import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fallbackGradeReason, fallbackHint, fallbackSimulateCustomer } from './fallback'
import { createAiClient, providerChain, resetAiQuota, resetAiRateLimiter, resolveProvider } from './index'
import { BackgroundGrader, InMemoryGradeJobStore } from './grade-queue'
import { ProviderRateLimiter, limitsFromEnv } from './rate-limiter'
import {
  DIMENSION_SCORE_MAX,
  RUBRIC_DIMENSION_IDS,
  WEIGHTED_MAX,
  WEIGHTED_MIN,
  starsFromWeighted,
  weightedTotal,
} from './rubric'

/** คำตอบรายด้านแบบที่โมเดลควรส่งกลับมา ใช้ในเทสต์เส้นทาง AI */
function aiDimensions(score = 3) {
  return RUBRIC_DIMENSION_IDS.map((id) => ({
    id,
    score,
    evidence: `อ้างจากสิ่งที่นักเรียนเขียนสำหรับ ${id}`,
    suggestion: `ลองต่อยอดด้าน ${id} อีกนิด`,
  }))
}

/** fetch ปลอมที่ตอบ JSON ตามที่กำหนด ใช้แทนการยิงเน็ตจริง */
function fakeFetch(payload: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch & { mock: { calls: unknown[][] } }
}

function geminiPayload(obj: unknown) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] }
}

function typhoonPayload(obj: unknown) {
  return { choices: [{ message: { content: JSON.stringify(obj) } }] }
}

beforeEach(() => {
  resetAiQuota()
  resetAiRateLimiter()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('เลือกผู้ให้บริการจาก key ที่มีจริง', () => {
  it('ไม่มี key เลยคืน null', () => {
    expect(resolveProvider({})).toBeNull()
    expect(resolveProvider({ GEMINI_API_KEY: '   ' })).toBeNull()
  })

  it('มี key ตัวไหนใช้ตัวนั้น', () => {
    expect(resolveProvider({ TYPHOON_API_KEY: 'k' })?.provider).toBe('typhoon')
    expect(resolveProvider({ GEMINI_API_KEY: 'k' })?.provider).toBe('gemini')
  })

  it('งานสั้นที่ผู้เรียนรอ ใช้ Typhoon ก่อน เพราะรับพร้อมกันได้มากกว่าและเร็วพอ ๆ กัน', () => {
    // วัดจริง 30 ก.ย. 2569: คำใบ้ typhoon 811 ms · gemini 1,020 ms · ความจุ 4 RPS ต่อ 1 RPS
    const env = { GEMINI_API_KEY: 'g', TYPHOON_API_KEY: 't' }
    expect(resolveProvider(env, 'hint')?.provider).toBe('typhoon')
    expect(resolveProvider(env, 'customer')?.provider).toBe('typhoon')
  })

  it('งานตรวจคำตอบในงบ 5 วินาที ใช้ Gemini ก่อน เพราะ Typhoon ใช้ 13.3 วินาที ไม่มีทางทัน', () => {
    const env = { GEMINI_API_KEY: 'g', TYPHOON_API_KEY: 't' }
    expect(resolveProvider(env, 'grade')?.provider).toBe('gemini')
    // แต่งเรื่องมีงบตั้งต้น 60 วินาทีเพราะเป็นคิวเบื้องหลัง ถ้าบีบเหลือ 5 วินาทีก็ต้องสลับเหมือนกัน
    expect(resolveProvider(env, 'story', 5000)?.provider).toBe('gemini')
  })

  it('งานเดียวกันแต่เป็นคิวเบื้องหลัง (งบ 60 วินาที) กลับไปใช้ Typhoon ก่อนเพราะรับได้มากกว่า', () => {
    const env = { GEMINI_API_KEY: 'g', TYPHOON_API_KEY: 't' }
    expect(resolveProvider(env, 'grade', 60_000)?.provider).toBe('typhoon')
    expect(resolveProvider(env, 'story')?.provider).toBe('typhoon')
  })
})

describe('ไม่มี API key ต้องทำงานได้เต็มรูปแบบ', () => {
  it('คำใบ้มาจากกฎล้วน และไม่มีการเรียกเน็ตแม้แต่ครั้งเดียว', async () => {
    const fetchImpl = fakeFetch({})
    const client = createAiClient({ env: {}, fetchImpl })

    const r = await client.hintFor({ missionId: 'm1', hintLevel: 1, studentId: 'stu-1' })

    expect(r.source).toBe('fallback')
    expect(r.provider).toBe('rules')
    expect(r.fallbackReason).toBe('no-api-key')
    expect(r.text.length).toBeGreaterThan(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('ตรวจเหตุผลด้วยกฎ และครูยังต้องยืนยันคะแนนเสมอ', async () => {
    const fetchImpl = fakeFetch({})
    const client = createAiClient({ env: {}, fetchImpl })

    const r = await client.gradeReason({
      tldId: 'in-th',
      reasonText: 'เลือก .in.th เพราะร้านยังไม่ได้จดทะเบียนบริษัท ใช้บัตรประชาชนยื่นได้',
    })

    expect(r.source).toBe('fallback')
    expect(r.needsTeacherConfirm).toBe(true)
    expect(r.dimensions).toHaveLength(RUBRIC_DIMENSION_IDS.length)
    expect(r.weightedTotal).toBeGreaterThanOrEqual(WEIGHTED_MIN)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('ลูกค้าจำลองเดินด้วยกฎ และให้ผลเดิมทุกครั้งสำหรับชื่อเดิม', async () => {
    const client = createAiClient({ env: {}, fetchImpl: fakeFetch({}) })
    const first = await client.simulateCustomer({ domainName: 'cake-shop', customerIndex: 1 })
    const second = await client.simulateCustomer({ domainName: 'cake-shop', customerIndex: 1 })

    expect(first.source).toBe('fallback')
    expect(first.correct).toBe(false)
    expect(first.typed).toBe('cakeshop')
    expect(second).toEqual(first)
  })

  it('ไม่ได้ส่ง fetch เข้ามาเลยก็ยังทำงานได้ ไม่พัง', async () => {
    const client = createAiClient({ env: {} })
    const r = await client.hintFor({ missionId: 'm2', hintLevel: 2 })
    expect(r.source).toBe('fallback')
  })
})

describe('มี API key แล้วโมเดลตอบปกติ', () => {
  it('ได้คำใบ้จาก AI พร้อม source เป็น ai', async () => {
    const fetchImpl = fakeFetch(geminiPayload({ text: 'ลองอ่านเงื่อนไขของช่องนั้นอีกรอบนะ' }))
    const client = createAiClient({ env: { GEMINI_API_KEY: 'test-key' }, fetchImpl })

    const r = await client.hintFor({ missionId: 'm1', hintLevel: 1, studentId: 'stu-1' })

    expect(r.source).toBe('ai')
    expect(r.provider).toBe('gemini')
    expect(r.fallbackReason).toBeNull()
    expect(r.text).toBe('ลองอ่านเงื่อนไขของช่องนั้นอีกรอบนะ')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('คะแนนจาก AI ก็ยังต้องให้ครูยืนยัน และถูกบีบให้อยู่ในช่วง 0-3', async () => {
    const fetchImpl = fakeFetch(typhoonPayload({ dimensions: aiDimensions(9) }))
    const client = createAiClient({ env: { TYPHOON_API_KEY: 'test-key' }, fetchImpl })

    const r = await client.gradeReason({ tldId: 'co-th', reasonText: 'ร้านจดทะเบียนบริษัทแล้ว' })

    expect(r.source).toBe('ai')
    expect(r.provider).toBe('typhoon')
    // โมเดลส่งคะแนน 9 มา ต้องถูกบีบให้อยู่ในช่วงของไฟล์เนื้อหา
    expect(r.dimensions.every((d) => d.score <= 3)).toBe(true)
    expect(r.needsTeacherConfirm).toBe(true)
  })

  it('ลูกค้า AI ที่พิมพ์ตรงกับชื่อจริง ถือว่าพิมพ์ถูก', async () => {
    const fetchImpl = fakeFetch(geminiPayload({ typed: 'kanomwan', comment: 'พิมพ์ตามแล้วนะ' }))
    const client = createAiClient({ env: { GEMINI_API_KEY: 'k' }, fetchImpl })

    const r = await client.simulateCustomer({ domainName: 'kanomwan' })
    expect(r.source).toBe('ai')
    expect(r.correct).toBe(true)
  })

  it('ส่ง key ไปใน header ไม่ใช่ใน URL และไม่มี env ขึ้นต้น NEXT_PUBLIC_', async () => {
    const fetchImpl = fakeFetch(geminiPayload({ text: 'คำใบ้' }))
    const client = createAiClient({ env: { GEMINI_API_KEY: 'secret-key' }, fetchImpl })
    await client.hintFor({ missionId: 'm1', hintLevel: 1 })

    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!
    expect(url).not.toContain('secret-key')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key')
  })
})

describe('AI พังต้องตกไปใช้ทางสำรอง ห้าม throw ให้ผู้ใช้เห็น', () => {
  it('key ปลอมแล้ว fetch โยน error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }) as unknown as typeof fetch
    const client = createAiClient({ env: { GEMINI_API_KEY: 'ปลอม' }, fetchImpl })

    const r = await client.hintFor({ missionId: 'm1', hintLevel: 1 })
    expect(r.source).toBe('fallback')
    expect(r.fallbackReason).toBe('request-failed')
    expect(r.text.length).toBeGreaterThan(0)
  })

  it('เซิร์ฟเวอร์ตอบ 500', async () => {
    const fetchImpl = fakeFetch({ error: 'boom' }, 500)
    const client = createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl })

    const r = await client.gradeReason({ tldId: 'com', reasonText: 'ชอบ' })
    expect(r.source).toBe('fallback')
    expect(r.fallbackReason).toBe('request-failed')
    expect(r.needsTeacherConfirm).toBe(true)
  })

  it('โมเดลตอบกลับมาไม่ใช่ JSON ที่ใช้ได้', async () => {
    const fetchImpl = fakeFetch(typhoonPayload({ ไม่มีฟิลด์ที่ต้องการ: true }))
    const client = createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl })

    const r = await client.hintFor({ missionId: 'm3', hintLevel: 1 })
    expect(r.source).toBe('fallback')
    expect(r.fallbackReason).toBe('bad-response')
  })

  it('ช้าเกินเวลาที่กำหนด ตกไปใช้ทางสำรอง และยกเลิกคำขอที่ค้างอยู่', async () => {
    let aborted = false
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true
            reject(new Error('aborted'))
          })
          setTimeout(() => resolve(new Response('{}')), 500)
        }),
    ) as unknown as typeof fetch

    const client = createAiClient({ env: { GEMINI_API_KEY: 'k' }, fetchImpl, timeoutMs: 20 })
    const r = await client.simulateCustomer({ domainName: 'cakeshop' })

    expect(r.source).toBe('fallback')
    expect(r.fallbackReason).toBe('timeout')
    expect(aborted).toBe(true)
  })
})

describe('โควตาต่อคนต่อคาบ', () => {
  it('เกินโควตาแล้วใช้ทางสำรอง และไม่ยิงเน็ตเพิ่ม', async () => {
    const fetchImpl = fakeFetch(geminiPayload({ text: 'คำใบ้จาก AI' }))
    const client = createAiClient({
      env: { GEMINI_API_KEY: 'k' },
      fetchImpl,
      maxCallsPerStudent: 2,
    })

    const first = await client.hintFor({ missionId: 'm1', hintLevel: 1, studentId: 'stu-1' })
    const second = await client.hintFor({ missionId: 'm1', hintLevel: 2, studentId: 'stu-1' })
    const third = await client.hintFor({ missionId: 'm1', hintLevel: 3, studentId: 'stu-1' })

    expect(first.source).toBe('ai')
    expect(second.source).toBe('ai')
    expect(third.source).toBe('fallback')
    expect(third.fallbackReason).toBe('quota-exceeded')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('โควตาแยกรายคน คนอื่นไม่โดนตัดสิทธิ์ตาม', async () => {
    const fetchImpl = fakeFetch(geminiPayload({ text: 'คำใบ้' }))
    const client = createAiClient({ env: { GEMINI_API_KEY: 'k' }, fetchImpl, maxCallsPerStudent: 1 })

    await client.hintFor({ missionId: 'm1', hintLevel: 1, studentId: 'stu-1' })
    const blocked = await client.hintFor({ missionId: 'm1', hintLevel: 2, studentId: 'stu-1' })
    const other = await client.hintFor({ missionId: 'm1', hintLevel: 1, studentId: 'stu-2' })

    expect(blocked.source).toBe('fallback')
    expect(other.source).toBe('ai')
  })

  it('อ่านโควตาจาก env ได้ และล้างตัวนับตอนเริ่มคาบใหม่ได้', async () => {
    const fetchImpl = fakeFetch(geminiPayload({ text: 'คำใบ้' }))
    const client = createAiClient({
      env: { GEMINI_API_KEY: 'k', AI_MAX_CALLS_PER_STUDENT: '1' },
      fetchImpl,
    })

    await client.hintFor({ missionId: 'm1', hintLevel: 1, studentId: 'stu-9' })
    expect((await client.hintFor({ missionId: 'm1', hintLevel: 2, studentId: 'stu-9' })).source).toBe(
      'fallback',
    )

    resetAiQuota('stu-9')
    expect((await client.hintFor({ missionId: 'm1', hintLevel: 3, studentId: 'stu-9' })).source).toBe(
      'ai',
    )
  })
})

describe('ทางสำรองแบบกฎล้วน', () => {
  it('ชื่อที่พิมพ์ค้างไว้ยังผิดกฎ คำใบ้ต้องพูดถึงกฎข้อนั้นก่อนคำใบ้ทั่วไป', () => {
    const r = fallbackHint({ missionId: 'm1', hintLevel: 1, draftName: 'ab' })
    expect(r.text).toContain('สั้นไป')
    expect(r.source).toBe('fallback')
  })

  it('ยังไม่ได้พิมพ์ชื่อ ใช้คำใบ้ของภารกิจตามระดับที่ขอ', () => {
    const level1 = fallbackHint({ missionId: 'm1', hintLevel: 1 })
    const level2 = fallbackHint({ missionId: 'm1', hintLevel: 2 })
    expect(level1.text).not.toBe(level2.text)
    expect(level1.text.length).toBeGreaterThan(0)
  })

  it('ภารกิจที่ไม่มีคำใบ้ในไฟล์เนื้อหา ยังได้ข้อความกลาง ๆ ไม่พัง', () => {
    const r = fallbackHint({ missionId: 'ไม่มีภารกิจนี้', hintLevel: 9 })
    expect(r.text.length).toBeGreaterThan(0)
  })

  it('เหตุผลสั้นและไม่อ้างเงื่อนไข ได้คะแนนน้อยพร้อมคำแนะนำที่ทำต่อได้', () => {
    const r = fallbackGradeReason({ tldId: 'co-th', reasonText: 'ชอบ' })
    const reason = r.dimensions.find((d) => d.id === 'dim-customer-reason')!
    expect(reason.score).toBe(1)
    expect(reason.suggestion.length).toBeGreaterThan(0)
    expect(r.needsTeacherConfirm).toBe(true)
  })

  it('ลูกค้าคนแรกพิมพ์ตามที่ได้ยินได้ถูกเสมอ', () => {
    const r = fallbackSimulateCustomer({ domainName: 'cake-shop', customerIndex: 0 })
    expect(r.correct).toBe(true)
  })

  it('ชื่อที่ไม่กำกวมเลย ลูกค้าคนหลังก็ยังพิมพ์ถูก', () => {
    const r = fallbackSimulateCustomer({ domainName: 'kanomwan', customerIndex: 1 })
    expect(r.correct).toBe(true)
  })

  it('ชื่อที่มีเลขออกเสียงเหมือนคำ ทำให้ลูกค้าพิมพ์ผิด', () => {
    const r = fallbackSimulateCustomer({ domainName: 'cake4you', customerIndex: 1 })
    expect(r.correct).toBe(false)
    expect(r.typed).toBe('cakefouryou')
  })

  it('ทุกผลลัพธ์ของทางสำรองมี source ติดมาเสมอ', () => {
    expect(fallbackHint({ missionId: 'm1', hintLevel: 1 }).source).toBe('fallback')
    expect(fallbackGradeReason({ tldId: 'com', reasonText: 'x' }).source).toBe('fallback')
    expect(fallbackSimulateCustomer({ domainName: 'x' }).source).toBe('fallback')
  })
})

describe('ตรวจใบเสนอชื่อเว็บรายด้านตามรูบริก', () => {
  const goodWork = {
    tldId: 'in-th',
    domainName: 'kanomwan',
    shopName: 'ขนมหวาน',
    businessTypeId: 'bakery',
    reasonText:
      'เลือก .in.th เพราะลูกค้าของร้านขนมเป็นคนไทยในย่านเดียวกัน และร้านยังไม่ได้จดทะเบียนบริษัท ใช้บัตรประชาชนยื่นได้',
  }

  it('ไม่มีคีย์ AI ก็ยังให้คะแนนครบทั้ง 4 ด้านตามไฟล์เนื้อหา', () => {
    const r = fallbackGradeReason(goodWork)
    expect(r.dimensions.map((d) => d.id)).toEqual(RUBRIC_DIMENSION_IDS)
    expect(r.source).toBe('fallback')
    expect(r.provider).toBe('rules')
  })

  it('ทุกด้านมีหลักฐานและข้อเสนอแนะ ไม่มีช่องว่าง', () => {
    for (const work of [goodWork, { tldId: '', reasonText: '' }]) {
      for (const d of fallbackGradeReason(work).dimensions) {
        expect(d.evidence.trim().length).toBeGreaterThan(0)
        expect(d.suggestion.trim().length).toBeGreaterThan(0)
        expect(d.levelLabel.length).toBeGreaterThan(0)
      }
    }
  })

  it('ข้อเสนอแนะไม่มีคำตำหนิและไม่เปรียบเทียบกับเพื่อน', () => {
    const blame = ['ไม่เก่ง', 'แย่', 'ล้มเหลว', 'ผิดหมด', 'ไม่ตั้งใจ', 'น่าเสียดาย']
    // ห้ามเปรียบเทียบ ไม่ใช่ห้ามพูดถึงเพื่อนเลย — "ให้เพื่อนพิมพ์ตาม" เป็นวิธีตรวจที่รูบริกกำหนดไว้เอง
    const compare = ['กว่าเพื่อน', 'เทียบกับเพื่อน', 'ค่าเฉลี่ย', 'อันดับ', 'คนอื่นทำได้']
    for (const work of [goodWork, { tldId: 'go-th', reasonText: 'ชอบ', domainName: 'ab' }]) {
      for (const d of fallbackGradeReason(work).dimensions) {
        for (const word of [...blame, ...compare]) expect(d.suggestion).not.toContain(word)
      }
    }
  })

  it('หลักฐานยกสิ่งที่นักเรียนเขียนมาอ้างจริง', () => {
    const r = fallbackGradeReason(goodWork)
    const naming = r.dimensions.find((d) => d.id === 'dim-naming')!
    expect(naming.evidence).toContain('kanomwan')
    const reason = r.dimensions.find((d) => d.id === 'dim-customer-reason')!
    expect(reason.evidence).toContain('ลูกค้า')
  })

  it('ด้านที่ผู้เรียนขอให้เน้น ถูกถ่วง 2 เท่าจริง', () => {
    const plain = fallbackGradeReason(goodWork)
    const emphasized = fallbackGradeReason({ ...goodWork, emphasisCriterion: 'emphasis-naming' })
    const namingScore = plain.dimensions.find((d) => d.id === 'dim-naming')!.score
    const others = plain.dimensions
      .filter((d) => d.id !== 'dim-naming')
      .reduce((sum, d) => sum + d.score, 0)

    expect(emphasized.emphasisDimensionId).toBe('dim-naming')
    expect(emphasized.dimensions.find((d) => d.id === 'dim-naming')!.emphasized).toBe(true)
    expect(emphasized.weightedTotal).toBe(Math.min(WEIGHTED_MAX, namingScore * 2 + others))
  })

  it('รับรหัสด้านตรง ๆ ก็ถ่วงให้เหมือนกัน', () => {
    const byOption = fallbackGradeReason({ ...goodWork, emphasisCriterion: 'emphasis-tld-fit' })
    const byDimension = fallbackGradeReason({ ...goodWork, emphasisCriterion: 'dim-tld-fit' })
    expect(byDimension.weightedTotal).toBe(byOption.weightedTotal)
    expect(byDimension.emphasisDimensionId).toBe('dim-tld-fit')
  })

  it('คะแนนถ่วงน้ำหนักอยู่ในช่วงของไฟล์เนื้อหาเสมอ ไม่ว่าทำดีแค่ไหนหรือแย่แค่ไหน', () => {
    const works = [
      goodWork,
      { tldId: '', reasonText: '' },
      { ...goodWork, emphasisCriterion: 'emphasis-business-link' },
      { tldId: 'go-th', reasonText: 'ชอบ', domainName: 'a' },
    ]
    for (const work of works) {
      const r = fallbackGradeReason(work)
      expect(r.weightedTotal).toBeGreaterThanOrEqual(WEIGHTED_MIN)
      expect(r.weightedTotal).toBeLessThanOrEqual(WEIGHTED_MAX)
      expect(r.weightedMax).toBe(WEIGHTED_MAX)
    }
  })

  it('ดาวแปลงจากคะแนนถ่วงน้ำหนักด้วย starBands เท่านั้น', () => {
    for (const work of [goodWork, { tldId: '', reasonText: '' }]) {
      const r = fallbackGradeReason(work)
      expect(r.stars).toBe(starsFromWeighted(r.weightedTotal, true))
      expect(r.stars).toBeGreaterThanOrEqual(1)
      expect(r.stars).toBeLessThanOrEqual(3)
    }
  })

  it('งานที่ทำครบทุกด้านได้คะแนนสูงกว่างานที่ยังไม่ได้กรอกอะไรเลย', () => {
    const good = fallbackGradeReason(goodWork)
    const empty = fallbackGradeReason({ tldId: '', reasonText: '' })
    expect(good.weightedTotal).toBeGreaterThan(empty.weightedTotal)
    expect(good.dimensions.every((d) => d.score <= DIMENSION_SCORE_MAX)).toBe(true)
  })

  it('สูตรถ่วงน้ำหนักตรงกับที่เขียนไว้ในไฟล์เนื้อหา', () => {
    const scores = { 'dim-naming': 3, 'dim-tld-fit': 2, 'dim-customer-reason': 2, 'dim-business-link': 1 }
    // (ด้านที่เน้น x 2) + อีก 3 ด้าน = (3x2) + 2 + 2 + 1 = 11
    expect(weightedTotal(scores, 'dim-naming')).toBe(11)
    // ไม่เลือกด้านไหน ระบบถ่วงด้านที่ทำได้ดีที่สุดให้ จะได้ไม่เสียเปรียบคนที่เลือก
    expect(weightedTotal(scores, null)).toBe(11)
  })

  it('เส้นทาง AI ที่ให้คะแนนไม่ครบทุกด้าน ตกไปใช้กฎล้วน ไม่ส่งผลครึ่ง ๆ กลาง ๆ ให้ครู', async () => {
    const fetchImpl = fakeFetch(
      geminiPayload({ dimensions: aiDimensions(3).slice(0, 2) }),
    )
    const client = createAiClient({ env: { GEMINI_API_KEY: 'k' }, fetchImpl })
    const r = await client.gradeReason(goodWork)

    expect(r.source).toBe('fallback')
    expect(r.fallbackReason).toBe('bad-response')
    expect(r.dimensions).toHaveLength(RUBRIC_DIMENSION_IDS.length)
  })

  it('เส้นทาง AI ที่ตอบครบ ได้คะแนนรายด้านจากโมเดล แต่ดาวคำนวณฝั่งเราเอง', async () => {
    const fetchImpl = fakeFetch(geminiPayload({ dimensions: aiDimensions(3) }))
    const client = createAiClient({ env: { GEMINI_API_KEY: 'k' }, fetchImpl })
    const r = await client.gradeReason({ ...goodWork, emphasisCriterion: 'emphasis-naming' })

    expect(r.source).toBe('ai')
    expect(r.dimensions).toHaveLength(RUBRIC_DIMENSION_IDS.length)
    expect(r.weightedTotal).toBe(WEIGHTED_MAX)
    expect(r.stars).toBe(starsFromWeighted(WEIGHTED_MAX, true))
    expect(r.needsTeacherConfirm).toBe(true)
  })
})

describe('คิวจำกัดอัตราต่อผู้ให้บริการ', () => {
  /** นาฬิกาปลอม จะได้ทดสอบคิวโดยไม่ต้องรอจริงและไม่ยิงเน็ต */
  function fakeClock() {
    let now = 1_759_000_000_000
    return {
      now: () => now,
      sleep: async (ms: number) => {
        now += ms
      },
      advance: (ms: number) => {
        now += ms
      },
    }
  }

  it('ยิงได้ตามลิมิตต่อวินาที พอครบต้องรอถึงวินาทีถัดไป', async () => {
    const clock = fakeClock()
    const limiter = new ProviderRateLimiter({ typhoon: { rps: 2, rpm: 100 } }, clock)

    expect(await limiter.acquire('typhoon', 5000)).toBe(true)
    expect(await limiter.acquire('typhoon', 5000)).toBe(true)
    expect(limiter.waitMs('typhoon')).toBeGreaterThan(0)
    expect(await limiter.acquire('typhoon', 5000)).toBe(true)
    expect(limiter.usedInLastMinute('typhoon')).toBe(3)
  })

  it('ยิงพร้อมกันทั้งห้อง คิวต้องกันได้จริง ไม่ใช่ปล่อยผ่านทั้งหมดเพราะทุกคนเห็นคิวว่างพร้อมกัน', async () => {
    // นาฬิกาหยุดนิ่ง = จำลอง "ทุกคนกดในเสี้ยววินาทีเดียวกัน" ตามจริง
    const frozen = 1_759_000_000_000
    const clock = { now: () => frozen, sleep: async () => {} }
    const limiter = new ProviderRateLimiter({ gemini: { rps: 3, rpm: 12 } }, clock)

    // 10 คำขอออกตัวพร้อมกัน แต่ละคนยอมรอได้ 1.5 วินาที
    const results = await Promise.all(
      Array.from({ length: 10 }, () => limiter.acquire('gemini', 1500)),
    )

    const passed = results.filter(Boolean).length
    // 3 ช่องแรกได้ทันที · อีก 3 ช่องรอ 1 วินาที · ที่เหลือต้องรอ 2 วินาทีขึ้นไป = เกินงบ
    expect(passed).toBe(6)
    expect(limiter.usedInLastMinute('gemini')).toBe(6)
  })

  it('คิวยาวเกินงบเวลา ต้องคืน false ทันที ไม่ให้นักเรียนนั่งรอ', async () => {
    const clock = fakeClock()
    const limiter = new ProviderRateLimiter({ gemini: { rps: 1, rpm: 5 } }, clock)

    expect(await limiter.acquire('gemini', 5000)).toBe(true)
    // ต้องรออีกเกือบ 1 วินาที แต่ให้งบแค่ 100 มิลลิวินาที
    expect(await limiter.acquire('gemini', 100)).toBe(false)
  })

  it('จำกัดต่อนาทีด้วย ไม่ใช่แค่ต่อวินาที', async () => {
    const clock = fakeClock()
    const limiter = new ProviderRateLimiter({ gemini: { rps: 10, rpm: 3 } }, clock)

    for (let i = 0; i < 3; i++) expect(await limiter.acquire('gemini', 10_000)).toBe(true)
    expect(limiter.waitMs('gemini')).toBeGreaterThan(0)

    clock.advance(60_001)
    expect(limiter.waitMs('gemini')).toBe(0)
    expect(limiter.usedInLastMinute('gemini')).toBe(0)
  })

  it('ผู้ให้บริการที่ไม่ได้ตั้งลิมิตไว้ ไม่ถูกจำกัด', async () => {
    const limiter = new ProviderRateLimiter({}, fakeClock())
    expect(limiter.waitMs('ไม่รู้จัก')).toBe(0)
    expect(await limiter.acquire('ไม่รู้จัก', 0)).toBe(true)
  })

  it('อ่านลิมิตจาก env ได้ และมีค่าเริ่มต้นที่ปลอดภัยเมื่อไม่ได้ตั้ง', () => {
    const fromEnv = limitsFromEnv({ TYPHOON_RPS: '2', GEMINI_RPM: '9' })
    expect(fromEnv.typhoon!.rps).toBe(2)
    expect(fromEnv.gemini!.rpm).toBe(9)

    const defaults = limitsFromEnv({})
    // Typhoon จริง 5 RPS / 200 RPM · Gemini free tier สาย Flash Lite 15 RPM
    expect(defaults.typhoon!.rps).toBeLessThanOrEqual(5)
    expect(defaults.typhoon!.rpm).toBeLessThanOrEqual(200)
    expect(defaults.gemini!.rpm).toBeLessThanOrEqual(15)
  })

  it('คิวเต็มแล้วชั้นนั้นถูกข้าม ไปใช้เจ้าถัดไปหรือกฎ โดยไม่ยิงเน็ตเพิ่ม', async () => {
    const clock = fakeClock()
    const limiter = new ProviderRateLimiter(
      { typhoon: { rps: 1, rpm: 1 }, gemini: { rps: 1, rpm: 1 } },
      clock,
    )
    const fetchImpl = fakeFetch(typhoonPayload({ text: 'คำใบ้จาก AI' }))
    const client = createAiClient({
      env: { TYPHOON_API_KEY: 't', GEMINI_API_KEY: 'g' },
      fetchImpl,
      limiter,
    })

    const first = await client.hintFor({ missionId: 'm1', hintLevel: 1 })
    expect(first.source).toBe('ai')
    // จองคิวของ Gemini ให้เต็มด้วย จำลองว่าทั้งสองเจ้าถูกใช้จนเต็มลิมิตแล้ว
    expect(await limiter.acquire('gemini', 0)).toBe(true)

    // คิวของทั้งสองเจ้าเต็มแล้ว คำขอถัดไปต้องตกกฎทันทีโดยไม่ยิงเน็ตเพิ่ม
    const callsBefore = (fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    const second = await client.hintFor({ missionId: 'm1', hintLevel: 2 })
    expect(second.source).toBe('fallback')
    expect(second.fallbackReason).toBe('rate-limited')
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(callsBefore)
  })

  it('ลำดับลูกโซ่ตัดสินจากงบเวลาของงานนั้น ไม่ใช่ลำดับตายตัว', () => {
    const env = { TYPHOON_API_KEY: 't', GEMINI_API_KEY: 'g' }
    // งานสั้น: ทันทั้งคู่ เรียงตามความจุ (typhoon 4 RPS > gemini 1 RPS)
    expect(providerChain(env, 'hint').map((c) => c.provider)).toEqual(['typhoon', 'gemini'])
    // งานยาวในงบ 5 วินาที: typhoon ไม่ทัน ตกไปท้ายแถว
    expect(providerChain(env, 'grade').map((c) => c.provider)).toEqual(['gemini', 'typhoon'])
    // งานเดียวกันในคิวเบื้องหลัง: ทันทั้งคู่ กลับไปเรียงตามความจุ
    expect(providerChain(env, 'grade', 60_000).map((c) => c.provider)).toEqual([
      'typhoon',
      'gemini',
    ])
    expect(providerChain({ GEMINI_API_KEY: 'g' }).map((c) => c.provider)).toEqual(['gemini'])
    expect(providerChain({})).toEqual([])
  })

  it('ปรับความจุผ่าน env แล้วลำดับเปลี่ยนตาม ไม่ต้องแก้โค้ด', () => {
    // เปิด billing ของ Gemini แล้วตั้ง GEMINI_RPS สูงกว่า Typhoon
    const env = { TYPHOON_API_KEY: 't', GEMINI_API_KEY: 'g', GEMINI_RPS: '10' }
    expect(providerChain(env, 'hint').map((c) => c.provider)).toEqual(['gemini', 'typhoon'])
  })

  it('ทับเวลาตอบที่วัดไว้ผ่าน env ได้ เผื่อผู้ให้บริการเร็วขึ้นกลางคาบ', () => {
    const env = { TYPHOON_API_KEY: 't', GEMINI_API_KEY: 'g', AI_LATENCY_TYPHOON_GRADE: '1500' }
    // typhoon ตอบงานตรวจใน 1.5 วินาทีแล้ว จึงทันงบ 5 วินาที และได้ที่หนึ่งคืนจากความจุ
    expect(providerChain(env, 'grade').map((c) => c.provider)).toEqual(['typhoon', 'gemini'])
  })
})

describe('คิวตรวจงานเบื้องหลัง', () => {
  const submission = {
    submissionId: 'sub-1',
    studentId: 'stu-1',
    tldId: 'in-th',
    domainName: 'kanomwan',
    shopName: 'ขนมหวาน',
    businessTypeId: 'bakery',
    reasonText: 'เลือก .in.th เพราะลูกค้าเป็นคนไทยในย่านเดียวกัน และร้านยังไม่ได้จดทะเบียนบริษัท',
    emphasisCriterion: 'emphasis-naming',
  }

  function makeGrader(over: Partial<ConstructorParameters<typeof BackgroundGrader>[0]> = {}) {
    const store = new InMemoryGradeJobStore()
    const fetchImpl = fakeFetch(typhoonPayload({ dimensions: aiDimensions(2) }))
    const client = createAiClient({ env: { TYPHOON_API_KEY: 't' }, fetchImpl })
    const grader = new BackgroundGrader({ client, store, concurrency: 1, ...over })
    return { store, grader, fetchImpl }
  }

  it('นักเรียนกดส่งแล้วได้ผลจากกฎทันที ไม่ต้องรอ AI และยังไม่มีการยิงเน็ต', async () => {
    const { grader, fetchImpl } = makeGrader()
    const started = Date.now()
    const result = await grader.submit(submission)

    expect(result.rules.source).toBe('fallback')
    expect(result.rules.dimensions).toHaveLength(RUBRIC_DIMENSION_IDS.length)
    expect(result.rules.stars).toBeGreaterThanOrEqual(1)
    expect(Date.now() - started).toBeLessThan(200)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('งานถูกฝากเข้าคิวไว้ให้ตรวจทีหลัง', async () => {
    const { grader, store } = makeGrader()
    const { jobId } = await grader.submit(submission)

    expect((await store.get(jobId))?.status).toBe('pending')
    expect((await grader.status()).pending).toBe(1)
  })

  it('ตรวจเบื้องหลังเสร็จแล้วเก็บเป็นข้อเสนอ ไม่ไปทับดาวที่นักเรียนเห็นแล้ว', async () => {
    const { grader } = makeGrader()
    const submitted = await grader.submit(submission)
    const studentStars = submitted.rules.stars

    await grader.drain()

    const suggestion = await grader.aiSuggestionFor('stu-1')
    expect(suggestion?.source).toBe('ai')
    expect(suggestion?.dimensions).toHaveLength(RUBRIC_DIMENSION_IDS.length)
    expect(suggestion?.needsTeacherConfirm).toBe(true)
    // ผลที่นักเรียนเห็นยังเป็นค่าเดิมทุกประการ
    expect(submitted.rules.stars).toBe(studentStars)
    expect((await grader.status()).done).toBe(1)
  })

  it('ผู้ให้บริการยังไม่ว่าง งานถูกโยนกลับเข้าคิว ไม่หายและไม่นับว่าเสร็จ', async () => {
    const { grader, store } = makeGrader({
      client: createAiClient({ env: {} }), // ไม่มีคีย์ = ได้แต่ผลจากกฎ ยังไม่ใช่ AI
      store: new InMemoryGradeJobStore(),
    })
    const { jobId } = await grader.submit(submission)
    await grader.drain(3)

    const job = await store.get(jobId)
    // งานอยู่ในคิวของ grader ตัวที่สร้างเอง ไม่ใช่ store ตัวนี้ จึงเช็กจากสถานะรวมแทน
    expect(job === null || job.status !== 'done').toBe(true)
    const counts = await grader.status()
    expect(counts.done).toBe(0)
    expect(counts.pending + counts.failed).toBeGreaterThan(0)
  })

  it('ลองซ้ำได้ไม่เกินจำนวนที่กำหนด แล้วหยุด ไม่วนไม่จบ', async () => {
    const store = new InMemoryGradeJobStore()
    const grader = new BackgroundGrader({
      client: createAiClient({ env: {} }),
      store,
      concurrency: 1,
      maxAttempts: 2,
    })
    await grader.submit(submission)
    await grader.drain(20)

    const counts = await grader.status()
    expect(counts.failed).toBe(1)
    expect(counts.pending).toBe(0)
  })

  it('สถานะคิวอ่านจากที่เก็บภายนอกได้ จึงต่อฐานข้อมูลแทนหน่วยความจำได้ทีหลัง', async () => {
    const store = new InMemoryGradeJobStore()
    const { grader } = makeGrader({ store })
    await grader.submit(submission)

    // จำลองเซิร์ฟเวอร์รีสตาร์ต: สร้างตัวตรวจใหม่จาก store เดิม งานที่ค้างต้องยังอยู่
    const revived = new BackgroundGrader({
      client: createAiClient({ env: { TYPHOON_API_KEY: 't' }, fetchImpl: fakeFetch(typhoonPayload({ dimensions: aiDimensions(3) })) }),
      store,
      concurrency: 1,
    })
    expect((await revived.status()).pending).toBe(1)
    await revived.drain()
    expect((await revived.status()).done).toBe(1)
  })
})

/**
 * T61 — ต้นเหตุที่ AI ไม่เคยได้ใช้จริงในงานตรวจคำตอบ
 * เดิม providerChain ทิ้งชนิดงาน ทุกงานจึงยิง Typhoon ก่อน ซึ่งใช้ 13.3 วินาทีกับงานนี้
 * หมดเวลาทุกครั้งแล้วยังเผางบไปครึ่งหนึ่ง เหลือให้ Gemini ไม่พอทำงาน
 */
describe('แบ่งงบเวลาตามชนิดงานและบริบท', () => {
  /** fetch ปลอมที่แยกคำตอบตามผู้ให้บริการ และจำว่าใครถูกเรียกบ้าง */
  function routedFetch(options: { geminiStatus?: number; typhoonStatus?: number } = {}) {
    const hits: string[] = []
    const impl = vi.fn(async (url: string) => {
      const isGemini = String(url).includes('generativelanguage')
      hits.push(isGemini ? 'gemini' : 'typhoon')
      const status = isGemini ? (options.geminiStatus ?? 200) : (options.typhoonStatus ?? 200)
      const body = isGemini
        ? geminiPayload({ dimensions: aiDimensions(3) })
        : typhoonPayload({ dimensions: aiDimensions(2) })
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    return { impl, hits }
  }

  const bothKeys = { TYPHOON_API_KEY: 't', GEMINI_API_KEY: 'g' }
  const submission = { tldId: 'in-th', reasonText: 'ลูกค้าเป็นคนไทยในย่านเดียวกัน' }

  it('งานตรวจคำตอบที่ผู้เรียนรอ ยิง Gemini ตัวเดียวจบ ไม่แตะ Typhoon เลย', async () => {
    const { impl, hits } = routedFetch()
    const client = createAiClient({ env: bothKeys, fetchImpl: impl })

    const result = await client.gradeReason(submission)

    expect(result.source).toBe('ai')
    expect(result.provider).toBe('gemini')
    expect(hits).toEqual(['gemini'])
  })

  it('Gemini พังแล้ว **ไม่ยิง Typhoon ต่อ** เพราะงบที่เหลือไม่มีทางพอ — ตกกฎทันทีแทนการรอเก้อ', async () => {
    const { impl, hits } = routedFetch({ geminiStatus: 500 })
    const attempts: { provider: string; reason?: string; detail?: string }[] = []
    const client = createAiClient({
      env: bothKeys,
      fetchImpl: impl,
      onAttempt: (a) => attempts.push({ provider: a.provider, reason: a.reason, detail: a.detail }),
    })

    const result = await client.gradeReason(submission)

    expect(result.source).toBe('fallback')
    expect(hits).toEqual(['gemini']) // Typhoon ไม่ถูกยิงเลย
    const skipped = attempts.find((a) => a.provider === 'typhoon')
    expect(skipped?.reason).toBe('timeout')
    expect(skipped?.detail).toContain('ไม่พอ')
    // กฎล้วนยังให้คะแนนครบและยังต้องให้ครูยืนยัน
    expect(result.needsTeacherConfirm).toBe(true)
    expect(result.dimensions).toHaveLength(RUBRIC_DIMENSION_IDS.length)
  })

  it('งานเดียวกันในคิวเบื้องหลัง (งบ 60 วินาที) ยิง Typhoon ก่อน เพราะรับพร้อมกันได้มากกว่า', async () => {
    const { impl, hits } = routedFetch()
    const client = createAiClient({ env: bothKeys, fetchImpl: impl, timeoutMs: 60_000 })

    const result = await client.gradeReason(submission)

    expect(result.provider).toBe('typhoon')
    expect(hits).toEqual(['typhoon'])
  })

  it('มีเจ้าเดียวในลูกโซ่ ต้องได้ลองเสมอ แม้ตารางเวลาจะบอกว่าช้าเกินงบ', async () => {
    // ป้องกันตารางเวลาที่ล้าสมัยปิดสวิตช์ AI ทั้งระบบโดยไม่เคยยิงสักครั้ง
    const { impl, hits } = routedFetch()
    const client = createAiClient({ env: { TYPHOON_API_KEY: 't' }, fetchImpl: impl })

    const result = await client.gradeReason(submission)

    expect(hits).toEqual(['typhoon'])
    expect(result.source).toBe('ai')
  })

  it('คำใบ้ยังยิง Typhoon ก่อนเหมือนเดิม งานสั้นเจ้านี้เร็วกว่าและรับได้มากกว่า', async () => {
    const hits: string[] = []
    const impl = vi.fn(async (url: string) => {
      const isGemini = String(url).includes('generativelanguage')
      hits.push(isGemini ? 'gemini' : 'typhoon')
      const body = isGemini
        ? geminiPayload({ text: 'ลองอ่านชื่อออกเสียงดูอีกครั้ง' })
        : typhoonPayload({ text: 'ลองอ่านชื่อออกเสียงดูอีกครั้ง' })
      return new Response(JSON.stringify(body), { status: 200 })
    }) as unknown as typeof fetch

    const client = createAiClient({ env: bothKeys, fetchImpl: impl })
    const result = await client.hintFor({ missionId: 'm1', hintLevel: 1 })

    expect(result.source).toBe('ai')
    expect(hits).toEqual(['typhoon'])
  })

  it('ชั้นแรกพังในงานสั้น ชั้นสองต้องได้เวลาจริงไปทำงานต่อ ไม่ใช่เหลือเศษ', async () => {
    const hits: string[] = []
    const impl = vi.fn(async (url: string) => {
      const isGemini = String(url).includes('generativelanguage')
      hits.push(isGemini ? 'gemini' : 'typhoon')
      return isGemini
        ? new Response(JSON.stringify(geminiPayload({ text: 'ลองออกเสียงชื่อดูอีกที' })), {
            status: 200,
          })
        : new Response(JSON.stringify({ error: 'boom' }), { status: 500 })
    }) as unknown as typeof fetch

    const client = createAiClient({ env: bothKeys, fetchImpl: impl })
    const result = await client.hintFor({ missionId: 'm1', hintLevel: 1 })

    expect(hits).toEqual(['typhoon', 'gemini'])
    expect(result.source).toBe('ai')
    expect(result.provider).toBe('gemini')
  })

  it('ไม่มีคีย์เลย ทุกงานยังเดินจบด้วยกฎ และบอกที่มาได้ทุกก้อน', async () => {
    const netCall = vi.fn() as unknown as typeof fetch
    const client = createAiClient({ env: {}, fetchImpl: netCall })

    const graded = await client.gradeReason(submission)
    const hinted = await client.hintFor({ missionId: 'm1', hintLevel: 1 })
    const customer = await client.simulateCustomer({ domainName: 'cakeshop' })

    for (const result of [graded, hinted, customer]) {
      expect(result.source).toBe('fallback')
      expect(result.fallbackReason).toBe('no-api-key')
    }
    expect((netCall as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0)
  })
})

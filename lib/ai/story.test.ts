import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import storySeedsJson from '../../content/story-seeds.json'
import { createAiClient, resetAiQuota, resetAiRateLimiter } from './index'
import {
  MAX_STORY_WORDS,
  STORY_IDS,
  checkStoryText,
  fallbackStorySet,
  fallbackStoryText,
  fillPlaceholders,
  isValidSlug,
  looksLikeDomain,
  resolveCategory,
  SLUG_FALLBACK_PROMPT,
  slugFromBrand,
} from './story'
import { InMemoryStoryJobStore, STORY_TIMEOUT_MS, StoryQueue } from './story-queue'
import type { StoryInput } from './types'

const INPUT: StoryInput = {
  studentId: 'stu-1',
  nickname: 'พลอย',
  brandName: 'ขนมบ้านยาย',
  description: 'ขนมไทยทำเอง',
  customers: 'ลูกค้าในชุมชน',
  businessTypeId: 'bakery',
  isRegisteredCompany: false,
}

/** เรื่องราวปลอมที่ผ่านทุกข้อในรายการตรวจของสเปก */
function aiIntros(brand = INPUT.brandName) {
  return Object.fromEntries(
    STORY_IDS.map((id) => [id, `${brand} มีเรื่องให้ CEO {ชื่อ} ช่วยคิดในโจทย์ ${id} ครับ`]),
  )
}

function storyPayload(over: Record<string, unknown> = {}) {
  return {
    brand_slug: 'bankhanomyai',
    brand_slug_alternatives: ['khanombanyai'],
    intros: aiIntros(),
    safety: { famous_brand: false, inappropriate: false },
    ...over,
  }
}

function fakeFetch(payload: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch & { mock: { calls: unknown[][] } }
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

describe('คลังเรื่องราวอยู่ในไฟล์เนื้อหา', () => {
  it('มีครบ 10 เรื่องตามสเปก E-07 และทุกเรื่องมีทั้งแก่นเรื่องและประโยคสำรอง', () => {
    expect(STORY_IDS).toEqual(['M1', 'M2', 'M3', 'M4', 'B-T1', 'B-T2', 'B-T3', 'B-T4', 'B-T5', 'B-T6'])
    expect(STORY_IDS).toHaveLength(storySeedsJson.meta.storyCount)
    for (const row of storySeedsJson.stories) {
      expect(row.seed.length).toBeGreaterThan(10)
      expect(row.fallback.length).toBeGreaterThan(10)
    }
  })

  it('ตัวละครมาจากหมวดธุรกิจ จัดไม่ได้ใช้หมวดอื่น ๆ และตัวละครหุ้นส่วน', () => {
    expect(resolveCategory(INPUT).character).toBe('ยาย')
    expect(resolveCategory({ ...INPUT, businessTypeId: 'game' }).character).toBe('โค้ชทีม')
    const unknown = resolveCategory({ ...INPUT, businessTypeId: 'ไม่มีหมวดนี้' })
    expect(unknown.name).toBe('อื่น ๆ')
    expect(unknown.character).toBe('หุ้นส่วน')
  })
})

describe('ประโยคสำรอง เติมด้วยข้อมูลจริงของนักเรียนแบบกฎล้วน', () => {
  it('แทนสัญลักษณ์ครบทุกตัว ไม่มี { } หลงเหลือ', () => {
    for (const id of STORY_IDS) {
      const text = fallbackStoryText(id, INPUT)
      expect(text).not.toMatch(/[{}]/)
      expect(text).toContain('พลอย')
    }
  })

  it('ใช้ชื่อแบรนด์และตัวละครของนักเรียนคนนั้นจริง', () => {
    const m1 = fallbackStoryText('M1', INPUT)
    expect(m1).toContain('ขนมบ้านยาย')
    expect(m1).toContain('ยาย')

    const other = fallbackStoryText('M1', { ...INPUT, brandName: 'เกมเมอร์ช็อป', businessTypeId: 'game' })
    expect(other).toContain('เกมเมอร์ช็อป')
    expect(other).toContain('โค้ชทีม')
  })

  it('B-T4 เปลี่ยนเรื่องตามสถานะการจดทะเบียนของร้าน', () => {
    expect(fallbackStoryText('B-T4', INPUT)).toContain('ยังไม่ได้จดทะเบียน')
    expect(fallbackStoryText('B-T4', { ...INPUT, isRegisteredCompany: true })).toContain(
      'จดทะเบียนการค้าแล้ว',
    )
  })

  it('ข้อมูลขาดก็ยังได้ประโยคที่อ่านรู้เรื่อง ไม่มีช่องว่างโหว่', () => {
    const text = fillPlaceholders('{ตัวละคร}ของ{แบรนด์} ลูกค้าคือ{ลูกค้า} CEO {ชื่อ}', {
      nickname: '',
      brandName: '',
    })
    expect(text).not.toMatch(/[{}]/)
    expect(text).toContain('CEO')
  })

  it('ชุดสำรองมีครบ 10 เรื่อง และบอกได้ว่าทำไมถึงใช้ทางสำรอง', () => {
    const set = fallbackStorySet(INPUT, 'no-api-key')
    expect(set.stories).toHaveLength(10)
    expect(set.source).toBe('fallback')
    expect(set.provider).toBe('rules')
    expect(set.fallbackReason).toBe('no-api-key')
    expect(set.stories.every((s) => s.source === 'fallback')).toBe(true)
  })
})

describe('รายการตรวจผลจาก AI ตามสเปก E-07', () => {
  it('ผ่านเมื่อครบทุกข้อ', () => {
    expect(checkStoryText('ขนมบ้านยายอยากให้ CEO ช่วยคิดชื่อร้าน', INPUT).ok).toBe(true)
  })

  it('**ปัดทิ้งเรื่องที่มีข้อเท็จจริงเรื่องโดเมน** ชื่อเว็บหรือนามสกุลเว็บ', () => {
    expect(looksLikeDomain('ลองจด kanomwan.co.th ดูสิ')).toBe(true)
    expect(looksLikeDomain('เข้าที่ www.shop ได้เลย')).toBe(true)
    expect(looksLikeDomain('ชื่อ .ไทย ก็ดีนะ')).toBe(true)
    expect(looksLikeDomain('ขนมบ้านยายขายดีมาก')).toBe(false)

    const check = checkStoryText('ขนมบ้านยายควรใช้ .co.th เพราะน่าเชื่อถือ', INPUT)
    expect(check.ok).toBe(false)
    expect(check.reason).toContain('ชื่อเว็บ')
  })

  it('ปัดทิ้งเรื่องที่ยาวเกิน 60 คำ', () => {
    const long = `${INPUT.brandName} ` + 'คำ '.repeat(MAX_STORY_WORDS + 5)
    const check = checkStoryText(long, INPUT)
    expect(check.ok).toBe(false)
    expect(check.reason).toContain('ยาวเกิน')
  })

  it('ปัดทิ้งเรื่องที่ไม่มีชื่อแบรนด์', () => {
    expect(checkStoryText('มีเรื่องให้ CEO ช่วยคิด', INPUT).reason).toContain('ชื่อแบรนด์')
  })

  it('ปัดทิ้งเรื่องที่ไม่ผ่านตัวกรองเนื้อหา E-11', () => {
    const check = checkStoryText('ขนมบ้านยายจะเปิดบ่อนพนันด้วย', INPUT)
    expect(check.ok).toBe(false)
    expect(check.reason).toContain('ตัวกรอง')
  })

  it('กฎของ brand_slug', () => {
    expect(isValidSlug('bankhanomyai')).toBe(true)
    expect(isValidSlug('ban-khanom-1')).toBe(true)
    expect(isValidSlug('ขนมบ้านยาย')).toBe(false)
    expect(isValidSlug('has space')).toBe(false)
    expect(isValidSlug('ab')).toBe(false)
    expect(isValidSlug('x'.repeat(21))).toBe(false)
  })

  it('ชื่อร้านอักษรไทยล้วนสร้าง slug เองไม่ได้ ต้องให้นักเรียนพิมพ์เอง', () => {
    expect(slugFromBrand('ขนมบ้านยาย')).toBeNull()
    expect(slugFromBrand('Ban Khanom Yai')).toBe('bankhanomyai')
    const result = fallbackStorySet(INPUT, 'no-api-key')
    expect(result.needsBrandSlugFromStudent).toBe(true)
    // ต้องมีประโยคถามติดมาด้วย ไม่ใช่ปล่อยให้หน้าจอคิดคำถามเอง
    expect(result.brandSlugPrompt).toBe(SLUG_FALLBACK_PROMPT)
    expect(result.brandSlugPrompt!.length).toBeGreaterThan(0)
  })
})

describe('เส้นทาง AI จริงของ storyFor (ใช้ fetch ปลอม ไม่แตะเน็ต)', () => {
  it('**ไม่มีคีย์ AI ได้ประโยคสำรองครบ 10 เรื่อง และไม่แตะ fetch เลย**', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    const client = createAiClient({ env: {} })

    const result = await client.storyFor(INPUT)
    expect(spy).not.toHaveBeenCalled()
    expect(result.source).toBe('fallback')
    expect(result.fallbackReason).toBe('no-api-key')
    expect(result.stories).toHaveLength(10)
    expect(result.stories[0]!.text).toContain('ขนมบ้านยาย')
    expect(result.character).toBe('ยาย')
  })

  it('AI ตอบครบ ได้เรื่องราวจาก AI และแทนชื่อเล่นให้เอง', async () => {
    const client = createAiClient({
      env: { TYPHOON_API_KEY: 'k' },
      fetchImpl: fakeFetch(typhoonPayload(storyPayload())),
    })

    const result = await client.storyFor(INPUT)
    expect(result.source).toBe('ai')
    expect(result.provider).toBe('typhoon')
    expect(result.stories).toHaveLength(10)
    expect(result.brandSlug).toBe('bankhanomyai')
    expect(result.needsBrandSlugFromStudent).toBe(false)
    // ไม่ต้องถามอะไร จึงไม่มีประโยคถามติดมา
    expect(result.brandSlugPrompt).toBeNull()
    for (const story of result.stories) {
      expect(story.source).toBe('ai')
      // {ชื่อ} ถูกแทนด้วยชื่อเล่นฝั่งเรา ไม่มีสัญลักษณ์หลงเหลือ
      expect(story.text).not.toMatch(/[{}]/)
      expect(story.text).toContain('พลอย')
    }
  })

  it('**ไม่ส่งชื่อเล่นของนักเรียนออกไปให้ AI**', async () => {
    const spy = fakeFetch(typhoonPayload(storyPayload()))
    const client = createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl: spy })
    await client.storyFor(INPUT)

    const body = String((spy.mock.calls[0] as [string, { body: string }])[1].body)
    expect(body).not.toContain('พลอย')
    expect(body).toContain('ขนมบ้านยาย')
    // มีสัญลักษณ์ให้โมเดลเขียนแทนชื่อ
    expect(body).toContain('{ชื่อ}')
  })

  it('เรื่องที่ไม่ผ่านการตรวจถูกแทนด้วยประโยคสำรอง **เป็นรายเรื่อง** ไม่ทิ้งทั้งชุด', async () => {
    const broken = aiIntros()
    broken.M2 = 'ขนมบ้านยายควรใช้ชื่อ kanomwan.co.th นะ' // มีชื่อเว็บ = ผิดกฎ
    broken.M3 = 'เรื่องนี้ไม่มีชื่อร้านเลย' // ไม่มีชื่อแบรนด์
    const client = createAiClient({
      env: { TYPHOON_API_KEY: 'k' },
      fetchImpl: fakeFetch(typhoonPayload(storyPayload({ intros: broken }))),
    })

    const result = await client.storyFor(INPUT)
    expect(result.source).toBe('ai')
    expect(result.stories).toHaveLength(10)

    const m2 = result.stories.find((s) => s.id === 'M2')!
    const m3 = result.stories.find((s) => s.id === 'M3')!
    expect(m2.source).toBe('fallback')
    expect(m2.rejectReason).toContain('ชื่อเว็บ')
    expect(m2.text).toBe(fallbackStoryText('M2', INPUT))
    expect(m3.source).toBe('fallback')
    expect(result.stories.find((s) => s.id === 'M1')!.source).toBe('ai')
  })

  it('AI ตอบพังทั้งชุด ตกไปใช้ประโยคสำรองทั้ง 10 เรื่อง', async () => {
    const client = createAiClient({
      env: { TYPHOON_API_KEY: 'k' },
      fetchImpl: fakeFetch(typhoonPayload({ intros: {} })),
    })
    const result = await client.storyFor(INPUT)
    expect(result.source).toBe('fallback')
    expect(result.stories.every((s) => s.source === 'fallback')).toBe(true)
  })

  it('slug ที่ AI ให้มาผิดกฎ ถูกแทนด้วย slug ที่สร้างจากชื่อร้าน', async () => {
    const client = createAiClient({
      env: { TYPHOON_API_KEY: 'k' },
      fetchImpl: fakeFetch(typhoonPayload(storyPayload({ brand_slug: 'ชื่อไทย!!' }))),
    })
    const result = await client.storyFor({ ...INPUT, brandName: 'Ban Khanom Yai' })
    expect(result.brandSlug).toBe('bankhanomyai')
  })
})

describe('คิวสร้างเรื่องราวเบื้องหลัง', () => {
  function queueWith(fetchImpl: typeof fetch) {
    const store = new InMemoryStoryJobStore()
    const queue = new StoryQueue({
      client: createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl, timeoutMs: STORY_TIMEOUT_MS }),
      store,
      concurrency: 2,
    })
    return { store, queue }
  }

  it('ฝากงานแล้วคืนทันที ไม่แตะเน็ตเลย', async () => {
    const spy = fakeFetch(typhoonPayload(storyPayload()))
    const { queue } = queueWith(spy)

    const { jobId } = await queue.enqueue(INPUT)
    expect(jobId).toContain('stu-1')
    expect(spy).not.toHaveBeenCalled()
    expect(await queue.status()).toMatchObject({ pending: 1, done: 0 })
  })

  it('**เปิดภารกิจก่อนคิวเสร็จ ต้องได้ประโยคสำรองทันที ไม่ใช่ช่องว่าง**', async () => {
    const { queue } = queueWith(fakeFetch(typhoonPayload(storyPayload())))
    await queue.enqueue(INPUT)

    const story = await queue.storyFor('stu-1', 'M1', INPUT)
    expect(story.source).toBe('fallback')
    expect(story.text).toContain('ขนมบ้านยาย')
    expect(story.text).not.toMatch(/[{}]/)
  })

  it('คิวเดินจบแล้วได้เรื่องจาก AI', async () => {
    const { queue } = queueWith(fakeFetch(typhoonPayload(storyPayload())))
    await queue.enqueue(INPUT)

    const drained = await queue.drain(10)
    expect(drained.processed).toBeGreaterThan(0)
    expect(await queue.status()).toMatchObject({ done: 1, failed: 0, pending: 0 })

    const story = await queue.storyFor('stu-1', 'M1', INPUT)
    expect(story.source).toBe('ai')
  })

  it('คิวทนการรีสตาร์ต งานที่ค้างยังอยู่และสร้างต่อได้', async () => {
    const store = new InMemoryStoryJobStore()
    const first = new StoryQueue({
      client: createAiClient({ env: {} }),
      store,
    })
    await first.enqueue(INPUT)

    // เซิร์ฟเวอร์รีสตาร์ต สร้างตัวใหม่จากที่เก็บเดิม
    const second = new StoryQueue({
      client: createAiClient({
        env: { TYPHOON_API_KEY: 'k' },
        fetchImpl: fakeFetch(typhoonPayload(storyPayload())),
        timeoutMs: STORY_TIMEOUT_MS,
      }),
      store,
    })
    await second.drain(10)
    expect(await second.status()).toMatchObject({ done: 1 })
  })

  it('ห้องเรียน 30 คนฝากงานพร้อมกันได้ โดยไม่มีใครรอ', async () => {
    const { queue } = queueWith(fakeFetch(typhoonPayload(storyPayload())))
    const started = Date.now()
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        queue.enqueue({ ...INPUT, studentId: `stu-${i + 1}`, nickname: `เด็ก ${i + 1}` }),
      ),
    )
    expect(Date.now() - started).toBeLessThan(500)
    expect(await queue.status()).toMatchObject({ pending: 30 })
  })
})

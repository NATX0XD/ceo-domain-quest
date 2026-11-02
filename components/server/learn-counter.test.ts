import { describe, expect, it } from 'vitest'
import answers from '../../content/learn-counter-answers.json'
import publicJson from '../../content/learn-counter.json'
import type { CounterDecision, CounterDetail } from '../learn/counter-types'
import { LEGACY_SHIFT, checkCounterStep, counterPoolIds, drawShift, newShiftSeed, publicCounterData, scoreCounter, validShift } from './learn-counter'

type Answer = (typeof answers.cases)[number]
/** เทสต์คะแนนใช้กะสำรอง 2 คน (ค่าเริ่มต้นของ scoreCounter) */
const legacy = answers.cases.filter((a) => (LEGACY_SHIFT as readonly string[]).includes(a.caseId))

function perfect(a: Answer): CounterDecision {
  return {
    caseId: a.caseId,
    tags: a.tags as unknown as CounterDecision['tags'],
    asked: a.keyQuestions,
    stamp: a.stamp as CounterDecision['stamp'],
    extension: a.acceptedExtensions[0] ?? null,
  }
}

describe('scoreCounter ด่าน 3 เคาน์เตอร์รับจดโดเมน', () => {
  it('ตอบถูกหมดได้ 100 และผ่าน', () => {
    const r = scoreCounter({ decisions: legacy.map(perfect) })
    const detail = r.detail as CounterDetail
    expect(r.score).toBe(100)
    expect(r.passed).toBe(true)
    expect(detail.cases).toHaveLength(legacy.length)
    expect(detail.cases.every((c) => c.stampCorrect && c.askedKeyQuestion)).toBe(true)
  })

  it('ป้ายถูกหมดแต่ตราผิดทุกเคส ได้ 50 ยังไม่ผ่าน', () => {
    const decisions = legacy.map((a) => ({
      ...perfect(a),
      stamp: a.stamp === 'reject' ? 'approve' : 'reject',
      extension: null,
    }))
    const r = scoreCounter({ decisions })
    expect(r.score).toBe(50)
    expect(r.passed).toBe(false)
  })

  it('ตราถูกหมดแต่ป้ายถูกต่ำกว่า 80% ยังไม่ผ่านแม้คะแนนเกิน 60', () => {
    // ทำป้ายผิด 2 ใบจาก 8 = 75%
    let wrongLeft = 2
    const decisions = legacy.map((a) => {
      const d = perfect(a)
      const tags = { ...d.tags }
      for (const name of Object.keys(tags)) {
        if (wrongLeft > 0) {
          tags[name] = tags[name] === 'gTLD ทั่วไป' ? 'ccTLD ไทย' : 'gTLD ทั่วไป'
          wrongLeft -= 1
          break
        }
      }
      return { ...d, tags }
    })
    const r = scoreCounter({ decisions })
    const detail = r.detail as CounterDetail
    expect(detail.tagAccuracy).toBeLessThan(0.8)
    expect(r.score).toBeGreaterThan(60)
    expect(r.passed).toBe(false)
  })

  it('ตราเสนอนามสกุลใหม่ แต่นามสกุลที่เสนอไม่อยู่ในรายการที่ยอมรับ นับว่าตราผิด', () => {
    const decisions = legacy.map((a) =>
      a.acceptedExtensions.length > 0 ? { ...perfect(a), extension: '.go.th' } : perfect(a),
    )
    const r = scoreCounter({ decisions })
    const detail = r.detail as CounterDetail
    const withExt = legacy.filter((a) => a.acceptedExtensions.length > 0).map((a) => a.caseId)
    for (const c of detail.cases) expect(c.stampCorrect).toBe(!withExt.includes(c.caseId))
  })

  it('ไม่ได้ส่งเคสไหนเลยได้ 0', () => {
    const r = scoreCounter({ decisions: [] })
    expect(r.score).toBe(0)
    expect(r.passed).toBe(false)
  })

  it('payload ผิดรูปแบบได้ 0 และบอก error', () => {
    for (const bad of [null, 'x', { decisions: 'no' }, { decisions: [{ caseId: 'c1', tags: { a: 'ผิดหมวด' }, asked: [], stamp: 'approve', extension: null }] }, { decisions: [{ caseId: 'c1', tags: {}, asked: ['q1', 'q2', 'q3', 'q4'], stamp: 'approve', extension: null }] }]) {
      const r = scoreCounter(bad)
      expect(r.score).toBe(0)
      expect(r.passed).toBe(false)
      expect((r.detail as CounterDetail).error).toBe('invalid-payload')
    }
  })

  it('ข้อมูลสาธารณะไม่มีเฉลย และเคส/โดเมนตรงกับไฟล์เฉลย', () => {
    const data = publicCounterData()
    const text = JSON.stringify(publicJson)
    expect(text).not.toMatch(/acceptedExtensions|keyQuestions|explanation/)
    expect(data.cases.map((c) => c.id)).toEqual(answers.cases.map((a) => a.caseId))
    for (const a of answers.cases) {
      const c = data.cases.find((x) => x.id === a.caseId)!
      expect(c.domains.map((d) => d.name).sort()).toEqual(Object.keys(a.tags).sort())
      for (const ext of a.acceptedExtensions) expect(c.extensionOptions).toContain(ext)
    }
  })

  it('ตราถูกตอนลองแก้ (attempt 2) ได้ 1 แต้ม ถูกครั้งแรกได้ 2 แต้ม', () => {
    const decisions = legacy.map((a, i) => ({ ...perfect(a), attempt: (i === 0 ? 2 : 1) as 1 | 2 }))
    const detail = scoreCounter({ decisions }).detail as CounterDetail
    expect(detail.cases.map((c) => c.points)).toEqual(legacy.map((_, i) => (i === 0 ? 1 : 2)))
    expect(detail.stampPoints).toBe(legacy.length * 2 - 1)
    expect(detail.stampMax).toBe(legacy.length * 2)
  })

  it('ตราผิดได้ 0 แต้ม และไม่ผ่านเมื่อแต้มตราต่ำกว่า 60% แม้ป้ายถูกหมด', () => {
    const decisions = legacy.map((a, i) =>
      i < 1 ? perfect(a) : { ...perfect(a), stamp: a.stamp === 'reject' ? 'approve' : 'reject', extension: null },
    )
    const r = scoreCounter({ decisions })
    const detail = r.detail as CounterDetail
    expect(detail.cases.map((c) => c.points)).toEqual([2, 0])
    expect(detail.tagAccuracy).toBe(1)
    expect(r.passed).toBe(false)
  })

  it('ตอบถูกตอนลองแก้ทุกคน ได้แต้มตรา 50% ยังไม่ผ่าน แต่ถ้าถูกครั้งแรกบางคนผ่านได้', () => {
    const allRetry = scoreCounter({ decisions: legacy.map((a) => ({ ...perfect(a), attempt: 2 as const })) })
    expect(allRetry.passed).toBe(false)
    const mixed = scoreCounter({
      decisions: legacy.map((a, i) => ({ ...perfect(a), attempt: (i < 2 ? 1 : 2) as 1 | 2 })),
    })
    expect(mixed.passed).toBe(true)
  })

  it('สรุปป้ายแยกกลุ่ม รวมแล้วเท่ากับจำนวนโดเมนทั้งหมด', () => {
    const detail = scoreCounter({ decisions: legacy.map(perfect) }).detail as CounterDetail
    const total = legacy.reduce((n, a) => n + Object.keys(a.tags).length, 0)
    expect(detail.groups.reduce((n, g) => n + g.total, 0)).toBe(total)
    expect(detail.groups.every((g) => g.correct === g.total)).toBe(true)
  })

  it('checkCounterStep: ถูกไม่มีคำอธิบาย ผิดครั้งแรกบอกป้ายที่ผิดแต่ไม่เฉลย ผิดครั้งที่ 2 ให้คำอธิบาย', () => {
    const a = legacy[1]!
    const ok = checkCounterStep(perfect(a)).result
    expect(ok).toMatchObject({ correct: true, wrongTags: [], explanation: '' })

    const [name] = Object.keys(a.tags)
    const wrong = { ...perfect(a), tags: { ...perfect(a).tags, [name!]: 'gTLD ทั่วไป' as const }, stamp: 'reject' as const }
    const first = checkCounterStep({ ...wrong, attempt: 1 }).result
    expect(first.correct).toBe(false)
    expect(first.stampCorrect).toBe(false)
    expect(first.explanation).toBe('')
    const second = checkCounterStep({ ...wrong, attempt: 2 })
    expect(second.result.explanation).toBe(a.explanation)
    expect(second.log).toEqual({ caseId: a.caseId, attempt: 2, correct: false })
  })

  it('checkCounterStep: payload ผิดรูปแบบโยน error, เคสที่ไม่รู้จักไม่เฉลยอะไร', () => {
    expect(() => checkCounterStep({ caseId: 'c1' })).toThrow()
    const r = checkCounterStep({ caseId: 'zzz', tags: {}, asked: [], stamp: 'approve', extension: null, attempt: 2 })
    expect(r.result).toMatchObject({ correct: false, explanation: '', wrongTags: [] })
  })

  it('การ์ดเหตุผล (S14): ตรวจแยก ไม่เปลี่ยนคะแนน/เกณฑ์ผ่าน และข้อมูลสาธารณะไม่บอกใบที่ถูก', () => {
    const data = publicCounterData()
    for (const a of legacy) {
      const c = data.cases.find((x) => x.id === a.caseId)!
      expect(c.reasons?.map((r) => r.id)).toContain(a.reason)
    }
    expect(JSON.stringify(publicJson)).not.toMatch(/"reason"\s*:/)
    const right = legacy.map((a) => ({ ...perfect(a), reason: a.reason }))
    const wrong = legacy.map((a) => ({ ...perfect(a), reason: a.reason === 'r1' ? 'r2' : 'r1' }))
    const r1 = scoreCounter({ decisions: right })
    const r2 = scoreCounter({ decisions: wrong })
    expect(r1.score).toBe(100)
    expect(r2.score).toBe(100)
    expect(r2.passed).toBe(true)
    expect((r1.detail as CounterDetail).cases.every((c) => c.reasonCorrect === true)).toBe(true)
    expect((r2.detail as CounterDetail).cases.every((c) => c.reasonCorrect === false)).toBe(true)
    expect(checkCounterStep(right[0]).result.reasonCorrect).toBe(true)
    expect(checkCounterStep(wrong[0]).result).toMatchObject({ correct: true, reasonCorrect: false })
  })

  it('ลูกค้าทุกคนมีภาพและคำลงท้ายตรงเพศ (ชาย ครับ / หญิง ค่ะ)', () => {
    const male = new Set(['c2', 'c3', 'c7', 'c9', 'c11', 'c13', 'c15', 'c17'])
    for (const c of publicCounterData().cases) {
      expect(c.portrait).toMatch(/^c([1-9]|1[0-8])$/)
      const text = [c.greeting, ...c.questions.map((q) => q.reply)].join(' ')
      if (male.has(c.portrait!)) expect(text).not.toMatch(/ค่ะ|คะ/)
      else expect(text).not.toMatch(/ครับ/)
    }
  })

  it('คลังลูกค้ามีอย่างน้อย 18 คน ครบทั้ง 4 ตรา และครบ 3 ชั้นของคู่มือ', () => {
    expect(counterPoolIds().length).toBeGreaterThanOrEqual(18)
    const stamps = new Set(answers.cases.map((a) => a.stamp))
    for (const s of ['approve', 'suggest', 'first-step', 'reject']) expect(stamps.has(s)).toBe(true)
    const cats = new Set(answers.cases.flatMap((a) => Object.values(a.tags)))
    expect(cats.size).toBe(3)
  })
})

describe('drawShift สุ่มลูกค้าต่อกะ', () => {
  const stampOf = (id: string) => answers.cases.find((a) => a.caseId === id)!.stamp
  it('seed เดิมได้ชุดเดิมและลำดับเดิม (รีเฟรชไม่สลับ)', () => {
    for (const seed of [1, 42, 99999, 2 ** 31 - 1]) expect(drawShift(seed)).toEqual(drawShift(seed))
  })
  it('ได้ 2 คนไม่ซ้ำและสุ่มจากคลังทุก seed', () => {
    for (let seed = 0; seed < 300; seed++) {
      const ids = drawShift(seed)
      expect(ids).toHaveLength(2)
      expect(new Set(ids).size).toBe(2)
      const stamps = ids.map(stampOf)
      expect(stamps.every((stamp) => ['approve', 'suggest', 'first-step', 'reject'].includes(stamp))).toBe(true)
      const cats = new Set(ids.flatMap((id) => Object.values(answers.cases.find((a) => a.caseId === id)!.tags)))
      expect(cats.size).toBe(3)
    }
  })
  it('กะใหม่ไม่ซ้ำชุดเดิม และ validShift กรอง id แปลก', () => {
    const prev = drawShift(7)
    let n = 0
    const fake = () => ((n = (n * 9301 + 49297) % 233280), n / 233280)
    const next = newShiftSeed(prev, fake)
    expect(next.caseIds).toEqual(drawShift(next.seed))
    expect([...next.caseIds].sort()).not.toEqual([...prev].sort())
    expect(validShift(['c1', 'zzz', 'c1', 5])).toEqual(['c1'])
    expect(validShift([])).toEqual([...LEGACY_SHIFT])
  })
  it('หมุนครบทั้งคลังโดยไม่ซ้ำระหว่างกะ แล้วเริ่มสุ่มรอบใหม่เมื่อหมดคลัง', () => {
    const seen = new Set<string>()
    let previous: string[] = []
    for (let run = 0; run < 9; run += 1) {
      const next = newShiftSeed(previous, () => 0.42, [...seen])
      expect(next.caseIds).toHaveLength(2)
      expect(next.caseIds.some((id) => seen.has(id))).toBe(false)
      next.caseIds.forEach((id) => seen.add(id))
      previous = next.caseIds
    }
    expect(seen.size).toBe(counterPoolIds().length)
    const reshuffled = newShiftSeed(previous, () => 0.91, [...seen])
    expect(reshuffled.caseIds).toHaveLength(2)
  })
  it('scoreCounter ตรวจเฉพาะลูกค้าในกะ: ตอบถูกครบกะได้ 100 ส่งเคสนอกกะไม่ช่วย', () => {
    const ids = drawShift(123)
    const inShift = answers.cases.filter((a) => ids.includes(a.caseId))
    const r = scoreCounter({ decisions: inShift.map(perfect) }, ids)
    expect(r.score).toBe(100)
    expect((r.detail as CounterDetail).cases.map((c) => c.caseId)).toEqual(ids)
    const outside = answers.cases.filter((a) => !ids.includes(a.caseId))
    const r2 = scoreCounter({ decisions: outside.slice(0, 4).map(perfect) }, ids)
    expect(r2.score).toBe(0)
    expect(publicCounterData(ids).cases.map((c) => c.id)).toEqual(ids)
  })
})

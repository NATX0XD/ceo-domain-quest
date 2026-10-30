import { describe, expect, it } from 'vitest'
import answers from '../../content/learn-counter-answers.json'
import publicJson from '../../content/learn-counter.json'
import type { CounterDecision, CounterDetail } from '../learn/counter-types'
import { checkCounterStep, publicCounterData, scoreCounter } from './learn-counter'

type Answer = (typeof answers.cases)[number]

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
    const r = scoreCounter({ decisions: answers.cases.map(perfect) })
    const detail = r.detail as CounterDetail
    expect(r.score).toBe(100)
    expect(r.passed).toBe(true)
    expect(detail.cases).toHaveLength(answers.cases.length)
    expect(detail.cases.every((c) => c.stampCorrect && c.askedKeyQuestion)).toBe(true)
  })

  it('ป้ายถูกหมดแต่ตราผิดทุกเคส ได้ 50 ยังไม่ผ่าน', () => {
    const decisions = answers.cases.map((a) => ({
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
    const decisions = answers.cases.map((a) => {
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
    const decisions = answers.cases.map((a) =>
      a.acceptedExtensions.length > 0 ? { ...perfect(a), extension: '.go.th' } : perfect(a),
    )
    const r = scoreCounter({ decisions })
    const detail = r.detail as CounterDetail
    const withExt = answers.cases.filter((a) => a.acceptedExtensions.length > 0).map((a) => a.caseId)
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
    const decisions = answers.cases.map((a, i) => ({ ...perfect(a), attempt: (i === 0 ? 2 : 1) as 1 | 2 }))
    const detail = scoreCounter({ decisions }).detail as CounterDetail
    expect(detail.cases.map((c) => c.points)).toEqual(answers.cases.map((_, i) => (i === 0 ? 1 : 2)))
    expect(detail.stampPoints).toBe(answers.cases.length * 2 - 1)
    expect(detail.stampMax).toBe(answers.cases.length * 2)
  })

  it('ตราผิดได้ 0 แต้ม และไม่ผ่านเมื่อแต้มตราต่ำกว่า 60% แม้ป้ายถูกหมด', () => {
    const decisions = answers.cases.map((a, i) =>
      i < 2 ? perfect(a) : { ...perfect(a), stamp: a.stamp === 'reject' ? 'approve' : 'reject', extension: null },
    )
    const r = scoreCounter({ decisions })
    const detail = r.detail as CounterDetail
    expect(detail.cases.map((c) => c.points)).toEqual([2, 2, 0, 0])
    expect(detail.tagAccuracy).toBe(1)
    expect(r.passed).toBe(false)
  })

  it('ตอบถูกตอนลองแก้ทุกคน ได้แต้มตรา 50% ยังไม่ผ่าน แต่ถ้าถูกครั้งแรกบางคนผ่านได้', () => {
    const allRetry = scoreCounter({ decisions: answers.cases.map((a) => ({ ...perfect(a), attempt: 2 as const })) })
    expect(allRetry.passed).toBe(false)
    const mixed = scoreCounter({
      decisions: answers.cases.map((a, i) => ({ ...perfect(a), attempt: (i < 2 ? 1 : 2) as 1 | 2 })),
    })
    expect(mixed.passed).toBe(true)
  })

  it('สรุปป้ายแยกกลุ่ม รวมแล้วเท่ากับจำนวนโดเมนทั้งหมด', () => {
    const detail = scoreCounter({ decisions: answers.cases.map(perfect) }).detail as CounterDetail
    const total = answers.cases.reduce((n, a) => n + Object.keys(a.tags).length, 0)
    expect(detail.groups.reduce((n, g) => n + g.total, 0)).toBe(total)
    expect(detail.groups.every((g) => g.correct === g.total)).toBe(true)
  })

  it('checkCounterStep: ถูกไม่มีคำอธิบาย ผิดครั้งแรกบอกป้ายที่ผิดแต่ไม่เฉลย ผิดครั้งที่ 2 ให้คำอธิบาย', () => {
    const a = answers.cases[1]!
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
})

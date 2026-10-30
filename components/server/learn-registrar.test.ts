import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import answersJson from '../../content/learn-registrar-answers.json' with { type: 'json' }
import publicJson from '../../content/learn-registrar.json' with { type: 'json' }
import type { ExplainPayload, RegistrarDetail, RegistrarStepResult } from '@/components/learn/registrar-types'
import { checkRegistrarStep, publicRegistrarData, rubricExplain, scoreRegistrar } from './learn-registrar'

const CORRECT_ORDER = answersJson.order
const ALL_EVENTS_RIGHT: Record<string, number> = { ...answersJson.events }
const KEY = ['st-search', 'st-form', 'st-docs', 'st-review', 'st-pay', 'st-dns']

const GOOD_EXPLAIN: ExplainPayload = {
  order: KEY,
  reasons: { ...answersJson.reasonAnswers },
  renewal: answersJson.renewalPoints.indexOf(2),
}

function wrongChoice(id: keyof typeof answersJson.events): number {
  return answersJson.events[id] === 0 ? 1 : 0
}

function full(over: Record<string, unknown> = {}) {
  return { order: CORRECT_ORDER, events: ALL_EVENTS_RIGHT, searched: true, misses: 0, explain: GOOD_EXPLAIN, ...over }
}

describe('rubricExplain', () => {
  it('ตอบถูกหมดได้ 10 (4/2/2/2)', () => {
    const r = rubricExplain(GOOD_EXPLAIN)
    expect(r.rows.map((x) => x.got)).toEqual([4, 2, 2, 2])
    expect(r.total).toBe(10)
  })

  it('จ่ายเงินก่อนรอผลตรวจเสีย 1 คะแนนลำดับ และ DNS ไม่ท้ายสุดเสียอีก 1', () => {
    const order = ['st-search', 'st-form', 'st-docs', 'st-pay', 'st-review', 'st-dns']
    expect(rubricExplain({ ...GOOD_EXPLAIN, order }).rows[1]?.got).toBe(1)
    const dnsEarly = ['st-dns', 'st-search', 'st-form', 'st-docs', 'st-review', 'st-pay']
    expect(rubricExplain({ ...GOOD_EXPLAIN, order: dnsEarly }).rows[1]?.got).toBe(1)
  })

  it('ขั้นที่ขาดลดคะแนนครบถ้วนตามสัดส่วน', () => {
    const r = rubricExplain({ ...GOOD_EXPLAIN, order: KEY.slice(0, 3) })
    expect(r.rows[0]?.got).toBe(2)
    expect(r.rows[1]?.got).toBe(0)
  })

  it('เหตุผลที่เลือกผิดไม่ได้คะแนน และต่ออายุแบบไม่บอกผลได้ 1', () => {
    const r = rubricExplain({ ...GOOD_EXPLAIN, reasons: {}, renewal: answersJson.renewalPoints.indexOf(1) })
    expect(r.rows[2]?.got).toBe(0)
    expect(r.rows[3]?.got).toBe(1)
  })

  it('คำอธิบายที่พิมพ์เอง: เหตุผลกับต่ออายุตรวจจากคำสำคัญ', () => {
    const typed = rubricExplain({
      order: KEY,
      reasons: {},
      renewal: null,
      text: 'ต้องค้นชื่อก่อนเพราะชื่อห้ามซ้ำ แนบเอกสารเพื่อยืนยันตัวตน และต้องต่ออายุทุกปี ถ้าไม่ต่อชื่อจะถูกระงับ',
    })
    expect(typed.rows[2]?.got).toBe(2)
    expect(typed.rows[3]?.got).toBe(2)
  })

  it('ไม่มีคำอธิบายได้ 0 และไม่ throw', () => {
    expect(rubricExplain(undefined).total).toBe(0)
  })
})

describe('checkRegistrarStep', () => {
  it('วางการ์ดถูกช่องได้เหตุผล วางผิดได้คำถามนำที่ไม่บอกเฉลย', () => {
    const ok = checkRegistrarStep({ kind: 'place', slot: 7, stepId: 'st-pay' }).result
    expect(ok).toMatchObject({ kind: 'place', correct: true })
    const bad = checkRegistrarStep({ kind: 'place', slot: 3, stepId: 'st-pay' }).result as Extract<RegistrarStepResult, { kind: 'place' }>
    expect(bad.correct).toBe(false)
    expect(bad.reason).toBeUndefined()
    expect(bad.hint).toContain('อนุมัติ')
  })

  it('เหตุการณ์ตอบถูก/ผิดพร้อมคำอธิบาย', () => {
    const r = checkRegistrarStep({ kind: 'event', eventId: 'ev-pay', choice: answersJson.events['ev-pay'] }).result
    expect(r).toMatchObject({ correct: true })
    const w = checkRegistrarStep({ kind: 'event', eventId: 'ev-pay', choice: wrongChoice('ev-pay') }).result
    expect(w).toMatchObject({ correct: false })
  })

  it('อีเมล 3 ผล: ไม่มีสิทธิ์ = ไม่อนุมัติ · เอกสารผิด/ภาพไม่ชัด = ขอเพิ่ม · ส่งชัดรอบสอง = อนุมัติ', () => {
    const base = { kind: 'docs', ownerType: 'individual', tld: '.in.th' } as const
    const outcome = (x: object) => (checkRegistrarStep({ ...base, ...x }).result as { outcome: string }).outcome
    expect(outcome({ docId: 'doc-id', round: 0 })).toBe('more')
    expect(outcome({ docId: 'doc-company', round: 1 })).toBe('more')
    expect(outcome({ docId: 'doc-id', round: 1 })).toBe('approve')
    expect(outcome({ tld: '.co.th', docId: 'doc-id', round: 1 })).toBe('reject')
  })

  it('คำอธิบายให้บอสคืนรูบริกและคำถามต่อ', () => {
    const r = checkRegistrarStep({ kind: 'explain', ...GOOD_EXPLAIN, order: KEY.slice(0, 5) }).result as Extract<RegistrarStepResult, { kind: 'explain' }>
    expect(r.rubric).toHaveLength(4)
    expect(r.followUp.question).toContain('DNS')
  })

  it('รูปแบบผิดโยน ZodError', () => {
    expect(() => checkRegistrarStep({ kind: 'nope' })).toThrow(ZodError)
    expect(() => checkRegistrarStep(null)).toThrow(ZodError)
  })
})

describe('scoreRegistrar', () => {
  it('ทำถูกทั้งหมดได้ 100 ผ่าน 3 ดาว', () => {
    const r = scoreRegistrar(full())
    expect(r.score).toBe(100)
    expect(r.passed).toBe(true)
    const d = r.detail as RegistrarDetail
    expect(d.order.correct).toBe(10)
    expect(d.events.correct).toBe(4)
    expect(d.explanation.points).toBe(10)
    expect(d.stars).toBe(3)
    expect(Object.keys(d.order.reasons)).toHaveLength(10)
  })

  it('วางผิดระหว่างทางหักคะแนนและลดเหลือ 2 ดาว แต่ยังผ่าน', () => {
    const r = scoreRegistrar(full({ misses: 2 }))
    expect(r.score).toBe(96)
    expect(r.passed).toBe(true)
    expect((r.detail as RegistrarDetail).stars).toBe(2)
  })

  it('ผ่านหลังรอบซ่อมได้ 1 ดาว', () => {
    expect((scoreRegistrar(full({ repaired: true })).detail as RegistrarDetail).stars).toBe(1)
  })

  it('เหตุการณ์ถูกแค่ 2 จาก 4 ยังไม่ผ่านแม้คำอธิบายเต็ม', () => {
    const events = { ...ALL_EVENTS_RIGHT, 'ev-pay': wrongChoice('ev-pay'), 'ev-expire': wrongChoice('ev-expire') }
    const r = scoreRegistrar(full({ events }))
    expect(r.passed).toBe(false)
    expect((r.detail as RegistrarDetail).stars).toBe(0)
  })

  it('เหตุการณ์ถูก 3 จาก 4 และคำอธิบาย 7 ขึ้นไปผ่าน', () => {
    const events = { ...ALL_EVENTS_RIGHT, 'ev-taken': wrongChoice('ev-taken') }
    expect(scoreRegistrar(full({ events })).passed).toBe(true)
  })

  it('คำอธิบายต่ำกว่า 7 จาก 10 ยังไม่ผ่านแม้เหตุการณ์ถูกหมด', () => {
    const explain = { ...GOOD_EXPLAIN, reasons: {}, renewal: answersJson.renewalPoints.indexOf(0) }
    const r = scoreRegistrar(full({ explain }))
    expect((r.detail as RegistrarDetail).explanation.points).toBe(6)
    expect(r.passed).toBe(false)
  })

  it('ไม่ส่งคำอธิบายได้ 0 ส่วนนั้นและยังไม่ผ่าน', () => {
    const r = scoreRegistrar(full({ explain: undefined }))
    expect(r.passed).toBe(false)
    expect(r.score).toBe(50)
  })

  it('การ์ดใบเดียวกันวางซ้ำนับแค่ครั้งแรก', () => {
    const first = CORRECT_ORDER[0] as string
    const order = Array.from({ length: 10 }, () => first)
    const r = scoreRegistrar({ order, events: {}, searched: false })
    expect((r.detail as RegistrarDetail).order.correct).toBe(1)
    expect(r.score).toBe(2)
  })

  it('payload ผิดรูปแบบได้ 0 ไม่ throw', () => {
    for (const bad of [null, 'x', { order: 'a' }, { order: [], events: { a: -1 }, searched: true }, { order: [], events: {} }]) {
      const r = scoreRegistrar(bad)
      expect(r.score).toBe(0)
      expect(r.passed).toBe(false)
      expect((r.detail as RegistrarDetail).error).toBe('invalid-payload')
    }
  })
})

describe('publicRegistrarData', () => {
  it('มีการ์ด 10 ใบชุดเดียวกับเฉลย แต่ไม่ได้เรียงตามเฉลย', () => {
    const data = publicRegistrarData()
    const ids = data.steps.map((s) => s.id)
    expect([...ids].sort()).toEqual([...CORRECT_ORDER].sort())
    expect(ids).not.toEqual(CORRECT_ORDER)
  })

  it('ไฟล์สาธารณะไม่มีคีย์เฉลยหรือคำอธิบายเฉลย', () => {
    const raw = JSON.stringify(publicJson)
    expect(raw).not.toMatch(/"answer|"correct|"order"|stepReasons|eventExplanations|misplaceHints|reasonAnswers|renewalPoints|docRequired/)
    for (const text of [...Object.values(answersJson.eventExplanations), ...Object.values(answersJson.stepReasons)]) {
      expect(raw).not.toContain(text)
    }
  })

  it('ทุกเหตุการณ์มีเฉลยที่อยู่ในช่วงตัวเลือก', () => {
    for (const ev of publicRegistrarData().events) {
      const key = answersJson.events[ev.id as keyof typeof answersJson.events]
      expect(key).toBeGreaterThanOrEqual(0)
      expect(key).toBeLessThan(ev.choices.length)
    }
  })

  it('ตัวเลือกเหตุผลทุกขั้นหลักมีเฉลยอยู่ในช่วง', () => {
    const data = publicRegistrarData()
    for (const id of KEY) {
      expect(answersJson.reasonAnswers[id as keyof typeof answersJson.reasonAnswers]).toBeLessThan(data.explain.reasonChoices[id]?.length ?? 0)
    }
    expect(data.explain.renewalChoices).toHaveLength(answersJson.renewalPoints.length)
  })
})

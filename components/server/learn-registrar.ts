import { z } from 'zod'
import type { Json } from '@/lib/db/types'
import publicJson from '../../content/learn-registrar.json' with { type: 'json' }
import answersJson from '../../content/learn-registrar-answers.json' with { type: 'json' }
import type {
  ExplainPayload,
  RegistrarData,
  RegistrarDetail,
  RegistrarResult,
  RegistrarStepResult,
  RubricRow,
} from '@/components/learn/registrar-types'

/**
 * Scorer ของเกมลงมือทำ m4 ด่านบอส "จดชื่อเว็บของร้านฉัน" (docs/mission-4/mission-4-domain-registration.md ข้อ 6)
 *
 * คะแนนเต็ม 100 = วางการ์ดถูกครั้งแรก 20 + รับมือเหตุการณ์ 30 + คำอธิบายให้บอส 50 (รูบริก 10 คะแนน 4/2/2/2)
 * ผ่านเมื่อคำอธิบาย >= 7 จาก 10 และรับมือเหตุการณ์ถูกอย่างน้อย 3 จาก 4
 * ดาว: 3 = วางถูกครั้งแรกทุกช่องและคำอธิบาย >= 9 · 2 = ผ่านเกณฑ์ · 1 = ผ่านหลังรอบซ่อม
 *
 * ⚠️ เฉลยอยู่ใน content/learn-registrar-answers.json — ไฟล์นี้ต้องถูก import จากฝั่งเซิร์ฟเวอร์เท่านั้น
 * ⚠️ ผลวางการ์ดผิดตอบเป็นคำถามนำ ไม่บอกว่าช่องนั้นควรเป็นการ์ดใบไหน
 */

const ORDER_POINTS = 20
const EVENT_POINTS = 30
const EXPLAIN_POINTS = 50
const PASS_EXPLAIN = 7
const MIN_EVENTS_CORRECT = 3
const KEY_STEPS = ['st-search', 'st-form', 'st-docs', 'st-review', 'st-pay', 'st-dns'] as const

const PublicSchema = z.object({
  title: z.string().min(1),
  intro: z.string().min(1),
  search: z.object({ prompt: z.string(), placeholder: z.string(), note: z.string() }),
  board: z.object({ instruction: z.string().min(1) }),
  steps: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).length(10),
  events: z
    .array(
      z.object({
        id: z.string().min(1),
        stage: z.enum(['search', 'docs', 'pay', 'after-dns']),
        title: z.string().min(1),
        story: z.string().min(1),
        question: z.string().min(1),
        choices: z.array(z.string().min(1)).min(2),
      }),
    )
    .length(4),
  fee: z.object({
    pricePerYear: z.number().positive(),
    startCoins: z.number().positive(),
    restoreFee: z.number().positive(),
    comSample: z.number().positive(),
    text: z.string().min(1),
    note: z.string().min(1),
    comNote: z.string().min(1),
  }),
  dns: z.object({
    intro: z.string().min(1),
    sampleText: z.string().min(1),
    nameserverPlaceholders: z.tuple([z.string(), z.string()]),
    successText: z.string().min(1),
    reference: z.object({ domain: z.string(), nameservers: z.array(z.string()), checkedAt: z.string() }),
  }),
  docs: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).length(3),
  detective: z.object({ question: z.string().min(1), choices: z.array(z.string().min(1)).min(2) }),
  explain: z.object({
    prompt: z.string(),
    chips: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).length(6),
    reasonPrompt: z.string(),
    reasonChoices: z.record(z.string(), z.array(z.string().min(1)).min(2)),
    renewalQuestion: z.string(),
    renewalChoices: z.array(z.string().min(1)).min(2),
    textLabel: z.string(),
    textPlaceholder: z.string(),
  }),
})

const AnswersSchema = z.object({
  order: z.array(z.string().min(1)).length(10),
  stepReasons: z.record(z.string(), z.string()),
  events: z.record(z.string(), z.number().int().min(0)),
  eventExplanations: z.record(z.string(), z.string()),
  misplaceHints: z.record(z.string(), z.string()),
  detective: z.object({ answer: z.number().int().min(0), explanation: z.string() }),
  eligible: z.record(z.string(), z.array(z.string())),
  docRequired: z.record(z.string(), z.string()),
  docNames: z.record(z.string(), z.string()),
  reasonAnswers: z.record(z.string(), z.number().int().min(0)),
  renewalPoints: z.array(z.number().int().min(0).max(2)),
  followUps: z.record(z.string(), z.string()),
})

const publicData = PublicSchema.parse(publicJson) as RegistrarData
const answers = AnswersSchema.parse(answersJson)

const ExplainSchema = z.object({
  order: z.array(z.string().min(1).max(40)).max(10),
  reasons: z.record(z.string().min(1).max(40), z.number().int().min(0).max(9)),
  renewal: z.number().int().min(0).max(9).nullable(),
  text: z.string().max(1500).optional(),
})

export const RegistrarPayloadSchema = z.object({
  order: z.array(z.string().min(1).max(40)).max(10),
  events: z.record(z.string().min(1).max(40), z.number().int().min(0).max(9)),
  searched: z.boolean(),
  misses: z.number().int().min(0).max(99).optional(),
  repaired: z.boolean().optional(),
  explain: ExplainSchema.optional(),
})

const StepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('place'), slot: z.number().int().min(0).max(9), stepId: z.string().min(1).max(40) }),
  z.object({ kind: z.literal('event'), eventId: z.string().min(1).max(40), choice: z.number().int().min(0).max(9) }),
  z.object({ kind: z.literal('detect'), choice: z.number().int().min(0).max(9) }),
  z.object({
    kind: z.literal('docs'),
    ownerType: z.enum(['individual', 'company']),
    tld: z.string().min(1).max(12),
    docId: z.string().min(1).max(40),
    round: z.number().int().min(0).max(9),
  }),
  ExplainSchema.extend({ kind: z.literal('explain') }),
])

/** ส่วนสาธารณะ (ไม่มีเฉลย) สำหรับส่งให้ RegistrarGame */
export function publicRegistrarData(): RegistrarData {
  return publicData
}

/** คำสำคัญของแต่ละขั้น ใช้ตรวจคำอธิบายที่พิมพ์เอง */
const KEY_WORDS: Record<(typeof KEY_STEPS)[number], RegExp> = {
  'st-search': /ค้น|เช็ก|ซ้ำ|ว่าง/,
  'st-form': /กรอก|ฟอร์ม|จำนวนปี|ข้อมูลผู้/,
  'st-docs': /เอกสาร|บัตร|แนบ/,
  'st-review': /เจ้าหน้าที่|อนุมัติ|รอผล|ตรวจคำขอ|ตรวจเอกสาร/,
  'st-pay': /จ่าย|ชำระ|ค่าธรรมเนียม/,
  'st-dns': /dns|เนมเซิร์ฟ|nameserver/i,
}
const REASON_MARK = /เพราะ|เนื่องจาก|เพื่อ|ทำให้|ไม่งั้น|ไม่เช่นนั้น|ถ้าไม่|จะได้/

function half(n: number): number {
  return Math.round(n * 2) / 2
}

/** รูบริกคำอธิบายให้บอส 10 คะแนน: ครบ 4 · ลำดับ 2 · เหตุผล 2 · ต่ออายุ 2 */
export function rubricExplain(ex: ExplainPayload | undefined): { rows: RubricRow[]; total: number; weakest: string } {
  const order = ex?.order ?? []
  const reasons = ex?.reasons ?? {}
  const text = (ex?.text ?? '').trim()
  const seen = new Set<string>()
  const keyOrder = order.filter((id) => {
    if (seen.has(id) || !(KEY_STEPS as readonly string[]).includes(id)) return false
    seen.add(id)
    return true
  })

  const have = keyOrder.length
  const complete = half((have / KEY_STEPS.length) * 4)

  const at = (id: string) => keyOrder.indexOf(id)
  const payAfterReview = at('st-pay') >= 0 && at('st-review') >= 0 && at('st-pay') > at('st-review')
  const dnsLast = at('st-dns') >= 0 && at('st-dns') === keyOrder.length - 1 && at('st-pay') >= 0 && at('st-dns') > at('st-pay')
  const orderGot = (payAfterReview ? 1 : 0) + (dnsLast ? 1 : 0)

  const clauses = text.split(/[,.;\n]|\sและ\s|\sแล้ว\s/).map((c) => c.trim()).filter(Boolean)
  const goodReasons = new Set<string>()
  for (const id of KEY_STEPS) {
    if (answers.reasonAnswers[id] !== undefined && reasons[id] === answers.reasonAnswers[id] && at(id) >= 0) goodReasons.add(id)
    if (clauses.some((c) => KEY_WORDS[id].test(c) && REASON_MARK.test(c))) goodReasons.add(id)
  }
  const reasonsGot = Math.min(2, goodReasons.size)

  let renewalGot = ex?.renewal != null ? (answers.renewalPoints[ex.renewal] ?? 0) : 0
  if (/ต่ออายุ/.test(text)) renewalGot = Math.max(renewalGot, /ระงับ|หมดอายุ|เสียชื่อ|กู้คืน|ไม่ต่อ/.test(text) ? 2 : 1)

  const rows: RubricRow[] = [
    {
      id: 'complete',
      label: 'บอกขั้นตอนครบ',
      max: 4,
      got: complete,
      note: have === KEY_STEPS.length ? 'ครบทั้ง 6 ขั้นหลัก' : `มี ${have} จาก 6 ขั้นหลัก (ค้นชื่อ กรอกข้อมูล แนบเอกสาร รอผลตรวจ ชำระเงิน ตั้ง DNS)`,
    },
    {
      id: 'order',
      label: 'เรียงลำดับถูก',
      max: 2,
      got: orderGot,
      note: `${payAfterReview ? 'จ่ายเงินหลังอนุมัติถูกแล้ว' : 'ชำระเงินต้องมาหลังรอผลตรวจ'} · ${dnsLast ? 'DNS เป็นขั้นท้ายถูกแล้ว' : 'DNS ต้องเป็นขั้นท้ายสุด'}`,
    },
    {
      id: 'reasons',
      label: 'บอกเหตุผลอย่างน้อย 2 ขั้น',
      max: 2,
      got: reasonsGot,
      note: reasonsGot >= 2 ? 'บอกเหตุผลได้ครบ 2 ขั้นขึ้นไป' : `บอกเหตุผลถูก ${reasonsGot} ขั้น ลองเพิ่มอีก`,
    },
    {
      id: 'renewal',
      label: 'พูดถึงการต่ออายุและผลของการไม่ต่อ',
      max: 2,
      got: renewalGot,
      note: renewalGot >= 2 ? 'บอกทั้งการต่ออายุและผลของการปล่อยหมด' : 'ต้องบอกว่าต้องต่ออายุ และถ้าปล่อยหมดอายุชื่อจะถูกระงับ',
    },
  ]

  // ขั้นที่บอสถามต่อ: ขั้นหลักที่ขาด หรือเหตุผลที่ยังไม่ถูก แล้วค่อยเรื่องต่ออายุ
  const missing = KEY_STEPS.find((id) => at(id) < 0)
  const weakReason = KEY_STEPS.find((id) => !goodReasons.has(id))
  const weakest = missing ?? (renewalGot < 2 ? 'renew' : (weakReason ?? 'st-pay'))
  return { rows, total: rows.reduce((n, r) => n + r.got, 0), weakest }
}

function eventResult(eventId: string, choice: number | undefined) {
  const known = publicData.events.some((e) => e.id === eventId)
  const correct = known && choice !== undefined && answers.events[eventId] === choice
  return {
    correct,
    explanation: known && choice !== undefined ? (answers.eventExplanations[eventId] ?? '') : '',
  }
}

/**
 * ตรวจทีละจังหวะระหว่างเล่น (route action 'step')
 * ⚠️ โยน ZodError ถ้ารูปแบบผิด (route แปลงเป็น 400) · ไม่เคยคืนเฉลยของช่องที่ยังไม่ได้ตอบ
 */
export function checkRegistrarStep(payload: unknown): { result: RegistrarStepResult; log?: Json } {
  const step = StepSchema.parse(payload)

  if (step.kind === 'place') {
    const correct = answers.order[step.slot] === step.stepId
    const result: RegistrarStepResult = correct
      ? { kind: 'place', correct, reason: answers.stepReasons[step.stepId] }
      : { kind: 'place', correct, hint: answers.misplaceHints[step.stepId] ?? 'ลองคิดดูว่าขั้นนี้ต้องมีอะไรเกิดขึ้นก่อน' }
    return { result, log: { k: 'place', slot: step.slot, stepId: step.stepId, ok: correct } }
  }

  if (step.kind === 'event') {
    const r = eventResult(step.eventId, step.choice)
    return {
      result: { kind: 'event', eventId: step.eventId, ...r },
      log: { k: 'event', id: step.eventId, choice: step.choice, ok: r.correct },
    }
  }

  if (step.kind === 'detect') {
    const correct = step.choice === answers.detective.answer
    return {
      result: { kind: 'detect', correct, explanation: answers.detective.explanation },
      log: { k: 'detect', choice: step.choice, ok: correct },
    }
  }

  if (step.kind === 'docs') {
    const allowed = answers.eligible[step.ownerType] ?? []
    const needDoc = answers.docRequired[step.tld]
    const need = needDoc ? (answers.docNames[needDoc] ?? '') : ''
    let result: RegistrarStepResult
    if (!allowed.includes(step.tld)) {
      result = {
        kind: 'docs',
        outcome: 'reject',
        message: `ไม่อนุมัติ ผู้ขอประเภทนี้ไม่มีสิทธิ์จดนามสกุล ${step.tld} กลับไปเลือกนามสกุลที่มีสิทธิ์ตามบัตร`,
      }
    } else if (step.docId !== needDoc) {
      result = {
        kind: 'docs',
        outcome: 'more',
        message: `ขอเอกสารเพิ่ม เอกสารที่แนบมาไม่ตรงกับนามสกุล ${step.tld} ต้องใช้${need}`,
      }
    } else if (step.round === 0) {
      result = {
        kind: 'docs',
        outcome: 'more',
        message: `ขอเอกสารเพิ่ม ภาพ${need}ที่แนบมาไม่ชัด ส่งภาพที่ชัดเจนกลับมาอีกครั้ง`,
      }
    } else {
      result = { kind: 'docs', outcome: 'approve', message: 'อนุมัติ คำขอและเอกสารถูกต้อง ชำระค่าธรรมเนียมได้เลย' }
    }
    return { result, log: { k: 'docs', tld: step.tld, doc: step.docId, round: step.round, outcome: result.outcome } }
  }

  const { rows, total, weakest } = rubricExplain(step)
  return {
    result: {
      kind: 'explain',
      rubric: rows,
      total,
      followUp: {
        question: answers.followUps[weakest] ?? answers.followUps['renew'] ?? '',
        reason: weakest === 'renew' ? (answers.eventExplanations['ev-expire'] ?? '') : (answers.stepReasons[weakest] ?? ''),
      },
    },
    log: { k: 'explain', total, rubric: rows.map((r) => r.got), typed: Boolean(step.text), len: step.text?.length ?? 0 },
  }
}

export function scoreRegistrar(payload: unknown): RegistrarResult {
  const parsed = RegistrarPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    const detail: RegistrarDetail = {
      order: { correct: 0, total: answers.order.length, points: 0, perSlot: [], reasons: {}, misses: 0 },
      events: { correct: 0, total: publicData.events.length, points: 0, perEvent: [] },
      explanation: { points: 0, max: 10, rubric: [] },
      stars: 0,
      searched: false,
      error: 'invalid-payload',
    }
    return { score: 0, passed: false, detail }
  }

  const { order, events, searched, explain } = parsed.data
  const misses = parsed.data.misses ?? 0

  // การ์ดซ้ำในหลายช่องนับแค่ช่องแรก กันการวางใบเดียวกันซ้ำเพื่อเก็บคะแนน
  const seen = new Set<string>()
  const perSlot = order.map((stepId, i) => {
    const duplicate = seen.has(stepId)
    seen.add(stepId)
    return { stepId, correct: !duplicate && answers.order[i] === stepId }
  })
  const orderCorrect = perSlot.filter((s) => s.correct).length
  const orderTotal = answers.order.length
  // วางถูกครั้งแรก = ถูกตำแหน่ง หักด้วยจำนวนครั้งที่วางผิดระหว่างทาง
  const firstTry = Math.max(0, Math.min(orderCorrect, orderTotal - misses))
  const orderPoints = (firstTry / orderTotal) * ORDER_POINTS

  const reasons: Record<string, string> = {}
  for (const stepId of seen) {
    const reason = answers.stepReasons[stepId]
    if (reason) reasons[stepId] = reason
  }

  const perEvent = publicData.events.map((ev) => {
    const chosen = events[ev.id]
    const r = eventResult(ev.id, chosen)
    return { id: ev.id, chosen: chosen ?? null, correct: r.correct, explanation: r.explanation }
  })
  const eventsCorrect = perEvent.filter((e) => e.correct).length
  const eventsTotal = perEvent.length
  const eventPoints = (eventsCorrect / eventsTotal) * EVENT_POINTS

  const rub = rubricExplain(explain)
  const explainPoints = (rub.total / 10) * EXPLAIN_POINTS

  const raw = orderPoints + eventPoints + explainPoints
  const passed = rub.total >= PASS_EXPLAIN && eventsCorrect >= MIN_EVENTS_CORRECT
  const stars = !passed ? 0 : parsed.data.repaired ? 1 : firstTry === orderTotal && rub.total >= 9 ? 3 : 2

  const detail: RegistrarDetail = {
    order: {
      correct: orderCorrect,
      total: orderTotal,
      points: Math.round(orderPoints * 10) / 10,
      perSlot,
      reasons,
      misses,
    },
    events: {
      correct: eventsCorrect,
      total: eventsTotal,
      points: Math.round(eventPoints * 10) / 10,
      perEvent,
    },
    explanation: { points: rub.total, max: 10, rubric: rub.rows },
    stars,
    searched,
  }

  return { score: Math.round(raw), passed, detail }
}

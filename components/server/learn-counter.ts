import { z } from 'zod'
import publicJson from '../../content/learn-counter.json'
import answersJson from '../../content/learn-counter-answers.json'
import {
  COUNTER_CATEGORIES,
  COUNTER_STAMPS,
  type CounterCaseResult,
  type CounterData,
  type CounterDetail,
  type CounterGroupResult,
  type CounterStepResult,
} from '../learn/counter-types'

/**
 * Scorer ของเกมลงมือทำ ด่าน 3 (เคาน์เตอร์รับจดโดเมน)
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น — ไฟล์นี้อ่าน learn-counter-answers.json
 * คะแนน 0-100 = 50% สัดส่วนป้ายประเภทที่ติดถูก + 50% สัดส่วนแต้มตรา
 * แต้มตราต่อลูกค้า: ตราถูกครั้งแรก 2 · ถูกตอนลองแก้ (attempt 2) 1 · ไม่ถูก 0
 * ผ่านเมื่อแต้มตรา >= 60% ของเต็ม และติดป้ายถูกอย่างน้อย 80%
 */

const category = z.enum(COUNTER_CATEGORIES)
const stamp = z.enum(COUNTER_STAMPS)
const tone = z.enum(['brand', 'quest', 'spark', 'reward'])
const hintList = z.array(z.string().min(1)).min(1)

const counterDataSchema = z.object({
  title: z.string(),
  intro: z.string(),
  maxQuestions: z.number().int().positive(),
  hintsPerShift: z.number().int().nonnegative(),
  handbookSeconds: z.number().int().positive(),
  categories: z.array(z.object({ id: category, label: z.string(), short: z.string() })),
  stamps: z.array(
    z.object({ id: stamp, label: z.string(), hint: z.string(), needsExtension: z.boolean() }),
  ),
  handbook: z.array(
    z.object({
      category,
      floor: z.string(),
      rows: z.array(z.object({ suffix: z.string(), who: z.string() })),
    }),
  ),
  hints: z.object({ request: hintList, interview: hintList, tag: hintList, stamp: hintList }),
  cases: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        portrait: z.string().optional(),
        particle: z.string().optional(),
        business: z.string(),
        tone,
        greeting: z.string(),
        domains: z.array(z.object({ name: z.string(), role: z.string() })).min(1),
        questions: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            reply: z.string(),
            docs: z.array(z.string()).optional(),
            who: z.string().optional(),
          }),
        ),
        extensionOptions: z.array(z.string()),
        reasons: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
      }),
    )
    .min(1),
})

const answersSchema = z.object({
  cases: z.array(
    z.object({
      caseId: z.string(),
      tags: z.record(z.string(), category),
      stamp,
      acceptedExtensions: z.array(z.string()),
      reason: z.string().optional(),
      keyQuestions: z.array(z.string()),
      explanation: z.string(),
    }),
  ),
})

const decisionSchema = z.object({
  caseId: z.string().min(1).max(40),
  tags: z.record(z.string().max(80), category),
  asked: z.array(z.string().max(20)).max(3),
  stamp,
  extension: z.string().max(40).nullable(),
  attempt: z.union([z.literal(1), z.literal(2)]).optional(),
  reason: z.string().max(20).nullable().optional(),
})

const payloadSchema = z.object({ decisions: z.array(decisionSchema).max(20) })

type Decision = z.infer<typeof decisionSchema>
type Answer = (typeof ANSWERS.cases)[number]

function judge(ans: Answer, d: Decision | undefined) {
  const domains = Object.keys(ans.tags)
  const wrongTags = d ? domains.filter((name) => d.tags[name] !== ans.tags[name]) : domains
  const needsExt = ans.acceptedExtensions.length > 0
  const stampCorrect =
    !!d &&
    d.stamp === ans.stamp &&
    (!needsExt || (d.extension != null && ans.acceptedExtensions.includes(d.extension.trim())))
  // การ์ดเหตุผล (S14) ตรวจแยก ไม่นับในคะแนน/เกณฑ์ผ่าน
  const reasonCorrect = ans.reason ? !!d && d.reason === ans.reason : undefined
  return { domains, wrongTags, stampCorrect, reasonCorrect }
}

const DATA: CounterData = counterDataSchema.parse(publicJson)
const ANSWERS = answersSchema.parse(answersJson)

export function publicCounterData(): CounterData {
  return DATA
}

export function scoreCounter(payload: unknown): { score: number; passed: boolean; detail: unknown } {
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) {
    const detail: CounterDetail = {
      tagAccuracy: 0,
      stampAccuracy: 0,
      cases: [],
      stampPoints: 0,
      stampMax: 0,
      groups: [],
      error: 'invalid-payload',
    }
    return { score: 0, passed: false, detail }
  }

  // เคสซ้ำ: ใช้คำตอบแรกเท่านั้น
  const byCase = new Map<string, (typeof parsed.data.decisions)[number]>()
  for (const d of parsed.data.decisions) if (!byCase.has(d.caseId)) byCase.set(d.caseId, d)

  let tagsCorrectAll = 0
  let tagsTotalAll = 0
  let stampPoints = 0
  const groupMap = new Map<string, CounterGroupResult>()

  const cases: CounterCaseResult[] = ANSWERS.cases.map((ans) => {
    const d = byCase.get(ans.caseId)
    const { domains, wrongTags, stampCorrect, reasonCorrect } = judge(ans, d)
    const tagsCorrect = domains.length - wrongTags.length
    const askedKeyQuestion = !!d && d.asked.some((q) => ans.keyQuestions.includes(q))
    const points: 0 | 1 | 2 = stampCorrect ? ((d?.attempt ?? 1) === 2 ? 1 : 2) : 0

    tagsCorrectAll += tagsCorrect
    tagsTotalAll += domains.length
    stampPoints += points
    for (const name of domains) {
      const cat = ans.tags[name]
      if (!cat) continue
      const g = groupMap.get(cat) ?? { category: cat, correct: 0, total: 0 }
      g.total += 1
      if (!wrongTags.includes(name)) g.correct += 1
      groupMap.set(cat, g)
    }

    return {
      caseId: ans.caseId,
      tagsCorrect,
      tagsTotal: domains.length,
      stampCorrect,
      askedKeyQuestion,
      ...(reasonCorrect === undefined ? {} : { reasonCorrect }),
      points,
      // เคสที่ไม่ได้ตอบไม่ส่งคำอธิบาย กันส่งชุดว่างมาขอเฉลยทั้งกะ
      explanation: d ? ans.explanation : '',
    }
  })

  const stampMax = ANSWERS.cases.length * 2
  const tagAccuracy = tagsTotalAll > 0 ? tagsCorrectAll / tagsTotalAll : 0
  const stampAccuracy = stampMax > 0 ? stampPoints / stampMax : 0
  const score = Math.round(50 * tagAccuracy + 50 * stampAccuracy)
  const passed = stampAccuracy >= 0.6 && tagAccuracy >= 0.8

  const groups = COUNTER_CATEGORIES.map((c) => groupMap.get(c)).filter((g): g is CounterGroupResult => !!g)
  const detail: CounterDetail = { tagAccuracy, stampAccuracy, cases, stampPoints, stampMax, groups }
  return { score, passed, detail }
}

/**
 * ตรวจลูกค้าทีละคนระหว่างเล่น (`action: 'step'`) — ไม่เก็บคะแนน ใช้ให้เกมบอกว่าถูกไหมเพื่อลองแก้ 1 ครั้ง
 * คำอธิบายเปิดเฉพาะตอนลองแก้ครั้งที่ 2 แล้วยังไม่ถูก
 * @throws ZodError เมื่อรูปแบบข้อมูลผิด (route ตอบ 400)
 */
export function checkCounterStep(payload: unknown): {
  result: CounterStepResult
  log: { caseId: string; attempt: 1 | 2; correct: boolean }
} {
  const d = decisionSchema.parse(payload)
  const ans = ANSWERS.cases.find((c) => c.caseId === d.caseId)
  const attempt = d.attempt ?? 1
  if (!ans) {
    return {
      result: { correct: false, stampCorrect: false, tagsCorrect: 0, tagsTotal: 0, wrongTags: [], explanation: '' },
      log: { caseId: d.caseId, attempt, correct: false },
    }
  }
  const { domains, wrongTags, stampCorrect, reasonCorrect } = judge(ans, d)
  const correct = stampCorrect && wrongTags.length === 0
  return {
    result: {
      correct,
      stampCorrect,
      tagsCorrect: domains.length - wrongTags.length,
      tagsTotal: domains.length,
      wrongTags,
      ...(reasonCorrect === undefined ? {} : { reasonCorrect }),
      explanation: !correct && attempt === 2 ? ans.explanation : '',
    },
    log: { caseId: d.caseId, attempt, correct },
  }
}

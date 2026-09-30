/**
 * เฉลยของคลังเนื้อหาตามสเปกหัวข้อ 11 — โมดูลฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * โหลด content/mission-tasks-answers.json และ content/bonus-missions-answers.json
 * ถ้าถูก import เข้า client component เมื่อไหร่ เฉลยจะติดไปกับ bundle
 * และผู้เรียนเปิด DevTools อ่านได้ทั้งชุด จึงมีตัวกันไว้ข้างล่างนี้แบบเดียวกับ core/quiz.ts
 *
 * โจทย์ที่ไม่มีเฉลยอยู่ที่ core/content-library.ts ซึ่ง import จากเบราว์เซอร์ได้
 * การตรวจคำตอบต้องทำที่เซิร์ฟเวอร์เสมอ ห้ามส่งเฉลยไปให้เบราว์เซอร์ตรวจเอง
 */
import { z } from 'zod'
import bonusAnswersJson from '../content/bonus-missions-answers.json' with { type: 'json' }
import missionAnswersJson from '../content/missions-answers.json' with { type: 'json' }
import missionsJson from '../content/missions.json' with { type: 'json' }
import taskAnswersJson from '../content/mission-tasks-answers.json' with { type: 'json' }
import { bonusMissions, findMissionTask, missionTasks } from './content-library'

if (typeof window !== 'undefined') {
  throw new Error(
    'core/content-library-answers.ts มีเฉลย ห้าม import จากฝั่งเบราว์เซอร์ ให้เรียกผ่าน API ฝั่งเซิร์ฟเวอร์แทน',
  )
}

const ChoiceFeedbackSchema = z.object({
  index: z.number().int().min(0),
  text: z.string().min(1),
})

const AspectSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  keywords: z.array(z.string().min(1)).optional(),
  hintWhenMissing: z.string().optional(),
  checkedBy: z.string().optional(),
})

const TaskAnswerSchema = z
  .object({
    id: z.string().min(1),
    answerIndex: z.number().int().min(0).nullable().optional(),
    answerIndexes: z.array(z.number().int().min(0)).optional(),
    explanation: z.string().min(1).nullable().optional(),
    choiceFeedback: z.array(ChoiceFeedbackSchema).optional(),
    gradedBy: z.string().optional(),
    passRule: z.string().optional(),
    aspects: z.array(AspectSchema).optional(),
    sampleAnswer: z.string().min(1).nullable().optional(),
  })
  .passthrough()

const BonusAnswerSchema = z
  .object({
    id: z.string().min(1),
    answerIndex: z.number().int().min(0).nullable().optional(),
    answerIndexes: z.array(z.number().int().min(0)).optional(),
    explanation: z.string().min(1).nullable().optional(),
    choiceFeedback: z.array(ChoiceFeedbackSchema).optional(),
    gradedBy: z.string().optional(),
    groupAnswers: z
      .array(
        z.object({
          groupId: z.string().min(1),
          answerIndex: z.number().int().min(0),
          explanation: z.string().min(1).nullable().optional(),
        }),
      )
      .optional(),
    groupKey: z
      .array(z.object({ groupId: z.string().min(1), cardIds: z.array(z.string().min(1)).min(1) }))
      .optional(),
  })
  .passthrough()

export type TaskAnswer = z.infer<typeof TaskAnswerSchema>
export type BonusAnswer = z.infer<typeof BonusAnswerSchema>

export const taskAnswers: TaskAnswer[] = z.array(TaskAnswerSchema).min(1).parse(taskAnswersJson.tasks)
export const bonusAnswers: BonusAnswer[] = z.array(BonusAnswerSchema).min(1).parse(bonusAnswersJson.items)

/**
 * ตรวจว่าโจทย์กับเฉลยจับคู่กันครบตั้งแต่ตอนโหลด
 * ถ้าปล่อยให้ขาดคู่ ผู้เรียนจะเจอข้อที่ตรวจไม่ได้กลางคาบ และคะแนนทั้งห้องจะเพี้ยน
 */
function assertPaired(): void {
  const answerIds = new Set(taskAnswers.map((a) => a.id))
  if (answerIds.size !== taskAnswers.length) {
    throw new Error('content/mission-tasks-answers.json มี id ซ้ำกัน')
  }
  for (const task of missionTasks) {
    if (!answerIds.has(task.id)) {
      throw new Error(`โจทย์ ${task.id} ไม่มีเฉลยใน content/mission-tasks-answers.json`)
    }
  }
  for (const answer of taskAnswers) {
    const isAlt = answer.id.endsWith('-alt')
    if (!isAlt && !findMissionTask(answer.id)) {
      throw new Error(`เฉลย ${answer.id} ไม่มีโจทย์คู่กันใน content/mission-tasks.json`)
    }
  }

  const bonusIds = new Set(bonusAnswers.map((a) => a.id))
  if (bonusIds.size !== bonusAnswers.length) {
    throw new Error('content/bonus-missions-answers.json มี id ซ้ำกัน')
  }
  for (const mission of bonusMissions) {
    for (const item of mission.items) {
      if (!bonusIds.has(item.id)) {
        throw new Error(`ข้อ ${item.id} ไม่มีเฉลยใน content/bonus-missions-answers.json`)
      }
    }
  }
}

/**
 * ตรวจว่าเลขตัวเลือกที่เฉลยชี้ไป มีอยู่จริงในโจทย์
 * เคยพลาดกันมาแล้วตอนสลับลำดับตัวเลือกเพื่อไม่ให้ข้อถูกอยู่ตำแหน่งแรกเสมอ
 */
function assertIndexesInRange(): void {
  for (const answer of taskAnswers) {
    const task = findMissionTask(answer.id)
    const choices = task?.choices
    if (!choices) continue
    const indexes = [
      ...(typeof answer.answerIndex === 'number' ? [answer.answerIndex] : []),
      ...(answer.answerIndexes ?? []),
      ...(answer.choiceFeedback ?? []).map((f) => f.index),
    ]
    for (const i of indexes) {
      if (i >= choices.length) {
        throw new Error(`เฉลยของ ${answer.id} ชี้ไปตัวเลือกที่ ${i} แต่โจทย์มีแค่ ${choices.length} ตัวเลือก`)
      }
    }
  }

  const bonusItems = new Map(bonusMissions.flatMap((m) => m.items).map((i) => [i.id, i]))
  for (const answer of bonusAnswers) {
    const choices = bonusItems.get(answer.id)?.choices
    if (!choices) continue
    const indexes = [
      ...(typeof answer.answerIndex === 'number' ? [answer.answerIndex] : []),
      ...(answer.answerIndexes ?? []),
      ...(answer.choiceFeedback ?? []).map((f) => f.index),
    ]
    for (const i of indexes) {
      if (i >= choices.length) {
        throw new Error(`เฉลยของ ${answer.id} ชี้ไปตัวเลือกที่ ${i} แต่โจทย์มีแค่ ${choices.length} ตัวเลือก`)
      }
    }
  }
}

assertPaired()
assertIndexesInRange()

export function findTaskAnswer(id: string): TaskAnswer | undefined {
  return taskAnswers.find((a) => a.id === id)
}

export function findBonusAnswer(id: string): BonusAnswer | undefined {
  return bonusAnswers.find((a) => a.id === id)
}

export interface ChoiceGrade {
  correct: boolean
  /** ข้อความเฉพาะตัวเลือกที่เลือกผิด ถ้าคลังเนื้อหาเขียนไว้ */
  feedback: string | null
  explanation: string | null
}

/** ตรวจข้อเลือกตอบข้อเดียว รองรับทั้งโจทย์ภารกิจและภารกิจเสริม */
export function gradeChoice(answer: TaskAnswer | BonusAnswer | undefined, picked: number): ChoiceGrade {
  if (!answer || typeof answer.answerIndex !== 'number') {
    return { correct: false, feedback: null, explanation: null }
  }
  const correct = picked === answer.answerIndex
  const feedback = correct ? null : (answer.choiceFeedback?.find((f) => f.index === picked)?.text ?? null)
  return { correct, feedback, explanation: correct ? (answer.explanation ?? null) : null }
}

/**
 * ตรวจข้อเลือกหลายข้อ ต้องตรงครบพอดี ไม่ขาดไม่เกิน
 * เรียงลำดับที่ผู้เรียนกดไม่มีผล
 */
export function gradeMultiChoice(
  answer: TaskAnswer | BonusAnswer | undefined,
  picked: number[],
): ChoiceGrade {
  const key = answer?.answerIndexes
  if (!key || key.length === 0) return { correct: false, feedback: null, explanation: null }
  const chosen = [...new Set(picked)].sort((a, b) => a - b)
  const want = [...key].sort((a, b) => a - b)
  const correct = chosen.length === want.length && chosen.every((v, i) => v === want[i])
  const firstWrong = chosen.find((i) => !want.includes(i))
  const feedback =
    correct || firstWrong === undefined
      ? null
      : (answer.choiceFeedback?.find((f) => f.index === firstWrong)?.text ?? null)
  return { correct, feedback, explanation: correct ? (answer.explanation ?? null) : null }
}

/* ------------------------------------------------------------------ *
 * ข้อความตอบกลับรายตัวเลือกของข้อตรวจภารกิจ (สเปกหัวข้อ 11.3 · ใช้ใน S-19)
 * ------------------------------------------------------------------ */

/** spec-11.3 คือลอกจากสเปกทุกคำ · derived คือถอดมาจาก explanation ของข้อเดียวกัน ครูควรอ่านทวน */
export const FEEDBACK_SOURCES = ['spec-11.3', 'derived'] as const
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]

const MissionChoiceFeedbackSchema = z.object({
  index: z.number().int().min(0),
  text: z.string().min(1),
  source: z.enum(FEEDBACK_SOURCES),
})

const MissionAnswerSchema = z
  .object({
    id: z.string().min(1),
    checkId: z.string().min(1),
    answerIndex: z.number().int().min(0),
    explanation: z.string().min(1),
    /** เกณฑ์ดาวที่ส่งกลับให้ผู้เรียนอ่านตอนตอบถูก — ตัวคำนวณจริงคือ starsFor() ไม่ใช่ข้อความนี้ */
    starCriteria: z.string().min(1),
    choiceFeedback: z.array(MissionChoiceFeedbackSchema).min(1),
  })
  .passthrough()

export type MissionChoiceFeedback = z.infer<typeof MissionChoiceFeedbackSchema>
export type MissionAnswer = z.infer<typeof MissionAnswerSchema>

export const missionAnswers: MissionAnswer[] = z
  .array(MissionAnswerSchema)
  .min(1)
  .parse(missionAnswersJson.missions)

/**
 * ตัวเลือกที่ยังไม่ถูก "ทุกตัว" ต้องมีข้อความเฉพาะของมัน
 *
 * โจทย์ของสื่อนี้คือห้ามตอบกลับด้วยข้อความกลาง ๆ เพราะผู้เรียนไม่รู้ว่าตัวเองเข้าใจคลาดตรงไหน
 * ถ้าขาดไปแม้ตัวเดียว ให้พังตั้งแต่โหลด ดีกว่าให้ผู้เรียนบางคนเจอข้อความเปล่า
 * และห้ามมีข้อความของตัวเลือกที่ถูก เพราะจะกลายเป็นเฉลยโผล่ตอนตอบผิด
 */
function assertChoiceFeedbackComplete(): void {
  const choicesOf = new Map(missionsJson.missions.map((m) => [m.id, m.check.choices]))
  for (const answer of missionAnswers) {
    const choices = choicesOf.get(answer.id)
    if (!choices) {
      throw new Error(`content/missions-answers.json มี ${answer.id} แต่ content/missions.json ไม่มีภารกิจนี้`)
    }
    if (answer.answerIndex >= choices.length) {
      throw new Error(`เฉลยของ ${answer.id} ชี้ไปตัวเลือกที่ ${answer.answerIndex} แต่มีแค่ ${choices.length} ตัวเลือก`)
    }
    const covered = new Set(answer.choiceFeedback.map((f) => f.index))
    for (let i = 0; i < choices.length; i += 1) {
      if (i === answer.answerIndex) {
        if (covered.has(i)) {
          throw new Error(`${answer.id} มีข้อความตอบกลับของตัวเลือกที่ถูก (${i}) ซึ่งจะกลายเป็นการเฉลย`)
        }
        continue
      }
      if (!covered.has(i)) {
        throw new Error(`${answer.id} ยังไม่มีข้อความตอบกลับของตัวเลือกที่ ${i}`)
      }
    }
    for (const f of answer.choiceFeedback) {
      if (f.index >= choices.length) {
        throw new Error(`${answer.id} มีข้อความตอบกลับของตัวเลือกที่ ${f.index} ซึ่งไม่มีอยู่จริง`)
      }
    }
  }
}

assertChoiceFeedbackComplete()

export function findMissionAnswer(missionId: string): MissionAnswer | undefined {
  return missionAnswers.find((a) => a.id === missionId)
}

/**
 * ข้อความตอบกลับของตัวเลือกที่ผู้เรียนเลือก
 * คืน null เมื่อเลือกถูก เพราะข้อความตอนตอบถูกมาจากคลังข้อความ (S-19) ไม่ใช่ที่นี่
 */
export function missionChoiceFeedback(missionId: string, picked: number): string | null {
  const answer = findMissionAnswer(missionId)
  if (!answer || picked === answer.answerIndex) return null
  return answer.choiceFeedback.find((f) => f.index === picked)?.text ?? null
}

export interface MissionCheckGrade {
  /** ไม่พบเฉลยของข้อนี้ = ตรวจไม่ได้ ผู้เรียกต้องตอบ 503 ไม่ใช่ตัดสินว่าผิด */
  found: boolean
  correct: boolean
  /** ส่งกลับเฉพาะตอนตอบถูก ตอบผิดห้ามส่งอะไรที่ชี้เฉลยได้ */
  explanation: string | null
  starCriteria: string | null
  /** ข้อความเฉพาะตัวเลือกที่เลือกผิด (สเปกหัวข้อ 11.3 · S-19) null เมื่อตอบถูก */
  choiceFeedback: string | null
}

/**
 * ตรวจข้อเช็กความเข้าใจของภารกิจ — **ทางเดียวที่ควรใช้ตรวจข้อเช็ก**
 *
 * รวมทุกอย่างที่เส้นทาง `POST /api/mission/:id/check` ต้องใช้ไว้ในที่เดียว
 * (เฉลย · คำอธิบายตอนตอบถูก · เกณฑ์ดาว · ข้อความรายตัวเลือกตอนตอบผิด)
 * เพื่อไม่ให้มีสองที่อ่านไฟล์เฉลยด้วยกติกาคนละชุด ซึ่งจะเพี้ยนกันเงียบ ๆ เมื่อไฟล์เนื้อหาเปลี่ยน
 *
 * ตรวจ checkId ด้วยเสมอ กันกรณีไฟล์โจทย์เปลี่ยนข้อเช็กของภารกิจแล้วเฉลยยังเป็นของข้อเก่า
 */
export function gradeMissionCheck(
  missionId: string,
  checkId: string,
  picked: number,
): MissionCheckGrade {
  const answer = findMissionAnswer(missionId)
  if (!answer || answer.checkId !== checkId) {
    return { found: false, correct: false, explanation: null, starCriteria: null, choiceFeedback: null }
  }
  const correct = picked === answer.answerIndex
  return {
    found: true,
    correct,
    explanation: correct ? answer.explanation : null,
    starCriteria: correct ? (answer.starCriteria as string) : null,
    choiceFeedback: correct ? null : missionChoiceFeedback(missionId, picked),
  }
}

/** ข้อความที่ยังไม่ได้ลอกมาจากสเปก ครูควรอ่านทวนก่อนใช้จริง */
export function derivedChoiceFeedback(): Array<{ missionId: string; index: number; text: string }> {
  return missionAnswers.flatMap((a) =>
    a.choiceFeedback
      .filter((f) => f.source === 'derived')
      .map((f) => ({ missionId: a.id, index: f.index, text: f.text })),
  )
}

export interface AspectGrade {
  metIds: string[]
  missingIds: string[]
  /** คำใบ้ของประเด็นแรกที่ยังขาด ตามที่สเปกหัวข้อ 11.3 ให้ใบ้ตามประเด็นที่ขาด */
  nextHint: string | null
}

/**
 * ตรวจข้อเขียนด้วยคำสำคัญ ใช้เมื่อ AI ใช้ไม่ได้
 * เทียบแบบไม่สนตัวพิมพ์ใหญ่เล็ก เพราะคำสำคัญมีทั้งไทยและอังกฤษปนกัน
 * ประเด็นที่ไม่มีคำสำคัญในคลัง ถือว่ายังตรวจด้วยกฎไม่ได้ จึงนับเป็นยังไม่ได้ประเด็นนั้น
 */
export function gradeAspects(answer: TaskAnswer | undefined, text: string): AspectGrade {
  const aspects = answer?.aspects ?? []
  const hay = (text ?? '').toLowerCase()
  const metIds: string[] = []
  const missingIds: string[] = []
  for (const aspect of aspects) {
    const keywords = aspect.keywords ?? []
    const met = keywords.length > 0 && keywords.some((k) => hay.includes(k.toLowerCase()))
    if (met) metIds.push(aspect.id)
    else missingIds.push(aspect.id)
  }
  const firstMissing = aspects.find((a) => missingIds.includes(a.id))
  return { metIds, missingIds, nextHint: firstMissing?.hintWhenMissing ?? null }
}

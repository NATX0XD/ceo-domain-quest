import { z } from 'zod'
import checkJson from '@/content/check-questions.json'

/**
 * S-05 เช็กความเข้าใจ 4 ข้อ — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * แยกให้ขาดจากแบบทดสอบวิจัย (T-12) ซึ่งมี 10 ข้อและอยู่ที่ /pretest กับ /posttest:
 * - ชุดนี้ = 4 ข้อ อยู่ในช่วงรู้จักตัวเอง ใช้ **เสนอระดับตัวช่วย** ไม่ใช่คะแนนวิจัย ไม่เก็บเป็นคะแนน
 * - ชุดวิจัย = 10 ข้อ ก่อน/หลังคาบ ครูเป็นคนเปิด เก็บลง profiles.pre_test_score / post_test_score
 *
 * ⚠️ เฉลยอยู่ใน content/check-questions-answers.json **ห้าม import จาก client component**
 *    โหลดด้วย dynamic import ในฟังก์ชันตรวจเท่านั้น เพื่อไม่ให้เฉลยติดไปกับ bundle ของหน้าไหนเลย
 */

const QuestionSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  objectiveId: z.string().min(1),
  topic: z.string().min(1),
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2),
})

const FileSchema = z.object({
  meta: z.object({
    title: z.string().min(1),
    intro: z.string().min(1),
    questionCount: z.number().int().positive(),
  }),
  sets: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        role: z.string().min(1),
        questions: z.array(QuestionSchema).min(1),
      }),
    )
    .min(1),
})

const checkFile = FileSchema.parse(checkJson)

export type CheckSetId = string
export type CheckQuestion = z.infer<typeof QuestionSchema>

export const checkMeta = checkFile.meta

/** ชุดหลักที่ใช้ในคาบปกติ = ชุดแรกในไฟล์ (ชุด B เป็นชุดคู่ขนานไว้สลับ) */
export const DEFAULT_CHECK_SET = checkFile.sets[0]?.id ?? 'set-a'

export function checkSetIds(): string[] {
  return checkFile.sets.map((s) => s.id)
}

/** โจทย์ที่ส่งให้เบราว์เซอร์ได้ — ไม่มี answerIndex และไม่มีคำอธิบายเฉลยติดไป */
export function checkQuestionsForClient(setId: string = DEFAULT_CHECK_SET) {
  const set = checkFile.sets.find((s) => s.id === setId) ?? checkFile.sets[0]
  return (set?.questions ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((q) => ({ id: q.id, question: q.question, choices: q.choices, topic: q.topic }))
}

export interface CheckResult {
  score: number
  total: number
  /** ผลรายข้อ (ใช้บันทึกความมั่นใจคู่กับผลจริง เพื่อคิดธง calibration ให้ครู) */
  perQuestion: { id: string; objectiveId: string; correct: boolean; topic: string }[]
  /** วัตถุประสงค์ที่ยังไม่แม่น — ใช้เสนอระดับตัวช่วยและเน้นเนื้อหา */
  weakObjectiveIds: string[]
}

export interface CheckSuggestion {
  suggested: 1 | 2 | 3
  reason: string
}

/**
 * เสนอระดับตัวช่วยจากผลเช็ก 4 ข้อ
 *
 * ⚠️ **ห้ามใช้ `recommendLevel()` ของ core/personalize กับชุดนี้** — ฟังก์ชันนั้นผูกกับ
 *    `preTestMap` ของแบบทดสอบวิจัย (รหัสข้อ pre-*) และคิดระดับจากคะแนนเต็ม 10
 *    เอามาใช้กับชุด 4 ข้อแล้วได้เหตุผลผิด (เคยได้ข้อความ "ตอบถูกครบทุกข้อ" ทั้งที่ได้ 1 จาก 4)
 * ระดับเป็นแค่ข้อเสนอ ผู้เรียนกดเปลี่ยนเองได้ที่ /profile เสมอ
 */
export function suggestLevelFromCheck(result: CheckResult): CheckSuggestion {
  const weakTopics = [...new Set(result.perQuestion.filter((q) => !q.correct).map((q) => q.topic))]

  if (weakTopics.length === 0) {
    return {
      suggested: 1,
      reason:
        'ตอบตรงแนวครบทุกข้อ ระบบจึงเสนอให้ลองทำเองก่อนโดยไม่เปิดป้ายช่วย อยากเปิดตัวช่วยกดเองได้ทุกเมื่อ',
    }
  }

  // ยังไม่ชัด 1 เรื่อง = ตัวช่วยระดับ 2 · ตั้งแต่ 2 เรื่องขึ้นไป = ระดับ 3 (ตัวช่วยเยอะสุด)
  const suggested: 1 | 2 | 3 = weakTopics.length >= 2 ? 3 : 2
  return {
    suggested,
    reason: `ยังไม่ชัดเรื่อง ${weakTopics.join(' และ ')} ระบบจึงเสนอระดับตัวช่วยที่ ${suggested} ให้ กดเปลี่ยนเองได้ถ้าอยากลองเอง`,
  }
}

/**
 * ตรวจคำตอบ — เฉลยถูกอ่านตรงนี้ที่เดียว
 * คืนเฉพาะสรุป ไม่คืนเฉลยหรือคำอธิบายกลับไปให้หน้าจอ
 */
export async function gradeCheck(
  answers: Record<string, number>,
  setId: string = DEFAULT_CHECK_SET,
): Promise<CheckResult> {
  const { default: answerFile } = await import('@/content/check-questions-answers.json')
  const answerById = new Map(
    (answerFile.questions as { id: string; answerIndex: number }[]).map((row) => [
      row.id,
      row.answerIndex,
    ]),
  )

  const set = checkFile.sets.find((s) => s.id === setId) ?? checkFile.sets[0]
  const questions = set?.questions ?? []

  const perQuestion = questions.map((q) => ({
    id: q.id,
    objectiveId: q.objectiveId,
    topic: q.topic,
    correct: answers[q.id] === answerById.get(q.id),
  }))

  return {
    score: perQuestion.filter((q) => q.correct).length,
    total: questions.length,
    perQuestion,
    weakObjectiveIds: [...new Set(perQuestion.filter((q) => !q.correct).map((q) => q.objectiveId))],
  }
}

/**
 * แบบทดสอบก่อน/หลังเรียน และรายชื่อโดเมนที่ถูกจองแล้ว — โมดูลฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * ไฟล์นี้โหลด content/quiz-answers.json ซึ่งมีเฉลย
 * ถ้าถูก import เข้า client component เมื่อไหร่ เฉลยจะติดไปกับ bundle
 * และนักเรียนเปิด DevTools อ่านได้ทั้งชุด จึงมีตัวกันไว้ข้างล่างนี้
 *
 * โจทย์ (ไม่มีเฉลย) อยู่ที่ content/quiz.json ส่งให้เบราว์เซอร์ได้ผ่าน API หรือ server component
 * การตรวจคำตอบต้องทำที่เซิร์ฟเวอร์เสมอ ห้ามส่งเฉลยไปให้เบราว์เซอร์ตรวจเอง
 */
import { z } from 'zod'
import quizAnswersJson from '../content/quiz-answers.json' with { type: 'json' }
import quizJson from '../content/quiz.json' with { type: 'json' }
import takenDomainsJson from '../content/taken-domains.json' with { type: 'json' }

if (typeof window !== 'undefined') {
  throw new Error(
    'core/quiz.ts มีเฉลยข้อสอบ ห้าม import จากฝั่งเบราว์เซอร์ ให้เรียกผ่าน API ฝั่งเซิร์ฟเวอร์แทน',
  )
}

/** โจทย์ที่เปิดเผยได้ ส่งให้เบราว์เซอร์ได้ */
const QuizQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  /** ต้องมี 4 ตัวเลือกพอดี ไม่มากไม่น้อย เพราะหน้าจอวางไว้ 4 ปุ่ม */
  choices: z.array(z.string().min(1)).length(4),
  /**
   * จุดประสงค์ที่ข้อนี้วัด อ้างถึง objectives ใน content/self-profile.json
   * ข้อหนึ่งวัดได้มากกว่าหนึ่งจุดประสงค์ เช่น ข้อสถานการณ์ที่วัดทั้ง obj-4 และ obj-5
   */
  objectiveIds: z.array(z.string().min(1)).min(1),
})

/** เฉลย ห้ามหลุดไปฝั่งเบราว์เซอร์ */
const QuizAnswerSchema = z.object({
  id: z.string().min(1),
  /** ลำดับตัวเลือกที่ถูก นับจาก 0 จึงต้องอยู่ในช่วง 0-3 */
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
})

const QuizFileSchema = z.object({
  pre: z.array(QuizQuestionSchema).min(1),
  post: z.array(QuizQuestionSchema).min(1),
})

/**
 * ตรวจว่าชุดหลังเรียนเป็นแบบคู่ขนานของชุดก่อนเรียน "ข้อต่อข้อ"
 * ถ้าข้อที่ i ของสองชุดวัดคนละจุดประสงค์ การเทียบคะแนนก่อน-หลังจะไม่มีความหมาย
 * และค่าทีที่รายงานไปก็เชื่อไม่ได้ จึงให้พังตั้งแต่โหลดไฟล์ ดีกว่ารายงานผลผิดให้กรรมการ
 */
function assertParallelForms(file: QuizFile): void {
  if (file.pre.length !== file.post.length) {
    throw new Error(
      `content/quiz.json ชุดก่อนเรียนมี ${file.pre.length} ข้อ แต่ชุดหลังเรียนมี ${file.post.length} ข้อ ต้องเท่ากันจึงเทียบคะแนนก่อน-หลังได้`,
    )
  }
  for (let i = 0; i < file.pre.length; i += 1) {
    const before = [...file.pre[i]!.objectiveIds].sort().join(',')
    const after = [...file.post[i]!.objectiveIds].sort().join(',')
    if (before !== after) {
      throw new Error(
        `content/quiz.json ข้อที่ ${i + 1} วัดจุดประสงค์ไม่ตรงกัน (${file.pre[i]!.id} วัด ${before} แต่ ${file.post[i]!.id} วัด ${after})`,
      )
    }
  }
}

const QuizAnswerFileSchema = z.object({
  pre: z.array(QuizAnswerSchema).min(1),
  post: z.array(QuizAnswerSchema).min(1),
})

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>
export type QuizAnswer = z.infer<typeof QuizAnswerSchema>
export type QuizFile = z.infer<typeof QuizFileSchema>
/** ชุดข้อสอบ: ก่อนเรียน หรือ หลังเรียน */
export type QuizSetName = keyof QuizFile

/** โจทย์พร้อมเฉลย ใช้ได้เฉพาะฝั่งเซิร์ฟเวอร์ */
export type QuizQuestionWithAnswer = QuizQuestion & Omit<QuizAnswer, 'id'>

export const quiz: QuizFile = QuizFileSchema.parse(quizJson)
assertParallelForms(quiz)

/** คะแนนเต็มของแต่ละชุด = จำนวนข้อ (ข้อละ 1 คะแนน) — B ในสูตร E2 ของสเปกข้อ 9.3 */
export function quizMaxScore(set: QuizSetName): number {
  return quiz[set].length
}

/** จุดประสงค์ทั้งหมดที่ข้อสอบชุดนี้วัด เรียงตามที่พบในไฟล์ */
/**
 * @wired-optional ใช้ตรวจว่าข้อสอบครอบคลุมจุดประสงค์ครบ ไม่ได้อยู่บนเส้นทางการทำข้อสอบ
 *   รายงานผลอ่านจุดประสงค์จาก content/self-profile.json ไม่ใช่จากไฟล์ข้อสอบ
 */
export function quizObjectiveIds(set: QuizSetName = 'pre'): string[] {
  const ids: string[] = []
  for (const q of quiz[set]) {
    for (const id of q.objectiveIds) if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

const quizAnswers = QuizAnswerFileSchema.parse(quizAnswersJson)

/**
 * ต่อโจทย์กับเฉลยเข้าด้วยกัน
 * ถ้า id ไม่ครบคู่หรือเรียงไม่ตรงกัน ให้พังตั้งแต่ตอนโหลด
 * ดีกว่าปล่อยให้ตรวจข้อสอบผิดข้อทั้งห้องแล้วค่อยรู้ทีหลัง
 */
function joinAnswers(set: QuizSetName): QuizQuestionWithAnswer[] {
  const answers = new Map(quizAnswers[set].map((a) => [a.id, a]))
  if (answers.size !== quizAnswers[set].length) {
    throw new Error(`content/quiz-answers.json ชุด ${set} มี id ซ้ำกัน`)
  }
  return quiz[set].map((q) => {
    const answer = answers.get(q.id)
    if (!answer) {
      throw new Error(`ข้อ ${q.id} ไม่มีเฉลยใน content/quiz-answers.json`)
    }
    return { ...q, answerIndex: answer.answerIndex, explanation: answer.explanation }
  })
}

const questionsWithAnswers: Record<QuizSetName, QuizQuestionWithAnswer[]> = {
  pre: joinAnswers('pre'),
  post: joinAnswers('post'),
}

export const takenDomains: string[] = z
  .array(z.string().min(1))
  .min(1)
  .parse(takenDomainsJson.items)
  .map((d) => d.trim().toLowerCase())

/** ชุดตรวจค้นแบบเร็ว สร้างครั้งเดียวตอนโหลดไฟล์ */
const takenSet = new Set(takenDomains)

/** คำตอบของนักเรียน: รหัสข้อ → ลำดับตัวเลือกที่เลือก (ข้อที่ยังไม่ตอบให้ข้ามไปได้) */
export type QuizAnswers = Record<string, number | string | null | undefined>

export interface ObjectiveScore {
  objectiveId: string
  correct: number
  total: number
}

export interface QuizResult {
  /** จำนวนข้อที่ตอบถูก */
  score: number
  /** จำนวนข้อทั้งหมดในชุด */
  total: number
  /** รหัสข้อที่ตอบผิดหรือไม่ได้ตอบ ใช้ชี้ว่าต้องทบทวนเรื่องไหน */
  wrongIds: string[]
  /** ตอบถูกกี่ข้อในแต่ละจุดประสงค์ ครูใช้ดูว่าต้องทบทวนเรื่องไหนท้ายคาบ */
  byObjective: Record<string, ObjectiveScore>
  /** รหัสข้อ -> ตอบถูกหรือไม่ ใช้ต่อกับ itemAnalysis ใน core/statistics.ts ได้ตรง ๆ */
  correctByItem: Record<string, boolean>
}

/** โจทย์อย่างเดียว ไม่มีเฉลย — ชุดนี้ส่งออกไปฝั่งเบราว์เซอร์ได้ */
export function getQuizSet(set: QuizSetName): QuizQuestion[] {
  return quiz[set]
}

/** โจทย์พร้อมเฉลย ใช้ตอนเฉลยหลังส่งคำตอบแล้วเท่านั้น */
export function getQuizSetWithAnswers(set: QuizSetName): QuizQuestionWithAnswer[] {
  return questionsWithAnswers[set]
}

/**
 * แปลงค่าที่รับมาจาก client ให้เป็นลำดับตัวเลือก
 * ฟอร์ม HTML ส่ง e.target.value มาเป็น string ("0") เสมอ และ JSON ที่ไม่ได้แปลงก็เป็น string ได้
 * ถ้าเทียบด้วย === ตรง ๆ จะได้ 0 คะแนนทั้งชุดโดยไม่มีสัญญาณเตือน
 * คืน null เมื่อค่าไม่ใช่ตัวเลข ว่าง หรือไม่ได้ตอบ — นับเป็นตอบผิด
 */
function toChoiceIndex(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string' && raw.trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
}

/** ตรวจคำตอบทั้งชุด ข้อที่ไม่ได้ตอบนับเป็นผิด */
export function gradeQuiz(answers: QuizAnswers, set: QuizSetName): QuizResult {
  const questions = getQuizSetWithAnswers(set)
  const wrongIds: string[] = []
  const correctByItem: Record<string, boolean> = {}
  const byObjective: Record<string, ObjectiveScore> = {}

  for (const q of questions) {
    const correct = toChoiceIndex(answers[q.id]) === q.answerIndex
    correctByItem[q.id] = correct
    if (!correct) wrongIds.push(q.id)

    for (const objectiveId of q.objectiveIds) {
      const row = (byObjective[objectiveId] ??= { objectiveId, correct: 0, total: 0 })
      row.total += 1
      if (correct) row.correct += 1
    }
  }

  return {
    score: questions.length - wrongIds.length,
    total: questions.length,
    wrongIds,
    byObjective,
    correctByItem,
  }
}

/**
 * แปลงคะแนนก่อนเรียนเป็นระดับตัวช่วยที่สถานี B
 * คะแนนน้อย = ระดับ 1 = เห็นป้ายบอกเงื่อนไขครบ
 * คะแนนเต็ม = ระดับ 3 = ไม่มีป้าย ต้องจำจากที่ครูสอน
 *
 * ค่าที่อ่านไม่ได้ (NaN, ค่าติดลบ, ค่าเกินคะแนนเต็ม) ถูกบีบเข้าช่วงก่อนเสมอ
 * เพราะถ้าปล่อยผ่าน เด็กที่คะแนนเพี้ยนจะโดนโหมดยากสุดโดยไม่มีใครรู้
 */
export function suggestScaffoldLevel(preScore: number): 1 | 2 | 3 {
  const total = quiz.pre.length
  if (total <= 0) return 1
  const safe = Number.isFinite(preScore) ? Math.min(Math.max(preScore, 0), total) : 0
  const ratio = safe / total
  if (ratio < 0.5) return 1
  if (ratio < 1) return 2
  return 3
}

/**
 * ชื่อนี้ถูกคนอื่นจดไปแล้วหรือยัง — เทียบแบบไม่สนตัวพิมพ์ใหญ่เล็ก
 * ชื่อว่างหรือช่องว่างล้วนคืน true (ถือว่าใช้ไม่ได้) เพราะถ้าคืน false
 * หน้าที่เช็กด้วยฟังก์ชันนี้อย่างเดียวจะปล่อยให้นักเรียนจดชื่อว่างผ่านไปได้
 */
export function isDomainTaken(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  if (normalized.length === 0) return true
  return takenSet.has(normalized)
}

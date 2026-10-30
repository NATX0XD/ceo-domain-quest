import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import learnPathsJson from '@/content/learn-paths.json' with { type: 'json' }
import { getServiceClient } from '@/lib/db/client'
import type { AiClient, LearnCheckItemResult } from '@/lib/ai/types'

/**
 * เส้นทางเรียนก่อนเข้าภารกิจ (ดู / อ่าน / ลงมือทำ) — สเปกเต็มอยู่ที่ docs/learn-path-spec.md
 *
 * ไฟล์เนื้อหาสาธารณะ `content/learn-paths.json` ส่งให้เบราว์เซอร์ได้ (ไม่มีเฉลย)
 * เฉลยอยู่ที่ `content/learn-paths-answers.json` อ่านด้วย dynamic import ตอนตรวจเท่านั้น
 * ผลทั้งหมดเก็บในตาราง events ไม่แตะโครงสร้างฐานข้อมูล
 */

export const LEARN_MODES = ['watch', 'read', 'do'] as const
export type LearnMode = (typeof LEARN_MODES)[number]

/** วิธีเรียนใหม่ จับคู่กับช่องทางเดิมในฐานข้อมูล (clip | card | game | buddy) */
export const MODE_TO_ROUTE = { watch: 'clip', read: 'card', do: 'game' } as const

export const PASS_SCORE = 60

const QuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  placeholder: z.string().optional(),
  /** ช่วงฉาก/ข้อความแชต (นับจาก 1) ที่โดมชี้ให้ย้อนไปดูเมื่อข้อนี้ยังไม่ครบ */
  review: z.object({ from: z.number().int().min(1), to: z.number().int().min(1) }).optional(),
  /** คำใบ้สั้นเฉพาะจุด ไม่ใช่เฉลย */
  hint: z.string().optional(),
})

const CardSortPublicSchema = z.object({
  zones: z.array(z.object({ id: z.string().min(1), title: z.string().min(1) })).min(2),
  cards: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(2),
})

const PathSchema = z.object({
  missionId: z.string().min(1),
  story: z.string().min(1),
  warmup: z
    .array(z.object({ id: z.string().min(1), question: z.string().min(1), choices: z.array(z.string().min(1)).length(4) }))
    .length(3),
  watch: z.object({
    title: z.string().min(1),
    /** คลิปจริงจากทีมผลิต เช่น /videos/m1-watch.mp4 (อยู่ใน public/) ไม่มี = ใช้ฉากภาพนิ่งแทน */
    video: z.string().startsWith('/videos/').optional(),
    /** หน้ารับภารกิจก่อนดู */
    brief: z.object({ title: z.string().min(1), situation: z.string().min(1), tip: z.string().optional() }).optional(),
    scenes: z
      .array(
        z.object({
          id: z.string().min(1),
          speaker: z.string().min(1),
          line: z.string().min(1),
          caption: z.string().optional(),
          visual: z.string().optional(),
        }),
      )
      .min(1),
    questions: z.array(QuestionSchema).min(1),
  }),
  read: z.object({
    title: z.string().min(1),
    chat: z
      .array(z.object({ who: z.enum(['a', 'b', 'dome']), name: z.string().min(1), text: z.string().min(1) }))
      .min(1),
    brief: z.object({ title: z.string().min(1), situation: z.string().min(1), tip: z.string().optional() }).optional(),
    /** ชิปตอบด่วนท้ายแชต (ไม่นับคะแนน ไม่มีธงเฉลย ตอบแต่ละข้อมีคำตอบจากโดม) */
    quick: z
      .object({
        prompt: z.string().min(1),
        choices: z
          .array(z.object({ text: z.string().min(1), reply: z.string().min(1), ok: z.boolean().optional() }))
          .min(2),
      })
      .optional(),
    /** ตัวแบ่งช่วงของแชต (start นับจาก 1) */
    parts: z.array(z.object({ start: z.number().int().min(1), title: z.string().min(1) })).optional(),
    questions: z.array(QuestionSchema).min(1),
  }),
  do: z.object({
    kind: z.enum(['game', 'counter', 'registrar', 'cards']),
    title: z.string().min(1),
    instruction: z.string().min(1),
    /** kind cards: การ์ดและช่องวาง (ไม่มีเฉลย) */
    cards: CardSortPublicSchema.optional(),
  }),
})

export type LearnPath = z.infer<typeof PathSchema>

const learnPaths: LearnPath[] = z.object({ paths: z.array(PathSchema) }).parse(learnPathsJson).paths

export function findLearnPath(missionId: string): LearnPath | undefined {
  return learnPaths.find((p) => p.missionId === missionId)
}

/* ------------------------------------------------------------------ เฉลย */

const RubricSchema = z.object({
  modelAnswer: z.string(),
  concepts: z.array(z.object({ label: z.string(), points: z.number(), any: z.array(z.string()) })).min(1),
  feedbackPass: z.string(),
  feedbackRetry: z.string(),
})

const CardSortKeySchema = z.object({
  zones: z.record(z.string(), z.string()),
  weights: z.record(z.string(), z.number()),
  hint: z.string(),
  byCorrect: z.record(z.string(), z.string()),
  byBand: z.object({ low: z.string(), mid: z.string(), pass: z.string() }),
})

const AnswersSchema = z.object({
  paths: z.array(
    z.object({
      missionId: z.string(),
      warmup: z.record(z.string(), z.number().int()),
      rubrics: z.record(z.string(), RubricSchema),
      cardSort: CardSortKeySchema.optional(),
    }),
  ),
})

async function loadAnswers(missionId: string) {
  const fileUrl = pathToFileURL(join(process.cwd(), 'content', 'learn-paths-answers.json')).href
  const mod = (await import(/* turbopackIgnore: true */ fileUrl, { with: { type: 'json' } })) as {
    default: unknown
  }
  const parsed = AnswersSchema.parse(mod.default)
  const found = parsed.paths.find((p) => p.missionId === missionId)
  if (!found) throw new Error(`learn-paths-answers: ไม่มีเฉลยของ ${missionId}`)
  return found
}

/* ---------------------------------------------------------- เช็กพื้นฐาน */

export interface WarmupResult {
  score: number
  total: number
  perQuestion: boolean[]
  recommended: LearnMode
  reason: string
}

/** 0-1 ข้อ = ดูภาพรวมก่อน · 2 = อ่านทบทวน · 3 = ลงมือทำได้เลย — เป็นข้อเสนอเท่านั้น */
export function recommendMode(score: number): { mode: LearnMode; reason: string } {
  if (score >= 3) {
    return { mode: 'do', reason: 'ตอบถูกครบ 3 ข้อ พื้นฐานแน่นแล้ว ลองลงมือทำจริงเลยน่าจะสนุกที่สุด' }
  }
  if (score === 2) {
    return { mode: 'read', reason: 'ตอบถูก 2 ข้อ รู้เรื่องนี้มาบ้างแล้ว อ่านแชตทบทวนอีกนิดจะครบขึ้น' }
  }
  return { mode: 'watch', reason: 'เรื่องนี้ยังใหม่สำหรับเรา เริ่มจากดูภาพรวมก่อนจะเข้าใจง่ายที่สุด' }
}

export async function scoreWarmup(path: LearnPath, answers: number[]): Promise<WarmupResult> {
  const key = await loadAnswers(path.missionId)
  const perQuestion = path.warmup.map((q, i) => key.warmup[q.id] === answers[i])
  const score = perQuestion.filter(Boolean).length
  const { mode, reason } = recommendMode(score)
  return { score, total: path.warmup.length, perQuestion, recommended: mode, reason }
}

/* ------------------------------------------------- คำตอบปลายเปิดของโดม */

/** ตัดช่องว่างและตัวพิมพ์ใหญ่ ให้คำตอบที่พิมพ์ต่างกันนิดหน่อยยังจับคำได้ */
export function normalizeAnswer(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

/** ใครตรวจข้อนี้ — โมเดลช่วยตรวจ หรือคำสำคัญล้วน */
export type AnswerSource = 'typhoon' | 'gemini' | 'rule'

export interface QuestionScore {
  id: string
  score: number
  feedback: string
  /** concept ที่ยังขาด ใช้บอกเฉพาะจุดว่าควรเติมเรื่องอะไร (ไม่ใช่เฉลย) */
  missing: string[]
  /** 'rule' = ตรวจด้วยคำสำคัญล้วน · ชื่อผู้ให้บริการ = AI ช่วยตรวจข้อนี้ */
  source: AnswerSource
  /** คะแนนจากคำสำคัญ = พื้นขั้นต่ำเสมอ */
  keywordScore: number
  /** คะแนนตามแนวคิดที่ AI ว่าครอบคลุม null = ไม่ได้ใช้ AI กับข้อนี้ */
  aiScore: number | null
}

type Rubric = z.infer<typeof RubricSchema>

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n))
}

export function scoreOpenAnswer(rubric: Rubric, id: string, text: string): QuestionScore {
  const norm = normalizeAnswer(text)
  let score = 0
  const missing: string[] = []
  for (const c of rubric.concepts) {
    const hit = c.any.some((word) => {
      const w = normalizeAnswer(word)
      return w.length > 0 && norm.includes(w)
    })
    if (hit) score += c.points
    else missing.push(c.label)
  }
  score = clampScore(score)
  return {
    id,
    score,
    feedback: score > PASS_SCORE ? rubric.feedbackPass : rubric.feedbackRetry,
    missing,
    source: 'rule',
    keywordScore: score,
    aiScore: null,
  }
}

/**
 * รวมผลคำสำคัญกับผล AI ของข้อเดียว — **คะแนน = max(คำสำคัญ, AI)**
 * AI จึงช่วยได้แค่คำตอบที่ใช้คำของตัวเอง ไม่มีวันทำให้เข้มกว่าเดิม
 * คำแนะนำจาก AI ใช้เมื่อผลของ AI เป็นตัวที่ถูกเลือก และยังมีแนวคิดที่ขาด
 */
export function mergeAiCheck(
  rubric: Rubric,
  keyword: QuestionScore,
  check: LearnCheckItemResult,
  provider: Exclude<AnswerSource, 'rule'>,
): QuestionScore {
  const aiScore = clampScore(rubric.concepts.reduce((s, c, i) => s + (check.covered[i] ? c.points : 0), 0))
  const base = { ...keyword, source: provider, aiScore }
  if (aiScore <= keyword.keywordScore) return base

  const missing = rubric.concepts.filter((_, i) => !check.covered[i]).map((c) => c.label)
  const feedback =
    missing.length > 0 && check.feedback
      ? check.feedback
      : aiScore > PASS_SCORE
        ? rubric.feedbackPass
        : rubric.feedbackRetry
  return { ...base, score: aiScore, missing, feedback }
}

/** คำตอบสั้นกว่านี้ไม่ต้องส่งให้ AI (ไม่มีเนื้อหาให้ตีความ) */
const AI_MIN_ANSWER_CHARS = 4

export interface OpenAnswerOptions {
  /** ตัวตรวจ AI (ปกติคือ ai จาก components/server/ai.ts) ไม่ส่ง = คำสำคัญล้วน */
  checker?: Pick<AiClient, 'learnCheck'> | null
  /** นับโควตา AI รายคน */
  studentId?: string
}

export async function scoreOpenAnswers(
  path: LearnPath,
  mode: 'watch' | 'read',
  answers: Record<string, string>,
  options: OpenAnswerOptions = {},
): Promise<{ score: number; passed: boolean; perQuestion: QuestionScore[] }> {
  const key = await loadAnswers(path.missionId)
  const questions = path[mode].questions
  const rubrics = questions.map((q) => {
    const rubric = key.rubrics[q.id]
    if (!rubric) throw new Error(`learn-paths-answers: ไม่มี rubric ของ ${q.id}`)
    return rubric
  })
  let perQuestion = questions.map((q, i) => scoreOpenAnswer(rubrics[i]!, q.id, answers[q.id] ?? ''))

  // ส่งให้ AI เฉพาะข้อที่คำสำคัญยังให้ไม่เต็มและมีเนื้อหาจริง ข้อเต็มแล้ว AI เพิ่มอะไรไม่ได้
  const items = questions
    .map((q, i) => ({ q, i, answer: (answers[q.id] ?? '').trim() }))
    .filter(({ i, answer }) => perQuestion[i]!.keywordScore < 100 && answer.replace(/\s+/g, '').length >= AI_MIN_ANSWER_CHARS)
    .map(({ q, i, answer }) => ({
      id: q.id,
      question: q.prompt,
      concepts: rubrics[i]!.concepts.map((c) => c.label),
      answer,
    }))

  if (options.checker && items.length > 0) {
    try {
      const check = await options.checker.learnCheck({ items, studentId: options.studentId, missionId: path.missionId })
      if (check.source === 'ai' && check.provider !== 'rules') {
        const provider = check.provider
        const byId = new Map(check.items.map((item) => [item.id, item]))
        perQuestion = perQuestion.map((q, i) => {
          const item = byId.get(q.id)
          return item ? mergeAiCheck(rubrics[i]!, q, item, provider) : q
        })
      }
    } catch (err) {
      // ชั้น AI ไม่ควร throw อยู่แล้ว กันไว้อีกชั้น — พังเมื่อไรใช้คำสำคัญล้วน
      console.warn('[learn] AI ช่วยตรวจไม่สำเร็จ ใช้คำสำคัญแทน', err instanceof Error ? err.message : err)
    }
  }

  const score = Math.round(perQuestion.reduce((s, q) => s + q.score, 0) / Math.max(1, perQuestion.length))
  return { score, passed: score > PASS_SCORE, perQuestion }
}

/* ------------------------------------------------------ จัดการ์ด (ลงมือทำ) */

export interface CardSortDetail {
  /** การ์ดที่วางถูก/ผิด — ไม่บอกว่าที่ถูกคือช่องไหน */
  correct: string[]
  wrong: string[]
  feedback: string
  hint: string
}

const CardSortPayloadSchema = z.object({ placements: z.record(z.string(), z.string()) })

/** ตรวจตำแหน่งการ์ดทางเซิร์ฟเวอร์ — คะแนนถ่วงน้ำหนัก ผ่านเมื่อมากกว่า PASS_SCORE */
export async function scoreCardSort(
  path: LearnPath,
  payload: unknown,
): Promise<{ score: number; passed: boolean; detail: CardSortDetail }> {
  const key = (await loadAnswers(path.missionId)).cardSort
  if (!key) throw new Error(`learn-paths-answers: ไม่มี cardSort ของ ${path.missionId}`)
  const { placements } = CardSortPayloadSchema.parse(payload)
  const ids = Object.keys(key.zones)
  const correct = ids.filter((id) => placements[id] === key.zones[id])
  const wrong = ids.filter((id) => !correct.includes(id))
  const score = correct.reduce((s, id) => s + (key.weights[id] ?? 0), 0)
  const passed = score > PASS_SCORE
  const feedback =
    key.byCorrect[[...correct].sort().join('+')] ??
    (score <= 30 ? key.byBand.low : passed ? key.byBand.pass : key.byBand.mid)
  return { score, passed, detail: { correct, wrong, feedback, hint: key.hint } }
}

/* ------------------------------------------------------- สถานะของผู้เรียน */

export const LEARN_EVENTS = {
  warmup: 'learn-warmup',
  choose: 'learn-choose',
  answer: 'learn-answer',
  do: 'learn-do',
  done: 'learn-done',
} as const

export interface LearnState {
  warmup: { score: number; total: number; recommended: LearnMode; reason: string } | null
  chosen: LearnMode | null
  done: { mode: LearnMode; score: number } | null
}

function bag(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asMode(value: unknown): LearnMode | null {
  return (LEARN_MODES as readonly string[]).includes(String(value)) ? (value as LearnMode) : null
}

/** อ่านสถานะล่าสุดของภารกิจหนึ่งจาก events — ใช้ทั้งจอผู้เรียนและแผงครู */
export async function loadLearnStates(studentId: string): Promise<Record<string, LearnState>> {
  const { data, error } = await getServiceClient()
    .from('events')
    .select('type, payload, created_at')
    .eq('student_id', studentId)
    .in('type', [LEARN_EVENTS.warmup, LEARN_EVENTS.choose, LEARN_EVENTS.done])
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`loadLearnStates: ${error.message}`)

  // ดึงล่าสุด 500 แถว (ไม่ใช่เก่าสุด) แล้วกลับลำดับเป็นเก่าไปใหม่ก่อนไล่สถานะ
  const states: Record<string, LearnState> = {}
  for (const row of (data ?? []).reverse()) {
    const p = bag(row.payload)
    const missionId = typeof p.missionId === 'string' ? p.missionId : null
    if (!missionId) continue
    const s = (states[missionId] ??= { warmup: null, chosen: null, done: null })
    if (row.type === LEARN_EVENTS.warmup) {
      const recommended = asMode(p.recommended)
      if (recommended) {
        s.warmup = {
          score: Number(p.score ?? 0),
          total: Number(p.total ?? 3),
          recommended,
          reason: String(p.reason ?? ''),
        }
      }
    } else if (row.type === LEARN_EVENTS.choose) {
      s.chosen = asMode(p.mode)
    } else if (row.type === LEARN_EVENTS.done) {
      const mode = asMode(p.mode)
      if (mode && (!s.done || Number(p.score ?? 0) >= s.done.score)) s.done = { mode, score: Number(p.score ?? 0) }
    }
  }
  return states
}

export async function loadLearnState(studentId: string, missionId: string): Promise<LearnState> {
  return (await loadLearnStates(studentId))[missionId] ?? { warmup: null, chosen: null, done: null }
}

/**
 * ยืนยันว่ามินิเกมเดิมของภารกิจนี้ตอบถูกครบจริง **หลังจากเลือกวิธีลงมือทำครั้งล่าสุด**
 * (กันส่ง "solved" ลอย ๆ และกันเอาผลเกมเก่าก่อนเข้าเส้นทางเรียนมานับ)
 */
export async function recentGameSolved(studentId: string, missionId: string): Promise<boolean> {
  const chose = await getServiceClient()
    .from('events')
    .select('payload, created_at')
    .eq('student_id', studentId)
    .eq('type', LEARN_EVENTS.choose)
    .order('created_at', { ascending: false })
    .limit(50)
  if (chose.error) throw new Error(`recentGameSolved: ${chose.error.message}`)
  const since = (chose.data ?? []).find((row) => bag(row.payload).missionId === missionId)?.created_at
  if (!since) return false

  const { data, error } = await getServiceClient()
    .from('events')
    .select('payload')
    .eq('student_id', studentId)
    .eq('type', 'mission-game-checked')
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(`recentGameSolved: ${error.message}`)
  return (data ?? []).some((row) => {
    const p = bag(row.payload)
    const total = Number(p.total ?? 0)
    return p.missionId === missionId && total > 0 && Number(p.correctCount ?? -1) === total
  })
}

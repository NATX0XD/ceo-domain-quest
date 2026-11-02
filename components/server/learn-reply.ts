import type { AiClient, AiProvider, FallbackReason } from '@/lib/ai/types'
import {
  AI_MIN_ANSWER_CHARS,
  avoidWords,
  loadRubric,
  mergeAiCheck,
  scoreOpenAnswer,
  type LearnPath,
} from './learn-path'

/**
 * โดมตอบกลับทันทีหลังผู้เรียนตอบแต่ละข้อในแชต "คุยกับโดม" (โหมดดู/อ่าน)
 *
 * - ใช้ลูกโซ่ AI ตัวเดียวกับ learnCheck (ล็อกหัวข้อ + sanitizer + ตัวกรองถ้อยคำ) แล้วกรองเฉลยหลุดซ้ำด้วย mergeAiCheck
 * - **ไม่ใช่การตรวจคะแนน** ผลนี้ไม่ถูกเก็บเป็นคะแนน การตรวจจริงยังอยู่ที่การส่งคำตอบรอบสุดท้าย
 * - ไม่ส่ง studentId เข้าชั้น AI = ไม่กินโควตาตรวจงาน โควตาของการตอบกลับคุมแยกที่ route
 * - พัง ช้าเกินงบ หรือถ้อยคำใช้ไม่ได้ = ข้อความเดิมแบบตายตัว ไม่มีวัน throw
 */

export const DOME_REPLY_FALLBACK: Record<'watch' | 'read', string> = {
  watch: 'โดมได้รับคำตอบแล้วครับ ไปคำถามต่อไปกันเลย',
  read: 'ได้รับคำตอบแล้วครับ ไปข้อถัดไปกัน',
}

/** งบเวลาที่ผู้เรียนรอโดมพิมพ์ — สั้นกว่างบ 5 วินาทีของชั้น AI เล็กน้อย ให้ผลกลับถึงจอทันงบ */
export const DOME_REPLY_BUDGET_MS = 7000
/** โควตาการตอบกลับรายข้อต่อคนต่อ 10 นาที (กันงบ AI) */
export const DOME_REPLY_MAX_PER_WINDOW = 20

export type DomeReplyReason = FallbackReason | 'too-short' | 'filtered' | 'error'

export interface DomeReply {
  reply: string
  source: 'ai' | 'fallback'
  provider: Exclude<AiProvider, 'rules'> | 'rules'
  fallbackReason: DomeReplyReason | null
  ms: number
}

export async function domeLearnReply(
  path: LearnPath,
  mode: 'watch' | 'read',
  questionId: string,
  answer: string,
  options: { checker?: Pick<AiClient, 'learnCheck'> | null; budgetMs?: number } = {},
): Promise<DomeReply | null> {
  const question = path[mode].questions.find((q) => q.id === questionId)
  if (!question) return null
  const startedAt = Date.now()
  // ระบบเดิมสำรอง: มี rubric = ใช้คำติชมตามเกณฑ์ของข้อนั้น (ผ่าน/ลองเพิ่ม) แทนข้อความกลาง ๆ
  let scripted: string | null = null
  const fallback = (reason: DomeReplyReason, provider: DomeReply['provider'] = 'rules'): DomeReply => ({
    reply: scripted ?? DOME_REPLY_FALLBACK[mode],
    source: 'fallback',
    provider,
    fallbackReason: reason,
    ms: Date.now() - startedAt,
  })

  const text = answer.trim()
  if (text.replace(/\s+/g, '').length < AI_MIN_ANSWER_CHARS) return fallback('too-short')
  if (!options.checker) return fallback('not-requested')

  try {
    const rubric = await loadRubric(path.missionId, questionId)
    if (!rubric) return fallback('error')
    scripted = scoreOpenAnswer(rubric, questionId, text).feedback?.trim() || null
    const budget = options.budgetMs ?? DOME_REPLY_BUDGET_MS
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), budget)
    })
    const check = await Promise.race([
      options.checker.learnCheck({
        items: [
          {
            id: questionId,
            question: question.prompt,
            concepts: rubric.concepts.map((c) => c.label),
            answer: text,
            avoid: avoidWords(rubric, text, question.prompt),
          },
        ],
        missionId: path.missionId,
        role: 'dome',
      }),
      timeout,
    ]).finally(() => clearTimeout(timer))
    if (check === 'timeout') return fallback('timeout')
    if (check.source !== 'ai' || check.provider === 'rules') return fallback(check.fallbackReason ?? 'request-failed')
    const item = check.items.find((i) => i.id === questionId)
    if (!item) return fallback('bad-response', check.provider)
    // ตัวกรองชุดเดียวกับผลรอบสุดท้าย: เฉลยหลุด / น้ำเสียงขัดกับสิ่งที่ตอบมา = ข้อความเดิม
    const keyword = scoreOpenAnswer(rubric, questionId, text)
    const merged = mergeAiCheck(rubric, keyword, item, check.provider, { answer: text, question: question.prompt })
    if (merged.feedbackSource !== 'ai') return fallback('filtered', check.provider)
    return { reply: merged.feedback, source: 'ai', provider: check.provider, fallbackReason: null, ms: Date.now() - startedAt }
  } catch (err) {
    console.warn('[learn-reply] โดมตอบกลับด้วย AI ไม่สำเร็จ ใช้ข้อความเดิม', err instanceof Error ? err.message : err)
    return fallback('error')
  }
}

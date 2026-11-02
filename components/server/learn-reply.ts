import { gateAiText } from '@/core/content-filter'
import type { AiClient, AiProvider, FallbackReason } from '@/lib/ai/types'
import {
  AI_MIN_ANSWER_CHARS,
  avoidWords,
  loadRubric,
  type LearnPath,
} from './learn-path'
import { sanitizeStudentAnswer } from '@/lib/ai/prompts'

/**
 * โดมตอบกลับทันทีหลังผู้เรียนตอบแต่ละข้อในแชต "คุยกับโดม" (โหมดดู/อ่าน)
 *
 * - ใช้ลูกโซ่ AI ตัวเดียวกับ learnCheck (ล็อกหัวข้อ + sanitizer + ตัวกรองถ้อยคำ)
 * - **ไม่ใช่การตรวจคะแนน** ผลนี้ไม่ถูกเก็บเป็นคะแนน การตรวจจริงยังอยู่ที่การส่งคำตอบรอบสุดท้าย
 * - ไม่ส่ง studentId เข้าชั้น AI = ไม่กินโควตาตรวจงาน โควตาของการตอบกลับคุมแยกที่ route
 * - พัง ช้าเกินงบ หรือถ้อยคำใช้ไม่ได้ = ข้อความเดิมแบบตายตัว ไม่มีวัน throw
 */

export const DOME_REPLY_FALLBACK: Record<'watch' | 'read', string> = {
  watch: 'โดมจดคำตอบไว้แล้วครับ ไปคำถามต่อไปกัน',
  read: 'โดมจดคำตอบไว้แล้วครับ ไปข้อถัดไปกัน',
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

const DOME_REPLY_BLOCKED_WORDS = [
  'ถูก',
  'ผิด',
  'ครบ',
  'ไม่ครบ',
  'ยังไม่',
  'ยังขาด',
  'ขาด',
  'ลองอีก',
  'ลองคิด',
  'ลองย้อน',
  'ลองเติม',
  'ลองเพิ่ม',
  'เฉลย',
  'คำตอบที่ถูก',
  'ใช่เลย',
  'เกือบ',
  'ชวนคิด',
  'คิดต่อ',
  'ทบทวน',
  'กลับไปอ่าน',
  'แนวคิด',
]

function normalized(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

function hasDomeReplyBlockedText(text: string, rubric: Awaited<ReturnType<typeof loadRubric>>): boolean {
  const lower = text.toLowerCase()
  if (DOME_REPLY_BLOCKED_WORDS.some((word) => lower.includes(word))) return true
  if (!rubric) return false
  const reply = normalized(text)
  const rubricPhrases = rubric.concepts.flatMap((concept) => [concept.label, ...concept.any])
  return rubricPhrases.some((phrase) => normalized(phrase).length >= 4 && reply.includes(normalized(phrase)))
}

/** สร้างข้อความสำรองที่สะท้อนคำของนักเรียนโดยไม่ประเมินคำตอบ */
export function buildDomeReplyFallback(mode: 'watch' | 'read', answer: string): string {
  const text = sanitizeStudentAnswer(answer)
  if (text.replace(/\s+/g, '').length < AI_MIN_ANSWER_CHARS) return DOME_REPLY_FALLBACK[mode]
  const excerpt = Array.from(text)
    .slice(0, 40)
    .join('')
    .replace(/["“”]/g, '')
    .trim()
  if (!excerpt || hasDomeReplyBlockedText(excerpt, undefined)) return DOME_REPLY_FALLBACK[mode]
  if (!gateAiText(excerpt).usable) return DOME_REPLY_FALLBACK[mode]
  return `โดมจดคำตอบ "${excerpt}" ไว้แล้วครับ ไป${mode === 'watch' ? 'คำถามต่อไป' : 'ข้อถัดไป'}กัน`
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
  const fallback = (reason: DomeReplyReason, provider: DomeReply['provider'] = 'rules'): DomeReply => ({
    reply: buildDomeReplyFallback(mode, answer),
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
        replyOnly: true,
      }),
      timeout,
    ]).finally(() => clearTimeout(timer))
    if (check === 'timeout') return fallback('timeout')
    if (check.source !== 'ai' || check.provider === 'rules') return fallback(check.fallbackReason ?? 'request-failed')
    const item = check.items.find((i) => i.id === questionId)
    if (!item) return fallback('bad-response', check.provider)
    const reply = item.feedback?.trim() ?? ''
    if (!reply || hasDomeReplyBlockedText(reply, rubric) || !gateAiText(reply).usable) return fallback('filtered', check.provider)
    return { reply, source: 'ai', provider: check.provider, fallbackReason: null, ms: Date.now() - startedAt }
  } catch (err) {
    console.warn('[learn-reply] โดมตอบกลับด้วย AI ไม่สำเร็จ ใช้ข้อความเดิม', err instanceof Error ? err.message : err)
    return fallback('error')
  }
}

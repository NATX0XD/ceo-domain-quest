import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logEvent } from '@/lib/db/repo'
import { attempt } from '@/lib/rate-limit'
import { findLearnPath, isAdaptiveLearnPath } from '@/components/server/learn-path'
import {
  DOME_REPLY_FALLBACK,
  DOME_REPLY_MAX_PER_WINDOW,
  domeLearnReply,
  type DomeReply,
} from '@/components/server/learn-reply'
import { ai } from '@/components/server/ai'
import { hasShopProfile } from '@/components/server/shop-gate'
import { pretestBlockResponse } from '@/components/server/pretest-required'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../../../../_lib/session-cookie'

/**
 * โดมตอบกลับรายข้อในแชต "คุยกับโดม" ทันทีหลังผู้เรียนตอบ — ไม่ตรวจคะแนน (การตรวจจริงอยู่ที่ /learn action answer)
 * ตอบ { reply, source: 'ai' | 'fallback' } เสมอ AI พัง/ช้า/เกินโควตา = ข้อความเดิมแบบตายตัว
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  mode: z.enum(['watch', 'read']),
  questionId: z.string().min(1).max(40),
  answer: z.string().max(1000),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')
  if (!(await hasShopProfile(session.studentId))) return errorResponse('no-profile', 'ยังไม่ได้ตั้งค่าร้าน กลับไปที่หน้า /setup ก่อน', 409, { href: '/setup' })
  const pretestBlocked = await pretestBlockResponse(session.studentId)
  if (pretestBlocked) return pretestBlocked

  const path = findLearnPath(id)
  if (!path || !isAdaptiveLearnPath(path)) return errorResponse('mission-not-found', 'ไม่พบภารกิจนี้', 404)
  const parsed = BodySchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'รูปแบบข้อมูลไม่ถูกต้อง', 400)
  const { mode, questionId, answer } = parsed.data

  const quota = attempt(`learn-reply:${session.studentId}`, Date.now(), DOME_REPLY_MAX_PER_WINDOW)
  const result: DomeReply | null = quota.allowed
    ? await domeLearnReply(path, mode, questionId, answer, { checker: ai })
    : { reply: DOME_REPLY_FALLBACK[mode], source: 'fallback', provider: 'rules', fallbackReason: 'quota-exceeded', ms: 0 }
  if (!result) return errorResponse('bad-request', 'ไม่พบคำถามข้อนี้', 400)

  await logEvent(session.studentId, 'learn-reply', {
    missionId: path.missionId,
    mode,
    questionId,
    source: result.source,
    provider: result.provider,
    fallbackReason: result.fallbackReason,
    ms: result.ms,
    reply: result.reply,
  }).catch((err) => console.warn('[learn-reply] บันทึก event ไม่สำเร็จ', err instanceof Error ? err.message : err))

  return NextResponse.json({ reply: result.reply, source: result.source })
}

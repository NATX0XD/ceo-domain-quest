import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getClassroomReportRaw, getOwnedClassroom, listClassroomPlanRequests, listPendingReview } from '@/lib/db/repo'
import { attempt } from '@/lib/rate-limit'
import { ai } from '@/components/server/ai'
import { loadClassroomLearnResults } from '@/components/server/learn-results'
import { buildAssistContext, contextToText, fallbackAnswer } from '@/components/server/teacher-assistant'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ถามโดม (ฝั่งครู) — ตอบคำถามเรื่องนักเรียนในห้องที่เลือกอยู่
 *
 * ⚠️ teacherId จากคุกกี้เท่านั้น · ไม่ใช่เจ้าของห้อง = 404 (ไม่บอกว่าห้องมีจริงไหม)
 * ⚠️ ข้อมูลที่ส่งให้โมเดลมีแค่ชื่อเล่นกับตัวเลข ดู components/server/teacher-assistant.ts
 * AI ไม่ว่าง/ช้า/ล่ม = ตอบด้วยกฎจากข้อมูลชุดเดียวกัน (source: 'fallback') ไม่ตอบ error
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PER_WINDOW = 30

const BodySchema = z.object({
  classroomId: z.string().uuid(),
  messages: z
    .array(z.object({ role: z.enum(['teacher', 'dome']), text: z.string().trim().min(1).max(500) }))
    .min(1)
    .max(40),
})

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = BodySchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'รูปแบบข้อมูลไม่ถูกต้อง', 400)
  const { classroomId } = parsed.data
  const messages = parsed.data.messages.slice(-6)
  const last = messages[messages.length - 1]!
  if (last.role !== 'teacher') return errorResponse('bad-request', 'ข้อความสุดท้ายต้องเป็นคำถามของครู', 400)

  const owned = await getOwnedClassroom(session.teacherId, classroomId)
  if (!owned) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const quota = attempt(`teacher-assist:${session.teacherId}`, Date.now(), MAX_PER_WINDOW)
  if (!quota.allowed) return errorResponse('rate-limited', 'ถามถี่เกินไป รอสักครู่แล้วลองใหม่ครับ', 429)

  const [raw, learn, pending, requests] = await Promise.all([
    getClassroomReportRaw(session.teacherId, classroomId),
    loadClassroomLearnResults(session.teacherId, classroomId).catch(() => null),
    listPendingReview(session.teacherId, classroomId).catch(() => null),
    listClassroomPlanRequests(session.teacherId, classroomId).catch(() => null),
  ])
  if (!raw) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const pendingByNickname = new Map<string, number>()
  for (const p of pending ?? []) pendingByNickname.set(p.nickname, (pendingByNickname.get(p.nickname) ?? 0) + 1)
  const requestsByStudent = new Map<string, number>()
  for (const r of requests ?? []) {
    if ((r.status ?? 'pending') === 'pending') requestsByStudent.set(r.student_id, (requestsByStudent.get(r.student_id) ?? 0) + 1)
  }

  const ctx = buildAssistContext({ raw, learn: learn ?? [], pendingByNickname, requestsByStudent })

  let result: Awaited<ReturnType<typeof ai.teacherAssist>> | null = null
  try {
    result = await ai.teacherAssist({ context: contextToText(ctx), messages })
  } catch (err) {
    console.warn('[teacher-assistant] AI ล้มเหลว ใช้ทางสำรอง', err instanceof Error ? err.message : err)
  }

  if (result && result.source === 'ai' && result.text) {
    return NextResponse.json({ ok: true, reply: result.text, source: 'ai', provider: result.provider })
  }
  return NextResponse.json({
    ok: true,
    reply: fallbackAnswer(last.text, ctx),
    source: 'fallback',
    provider: 'rules',
    fallbackReason: result?.fallbackReason ?? 'request-failed',
  })
}

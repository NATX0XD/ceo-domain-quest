import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  listClassroomFeedback,
  listPendingReview,
  listPinnedShowcase,
  listStudentsWithoutFeedback,
  teacherHideFeedback,
  teacherPinSubmission,
} from '@/lib/db/repo'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ครูดูแลผนังผลงาน — ปักหมุดผลงานขึ้นจอหน้าห้อง (T-04) + ซ่อนความเห็นที่ไม่เหมาะสม (T-09)
 *
 * ⚠️ ซ่อน = ซ่อน **ไม่ลบข้อความต้นฉบับ** (ฝั่ง DB เก็บ hidden_at/hidden_by/hidden_reason ไว้)
 * ⚠️ ผลงานที่ปักหมุดขึ้นจอหน้าห้องต้องไม่มีดาวและไม่มีคะแนน ครูเลือกซ่อนชื่อเจ้าของได้
 * ⚠️ teacherId จาก cookie · ทุก RPC ตรวจเจ้าของห้องในคิวรีเดียวกัน
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pin'),
    submissionId: z.string().uuid(),
    pinned: z.boolean(),
    /** ปักหมุดแบบไม่แสดงชื่อเจ้าของ */
    hideName: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('hide-feedback'),
    feedbackId: z.string().uuid(),
    hidden: z.boolean(),
    reason: z.string().trim().max(300).optional(),
  }),
])

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  const pending = await listPendingReview(session.teacherId, classroomId)
  if (pending === null) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const [pinned, feedback, withoutFeedback] = await Promise.all([
    listPinnedShowcase(session.teacherId, classroomId),
    listClassroomFeedback(session.teacherId, classroomId),
    listStudentsWithoutFeedback(session.teacherId, classroomId),
  ])

  return NextResponse.json({ ok: true, pinned, feedback, withoutFeedback })
}

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = ActionSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'action ต้องเป็น pin หรือ hide-feedback')
  }

  const body = parsed.data

  if (body.action === 'pin') {
    const row = await teacherPinSubmission(
      session.teacherId,
      body.submissionId,
      body.pinned,
      body.hideName === true,
    )
    if (!row) return errorResponse('not-found', 'ไม่พบผลงานชิ้นนี้ในห้องของคุณ', 404)
    return NextResponse.json({ ok: true, submissionId: row.id, pinnedAt: row.pinned_at })
  }

  const row = await teacherHideFeedback(
    session.teacherId,
    body.feedbackId,
    body.hidden,
    body.reason,
  )
  if (!row) return errorResponse('not-found', 'ไม่พบความเห็นนี้ในห้องของคุณ', 404)
  return NextResponse.json({ ok: true, feedbackId: row.id, hiddenAt: row.hidden_at })
}

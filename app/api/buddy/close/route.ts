import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cancelBuddyRequest, completeBuddyRequest, logEvent } from '@/lib/db/repo'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../_lib/session-cookie'

/**
 * ผู้ขอปิดใบคำขอของตัวเอง — ยกเลิก หรือ ปิดเพราะเพื่อนช่วยจบแล้ว
 *
 * ⚠️ ปิดใบของคนอื่นไม่ได้ — ทั้ง `cancel_buddy_request` และ `complete_buddy_request`
 *    มี `requester_id` อยู่ในเงื่อนไข UPDATE คืน 0 แถวเมื่อไม่ใช่เจ้าของ
 * ⚠️ ตราพี่เลี้ยงของผู้ช่วย (+1) เพิ่มที่ 'done' เท่านั้น การยกเลิกไม่นับให้ใคร
 *    ตัวเลขนี้ย้อนกลับไปเป็นคะแนนลบใน `core/buddy.ts` เพื่อ **กระจายภาระ** ไม่ให้คนเก่งถูกขอทั้งคาบ
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['cancel', 'done']),
  /** ผลตอบรับหลังจบ ไม่มีผลต่อดาวของใคร */
  feedback: z.enum(['helpful', 'ok']).optional(),
  /** ผ่านภารกิจนั้นได้ไหมหลังเพื่อนช่วย — ครูใช้ดูว่าการจับคู่ได้ผลจริงไหม */
  passedAfter: z.boolean().optional(),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', "ต้องส่ง requestId กับ action ('cancel' หรือ 'done')", 400)
  }

  const { requestId, action } = parsed.data

  const closed =
    action === 'cancel'
      ? await cancelBuddyRequest(session.studentId, requestId)
      : await completeBuddyRequest(
          session.studentId,
          requestId,
          parsed.data.feedback ?? null,
          parsed.data.passedAfter ?? null,
        )

  if (!closed) {
    return errorResponse(
      'request-not-open',
      action === 'cancel'
        ? 'ใบคำขอนี้ปิดไปแล้ว หรือไม่ใช่ใบของเรา'
        : 'ปิดใบได้เฉพาะตอนที่เพื่อนรับปากช่วยแล้ว ถ้ายังไม่มีใครรับให้กดยกเลิกแทน',
      409,
    )
  }

  await logEvent(session.studentId, action === 'cancel' ? 'buddy-cancelled' : 'buddy-done', {
    requestId,
    missionId: closed.mission_id,
    feedback: closed.feedback,
  }).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    status: closed.status,
    message:
      action === 'cancel'
        ? 'ยกเลิกคำขอแล้ว กดขอใหม่ได้ทุกเมื่อ'
        : 'ปิดคำขอแล้ว เพื่อนที่มาช่วยได้ตราพี่เลี้ยงเพิ่ม 1 ครั้ง',
  })
}

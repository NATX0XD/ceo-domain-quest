import { NextResponse } from 'next/server'
import { listPendingReview } from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * จำนวนงานรอตรวจของห้องหนึ่ง — ใช้โชว์ตัวเลขบนระฆัง/เมนูของแดชบอร์ดครู (อ่านอย่างเดียว)
 * ⚠️ teacherId จาก cookie · listPendingReview ตรวจเจ้าของห้องในคิวรีเดียวกับที่อ่าน ไม่ใช่ห้องของครู = 404
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()
  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')
  const pending = await listPendingReview(session.teacherId, classroomId)
  if (pending === null) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
  return NextResponse.json({ ok: true, pendingCount: pending.length })
}

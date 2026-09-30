import { NextResponse } from 'next/server'
import { z } from 'zod'
import { genRoomCode } from '@/lib/room-code'
import {
  closeClassroom,
  createClassroomWithUniqueCode,
  deleteClassroom,
  listClassroomsByTeacher,
  setClassroomStatus,
  type ClassroomStatus,
} from '@/lib/db/repo'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ห้องเรียนของครู — สร้าง / ดูรายการ / ล็อก / ปิด
 *
 * ⚠️ teacherId อ่านจาก cookie httpOnly เท่านั้น ห้ามรับจาก body
 *    classroomId รับจาก body ได้ แต่ทุกคำสั่งส่งผ่าน repo ที่ตรวจ `teacher_id = <คนที่ login>`
 *    ใน query เดียวกัน ถ้าไม่ใช่เจ้าของจะได้ null แล้วตอบ 404 (ไม่บอกว่าห้องนั้นมีจริงไหม)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DeleteSchema = z.object({ classroomId: z.string().uuid() })

const PatchSchema = z.object({
  classroomId: z.string().uuid(),
  status: z.enum(['open', 'locked', 'closed']),
})

export async function GET() {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classrooms = await listClassroomsByTeacher(session.teacherId)
  return NextResponse.json({ classrooms })
}

/** สร้างห้องใหม่ รหัส 6 ตัวสุ่มจาก genRoomCode() ชนแล้วสุ่มใหม่ให้เอง */
export async function POST() {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroom = await createClassroomWithUniqueCode(session.teacherId, genRoomCode)
  return NextResponse.json({ ok: true, classroom }, { status: 201 })
}

/** เปลี่ยนสถานะห้อง — 'closed' จะ stamp closes_at ให้ด้วย */
export async function PATCH(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = PatchSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง classroomId และ status (open|locked|closed)')
  }

  const status: ClassroomStatus = parsed.data.status
  const classroom =
    status === 'closed'
      ? await closeClassroom(session.teacherId, parsed.data.classroomId)
      : await setClassroomStatus(session.teacherId, parsed.data.classroomId, status)

  if (!classroom) {
    return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
  }

  return NextResponse.json({ ok: true, classroom })
}

/**
 * ลบห้องเรียนถาวร — ลบไฟล์เสียงใน storage ก่อน แล้วลบแถวห้อง
 * แถวลูกทุกตารางหายตาม FK cascade (students · profiles · progress · submissions · events ·
 * route_changes · reflections · mission_progress · peer_feedback · mission_skips ·
 * chat_messages · voice_submissions)
 *
 * ⚠️ กู้คืนไม่ได้ · เงื่อนไขเจ้าของอยู่ใน DELETE เดียวกัน ไม่ใช่ห้องของครูคนนี้ = 404
 */
export async function DELETE(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = DeleteSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง classroomId')
  }

  const result = await deleteClassroom(session.teacherId, parsed.data.classroomId)
  if (!result) {
    return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
  }

  return NextResponse.json({ ok: true, deletedVoiceFiles: result.deletedFiles })
}

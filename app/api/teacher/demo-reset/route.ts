import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DEMO_BOTS, fillDemoClassroom } from '@/lib/db/demo-seed'
import { getOwnedClassroom, resetDemoClassroom } from '@/lib/db/repo'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * E-16 ปุ่มล้างห้องสาธิตกลับค่าเริ่มต้น — ใช้จริงบนเวทีตอนสาธิตแล้วห้องเละ
 *
 *   POST /api/teacher/demo-reset   { classroomId, roomCode }
 *
 * สามด่านซ้อนกัน ด่านล่างสุดคือตัวจริง:
 *   1. คุกกี้ครู (teacherId ไม่เคยรับจาก body)
 *   2. `roomCode` ในคำขอต้องตรงกับรหัสห้องจริง = **การยืนยัน** ยิงมั่วหรือกดพลาดจะไม่ลบอะไร
 *   3. `reset_demo_classroom` ในฐานข้อมูลปฏิเสธห้องที่ไม่ได้ติดป้าย is_demo
 *      → ห้องเรียนจริงล้างไม่ได้แม้จะยิง API ตรง ๆ ผ่านทุกด่านบนก็ตาม
 *
 * ล้างเสร็จเติมหุ่นชุดเดิมกลับทันทีจาก `lib/db/demo-seed` — ห้องหลังกดปุ่มหน้าตาเหมือนตอนซ้อม
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  classroomId: z.string().uuid(),
  /** ต้องพิมพ์/ส่งรหัสห้องมายืนยัน ป้องกันการกดล้างข้ามห้อง */
  roomCode: z.string().trim().min(1).max(12),
})

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = BodySchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง classroomId (uuid) กับ roomCode เพื่อยืนยัน', 400)
  }

  const classroom = await getOwnedClassroom(session.teacherId, parsed.data.classroomId)
  if (!classroom) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  if (classroom.room_code.trim().toUpperCase() !== parsed.data.roomCode.toUpperCase()) {
    return errorResponse(
      'confirm-mismatch',
      'รหัสห้องที่ยืนยันไม่ตรงกับห้องที่เลือก ยังไม่ได้ล้างอะไรทั้งนั้น',
      400,
    )
  }

  const started = Date.now()
  const wiped = await resetDemoClassroom(session.teacherId, classroom.id)
  if (!wiped.ok) {
    if (wiped.reason === 'not-found') {
      return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
    }
    return errorResponse(
      'not-demo',
      `ห้อง ${classroom.room_code} เป็นห้องเรียนจริง ปุ่มล้างใช้ได้กับห้องสาธิตเท่านั้น`,
      403,
    )
  }

  const seeded = await fillDemoClassroom(session.teacherId, classroom.id, classroom.room_code)

  return NextResponse.json({
    ok: true,
    roomCode: classroom.room_code,
    cleared: wiped.counts,
    seeded,
    elapsedMs: Date.now() - started,
    message:
      `ล้างห้องสาธิต ${classroom.room_code} แล้ว เรียงนักเรียนหุ่น ${DEMO_BOTS.length} คนกลับเหมือนเดิม ` +
      'สาธิตรอบใหม่ได้เลย',
  })
}

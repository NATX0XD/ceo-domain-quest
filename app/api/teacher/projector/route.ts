import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db/client'
import { listClassroomsByTeacher, listPinnedShowcase } from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ข้อมูลสำหรับจอหน้าห้อง (โปรเจกเตอร์) — อ่านอย่างเดียว ไม่ใช่การควบคุมคาบสด
 * ส่งเฉพาะจำนวนนักเรียนที่เข้าห้อง + ผลงานที่ครูปักหมุด (ไม่มีดาว ไม่มีคะแนน · ซ่อนชื่อตามที่ครูเลือก)
 * ⚠️ teacherId จาก cookie · ห้องต้องอยู่ในบัญชีของครูคนนี้ ไม่งั้น 404
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  const rooms = await listClassroomsByTeacher(session.teacherId)
  if (!rooms.some((r) => r.id === classroomId)) {
    return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
  }

  const [{ count }, pinned] = await Promise.all([
    getServiceClient().from('students').select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId),
    listPinnedShowcase(session.teacherId, classroomId),
  ])

  return NextResponse.json({
    ok: true,
    joined: count ?? 0,
    showcase: pinned.map((row) => ({
      domain: `${row.domain_name ?? ''}${row.tld ?? ''}`,
      reason: row.reason_text ?? '',
      nickname: row.nickname,
    })),
  })
}

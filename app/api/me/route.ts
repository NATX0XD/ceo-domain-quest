import { NextResponse } from 'next/server'
import {
  getClassroomById,
  getProfile,
  getStudent,
  listMissionProgress,
  listProgress,
} from '@/lib/db/repo'
import { lessonSummary } from '@/components/server/lesson-progress'
import { readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * ข้อมูลของนักเรียนคนที่ถือ cookie ใบนี้
 *
 * ⚠️ ไม่มีพารามิเตอร์ใด ๆ ให้ส่งเข้ามา — studentId และ classroomId อ่านจาก session cookie เท่านั้น
 *    เป็นจุดที่หน้าเว็บใช้เช็กว่า "ยังอยู่ในห้องไหม" หลังรีเฟรช
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const student = await getStudent(session.studentId)
  if (!student) {
    // cookie ใช้ได้แต่แถวหายไปแล้ว (ครูเตะออก หรือ db reset) — ให้หน้าเว็บพากลับไปหน้าเข้าห้อง
    return unauthorized('ไม่พบข้อมูลนักเรียนคนนี้แล้ว ให้เข้าห้องใหม่')
  }

  const [classroom, profile, progress, missions, summary] = await Promise.all([
    getClassroomById(session.classroomId),
    getProfile(session.studentId),
    listProgress(session.studentId),
    listMissionProgress(session.studentId),
    lessonSummary(session.studentId),
  ])

  return NextResponse.json({
    student: {
      id: student.id,
      nickname: student.nickname,
      joinedAt: student.created_at,
    },
    classroom: classroom
      ? { id: classroom.id, roomCode: classroom.room_code, status: classroom.status }
      : null,
    profile,
    progress,
    missions,
    /**
     * S-09 ขั้นการเติบโตของร้าน — **นับจำนวนด่านที่ผ่านจริง** ไม่ใช่คิดเป็นเปอร์เซ็นต์
     * เปอร์เซ็นต์ยังคืนไว้ให้ของเดิมใช้ต่อได้ แต่ค่าที่ควรใช้ตัดสินภาพคือ `stage`
     */
    shop: {
      stage: summary.shopStage,
      stagesCleared: summary.stagesCleared,
      stagesTotal: summary.stagesTotal,
      label: summary.shopStageLabel,
      percent: summary.percent,
    },
  })
}

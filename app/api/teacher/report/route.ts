import { NextResponse } from 'next/server'
import {
  getClassroomReport,
  getStudentReport,
  interpretSurveyMean,
  listClassroomBuddyLog,
} from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * T-10 รายงานรายคน · T-11 รายงานรายห้อง
 *
 *   GET /api/teacher/report?studentId=<uuid>     รายคน
 *   GET /api/teacher/report?classroomId=<uuid>   รายห้อง (มีสรุปแบบสอบถามแบบไม่มีชื่อ)
 *
 * ⚠️ ข้อมูลข้ามห้องต้องไม่รั่ว — repo เรียก SQL ที่ตรวจ `teacher_id = <คนที่ login>` ก่อนอ่านอะไรทั้งสิ้น
 *    ไม่ใช่เจ้าของ = คืน null แล้วที่นี่ตอบ 404 โดยไม่บอกว่าห้อง/นักเรียนนั้นมีจริงไหม
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const params = new URL(request.url).searchParams
  const studentId = params.get('studentId')
  const classroomId = params.get('classroomId')

  if (studentId) {
    const report = await getStudentReport(session.teacherId, studentId)
    if (!report) return errorResponse('not-found', 'ไม่พบนักเรียนคนนี้ในห้องของคุณ', 404)
    return NextResponse.json({ report })
  }

  if (classroomId) {
    const report = await getClassroomReport(session.teacherId, classroomId)
    if (!report) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

    const buddyLog = await listClassroomBuddyLog(session.teacherId, classroomId)
    return NextResponse.json({
      report: {
        ...report,
        survey: report.survey
          ? {
              ...report.survey,
              /** เกณฑ์แปลผลตามสเปก S-40 — คำนวณที่เดียว หน้าเว็บไม่ต้องรู้ช่วงตัวเลข */
              interpretation: interpretSurveyMean(report.survey.overallMean),
            }
          : null,
      },
      buddyLog,
    })
  }

  return errorResponse('bad-request', 'ต้องส่ง studentId (รายคน) หรือ classroomId (รายห้อง)')
}

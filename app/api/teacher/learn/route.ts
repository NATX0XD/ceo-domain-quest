import { NextResponse } from 'next/server'
import { z } from 'zod'
import missionsJson from '@/content/missions.json'
import { findLearnPath } from '@/components/server/learn-path'
import { loadClassroomLearnResults, summarizeClassLearn } from '@/components/server/learn-results'
import { errorResponse, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ผลเส้นทางเรียน (ดู / อ่าน / ลงมือทำ) ของห้อง — สเปก docs/learn-path-spec.md
 *
 *   GET /api/teacher/learn?classroomId=<uuid>                     ทั้งห้อง + สรุปรายภารกิจ
 *   GET /api/teacher/learn?classroomId=<uuid>&studentId=<uuid>    คนเดียว
 *
 * ⚠️ teacherId จาก cookie · ตรวจเจ้าของห้องในคิวรีเดียวกับที่อ่านข้อมูล ไม่ใช่เจ้าของ = 404
 * คืนคำตอบปลายเปิดครั้งล่าสุดต่อภารกิจ (latestAnswer) + โจทย์ใน questionPrompts[missionId][qid]
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const missionTitles: Record<string, string> = Object.fromEntries(
  missionsJson.missions.map((m) => [m.id, m.title]),
)

/** โจทย์ปลายเปิดทุกข้อ (ดู + อ่าน) แยกตามภารกิจ ให้ครูอ่านคำตอบคู่กับคำถาม */
const questionPrompts: Record<string, Record<string, string>> = Object.fromEntries(
  missionsJson.missions.map((m) => {
    const path = findLearnPath(m.id)
    const prompts: Record<string, string> = {}
    for (const q of [...(path?.watch.questions ?? []), ...(path?.read.questions ?? [])]) prompts[q.id] = q.prompt
    return [m.id, prompts]
  }),
)

const Query = z.object({
  classroomId: z.string().uuid(),
  studentId: z.string().uuid().optional(),
})

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const params = new URL(request.url).searchParams
  const parsed = Query.safeParse({
    classroomId: params.get('classroomId') ?? undefined,
    studentId: params.get('studentId') ?? undefined,
  })
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง classroomId (และ studentId ถ้าดูรายคน) ให้ถูกรูปแบบ')
  const { classroomId, studentId } = parsed.data

  try {
    const students = await loadClassroomLearnResults(session.teacherId, classroomId, studentId)
    if (!students) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
    if (studentId) {
      const student = students[0]
      if (!student) return errorResponse('not-found', 'ไม่พบนักเรียนคนนี้ในห้องของคุณ', 404)
      return NextResponse.json({ student, missionTitles, questionPrompts })
    }
    return NextResponse.json({ students, missions: summarizeClassLearn(students), missionTitles, questionPrompts })
  } catch (err) {
    console.error('[teacher/learn]', err)
    return errorResponse('learn-unavailable', 'อ่านผลเส้นทางเรียนไม่สำเร็จ ลองใหม่อีกครั้ง', 503)
  }
}

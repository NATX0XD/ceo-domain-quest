import { NextResponse } from 'next/server'
import { mediaEfficiency, type MissionScoreInput } from '@/core/efficiency'
import { getClassroomEfficiencyRaw } from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * E1/E2 ของห้อง — ตัวเลขที่ใช้ตอบกรรมการเรื่องประสิทธิภาพสื่อ (ตัวชี้วัด K7)
 *
 * E1 = คะแนนระหว่างเรียนเฉลี่ย (ภารกิจย่อย + รูบริกด่านบอส **ที่ครูยืนยันแล้วเท่านั้น**)
 * E2 = คะแนนแบบทดสอบหลังเรียนเฉลี่ย
 * สูตรและกติกา (ข้ามภารกิจ = นับเต็ม, ยังไม่ยืนยัน = 0) อยู่ใน core/efficiency.ts ไฟล์นี้ไม่คิดเอง
 *
 * ⚠️ teacherId จาก cookie · getTeacherBoardWithFlags ตรวจเจ้าของห้องใน query เดียว ไม่ใช่เจ้าของ = 404
 * ⚠️ คืนค่าเป็นภาพรวมของห้อง ไม่ใช่ตารางจัดอันดับรายคน (รายคนมีไว้ให้ครูตรวจย้อนเท่านั้น)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** อ่านคะแนนรูบริกที่ครูยืนยันแล้วจากใบเสนอล่าสุด — สถานะ 'revise' ยังไม่ใช่คะแนนสุดท้าย */
function confirmedRubricScore(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const bag = value as Record<string, unknown>
  if (bag.status === 'revise') return null
  if (typeof bag.weightedTotal === 'number') return bag.weightedTotal
  if (typeof bag.score === 'number') return bag.score
  return null
}

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  /**
   * ⚠️ ห้ามกลับไปวนยิงคิวรีรายคน — ของเดิมยิง 3 คิวรีต่อนักเรียนหนึ่งคน
   *    ห้อง 277 คน = 831 รอบไปกลับ วัดได้ 3,623 ms เกินเกณฑ์สเปกข้อ 9.5 (แผงครูไม่เกิน 3 วินาที)
   * RPC ตัวนี้คืนของดิบชุดเดียวกันเป๊ะในคิวรีเดียว และตรวจเจ้าของห้องให้ด้วย (null = ไม่ใช่ห้องของครูคนนี้)
   */
  const raw = await getClassroomEfficiencyRaw(session.teacherId, classroomId)
  if (!raw) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const rows = raw.map((student) => {
    // ด่านบอสไม่อยู่ในลิสต์นี้แล้ว (SQL ตัดออก) เพราะคิดจากรูบริก ไม่ใช่จากดาว กันนับซ้ำ
    const missions: MissionScoreInput[] = student.missions.map((row) => ({
      missionId: row.missionId,
      stars: row.stars,
    }))

    return {
      studentId: student.studentId,
      missions,
      rubricScore: confirmedRubricScore(student.rubricScores),
      postScore: student.postScore,
      preScore: student.preScore,
    }
  })

  const postScores = rows
    .map((r) => r.postScore)
    .filter((v): v is number => typeof v === 'number')
  const preScores = rows.map((r) => r.preScore).filter((v): v is number => typeof v === 'number')
  const efficiency = mediaEfficiency(rows, postScores)

  return NextResponse.json({
    ok: true,
    studentCount: rows.length,
    postTestDone: postScores.length,
    preTestDone: preScores.length,
    e1: efficiency.e1,
    e2: efficiency.e2,
    label: efficiency.label,
    standardLabel: efficiency.standardLabel,
    meetsStandard: efficiency.meetsStandard,
    summary: efficiency.summary,
  })
}

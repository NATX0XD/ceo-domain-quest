import type { Metadata } from 'next'
import { getClassroomReportRaw, listPendingReview } from '@/lib/db/repo'
import { StudentReportClient } from './student-report-client'
import { StudentCards } from '../_ux/student-cards'
import { loadShopTypes, toCardData } from '../_lib/student-cards-data'
import { TeacherSignedOut, TeacherSubPage, loadTeacherPage, one, type SearchParams } from '../_lib/teacher-page'

/**
 * T-10 รายงานรายคน — ครูใช้ให้คะแนนจริงหลังคาบ
 * ข้อมูลมาจาก GET /api/teacher/report?studentId= ซึ่งตรวจว่าเด็กอยู่ห้องของครูคนนี้จริงก่อนอ่าน
 */
export const metadata: Metadata = { title: 'รายงานรายคน — สำหรับครู' }
export const dynamic = 'force-dynamic'

export default async function TeacherStudentReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const data = await loadTeacherPage(params)
  if (!data) return <TeacherSignedOut title="รายงานรายคน" />

  // รายชื่อห้องอ่านฝั่งเซิร์ฟเวอร์ (ตรวจเจ้าของห้องใน repo) — เดิมพึ่ง endpoint แผงสดที่ปิดอยู่ จึงเห็น 0 คน
  const [raw, pending] = data.selectedId
    ? await Promise.all([
        getClassroomReportRaw(data.teacherId, data.selectedId).catch(() => null),
        listPendingReview(data.teacherId, data.selectedId).catch(() => null),
      ])
    : [null, null]
  const pendingNames = new Set((pending ?? []).map((p) => p.student_id))
  const roster = (raw?.students ?? []).map((st) => ({
    studentId: st.studentId,
    nickname: st.nickname,
    earnedStars: st.profile?.earnedStars ?? null,
    pendingReview: pendingNames.has(st.studentId),
    cleared: st.missions.filter((m) => m.passed).length + (st.submission !== null ? 1 : 0),
  }))

  const askedStudent = one(params.studentId)
  if (!askedStudent) {
    const types = await loadShopTypes((raw?.students ?? []).map((st) => st.studentId))
    const cards = toCardData(raw, types, pendingNames)
    return (
      <TeacherSubPage data={data} title="นักเรียนรายคน" subtitle="">
        <StudentCards students={cards} classroomId={data.selectedId} roomCode={data.selectedRoomCode} />
      </TeacherSubPage>
    )
  }

  return (
    <TeacherSubPage
      data={data}
      title="รายงานรายคน"
      subtitle=""
      basePath="/teacher/student"
    >
      <StudentReportClient classroomId={data.selectedId} studentId={askedStudent} initialRoster={roster} />
    </TeacherSubPage>
  )
}

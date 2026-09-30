import type { Metadata } from 'next'
import { StudentReportClient } from './student-report-client'
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

  return (
    <TeacherSubPage
      data={data}
      title="รายงานรายคน"
      subtitle={
        data.selectedRoomCode
          ? `ห้อง ${data.selectedRoomCode} · เลือกชื่อแล้วกดพิมพ์ได้เลย`
          : 'ยังไม่มีห้องเรียน'
      }
      basePath="/teacher/student"
    >
      <StudentReportClient classroomId={data.selectedId} studentId={one(params.studentId) ?? null} />
    </TeacherSubPage>
  )
}

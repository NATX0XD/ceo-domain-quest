import type { Metadata } from 'next'
import { ClassReportClient } from './class-report-client'
import { ReflectionPanel } from './reflection-panel'
import { LearnResultsPanel, MasteryRadarCard } from './learn-results-panel'
import { TeacherSignedOut, TeacherSubPage, loadTeacherPage, type SearchParams } from '../_lib/teacher-page'

/**
 * T-11 รายงานรายห้อง — E1/E2 · t-test · Cohen's d · <g> · จุดประสงค์ที่ห้องยังอ่อน
 * ตัวเลขมาจาก GET /api/teacher/report/class (คิดที่ core/ ทั้งหมด)
 */
export const metadata: Metadata = { title: 'รายงานรายห้อง — สำหรับครู' }
export const dynamic = 'force-dynamic'

export default async function TeacherClassReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="รายงานรายห้อง" />

  return (
    <TeacherSubPage
      data={data}
      title="ผลการเรียน"
      subtitle={data.selectedRoomCode ? `ห้อง ${data.selectedRoomCode}` : 'ยังไม่มีห้องเรียน'}
      basePath="/teacher/report"
    >
      <ClassReportClient
        classroomId={data.selectedId}
        roomCode={data.selectedRoomCode}
        masterySlot={<MasteryRadarCard classroomId={data.selectedId} />}
        csvHref={
          data.selectedId
            ? `/api/teacher/export?classroomId=${data.selectedId}&type=scores&pseudonymize=1`
            : undefined
        }
      />
      <LearnResultsPanel classroomId={data.selectedId} />
      <ReflectionPanel teacherId={data.teacherId} classroomId={data.selectedId} />
    </TeacherSubPage>
  )
}

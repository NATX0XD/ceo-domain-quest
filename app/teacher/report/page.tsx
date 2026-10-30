import type { Metadata } from 'next'
import Link from 'next/link'
import { ClassReportClient } from './class-report-client'
import { LearnResultsPanel } from './learn-results-panel'
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
      title="รายงานรายห้อง"
      subtitle={
        data.selectedRoomCode
          ? `ห้อง ${data.selectedRoomCode} · ตัวเลขสำหรับเอกสารผลการทดลองและสไลด์`
          : 'ยังไม่มีห้องเรียน'
      }
      basePath="/teacher/report"
      action={
        data.selectedId ? (
          <Link
            href={`/api/teacher/export?classroomId=${data.selectedId}&type=scores&pseudonymize=1`}
            className="btn-base bg-surface-raised px-4 text-brand-700 ring-2 ring-brand-100 ring-inset"
          >
            ดาวน์โหลด CSV
          </Link>
        ) : null
      }
    >
      <ClassReportClient classroomId={data.selectedId} roomCode={data.selectedRoomCode} />
      <LearnResultsPanel classroomId={data.selectedId} />
    </TeacherSubPage>
  )
}

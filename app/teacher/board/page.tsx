import type { Metadata } from 'next'
import { LiveBoardClient } from './live-board-client'
import { TeacherSignedOut, TeacherSubPage, loadTeacherPage, type SearchParams } from '../_lib/teacher-page'

/**
 * T-05 แผงห้องเรียนสด — "ครูคนเดียวดู 30 คนพร้อมกันยังไง" ตอบด้วยจอนี้
 * ข้อมูลทั้งหมดมาจาก GET /api/teacher/board (poll 3 วินาที) ซึ่งตรวจเจ้าของห้องให้แล้ว
 */
export const metadata: Metadata = { title: 'แผงห้องเรียนสด — สำหรับครู' }
export const dynamic = 'force-dynamic'

export default async function TeacherBoardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="แผงห้องเรียนสด" />

  return (
    <TeacherSubPage
      data={data}
      title="ห้องเรียนสด"
      subtitle={data.selectedRoomCode ? `ห้อง ${data.selectedRoomCode} · แดงก่อนเสมอ` : 'ยังไม่มีห้องเรียน'}
      basePath="/teacher/board"
    >
      <LiveBoardClient classroomId={data.selectedId} />
    </TeacherSubPage>
  )
}

import type { Metadata } from 'next'
import { snapshotMissionSettings } from '@/lib/mission-settings'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { TeacherMissionSettings } from '@/components/teacher-mission-settings'

export const metadata: Metadata = { title: 'ตั้งค่าด่าน — สำหรับครู' }
export const dynamic = 'force-dynamic'

export default async function TeacherMissionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="ตั้งค่าด่าน" />
  const initial = data.selectedId ? await snapshotMissionSettings(data.selectedId) : null
  return <PageBody><PageHead title="ตั้งค่าด่าน" subtitle="กำหนดจังหวะการเรียนของแต่ละห้อง โดยไม่ต้องเปิดคาบสด" /><TeacherMissionSettings classroomId={data.selectedId} initial={initial} /></PageBody>
}

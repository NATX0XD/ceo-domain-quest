import type { Metadata } from 'next'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { PlanRequests } from '../board/plan-requests'

export const metadata: Metadata = { title: 'คำขอจากนักเรียน — สำหรับครู' }
export const dynamic = 'force-dynamic'

/** S-08 คำขอเปลี่ยนแผนของนักเรียน — ครูตอบได้ทีละใบ พร้อมเลือกให้แบบอื่นแทน */
export default async function TeacherRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="คำขอจากนักเรียน" />

  return (
    <PageBody>
      <PageHead
        title="คำขอจากนักเรียน"
        subtitle="ตอบแล้วเด็กเห็นทันทีว่าครูให้อะไร · ให้แบบอื่นแทนได้ ไม่ต้องตอบแค่ได้หรือไม่ได้"
      />
      <PlanRequests classroomId={data.selectedId} />
    </PageBody>
  )
}

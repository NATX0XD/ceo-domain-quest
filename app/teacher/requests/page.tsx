import type { Metadata } from 'next'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { Icon3d } from '../_ux/v2'
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
        tone="blue"
        art="/ui/mode/dome.webp"
        icon={<Icon3d name="speech-balloon" size={36} />}
        title="คำขอนักเรียน"
        subtitle="ตอบแล้วเด็กเห็นทันที"
      />
      <PlanRequests classroomId={data.selectedId} />
    </PageBody>
  )
}

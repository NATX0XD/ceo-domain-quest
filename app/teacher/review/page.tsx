import type { Metadata } from 'next'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { Icon3d } from '../_ux/v2'
import { ReviewList } from '../_ux/review-list'

export const metadata: Metadata = { title: 'งานรอตรวจ — สำหรับครู' }
export const dynamic = 'force-dynamic'

/** งานที่นักเรียนส่งมาและรอครูยืนยันคะแนน — หน้าเต็มของแดชบอร์ด (UX-6) */
export default async function TeacherReviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const data = await loadTeacherPage(params)
  if (!data) return <TeacherSignedOut title="งานรอตรวจ" />

  return (
    <PageBody>
      <PageHead
        tone="rose"
        icon={<Icon3d name="memo" size={36} />}
        title="งานรอตรวจ"
        subtitle="ครูเป็นคนยืนยันคะแนนเสมอ"
      />
      <ReviewList teacherId={data.teacherId} classroomId={data.selectedId} selectedId={typeof params.submission === 'string' ? params.submission : null} />
    </PageBody>
  )
}

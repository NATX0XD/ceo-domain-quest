import type { Metadata } from 'next'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { ReviewList } from '../_ux/review-list'

export const metadata: Metadata = { title: 'งานรอตรวจ — สำหรับครู' }
export const dynamic = 'force-dynamic'

/** งานที่นักเรียนส่งมาและรอครูยืนยันคะแนน — หน้าเต็มของแดชบอร์ด (UX-6) */
export default async function TeacherReviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="งานรอตรวจ" />

  return (
    <PageBody>
      <PageHead
        title="งานรอตรวจ"
        subtitle="คะแนนทุกก้อนเป็นข้อเสนอ ครูเป็นคนยืนยันเสมอ · ส่งกลับให้แก้ได้จากการ์ดเดียวกัน"
      />
      <ReviewList teacherId={data.teacherId} classroomId={data.selectedId} />
    </PageBody>
  )
}

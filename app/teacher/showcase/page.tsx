import type { Metadata } from 'next'
import Link from 'next/link'
import { listPendingReview } from '@/lib/db/repo'
import { TeacherShowcaseClient } from '@/components/teacher-showcase-client'
import { TeacherFlagsClient } from '@/components/teacher-flags-client'
import { Card } from '@/components/ui'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'

export const metadata: Metadata = { title: 'ผลงานและจอหน้าห้อง — สำหรับครู' }
export const dynamic = 'force-dynamic'

/**
 * T-04 ปักหมุดผลงานขึ้นจอหน้าห้อง + T-09 ซ่อนความเห็นที่ไม่เหมาะสม
 * รวมไว้หน้าเดียวเพราะเป็นงาน "ของที่จะขึ้นให้ทั้งห้องเห็น" เหมือนกัน
 */
export default async function TeacherShowcasePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="ผลงานและจอหน้าห้อง" />

  const pending = data.selectedId
    ? ((await listPendingReview(data.teacherId, data.selectedId)) ?? [])
    : []

  return (
    <PageBody>
      <PageHead
        title="ผลงานและจอหน้าห้อง"
        subtitle="เลือกผลงานขึ้นจอหน้าห้อง · ดูแลความเห็นของเพื่อนในห้อง · จอหน้าห้องไม่แสดงดาวและคะแนน"
        action={
          data.selectedId ? (
            <Link
              href={`/board?classroomId=${data.selectedId}`}
              target="_blank"
              className="btn-base bg-brand-600 px-4 text-ink-onbrand shadow-soft-1"
            >
              เปิดจอหน้าห้อง (แท็บใหม่)
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-4">
        <TeacherFlagsClient classroomId={data.selectedId} />

        <TeacherShowcaseClient
          classroomId={data.selectedId}
          candidates={pending
            .filter((row) => row.emphasis_criterion !== null)
            .map((row) => ({
              id: row.id,
              nickname: row.nickname,
              domain: `${row.domain_name}${row.tld}`,
            }))}
        />

        <Card as="section">
          <h2 className="text-title-sm font-bold text-ink">จอหน้าห้องแสดงอะไรบ้าง</h2>
          <p className="mt-1 text-body text-ink-muted">
            จอหน้าห้องเปลี่ยนตามช่วงของคาบให้เอง — ช่วงรอเริ่มขึ้นรหัสห้องกับ QR ·
            ช่วงภารกิจขึ้นเมืองของห้อง · ช่วงครูสรุปขึ้นผลงานที่ปักหมุดไว้
            <strong> ไม่มีดาว ไม่มีคะแนน ไม่มีการจัดอันดับ</strong> ตามกติกาของระบบ
          </p>
        </Card>
      </div>
    </PageBody>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { listPendingReview, listTeacherShowcaseLikes } from '@/lib/db/repo'
import { TeacherShowcaseClient } from '@/components/teacher-showcase-client'
import { TeacherFlagsClient } from '@/components/teacher-flags-client'
import { showcaseSafeForPeers } from '@/components/server/showcase-safety'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { Icon3d, InfoTip } from '../_ux/v2'

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

  const [pending, likes] = data.selectedId
    ? await Promise.all([
        listPendingReview(data.teacherId, data.selectedId).then((rows) => rows ?? []),
        listTeacherShowcaseLikes(data.teacherId, data.selectedId),
      ])
    : [[], []]
  // ใจที่เพื่อนกดให้บนแกลเลอรี /showcase — ครูเห็นตัวเลข นักเรียนไม่เห็นการจัดอันดับ
  const liked = likes.filter((row) => row.likes > 0).sort((a, b) => a.nickname.localeCompare(b.nickname, 'th'))

  return (
    <PageBody>
      <PageHead
        title="ผลงานเด่น"
        subtitle="จอหน้าห้องไม่แสดงดาวและคะแนน"
        action={
          data.selectedId ? (
            <Link
              href={`/board?classroomId=${data.selectedId}`}
              target="_blank"
              className="t2-btn focus-ring"
              data-kind="primary"
            >
              <Icon3d name="television" size={24} />
              เปิดจอฉาย
            </Link>
          ) : null
        }
      />

      <div className="t2-stack">
        <TeacherFlagsClient classroomId={data.selectedId} />

        <TeacherShowcaseClient
          classroomId={data.selectedId}
          candidates={pending
            .filter((row) => row.emphasis_criterion !== null)
            .map((row) => ({
              id: row.id,
              nickname: row.nickname,
              domain: `${row.domain_name}${row.tld}`,
              // ติดตัวกรองคำ = เพื่อนไม่เห็นบนผนังผลงาน ครูยังเห็นและปักหมุดเองได้ถ้าจะใช้สอน
              hiddenFromPeers: !showcaseSafeForPeers({
                domainName: row.domain_name,
                tld: row.tld,
                reasonText: row.reason_text,
              }),
            }))}
        />

        <section className="t2-card">
          <h3 className="t2-card-title">ใจจากเพื่อนบนแกลเลอรี</h3>
          {liked.length === 0 ? (
            <p className="t2-empty">ยังไม่มีใครกดใจผลงานเพื่อน</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {liked.map((row) => (
                <li key={row.nickname} className="t2-chip">
                  <span className="font-extrabold">{row.nickname}</span>
                  <span>♥ {row.likes}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="t2-note" data-tone="sky">
          <Icon3d name="television" size={32} />
          <span className="min-w-0 flex-1">
            จอหน้าห้องเปลี่ยนตามช่วงคาบเอง
            <InfoTip
              label="เรื่องจอหน้าห้อง"
              text="ช่วงรอเริ่มขึ้นรหัสห้องกับ QR · ช่วงภารกิจขึ้นเมืองของห้อง · ช่วงครูสรุปขึ้นผลงานที่ปักหมุดไว้ ไม่มีดาว ไม่มีคะแนน ไม่มีการจัดอันดับ"
            />
          </span>
        </section>
      </div>
    </PageBody>
  )
}

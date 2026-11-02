import type { Metadata } from 'next'
import { listClassroomCeoWorks, listPendingReview, listTeacherShowcaseLikes } from '@/lib/db/repo'
import { TeacherShowcaseClient } from '@/components/teacher-showcase-client'
import { TeacherFlagsClient } from '@/components/teacher-flags-client'
import { TeacherPeerVisibilityClient, type PeerVisibilityRow } from '@/components/teacher-peer-visibility-client'
import { showcaseSafeForPeers, showcaseVisibleToPeers } from '@/components/server/showcase-safety'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { InfoTip } from '../_ux/v2'

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

  const [pending, likes, works] = data.selectedId
    ? await Promise.all([
        listPendingReview(data.teacherId, data.selectedId).then((rows) => rows ?? []),
        listTeacherShowcaseLikes(data.teacherId, data.selectedId),
        listClassroomCeoWorks(data.teacherId, data.selectedId).then((rows) => rows ?? []),
      ])
    : [[], [], []]
  /** ผนังผลงานเพื่อนแสดงใบเสนอล่าสุดของแต่ละคน — ครูตั้งการแสดงที่ใบนั้น */
  const latestWork = new Map<string, (typeof works)[number]>()
  for (const row of works) {
    const prev = latestWork.get(row.nickname)
    if (!prev || row.created_at > prev.created_at) latestWork.set(row.nickname, row)
  }
  const peerRows: PeerVisibilityRow[] = [...latestWork.values()]
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'th'))
    .map((row) => ({
      submissionId: row.id,
      nickname: row.nickname,
      domain: `${row.domain_name}${row.tld}`,
      flagged: !showcaseSafeForPeers({ domainName: row.domain_name, tld: row.tld, reasonText: row.reason_text }),
      override: row.peer_visible ?? null,
    }))
  // ใจที่เพื่อนกดให้บนแกลเลอรี /showcase — ครูเห็นตัวเลข นักเรียนไม่เห็นการจัดอันดับ
  const liked = likes.filter((row) => row.likes > 0).sort((a, b) => a.nickname.localeCompare(b.nickname, 'th'))

  return (
    <PageBody>
      <PageHead
        title="ผลงานเด่น"
        subtitle="กลั่นกรองผลงานที่เพื่อนจะเห็น"
      />

      <div className="t2-stack">
        <TeacherFlagsClient classroomId={data.selectedId} />

        {data.selectedId ? <TeacherPeerVisibilityClient rows={peerRows} /> : null}

        <TeacherShowcaseClient
          classroomId={data.selectedId}
          candidates={pending
            .filter((row) => row.emphasis_criterion !== null)
            .map((row) => ({
              id: row.id,
              nickname: row.nickname,
              domain: `${row.domain_name}${row.tld}`,
              // ติดตัวกรองคำ = เพื่อนไม่เห็นบนผนังผลงาน ครูยังเห็นและปักหมุดเองได้ถ้าจะใช้สอน
              hiddenFromPeers: !showcaseVisibleToPeers({
                domainName: row.domain_name,
                tld: row.tld,
                reasonText: row.reason_text,
                peerVisible: row.peer_visible ?? null,
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

        <section className="t2-note" data-tone="sky"><span><strong>การมองเห็นของเพื่อน</strong> ใช้ปุ่ม peer_visible เพื่อเลือกผลงานที่ปลอดภัยและเหมาะกับการแลกเปลี่ยนเรียนรู้</span><InfoTip label="เรื่องการมองเห็น" text="ผลงานที่ไม่ผ่านตัวกรองจะถูกซ่อนจากเพื่อนโดยอัตโนมัติ ครูตรวจและยืนยันได้จากหน้านี้" /></section>
      </div>
    </PageBody>
  )
}

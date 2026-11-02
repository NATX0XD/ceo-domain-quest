import type { Metadata } from 'next'
import { listClassroomCeoWorks, listPendingReview, listPinnedShowcase, listTeacherShowcaseLikes } from '@/lib/db/repo'
import { loadShopTypes } from '@/app/teacher/_lib/student-cards-data'
import { shopArtSrc } from '@/components/shop-art'
import { TeacherShowcaseClient, type ShowcaseCandidate } from '@/components/teacher-showcase-client'
import { TeacherFlagsClient } from '@/components/teacher-flags-client'
import { TeacherPeerVisibilityClient, type PeerVisibilityRow } from '@/components/teacher-peer-visibility-client'
import { showcaseSafeForPeers, showcaseVisibleToPeers } from '@/components/server/showcase-safety'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody } from '../_ux/page-head'
import { UrlTabs } from '../_ux/url-tabs'

export const metadata: Metadata = { title: 'ผลงานและจอหน้าห้อง — สำหรับครู' }
export const dynamic = 'force-dynamic'

/** T-04 ปักหมุดผลงานขึ้นจอหน้าห้อง + T-09 ซ่อนความเห็นที่ไม่เหมาะสม */
export default async function TeacherShowcasePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="ผลงานและจอหน้าห้อง" />

  const result = data.selectedId
    ? await Promise.all([
        listPendingReview(data.teacherId, data.selectedId).then((rows) => rows ?? []),
        listTeacherShowcaseLikes(data.teacherId, data.selectedId),
        listClassroomCeoWorks(data.teacherId, data.selectedId).then((rows) => rows ?? []),
        listPinnedShowcase(data.teacherId, data.selectedId),
      ])
    : null
  const likes = result?.[1] ?? []
  const works = result?.[2] ?? []
  const pinned = result?.[3] ?? []
  const shopTypes = await loadShopTypes(works.map((row) => row.student_id))
  const pinnedIds = new Set(pinned.map((row) => row.submission_id))

  const latestWork = new Map<string, (typeof works)[number]>()
  for (const row of works) {
    const prev = latestWork.get(row.nickname)
    if (!prev || row.created_at > prev.created_at) latestWork.set(row.nickname, row)
  }

  const peerRows: PeerVisibilityRow[] = [...latestWork.values()]
    .map((row) => {
      const flagged = !showcaseSafeForPeers({ domainName: row.domain_name, tld: row.tld, reasonText: row.reason_text })
      return {
        submissionId: row.id,
        nickname: row.nickname,
        domain: `${row.domain_name}${row.tld}`,
        reasonText: row.reason_text,
        flagged,
        override: row.peer_visible ?? null,
        shopArt: shopArtSrc(shopTypes.get(row.student_id), 5),
        pinned: pinnedIds.has(row.id),
      }
    })
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.nickname.localeCompare(b.nickname, 'th'))

  const candidates: ShowcaseCandidate[] = works.map((row) => ({
    id: row.id,
    nickname: row.nickname,
    domain: `${row.domain_name}${row.tld}`,
    reason: row.reason_text ?? '',
    shopArt: shopArtSrc(shopTypes.get(row.student_id), 5),
  }))
  const visibleCount = peerRows.filter((row) => {
    const dot = row.domain.lastIndexOf('.')
    return showcaseVisibleToPeers({
      domainName: dot > 0 ? row.domain.slice(0, dot) : row.domain,
      tld: dot > 0 ? row.domain.slice(dot) : '',
      reasonText: row.reasonText,
      peerVisible: row.override,
    })
  }).length
  const hiddenCount = peerRows.length - visibleCount
  const reviewCount = peerRows.filter((row) => row.flagged).length
  const liked = likes.filter((row) => row.likes > 0).sort((a, b) => a.nickname.localeCompare(b.nickname, 'th'))

  return (
    <PageBody>
      <section className="showcase-hero" aria-labelledby="showcase-title">
        <div className="showcase-hero__copy">
          <span className="showcase-hero__eyebrow"><span aria-hidden>✦</span> ห้องแกลเลอรีของเรา</span>
          <h1 id="showcase-title">ผลงานเด่น</h1>
          <p>เลือกผลงานที่เพื่อนในห้องจะเห็นบนผนังผลงาน</p>
        </div>
        <img className="showcase-hero__dome" src="/ui/teacher/hero-dome.webp" alt="โดมถือคลิปบอร์ดและคอมพิวเตอร์" />
        <div className="showcase-hero__stats" aria-label="สรุปการมองเห็นผลงาน">
          <div><strong>{visibleCount}</strong><span>แสดง</span></div>
          <div><strong>{hiddenCount}</strong><span>ซ่อน</span></div>
          <div><strong>{reviewCount}</strong><span>ต้องดู</span></div>
        </div>
      </section>

      <UrlTabs
        label="หมวดผลงานเด่น"
        items={[
          {
            value: 'moderate',
            label: 'กลั่นกรอง',
            content: (
              <>
                <TeacherFlagsClient classroomId={data.selectedId} />
                {data.selectedId ? (
                  <TeacherPeerVisibilityClient rows={peerRows} initialPinnedIds={[...pinnedIds]} />
                ) : (
                  <section className="showcase-empty showcase-empty--wide"><strong>ยังไม่มีห้องที่เลือก</strong><span>เลือกห้องเรียนจากแถบด้านบนเพื่อเริ่มคัดผลงาน</span></section>
                )}
              </>
            ),
          },
          {
            value: 'screen',
            label: 'ขึ้นจอหน้าห้อง',
            content: (
              <>
                <TeacherShowcaseClient classroomId={data.selectedId} candidates={candidates} initialPinned={pinned} />
                <section className="t2-card showcase-likes" aria-label="ใจจากเพื่อนบนแกลเลอรี">
                  <div><p className="showcase-section-kicker">เสียงจากแกลเลอรี</p><h2 className="showcase-section-title">ใจจากเพื่อน</h2></div>
                  {liked.length === 0 ? (
                    <p className="t2-empty">ยังไม่มีใครกดใจผลงานเพื่อน</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {liked.map((row) => <li key={row.nickname} className="t2-chip"><span className="font-extrabold">{row.nickname}</span><span>♥ {row.likes}</span></li>)}
                    </ul>
                  )}
                </section>
              </>
            ),
          },
        ]}
      />
    </PageBody>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { getProfile, getStudent, listPeerFeedbackFor, listSubmissions } from '@/lib/db/repo'
import { SignInGate } from '@/components/student-shell'
import { AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import { ShowcaseCarousel, type ShowcaseFeedback, type ShowcaseMine } from '@/components/showcase-client'
import { ShowcaseHeader } from '@/components/showcase-header'
import { ChevronRightIcon } from '@/components/ui'
import { loadShopProfile } from '@/components/server/game-state'
import { resolveShopArt } from '@/components/server/shop-art-file'
import { showcaseSafeForPeers, showcaseVisibleToPeers } from '@/components/server/showcase-safety'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import './showcase.css'

export const metadata: Metadata = { title: 'ผลงานของฉัน | CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * ขั้นที่ 5 ดูผลงานเพื่อน - จอหลักเป็น carousel ที่เริ่มจากผลงานของเรา
 *
 * ⚠️ ห้ามแสดงคะแนนหรือดาวของเพื่อนเด็ดขาด แสดงแค่ผลงาน ไม่เอาผู้เรียนมาเทียบกัน
 * ⚠️ ผลงานของเพื่อนอ่านผ่าน GET /api/me/showcase เท่านั้น (ชื่อเล่น · โดเมน · นามสกุล · เหตุผล)
 *    ชิ้นที่ติดตัวกรองคำถูกซ่อนจากเพื่อนที่ API นั้น (ครูยังเห็นที่ /teacher/showcase)
 */
export default async function ShowcasePage() {
  const session = await readStudentSession()
  if (!session) {
    return <SignInGate message="ใส่รหัสห้องกับ PIN ที่ครูให้ก่อน แล้วจะเห็นผลงานของเพื่อนทั้งห้อง" />
  }

  const [student, mine, allFeedback, shop, profile] = await Promise.all([
    getStudent(session.studentId),
    listSubmissions(session.studentId),
    listPeerFeedbackFor(session.studentId),
    loadShopProfile(session.studentId).catch(() => null),
    getProfile(session.studentId).catch(() => null),
  ])
  // แหล่งเดียวกับ /posttest - ทำแล้วไม่ชวนทำซ้ำ พาไปดูผลกับเกียรติบัตรแทน
  const posttestDone = profile?.post_test_score != null

  /**
   * T-09 ครูซ่อนความเห็นที่ไม่เหมาะสมได้ - ที่ถูกซ่อนต้องไม่โผล่ให้ผู้เรียนเห็น
   * ข้อความต้นฉบับยังอยู่ในฐานข้อมูล ครูกดเลิกซ่อนได้ (ไม่ได้ลบทิ้ง)
   */
  const feedback = allFeedback.filter((row) => row.hidden_at === null)

  // ใบล่าสุดคือแถวแรก (listSubmissions เรียง created_at DESC) - สำคัญเมื่อมีการแก้งานหลายฉบับ
  const myWork = mine.find((row) => row.emphasis_criterion !== null) ?? mine[0] ?? null
  /** ตรงกับที่ /api/me/showcase ตัดสิน - ครูอนุมัติแล้ว (peer_visible = true) โน้ตนี้หายไป */
  const myWorkFields = myWork
    ? { domainName: myWork.domain_name, tld: myWork.tld, reasonText: myWork.reason_text }
    : null
  const hiddenFromPeers =
    myWorkFields !== null && !showcaseVisibleToPeers({ ...myWorkFields, peerVisible: myWork?.peer_visible ?? null })
  const hiddenNote = !hiddenFromPeers
    ? null
    : myWorkFields && !showcaseSafeForPeers(myWorkFields)
      ? 'ผลงานชิ้นนี้มีคำที่ไม่เหมาะ เพื่อนจึงไม่เห็นบนผนังผลงาน ครูเห็นอยู่คนเดียว'
      : 'ครูยังไม่ให้ผลงานชิ้นนี้ขึ้นผนังผลงานเพื่อน ครูเห็นอยู่คนเดียว'

  const art = resolveShopArt(shop?.businessTypeId, 5)

  const myShowcase: ShowcaseMine = {
    shopName: shop?.shopName ?? student?.nickname ?? 'ร้านของฉัน',
    artSrc: art,
    domainName: myWork?.domain_name ?? null,
    tld: myWork?.tld ?? null,
    reasonText: myWork?.reason_text ?? null,
    hiddenNote,
  }
  const receivedFeedback: ShowcaseFeedback[] = feedback.map((row) => ({
    id: row.id,
    praiseText: row.praise_text,
    suggestText: row.suggest_text,
  }))

  return (
    <AppShell
      fit
      className="student-world sc-shell"
      mainClassName="sc-main"
      header={<ShowcaseHeader />}
      footer={<BottomNav />}
    >
      <div className="sc-page">
        <ShowcaseCarousel my={myShowcase} feedback={receivedFeedback} />

        <Link
          href={posttestDone ? '/result' : '/posttest'}
          className="game-button game-button--orange game-button--lg sc-cta"
        >
          {posttestDone ? 'ดูผลและเกียรติบัตร' : 'แบบทดสอบหลังเรียน'}
          <ChevronRightIcon width={22} height={22} aria-hidden />
        </Link>
      </div>
    </AppShell>
  )
}

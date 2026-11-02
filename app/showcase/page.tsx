import type { Metadata } from 'next'
import Link from 'next/link'
import { getStudent, listPeerFeedbackFor, listSubmissions } from '@/lib/db/repo'
import { SignInGate } from '@/components/student-shell'
import { AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import { ShowcaseBoard, ShowcaseFeedbackForm } from '@/components/showcase-client'
import { ShowcaseHeader } from '@/components/showcase-header'
import { Card, CheckIcon, ChevronRightIcon, LightbulbIcon, SendIcon, Sheet, UsersIcon } from '@/components/ui'
import { loadShopProfile } from '@/components/server/game-state'
import { resolveShopArt } from '@/components/server/shop-art-file'
import { showcaseSafeForPeers } from '@/components/server/showcase-safety'
import { shopArtFallbackSrc } from '@/components/shop-art'
import { ShopArtImg } from '@/components/shop-art-img'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import './showcase.css'

export const metadata: Metadata = { title: 'ผลงานของฉัน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/** เหตุผลที่บันทึกเป็นก้อนเดียว ("1. ...\n2. ...") แยกเป็นข้อ ตัดเลขนำหน้าเดิมทิ้ง (หน้าจอใส่เลขให้เอง) */
function splitReasons(text: string | null): string[] {
  return (text ?? '')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 3)
}

/**
 * ขั้นที่ 5 ดูผลงานเพื่อน — จอหลักคือ **ผลงานของเราเอง** (ภาพร้าน + ป้ายชื่อเว็บ + เหตุผล)
 *
 * ของยาว (ผลงานเพื่อนทั้งห้อง · ฟอร์มชม · ความเห็นที่เพื่อนเขียนถึงเรา) อยู่ในแผ่นเลื่อนขึ้น จอหลักจึงไม่ต้องเลื่อน
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

  const [student, mine, allFeedback, shop] = await Promise.all([
    getStudent(session.studentId),
    listSubmissions(session.studentId),
    listPeerFeedbackFor(session.studentId),
    loadShopProfile(session.studentId).catch(() => null),
  ])

  /**
   * T-09 ครูซ่อนความเห็นที่ไม่เหมาะสมได้ — ที่ถูกซ่อนต้องไม่โผล่ให้ผู้เรียนเห็น
   * ข้อความต้นฉบับยังอยู่ในฐานข้อมูล ครูกดเลิกซ่อนได้ (ไม่ได้ลบทิ้ง)
   */
  const feedback = allFeedback.filter((row) => row.hidden_at === null)

  // ใบล่าสุดคือแถวแรก (listSubmissions เรียง created_at DESC) — สำคัญเมื่อมีการแก้งานหลายฉบับ
  const myWork = mine.find((row) => row.emphasis_criterion !== null) ?? mine[0] ?? null
  const reasons = splitReasons(myWork?.reason_text ?? null)
  const hiddenFromPeers =
    myWork !== null &&
    !showcaseSafeForPeers({ domainName: myWork.domain_name, tld: myWork.tld, reasonText: myWork.reason_text })

  const art = resolveShopArt(shop?.businessTypeId, 5)

  return (
    <AppShell
      fit
      className="student-world sc-shell"
      mainClassName="sc-main"
      header={<ShowcaseHeader />}
      footer={<BottomNav />}
    >
      <div className="sc-page">
        <section className="sc-card" aria-labelledby="sc-my-domain">
          <div className="sc-card-head">
            <p className="sc-kicker">{shop?.shopName ?? student?.nickname ?? 'ร้านของฉัน'}</p>
            <Sheet
              id="sheet-inbox"
              triggerVariant="chip"
              triggerIcon={
                // eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D สถิต
                <img src="/icons/3d/speech-balloon.webp" alt="" aria-hidden="true" style={{ width: 22, height: 22 }} />
              }
              trigger={
                <>
                  เพื่อนชมเรา
                  <span className={`sc-badge${feedback.length > 0 ? ' is-new' : ''}`}>{feedback.length}</span>
                </>
              }
              title="ความเห็นที่เพื่อนเขียนถึงเรา"
              triggerClassName="sc-inbox"
            >
              {feedback.length === 0 ? (
                <div className="rounded-xl bg-surface-sunken p-4">
                  <p className="text-body font-bold text-ink">ยังไม่มีใครเขียนถึงเรา</p>
                  <p className="mt-1 text-label text-ink-muted">
                    ระหว่างรอ ลองไปอ่านงานเพื่อนแล้วเขียนชมเขาก่อนก็ได้
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {feedback.map((f) => (
                    /* แถบสีซ้ายของการ์ด บอกว่าเป็นคำชม (เขียว) หรือมีข้อเสนอแนะ (ส้ม) */
                    <Card
                      as="li"
                      key={f.id}
                      className={`border-l-4 ${f.praise_text ? 'border-quest-500' : 'border-spark-500'}`}
                    >
                      {f.praise_text ? (
                        <p className="flex items-start gap-2 text-body text-pretty text-quest-700">
                          <CheckIcon width={20} height={20} aria-hidden className="mt-1 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="font-bold">ชม:</span> {f.praise_text}
                          </span>
                        </p>
                      ) : null}
                      {f.suggest_text ? (
                        <p
                          className={`flex items-start gap-2 text-body text-pretty text-ink ${
                            f.praise_text ? 'mt-2' : ''
                          }`}
                        >
                          <LightbulbIcon width={20} height={20} aria-hidden className="mt-1 shrink-0 text-spark-600" />
                          <span className="min-w-0 flex-1">
                            <span className="font-bold">เสนอแนะ:</span> {f.suggest_text}
                          </span>
                        </p>
                      ) : null}
                    </Card>
                  ))}
                </ul>
              )}
            </Sheet>
          </div>

          <div className="sc-scene">
            <span className="sc-cloud sc-cloud-one" aria-hidden="true" />
            <span className="sc-cloud sc-cloud-two" aria-hidden="true" />
            <ShopArtImg src={art} fallback={shopArtFallbackSrc(5)} alt="ภาพร้านของฉัน" className="sc-art" />
          </div>

          {myWork ? (
            <>
              <div className="sc-sign">
                <span className="sc-sign-type">ชื่อเว็บของฉัน</span>
                {/* โดเมนไม่มีช่องว่าง ตัดคำแบบ break-all ไม่งั้นดันป้ายกว้างเกินจอ */}
                <strong id="sc-my-domain">
                  {myWork.domain_name}
                  {myWork.tld}
                </strong>
              </div>
              {reasons.length > 0 ? (
                <ol className="sc-reasons" aria-label="เหตุผลที่ตั้งชื่อนี้">
                  {reasons.map((reason, i) => (
                    <li key={`${i}-${reason}`}>
                      <span className="sc-reason-no" aria-hidden="true">{i + 1}</span>
                      <span className="sc-reason-text">{reason}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {hiddenFromPeers ? (
                <p className="sc-hidden-note" role="note">
                  ผลงานชิ้นนี้มีคำที่ไม่เหมาะ เพื่อนจึงไม่เห็นบนผนังผลงาน ครูเห็นอยู่คนเดียว
                </p>
              ) : null}
            </>
          ) : (
            /* จอว่างต้องบอกเหตุผลและทางไปต่อ ไม่ใช่ปล่อยว่าง */
            <div className="sc-empty">
              <h2 id="sc-my-domain">ยังไม่มีผลงานที่ส่ง</h2>
              <p>ส่งใบเสนอที่ด่านบอส CEO ก่อน แล้วผลงานจะมาโผล่ตรงนี้ ระหว่างนี้ดูงานเพื่อนได้เลย</p>
              <Link href="/ceo" className="game-button game-button--purple game-button--sm">
                ไปด่านบอส CEO
              </Link>
            </div>
          )}
        </section>

        <nav aria-label="ดูและเขียนถึงเพื่อน" className="sc-actions">
          <Sheet
            id="sheet-peers"
            triggerVariant="chip"
            triggerIcon={<UsersIcon width={20} height={20} aria-hidden />}
            trigger="ผลงานเพื่อน"
            title="ผลงานของเพื่อนในห้อง"
            triggerClassName="game-button game-button--blue game-button--md sc-action"
          >
            <p className="text-label text-ink-muted">
              อ่านไอเดียเพื่อนได้เลย แผ่นนี้แสดงเฉพาะชื่อเว็บกับเหตุผล ไม่มีการจัดอันดับ
            </p>
            <div className="mt-3">
              <ShowcaseBoard />
            </div>
          </Sheet>

          <Sheet
            id="sheet-praise"
            triggerVariant="chip"
            triggerIcon={<SendIcon width={20} height={20} aria-hidden />}
            trigger="เขียนชมเพื่อน"
            title="เขียนถึงเพื่อน"
            triggerClassName="game-button game-button--green game-button--md sc-action"
          >
            <ShowcaseFeedbackForm myNickname={student?.nickname ?? ''} />
          </Sheet>
        </nav>

        <Link href="/posttest" className="game-button game-button--orange game-button--lg sc-cta">
          แบบทดสอบหลังเรียน
          <ChevronRightIcon width={22} height={22} aria-hidden />
        </Link>
      </div>
    </AppShell>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { SignInGate } from '@/components/student-shell'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import {
  AchievementBadge,
  ChevronRightIcon,
  DomeAvatar,
  DownloadIcon,
  ExternalLinkIcon,
  KnowledgeIcon,
  ProgressBar,
  RewardIcon,
  SceneDecor,
  Sheet,
  SpeechBubble,
  StarIcon,
  TargetIcon,
} from '@/components/ui'
import { SelfAssessPanel } from '@/components/self-assess/self-assess-panel'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { lessonSummary } from '@/components/server/lesson-progress'
import { loadShopProfile, loadSelfProfileDb } from '@/components/server/game-state'
import {
  fillTemplate,
  goalCompareCard,
  reflection,
  selfProfile,
} from '@/components/server/lesson-content'
import { certificateEligibility } from '@/components/server/certificate-eligibility'
import { posttestGate } from '@/components/server/posttest-gate'
import { PRODUCT_NAME_EN } from '@/components/product'
import { getProfile, getStudent, listSubmissions } from '@/lib/db/repo'

export const metadata: Metadata = { title: 'เปิดตัวบริษัท — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/** ชื่อเดือนย่อภาษาไทย — ใช้พิมพ์วันที่บนเกียรติบัตรโดยไม่พึ่ง ICU ของเครื่องที่รัน */
const THAI_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

/** แปลงวันที่จากฐานข้อมูลเป็นรูปแบบไทย พ.ศ. — คืน null เมื่อค่าที่ได้ไม่ใช่วันที่ */
function thaiDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

/**
 * จอสุดท้าย "เปิดตัวบริษัท" (จอที่ 6 ในภาพต้นแบบ)
 *
 * ## จบในจอเดียว (UX-1 ข้อ 1)
 *
 * ของเดิมหน้านี้สูงเกือบ 3 เท่าของจอ รอบนี้เหลือเฉพาะของที่ต้องเห็นทันที
 * (โดมแสดงความยินดี · ตัวเลขสองตัว · สถานะเกียรติบัตร · ปุ่มเดียวที่ต้องกดต่อ)
 * ของยาวทั้งหมดย้ายไปอยู่ใน **แผ่นเลื่อนขึ้นจากด้านล่าง** ซึ่งกติกาอนุญาตให้เลื่อนข้างในได้
 *  - รายละเอียดใบประกาศ / สิ่งที่ยังเหลือ → แผ่น `sheet-cert`
 *  - ตารางคะแนน 3 แหล่ง (จุดประสงค์ข้อ 6) → แผ่น `sheet-scores`
 *  - เทียบกับเป้าที่ตั้งไว้ → แผ่น `sheet-goal`
 *  - ลิงก์ปลายทางอื่น ๆ → แผ่น `sheet-more`
 *
 * ## บอกทาง (กฎเจ้าของ)
 *
 * บรรทัด "ตอนนี้ต้องทำอะไร" พูดผ่านโดมติดกับปุ่มหลัก และแถบขั้นตอนบอกว่าอยู่ท้ายคาบแล้ว
 * สถานะ "รอครูยืนยัน" ต้องบอกด้วยว่าระหว่างรอทำอะไรได้ ไม่ใช่ปล่อยให้นั่งมองจอ
 *
 * ⚠️ กติกาใหม่ (มติ T40 · สเปกข้อ 2.3): ใบประกาศออกให้เมื่อ **ครูยืนยันแล้วว่าได้ระดับ 3 ครบทั้ง 4 ด้าน**
 *    **ห้ามใช้คำว่าตก/ไม่ผ่านเด็ดขาด** ต้องบอกว่าเหลือด้านไหนและทำอะไรต่อ
 *    เงื่อนไขจริงตัดสินที่ `/api/certificate` หน้านี้แค่แสดงผล เดา URL ก็ไม่ได้ใบ
 */
export default async function ResultPage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate />

  const [student, shop, self, data, standing, postGate, profileRow, submissions] = await Promise.all([
    getStudent(session.studentId),
    loadShopProfile(session.studentId),
    loadSelfProfileDb(session.studentId),
    lessonSummary(session.studentId),
    certificateEligibility(session.studentId),
    posttestGate(session.studentId),
    getProfile(session.studentId),
    listSubmissions(session.studentId).catch(() => []),
  ])
  /**
   * ชื่อเว็บบนใบประกาศยึดตาม "ใบเสนอ CEO" ที่ส่งจริงก่อน (มี emphasis_criterion) ไม่มีจึงใช้ชื่อจากหน้าตั้งค่าร้าน
   * ให้ตรงกับ PDF จาก /api/certificate
   */
  const proposal = submissions.find((row) => row.emphasis_criterion !== null) ?? null
  const certDomain = proposal?.domain_name?.trim()
    ? `${proposal.domain_name.trim()}${(proposal.tld ?? '').trim()}`
    : (shop?.domainName ?? '')
  // ลิงก์แบบทดสอบหลังเรียนโผล่เฉพาะตอนครูกดเปิดแล้วและยังไม่เคยทำ (ทำได้ครั้งเดียว)
  const showPosttest = postGate.open && (profileRow?.post_test_score ?? null) === null

  const nickname = student?.nickname ?? 'ยังไม่มีข้อมูล'
  const shopName = shop?.shopName?.trim() ? shop.shopName : 'ยังไม่ได้ตั้งชื่อร้าน'
  const goalStars = data.goalStars ?? 0
  const compare = data.outcome ? goalCompareCard(data.outcome) : null
  const weakTopic =
    self.weakObjectives
      .map((id) => selfProfile.objectives.find((o) => o.id === id)?.shortName)
      .find((name): name is string => Boolean(name)) ?? null

  const values = {
    nickname,
    goalName: data.goalName ?? '',
    goalStars,
    earnedStars: data.totalStars,
    missingStars: Math.max(goalStars - data.totalStars, 0),
    extraStars: Math.max(data.totalStars - goalStars, 0),
    weakTopic: weakTopic ?? '',
  }

  const earned = standing.eligible
  const joinedOn = thaiDate(student?.created_at)
  // วันที่ออกใบ = วันที่เปิดหน้านี้ (หน้า force-dynamic จึงเป็นวันจริงเสมอ ไม่ใช่วันที่ build)
  const issuedOn = thaiDate(new Date().toISOString())

  /** หัวข้อสั้นบนการ์ดสถานะ — ต้องอ่านปราดเดียวรู้ว่าตัวเองอยู่สถานะไหน */
  const statusTitle = earned
    ? 'ได้เกียรติบัตรแล้ว'
    : standing.status === 'not-submitted'
      ? 'ยังไม่ได้ส่งใบเสนอ'
      : standing.status === 'pending-teacher'
        ? 'ส่งแล้ว รอครูตรวจ'
        : `ครูยืนยันแล้ว ${standing.passedCount} จาก ${standing.totalCount} ด้าน`

  /** บรรทัดเดียวที่บอกว่าตอนนี้ต้องทำอะไร — รวมถึงตอนต้องรอ ต้องบอกว่าระหว่างรอทำอะไรได้ */
  const nowLine = earned
    ? 'เยี่ยมมากครับ กดปุ่มด้านล่างโหลดใบประกาศเก็บไว้ได้เลย'
    : standing.status === 'not-submitted'
      ? 'ยังเหลือขั้นสุดท้าย ส่งใบเสนอชื่อเว็บที่ด่านบอสก่อนครับ'
      : standing.status === 'pending-teacher'
        ? 'ส่งแล้วครับ รอครูตรวจสักครู่ · ระหว่างรอ ให้คะแนนตัวเองในแผ่น "คะแนน 3 แหล่ง" ได้เลย'
        : 'ครูตรวจแล้วครับ เปิดดูว่าเหลือด้านไหน แล้วแก้ตามที่เขียนไว้ได้เลย'

  return (
    <AppShell
      fit
      className="student-world student-display media-shell result-world"
      header={
        <AppHeader className="pb-2" backHref="/home">
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-title-sm font-extrabold text-ink">
              เปิดตัวบริษัทของ {nickname}
            </h1>
            <p className="shrink-0 rounded-full bg-reward-100 px-3 py-1 text-label font-extrabold text-reward-700 tabular-nums">
              <StarIcon width={16} height={16} aria-hidden className="mr-1 inline align-[-3px]" />
              {data.totalStars}
              <span className="sr-only">ดาวสะสมจากทั้งหมด {data.maxStars} ดวง</span>
            </p>
          </div>
          {/* แถบขั้นตอน — จอนี้คือขั้นสุดท้ายของคาบ ทุกขีดเต็มหมด ยกเว้นขีดสุดท้ายที่รอใบประกาศ */}
          <div className="mt-2 flex items-center gap-1" aria-hidden="true">
            <span className="h-2 flex-1 rounded-full bg-quest-500" />
            <span className="h-2 flex-1 rounded-full bg-quest-500" />
            <span className={`h-2 flex-[2] rounded-full ${earned ? 'bg-quest-500' : 'bg-brand-600'}`} />
          </div>
          <p className="mt-1 text-note font-bold text-ink-muted">
            <span className="text-brand-700">ขั้นสุดท้ายของคาบ</span>
            {earned ? ' · จบครบทุกขั้นแล้ว' : ' · เหลืออีก 1 ขั้นคือรับใบประกาศ'}
          </p>
        </AppHeader>
      }
      footer={
        <>
          <AppFooter divider={false} className="pb-2">
            <div className="mb-2 flex items-center gap-2">
              <DomeAvatar mood="celebrate" size={44} decorative />
              <SpeechBubble speaker="dome" tail="left" className="min-w-0 flex-1 px-3 py-2">
                <span className="break-words text-label font-bold text-ink">{nowLine}</span>
              </SpeechBubble>
            </div>
            {earned ? (
              <a href="/api/certificate" className="btn-confirm">
                <DownloadIcon width={22} height={22} aria-hidden />
                โหลดใบประกาศ (PDF)
              </a>
            ) : (
              <Link href={standing.nextHref} className="btn-go">
                {standing.nextLabel}
                <ChevronRightIcon width={22} height={22} aria-hidden />
              </Link>
            )}
          </AppFooter>
          <BottomNav />
        </>
      }
    >
      <div className="relative isolate flex h-full min-h-0 flex-col gap-2 scene-sky px-4 pt-2 pb-1">
        <SceneDecor density="light" />
        {/* ตัวเลขสองตัวที่ต้องอ่านได้จากไกล — ดาวที่เก็บได้ และด้านที่ครูยืนยัน
            ⚠️ ช่องขวาไม่โชว์ "0 จาก 4" ตอนครูยังไม่ตรวจ เลขศูนย์ตรงนั้นอ่านเป็น "ทำไม่ได้เลย" */}
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <div className="result-stat-card game-card rounded-2xl bg-surface-raised p-3 text-center shadow-soft-1">
            <p className="text-title font-black text-quest-700 tabular-nums">
              {data.totalStars}
              <span className="text-body-lg font-extrabold text-ink-muted"> / {data.maxStars}</span>
            </p>
            <p className="text-note font-bold text-ink-muted">ดาวที่เก็บได้</p>
          </div>
          <div className="result-stat-card game-card rounded-2xl bg-surface-raised p-3 text-center shadow-soft-1">
            {standing.status === 'not-submitted' || standing.status === 'pending-teacher' ? (
              <>
                <p className="text-title font-black text-ink-subtle">—</p>
                <p className="text-note font-bold text-ink-muted">
                  {standing.status === 'not-submitted' ? 'ยังไม่ได้ส่งใบเสนอ' : 'รอครูตรวจ'}
                </p>
              </>
            ) : (
              <>
                <p className="text-title font-black text-brand-700 tabular-nums">
                  {standing.passedCount}
                  <span className="text-body-lg font-extrabold text-ink-muted"> / {standing.totalCount}</span>
                </p>
                <p className="text-note font-bold text-ink-muted">ด้านที่ครูยืนยัน</p>
              </>
            )}
          </div>
        </div>

        {/* การ์ดสถานะเกียรติบัตร — พระเอกของจอ กินพื้นที่ที่เหลือทั้งหมด */}
        <div
          className={`result-status-card game-card flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl px-4 py-3 text-center shadow-soft-2 ${
            earned ? 'bg-reward-100 ring-1 ring-reward-300 ring-inset' : 'bg-surface-raised'
          }`}
        >
          <AchievementBadge
            size={104}
            earned={earned}
            className={earned ? 'animate-pop-in motion-reduce:animate-none' : undefined}
          />
          <p className="mt-2 text-title-sm font-black text-balance text-ink">{statusTitle}</p>
          <p className="mt-0.5 line-clamp-2 text-label text-pretty text-ink-muted">{standing.message}</p>
          {earned ? null : (
            <div className="mt-2 w-full max-w-[18rem]">
              <ProgressBar
                value={standing.passedCount}
                max={standing.totalCount}
                label={`ครูยืนยันแล้ว ${standing.passedCount} จาก ${standing.totalCount} ด้าน`}
                hideLabel
                tone="quest"
              />
            </div>
          )}
        </div>

        {/* แถวชิป — ของยาวทั้งหมดอยู่หลังชิปพวกนี้ กดแล้วแผ่นเลื่อนขึ้นมา */}
        <nav aria-label="รายละเอียดเพิ่มเติม" className="chip-row shrink-0 justify-center">
          <Sheet
            id="sheet-cert"
            triggerVariant="chip"
            triggerIcon={<RewardIcon width={18} height={18} aria-hidden />}
            trigger="ใบประกาศ"
            title={earned ? 'เกียรติบัตรของฉัน' : 'สิ่งที่ยังเหลืออยู่'}
          >
            {earned ? (
              <div className="rounded-xl bg-surface-sunken px-4 py-5 text-center ring-2 ring-reward-300 ring-inset">
                <p className="text-label text-ink-muted">มอบให้</p>
                <p className="mt-1 text-title font-extrabold text-balance text-ink">{nickname}</p>
                <p className="mt-4 text-label text-ink-muted">เจ้าของร้าน</p>
                <p className="text-body-lg font-bold text-balance text-ink">{shopName}</p>
                {certDomain ? (
                  <p className="mt-1 text-body font-semibold break-all text-brand-700">{certDomain}</p>
                ) : null}
                <p className="mt-4 border-t border-line pt-3 text-label text-ink-muted">
                  ปวช.1 · {PRODUCT_NAME_EN}
                </p>
                {joinedOn ? <p className="text-label text-ink-muted">วันที่เข้าร่วม {joinedOn}</p> : null}
                {issuedOn ? <p className="text-label text-ink-muted">วันที่ออกใบ {issuedOn}</p> : null}
                <p className="mt-4 text-label text-pretty text-ink-muted">
                  ครูยืนยันแล้วว่าทำได้ครบทั้ง 4 ด้าน ส่วนดาวเป็นของใครของมัน ไม่ต้องเอาไปเทียบกับเพื่อน
                </p>
              </div>
            ) : (
              <div>
                <p className="text-body text-pretty text-ink">{standing.message}</p>
                {standing.status === 'keep-going' ? (
                  <ul className="mt-4 flex flex-col gap-3">
                    {standing.missing.map((dim) => (
                      <li key={dim.id} className="rounded-xl bg-surface-sunken p-3 ring-1 ring-line ring-inset">
                        <p className="text-body font-bold text-ink">{dim.name}</p>
                        <p className="mt-1 text-label text-ink-muted">
                          ตอนนี้ครูให้ {dim.score ?? '-'} จาก 3 · ทำแบบนี้แล้วได้ 3 เต็ม
                        </p>
                        <p className="mt-1 text-label text-pretty text-ink">{dim.whatGetsYouThere}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-4 text-label text-pretty text-ink-muted">
                  ดาวที่เก็บได้แล้วไม่หายไปไหน และไม่มีคำว่าสอบตกในภารกิจนี้ กลับมาแก้เมื่อไรก็ได้
                </p>
              </div>
            )}
          </Sheet>

          {/**
           * ตารางคะแนน 3 แหล่ง (จุดประสงค์ข้อ 6)
           * ⚠️ คอมโพเนนต์โหลดข้อมูลเองจาก GET /api/self-assess และสลับโหมดเอง
           * ⚠️ ขึ้นเฉพาะตอนส่งใบเสนอแล้ว เพราะ POST /api/self-assess ตอบ 409 ถ้ายังไม่มีงานให้ประเมิน
           */}
          <Sheet
            id="sheet-scores"
            triggerVariant="chip"
            triggerIcon={<TargetIcon width={18} height={18} aria-hidden />}
            trigger="คะแนน 3 แหล่ง"
            title="คะแนน 3 แหล่ง"
          >
            {data.bigMissionSubmitted ? (
              <SelfAssessPanel />
            ) : (
              <div className="rounded-xl bg-surface-sunken p-4">
                <p className="text-body font-bold text-ink">ยังไม่มีงานให้ประเมินตัวเอง</p>
                <p className="mt-1 text-label text-ink-muted">
                  ส่งใบเสนอชื่อเว็บที่ด่านบอสก่อน แล้วกลับมาให้คะแนนตัวเองรายด้านได้เลย
                </p>
              </div>
            )}
          </Sheet>

          <Sheet
            id="sheet-goal"
            triggerVariant="chip"
            triggerIcon={<KnowledgeIcon width={18} height={18} aria-hidden />}
            trigger="เทียบกับเป้า"
            title="เทียบกับเป้าที่ตั้งไว้"
          >
            {compare ? (
              <div>
                <p className="inline-flex min-h-8 items-center rounded-full bg-brand-100 px-3 text-label font-bold text-brand-700">
                  {compare.badgeLabel}
                </p>
                <p className="mt-3 text-body-lg font-bold text-balance text-ink">
                  {fillTemplate(compare.headline ?? '', values)}
                </p>
                <p className="mt-1 text-body text-pretty text-ink-muted">
                  {fillTemplate(compare.message ?? '', values)}
                </p>
                <p className="mt-4 text-label font-bold text-ink">{compare.focusLabel}</p>
                <p className="text-body text-pretty text-ink-muted">
                  {fillTemplate(compare.focusTemplate ?? '', values)}
                </p>
                <p className="mt-4 text-label font-bold text-ink">{compare.nextStepLabel}</p>
                <p className="text-body text-pretty text-ink-muted">{compare.nextStepText}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-surface-sunken p-4">
                <p className="text-body font-bold text-ink">ยังไม่ได้ตั้งเป้าหมายของตัวเอง</p>
                <p className="mt-1 text-label text-ink-muted">
                  ตั้งเป้าเองว่าอยากได้กี่ดาว แล้วหน้านี้จะเทียบผลจริงกับเป้าให้
                </p>
                <Link href="/profile" className="btn-base mt-3 w-full rounded-xl bg-brand-100 text-label font-bold text-brand-700">
                  ไปตั้งเป้าหมาย
                </Link>
              </div>
            )}
          </Sheet>

          <Sheet
            id="sheet-more"
            triggerVariant="chip"
            triggerIcon={<ExternalLinkIcon width={18} height={18} aria-hidden />}
            trigger="ไปที่อื่น"
            title="ไปที่อื่นต่อ"
          >
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/my-site" className="btn-base w-full rounded-xl bg-brand-600 text-body font-bold text-ink-onbrand">
                  ดูเว็บไซต์ของฉัน
                </Link>
              </li>
              {showPosttest ? (
                <li>
                  <Link href="/posttest" className="btn-base w-full rounded-xl bg-quest-600 text-body font-bold text-ink-onbrand">
                    ทำแบบทดสอบหลังเรียน (ครูเปิดให้แล้ว)
                  </Link>
                </li>
              ) : null}
              <li>
                <Link href="/rewards" className="btn-base w-full rounded-xl bg-surface-sunken text-body font-bold text-brand-700">
                  ดูรางวัลและดาวของฉัน
                </Link>
              </li>
              <li>
                <Link href="/map" className="btn-base w-full rounded-xl bg-surface-sunken text-body font-bold text-brand-700">
                  {reflection.closing.backToMapLabel}
                </Link>
              </li>
            </ul>
            <p className="mt-3 text-label text-pretty text-ink-muted">
              ยังแชร์ออกโซเชียลจากในระบบไม่ได้ในเวอร์ชันนี้ ถ่ายรูปหน้าจอส่งให้ครูได้เลย
            </p>
          </Sheet>
        </nav>
      </div>
    </AppShell>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { SignInGate } from '@/components/student-shell'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import {
  AchievementBadge,
  AlertIcon,
  Card,
  CheckIcon,
  ChevronRightIcon,
  CrownIcon,
  DomeAvatar,
  InfoIcon,
  ProgressBar,
  SceneDecor,
  Sheet,
  SpeechBubble,
  StarIcon,
  StatBadge,
  TargetIcon,
} from '@/components/ui'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { lessonSummary } from '@/components/server/lesson-progress'
import { selfProfile } from '@/components/server/lesson-content'

export const metadata: Metadata = { title: 'รางวัลของฉัน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

const OUTCOME_LABEL = {
  below: 'ยังไม่ถึงเป้าที่ตั้งไว้ ยังเก็บเพิ่มได้',
  met: 'ถึงเป้าที่ตั้งไว้พอดี',
  exceeded: 'เกินเป้าที่ตั้งไว้',
} as const

/**
 * รางวัลของฉัน (แท็บ "รางวัล" ในแถบล่าง)
 *
 * ## จบในจอเดียว + บอกวิธีเก็บดาวเพิ่ม
 *
 * FLOW-1 จับได้ว่าหน้านี้ "ดูอย่างเดียว ไม่บอกว่าเก็บดาวเพิ่มยังไง" และยาวจนต้องเลื่อน
 * รอบนี้จอหลักเหลือ ดาวรวม · ตราภารกิจ · บรรทัดสั่งงานว่าจะเก็บดาวถัดไปจากไหน
 * ส่วนรายละเอียด (เป้าหมายที่ตั้งเอง · ด่านบอส) ย้ายไปอยู่ในแผ่นเลื่อน
 *
 * ดาว เป้าหมาย และสถานะการส่งภารกิจใหญ่ อ่านจาก `lessonSummary()` ทั้งหมด
 * ⚠️ ดาวของภารกิจใหญ่เป็น null โดยตั้งใจ (ครูยังไม่ประเมิน) ห้ามแสดงเป็น 0
 */
export default async function RewardsPage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate />

  const data = await lessonSummary(session.studentId)
  const perMissionMax = selfProfile.starBudget.perMissionMax
  const nothingYet = data.totalStars === 0 && !data.bigMissionSubmitted
  const goalPercent =
    data.goalStars && data.goalStars > 0
      ? Math.min(Math.round((data.totalStars / data.goalStars) * 100), 100)
      : null

  /** ดาวดวงต่อไปหาได้จากไหน — ตอบคำถามที่หน้านี้เคยไม่ตอบ (FLOW-1 ตาราง /rewards) */
  const nextStar = data.missions.find((m) => m.stars < perMissionMax) ?? null
  const nowLine = nextStar
    ? `เก็บดาวเพิ่มได้ที่ภารกิจ "${nextStar.title}" ตอนนี้ได้ ${nextStar.stars} จาก ${perMissionMax} ดวง`
    : data.bigMissionSubmitted
      ? 'ดาวภารกิจย่อยเต็มแล้วครับ ที่เหลือมาจากด่านบอสซึ่งครูเป็นคนยืนยัน'
      : `ดาวภารกิจย่อยเต็มแล้วครับ ส่งใบเสนอที่ด่านบอสได้ดาวเพิ่มอีกสูงสุด ${data.bigMissionMaxStars} ดวง`
  const nextHref = nextStar ? `/mission/${nextStar.id}` : '/ceo'

  return (
    <AppShell
      fit
      header={
        <AppHeader className="pb-2">
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-title-sm font-extrabold text-ink">รางวัลของฉัน</h1>
            <span className="shrink-0 rounded-full bg-reward-100 px-3 py-1 text-note font-bold text-reward-700">
              ดาวเป็นของเราคนเดียว
            </span>
          </div>
        </AppHeader>
      }
      footer={
        <>
          <AppFooter divider={false} className="pb-2">
            <div className="mb-2 flex items-center gap-2">
              <DomeAvatar mood={nothingYet ? 'cheer' : 'happy'} size={44} decorative />
              <SpeechBubble speaker="dome" tail="left" className="min-w-0 flex-1 px-3 py-2">
                <span className="line-clamp-2 text-label font-bold text-ink">{nowLine}</span>
              </SpeechBubble>
            </div>
            <Link href={nextHref} className="btn-go">
              {nextStar ? 'ไปเก็บดาวต่อ' : 'ไปด่านบอส CEO'}
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
          <BottomNav />
        </>
      }
    >
      <div className="relative isolate flex h-full min-h-0 flex-col gap-2 scene-sky px-4 pt-2 pb-1">
        <SceneDecor density="light" />
        {/* ดาวรวมทั้งคาบ — ตัวเลขที่ต้องอ่านได้ในแวบเดียว */}
        <div className="shrink-0 rounded-2xl bg-reward-100 px-4 py-3 text-center shadow-soft-2">
          <p className="text-note font-bold text-reward-700">ดาวที่เก็บได้ทั้งคาบ</p>
          <p className="text-title font-black text-ink tabular-nums">
            <StarIcon width={26} height={26} aria-hidden className="mr-1 inline align-[-4px]" />
            {data.totalStars}
            <span className="text-body-lg font-extrabold text-ink-muted"> / {data.maxStars}</span>
          </p>
          <div className="mt-1.5">
            <ProgressBar
              value={data.totalStars}
              max={data.maxStars}
              label="ดาวที่เก็บได้จากดาวทั้งหมด"
              hideLabel
              tone="quest"
            />
          </div>
        </div>

        {/* ตราภารกิจ — กินพื้นที่ที่เหลือ หนึ่งช่องต่อหนึ่งภารกิจ */}
        {data.missions.length === 0 ? (
          <div className="my-auto rounded-2xl bg-surface-raised p-5 text-center shadow-soft-1">
            <p className="text-body font-bold text-ink">ยังไม่มีภารกิจในห้องนี้</p>
            <p className="mt-1 text-label text-ink-muted">
              ครูยังไม่เปิดภารกิจของคาบนี้ เปิดเมื่อไรตราภารกิจจะมาโผล่ตรงนี้เอง
            </p>
          </div>
        ) : (
          <ul className="grid min-h-0 flex-1 grid-cols-2 gap-2">
            {data.missions.map((mission) => (
              <li key={mission.id} className="min-h-0">
                <div
                  className={`flex h-full min-h-0 flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center shadow-soft-1 ${
                    mission.passed ? 'bg-reward-100' : 'bg-surface-raised'
                  }`}
                >
                  <AchievementBadge size={56} earned={mission.passed} />
                  <p className="line-clamp-2 text-note font-extrabold text-ink">{mission.title}</p>
                  <p className="flex items-center gap-1 text-note font-bold text-reward-700 tabular-nums">
                    <StarIcon width={14} height={14} aria-hidden />
                    {mission.stars}/{perMissionMax}
                    <span className="sr-only">
                      {mission.passed ? 'ผ่านแล้ว' : mission.attempts > 0 ? 'ยังทำอยู่' : 'ยังไม่เริ่ม'}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <nav aria-label="รายละเอียดเพิ่มเติม" className="chip-row shrink-0 justify-center">
          <Sheet
            id="sheet-goal"
            triggerVariant="chip"
            triggerIcon={<TargetIcon width={18} height={18} aria-hidden />}
            trigger="เป้าที่ตั้งเอง"
            title="เป้าหมายที่ตั้งเอง"
          >
            {data.goalName && data.goalStars !== null ? (
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-bold text-ink">{data.goalName}</span>
                  <StatBadge
                    kind="count"
                    value={`เป้า ${data.goalStars} ดาว`}
                    label="เป้าหมายดาวที่ตั้งเอง"
                    hideLabel
                    size="sm"
                  />
                </div>
                {goalPercent !== null ? (
                  <ProgressBar
                    className="mt-3"
                    value={goalPercent}
                    label="ความคืบหน้าเทียบเป้าหมายที่ตั้งเอง"
                    hideLabel
                    tone="brand"
                  />
                ) : null}
                <p className="mt-3 flex items-start gap-2 text-label font-semibold text-ink">
                  {data.outcome === null ? (
                    <InfoIcon width={20} height={20} aria-hidden className="shrink-0 text-ink-subtle" />
                  ) : data.outcome === 'below' ? (
                    <AlertIcon width={20} height={20} aria-hidden className="shrink-0 text-spark-600" />
                  ) : (
                    <CheckIcon width={20} height={20} aria-hidden className="shrink-0 text-quest-600" />
                  )}
                  <span>{data.outcome ? OUTCOME_LABEL[data.outcome] : 'ยังไม่มีข้อมูล'}</span>
                </p>
              </Card>
            ) : (
              <div className="rounded-xl bg-surface-sunken p-4">
                <p className="text-body font-bold text-ink">ยังไม่ได้ตั้งเป้าหมาย</p>
                <p className="mt-1 text-label text-ink-muted">
                  ตั้งเองว่าคาบนี้อยากได้กี่ดาว แล้วกลับมาดูความคืบหน้าตรงนี้
                </p>
                <Link href="/profile" className="btn-base mt-3 w-full rounded-xl bg-brand-100 text-label font-bold text-brand-700">
                  ไปตั้งเป้าหมายของตัวเอง
                </Link>
              </div>
            )}
          </Sheet>

          <Sheet
            id="sheet-boss"
            triggerVariant="chip"
            triggerIcon={<CrownIcon width={18} height={18} aria-hidden />}
            trigger="ด่านบอส"
            title="ด่านบอส CEO"
            triggerClassName="bg-reward-100 text-reward-700 hover:bg-reward-300"
          >
            <Card tone={data.bigMissionSubmitted ? 'quest' : 'spark'}>
              <div className="flex items-start gap-3">
                <AchievementBadge size={64} earned={data.bigMissionSubmitted} />
                <div className="min-w-0 flex-1">
                  <p className="text-body font-bold text-ink">
                    {data.bigMissionSubmitted ? 'ส่งงานให้ครูแล้ว' : 'ยังไม่ได้ส่งงานนำเสนอ'}
                  </p>
                  <StatBadge
                    className="mt-2"
                    kind="star"
                    value={data.bigMissionStars}
                    max={data.bigMissionMaxStars}
                    label="ดาวด่านบอส CEO"
                    hideLabel
                    size="sm"
                  />
                  <p className="mt-2 text-label text-pretty text-ink-muted">
                    {!data.bigMissionSubmitted
                      ? `ส่งงานแล้วได้ดาวทันทีสูงสุด ${data.bigMissionMaxStars} ดวง`
                      : data.bigMissionPendingTeacher
                        ? `ได้ ${data.bigMissionStars} ดาวจากคะแนนที่ระบบเสนอ · รอครูยืนยัน ครูปรับขึ้นลงได้`
                        : `ได้ ${data.bigMissionStars} ดาว · ครูยืนยันคะแนนแล้ว`}
                  </p>
                </div>
              </div>
              <Link href="/ceo" className="btn-base mt-4 w-full rounded-xl bg-brand-600 text-body font-bold text-ink-onbrand">
                {data.bigMissionSubmitted ? 'ดูงานที่ส่งไป' : 'ไปด่านบอส CEO'}
                <ChevronRightIcon width={20} height={20} aria-hidden />
              </Link>
            </Card>
          </Sheet>

          <Link
            href="/result"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-100 px-3 text-label font-bold text-brand-700 hover:bg-brand-200 focus-ring"
          >
            <CheckIcon width={18} height={18} aria-hidden />
            เกียรติบัตร
          </Link>
        </nav>
      </div>
    </AppShell>
  )
}

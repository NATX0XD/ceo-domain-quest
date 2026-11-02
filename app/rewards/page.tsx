import type { Metadata } from 'next'
import Link from 'next/link'
import './rewards.css'
import { SignInGate } from '@/components/student-shell'
import { AppHeader, AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import {
  AlertIcon,
  Card,
  CheckIcon,
  ChevronRightIcon,
  InfoIcon,
  ProgressBar,
  SceneDecor,
  Sheet,
  StarIcon,
  StatBadge,
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

/** ห้องถ้วยรางวัล — ใช้ข้อมูล progress เดิม แต่จัดลำดับให้เห็นดาวและเหรียญในจอเดียว */
export default async function RewardsPage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate />

  const data = await lessonSummary(session.studentId)
  const perMissionMax = selfProfile.starBudget.perMissionMax
  const goalPercent =
    data.goalStars && data.goalStars > 0
      ? Math.min(Math.round((data.totalStars / data.goalStars) * 100), 100)
      : null
  const nextStar = data.missions.find((m) => m.stars < perMissionMax) ?? null
  const nextHref = nextStar ? `/mission/${nextStar.id}` : '/ceo'
  const starPercent = data.maxStars > 0 ? Math.min(100, (data.totalStars / data.maxStars) * 100) : 0
  /** หมุดดาวทุก 3 ดวง = ดาวเต็มของ 1 ภารกิจ (ไม่วางที่ปลายราง) */
  const starTicks: number[] = []
  for (let at = perMissionMax; perMissionMax > 0 && at < data.maxStars; at += perMissionMax) starTicks.push(at)

  return (
    <AppShell
      fit
      className="student-world student-display media-shell rewards-world"
      header={
        <AppHeader className="rw-header" divider={false}>
          {/* หัวหน้าแท็บหลักมีแค่ป้ายไม้ชื่อหน้า + ชิปดาวข้างป้าย */}
          <div className="rw-header-row">
            <h1>ห้องถ้วยรางวัล</h1>
            <span className="rw-star-pill"><StarIcon width={17} height={17} aria-hidden />{data.totalStars}</span>
          </div>
        </AppHeader>
      }
      footer={<BottomNav />}
    >
      <div className="rw-main">
        <SceneDecor density="light" />

        <section className="rw-star-meter" aria-label={`ดาวสะสม ${data.totalStars} จาก ${data.maxStars} ดวง`}>
          <div className="rw-meter-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div className="rw-meter-top">
            <div>
              <span className="rw-section-kicker">พลังดาว</span>
              <h2>ดาวสะสมของฉัน</h2>
            </div>
            <div className="rw-meter-total">
              <StarIcon width={30} height={30} aria-hidden />
              <strong>{data.totalStars}</strong>
              <span>/ {data.maxStars}</span>
            </div>
          </div>
          {/* มาตรดาวแบบเกม: รางหนาขอบน้ำตาล ไส้ทองวาว มีหมุดดาวทุก 3 ดวง (1 ภารกิจ) */}
          <div
            className="rw-gauge"
            role="progressbar"
            aria-label="ดาวที่เก็บได้จากดาวทั้งหมด"
            aria-valuemin={0}
            aria-valuemax={data.maxStars}
            aria-valuenow={data.totalStars}
          >
            <span
              className={`rw-gauge-fill${data.totalStars > 0 ? '' : ' is-empty'}`}
              style={{ width: `${starPercent}%` }}
            />
            {starTicks.map((at) => (
              <span
                key={at}
                className={`rw-gauge-tick${data.totalStars >= at ? ' is-lit' : ''}`}
                style={{ left: `${(at / data.maxStars) * 100}%` }}
                aria-hidden="true"
              >
                <StarIcon width={13} height={13} filled={data.totalStars >= at} />
              </span>
            ))}
          </div>
          <div className="rw-meter-foot">
            <p className="rw-meter-note">{data.totalStars >= data.maxStars ? 'เต็มหีบแล้ว ทุกด่านส่องแสงเลย' : `อีก ${Math.max(0, data.maxStars - data.totalStars)} ดวง จะเต็มหีบดาว`}</p>
            <Link href={nextHref} className="rw-meter-cta">
              {nextStar ? 'ไปเก็บดาวต่อ' : 'ไปด่านบอส'}
              <ChevronRightIcon width={16} height={16} aria-hidden />
            </Link>
          </div>
        </section>

        <div className="rw-medal-heading">
          <h2>เหรียญประจำภารกิจ</h2>
          <span className="rw-medal-count">{data.missions.filter((mission) => mission.passed).length}/{data.missions.length} ผ่านแล้ว</span>
        </div>

        {data.missions.length === 0 ? (
          <div className="rw-empty-state"><p>ยังไม่มีเหรียญในหีบ</p><span>ครูยังไม่เปิดภารกิจของคาบนี้ เปิดเมื่อไรเหรียญจะมาอยู่ตรงนี้เอง</span></div>
        ) : (
          <ul className="rw-medal-grid">
            {data.missions.map((mission, index) => {
              // เหรียญทองต้องมีดาวจริง ผ่านแบบ 0 ดาว (ครูข้ามให้) แสดงสถานะกลาง ไม่ใช่ทอง
              const earned = mission.passed && mission.stars > 0
              const passedNoStars = mission.passed && mission.stars <= 0
              return (
              <li key={mission.id}>
                <div className={`rw-medal-card ${earned ? 'is-earned' : passedNoStars ? 'is-passed' : 'is-locked'}`}>
                  <span className="rw-medal-number">0{index + 1}</span>
                  <div className="rw-medal-visual">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/ui/rewards/mission-medal.webp" alt={earned ? `เหรียญภารกิจ ${mission.title} ที่ได้รับแล้ว` : passedNoStars ? `ภารกิจ ${mission.title} ผ่านแล้ว (ครูข้ามให้)` : `เหรียญภารกิจ ${mission.title} ที่ยังล็อกอยู่`} width={118} height={108} draggable={false} />
                    {!mission.passed ? <span className="rw-lock-mark" aria-hidden="true">ล็อก</span> : passedNoStars ? <span className="rw-lock-mark is-pass">ผ่าน (ครูข้ามให้)</span> : null}
                  </div>
                  <p className="rw-medal-title">{mission.title}</p>
                  <p className="rw-medal-stars"><StarIcon width={14} height={14} aria-hidden />{mission.stars}/{perMissionMax}</p>
                </div>
              </li>
              )
            })}
          </ul>
        )}

        <nav aria-label="ของสะสมเพิ่มเติม" className="rw-chip-row">
          <Sheet
            id="sheet-goal"
            triggerVariant="chip"
            triggerIcon={<span className="rw-chip-art"><img src="/ui/rewards/goal-plaque.webp" alt="" width={42} height={30} /></span>}
            trigger="เป้าที่ตั้งเอง"
            title="เป้าหมายที่ตั้งเอง"
            triggerClassName="rw-chip rw-chip-goal"
          >
            {data.goalName && data.goalStars !== null ? (
              <Card className="rw-sheet-card">
                <div className="rw-sheet-card-head"><img src="/ui/rewards/goal-plaque.webp" alt="" width={96} height={64} /><div><p className="text-body font-bold text-ink">{data.goalName}</p><StatBadge className="mt-1" kind="count" value={`เป้า ${data.goalStars} ดาว`} label="เป้าหมายดาวที่ตั้งเอง" hideLabel size="sm" /></div></div>
                {goalPercent !== null ? <ProgressBar className="mt-3" value={goalPercent} label="ความคืบหน้าเทียบเป้าหมายที่ตั้งเอง" hideLabel tone="brand" /> : null}
                <p className="mt-3 flex items-start gap-2 text-label font-semibold text-ink">
                  {data.outcome === null ? <InfoIcon width={20} height={20} aria-hidden className="shrink-0 text-ink-subtle" /> : data.outcome === 'below' ? <AlertIcon width={20} height={20} aria-hidden className="shrink-0 text-spark-600" /> : <CheckIcon width={20} height={20} aria-hidden className="shrink-0 text-quest-600" />}
                  <span>{data.outcome ? OUTCOME_LABEL[data.outcome] : 'ยังไม่มีข้อมูล'}</span>
                </p>
              </Card>
            ) : (
              <div className="rw-sheet-empty"><p>ยังไม่ได้ตั้งเป้าหมาย</p><span>ตั้งเองว่าคาบนี้อยากได้กี่ดาว แล้วกลับมาดูความคืบหน้าตรงนี้</span><Link href="/profile" className="btn-base mt-3 w-full rounded-xl bg-brand-100 text-label font-bold text-brand-700">ไปตั้งเป้าหมายของตัวเอง</Link></div>
            )}
          </Sheet>

          <Sheet
            id="sheet-boss"
            triggerVariant="chip"
            triggerIcon={<span className="rw-chip-art"><img src="/ui/rewards/boss-plaque.webp" alt="" width={42} height={30} /></span>}
            trigger="ด่านบอส"
            title="ด่านบอส CEO"
            triggerClassName="rw-chip rw-chip-boss"
          >
            <Card tone={data.bigMissionSubmitted ? 'quest' : 'spark'} className="rw-sheet-card">
              <div className="rw-sheet-card-head"><img className={data.bigMissionSubmitted ? '' : 'is-dimmed'} src="/ui/rewards/boss-plaque.webp" alt={data.bigMissionSubmitted ? 'ป้ายด่านบอสที่ส่งงานแล้ว' : 'ป้ายด่านบอสที่ยังล็อกอยู่'} width={96} height={72} /><div className="min-w-0 flex-1"><p className="text-body font-bold text-ink">{data.bigMissionSubmitted ? 'ส่งงานให้ครูแล้ว' : 'ยังไม่ได้ส่งงานนำเสนอ'}</p><StatBadge className="mt-2" kind="star" value={data.bigMissionStars} max={data.bigMissionMaxStars} label="ดาวด่านบอส CEO" hideLabel size="sm" /><p className="mt-2 text-label text-pretty text-ink-muted">{!data.bigMissionSubmitted ? `ส่งงานแล้วได้ดาวทันทีสูงสุด ${data.bigMissionMaxStars} ดวง` : data.bigMissionPendingTeacher ? `ได้ ${data.bigMissionStars} ดาวจากคะแนนที่ระบบเสนอ · รอครูยืนยัน ครูปรับขึ้นลงได้` : `ได้ ${data.bigMissionStars} ดาว · ครูยืนยันคะแนนแล้ว`}</p></div></div>
              <Link href="/ceo" className="btn-base mt-4 w-full rounded-xl bg-brand-600 text-body font-bold text-ink-onbrand">{data.bigMissionSubmitted ? 'ดูงานที่ส่งไป' : 'ไปด่านบอส CEO'}<ChevronRightIcon width={20} height={20} aria-hidden /></Link>
            </Card>
          </Sheet>

          <Link href="/result" className="rw-chip rw-chip-certificate"><span className="rw-chip-art"><img src="/ui/rewards/certificate-plaque.webp" alt="" width={42} height={30} /></span>เกียรติบัตร</Link>
        </nav>
      </div>
    </AppShell>
  )
}

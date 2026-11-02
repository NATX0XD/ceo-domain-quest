import type { Metadata } from 'next'
import Link from 'next/link'
import './home.css'
import { getStudent } from '@/lib/db/repo'
import { shopStageFromCleared } from '@/components/shop-stages'
import { SignInGate } from '@/components/student-shell'
import { SessionClock } from '@/components/session-clock'
import { BottomNav } from '@/components/bottom-nav'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { ChevronRightIcon, DomeAvatar, SpeechBubble, StarIcon } from '@/components/ui'
import { lessonSummary } from '@/components/server/lesson-progress'
import { certificateEligibility } from '@/components/server/certificate-eligibility'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { TestNudgeCard } from '@/components/test-nudge'
import { loadTestNudge } from '@/components/server/test-nudge'
import { requireShopProfile } from '@/components/server/shop-gate'

export const metadata: Metadata = { title: 'หน้าหลัก — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

const BUSINESS_TYPE_LABEL: Record<string, string> = {
  bakery: 'ร้านเบเกอรี่',
  clothes: 'ร้านเสื้อผ้า',
  coffee: 'ร้านกาแฟ',
  secondhand: 'ร้านมือสอง',
  'phone-repair': 'ร้านซ่อมมือถือ',
  flower: 'ร้านดอกไม้',
  food: 'ร้านอาหาร',
  game: 'ร้านเกม',
}

const PATH_STAGES = ['ภารกิจ 1', 'ภารกิจ 2', 'ภารกิจ 3', 'ภารกิจ 4', 'บอส CEO']

/** Lobby ของนักเรียน — ข้อมูลทั้งหมดอ่านจาก session/profile/progress เดิม เพียงจัดวางใหม่ให้เป็นโลกเกม */
export default async function HomePage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate />

  const [student, profile, summary, standing] = await Promise.all([
    getStudent(session.studentId),
    requireShopProfile(session.studentId),
    lessonSummary(session.studentId),
    certificateEligibility(session.studentId),
  ])
  const nudge = await loadTestNudge(session.studentId, summary.missions.filter((m) => m.passed).length)

  const nextMission = summary.missions.find((m) => !m.passed)
  const stepTotal = summary.missions.length + 1
  const stepNow = Math.min(stepTotal, (nextMission ? summary.missions.indexOf(nextMission) : summary.missions.length) + 1)
  const stepsLeft = Math.max(0, stepTotal - stepNow)

  const domeLine = nextMission
    ? `ต่อไป: ${nextMission.title}`
    : standing.status === 'not-submitted'
      ? 'ภารกิจย่อยครบแล้ว เหลือด่านบอส CEO'
      : standing.status === 'pending-teacher'
        ? 'ส่งใบเสนอแล้ว รอครูตรวจได้เลย'
        : standing.status === 'keep-going'
          ? `มีงานให้แก้อีก ${standing.missing.length} ด้าน`
          : 'ครบทุกด่านแล้ว ไปรับใบประกาศกัน'

  const primary = nudge && !nudge.waiting
    ? { href: nudge.href, label: nudge.title }
    : nextMission
      ? { href: `/mission/${nextMission.id}`, label: 'ทำภารกิจต่อ' }
      : standing.status === 'not-submitted'
        ? { href: '/ceo', label: 'ไปด่านบอส CEO' }
        : standing.status === 'pending-teacher'
          ? { href: '/ceo', label: 'ดูสถานะงานที่ส่งไป' }
          : standing.status === 'keep-going'
            ? { href: '/ceo', label: standing.nextLabel }
            : { href: '/result', label: 'ดูผลและเกียรติบัตร' }

  const level = shopStageFromCleared(summary.stagesCleared, summary.stagesTotal)
  const shopArtStage = Math.min(5, Math.max(1, level + 1))
  const cleared = Math.min(PATH_STAGES.length, Math.max(0, summary.stagesCleared))
  const activePathStage = Math.min(PATH_STAGES.length - 1, cleared)
  const businessType = BUSINESS_TYPE_LABEL[profile?.businessTypeId ?? ''] ?? 'ร้านค้าของฉัน'
  const nickname = student?.nickname ?? 'นักเรียน'

  return (
    <AppShell
      fit
      className="home-shell"
      mainClassName="home-lobby-main"
      header={
        <AppHeader className="home-header" divider={false}>
          <div className="home-header-row">
            <div className="min-w-0">
              <p className="home-eyebrow">CEO DOMAIN QUEST</p>
              <p className="home-greeting">สวัสดี {nickname}</p>
            </div>
            <div className="home-header-tools">
              <SessionClock variant="pill" />
              <p className="home-star-pill">
                <StarIcon width={19} height={19} aria-hidden />
                {summary.totalStars}
                <span className="sr-only">ดาวสะสมจากทั้งหมด {summary.maxStars} ดวง</span>
              </p>
            </div>
          </div>
          <p className="home-header-progress">
            <span>{`ขั้นที่ ${stepNow} จาก ${stepTotal}`}</span>
            {stepsLeft > 0 ? ` · เหลืออีก ${stepsLeft} ขั้น` : ' · ครบทุกขั้นแล้ว'}
          </p>
        </AppHeader>
      }
      footer={
        <>
          <AppFooter divider={false} className="home-cta-footer">
            <Link href={primary.href} className="home-primary-cta">
              <span className="home-primary-cta-copy">
                <span className="home-primary-cta-kicker">ภารกิจถัดไป</span>
                <span>{primary.label}</span>
              </span>
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
          <BottomNav />
        </>
      }
    >
      <div className="home-lobby">
        <section className="home-shop-card" aria-labelledby="home-shop-title">
          <div className="home-shop-heading">
            <div className="min-w-0">
              <p className="home-section-kicker">เกาะของฉัน</p>
              <h1 id="home-shop-title">ร้านกำลังโต</h1>
            </div>
            <span className="home-level-badge">เลเวล {shopArtStage}/5</span>
          </div>

          <div className="home-shop-scene">
            <span className="home-cloud home-cloud-one" aria-hidden="true" />
            <span className="home-cloud home-cloud-two" aria-hidden="true" />
            <span className="home-spark home-spark-one" aria-hidden="true">✦</span>
            <img
              src={`/ui/home/shop-stage-${shopArtStage}.webp`}
              alt={`ภาพร้านของฉัน ระดับ ${shopArtStage} จาก 5`}
              className="home-shop-art"
              draggable={false}
            />
          </div>

          <div className="home-shop-sign">
            <span className="home-shop-sign-type">{businessType}</span>
            <strong>{profile?.shopName ?? 'ยังไม่ได้ตั้งชื่อร้าน'}</strong>
          </div>
        </section>

        <section className="home-path-card" aria-labelledby="home-path-title">
          <div className="home-path-heading">
            <div>
              <p className="home-section-kicker">เส้นทางเติบโต</p>
              <h2 id="home-path-title">ปลดล็อกเกาะถัดไป</h2>
            </div>
            <span className="home-path-count">{cleared}/{PATH_STAGES.length}</span>
          </div>
          <ol className="home-path-track">
            {PATH_STAGES.map((label, index) => {
              const done = index < cleared
              const current = index === activePathStage && !done
              return (
                <li key={label} className={done ? 'is-done' : current ? 'is-current' : undefined}>
                  <span className="home-path-node" aria-hidden="true">{done ? '✓' : index === 4 ? '★' : index + 1}</span>
                  <span className="home-path-label">{label}</span>
                </li>
              )
            })}
          </ol>
          <p className="home-path-status">
            {cleared >= PATH_STAGES.length ? 'ร้านเปิดครบทุกด่านแล้ว' : `ผ่านแล้ว ${cleared} ด่าน · ${PATH_STAGES.length - cleared} ด่านที่รออยู่`}
          </p>
        </section>

        {nudge?.waiting ? <TestNudgeCard nudge={nudge} className="home-nudge" /> : null}

        <section className="home-dome-row" aria-label="คำแนะนำจากโดม">
          <DomeAvatar mood={nextMission ? 'cheer' : 'celebrate'} size={64} decorative sparkle />
          <SpeechBubble speaker="dome" tail="left" className="home-dome-bubble">
            <span>{domeLine}</span>
          </SpeechBubble>
        </section>
      </div>
    </AppShell>
  )
}

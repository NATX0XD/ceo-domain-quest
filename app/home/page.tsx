import type { Metadata } from 'next'
import Link from 'next/link'
import { getStudent } from '@/lib/db/repo'
import { ShopStages, businessKindFrom, shopStageFromCleared } from '@/components/shop-stages'
import { SignInGate } from '@/components/student-shell'
import { SessionClock } from '@/components/session-clock'
import { BottomNav } from '@/components/bottom-nav'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { ChevronRightIcon, DomeAvatar, ProgressBar, SpeechBubble, StarIcon } from '@/components/ui'
import { lessonSummary } from '@/components/server/lesson-progress'
import { certificateEligibility } from '@/components/server/certificate-eligibility'
import { loadShopProfile } from '@/components/server/game-state'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'หน้าหลัก — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * หน้าหลักของนักเรียน — จอที่ 3 ในภาพต้นแบบ
 *
 * ## จบในจอเดียว ไม่มีการเลื่อนเลย (UX-1 ข้อ 1)
 *
 * ของเดิมหน้านี้สูง 2,485px บนจอ 844px ต้องไถ 3 หน้าจอถึงจะเห็นครบ
 * รอบนี้ตัดให้เหลือของที่ "ต้องเห็นตอนเปิดแอปมา" อย่างเดียว แล้วใช้ `<AppShell fit>`
 * ซึ่งปิดการเลื่อนของชั้นเนื้อหาไปเลย ถ้าของล้นจะเห็นทันทีตอนวัด ไม่ใช่ซ่อนไว้ใต้แถบเลื่อน
 *
 * **ของที่ย้ายออกจากหน้านี้** (ไม่ได้หายไปไหน มีที่อยู่เดิมของมันอยู่แล้ว)
 *  - รายการภารกิจทั้งหมด → `/map` ซึ่งเป็นหน้าแผนภารกิจโดยเฉพาะ (ปุ่ม "แผนภารกิจ" ในแถวชิป)
 *  - ปุ่มรองหลายปุ่มที่ซ้อนกันเป็นกล่องใหญ่ → ยุบเป็นแถวชิปเล็กที่มีไอคอนสี
 *
 * ## ภาพร้าน
 *
 * เป็นพระเอกของจอนี้ จึงกินพื้นที่ที่เหลือทั้งหมด (`flex-1`) ไม่ใช่กล่องสี่เหลี่ยมตายตัว
 * **ชื่อร้านไม่ได้อยู่ในภาพ** อยู่เป็นข้อความ HTML ใต้ภาพ ตามคำสั่งเจ้าของ
 *
 * ⚠️ ชื่อนักเรียน ชื่อร้าน ประเภทธุรกิจ ดาว และเปอร์เซ็นต์ อ่านจากฐานข้อมูลทั้งหมด ห้ามฝังค่าตัวอย่าง
 */
export default async function HomePage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate />

  const [student, profile, summary, standing] = await Promise.all([
    getStudent(session.studentId),
    loadShopProfile(session.studentId),
    lessonSummary(session.studentId),
    certificateEligibility(session.studentId),
  ])

  const nextMission = summary.missions.find((m) => !m.passed)
  /**
   * ปุ่มหลักในแถบท้าย — พาไปตาม **สถานะจริงของคนนี้** ไม่ใช่ปลายทางตายตัว
   * สถานะมาจาก `certificateEligibility()` ตัวเดียวกับที่หน้า /result ใช้ จะได้ไม่มีกติกาสองชุด
   * ช่วง "รอครูยืนยัน" จงใจไปที่ /ceo ซึ่งหลังส่งงานคือจอสถานะ ไม่ใช่ฟอร์มส่งซ้ำ
   */
  /** ขั้นของคาบที่เด็กเห็น = ภารกิจย่อยทุกอัน + ด่านบอสอีก 1 ขั้น (คำนวณจากข้อมูลจริงเสมอ) */
  const stepTotal = summary.missions.length + 1
  const stepNow = Math.min(stepTotal, (nextMission ? summary.missions.indexOf(nextMission) : summary.missions.length) + 1)
  const stepsLeft = stepTotal - (summary.summary.done + (standing.eligible ? 1 : 0))

  /**
   * ประโยคของโดม — **ต้องตรงกับสถานะจริงเดียวกับปุ่ม** (FLOW-1 ข้อ 1)
   *
   * ของเดิมพูดว่า "ครูกำลังอ่านงานของเราอยู่" ทั้งที่ครูส่งกลับมาให้แก้แล้ว
   * แล้วปุ่มใต้ประโยคเขียนว่า "ไปแก้งานแล้วส่งใหม่" เด็กเลือกเชื่อประโยคแล้วนั่งรอทั้งคาบ
   * รอบนี้ทั้งประโยคและปุ่มอ่านจาก `certificateEligibility()` ตัวเดียวกัน จึงขัดกันไม่ได้อีก
   */
  const domeLine = nextMission
    ? `ต่อไปทำภารกิจ "${nextMission.title}" กดปุ่มด้านล่างได้เลยครับ`
    : standing.status === 'not-submitted'
      ? 'ภารกิจย่อยครบแล้วครับ เหลือด่านบอส ส่งใบเสนอชื่อเว็บเป็นขั้นสุดท้าย'
      : standing.status === 'pending-teacher'
        ? 'ส่งใบเสนอแล้วครับ ครูกำลังอ่านอยู่ · ระหว่างรอ ไปอ่านคลังความรู้ก่อนได้'
        : standing.status === 'keep-going'
          ? `ครูอ่านงานเราแล้วครับ ส่งกลับมาให้แก้ ${standing.missing.length} ด้าน · แก้แล้วส่งใหม่ได้เลย`
          : 'ครูยืนยันครบทุกด้านแล้วครับ ไปรับใบประกาศได้เลย'

  const primary = nextMission
    ? { href: `/mission/${nextMission.id}`, label: 'ทำภารกิจต่อ' }
    : standing.status === 'not-submitted'
      ? { href: '/ceo', label: 'ไปด่านบอส CEO' }
      : standing.status === 'pending-teacher'
        ? { href: '/ceo', label: 'ดูสถานะงานที่ส่งไป' }
        : standing.status === 'keep-going'
          ? { href: '/ceo', label: standing.nextLabel }
          : { href: '/result', label: 'ดูผลและเกียรติบัตร' }

  const level = shopStageFromCleared(summary.stagesCleared, summary.stagesTotal)
  const kind = businessKindFrom(profile?.businessTypeId)
  const nickname = student?.nickname ?? 'นักเรียน'

  return (
    <AppShell
      fit
      header={
        <AppHeader className="pb-2">
          <SessionClock />
          <div className="mt-1 flex items-center gap-3">
            <DomeAvatar mood="greet" size={44} decorative />
            <div className="min-w-0 flex-1">
              <p className="truncate text-title-sm font-extrabold text-ink">{nickname}</p>
            </div>
            <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-reward-100 px-3 py-1.5 text-body font-extrabold text-reward-700 tabular-nums">
              <StarIcon width={20} height={20} aria-hidden />
              {summary.totalStars}
              <span className="sr-only">ดาวสะสมจากทั้งหมด {summary.maxStars} ดวง</span>
            </p>
          </div>
          {/* แถบขั้นตอนของคาบ (FLOW-1 ข้อ 21) — จอที่เด็กอยู่นานที่สุดกลับเป็นจอที่ไม่เคยบอกว่าอยู่ขั้นไหน
              เขียว = ผ่านแล้ว · ม่วงยาว = ขั้นที่อยู่ตอนนี้ · เทา = ยังไม่ถึง (ขีดสุดท้ายคือด่านบอส) */}
          <div className="mt-1.5 flex items-center gap-1" aria-hidden="true">
            {Array.from({ length: stepTotal }, (_, i) => (
              <span
                key={i}
                className={
                  i < stepNow - 1
                    ? 'h-1.5 flex-1 rounded-full bg-quest-500'
                    : i === stepNow - 1
                      ? 'h-1.5 flex-[2] rounded-full bg-brand-600'
                      : 'h-1.5 flex-1 rounded-full bg-line'
                }
              />
            ))}
          </div>
          <p className="mt-1 text-[0.875rem] font-bold text-ink-muted tabular-nums">
            <span className="text-brand-700">{`ขั้นที่ ${stepNow} จาก ${stepTotal}`}</span>
            {stepsLeft > 0 ? ` · เหลืออีก ${stepsLeft} ขั้น` : ' · ครบทุกขั้นแล้ว'}
          </p>
        </AppHeader>
      }
      footer={
        <>
          <AppFooter divider={false} className="pb-2">
            <Link href={primary.href} className="btn-go">
              {primary.label}
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
          {/* แถบเมนูล่างต้องอยู่ในชั้น footer ของ shell — วางนอก AppShell จะถูก body ตัดหาย */}
          <BottomNav />
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2 px-4 pt-2 pb-2">
        {/* ฉากร้าน — พระเอกของจอ กินพื้นที่ที่เหลือทั้งหมด */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-3xl scene-sky shadow-soft-2 ring-1 ring-brand-100 ring-inset">
          <ShopStages level={level} kind={kind} decorative className="h-full" />
        </div>

        {/* ชื่อร้าน + ความคืบหน้า — อยู่นอกภาพเสมอ */}
        <div className="shrink-0 rounded-2xl bg-surface-raised px-4 py-3 shadow-soft-1">
          {/* ตัวเลขเปอร์เซ็นต์อยู่ในแถบความคืบหน้าอยู่แล้ว ไม่พิมพ์ซ้ำอีกที่หัวการ์ด */}
          <p className="min-w-0 truncate text-body-lg font-extrabold text-ink">
            {profile?.shopName ?? 'ยังไม่ได้ตั้งชื่อร้าน'}
          </p>
          <div className="mt-2">
            <ProgressBar
              value={summary.stagesCleared}
              max={summary.stagesTotal}
              label={`ความคืบหน้าการสร้างร้าน: ${summary.shopStageLabel}`}
              hideLabel
              tone="quest"
            />
          </div>
          <p className="mt-1 text-[0.875rem] text-ink-muted">{summary.shopStageLabel}</p>
        </div>

        {/* โดมพูดสั้น ๆ หนึ่งประโยค — ประโยคยาวทำให้จอนี้ล้น */}
        <div className="flex shrink-0 items-center gap-2">
          <DomeAvatar mood={nextMission ? 'cheer' : 'happy'} size={60} decorative sparkle />
          <SpeechBubble speaker="dome" tail="left" className="min-w-0 flex-1 px-4 py-2.5">
            <span className="line-clamp-2 text-label font-bold text-ink">{domeLine}</span>
          </SpeechBubble>
        </div>

      </div>
    </AppShell>
  )
}

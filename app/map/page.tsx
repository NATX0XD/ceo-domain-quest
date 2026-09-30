import type { Metadata } from 'next'
import Link from 'next/link'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import { SignInGate } from '@/components/student-shell'
import {
  BagIcon,
  CheckIcon,
  ChevronRightIcon,
  CrownIcon,
  DomeAvatar,
  GlobeIcon,
  LightbulbIcon,
  LockIcon,
  SceneDecor,
  SpeechBubble,
  StarIcon,
  TargetIcon,
  UsersIcon,
  cn,
} from '@/components/ui'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { lessonSummary } from '@/components/server/lesson-progress'
import { certificateEligibility } from '@/components/server/certificate-eligibility'
import { bigMission, selfProfile } from '@/components/server/lesson-content'

export const metadata: Metadata = { title: 'แผนภารกิจของฉัน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * แผนภารกิจของฉัน — จอที่ 2 ในภาพต้นแบบ
 *
 * ## จบในจอเดียว ไม่มีการเลื่อน (UX-1 ข้อ 1)
 *
 * ของเดิมเป็นการ์ดใหญ่ซ้อนกัน 7 ใบ สูงเกินจอเท่าตัว รอบนี้ยุบเหลือ "หนึ่งแถวต่อหนึ่งภารกิจ"
 * แล้วให้ทุกแถวแบ่งพื้นที่ที่เหลือเท่า ๆ กันด้วย `flex-1` จำนวนภารกิจจึงเปลี่ยนได้
 * โดยหน้าไม่มีวันล้น (ห้องที่มี 3 ภารกิจกับ 6 ภารกิจใช้โค้ดเดียวกัน)
 *
 * **ของที่ย้ายออก** — การ์ดความคืบหน้าใหญ่ยุบเป็นแถบบาง ๆ ในหัวจอ · การ์ดเป้าหมายยุบเป็นชิป
 * · ประโยคของโดมตัดออก (มีอยู่แล้วที่หน้าหลักและหน้าคุยกับโดม)
 *
 * ## สีแยกตามหน้าที่ (UX-1 ข้อ 2)
 *
 * เขียว = ผ่านแล้ว · ม่วง = ขั้นที่ต้องไปต่อ · เหลืองทอง = ดาวกับด่านบอส · เทา = ยังไม่ถึง
 *
 * ⚠️ ทุกตัวเลขมาจาก `lessonSummary(session.studentId)` ซึ่งอ่านฐานข้อมูลจริง
 * ⚠️ ห้ามฝังชื่อภารกิจ จำนวนดาว หรือเปอร์เซ็นต์ตัวอย่างไว้ในไฟล์นี้
 * ⚠️ studentId มาจากคุกกี้เท่านั้น ไม่รับจาก query string
 */

/**
 * ไอคอนประจำภารกิจ — ผูกกับรหัสภารกิจใน `content/missions.json`
 * รหัสที่ไม่รู้จักตกมาที่ไอคอนเป้า จึงไม่มีทางเป็นช่องว่างถ้าเนื้อหาเพิ่มภารกิจใหม่
 */
const MISSION_ICONS: Record<string, typeof TargetIcon> = {
  m1: GlobeIcon,
  m2: LightbulbIcon,
  m3: BagIcon,
  m4: UsersIcon,
}

export default async function MapPage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate message="ใส่รหัสห้องกับ PIN ที่ครูให้ก่อน แล้วแผนภารกิจจะขึ้นมาให้ดูทั้งเส้นทาง" />

  /* สถานะด่านบอสต้องมาจากตัวตัดสินเดียวกับ /home และ /result
     ไม่งั้นงานชิ้นเดียวกันจะพูดคนละอย่างข้ามจอ (FLOW-1 ข้อ 1) */
  const [data, standing] = await Promise.all([
    lessonSummary(session.studentId),
    certificateEligibility(session.studentId),
  ])
  const perMissionMax = selfProfile.starBudget.perMissionMax
  const allMissionsPassed = data.missions.length > 0 && data.missions.every((m) => m.passed)
  const currentIndex = data.missions.findIndex((m) => !m.passed)
  const currentMission = currentIndex >= 0 ? data.missions[currentIndex] : null

  /* ── บอกทาง (กฎเจ้าของข้อ 1-2) ───────────────────────────────────────────
     "ขั้น" ที่นับให้เด็กเห็น = ภารกิจย่อยทุกอัน + ด่านบอสอีก 1 ขั้น
     ตัวเลขทั้งหมดคำนวณจากข้อมูลจริง ไม่ได้ตั้งค่าคงที่ไว้ ห้องที่มีภารกิจไม่เท่ากันจึงถูกทั้งคู่ */
  const stepTotal = data.missions.length + 1
  const stepNow = Math.min(stepTotal, (currentMission ? currentIndex : data.missions.length) + 1)
  const stepsLeft = stepTotal - (data.summary.done + (data.bigMissionSubmitted ? 1 : 0))
  const missionsLeft = data.missions.length - data.summary.done

  /** บรรทัดเดียวที่บอกว่า "ตอนนี้ต้องทำอะไร" — ต้องสั่งงานได้เลย ไม่ใช่ชื่อหัวข้อ */
  const nowLine = currentMission
    ? `ต่อไปทำภารกิจที่ ${currentIndex + 1} "${currentMission.title}" กดปุ่มด้านล่างได้เลย`
    : standing.status === 'not-submitted'
      ? 'ภารกิจย่อยครบแล้ว กดปุ่มด้านล่างไปทำด่านบอส CEO เลย'
      : standing.status === 'pending-teacher'
        ? 'ส่งใบเสนอแล้ว รอครูตรวจ · ระหว่างรอไปอ่านคลังความรู้ได้'
        : standing.status === 'keep-going'
          ? `ครูส่งกลับมาให้แก้ ${standing.missing.length} ด้าน กดปุ่มด้านล่างไปดูว่าต้องเติมอะไร`
          : 'ครูยืนยันครบทุกด้านแล้ว ไปรับใบประกาศได้เลย'

  /** สถานะด่านบอสบนการ์ดขั้นสุดท้าย — ต้องพูดตรงกับ nowLine และกับหน้า /home */
  const bossLine =
    standing.status === 'pending-teacher'
      ? 'ส่งแล้ว ครูกำลังอ่านอยู่'
      : standing.status === 'keep-going'
        ? `ครูส่งกลับมาให้แก้ ${standing.missing.length} ด้าน — กดเข้าไปดูว่าต้องเติมอะไร`
        : standing.eligible
          ? 'ครูยืนยันครบทุกด้านแล้ว'
          : allMissionsPassed
            ? 'เปิดแล้ว เข้าได้เลย'
            : `ยังเข้าไม่ได้ ต้องผ่านภารกิจย่อยอีก ${missionsLeft} อันก่อน`

  return (
    <AppShell
      fit
      header={
        <AppHeader className="pb-2">
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-title-sm font-extrabold text-ink">
              แผนภารกิจของฉัน
            </h1>
            <p className="shrink-0 rounded-full bg-reward-100 px-3 py-1 text-label font-extrabold text-reward-700 tabular-nums">
              <StarIcon width={16} height={16} aria-hidden className="mr-1 inline align-[-3px]" />
              {data.totalStars}
              <span className="sr-only">ดาวสะสมจากทั้งหมด {data.maxStars} ดวง</span>
            </p>
          </div>
          {/* กฎบอกทางข้อ 2 — "อยู่ตรงไหนของคาบ" ทำเป็นแถบขั้นตอนมีสี ไม่ใช่ตัวหนังสือเทา
              แต่ละขีดคือหนึ่งขั้น: เขียว = ผ่านแล้ว · ม่วงยาว = ขั้นที่อยู่ตอนนี้ · เทา = ยังไม่ถึง */}
          <div className="mt-2">
            <ul aria-hidden="true" className="flex items-center gap-1">
              {Array.from({ length: stepTotal }, (_, i) => (
                <li
                  key={i}
                  className={cn(
                    'h-2 rounded-full',
                    i < stepNow - 1 ? 'flex-1 bg-quest-500' : i === stepNow - 1 ? 'flex-[2] bg-brand-600' : 'flex-1 bg-line',
                  )}
                />
              ))}
            </ul>
            <p className="mt-1 text-note font-bold text-ink-muted tabular-nums">
              <span className="text-brand-700">{`ขั้นที่ ${stepNow} จาก ${stepTotal}`}</span>
              {stepsLeft > 0 ? ` · เหลืออีก ${stepsLeft} ขั้นถึงใบประกาศ` : ' · ครบทุกขั้นแล้ว'}
              <span className="sr-only">{`ผ่านแล้ว ${data.summary.done} จาก ${data.summary.total} ภารกิจ`}</span>
            </p>
          </div>
        </AppHeader>
      }
      footer={
        <>
          <AppFooter divider={false} className="pb-2">
            {/* กฎบอกทางข้อ 1 — บรรทัดสั่งงาน ให้โดมเป็นคนพูด วางติดปุ่มที่ต้องกด
                ทำเป็นบับเบิลมีตัวละคร ไม่ใช่ข้อความเทาแปะไว้ เด็กจึงอ่านจริงและจอยังน่ารัก */}
            <div className="mb-2 flex items-center gap-2">
              <DomeAvatar mood={currentMission ? 'cheer' : 'happy'} size={44} decorative />
              <SpeechBubble speaker="dome" tail="left" className="min-w-0 flex-1 px-3 py-2">
                <span className="line-clamp-2 text-label font-bold text-ink">{nowLine}</span>
              </SpeechBubble>
            </div>
            <Link
              href={currentMission ? `/mission/${currentMission.id}` : standing.nextHref}
              className="btn-go"
            >
              {/* ปลายทางเปลี่ยนตามสถานะจริง — ส่งงานไปแล้วต้องพาไปดูสถานะ ไม่ใช่กลับไปหน้าส่งซ้ำ */}
              {currentMission ? `ทำต่อ: ${currentMission.title}` : standing.nextLabel}
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
          <BottomNav />
        </>
      }
    >
      <div className="relative isolate flex h-full min-h-0 flex-col scene-sky px-4 pt-2 pb-1">
        <SceneDecor density="light" />
        {data.missions.length === 0 ? (
          /* กฎบอกทางข้อ 4-5 — จอว่างต้องบอกเหตุผลและบอกว่าระหว่างรอทำอะไรได้ */
          <div className="my-auto rounded-2xl bg-surface-raised p-5 text-center shadow-soft-1">
            <p className="text-body font-bold text-ink">ยังไม่มีภารกิจให้ทำตอนนี้</p>
            <p className="mt-1 text-label text-ink-muted">
              ครูยังไม่เปิดภารกิจของคาบนี้ ไม่ต้องทำอะไรเพิ่ม รอครูเปิดแล้วหน้านี้จะขึ้นเอง
            </p>
            <Link href="/knowledge" className="btn-base mt-3 inline-flex rounded-xl bg-brand-100 px-4 text-label font-bold text-brand-700">
              ระหว่างรอ ไปอ่านคลังความรู้ก่อน
            </Link>
          </div>
        ) : null}

        <ol className="flex min-h-0 flex-1 flex-col">
          {data.missions.map((mission, index) => {
            const isCurrent = index === currentIndex
            const Icon = MISSION_ICONS[mission.id] ?? TargetIcon
            return (
              <li key={mission.id} className="flex min-h-0 flex-1 gap-2.5">
                {/* เส้นเวลาแนวตั้ง — วงกลมไอคอน + เส้นเชื่อมลงขั้นถัดไป */}
                <div className="flex w-11 shrink-0 flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative grid size-11 shrink-0 place-items-center rounded-full ring-4 ring-surface',
                      mission.passed
                        ? 'bg-quest-100 text-quest-700'
                        : isCurrent
                          ? 'bg-brand-600 text-ink-onbrand shadow-soft-2'
                          : 'bg-surface-sunken text-ink-muted',
                    )}
                  >
                    <Icon width={22} height={22} />
                    {mission.passed ? (
                      <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-quest-600 text-ink-onbrand ring-2 ring-surface">
                        <CheckIcon width={13} height={13} strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>
                  <span aria-hidden="true" className="w-1 flex-1 rounded-full bg-line" />
                </div>

                <Link
                  href={`/mission/${mission.id}`}
                  className={cn(
                    'mb-2 flex min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-2xl px-4 py-2',
                    'transition-shadow duration-200 ease-[var(--ease-soft)] focus-ring motion-reduce:transition-none',
                    mission.passed
                      ? 'bg-quest-50 shadow-soft-1 ring-1 ring-quest-100 ring-inset'
                      : isCurrent
                        ? 'bg-surface-raised shadow-soft-2 ring-2 ring-brand-300 ring-inset'
                        : 'bg-surface-raised shadow-soft-1',
                  )}
                >
                  <p className={cn('text-note font-bold', isCurrent ? 'text-brand-700' : 'text-ink-muted')}>
                    {isCurrent ? `ภารกิจที่ ${index + 1} · ทำต่อตรงนี้` : `ภารกิจที่ ${index + 1}`}
                  </p>
                  <h2 className="mt-0.5 line-clamp-2 text-body font-extrabold text-ink">{mission.title}</h2>
                  <p className="mt-0.5 flex items-center gap-1 text-note font-bold text-reward-700 tabular-nums">
                    <StarIcon width={15} height={15} aria-hidden />
                    {mission.stars}/{perMissionMax}
                    <span className="sr-only">
                      ดาวภารกิจ {mission.title} {mission.passed ? 'ผ่านแล้ว' : mission.attempts > 0 ? 'กำลังทำอยู่' : 'ยังไม่เริ่ม'}
                    </span>
                  </p>
                </Link>
              </li>
            )
          })}

          {/* ขั้นสุดท้าย — ด่านบอส มีมงกุฎเมื่อปลดล็อก และแม่กุญแจเมื่อยังไม่ถึง */}
          <li className="flex min-h-0 flex-1 gap-2.5">
            <div className="flex w-11 shrink-0 flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-full ring-4 ring-surface',
                  allMissionsPassed ? 'bg-reward-500 text-ink' : 'bg-surface-sunken text-ink-subtle',
                )}
              >
                {allMissionsPassed ? <CrownIcon width={24} height={24} /> : <LockIcon width={22} height={22} />}
              </span>
            </div>

            <Link
              href="/ceo"
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-2xl px-4 py-2',
                'transition-shadow duration-200 ease-[var(--ease-soft)] focus-ring motion-reduce:transition-none',
                allMissionsPassed
                  ? 'bg-reward-100 shadow-soft-2 ring-1 ring-reward-300 ring-inset'
                  : 'bg-surface-sunken shadow-soft-1 ring-1 ring-line ring-inset',
              )}
            >
              <p className="text-note font-bold text-reward-700">ด่านบอส CEO</p>
              <h2
                className={cn(
                  'mt-0.5 line-clamp-2 text-body font-extrabold',
                  allMissionsPassed ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {bigMission.title}
              </h2>
              <p className="mt-0.5 flex items-center gap-1 text-note text-ink-muted">
                {allMissionsPassed ? null : <LockIcon width={14} height={14} aria-hidden />}
                {/* กฎบอกทางข้อ 6 — บอกล่วงหน้าว่าต้องทำอะไรก่อนถึงจะเข้าได้ ไม่ใช่กดแล้วค่อยรู้ */}
                {bossLine}
              </p>
            </Link>
          </li>
        </ol>
      </div>
    </AppShell>
  )
}

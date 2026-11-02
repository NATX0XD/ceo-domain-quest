'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import './map-hotspots.css'
import { useRouter } from 'next/navigation'
import { TestNudgeCard } from '@/components/test-nudge'
import { DomeFab } from '@/components/dome-fab'
import type { TestNudge } from '@/components/server/test-nudge'
import { ModePopup } from '@/components/learn/mode-popup'
import { postLearn, type LearnModeId } from '@/components/learn/learn-path-api'
import { CheckIcon, ChevronRightIcon, LockIcon, StarIcon, Toast, ToastViewport } from '@/components/ui'

type Mission = {
  id: string
  title: string
  passed: boolean
  stars: number
  maxStars: number
  attempts: number
}

type Boss = { title: string; unlocked: boolean; href: string }

type MapHotspotsProps = {
  imageState: number
  missions: Mission[]
  boss: Boss
  nudge?: TestNudge | null
  recommendedMode?: LearnModeId | null
  enabledModesByMission?: Record<string, readonly LearnModeId[]>
  /** มาจาก /map?done=m1 หลังจบภารกิจ = ฉลองเกาะนั้น แล้วชี้เกาะถัดไป */
  justDone?: string | null
  /** ยังไม่ได้ส่งแบบทดสอบก่อนเรียน = ล็อกทุกเกาะ (open = ครูเปิดแบบทดสอบแล้ว) · null = ไม่ล็อก */
  pretestLock?: { open: boolean } | null
}

const ISLAND_HOTSPOTS = [
  { left: '42%', top: '24%', width: '55%', height: '20%' },
  { left: '8%', top: '41%', width: '63%', height: '19%' },
  { left: '45%', top: '56%', width: '53%', height: '18%' },
  { left: '21%', top: '75%', width: '59%', height: '19%' },
] as const

const BADGE_POSITIONS = [
  { left: '75%', top: '27%' },
  { left: '5%', top: '44%' },
  { left: '76%', top: '59%' },
  { left: '5%', top: '79%' },
] as const

function statusOf(mission: Mission, unlocked: boolean) {
  if (mission.passed) return 'ผ่านแล้ว'
  if (unlocked && mission.attempts > 0) return 'กำลังทำอยู่'
  if (unlocked) return 'เปิดอยู่'
  return 'ล็อกอยู่'
}

export function MapHotspots({ imageState, missions, boss, nudge = null, recommendedMode = null, enabledModesByMission = {}, justDone = null, pretestLock = null }: MapHotspotsProps) {
  const reduce = useReducedMotion()
  const doneIndex = justDone ? missions.findIndex((m) => m.id === justDone && m.passed) : -1
  const [celebrate, setCelebrate] = useState(doneIndex >= 0)
  /** เกาะถัดไป = เกาะแรกที่ยังไม่ผ่าน (ปลดล็อกแล้วเพราะเกาะก่อนหน้าผ่าน) */
  const nextIndex = pretestLock
    ? -1
    : missions.slice(0, 4).findIndex((m, i) => !m.passed && (i === 0 || Boolean(missions[i - 1]?.passed)))
  const pretestMessage = pretestLock?.open === false ? 'รอครูเปิดแบบทดสอบก่อนเรียน' : 'ทำแบบทดสอบก่อนเรียนก่อนนะ'
  useEffect(() => {
    if (!justDone) return
    // ล้าง ?done ออกจาก URL รีเฟรชแล้วจะได้ไม่ฉลองซ้ำ (ไม่ต้องโหลดหน้าใหม่)
    window.history.replaceState(window.history.state, '', '/map')
  }, [justDone])
  const [toast, setToast] = useState(false)
  const [entering, setEntering] = useState<number | null>(null)
  const [drawerIndex, setDrawerIndex] = useState<number | null>(null)
  const [picked, setPicked] = useState<LearnModeId>(recommendedMode ?? 'do')
  const [drawerBusy, setDrawerBusy] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const router = useRouter()
  const focusHotspot = entering === null ? null : ISLAND_HOTSPOTS[entering] ?? ISLAND_HOTSPOTS[0]

  function enterMission(href: string, index: number) {
    router.prefetch(href)
    setEntering(index)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => router.push(href), reduced ? 140 : 720)
  }

  function openMission(index: number, href: string) {
    setCelebrate(false)
    if (index < 2) {
      setDrawerIndex(index)
      const enabled = enabledModesByMission[missions[index]?.id ?? ''] ?? ['watch', 'read', 'do']
      setPicked(recommendedMode && enabled.includes(recommendedMode) ? recommendedMode : enabled[0] ?? 'do')
      setDrawerError(null)
      return
    }
    enterMission(href, index)
  }

  async function startFromDrawer() {
    if (drawerIndex === null || !picked) return
    const mission = missions[drawerIndex]
    if (!mission) return
    setDrawerBusy(true)
    setDrawerError(null)
    const result = await postLearn<{ ok: true }>(mission.id, { action: 'choose', mode: picked })
    setDrawerBusy(false)
    if (!result.ok) {
      setDrawerError(result.message)
      return
    }
    const index = drawerIndex
    setDrawerIndex(null)
    window.setTimeout(() => enterMission(`/mission/${mission.id}`, index), 120)
  }

  return (
    <div className="map-page">
      <ToastViewport className="map-toast-viewport">
        {toast ? <Toast message={pretestLock ? pretestMessage : 'ผ่านภารกิจก่อนหน้าก่อนนะ'} tone="info" onDismiss={() => setToast(false)} /> : null}
      </ToastViewport>

      {pretestLock ? (
        <div className="map-test-strip map-pretest-gate" data-testid="map-pretest-gate">
          {/* ต้องทำแบบทดสอบก่อนเรียนก่อน — ปุ่มหลักของหน้า เกาะทุกเกาะล็อกจนกว่าจะส่ง */}
          <Link href="/pretest" className="gf-nudge map-pretest-cta focus-ring" data-testid="nudge-pretest">
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3 มิติ */}
            <img src="/icons/3d/clipboard.webp" alt="" width={44} height={44} style={{ width: 44, height: 44 }} />
            <span className="min-w-0 flex-1">
              <strong className="block">{pretestMessage}</strong>
              <span className="gf-nudge-chip">
                {pretestLock.open ? 'ถึงเวลาแล้ว · แตะเพื่อเริ่ม' : 'ภารกิจยังล็อกอยู่ · แตะเพื่อดู'}
              </span>
            </span>
            <ChevronRightIcon aria-hidden width={24} height={24} />
          </Link>
        </div>
      ) : nudge ? (
        <div className="map-test-strip">
          <TestNudgeCard nudge={nudge} />
        </div>
      ) : null}

      <div
        className={entering === null ? 'map-artboard' : 'map-artboard map-artboard-entering'}
        style={
          focusHotspot === null
            ? undefined
            : ({
                '--map-focus-x': `${Number.parseFloat(focusHotspot.left) + Number.parseFloat(focusHotspot.width) / 2}%`,
                '--map-focus-y': `${Number.parseFloat(focusHotspot.top) + Number.parseFloat(focusHotspot.height) / 2}%`,
              } as CSSProperties)
        }
      >
        <img
          src={`/ui/map/state-${imageState}.webp`}
          alt="แผนที่ภารกิจ เกาะภารกิจที่ 1 ถึง 4 เชื่อมต่อกันด้วยสะพาน"
          className="map-artwork"
          draggable={false}
        />

        <div className="map-ambient" aria-hidden="true">
          <span className="map-cloud map-cloud-one" />
          <span className="map-cloud map-cloud-two" />
          <span className="map-bird map-bird-one" />
          <span className="map-bird map-bird-two" />
          <span className="map-wave map-wave-one" />
          <span className="map-wave map-wave-two" />
          <span className="map-wave map-wave-three" />
        </div>

        {/* แผนที่เป็นแท็บหลัก ไม่มีปุ่มย้อนกลับ — ปุ่มโดมลอยวางทับปุ่มย้อนที่วาดติดมากับภาพ (มุมซ้ายบน ไม่ทับเกาะ) */}
        <DomeFab from="/map" className="map-dome-fab" />

        {missions.slice(0, 4).map((mission, index) => {
          const previousPassed = index === 0 || Boolean(missions[index - 1]?.passed)
          const unlocked = !pretestLock && (mission.passed || previousPassed)
          const label = `ภารกิจที่ ${index + 1} ${mission.title} ${statusOf(mission, unlocked)}`
          return (
            <div
              key={mission.id}
              className={`map-hotspot-layer map-hotspot-layer-${index + 1}`}
              style={{ '--map-island-delay': `${index * -0.8}s` } as CSSProperties}
            >
              {unlocked ? (
                <button
                  type="button"
                  onClick={() => openMission(index, `/mission/${mission.id}`)}
                  aria-label={label}
                  className={`map-island-hotspot focus-ring${drawerIndex === index ? ' map-island-hotspot-selected' : ''}`}
                  style={ISLAND_HOTSPOTS[index]}
                />
              ) : (
                <button type="button" aria-label={label} className="map-island-hotspot focus-ring" style={ISLAND_HOTSPOTS[index]} onClick={() => setToast(true)} />
              )}
              <span
                className="map-progress-badge"
                style={BADGE_POSITIONS[index]}
                aria-label={`ภารกิจที่ ${index + 1} ดาว ${mission.stars} จาก ${mission.maxStars}${mission.passed ? ' ผ่านแล้ว' : ''}`}
              >
                <StarIcon aria-hidden width={15} height={15} filled={mission.stars > 0} />
                <span>{mission.stars}/{mission.maxStars}</span>
                {mission.passed ? <CheckIcon aria-hidden width={15} height={15} strokeWidth={3} /> : null}
              </span>
              {mission.passed ? (
                <span className="map-complete-sparkles" aria-hidden="true">
                  <img src="/icons/3d/sparkles.webp" alt="" draggable={false} />
                  <img src="/icons/3d/sparkles.webp" alt="" draggable={false} />
                  <img src="/icons/3d/sparkles.webp" alt="" draggable={false} />
                </span>
              ) : null}
              {index === doneIndex ? (
                <span className="map-done-ring" style={ISLAND_HOTSPOTS[index]} aria-hidden="true">
                  <motion.span
                    className="map-done-stamp"
                    initial={reduce ? false : { scale: 2.4, opacity: 0, rotate: -25 }}
                    animate={{ scale: 1, opacity: 1, rotate: -8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.35 }}
                  >
                    <CheckIcon width={18} height={18} strokeWidth={3.5} />
                    สำเร็จ
                  </motion.span>
                </span>
              ) : null}
              {index === nextIndex && drawerIndex === null ? (
                <span className="map-next-pointer" style={ISLAND_HOTSPOTS[index]} aria-hidden="true">
                  <span className="map-next-pointer-art">
                    {/* eslint-disable-next-line @next/next/no-img-element -- asset มือชี้ที่สร้างสำหรับแผนที่ */}
                    <img src="/ui/map/pointer-hand.webp" alt="" draggable={false} />
                  </span>
                  <span className="map-next-tag">แตะเพื่อเริ่ม ภารกิจที่ {index + 1}</span>
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      <section className="map-boss-entry" aria-label="ด่านบอส CEO">
        {boss.unlocked ? (
          <Link href={boss.href} className="map-boss-button focus-ring" aria-label={`ด่านบอส CEO ${boss.title} ปลดล็อกแล้ว`}>
            <span className="map-boss-art" aria-hidden="true">
              <img src="/ui/map/ceo-boss-gate.webp" alt="" draggable={false} />
            </span>
            <strong>ด่านบอส CEO</strong>
            <span className="map-boss-status-badge map-boss-status-badge--open" aria-hidden="true">
              <CheckIcon width={18} height={18} strokeWidth={3} />
            </span>
          </Link>
        ) : (
          <button type="button" className="map-boss-button map-boss-locked focus-ring" onClick={() => setToast(true)} aria-label="ด่านบอส CEO ล็อกอยู่ ต้องผ่านภารกิจ 1 ถึง 4 ก่อน">
            <span className="map-boss-art" aria-hidden="true">
              <img src="/ui/map/ceo-boss-gate.webp" alt="" draggable={false} />
            </span>
            <strong>ด่านบอส CEO</strong>
            <span className="map-boss-status-badge map-boss-status-badge--locked" aria-hidden="true">
              <LockIcon width={17} height={17} />
            </span>
          </button>
        )}
      </section>
      {celebrate && doneIndex >= 0 && drawerIndex === null ? (
        <motion.div
          className="map-celebrate"
          role="status"
          initial={reduce ? false : { y: -40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- มาสคอตทางการ */}
          <img src="/dome/mascot/dome-celebrate.webp" alt="" aria-hidden="true" className="map-celebrate-dome" />
          <div className="map-celebrate-copy">
            <p className="map-celebrate-kicker">ภารกิจที่ {doneIndex + 1} สำเร็จ!</p>
            <p className="map-celebrate-stars" aria-label={`ได้ ${missions[doneIndex]?.stars ?? 0} จาก ${missions[doneIndex]?.maxStars ?? 3} ดาว`}>
              {Array.from({ length: missions[doneIndex]?.maxStars ?? 3 }, (_, i) => (
                <StarIcon key={i} aria-hidden width={22} height={22} filled={i < (missions[doneIndex]?.stars ?? 0)} />
              ))}
            </p>
            <p className="map-celebrate-next">
              {nextIndex >= 0 ? `ต่อไป: แตะเกาะที่ ${nextIndex + 1} ที่กระพริบอยู่` : boss.unlocked ? 'ครบทุกเกาะแล้ว ไปด่านบอสด้านล่างได้เลย' : 'เก่งมาก!'}
            </p>
          </div>
          <button type="button" className="map-celebrate-close focus-ring" onClick={() => setCelebrate(false)} aria-label="ปิดข้อความฉลอง">
            ×
          </button>
          {!reduce ? (
            <span className="map-confetti" aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ '--i': i } as CSSProperties} />
              ))}
            </span>
          ) : null}
        </motion.div>
      ) : null}
      {drawerIndex !== null && missions[drawerIndex] ? (
        <ModePopup
          missionNo={String(drawerIndex + 1)}
          title={missions[drawerIndex].title}
          recommended={recommendedMode ?? 'do'}
          reason={recommendedMode ? undefined : 'ยังไม่รู้สไตล์ของคุณ ลองแบบนี้ก่อน'}
          picked={picked}
          busy={drawerBusy}
          error={drawerError}
          onPick={setPicked}
          onStart={() => void startFromDrawer()}
          onClose={() => setDrawerIndex(null)}
          enabledModes={enabledModesByMission[missions[drawerIndex].id]}
          presentation="drawer"
        />
      ) : null}
      {entering !== null ? <div className="map-fog-transition" role="status" aria-live="polite">กำลังพาไปเกาะภารกิจ</div> : null}
    </div>
  )
}

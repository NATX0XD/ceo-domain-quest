'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, CheckIcon, LockIcon, StarIcon, Toast, ToastViewport } from '@/components/ui'

type Mission = {
  id: string
  title: string
  passed: boolean
  stars: number
  maxStars: number
  attempts: number
}

type Boss = { title: string; unlocked: boolean; href: string }

type MapHotspotsProps = { imageState: number; missions: Mission[]; boss: Boss }

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

export function MapHotspots({ imageState, missions, boss }: MapHotspotsProps) {
  const [toast, setToast] = useState(false)
  const [entering, setEntering] = useState(false)
  const router = useRouter()

  function enterMission(href: string) {
    router.prefetch(href)
    setEntering(true)
    window.setTimeout(() => router.push(href), 720)
  }

  return (
    <div className="map-page">
      <ToastViewport>
        {toast ? <Toast message="ผ่านภารกิจก่อนหน้าก่อนนะ" tone="info" onDismiss={() => setToast(false)} /> : null}
      </ToastViewport>

      <div className="map-artboard">
        <img
          src={`/ui/map/state-${imageState}.webp`}
          alt="แผนที่ภารกิจ เกาะภารกิจที่ 1 ถึง 4 เชื่อมต่อกันด้วยสะพาน"
          className="map-artwork"
          draggable={false}
        />

        <Link href="/home" aria-label="กลับหน้าหลัก" className="map-back-hotspot focus-ring">
          <ArrowLeftIcon aria-hidden width={26} height={26} />
        </Link>

        {missions.slice(0, 4).map((mission, index) => {
          const previousPassed = index === 0 || Boolean(missions[index - 1]?.passed)
          const unlocked = mission.passed || previousPassed
          const label = `ภารกิจที่ ${index + 1} ${mission.title} ${statusOf(mission, unlocked)}`
          return (
            <div key={mission.id} className="map-hotspot-layer">
              {unlocked ? (
                <button type="button" onClick={() => enterMission(`/mission/${mission.id}`)} aria-label={label} className="map-island-hotspot focus-ring" style={ISLAND_HOTSPOTS[index]} />
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
            </div>
          )
        })}
      </div>

      <section className="map-boss-entry" aria-label="ด่านบอส CEO">
        {boss.unlocked ? (
          <Link href={boss.href} className="map-boss-button focus-ring">
            <span>
              <span className="map-boss-kicker">ปลดล็อกแล้ว</span>
              <strong>ด่านบอส CEO · {boss.title}</strong>
            </span>
            <CheckIcon aria-hidden width={22} height={22} strokeWidth={3} />
          </Link>
        ) : (
          <button type="button" className="map-boss-button map-boss-locked focus-ring" onClick={() => setToast(true)}>
            <span>
              <span className="map-boss-kicker">ด่านบอส CEO</span>
              <strong>ผ่านภารกิจ 1–4 ก่อนจึงจะปลดล็อก</strong>
            </span>
            <LockIcon aria-hidden width={22} height={22} />
          </button>
        )}
      </section>
      {entering ? <div className="map-fog-transition" role="status" aria-live="polite">กำลังพาไปเกาะภารกิจ</div> : null}
    </div>
  )
}

'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { DomeAvatar, cn } from '@/components/ui'
import { Float } from './app/fx'

/**
 * ภาพประกอบฉากของโหมด "ดู" — วาดด้วย SVG + โทเคนสี ไม่ใช้ไฟล์รูป
 * คีย์ visual มาจาก content/learn-paths.json: shop | dome | diagram | computer | counter | office
 * คีย์ที่ไม่รู้จัก = ใช้ฉากโดม
 */

const TONE: Record<string, string> = {
  shop: 'bg-spark-50 ring-spark-100',
  dome: 'bg-brand-50 ring-brand-100',
  diagram: 'bg-quest-50 ring-quest-100',
  computer: 'bg-brand-50 ring-brand-100',
  counter: 'bg-reward-100 ring-reward-300',
  office: 'bg-quest-50 ring-quest-100',
}

function Shop() {
  return (
    <>
      <rect x="60" y="70" width="200" height="110" rx="14" className="fill-surface-raised" />
      <path d="M50 70 L80 30 H240 L270 70 Z" className="fill-spark-300" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${50 + i * 44} 70 q22 26 44 0`} className={i % 2 ? 'fill-spark-200' : 'fill-spark-400'} />
      ))}
      <rect x="85" y="105" width="60" height="75" rx="8" className="fill-brand-200" />
      <rect x="165" y="105" width="70" height="45" rx="8" className="fill-quest-100" />
      <rect x="110" y="40" width="100" height="22" rx="11" className="fill-surface-raised" />
    </>
  )
}

function Diagram() {
  return (
    <>
      <rect x="30" y="80" width="70" height="44" rx="12" className="fill-brand-200" />
      <rect x="125" y="80" width="70" height="44" rx="12" className="fill-quest-200" />
      <rect x="220" y="80" width="70" height="44" rx="12" className="fill-spark-200" />
      <path d="M100 102 H120 M195 102 H215" strokeWidth="5" strokeLinecap="round" className="stroke-ink-muted" />
      <path
        d="M114 94 l8 8 -8 8 M209 94 l8 8 -8 8"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-ink-muted"
      />
      <circle cx="160" cy="40" r="16" className="fill-reward-300" />
    </>
  )
}

function Computer() {
  return (
    <>
      <rect x="70" y="30" width="180" height="115" rx="12" className="fill-ink-muted" />
      <rect x="80" y="40" width="160" height="95" rx="6" className="fill-surface-raised" />
      <rect x="92" y="52" width="136" height="16" rx="8" className="fill-brand-100" />
      <rect x="92" y="78" width="90" height="10" rx="5" className="fill-quest-200" />
      <rect x="92" y="96" width="120" height="10" rx="5" className="fill-spark-200" />
      <rect x="140" y="145" width="40" height="18" className="fill-ink-muted" />
      <rect x="105" y="163" width="110" height="12" rx="6" className="fill-ink-muted" />
    </>
  )
}

function Counter() {
  return (
    <>
      <rect x="30" y="110" width="260" height="70" rx="12" className="fill-reward-300" />
      <rect x="30" y="104" width="260" height="14" rx="7" className="fill-reward-500" />
      <rect x="70" y="40" width="80" height="56" rx="8" className="fill-surface-raised" />
      <rect x="80" y="52" width="60" height="8" rx="4" className="fill-brand-200" />
      <rect x="80" y="68" width="44" height="8" rx="4" className="fill-quest-200" />
      <circle cx="225" cy="70" r="24" className="fill-danger-100" />
      <circle cx="225" cy="70" r="14" className="fill-surface-raised" />
    </>
  )
}

function Office() {
  return (
    <>
      <rect x="40" y="30" width="110" height="80" rx="10" className="fill-surface-raised" />
      <path
        d="M55 95 L80 65 L100 82 L120 55 L138 95"
        fill="none"
        strokeWidth="5"
        strokeLinejoin="round"
        className="stroke-quest-500"
      />
      <rect x="170" y="40" width="110" height="14" rx="7" className="fill-brand-100" />
      <rect x="170" y="64" width="80" height="14" rx="7" className="fill-spark-100" />
      <rect x="30" y="130" width="260" height="16" rx="8" className="fill-quest-300" />
      <rect x="60" y="146" width="12" height="36" className="fill-quest-300" />
      <rect x="248" y="146" width="12" height="36" className="fill-quest-300" />
    </>
  )
}

function DomeStage() {
  return (
    <>
      <circle cx="60" cy="50" r="22" className="fill-brand-100" />
      <circle cx="270" cy="150" r="30" className="fill-quest-100" />
      <circle cx="260" cy="40" r="10" className="fill-reward-300" />
      <ellipse cx="160" cy="178" rx="110" ry="14" className="fill-brand-100" />
    </>
  )
}

const ART: Record<string, () => ReactNode> = {
  shop: Shop,
  diagram: Diagram,
  computer: Computer,
  counter: Counter,
  office: Office,
  dome: DomeStage,
}

export function LearnScenePanel({
  visual,
  caption,
  domeSpeaking,
  m2 = false,
}: {
  visual?: string
  caption?: string
  domeSpeaking: boolean
  m2?: boolean
}) {
  const key = visual && ART[visual] ? visual : 'dome'
  const Art = ART[key] ?? DomeStage
  const domeBig = key === 'dome'
  const reduce = useReducedMotion()
  const art = (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={cn(
        'relative aspect-[16/10] w-full overflow-hidden rounded-[24px] shadow-soft-2 ring-1 ring-inset',
        TONE[key],
        m2 && 'bg-[#f9ddaa]'
      )}
    >
      {m2 ? (
        // ภาพเป็นฉากประกอบเท่านั้น; ข้อความและปุ่มยัง render เป็น HTML ด้านนอกภาพ
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/ui/m2/bg-bakery.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {m2 ? <div className="absolute inset-0 bg-[#5d321d]/20" aria-hidden /> : null}
      <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <Art />
      </svg>
      {domeBig ? (
        <Float className="absolute inset-0 flex items-center justify-center">
          <DomeAvatar mood="greet" size={120} decorative />
        </Float>
      ) : domeSpeaking ? (
        <Float className="absolute right-2 bottom-2">
          <DomeAvatar mood="cheer" size={64} decorative />
        </Float>
      ) : null}
      {caption && !m2 ? (
        <p className="absolute top-2 left-2 max-w-[75%] rounded-lg bg-surface-raised/95 px-3 py-1 text-label font-bold text-ink shadow-soft-1">
          {caption}
        </p>
      ) : null}
    </motion.div>
  )
  return m2 ? (
    <figure className="flex flex-col gap-2">
      {art}
      {caption ? <figcaption className="rounded-2xl bg-white px-4 py-2 text-label font-bold text-ink shadow-soft-1">{caption}</figcaption> : null}
    </figure>
  ) : art
}

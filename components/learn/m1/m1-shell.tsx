'use client'

/* eslint-disable @next/next/no-img-element -- ภาพสถิตจาก public/ ของภารกิจ 1 */
import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/components/ui'
import { buzz } from '../app/fx'
import './m1-shell.css'

/**
 * โครงจอภารกิจ 1 ตามสตอรี่บอร์ดของทีม (สไตล์เดียวกับภารกิจ 2):
 * ฉากเต็มจอ · ป้ายไม้มีใบไม้ · ปุ่มกลมย้อนกลับ/เสียง · แผงครีมขอบน้ำตาล · ปุ่มหลักแบบมันวาว
 */

export type M1Scene = 'sky' | 'bakery' | 'room'

const SCENE_BG: Record<M1Scene, string> = {
  sky: '/learn/m1/kit/bg-scene.webp',
  bakery: '/learn/m1/bg-bakery.webp',
  room: '/learn/m1/dome-room.webp',
}

const SOUND_KEY = 'dbq:m1-sound'

/** เสียงเปิด/ปิด จำไว้ในเครื่อง ใช้กับคลิปและเสียงสั่นตอบรับ */
export function useM1Sound() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(SOUND_KEY) === 'off') setOn(false)
    } catch {
      /* ข้าม */
    }
  }, [])
  function toggle() {
    setOn((v) => {
      const next = !v
      try {
        localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
      } catch {
        /* ข้าม */
      }
      return next
    })
  }
  return { on, toggle }
}

export function M1Shell({
  sign,
  pill,
  onBack,
  sound,
  onSound,
  stage,
  stages,
  scene = 'sky',
  dock,
  children,
}: {
  sign: string
  pill?: string
  onBack?: () => void
  sound: boolean
  onSound: () => void
  stage: number
  stages: readonly string[]
  scene?: M1Scene
  dock?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="m1-shell" data-theme-id="m1" data-scene={scene}>
      <img className="m1-shell-bg" src={SCENE_BG[scene]} alt="" aria-hidden draggable={false} />
      <div className="m1-shell-veil" aria-hidden />
      <header className="m1-head">
        {onBack ? (
          <button type="button" className="m1-round" onClick={onBack} aria-label="ย้อนกลับ">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H6M11.5 5.5 5 12l6.5 6.5" />
            </svg>
          </button>
        ) : (
          <span className="m1-round-spacer" aria-hidden />
        )}
        <div className="m1-sign-wrap">
          <div className="m1-sign">
            <span className="m1-leaf m1-leaf-l" aria-hidden />
            <span className="m1-leaf m1-leaf-r" aria-hidden />
            <span className="m1-leaf m1-leaf-l2" aria-hidden />
            <h1>{sign}</h1>
          </div>
          {pill ? <span className="m1-pill">{pill}</span> : null}
        </div>
        <button
          type="button"
          className={cn('m1-round', !sound && 'is-muted')}
          onClick={onSound}
          aria-label={sound ? 'ปิดเสียง' : 'เปิดเสียง'}
          aria-pressed={sound}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
            {sound ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" strokeWidth="2.4" strokeLinecap="round" /> : null}
          </svg>
          {!sound ? <span className="m1-mute-slash" aria-hidden /> : null}
        </button>
      </header>
      <ol className="m1-steps" aria-label="ขั้นตอนการเรียน">
        {stages.map((label, i) => (
          <li key={label} className={cn(i < stage && 'is-done', i === stage && 'is-now')} aria-current={i === stage ? 'step' : undefined}>
            <span className="m1-step-dot">{i < stage ? '✓' : i + 1}</span>
            <span className="m1-step-label">{label}</span>
          </li>
        ))}
      </ol>
      <main className="m1-content">{children}</main>
      {dock ? <div className="m1-dock">{dock}</div> : null}
    </div>
  )
}

type Tone = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger'

/** ปุ่มมันวาวของภารกิจ 1 — props ชุดเดียวกับ Button ของ components/ui ที่ใช้ใน learn path */
export function M1Button({
  children,
  onClick,
  disabled,
  loading,
  loadingLabel,
  variant = 'primary',
  size,
  fullWidth,
  className,
  leadingIcon,
  trailingIcon,
  type = 'button',
}: {
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  variant?: Tone | string
  size?: string
  fullWidth?: boolean
  className?: string
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  type?: 'button' | 'submit'
}) {
  const reduce = useReducedMotion()
  const off = disabled || loading
  const tone: Tone =
    variant === 'success' ? 'success' : variant === 'secondary' ? 'secondary' : variant === 'ghost' ? 'ghost' : variant === 'danger' ? 'danger' : 'primary'
  return (
    <motion.button
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      whileTap={off || reduce ? undefined : { scale: 0.96, y: 2 }}
      onClick={() => {
        buzz()
        onClick?.()
      }}
      className={cn('m1-btn', `m1-btn--${tone}`, size === 'sm' && 'm1-btn--sm', size === 'md' && 'm1-btn--md', fullWidth && 'm1-btn--full', className)}
    >
      {loading ? (
        <>
          <span className="m1-btn-spin" aria-hidden />
          <span>{loadingLabel ?? 'กำลังส่ง'}</span>
        </>
      ) : (
        <>
          {leadingIcon ? <span className="m1-btn-icon">{leadingIcon}</span> : null}
          <span className="m1-btn-text">{children}</span>
          {trailingIcon ? <span className="m1-btn-icon">{trailingIcon}</span> : null}
        </>
      )}
    </motion.button>
  )
}

/** โดมพูดด้วยบับเบิลสีขาว (นอกพื้นที่แชตเรื่องเล่า) */
export function DomeSays({
  mood = 'greet',
  size = 116,
  children,
  side = 'left',
  className,
}: {
  mood?: 'greet' | 'cheer' | 'explain' | 'happy' | 'think' | 'celebrate' | 'surprised'
  size?: number
  children: ReactNode
  side?: 'left' | 'right'
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('m1-dome-says', side === 'right' && 'is-right', className)}>
      <motion.img
        src={`/dome/mascot/dome-${mood}.webp`}
        alt=""
        aria-hidden
        draggable={false}
        style={{ width: size, height: 'auto' }}
        className="m1-dome-img"
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={reduce ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="m1-speech"
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.1 }}
      >
        <span className="sr-only">โดมพูดว่า </span>
        {children}
      </motion.div>
    </div>
  )
}

/** แผงครีมขอบน้ำตาล */
export function M1Board({ children, className, title, kicker }: { children: ReactNode; className?: string; title?: ReactNode; kicker?: ReactNode }) {
  return (
    <section className={cn('m1-board', className)}>
      {kicker ? <p className="m1-kicker">{kicker}</p> : null}
      {title ? <h2 className="m1-board-title">{title}</h2> : null}
      {children}
    </section>
  )
}

/** แถบขั้นตอนแบบภาพ (อินโฟกราฟิกในหน้ากติกา) */
export function M1Flowline({ items }: { items: { icon: string; label: string; note?: string }[] }) {
  return (
    <ol className="m1-flowline">
      {items.map((it, i) => (
        <li key={it.label}>
          <span className="m1-flow-icon">
            <img src={it.icon} alt="" aria-hidden draggable={false} />
            <b>{i + 1}</b>
          </span>
          <span className="m1-flow-label">{it.label}</span>
          {it.note ? <span className="m1-flow-note">{it.note}</span> : null}
        </li>
      ))}
    </ol>
  )
}

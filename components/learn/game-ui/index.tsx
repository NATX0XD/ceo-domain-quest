'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/components/ui'

/**
 * ชิ้นส่วนร่วมของเกมลงมือทำ (m3 Pixel Counter / m4 บอส)
 * ทุกชิ้นเคารพ prefers-reduced-motion และปุ่มสูงอย่างน้อย 48px
 */

export function useGameMotion() {
  const reduce = !!useReducedMotion()
  return {
    reduce,
    spring: reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 26 },
    slide: reduce ? { duration: 0 } : { duration: 0.26, ease: 'easeOut' as const },
  }
}

export function buzz(ms = 10) {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(ms)
}

/** ตัวเลขวิ่งจากค่าก่อนหน้าไปค่าใหม่ */
export function CountUp({
  to,
  duration = 1.1,
  className,
  suffix,
}: {
  to: number
  duration?: number
  className?: string
  suffix?: string
}) {
  const { reduce } = useGameMotion()
  const prev = useRef(to)
  const [v, setV] = useState(to)
  useEffect(() => {
    const from = prev.current
    prev.current = to
    if (reduce || from === to) return
    const c = animate(from, to, { duration, ease: 'easeOut', onUpdate: (l) => setV(Math.round(l)) })
    return () => c.stop()
  }, [to, duration, reduce])
  const shown = reduce ? to : v
  return (
    <span className={className}>
      {shown.toLocaleString('th-TH')}
      {suffix}
    </span>
  )
}

/** พื้นหลังภาพ webp เบลอ มีไล่สีสำรองเมื่อไม่มีไฟล์ */
export function SceneBg({
  src,
  fallback,
  blur = 3,
  dim = 0.25,
}: {
  src: string
  fallback: string
  blur?: number
  dim?: number
}) {
  const { reduce } = useGameMotion()
  const [failed, setFailed] = useState(false)
  return (
    <div aria-hidden="true" className={cn('absolute inset-0 overflow-hidden', fallback)}>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- ภาพพื้นหลังสถิตใน public
        <motion.img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full scale-110 object-cover [image-rendering:pixelated]"
          animate={{ filter: `blur(${blur}px)` }}
          transition={reduce ? { duration: 0 } : { duration: 0.4 }}
        />
      ) : null}
      <div className="absolute inset-0 bg-black" style={{ opacity: dim }} />
    </div>
  )
}

export function HudPill({
  label,
  children,
  tone = 'paper',
  className,
}: {
  label?: string
  children: ReactNode
  tone?: 'paper' | 'dark' | 'gold'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-10 items-center gap-1.5 rounded-xl border-2 px-2.5 text-label font-extrabold shadow-[0_3px_0_rgba(0,0,0,0.25)]',
        tone === 'paper' && 'border-[#7a5a3a] bg-[#fff6dc] text-[#3a2a18]',
        tone === 'dark' && 'border-[#7a5a3a] bg-[#f1e2c3] text-[#3a2a18]',
        tone === 'gold' && 'border-[#b8860b] bg-[#ffd96a] text-[#4a3000]',
        className,
      )}
    >
      {label ? <span className="font-semibold opacity-75">{label}</span> : null}
      {children}
    </div>
  )
}

export function PixelPanel({
  variant = 'paper',
  className,
  children,
  ...rest
}: {
  variant?: 'paper' | 'dark' | 'glass'
  className?: string
  children: ReactNode
} & Omit<React.ComponentProps<typeof motion.div>, 'children' | 'className'>) {
  return (
    <motion.div
      {...rest}
      className={cn(
        'rounded-2xl border-[3px] p-3.5',
        variant === 'paper' && 'border-[#7a5a3a] bg-[#fff8e6] text-[#3a2a18] shadow-[0_5px_0_#5c4228]',
        variant === 'dark' && 'border-[#7a5a3a] bg-[#f1e2c3] text-[#3a2a18] shadow-[0_5px_0_#5c4228]',
        variant === 'glass' && 'border-white/40 bg-white/20 text-white shadow-soft-3 backdrop-blur-md',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

export function GameButton({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary',
  className,
  ariaLabel,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'gold' | 'ghost' | 'paper' | 'dark'
  className?: string
  ariaLabel?: string
  type?: 'button' | 'submit'
}) {
  const { reduce } = useGameMotion()
  const off = disabled || loading
  const skin = variant === 'ghost' ? 'purple' : variant === 'paper' || variant === 'dark' ? 'cream' : 'orange'
  return (
    <motion.button
      type={type}
      aria-label={ariaLabel}
      disabled={off}
      aria-busy={loading || undefined}
      whileTap={off || reduce ? undefined : { scale: 0.96, y: 2 }}
      onClick={() => {
        buzz()
        onClick?.()
      }}
      className={cn(
        // ขอบซ้าย/ขวาของภาพปุ่มกินที่ราว 1.5rem ต่อข้าง เว้นที่ให้ตัวอักษรไม่ทับลวดลายขอบ
        'game-button inline-flex min-h-12 min-w-44 items-center justify-center gap-2 rounded-xl px-9 text-body font-extrabold',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        `game-button--${skin}`,
        className,
      )}
    >
      {loading ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          <span>กำลังส่ง</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  )
}

/** วงนับถอยหลัง */
export function CountdownRing({ value, max, size = 56 }: { value: number; max: number; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div
      role="timer"
      aria-label={`เหลือเวลา ${value} วินาที`}
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="#fff6dc" stroke="#d9c7a0" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={frac > 0.35 ? '#7c4dff' : '#ff8a3d'}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute text-body font-extrabold text-[#3a2a18]">{value}</span>
    </div>
  )
}

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z'

/** ดาวผลงาน เด้งเข้าทีละดวง */
export function Stars({ count, of = 3, size = 44 }: { count: number; of?: number; size?: number }) {
  const { reduce, spring } = useGameMotion()
  return (
    <div className="flex items-center justify-center gap-2" role="img" aria-label={`ได้ ${count} จาก ${of} ดาว`}>
      {Array.from({ length: of }, (_, i) => {
        const on = i < count
        return (
          <motion.svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden
            initial={reduce ? false : { scale: 0, rotate: -40, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ ...spring, delay: reduce ? 0 : 0.35 + i * 0.28 }}
          >
            <path
              d={STAR_PATH}
              fill={on ? '#ffcf4a' : '#3a3050'}
              stroke={on ? '#b8860b' : '#241446'}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          </motion.svg>
        )
      })}
    </div>
  )
}

/**
 * ลูกค้า: ลองภาพตามลำดับใน `srcs` (เช่น -happy.png แล้วถอยไปภาพปกติ) ไม่มีเลยก็ใช้ตัวการ์ตูนสำรองสีตามโทน
 * ถ้าภาพไม่โปร่งใส (มุมภาพทึบ เช่นพื้นครีม) จะใช้ mix-blend-mode: multiply ซ่อนพื้นให้อัตโนมัติ
 */
export function Sprite({
  srcs,
  head,
  body,
  height = 170,
  label,
  float = true,
}: {
  srcs: string[]
  head: string
  body: string
  height?: number | string
  label: string
  float?: boolean
}) {
  const { reduce } = useGameMotion()
  const [idx, setIdx] = useState(0)
  const [opaque, setOpaque] = useState(false)
  const src = srcs[idx]

  function probe(img: HTMLImageElement) {
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 4
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, 4, 4)
      setOpaque(ctx.getImageData(0, 0, 1, 1).data[3] === 255)
    } catch {
      setOpaque(false)
    }
  }

  return (
    <motion.div
      role="img"
      aria-label={label}
      animate={reduce || !float ? undefined : { y: [0, -5, 0] }}
      transition={reduce ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ height }}
      className="relative flex items-end"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- sprite สถิตใน public
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => probe(e.currentTarget)}
          onError={() => setIdx((i) => i + 1)}
          className={cn(
            'h-full w-auto select-none object-contain drop-shadow-[0_6px_0_rgba(0,0,0,0.25)] [image-rendering:pixelated]',
            opaque && 'mix-blend-multiply',
          )}
        />
      ) : (
        <svg viewBox="0 0 100 140" className="h-full w-auto drop-shadow-[0_6px_0_rgba(0,0,0,0.25)]" aria-hidden>
          <rect x="22" y="62" width="56" height="72" rx="20" className={body} />
          <circle cx="50" cy="38" r="28" className={head} />
          <circle cx="40" cy="36" r="3.4" className="fill-ink" />
          <circle cx="60" cy="36" r="3.4" className="fill-ink" />
          <path d="M41 50 Q50 57 59 50" className="stroke-ink" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </motion.div>
  )
}

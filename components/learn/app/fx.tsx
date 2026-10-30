'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'

/** สั่นเบา ๆ เมื่อ trigger เปลี่ยน (ใช้ตอนยังไม่ใช่) — ไม่ใช้สีแดงจัด */
export function Shake({ trigger, children, className }: { trigger: number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      key={trigger}
      className={className}
      initial={false}
      animate={!reduce && trigger > 0 ? { x: [0, -8, 8, -6, 6, -3, 0] } : { x: 0 }}
      transition={{ duration: 0.42 }}
    >
      {children}
    </motion.div>
  )
}

/** ตัวเลขวิ่งขึ้น */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduce) {
      from.current = value
      setShown(value)
      return
    }
    const controls = animate(from.current, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
      onComplete: () => {
        from.current = value
      },
    })
    return () => controls.stop()
  }, [value, reduce])
  return <span className={className}>{shown}</span>
}

const COLORS = ['#7c5cf0', '#f59e42', '#34c38f', '#f7c948', '#ff7aa8']

/** คอนเฟตตีเล็ก ๆ ยิงครั้งเดียวเมื่อ fire เปลี่ยนเป็นค่าใหม่ (>0) */
export function Confetti({ fire, count = 22 }: { fire: number; count?: number }) {
  const reduce = useReducedMotion()
  if (!fire || reduce) return null
  return (
    <div key={fire} className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.2
        const dist = 90 + ((i * 37) % 110)
        return (
          <motion.span
            key={i}
            className="absolute top-[38%] left-1/2 block h-2.5 w-2 rounded-[2px]"
            style={{ background: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist * 0.8 + 120,
              opacity: 0,
              rotate: 240 + i * 25,
              scale: 0.6,
            }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

export function buzz() {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(10)
}

/** ห่อโดมให้ลอยหายใจ */
export function Float({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      animate={reduce ? undefined : { y: [0, -6, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

/** จุด 3 จุดกำลังพิมพ์ */
export function TypingDots({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`} role="status" aria-label="กำลังพิมพ์">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-ink-muted"
          animate={reduce ? { opacity: 0.6 } : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}

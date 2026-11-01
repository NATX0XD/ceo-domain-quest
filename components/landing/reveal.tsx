'use client'

import { motion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/** ครอบทั้งหน้า: ผู้ใช้ที่ตั้งลดการเคลื่อนไหวจะไม่เห็นแอนิเมชัน transform */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/** เลื่อนถึงแล้วค่อยเด้งขึ้น (ครั้งเดียว) — ผู้ใช้ลดการเคลื่อนไหว: MotionConfig ตัด y/scale เหลือแค่ค่อย ๆ ปรากฏ (ห้ามแยกกิ่งด้วย useReducedMotion: SSR/ไคลเอนต์จะไม่ตรงกัน) */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'li'
}) {
  const M = as === 'li' ? motion.li : motion.div
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ type: 'spring', stiffness: 140, damping: 18, delay }}
    >
      {children}
    </M>
  )
}

'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { Countdown, useOpenState } from './countdown'
import { Cloud, Pic } from './pic'

const STARS: Array<{ top: string; left: string; size: number; delay: string }> = [
  { top: '2%', left: '-6%', size: 26, delay: '0s' },
  { top: '30%', left: '104%', size: 20, delay: '.8s' },
  { top: '70%', left: '-10%', size: 18, delay: '1.4s' },
  { top: '8%', left: '86%', size: 16, delay: '2s' },
]

function Star({ top, left, size, delay }: { top: string; left: string; size: number; delay: string }) {
  return (
    <svg className="ld-star" viewBox="0 0 24 24" aria-hidden style={{ top, left, width: size, height: size, animationDelay: delay }}>
      <path d="M12 0c1 6 3 9 12 12-9 3-11 6-12 12-1-6-3-9-12-12C9 9 11 6 12 0z" fill="#ffe27a" stroke="#fff" strokeWidth="1" />
    </svg>
  )
}

export function Hero({ openAt, openLabel }: { openAt: string | null; openLabel: string }) {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['0%', '14%'])
  const cloudY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 90])
  const domeY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -36])
  const { open } = useOpenState(openAt)

  return (
    <header className="ld-hero" ref={ref}>
      <nav className="ld-nav" aria-label="เมนูหลัก">
        <a href="/landing" className="ld-nav-brand">CEO Domain Quest</a>
        <a href="/landing/manual" className="ld-nav-manual">คู่มือการใช้งาน ↗</a>
      </nav>
      <motion.div className="ld-hero-bg" style={{ y: bgY }} aria-hidden>
        <Pic src="/landing/sea-bg.webp" alt="" width={720} height={1279} priority />
      </motion.div>
      <motion.div style={{ y: cloudY }} aria-hidden>
        <Cloud className="ld-cloud ld-cloud--a" />
        <Cloud className="ld-cloud ld-cloud--b" />
        <Cloud className="ld-cloud ld-cloud--c" />
      </motion.div>

      <div className="ld-wrap">
        <div className="ld-hero-inner">
          <motion.div
            className="ld-badge"
            initial={false}
          >
            <span className="ld-badge-dot" aria-hidden />
            {open ? 'เปิดให้เล่นแล้ว!' : `เปิดให้เล่น ${openLabel}`}
          </motion.div>

          <motion.h1
            className="ld-logo"
            initial={false}
          >
            <Pic src="/landing/logo.webp" alt="CEO Domain Quest" width={720} height={487} priority />
          </motion.h1>

          <motion.div className="ld-dome-stage" style={{ y: domeY }}>
            {STARS.map((s) => (
              <Star key={s.top + s.left} {...s} />
            ))}
            <motion.div
              className="ld-bubble"
              initial={false}
            >
              สวัสดี! มาเล่นกัน
            </motion.div>
            <motion.div
              initial={false}
            >
              <Pic className="ld-dome" src="/landing/dome-wave.webp" alt="โดม มาสคอตผู้ช่วยของเกม" width={640} height={756} priority />
            </motion.div>
          </motion.div>

          <p className="ld-sign ld-sign--sm">สร้างร้านในฝัน เรียนรู้โดเมนอย่างสนุก</p>

          <Countdown openAt={openAt} />

          <div className="ld-cta-row">
            {open ? (
              <motion.a className="ld-btn" href="/join" whileTap={{ scale: 0.94 }}>
                เข้าเล่นเลย ▶
              </motion.a>
            ) : (
              <motion.a className="ld-btn" href="#how" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}>
                ดูวิธีเล่น ▶
              </motion.a>
            )}
            <motion.a className="ld-btn ld-btn--ghost" href="#teacher" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}>
              สำหรับครู
            </motion.a>
          </div>
        </div>
      </div>

      <div className="ld-waves" aria-hidden>
        <div className="ld-wave ld-wave--1" />
        <div className="ld-wave ld-wave--2" />
      </div>
    </header>
  )
}

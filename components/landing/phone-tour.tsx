'use client'

import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { useRef, useState } from 'react'
import { Pic } from './pic'
import { useLandingScroll } from './reveal'

const STEPS = [
  { src: '/landing/shot-join.webp', icon: 'door', title: 'เข้าห้อง', note: 'ใส่รหัสจากครู', say: 'ใส่รหัสห้องจากครูได้เลย!' },
  { src: '/landing/shot-home.webp', icon: 'school', title: 'ร้านของเรา', note: 'ดูความคืบหน้า', say: 'นี่คือร้านของเธอนะ' },
  { src: '/landing/shot-map.webp', icon: 'bullseye', title: 'แผนที่เกาะ', note: 'เลือกภารกิจ', say: 'เลือกเกาะที่อยากไป' },
  { src: '/landing/shot-choose.webp', icon: 'eyes', title: 'เลือกวิธีเรียน', note: 'ดู อ่าน ลงมือทำ', say: 'ชอบแบบไหน เลือกเลย' },
  { src: '/landing/shot-play.webp', icon: 'gear', title: 'ลงมือทำ', note: 'เล่นเกมฝึก', say: 'ลองทำจริงสนุกกว่าเยอะ' },
  { src: '/landing/shot-dome.webp', icon: 'speech-balloon', title: 'ถามโดม', note: 'ผู้ช่วย AI', say: 'ติดตรงไหน ถามโดมได้!' },
] as const

export function PhoneTour() {
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const scrollRef = useLandingScroll()
  const inView = useInView(box, { margin: '-20% 0px -20% 0px' })
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ container: scrollRef, target: box, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    if (reduce || !inView) return
    setActive(Math.min(STEPS.length - 1, Math.floor(value * STEPS.length)))
  })

  const step = STEPS[active] ?? STEPS[0]
  return (
    <div className="ld-tour-scroll" ref={box}>
      <div className="ld-tour-sticky">
        <div className="ld-tour-head">
          <h2 className="ld-sign">ลองดูหน้าจอจริง</h2>
          <p className="ld-sec-sub">แตะขั้นตอนเพื่อดูทีละหน้า</p>
        </div>
        <div className="ld-tour">
          <div className="ld-phone-wrap">
            <div className="ld-phone">
              <div className="ld-screen">
                {STEPS.map((s, i) => (
                  <motion.div
                    key={s.src}
                    style={{ position: 'absolute', inset: 0 }}
                    animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 1.06 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    aria-hidden={i !== active}
                  >
                    <Pic src={s.src} alt={`หน้าจอ: ${s.title}`} width={390} height={844} priority={i === 0} sizes="300px" />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          <div className="ld-tour-dome" aria-hidden>
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="ld-bubble"
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              >
                {step.say}
              </motion.div>
            </AnimatePresence>
            <Pic className="ld-dome" src="/dome/mascot/dome-cheer.webp" alt="" width={448} height={532} />
          </div>
          <div className="ld-step-list" role="group" aria-label="ขั้นตอนการเล่น">
            {STEPS.map((s, i) => (
              <motion.button
                key={s.title}
                type="button"
                className="ld-step-btn"
                aria-current={i === active}
                onClick={() => {
                  setActive(i)
                  if (box.current && scrollRef.current && window.matchMedia('(min-width: 900px)').matches) {
                    const top = scrollRef.current.scrollTop + box.current.getBoundingClientRect().top - scrollRef.current.getBoundingClientRect().top + (box.current.offsetHeight - scrollRef.current.clientHeight) * (i / (STEPS.length - 1))
                    scrollRef.current.scrollTo({ top, behavior: 'smooth' })
                  }
                }}
                onFocus={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onViewportEnter={() => {
                  if (window.matchMedia('(max-width: 899px)').matches) setActive(i)
                }}
                viewport={{ amount: 0.65 }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.97 }}
              >
                <Pic src={`/icons/3d/${s.icon}.webp`} alt="" width={30} height={30} />
                {s.title}
                <small>{s.note}</small>
                {i === active && <span className="ld-progress" />}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

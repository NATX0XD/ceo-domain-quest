'use client'

import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Pic } from './pic'

const DURATION = 3400

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
  const [paused, setPaused] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const inView = useInView(box, { margin: '-20% 0px -20% 0px' })
  const reduce = useReducedMotion()
  const run = inView && !paused && !reduce

  useEffect(() => {
    if (!run) return
    const id = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), DURATION)
    return () => clearTimeout(id)
  }, [active, run])

  const step = STEPS[active] ?? STEPS[0]
  return (
    <div className="ld-tour" ref={box} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
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
      </div>

      <div className="ld-step-list" role="group" aria-label="ขั้นตอนการเล่น">
        {STEPS.map((s, i) => (
          <motion.button
            key={s.title}
            type="button"
            className="ld-step-btn"
            aria-current={i === active}
            onClick={() => setActive(i)}
            whileTap={{ scale: 0.97 }}
          >
            <Pic src={`/icons/3d/${s.icon}.webp`} alt="" width={30} height={30} />
            {s.title}
            <small>{s.note}</small>
            {i === active && <span key={`${active}-${run}`} className="ld-progress" data-run={run} style={{ ['--ld-dur' as string]: `${DURATION}ms` }} />}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

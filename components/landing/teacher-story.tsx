'use client'

import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useScroll } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Pic } from './pic'
import { useLandingScroll } from './reveal'

/** หน้าจอจริงของครู (1440×900) + กรอบไฮไลต์เป็น % ของภาพ */
const SCREENS = [
  { src: '/landing/teacher/home.webp', alt: 'หน้าภาพรวมห้องเรียน โดมสรุปจำนวนนักเรียน เกียรติบัตร และความคืบหน้าเฉลี่ย' },
  { src: '/landing/teacher/review.webp', alt: 'หน้างานให้ครูดู ระบบและ AI เสนอคะแนน ครูยืนยันเอง' },
  { src: '/landing/teacher/report.webp', alt: 'หน้ารายงานผลการเรียนของทั้งห้อง คะแนนก่อนและหลังเรียน' },
] as const

const STEPS = [
  { icon: 'school', title: 'ภาพรวมห้อง', note: 'โดมสรุปให้ครู', detail: 'ใครได้เกียรติบัตร ใครติดตรงไหน เห็นทันที', screen: 0, ring: { left: 20.6, top: 9.4, width: 77.6, height: 46.4 } },
  { icon: 'robot', title: 'AI ช่วยตรวจ', note: 'ครูตัดสินใจเอง', detail: 'AI เสนอคะแนน ครูดูย้อนหลังแล้วยืนยันหรือแก้ได้', screen: 1, ring: { left: 39.6, top: 29.8, width: 57.4, height: 51.2 } },
  { icon: 'bar-chart', title: 'รายงานผล', note: 'รายคนและทั้งห้อง', detail: 'คะแนนก่อน-หลัง ดูได้ทั้งห้องในหน้าเดียว', screen: 2, ring: { left: 20.6, top: 16.4, width: 77.6, height: 18.6 } },
] as const

const LID_CLOSED = -88
const LID_OPEN = 11
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

/** ช่วงสกรอล์ (0–1 ของช่วงที่ตรึง): เปิดฝา → 3 ขั้น → สรุป */
const OPEN_END = 0.2
const STEP_AT = [0.26, 0.44, 0.62, 0.8] as const

export function TeacherStory() {
  const track = useRef<HTMLDivElement>(null)
  const laptop = useRef<HTMLDivElement>(null)
  const scrollRef = useLandingScroll()
  const desktop = useRef(false)
  const [step, setStep] = useState(0) // 0 = ยังไม่เริ่ม, 1-3 = ขั้น, 4 = สรุปครบ
  const lid = useMotionValue(LID_CLOSED)
  const slide = useMotionValue(1)
  const rise = useMotionValue(1)
  const { scrollYProgress } = useScroll({ container: scrollRef, target: track, offset: ['start start', 'end end'] })
  const laptopSeen = useInView(laptop, { once: true, amount: 0.45 })

  const apply = (p: number) => {
    const open = ease(clamp01(p / OPEN_END))
    lid.set(LID_CLOSED + (LID_OPEN - LID_CLOSED) * open)
    rise.set(1 - open)
    slide.set(1 - ease(clamp01((p - OPEN_END * 0.7) / (STEP_AT[0] - OPEN_END * 0.7))))
    setStep(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 4 : STEP_AT.filter((at) => p >= at).length)
  }

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const sync = () => {
      desktop.current = mq.matches
      if (mq.matches) apply(scrollYProgress.get())
      else { slide.set(0); rise.set(0) }
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
    // apply อ่านแต่ motion value — ไม่ต้องผูก deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (desktop.current) apply(p)
  })

  // มือถือ: ไม่ตรึงยาว — เห็นเครื่องแล้วฝาเปิดครั้งเดียว จากนั้นวนไฮไลต์ทีละขั้น
  useEffect(() => {
    if (desktop.current || !laptopSeen) return
    const opening = animate(lid, LID_OPEN, { type: 'spring', stiffness: 70, damping: 14 })
    let i = 0
    const timer = window.setInterval(() => {
      i = (i % 3) + 1
      setStep(i)
    }, 2600)
    const first = window.setTimeout(() => setStep(1), 900)
    return () => { opening.stop(); window.clearInterval(timer); window.clearTimeout(first) }
  }, [laptopSeen, lid])

  const goTo = (i: number) => {
    setStep(i + 1)
    const box = track.current
    const sc = scrollRef.current
    if (!desktop.current || !box || !sc) return
    const start = sc.scrollTop + box.getBoundingClientRect().top - sc.getBoundingClientRect().top
    const at = ((STEP_AT[i] ?? 0) + (STEP_AT[i + 1] ?? 1)) / 2
    sc.scrollTo({ top: start + (box.offsetHeight - sc.clientHeight) * at, behavior: 'smooth' })
  }

  const active = step >= 1 && step <= 3 ? STEPS[step - 1] : null
  const screen = active ? active.screen : 0

  return (
    <div className="ld-tch-track" ref={track} data-step={step}>
      <div className="ld-tch-stage">
        <div className="ld-tch-head">
          <h2 className="ld-sign">สำหรับครู</h2>
          <p className="ld-sec-sub">เปิดห้อง ฉายจอ ดูผลได้ในที่เดียว</p>
        </div>
        <div className="ld-tch-body">
          <motion.div className="ld-tch-device" style={{ ['--slide' as string]: slide, ['--rise' as string]: rise }}>
            <motion.div ref={laptop} className="ld-lt" style={{ ['--lid' as string]: lid }}>
              <div className="ld-lt-body">
                <div className="ld-lt-deck" aria-hidden>
                  <span className="ld-lt-hinge" />
                  <span className="ld-lt-keys" />
                  <span className="ld-lt-pad" />
                  <span className="ld-lt-lip" />
                </div>
                <div className="ld-lt-lid">
                  <div className="ld-lt-front">
                    <div className="ld-lt-screen">
                      {SCREENS.map((s, i) => (
                        <div key={s.src} className={`ld-lt-shot ${i === screen ? 'is-on' : ''}`} aria-hidden={i !== screen}>
                          <Pic src={s.src} alt={s.alt} width={1440} height={900} sizes="(min-width: 900px) 900px, 100vw" />
                        </div>
                      ))}
                      {STEPS.map((s, i) => (
                        <span
                          key={s.title}
                          className={`ld-lt-ring ${step === i + 1 ? 'is-on' : ''}`}
                          style={{ left: `${s.ring.left}%`, top: `${s.ring.top}%`, width: `${s.ring.width}%`, height: `${s.ring.height}%` }}
                          aria-hidden
                        />
                      ))}
                      <span className="ld-lt-glare" aria-hidden />
                    </div>
                    <span className="ld-lt-cam" aria-hidden />
                  </div>
                  <div className="ld-lt-back" aria-hidden>
                    <Pic src="/landing/logo.webp" alt="" width={240} height={162} />
                  </div>
                  <span className="ld-lt-edge" aria-hidden />
                </div>
              </div>
            </motion.div>
            <span className="ld-tch-hint" aria-hidden><i />เลื่อนลงเพื่อเปิดเครื่อง</span>
          </motion.div>
          <ol className="ld-tch-steps" aria-label="ครูทำอะไรได้บ้าง">
            {STEPS.map((s, i) => {
              const shown = step >= i + 1
              const on = step === i + 1
              return (
                <li key={s.title} className={`ld-tch-step ${shown ? 'is-shown' : ''} ${on ? 'is-on' : ''}`}>
                  <button type="button" onClick={() => goTo(i)} aria-pressed={on}>
                    <span className="ld-tch-no">{i + 1}</span>
                    <span className="ld-card-ico"><Pic src={`/icons/3d/${s.icon}.webp`} alt="" width={38} height={38} /></span>
                    <span className="ld-tch-copy">
                      <b>{s.title}</b>
                      <small>{s.note}</small>
                      <em>{s.detail}</em>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}

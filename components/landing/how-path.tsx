'use client'

import { motion, useMotionValue, useMotionValueEvent, useScroll } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Pic } from './pic'
import { useLandingScroll } from './reveal'

const icon = (name: string, size = 38) => <Pic src={`/icons/3d/${name}.webp`} alt="" width={size} height={size} />

const FLOW = [
  { icon: 'door', title: 'เข้าห้อง', note: 'ใส่รหัสจากครู แล้วตั้งชื่อเล่น', shot: 'join', anchor: 'step-1' },
  { icon: 'brain', title: 'เช็กพื้นฐาน', note: 'ตอบ 3 ข้อสั้น ๆ ก่อนออกเดินทาง', shot: 'home', anchor: 'step-6' },
  { icon: 'eyes', title: 'เลือกวิธีเรียน', note: 'เลือกแบบที่ถนัดได้เลย', shot: 'choose', anchor: 'step-6', chips: [['television', 'ดู'], ['books', 'อ่าน'], ['gear', 'ลงมือทำ']] },
  { icon: 'bullseye', title: 'ผ่านภารกิจ 1-4', note: 'เก็บดาวทีละเกาะบนแผนที่', shot: 'map', anchor: 'step-7' },
  { icon: 'crown', title: 'สู้บอส CEO', note: 'ใช้ความรู้ทั้งหมด ปิดเกมให้สวย', shot: 'play', anchor: 'step-10' },
] as const

const SAY = ['ใส่รหัสก่อนนะ!', 'อุ่นเครื่องกัน', 'เลือกแบบที่ชอบ', 'ลุยทีละเกาะ!', 'บอสรออยู่!'] as const

const PATH_D = 'M0 28 C 125 28, 125 78, 250 78 S 375 28, 500 28 S 625 78, 750 78 S 875 28, 1000 28'

/** ทางไม้ + โดมเดินตามการเลื่อน: เดสก์ท็อปเดินซ้าย→ขวาบนเส้นทาง มือถือไต่ลงตามเชือก */
export function HowPath() {
  const track = useRef<HTMLDivElement>(null)
  const steps = useRef<HTMLOListElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const path = useRef<SVGPathElement>(null)
  const walker = useRef<HTMLDivElement>(null)
  const last = useRef(0)
  const scrollRef = useLandingScroll()
  const [active, setActive] = useState(-1)
  const [back, setBack] = useState(false)
  const draw = useMotionValue(0)
  const { scrollYProgress } = useScroll({ container: scrollRef, target: track, offset: ['start 85%', 'end 40%'] })

  const place = (raw: number) => {
    const t = track.current
    const w = walker.current
    const list = steps.current
    if (!t || !w || !list) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const p = reduce ? 0 : Math.min(1, Math.max(0, raw))
    const box = t.getBoundingClientRect()
    const cards = Array.from(list.children) as HTMLElement[]
    let x = 0
    let y = 0
    let next = -1
    if (window.matchMedia('(min-width: 900px)').matches && path.current && svg.current) {
      const at = p
      const pt = path.current.getPointAtLength(path.current.getTotalLength() * at)
      const s = svg.current.getBoundingClientRect()
      x = s.left - box.left + (pt.x / 1000) * s.width
      y = s.top - box.top + (pt.y / 100) * s.height
      draw.set(at)
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect()
        if (r.left + r.width / 2 - box.left <= x + 24) next = i
      })
    } else {
      const l = list.getBoundingClientRect()
      x = l.left - box.left + 23
      y = l.top - box.top + p * (l.height - 30) + 10
      cards.forEach((c, i) => {
        if (c.getBoundingClientRect().top - box.top <= y + 16) next = i
      })
    }
    const hop = reduce ? 0 : Math.abs(Math.sin(p * Math.PI * 9)) * 9
    w.style.transform = `translate3d(${x}px, ${y - hop}px, 0)`
    w.classList.toggle('is-right', x > box.width * 0.72)
    t.style.setProperty('--hw-p', String(p))
    if (Math.abs(raw - last.current) > 0.002) setBack(raw < last.current)
    last.current = raw
    if (!reduce && p > 0) setActive(next)
  }

  useMotionValueEvent(scrollYProgress, 'change', place)
  useEffect(() => {
    const sync = () => place(scrollYProgress.get())
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
    // place อ่านจาก ref/motion value เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tilt = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== 'mouse') return
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -16}deg`)
    el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 22}deg`)
    el.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  const untilt = (e: PointerEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.removeProperty('--rx')
    e.currentTarget.style.removeProperty('--ry')
  }

  return (
    <div className="ld-hw-track" ref={track}>
      <svg className="ld-hw-path" ref={svg} viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden>
        <path className="ld-hw-path-base" d={PATH_D} vectorEffect="non-scaling-stroke" />
        <motion.path className="ld-hw-path-draw" ref={path} d={PATH_D} vectorEffect="non-scaling-stroke" style={{ pathLength: draw }} />
      </svg>
      <div className="ld-hw-walker" ref={walker} aria-hidden>
        <span className={`ld-hw-walker-body ${back ? 'is-back' : ''}`}>
          <Pic src="/dome/mascot/dome-greet.webp" alt="" width={220} height={220} sizes="96px" />
        </span>
        <span className="ld-hw-bubble" key={active}>{active >= 0 ? SAY[active] : 'ตามโดมมา!'}</span>
      </div>
      <ol className="ld-hw-steps" ref={steps}>
        {FLOW.map((s, i) => (
          <motion.li
            key={s.title}
            className={`ld-hw-step ${i <= active ? 'is-reached' : ''} ${i === active ? 'is-active' : ''}`}
            style={{ ['--i' as string]: i }}
            initial={{ opacity: 0, y: 40, scale: 0.9, rotate: i % 2 ? 5 : -5 }}
            whileInView={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            transition={{ type: 'spring', stiffness: 220, damping: 11, delay: i * 0.12 }}
          >
            {i === active && (
              <span className="ld-hw-burst" aria-hidden>
                {Array.from({ length: 8 }, (_, k) => <i key={k} style={{ ['--k' as string]: k }} />)}
              </span>
            )}
            <a className="ld-hw-card" href={`/landing/manual#${s.anchor}`} aria-label={`เปิดคู่มือ: ${s.title}`} onPointerMove={tilt} onPointerLeave={untilt}>
              <span className="ld-hw-no">{i + 1}</span>
              <span className="ld-hw-shot">
                <Pic src={`/landing/shot-${s.shot}.webp`} alt="" width={390} height={844} sizes="220px" />
              </span>
              <span className="ld-hw-ico">{icon(s.icon, 64)}</span>
              <span className="ld-hw-copy">
                <h3>{s.title}</h3>
                <p>{s.note}</p>
                {'chips' in s && (
                  <span className="ld-chips">
                    {s.chips.map(([ic, label]) => (
                      <span className="ld-chip" key={label}>
                        {icon(ic, 20)}
                        {label}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </a>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

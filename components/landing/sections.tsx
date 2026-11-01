'use client'

import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Countdown, useOpenState } from './countdown'
import { PhoneTour } from './phone-tour'
import { Cloud, Pic } from './pic'
import { Reveal } from './reveal'

const icon = (name: string, size = 38) => <Pic src={`/icons/3d/${name}.webp`} alt="" width={size} height={size} />

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <Reveal className="ld-sec-head">
      <h2 className="ld-sign">{title}</h2>
      {sub && <p className="ld-sec-sub">{sub}</p>}
    </Reveal>
  )
}

const MISSIONS = [
  { no: '1', icon: 'magnifying-glass-tilted-left', title: 'รู้จักโดเมนและ DNS', note: 'เว็บถูกหาเจอได้ยังไง' },
  { no: '2', icon: 'package', title: 'โครงสร้างโดเมน', note: 'ชื่อ จุด นามสกุล' },
  { no: '3', icon: 'clipboard', title: 'จำแนกประเภทโดเมน', note: '.com .org .net ต่างกันยังไง' },
  { no: '4', icon: 'handshake', title: 'จดทะเบียนโดเมน', note: 'ซื้อชื่อให้ร้านของเรา' },
]

export function MissionsSection() {
  const [selectedMission, setSelectedMission] = useState('1')
  return (
    <section className="ld-sec ld-sec--cream" id="learn" aria-labelledby="learn-h">
      <div className="ld-wrap">
        <Head title="4 ภารกิจ + บอส CEO" sub="ผ่านทีละเกาะ จนได้ตั้งชื่อเว็บร้านตัวเอง" />
        <div className="ld-world">
          <Reveal>
            <motion.div className="ld-map-frame" whileHover={{ rotate: -1.5, scale: 1.02 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
              <Pic src="/ui/map/state-1.webp" alt="แผนที่เกาะภารกิจ 4 เกาะ" width={941} height={1672} sizes="380px" />
              <span className={`ld-map-ring ld-map-ring--${selectedMission}`} aria-hidden />
            </motion.div>
          </Reveal>
          <ul className="ld-missions" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {MISSIONS.map((m, i) => (
              <Reveal as="li" key={m.no} delay={i * 0.08} className={`ld-card ld-card--mission-${m.no} ${selectedMission === m.no ? 'is-selected' : ''}`}>
                <button className="ld-card-hit" type="button" aria-label={`ไฮไลต์เกาะภารกิจ ${m.no}`} onMouseEnter={() => setSelectedMission(m.no)} onFocus={() => setSelectedMission(m.no)} onClick={() => setSelectedMission(m.no)} />
                <span className="ld-card-no">{m.no}</span>
                <span className="ld-card-ico">{icon(m.icon)}</span>
                <div>
                  <h3>{m.title}</h3>
                  <p>{m.note}</p>
                </div>
              </Reveal>
            ))}
            <Reveal as="li" delay={0.36} className={`ld-card ld-card--boss ${selectedMission === 'boss' ? 'is-selected' : ''}`}>
              <button className="ld-card-hit" type="button" aria-label="ไฮไลต์ด่านบอส CEO" onMouseEnter={() => setSelectedMission('boss')} onFocus={() => setSelectedMission('boss')} onClick={() => setSelectedMission('boss')} />
              <span className="ld-card-no">★</span>
              <span className="ld-card-ico">{icon('crown')}</span>
              <div>
                <h3>ด่านบอส CEO</h3>
                <p>เอาทุกอย่างที่เรียนมาใช้จริง</p>
              </div>
            </Reveal>
          </ul>
        </div>
      </div>
      <span id="learn-h" className="ld-sr">สิ่งที่จะได้เรียน</span>
    </section>
  )
}

const FLOW = [
  { icon: 'door', title: 'เข้าห้อง', note: 'ใส่รหัสจากครู' },
  { icon: 'brain', title: 'เช็กพื้นฐาน', note: '3 ข้อสั้น ๆ' },
  { icon: 'eyes', title: 'เลือกวิธีเรียน', note: 'เลือกแบบที่ชอบ', chips: [['television', 'ดู'], ['books', 'อ่าน'], ['gear', 'ลงมือทำ']] },
  { icon: 'bullseye', title: 'ผ่านภารกิจ 1-4', note: 'เก็บดาวทีละเกาะ' },
  { icon: 'crown', title: 'สู้บอส CEO', note: 'ปิดเกมให้สวย' },
] as const

export function HowSection() {
  return (
    <section className="ld-sec ld-sec--sand" id="how" aria-label="นักเรียนเล่นยังไง">
      <div className="ld-wrap">
        <Head title="เล่นยังไง" sub="ใช้มือถือเครื่องเดียว ไม่ต้องติดตั้งอะไร" />
        <div className="ld-route-scene" aria-hidden="true"><span className="ld-route-bridge" /><span className="ld-route-flag">★</span></div>
        <ol className="ld-steps">
          {FLOW.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 0.1} className="ld-step">
              <span className="ld-step-ico">
                {icon(s.icon, 42)}
                <span className="ld-step-no">{i + 1}</span>
              </span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.note}</p>
                {'chips' in s && (
                  <div className="ld-chips">
                    {s.chips.map(([ic, label]) => (
                      <span className="ld-chip" key={label}>
                        {icon(ic, 20)}
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function TourSection() {
  return (
    <section className="ld-sec ld-sec--sea" id="tour" aria-label="ตัวอย่างหน้าจอ">
      <div className="ld-wrap">
        <Head title="ลองดูหน้าจอจริง" sub="แตะขั้นตอนเพื่อดูทีละหน้า" />
        <Reveal>
          <PhoneTour />
        </Reveal>
      </div>
    </section>
  )
}

const TEACH = [
  { icon: 'stopwatch', title: 'คุมคาบสด', note: 'เห็นทุกคนพร้อมกัน' },
  { icon: 'robot', title: 'AI ช่วยตรวจ', note: 'ครูตัดสินใจเอง' },
  { icon: 'bar-chart', title: 'รายงานผล', note: 'รายคนและทั้งห้อง' },
]

export function TeacherSection() {
  return (
    <section className="ld-sec ld-sec--cream" id="teacher" aria-label="สำหรับครู">
      <div className="ld-wrap">
        <Head title="สำหรับครู" sub="เปิดห้อง ฉายจอ ดูผลได้ในที่เดียว" />
        <Reveal>
          <div className="ld-laptop">
            <div className="ld-laptop-screen">
              <Pic src="/landing/teacher-v2.png" alt="แผงควบคุมครูเวอร์ชันใหม่" width={1440} height={900} sizes="560px" />
            </div>
            <div className="ld-laptop-base" />
          </div>
        </Reveal>
        <div className="ld-feats">
          {TEACH.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.1} className="ld-card">
              <span className="ld-card-ico">{icon(t.icon)}</span>
              <div>
                <h3>{t.title}</h3>
                <p>{t.note}</p>
                <span className="ld-mini-preview" aria-hidden><i /><i /><i /></span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const CHAT = [
  { who: 'me', text: 'โดเมนคืออะไร' },
  { who: 'dome', text: 'เหมือนที่อยู่ของเว็บ ให้คนหาร้านเธอเจอครับ' },
  { who: 'me', text: 'ช่วยทำการบ้านวิชาอื่นหน่อย' },
  { who: 'dome', text: 'โดมช่วยเรื่องบทเรียนนี้นะครับ ลองถามเรื่องโดเมนดูไหม', lock: true },
] as const

export function AiSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  const [typed, setTyped] = useState<number[]>([0])
  useEffect(() => {
    if (!ref.current) return
    if (!('IntersectionObserver' in window)) {
      setSeen(true)
      setTyped(CHAT.map((_, i) => i))
      return
    }
    const fallback = window.setTimeout(() => {
      setSeen(true)
      setTyped(CHAT.map((_, i) => i))
    }, 4200)
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setSeen(true)
      observer.disconnect()
      window.clearTimeout(fallback)
    }, { rootMargin: '0px 0px -20% 0px' })
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
      window.clearTimeout(fallback)
    }
  }, [])
  useEffect(() => {
    if (!seen) return
    const timers: ReturnType<typeof setTimeout>[] = []
    CHAT.slice(1).forEach((_, offset) => {
      const i = offset + 1
      timers.push(setTimeout(() => setTyped((current) => [...current, i]), 650 + offset * 1150))
    })
    timers.push(setTimeout(() => setTyped(CHAT.map((_, i) => i)), 3900))
    return () => timers.forEach(clearTimeout)
  }, [seen])
  return (
    <section className="ld-sec ld-sec--sea" id="ai" aria-label="ผู้ช่วย AI">
      <div className="ld-wrap">
        <Head title="โดม ผู้ช่วย AI" sub="ตอบเฉพาะเรื่องที่กำลังเรียน" />
        <div className="ld-ai" ref={ref}>
          <Reveal>
            <Pic className="ld-dome" src="/dome/mascot/dome-explain.webp" alt="โดมกำลังอธิบาย" width={482} height={532} sizes="300px" style={{ width: 240 }} />
          </Reveal>
          <div className="ld-chat" aria-label="ตัวอย่างบทสนทนา">
            {CHAT.map((m, i) => (
              <motion.div
                key={i}
                className={`ld-msg ld-msg--${m.who}`}
                initial={{ opacity: 0, y: 16, scale: 0.92 }}
                animate={typed.includes(i) ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.25 + i * 0.7 }}
              >
                {m.who === 'dome' && <b>โดม</b>}
                {m.text}
                {'lock' in m && (
                  <span className="ld-lock">
                    {icon('locked', 20)} ล็อกไว้เฉพาะบทเรียน
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function FinalSection({ openAt, openLabel }: { openAt: string | null; openLabel: string }) {
  const { open } = useOpenState(openAt)
  const ref = useRef<HTMLElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setSeen(true), { rootMargin: '0px 0px -18% 0px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const confetti = Array.from({ length: 14 }, (_, i) => i)
  return (
    <footer className="ld-final" ref={ref}>
      <Cloud className="ld-cloud ld-cloud--a" />
      <Cloud className="ld-cloud ld-cloud--b" />
      <div className="ld-final-islands" aria-hidden><span /><span /><span /></div>
      <div className={`ld-confetti ${seen ? 'is-live' : ''}`} aria-hidden>{confetti.map((i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>
      <div className="ld-wrap ld-final-inner">
        <motion.div animate={seen ? { y: [0, -24, 0], rotate: [0, -3, 3, 0] } : {}} transition={{ duration: 1.1, type: 'tween', ease: [0.22, 1, 0.36, 1] }}>
          <Pic className="ld-final-dome ld-dome" src="/dome/mascot/dome-celebrate.webp" alt="" width={499} height={532} />
        </motion.div>
        <h2 className="ld-sign">พร้อมออกผจญภัย</h2>
        <div className="ld-badge">
          <span className="ld-badge-dot" aria-hidden />
          {open ? 'เปิดให้เล่นแล้ว!' : `เปิดให้เล่น ${openLabel}`}
        </div>
        <Countdown openAt={openAt} />
        {open && (
          <motion.a className="ld-btn" href="/join" whileTap={{ scale: 0.94 }}>
            เข้าเล่นเลย ▶
          </motion.a>
        )}
        <p className="ld-foot">
          CEO Domain Quest · สื่อการสอนแบบเกม
          <br />
          วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล
          <br />
          <a href="/landing/manual" className="ld-foot-link">เปิดคู่มือการใช้งาน</a>
        </p>
      </div>
    </footer>
  )
}

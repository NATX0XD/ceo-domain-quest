'use client'

import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Countdown, useOpenState } from './countdown'
import { DecoLayer, Fade } from './deco'
import { HowPath } from './how-path'
import { PhoneTour } from './phone-tour'
import { TeacherStory } from './teacher-story'
import { Pic } from './pic'
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

export function HowSection() {
  return (
    <section className="ld-sec ld-hw" id="how" aria-label="นักเรียนเล่นยังไง">
      <span className="ld-hw-spark ld-hw-spark--a" aria-hidden>{icon('sparkles', 44)}</span>
      <span className="ld-hw-spark ld-hw-spark--b" aria-hidden>{icon('glowing-star', 36)}</span>
      <div className="ld-wrap">
        <div className="ld-hw-head">
          <Head title="เล่นยังไง" sub="ใช้มือถือเครื่องเดียว ไม่ต้องติดตั้งอะไร" />
        </div>
        <HowPath />
        <a className="ld-how-cta" href="/landing/manual">ดูคู่มือฉบับเต็ม <span aria-hidden>↗</span></a>
      </div>
    </section>
  )
}

export function TourSection() {
  return (
    <section className="ld-sec ld-sec--sea" id="tour" aria-label="ตัวอย่างหน้าจอ">
      <DecoLayer scene="island" />
      <Fade top="#a9dcf0" bottom="#e9f7ff" />
      <div className="ld-wrap">
        <Reveal>
          <PhoneTour />
        </Reveal>
      </div>
    </section>
  )
}

export function TeacherSection() {
  return (
    <section className="ld-sec ld-tch" id="teacher" aria-label="สำหรับครู">
      <Fade bottom="#b79ae0" />
      <div className="ld-wrap ld-tch-wrap">
        <TeacherStory />
      </div>
    </section>
  )
}

const CHAT = [
  { who: 'me', text: 'โดเมนคืออะไร', time: '10:41' },
  { who: 'dome', text: 'เหมือนที่อยู่ของเว็บ ให้คนหาร้านเธอเจอครับ', time: '10:41' },
  { who: 'me', text: 'ช่วยทำการบ้านวิชาอื่นหน่อย', time: '10:42' },
  { who: 'dome', text: 'โดมช่วยเรื่องบทเรียนนี้นะครับ ลองถามเรื่องโดเมนดูไหม', time: '10:42', lock: true },
] as const

const SUGGESTIONS = ['โดเมนคืออะไร', '.com กับ .th ต่างกันยังไง', 'DNS ทำงานยังไง']

export function AiSection() {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <section className="ld-sec ld-sec--sea" id="ai" aria-label="ผู้ช่วย AI">
      <DecoLayer scene="night" tone="purple" />
      <Fade top="#b79ae0" bottom="#43357f" />
      <div className="ld-wrap">
        <Head title="โดม ผู้ช่วย AI" sub="ตอบเฉพาะเรื่องที่กำลังเรียน" />
        <div className="ld-ai" ref={ref}>
          <Reveal>
            <Pic className="ld-dome" src="/dome/mascot/dome-explain.webp" alt="โดมกำลังอธิบาย" width={482} height={532} sizes="300px" style={{ width: 240 }} />
          </Reveal>
          <div className="ld-chat-window" aria-label="ตัวอย่างบทสนทนากับโดม">
            <header className="ld-chat-header">
              <div className="ld-chat-profile">
                <span className="ld-chat-avatar ld-chat-avatar--dome"><Pic src="/dome/mascot/dome-greet.webp" alt="" width={56} height={56} /></span>
                <span><b>น้องโดม</b><small><i aria-hidden />ออนไลน์</small></span>
              </div>
              <span className="ld-chat-lock">{icon('locked', 16)} ล็อกเฉพาะบทเรียน</span>
            </header>
            <div className="ld-chat-thread">
            {CHAT.map((m, i) => (
                <div key={i} data-chat-index={i} className={`ld-msg-row ld-msg-row--${m.who}`}>
                  {m.who === 'dome' && <span className="ld-chat-avatar ld-chat-avatar--dome"><Pic src="/dome/mascot/dome-greet.webp" alt="" width={38} height={38} /></span>}
                  <div className={`ld-msg ld-msg--${m.who}`}>
                    <div className="ld-msg-meta"><b>{m.who === 'dome' ? 'น้องโดม' : 'คุณ'}</b><time>{m.time}</time></div>
                    <p>{m.text}</p>
                    {'lock' in m && <span className="ld-lock">{icon('locked', 17)} ล็อกไว้เฉพาะบทเรียน</span>}
                  </div>
                  {m.who === 'me' && <span className="ld-chat-avatar ld-chat-avatar--user"><Pic src="/icons/3d/bust-in-silhouette.webp" alt="" width={38} height={38} /></span>}
                </div>
            ))}
            <div className="ld-msg-row ld-msg-row--dome ld-typing-row ld-typing-row--one" aria-hidden><span className="ld-chat-avatar ld-chat-avatar--dome"><Pic src="/dome/mascot/dome-greet.webp" alt="" width={38} height={38} /></span><div className="ld-typing"><span><i /><i /><i /></span><small>น้องโดมกำลังพิมพ์</small></div></div>
            <div className="ld-msg-row ld-msg-row--dome ld-typing-row ld-typing-row--two" aria-hidden><span className="ld-chat-avatar ld-chat-avatar--dome"><Pic src="/dome/mascot/dome-greet.webp" alt="" width={38} height={38} /></span><div className="ld-typing"><span><i /><i /><i /></span><small>น้องโดมกำลังพิมพ์</small></div></div>
            </div>
            <div className="ld-suggestions" aria-label="คำถามแนะนำ">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion}>{suggestion}</button>)}</div>
            <form className="ld-chat-input" onSubmit={(event) => event.preventDefault()}>
              <input aria-label="ถามโดมเรื่องบทเรียน" placeholder="ถามโดมเรื่องบทเรียน…" />
              <button type="submit" aria-label="ส่งข้อความ"><span aria-hidden>↗</span></button>
            </form>
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
      <DecoLayer scene="night" tone="purple" />
      <div className="ld-final-bg" aria-hidden />
      <Fade top="#43357f" />
      <div className={`ld-confetti ${seen ? 'is-live' : ''}`} aria-hidden>{confetti.map((i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>
      <div className="ld-wrap ld-final-inner">
        <motion.div animate={seen ? { y: [0, -24, 0], rotate: [0, -3, 3, 0] } : {}} transition={{ duration: 1.1, type: 'tween', ease: [0.22, 1, 0.36, 1] }}>
          <Pic className="ld-final-dome ld-dome" src="/dome/mascot/dome-celebrate.webp" alt="" width={499} height={532} />
        </motion.div>
        <div className="ld-final-plaque">
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
      </div>
    </footer>
  )
}

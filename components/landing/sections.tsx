'use client'

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Countdown, useOpenState } from './countdown'
import { DecoLayer } from './deco'
import { PhoneTour } from './phone-tour'
import { Pic } from './pic'
import { Reveal, useLandingScroll } from './reveal'

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
  { icon: 'door', title: 'เข้าห้อง', note: 'ใส่รหัสจากครู แล้วตั้งชื่อเล่น', shot: 'join', anchor: 'step-1' },
  { icon: 'brain', title: 'เช็กพื้นฐาน', note: 'ตอบ 3 ข้อสั้น ๆ ก่อนออกเดินทาง', shot: 'home', anchor: 'step-6' },
  { icon: 'eyes', title: 'เลือกวิธีเรียน', note: 'เลือกแบบที่ถนัดได้เลย', shot: 'choose', anchor: 'step-6', chips: [['television', 'ดู'], ['books', 'อ่าน'], ['gear', 'ลงมือทำ']] },
  { icon: 'bullseye', title: 'ผ่านภารกิจ 1-4', note: 'เก็บดาวทีละเกาะบนแผนที่', shot: 'map', anchor: 'step-7' },
  { icon: 'crown', title: 'สู้บอส CEO', note: 'ใช้ความรู้ทั้งหมด ปิดเกมให้สวย', shot: 'play', anchor: 'step-10' },
] as const

const PATH_D = 'M0 34 C 100 34, 100 66, 200 66 S 300 34, 400 34 S 500 66, 600 66 S 700 34, 800 34 S 900 66, 1000 66'

export function HowSection() {
  return (
    <section className="ld-sec ld-hw" id="how" aria-label="นักเรียนเล่นยังไง">
      <span className="ld-hw-sea" aria-hidden />
      <span className="ld-hw-spark ld-hw-spark--a" aria-hidden>{icon('sparkles', 44)}</span>
      <span className="ld-hw-spark ld-hw-spark--b" aria-hidden>{icon('glowing-star', 36)}</span>
      <div className="ld-wrap">
        <div className="ld-hw-head">
          <Reveal className="ld-hw-dome">
            <Pic src="/dome/mascot/dome-greet.webp" alt="โดมมาสคอต" width={220} height={220} sizes="160px" />
            <span className="ld-hw-bubble">ตามโดมมา!</span>
          </Reveal>
          <Head title="เล่นยังไง" sub="ใช้มือถือเครื่องเดียว ไม่ต้องติดตั้งอะไร" />
        </div>
        <div className="ld-hw-track">
          <svg className="ld-hw-path" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden>
            <path className="ld-hw-path-base" d={PATH_D} vectorEffect="non-scaling-stroke" />
            <motion.path
              className="ld-hw-path-draw"
              d={PATH_D}
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, margin: '0px 0px -25% 0px' }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
            />
          </svg>
          <ol className="ld-hw-steps">
            {FLOW.map((s, i) => (
              <motion.li
                key={s.title}
                className="ld-hw-step"
                initial={{ opacity: 0, y: 36, scale: 0.92 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ type: 'spring', stiffness: 150, damping: 15, delay: i * 0.12 }}
              >
                <a className="ld-hw-card" href={`/landing/manual#${s.anchor}`} aria-label={`เปิดคู่มือ: ${s.title}`}>
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
        <a className="ld-how-cta" href="/landing/manual">ดูคู่มือฉบับเต็ม <span aria-hidden>↗</span></a>
      </div>
    </section>
  )
}

export function TourSection() {
  return (
    <section className="ld-sec ld-sec--sea" id="tour" aria-label="ตัวอย่างหน้าจอ">
      <DecoLayer scene="island" />
      <div className="ld-wrap">
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
  const [caption, setCaption] = useState(0)
  const [captionReady, setCaptionReady] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [sequenceDone, setSequenceDone] = useState(false)
  const teacherRef = useRef<HTMLDivElement>(null)
  const scrollRef = useLandingScroll()
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ container: scrollRef, target: teacherRef, offset: ['start start', 'end end'] })
  const open = useTransform(scrollYProgress, [0, 0.28, 0.54], [-86, -86, 0])
  const closedOpacity = useTransform(open, [-86, -48, -16], [1, 0, 0])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)')
    const sync = () => setIsDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (reduce) setCaptionReady(true)
  }, [reduce])

  useEffect(() => {
    const syncSequence = () => {
      if (!teacherRef.current) return
      setSequenceDone(teacherRef.current.getBoundingClientRect().bottom <= (scrollRef.current?.getBoundingClientRect().bottom ?? window.innerHeight) + 12)
    }
    syncSequence()
    scrollRef.current?.addEventListener('scroll', syncSequence, { passive: true })
    window.addEventListener('resize', syncSequence)
    return () => {
      scrollRef.current?.removeEventListener('scroll', syncSequence)
      window.removeEventListener('resize', syncSequence)
    }
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const ready = reduce || value >= 0.58
    setCaptionReady(ready)
    if (!reduce) setCaption(value < 0.72 ? 0 : value < 0.84 ? 1 : 2)
  })

  return (
    <section className="ld-sec ld-sec--cream" id="teacher" aria-label="สำหรับครู">
      <DecoLayer scene="island" tone="purple" />
      <div className="ld-wrap ld-teacher-scroll" ref={teacherRef}>
        <Head title="สำหรับครู" sub="เปิดห้อง ฉายจอ ดูผลได้ในที่เดียว" />
        <div className="ld-teacher-sticky">
          <div className="ld-teacher-scene">
            <Reveal>
              <motion.div className="ld-laptop" style={!isDesktop || reduce ? undefined : { perspective: 1200 }}>
                <motion.div className="ld-laptop-lid" style={!isDesktop || reduce ? undefined : { rotateX: open }}>
                  <div className="ld-laptop-screen">
                    <Pic src="/manual/teacher-captures/live.png" alt="หน้าคุมคาบสด แสดงรายชื่อนักเรียนและสถานะภารกิจ" width={1440} height={900} sizes="560px" />
                  </div>
                </motion.div>
                  <motion.div className="ld-laptop-closed" aria-hidden style={!isDesktop || reduce ? undefined : { opacity: closedOpacity }}><span>CEO<br />DOMAIN QUEST</span></motion.div>
                <div className="ld-laptop-base" />
              </motion.div>
            </Reveal>
            <div className="ld-teacher-caption" aria-live="polite">
              {TEACH.map((t, i) => (
              <motion.div key={t.title} className={`ld-teacher-callout ld-teacher-callout--${i + 1}`} animate={{ opacity: (!isDesktop || captionReady) && i === caption ? 1 : 0, y: (!isDesktop || captionReady) && i === caption ? 0 : 8 }}>
                  <span className="ld-callout-line" aria-hidden />
                  <span className="ld-card-ico">{icon(t.icon, 30)}</span>
                  <span><b>{t.title}</b><small>{t.note}</small></span>
                </motion.div>
              ))}
            </div>
          </div>
          <motion.div className="ld-feats" style={!isDesktop || reduce ? undefined : { opacity: sequenceDone ? 1 : 0, pointerEvents: sequenceDone ? 'auto' : 'none' }}>
            {TEACH.map((t) => <div key={t.title} className="ld-card"><span className="ld-card-ico">{icon(t.icon)}</span><div><h3>{t.title}</h3><p>{t.note}</p><span className="ld-mini-preview" aria-hidden><i /><i /><i /></span></div></div>)}
          </motion.div>
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
      <DecoLayer scene="night" tone="purple" />
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
      <DecoLayer scene="night" tone="purple" />
      <div className="ld-final-bg" aria-hidden />
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

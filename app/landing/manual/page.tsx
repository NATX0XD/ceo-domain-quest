'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import './manual.css'

const studentSteps = [
  ['เข้าห้องเรียน', 'เปิดลิงก์จากครู ใส่รหัสห้อง ชื่อเล่น และ PIN 4 หลักเพื่อกลับมาเล่นต่อได้', '/manual/student-join.png'],
  ['ทำความรู้จักเกม', 'อ่านการ์ดแนะนำ แล้วทำตามเส้นทางบนแผนที่ทีละเกาะ', '/manual/shot-home.png'],
  ['ถามโดม', 'กดปุ่มแชตเพื่อถามเรื่องบทเรียน โดมจะตอบเฉพาะเนื้อหาที่ปลดล็อกแล้ว', '/manual/shot-dome.png'],
  ['แต่งร้าน', 'เลือกประเภทร้าน ชื่อร้าน และชื่อเว็บให้ครบ 5 ข้อ', '/manual/student-setup.png'],
  ['ดูแผนที่ภารกิจ', 'เปิด Map แตะเกาะที่พร้อมเล่น แล้วอ่านเป้าหมายก่อนเริ่ม', '/manual/shot-map.png'],
  ['แบบทดสอบและเลือกวิธีเรียน', 'ตอบคำถามสั้น ๆ 3 ข้อ แล้วเลือกวิธีเรียนที่ชอบ: ดู อ่าน หรือ ลงมือทำ', '/manual/m1-gameplay.png'],
  ['ภารกิจที่ 1–2: รู้จักชื่อเว็บ', 'ดูคลิป อ่านเรื่อง หรือเล่นเกมตามวิธีที่เลือก แล้วตอบคำถาม', '/manual/m2-gameplay.png'],
  ['ภารกิจที่ 3: ร้านรับจดชื่อเว็บ', 'ฟังลูกค้าแต่ละคน แล้วแนะนำนามสกุลชื่อเว็บที่เหมาะกับเขา', '/manual/m3-gameplay.png'],
  ['ภารกิจที่ 4: จดชื่อเว็บให้ร้าน', 'ค้นหาชื่อเว็บที่ยังว่าง กรอกข้อมูล แล้วยืนยันการจด', '/manual/m4-gameplay.png'],
  ['บอส CEO และรางวัล', 'ใช้ความรู้ทั้งหมดส่งคำตอบบอส แล้วดูผล รางวัล และโปรไฟล์', '/manual/ceo-boss.png'],
  ['ย้ายเครื่อง', 'กด “เคยเข้าแล้ว ย้ายเครื่อง” แล้วใส่ชื่อเดิมกับ PIN เดิม', '/manual/shot-station-b.png'],
  ['ขอความช่วยเหลือ', 'กดขอความช่วยเหลือ เลือกหัวข้อ และเขียนสิ่งที่ติดอยู่', '/manual/shot-dome.png'],
]

const teacherSteps = [
  ['เข้าสู่ระบบครู', 'ใช้บัญชีครูที่ผู้ดูแลสร้างไว้ แล้วเลือกห้องเรียนจากแถบด้านบน', '/manual/teacher-captures/live.png'],
  ['ควบคุมคาบสด', 'ดูว่าตอนนี้อยู่ช่วงไหน เพิ่มเวลา หยุด ตั้งเวลาใหม่ หรือไปช่วงถัดไป', '/manual/teacher-captures/live-2.png'],
  ['จอฉายหน้าห้อง', 'เปิดหน้าจอสำหรับฉายบนโปรเจกเตอร์ ให้ทั้งห้องเห็นความคืบหน้ารวม', '/manual/teacher-captures/board.png'],
  ['นักเรียนรายคน', 'เลือกชื่อเพื่อดูดาว เป้าหมาย ช่องทางเรียน และความคืบหน้ารายภารกิจ', '/manual/teacher-captures/student.png'],
  ['งานรอตรวจ', 'เปิดงานที่นักเรียนส่งมา อ่าน ให้คะแนน แล้วยืนยันหรือส่งกลับให้แก้', '/manual/teacher-captures/review.png'],
  ['คำขอจากนักเรียน', 'ดูคำขอ เช่น ขอเวลาเพิ่ม หรือขอเปลี่ยนวิธีเรียน แล้วตอบรับ เสนอทางอื่น หรือปฏิเสธ', '/manual/teacher-captures/requests.png'],
  ['รายงานผลการเรียน', 'ดูคะแนนก่อนเรียนและหลังเรียน กราฟความเข้าใจแต่ละภารกิจ และดาวน์โหลดเป็นไฟล์ตาราง', '/manual/teacher-captures/report.png'],
  ['ผลงานเด่น', 'เลือกผลงานของนักเรียนที่ดี ปักหมุด หรือซ่อนชื่อ แล้วฉายบนจอหน้าห้อง', '/manual/teacher-captures/showcase.png'],
  ['ตั้งค่าห้องเรียน', 'เปิดแบบทดสอบก่อน/หลังเรียน ตั้งค่าห้อง เปิดหรือปิดผู้ช่วย AI และโหมดสาธิต', '/manual/teacher-captures/settings.png'],
]

function tilt(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -10}deg`)
  el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`)
  el.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`)
  el.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`)
}
function untilt(e: PointerEvent<HTMLElement>) {
  for (const k of ['--rx', '--ry', '--gx', '--gy']) e.currentTarget.style.removeProperty(k)
}

const SECTIONS = [
  ['overview', 'ภาพรวมระบบ', 'เริ่มจากตรงนี้เลย!', 'greet'],
  ['student', 'นักเรียน', 'ทำตามทีละขั้นนะ', 'explain'],
  ['teacher', 'ครู', 'ครูดูได้ทั้งห้อง', 'think'],
  ['help', 'ขอความช่วยเหลือ', 'ติดตรงไหนเรียกโดม!', 'cheer'],
] as const

/** หมอกคลายตอนเข้า + เผยเนื้อหาตามสกรอล์ + สารบัญติดตาม + โดมโผล่ + พารัลแลกซ์หัวหน้า */
function useManualMotion(root: React.RefObject<HTMLElement | null>, setActive: (id: string) => void, setScrolled: (p: number) => void) {
  useLayoutEffect(() => {
    const page = root.current
    if (!page) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const warped = sessionStorage.getItem('manual-warp') === '1'
    sessionStorage.removeItem('manual-warp')
    page.dataset.arrive = reduce ? 'none' : warped ? 'warp' : 'direct'
    const items = Array.from(page.querySelectorAll<HTMLElement>('.manual-step, .manual-section-head, .manual-overview, .manual-help'))
    let reveal: IntersectionObserver | null = null
    if (reduce) items.forEach((el) => el.classList.add('is-in'))
    else {
      items.forEach((el) => el.classList.add('will-reveal'))
      reveal = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); reveal?.unobserve(en.target) } }), { root: page, rootMargin: '0px 0px -12% 0px' })
      items.forEach((el) => reveal?.observe(el))
    }
    const spy = new IntersectionObserver((entries) => {
      const hit = entries.filter((en) => en.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (hit) setActive(hit.target.id)
    }, { root: page, rootMargin: '-35% 0px -55% 0px' })
    SECTIONS.forEach(([id]) => { const el = page.querySelector(`#${id}`); if (el) spy.observe(el) })
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = page.scrollTop
        if (!reduce) page.style.setProperty('--hero-y', `${Math.min(y, 600)}px`)
        setScrolled(y / Math.max(1, page.scrollHeight - page.clientHeight))
      })
    }
    page.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { reveal?.disconnect(); spy.disconnect(); page.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [root, setActive, setScrolled])
}

function StepCard({ step, index, onOpen }: { step: string[]; index: number; onOpen: (src: string, alt: string) => void }) {
  return <article className="manual-step" id={`step-${index + 1}`}>
    <div className="manual-step-copy">
      <span className="manual-step-no">{index + 1}</span>
      <h3>{step[0]}</h3>
      <p>{step[1]}</p>
      <div className="manual-tip"><b>คำแนะนำการเล่น</b> ทำตามหมายเลขบนหน้าจอ และกด <strong>ขอความช่วยเหลือ</strong> เมื่อไม่แน่ใจ</div>
    </div>
    <figure><button className="manual-image-button" type="button" onPointerMove={tilt} onPointerLeave={untilt} onClick={() => onOpen(step[2]!, `ภาพหน้าจอขั้นตอน ${index + 1}: ${step[0]}`)}><img src={step[2]} alt={`ภาพหน้าจอขั้นตอน ${index + 1}: ${step[0]}`} /></button><figcaption>แตะภาพเพื่อดูเต็ม · รูปที่ {index + 1}</figcaption></figure>
  </article>
}

export default function ManualPage() {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const page = useRef<HTMLElement>(null)
  const [active, setActive] = useState('overview')
  const [scrolled, setScrolled] = useState(0)
  useManualMotion(page, setActive, setScrolled)
  const now = SECTIONS.find(([id]) => id === active) ?? SECTIONS[0]
  useEffect(() => {
    if (!lightbox) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setLightbox(null)
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [lightbox])
  return <main className="manual-page" ref={page}>
    <div className="manual-arrive-fog" aria-hidden />
    <div className="manual-progress" aria-hidden style={{ transform: `scaleX(${scrolled})` }} />
    <div className="manual-buddy" aria-hidden data-hide={scrolled < 0.04}>
      <span className="manual-buddy-say" key={now[0]}>{now[2]}</span>
      <img key={now[3]} src={`/dome/mascot/dome-${now[3]}.webp`} alt="" />
    </div>
    <header className="manual-hero">
      <nav className="manual-nav"><a href="/landing">← กลับหน้าแรก</a></nav>
      <div className="manual-hero-inner">
        <img src="/landing/logo.webp" alt="CEO Domain Quest" className="manual-logo" />
        <img src="/landing/dome-wave.webp" alt="โดม" className="manual-dome" />
        <div className="manual-sign">คู่มือการใช้งาน</div>
        <p>วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล</p>
        <div className="manual-actions"><a className="manual-btn" href="#student">คู่มือนักเรียน</a><a className="manual-btn manual-btn-alt" href="#teacher">คู่มือครู</a></div>
      </div>
    </header>
    <div className="manual-layout">
      <aside className="manual-toc"><b>สารบัญย่อ</b>{SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className={active === id ? 'is-active' : ''} aria-current={active === id ? 'true' : undefined}>{label}</a>)}</aside>
      <div className="manual-content">
        <section id="overview" className="manual-overview"><span className="manual-kicker">START HERE</span><h1>ออกเดินทางจากชื่อร้าน<br />ไปสู่โดเมนที่ใช่</h1><p>CEO Domain Quest คือเกมการเรียนรู้ที่พานักเรียนสำรวจโดเมน ตั้งร้าน ทดลองทำภารกิจ และสรุปความรู้ร่วมกับครูในห้องเรียนเดียวกัน</p><div className="manual-overview-grid"><div><b>1 ห้องเรียน</b><span>รหัสห้องเดียว เข้าพร้อมกันทั้งชั้น</span></div><div><b>4 ภารกิจ</b><span>ดู อ่าน ลงมือทำ ได้ตามจังหวะตัวเอง</span></div><div><b>1 บอส CEO</b><span>นำความรู้ไปตัดสินใจจริง</span></div></div></section>
        <section id="student" className="manual-section"><div className="manual-section-head"><span className="manual-kicker">PART 01</span><h2>สำหรับนักเรียน</h2><p>ใช้มือถือหรือแท็บเล็ต เปิดลิงก์จากครู แล้วเดินทางตามเกาะทีละขั้น</p></div><div className="manual-steps">{studentSteps.map((step, i) => <StepCard key={step[0]} step={step} index={i} onOpen={(src, alt) => setLightbox({ src, alt })} />)}</div></section>
        <section id="teacher" className="manual-section manual-teacher"><div className="manual-section-head"><span className="manual-kicker">PART 02</span><h2>สำหรับครู</h2><p>เปิดห้อง คุมจังหวะ ดูคำตอบ และเปลี่ยนข้อมูลในห้องให้เป็นบทสนทนา</p></div><div className="manual-steps">{teacherSteps.map((step, i) => <StepCard key={step[0]} step={step} index={i + studentSteps.length} onOpen={(src, alt) => setLightbox({ src, alt })} />)}</div></section>
        <section id="help" className="manual-help"><img src="/dome/mascot/dome-explain.webp" alt="โดมช่วยอธิบาย" /><div><h2>ติดตรงไหน ให้เรียกโดม</h2><p>ลองอ่านคำใบ้ในภารกิจก่อน ถ้ายังไม่แน่ใจให้กดขอความช่วยเหลือ ครูจะเห็นคำขอในคิวและเข้ามาช่วยได้ทันที</p><a href="/landing">กลับไปดูภาพรวมเกม ↗</a></div></section>
      </div>
    </div>
    <footer className="manual-footer">CEO Domain Quest · วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล</footer>
    {lightbox && <div className="manual-lightbox" role="dialog" aria-modal="true" aria-label="ภาพหน้าจอขนาดเต็ม" onClick={() => setLightbox(null)}><button type="button" className="manual-lightbox-close" aria-label="ปิดภาพ" onClick={() => setLightbox(null)}>×</button><img src={lightbox.src} alt={lightbox.alt} onClick={(event) => event.stopPropagation()} /></div>}
  </main>
}

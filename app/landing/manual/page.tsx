import type { Metadata } from 'next'
import './manual.css'

export const metadata: Metadata = {
  title: 'คู่มือการใช้งาน — CEO Domain Quest',
  description: 'คู่มือฉบับย่อสำหรับนักเรียนและครู วิชา 21910-2002',
}

const studentSteps = [
  ['เข้าห้องเรียน', 'เปิดลิงก์จากครู ใส่รหัสห้อง ชื่อเล่น และ PIN 4 หลักเพื่อกลับมาเล่นต่อได้', '/manual/student-join.png'],
  ['ทำความรู้จักเกม', 'อ่านการ์ดแนะนำ แล้วทำตามเส้นทางบนแผนที่ทีละเกาะ', '/manual/shot-home.png'],
  ['ถามโดม', 'กดปุ่มแชตเพื่อถามเรื่องบทเรียน โดมจะตอบเฉพาะเนื้อหาที่ปลดล็อกแล้ว', '/manual/shot-dome.png'],
  ['แต่งร้าน', 'เลือกประเภทร้าน ชื่อร้าน และชื่อเว็บให้ครบ 5 ข้อ', '/manual/student-setup.png'],
  ['ดูแผนที่ภารกิจ', 'เปิด Map แตะเกาะที่พร้อมเล่น แล้วอ่านเป้าหมายก่อนเริ่ม', '/manual/shot-map.png'],
  ['Pretest และวิธีเรียน', 'เริ่มพื้นฐาน 3 ข้อ แล้วเลือก ดู อ่าน หรือ ลงมือทำ', '/manual/m1-gameplay.png'],
  ['ภารกิจ M1–M2', 'อ่านโจทย์จริงของด่าน แล้วเลือกคำตอบหรือวิธีเรียนตามที่ระบบขอ', '/manual/m2-gameplay.png'],
  ['ภารกิจ M3 Pixel Counter', 'จับคู่ลูกค้ากับชนิดโดเมนให้ถูกประเภท แล้วตรวจผลในเกม', '/manual/m3-gameplay.png'],
  ['ภารกิจ M4 Registrar', 'ค้นหาชื่อโดเมน กรอกข้อมูลนายทะเบียน และตรวจเอกสาร', '/manual/m4-gameplay.png'],
  ['บอส CEO และรางวัล', 'ใช้ความรู้ทั้งหมดส่งคำตอบบอส แล้วดูผล รางวัล และโปรไฟล์', '/manual/ceo-boss.png'],
  ['ย้ายเครื่อง', 'กด “เคยเข้าแล้ว ย้ายเครื่อง” แล้วใส่ชื่อเดิมกับ PIN เดิม', '/manual/shot-station-b.png'],
  ['ขอความช่วยเหลือ', 'กดขอความช่วยเหลือ เลือกหัวข้อ และเขียนสิ่งที่ติดอยู่', '/manual/shot-dome.png'],
]

const teacherSteps = [
  ['เข้าสู่ระบบครู', 'ใช้บัญชีครูที่ผู้ดูแลสร้างไว้ แล้วเลือกห้องเรียนจากแถบด้านบน', '/manual/teacher-captures/live.png'],
  ['ควบคุมคาบสด', 'ดู phase และเวลา เพิ่ม/หยุด/ตั้งเวลาใหม่ หรือไปช่วงถัดไป', '/manual/teacher-captures/live-2.png'],
  ['Board / Projector', 'เปิดห้องเรียนสดเพื่อฉายสถานะ คำขอ และข้อมูลรวมหน้าห้อง', '/manual/teacher-captures/board.png'],
  ['นักเรียนรายคน', 'เลือกชื่อเพื่อดูดาว เป้าหมาย ช่องทางเรียน และความคืบหน้ารายภารกิจ', '/manual/teacher-captures/student.png'],
  ['Review queue', 'เปิดงานที่รอตรวจ อ่านหลักฐาน ให้คะแนน และยืนยันหรือส่งกลับ', '/manual/teacher-captures/review.png'],
  ['Requests', 'ดูคำขอจากนักเรียน เลือกให้ตามคำขอ ให้ทางเลือกอื่น หรือยังไม่ให้', '/manual/teacher-captures/requests.png'],
  ['Reports และ CSV', 'ดู E1/E2 กราฟเป้าหมาย และกดส่งออกข้อมูลของห้อง', '/manual/teacher-captures/report.png'],
  ['Showcase', 'เลือกผลงานเด่น ปักหมุดหรือซ่อนข้อความ แล้วเปิดบนจอหน้าห้อง', '/manual/teacher-captures/showcase.png'],
  ['Settings / Demo / AI', 'เปิดการทดสอบก่อนเรียน ตั้งค่าห้อง และสลับ AI ช่วยคิดตามบริบท', '/manual/teacher-captures/settings.png'],
]

function StepCard({ step, index }: { step: string[]; index: number }) {
  return <article className="manual-step" id={`step-${index + 1}`}>
    <div className="manual-step-copy">
      <span className="manual-step-no">{index + 1}</span>
      <h3>{step[0]}</h3>
      <p>{step[1]}</p>
      <div className="manual-tip"><b>เคล็ดลับ</b> ทำตามหมายเลขบนหน้าจอ และกด <strong>ขอความช่วยเหลือ</strong> เมื่อไม่แน่ใจ</div>
    </div>
    <figure><img src={step[2]} alt={`ภาพหน้าจอขั้นตอน ${index + 1}: ${step[0]}`} /><figcaption>รูปที่ {index + 1} · {step[0]}</figcaption></figure>
  </article>
}

export default function ManualPage() {
  return <main className="manual-page">
    <header className="manual-hero">
      <nav className="manual-nav"><a href="/landing">← กลับหน้าแรก</a><a href="/manual/คู่มือการใช้งาน-CEO-Domain-Quest.docx" download>ดาวน์โหลด Word</a></nav>
      <div className="manual-hero-inner">
        <img src="/landing/logo.webp" alt="CEO Domain Quest" className="manual-logo" />
        <img src="/landing/dome-wave.webp" alt="โดม" className="manual-dome" />
        <div className="manual-sign">คู่มือการใช้งาน</div>
        <p>วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล</p>
        <div className="manual-actions"><a className="manual-btn" href="#student">คู่มือนักเรียน</a><a className="manual-btn manual-btn-alt" href="#teacher">คู่มือครู</a></div>
      </div>
    </header>
    <div className="manual-layout">
      <aside className="manual-toc"><b>สารบัญย่อ</b><a href="#overview">ภาพรวมระบบ</a><a href="#student">นักเรียน</a><a href="#teacher">ครู</a><a href="#help">ขอความช่วยเหลือ</a><a className="manual-download" href="/คู่มือการใช้งาน-CEO-Domain-Quest.pdf" download>ดาวน์โหลด PDF ↓</a></aside>
      <div className="manual-content">
        <section id="overview" className="manual-overview"><span className="manual-kicker">START HERE</span><h1>ออกเดินทางจากชื่อร้าน<br />ไปสู่โดเมนที่ใช่</h1><p>CEO Domain Quest คือเกมการเรียนรู้ที่พานักเรียนสำรวจโดเมน ตั้งร้าน ทดลองทำภารกิจ และสรุปความรู้ร่วมกับครูในห้องเรียนเดียวกัน</p><div className="manual-overview-grid"><div><b>1 ห้องเรียน</b><span>รหัสห้องเดียว เข้าพร้อมกันทั้งชั้น</span></div><div><b>4 ภารกิจ</b><span>ดู อ่าน ลงมือทำ ได้ตามจังหวะตัวเอง</span></div><div><b>1 บอส CEO</b><span>นำความรู้ไปตัดสินใจจริง</span></div></div></section>
        <section id="student" className="manual-section"><div className="manual-section-head"><span className="manual-kicker">PART 01</span><h2>สำหรับนักเรียน</h2><p>ใช้มือถือหรือแท็บเล็ต เปิดลิงก์จากครู แล้วเดินทางตามเกาะทีละขั้น</p></div><div className="manual-steps">{studentSteps.map((step, i) => <StepCard key={step[0]} step={step} index={i} />)}</div></section>
        <section id="teacher" className="manual-section manual-teacher"><div className="manual-section-head"><span className="manual-kicker">PART 02</span><h2>สำหรับครู</h2><p>เปิดห้อง คุมจังหวะ ดูคำตอบ และเปลี่ยนข้อมูลในห้องให้เป็นบทสนทนา</p></div><div className="manual-steps">{teacherSteps.map((step, i) => <StepCard key={step[0]} step={step} index={i + studentSteps.length} />)}</div></section>
        <section id="help" className="manual-help"><img src="/dome/mascot/dome-explain.webp" alt="โดมช่วยอธิบาย" /><div><h2>ติดตรงไหน ให้เรียกโดม</h2><p>ลองอ่านคำใบ้ในภารกิจก่อน ถ้ายังไม่แน่ใจให้กดขอความช่วยเหลือ ครูจะเห็นคำขอในคิวและเข้ามาช่วยได้ทันที</p><a href="/landing">กลับไปดูภาพรวมเกม ↗</a></div></section>
      </div>
    </div>
    <footer className="manual-footer">CEO Domain Quest · วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล</footer>
  </main>
}

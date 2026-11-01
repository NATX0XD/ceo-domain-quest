import type { Metadata } from 'next'
import './manual.css'

export const metadata: Metadata = {
  title: 'คู่มือการใช้งาน — CEO Domain Quest',
  description: 'คู่มือฉบับย่อสำหรับนักเรียนและครู วิชา 21910-2002',
}

const studentSteps = [
  ['เข้าห้องเรียน', 'เปิดลิงก์จากครู ใส่รหัสห้อง ชื่อเล่น และ PIN 4 หลักเพื่อกลับมาเล่นต่อได้', '/manual/student-join.png'],
  ['ทำความรู้จักเกม', 'อ่านคำทักทายจากโดม แล้วทำตามเส้นทางบนแผนที่ทีละเกาะ', '/landing/shot-home.webp'],
  ['ถามโดม', 'กดปุ่มแชตเพื่อถามเรื่องบทเรียน โดมจะตอบเฉพาะเนื้อหาที่ปลดล็อกแล้ว', '/landing/shot-dome.webp'],
  ['แต่งร้าน', 'เลือกประเภทร้านและของตกแต่งให้ตรงกับไอเดียธุรกิจของคุณ', '/setup/bakery.webp'],
  ['ดูแผนที่ภารกิจ', 'กลับหน้าแรกเพื่อดูดาว ความคืบหน้า และเกาะถัดไปที่พร้อมเล่น', '/landing/shot-map.webp'],
  ['ทำแบบทดสอบก่อนเรียน', 'ตอบ 3 ข้อ แล้วเลือกวิธีเรียนที่ถนัด: ดู อ่าน หรือ ลงมือทำ', '/landing/shot-choose.webp'],
  ['ภารกิจ M1–M2', 'เรียนรู้โดเมนและโครงสร้างชื่อเว็บผ่านวิดีโอ บัตรความรู้ และกิจกรรมสั้น ๆ', '/learn/m1/watch-s1.webp'],
  ['ภารกิจ M3 Pixel Counter', 'จับคู่ลูกค้ากับชื่อโดเมนให้ถูกประเภท แล้วสะสมคะแนน', '/learn/m3/bg-pixel-office.webp'],
  ['ภารกิจ M4 Registrar', 'จำลองการจดทะเบียนโดเมน ตรวจชื่อร้าน และยืนยันคำตอบ', '/learn/m4/boss-door.webp'],
  ['บอส CEO และรางวัล', 'ใช้ความรู้ทั้งหมดตั้งชื่อเว็บ สรุปผล รับเหรียญ และเปิดดูโปรไฟล์/คลังความรู้', '/landing/shot-play.webp'],
]

const teacherSteps = [
  ['สมัครและเข้าสู่ระบบ', 'ถ้ามี /teacher/signup ให้สมัครด้วย invite code จากผู้ดูแล จากนั้นเข้าสู่ระบบครู', '/landing/shot-teacher.webp'],
  ['ควบคุมคาบสด', 'เลือกห้อง ตั้งเวลา เปิดเฟสการเรียน และดูสถานะนักเรียนแบบเรียลไทม์', '/manual/teacher-dashboard.png'],
  ['กระดานและโปรเจกเตอร์', 'เปิด Board เพื่อฉายรหัสห้อง คำสั่ง และความคืบหน้าของทั้งห้อง', '/manual/teacher-board.png'],
  ['นักเรียนและคิวตรวจ', 'ตรวจรายชื่อ เปิดผลงานที่รอตรวจ ให้คะแนน หรือส่งคำขอแก้ไข', '/manual/teacher-students.png'],
  ['คำขอและรายงาน', 'ตอบคำขอความช่วยเหลือ ดูกราฟผลการเรียน และดาวน์โหลด CSV ได้จากเมนูรายงาน', '/manual/teacher-report.png'],
  ['โชว์เคสและตั้งค่า', 'เลือกผลงานขึ้น Showcase ตั้งค่าห้อง เปิด Demo mode หรือสลับ AI ตามบริบทการสอน', '/manual/teacher-settings.png'],
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

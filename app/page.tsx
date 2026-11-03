import Link from 'next/link'
import { AppFooter, AppShell } from '@/components/app-shell'

/**
 * หน้าแรกก่อนเข้าห้อง — จอแรกที่กรรมการและครูเห็น
 *
 * จบในจอเดียว (`fit`) เหมือนหน้าอื่น ๆ · ฉากร้านเป็นภาพชุดเดียวกับในเกม
 * ไม่ใช่ภาพประกอบคนละชุด คนที่เห็นจอนี้จะได้เดาออกทันทีว่าเกมนี้เกี่ยวกับอะไร
 *
 * บอกทาง: โดมบอกด้วยประโยคสั่งงานว่าต้องมีรหัสห้องจากครูก่อน
 * และบอกทางออกไว้ล่วงหน้าสำหรับคนที่ยังไม่มีรหัส (กฎบอกทางข้อ 1 และ 6)
 */
export default function LandingPage() {
  return (
    <AppShell
      fit
      className="media-shell student-display welcome-shell"
      footer={
        <AppFooter divider={false} className="welcome-footer">
          <div className="welcome-choices">
            <Link href="/join" className="welcome-choice game-button game-button--orange">
              เข้าห้องเรียน <span aria-hidden="true">▶</span>
            </Link>
            <Link href="/teacher" className="welcome-choice game-button game-button--purple">
              สำหรับครู
            </Link>
            <p className="welcome-helper">ขอรหัสห้อง 6 ตัวกับ PIN จากครูก่อน แล้วกดปุ่มด้านบนได้เลยครับ</p>
          </div>
        </AppFooter>
      }
    >
      <div className="media-landing-main welcome-main relative isolate flex h-full min-h-0 flex-col items-center gap-2 overflow-hidden px-4 pt-3 pb-1 text-center">
        <span className="welcome-subject-sign relative z-10 shrink-0">
          21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล
        </span>
        <div className="welcome-brand-lockup relative z-10">
          <img src="/ui/kit/signs/welcome-logo.webp" alt="โลโก้ CEO Domain Quest" className="welcome-logo object-contain" />
        </div>
        <div className="welcome-dome-stage relative z-10 min-h-0 w-full flex-1">
          <img src="/ui/welcome/official-dome.webp" alt="โดมกำลังโบกมือทักทาย" className="media-landing-art welcome-dome mx-auto h-full w-full object-contain object-center" />
          <div className="welcome-dome-bubble">สวัสดี! มาเล่นกัน</div>
        </div>
        <div className="welcome-tagline relative z-10">สร้างร้านในฝัน เรียนรู้โดเมนอย่างสนุก</div>
      </div>
    </AppShell>
  )
}

import Link from 'next/link'
import { AppFooter, AppShell } from '@/components/app-shell'
import { ChevronRightIcon, PlayIcon, SpeechBubble, UsersIcon } from '@/components/ui'
import { PRODUCT_NAME_EN, PRODUCT_NAME_TH } from '@/components/product'

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
        <AppFooter className="welcome-choices pb-3">
          <Link href="/join" className="welcome-choice welcome-choice--primary">
            <span className="welcome-choice-icon" aria-hidden="true"><PlayIcon width={24} height={24} fill="currentColor" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-lg font-extrabold">เข้าห้องเรียน</span>
              <span className="block text-label font-semibold opacity-85">สำหรับนักเรียน</span>
            </span>
            <ChevronRightIcon width={24} height={24} aria-hidden />
          </Link>
          <Link href="/teacher" className="welcome-choice welcome-choice--secondary">
            <span className="welcome-choice-icon" aria-hidden="true"><UsersIcon width={23} height={23} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-extrabold">สำหรับครู</span>
              <span className="block text-label font-semibold opacity-75">เปิดห้องและดูผลนักเรียน</span>
            </span>
            <ChevronRightIcon width={22} height={22} aria-hidden />
          </Link>
        </AppFooter>
      }
    >
      <div className="media-landing-main welcome-main relative isolate flex h-full min-h-0 flex-col items-center gap-2 overflow-hidden px-4 pt-3 pb-1 text-center">
        <span className="welcome-subject-sign relative z-10 shrink-0">
          21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล
        </span>
        <div className="welcome-brand-lockup relative z-10">
          <img src="/ui/welcome/logo.webp" alt={`${PRODUCT_NAME_EN} — โลโก้`} className="welcome-logo object-contain" />
          <p className="welcome-product-name">{PRODUCT_NAME_TH}</p>
        </div>
        <div className="welcome-dome-stage relative z-10 min-h-0 w-full flex-1">
          <img src="/ui/welcome/dome.webp" alt="โดม ตัวละครผู้ช่วย" className="media-landing-art welcome-dome mx-auto h-full w-full object-contain object-bottom" />
          <SpeechBubble speaker="dome" tail="none" className="welcome-dome-bubble">
            <span className="line-clamp-2 text-label font-bold text-[#6B2D12]">ขอรหัสห้อง 6 ตัวกับ PIN จากครูก่อน แล้วกดปุ่มด้านล่างได้เลยครับ</span>
          </SpeechBubble>
        </div>
      </div>
    </AppShell>
  )
}

import { AppFooter, AppShell } from '@/components/app-shell'
import { QuestLinkButton } from '@/components/quest-link-button'
import { SpeechBubble } from '@/components/ui'
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
      className="media-shell student-display"
      footer={
        <AppFooter className="flex flex-col gap-2 pb-2">
          <QuestLinkButton
            href="/join"
            label="เข้าห้องเรียน"
            hint="สำหรับนักเรียน ใช้รหัสห้องจากครู"
          />
          <QuestLinkButton
            href="/teacher"
            label="สำหรับครู"
            hint="เปิดห้อง ดูผลนักเรียนแบบสด"
            variant="secondary"
          />
        </AppFooter>
      }
    >
      <div className="media-landing-main relative isolate flex h-full min-h-0 flex-col items-center gap-2 overflow-hidden px-4 pt-3 pb-1 text-center">
        <span className="relative z-10 shrink-0 rounded-full bg-[#FFF1D6] px-4 py-1 text-label font-bold text-[#1555C8] shadow-[0_4px_0_#6B2D12]">
          21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล
        </span>
        <img src="/ui/welcome/logo.webp" alt={`${PRODUCT_NAME_EN} — โลโก้`} className="relative z-10 -mb-3 w-[min(82vw,20rem)] object-contain" />
        <p className="relative z-10 shrink-0 rounded-full bg-[#FFF1D6] px-4 py-1 text-body font-bold text-[#1555C8] shadow-[0_4px_0_#6B2D12]">{PRODUCT_NAME_TH}</p>
        <div className="relative z-10 min-h-0 w-full flex-1">
          <img src="/ui/welcome/dome.webp" alt="โดม ตัวละครผู้ช่วย" className="media-landing-art mx-auto h-full w-full object-contain object-bottom" />
        </div>
        <div className="relative z-10 flex w-full shrink-0 items-center gap-2 text-left">
          <SpeechBubble speaker="dome" tail="left" className="media-panel min-w-0 flex-1 px-3 py-2">
            <span className="line-clamp-2 text-label font-bold text-[#6B2D12]">ขอรหัสห้อง 6 ตัวกับ PIN จากครูก่อน แล้วกดปุ่มด้านล่างได้เลยครับ</span>
          </SpeechBubble>
        </div>
      </div>
    </AppShell>
  )
}

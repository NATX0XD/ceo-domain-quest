import { AppFooter, AppShell } from '@/components/app-shell'
import { QuestLinkButton } from '@/components/quest-link-button'
import { DomeAvatar, SceneDecor, SpeechBubble } from '@/components/ui'
import { ShopStages } from '@/components/shop-stages'
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
      <div className="relative isolate flex h-full min-h-0 flex-col items-center gap-2 scene-sky px-4 pt-3 pb-1 text-center">
        <SceneDecor density="full" />
        <span className="shrink-0 rounded-full bg-brand-100 px-4 py-1 text-note font-bold text-brand-700">
          21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล
        </span>
        {/* ชื่อหลักเป็นอังกฤษ ไทยเป็นชื่อรองใต้ลงมา (มติ T40) */}
        <h1 className="shrink-0 text-title font-black text-balance text-ink">{PRODUCT_NAME_EN}</h1>
        <p className="shrink-0 text-body font-bold text-balance text-brand-700">{PRODUCT_NAME_TH}</p>

        <div className="min-h-0 w-full flex-1">
          <ShopStages level={5} kind="bakery" decorative className="h-full" />
        </div>

        <div className="flex w-full shrink-0 items-center gap-2 text-left">
          <DomeAvatar mood="greet" size={52} decorative sparkle />
          <SpeechBubble speaker="dome" tail="left" className="min-w-0 flex-1 px-3 py-2">
            <span className="line-clamp-2 text-label font-bold text-ink">
              ขอรหัสห้อง 6 ตัวกับ PIN จากครูก่อน แล้วกดปุ่มด้านล่างได้เลยครับ
            </span>
          </SpeechBubble>
        </div>
      </div>
    </AppShell>
  )
}

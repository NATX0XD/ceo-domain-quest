import { ProgressBar, ShopScene as ShopSceneUI, type ShopStage } from '@/components/ui'

/**
 * ภาพร้านที่ค่อย ๆ สร้างเสร็จตามความคืบหน้า (S-09)
 *
 * **ขั้นของร้านนับจากจำนวนด่านที่ผ่านจริง ไม่ใช่เปอร์เซ็นต์**
 * ตัวเลขทั้งหมดคิดที่เซิร์ฟเวอร์แล้ว (`components/server/lesson-progress.ts` → `shopStageFromMissions`)
 * ไฟล์นี้เหลือหน้าที่ประกอบภาพเข้ากับชื่อร้านและแถบความคืบหน้าเป็นการ์ดเดียว ไม่ตัดสินอะไรเอง
 *
 * ⚠️ ตอนนี้ภาพมี 4 ใบ แต่ด่านมี 5 ขั้นท้าย ๆ จึงใช้ภาพสุดท้ายซ้ำ
 *    **ข้อความใต้ภาพเป็นตัวบอกความจริง** ว่าผ่านไปกี่จาก 5 ด่าน ห้ามให้ภาพเป็นตัวบอกจำนวนขั้น
 */
export function ShopScene({
  stage,
  stagesCleared,
  stagesTotal,
  percent,
  label,
  shopName,
}: {
  /** ภาพที่ใช้ 1-4 — เซิร์ฟเวอร์คิดมาให้แล้ว */
  stage: ShopStage
  /** ด่านที่ผ่านจริง 0-5 */
  stagesCleared: number
  stagesTotal: number
  percent: number
  /** ข้อความบอกความคืบหน้าจากเซิร์ฟเวอร์ เช่น "ร้านโตมาแล้ว 2 จาก 5 ด่าน" */
  label: string
  shopName: string | null
}) {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)))

  return (
    <div className="overflow-hidden rounded-2xl bg-quest-50 p-3 shadow-soft-2 ring-1 ring-quest-100 ring-inset">
      <div className="grid place-items-center">
        <ShopSceneUI stage={stage} decorative />
      </div>

      <div className="mt-2 rounded-xl bg-surface-raised p-3 shadow-soft-1">
        <p className="truncate text-body font-bold text-ink">
          {shopName ?? 'ยังไม่ได้ตั้งชื่อร้าน'}
        </p>
        <div className="mt-2">
          <ProgressBar
            value={stagesCleared}
            max={stagesTotal}
            label={
              shopName
                ? `ความคืบหน้าการสร้างร้าน ${shopName}: ${label}`
                : `ความคืบหน้าการสร้างร้านของฉัน: ${label}`
            }
            hideLabel
          />
        </div>
        <p className="mt-1.5 text-note text-ink-muted">{`${label} (${safePercent}%)`}</p>
      </div>
    </div>
  )
}

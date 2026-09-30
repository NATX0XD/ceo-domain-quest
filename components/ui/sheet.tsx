import type { ReactNode } from 'react'
import { cn } from './cn'
import { ChevronRightIcon, CloseIcon } from './icons'

/**
 * แผ่นเลื่อนขึ้นจากด้านล่าง (bottom sheet) — **ไม่ใช้ JavaScript เลย**
 *
 * ทำไมถึงต้องมี: กติกา UX-1 ข้อ 1 คือทุกหน้าจบในจอเดียว ห้ามเลื่อนแม้แต่ชั้นเนื้อหา
 * ของที่ยาวจริง ๆ (รายละเอียดเกียรติบัตร · ตารางคะแนน 3 แหล่ง · รายการภารกิจทั้งหมด)
 * จึงย้ายมาอยู่ในแผ่นนี้แทนที่จะต่อหน้าให้ยาวขึ้น
 *
 * ทำไมไม่ใช้ JavaScript: หน้าที่ใช้ตัวนี้เป็น server component ทั้งหมด
 * และไฟล์ `-client.tsx` เป็นของ session อื่น
 *
 * กลไก: ลิงก์ `#id` + ตัวเลือก `:target` ของ CSS
 *   - กดปุ่มเปิด → URL กลายเป็น `#sheet-xxx` → แผ่นที่มี id นั้นเลื่อนขึ้น
 *   - กดฉากหลังหรือปุ่มปิด → ลิงก์ไป `#` → ไม่มีอะไร target แผ่นจึงเลื่อนลง
 * ได้ครบทั้ง **กดฉากหลังเพื่อปิด** และ **ใช้คีย์บอร์ดได้** (ลิงก์โฟกัสได้อยู่แล้ว)
 * โดยไม่ต้องดัก Escape เอง ไม่ต้องจัดการโฟกัสเอง ไม่มี state ให้พัง
 *
 * ⚠️ นี่คือที่เดียวในระบบที่ยังมี `overflow-y: auto` ได้ตามกติกา UX-1
 * ⚠️ `id` ต้องไม่ซ้ำกันในหน้าเดียว — ผู้เรียกเป็นคนตั้ง
 */

export type SheetProps = {
  /** id ของแผ่น ต้องไม่ซ้ำในหน้าเดียวกัน */
  id: string
  /** ข้อความบนปุ่มที่กดแล้วเปิดแผ่น */
  trigger: ReactNode
  /** หัวข้อบนแผ่น */
  title: string
  children: ReactNode
  /**
   * หน้าตาปุ่มเปิด
   *  - `button` (ค่าตั้งต้น) แถบเต็มความกว้าง มีลูกศรท้าย ใช้เมื่อเป็นทางเลือกหลักของจอ
   *  - `chip` ชิปกลมเล็กเรียงเป็นแถว ใช้เมื่อมีหลายแผ่นในจอเดียวและพื้นที่แนวตั้งเหลือน้อย
   *  - `card` การ์ดเต็มช่องในตาราง ใช้เมื่อแผ่นแต่ละใบคือ "หัวข้อ" ที่ต้องเลือกด้วยตา
   */
  triggerVariant?: 'button' | 'chip' | 'card'
  /** ไอคอนนำหน้าข้อความบนปุ่มเปิด */
  triggerIcon?: ReactNode
  /** คลาสของปุ่มเปิด */
  triggerClassName?: string
}

export function Sheet({
  id,
  trigger,
  title,
  children,
  triggerVariant = 'button',
  triggerIcon,
  triggerClassName,
}: SheetProps) {
  const chip = triggerVariant === 'chip'
  const card = triggerVariant === 'card'
  return (
    <>
      <a
        href={`#${id}`}
        className={cn(
          'cursor-pointer focus-ring',
          chip &&
            'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-100 px-3 text-label font-bold text-brand-700 hover:bg-brand-200',
          card &&
            'flex h-full min-h-0 w-full flex-col items-center justify-center gap-1 rounded-2xl bg-surface-raised p-3 text-center shadow-soft-1 hover:bg-brand-50',
          !chip && !card &&
            'btn-base w-full rounded-xl bg-surface-raised px-4 text-body font-bold text-brand-700 ring-2 ring-brand-100 ring-inset hover:bg-brand-50',
          triggerClassName,
        )}
      >
        {triggerIcon}
        <span className={cn('min-w-0', !chip && !card && 'flex-1 text-left')}>{trigger}</span>
        {chip || card ? null : <ChevronRightIcon width={20} height={20} aria-hidden className="shrink-0" />}
      </a>

      <div id={id} className="sheet-panel" role="group" aria-label={title}>
        <span aria-hidden="true" className="sheet-grip" />
        <div className="flex shrink-0 items-start justify-between gap-3">
          <h2 className="text-title-sm font-extrabold text-balance text-ink">{title}</h2>
          <a href="#" className="tap-target -mt-1 rounded-full text-ink-muted hover:bg-surface-sunken">
            <CloseIcon width={22} height={22} aria-hidden />
            <span className="sr-only">ปิด{title}</span>
          </a>
        </div>
        <div className="mt-3 min-h-0">{children}</div>
      </div>

      {/* ฉากหลังมืด — ต้องอยู่ "หลังแผ่น" ใน DOM เพื่อให้ตัวเลือก `:target ~` ของ CSS ทำงาน
          ส่วนการวางทับกันใช้ z-index ไม่ใช่ลำดับใน DOM */}
      <a href="#" aria-hidden="true" tabIndex={-1} className="sheet-backdrop" />
    </>
  )
}

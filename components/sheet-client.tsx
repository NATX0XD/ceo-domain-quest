'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon, cn } from '@/components/ui'

/**
 * แผ่นเลื่อนขึ้นจากด้านล่าง (bottom sheet) — ที่เก็บของที่ยาวเกินจอ
 *
 * **ทำไมต้องมี**: เจ้าของโปรเจกต์สั่งว่าหน้าจอ **ห้ามเลื่อนเลย แม้แต่ส่วนเนื้อหา**
 * ทุกจอต้องจบในหน้าเดียวเหมือน mockup ของที่ยาว (คำใบ้ · ความรู้เพิ่มเติม · เกณฑ์ให้คะแนน ·
 * ผลตรวจรายด้าน · หัวข้อด่านบอส) จึงย้ายมาอยู่ในแผ่นนี้ ซึ่งผู้ใช้เป็นคนเปิดเอง
 *
 * ⚠️ **ที่เดียวในระบบที่มีสิทธิ์เลื่อนได้คือข้างในแผ่นนี้** (กติกาของเจ้าของ:
 *    "ไม่มี overflow-y auto ที่ไหน ยกเว้นข้างใน popup/sheet ที่ผู้ใช้เปิดเอง")
 *    ห้ามเอา `overflow-y` ไปใส่กล่องอื่นในหน้าเด็ดขาด
 * ⚠️ ไม่ต้องล็อกการเลื่อนของ body เพราะหน้าไม่เลื่อนอยู่แล้วโดยโครง 100dvh ของ AppShell
 * ⚠️ ไฟล์นี้ไม่มีข้อมูลของผู้เรียนฝังอยู่เลย เป็นภาชนะเปล่า
 */

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** บรรทัดรองใต้ชื่อ เช่น บอกว่าเปิดดูได้ไม่จำกัด ไม่หักดาว */
  description?: string
  children: ReactNode
  className?: string
}

export function Sheet({ open, onClose, title, description, children, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  // ปิดด้วยปุ่ม Esc — เด็กที่ใช้คีย์บอร์ดหรือสวิตช์ต้องออกได้โดยไม่ต้องหาปุ่มกากบาท
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // เปิดแล้วโฟกัสไปที่ปุ่มปิด โปรแกรมอ่านหน้าจอจะได้รู้ว่าย้ายเข้ามาในแผ่นแล้ว
  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* ฉากหลัง — แตะที่ว่างเพื่อปิด เป็นท่าที่มือถือทุกเครื่องทำเหมือนกัน */}
      <button
        type="button"
        aria-label={`ปิด ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[80dvh] w-full flex-col rounded-t-3xl bg-surface shadow-soft-3',
          'animate-rise-in motion-reduce:animate-none',
          className,
        )}
      >
        <div className="flex items-start gap-2 px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1">
            {/* ขีดจับด้านบน บอกว่านี่คือแผ่นที่ปิดได้ ไม่ใช่หน้าใหม่ */}
            <span aria-hidden="true" className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-line" />
            <h2 className="text-title-sm font-extrabold text-balance text-ink">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-label text-pretty text-ink-muted">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="tap-target -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-sunken focus-ring"
          >
            <CloseIcon width={22} height={22} aria-hidden />
          </button>
        </div>

        {/**
         * ชั้นเดียวในระบบที่เลื่อนได้ — และเลื่อนเฉพาะตอนผู้ใช้เปิดแผ่นนี้เอง
         * overscroll-contain กันไม่ให้การเลื่อนทะลุไปโดนหน้าข้างหลัง
         */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
      </div>
    </div>
  )
}

export interface SheetChipProps {
  onClick: () => void
  icon?: ReactNode
  children: ReactNode
  /** สีของชิป — แต่ละตัวช่วยมีสีของตัวเอง ไม่ใช่กล่องม่วงเหมือนกันหมด */
  tone?: 'spark' | 'brand' | 'quest' | 'danger' | 'plain'
  disabled?: boolean
  /** ตัวเลขมุมขวา เช่น จำนวนคำใบ้ที่เปิดแล้ว */
  badge?: string | null
  /**
   * คำอ่านเต็มของชิปนี้ — ตัวเลขอย่าง "1/3" บนหน้าจอเล็กเกินจะอธิบายตัวเอง
   * (reviewer เจอว่าเด็กอ่าน "ดูคำใบ้ 1/3" แล้วไม่รู้ว่า 1/3 คืออะไร · flow-1.md ข้อ 25)
   */
  ariaLabel?: string
  className?: string
}

const CHIP_TONE: Record<NonNullable<SheetChipProps['tone']>, string> = {
  spark: 'bg-spark-50 text-spark-700 ring-spark-200 hover:bg-spark-100',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100',
  quest: 'bg-quest-50 text-quest-700 ring-quest-100 hover:bg-quest-100',
  danger: 'bg-danger-100 text-danger-700 ring-danger-600 hover:bg-danger-100',
  plain: 'bg-surface-raised text-ink ring-line hover:bg-surface-sunken',
}

/**
 * ชิปตัวช่วย — เล็กพอให้เรียง 2x2 ได้ในจอ 390 แต่ยังสูงถึง 44 จุดภาพตามเกณฑ์นิ้วมือ
 * แต่ละตัวมีไอคอนกับสีของตัวเอง (mockup) ไม่ใช่กล่องม่วงเหมือนกันหมด
 */
export function SheetChip({
  onClick,
  icon,
  children,
  tone = 'plain',
  disabled = false,
  badge = null,
  ariaLabel,
  className,
}: SheetChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'btn-base min-h-11 w-full justify-start gap-1.5 rounded-xl px-2.5 text-label font-bold ring-1 ring-inset',
        'disabled:cursor-not-allowed disabled:opacity-55',
        CHIP_TONE[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {badge ? <span className="shrink-0 tabular-nums opacity-80">{badge}</span> : null}
    </button>
  )
}

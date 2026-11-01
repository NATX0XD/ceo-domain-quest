'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * กล่องซ้อน (popup) ของแผงครู — **ของตัวเองใต้ app/teacher/**
 *
 * ทำไมไม่ใช้ของกลางใน components/ui: รอบนี้ session design กำลังรื้อ components/ui อยู่
 * มติจึงเป็นทำของตัวเองไปก่อน แล้วค่อยยุบรวมทีหลัง (เขียนไว้ในไฟล์ผล UX-3)
 *
 * กติกาที่กล่องนี้ต้องทำให้ได้:
 * - หน้าแผงครูห้ามเลื่อน ของยาว ๆ จึงต้องมาอยู่ในนี้ **แล้วให้เลื่อนเฉพาะข้างในกล่อง**
 * - ปิดได้ด้วย Esc · กดพื้นหลัง · ปุ่มปิดขนาดแตะได้ 44 จุดภาพ
 * - เปิดแล้วโฟกัสเข้ามาในกล่อง ปิดแล้วโฟกัสกลับไปที่ปุ่มเดิม (ครูใช้คีย์บอร์ดบนโน้ตบุ๊ก)
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  /** 'md' สำหรับแผงทั่วไป · 'lg' สำหรับคิวตรวจงานที่มีของยาว */
  size = 'md',
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'md' | 'lg'
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openerRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="teacher-cms-dialog"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div aria-hidden className="teacher-cms-dialog__scrim" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-size={size}
        className="teacher-cms-dialog__panel"
      >
        <div className="teacher-cms-dialog__head">
          <div className="min-w-0 flex-1">
            <h2 className="teacher-cms-dialog__title">{title}</h2>
            {description ? <p className="teacher-cms-dialog__desc">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="teacher-cms-dialog__close focus-ring"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        {/* ชั้นเดียวในกล่องที่เลื่อนได้ — หน้าข้างนอกยังไม่เลื่อน */}
        <div className="teacher-cms-dialog__body">{children}</div>
      </div>
    </div>
  )
}

/**
 * ปุ่มของงานที่ย้อนไม่ได้ — ต้องกดสองจังหวะเสมอ
 * จังหวะแรกเปลี่ยนเป็นคำถาม จังหวะที่สองถึงลงมือจริง (กติกาเดียวกับปุ่มปิดคาบเดิม)
 */
export function DangerButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  confirming,
  onArm,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
  confirming: boolean
  onArm: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (confirming ? onConfirm() : onArm())}
      data-block="true"
      data-kind={confirming ? 'dangerfill' : 'danger'}
      style={{ whiteSpace: 'normal', paddingBlock: '0.5rem' }}
      className="t2-btn focus-ring"
    >
      {confirming ? confirmLabel : label}
    </button>
  )
}

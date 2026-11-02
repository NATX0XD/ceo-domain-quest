'use client'

import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from '../../../components/ui'

/** ชิ้นส่วนหน้าตาแบบ CMS ของแดชบอร์ดครู — ชิปกรอง · ลิ้นชักรายละเอียดด้านขวา (การ์ดตัวเลขอยู่ที่ ./v2) */

export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-note font-bold text-ink-muted">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="t2-tab focus-ring"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** ลิ้นชักด้านขวา (จอกว้างกว้าง 480px · จอแคบเต็มจอ) ปิดด้วย Esc หรือกดฉากหลัง */
export function SideDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="ปิดรายละเอียด" className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-[480px] flex-col shadow-soft-3"
        style={{ background: '#fff' }}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
          <h2 className="min-w-0 truncate text-title-sm font-extrabold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid size-11 place-items-center rounded-full bg-white text-ink ring-1 ring-line-contrast hover:bg-surface-sunken focus-ring"
          >
            <CloseIcon width={22} height={22} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}

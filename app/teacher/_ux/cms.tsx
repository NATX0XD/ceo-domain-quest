'use client'

import { useEffect, type ReactNode } from 'react'
import { CloseIcon, cn } from '../../../components/ui'

/** ชิ้นส่วนหน้าตาแบบ CMS ของแดชบอร์ดครู — การ์ดตัวเลข · ชิปกรอง · ลิ้นชักรายละเอียดด้านขวา */

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
}

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'good' | 'warn'
}) {
  return (
    <div className="rounded-xl bg-surface-raised p-4 shadow-soft-1 ring-1 ring-line">
      <p className="text-note font-bold text-ink-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-title font-extrabold tabular-nums',
          tone === 'good' ? 'text-quest-700' : tone === 'warn' ? 'text-spark-700' : 'text-ink',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-note text-ink-muted">{hint}</p> : null}
    </div>
  )
}

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
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="text-note font-bold text-ink-muted">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-9 rounded-full px-3 text-note font-bold ring-1 transition-colors focus-ring',
            value === o.value
              ? 'bg-brand-600 text-ink-onbrand ring-brand-600'
              : 'bg-surface-raised text-ink-muted ring-line hover:bg-surface-sunken',
          )}
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
      <div className="relative flex h-full w-full max-w-[480px] flex-col bg-surface-raised shadow-soft-3">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <h2 className="min-w-0 truncate text-body font-extrabold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid size-11 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken focus-ring"
          >
            <CloseIcon width={22} height={22} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

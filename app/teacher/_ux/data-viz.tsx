'use client'

import type { ReactNode } from 'react'
import { missionColor, STATUS_LABEL, type PassStatus } from './ui'

/**
 * กราฟแท่งสำหรับข้อมูลของแดชบอร์ดครู — สีมาจากโทเคนสีข้อมูล (--d-* / --m*) เท่านั้น
 * ทุกแท่งมีตัวเลขกำกับ ไม่พึ่งสีอย่างเดียว
 */

/** แท่งแนวนอนหนึ่งค่า (0–max) สีเดียว + ตัวเลขชัด + เส้นเกณฑ์ (ถ้ามี) */
export function ColorBar({
  label,
  value,
  display,
  color,
  max = 100,
  sub,
  threshold,
  mark,
}: {
  label: ReactNode
  value: number
  display?: string
  color: string
  max?: number
  sub?: ReactNode
  /** เส้นเกณฑ์ (ในหน่วยเดียวกับ value) */
  threshold?: number
  /** ป้ายสถานะถัดจากตัวเลข */
  mark?: ReactNode
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0))
  const tpct = threshold === undefined ? null : Math.max(0, Math.min(100, (threshold / max) * 100))
  const shown = display ?? `${Math.round(pct)}%`
  return (
    <li className="min-w-0">
      <div className="flex items-center justify-between gap-3 text-[15px] leading-6">
        <span className="flex min-w-0 items-center gap-2 text-[var(--c-ink)]">{label}</span>
        <span className="flex shrink-0 items-center gap-2 font-semibold text-[var(--c-ink)] tabular-nums">
          {shown}
          {mark}
        </span>
      </div>
      <div
        className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--c-sunken)]"
        role="img"
        aria-label={`${typeof label === 'string' ? label : 'ค่า'} ${shown}`}
      >
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        {tpct !== null ? (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-[var(--c-ink)]/60"
            style={{ left: `${tpct}%` }}
          />
        ) : null}
      </div>
      {sub ? <p className="mt-1 text-[13px] leading-5 text-[var(--c-ink-3)]">{sub}</p> : null}
    </li>
  )
}

export function BarList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-4">{children}</ul>
}

/** ป้ายด่านมีสี่เหลี่ยมสีประจำด่านนำหน้า (ไม่ใช้พื้นสีเต็ม) */
export function MissionTag({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: missionColor(n) }} />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** แท่งซ้อน ผ่าน / กำลังเรียน / ยังไม่เริ่ม ของหนึ่งด่าน (หน่วย: คน) */
export function StackBar({
  label,
  segments,
  total,
}: {
  label: ReactNode
  segments: { status: PassStatus; count: number }[]
  total: number
}) {
  const text = segments.map((s) => `${STATUS_LABEL[s.status]} ${s.count}`).join(' · ')
  return (
    <li className="min-w-0">
      <div className="flex items-center justify-between gap-3 text-[15px] leading-6">
        <span className="flex min-w-0 items-center gap-2 text-[var(--c-ink)]">{label}</span>
        <span className="shrink-0 text-[13px] text-[var(--c-ink-3)] tabular-nums">{text}</span>
      </div>
      <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-[var(--c-sunken)]" role="img" aria-label={`${typeof label === 'string' ? label : 'ด่าน'}: ${text}`}>
        {total > 0
          ? segments.map((s) =>
              s.count > 0 ? (
                <span
                  key={s.status}
                  className="h-full border-r border-white last:border-r-0"
                  style={{ width: `${(s.count / total) * 100}%`, background: `var(--d-${s.status})` }}
                />
              ) : null,
            )
          : null}
      </div>
    </li>
  )
}

/** แท่งกระจายตัว 1–5 (Likert) ไล่โทนเดียวจากอ่อนไปเข้ม */
const LIKERT = ['#e0d9f3', '#bdb0e4', '#917dc9', '#6a55a8', '#4b3a7a']
export function LikertDist({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div>
      <div
        className="flex h-32 items-end gap-3"
        role="img"
        aria-label={items.map((i) => `${i.label}: ${i.value}`).join(' · ')}
      >
        {items.map((i, idx) => (
          <div key={i.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[13px] font-semibold text-[var(--c-ink)] tabular-nums">{i.value}</span>
            <span
              className="w-full rounded-t-md"
              style={{ height: `${Math.max(4, (i.value / max) * 80)}%`, background: LIKERT[idx] ?? LIKERT[4] }}
            />
            <span className="text-[13px] text-[var(--c-ink-3)]">{i.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 flex justify-between text-[13px] text-[var(--c-ink-3)]">
        <span>1 = น้อยที่สุด</span>
        <span>5 = มากที่สุด</span>
      </p>
    </div>
  )
}

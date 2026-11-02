'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { InfoTip } from './v2'

/**
 * UI primitives ของแดชบอร์ดครู (redesign C1) — แหล่งเดียวของ Card / StatTile / DataTable / StatusBadge /
 * ฟอร์ม / Tabs / EmptyState / Toast / Skeleton / Legend · สีอ่านจากโทเคนใน teacher-v2.css (`.teacher-cms`)
 * สีข้อมูลต้องมีข้อความกำกับเสมอ ห้ามใช้สีอย่างเดียว
 */

export { Dialog } from './dialog'
export { SideDrawer as Drawer } from './cms'

const cx = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(' ')

/* ───────────────────────── data palette ───────────────────────── */

export type PassStatus = 'passed' | 'inprogress' | 'atrisk' | 'failed' | 'notstarted'

export const STATUS_LABEL: Record<PassStatus, string> = {
  passed: 'ผ่าน',
  inprogress: 'กำลังเรียน',
  atrisk: 'เสี่ยง',
  failed: 'ไม่ผ่าน',
  notstarted: 'ยังไม่เริ่ม',
}

/** เกณฑ์เดียวของทั้งแดชบอร์ด: ≥80% ผ่าน · 50–79% เสี่ยง · <50% ไม่ผ่าน */
export function statusFromRate(rate: number): PassStatus {
  return rate >= 0.8 ? 'passed' : rate >= 0.5 ? 'atrisk' : 'failed'
}

export const STATUS_RATE_LEGEND = 'ผ่าน ≥80% · เสี่ยง 50–79% · ไม่ผ่าน <50%'

export type EffectLevel = 'low' | 'mid' | 'high'
export const EFFECT_LABEL: Record<EffectLevel, string> = { low: 'น้อย', mid: 'ปานกลาง', high: 'ใหญ่' }

/** สีประจำด่าน (1–5 และ CEO = 6) ใช้ซ้ำทุกหน้า */
export const missionColor = (n: number) => `var(--m${Math.min(Math.max(Math.round(n), 1), 6)})`
export const missionSoft = (n: number) => `var(--m${Math.min(Math.max(Math.round(n), 1), 6)}-soft)`

/* ───────────────────────── Card ───────────────────────── */

export function Card({
  title,
  tip,
  action,
  children,
  className,
  flush,
}: {
  title?: ReactNode
  tip?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  /** true = ไม่ใส่ padding ให้เนื้อหา (ตารางเต็มกว้าง) */
  flush?: boolean
}) {
  return (
    <section
      className={cx(
        'rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] shadow-[var(--sh-1)]',
        className,
      )}
    >
      {title || action ? (
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--c-line)] px-4 py-3 sm:px-5">
          <h2 className="flex min-w-0 items-center gap-2 text-[16px] leading-6 font-semibold text-[var(--c-ink)]">
            <span className="truncate">{title}</span>
            {tip ? <InfoTip text={tip} /> : null}
          </h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={flush ? '' : 'p-4 sm:p-5'}>{children}</div>
    </section>
  )
}

/* ───────────────────────── StatusBadge ───────────────────────── */

export function StatusBadge({
  status,
  children,
  className,
}: {
  status: PassStatus
  children?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] leading-5 font-medium whitespace-nowrap',
        className,
      )}
      style={{ background: `var(--d-${status}-soft)`, color: `var(--d-${status}-ink)` }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: `var(--d-${status})` }} />
      {children ?? STATUS_LABEL[status]}
    </span>
  )
}

export function LevelBadge({ level, children }: { level: EffectLevel; children?: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[13px] leading-5 font-medium whitespace-nowrap"
      style={{ background: `var(--d-lv-${level})`, color: `var(--d-lv-${level}-ink)` }}
    >
      {children ?? EFFECT_LABEL[level]}
    </span>
  )
}

/* ───────────────────────── StatTile ───────────────────────── */

export function StatTile({
  label,
  value,
  unit,
  icon,
  badge,
  hint,
}: {
  label: string
  value: ReactNode
  unit?: string
  /** ไอคอน 3 มิติ 28–32px */
  icon?: ReactNode
  badge?: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--c-line)] bg-[var(--c-surface)] p-4 shadow-[var(--sh-1)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] leading-6 text-[var(--c-ink-3)]">{label}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[28px] leading-9 font-bold text-[var(--c-ink)] tabular-nums">
            <span className="break-words">{value}</span>
            {unit ? <span className="text-[14px] font-medium text-[var(--c-ink-3)]">{unit}</span> : null}
          </p>
        </div>
        {icon ? (
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--c-sunken)]">
            {icon}
          </span>
        ) : null}
      </div>
      {badge || hint ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-[var(--c-ink-3)]">
          {badge}
          {hint ? <span>{hint}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

/* ───────────────────────── DataTable ───────────────────────── */

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** ตัวเลข = ชิดขวา + tabular-nums */
  numeric?: boolean
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  caption,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: ReactNode
  caption?: string
}) {
  if (rows.length === 0 && empty) return <>{empty}</>
  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[15px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 z-[1] bg-[var(--c-sunken)] text-[13px] font-semibold text-[var(--c-ink-3)]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx('px-4 py-2.5 whitespace-nowrap', c.numeric && 'text-right', c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="h-12 border-b border-[var(--c-line)] last:border-b-0 hover:bg-[#faf9f6]"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cx('px-4 py-2 text-[var(--c-ink)]', c.numeric && 'text-right tabular-nums', c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ───────────────────────── Legend ───────────────────────── */

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--c-ink-2)]">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export const STATUS_LEGEND = (['passed', 'inprogress', 'atrisk', 'failed', 'notstarted'] as PassStatus[]).map((s) => ({
  color: `var(--d-${s})`,
  label: STATUS_LABEL[s],
}))

/* ───────────────────────── Buttons ───────────────────────── */

export function Button({
  kind = 'secondary',
  size = 'md',
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}) {
  const tone =
    kind === 'primary'
      ? 'bg-[var(--c-brand)] text-white border-[var(--c-brand)] hover:bg-[var(--c-brand-hover)]'
      : kind === 'danger'
        ? 'bg-white text-[var(--s-danger-ink)] border-[var(--s-danger)] hover:bg-[var(--s-danger-soft)]'
        : kind === 'ghost'
          ? 'bg-transparent text-[var(--c-ink-2)] border-transparent hover:bg-[var(--c-sunken)]'
          : 'bg-white text-[var(--c-ink)] border-[var(--c-line-strong)] hover:bg-[var(--c-sunken)]'
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-9 px-3 text-[14px]' : 'h-10 px-4 text-[15px]',
        tone,
        className,
      )}
    />
  )
}

/* ───────────────────────── Form rows ───────────────────────── */

export function Field({
  label,
  help,
  error,
  children,
  htmlFor,
}: {
  label: string
  help?: ReactNode
  error?: string | null
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[14px] font-medium text-[var(--c-ink)]">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[14px] text-[var(--s-danger-ink)]">
          {error}
        </p>
      ) : help ? (
        <p className="text-[14px] text-[var(--c-ink-3)]">{help}</p>
      ) : null}
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'h-10 w-full rounded-lg border border-[var(--c-line-strong)] bg-white px-3 text-[15px] text-[var(--c-ink)] outline-none focus:border-[var(--c-brand)] focus:ring-2 focus:ring-[var(--c-brand-ring)] disabled:bg-[var(--c-sunken)]',
        props.className,
      )}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: ReactNode
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label id={id} className="text-[15px] font-medium text-[var(--c-ink)]">
          {label}
        </label>
        {description ? <p className="text-[14px] text-[var(--c-ink-3)]">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none disabled:opacity-50"
        style={{ background: checked ? 'var(--s-success)' : 'var(--c-line-strong)' }}
      >
        <span
          aria-hidden
          className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(20px)' : 'none' }}
        />
      </button>
    </div>
  )
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  label: string
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2">
      <Button size="sm" aria-label={`ลด${label}`} disabled={value <= min} onClick={() => set(value - step)}>
        −
      </Button>
      <span className="min-w-12 text-center text-[16px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button size="sm" aria-label={`เพิ่ม${label}`} disabled={value >= max} onClick={() => set(value + step)}>
        +
      </Button>
      {unit ? <span className="text-[14px] text-[var(--c-ink-3)]">{unit}</span> : null}
    </div>
  )
}

/* ───────────────────────── Tabs / Segmented ───────────────────────── */

/** แท็บขีดเส้นใต้ — แทนชิปแบบเม็ดยา */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode; count?: number }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-[var(--c-line)]">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              '-mb-px h-11 shrink-0 border-b-2 px-3 text-[15px] whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none',
              on
                ? 'border-[var(--c-brand)] font-semibold text-[var(--c-brand)]'
                : 'border-transparent font-medium text-[var(--c-ink-3)] hover:text-[var(--c-ink)]',
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span className="ml-1.5 rounded-md bg-[var(--c-sunken)] px-1.5 text-[13px] tabular-nums">{o.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-[var(--c-sunken)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 rounded-md px-3 text-[14px] font-medium focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none',
            o.value === value ? 'bg-white text-[var(--c-ink)] shadow-[var(--sh-1)]' : 'text-[var(--c-ink-3)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ───────────────────────── EmptyState ───────────────────────── */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span aria-hidden className="mb-1 grid size-10 place-items-center rounded-lg bg-[var(--c-sunken)]">
        {icon}
      </span>
      <p className="text-[16px] font-semibold text-[var(--c-ink)]">{title}</p>
      {body ? <p className="max-w-sm text-[14px] text-[var(--c-ink-3)]">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/* ───────────────────────── Skeleton ───────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('t2-skel', className)} />
}

/* ───────────────────────── Toast ───────────────────────── */

type ToastKind = 'success' | 'danger' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {})

export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((cur) => [...cur, { id, kind, text }])
    window.setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000)
  }, [])
  const mark = { success: '✓', danger: '!', info: 'i' } as const
  return (
    <ToastCtx.Provider value={useMemo(() => push, [push])}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[70] grid gap-2" role="region" aria-label="การแจ้งเตือน">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'danger' ? 'alert' : 'status'}
            className="t2-toast pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg border border-[var(--c-line)] bg-white py-2.5 pr-4 pl-3 text-[15px] shadow-[var(--sh-pop)]"
            style={{ borderLeft: `4px solid var(--s-${t.kind})` }}
          >
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
              style={{ background: `var(--s-${t.kind})` }}
            >
              {mark[t.kind]}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** ปิดด้วย Esc — ใช้กับเมนูลอยเล็ก ๆ */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onEscape()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [active, onEscape])
}

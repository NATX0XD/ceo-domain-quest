'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'

/**
 * ชิ้นส่วนหน้าตา "visual v2" ของแดชบอร์ดครู — การ์ดพาสเทล + ไอคอน 3 มิติ + กราฟแทนประโยค
 * สไตล์อยู่ที่ `app/teacher/teacher-v2.css` (ขอบเขต `.teacher-cms` เท่านั้น)
 *
 * ไอคอน 3 มิติ: Microsoft Fluent Emoji 3D (MIT) แปลงเป็น WebP ที่ `public/icons/3d/`
 */

export type Icon3dName =
  | 'alarm-clock'
  | 'bar-chart'
  | 'bell'
  | 'books'
  | 'brain'
  | 'bullseye'
  | 'bust-in-silhouette'
  | 'busts-in-silhouette'
  | 'chart-increasing'
  | 'check-mark-button'
  | 'chequered-flag'
  | 'clipboard'
  | 'crown'
  | 'door'
  | 'eyes'
  | 'fire'
  | 'gear'
  | 'glowing-star'
  | 'graduation-cap'
  | 'handshake'
  | 'hourglass-not-done'
  | 'light-bulb'
  | 'locked'
  | 'magnifying-glass-tilted-left'
  | 'memo'
  | 'package'
  | 'performing-arts'
  | 'printer'
  | 'robot'
  | 'rocket'
  | 'school'
  | 'seedling'
  | 'sparkles'
  | 'star'
  | 'party-popper'
  | 'counterclockwise-arrows-button'
  | 'speech-balloon'
  | 'stopwatch'
  | 'television'
  | 'trophy'
  | 'warning'

/** ไอคอน 3 มิติแบบตกแต่ง (alt ว่าง) — ความหมายต้องมีตัวหนังสือกำกับข้าง ๆ เสมอ */
export function Icon3d({ name, size = 40, className }: { name: Icon3dName; size?: number; className?: string }) {
  return (
    <Image
      src={`/icons/3d/${name}.webp`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized
      draggable={false}
      className={`t2-ico${className ? ` ${className}` : ''}`}
    />
  )
}

/** ชื่อหน้า — คำสุดท้ายอยู่บนป้ายเหลืองเอียงเล็กน้อย */
export function HighlightTitle({ title }: { title: string }) {
  const parts = title.trim().split(/\s+/)
  const last = parts.length > 1 ? parts.pop() : null
  return (
    <h1 className="t2-title">
      {last ? `${parts.join(' ')} ` : null}
      <span className="t2-hl">{last ?? title}</span>
    </h1>
  )
}

/** ข้อมูลเสริมที่ไม่ต้องกางให้เห็นตลอด — กดเพื่ออ่าน · Esc/กดที่อื่นเพื่อปิด */
export function InfoTip({
  text,
  label = 'ดูรายละเอียด',
  align = 'start',
}: {
  text: ReactNode
  label?: string
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <span ref={ref} className="t2-tip">
      <button
        type="button"
        className="t2-tip__btn focus-ring"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>i</span>
      </button>
      {open ? (
        <span id={id} role="tooltip" className="t2-tip__pop" data-align={align}>
          {text}
        </span>
      ) : null}
    </span>
  )
}

export type Tone = 'yellow' | 'lilac' | 'mint' | 'peach' | 'sky' | 'rose'

/** การ์ดตัวเลขพาสเทล — ไอคอน 3 มิติหนึ่งชิ้น + ตัวเลขใหญ่ + ป้ายสั้น */
function isLong(v: ReactNode) {
  return typeof v === 'string' && v.length > 7
}

export function Kpi({
  label,
  value,
  unit,
  hint,
  tone,
  icon,
  tip,
  href,
  onClick,
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: string
  tone: Tone
  icon: Icon3dName
  tip?: string
  href?: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className="t2-kpi__top">
        <Icon3d name={icon} size={44} />
        <span className="t2-kpi__value" data-long={isLong(value) ? 'true' : undefined}>
          {value}
          {unit ? <small>{unit}</small> : null}
        </span>
      </span>
      <span>
        <span className="t2-kpi__label">{label}</span>
        {hint ? <span className="t2-kpi__hint block">{hint}</span> : null}
      </span>
    </>
  )
  if (href) {
    // ลิงก์ล้วน — ไม่ซ้อนปุ่มข้างใน (tip ใช้ได้เฉพาะการ์ดที่ไม่กด)
    return (
      <Link href={href} className="t2-kpi focus-ring" data-tone={tone}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="t2-kpi focus-ring" data-tone={tone}>
        {inner}
      </button>
    )
  }
  return (
    <div className="t2-kpi" data-tone={tone}>
      {inner}
      {tip ? (
        <span className="absolute right-2 bottom-2">
          <InfoTip text={tip} align="end" />
        </span>
      ) : null}
    </div>
  )
}

export function KpiGrid({ children, cols }: { children: ReactNode; cols?: 3 | 5 | 6 }) {
  return (
    <div className="t2-kpis" data-cols={cols}>
      {children}
    </div>
  )
}

export const BAR_COLOR = {
  blue: 'var(--t2-blue)',
  purple: 'var(--t2-purple)',
  coral: 'var(--t2-coral)',
  green: 'var(--t2-green)',
  gold: 'var(--t2-gold)',
  red: 'var(--t2-red)',
} as const
export type BarColor = keyof typeof BAR_COLOR

/** แถบความคืบหน้าสีเดียว — ป้าย + ตัวเลขชัด ไม่พึ่งสีอย่างเดียว */
export function Bar({
  label,
  value,
  display,
  color = 'purple',
  max = 100,
  sub,
}: {
  label: ReactNode
  value: number
  display?: string
  color?: BarColor
  max?: number
  sub?: ReactNode
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0))
  return (
    <li>
      <div className="t2-bar__row">
        <span className="t2-bar__tag">{label}</span>
        <b>{display ?? `${Math.round(pct)}%`}</b>
      </div>
      <div
        className="t2-bar__track"
        role="img"
        aria-label={`${typeof label === 'string' ? label : 'ค่า'} ${display ?? `${Math.round(pct)}%`}`}
      >
        <span className="t2-bar__fill" style={{ width: `${pct}%`, background: BAR_COLOR[color] }} />
      </div>
      {sub ? <div className="t2-kpi__hint mt-1">{sub}</div> : null}
    </li>
  )
}

export function Bars({ children }: { children: ReactNode }) {
  return <ul className="t2-bars">{children}</ul>
}

/** เรดาร์หลายแกน (ค่า 0-100) — ใช้กับความเข้าใจรายภารกิจ */
export function Radar({
  axes,
  title,
  scale = 100,
}: {
  axes: { label: string; sub?: string; value: number; value2?: number }[]
  title: string
  /** ค่าที่ขอบนอกสุดของวง (ร้อยละ) — ห้องที่ค่าน้อยทุกแกนจะได้ไม่เป็นจุดเล็กกลางวง */
  scale?: number
}) {
  const W = 440
  const H = 300
  const cx = W / 2
  const cy = H / 2 + 4
  const R = 96
  const k = 100 / Math.max(1, scale)
  const n = axes.length
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const
  }
  const ring = (f: number) => axes.map((_, i) => pt(i, R * f).join(',')).join(' ')
  const shape = axes.map((a, i) => pt(i, (R * Math.max(5, Math.min(100, a.value * k))) / 100).join(',')).join(' ')
  const hasSecond = axes.some((a) => a.value2 !== undefined)
  const shape2 = axes.map((a, i) => pt(i, (R * Math.max(5, Math.min(100, (a.value2 ?? 0) * k))) / 100).join(',')).join(' ')
  const summary = axes.map((a) => `${a.label} ${Math.round(a.value)}%`).join(' · ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="t2-radar" role="img" aria-label={`${title}: ${summary}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill={f === 1 ? '#fffdf5' : 'none'} stroke="#e3ddcd" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e3ddcd" strokeWidth="1" />
      })}
 {hasSecond ? (
        <polygon points={shape2} fill="rgb(74 152 201 / 0.18)" stroke="#4a98c9" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
      ) : null}
      <polygon points={shape} fill="rgb(240 184 35 / 0.38)" stroke="#d9a010" strokeWidth="2.5" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, (R * Math.max(5, Math.min(100, a.value * k))) / 100)
        return <circle key={a.label} cx={x} cy={y} r="5" fill="#fff" stroke="#d9a010" strokeWidth="2.5" />
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 18)
        const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end'
        const dy = y < cy - 4 ? -6 : y > cy + 4 ? 14 : 4
        return (
          <g key={`l${a.label}`}>
            <text x={x} y={y + dy} textAnchor={anchor} fontSize="14">
              {a.label}
            </text>
            <text x={x} y={y + dy + 15} textAnchor={anchor} fontSize="13" className="t2-radar__sub">
              {a.sub ?? `${Math.round(a.value)}%`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** แท่งกระจายตัว (เช่น ความพึงพอใจ 1→5) */
export function Distribution({
  items,
  color = 'var(--t2-purple)',
}: {
  items: { label: string; value: number }[]
  color?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div
      className="t2-dist"
      role="img"
      aria-label={items.map((i) => `${i.label}: ${i.value}`).join(' · ')}
    >
      {items.map((i) => (
        <div key={i.label} className="t2-dist__col">
          <span>{i.value}</span>
          <i style={{ height: `${Math.max(4, (i.value / max) * 100)}%`, background: color }} />
          <span className="t2-dist__lbl">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Chip({
  tone,
  children,
  title,
}: {
  tone?: 'red' | 'orange' | 'yellow' | 'green' | 'lilac' | 'sky'
  children: ReactNode
  title?: string
}) {
  return (
    <span className="t2-chip" data-tone={tone} title={title}>
      {children}
    </span>
  )
}

/** กล่องสรุปเล็กในหน้าต่างรายละเอียด — ไอคอน + ป้าย + ค่า */
export function Fact({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: ReactNode
  icon?: Icon3dName
  tone?: Tone
}) {
  return (
    <div className="t2-fact" data-tone={tone}>
      {icon ? <Icon3d name={icon} size={32} /> : null}
      <div className="min-w-0">
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  )
}

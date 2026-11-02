'use client'

/**
 * โครงจอภารกิจที่ 3 แบบเดียวกับสตอรีบอร์ดภารกิจที่ 2
 * ฉากเต็มจอ · ป้ายไม้ชื่อภารกิจ · ปุ่มกลมย้อนกลับ/เสียง · แผงครีม · โดมพร้อมฟองคำพูด · ปุ่มหลักมันวาว
 * พร้อมตัวช่วยลากวาง (pointer events ใช้ได้ทั้งนิ้วและเมาส์) และแตะเลือกแทนการลากได้
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/components/ui'
import { GameHeader } from '@/components/learn/game-header'
import './counter-flow.css'

export const M3_ASSET = {
  back: '/learn/m3/kit/icon_back.webp',
  sound: '/learn/m3/kit/icon_sound.webp',
  dome: '/learn/m3/kit/dome_cheer.webp',
  building: '/learn/m3/domain-building.webp',
  counterBg: '/learn/m3/bg-counter.webp',
  hand: '/ui/map/pointer-hand.webp',
  icon: (name: string) => `/icons/3d/${name}.webp`,
}

/* ---------- เสียงสั้น ๆ (สร้างด้วย WebAudio ไม่ต้องมีไฟล์) ---------- */

let muted = false
let ctx: AudioContext | null = null
type Sfx = 'tap' | 'ok' | 'bad' | 'stamp' | 'win'
const NOTES: Record<Sfx, [number, number][]> = {
  tap: [[660, 0.05]],
  ok: [[660, 0.07], [990, 0.12]],
  bad: [[220, 0.14], [180, 0.16]],
  stamp: [[140, 0.12]],
  win: [[523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.2]],
}

/** สถานะเสียงของภารกิจ 3 (จำใน localStorage 'm3-sound') ใช้ร่วมทุกจอ */
export function useM3Sound(): [boolean, () => void] {
  const [soundOn, setSoundOn] = useState(!muted)
  useEffect(() => {
    if (window.localStorage.getItem('m3-sound') === '0') {
      muted = true
      setSoundOn(false)
    }
  }, [])
  const toggle = () => {
    muted = soundOn
    window.localStorage.setItem('m3-sound', soundOn ? '0' : '1')
    setSoundOn(!soundOn)
    if (!soundOn) sfx('tap')
  }
  return [soundOn, toggle]
}

export function sfx(kind: Sfx) {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(kind === 'bad' ? [20, 40, 20] : 10)
  if (muted || typeof window === 'undefined') return
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    let t = ctx.currentTime
    for (const [freq, dur] of NOTES[kind]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = kind === 'stamp' || kind === 'bad' ? 'square' : 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + dur + 0.02)
      t += dur * 0.85
    }
  } catch {
    /* เสียงเป็นของแถม ถ้าเล่นไม่ได้ก็ข้าม */
  }
}

/**
 * นาฬิกาติ๊กตื่นเต้นช่วงท้าย (ใช้ร่วมด่าน 3 และ 4) — สร้างด้วย WebAudio ไม่ต้องมีไฟล์
 * เหลือ ≤ `from` วินาทีและ `active` = ติ๊กทุกวินาที เร่งเป็น 2 และ 4 ครั้ง/วินาทีเมื่อใกล้ศูนย์
 * ปิดเสียงตามปุ่มเสียงของเกม · หยุดทันทีเมื่อ active เป็น false (ตัดสิน/หมดเวลา/ออกจากจอ)
 * คืนค่า true เมื่ออยู่ในช่วงเร่งด่วน (ใช้ทำชิปเวลากะพริบแดง)
 */
export function useUrgentTick(secondsLeft: number | null | undefined, active: boolean, from = 10): boolean {
  const urgent = active && secondsLeft != null && secondsLeft > 0 && secondsLeft <= from
  useEffect(() => {
    if (!urgent || secondsLeft == null || muted || typeof window === 'undefined') return
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const nodes: OscillatorNode[] = []
    try {
      ctx ??= new AC()
      const c = ctx
      if (c.state === 'suspended') void c.resume().catch(() => {})
      const n = secondsLeft <= 3 ? 4 : secondsLeft <= 6 ? 2 : 1
      const vol = secondsLeft <= 3 ? 0.11 : 0.07
      for (let i = 0; i < n; i++) {
        const t = c.currentTime + 0.02 + i / n
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'square'
        osc.frequency.value = i % 2 === 0 ? 1560 : 1170
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.004)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
        osc.connect(gain).connect(c.destination)
        osc.start(t)
        osc.stop(t + 0.06)
        nodes.push(osc)
      }
    } catch {
      /* เสียงเป็นของแถม */
    }
    return () => {
      for (const o of nodes) {
        try {
          o.stop()
        } catch {
          /* หยุดไปแล้ว */
        }
      }
    }
  }, [urgent, secondsLeft])
  return urgent
}

/* ---------- โครงจอ ---------- */

export function M3Stage({
  title = 'ภารกิจที่ 3',
  pill,
  onBack,
  bg = 'scene',
  children,
  dock,
  className,
  label,
}: {
  title?: string
  pill?: ReactNode
  onBack?: () => void
  bg?: 'scene' | 'counter' | 'dim'
  children: ReactNode
  dock?: ReactNode
  className?: string
  label?: string
}) {
  const router = useRouter()
  const [soundOn, toggleSound] = useM3Sound()
  const [confirm, setConfirm] = useState(false)
  const dialog = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (confirm && !d.open) d.showModal()
    if (!confirm && d.open) d.close()
  }, [confirm])

  return (
    <div className={cn('m3s', `m3s--${bg}`, className)} aria-label={label}>
      <div className="m3s-stage">
        <GameHeader
          title={title}
          subtitle={typeof pill === 'string' ? pill : undefined}
          onBack={() => (onBack ? onBack() : setConfirm(true))}
          soundOn={soundOn}
          onSound={toggleSound}
        />
        {pill && typeof pill !== 'string' ? <span className="m3s-pill">{pill}</span> : null}
        <main className="m3s-content">{children}</main>
        {dock ? <div className="m3s-dock">{dock}</div> : null}
      </div>
      {/* ผู้เรียกส่ง onBack มา = ใช้กล่องยืนยันออกของผู้เรียก → ไม่วาง dialog ซ้ำ */}
      {onBack ? null : (
      <dialog ref={dialog} className="m3s-dialog" onClose={() => setConfirm(false)} aria-label="ออกจากภารกิจ">
        <div className="m3s-panel m3s-dialog-panel">
          <DomeSay>ออกตอนนี้ได้นะครับ กลับมาเปิดภารกิจที่ 3 แล้วเริ่มกะใหม่ได้เสมอ</DomeSay>
          <div className="m3s-row">
            <Cta tone="cream" onClick={() => setConfirm(false)}>
              อยู่ต่อ
            </Cta>
            <Cta tone="orange" onClick={() => router.push('/map')}>
              กลับแผนที่
            </Cta>
          </div>
        </div>
      </dialog>
      )}
    </div>
  )
}

export function Panel({
  children,
  className,
  kicker,
  title,
  aside,
}: {
  children?: ReactNode
  className?: string
  kicker?: ReactNode
  title?: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className={cn('m3s-panel', className)}>
      {kicker || aside ? (
        <div className="m3s-panel-top">
          {kicker ? <span className="m3s-kicker">{kicker}</span> : <span />}
          {aside}
        </div>
      ) : null}
      {title ? <h2 className="m3s-title">{title}</h2> : null}
      {children}
    </section>
  )
}

export function DomeSay({
  children,
  name = 'โดม',
  className,
  live,
}: {
  children: ReactNode
  name?: string
  className?: string
  live?: boolean
}) {
  return (
    <div className={cn('m3s-dome', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ภาพโดมสถิต */}
      <img src={M3_ASSET.dome} alt="" draggable={false} />
      <div className="m3s-bubble" aria-live={live ? 'polite' : undefined}>
        <span>{name}</span>
        <p>{children}</p>
      </div>
    </div>
  )
}

export function Cta({
  children,
  onClick,
  tone = 'green',
  disabled,
  className,
  busy,
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'green' | 'cream' | 'gold' | 'purple' | 'orange'
  disabled?: boolean
  className?: string
  busy?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      className={cn('m3s-cta', `m3s-cta--${tone}`, busy && 'is-busy', className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      onClick={() => {
        sfx('tap')
        onClick?.()
      }}
    >
      {busy ? <span className="m3s-spinner" aria-hidden /> : null}
      {children}
    </button>
  )
}

/* ---------- ลากวาง ---------- */

type DragState = { id: string; x: number; y: number; dx: number; dy: number; moved: boolean; pointer: number }

/**
 * ลากด้วย pointer events (นิ้ว + เมาส์) และแตะเลือกแล้วแตะช่องปลายทางแทนได้
 * ช่องปลายทางระบุด้วย data-drop="<id>"
 */
export function useDragDrop({ onDrop }: { onDrop: (item: string, zone: string) => void }) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const dropRef = useRef(onDrop)
  useEffect(() => {
    dropRef.current = onDrop
  })

  const zoneAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const z = (el as HTMLElement).closest?.('[data-drop]') as HTMLElement | null
      if (z) return z.dataset.drop ?? null
    }
    return null
  }

  const itemProps = useCallback(
    (id: string) => ({
      'data-drag': id,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const s = { id, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false, pointer: e.pointerId }
        dragRef.current = s
        setDrag(s)
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const s = dragRef.current
        if (!s || s.id !== id || s.pointer !== e.pointerId) return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        const moved = s.moved || Math.hypot(dx, dy) > 8
        const next = { ...s, dx, dy, moved }
        dragRef.current = next
        setDrag(next)
        if (moved) setOver(zoneAt(e.clientX, e.clientY))
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        const s = dragRef.current
        dragRef.current = null
        setDrag(null)
        setOver(null)
        if (!s || s.id !== id) return
        if (s.moved) {
          const zone = zoneAt(e.clientX, e.clientY)
          setSelected(null)
          if (zone) dropRef.current(id, zone)
        } else {
          sfx('tap')
          setSelected((cur) => (cur === id ? null : id))
        }
      },
      onPointerCancel: () => {
        dragRef.current = null
        setDrag(null)
        setOver(null)
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setSelected((cur) => (cur === id ? null : id))
        }
      },
      style:
        drag?.id === id && drag.moved
          ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.08) rotate(-3deg)`, zIndex: 50, transition: 'none' }
          : undefined,
      className: cn('m3s-draggable', drag?.id === id && drag.moved && 'is-dragging', selected === id && 'is-selected'),
      'aria-pressed': selected === id,
    }),
    [drag, selected],
  )

  const zoneProps = useCallback(
    (zone: string) => ({
      'data-drop': zone,
      tabIndex: selected ? 0 : -1,
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if ((e.key === 'Enter' || e.key === ' ') && selected) {
          e.preventDefault()
          const item = selected
          setSelected(null)
          dropRef.current(item, zone)
        }
      },
      onClick: () => {
        if (!selected) return
        const item = selected
        setSelected(null)
        dropRef.current(item, zone)
      },
      className: cn('m3s-dropzone', over === zone && 'is-over', !!selected && 'is-armed'),
    }),
    [over, selected],
  )

  return { itemProps, zoneProps, selected, setSelected, dragging: drag?.moved ? drag.id : null }
}

/** ตึกโดเมน 3 ชั้น พร้อมข้อความจริงบนป้ายแต่ละชั้น (ภาพไม่มีตัวอักษรฝัง) */
export const FLOORS = [
  { id: 'gTLD ทั่วไป', no: 1, name: 'นามสกุลสากล', rule: 'ใครก็จดได้ ไม่ต้องมีเอกสาร', tags: ['.com', '.net', '.org', '.shop'], tone: 'orange' },
  { id: 'ccTLD ไทย', no: 2, name: 'นามสกุลไทย', rule: 'ต้องแสดงตัวด้วยเอกสาร', tags: ['.co.th', '.in.th', '.ไทย'], tone: 'teal' },
  { id: 'หมวดเฉพาะที่สงวน', no: 3, name: 'หมวดสงวน', rule: 'เฉพาะโรงเรียน ราชการ มูลนิธิ', tags: ['.ac.th', '.go.th', '.or.th'], tone: 'purple' },
] as const

export function Building({
  className,
  lit,
  focus,
  renderFloor,
  showTags = true,
}: {
  className?: string
  lit?: boolean
  focus?: 1 | 2 | 3 | null
  renderFloor?: (floor: (typeof FLOORS)[number]) => ReactNode
  showTags?: boolean
}) {
  return (
    <div className={cn('m3s-building', lit && 'is-lit', focus && `focus-${focus}`, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ภาพตึกสถิต */}
      <img src={M3_ASSET.building} alt="ตึกโดเมน 3 ชั้น" draggable={false} />
      {FLOORS.map((f) => (
        <div key={f.id} className={cn('m3s-floor', `m3s-floor--${f.no}`, `tone-${f.tone}`)}>
          <div className="m3s-floor-sign">
            <b>ชั้น {f.no} · {f.name}</b>
            {showTags ? <span>{f.tags.join(' ')}</span> : <span>{f.rule}</span>}
          </div>
          {renderFloor?.(f)}
        </div>
      ))}
    </div>
  )
}

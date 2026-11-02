'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { NAV_START_EVENT } from './curtain-events'
import './cloud-curtain.css'

type Phase = 'idle' | 'closing' | 'closed' | 'opening'

const SHOW_DELAY_MS = 150 // เปลี่ยนหน้าเร็วกว่านี้ = ไม่ต้องโชว์เมฆ
const CLOSE_MS = 480
const OPEN_MS = 520
const MIN_CLOSED_MS = 120
const FAILSAFE_MS = 4000

// ก้อนเมฆที่ขอบด้านใน [top %, ขนาดคูณ, ยื่นออก] — สีเดียวกันทั้งหมดจึงรวมเป็นขอบเมฆฟู ๆ ก้อนเดียว
const EDGE_PUFFS: ReadonlyArray<readonly [number, number, number]> = [
  [-2, 1, 0],
  [9, 0.55, 0.42],
  [17, 0.92, 0],
  [28, 0.6, 0.4],
  [37, 1.04, 0],
  [48, 0.5, 0.45],
  [57, 0.9, 0],
  [67, 0.62, 0.38],
  [77, 1, 0],
  [88, 0.55, 0.42],
  [98, 0.95, 0],
]

function Puffs({ shift }: { shift: number }) {
  return EDGE_PUFFS.map(([top, scale, out], i) => (
    <span
      key={i}
      className="cc-puff"
      style={{ top: `${top + shift}%`, '--s': scale, '--o': out } as React.CSSProperties}
    />
  ))
}

// เมฆสองชั้น: ชั้นหลังกว้างเต็มฝั่ง (ขอบชนกลางจอ) ชั้นหน้าแคบกว่าและขาวกว่า ซ้อนให้ดูฟูมีมิติ
function Tier({ tier, shift }: { tier: 'back' | 'front'; shift: number }) {
  return (
    <div className={`cc-tier cc-${tier}`}>
      <div className="cc-layer cc-shade">
        <Puffs shift={shift} />
      </div>
      <div className="cc-layer cc-main">
        <Puffs shift={shift} />
      </div>
    </div>
  )
}

function Bank({ side }: { side: 'left' | 'right' }) {
  const shift = side === 'right' ? 5 : 0
  return (
    <div className={`cc-bank cc-bank-${side}`} aria-hidden>
      <Tier tier="back" shift={shift} />
      <Tier tier="front" shift={shift + 4} />
    </div>
  )
}

function CurtainView({ phase }: { phase: Phase }) {
  return (
    <div className="cc-root" data-phase={phase} role="status" aria-live="polite">
      <Bank side="left" />
      <Bank side="right" />
      <div className="cc-label">
        <span className="cc-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        กำลังโหลด...
      </div>
    </div>
  )
}

/**
 * ม่านเมฆตอนเปลี่ยนหน้า วางครั้งเดียวใน app/layout.tsx
 * เริ่ม: onRouterTransitionStart (instrumentation-client.ts) ส่ง event มาเมื่อ path เปลี่ยน
 * จบ: usePathname เปลี่ยน = หน้าใหม่ commit แล้ว → แยกเมฆออก
 * ไม่ค้าง: failsafe 4 วินาที / หน้าเร็วกว่า 150ms ไม่โชว์เลย
 */
export function CloudCurtain() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<Phase>('idle')
  const onPath = useRef<(path: string) => void>(() => {})

  useEffect(() => {
    let current: Phase = 'idle'
    let navFrom: string | null = null
    let openReadyAt = 0
    const t: { show?: number; fail?: number; step?: number } = {}
    const set = (p: Phase) => {
      current = p
      setPhase(p)
    }
    const clear = (k: keyof typeof t) => {
      window.clearTimeout(t[k])
      t[k] = undefined
    }

    const open = () => {
      navFrom = null
      clear('show')
      clear('fail')
      if (current === 'idle' || current === 'opening') return
      clear('step')
      t.step = window.setTimeout(
        () => {
          set('opening')
          t.step = window.setTimeout(() => set('idle'), OPEN_MS)
        },
        Math.max(0, openReadyAt - Date.now()),
      )
    }

    const onNav = (e: Event) => {
      navFrom = (e as CustomEvent<string>).detail || window.location.pathname
      clear('fail')
      t.fail = window.setTimeout(open, FAILSAFE_MS)
      if (current === 'closing' || current === 'closed' || t.show !== undefined) return
      t.show = window.setTimeout(() => {
        t.show = undefined
        if (navFrom === null) return
        clear('step')
        openReadyAt = Date.now() + CLOSE_MS + MIN_CLOSED_MS
        set('closing')
        t.step = window.setTimeout(() => set('closed'), CLOSE_MS)
      }, SHOW_DELAY_MS)
    }

    onPath.current = (path) => {
      if (navFrom !== null && navFrom !== path) open()
    }
    window.addEventListener(NAV_START_EVENT, onNav)
    return () => {
      window.removeEventListener(NAV_START_EVENT, onNav)
      clear('show')
      clear('fail')
      clear('step')
    }
  }, [])

  useEffect(() => {
    onPath.current(pathname)
  }, [pathname])

  if (phase === 'idle') return null
  return <CurtainView phase={phase} />
}

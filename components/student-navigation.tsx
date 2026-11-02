'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import './student-navigation.css'

type BackButtonProps = {
  href?: string
  onClick?: () => void
  label?: string
  className?: string
}

/** ปุ่มย้อนกลับแบบเดียวกับป้ายไม้บนแผนที่ — ใช้ได้ทั้งลิงก์และ flow ที่ต้องถามก่อนออก */
export function StudentBackButton({ href, onClick, label = 'ย้อนกลับ', className }: BackButtonProps) {
  const content = (
    // eslint-disable-next-line @next/next/no-img-element -- asset ปุ่มเกมเป็นภาพสถิติโปร่งใส
    <img src="/ui/kit2/back-button.webp" alt="" aria-hidden width={42} height={42} draggable={false} />
  )

  if (href) {
    return (
      <Link href={href} aria-label={label} className={`student-back-button focus-ring${className ? ` ${className}` : ''}`}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`student-back-button focus-ring${className ? ` ${className}` : ''}`}
    >
      {content}
    </button>
  )
}

export function ExitConfirmDialog({
  open,
  onStay,
  onExit,
  note,
  kicker = 'พักด่านชั่วคราว',
  title = 'ออกจากด่านนี้ไหม?',
  description,
  stayLabel = 'อยู่ต่อ',
  exitLabel = 'ออกจากด่าน',
  imageAlt = 'โดมทำหน้ากังวลและยกมือโบกให้หยุดก่อนออกจากด่าน',
  busy = false,
}: {
  open: boolean
  onStay: () => void
  onExit: () => void
  note?: ReactNode
  /** ข้อความเต็มใต้หัวข้อ — ส่งมาเมื่อไม่ใช่การออกจากด่าน (เช่น ออกจากระบบ) */
  description?: ReactNode
  kicker?: string
  title?: string
  stayLabel?: string
  exitLabel?: string
  imageAlt?: string
  /** กำลังทำงาน — ล็อกปุ่มออกไว้กันกดซ้ำ */
  busy?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const stayRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    stayRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onStay()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [onStay, open])

  if (!open) return null

  return (
    <div className="student-exit-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-exit-title"
        aria-describedby="student-exit-description"
        className="student-exit-dialog"
      >
        <img
          src="/ui/kit2/dome-exit-confirm.webp"
          alt={imageAlt}
          width={128}
          height={136}
          className="student-exit-dome"
          draggable={false}
        />
        <div className="student-exit-copy">
          <p className="student-exit-kicker">{kicker}</p>
          <h2 id="student-exit-title">{title}</h2>
          <div id="student-exit-description" className="student-exit-description">
            {description ?? <p>ความคืบหน้าในด่านนี้จะเป็นอย่างไรต่อไป: {note}</p>}
          </div>
        </div>
        <div className="student-exit-actions">
          <button ref={stayRef} type="button" onClick={onStay} className="student-exit-stay focus-ring">
            {stayLabel}
          </button>
          <button type="button" onClick={onExit} disabled={busy} className="student-exit-leave focus-ring">
            {exitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function useExitConfirm({ href, note }: { href: string; note: ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const stay = useCallback(() => setOpen(false), [])
  const request = useCallback(() => setOpen(true), [])
  const exit = useCallback(() => {
    setOpen(false)
    router.push(href)
  }, [href, router])

  return {
    request,
    dialog: <ExitConfirmDialog open={open} onStay={stay} onExit={exit} note={note} />,
  }
}

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
}: {
  open: boolean
  onStay: () => void
  onExit: () => void
  note: ReactNode
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
          alt="โดมทำหน้ากังวลและยกมือโบกให้หยุดก่อนออกจากด่าน"
          width={128}
          height={136}
          className="student-exit-dome"
          draggable={false}
        />
        <div className="student-exit-copy">
          <p className="student-exit-kicker">พักด่านชั่วคราว</p>
          <h2 id="student-exit-title">ออกจากด่านนี้ไหม?</h2>
          <p id="student-exit-description">ความคืบหน้าในด่านนี้จะเป็นอย่างไรต่อไป: {note}</p>
        </div>
        <div className="student-exit-actions">
          <button ref={stayRef} type="button" onClick={onStay} className="student-exit-stay focus-ring">
            อยู่ต่อ
          </button>
          <button type="button" onClick={onExit} className="student-exit-leave focus-ring">
            ออกจากด่าน
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

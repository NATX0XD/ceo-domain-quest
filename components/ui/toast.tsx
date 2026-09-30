'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from './cn'
import { CheckIcon, AlertIcon, InfoIcon, CloseIcon } from './icons'

/**
 * แถบแจ้งผลชั่วคราว
 *
 * `role` เลือกตามความเร่งด่วน:
 * - success/info ใช้ `status` (polite) — รอให้อ่านจบประโยคก่อนแล้วค่อยแทรก
 * - error ใช้ `alert` (assertive) — ขัดจังหวะทันที เพราะนักเรียนต้องรู้ว่าส่งไม่สำเร็จ
 *
 * ตำแหน่ง: ลอยอยู่ "ด้านบน" ของจอ ไม่ใช่ด้านล่าง เพราะด้านล่างมีแถบเมนู 5 ปุ่มอยู่แล้ว
 * และนิ้วโป้งมักบังครึ่งล่างของจอตอนถือมือถือ
 */

type ToastTone = 'success' | 'error' | 'info'

const TONE: Record<ToastTone, { box: string; icon: ReactNode; spoken: string }> = {
  success: {
    box: 'bg-quest-700 text-ink-onbrand',
    icon: <CheckIcon width={22} height={22} />,
    spoken: 'สำเร็จ',
  },
  error: {
    box: 'bg-danger-600 text-ink-onbrand',
    icon: <AlertIcon width={22} height={22} />,
    spoken: 'ผิดพลาด',
  },
  info: {
    box: 'bg-ink text-ink-onbrand',
    icon: <InfoIcon width={22} height={22} />,
    spoken: 'แจ้งให้ทราบ',
  },
}

export type ToastProps = {
  message: ReactNode
  tone?: ToastTone
  /** มิลลิวินาทีก่อนปิดเอง — ใส่ 0 หรือ null เพื่อให้ค้างไว้จนกว่าจะกดปิด */
  duration?: number | null
  onDismiss?: () => void
  /** ข้อความบนปุ่มปิด (ใช้เป็น aria-label) */
  dismissLabel?: string
  /** ปุ่มทำต่อ เช่น "ลองใหม่" */
  action?: ReactNode
  className?: string
}

export function Toast({
  message,
  tone = 'info',
  duration = 4000,
  onDismiss,
  dismissLabel = 'ปิดข้อความแจ้งเตือน',
  action,
  className,
}: ToastProps) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!duration || duration <= 0) return
    const timer = window.setTimeout(() => onDismissRef.current?.(), duration)
    return () => window.clearTimeout(timer)
  }, [duration])

  const palette = TONE[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-2xl px-4 py-3 shadow-soft-3',
        'animate-rise-in motion-reduce:animate-none',
        palette.box,
        className,
      )}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {palette.icon}
      </span>
      <span className="sr-only">{palette.spoken}: </span>
      <div className="min-w-0 flex-1 text-label font-semibold text-pretty">{message}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="tap-target -my-1 -mr-2 shrink-0 cursor-pointer rounded-full opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <CloseIcon width={20} height={20} />
        </button>
      ) : null}
    </div>
  )
}

export type ToastViewportProps = {
  children: ReactNode
  className?: string
}

/** ที่วางแถบแจ้งผล — ลอยบนสุดของจอ ไม่บังแถบเมนูล่าง */
export function ToastViewport({ children, className }: ToastViewportProps) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-(--z-toast) flex flex-col gap-2',
        'safe-t safe-x mx-auto w-full max-w-[30rem] px-4 pt-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

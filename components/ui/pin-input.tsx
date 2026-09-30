'use client'

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from './cn'
import { AlertIcon } from './icons'

/**
 * ช่องกรอกรหัสตัวเลขแบบแยกช่อง
 *
 * ทำไมต้องแยกช่อง: บนมือถือ ช่องเดียวที่ใส่ 4 หลักทำให้นักเรียนไม่รู้ว่าพิมพ์ไปกี่ตัวแล้ว
 * (โดยเฉพาะตอนเป็นจุดปิดบัง) แยกช่องแล้วนับด้วยตาได้ทันทีว่าเหลืออีกกี่ช่อง
 *
 * a11y ที่ต้องระวังกับรูปแบบนี้:
 * - ช่องทั้งชุดครอบด้วย `role="group"` + `aria-labelledby` โปรแกรมอ่านหน้าจอจึงรู้ว่านี่คือรหัสชุดเดียว
 * - แต่ละช่องมี `aria-label` บอกลำดับ ("หลักที่ 2 จาก 4")
 * - Backspace ในช่องว่างถอยไปช่องก่อนหน้า · ลูกศรซ้ายขวาเลื่อนช่องได้
 * - วาง (paste) รหัสทั้งชุดทีเดียวได้ เพราะนักเรียนบางคนก๊อปมาจากแชต
 *
 * ค่าที่ส่งออกยังเป็น string เดียว ("1234") เหมือนช่อง input ปกติ
 * ตรรกะฝั่งหน้าเว็บจึงไม่ต้องแก้อะไรเลย
 */

export type PinInputProps = {
  /** ค่าปัจจุบัน — string ของตัวเลขล้วน ยาวไม่เกิน `length` */
  value: string
  onChange: (next: string) => void
  /** จำนวนหลัก (ค่าเริ่มต้น 4) */
  length?: number
  label: string
  hint?: string
  error?: string | null
  /** ปิดบังตัวเลขเป็นจุด */
  masked?: boolean
  disabled?: boolean
  /** ยิงเมื่อกรอกครบทุกหลัก — ใช้ย้ายโฟกัสไปปุ่มส่ง */
  onComplete?: () => void
  className?: string
}

export function PinInput({
  value,
  onChange,
  length = 4,
  label,
  hint,
  error,
  masked = true,
  disabled = false,
  onComplete,
  className,
}: PinInputProps) {
  const groupId = useId()
  const labelId = `${groupId}-label`
  const hintId = `${groupId}-hint`
  const errorId = `${groupId}-error`
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  function focusAt(index: number) {
    const clamped = Math.min(Math.max(index, 0), length - 1)
    inputsRef.current[clamped]?.focus()
    inputsRef.current[clamped]?.select()
  }

  function setDigit(index: number, digit: string) {
    const next = digits.slice()
    next[index] = digit
    const joined = next.join('').replace(/\D/g, '').slice(0, length)
    onChange(joined)
    return joined
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, '')
    if (clean.length === 0) {
      setDigit(index, '')
      return
    }
    // พิมพ์รวดเดียวหลายตัว (หรือคีย์บอร์ดมือถือเติมมาทีเดียว) — เติมไล่จากช่องนี้ไป
    const merged = (digits.slice(0, index).join('') + clean).replace(/\D/g, '').slice(0, length)
    onChange(merged)
    if (merged.length >= length) {
      inputsRef.current[length - 1]?.blur()
      onComplete?.()
    } else {
      focusAt(merged.length)
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        setDigit(index, '')
        return
      }
      event.preventDefault()
      setDigit(index - 1 < 0 ? 0 : index - 1, '')
      focusAt(index - 1)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAt(index - 1)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusAt(index + 1)
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted)
    if (pasted.length >= length) onComplete?.()
    else focusAt(pasted.length)
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <span id={labelId} className="text-body font-bold text-ink">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className="mt-2 flex items-center gap-2"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputsRef.current[index] = node
            }}
            type={masked ? 'password' : 'text'}
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            disabled={disabled}
            value={digit}
            aria-label={`รหัสหลักที่ ${index + 1} จาก ${length}`}
            aria-invalid={error ? true : undefined}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(
              'h-16 min-w-0 flex-1 rounded-sm bg-surface-raised text-center text-title font-bold text-ink',
              'ring-2 ring-inset outline-none transition-[box-shadow,background-color] duration-200',
              'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
              'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
              error
                ? 'bg-danger-100 ring-danger-600'
                : digit
                  ? 'ring-brand-500'
                  : 'ring-line-contrast focus:ring-brand-500',
            )}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-label font-semibold text-danger-700">
          <AlertIcon width={18} height={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-label text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

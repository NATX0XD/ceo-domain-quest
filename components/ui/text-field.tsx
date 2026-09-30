'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from './cn'
import { AlertIcon } from './icons'

/**
 * ช่องกรอกข้อความ
 *
 * - `<label>` ผูกกับ input ด้วย id จริงเสมอ (ไม่ใช้ placeholder แทน label
 *   เพราะ placeholder หายไปทันทีที่เริ่มพิมพ์ นักเรียนจะลืมว่าช่องนี้คืออะไร)
 * - ข้อความช่วยเหลือและข้อความผิดผูกด้วย `aria-describedby` โปรแกรมอ่านหน้าจอจึงอ่านต่อจากชื่อช่อง
 * - ข้อความผิดมีไอคอนคู่เสมอ ไม่ได้สื่อด้วยสีแดงอย่างเดียว
 * - ความสูง 56px และตัวอักษร 17px กัน iOS ซูมหน้าอัตโนมัติตอนโฟกัส
 */

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> & {
  label: string
  /** คำอธิบายใต้ช่อง ตอนยังไม่มีข้อความผิด */
  hint?: ReactNode
  /** ข้อความผิด — ใส่เมื่อไรช่องจะเปลี่ยนเป็นสถานะผิดทันที */
  error?: string | null
  /** ช่องนี้ผ่านแล้ว แสดงเป็นสถานะถูก */
  valid?: boolean
  /** จัดตัวอักษรกลางช่อง สำหรับรหัสสั้น ๆ */
  center?: boolean
  className?: string
  inputClassName?: string
}

export function TextField({
  label,
  hint,
  error,
  valid = false,
  center = false,
  className,
  inputClassName,
  id,
  ...rest
}: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={fieldId} className="text-body font-bold text-ink">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          'mt-2 min-h-14 w-full rounded-sm bg-surface-raised px-4 text-body text-ink',
          'ring-2 ring-inset outline-none transition-[box-shadow,background-color] duration-200',
          'placeholder:text-ink-subtle',
          'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
          'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
          center && 'text-center',
          error
            ? 'ring-danger-600 bg-danger-100'
            : valid
              ? 'ring-quest-500'
              : 'ring-line-contrast focus:ring-brand-500',
          inputClassName,
        )}
        {...rest}
      />
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

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/**
 * ปุ่มมาตรฐาน 4 แบบ
 *
 * - `primary`   ม่วงทึบ  — สิ่งที่อยากให้กดมากที่สุดของหน้า ใช้ได้หน้าละ 1 ปุ่ม
 * - `secondary` ม่วงอ่อน — ทางเลือกรองที่ยังอยากให้เห็นชัด เช่น "ดูคำใบ้"
 * - `success`   เขียวทึบ — ยืนยัน/ส่งคำตอบ (ตามภาพต้นแบบปุ่ม "ตรวจคำตอบ")
 * - `ghost`     โปร่ง    — การกระทำที่ถอยออก เช่น "ข้ามภารกิจนี้"
 *
 * ทุกแบบสูงอย่างน้อย 44px ตาม WCAG 2.5.8 (ค่าจริง: sm 44 / md 48 / lg 56)
 */

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonOwnProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** ยืดเต็มความกว้างพ่อแม่ — ค่าเริ่มต้นของ CTA หลักบนมือถือ */
  fullWidth?: boolean
  /** กำลังรอผลลัพธ์: ปิดการกดซ้ำและประกาศสถานะให้โปรแกรมอ่านหน้าจอ */
  loading?: boolean
  /** ข้อความที่อ่านให้ฟังตอน loading (ค่าเริ่มต้น "กำลังทำงาน") */
  loadingLabel?: string
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

type ButtonBase = ButtonOwnProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

/**
 * บังคับตั้งแต่ชั้น type: ปุ่มที่ไม่มีข้อความ (ปุ่มไอคอนล้วน) ต้องมี `aria-label`
 * ไม่งั้นโปรแกรมอ่านหน้าจอจะอ่านออกมาว่า "ปุ่ม" เฉย ๆ
 */
export type ButtonProps =
  | (ButtonBase & { children: ReactNode })
  | (ButtonBase & { children?: undefined; 'aria-label': string })

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'game-button game-button--primary text-ink-onbrand shadow-soft-2 hover:bg-brand-700 active:bg-brand-700 active:translate-y-px active:shadow-soft-1',
  secondary:
    'game-button game-button--secondary bg-brand-100 text-brand-700 hover:bg-brand-200 active:bg-brand-200 active:text-brand-800 active:translate-y-px',
  success:
    'bg-quest-600 text-ink-onbrand shadow-soft-2 hover:bg-quest-700 active:bg-quest-700 active:translate-y-px active:shadow-soft-1',
  ghost:
    'bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100 active:translate-y-px',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-11 rounded-md px-4 text-label',
  md: 'min-h-12 rounded-lg px-5 text-body',
  lg: 'min-h-14 rounded-xl px-6 text-body-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  loadingLabel = 'กำลังทำงาน',
  leadingIcon,
  trailingIcon,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'btn-base',
        SIZE_CLASS[size],
        VARIANT_CLASS[variant],
        fullWidth ? 'w-full' : 'w-auto',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : (
        leadingIcon
      )}
      {children}
      {!loading && trailingIcon}
    </button>
  )
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      className="animate-spin motion-reduce:animate-none"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.28" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** ปุ่มไอคอนล้วนทรงกลม — ใช้กับปุ่มปิด/ย้อนกลับ/เมนูมุมจอ */
export type IconButtonProps = Omit<ButtonBase, 'fullWidth' | 'leadingIcon' | 'trailingIcon'> & {
  icon: ReactNode
  /** จำเป็นเสมอ เพราะไม่มีข้อความให้โปรแกรมอ่านหน้าจออ่าน */
  'aria-label': string
}

export function IconButton({
  icon,
  variant = 'secondary',
  size = 'md',
  className,
  disabled,
  loading = false,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const box = size === 'sm' ? 'size-11' : size === 'lg' ? 'size-14' : 'size-12'

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'btn-base shrink-0 rounded-full px-0',
        box,
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
}

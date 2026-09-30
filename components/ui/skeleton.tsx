import { cn } from './cn'

/**
 * โครงร่างเนื้อหาระหว่างรอโหลด
 *
 * เหตุผลที่ใช้ skeleton ไม่ใช่วงกลมหมุน: หน้าจอในแอปนี้โหลดคำตอบจาก AI ซึ่งอาจใช้
 * เวลาหลายวินาที skeleton บอกล่วงหน้าว่า "ของที่กำลังมามีหน้าตาแบบนี้" และจองพื้นที่ไว้
 * เลย์เอาต์จึงไม่กระโดดตอนเนื้อหามาถึง (CLS = 0)
 *
 * ทั้งก้อนเป็น `aria-hidden` + มี `aria-live` ประกาศ "กำลังโหลด" ครั้งเดียว
 * ไม่งั้นโปรแกรมอ่านหน้าจอจะอ่านกล่องเปล่าทีละกล่อง
 */

type SkeletonShape = 'text' | 'title' | 'circle' | 'rect' | 'chip'

const SHAPE_CLASS: Record<SkeletonShape, string> = {
  text: 'h-[1.0625rem] rounded-md',
  title: 'h-6 rounded-lg',
  circle: 'aspect-square rounded-full',
  rect: 'rounded-xl',
  chip: 'h-12 rounded-full',
}

export type SkeletonProps = {
  shape?: SkeletonShape
  /** จำนวนบรรทัด (ใช้กับ shape 'text' เท่านั้น) — บรรทัดสุดท้ายจะสั้นลงเหมือนข้อความจริง */
  lines?: number
  /** ความกว้าง เช่น '60%' หรือ '8rem' — ค่าเริ่มต้นเต็มความกว้าง */
  width?: string
  /** ความสูง สำหรับ shape 'rect' และ 'circle' */
  height?: string
  className?: string
}

export function Skeleton({ shape = 'text', lines = 1, width, height, className }: SkeletonProps) {
  const base =
    'bg-[linear-gradient(100deg,var(--color-surface-sunken)_30%,var(--color-brand-50)_50%,var(--color-surface-sunken)_70%)] bg-[length:250%_100%] animate-shimmer motion-reduce:animate-none motion-reduce:bg-surface-sunken'

  if (shape === 'text' && lines > 1) {
    return (
      <div aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cn(base, SHAPE_CLASS.text)}
            style={{ width: i === lines - 1 ? '68%' : (width ?? '100%') }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className={cn(base, SHAPE_CLASS[shape], className)}
      style={{ width, height }}
    />
  )
}

export type SkeletonGroupProps = {
  children: React.ReactNode
  /** ข้อความที่ประกาศให้โปรแกรมอ่านหน้าจอครั้งเดียวตอนเริ่มโหลด */
  label?: string
  className?: string
}

/** ครอบกลุ่ม skeleton เพื่อประกาศสถานะ "กำลังโหลด" ให้โปรแกรมอ่านหน้าจอ */
export function SkeletonGroup({
  children,
  label = 'กำลังโหลดเนื้อหา',
  className,
}: SkeletonGroupProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

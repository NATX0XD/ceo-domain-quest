import type { ReactNode } from 'react'
import { cn } from './cn'

/**
 * หน้าจอ "ยังไม่มีอะไรตรงนี้"
 *
 * ออกแบบให้เป็นคำเชิญชวน ไม่ใช่คำบอกความล้มเหลว — นักเรียน ปวช.1 ที่เจอหน้าจอว่าง
 * มักคิดว่าแอปพัง เลยต้องบอกชัดว่า "ยังไม่มี" แล้วชี้ทางต่อด้วยปุ่มเดียว
 *
 * ภาพประกอบส่งเข้ามาจากข้างนอก (เช่น <DomeAvatar mood="cheer" />)
 * component นี้ไม่ผูกกับภาพใดภาพหนึ่ง
 */

export type EmptyStateProps = {
  /** หัวข้อสั้น ๆ บอกว่ายังไม่มีอะไร */
  title: string
  /** อธิบายว่าต้องทำอะไรถึงจะมีของขึ้นมา */
  description?: ReactNode
  /** ภาพประกอบ — ควรส่ง decorative image เข้ามา */
  illustration?: ReactNode
  /** ปุ่มทางออกหนึ่งปุ่ม */
  action?: ReactNode
  /** ลิงก์รองใต้ปุ่ม */
  secondaryAction?: ReactNode
  /** ระดับหัวข้อจริงในหน้า */
  as?: 'h2' | 'h3'
  className?: string
}

export function EmptyState({
  title,
  description,
  illustration,
  action,
  secondaryAction,
  as: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl bg-surface-raised px-5 py-8 text-center shadow-soft-1',
        className,
      )}
    >
      {illustration ? (
        <div aria-hidden="true" className="opacity-95">
          {illustration}
        </div>
      ) : null}
      <Heading className="text-title-sm font-bold text-balance text-ink">{title}</Heading>
      {description ? (
        <p className="max-w-[26rem] text-body text-pretty text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2 w-full max-w-[18rem]">{action}</div> : null}
      {secondaryAction ? <div className="mt-1">{secondaryAction}</div> : null}
    </div>
  )
}

import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/**
 * การ์ดลอยมีเงานุ่ม — หน่วยเนื้อหาหลักของทุกหน้าตามภาพต้นแบบ
 *
 * `tone` ใช้สื่อ "ประเภทของเนื้อหา" ไม่ใช่ความสวยงามล้วน ๆ
 * นักเรียนกวาดตาแล้วรู้ทันทีว่าอันไหนคือความรู้ (ม่วง) อันไหนคือผลสำเร็จ (เขียว)
 * อันไหนคือสิ่งที่ต้องลงมือทำต่อ (ส้ม)
 */

type CardTone = 'plain' | 'brand' | 'quest' | 'spark' | 'reward' | 'danger'
type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const TONE_CLASS: Record<CardTone, string> = {
  plain: 'bg-surface-raised',
  brand: 'bg-brand-50 ring-1 ring-brand-100 ring-inset',
  quest: 'bg-quest-50 ring-1 ring-quest-100 ring-inset',
  spark: 'bg-spark-50 ring-1 ring-spark-100 ring-inset',
  reward: 'bg-reward-100 ring-1 ring-reward-300 ring-inset',
  /**
   * สำหรับแผงครูเท่านั้น — "คนนี้ต้องเข้าไปช่วยก่อน" (T-05)
   * ⚠️ ห้ามใช้กับหน้าของนักเรียน จอเด็กไม่มีการ์ดสีเตือนที่บอกว่าใครตกใครไม่ผ่าน
   */
  danger: 'bg-danger-100 ring-1 ring-danger-300 ring-inset',
}

const PADDING_CLASS: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
}

export type CardProps = HTMLAttributes<HTMLElement> & {
  tone?: CardTone
  padding?: CardPadding
  /** ยกการ์ดให้ลอยสูงขึ้น สำหรับการ์ดที่เป็นพระเอกของหน้า */
  elevated?: boolean
  /** เปลี่ยน tag ที่เรนเดอร์ เช่น 'section' | 'article' | 'li' เพื่อให้ HTML สื่อความหมายถูก */
  as?: ElementType
  children?: ReactNode
}

export function Card({
  tone = 'plain',
  padding = 'md',
  elevated = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        'game-card rounded-2xl',
        TONE_CLASS[tone],
        PADDING_CLASS[padding],
        elevated ? 'shadow-soft-3' : 'shadow-soft-2',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export type CardHeaderProps = {
  /** ระดับหัวข้อจริงในหน้า — ต้องไล่ h1 > h2 > h3 ตามลำดับ ห้ามข้ามขั้น */
  as?: 'h2' | 'h3' | 'h4'
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** ช่องขวาสุด เช่น ป้ายดาวหรือปุ่มเล็ก */
  trailing?: ReactNode
  className?: string
}

export function CardHeader({
  as: Heading = 'h3',
  title,
  description,
  icon,
  trailing,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {icon ? (
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <Heading className="text-title-sm font-bold text-balance text-ink">{title}</Heading>
        {description ? (
          <p className="mt-1 text-label text-ink-muted">{description}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}

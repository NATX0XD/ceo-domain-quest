import type { ReactNode } from 'react'
import { cn } from '@/components/ui'
import './page-state-card.css'

/**
 * การ์ดสถานะของหน้านักเรียน (รอครูเปิด / ล็อกแล้ว / ส่งแล้ว / ยังไม่มีข้อมูล)
 * ภาพ 3 มิติในวงแสง + หัวข้อ + คำอธิบายสั้น + ช่องใส่ของเพิ่ม — เติมจอให้เต็ม ไม่ปล่อยกล่องว่าง
 */
export function PageStateCard({
  art,
  badge,
  title,
  body,
  tone = 'warm',
  children,
  className,
  live = false,
}: {
  /** path ภาพ เช่น /icons/3d/locked.webp */
  art: string
  /** ภาพเล็กมุมขวาล่างของวงแสง เช่น badge-check */
  badge?: string
  title: ReactNode
  body?: ReactNode
  tone?: 'warm' | 'done' | 'wait'
  children?: ReactNode
  className?: string
  live?: boolean
}) {
  return (
    <section
      className={cn('psc', `psc-${tone}`, className)}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
    >
      <div className="psc-art" aria-hidden="true">
        <span className="psc-glow" />
        <img src={art} alt="" className="psc-art-img" />
        {badge ? <img src={badge} alt="" className="psc-badge" /> : null}
      </div>
      <h2 className="psc-title">{title}</h2>
      {body ? <p className="psc-body">{body}</p> : null}
      {children ? <div className="psc-extra">{children}</div> : null}
    </section>
  )
}

/** แถวไอคอน + ข้อความสั้น ใช้ใต้การ์ดสถานะ */
export function PageStateTip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <p className="psc-tip">
      <img src={icon} alt="" />
      <span>{children}</span>
    </p>
  )
}

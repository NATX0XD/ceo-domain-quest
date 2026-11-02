import type { ReactNode } from 'react'
import { StudentShell } from '@/components/student-shell'
import { DomeSays, type DomeMood, cn } from '@/components/ui'
import { StudentBackButton } from '@/components/student-navigation'

/**
 * โครงเกมของหน้าแบบทดสอบก่อน/หลังเรียนและทบทวนตัวเอง
 * ป้ายไม้ + ปุ่มกลับกลมมุมซ้ายบน + (ตัวนับข้อ 1 ตัวเดียวที่มุมขวา) + โดมพูดสั้น ๆ + แถบปุ่มท้ายจอ
 * ตัวนับในป้ายคือตัวบอกความคืบหน้าเพียงตัวเดียวของทั้ง flow (UX R5)
 */
export function GameFrame({
  title,
  backHref = '/map',
  count,
  mood = 'greet',
  say,
  footer,
  children,
  className,
  onBack,
}: {
  title: string
  backHref?: string | null
  /** ตัวนับเช่น "3/10" — ใช้ตัวเดียวต่อจอ */
  count?: string
  mood?: DomeMood
  /** โดมพูดได้ไม่เกิน 1 บรรทัด */
  say?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  onBack?: () => void
}) {
  return (
    <StudentShell
      className={cn('gf-shell flex h-full min-h-0 flex-col gap-3', className)}
      header={
        <div className="gf-sign">
          {backHref ? <StudentBackButton href={backHref} label="กลับ" className="gf-back" /> : null}
          {!backHref && onBack ? <StudentBackButton onClick={onBack} label="กลับ" className="gf-back" /> : null}
          <h1>{title}</h1>
          {count ? (
            <span className="gf-count" aria-label={`ข้อ ${count}`}>
              {count}
            </span>
          ) : null}
        </div>
      }
      footer={footer ? <div className="gf-footer">{footer}</div> : null}
    >
      {say ? (
        <DomeSays mood={mood} avatarSize={64} className="shrink-0 items-center">
          <span className="text-body font-bold text-ink">{say}</span>
        </DomeSays>
      ) : null}
      {children}
    </StudentShell>
  )
}

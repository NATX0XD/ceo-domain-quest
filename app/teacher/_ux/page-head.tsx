import type { ReactNode } from 'react'

/**
 * v4 — ชื่อหน้าอยู่ที่แถบบนที่เดียว (ไม่ซ้ำเป็นแบนเนอร์ใหญ่) · คอมโพเนนต์นี้เหลือแค่แถบเครื่องมือบาง ๆ
 * ของหน้า (ปุ่มมุมขวา + ข้อความสั้น) — ไม่มี action/children = ไม่เรนเดอร์อะไร เนื้อหาเริ่มทันที
 * props ที่เหลือ (title/subtitle/icon/tone/art) รับไว้เพื่อให้หน้าเดิมคอมไพล์ได้ แต่ไม่แสดงซ้ำ
 */
export function PageHead({
  action,
  children,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  icon?: ReactNode
  tone?: 'purple' | 'blue' | 'green' | 'amber' | 'rose' | 'teal' | 'orange' | 'gray'
  art?: string
  children?: ReactNode
}) {
  if (!action && !children) return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 text-[14px] text-[var(--c-ink-3)]">{children}</div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}

/** กรอบเนื้อหาของหน้า — ระยะขอบเท่ากันทุกหน้าในแดชบอร์ด */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="teacher-page-body mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</div>
}

import type { ReactNode } from 'react'

/**
 * หัวของหน้าในแดชบอร์ดครู — h1 ธรรมดา + คำอธิบายบรรทัดเดียว + ช่องปุ่มมุมขวา (ตกบรรทัดบนมือถือ) + เส้นคั่นล่าง
 * ชื่อหน้าซ้ำกับ breadcrumb บนแถบบนไม่ได้ — แถบบนบอกตำแหน่ง ส่วนนี้บอกชื่อหน้า
 */
export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="t2-head">
      <div className="min-w-0">
        <h1 className="t2-title">{title}</h1>
        {subtitle ? <p className="t2-sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}

/** กรอบเนื้อหาของหน้า — ระยะขอบเท่ากันทุกหน้าในแดชบอร์ด */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="teacher-page-body mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
}

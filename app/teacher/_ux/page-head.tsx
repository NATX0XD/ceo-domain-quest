import type { ReactNode } from 'react'
import { HighlightTitle } from './v2'

/**
 * หัวของหน้าในแดชบอร์ดครู — ชื่อหน้าสั้นบนป้ายเหลือง + บรรทัดช่วยเหลือบรรทัดเดียว + ปุ่มมุมขวา
 * (visual v2: คำอธิบายยาว ๆ ย้ายไปอยู่ในไอคอน i ของแต่ละการ์ด)
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
        <HighlightTitle title={title} />
        {subtitle ? <p className="t2-sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** กรอบเนื้อหาของหน้า — ระยะขอบเท่ากันทุกหน้าในแดชบอร์ด */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="teacher-page-body mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 sm:py-6 xl:px-8">{children}</div>
}

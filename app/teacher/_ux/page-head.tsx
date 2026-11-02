import type { ReactNode } from 'react'

/**
 * หัวของหน้าในแดชบอร์ดครู — แบนเนอร์โทนอ่อนมีไอคอนสี (หรือภาพประกอบ) + ชื่อหน้า + คำอธิบาย + ปุ่มมุมขวา
 * ชื่อหน้าซ้ำกับ breadcrumb บนแถบบนไม่ได้ — แถบบนบอกตำแหน่ง ส่วนนี้บอกชื่อหน้า
 */
export function PageHead({
  title,
  subtitle,
  action,
  icon,
  tone = 'purple',
  art,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  /** ไอคอน 3 มิติ (ใส่ <Icon3d/>) */
  icon?: ReactNode
  tone?: 'purple' | 'blue' | 'green' | 'amber' | 'rose' | 'teal' | 'orange' | 'gray'
  /** ภาพประกอบมุมขวา (เช่น /landing/dome-wave.webp) */
  art?: string
  /** เนื้อหาเสริมใต้คำอธิบาย (ชิปสรุป ฯลฯ) */
  children?: ReactNode
}) {
  return (
    <div data-tone={tone} className="t3-hero t3-hero--soft mb-6 px-5 py-5 sm:px-7 sm:py-6">
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-4" style={art ? { paddingRight: 'min(26%, 9rem)' } : undefined}>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {icon ? (
            <span aria-hidden className="t3-tile size-14 shrink-0 rounded-2xl bg-white shadow-[var(--sh-1)] sm:size-16">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="m-0 text-[22px] leading-8 font-extrabold text-[var(--c-ink)] sm:text-[26px]">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-[14px] leading-6 text-[var(--c-ink-2)]">{subtitle}</p> : null}
            {children ? <div className="mt-2">{children}</div> : null}
          </div>
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element -- ภาพตกแต่งนิ่ง
        <img src={art} alt="" aria-hidden draggable={false} className="t3-hero-art" style={{ height: '112%', maxWidth: '22%' }} />
      ) : null}
    </div>
  )
}

/** กรอบเนื้อหาของหน้า — ระยะขอบเท่ากันทุกหน้าในแดชบอร์ด */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="teacher-page-body mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
}

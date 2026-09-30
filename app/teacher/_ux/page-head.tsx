import type { ReactNode } from 'react'

/**
 * หัวของหน้าในแดชบอร์ดครู — ชื่อหน้า + คำอธิบายสั้น + ปุ่มมุมขวา
 *
 * โครงแดชบอร์ด (แถบบน + เมนูข้าง) อยู่ที่ `layout.tsx` แล้ว หน้าแต่ละหน้าจึงเหลือแค่หัวกับเนื้อหา
 * ระยะ 16/24px ตามกติกาแดชบอร์ดที่ไปดูมา (ห่างระหว่างชิ้น 16 · ระหว่างหมวด 24-32)
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
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-title font-extrabold text-balance text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-label text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** กรอบเนื้อหาของหน้า — ระยะขอบเท่ากันทุกหน้าในแดชบอร์ด */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-5">{children}</div>
}

import Link from 'next/link'
import { ChevronRightIcon, cn } from '@/components/ui'

/**
 * ปุ่มลิงก์ใหญ่ของหน้าแรก — มีคำอธิบายบรรทัดรองใต้ชื่อปุ่ม
 *
 * ใช้ `<Link>` ไม่ใช่ `<button>` เพราะมันพาไปหน้าอื่นจริง ๆ
 * นักเรียนจึงกดค้างเพื่อเปิดแท็บใหม่ได้ และโปรแกรมอ่านหน้าจออ่านว่าเป็น "ลิงก์"
 */

type Variant = 'primary' | 'secondary'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-ink-onbrand shadow-soft-2 hover:bg-brand-700 active:bg-brand-700',
  secondary:
    'bg-surface-raised text-brand-700 shadow-soft-1 ring-2 ring-brand-100 ring-inset hover:bg-brand-50 active:bg-brand-100',
}

export function QuestLinkButton({
  href,
  label,
  hint,
  variant = 'primary',
}: {
  href: string
  label: string
  hint?: string
  variant?: Variant
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl px-5 py-4',
        'transition-[background-color,box-shadow,transform] duration-200 ease-[var(--ease-soft)]',
        'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
        'active:translate-y-px',
        VARIANT_CLASS[variant],
      )}
    >
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-body-lg font-bold text-balance">{label}</span>
        {hint ? <span className="mt-0.5 block text-label font-medium opacity-85">{hint}</span> : null}
      </span>
      <ChevronRightIcon width={24} height={24} aria-hidden className="shrink-0 opacity-80" />
    </Link>
  )
}

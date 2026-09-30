import Link from 'next/link'
import { cn } from './cn'
import { NAV_ICONS, type NavIconName } from './icons'

/**
 * แถบเมนูล่าง 5 ปุ่ม
 *
 * - ไม่ฝังรายการเมนูไว้ในตัว component — หน้าที่เรียกใช้ต้องส่ง `items` มาเอง
 *   (เมนูฝั่งนักเรียนกับฝั่งครูไม่เหมือนกัน และ label อาจถูกแปล/ปรับได้)
 * - ไม่ใช้ `usePathname()` เพื่อให้ยังเป็น server component ได้ ผู้เรียกส่ง `activeHref` มา
 * - ปุ่มละ 56px สูงเต็มความสูงแถบ เกินขั้นต่ำ 44px และแบ่งความกว้างเท่ากัน 5 ช่อง
 *   บนจอ 390px ได้ช่องละ ~76px ซึ่งกว้างพอสำหรับนิ้วโป้ง
 * - **ไม่ fixed และไม่จัดการพื้นที่ปลอดภัยเอง** — เป็นชั้น footer ของ AppShell
 *   ซึ่งอยู่กับที่อยู่แล้วโดยไม่ต้องลอยทับเนื้อหา และ AppShell เว้น
 *   `safe-area-inset-bottom` ให้พ้นแถบ home indicator ของ iPhone แล้ว
 */

export type BottomNavItem = {
  href: string
  label: string
  icon: NavIconName
  /** ตัวเลขแจ้งเตือน เช่น ภารกิจใหม่ 2 อัน */
  badge?: number
}

export type BottomNavProps = {
  items: BottomNavItem[]
  /** path ปัจจุบัน ใช้ตัดสินว่าแท็บไหนกำลังเปิดอยู่ */
  activeHref: string
  /** ชื่อของแถบเมนูสำหรับโปรแกรมอ่านหน้าจอ */
  ariaLabel?: string
  className?: string
}

export function BottomNav({
  items,
  activeHref,
  ariaLabel = 'เมนูหลัก',
  className,
}: BottomNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn('border-t border-line bg-surface-raised', className)}
    >
      <ul className="mx-auto flex w-full max-w-[30rem] items-stretch gap-1 px-2 py-1.5">
        {items.map((item) => {
          const IconComponent = NAV_ICONS[item.icon]
          const active = activeHref === item.href || activeHref.startsWith(`${item.href}/`)

          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5',
                  'rounded-xl px-1 py-1.5 text-center text-note font-semibold',
                  'transition-colors duration-200 ease-[var(--ease-soft)]',
                  'focus-visible:outline-3 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
                  active
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-ink-muted hover:bg-surface-sunken active:bg-surface-sunken',
                )}
              >
                <span className="relative">
                  <IconComponent width={24} height={24} />
                  {item.badge && item.badge > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-2.5 grid min-w-5 place-items-center rounded-full bg-spark-600 px-1 text-[0.6875rem] leading-5 font-bold text-ink-onbrand"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="w-full truncate leading-tight">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="sr-only">{`มี ${item.badge} รายการใหม่`}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

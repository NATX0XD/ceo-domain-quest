'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DomeFab, MAIN_TAB_PATHS } from '@/components/dome-fab'
import './bottom-nav.css'

type Tab = {
  href: string
  label: string
  icon: string
}

const TABS: Tab[] = [
  { href: '/home', label: 'หน้าหลัก', icon: '/icons/3d/seedling.webp' },
  { href: '/map', label: 'ภารกิจ', icon: '/icons/3d/chequered-flag.webp' },
  { href: '/knowledge', label: 'ความรู้', icon: '/icons/3d/books.webp' },
  { href: '/rewards', label: 'รางวัล', icon: '/icons/3d/trophy.webp' },
  { href: '/profile', label: 'โปรไฟล์', icon: '/icons/3d/bust-in-silhouette.webp' },
]

/**
 * แถบเมนูลอยแบบเกม — ขอบบนไล่สีกลืนกับฉากของหน้า (ไม่มีเส้นคั่น) แท็บที่อยู่ยกตัวขึ้นและเรือง
 * หน้าแท็บหลัก (ยกเว้นแผนที่ ซึ่งวางปุ่มโดมไว้ในภาพแผนที่เอง) มีปุ่มโดมลอยอยู่มุมขวาเหนือแถบ
 */
export function BottomNav() {
  const pathname = usePathname() ?? ''
  const tab = MAIN_TAB_PATHS.find((href) => pathname === href)
  const withDome = Boolean(tab && tab !== '/map')

  return (
    <nav aria-label="เมนูหลัก" className={`game-bottom-nav${withDome ? ' game-bottom-nav--dome' : ''}`}>
      {withDome && tab ? <DomeFab from={tab} className="game-bottom-nav__dome" /> : null}
      <ul className="game-bottom-nav__list">
        {TABS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <li key={item.href} className="game-bottom-nav__item">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`game-bottom-nav__link${active ? ' is-active' : ''}`}
              >
                <span className="game-bottom-nav__icon-wrap" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- icon เป็น asset 3D ขนาดเล็กใน public */}
                  <img src={item.icon} alt="" className="game-bottom-nav__icon" draggable={false} />
                </span>
                <span className="game-bottom-nav__label">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

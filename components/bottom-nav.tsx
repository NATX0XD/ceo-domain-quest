'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DomeFab, MAIN_TAB_PATHS } from '@/components/dome-fab'
import './bottom-nav.css'

type Tab = {
  href: string
  label: string
  /** ไอคอนชุด kit2 (วางไฟล์เมื่อไรก็ใช้ทันที) */
  kit: string
  /** ไอคอนสำรองเมื่อยังไม่มีไฟล์ kit2 */
  icon: string
}

/**
 * ไอคอนเมนู: ใช้ public/ui/kit2/nav/<ชื่อ>.webp ถ้ามีไฟล์ ไม่มีก็ใช้ไอคอน 3D เดิม
 * ช่องไอคอนแสดง 36×36 CSS px (32×32 ที่จอ ≤370px) object-fit: contain
 * → ไฟล์ใหม่ควรเป็นสี่เหลี่ยมจัตุรัส 1:1 พื้นโปร่งใส ขนาด 96×96 px (รองรับจอ 3x)
 */
const TABS: Tab[] = [
  { href: '/home', label: 'หน้าหลัก', kit: '/ui/kit2/nav/home.webp', icon: '/icons/3d/seedling.webp' },
  { href: '/map', label: 'ภารกิจ', kit: '/ui/kit2/nav/map.webp', icon: '/icons/3d/chequered-flag.webp' },
  { href: '/knowledge', label: 'ความรู้', kit: '/ui/kit2/nav/knowledge.webp', icon: '/icons/3d/books.webp' },
  { href: '/rewards', label: 'รางวัล', kit: '/ui/kit2/nav/rewards.webp', icon: '/icons/3d/trophy.webp' },
  { href: '/profile', label: 'โปรไฟล์', kit: '/ui/kit2/nav/profile.webp', icon: '/icons/3d/bust-in-silhouette.webp' },
]

/** ผลตรวจว่าไฟล์ kit2 มีจริงไหม — ตรวจครั้งเดียวต่อการโหลดแอป แล้วจำไว้ข้ามการเปลี่ยนหน้า */
let kitAvailable: Record<string, boolean> | null = null
let kitProbe: Promise<Record<string, boolean>> | null = null

function probeKitIcons(): Promise<Record<string, boolean>> {
  kitProbe ??= Promise.all(
    TABS.map(
      (tab) =>
        new Promise<[string, boolean]>((resolve) => {
          const img = new Image()
          img.onload = () => resolve([tab.kit, img.naturalWidth > 0])
          img.onerror = () => resolve([tab.kit, false])
          img.src = tab.kit
        }),
    ),
  ).then((entries) => (kitAvailable = Object.fromEntries(entries)))
  return kitProbe
}

function useKitIcons(): Record<string, boolean> {
  const [found, setFound] = useState<Record<string, boolean>>(() => kitAvailable ?? {})
  useEffect(() => {
    if (kitAvailable) return
    let alive = true
    void probeKitIcons().then((result) => {
      if (alive) setFound(result)
    })
    return () => {
      alive = false
    }
  }, [])
  return found
}

/**
 * แถบเมนูลอยแบบเกม — ขอบบนไล่สีกลืนกับฉากของหน้า (ไม่มีเส้นคั่น) แท็บที่อยู่ยกตัวขึ้นและเรือง
 * หน้าแท็บหลัก (ยกเว้นแผนที่ ซึ่งวางปุ่มโดมไว้ในภาพแผนที่เอง) มีปุ่มโดมลอยอยู่มุมขวาเหนือแถบ
 */
export function BottomNav() {
  const pathname = usePathname() ?? ''
  const tab = MAIN_TAB_PATHS.find((href) => pathname === href)
  const withDome = Boolean(tab && tab !== '/map')
  const kit = useKitIcons()

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
                  <img src={kit[item.kit] ? item.kit : item.icon} alt="" className="game-bottom-nav__icon" draggable={false} />
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

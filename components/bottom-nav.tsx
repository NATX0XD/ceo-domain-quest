'use client'

import { usePathname } from 'next/navigation'
import { BottomNav as BottomNavUI, type BottomNavItem } from '@/components/ui'

/**
 * แถบเมนูล่างของฝั่งนักเรียน — 5 แท็บตามภาพต้นแบบ
 *
 * ไฟล์นี้เหลือหน้าที่เดียวคือ "บอกว่าแอปนี้มีแท็บอะไรบ้าง" แล้วส่งต่อให้
 * `components/ui/bottom-nav.tsx` ซึ่งเป็นตัวเดียวที่รู้เรื่องหน้าตาและ a11y
 * ระบบจึงมี BottomNav ตัวจริงแค่ตัวเดียว ไม่ใช่สองตัวที่ต้องคอยแก้ให้ตรงกัน
 *
 * ต้องเป็น client component เพราะใช้ `usePathname()` หาแท็บปัจจุบันเท่านั้น
 * ⚠️ ห้าม import เนื้อหา/เฉลย (core/*, components/server/*, content/*.json) เข้ามาในไฟล์นี้เด็ดขาด
 *    ทุกอย่างในนี้เป็นแค่ลิงก์กับป้ายชื่อเมนู ไม่ใช่ข้อมูลของผู้เรียน
 */
const TABS: BottomNavItem[] = [
  { href: '/home', label: 'หน้าหลัก', icon: 'home' },
  { href: '/map', label: 'ภารกิจ', icon: 'quest' },
  { href: '/knowledge', label: 'ความรู้', icon: 'knowledge' },
  { href: '/rewards', label: 'รางวัล', icon: 'reward' },
  { href: '/profile', label: 'โปรไฟล์', icon: 'profile' },
]

export function BottomNav() {
  const pathname = usePathname() ?? ''
  return <BottomNavUI items={TABS} activeHref={pathname} />
}

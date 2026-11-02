import Link from 'next/link'
import type { ReactNode } from 'react'
import { DomeAvatar, StatBadge, cn } from '@/components/ui'
import { AppFooter, AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import { SessionClock } from '@/components/session-clock'

/**
 * โครงหน้าจอฝั่งนักเรียน — ห่อ AppShell อีกชั้นเพื่อเติมของที่ทุกหน้าของนักเรียนต้องมี
 * (นาฬิกาช่วงกิจกรรม และแถบเมนูล่าง) หน้าที่เรียกใช้จึงไม่ต้องรู้เรื่องโครง 3 ชั้นเลย
 *
 * โครงที่ได้: [นาฬิกา + header ของหน้า] อยู่กับที่ · [children] เลื่อนได้ · [footer + แถบเมนู] อยู่กับที่
 *
 * ⚠️ ไฟล์นี้ไม่มีข้อมูลของผู้เรียนฝังอยู่เลย ทุกค่ามาจาก props ที่หน้าอ่านจากฐานข้อมูล/API
 */

export type StudentShellProps = {
  children: ReactNode
  /** true เมื่อหน้านี้มีแถบเมนูล่าง 5 ปุ่ม */
  withBottomNav?: boolean
  /** แถบบนที่อยู่กับที่ เช่น ปุ่มย้อนกลับ + ชื่อหน้า (ใส่ใน AppHeader มาเอง) */
  header?: ReactNode
  /** ปุ่มลงมือหลักของหน้า อยู่กับที่เหนือแถบเมนู (ใส่ใน AppFooter มาเอง) */
  footer?: ReactNode
  /** คลาสของกล่องเนื้อหาที่เลื่อนได้ */
  className?: string
}

export function StudentShell({
  children,
  withBottomNav = false,
  header,
  footer,
  className,
}: StudentShellProps) {
  return (
    <AppShell
      className={cn('student-world student-display', className)}
      header={
        <>
          {/* S-11 แถบช่วงกิจกรรม + หน้าพัก "ดูจอหน้าห้อง" — อยู่ทุกหน้าของนักเรียน
              ครูยังไม่เปิดคาบ = ไม่เรนเดอร์อะไรเลย */}
          <SessionClock />
          {header}
        </>
      }
      footer={
        footer || withBottomNav ? (
          <>
            {footer}
            {withBottomNav ? <BottomNav /> : null}
          </>
        ) : null
      }
    >
      <div className={cn('px-4 pt-5 pb-8', className)}>{children}</div>
    </AppShell>
  )
}

export type PageHeadingProps = {
  /** ป้ายเล็กเหนือหัวข้อ บอกว่าอยู่ส่วนไหนของคาบ */
  eyebrow?: string
  title: string
  description?: ReactNode
  /** มุมขวา เช่น ป้ายดาว */
  trailing?: ReactNode
  className?: string
}

export function PageHeading({
  eyebrow,
  title,
  description,
  trailing,
  className,
}: PageHeadingProps) {
  return (
    <header className={cn('mb-5 flex items-start gap-3', className)}>
      <div className="min-w-0 flex-1">
        {/* ป้ายบอกตำแหน่งในคาบเป็นชิป ไม่ใช่ข้อความลอย — สายตาจับได้ก่อนหัวข้อ
            และแยกออกจากคำอธิบายใต้หัวข้อชัดเจน */}
        {eyebrow ? <p className="eyebrow-chip mb-1.5">{eyebrow}</p> : null}
        <h1 className="page-heading-sign text-display font-extrabold text-balance text-ink">{title}</h1>
        {/* ขีดสั้นใต้หัวข้อ ทำหน้าที่เป็นเส้นแบ่งแทนกรอบ ไม่กินที่และไม่เพิ่มเส้นรบกวน */}
        <span aria-hidden="true" className="mt-2 block h-1.5 w-14 rounded-full bg-brand-400" />
        {description ? (
          <p className="mt-2.5 text-body text-pretty text-ink-muted">{description}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0 pt-1">{trailing}</div> : null}
    </header>
  )
}

export type StudentTopBarProps = {
  /** ชื่อเล่นจากฐานข้อมูล — null เมื่อยังโหลดไม่ได้ */
  nickname: string | null
  /** ข้อความบรรทัดรอง เช่น ชื่อห้อง */
  subtitle?: string
  /** ดาวสะสมจากฐานข้อมูล */
  stars?: number
  className?: string
}

/** แถบบนสุดของหน้าที่มีแถบเมนูล่าง — ชื่อนักเรียนซ้าย ดาวขวา ตามภาพต้นแบบหน้า 3 */
export function StudentTopBar({ nickname, subtitle, stars, className }: StudentTopBarProps) {
  return (
    <header className={cn('mb-4 flex items-center gap-3', className)}>
      <DomeAvatar mood="greet" size={44} decorative />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold text-ink">{nickname ?? '—'}</p>
        {subtitle ? <p className="truncate text-note text-ink-muted">{subtitle}</p> : null}
      </div>
      {stars != null ? (
        <StatBadge kind="star" value={stars} label="ดาวสะสม" hideLabel size="sm" />
      ) : null}
    </header>
  )
}

export type SignInGateProps = {
  /** อธิบายว่าหน้านี้ต้องเข้าห้องก่อนเพราะอะไร */
  message?: string
}

/**
 * หน้าจอที่แสดงเมื่อยังไม่มี session ของนักเรียน
 * ทุกหน้าฝั่งนักเรียนใช้ตัวนี้ตัวเดียวกัน ข้อความจะได้ไม่เพี้ยนกันไปคนละอย่าง
 */
export function SignInGate({
  message = 'ใส่รหัสห้อง 6 ตัวกับรหัส 4 หลักที่ครูให้ก่อน แล้วโดมจะรออยู่ตรงนี้',
}: SignInGateProps) {
  return (
    <AppShell
      className="student-world student-display media-shell"
      mainClassName="grid place-items-center"
      footer={
        <AppFooter className="flex flex-col items-center gap-1">
          <Link
            href="/join"
            className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
            prefetch={false}
          >
            ไปหน้าเข้าห้องเรียน
          </Link>
          <Link
            href="/"
            className="tap-target rounded-md px-3 text-label font-bold text-brand-700 underline focus-ring"
          >
            กลับหน้าแรก
          </Link>
        </AppFooter>
      }
    >
      <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
        <DomeAvatar mood="greet" size={128} decorative />
        <h1 className="text-title font-extrabold text-balance text-ink">ยังไม่ได้เข้าห้องเรียน</h1>
        <p className="max-w-[24rem] text-body text-pretty text-ink-muted">{message}</p>
      </div>
    </AppShell>
  )
}

export type SectionProps = {
  title: string
  description?: string
  /** ปุ่ม/ลิงก์มุมขวาของหัวข้อ */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** หัวข้อย่อยในหน้า — ใช้ h2 เสมอ เพื่อให้ลำดับหัวข้อของทุกหน้าเป็น h1 > h2 > h3 */
export function Section({ title, description, action, children, className }: SectionProps) {
  return (
    <section className={cn('mt-7', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {/* ขีดสีหน้าหัวข้อ — แยก "หัวข้อ" ออกจาก "เนื้อหา" โดยไม่ต้องขยายตัวอักษร
              ช่วยมากบนจอ 390 ที่ทุกอย่างเรียงต่อกันเป็นแถวเดียว */}
          <span aria-hidden="true" className="accent-rule mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-title-sm font-extrabold text-balance text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-label text-ink-muted">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

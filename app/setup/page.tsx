import type { Metadata } from 'next'
import Link from 'next/link'
import { businessTypes } from '@/core/content'
import { SetupForm } from '@/components/setup-form'
import { SignInGate } from '@/components/student-shell'
import { AppFooter, AppShell } from '@/components/app-shell'
import { Card, ChevronRightIcon, DomeAvatar, LockIcon } from '@/components/ui'
import { isShopProfileLocked, loadShopProfile } from '@/components/server/game-state'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'ตั้งค่าร้าน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * โหลดรายการประเภทร้านที่เซิร์ฟเวอร์ แล้วส่งเฉพาะฟิลด์ที่หน้าจอใช้
 * (keywords ของแต่ละประเภทใช้ตรวจกฎตั้งชื่อ ไม่ต้องส่งไปให้เบราว์เซอร์)
 */
export default async function SetupPage() {
  const session = await readStudentSession()
  if (!session) {
    return <SignInGate message="ใส่รหัสห้อง 6 ตัวกับรหัส 4 หลักที่ครูให้ก่อน แล้วค่อยตั้งค่าร้าน" />
  }

  const [profile, locked] = await Promise.all([
    loadShopProfile(session.studentId),
    isShopProfileLocked(session.studentId),
  ])

  if (locked) {
    return (
      <AppShell
        mainClassName="grid place-items-center"
        footer={
          <AppFooter>
            <Link
              href="/home"
              className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
            >
              กลับหน้าหลัก
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
        }
      >
        <div className="flex flex-col items-center gap-5 px-4 py-8 text-center">
        <DomeAvatar mood="cheer" size={112} decorative />

        <h1 className="flex items-center gap-2 text-title font-extrabold text-balance text-ink">
          <LockIcon width={26} height={26} aria-hidden className="shrink-0 text-brand-600" />
          ข้อมูลร้านถูกล็อกแล้ว
        </h1>

        <p className="max-w-[24rem] text-body text-pretty text-ink-muted">
          เริ่มทำภารกิจไปแล้ว จึงแก้ข้อมูลร้านไม่ได้ ถ้าจำเป็นต้องแก้ให้ยกมือบอกครู
        </p>

        <Card tone="brand" padding="md" className="w-full max-w-[24rem] text-left">
          <p className="text-label font-semibold text-ink-muted">ร้านของเรา</p>
          <p className="mt-1 text-title-sm font-extrabold text-balance text-brand-700">
            {profile?.shopName ?? 'ยังไม่มีข้อมูล'}
          </p>
        </Card>
        </div>
      </AppShell>
    )
  }

  const options = businessTypes.map((b) => ({ id: b.id, label: b.label, icon: b.icon }))
  return <SetupForm businessTypes={options} />
}

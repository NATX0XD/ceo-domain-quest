import type { Metadata } from 'next'
import Link from 'next/link'
import { businessTypes } from '@/core/content'
import { SetupForm } from '@/components/setup-form'
import { SignInGate } from '@/components/student-shell'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'
import { ChevronRightIcon } from '@/components/ui'
import { PageStateCard, PageStateTip } from '@/components/page-state-card'
import './setup-locked.css'
import { isShopProfileLocked, loadShopProfile } from '@/components/server/game-state'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { resolveShopArt } from '@/components/server/shop-art-file'
import { shopArtFallbackSrc } from '@/components/shop-art'
import { ShopArtImg } from '@/components/shop-art-img'
import { certificateDisplayNameFromProfile } from '@/lib/certificate/profile'
import { getProfile } from '@/lib/db/repo'

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

  const [profile, locked, dbProfile] = await Promise.all([
    loadShopProfile(session.studentId),
    isShopProfileLocked(session.studentId),
    getProfile(session.studentId),
  ])

  if (locked) {
    return (
      <AppShell
        className="student-world student-display media-shell setup-locked-shell"
        mainClassName="flex flex-col"
        header={<AppHeader backHref="/home"><h1>ตั้งค่าร้านของเรา</h1></AppHeader>}
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
        <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
          <PageStateCard
            art="/icons/3d/locked.webp"
            title="ข้อมูลร้านถูกล็อกแล้ว"
            body="เริ่มทำภารกิจไปแล้ว จึงแก้ข้อมูลร้านไม่ได้ ถ้าจำเป็นต้องแก้ให้ยกมือบอกครู"
          >
            <div className="setup-locked-shop">
              <ShopArtImg src={resolveShopArt(profile?.businessTypeId, 5)} fallback={shopArtFallbackSrc(5)} alt="" />
              <div>
                <p>ร้านของเรา</p>
                <strong>{profile?.shopName ?? 'ยังไม่มีข้อมูล'}</strong>
              </div>
            </div>
            <PageStateTip icon="/icons/3d/rocket.webp">ข้อมูลร้านนี้ใช้ต่อในทุกภารกิจจนจบคาบ</PageStateTip>
          </PageStateCard>
        </div>
      </AppShell>
    )
  }

  // ภาพตัวอย่างร้านขั้น 1 ของแต่ละประเภท — เช็กไฟล์ที่เซิร์ฟเวอร์ ประเภทที่ยังไม่มีภาพได้ภาพกลาง
  const options = businessTypes.map((b) => ({ id: b.id, label: b.label, icon: b.icon, art: resolveShopArt(b.id, 1) }))
  return (
    <SetupForm
      businessTypes={options}
      initialCertificateDisplayName={certificateDisplayNameFromProfile(dbProfile) ?? ''}
    />
  )
}

import type { Metadata } from 'next'
import { UrlTabs } from '../_ux/url-tabs'
import QRCode from 'qrcode'
import { getTeacher } from '@/lib/db/repo'
import { TeacherRoomClient } from '@/components/teacher-room-client'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { Icon3d } from '../_ux/v2'
import { Card } from '../_ux/ui'
import { TeacherAccountPanel } from './account-panel'

export const metadata: Metadata = { title: 'ตั้งค่าห้อง — สำหรับครู' }
export const dynamic = 'force-dynamic'

const EXPORTS = [
  { type: 'students', label: 'รายชื่อ', icon: 'graduation-cap' },
  { type: 'scores', label: 'คะแนน', icon: 'bar-chart' },
  { type: 'events', label: 'ร่องรอยการเรียน', icon: 'clipboard' },
  { type: 'reflections', label: 'สะท้อนคิด', icon: 'brain' },
  { type: 'survey', label: 'ความพึงพอใจ', icon: 'sparkles' },
] as const

/**
 * ตั้งค่าห้อง — ของที่ครูกดนาน ๆ ครั้ง รวมไว้หน้าเดียว (UX-6)
 * รหัสห้อง/QR · สวิตช์ของคาบ · สวิตช์ปิด AI · แบบทดสอบหลังเรียน · ดาวน์โหลดข้อมูล · โหมดสาธิต
 */
export default async function TeacherSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignedOut title="ตั้งค่าห้อง" />

  const teacher = await getTeacher(data.teacherId)

  // QR ของลิงก์เข้าห้อง — สร้างเป็น SVG ฝั่งเซิร์ฟเวอร์ ไม่ต้องพึ่ง JS ฝั่งเบราว์เซอร์
  const joinPath = data.selectedRoomCode ? `/join?code=${data.selectedRoomCode}` : '/join'
  const joinUrl = `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}${joinPath}`
  const qrSvg = data.selectedRoomCode
    ? await QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 280 })
    : null

  return (
    <PageBody>
      <PageHead tone="gray" icon={<Icon3d name="clipboard" size={36} />} title="ตั้งค่าห้อง" subtitle="บัญชี รหัสห้อง และการดาวน์โหลดข้อมูล" />

      <UrlTabs
        label="หมวดตั้งค่าห้อง"
        items={[
          { value: 'room', label: 'ห้องเรียน', content: (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <TeacherRoomClient roomCode={data.selectedRoomCode} joinPath={joinPath} classroomId={data.selectedId} />

          {qrSvg ? (
            <Card icon={<Icon3d name="door" size={22} />} tone="teal" title="สแกนเข้าห้อง" className="text-center">
              {/* eslint-disable-next-line react/no-danger */}
              <div
                className="mx-auto w-full max-w-[12rem]"
                role="img"
                aria-label={`QR code ของลิงก์ ${joinUrl}`}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="mt-3 text-[14px] break-all text-[var(--c-ink-3)]">{joinUrl}</p>
            </Card>
          ) : null}
        </div>

          ) },
          { value: 'account', label: 'บัญชี', content: (
            <>{teacher ? <TeacherAccountPanel email={teacher.email} initialDisplayName={teacher.name ?? ''} /> : null}</>
          ) },
          { value: 'export', label: 'ดาวน์โหลดข้อมูล', content: (
        <>{data.selectedId ? (
          <Card
            icon={<Icon3d name="package" size={22} />}
            tone="amber"
            title="ดาวน์โหลด CSV"
            tip="ไฟล์ใช้ชื่อสมมติแทนชื่อจริงของนักเรียน (pseudonymize) นำไปวิเคราะห์ต่อได้เลย"
          >
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {EXPORTS.map((item) => (
                <li key={item.type}>
                  <a
                    href={`/api/teacher/export?classroomId=${data.selectedId}&type=${item.type}&pseudonymize=1`}
                    className="flex h-12 items-center gap-3 rounded-lg border border-[var(--c-line-strong)] bg-white px-3 text-[15px] font-semibold text-[var(--c-ink)] transition-colors hover:bg-[var(--c-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none"
                  >
                    <Icon3d name={item.icon} size={24} />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}</>
          ) },
        ]}
      />
    </PageBody>
  )
}

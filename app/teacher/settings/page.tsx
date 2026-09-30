import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { getActiveClassSession } from '@/lib/db/repo'
import { TeacherRoomClient } from '@/components/teacher-room-client'
import { TeacherPosttestClient } from '@/components/teacher-posttest-client'
import { Card } from '@/components/ui'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { AiSwitch } from '../ai-switch'
import { DemoModeBanner } from '../demo-mode'
import { SessionSettings } from './session-settings'

export const metadata: Metadata = { title: 'ตั้งค่าห้อง — สำหรับครู' }
export const dynamic = 'force-dynamic'

const EXPORTS = [
  { type: 'students', label: 'รายชื่อและโปรไฟล์' },
  { type: 'scores', label: 'คะแนนก่อน-หลังเรียน' },
  { type: 'events', label: 'ร่องรอยการเรียน' },
  { type: 'reflections', label: 'สะท้อนคิด' },
  { type: 'survey', label: 'ความพึงพอใจ' },
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

  const activeSession = data.selectedId ? await getActiveClassSession(data.selectedId) : null

  // QR ของลิงก์เข้าห้อง — สร้างเป็น SVG ฝั่งเซิร์ฟเวอร์ ไม่ต้องพึ่ง JS ฝั่งเบราว์เซอร์
  const joinPath = data.selectedRoomCode ? `/join?code=${data.selectedRoomCode}` : '/join'
  const joinUrl = `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}${joinPath}`
  const qrSvg = data.selectedRoomCode
    ? await QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 280 })
    : null

  return (
    <PageBody>
      <PageHead
        title="ตั้งค่าห้อง"
        subtitle="รหัสห้องและ QR · สวิตช์ของคาบ · สวิตช์ปิด AI · ดาวน์โหลดข้อมูล"
      />

      <div className="flex flex-col gap-4">
        {/* E-16 ป้ายโหมดสาธิต + ปุ่มล้างกลับค่าเริ่มต้น — ขึ้นเฉพาะห้องที่ติดป้ายห้องสาธิต */}
        <DemoModeBanner
          classroomId={data.selectedId}
          roomCode={data.selectedRoomCode}
          isDemo={data.selectedIsDemo}
          showReset
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <TeacherRoomClient roomCode={data.selectedRoomCode} joinPath={joinPath} />

          {qrSvg ? (
            <Card as="section" className="text-center">
              <h2 className="text-title-sm font-bold text-ink">สแกนเข้าห้องได้เลย</h2>
              {/* eslint-disable-next-line react/no-danger */}
              <div
                className="mx-auto mt-3 w-full max-w-[14rem]"
                role="img"
                aria-label={`QR code ของลิงก์ ${joinUrl}`}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="mt-3 text-label break-all text-ink-muted">{joinUrl}</p>
            </Card>
          ) : null}
        </div>

        <SessionSettings classroomId={data.selectedId} />

        <AiSwitch
          sessionId={activeSession?.id ?? null}
          aiEnabled={activeSession?.ai_enabled ?? true}
        />

        <TeacherPosttestClient classroomId={data.selectedId} />

        {data.selectedId ? (
          <Card as="section">
            <h2 className="text-title-sm font-bold text-ink">ดาวน์โหลดข้อมูลเป็น CSV</h2>
            <p className="mt-1 text-label text-ink-muted">
              ไฟล์ใช้ชื่อสมมติแทนชื่อจริงของนักเรียน (pseudonymize) นำไปวิเคราะห์ต่อได้เลย
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {EXPORTS.map((item) => (
                <li key={item.type}>
                  <a
                    href={`/api/teacher/export?classroomId=${data.selectedId}&type=${item.type}&pseudonymize=1`}
                    className="btn-base w-full bg-surface-raised text-ink ring-1 ring-line ring-inset hover:bg-brand-50"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </PageBody>
  )
}

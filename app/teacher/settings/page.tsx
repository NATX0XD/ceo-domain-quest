import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { getActiveClassSession } from '@/lib/db/repo'
import { TeacherRoomClient } from '@/components/teacher-room-client'
import { TeacherPosttestClient } from '@/components/teacher-posttest-client'
import { loadTeacherPage, TeacherSignedOut, type SearchParams } from '../_lib/teacher-page'
import { PageBody, PageHead } from '../_ux/page-head'
import { Icon3d, InfoTip } from '../_ux/v2'
import { AiSwitch } from '../ai-switch'
import { DemoModeBanner } from '../demo-mode'
import { SessionSettings } from './session-settings'

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

  const activeSession = data.selectedId ? await getActiveClassSession(data.selectedId) : null

  // QR ของลิงก์เข้าห้อง — สร้างเป็น SVG ฝั่งเซิร์ฟเวอร์ ไม่ต้องพึ่ง JS ฝั่งเบราว์เซอร์
  const joinPath = data.selectedRoomCode ? `/join?code=${data.selectedRoomCode}` : '/join'
  const joinUrl = `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}${joinPath}`
  const qrSvg = data.selectedRoomCode
    ? await QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 280 })
    : null

  return (
    <PageBody>
      <PageHead title="ตั้งค่าห้อง" subtitle="รหัสห้อง · สวิตช์ของคาบ · ข้อมูล" />

      <div className="t2-stack">
        {/* E-16 ป้ายโหมดสาธิต + ปุ่มล้างกลับค่าเริ่มต้น — ขึ้นเฉพาะห้องที่ติดป้ายห้องสาธิต */}
        <DemoModeBanner
          classroomId={data.selectedId}
          roomCode={data.selectedRoomCode}
          isDemo={data.selectedIsDemo}
          showReset
        />

        <div className="t2-grid-2" style={{ alignItems: 'stretch' }}>
          <TeacherRoomClient roomCode={data.selectedRoomCode} joinPath={joinPath} />

          {qrSvg ? (
            <section className="t2-card text-center">
              <h2 className="t2-card-title" style={{ justifyContent: 'center' }}>
                <Icon3d name="magnifying-glass-tilted-left" size={32} />
                สแกนเข้าห้อง
              </h2>
              {/* eslint-disable-next-line react/no-danger */}
              <div
                className="mx-auto w-full max-w-[12rem]"
                role="img"
                aria-label={`QR code ของลิงก์ ${joinUrl}`}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="mt-2 text-note font-bold break-all text-ink-muted">{joinUrl}</p>
            </section>
          ) : null}
        </div>

        <SessionSettings classroomId={data.selectedId} />

        <AiSwitch
          sessionId={activeSession?.id ?? null}
          aiEnabled={activeSession?.ai_enabled ?? true}
        />

        <TeacherPosttestClient classroomId={data.selectedId} />

        {data.selectedId ? (
          <section className="t2-card">
            <h2 className="t2-card-title">
              <Icon3d name="package" size={32} />
              ดาวน์โหลด CSV
              <InfoTip
                label="เรื่องไฟล์ CSV"
                text="ไฟล์ใช้ชื่อสมมติแทนชื่อจริงของนักเรียน (pseudonymize) นำไปวิเคราะห์ต่อได้เลย"
              />
            </h2>
            <ul className="t2-grid" style={{ listStyle: 'none', padding: 0, margin: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 13rem), 1fr))' }}>
              {EXPORTS.map((item) => (
                <li key={item.type}>
                  <a
                    href={`/api/teacher/export?classroomId=${data.selectedId}&type=${item.type}&pseudonymize=1`}
                    className="t2-btn focus-ring"
                    data-block="true"
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Icon3d name={item.icon} size={26} />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PageBody>
  )
}

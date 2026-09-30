import type { Metadata } from 'next'
import { getActiveClassSession, listPendingReview } from '@/lib/db/repo'
import { TeacherLoginClient } from '@/components/teacher-login-client'
import { TeacherFlagsClient } from '@/components/teacher-flags-client'
import { readTeacherSession } from '@/app/api/_lib/session-cookie'
import { loadTeacherPage, type SearchParams } from './_lib/teacher-page'
import { DemoModeBanner } from './demo-mode'
import { TeacherCockpit } from './_ux/cockpit'

export const metadata: Metadata = { title: 'สำหรับครู — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * หน้าแรกของแดชบอร์ดครู = **คุมคาบสด**
 *
 * โครงแดชบอร์ด (แถบบน + เมนูข้าง + ปุ่มออกจากระบบ) อยู่ที่ `layout.tsx` แล้ว
 * หน้านี้จึงเหลือเฉพาะเนื้อหาของงาน "คุมคาบ" — ของที่นาน ๆ ใช้ทีย้ายไปหน้าอื่นในเมนูหมดแล้ว
 * (งานรอตรวจ · คำขอ · ผลงาน · ตั้งค่าห้อง)
 *
 * ⚠️ ยังไม่ได้เข้าสู่ระบบ = แสดงฟอร์มเข้าสู่ระบบ (layout จะไม่ใส่โครงให้)
 */
/**
 * หน้าเข้าสู่ระบบของครู — ฟอร์มเดิม + ทางออกเมื่อเข้าไม่ได้ (flow-1 ข้อ 26)
 * ของเดิมมีแค่ช่องอีเมล/รหัสผ่าน ครูที่จำรหัสไม่ได้ในวันแข่งไปต่อไม่ได้เลย
 */
function TeacherSignInScreen() {
  return (
    <div>
      <TeacherLoginClient />
      <p className="mx-auto mt-4 max-w-md px-4 pb-8 text-center text-label text-ink-muted">
        ลืมรหัสผ่าน หรือยังไม่มีบัญชีครู — ติดต่อผู้ดูแลระบบของวิทยาลัยเพื่อขอตั้งรหัสใหม่
        (ระบบไม่ส่งอีเมลรีเซ็ตรหัสผ่านเอง)
      </p>
    </div>
  )
}

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await readTeacherSession()
  if (!session) return <TeacherSignInScreen />

  const data = await loadTeacherPage(await searchParams)
  if (!data) return <TeacherSignInScreen />

  const pending = data.selectedId ? await listPendingReview(data.teacherId, data.selectedId) : null
  const activeSession = data.selectedId ? await getActiveClassSession(data.selectedId) : null

  return (
    <TeacherCockpit
      classroomId={data.selectedId}
      roomCode={data.selectedRoomCode}
      pendingCount={pending?.length ?? 0}
      hasOpenSession={activeSession !== null}
      alertsSlot={
        <>
          {/* E-16 ป้ายโหมดสาธิต — ขึ้นเฉพาะห้องที่ติดป้ายห้องสาธิต */}
          <DemoModeBanner
            classroomId={data.selectedId}
            roomCode={data.selectedRoomCode}
            isDemo={data.selectedIsDemo}
          />
          {/* E-11 ข้อความที่ต้องดูแล — ไม่มีอะไรต้องดูแลก็ไม่กินที่เลย */}
          <TeacherFlagsClient classroomId={data.selectedId} />
        </>
      }
    />
  )
}

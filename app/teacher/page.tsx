import type { Metadata } from 'next'
import { getClassroomReportRaw, listPendingReview } from '@/lib/db/repo'
import { TeacherLoginClient } from '@/components/teacher-login-client'
import { readTeacherSession } from '@/app/api/_lib/session-cookie'
import { loadTeacherPage, type SearchParams } from './_lib/teacher-page'
import Link from 'next/link'
import { PageBody, PageHead } from './_ux/page-head'
import { HomeOverview, type HomeStudent } from './_ux/home-overview'

export const metadata: Metadata = { title: 'สำหรับครู — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/** Home is intentionally read-only: students set their own pace and the teacher reviews progress. */
/**
 * หน้าเข้าสู่ระบบของครู — ฟอร์มเดิม + ทางออกเมื่อเข้าไม่ได้ (flow-1 ข้อ 26)
 * ของเดิมมีแค่ช่องอีเมล/รหัสผ่าน ครูที่จำรหัสไม่ได้ในวันแข่งไปต่อไม่ได้เลย
 */
function TeacherSignInScreen() {
  return (
    <div className="teacher-auth-route">
      <TeacherLoginClient />
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

  const [pending, raw] = data.selectedId
    ? await Promise.all([
        listPendingReview(data.teacherId, data.selectedId),
        getClassroomReportRaw(data.teacherId, data.selectedId).catch(() => null),
      ])
    : [null, null]

  const q = data.selectedId ? `?classroomId=${data.selectedId}` : ''
  const students: HomeStudent[] = (raw?.students ?? []).map((student) => ({
    studentId: student.studentId,
    nickname: student.nickname,
    passed: student.missions.filter((m) => m.passed).map((m) => m.missionId),
    started: student.missions.map((m) => m.missionId),
    ceoDone: student.submission !== null,
    pre: student.profile?.preTestScore ?? null,
  }))

  return (
    <PageBody>
      <PageHead
        title="ห้องเรียนของคุณ"
        subtitle="ดูความคืบหน้าของแต่ละคนได้ทันที ผู้เรียนเริ่มด่านตามความพร้อมของตัวเอง"
        action={
          <>
            <Link href={`/teacher/report${q}`} className="t2-btn">ดูรายงานห้อง</Link>
            <Link href={`/teacher/missions${q}`} className="t2-btn" data-kind="primary">ตั้งค่าด่าน</Link>
          </>
        }
      />
      <HomeOverview students={students} pendingCount={pending?.length ?? 0} classroomId={data.selectedId} roomCode={data.selectedRoomCode ?? null} />
    </PageBody>
  )
}

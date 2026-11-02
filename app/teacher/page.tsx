import type { Metadata } from 'next'
import { getClassroomReportRaw, listPendingReview } from '@/lib/db/repo'
import { TeacherLoginClient } from '@/components/teacher-login-client'
import { readTeacherSession } from '@/app/api/_lib/session-cookie'
import { loadTeacherPage, type SearchParams } from './_lib/teacher-page'
import { PageBody } from './_ux/page-head'
import { getServiceClient } from '@/lib/db/client'
import { HomeOverview, type HomeStudent } from './_ux/home-overview'
import { loadShopTypes, toCardData } from './_lib/student-cards-data'

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

  const types = await loadShopTypes((raw?.students ?? []).map((st) => st.studentId))
  const cards = toCardData(raw, types, new Set((pending ?? []).map((p) => p.student_id)))
  const students: HomeStudent[] = cards.map((c, i) => {
    const st = raw!.students[i]!
    return { ...c, passedIds: st.missions.filter((m) => m.passed).map((m) => m.missionId), startedIds: st.missions.map((m) => m.missionId) }
  })

  const me = await getServiceClient().from('teachers').select('name, email').eq('id', data.teacherId).maybeSingle()
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Bangkok' }).format(new Date()))
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'

  return (
    <PageBody>
      <HomeOverview
        students={students}
        pendingCount={pending?.length ?? 0}
        classroomId={data.selectedId}
        roomCode={data.selectedRoomCode ?? null}
        greeting={greeting}
        teacherName={me.data?.name || me.data?.email?.split('@')[0] || null}
      />
    </PageBody>
  )
}

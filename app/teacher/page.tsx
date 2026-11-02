import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { getClassroomReportRaw, listClassroomCeoWorks, listPendingReview } from '@/lib/db/repo'
import { showcaseSafeForPeers } from '@/components/server/showcase-safety'
import { TeacherLoginClient } from '@/components/teacher-login-client'
import { readTeacherSession } from '@/app/api/_lib/session-cookie'
import { loadTeacherPage, type SearchParams } from './_lib/teacher-page'
import { PageBody } from './_ux/page-head'
import { HomeOverview, type HomeStudent, type HelpStudent } from './_ux/home-overview'
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
    <div className="tla-route">
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

  // นักเรียนที่ต้องช่วย: ยังไม่เริ่ม (เข้าห้องเกิน 1 วัน) · ติดอยู่ (พยายามซ้ำ ≥3 ครั้งยังไม่ผ่าน) · เงียบหาย ≥3 วัน
  const DAY = 86_400_000
  const now = Date.now()
  const help: HelpStudent[] = []
  for (const st of raw?.students ?? []) {
    if (st.submission !== null) continue
    const stamps = st.missions.flatMap((m) => [m.startedAt, m.passedAt]).filter((t): t is string => !!t).map((t) => Date.parse(t))
    const last = Math.max(Date.parse(st.joinedAt), ...stamps)
    if (st.missions.length === 0) {
      if (now - Date.parse(st.joinedAt) > DAY) help.push({ studentId: st.studentId, nickname: st.nickname, reason: 'ยังไม่เริ่มเรียน' })
    } else if (st.missions.some((m) => !m.passed && m.attempts >= 3)) {
      help.push({ studentId: st.studentId, nickname: st.nickname, reason: 'ทำซ้ำหลายรอบยังไม่ผ่าน' })
    } else if (now - last > 3 * DAY) {
      help.push({ studentId: st.studentId, nickname: st.nickname, reason: `เงียบไป ${Math.floor((now - last) / DAY)} วัน` })
    }
  }

  // ผลงานรอคัด: ใบเสนอล่าสุดของแต่ละคนที่ตัวกรองติดธง และครูยังไม่ตัดสิน
  const works = (data.selectedId ? await listClassroomCeoWorks(data.teacherId, data.selectedId).catch(() => null) : null) ?? []
  const latest = new Map<string, (typeof works)[number]>()
  for (const w of works) {
    const prev = latest.get(w.nickname)
    if (!prev || w.created_at > prev.created_at) latest.set(w.nickname, w)
  }
  const showcaseCount = [...latest.values()].filter(
    (w) => (w.peer_visible ?? null) === null && !showcaseSafeForPeers({ domainName: w.domain_name, tld: w.tld, reasonText: w.reason_text }),
  ).length

  const joinPath = data.selectedRoomCode ? `/join?code=${data.selectedRoomCode}` : null
  const joinUrl = joinPath ? `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}${joinPath}` : null
  const qrSvg = joinUrl ? await QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 240 }) : null

  // โดมสรุปห้อง: สร้างจากข้อมูลรายงานด้วยกฎ ไม่เรียก AI ตอนโหลดหน้า
  const MISSION_NAME: Record<string, string> = { m1: 'รู้จักชื่อโดเมน', m2: 'เลือกนามสกุล', m3: 'เจ้าหน้าที่จดทะเบียน', m4: 'ค้นหาชื่อที่ใช่' }
  const rawStudents = raw?.students ?? []
  const dome: string[] = []
  if (rawStudents.length > 0) {
    const certs = rawStudents.filter((st) => st.submission !== null).length
    dome.push(`เข้าห้อง ${rawStudents.length} คน · ได้เกียรติบัตรแล้ว ${certs}`)
    let worst: { id: string; n: number } | null = null
    for (const id of Object.keys(MISSION_NAME)) {
      const n = rawStudents.filter((st) => st.submission === null && st.missions.some((m) => m.missionId === id && !m.passed)).length
      if (n > 0 && (!worst || n > worst.n)) worst = { id, n }
    }
    if (worst) dome.push(`${worst.n > 1 ? 'ส่วนใหญ่' : 'มี 1 คน'}ติดที่ ${worst.id.toUpperCase()} ${MISSION_NAME[worst.id]}`)
    const todo = (pending?.length ?? 0) + showcaseCount
    dome.push(todo > 0 ? `มี ${todo} งานให้ครูดูเมื่อสะดวก` : 'ยังไม่มีงานให้ครูดู')
  }

  return (
    <PageBody>
      <HomeOverview
        students={students}
        pendingCount={pending?.length ?? 0}
        classroomId={data.selectedId}
        roomCode={data.selectedRoomCode ?? null}
        joinPath={joinPath}
        qrSvg={qrSvg}
        help={help}
        showcaseCount={showcaseCount}
        dome={dome}
      />
    </PageBody>
  )
}

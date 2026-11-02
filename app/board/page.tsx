import type { Metadata } from 'next'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import QRCode from 'qrcode'
import { BoardScreenClient } from '@/components/board-screen-client'
import { TeacherLoginClient } from '@/components/teacher-login-client'
import { AppShell } from '@/components/app-shell'
import { listClassroomsByTeacher } from '@/lib/db/repo'
import { readTeacherSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'จอหน้าห้อง — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const BG_PATHS = {
  join: '/ui/teacher/join-poster-bg.webp',
  showcase: '/ui/teacher/showcase-bg.webp',
} as const

/**
 * จอหน้าห้อง — เปิดเป็นแท็บแยกหรือจอที่สอง ใช้ได้โดยไม่ต้องมีการควบคุมคาบสด
 * ?mode=join (ค่าเริ่มต้น) ชวนเข้าห้อง · ?mode=showcase ผลงานเด่น
 *
 * ⚠️ ห้ามมีชื่อคนคู่กับคะแนน ดาว หรือสถานะรายคนบนหน้านี้
 * ⚠️ ต้องเป็นครูที่ล็อกอินและเป็นเจ้าของห้องเท่านั้น
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await readTeacherSession()
  if (!session) return <TeacherLoginClient />

  const classrooms = await listClassroomsByTeacher(session.teacherId)
  const sp = await searchParams
  const requested = one(sp.classroomId)
  const classroom =
    classrooms.find((c) => c.id === requested) ??
    classrooms.find((c) => c.status === 'open') ??
    classrooms[0] ??
    null

  if (!classroom) {
    return (
      <AppShell width="full" mainClassName="grid place-items-center">
        <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
          <h1 className="text-title font-extrabold text-ink">ยังไม่มีห้องเรียน</h1>
          <p className="text-body-lg text-ink-muted">สร้างห้องที่หน้าครูก่อน แล้วค่อยกลับมาเปิดจอนี้</p>
        </div>
      </AppShell>
    )
  }

  const joinUrl = `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/join?code=${classroom.room_code}`
  const qrSvg = await QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 720 })
  const mode = one(sp.mode) === 'showcase' ? 'showcase' : 'join'
  const requestedBg = BG_PATHS[mode]
  const hasBg = existsSync(join(process.cwd(), 'public', requestedBg))

  return (
    <BoardScreenClient
      classroomId={classroom.id}
      roomCode={classroom.room_code}
      joinUrl={joinUrl}
      qrSvg={qrSvg}
      bgUrl={hasBg ? requestedBg : null}
      mode={mode}
      backHref={`/teacher?classroomId=${classroom.id}`}
    />
  )
}

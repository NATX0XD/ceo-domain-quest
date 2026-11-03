import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  logEvent,
  teacherSetMissionPass,
  type MissionTarget,
} from '@/lib/db/repo'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../../../_lib/session-cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  missionId: z.enum(['m1', 'm2', 'm3', 'm4', 'ceo']),
  action: z.enum(['pass', 'undo']),
})

/** ceo เป็นชื่อ API/UI; mission_progress ใช้ boss เป็น canonical id */
function dbMissionId(missionId: z.infer<typeof BodySchema>['missionId']): MissionTarget {
  return missionId === 'ceo' ? 'boss' : missionId
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const { id: studentId } = await context.params
  if (!z.string().uuid().safeParse(studentId).success) {
    return errorResponse('bad-request', 'รหัสนักเรียนไม่ถูกต้อง')
  }

  const parsed = BodySchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง missionId เป็น m1 | m2 | m3 | m4 | ceo และ action เป็น pass | undo')
  }

  const { missionId, action } = parsed.data
  const result = await teacherSetMissionPass(session.teacherId, studentId, dbMissionId(missionId), action)
  if (!result) return errorResponse('not-found', 'ไม่พบนักเรียนคนนี้ในห้องของคุณ', 404)

  await logEvent(studentId, action === 'pass' ? 'teacher-mission-pass' : 'teacher-mission-pass-undo', {
    teacherId: session.teacherId,
    missionId,
    source: 'teacher-skip',
    status: result.status,
  })

  return NextResponse.json({
    ok: true,
    missionId,
    action,
    source: 'teacher-skip',
    status: result.status,
    changed: result.changed,
    progress: result.progress,
  })
}

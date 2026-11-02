import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getOwnedClassroom, logEvent } from '@/lib/db/repo'
import { getServiceClient } from '@/lib/db/client'
import {
  MISSION_SETTING_IDS,
  clampMissionSettings,
  snapshotMissionSettings,
  type MissionSettingId,
} from '@/lib/mission-settings'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PutSchema = z.object({
  classroomId: z.string().uuid().optional(),
  missionId: z.enum(MISSION_SETTING_IDS),
  settings: z.record(z.string(), z.unknown()),
})

function classroomIdOf(request: Request, body?: { classroomId?: string }): string | null {
  return body?.classroomId ?? new URL(request.url).searchParams.get('classroomId')
}
export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()
  const classroomId = classroomIdOf(request)
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')
  if (!(await getOwnedClassroom(session.teacherId, classroomId))) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
  return NextResponse.json({ ok: true, classroomId, missions: await snapshotMissionSettings(classroomId) })
}

export async function PUT(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()
  const parsed = PutSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง missionId และ settings ที่ถูกต้อง')
  const classroomId = classroomIdOf(request, parsed.data)
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')
  if (!(await getOwnedClassroom(session.teacherId, classroomId))) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const missionId = parsed.data.missionId as MissionSettingId
  const settings = clampMissionSettings(missionId, parsed.data.settings)
  const { data, error } = await getServiceClient()
    .from('classroom_mission_settings')
    .upsert({ classroom_id: classroomId, mission_id: missionId, settings, updated_by: session.teacherId, updated_at: new Date().toISOString() }, { onConflict: 'classroom_id,mission_id' })
    .select('classroom_id, mission_id, settings, updated_by, updated_at')
    .single()
  if (error) return errorResponse('save-failed', 'บันทึกค่าด่านไม่สำเร็จ', 500)

  // Keep the existing student event ledger as the audit trail. Empty classrooms have no event target yet.
  const firstStudent = await getServiceClient().from('students').select('id').eq('classroom_id', classroomId).limit(1).maybeSingle()
  if (firstStudent.data?.id) {
    await logEvent(firstStudent.data.id, 'teacher-mission-settings-updated', { teacherId: session.teacherId, missionId, settings })
  }
  return NextResponse.json({ ok: true, setting: data })
}

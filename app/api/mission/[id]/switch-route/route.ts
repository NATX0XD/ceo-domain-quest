import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { LearningRoute, MissionId } from '@/lib/db/repo'
import { getProfile, switchLearningRoute } from '@/lib/db/repo'
import { findMission } from '@/components/missions'
import { countRouteSwitches } from '@/components/server/game-state'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../../_lib/session-cookie'

/**
 * บันทึกการสลับช่องทางกลางคัน (from_route → to_route) ลงตาราง route_changes
 *
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ⚠️ ห้ามปฏิเสธการสลับไม่ว่ากรณีใด สลับกี่ครั้งก็ได้ ไม่หักดาว — เป็นข้อตกลงของสื่อนี้
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({ toRoute: z.enum(['clip', 'card', 'game', 'buddy']) })

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const mission = findMission(id)
  if (!mission) return errorResponse('mission-not-found', 'ไม่พบภารกิจนี้', 404, { missionId: id })

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง toRoute เป็น clip | card | game | buddy', 400)
  }

  const before = await getProfile(session.studentId)
  const fromRoute = (before?.learning_route as LearningRoute | null) ?? null

  // กดช่องทางเดิมซ้ำ ไม่ใช่การเปลี่ยนเส้นทาง ไม่ต้องเขียนแถวใหม่ (QA-1 พัง-6)
  if (fromRoute === parsed.data.toRoute) {
    return NextResponse.json({
      accepted: true,
      missionId: mission.id,
      fromRoute,
      toRoute: parsed.data.toRoute,
      unchanged: true,
      switchCount: await countRouteSwitches(session.studentId, mission.id),
    })
  }

  const change = await switchLearningRoute(session.studentId, parsed.data.toRoute, {
    missionId: mission.id as MissionId,
    chosenBy: 'student',
  })

  return NextResponse.json({
    accepted: true,
    missionId: mission.id,
    fromRoute: change.from_route ?? fromRoute,
    toRoute: change.to_route,
    switchCount: await countRouteSwitches(session.studentId, mission.id),
  })
}

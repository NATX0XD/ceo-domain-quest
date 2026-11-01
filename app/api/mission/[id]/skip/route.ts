import { NextResponse } from 'next/server'
import { type MissionId, logEvent } from '@/lib/db/repo'
import { findMission, missions } from '@/components/missions'
import { applyMissionSkip, decideMissionSkip } from '@/components/server/mission-skip'
import { hasShopProfile } from '@/components/server/shop-gate'
import { errorResponse, readStudentSession, unauthorized } from '../../../_lib/session-cookie'

/**
 * ผู้เรียนกด "ข้ามภารกิจนี้"
 *
 * ⚠️ **เซิร์ฟเวอร์เป็นคนตัดสินเองเสมอ ห้ามเชื่อค่าที่หน้าจอส่งมา**
 *    route นี้จึงไม่อ่าน body เลยแม้แต่ฟิลด์เดียว ต่อให้ยิง {"allowed":true,"by":"teacher"} มาก็ไม่มีผล
 *    หลักฐานทั้งหมด (ตอบถูกไหม · มั่นใจแค่ไหน · ครูเปิดให้ข้ามไว้ไหม) อ่านจาก DB ของคนที่ถือคุกกี้
 *
 * 3 ผลที่ต่างกันคนละเรื่อง (ดูเหตุผลเต็มที่ core/personalize.ts evaluateSkip):
 * - ข้ามเองโดยเข้าเงื่อนไข = 3 ดาว เท่าทำผ่านเอง เพราะพิสูจน์แล้วตอนเช็กความเข้าใจ
 * - ครูสั่งให้ข้าม (T-06) = 0 ดาว แต่ยังนับว่าผ่านจุดประสงค์
 * - ยังไม่เข้าเงื่อนไข = **ปฏิเสธ 403** ไม่ใช่ปล่อยให้ข้ามแล้วให้ 0 ดาว ไม่งั้นตัวเลขผ่านจุดประสงค์ทั้งห้องเชื่อไม่ได้
 *
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')
  if (!(await hasShopProfile(session.studentId))) return errorResponse('no-profile', 'ยังไม่ได้ตั้งค่าร้าน กลับไปที่หน้า /setup ก่อน', 409, { href: '/setup' })

  const mission = findMission(id)
  if (!mission) return errorResponse('mission-not-found', 'ไม่พบภารกิจนี้', 404, { missionId: id })

  const missionId = mission.id as MissionId
  const verdict = await decideMissionSkip(session.studentId, missionId)

  if (!verdict.decision.allowed) {
    await logEvent(session.studentId, 'mission-skip-rejected', {
      missionId,
      objectiveId: verdict.objectiveId,
      outcome: verdict.decision.outcome,
    })
    // ไม่บันทึกอะไรเลย ผู้เรียนกลับไปทำภารกิจตามปกติ ข้อความไม่ตำหนิ
    return errorResponse('skip-not-allowed', verdict.decision.reason, 403, {
      missionId,
      outcome: verdict.decision.outcome,
      stars: 0,
      passed: false,
    })
  }

  const applied = await applyMissionSkip(session.studentId, missionId, verdict)

  await logEvent(session.studentId, 'mission-skipped', {
    missionId,
    objectiveId: verdict.objectiveId,
    by: verdict.by,
    outcome: verdict.decision.outcome,
    stars: applied.stars,
  })

  const index = missions.findIndex((m) => m.id === mission.id)
  const next = index >= 0 ? missions[index + 1] : undefined

  return NextResponse.json({
    ok: true,
    skipped: mission.id,
    by: verdict.by,
    outcome: verdict.decision.outcome,
    stars: applied.stars,
    passed: applied.passed,
    reason: verdict.decision.reason,
    nextHref: next ? `/mission/${next.id}` : '/ceo',
  })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ROUTE_IDS } from '@/core/personalize'
import { findGoal, selfProfile } from '@/components/server/lesson-content'
import {
  chooseGoalDb,
  chooseLevelDb,
  chooseRouteDb,
  loadSelfProfileDb,
  saveOwnGoalTextDb,
} from '@/components/server/game-state'
import { moderateStudentText } from '@/components/server/moderation'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../_lib/session-cookie'

/**
 * บันทึกสิ่งที่ผู้เรียน "เลือกเอง" — หัวใจของ Personalized Learning
 *
 * ⚠️ ห้ามมีเงื่อนไขไหนปฏิเสธช่องทางหรือระดับที่ผู้เรียนเลือก เลือกได้ครบทั้ง 4 ช่องทางและ 3 ระดับเสมอ
 *    ระบบแค่บันทึกว่า chosenBy = 'student' ไว้เป็นหลักฐาน
 * ⚠️ ข้อยกเว้นเดียวคือเป้าหมายที่ลดลงไม่ได้ (goalPolicy.canLowerDuringLesson = false)
 * ⚠️ `ownGoalText` = เป้าหมายที่ผู้เรียน **พิมพ์เอง** ไม่ใช่เลือกจากรายการ
 *    ต้องผ่านด่านกรองคำทุกครั้งก่อนบันทึก และ **ห้ามลบหรือแก้ข้อความเด็กเงียบ ๆ**
 *    ไม่ผ่าน = ไม่บันทึก + คืนข้อความเดิมกลับไปให้เจ้าตัวเห็น พร้อมบอกว่าทำไม
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  route: z.enum(['clip', 'card', 'game', 'buddy']).optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  goalId: z.string().min(1).optional(),
  /** เป้าหมายที่พิมพ์เอง — ส่งสตริงว่างมา = ลบเป้าที่เคยพิมพ์ไว้ (เจ้าตัวเป็นคนสั่งเอง) */
  ownGoalText: z.string().max(300).optional(),
  finish: z.boolean().optional(),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse(
      'bad-request',
      `route ต้องเป็นหนึ่งใน ${ROUTE_IDS.join(' ')} · level ต้องเป็น 1-3 · goalId ต้องเป็นรหัสเป้าหมาย`,
      400,
    )
  }

  const before = await loadSelfProfileDb(session.studentId)
  const { route, level, goalId, ownGoalText } = parsed.data

  /**
   * ด่านกรองคำมาก่อนการบันทึกทุกอย่าง — ไม่ผ่านแล้วต้องไม่มีอะไรถูกเขียนลง DB เลย
   * คืน `original` กลับไปเสมอ เพื่อให้หน้าจอเติมข้อความเดิมกลับเข้าช่องได้ ไม่ให้พิมพ์ใหม่ทั้งหมด
   */
  if (typeof ownGoalText === 'string' && ownGoalText.trim().length > 0) {
    const verdict = await moderateStudentText(session.studentId, 'self-goal', ownGoalText)
    if (!verdict.ok) {
      return errorResponse(
        'content-flagged',
        verdict.message ?? 'ข้อความนี้ยังใช้ไม่ได้ ลองเขียนใหม่อีกครั้งนะ',
        422,
        {
          field: 'ownGoalText',
          original: verdict.original,
          famousBrands: verdict.famousBrands,
          hasPersonalInfo: verdict.hasPersonalInfo,
        },
      )
    }
  }

  if (route) {
    const chosenBy = route === before.suggestedRoute ? 'system' : 'student'
    await chooseRouteDb(session.studentId, route, chosenBy)
  }

  if (level) {
    const chosenBy = level === before.suggestedLevel ? 'system' : 'student'
    await chooseLevelDb(session.studentId, level, chosenBy)
  }

  if (typeof ownGoalText === 'string') {
    await saveOwnGoalTextDb(session.studentId, ownGoalText)
  }

  let goalNote: string | null = null
  if (goalId) {
    const goal = findGoal(goalId)
    if (!goal) return errorResponse('goal-not-found', 'ไม่มีเป้าหมายรหัสนี้', 404)
    const goalLevel = goal.order === 1 || goal.order === 2 || goal.order === 3 ? goal.order : 2
    const result = await chooseGoalDb(session.studentId, goal.id, goalLevel)
    if (!result.ok) goalNote = `${result.message} ${selfProfile.goalPolicy.lockedNote}`
  }

  const after = await loadSelfProfileDb(session.studentId)
  return NextResponse.json({
    accepted: true,
    route: after.route,
    routeChosenBy: after.routeChosenBy,
    level: after.scaffoldLevel,
    goalId: after.goalId,
    goalStars: after.goalStars,
    ownGoalText: after.ownGoalText,
    goalRejectedNote: goalNote,
  })
}

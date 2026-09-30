import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  describeAnswer,
  normalizeRequestedValue,
  PLAN_REQUEST_STATUSES,
  type PlanRequestKind,
  type PlanRequestStatus,
} from '@/core/plan-request'
import { respondPlanRequest } from '@/lib/db/repo'
import {
  errorResponse,
  readJsonBody,
  readTeacherSession,
  unauthorized,
} from '../../_lib/session-cookie'

/**
 * ครูตอบคำขอเปลี่ยนแผน — ให้ · ไม่ให้ · ให้แบบอื่นแทน
 *
 * ⚠️ teacherId มาจากคุกกี้ dbq_teacher เท่านั้น · `respond_plan_request` ตรวจความเป็นเจ้าของห้อง
 *    **ในคำสั่งเดียวกับที่เขียน** ไม่ใช่เจ้าของ = 0 แถว · ตอบไปแล้วตอบซ้ำไม่ได้ (กันครู 2 คนกดพร้อมกัน)
 * ⚠️ ไม่ส่ง grantedValue = ถือว่าให้ตามที่ขอ (SQL ใช้ coalesce กับ requested_value)
 *    'changed' โดยไม่บอกว่าให้อะไรแทนจึงไม่มีความหมาย — บล็อกไว้ที่นี่
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(PLAN_REQUEST_STATUSES),
  /** ข้อความที่ครูตอบกลับเด็ก */
  response: z.string().max(300).nullish(),
  /** สิ่งที่ครูให้จริง ต่างจากที่ขอได้ */
  grantedValue: z.union([z.string(), z.number()]).nullish(),
  /** ชนิดของคำขอ ส่งมาเพื่อให้ตรวจ grantedValue ได้ว่าอยู่ในค่าที่ระบบรองรับ */
  kind: z.enum(['level', 'channel', 'skip', 'time']).optional(),
})

export async function POST(request: Request) {
  const teacher = await readTeacherSession()
  if (!teacher) return unauthorized('ต้องเข้าสู่ระบบครูก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse(
      'bad-request',
      `ต้องส่ง requestId กับ status (${PLAN_REQUEST_STATUSES.join(' / ')})`,
      400,
    )
  }

  const status = parsed.data.status as PlanRequestStatus
  const kind = parsed.data.kind as PlanRequestKind | undefined
  const rawGranted = parsed.data.grantedValue

  if (status === 'changed' && (rawGranted === null || rawGranted === undefined || rawGranted === '')) {
    return errorResponse(
      'granted-value-required',
      'เลือก “ให้แบบอื่นแทน” ต้องบอกด้วยว่าให้อะไรแทน เด็กจะได้รู้ว่าต้องทำอะไรต่อ',
      400,
    )
  }

  // ตรวจค่าที่ครูให้ด้วยกติกาเดียวกับค่าที่เด็กขอ จะได้ไม่มีค่าประหลาดหลุดเข้าตาราง
  let grantedValue: string | null = null
  if (rawGranted !== null && rawGranted !== undefined && rawGranted !== '') {
    if (kind) {
      const normalized = normalizeRequestedValue(kind, rawGranted)
      if (!normalized.ok) return errorResponse('bad-value', normalized.message, 400)
      grantedValue = normalized.value
    } else {
      grantedValue = String(rawGranted).trim()
    }
  }

  const answered = await respondPlanRequest(teacher.teacherId, parsed.data.requestId, {
    status,
    response: parsed.data.response ?? null,
    grantedValue,
  })

  if (!answered) {
    return errorResponse(
      'request-not-open',
      'คำขอนี้ตอบไปแล้ว หรือไม่ได้อยู่ในห้องของครูคนนี้',
      409,
    )
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: answered.id,
      studentId: answered.student_id,
      kind: answered.kind,
      missionId: answered.mission_id,
      requestedValue: answered.requested_value,
      status: answered.status,
      grantedValue: answered.granted_value,
      teacherResponse: answered.teacher_response,
      respondedAt: answered.responded_at,
    },
    /** ประโยคที่เด็กจะเห็นบนจอ — ครูเห็นประโยคเดียวกันตอนกด จะได้ไม่เข้าใจคนละอย่าง */
    answer: describeAnswer({
      kind: (kind ?? answered.kind) as PlanRequestKind,
      status,
      requestedValue: answered.requested_value,
      grantedValue: answered.granted_value,
      teacherResponse: answered.teacher_response,
    }),
  })
}

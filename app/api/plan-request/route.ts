import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  describeAnswer,
  describeRequest,
  isPending,
  normalizeRequestedValue,
  PLAN_REQUEST_KINDS,
  type PlanRequestKind,
  type PlanRequestStatus,
} from '@/core/plan-request'
import { createPlanRequest, listClassroomPlanRequests, logEvent, MISSION_TARGETS } from '@/lib/db/repo'
import { listOwnPlanRequests, reviewReason } from './_lib/reason'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  readTeacherSession,
  unauthorized,
} from '../_lib/session-cookie'

/**
 * S-08 ผู้เรียนขอเปลี่ยนแผนเอง — หลักฐานว่า "ระบบเสนอ ผู้เรียนเลือก" ไม่ใช่ระบบบังคับ
 *
 * ⚠️ studentId / teacherId มาจากคุกกี้เท่านั้น ห้ามเชื่อ id จาก body
 * ⚠️ เหตุผลที่เด็กพิมพ์เอง **ต้องผ่าน `reviewStudentText()` ทุกครั้ง** ไม่มีทางลัด
 * ⚠️ เก็บทั้งสิ่งที่ขอ (requested_value) และสิ่งที่ได้จริง (granted_value) — ห้ามเขียนทับกัน
 *    เพราะครูตอบว่า "ให้แบบอื่นแทน" ได้ ถ้าเหลือค่าเดียวจะตอบไม่ได้ว่าเด็กขออะไรไว้
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  kind: z.enum(PLAN_REQUEST_KINDS),
  /** ค่าที่ขอ — ความหมายขึ้นกับ kind (ระดับ 1-3 · ช่องทาง · จำนวนนาที) */
  requestedValue: z.union([z.string(), z.number()]).nullish(),
  missionId: z.enum(MISSION_TARGETS).nullish(),
  reason: z.string().min(1).max(500),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = CreateSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse(
      'bad-request',
      `ต้องส่ง kind (${PLAN_REQUEST_KINDS.join(' / ')}) กับ reason ความยาว 1-500 ตัวอักษร`,
      400,
    )
  }

  const kind = parsed.data.kind as PlanRequestKind
  const normalized = normalizeRequestedValue(kind, parsed.data.requestedValue)
  if (!normalized.ok) return errorResponse('bad-value', normalized.message, 400)

  // ด่านกรองคำก่อนเขียนลงตาราง — ข้อความเดิมของเด็กถูกส่งกลับไปให้เห็นเสมอ ไม่กลืนหาย
  const verdict = await reviewReason(session.studentId, parsed.data.reason)
  if (!verdict.ok) {
    return errorResponse('reason-blocked', verdict.message ?? 'เขียนเหตุผลใหม่อีกครั้งนะ', 400, {
      original: verdict.original,
      level: verdict.level,
    })
  }

  /**
   * ใบซ้ำ = เรื่องเดียวกันของภารกิจเดียวกันยังค้างอยู่
   *
   * ฝั่ง SQL กันด้วย unique index (`plan_requests_one_pending_idx`) ซึ่งเด้งเป็น 23505
   * **ไม่ใช่ข้อผิดพลาดของเด็ก** — กดรัวหรือกดจากสองแท็บก็มาทางนี้ได้ จึงต้องตอบเป็น 409
   * พร้อมข้อความที่บอกทางออก ไม่ใช่ปล่อยเป็น 500 ให้จอขึ้นว่าระบบพัง
   */
  const created = await createPlanRequest(session.studentId, {
    kind,
    reason: parsed.data.reason,
    requestedValue: normalized.value,
    missionId: parsed.data.missionId ?? null,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('23505') || message.includes('plan_requests_one_pending_idx')) return null
    throw error
  })

  if (!created) {
    return errorResponse(
      'duplicate-request',
      'เรื่องนี้ขอไว้แล้วและยังรอครูตอบอยู่ รออีกครู่นะ ระหว่างรอทำข้อต่อไปได้เลย',
      409,
    )
  }

  await logEvent(session.studentId, 'plan-request-created', {
    kind,
    requestedValue: normalized.value,
    missionId: parsed.data.missionId ?? null,
  }).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    request: {
      id: created.id,
      kind: created.kind,
      missionId: created.mission_id,
      requestedValue: created.requested_value,
      reason: created.reason,
      status: created.status,
      createdAt: created.created_at,
      summary: describeRequest({
        kind,
        requestedValue: created.requested_value,
        missionId: created.mission_id,
      }),
    },
    message: 'ส่งคำขอถึงครูแล้ว ครูเห็นบนแผงของครูทันที ระหว่างรอทำข้อต่อไปได้เลย',
  })
}

/**
 * อ่านคำขอ — ครูเห็นของทั้งห้อง (ต้องส่ง classroomId) · ผู้เรียนเห็นของตัวเองเท่านั้น
 * ตัดสินจากคุกกี้ที่มี ไม่ใช่จากพารามิเตอร์ ครูจึงดูของห้องที่ไม่ใช่ของตัวเองไม่ได้ (RPC คืน 0 แถว)
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const teacher = await readTeacherSession()

  if (teacher) {
    const classroomId = url.searchParams.get('classroomId')
    // ตรวจรูปแบบก่อนยิงลงฐานข้อมูล ไม่งั้นค่าเพี้ยนจะกลายเป็น 500 แทนที่จะเป็น "ส่งมาผิด"
    if (!classroomId || !z.string().uuid().safeParse(classroomId).success) {
      return errorResponse('bad-request', 'ต้องส่ง classroomId เป็นรหัสห้องแบบยาว (uuid)', 400)
    }

    const includeAnswered = url.searchParams.get('all') === '1'
    const rows = await listClassroomPlanRequests(teacher.teacherId, classroomId, {
      includeAnswered,
    })
    // ไม่ใช่ห้องของครูคนนี้ = 404 เท่ากับ endpoint ครูตัวอื่นทั้งหมด (เดิมคืน 200 พร้อมรายการว่าง)
    if (rows === null) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

    return NextResponse.json({
      ok: true,
      role: 'teacher',
      pendingCount: rows.filter((row) => isPending(row.status)).length,
      requests: rows.map((row) => ({
        id: row.id,
        studentId: row.student_id,
        nickname: row.nickname,
        kind: row.kind,
        missionId: row.mission_id,
        requestedValue: row.requested_value,
        reason: row.reason,
        status: row.status,
        grantedValue: row.granted_value,
        teacherResponse: row.teacher_response,
        respondedAt: row.responded_at,
        createdAt: row.created_at,
        summary: describeRequest({
          kind: row.kind as PlanRequestKind,
          requestedValue: row.requested_value,
          missionId: row.mission_id,
        }),
      })),
    })
  }

  const session = await readStudentSession()
  if (!session) return unauthorized('ต้องเข้าสู่ระบบก่อน')

  const rows = await listOwnPlanRequests(session.studentId)

  return NextResponse.json({
    ok: true,
    role: 'student',
    requests: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      missionId: row.mission_id,
      requestedValue: row.requested_value,
      reason: row.reason,
      status: row.status,
      grantedValue: row.granted_value,
      respondedAt: row.responded_at,
      createdAt: row.created_at,
      summary: describeRequest({
        kind: row.kind as PlanRequestKind,
        requestedValue: row.requested_value,
        missionId: row.mission_id,
      }),
      /** คำตอบของครูเป็นภาษาคน null = ยังรอครูตอบอยู่ */
      answer: isPending(row.status)
        ? null
        : describeAnswer({
            kind: row.kind as PlanRequestKind,
            status: row.status as PlanRequestStatus,
            requestedValue: row.requested_value,
            grantedValue: row.granted_value,
            teacherResponse: row.teacher_response,
          }),
    })),
  })
}

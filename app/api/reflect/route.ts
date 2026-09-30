import { NextResponse } from 'next/server'
import { z } from 'zod'
import { reflection } from '@/components/server/lesson-content'
import { lessonSummary } from '@/components/server/lesson-progress'
import { certificateEligibility } from '@/components/server/certificate-eligibility'
import { loadReflectionDb, saveReflectionDb } from '@/components/server/game-state'
import { moderateFields } from '@/components/server/moderation'
import {
  CERTIFICATE_STATUS_LABEL,
  OPTIONAL_REFLECTION_IDS,
  REQUIRED_REFLECTION_COUNT,
  REQUIRED_REFLECTION_IDS,
  reflectionSubmitCheck,
  reflectionSubmitPolicy,
} from '@/core/reflection'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../_lib/session-cookie'

/**
 * ขั้นที่ 6 ทบทวนตัวเอง — บันทึกคำตอบสะท้อนลงตาราง reflections (ตอบซ้ำ = ทับของเดิม)
 *
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ⚠️ ความยาวขั้นต่ำและ **จำนวนข้อที่บังคับ** มาจาก content/reflection.json ผ่าน core/reflection.ts
 *    ห้ามฝังตัวเลขไว้ในไฟล์นี้ แผนการสอนให้ตอบ 2 ข้อในคาบ ข้อที่เหลือเป็นของแถมทำต่อที่บ้านได้
 *    (เดิมบังคับครบทุกข้อ ทำให้คนที่ทำตามแผนกดส่งไม่ผ่าน แล้วการ์ดปิดคาบไม่ขึ้นเลย — QA-3 ข้อ 1.2)
 * ⚠️ ข้อความที่ผู้เรียนพิมพ์ต้องผ่านตัวกรอง E-11 ก่อนบันทึกทุกครั้ง ทั้งตอนบันทึกร่างและตอนกดส่ง
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  answers: z.record(z.string().min(1), z.string().max(2000)),
  submit: z.boolean().optional(),
})

/** กติกาการส่งที่หน้าจอต้องรู้ เพื่อบอกผู้เรียนว่าข้อไหนบังคับ ข้อไหนของแถม */
function policyPayload() {
  return {
    requiredIds: REQUIRED_REFLECTION_IDS,
    optionalIds: OPTIONAL_REFLECTION_IDS,
    requiredCount: REQUIRED_REFLECTION_COUNT,
    totalCount: reflection.questions.length,
    optionalChipLabel: reflectionSubmitPolicy.optionalChipLabel,
    optionalHint: reflectionSubmitPolicy.optionalHint,
  }
}

/**
 * สถานะใบประกาศของคนนี้ ส่งไปให้หน้าจอตัดสินใจว่าจะโชว์ปุ่มโหลดใบประกาศไหม
 * คนที่ยังไม่ครบต้องได้ปุ่มทางไปต่อแทน ห้ามเป็นทางตัน และข้อความห้ามมีคำว่าตกหรือไม่ผ่าน
 * (ข้อความทั้งหมดมาจาก certificate-eligibility.ts ที่เดียว ไม่ได้เขียนซ้ำที่นี่)
 */
async function certificatePayload(studentId: string) {
  const standing = await certificateEligibility(studentId)
  return {
    eligible: standing.eligible,
    status: standing.status,
    message: standing.message,
    passedCount: standing.passedCount,
    totalCount: standing.totalCount,
    nextHref: standing.nextHref,
    nextLabel: standing.nextLabel,
    statusLabel: CERTIFICATE_STATUS_LABEL,
  }
}

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const answers = await loadReflectionDb(session.studentId)
  const check = reflectionSubmitCheck(answers)
  const [summary, certificate] = await Promise.all([
    lessonSummary(session.studentId),
    certificatePayload(session.studentId),
  ])

  return NextResponse.json({
    answers,
    policy: policyPayload(),
    /**
     * ตอบครบตามที่คาบกำหนดแล้วหรือยัง — หน้าจอใช้ค่านี้ตัดสินใจว่าจะโชว์การ์ดปิดคาบเลยไหม
     * ต้องส่งมาจากเซิร์ฟเวอร์ เพราะ app/reflect/page.tsx คิดจาก "ครบทุกข้อ" ซึ่งเข้มกว่ากติกาจริง
     */
    submitted: check.ok,
    missing: check.missing,
    message: check.message,
    earnedStars: summary.totalStars,
    goalStars: summary.goalStars,
    outcome: summary.outcome,
    certificate,
  })
}

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง answers เป็นคู่ของรหัสคำถามกับคำตอบ', 400)
  }

  const answers: Record<string, string> = {}
  for (const question of reflection.questions) {
    const value = parsed.data.answers[question.id]
    if (typeof value === 'string') answers[question.id] = value.slice(0, question.maxLength)
  }

  /**
   * คำตอบสะท้อนคิดเป็นข้อความที่นักเรียนพิมพ์เอง ต้องผ่านตัวกรอง E-11 ก่อนบันทึก
   * ไม่ผ่าน = คืนข้อความเดิมพร้อมเหตุผล ไม่บันทึกและไม่ลบทิ้งเงียบ ๆ
   */
  const checked = await moderateFields(
    session.studentId,
    'reflection',
    Object.entries(answers).map(([id, text]) => ({ id, text })),
  )
  if (!checked.ok && checked.verdict) {
    return errorResponse('content-flagged', checked.verdict.message ?? 'ลองเขียนใหม่นะ', 422, {
      field: checked.failedFieldId,
      original: checked.verdict.original,
    })
  }

  await saveReflectionDb(session.studentId, answers)

  if (parsed.data.submit) {
    const check = reflectionSubmitCheck(await loadReflectionDb(session.studentId))
    if (!check.ok) {
      /**
       * บอกให้ชัดว่าขาดข้อไหนและขาดกี่ตัวอักษร ไม่ใช่ 422 เปล่า ๆ
       * `tooShort` คงไว้เพื่อไม่ให้ผู้เรียกเดิมพัง ส่วน `missing` มีรายละเอียดครบกว่า
       */
      return errorResponse('too-short', check.message, 422, {
        missing: check.missing,
        tooShort: check.missing.map((m) => ({ id: m.id, minLength: m.minLength })),
        policy: policyPayload(),
      })
    }
  }

  const [summary, certificate] = await Promise.all([
    lessonSummary(session.studentId),
    certificatePayload(session.studentId),
  ])

  return NextResponse.json({
    ok: true,
    submitted: parsed.data.submit === true,
    policy: policyPayload(),
    earnedStars: summary.totalStars,
    goalStars: summary.goalStars,
    outcome: summary.outcome,
    certificate,
  })
}

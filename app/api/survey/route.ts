import { NextResponse } from 'next/server'
import { z } from 'zod'
import surveyJson from '@/content/survey.json'
import {
  SURVEY_SCALE_ITEMS,
  getActiveClassSession,
  getStudent,
  hasSubmittedSurvey,
  logEvent,
  submitSurveyResponse,
  type SurveyScaleItem,
} from '@/lib/db/repo'
import { checkContent } from '@/core/content-filter'
import { moderateFields } from '@/components/server/moderation'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * S-40 แบบสอบถามความพึงพอใจ 10 ข้อ
 *
 * ⚠️ **คำตอบไม่ผูกกับชื่อผู้ตอบ** — ตาราง survey_responses ไม่มีคอลัมน์ student_id เลย
 *    ระบบจำแค่ "ใครตอบแล้ว" ใน survey_completions เพื่อกันตอบซ้ำ (กฎ S-40)
 * ⚠️ ครูเป็นคนเปิด (ค่าเริ่มต้นปิด) ผ่านตั้งค่าคาบ `class_sessions.survey_enabled`
 * ⚠️ ข้อความปลายเปิดเก็บ 2 ฉบับ: ต้นฉบับ และฉบับกรองคำที่ครูเห็น
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCALE_MIN = surveyJson.scale.min
const SCALE_MAX = surveyJson.scale.max

const RequestSchema = z.object({
  scores: z.record(z.string(), z.number().int().min(SCALE_MIN).max(SCALE_MAX)),
  likeText: z.string().max(500).optional(),
  improveText: z.string().max(500).optional(),
})

/** เปิดให้ทำไหม — ครูต้องเปิดสวิตช์ในคาบก่อน */
async function surveyOpen(studentId: string): Promise<boolean> {
  const student = await getStudent(studentId)
  if (!student?.classroom_id) return false
  const classSession = await getActiveClassSession(student.classroom_id)
  return classSession?.survey_enabled === true
}

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const [open, done] = await Promise.all([
    surveyOpen(session.studentId),
    hasSubmittedSurvey(session.studentId),
  ])

  return NextResponse.json({
    open,
    done,
    meta: surveyJson.meta,
    scale: surveyJson.scale,
    // ข้อคำถามไม่ใช่ของลับ ส่งไปให้หน้าจอได้ (ไม่มีคำตอบถูกผิด)
    items: surveyJson.items,
    reason: open
      ? null
      : 'ครูยังไม่ได้เปิดแบบสอบถาม ถ้าอยากตอบให้บอกครูเปิดให้ หรือกลับมาตอบทีหลังก็ได้',
  })
}

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  if (!(await surveyOpen(session.studentId))) {
    return errorResponse('not-open', 'ครูยังไม่ได้เปิดแบบสอบถาม', 403)
  }

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse(
      'bad-request',
      `ต้องส่งคะแนนข้อ 1 ถึง 8 ข้อละ ${SCALE_MIN} ถึง ${SCALE_MAX}`,
      400,
    )
  }

  // ข้อ 1-8 ต้องครบ (กฎ S-40 ข้อ 3) ตรวจที่เซิร์ฟเวอร์ ไม่เชื่อหน้าจอ
  const scores = {} as Record<SurveyScaleItem, number>
  const missing: string[] = []
  for (const key of SURVEY_SCALE_ITEMS) {
    const value = parsed.data.scores[key]
    if (typeof value !== 'number') missing.push(key)
    else scores[key] = value
  }
  if (missing.length > 0) {
    return errorResponse('incomplete', 'ยังตอบไม่ครบทุกข้อ', 422, { missing })
  }

  const like = parsed.data.likeText?.trim() || null
  const improve = parsed.data.improveText?.trim() || null

  /**
   * ช่องปลายเปิดก็เป็นข้อความที่เด็กพิมพ์เอง ต้องผ่านตัวกรอง E-11 เหมือนช่องอื่น
   * ไม่ผ่าน = ไม่บันทึก คืนข้อความเดิมให้แก้เอง (ครูยังได้ธงตามระดับ)
   */
  const moderated = await moderateFields(session.studentId, 'survey-open', [
    { id: 'likeText', text: like ?? '' },
    { id: 'improveText', text: improve ?? '' },
  ])
  if (!moderated.ok && moderated.verdict) {
    return errorResponse('content-flagged', moderated.verdict.message ?? 'ลองเขียนใหม่นะ', 422, {
      field: moderated.failedFieldId,
      original: moderated.verdict.original,
    })
  }

  /**
   * ฉบับที่ครูเห็นผ่านตัวกรองคำก่อน ต้นฉบับยังเก็บไว้ (กฎ S-40)
   * ข้อความปกติผ่านฉลุย — ปิดเฉพาะตอนตัวกรองบอกว่าไม่ผ่านจริง ๆ
   * (ห้ามปิดทั้งประโยคทุกอัน ไม่งั้นครูอ่านความเห็นไม่ได้เลยสักข้อ)
   */
  const safeOf = (text: string | null): string | null => {
    if (text === null) return null
    const checked = checkContent(text)
    if (checked.ok) return text
    return checked.teacherText ?? ''
  }

  const saved = await submitSurveyResponse(session.studentId, scores, {
    likeText: like,
    improveText: improve,
    likeTextSafe: safeOf(like),
    improveTextSafe: safeOf(improve),
  })

  if (!saved) {
    return errorResponse('already-done', 'ตอบแบบสอบถามไปแล้ว ขอบคุณมากครับ', 409)
  }

  // บันทึกแค่ว่า "ตอบแล้ว" ไม่บันทึกคำตอบลง event เพราะคำตอบต้องไม่ผูกกับชื่อ
  await logEvent(session.studentId, 'survey-submitted', {})

  return NextResponse.json({ ok: true })
}

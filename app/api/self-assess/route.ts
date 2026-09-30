import { NextResponse } from 'next/server'
import { z } from 'zod'
import { calibrationFlag } from '@/core/personalize'
import { calibrationSummary, normalizeSelfScores } from '@/core/self-assess'
import { getStudent, getStudentReport, logEvent, saveSelfAssessment } from '@/lib/db/repo'
import { describeNextGoal } from '@/core/next-goal'
import {
  buildView,
  calibrationRecordsOf,
  latestSubmission,
  selfScoresRawOf,
  submissionOf,
} from './_lib/load'
import { latestNextGoal } from './_lib/next-goal-store'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  readTeacherSession,
  unauthorized,
} from '../_lib/session-cookie'

/**
 * S-26 + S-33 วงจรประเมินตนเอง 3 แหล่ง — ฉันให้ตัวเอง / ระบบเสนอ / ครูยืนยัน
 *
 * ⚠️ studentId / teacherId มาจากคุกกี้เท่านั้น ห้ามเชื่อ id จาก body หรือ query
 *    ฝั่งครูตรวจความเป็นเจ้าของด้วย `getStudentReport` ซึ่ง RPC ตรวจห้องให้ในคิวรีเดียวกับที่อ่าน
 * ⚠️ คะแนนที่ผู้เรียนให้ตัวเอง **ไม่ถูกเอาไปรวมกับคะแนนครูและไม่มีผลต่อดาว** ตามกติกาในไฟล์เนื้อหา
 * ⚠️ ข้อความทุกบรรทัดที่ผู้เรียนเห็นมาจาก `core/self-assess.ts` ซึ่งมีเทสต์คุมว่า **ไม่มีคำตัดสิน**
 *    หน้าจอห้ามแต่งประโยคเปรียบเทียบเอง
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SaveSchema = z.object({
  /** ไม่ส่งมาก็ได้ ระบบใช้งานชิ้นล่าสุดของผู้เรียนเอง */
  submissionId: z.string().uuid().optional(),
  scores: z.record(z.string(), z.number()),
})

/** ฝั่งครู: ตารางเทียบ 3 แหล่ง + ธงการรู้ตัวของผู้เรียนคนหนึ่ง */
async function teacherView(teacherId: string, studentId: string) {
  // ไม่ใช่นักเรียนในห้องของครูคนนี้ = คืน null ตั้งแต่ชั้นฐานข้อมูล
  const owned = await getStudentReport(teacherId, studentId)
  if (!owned) return null

  const [student, submission, records, nextGoal] = await Promise.all([
    getStudent(studentId),
    latestSubmission(studentId),
    calibrationRecordsOf(studentId),
    latestNextGoal(studentId).catch(() => null),
  ])

  const view = buildView(submission)

  return NextResponse.json({
    ok: true,
    role: 'teacher',
    studentId,
    nickname: student?.nickname ?? '',
    submissionId: view.submissionId,
    /** ตารางเดียวกับที่ผู้เรียนเห็น ครูจะได้คุยจากของชิ้นเดียวกัน */
    table: view.table,
    /** ธงการรู้ตัว — ของครูเท่านั้น ไม่เคยส่งไปฝั่งผู้เรียน */
    selfAwareness: calibrationSummary(records, calibrationFlag),
    /** S-32 เป้าที่ผู้เรียนตั้งไว้สำหรับคาบหน้า ใช้เตรียมคาบถัดไป ไม่มีผลต่อดาวของคาบนี้ */
    nextGoal,
    nextGoalSummary: describeNextGoal(nextGoal),
  })
}

export async function GET(request: Request) {
  const teacher = await readTeacherSession()
  if (teacher) {
    const studentId = new URL(request.url).searchParams.get('studentId')
    if (!studentId || !z.string().uuid().safeParse(studentId).success) {
      return errorResponse('bad-request', 'ต้องส่ง studentId เป็นรหัสนักเรียนแบบยาว (uuid)', 400)
    }
    const response = await teacherView(teacher.teacherId, studentId)
    return response ?? errorResponse('not-found', 'ไม่พบผู้เรียนคนนี้ในห้องของคุณ', 404)
  }

  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const submission = await latestSubmission(session.studentId)
  return NextResponse.json({ ok: true, role: 'student', ...buildView(submission) })
}

/** ผู้เรียนให้คะแนนตัวเองรายด้าน — ให้ใหม่ทับของเดิมได้ตลอด ไม่ใช่ทำได้ครั้งเดียว */
export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = SaveSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง scores เป็นคะแนนรายด้าน เช่น { "dim-naming": 3 }', 400)
  }

  const normalized = normalizeSelfScores(parsed.data.scores)
  if (!normalized.ok) return errorResponse('bad-scores', normalized.message, 400)

  const latest = await latestSubmission(session.studentId)
  const target =
    parsed.data.submissionId && parsed.data.submissionId !== latest?.id
      ? await submissionOf(session.studentId, parsed.data.submissionId)
      : latest

  if (!target) {
    return errorResponse(
      'no-submission',
      'ยังไม่มีงานให้ประเมิน ส่งใบเสนอชื่อเว็บที่ด่านบอสก่อนแล้วค่อยกลับมาให้คะแนนตัวเอง',
      409,
    )
  }

  const savedAt = new Date().toISOString()
  /**
   * เก็บรูปแบบเดียวกับฝั่งครู (`{ dimensions: {...} }`) เพื่อให้ตัวอ่านตัวเดียวใช้ได้ทั้งสามแหล่ง
   * `source` ติดไว้ให้ชัดว่าใครเป็นคนให้คะแนนก้อนนี้ ตอนตรวจย้อนจะได้ไม่สับสนกับคะแนนครู
   *
   * ⚠️ **รวมกับของเดิม ไม่เขียนทับทั้งก้อน** — คอลัมน์นี้เก็บคำตอบแบบพิมพ์ 3 ข้อของด่านบอสอยู่แล้ว
   *    (`bm-self1..3`) เขียนทับทั้งก้อนเมื่อไร คำตอบที่ผู้เรียนพิมพ์ไว้หายทันที
   */
  const saved = await saveSelfAssessment(session.studentId, target.id, {
    ...selfScoresRawOf(target),
    dimensions: normalized.scores,
    savedAt,
    source: 'student',
  })

  // งานชิ้นนั้นไม่ใช่ของผู้เรียนคนนี้ — repo มี student_id อยู่ในเงื่อนไข UPDATE จึงคืน null
  if (!saved) return errorResponse('not-found', 'ไม่พบงานชิ้นนี้ของเรา', 404)

  await logEvent(session.studentId, 'self-assessed', {
    submissionId: saved.id,
    scores: normalized.scores,
  }).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    role: 'student',
    ...buildView(saved),
    message: 'เก็บคะแนนที่เธอให้ตัวเองไว้แล้ว ครูจะเห็นคู่กับคะแนนที่ครูยืนยัน',
  })
}

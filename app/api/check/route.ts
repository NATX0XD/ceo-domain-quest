import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfile, logEvent } from '@/lib/db/repo'
import {
  DEFAULT_CHECK_SET,
  checkQuestionsForClient,
  gradeCheck,
  suggestLevelFromCheck,
} from '@/components/server/check-questions'
import { checkSetForStudent } from '@/components/server/check-assignment'
import { saveCheckResultDb, saveObjectiveOutcome } from '@/components/server/game-state'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * S-05 เช็กความเข้าใจ 4 ข้อ (ช่วงรู้จักตัวเอง นาทีที่ 15-20)
 *
 * **ไม่ใช่ข้อสอบวิจัย** — ชุดวิจัย 10 ข้อ อยู่ที่ /api/pretest กับ /api/posttest
 * ผลของชุดนี้ใช้ "เสนอ" ระดับตัวช่วย ผู้เรียนยืนยันหรือเปลี่ยนเองได้ที่ /profile
 *
 * ⚠️ ตรวจคำตอบฝั่งเซิร์ฟเวอร์เท่านั้น ไม่คืนเฉลยและไม่บอกว่าข้อไหนผิด
 *    (สเปก S-05: ไม่แสดงเฉลยในหน้าเช็ก ผู้เรียนจะได้ไปเจอเองในภารกิจ)
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  answers: z.record(z.string().min(1), z.number().int().min(0).max(5)),
  /** ความมั่นใจรายข้อ 1-3 (ไม่บังคับ) — ใช้คิดธงให้ครูว่าความมั่นใจตรงกับผลไหม */
  confidence: z.record(z.string().min(1), z.number().int().min(1).max(3)).optional(),
  setId: z.string().min(1).optional(),
})

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const profile = await getProfile(session.studentId)
  const readiness = (profile?.readiness ?? {}) as Record<string, unknown>
  const bag = readiness.check as { score?: number; total?: number } | undefined

  /**
   * S-05 คนละคนได้คนละชุด — สลับ A/B ตามลำดับเข้าห้อง (core/check-set.ts)
   * คนเดิมเข้าใหม่ได้ชุดเดิมเสมอ เพราะลำดับมาจาก students.created_at ที่ไม่เปลี่ยนแล้ว
   */
  const { setId, basis } = await checkSetForStudent(session.studentId, session.classroomId)

  return NextResponse.json({
    setId,
    setBasis: basis,
    questions: checkQuestionsForClient(setId),
    done: typeof bag?.score === 'number',
    score: bag?.score ?? null,
    total: bag?.total ?? null,
  })
}

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง answers เป็นคู่ของรหัสข้อกับลำดับตัวเลือก', 400)
  }

  /**
   * ⚠️ ตรวจด้วยชุดที่เซิร์ฟเวอร์แจกให้คนนี้ **ไม่ใช่ setId ที่หน้าจอส่งมา**
   *    ถ้าเชื่อค่าจากหน้าจอ ผู้เรียนส่งชุดอื่นเข้ามาแล้วได้เฉลยคนละชุดกับโจทย์ที่เห็น
   *    setId ใน body ยังรับไว้เพื่อความเข้ากันได้ แต่ใช้แค่ตอนบันทึกว่าหน้าจอคิดว่าเป็นชุดไหน
   */
  const assignment = await checkSetForStudent(session.studentId, session.classroomId)
  const setId = assignment.setId || DEFAULT_CHECK_SET
  const result = await gradeCheck(parsed.data.answers, setId)

  /**
   * บันทึกผลรายวัตถุประสงค์ + ความมั่นใจ
   * คู่นี้คือวัตถุดิบของธง "ควรคุย" บนแผงครู (มั่นใจมากแต่ตอบยังไม่ถูก)
   */
  for (const row of result.perQuestion) {
    await saveObjectiveOutcome(session.studentId, row.objectiveId, {
      confidence: parsed.data.confidence?.[row.id],
      correct: row.correct,
    })
  }

  // ระบบ "เสนอ" ระดับตัวช่วยจากผลชุดนี้ ผู้เรียนเปลี่ยนเองได้ที่ /profile
  const level = suggestLevelFromCheck(result)
  await saveCheckResultDb(session.studentId, {
    score: result.score,
    total: result.total,
    setId,
    suggestedLevel: level.suggested,
    levelReason: level.reason,
    weakObjectives: result.weakObjectiveIds,
  })

  await logEvent(session.studentId, 'check-done', {
    score: result.score,
    total: result.total,
    setId,
    suggestedLevel: level.suggested,
  })

  // ไม่บอกว่าข้อไหนผิด — คืนแค่ภาพรวมกับระดับที่เสนอ
  return NextResponse.json({
    ok: true,
    /** ชุดที่ใช้ตรวจจริง (ของเซิร์ฟเวอร์) — ไม่ใช่ค่าที่หน้าจอส่งมา */
    setId,
    score: result.score,
    total: result.total,
    suggestedLevel: level.suggested,
    levelReason: level.reason,
    weakObjectives: result.weakObjectiveIds,
  })
}

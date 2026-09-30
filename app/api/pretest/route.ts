import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logEvent, recordQuizItemResponses } from '@/lib/db/repo'
import { getQuizSet, gradeQuiz } from '@/core/quiz'
import { recommendLevel } from '@/core/personalize'
import { loadPretestDb, savePretestDb } from '@/components/server/game-state'
import { pretestGate } from '@/components/server/posttest-gate'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * แบบทดสอบก่อนเรียน 4 ข้อ (ชุด pre ของ content/quiz.json)
 *
 * ⚠️ ตรวจคำตอบที่เซิร์ฟเวอร์เท่านั้นผ่าน core/quiz.ts — เฉลยอยู่ใน content/quiz-answers.json
 *    ห้ามส่งเฉลยหรือรายข้อที่ผิดกลับไปเบราว์เซอร์ (คืนแค่คะแนนรวมกับหัวข้อที่ควรเน้น)
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ผลลัพธ์ส่งเข้า recommendLevel เพื่อ "เสนอ" ระดับตัวช่วย ผู้เรียนยืนยันหรือเปลี่ยนเองได้ที่ /profile
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  answers: z.record(z.string().min(1), z.number().int().min(0).max(3)),
})

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')
  const [result, gate] = await Promise.all([
    loadPretestDb(session.studentId),
    pretestGate(session.studentId),
  ])
  return NextResponse.json({ result, open: gate.open, reason: gate.reason })
}

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง answers เป็นคู่ของรหัสข้อกับลำดับตัวเลือก 0-3', 400)
  }

  /**
   * ครูเป็นคนกดเปิด (T-12) — ใช้สวิตช์ `class_sessions.pretest_enabled`
   * เดา URL แล้วยิง POST ตรงก็ไม่ผ่านด่านนี้
   */
  const gate = await pretestGate(session.studentId)
  if (!gate.open) {
    return errorResponse('not-open', gate.reason ?? 'ยังไม่ถึงเวลาทำแบบทดสอบก่อนเรียน', 403)
  }

  // รับเฉพาะรหัสข้อที่มีอยู่จริงในชุดก่อนเรียน
  const questions = getQuizSet('pre')
  const answers: Record<string, number> = {}
  for (const question of questions) {
    const picked = parsed.data.answers[question.id]
    if (typeof picked === 'number') answers[question.id] = picked
  }

  // ทำได้ครั้งเดียว ไม่งั้นผลก่อนเรียนถูกทับจนเทียบก่อน-หลังไม่ได้ (QA-1 พัง-7)
  const done = await loadPretestDb(session.studentId)
  if (done) {
    return errorResponse(
      'already-done',
      `ทำแบบทดสอบก่อนเรียนไปแล้ว ได้ ${done.score} คะแนน ทำซ้ำไม่ได้`,
      409,
      { score: done.score },
    )
  }

  const result = gradeQuiz(answers, 'pre')
  const level = recommendLevel(result)

  /**
   * เก็บคำตอบรายข้อไว้หาค่าความยาก p กับอำนาจจำแนก r (สเปกข้อ 9.4)
   * `correct` เป็นผลตรวจของ gradeQuiz ที่นี่ ไม่ใช่ค่าที่เบราว์เซอร์ส่งมา
   * ข้อที่ไม่ได้ตอบมีใน correctByItem ด้วย (นับเป็นผิด) จึงได้ฐาน responseCount ครบทุกคน
   */
  await recordQuizItemResponses(
    session.studentId,
    'pre',
    Object.entries(result.correctByItem).map(([itemId, correct]) => ({
      itemId,
      choiceIndex: answers[itemId] ?? null,
      correct,
    })),
  )

  await savePretestDb(session.studentId, {
    score: result.score,
    suggestedLevel: level.suggested,
    weakObjectives: level.weakObjectives,
    levelReason: level.reason,
  })
  await logEvent(session.studentId, 'pretest-done', {
    score: result.score,
    total: result.total,
    suggestedLevel: level.suggested,
  })

  // ไม่คืน wrongIds เพื่อไม่ให้ย้อนรู้ว่าข้อไหนเฉลยอะไร
  return NextResponse.json({
    ok: true,
    score: result.score,
    total: result.total,
    suggestedLevel: level.suggested,
    levelReason: level.reason,
    weakObjectives: level.weakObjectives,
  })
}

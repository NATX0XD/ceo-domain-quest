import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfile, logEvent, recordQuizItemResponses, upsertProfile } from '@/lib/db/repo'
import { getQuizSet, gradeQuiz } from '@/core/quiz'
import { posttestGate } from '@/components/server/posttest-gate'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * แบบทดสอบหลังเรียน 10 ข้อ (ชุด post ของ content/quiz.json)
 *
 * ทำไมต้องมี: ไม่มีคะแนนหลังเรียน = คำนวณ E2 ไม่ได้ = ตอบกรรมการเรื่องประสิทธิภาพสื่อ (E1/E2) ไม่ได้
 *
 * ⚠️ ตรวจคำตอบที่เซิร์ฟเวอร์เท่านั้นผ่าน core/quiz.ts — เฉลยอยู่ใน content/quiz-answers.json
 *    ห้ามส่งเฉลยหรือรายข้อที่ผิดกลับไปเบราว์เซอร์ (คืนแค่คะแนนรวม)
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ⚠️ ครูเป็นคนกดเปิด — ดู components/server/posttest-gate.ts · ทำซ้ำไม่ได้ (409)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  answers: z.record(z.string().min(1), z.number().int().min(0).max(3)),
})

/** โจทย์ที่ส่งให้เบราว์เซอร์ได้ — ไม่มี answerIndex และไม่มี objectiveIds ติดไปด้วย */
function questionsForClient() {
  return getQuizSet('post').map((q) => ({
    id: q.id,
    question: q.question,
    choices: q.choices,
  }))
}

async function doneScore(studentId: string): Promise<number | null> {
  const profile = await getProfile(studentId)
  return profile?.post_test_score ?? null
}

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const [gate, score] = await Promise.all([
    posttestGate(session.studentId),
    doneScore(session.studentId),
  ])

  return NextResponse.json({
    open: gate.open,
    reason: gate.reason,
    done: score !== null,
    score,
    total: getQuizSet('post').length,
    // ส่งโจทย์ให้เฉพาะตอนเปิดจริงและยังไม่เคยทำ
    questions: gate.open && score === null ? questionsForClient() : [],
  })
}

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const gate = await posttestGate(session.studentId)
  if (!gate.open) {
    return errorResponse('not-open', gate.reason ?? 'ยังไม่ถึงเวลาทำแบบทดสอบหลังเรียน', 403, {
      phase: gate.phase,
    })
  }

  const already = await doneScore(session.studentId)
  if (already !== null) {
    // ทำซ้ำไม่ได้ ไม่งั้นคะแนนหลังเรียนถูกทับจนเทียบก่อน-หลังไม่ได้ (เหมือนกติกาของชุดก่อนเรียน)
    return errorResponse(
      'already-done',
      `ทำแบบทดสอบหลังเรียนไปแล้ว ได้ ${already} คะแนน ทำซ้ำไม่ได้`,
      409,
      { score: already },
    )
  }

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง answers เป็นคู่ของรหัสข้อกับลำดับตัวเลือก 0-3', 400)
  }

  // รับเฉพาะรหัสข้อที่มีอยู่จริงในชุดหลังเรียน
  const answers: Record<string, number> = {}
  for (const question of getQuizSet('post')) {
    const picked = parsed.data.answers[question.id]
    if (typeof picked === 'number') answers[question.id] = picked
  }

  const result = gradeQuiz(answers, 'post')
  await upsertProfile(session.studentId, { post_test_score: result.score })

  /**
   * คำตอบรายข้อของชุดหลังเรียน — คู่กับชุดก่อนเรียนที่ /api/pretest
   * ค่าความยากคิดแยกชุด เพราะ pre กับ post เป็นข้อสอบคู่ขนานคนละฉบับ
   */
  await recordQuizItemResponses(
    session.studentId,
    'post',
    Object.entries(result.correctByItem).map(([itemId, correct]) => ({
      itemId,
      choiceIndex: answers[itemId] ?? null,
      correct,
    })),
  )
  await logEvent(session.studentId, 'posttest-done', {
    score: result.score,
    total: result.total,
  })

  const profile = await getProfile(session.studentId)
  const preScore = profile?.pre_test_score ?? null

  // ไม่คืน wrongIds เพื่อไม่ให้ย้อนรู้ว่าข้อไหนเฉลยอะไร
  return NextResponse.json({
    ok: true,
    score: result.score,
    total: result.total,
    preScore,
    /** ก่อน-หลังต่างกันเท่าไร (null = ยังไม่เคยทำชุดก่อนเรียน) */
    gain: preScore === null ? null : result.score - preScore,
  })
}

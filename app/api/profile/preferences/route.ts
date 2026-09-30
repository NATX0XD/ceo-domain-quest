import { NextResponse } from 'next/server'
import { z } from 'zod'
import { quiz } from '@/core/quiz'
import { recommendLevel, recommendRoute } from '@/core/personalize'
import { selfProfile, talentOfChoice } from '@/components/server/lesson-content'
import { loadPretestDb, saveSuggestionDb } from '@/components/server/game-state'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../_lib/session-cookie'

/**
 * ขั้นที่ 2 รู้จักตัวเอง — รับคำตอบความถนัด 5 ข้อ แล้วให้เซิร์ฟเวอร์คิดข้อเสนอ
 *
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ⚠️ core/personalize เป็น server-only (ดึง core/quiz.ts ที่โหลดไฟล์เฉลย) ห้ามเรียกจากเบราว์เซอร์
 * ⚠️ ผลที่คืนเป็น "ข้อเสนอ" ยังไม่ใช่ค่าที่ใช้จริงจนกว่าผู้เรียนจะกดเลือกที่ /api/profile/choice
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  prefAnswers: z.record(z.string().min(1), z.string().min(1)),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง prefAnswers เป็นคู่ของรหัสคำถามกับรหัสตัวเลือก', 400)
  }

  // รับเฉพาะรหัสที่มีอยู่จริงในไฟล์เนื้อหา กันการยัดคีย์แปลกปลอม
  const prefAnswers: Record<string, string> = {}
  for (const question of selfProfile.preferenceQuestions) {
    const picked = parsed.data.prefAnswers[question.id]
    if (picked && question.choices.some((c) => c.id === picked)) prefAnswers[question.id] = picked
  }

  const talentId = Object.values(prefAnswers).map(talentOfChoice).find((t) => t !== null) ?? null
  const route = recommendRoute(prefAnswers, {})

  /**
   * ใช้ผลแบบทดสอบก่อนเรียนถ้าทำมาแล้ว (หน้า /pretest)
   * ยังไม่ได้ทำ = ยังไม่รู้ว่าแน่นเรื่องไหน จึงนับทุกวัตถุประสงค์เป็นจุดที่ต้องช่วยไว้ก่อน
   * ไม่ว่าทางไหน ระดับที่ได้เป็นแค่ "ข้อเสนอ" ผู้เรียนกดเปลี่ยนเองได้ในหน้าเดียวกัน
   */
  const preQuestionIds: string[] = quiz.pre.map((q) => q.id)
  const pretest = await loadPretestDb(session.studentId)
  const level = pretest
    ? recommendLevel({
        score: pretest.score,
        total: preQuestionIds.length,
        // เก็บเฉพาะวัตถุประสงค์ที่อ่อนไว้ แปลงกลับเป็นรหัสข้อไม่ได้ จึงใช้คะแนนเป็นตัวตั้ง
        wrongIds: [],
      })
    : recommendLevel({ score: 0, total: preQuestionIds.length, wrongIds: preQuestionIds })

  await saveSuggestionDb(session.studentId, {
    prefAnswers,
    talentId,
    suggestedRoute: route.suggested,
    suggestedLevel: level.suggested,
    routeReason: route.reason,
    levelReason: level.reason,
    weakObjectives: pretest ? pretest.weakObjectives : level.weakObjectives,
  })

  return NextResponse.json({
    suggestedRoute: route.suggested,
    routeScores: route.scores,
    routeReason: route.reason,
    suggestedLevel: level.suggested,
    levelReason: level.reason,
    weakObjectives: pretest ? pretest.weakObjectives : level.weakObjectives,
    talentId,
  })
}

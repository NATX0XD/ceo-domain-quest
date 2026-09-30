import type { Metadata } from 'next'
import { CheckClient } from '@/components/check-client'
import { SignInGate } from '@/components/student-shell'
import { DEFAULT_CHECK_SET, checkMeta, checkQuestionsForClient } from '@/components/server/check-questions'
import { checkSetForStudent } from '@/components/server/check-assignment'
import { confidenceScaleForClient } from '@/components/server/lesson-content'
import { getProfile } from '@/lib/db/repo'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'เช็กความเข้าใจ — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * S-05 เช็กความเข้าใจ 4 ข้อ (ช่วงรู้จักตัวเอง)
 *
 * ⚠️ **คนละชุดกับแบบทดสอบวิจัย** — ชุดวิจัย 10 ข้ออยู่ที่ /pretest (ก่อนคาบ) และ /posttest (หลังคาบ)
 *    ชุดนี้ไม่เก็บเป็นคะแนน ใช้เสนอระดับตัวช่วยอย่างเดียว
 * ⚠️ เฉลยอยู่ใน content/check-questions-answers.json อ่านเฉพาะตอนตรวจที่ POST /api/check
 *
 * ⚠️ **ชุดคำถามต้องมาจาก `checkSetForStudent()` ตัวเดียวกับที่ POST /api/check ใช้ตรวจ**
 *    เดิมหน้านี้แจก `DEFAULT_CHECK_SET` (ชุด A) ให้ทุกคน แต่เซิร์ฟเวอร์ตรวจด้วยชุดที่สลับ A/B
 *    ตามลำดับเข้าห้อง คนลำดับคู่จึงเห็นโจทย์ชุด A แต่ถูกตรวจด้วยเฉลยชุด B — รหัสข้อไม่ตรงกัน
 *    ทุกข้อจึงนับผิดหมด ได้ 0 จาก 4 ทั้งที่ตอบถูก แล้วถูกเสนอตัวช่วยระดับสูงสุด
 *    (`gradeCheck` เทียบ `answers[q.id]` กับเฉลยของ q.id ในชุดที่มันใช้ ข้อที่ไม่มีคำตอบส่งมา = ผิด)
 */
export default async function CheckPage() {
  const session = await readStudentSession()
  if (!session) {
    return <SignInGate message="เข้าห้องก่อน แล้วค่อยมาเช็กความเข้าใจกัน 4 ข้อ" />
  }

  const [profile, assignment] = await Promise.all([
    getProfile(session.studentId),
    checkSetForStudent(session.studentId, session.classroomId),
  ])
  const readiness = (profile?.readiness ?? {}) as Record<string, unknown>
  const saved = readiness.check as { score?: number; total?: number } | undefined
  const questions = checkQuestionsForClient(assignment.setId || DEFAULT_CHECK_SET)

  const suggestion = (readiness.suggestion ?? {}) as { levelReason?: string }
  const savedLevel = profile?.scaffold_level
  const initialResult =
    typeof saved?.score === 'number'
      ? {
          score: saved.score ?? 0,
          total: saved.total ?? questions.length,
          suggestedLevel: (savedLevel === 2 || savedLevel === 3 ? savedLevel : 1) as 1 | 2 | 3,
          levelReason: suggestion.levelReason ?? '',
        }
      : null

  return (
    <CheckClient
      questions={questions}
      title={checkMeta.title}
      intro={checkMeta.intro}
      confidenceLevels={confidenceScaleForClient().levels}
      initialResult={initialResult}
    />
  )
}

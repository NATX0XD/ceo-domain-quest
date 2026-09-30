import type { Metadata } from 'next'
import { getQuizSet } from '@/core/quiz'
import { PosttestClient } from '@/components/posttest-client'
import { SignInGate } from '@/components/student-shell'
import { posttestGate } from '@/components/server/posttest-gate'
import { getProfile } from '@/lib/db/repo'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'แบบทดสอบหลังเรียน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * แบบทดสอบหลังเรียน 10 ข้อ (สเปกข้อ 3.1 แถวหลังคาบ)
 *
 * ไม่มีหน้านี้ = ไม่มีคะแนนหลังเรียน = คำนวณ E2 ไม่ได้ = ตอบกรรมการเรื่องประสิทธิภาพสื่อไม่ได้
 * ⚠️ ครูเป็นคนกดเปิด (posttestGate) · โจทย์ส่งไปเฉพาะตอนเปิดแล้วและยังไม่เคยทำ
 * ⚠️ เฉลยอยู่ใน content/quiz-answers.json อ่านเฉพาะตอนตรวจที่ POST /api/posttest เท่านั้น
 */
export default async function PosttestPage() {
  const session = await readStudentSession()
  if (!session) {
    return (
      <SignInGate message="ใส่รหัสห้อง 6 ตัวกับรหัส 4 หลักที่ครูให้ก่อน แล้วค่อยทำแบบทดสอบหลังเรียน" />
    )
  }

  const [gate, profile] = await Promise.all([
    posttestGate(session.studentId),
    getProfile(session.studentId),
  ])

  const all = getQuizSet('post')
  const done = profile?.post_test_score ?? null
  const questions =
    gate.open && done === null
      ? all.map((q) => ({ id: q.id, question: q.question, choices: q.choices }))
      : []

  return (
    <PosttestClient
      open={gate.open}
      reason={gate.reason}
      questions={questions}
      total={all.length}
      initialResult={
        done === null
          ? null
          : {
              score: done,
              total: all.length,
              preScore: profile?.pre_test_score ?? null,
              gain:
                profile?.pre_test_score === null || profile?.pre_test_score === undefined
                  ? null
                  : done - profile.pre_test_score,
            }
      }
    />
  )
}

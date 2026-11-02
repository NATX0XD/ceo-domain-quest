import type { Metadata } from 'next'
import { getQuizSet } from '@/core/quiz'
import { recommendLevel } from '@/core/personalize'
import { PretestClient } from '@/components/pretest-client'
import { SignInGate } from '@/components/student-shell'
import { selfProfile } from '@/components/server/lesson-content'
import { loadPretestDb, loadSelfProfileDb } from '@/components/server/game-state'
import { pretestGate } from '@/components/server/posttest-gate'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'แบบทดสอบก่อนเรียน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * T-12 แบบทดสอบก่อนเรียน (ชุดวิจัย 10 ข้อ ชุด `pre` ของ content/quiz.json)
 *
 * ⚠️ **คนละชุดกับ "เช็กความเข้าใจ 4 ข้อ" (S-05)** ที่อยู่หน้า /check
 *    ชุดนี้คือข้อสอบวิจัย ใช้คู่กับ /posttest เพื่อคิด E1/E2 และคะแนนพัฒนาการ
 *    ส่วนชุด 4 ข้อใช้เสนอระดับตัวช่วย ไม่เก็บเป็นคะแนน
 * เดิม — แบบทดสอบก่อนเรียน
 * เซิร์ฟเวอร์ส่งไปเฉพาะโจทย์กับตัวเลือก (getQuizSet ไม่มีเฉลยติดมา)
 * เฉลยอยู่ใน content/quiz-answers.json และถูกอ่านเฉพาะตอนตรวจที่ POST /api/pretest
 */
export default async function PretestPage() {
  const session = await readStudentSession()
  if (!session) {
    return (
      <SignInGate message="ใส่รหัสห้อง 6 ตัวกับรหัส 4 หลักที่ครูให้ก่อน แล้วค่อยทำแบบทดสอบก่อนเรียน" />
    )
  }

  const objectives = Object.fromEntries(
    selfProfile.objectives.map((o) => [o.id, o.shortName]),
  )

  const [saved, gate, self] = await Promise.all([
    loadPretestDb(session.studentId),
    pretestGate(session.studentId),
    loadSelfProfileDb(session.studentId),
  ])
  const questions = getQuizSet('pre').map((q) => ({
    id: q.id,
    question: q.question,
    choices: q.choices,
  }))

  // ทำแล้วให้เห็นผลเดิม พร้อมระดับที่ระบบเสนอจากคะแนนนั้น (คิดซ้ำฝั่งเซิร์ฟเวอร์ ไม่เก็บระดับซ้ำซ้อน)
  const initialResult = saved
    ? (() => {
        const level = recommendLevel({
          score: saved.score,
          total: questions.length,
          wrongIds: [],
        })
        return {
          score: saved.score,
          total: questions.length,
          suggestedLevel: level.suggested,
          levelReason: saved.levelReason || level.reason,
          weakTopics: saved.weakObjectives.map((id) => objectives[id] ?? id),
        }
      })()
    : null

  return (
    <PretestClient
      questions={questions}
      objectives={objectives}
      initialResult={initialResult}
      // ครูเป็นคนกดเปิด (T-12) · ทำไปแล้วยังเปิดดูผลเดิมได้เสมอ
      open={gate.open || initialResult !== null}
      closedReason={gate.reason}
      // ต้องทำแบบทดสอบนี้ก่อนเข้าภารกิจ — รู้จักตัวเองแล้วให้กลับไปแผนที่ได้เลย
      nextHref={self.route !== null ? '/map' : '/profile'}
    />
  )
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInGate } from '@/components/student-shell'
import { ReflectClient, type ReflectCompareCard, type ReflectOutcome } from '@/components/reflect-client'
import {
  fillTemplate,
  goalCompareCard,
  goalCompareMessage,
  reflection,
} from '@/components/server/lesson-content'
import { lessonSummary } from '@/components/server/lesson-progress'
import { loadReflectionDb, loadShopProfile } from '@/components/server/game-state'
import { reflectUnlocked } from '@/components/server/posttest-gate'
import { getProfile, getStudent } from '@/lib/db/repo'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'ทบทวนตัวเอง — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

const OUTCOMES: ReflectOutcome[] = ['below', 'met', 'exceeded']

/**
 * ขั้นที่ 6 ทบทวนตัวเอง (นาทีที่ 55-60)
 *
 * ⚠️ ข้อความทุกบรรทัดมาจาก content/reflection.json ผ่าน `reflection`
 *    เซิร์ฟเวอร์เป็นคนแทนค่า {nickname} {goalName} ... ด้วย fillTemplate เพราะ client แตะไฟล์เนื้อหาไม่ได้
 * ⚠️ ดาวและผลเทียบเป้าหมายมาจาก lessonSummary() ซึ่งอ่านฐานข้อมูลจริง ห้ามฝังตัวเลขตัวอย่าง
 */
export default async function ReflectPage() {
  const session = await readStudentSession()

  if (!session) {
    return <SignInGate message="ใส่รหัสห้องกับ PIN ที่ครูให้ก่อน แล้วค่อยกลับมาทบทวนตัวเอง" />
  }

  // ทบทวนได้หลังส่งแบบทดสอบหลังเรียนแล้วเท่านั้น (เดาลิงก์มาตรง ๆ ก็เด้งกลับ)
  if (!reflectUnlocked(await getProfile(session.studentId))) redirect('/posttest')

  const [student, shop, answers, summary] = await Promise.all([
    getStudent(session.studentId),
    loadShopProfile(session.studentId),
    loadReflectionDb(session.studentId),
    lessonSummary(session.studentId),
  ])

  const nickname = student?.nickname ?? ''
  const earnedStars = summary.totalStars
  const goalStars = summary.goalStars
  const weakMission = summary.missions.find((m) => !m.passed) ?? null

  const templateValues = {
    nickname,
    shopName: shop?.shopName ?? '',
    goalName: summary.goalName ?? '',
    goalStars: goalStars ?? 0,
    earnedStars,
    missingStars: Math.max(0, (goalStars ?? 0) - earnedStars),
    extraStars: Math.max(0, earnedStars - (goalStars ?? 0)),
    weakTopic: weakMission?.title ?? 'ยังไม่มีข้อมูล',
  }

  // เตรียมการ์ดเปรียบเทียบไว้ครบทั้ง 3 แบบ เพราะผลจริงถูกยืนยันอีกครั้งตอน POST /api/reflect
  const fillOrNull = (template: string | undefined) =>
    template ? fillTemplate(template, templateValues) : null

  const compareCards = Object.fromEntries(
    OUTCOMES.map((outcome): [ReflectOutcome, ReflectCompareCard | null] => {
      const card = goalCompareCard(outcome)
      if (!card) return [outcome, null]
      return [
        outcome,
        {
          badgeLabel: card.badgeLabel,
          headline: fillTemplate(card.headline, templateValues),
          message: fillTemplate(
            goalCompareMessage(card, templateValues.missingStars),
            templateValues,
          ),
          focusLabel: card.focusLabel ?? null,
          focusText: fillOrNull(card.focusTemplate),
          nextStepLabel: card.nextStepLabel ?? null,
          nextStepText: fillOrNull(card.nextStepText),
        },
      ]
    }),
  ) as Record<ReflectOutcome, ReflectCompareCard | null>

  const alreadyComplete =
    reflection.questions.length > 0 &&
    reflection.questions.every((q) => (answers[q.id] ?? '').trim().length >= q.minLength)

  return (
    <ReflectClient
      meta={{
        submitButtonLabel: reflection.meta.submitButtonLabel,
        savedMessage: fillTemplate(reflection.meta.savedMessage, templateValues),
      }}
      questions={reflection.questions
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((q) => ({
          id: q.id,
          question: fillTemplate(q.question, templateValues),
          helper: fillTemplate(q.helper, templateValues),
          placeholder: fillTemplate(q.placeholder, templateValues),
          starterPhrases: q.starterPhrases.map((p) => fillTemplate(p, templateValues)),
          minLength: q.minLength,
          maxLength: q.maxLength,
        }))}
      extras={reflection.extras.map((x) => ({
        id: x.id,
        kind: x.kind,
        question: x.question,
        options: x.options ?? [],
        max: x.max ?? 5,
      }))}
      promptShort={reflection.promptShort}
      learnedOptions={summary.missions.map((m) => m.title)}
      initialAnswers={answers}
      initiallyComplete={alreadyComplete}
      stars={{
        earned: earnedStars,
        goal: goalStars,
        goalName: summary.goalName,
        max: summary.maxStars,
      }}
      compareCards={compareCards}
      initialOutcome={summary.outcome}
    />
  )
}

import type { Metadata } from 'next'
import { DomeChatClient } from '@/components/dome-chat-client'
import { SignInGate } from '@/components/student-shell'
import { domeGreeting, domeNextStep, domeQuickReplies } from '@/components/server/dome-brain'
import { loadSelfProfileDb, loadShopProfile } from '@/components/server/game-state'
import { lessonSummary } from '@/components/server/lesson-progress'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { mainTabReturnPath } from '@/components/dome-fab'

export const metadata: Metadata = { title: 'คุยกับเลขาโดม — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/** หน้าแรกของนักเรียนคือหน้าคุยกับโดม ไม่ใช่แบบฟอร์ม (ตาม mockup หน้า 1) */
export default async function DomePage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const backHref = mainTabReturnPath((await searchParams).from)
  const session = await readStudentSession()
  if (!session) return <SignInGate />

  const [profile, selfProfile, summary] = await Promise.all([
    loadShopProfile(session.studentId),
    loadSelfProfileDb(session.studentId),
    lessonSummary(session.studentId),
  ])
  const currentMissionId = summary.missions.find((mission) => !mission.passed)?.id ?? 'm5'
  const greeting = domeGreeting(profile?.shopName ?? null)

  return (
    <DomeChatClient
      greeting={greeting.reply}
      greetingAction={greeting.action}
      quickReplies={domeQuickReplies()}
      currentMissionId={currentMissionId}
      nextStep={domeNextStep(profile?.shopName ?? null, selfProfile.route !== null)}
      backHref={backHref}
    />
  )
}

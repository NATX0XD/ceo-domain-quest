import type { Metadata } from 'next'
import { DomeChatClient } from '@/components/dome-chat-client'
import { SignInGate } from '@/components/student-shell'
import { domeGreeting, domeQuickReplies } from '@/components/server/dome-brain'
import { loadShopProfile } from '@/components/server/game-state'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'คุยกับเลขาโดม — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/** หน้าแรกของนักเรียนคือหน้าคุยกับโดม ไม่ใช่แบบฟอร์ม (ตาม mockup หน้า 1) */
export default async function DomePage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate />



  const profile = await loadShopProfile(session.studentId)
  const greeting = domeGreeting(profile?.shopName ?? null)

  return (
    <DomeChatClient
      greeting={greeting.reply}
      greetingAction={greeting.action}
      quickReplies={domeQuickReplies()}
    />
  )
}

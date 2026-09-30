import type { Metadata } from 'next'
import { IntroCardsClient } from '@/components/intro-cards-client'
import { SignInGate } from '@/components/student-shell'
import { introCards, introLabels } from '@/components/server/intro-content'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'วิธีใช้ — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * S-02 คำแนะนำการใช้งาน (หน้าจอ SC-02) — ขึ้นครั้งแรกหลังเข้าห้อง
 * กดข้ามได้ตลอด ไม่บังคับดูจนจบ
 */
export default async function IntroPage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate message="เข้าห้องก่อน แล้ววิธีใช้จะขึ้นให้เองครับ" />

  return (
    <IntroCardsClient
      cards={introCards}
      nextHref="/dome"
      skipLabel={introLabels.skip}
      nextLabel={introLabels.next}
      startLabel={introLabels.start}
    />
  )
}

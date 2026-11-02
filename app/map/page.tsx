import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import { SignInGate } from '@/components/student-shell'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { lessonSummary } from '@/components/server/lesson-progress'
import { bigMission, selfProfile } from '@/components/server/lesson-content'
import { MapHotspots } from '@/components/map-hotspots'
import { loadTestNudge } from '@/components/server/test-nudge'
import { requireShopProfile } from '@/components/server/shop-gate'
import { loadSelfProfileDb } from '@/components/server/game-state'
import type { LearnModeId } from '@/components/learn/learn-path-api'

export const metadata: Metadata = { title: 'แผนภารกิจของฉัน — CEO Domain Quest' }
export const dynamic = 'force-dynamic'

export default async function MapPage({ searchParams }: { searchParams: Promise<{ done?: string | string[] }> }) {
  const doneParam = (await searchParams).done
  const justDone = typeof doneParam === 'string' ? doneParam : null
  const session = await readStudentSession()
  if (!session) return <SignInGate message="ใส่รหัสห้องกับ PIN ที่ครูให้ก่อน แล้วแผนภารกิจจะขึ้นมาให้ดูทั้งเส้นทาง" />

  await requireShopProfile(session.studentId)
  const data = await lessonSummary(session.studentId)
  const self = await loadSelfProfileDb(session.studentId)
  const allMissionsPassed = data.missions.length > 0 && data.missions.every((mission) => mission.passed)
  const nudge = await loadTestNudge(session.studentId, data.missions.filter((m) => m.passed).length)
  const mapState = Math.min(data.summary.done + 1, 4)
  const savedRoute = self.route ?? self.suggestedRoute
  const recommendedMode: LearnModeId | null =
    savedRoute === 'clip' ? 'watch' : savedRoute === 'card' ? 'read' : savedRoute === 'game' ? 'do' : null

  return (
    <AppShell className="media-shell student-display student-world map-shell-fit" mainLabel="แผนที่ภารกิจ" footer={<BottomNav />} fit>
      <MapHotspots
        imageState={mapState}
        nudge={nudge}
        missions={data.missions.map((mission) => ({
          id: mission.id,
          title: mission.title,
          passed: mission.passed,
          stars: mission.stars,
          maxStars: selfProfile.starBudget.perMissionMax,
          attempts: mission.attempts,
        }))}
        boss={{
          title: bigMission.title,
          unlocked: allMissionsPassed,
          href: '/ceo',
        }}
        recommendedMode={recommendedMode}
        justDone={justDone}
      />
    </AppShell>
  )
}

import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { BottomNav } from '@/components/bottom-nav'
import { SignInGate } from '@/components/student-shell'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { lessonSummary } from '@/components/server/lesson-progress'
import { bigMission, selfProfile } from '@/components/server/lesson-content'
import { MapHotspots } from '@/components/map-hotspots'

export const metadata: Metadata = { title: 'แผนภารกิจของฉัน — CEO Domain Quest' }
export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const session = await readStudentSession()
  if (!session) return <SignInGate message="ใส่รหัสห้องกับ PIN ที่ครูให้ก่อน แล้วแผนภารกิจจะขึ้นมาให้ดูทั้งเส้นทาง" />

  const data = await lessonSummary(session.studentId)
  const allMissionsPassed = data.missions.length > 0 && data.missions.every((mission) => mission.passed)
  const mapState = Math.min(data.summary.done + 1, 4)

  return (
    <AppShell className="media-shell student-display" mainLabel="แผนที่ภารกิจ" footer={<BottomNav />}>
      <MapHotspots
        imageState={mapState}
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
      />
    </AppShell>
  )
}

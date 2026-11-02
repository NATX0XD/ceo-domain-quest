import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { MissionId } from '@/lib/db/repo'
import { MissionClient } from '@/components/mission-client'
import { SignInGate } from '@/components/student-shell'
import { findMission } from '@/components/missions'
import { lessonSummary } from '@/components/server/lesson-progress'
import { confidenceScaleForClient } from '@/components/server/lesson-content'
import { listProgress } from '@/lib/db/repo'
import { loadMissionRow, loadSelfProfileDb } from '@/components/server/game-state'
import { m2VariantFor, personalizeM2LearnPath, personalizeM2Mission } from '@/components/server/mission-variant'
import { suggestChannel } from '@/components/server/channel-advice'
import { missionStoryFor } from '@/components/server/mission-story'
import { buildGameData } from '@/components/server/mission-game-data'
import { buildStationSection } from '@/components/server/station-b-section'
import { passedAnswerLabel } from '@/components/server/mission-answer-recall'
import { certificateEligibility } from '@/components/server/certificate-eligibility'
import { studentNextStep } from '@/components/server/next-step'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { LearnPathClient } from '@/components/learn/learn-path-client'
import { M2Flow } from '@/components/learn/m2-flow'
import { PASS_SCORE, findLearnPath, loadLearnState, type LearnState } from '@/components/server/learn-path'
import { publicCounterData } from '@/components/server/learn-counter'
import { publicRegistrarData } from '@/components/server/learn-registrar'
import { requireShopProfile } from '@/components/server/shop-gate'
import type { LearnModeId } from '@/components/learn/learn-path-api'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const mission = findMission(id)
  return { title: mission ? `${mission.title} — CEO Domain Quest` : 'ไม่พบภารกิจ' }
}

export default async function MissionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const mission = findMission(id)
  if (!mission) notFound()

  const session = await readStudentSession()
  if (!session) {
    return <SignInGate message="ใส่รหัสห้องกับรหัส 4 หลักที่ครูให้ก่อน แล้วค่อยเริ่มภารกิจ" />
  }

  const shopProfile = await requireShopProfile(session.studentId)
  const selfProfile = await loadSelfProfileDb(session.studentId)
  const savedRoute = selfProfile.route ?? selfProfile.suggestedRoute
  const recommendedMode: LearnModeId | null =
    savedRoute === 'clip' ? 'watch' : savedRoute === 'card' ? 'read' : savedRoute === 'game' ? 'do' : null
  const m2Variant = mission.id === 'm2' ? m2VariantFor(session.studentId, shopProfile?.domainName) : null
  const studentMission = m2Variant ? personalizeM2Mission(mission, m2Variant) : mission

  /**
   * เส้นทางเรียนก่อนภารกิจ (docs/learn-path-spec.md) — ยังไม่จบ = แสดงจอเรียนแทนจอภารกิจ
   * ผู้เรียนเลือกวิธีเรียนจาก self-profile ก่อน แล้วเรียนตามวิธีที่เลือกจนครบเกณฑ์ · อ่านสถานะไม่ได้ = ปล่อยเข้าภารกิจเดิม ไม่ปิดทางเรียน
   */
  const learnPath = findLearnPath(mission.id)
  if (learnPath) {
    const studentLearnPath = m2Variant ? personalizeM2LearnPath(learnPath, m2Variant) : learnPath
    let learnState: LearnState | null = null
    try {
      learnState = await loadLearnState(session.studentId, mission.id)
    } catch (err) {
      console.error('[mission] loadLearnState', err)
    }
    if (learnState && !learnState.done) {
      if (mission.id === 'm2') {
        return (
          <M2Flow
            missionTitle={mission.title}
            path={studentLearnPath}
            state={learnState}
            recommendedMode={recommendedMode}
          />
        )
      }
      const kind = studentLearnPath.do.kind
      return (
        <LearnPathClient
          missionId={mission.id}
          studentId={session.studentId}
          missionTitle={mission.title}
          path={studentLearnPath}
          state={learnState}
          passScore={PASS_SCORE}
          gameData={kind === 'game' ? buildGameData(studentMission, session.studentId) : null}
          counterData={kind === 'counter' ? publicCounterData() : null}
          registrarData={kind === 'registrar' ? publicRegistrarData() : null}
          recommendedMode={recommendedMode}
        />
      )
    }
  }

  const [row, self, summary, progress, advice, story, standing] = await Promise.all([
    loadMissionRow(session.studentId, mission.id as MissionId),
    Promise.resolve(selfProfile),
    lessonSummary(session.studentId),
    listProgress(session.studentId),
    /**
     * E-03 ข้อเสนอช่องทางการเรียน — คิดจาก "ได้ผลจริงกับเด็กคนนี้" ไม่ใช่ความชอบตอนต้นคาบอย่างเดียว
     * ยังไม่มีประวัติ = คืนข้อเสนอเดิมจากคำตอบความถนัด (ดู components/server/channel-advice.ts)
     * **เป็นข้อเสนอเท่านั้น** ทั้ง 4 ช่องทางยังกดได้ครบ และการเลือกจริงถูกบันทึกที่ route_changes
     */
    suggestChannel(session.studentId),
    /**
     * E-07 + S-16 บทเปิดเฉพาะร้านของเด็กคนนี้
     * เรนเดอร์ฝั่งเซิร์ฟเวอร์ **ครั้งเดียวตอนเปิดหน้า** ยังไม่เสร็จก็ได้ประโยคสำรองทันที
     * ไม่ไป fetch ฝั่งเบราว์เซอร์ เพราะสเปกห้ามสลับข้อความระหว่างที่ผู้เรียนกำลังอ่าน
     */
    missionStoryFor(session.studentId, mission),
    /**
     * สถานะด่านบอส — ต้องอ่านจากตัวตัดสินตัวเดียวกับ /home /map /result
     * ไม่งั้นปุ่ม "ไปต่อ" ของจอนี้จะพาไปคนละที่กับที่จออื่นบอก (flow-1.md ข้อ 1)
     */
    certificateEligibility(session.studentId),
  ])
  // ธง "ขอครู" ของผู้เรียนคนนี้ (แผงครูอ่านค่าเดียวกัน)
  const helpRequested = progress.some((p) => p.status === 'needs_help')

  /**
   * ทำจบข้อนี้แล้วไปไหนต่อ — คิดที่ `studentNextStep()` ที่เดียวของทั้งระบบ
   * ภารกิจย่อยที่ยังไม่ผ่าน (ที่ไม่ใช่ข้อนี้) มาก่อนเสมอ ครบแล้วค่อยพูดถึงด่านบอส
   */
  const nextRow = summary.missions.find((m) => !m.passed && m.id !== mission.id) ?? null
  const nextStep = studentNextStep({
    status: standing.status,
    missingCount: standing.missing.length,
    nextMission: nextRow
      ? {
          id: nextRow.id,
          title: nextRow.title,
          order: summary.missions.findIndex((m) => m.id === nextRow.id) + 1,
        }
      : null,
  })

  /**
   * ผ่านแล้วต้องบอกด้วยว่าเราตอบอะไรไป (flow-1.md ข้อ 3)
   * ⚠️ ขอเฉพาะตอน `row.passed` เท่านั้น — ข้อที่ยังไม่ผ่านห้ามส่งอะไรที่เกี่ยวกับเฉลยลงไปเลย
   */
  const passedAnswer = row.passed ? await passedAnswerLabel(mission) : null

  // ⚠️ ส่งไปให้เบราว์เซอร์เฉพาะคำใบ้ที่ปลดล็อกแล้ว ใบที่เหลืออยู่ฝั่งเซิร์ฟเวอร์
  const revealedHints = mission.hints.slice(0, row.hintsUsed)
  const { hints: _hints, ...missionWithoutHints } = studentMission

  return (
    <MissionClient
      studentId={session.studentId}
      mission={missionWithoutHints}
      hintsTotal={mission.hints.length}
      revealedHints={revealedHints}
      attempts={row.attempts}
      wrong={Math.max(0, row.attempts - (row.passed ? 1 : 0))}
      passed={row.passed}
      route={row.channelUsed ?? self.route ?? null}
      suggestedRoute={advice.suggested ?? self.suggestedRoute ?? null}
      suggestionReason={advice.reason}
      storyText={story.text}
      storyPersonalized={story.personalized}
      progressRows={summary.missions.map((m) => ({
        id: m.id,
        title: m.title,
        passed: m.passed,
        stars: m.stars,
      }))}
      totalStars={summary.totalStars}
      goalStars={summary.goalStars}
      gameData={buildGameData(studentMission, session.studentId)}
      confidence={confidenceScaleForClient()}
      helpRequested={helpRequested}
      nextStep={nextStep}
      passedAnswer={passedAnswer}
      stationSection={await buildStationSection(mission.id, session.studentId)}
    />
  )
}

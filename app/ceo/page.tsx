import type { Metadata } from 'next'
import { CeoClient } from '@/components/ceo-client'
import { SignInGate } from '@/components/student-shell'
import { bigMission, rubricForClient } from '@/components/server/lesson-content'
import { lessonSummary } from '@/components/server/lesson-progress'
import { loadShopProfile } from '@/components/server/game-state'
import { revisionDimensions, revisionState } from '@/components/server/revision'
import { getStudent, listSubmissions } from '@/lib/db/repo'
import { readStudentSession } from '@/app/api/_lib/session-cookie'
import { resolveBossTemplate } from '@/app/api/ceo/_lib/boss-template'
import { buildStoryInput } from '@/app/api/story/_lib/input'
import { storyItemFor } from '@/app/api/story/_lib/runner'
import { storyIdForTemplate } from '@/core/boss-scenario'

export const metadata: Metadata = { title: 'ด่านบอส CEO — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

/**
 * ขั้นที่ 4 ด่านบอส CEO (โทรศัพท์เครื่องที่ 5 ใน mockup app.jpg)
 *
 * ⚠️ ข้อความทุกบรรทัดที่เป็น "เนื้อหาบทเรียน" มาจาก content/big-mission.json ผ่าน `bigMission`
 *    ห้ามฝังคำถาม ป้ายช่อง หัวข้อนำเสนอ หรือบรรทัดรูบริกไว้ในไฟล์นี้หรือใน client
 * ⚠️ studentId มาจากคุกกี้ dbq_student เท่านั้น การตัดสินความครบถ้วนอยู่ที่ POST /api/ceo
 */
export default async function CeoPage() {
  const session = await readStudentSession()

  if (!session) {
    return <SignInGate message="ใส่รหัสห้อง 6 ตัวกับรหัส 4 หลักที่ครูให้ก่อน แล้วค่อยกลับมาทำด่านบอส" />
  }

  const [student, shop, summary, submissions, bossTemplate] = await Promise.all([
    getStudent(session.studentId),
    loadShopProfile(session.studentId),
    lessonSummary(session.studentId),
    listSubmissions(session.studentId),
    // S-22 แม่แบบด่านบอสของคนนี้โดยเฉพาะ ล้มก็ยังเปิดหน้าได้ด้วยสถานการณ์กลาง
    resolveBossTemplate(session.studentId).catch(() => null),
  ])

  /**
   * S-16 เรื่องเปิดของด่านบอส เฉพาะร้านของผู้เรียนคนนี้
   *
   * ลำดับที่ใช้ เรียงจากดีที่สุดลงมา **ทุกชั้นคืนข้อความที่อ่านได้ ไม่มีชั้นไหนเป็นช่องว่าง**
   * 1. เรื่องที่ AI แต่งให้ร้านนี้ ผูกกับแม่แบบที่เลือกได้ (เช่น B-T4)
   * 2. ประโยคสำรองของแม่แบบนั้น ที่เติมชื่อร้านจริงแล้ว
   * 3. เรื่องราวของแม่แบบตามไฟล์เนื้อหา
   * 4. สถานการณ์กลางของด่านบอส (ของเดิมก่อนมีแม่แบบ)
   */
  let scenario = bossTemplate?.template.scenario ?? bigMission.scenario

  if (bossTemplate) {
    const storyInput = await buildStoryInput(session.studentId).catch(() => null)
    if (storyInput) {
      const item = await storyItemFor(
        session.studentId,
        storyIdForTemplate(bossTemplate.template),
        storyInput,
      ).catch(() => null)
      if (item?.text) scenario = item.text
    }
  }

  /**
   * ครูสั่งให้แก้อยู่หรือเปล่า — ส่งมาเป็น prop ตั้งต้นด้วย
   * หน้าจะได้บอกได้ทันทีตั้งแต่เรนเดอร์แรก ไม่ต้องรอ fetch (และอ่านได้แม้ JS ยังไม่ทำงาน)
   */
  const revision = revisionState(submissions)

  /**
   * รูปแบบการส่งงานลำดับแรกในไฟล์เนื้อหาคือแบบที่หน้าเว็บนี้ทำงานได้เต็มรูปแบบ (พิมพ์ในหน้าเว็บ)
   * อีกสองแบบเลือกได้และถูกบันทึก แต่ตัวงานจริงส่งกับครูหน้าห้อง จึงอ่านจากลำดับไม่ใช่จากรหัสที่ฝังไว้
   */
  const primaryModeId = bigMission.submitModes[0]?.id ?? ''

  return (
    <CeoClient
      title={bigMission.title}
      startMinute={bigMission.startMinute}
      endMinute={bigMission.endMinute}
      minutes={bigMission.minutes}
      objective={bigMission.objective}
      scenario={scenario}
      guidingQuestions={bigMission.guidingQuestions.map((q) => ({ id: q.id, text: q.text }))}
      submitModes={bigMission.submitModes.map((m) => ({
        id: m.id,
        label: m.label,
        icon: m.icon,
        instruction: m.instruction,
      }))}
      primaryModeId={primaryModeId}
      rubric={rubricForClient()}
      fields={bigMission.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        placeholder: f.placeholder ?? '',
        options: f.options?.map((o) => ({ value: o.value, label: o.label })) ?? [],
        help: f.help,
        required: f.required,
      }))}
      selfAssessment={bigMission.selfAssessment.map((s) => ({ id: s.id, question: s.question }))}
      nickname={student?.nickname ?? ''}
      shopName={shop?.shopName ?? ''}
      alreadySubmitted={summary.bigMissionSubmitted}
      initialRevision={
        revision.request
          ? {
              note: revision.request.note,
              dimensions: revisionDimensions(revision.request),
              round: revision.roundsUsed + 1,
              roundsLeft: revision.roundsLeft,
            }
          : null
      }
    />
  )
}

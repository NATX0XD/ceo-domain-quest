import missionsJson from '@/content/missions.json' with { type: 'json' }
import { type SkipBy, type SkipDecision, evaluateSkip } from '@/core/personalize'
import {
  type MissionId,
  type MissionProgressPatch,
  type OverrideReason,
  type SkipTarget,
  getOrCreateMissionProgress,
  getProfile,
  recalcStudentStars,
  recordSkip,
  teacherSkipMission,
  upsertMissionProgress,
} from '@/lib/db/repo'

/**
 * การข้ามภารกิจ — **เซิร์ฟเวอร์ตัดสินเองทุกครั้ง** (ฝั่งเซิร์ฟเวอร์เท่านั้น)
 *
 * ⚠️ ห้ามเชื่อค่าที่หน้าจอส่งมาว่า "ข้ามได้แล้ว" แม้แต่ฟิลด์เดียว
 *    route ของการข้ามจึงไม่อ่าน body เลย หลักฐานทุกชิ้นอ่านจากฐานข้อมูลของนักเรียนคนที่ถือคุกกี้
 *
 * กติกาอยู่ที่ `core/personalize.ts` (evaluateSkip) ซึ่งอ่านจาก content/rubric.json คีย์ missionStars.skip
 * ที่นี่ทำแค่ 2 อย่าง: หาหลักฐานมาป้อนกติกา แล้วบันทึกผลที่กติกาตัดสิน
 *
 * หลักฐาน 2 ชิ้นที่ใช้:
 * 1. ตอบข้อที่วัดจุดประสงค์ของภารกิจนี้ถูกไหม — `profiles.readiness[objectiveId]` (เขียนโดย /api/check)
 * 2. บอกว่ามั่นใจแค่ไหนในข้อนั้น — `profiles.confidence[objectiveId]` (เขียนโดย /api/check เหมือนกัน)
 * ส่วน "ครูสั่งให้ข้าม" (T-06) อ่านจาก `mission_progress.skip_allowed` ที่ RPC `teacher_allow_skip` ตั้งไว้
 */

/** จุดประสงค์ที่ภารกิจแต่ละข้อวัด — อ่านจากไฟล์เนื้อหาจริง ไม่ฮาร์ดโค้ดคู่ซ้ำ */
const OBJECTIVE_BY_MISSION = new Map<string, string>(
  (missionsJson as { missions: { id: string; objectiveId: string }[] }).missions.map((m) => [
    m.id,
    m.objectiveId,
  ]),
)

function bagOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export interface SkipVerdict {
  decision: SkipDecision
  /** ใครเป็นคนสั่งข้ามตามที่กติกาตัดสิน (ไม่ใช่ตามที่หน้าจอบอก) */
  by: SkipBy
  /** จุดประสงค์ที่ภารกิจนี้วัด — null ถ้าไฟล์เนื้อหาไม่ได้ผูกไว้ */
  objectiveId: string | null
  /** หลักฐานที่เอาไปป้อนกติกา ใช้อธิบายให้ครู/รายงานตรวจสอบย้อนหลังได้ */
  evidence: { correct: boolean; confidence: number | null; teacherAllowed: boolean }
}

/**
 * ตัดสินว่าคนนี้ข้ามภารกิจนี้ได้ไหม — อ่านหลักฐานจาก DB ล้วน
 *
 * ลำดับการตัดสิน: ดูว่าผู้เรียนผ่านเงื่อนไขด้วยตัวเองก่อนเสมอ (ได้ 3 ดาว)
 * ถ้ายังไม่ผ่านค่อยดูว่าครูเปิดให้ข้ามไว้ไหม (ได้ 0 ดาว แต่ผ่านจุดประสงค์)
 * ไม่เข้าทั้งสองทาง = ปฏิเสธ **ไม่ใช่ปล่อยให้ข้ามแล้วให้ 0 ดาว**
 */
export async function decideMissionSkip(
  studentId: string,
  missionId: MissionId,
): Promise<SkipVerdict> {
  const [profile, row] = await Promise.all([
    getProfile(studentId),
    getOrCreateMissionProgress(studentId, missionId),
  ])

  const objectiveId = OBJECTIVE_BY_MISSION.get(missionId) ?? null
  const readiness = bagOf(profile?.readiness)
  const confidenceBag = bagOf(profile?.confidence)

  const correct = objectiveId !== null && readiness[objectiveId] === true
  const rawConfidence = objectiveId === null ? undefined : confidenceBag[objectiveId]
  const confidence = typeof rawConfidence === 'number' ? rawConfidence : null
  const teacherAllowed = row.skip_allowed === true

  const evidence = { correct, confidence, teacherAllowed }

  // ยังไม่ได้ทำเช็กความเข้าใจ = ไม่มีความมั่นใจบันทึกไว้ = ข้ามเองไม่ได้ (กติกาเดียวกับ core/journey.ts)
  const self = evaluateSkip({
    by: 'student',
    correct,
    confidence: confidence ?? undefined,
  })
  if (self.allowed) return { decision: self, by: 'student', objectiveId, evidence }

  if (teacherAllowed) {
    return { decision: evaluateSkip({ by: 'teacher' }), by: 'teacher', objectiveId, evidence }
  }

  return { decision: self, by: 'student', objectiveId, evidence }
}

export interface SkipApplied {
  stars: number
  passed: boolean
}

/**
 * ลงบันทึกการข้ามที่ผ่านการตัดสินแล้ว
 *
 * - ดาวใช้ค่าที่สูงกว่าระหว่างของเดิมกับที่กติกาให้ **ไม่ลดดาวที่เคยทำได้เอง**
 * - ข้ามที่ระบบรับรองนับว่าผ่านจุดประสงค์ (สเปกข้อ 1.6 "ผ่าน M1 รวมการข้าม")
 * - `recordSkip()` (RPC `record_mission_skip`) เขียนทั้ง `mission_skips` และ
 *   `mission_progress.skipped_by` ในธุรกรรมเดียว — รายงานต้องแยก "เด็กข้ามเอง" กับ "ครูสั่งข้าม" ให้ขาด
 *   ไม่งั้น E1 นับการตัดสินใจของครูเป็นผลการเรียนรู้ของเด็ก
 */
async function applySkipOutcome(
  studentId: string,
  missionId: MissionId,
  decision: SkipDecision,
): Promise<SkipApplied> {
  const row = await getOrCreateMissionProgress(studentId, missionId)

  const stars = Math.max(row.stars, decision.stars)
  const patch: MissionProgressPatch = { stars }
  if (decision.passed && row.passed_at === null) {
    patch.passed_at = new Date().toISOString()
  }

  await upsertMissionProgress(studentId, missionId, patch)
  // ให้ดาวแล้วต้อง recalc ทุกครั้ง ไม่งั้น profiles.earned_stars ค้าง
  await recalcStudentStars(studentId)

  return { stars, passed: decision.passed || row.passed_at !== null }
}

export async function applyMissionSkip(
  studentId: string,
  missionId: MissionId,
  verdict: SkipVerdict,
): Promise<SkipApplied> {
  const applied = await applySkipOutcome(studentId, missionId, verdict.decision)
  await recordSkip(studentId, missionId, verdict.decision.reason, verdict.by)
  return applied
}

export interface TeacherSkipResult {
  decision: SkipDecision
  applied: SkipApplied | null
  skippedAt: string
}

/**
 * ครูสั่งข้ามแทนนักเรียน (T-06) — **ไม่ต้องรอให้เด็กกดปุ่มเอง**
 *
 * RPC `teacher_skip_mission` ตรวจเจ้าของห้องในคิวรีเดียวกับที่เขียน (ไม่ใช่เจ้าของ = คืน null
 * และไม่มีแถวไหนถูกแตะ) พร้อมลง `teacher_overrides` action `skip-mission` ให้เองเพื่อตอบกรรมการได้
 *
 * ⚠️ RPC เขียนแค่ `mission_skips` + `skipped_by` ฝั่งนี้จึงต้องลงดาวกับสถานะผ่านต่อเอง
 *    ครูสั่งข้าม = **0 ดาว แต่นับว่าผ่านจุดประสงค์** ตาม content/rubric.json
 *    และดาวที่เด็กเคยทำได้เองจะไม่ถูกลดลง (ใช้ค่าที่สูงกว่า)
 * ⚠️ 'boss' ไม่มีแถวใน mission_progress จึงบันทึกแค่ร่องรอยการข้าม ไม่แตะดาว
 */
export async function teacherSkipMissionNow(
  teacherId: string,
  studentId: string,
  missionId: SkipTarget,
  reason: OverrideReason = 'coached',
  note?: string | null,
): Promise<TeacherSkipResult | null> {
  const row = await teacherSkipMission(teacherId, studentId, missionId, reason, note)
  if (!row) return null

  const decision = evaluateSkip({ by: 'teacher' })
  const applied =
    missionId === 'boss'
      ? null
      : await applySkipOutcome(studentId, missionId as MissionId, decision)

  return { decision, applied, skippedAt: row.skipped_at }
}

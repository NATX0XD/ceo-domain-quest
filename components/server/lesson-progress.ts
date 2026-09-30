import {
  type GoalOutcome,
  type MissionRecord,
  type ProgressSummary,
  type RouteId,
  goalOutcome,
  progressSummary,
  starsFor,
} from '@/core/personalize'
import { listSubmissions } from '@/lib/db/repo'
import { missions } from '@/components/missions'
import { findGoal, selfProfile } from '@/components/server/lesson-content'
import {
  BIG_MISSION_MAX_STARS,
  countRouteSwitches,
  loadAllMissionRows,
  loadBigMissionStars,
  loadSelfProfileDb,
} from '@/components/server/game-state'

/**
 * สรุปผลทั้งคาบจาก **ฐานข้อมูลจริง** — ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * ⚠️ ห้าม import จาก client component (ดึง core/personalize ซึ่งดึง core/quiz.ts ที่โหลดไฟล์เฉลย)
 * ตัวเลขทุกตัวในหน้าจอนักเรียนต้องมาจากที่นี่ ห้ามฝังค่าตัวอย่างไว้ใน component
 */
export interface MissionRow {
  id: string
  title: string
  passed: boolean
  stars: number
  attempts: number
  hintsUsed: number
  route: RouteId | null
  switches: number
}

export interface LessonSummary {
  missions: MissionRow[]
  summary: ProgressSummary
  /** ดาวจากภารกิจย่อย 4 ภารกิจ (สูงสุด 12) */
  missionStars: number
  /** ดาวภารกิจใหญ่ — ให้ทันทีจากคะแนนที่ระบบเสนอ ครูยืนยันแล้วปรับได้ (มติ master หลัง QA-1) */
  bigMissionStars: number
  bigMissionMaxStars: number
  /** true = ยังเป็นคะแนนที่ระบบเสนอ ครูยังไม่ได้กดยืนยัน */
  bigMissionPendingTeacher: boolean
  bigMissionSubmitted: boolean
  /** ดาวรวมทั้งคาบ = ภารกิจย่อย + ภารกิจใหญ่ (ตัวเลขเดียวกับ profiles.earned_stars) */
  totalStars: number
  maxStars: number
  /** เปอร์เซ็นต์ความคืบหน้า = ภารกิจที่ผ่าน / ภารกิจทั้งหมด (ภารกิจใหญ่นับเป็น 1 ด่าน) */
  percent: number
  /** S-09 จำนวนด่านที่ผ่านจริง (ภารกิจย่อย + ด่านบอส) — นับหัว ไม่ใช่คิดเป็นเปอร์เซ็นต์ */
  stagesCleared: number
  stagesTotal: number
  /** ภาพร้านที่ควรแสดง 1-4 คิดจากจำนวนด่านที่ผ่าน ไม่ใช่จากเปอร์เซ็นต์ */
  shopStage: 1 | 2 | 3 | 4
  /** ข้อความบอกความคืบหน้าแบบนับหัว เช่น "ร้านโตมาแล้ว 2 จาก 5 ด่าน" */
  shopStageLabel: string
  goalId: string | null
  goalName: string | null
  goalStars: number | null
  outcome: GoalOutcome | null
  route: RouteId | null
  routeChosenBy: 'system' | 'student' | null
}

const DEFAULT_ROUTE: RouteId = 'card'

/** ด่านทั้งหมดที่ทำให้ร้านโต = ภารกิจย่อย 4 + ด่านบอส CEO 1 */
export const SHOP_STAGES_TOTAL = missions.length + 1

/**
 * S-09 ภาพร้านโตตาม **จำนวนด่านที่ผ่านจริง** ไม่ใช่เปอร์เซ็นต์
 *
 * ของเดิมใช้ `stageFromPercent()` ซึ่งอ่านเปอร์เซ็นต์แล้วเทียบเกณฑ์ 25/60/100
 * ผลคือเด็กที่ผ่านภารกิจเพิ่มอีก 1 ข้อบางทีภาพไม่ขยับเลย เพราะเปอร์เซ็นต์ยังไม่ข้ามเกณฑ์
 *
 * **มติเจ้าของโปรเจกต์: ขั้นมี 5 ตามจำนวนด่าน ห้ามลดจำนวนด่านให้เข้ากับจำนวนภาพ**
 * ตอนนี้มีภาพจริงแค่ 4 ใบ (`public/shop/shop-stage-{1..4}.svg`) จึงแมปขั้นท้าย ๆ
 * ให้ใช้ภาพสุดท้ายไปก่อน และให้ **ข้อความบอกความคืบหน้าเป็นตัวบอกความจริง** ว่ากี่จาก 5
 *
 * | ด่านที่ผ่าน | ภาพที่ใช้ |
 * |---|---|
 * | 0 | 1 ที่ดินเปล่า |
 * | 1 | 2 ลงเสา |
 * | 2 | 3 ผนัง+หลังคา |
 * | 3, 4, 5 | 4 ร้านเปิดบริการ (ภาพซ้ำ รอภาพเพิ่ม) |
 *
 * ⚠️ ห้ามวาดภาพปลอมขึ้นมาเอง · รายการภาพที่ต้องขอเพิ่มอยู่ท้ายไฟล์ผล T55
 *    ภาพมาครบเมื่อไร แก้ที่ฟังก์ชันนี้ฟังก์ชันเดียว
 */
export function shopStageFromMissions(stagesCleared: number): 1 | 2 | 3 | 4 {
  const cleared = Number.isFinite(stagesCleared) ? Math.max(0, Math.floor(stagesCleared)) : 0
  return Math.min(cleared + 1, 4) as 1 | 2 | 3 | 4
}

function shopStageLabelOf(cleared: number): string {
  return `ร้านโตมาแล้ว ${cleared} จาก ${SHOP_STAGES_TOTAL} ด่าน`
}

export async function lessonSummary(studentId: string | null): Promise<LessonSummary> {
  if (!studentId) {
    return {
      missions: missions.map((m) => ({
        id: m.id,
        title: m.title,
        passed: false,
        stars: 0,
        attempts: 0,
        hintsUsed: 0,
        route: null,
        switches: 0,
      })),
      summary: { done: 0, total: missions.length, stars: 0, routesUsed: [], switchCount: 0 },
      missionStars: 0,
      bigMissionStars: 0,
      bigMissionMaxStars: BIG_MISSION_MAX_STARS,
      bigMissionPendingTeacher: false,
      bigMissionSubmitted: false,
      totalStars: 0,
      maxStars: selfProfile.starBudget.maxStars,
      percent: 0,
      stagesCleared: 0,
      stagesTotal: SHOP_STAGES_TOTAL,
      shopStage: 1,
      shopStageLabel: shopStageLabelOf(0),
      goalId: null,
      goalName: null,
      goalStars: null,
      outcome: null,
      route: null,
      routeChosenBy: null,
    }
  }

  const [rowsById, self, submissions, big] = await Promise.all([
    loadAllMissionRows(studentId),
    loadSelfProfileDb(studentId),
    listSubmissions(studentId),
    loadBigMissionStars(studentId),
  ])

  const rows: MissionRow[] = []
  for (const mission of missions) {
    const row = rowsById.get(mission.id)
    rows.push({
      id: mission.id,
      title: mission.title,
      passed: row?.passed ?? false,
      stars:
        row?.stars ??
        starsFor({
          passed: row?.passed ?? false,
          attempts: row?.attempts ?? 0,
          hintsUsed: row?.hintsUsed ?? 0,
        }),
      attempts: row?.attempts ?? 0,
      hintsUsed: row?.hintsUsed ?? 0,
      route: (row?.channelUsed as RouteId | null) ?? null,
      switches: await countRouteSwitches(studentId, mission.id),
    })
  }

  const records: MissionRecord[] = rows.map((r) => ({
    missionId: r.id,
    passed: r.passed,
    stars: r.stars,
    route: r.route ?? (self.route as RouteId | null) ?? DEFAULT_ROUTE,
    routeSwitches: r.switches,
  }))

  const summary = progressSummary(records)
  /**
   * **ดาวสะสม = ภารกิจย่อย (mission_progress) + ภารกิจใหญ่ (คะแนนที่ครูยืนยัน/กฎเสนอ)**
   * สูตรเดียวกับ RPC `recalc_student_stars` ที่เขียนลง `profiles.earned_stars` รวมเพดาน 15
   * ทุกหน้าของนักเรียนอ่านผ่านฟังก์ชันนี้ที่เดียว ห้ามให้หน้าไหนบวกเอง (QA-2 ยังพัง-2)
   *
   * ⚠️ **ที่นี่คือเส้นทางอ่าน ห้ามเขียนอะไรทั้งสิ้น** (REVIEW-8 H-2)
   * ของเดิมเรียก `syncEarnedStars()` ตรงนี้เมื่อเลขไม่ตรง ซึ่งเป็นการเขียน mission_progress
   * โดยไม่มีธง `app.teacher_write` → หลังเลยวันหมดเขตทำต่อที่บ้าน เด็กเปิด /home หรือ /result
   * ย้อนดูงานตัวเองแล้วพัง 500 **ทุกครั้งที่เปิด** ขัดกับข้อความของ trigger เองที่บอกว่าย้อนดูได้
   *
   * ⚠️ และห้ามกลับไปแสดง `profiles.earned_stars` ดิบ ๆ (REVIEW-8 M-1)
   * คอลัมน์นั้นตามหลังหนึ่งรอบเสมอเมื่อครูเพิ่งยืนยันคะแนน ทำให้หน้าเดียวกันโชว์
   * "ดาวสะสม" ของเก่าคู่กับ "ดาวภารกิจใหญ่" ของใหม่ บวกกันไม่ลง เด็กถามครูแล้วครูตอบไม่ถูก
   * คอลัมน์นั้นให้เส้นทาง **เขียน** เป็นคนดูแล (ยืนยันคะแนน · ตอบภารกิจ · ส่งด่านบอส · สั่งข้าม)
   */
  const computedStars = Math.min(summary.stars + big.stars, selfProfile.starBudget.maxStars)
  const totalStars = computedStars
  const goal = self.goalId ? findGoal(self.goalId) : undefined
  const bigSubmitted = submissions.length > 0
  // S-09 นับหัวก่อน แล้วค่อยแปลงเป็นเปอร์เซ็นต์ — ไม่ใช่เอาเปอร์เซ็นต์ไปตัดสินขั้นของร้าน
  const stagesCleared = summary.done + (bigSubmitted ? 1 : 0)
  const percent = Math.round((stagesCleared / SHOP_STAGES_TOTAL) * 100)

  return {
    missions: rows,
    summary,
    missionStars: summary.stars,
    bigMissionStars: big.stars,
    bigMissionMaxStars: BIG_MISSION_MAX_STARS,
    bigMissionPendingTeacher: big.pendingTeacher,
    bigMissionSubmitted: bigSubmitted,
    totalStars,
    maxStars: selfProfile.starBudget.maxStars,
    percent,
    stagesCleared,
    stagesTotal: SHOP_STAGES_TOTAL,
    shopStage: shopStageFromMissions(stagesCleared),
    shopStageLabel: shopStageLabelOf(stagesCleared),
    goalId: self.goalId,
    goalName: goal?.name ?? null,
    goalStars: self.goalStars,
    // เทียบเป้าด้วยดาวรวม (ภารกิจย่อย + ภารกิจใหญ่) ไม่งั้นเป้า 10/14 ไม่มีทางถึงในคาบ
    outcome: self.goalId ? goalOutcome(totalStars, self.goalId) : null,
    route: (self.route as RouteId | null) ?? null,
    routeChosenBy: self.routeChosenBy,
  }
}

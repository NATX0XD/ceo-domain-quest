/**
 * สรุปผลการเรียน — ใช้ 3 ที่: หน้าสรุปผลของนักเรียน · ใบประกาศ PDF · ตัวเลขขึ้นสไลด์ตอนนำเสนอ
 *
 * ตรรกะล้วน ไม่ import React / Next / ฐานข้อมูล / fetch
 * ข้อมูลรับเข้ามาเป็นพารามิเตอร์ทั้งหมด และเวลาปัจจุบันรับเป็นพารามิเตอร์ ไม่เรียก Date.now()
 *
 * หลักที่ยึด 3 ข้อ:
 * 1. ใบประกาศให้ทุกคนที่เข้าร่วม ไม่ใช่ให้เฉพาะคนผ่าน — ระดับความสำเร็จบอกด้วยดาว ไม่ใช่ตัดสิทธิ์
 * 2. ตัวเลขต้องจริง gain ติดลบก็รายงานติดลบ ข้อมูลจริงมีค่ากว่าตัวเลขสวย
 * 3. ข้อความถึงผู้เรียนต้องอ้างสิ่งที่เขาทำได้จริง ห้ามตำหนิ ห้ามเทียบกับเพื่อน
 *
 * ⚠️ เป็นโมดูลฝั่งเซิร์ฟเวอร์เหมือน core/personalize.ts (นำเกณฑ์เป้าหมายมาใช้ซ้ำจากที่นั่น
 * ซึ่งต่อสายไปถึง core/quiz.ts ที่โหลดไฟล์เฉลย) การสรุปผลทั้งหมดทำฝั่งเซิร์ฟเวอร์อยู่แล้ว
 */
import selfProfileJson from '../content/self-profile.json' with { type: 'json' }
import {
  type ChosenBy,
  type CoachCause,
  type GoalOutcome,
  type RouteId,
  ROUTE_IDS,
  calibrationFlag,
  goalOutcome as compareGoal,
  goalStarTarget,
} from './personalize'
import { miniLessonForObjective, misconceptionsForObjective } from './content-library'
import { describeNextGoal, type NextGoalChoice } from './next-goal'
import { REQUIRED_REFLECTION_COUNT, TOTAL_REFLECTION_COUNT } from './reflection'
import { shopLabel } from './shop-name'
import {
  calibrationSummary,
  compareThreeSources,
  type CalibrationRecordInput,
  type CalibrationSummary,
  type ThreeSourceTable,
} from './self-assess'
import { quizMaxScore } from './quiz'
import {
  type Agreement,
  type NormalizedGain,
  type PairedTTest,
  type EffectSize,
  agreementRate,
  classNormalizedGain,
  descriptive,
  effectSize,
  pairedTTest,
  type Descriptive,
} from './statistics'

/**
 * วัตถุประสงค์ด้านเนื้อหา 4 ข้อที่มีภารกิจย่อยของตัวเอง
 * ใช้กับ classSummary / objectiveGaps ซึ่งนับการผ่านจาก "ภารกิจที่ผ่าน" เท่านั้น
 */
export const OBJECTIVE_IDS = ['obj-1', 'obj-2', 'obj-3', 'obj-4'] as const
export type ObjectiveId = (typeof OBJECTIVE_IDS)[number]

/**
 * วัตถุประสงค์ครบทั้ง 6 ข้อตามสเปกข้อ 1.6 — อ่านจาก content/self-profile.json ไม่ฝังในโค้ด
 * obj-5 วัดจากรูบริกด่านบอสที่ครูยืนยัน · obj-6 วัดจากการกำกับตนเอง ไม่ใช่จากภารกิจย่อย
 */
const objectivesFromContent = selfProfileJson.objectives as ReadonlyArray<{
  id: string
  shortName: string
  fullName: string
  measuredBy?: string
}>

/** ชื่อสั้นของแต่ละจุดประสงค์ ใช้ตอนรายงานธงการรู้ตัวให้ครูอ่านรู้เรื่อง ไม่ใช่โชว์รหัส */
export const OBJECTIVE_SHORT_NAMES: Record<string, string> = Object.fromEntries(
  objectivesFromContent.map((o) => [o.id, o.shortName]),
)

/**
 * จำนวนคำถามสะท้อนคิดที่ต้องตอบครบจึงจะผ่าน obj-6 — อ่านจากกติกาการส่งใน content/reflection.json
 *
 * เดิมนับ "ทุกข้อในไฟล์" (3 ข้อ) แต่แผนการสอนให้ตอบ 2 ข้อในคาบ ข้อที่เหลือเป็นของแถมทำที่บ้าน
 * ถ้ายังนับ 3 อยู่ รายงานจะบอกว่าไม่มีใครผ่าน obj-6 ทั้งห้อง ทั้งที่ทุกคนทำตามแผนครบแล้ว
 * เกณฑ์นี้จึงต้องเป็นเกณฑ์เดียวกับที่ใช้ตอนกดส่ง ไม่ใช่คนละเกณฑ์
 */
export const REFLECTION_QUESTION_COUNT: number = REQUIRED_REFLECTION_COUNT

export interface ReflectionProgress {
  /** ตอบไปแล้วกี่ข้อ */
  answered: number
  /** ต้องตอบกี่ข้อจึงผ่านจุดประสงค์ข้อ 6 (เกณฑ์เดียวกับตอนกดส่ง) */
  required: number
  /** มีทั้งหมดกี่ข้อในคลัง รวมข้อของแถมที่ทำหรือไม่ทำก็ได้ */
  total: number
  met: boolean
  /** ประโยคพร้อมขึ้นจอครู ไม่ต้องแต่งต่อ */
  text: string
}

/** ดาวเต็มต่อภารกิจ ตรงกับ starsFor ใน core/personalize.ts */
export const STARS_PER_MISSION = 3

/** เกณฑ์ที่ถือว่าทั้งห้อง "ยังไม่ผ่าน" วัตถุประสงค์ข้อนั้น ต้องหยิบมาทบทวนท้ายคาบ */
export const OBJECTIVE_GAP_THRESHOLD = 0.6

export interface MissionInput {
  missionId: string
  /** วัตถุประสงค์ที่ภารกิจนี้วัด */
  objectiveId: string
  title?: string
  passed: boolean
  stars: number
  /** ช่องทางที่ผู้เรียนใช้จริงในภารกิจนี้ */
  route: RouteId
  /** จำนวนครั้งที่สลับช่องทางระหว่างอยู่ในภารกิจนี้ */
  routeSwitches?: number
  /**
   * ภารกิจนี้ถูกข้ามหรือไม่ และใครสั่ง — null คือเล่นเอง
   * **ต้องแยกให้ชัดในรายงาน** ข้ามเองโดยผ่านเงื่อนไขได้ดาวเต็ม ส่วนครูสั่งข้ามได้ 0 ดาว
   * ถ้าปนกัน ตัวเลขดาวเฉลี่ยของห้องจะอธิบายไม่ได้ว่ามาจากอะไร
   */
  skippedBy?: 'student' | 'teacher' | null
  /** ผลการตัดสินการข้าม earned = ข้ามเองผ่านเงื่อนไข · teacher = ครูสั่ง · rejected = ถูกปฏิเสธ */
  skipOutcome?: 'earned' | 'teacher' | 'rejected'
}

export interface MissionReportRow {
  missionId: string
  objectiveId: string
  title: string
  passed: boolean
  stars: number
  route: RouteId
  /** null = เล่นเอง · 'student' = ข้ามเองผ่านเงื่อนไข · 'teacher' = ครูสั่งให้ข้าม */
  skippedBy: 'student' | 'teacher' | null
  skipOutcome: 'earned' | 'teacher' | 'rejected' | null
}

/**
 * คะแนนรายด้านของภารกิจใหญ่ที่ติดมากับรายงาน
 * ชนิดข้อมูลนิยามไว้ที่นี่เพื่อไม่ให้ core ต้อง import lib/ai (ชั้นนอกกว่า)
 * รูปร่างตรงกับ RubricDimensionScore ใน lib/ai/types.ts และอ่านนิยามด้านจาก content/rubric.json ที่เดียวกัน
 */
export interface ReportDimensionScore {
  id: string
  name: string
  score: number
  levelLabel?: string
  evidence?: string
  suggestion?: string
  emphasized?: boolean
}

export interface RubricBreakdown {
  /** ผลชุดนี้มาจากไหน — 'rules' คือกฎล้วนที่นักเรียนเห็นทันที · 'ai' คือข้อเสนอที่ตรวจทีหลัง */
  gradedBy?: 'rules' | 'ai'
  dimensions: ReportDimensionScore[]
  /** ด้านที่ผู้เรียนขอให้ถ่วง 2 เท่า null = ยังไม่ได้เลือก */
  emphasisDimensionId: string | null
  /** คะแนนถ่วงน้ำหนักตามสูตรในไฟล์เนื้อหา */
  weightedTotal: number
  weightedMax: number
  stars: number
  /** คะแนนทุกก้อนต้องผ่านการยืนยันของครูก่อนบันทึก ไม่ว่ามาจาก AI หรือกฎล้วน */
  needsTeacherConfirm: true
}

export interface StudentReportInput {
  studentId: string
  nickname: string
  shopName: string
  /** ชื่อโดเมนที่ตั้งไว้ ยังไม่มีนามสกุล เช่น kanomwan */
  domainName: string
  /** นามสกุลที่ยื่นผ่าน เช่น .co.th ถ้ายังไม่ผ่านสักช่องให้ส่งค่าว่าง */
  tldSuffix?: string
  /** เป้าหมายที่ผู้เรียนตั้งเอง ใส่เป็นรหัสเป้า (goal-good) หรือจำนวนดาวก็ได้ */
  goal: string | number
  missions: MissionInput[]
  preScore: number
  postScore: number
  /** ช่องทางที่ระบบเสนอตอนต้นคาบ */
  routeSuggested?: RouteId | null
  /** ช่องทางที่ผู้เรียนเลือกจริง ถ้าไม่ส่งมาจะใช้ช่องทางของภารกิจแรก */
  routeChosen?: RouteId | null
  /** ใครเป็นคนเลือกช่องทางที่ใช้จริง */
  routeChosenBy?: ChosenBy
  /** จำนวนครั้งที่ผู้เรียนกดยกเป้าหมายให้สูงขึ้นเอง */
  goalRaisedCount?: number
  /** เวลาเริ่ม (epoch ms) ใช้คำนวณเวลาที่ใช้ */
  startedAt?: number
  /** เวลาที่ส่งงานเสร็จ (epoch ms) ถ้ายังไม่เสร็จให้ใช้ now แทน */
  finishedAt?: number
  /** ดาวเต็มของทั้งคาบ ถ้าไม่ส่งมาคิดจากจำนวนภารกิจ × 3 */
  starsMax?: number
  /** กำลังติดอยู่ที่ไหนตอนนี้ ใช้ทำแผงครู */
  stuck?: { objectiveId: string; cause: CoachCause } | null
  /** คะแนนรายด้านของภารกิจใหญ่ ถ้ายังไม่ได้ส่งงานหรือยังไม่ตรวจ ให้เว้นไว้ */
  rubric?: RubricBreakdown | null
  /**
   * ข้อเสนอจาก AI ที่ตรวจเบื้องหลังทีหลัง — **ไม่ใช่คะแนนที่นักเรียนเห็น**
   * ครูดูคู่กับ rubric แล้วเป็นคนตัดสินว่าจะใช้ชุดไหน ระบบไม่เปลี่ยนดาวให้เอง
   */
  rubricAiSuggestion?: RubricBreakdown | null
  /** ครูกดยืนยันคะแนนด่านบอสแล้วหรือยัง — ใช้ตัดสินการผ่านจุดประสงค์ข้อ 5 */
  rubricConfirmedByTeacher?: boolean
  /** หลักฐานการกำกับตนเอง ใช้ตัดสินการผ่านจุดประสงค์ข้อ 6 */
  selfRegulation?: SelfRegulationInput
  /**
   * ความมั่นใจที่ผู้เรียนบอกไว้คู่กับผลจริง รายจุดประสงค์ (S-33)
   * ใช้ทำธง "มั่นใจสูงแต่ยังไม่ถูก ควรคุย" / "มั่นใจต่ำแต่ถูก ควรชม" ให้ครูเห็นในรายงานรายคน
   * ⚠️ ธงนี้ของครู ไม่ใช่ของผู้เรียน และไม่มีผลต่อคะแนนหรือดาวใด ๆ
   */
  calibration?: readonly CalibrationRecordInput[]
  /** คะแนนที่ผู้เรียนให้ตัวเองรายด้าน (S-26) รหัสด้านตรงกับรูบริก */
  selfRubricScores?: Record<string, number> | null
  /**
   * เป้าหมายที่ผู้เรียนตั้งไว้สำหรับคาบหน้า (S-32)
   * ครูใช้เตรียมคาบถัดไป **ไม่มีผลต่อดาวหรือการผ่านจุดประสงค์ของคาบนี้**
   */
  nextGoal?: NextGoalChoice | null
  /** คะแนนเต็มของแบบทดสอบ ถ้าไม่ส่งมาใช้จำนวนข้อใน content/quiz.json */
  quizMax?: number
}

/** หลักฐานของจุดประสงค์ข้อ 6 (ด้านเจตคติและการกำกับตนเอง) ตามสเปกข้อ 1.6 */
export interface SelfRegulationInput {
  /** ตั้งเป้าหมายของตัวเองไว้แล้ว */
  goalSet?: boolean
  /** ให้คะแนนตัวเองในรูบริกครบแล้ว */
  selfAssessed?: boolean
  /** ตอบคำถามสะท้อนคิดไปกี่ข้อ ต้องครบตาม REFLECTION_QUESTION_COUNT จึงผ่าน */
  reflectionAnswered?: number
}

export interface StudentReport {
  studentId: string
  nickname: string
  shopName: string
  /** ชื่อโดเมนเต็มพร้อมนามสกุล เช่น kanomwan.co.th */
  domainFull: string
  starsTotal: number
  starsMax: number
  /** จำนวนดาวที่ตั้งเป้าไว้ */
  goalLevel: number
  goalOutcome: GoalOutcome
  missions: MissionReportRow[]
  preScore: number
  postScore: number
  /** ผลต่างหลังเรียนลบก่อนเรียน ติดลบได้ ไม่ปัดเป็นศูนย์ */
  gain: number
  routesUsed: RouteId[]
  switchCount: number
  timeSpentSec: number
  routeSuggested: RouteId | null
  routeChosen: RouteId | null
  goalRaisedCount: number
  stuck: { objectiveId: string; cause: CoachCause } | null
  /** คะแนนรายด้านที่นักเรียนเห็นแล้ว (มาจากกฎล้วน ได้ทันทีตอนกดส่ง) */
  rubric: RubricBreakdown | null
  /** ข้อเสนอจาก AI ที่ตรวจทีหลัง ครูเป็นคนตัดสินว่าจะใช้หรือไม่ ไม่เคยทับดาวของนักเรียนเอง */
  rubricAiSuggestion: RubricBreakdown | null
  /** ดาวที่ AI เสนอต่างจากดาวที่นักเรียนเห็นหรือไม่ ใช้ขึ้นป้ายเตือนครูให้มาดู */
  rubricDiffers: boolean
  /** คะแนนเต็มของแบบทดสอบที่ใช้จริง ใช้คิดร้อยละและคะแนนพัฒนาการ */
  quizMax: number
  /** ร้อยละคะแนนก่อนเรียน */
  prePercent: number
  /** ร้อยละคะแนนหลังเรียน */
  postPercent: number
  rubricConfirmedByTeacher: boolean
  selfRegulation: Required<SelfRegulationInput>
  /**
   * ธงการรู้ตัวรวมของคนนี้ (S-33) — **สำหรับครูอ่านเท่านั้น**
   * ไม่มีธงเลยก็ยังมีก้อนนี้อยู่ แต่ entries ว่างและ teacherSummary เป็นค่าว่าง
   */
  selfAwareness: CalibrationSummary
  /**
   * ตารางคะแนน 3 แหล่ง (ฉันให้ตัวเอง / ระบบเสนอ / ครูยืนยัน) — หลักฐานตรงตัวของจุดประสงค์ข้อ 6
   * null เมื่อยังไม่มีคะแนนรูบริกของด่านบอสเลย จึงยังไม่มีอะไรให้เทียบ
   */
  selfVsSystemVsTeacher: ThreeSourceTable | null
  /** เป้าคาบหน้าที่ผู้เรียนตั้งเอง null = ยังไม่ได้ตั้ง */
  nextGoal: NextGoalChoice | null
  /** ประโยคเดียวสำหรับแผงครู อ่านรู้เรื่องแม้ยังไม่ได้ตั้งเป้า */
  nextGoalSummary: string
  /**
   * ความคืบหน้าการสะท้อนคิด — บอกทั้งเกณฑ์ที่ต้องถึงและจำนวนข้อทั้งหมดที่มี
   * ครูจะได้ไม่เข้าใจว่า "ตอบ 2 จาก 3" คือยังไม่ครบ ทั้งที่ข้อที่ 3 เป็นของแถม
   */
  reflectionProgress: ReflectionProgress
}

function toFinite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * สรุปผลรายคน ใช้ทั้งหน้าสรุปของนักเรียนและเป็นวัตถุดิบของใบประกาศ
 *
 * @param now เวลาปัจจุบัน (epoch ms) ใช้เมื่อยังไม่มี finishedAt — รับเข้ามา ไม่เรียก Date.now()
 */
export function studentReport(input: StudentReportInput, now: number | null = null): StudentReport {
  const missions = Array.isArray(input?.missions) ? input.missions : []

  const rows: MissionReportRow[] = missions.map((m) => ({
    missionId: m.missionId,
    objectiveId: m.objectiveId,
    title: m.title ?? m.missionId,
    passed: Boolean(m.passed),
    stars: toFinite(m.stars),
    route: m.route,
    skippedBy: m.skippedBy ?? null,
    skipOutcome: m.skipOutcome ?? null,
  }))

  const starsTotal = rows.reduce((sum, m) => sum + m.stars, 0)
  const starsMax = toFinite(input?.starsMax, missions.length * STARS_PER_MISSION)

  const routesUsed: RouteId[] = []
  let switchCount = 0
  let previousRoute: RouteId | null = null
  for (const m of missions) {
    if (m.route && !routesUsed.includes(m.route)) routesUsed.push(m.route)
    if (previousRoute !== null && m.route && m.route !== previousRoute) switchCount += 1
    if (m.route) previousRoute = m.route
    switchCount += toFinite(m.routeSwitches)
  }

  const goalLevel = goalStarTarget(input?.goal ?? 0) ?? 0
  const preScore = toFinite(input?.preScore)
  const postScore = toFinite(input?.postScore)
  // คะแนนเต็มของแบบทดสอบมาจากจำนวนข้อในไฟล์เนื้อหา ไม่ตรึงเลขไว้ในโค้ด
  const quizMax = toFinite(input?.quizMax, quizMaxScore('post'))

  const startedAt = toFinite(input?.startedAt, Number.NaN)
  const endedAt = toFinite(input?.finishedAt, toFinite(now, Number.NaN))
  const timeSpentSec =
    Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt > startedAt
      ? Math.round((endedAt - startedAt) / 1000)
      : 0

  const domainName = (input?.domainName ?? '').trim()
  const suffix = (input?.tldSuffix ?? '').trim()

  return {
    studentId: input?.studentId ?? '',
    nickname: input?.nickname ?? '',
    shopName: input?.shopName ?? '',
    domainFull: domainName ? `${domainName}${suffix}` : '',
    starsTotal,
    starsMax,
    goalLevel,
    goalOutcome: compareGoal(starsTotal, goalLevel),
    missions: rows,
    preScore,
    postScore,
    // ติดลบได้ ไม่ปัดเป็นศูนย์ — ถ้าคะแนนตกต้องเห็น จะได้รู้ว่าต้องกลับไปดูอะไร
    gain: postScore - preScore,
    routesUsed,
    switchCount,
    timeSpentSec,
    routeSuggested: input?.routeSuggested ?? null,
    routeChosen: input?.routeChosen ?? routesUsed[0] ?? null,
    goalRaisedCount: toFinite(input?.goalRaisedCount),
    stuck: input?.stuck ?? null,
    rubric: input?.rubric ? { gradedBy: 'rules', ...input.rubric } : null,
    rubricAiSuggestion: input?.rubricAiSuggestion
      ? { gradedBy: 'ai', ...input.rubricAiSuggestion }
      : null,
    rubricDiffers:
      Boolean(input?.rubric && input?.rubricAiSuggestion) &&
      input!.rubric!.stars !== input!.rubricAiSuggestion!.stars,
    quizMax,
    prePercent: quizMax > 0 ? round2((preScore / quizMax) * 100) : 0,
    postPercent: quizMax > 0 ? round2((postScore / quizMax) * 100) : 0,
    rubricConfirmedByTeacher: Boolean(input?.rubricConfirmedByTeacher),
    selfRegulation: {
      goalSet: Boolean(input?.selfRegulation?.goalSet),
      selfAssessed: Boolean(input?.selfRegulation?.selfAssessed),
      reflectionAnswered: toFinite(input?.selfRegulation?.reflectionAnswered),
    },
    selfAwareness: calibrationSummary(input?.calibration ?? [], calibrationFlag),
    selfVsSystemVsTeacher: buildThreeSourceTable(input),
    nextGoal: input?.nextGoal ?? null,
    nextGoalSummary: describeNextGoal(input?.nextGoal ?? null),
    reflectionProgress: reflectionProgressOf(toFinite(input?.selfRegulation?.reflectionAnswered)),
  }
}

/** ตอบสะท้อนคิดไปกี่ข้อจากกี่ข้อ — เกณฑ์ผ่านกับจำนวนข้อทั้งหมดเป็นคนละเลข */
function reflectionProgressOf(answered: number): ReflectionProgress {
  const met = answered >= REFLECTION_QUESTION_COUNT
  const extra = TOTAL_REFLECTION_COUNT - REFLECTION_QUESTION_COUNT
  return {
    answered,
    required: REFLECTION_QUESTION_COUNT,
    total: TOTAL_REFLECTION_COUNT,
    met,
    text: met
      ? `ตอบสะท้อนคิดแล้ว ${answered} ข้อ ครบตามเกณฑ์ ${REFLECTION_QUESTION_COUNT} ข้อ`
      : `ตอบสะท้อนคิดแล้ว ${answered} จาก ${REFLECTION_QUESTION_COUNT} ข้อที่ต้องตอบ` +
        (extra > 0 ? ` (ในคลังมี ${TOTAL_REFLECTION_COUNT} ข้อ อีก ${extra} ข้อเป็นของแถม)` : ''),
  }
}

/** ตารางเทียบ 3 แหล่งของรายงานรายคน — คิดจากคะแนนที่มีจริง ไม่เดาค่าที่ยังไม่มี */
function buildThreeSourceTable(input: StudentReportInput | null | undefined): ThreeSourceTable | null {
  const self = input?.selfRubricScores ?? null
  const systemRubric = input?.rubricAiSuggestion ?? input?.rubric ?? null
  const teacherRubric = input?.rubric ?? null
  if (!self && !systemRubric) return null

  const toBag = (rubric: RubricBreakdown | null): Record<string, number> | null =>
    rubric
      ? Object.fromEntries(rubric.dimensions.map((d) => [d.id, toFinite(d.score)]))
      : null

  return compareThreeSources({
    self,
    system: toBag(systemRubric),
    teacher: toBag(teacherRubric),
    teacherConfirmed: Boolean(input?.rubricConfirmedByTeacher),
  })
}

/** ระดับความสำเร็จบนใบประกาศ — บอกด้วยดาว ไม่ใช่ตัดสิทธิ์ใครออกจากใบประกาศ */
export type CertificateLevel = 'เข้าร่วม' | 'ผ่าน' | 'ทำได้ดี' | 'ยอดเยี่ยม'

export interface CertificateData {
  /** ทุกคนที่เข้าร่วมได้ใบประกาศ ค่านี้เป็น true เสมอโดยตั้งใจ */
  eligible: true
  nickname: string
  shopName: string
  domainFull: string
  starsTotal: number
  starsMax: number
  level: CertificateLevel
  /** บรรทัดข้อความบนใบประกาศ เรียงตามลำดับที่จะพิมพ์ */
  lines: string[]
  /** วันที่ออกใบประกาศ (epoch ms) รับเข้ามา ไม่คำนวณเอง */
  issuedAt: number | null
}

function certificateLevel(starsTotal: number, starsMax: number): CertificateLevel {
  if (starsMax <= 0 || starsTotal <= 0) return 'เข้าร่วม'
  const ratio = starsTotal / starsMax
  if (ratio >= 0.9) return 'ยอดเยี่ยม'
  if (ratio >= 0.6) return 'ทำได้ดี'
  return 'ผ่าน'
}

/**
 * ข้อมูลล้วนสำหรับใบประกาศ ไม่มี logic การวาดหรือจัดหน้า
 * ใบประกาศออกให้ทุกคนที่เข้าร่วม แม้ได้ 0 ดาว — ตัดสินไว้แล้วตั้งแต่ต้นโปรเจกต์
 * เหตุผล: ใบประกาศคือหลักฐานการเข้าร่วม ไม่ใช่รางวัลของคนเก่ง
 */
export function certificateData(report: StudentReport, issuedAt: number | null = null): CertificateData {
  const starsTotal = toFinite(report?.starsTotal)
  const starsMax = toFinite(report?.starsMax)
  const level = certificateLevel(starsTotal, starsMax)
  const nickname = report?.nickname ?? ''

  const lines = [
    'เกียรติบัตรผู้เข้าร่วมภารกิจ',
    `ขอมอบให้ ${nickname}`,
    `ในฐานะ CEO ${shopLabel(report?.shopName)}`,
    report?.domainFull
      ? `เจ้าของชื่อเว็บ ${report.domainFull}`
      : 'ผู้ร่วมเดินทางในภารกิจตั้งชื่อเว็บของร้านตัวเอง',
    `ระดับ ${level} · เก็บดาวได้ ${starsTotal} จาก ${starsMax} ดวง`,
    'วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล',
  ]

  return {
    eligible: true,
    nickname,
    shopName: report?.shopName ?? '',
    domainFull: report?.domainFull ?? '',
    starsTotal,
    starsMax,
    level,
    lines,
    issuedAt,
  }
}

/**
 * ข้อความสรุปให้กำลังใจ อ้างสิ่งที่ผู้เรียนทำได้จริงเท่านั้น
 * ห้ามมีคำตำหนิ และห้ามเทียบกับเพื่อนหรือกับค่าเฉลี่ยของห้อง
 * ถ้าคะแนนหลังเรียนไม่ขึ้น ให้พูดถึงสิ่งที่ลงมือทำจริงแทน ไม่พูดถึงคะแนนที่ตก
 */
export function encouragement(report: StudentReport): string {
  const parts: string[] = []
  const nickname = report?.nickname || 'หนู'
  const missions = report?.missions ?? []
  const passedCount = missions.filter((m) => m.passed).length

  parts.push(
    passedCount > 0
      ? `${nickname} ทำภารกิจสำเร็จ ${passedCount} จาก ${missions.length} ภารกิจ เก็บดาวได้ ${toFinite(report?.starsTotal)} ดวง`
      : `${nickname} ลงมือทำครบทุกขั้นของภารกิจวันนี้ และได้ชื่อเว็บของร้านตัวเองออกมาแล้ว`,
  )

  if (report?.domainFull) {
    parts.push(`ชื่อเว็บ ${report.domainFull} เป็นของ ${nickname} คนเดียวในห้องนี้`)
  }

  if (toFinite(report?.switchCount) > 0) {
    parts.push(
      `ระหว่างทาง ${nickname} เปลี่ยนวิธีเรียนด้วยตัวเอง ${report.switchCount} ครั้ง แปลว่ารู้แล้วว่าแบบไหนเข้ากับตัวเอง`,
    )
  }

  if (toFinite(report?.goalRaisedCount) > 0) {
    parts.push(`และยกเป้าหมายของตัวเองให้สูงขึ้นเอง ${report.goalRaisedCount} ครั้ง`)
  }

  const gain = toFinite(report?.gain)
  if (gain > 0) {
    parts.push(`คะแนนหลังเรียนขึ้นจากก่อนเรียน ${gain} ข้อ`)
  } else {
    parts.push('เรื่องที่ยังไม่ชัดวันนี้ เก็บไว้ลองใหม่คาบหน้าได้ ความรู้ไม่ได้หายไปไหน')
  }

  if (report?.goalOutcome === 'exceeded') {
    parts.push('ทำได้เกินเป้าที่ตั้งไว้เองด้วย')
  } else if (report?.goalOutcome === 'met') {
    parts.push('ถึงเป้าที่ตั้งไว้เองพอดี')
  }

  return parts.join(' ')
}

export interface StuckStudent {
  studentId: string
  nickname: string
  objectiveId: string
  cause: CoachCause
}

export interface ClassSummary {
  headcount: number
  avgStars: number
  avgGain: number
  /** จำนวนคนที่ผ่านแต่ละวัตถุประสงค์ ครูใช้ตัดสินว่าจะทบทวนเรื่องไหนท้ายคาบ */
  passedByObjective: Record<string, number>
  /** คนที่กำลังติดอยู่ตอนนี้ ใช้ขึ้นแผงครู */
  stuckNow: StuckStudent[]
}

/** ปัดทศนิยม 2 ตำแหน่ง กันเลขยาวเหยียดบนสไลด์ */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * สรุปทั้งห้อง — ครูดูระหว่างคาบและใช้ขึ้นสไลด์
 * ห้องว่างคืนค่าศูนย์ทั้งหมด ไม่พังและไม่หารด้วยศูนย์
 */
export function classSummary(reports: StudentReport[]): ClassSummary {
  const list = Array.isArray(reports) ? reports : []
  const headcount = list.length

  const passedByObjective: Record<string, number> = {}
  for (const id of OBJECTIVE_IDS) passedByObjective[id] = 0

  let totalStars = 0
  let totalGain = 0
  const stuckNow: StuckStudent[] = []

  for (const report of list) {
    totalStars += toFinite(report?.starsTotal)
    totalGain += toFinite(report?.gain)

    // คนเดียวกันทำภารกิจเดียวกันซ้ำหลายรอบ ต้องนับวัตถุประสงค์ละ 1 คนเท่านั้น
    const passedObjectives = new Set(
      (report?.missions ?? []).filter((m) => m.passed).map((m) => m.objectiveId),
    )
    for (const objectiveId of passedObjectives) {
      passedByObjective[objectiveId] = (passedByObjective[objectiveId] ?? 0) + 1
    }

    if (report?.stuck) {
      stuckNow.push({
        studentId: report.studentId,
        nickname: report.nickname,
        objectiveId: report.stuck.objectiveId,
        cause: report.stuck.cause,
      })
    }
  }

  return {
    headcount,
    avgStars: headcount > 0 ? round2(totalStars / headcount) : 0,
    avgGain: headcount > 0 ? round2(totalGain / headcount) : 0,
    passedByObjective,
    stuckNow,
  }
}

export interface ObjectiveGap {
  objectiveId: string
  passedCount: number
  headcount: number
  /** สัดส่วนคนที่ผ่าน 0-1 */
  passRate: number
  advice: string
  /**
   * บทสอนเสริม 3 นาทีของเรื่องนี้ (สเปกหัวข้อ 11.12) — ครูหยิบไปสอนซ่อมท้ายคาบได้ทันที
   * null เมื่อเรื่องนี้ยังไม่มีบทสอนเสริมในไฟล์เนื้อหา
   */
  miniLesson: { id: string; minutes: string[] } | null
  /**
   * คำถามชวนคิดตามความเข้าใจผิดที่เจอบ่อยของเรื่องนี้ (สเปกหัวข้อ 11.12)
   * **เป็นคำถามล้วน ไม่มีเฉลย** ตามกติกาในไฟล์เนื้อหา ครูเอาไปถามเองในห้อง
   */
  coachQuestions: Array<{ misconception: string; question: string }>
}

const OBJECTIVE_TOPICS: Record<string, string> = {
  'obj-1': 'ความหมายและประโยชน์ของชื่อโดเมน',
  'obj-2': 'ส่วนประกอบของชื่อเว็บ',
  'obj-3': 'ประเภทของนามสกุลโดเมน',
  'obj-4': 'เงื่อนไขและขั้นตอนการจดทะเบียน',
}

/**
 * วัตถุประสงค์ที่คนผ่านน้อยกว่าเกณฑ์ เรียงจากแย่สุดไปดีสุด
 * ครูเอารายการนี้ไปใช้ตอนสรุปท้ายคาบได้ตรง ๆ ว่าควรทบทวนเรื่องอะไรก่อน
 * ห้องว่างคืนรายการว่าง ไม่ใช่ทุกข้อเป็นช่องว่าง เพราะยังไม่มีข้อมูลให้สรุป
 */
export function objectiveGaps(summary: ClassSummary): ObjectiveGap[] {
  const headcount = toFinite(summary?.headcount)
  if (headcount <= 0) return []

  const gaps: ObjectiveGap[] = []
  for (const objectiveId of Object.keys(summary?.passedByObjective ?? {})) {
    const passedCount = toFinite(summary.passedByObjective[objectiveId])
    const passRate = passedCount / headcount
    if (passRate >= OBJECTIVE_GAP_THRESHOLD) continue
    const topic = OBJECTIVE_TOPICS[objectiveId] ?? objectiveId
    gaps.push({
      objectiveId,
      passedCount,
      headcount,
      passRate: round2(passRate),
      advice: `ผ่านแค่ ${passedCount} จาก ${headcount} คน ควรทบทวนเรื่อง${topic}ตอนสรุปท้ายคาบ`,
      miniLesson: lessonOf(objectiveId),
      coachQuestions: misconceptionsForObjective(objectiveId).map((m) => ({
        misconception: m.misconception,
        question: m.coachQuestion,
      })),
    })
  }

  // แย่สุดขึ้นก่อน ถ้าเท่ากันเรียงตามรหัสวัตถุประสงค์ เพื่อให้ผลคงที่ทุกครั้ง
  return gaps.sort((a, b) => a.passRate - b.passRate || a.objectiveId.localeCompare(b.objectiveId))
}

/** บทสอนเสริมของจุดประสงค์นั้น คืน null เมื่อไฟล์เนื้อหายังไม่มีให้ */
function lessonOf(objectiveId: string): { id: string; minutes: string[] } | null {
  const lesson = miniLessonForObjective(objectiveId)
  return lesson ? { id: lesson.id, minutes: [...lesson.minutes] } : null
}

/* ------------------------------------------------------------------ *
 * สถิติรายห้องและผลรายจุดประสงค์ — วัตถุดิบของรายงานผลการทดลองใช้สื่อ
 * สูตรทั้งหมดอยู่ที่ core/statistics.ts ไฟล์นี้แค่ป้อนข้อมูลเข้าไป
 * ------------------------------------------------------------------ */

export interface ClassStatistics {
  headcount: number
  /** คะแนนเต็มของแบบทดสอบที่ใช้จริง */
  quizMax: number
  pre: Descriptive
  post: Descriptive
  /** ผลต่างหลัง − ก่อน ติดลบได้ */
  gain: Descriptive
  /** การทดสอบค่าทีแบบกลุ่มตัวอย่างไม่อิสระ (สเปกข้อ 9.4) */
  tTest: PairedTTest
  /** ขนาดอิทธิพล d */
  effectSize: EffectSize
  /** คะแนนพัฒนาการแบบปรับมาตรฐานของทั้งห้อง */
  normalizedGain: NormalizedGain
  /**
   * ร้อยละความตรงกันของคะแนนรูบริก — สถิติตัวที่ 6 ของสเปกข้อ 9.4
   *
   * `aiVsTeacher` ตอบข้อครหาว่า "ให้ AI ตรวจแล้วเชื่อได้ไหม" (สเปกข้อ 9.4)
   * `selfVsTeacher` คือตัวชี้วัด PL7 ผู้เรียนประเมินตัวเองตรงกับครูแค่ไหน (สเปกข้อ 9.5)
   * นับเป็นคู่รายเกณฑ์ของคนที่มีคะแนนทั้งสองฝั่งจริงเท่านั้น คนที่ครูยังไม่ตรวจไม่ถูกนับเป็นศูนย์
   */
  agreement: { aiVsTeacher: Agreement; selfVsTeacher: Agreement }
  /** ประโยคพร้อมขึ้นสไลด์ อ้างตัวเลขจริงทุกตัว */
  summary: string
}

/**
 * สถิติคะแนนก่อน-หลังของทั้งห้อง ตามที่สเปกข้อ 9.4 กำหนด
 * ห้องว่างหรือมีคนเดียวไม่พัง — ค่าที่คำนวณไม่ได้คืน null พร้อมเหตุผล เพื่อให้รายงานเขียนตามจริง
 */
export function classStatistics(reports: StudentReport[]): ClassStatistics {
  const list = Array.isArray(reports) ? reports : []
  const quizMax = toFinite(list[0]?.quizMax, quizMaxScore('post'))

  const pairs = list.map((r) => ({ pre: toFinite(r?.preScore), post: toFinite(r?.postScore) }))
  const pre = descriptive(pairs.map((p) => p.pre))
  const post = descriptive(pairs.map((p) => p.post))
  const gain = descriptive(pairs.map((p) => p.post - p.pre))
  const tTest = pairedTTest(pairs)
  const gainStat = classNormalizedGain(pairs, quizMax)

  const summary =
    list.length === 0
      ? 'ยังไม่มีข้อมูลผู้เรียนในคาบนี้'
      : [
          `นักเรียน ${list.length} คน`,
          `ก่อนเรียนเฉลี่ย ${pre.mean.toFixed(2)}${pre.sd === null ? '' : ` (SD ${pre.sd.toFixed(2)})`} จาก ${quizMax}`,
          `หลังเรียนเฉลี่ย ${post.mean.toFixed(2)}${post.sd === null ? '' : ` (SD ${post.sd.toFixed(2)})`} จาก ${quizMax}`,
          tTest.t === null
            ? `ยังทดสอบค่าทีไม่ได้ — ${tTest.reason}`
            : `t = ${tTest.t.toFixed(3)}, df = ${tTest.df}, p = ${(tTest.p ?? 0).toFixed(4)} ` +
              `(${tTest.significant ? 'แตกต่างอย่างมีนัยสำคัญที่ระดับ .05' : 'ยังไม่แตกต่างอย่างมีนัยสำคัญที่ระดับ .05'})`,
          gainStat.g === null
            ? `คะแนนพัฒนาการคำนวณไม่ได้ — ${gainStat.reason}`
            : `คะแนนพัฒนาการ g = ${gainStat.g.toFixed(2)} (${gainStat.level})`,
        ].join(' · ')

  return {
    headcount: list.length,
    quizMax,
    pre,
    post,
    gain,
    tTest,
    effectSize: effectSize(tTest),
    normalizedGain: gainStat,
    agreement: {
      aiVsTeacher: agreementRate(rubricPairs(list, 'ai')),
      selfVsTeacher: agreementRate(rubricPairs(list, 'self')),
    },
    summary,
  }
}

/**
 * คู่คะแนนรายเกณฑ์สำหรับหาความตรงกัน — เทียบกับคะแนนที่ครูยืนยันเสมอ
 * เอาเฉพาะคนที่ครูตรวจแล้วและมีคะแนนอีกฝั่งครบ คนที่ยังไม่ถูกตรวจต้องไม่ถูกนับเป็น "ต่างกัน"
 */
function rubricPairs(
  reports: StudentReport[],
  side: 'ai' | 'self',
): Array<{ a: number; b: number }> {
  const pairs: Array<{ a: number; b: number }> = []
  for (const report of reports) {
    if (!report?.rubricConfirmedByTeacher) continue

    if (side === 'self') {
      // ตารางเทียบ 3 แหล่งเก็บคะแนนตัวเองกับครูไว้แถวเดียวกันอยู่แล้ว (S-26)
      for (const row of report?.selfVsSystemVsTeacher?.rows ?? []) {
        if (typeof row?.self !== 'number' || typeof row?.teacher !== 'number') continue
        pairs.push({ a: row.self, b: row.teacher })
      }
      continue
    }

    const teacher = report?.rubric?.dimensions ?? []
    if (teacher.length === 0) continue
    const ai = Object.fromEntries(
      (report?.rubricAiSuggestion?.dimensions ?? []).map((d) => [d.id, toFinite(d.score)]),
    )
    for (const dimension of teacher) {
      const score = ai[dimension.id]
      if (typeof score !== 'number' || !Number.isFinite(score)) continue
      pairs.push({ a: score, b: toFinite(dimension.score) })
    }
  }
  return pairs
}

export interface ObjectiveOutcome {
  objectiveId: string
  shortName: string
  fullName: string
  /** วัดจากอะไร ใช้เขียนช่อง "วิธีวัด" ในตารางรายงาน */
  measuredBy: string
  passedCount: number
  headcount: number
  /** สัดส่วนคนที่ผ่าน 0-1 */
  passRate: number
  /** เป้าหมายตามสเปกข้อ 9.1 (K1 K2 K4) */
  target: number
  meetsTarget: boolean
}

/** เป้าหมายร้อยละของผู้ผ่านแต่ละจุดประสงค์ ตามตัวชี้วัด K1 K2 และ K4 ในสเปกข้อ 9.1 */
export const OBJECTIVE_TARGETS: Record<string, number> = {
  'obj-1': 0.8,
  'obj-2': 0.8,
  'obj-3': 0.8,
  'obj-4': 0.8,
  'obj-5': 0.8,
  'obj-6': 0.9,
}

/** ผ่านจุดประสงค์ข้อ 5 เมื่อครูยืนยันแล้ว และทุกเกณฑ์ในรูบริกได้ตั้งแต่ระดับ 3 ขึ้นไป */
export function passedBigMissionObjective(report: StudentReport): boolean {
  if (!report?.rubricConfirmedByTeacher) return false
  const dimensions = report?.rubric?.dimensions ?? []
  if (dimensions.length === 0) return false
  return dimensions.every((d) => toFinite(d?.score) >= 3)
}

/** ผ่านจุดประสงค์ข้อ 6 เมื่อตั้งเป้า ประเมินตนเอง และตอบสะท้อนคิดครบทุกข้อ */
export function passedSelfRegulationObjective(report: StudentReport): boolean {
  const s = report?.selfRegulation
  if (!s) return false
  return (
    Boolean(s.goalSet) &&
    Boolean(s.selfAssessed) &&
    toFinite(s.reflectionAnswered) >= REFLECTION_QUESTION_COUNT
  )
}

/**
 * ผลรายจุดประสงค์ครบทั้ง 6 ข้อ — ตารางนี้คือคำตอบของตัวชี้วัด K1 K2 K4
 *
 * ข้อ 1-4 ผ่านเมื่อผ่านภารกิจของเรื่องนั้น (การข้ามถือว่าผ่านอยู่แล้ว เพราะบันทึกมาเป็น passed)
 * ข้อ 5 ผ่านเมื่อครูยืนยันด่านบอสและทุกเกณฑ์ได้ระดับ 3 ขึ้นไป
 * ข้อ 6 ผ่านเมื่อตั้งเป้า ประเมินตนเอง และสะท้อนคิดครบ
 * ห้องว่างคืนทุกข้อด้วย headcount 0 และ passRate 0 ไม่หารด้วยศูนย์
 */
export function objectiveOutcomes(reports: StudentReport[]): ObjectiveOutcome[] {
  const list = Array.isArray(reports) ? reports : []
  const headcount = list.length

  return objectivesFromContent.map((objective) => {
    let passedCount = 0
    for (const report of list) {
      if (objective.id === 'obj-5') {
        if (passedBigMissionObjective(report)) passedCount += 1
        continue
      }
      if (objective.id === 'obj-6') {
        if (passedSelfRegulationObjective(report)) passedCount += 1
        continue
      }
      const passed = (report?.missions ?? []).some(
        (m) => m.objectiveId === objective.id && m.passed,
      )
      if (passed) passedCount += 1
    }

    const passRate = headcount > 0 ? passedCount / headcount : 0
    const target = OBJECTIVE_TARGETS[objective.id] ?? 0.8
    return {
      objectiveId: objective.id,
      shortName: objective.shortName,
      fullName: objective.fullName,
      measuredBy: objective.measuredBy ?? 'ผ่านภารกิจของเรื่องนี้ (รวมการข้าม)',
      passedCount,
      headcount,
      passRate: round2(passRate),
      meetsTarget: headcount > 0 && passRate >= target,
      target,
    }
  })
}

export interface RouteChange {
  studentId: string
  missionId?: string
  fromRoute?: RouteId
  toRoute?: RouteId
  changedAt?: number
}

export interface AdaptiveEvidence {
  /** คนเลือกช่องทางไหนกี่คน */
  routeDistribution: Record<RouteId, number>
  /** กี่คนที่สลับช่องทางกลางคัน */
  switchedCount: number
  /** กี่คนที่ไม่เอาตามที่ระบบเสนอ */
  overrodeSuggestionCount: number
  /** กี่คนที่ยกเป้าหมายของตัวเองให้สูงขึ้น */
  raisedGoalCount: number
  /** กี่คนที่เดินทางเดียวกันเป๊ะทั้งคาบ */
  samePathCount: number
  headcount: number
}

/**
 * หลักฐานว่าสื่อนี้เป็น Personalized จริง ไม่ใช่ Adaptive ล้วน
 *
 * **ถ้า overrodeSuggestionCount เป็น 0 แปลว่าระบบทำงานเป็น adaptive ล้วน ยังไม่ใช่ personalized**
 * เพราะไม่มีใครใช้สิทธิ์ยับยั้งข้อเสนอของระบบเลย ซึ่งอาจแปลว่าหน้าจอไม่ได้เปิดทางให้เปลี่ยนจริง
 * ตัวเลขนี้คือตัวชี้ขาดที่ต้องโชว์กรรมการ คู่กับ switchedCount
 *
 * @param routeChanges แถวจากตาราง route_changes ใช้จับคนที่สลับช่องทางแม้ภารกิจจะบันทึกไม่ครบ
 */
export function adaptiveEvidence(
  reports: StudentReport[],
  routeChanges: RouteChange[] = [],
): AdaptiveEvidence {
  const list = Array.isArray(reports) ? reports : []
  const changes = Array.isArray(routeChanges) ? routeChanges : []
  const switchedIds = new Set(changes.map((c) => c?.studentId).filter(Boolean))

  const routeDistribution: Record<RouteId, number> = { clip: 0, card: 0, game: 0, buddy: 0 }
  let switchedCount = 0
  let overrodeSuggestionCount = 0
  let raisedGoalCount = 0

  for (const report of list) {
    const chosen = report?.routeChosen
    if (chosen && ROUTE_IDS.includes(chosen)) routeDistribution[chosen] += 1

    const switched = toFinite(report?.switchCount) > 0 || switchedIds.has(report?.studentId)
    if (switched) switchedCount += 1

    // นับเฉพาะคนที่ระบบเสนอไว้จริง และเลือกต่างจากที่เสนอ
    if (report?.routeSuggested && chosen && chosen !== report.routeSuggested) {
      overrodeSuggestionCount += 1
    }

    if (toFinite(report?.goalRaisedCount) > 0) raisedGoalCount += 1
  }

  return {
    routeDistribution,
    switchedCount,
    overrodeSuggestionCount,
    raisedGoalCount,
    samePathCount: list.length - switchedCount,
    headcount: list.length,
  }
}

const ROUTE_LABEL: Record<RouteId, string> = {
  clip: 'สายดูคลิป',
  card: 'สายอ่านการ์ด',
  game: 'สายลงมือเล่น',
  buddy: 'สายคู่หู',
}

/**
 * แปลงหลักฐานเป็นประโยคไทยพร้อมขึ้นสไลด์
 * ทุกบรรทัดเป็นตัวเลขจริงจากคาบที่สอน ไม่ใช่ข้อความโฆษณา
 */
export function evidenceSentences(evidence: AdaptiveEvidence): string[] {
  const headcount = toFinite(evidence?.headcount)
  if (headcount <= 0) return ['ยังไม่มีข้อมูลผู้เรียนในคาบนี้']

  const distribution = evidence?.routeDistribution ?? { clip: 0, card: 0, game: 0, buddy: 0 }
  const usedRoutes = ROUTE_IDS.filter((id) => toFinite(distribution[id]) > 0)
  const distributionText = usedRoutes
    .map((id) => `${ROUTE_LABEL[id]} ${distribution[id]} คน`)
    .join(' · ')

  const lines = [
    `นักเรียนทั้งหมด ${headcount} คน เรียนเรื่องเดียวกันด้วยเส้นทางที่ต่างกัน ${usedRoutes.length} แบบ: ${distributionText}`,
    `นักเรียน ${toFinite(evidence?.switchedCount)} จาก ${headcount} คน เปลี่ยนวิธีเรียนระหว่างคาบด้วยตัวเอง`,
    toFinite(evidence?.overrodeSuggestionCount) > 0
      ? `นักเรียน ${evidence.overrodeSuggestionCount} จาก ${headcount} คน ไม่เอาตามที่ระบบเสนอ และเลือกเส้นทางเองแทน — นี่คือจุดที่สื่อนี้เป็นการเรียนรู้ส่วนบุคคล ไม่ใช่ระบบปรับเหมาะล้วน`
      : `ยังไม่มีใครเปลี่ยนจากที่ระบบเสนอเลยในคาบนี้ ต้องกลับไปดูว่าหน้าจอเปิดทางให้ผู้เรียนเปลี่ยนจริงหรือยัง`,
    `นักเรียน ${toFinite(evidence?.raisedGoalCount)} คน ยกเป้าหมายของตัวเองให้สูงขึ้นระหว่างคาบ`,
    `มี ${toFinite(evidence?.samePathCount)} คนที่เดินเส้นทางเดียวตลอดคาบ ทุกคนไปถึงวัตถุประสงค์เดียวกัน แต่ไม่ได้เดินทางเดียวกัน`,
  ]

  return lines
}

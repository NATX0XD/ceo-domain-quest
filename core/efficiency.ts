/**
 * ประสิทธิภาพของสื่อ E1/E2 — ตรงตามสเปกข้อ 9.3 และตัวชี้วัด K7
 *
 * E1 ประสิทธิภาพของกระบวนการ = (ΣX ÷ N) ÷ A × 100
 *   X = คะแนนระหว่างเรียนรายคน = คะแนนภารกิจย่อย 4 ภารกิจ (เล่นแล้วใช้จำนวนดาว)
 *       + คะแนนรูบริกด่านบอสที่ครูยืนยัน
 *   ภารกิจที่ข้าม: ผู้เรียนข้ามเองโดยผ่านเงื่อนไข = นับเต็ม · **ครูสั่งให้ข้าม (T-06) = 0**
 *   เพราะกรณีหลังผู้เรียนยังไม่ได้พิสูจน์ว่ารู้เรื่องนั้น ถ้านับเต็มให้ E1 จะสูงขึ้นจากการตัดสินใจของครู
 *   กติกาการข้ามทั้งหมดอยู่ที่ core/personalize.ts (evaluateSkip) ซึ่งอ่านจาก content/rubric.json
 *   A = คะแนนเต็มระหว่างเรียน
 *   N = จำนวนนักเรียน
 *
 * E2 ประสิทธิภาพของผลลัพธ์ = (ΣF ÷ N) ÷ B × 100
 *   F = คะแนนแบบทดสอบหลังเรียนรายคน
 *   B = คะแนนเต็มของแบบทดสอบหลังเรียน
 *
 * เกณฑ์ตามสเปก K7 คือ E1/E2 ไม่ต่ำกว่า 80/80
 *
 * **คะแนนเต็มอ่านจากไฟล์เนื้อหา ไม่ฝังเลขในโค้ด**
 *   คะแนนเต็มภารกิจย่อย  <- content/self-profile.json คีย์ starBudget
 *   คะแนนเต็มรูบริกบอส   <- content/rubric.json คีย์ scoring.weightedMax
 *   คะแนนเต็มแบบทดสอบ    <- จำนวนข้อใน content/quiz.json ชุด post
 * ทับค่าได้ทาง options ถ้าต้องรายงานบนมาตราอื่น (เช่น มาตราของเอกสารสเปกที่ใช้รูบริกเต็ม 16)
 *
 * ⚠️ ข้อต่างที่ต้องรู้: เอกสารสเปกเขียน A = 28 เพราะสมมติรูบริกด่านบอสเต็ม 16 คะแนน
 * แต่รูบริกจริงในสื่อนี้ (content/rubric.json) เต็ม 15 คะแนนถ่วงน้ำหนัก A ที่คำนวณได้จึงเป็น 27
 * ไฟล์นี้จึงคืนค่า inClassMax ออกมาด้วยเสมอ เพื่อให้รายงานอ้างมาตราที่ใช้จริงได้ตรง ๆ
 *
 * ⚠️ โมดูลฝั่งเซิร์ฟเวอร์ (อ่านไฟล์เนื้อหาโดยตรง) ตรรกะล้วน ไม่เรียก Date.now() ไม่แตะฐานข้อมูล
 */
import quizJson from '../content/quiz.json' with { type: 'json' }
import rubricJson from '../content/rubric.json' with { type: 'json' }
import selfProfileJson from '../content/self-profile.json' with { type: 'json' }
import { SKIP_EARNED_STARS, SKIP_TEACHER_STARS } from './personalize'

const starBudget = selfProfileJson.starBudget as {
  perMissionMax: number
  missionCount: number
  missionStarsTotal: number
}

const rubricScoring = rubricJson.scoring as { weightedMax: number; weightedMin: number }

/** คะแนนเต็มของภารกิจย่อยทั้ง 4 (ดาวละ 1 คะแนน) — จาก content/self-profile.json */
export const MISSION_POINTS_MAX = starBudget.missionStarsTotal

/**
 * คะแนนของภารกิจที่ผู้เรียน "ข้ามเองโดยผ่านเงื่อนไข" ตามสเปกข้อ 9.3
 * อ่านจากกติกาการข้ามใน content/rubric.json ผ่าน core/personalize.ts — **แหล่งความจริงเดียว**
 * ไม่คำนวณซ้ำที่นี่ ไม่งั้น E1 กับดาวบนจอจะเพี้ยนคนละทางเมื่อทีมเนื้อหาแก้กติกา
 */
export const SKIP_POINTS: number = SKIP_EARNED_STARS

/** ครูสั่งให้ข้าม (T-06) ไม่ได้ดาว จึงไม่ได้คะแนนใน E1 ด้วย แต่ยังนับว่าผ่านจุดประสงค์ */
export const TEACHER_SKIP_POINTS: number = SKIP_TEACHER_STARS

/** คะแนนเต็มของรูบริกด่านบอส (คะแนนถ่วงน้ำหนัก) — จาก content/rubric.json */
export const RUBRIC_POINTS_MAX = rubricScoring.weightedMax

/** A ในสูตร E1 = คะแนนเต็มระหว่างเรียน */
export const IN_CLASS_MAX = MISSION_POINTS_MAX + RUBRIC_POINTS_MAX

/** B ในสูตร E2 = คะแนนเต็มของแบบทดสอบหลังเรียน */
export const POST_TEST_MAX = quizJson.post.length

/** เกณฑ์มาตรฐานตามสเปกข้อ K7 — E1 และ E2 ต้องไม่ต่ำกว่าค่านี้ทั้งคู่ */
export const EFFICIENCY_STANDARD = 80

/** ผลภารกิจย่อยรายคน 1 ภารกิจ */
export interface MissionScoreInput {
  missionId: string
  /** ข้ามภารกิจนี้ */
  skipped?: boolean
  /**
   * ใครสั่งข้าม ไม่ใส่ถือว่าผู้เรียนข้ามเองโดยผ่านเงื่อนไข (ตอบถูกและมั่นใจตอนเช็ก)
   * **ครูสั่งข้ามได้ 0 คะแนน** เพราะผู้เรียนยังไม่ได้พิสูจน์เอง ถ้านับเต็มให้ด้วย
   * E1 จะสูงขึ้นจากการตัดสินใจของครู ไม่ใช่จากการเรียนรู้ของนักเรียน
   */
  skippedBy?: 'student' | 'teacher'
  /** ดาวที่ได้จริงเมื่อเล่น 0-3 */
  stars?: number
}

export interface InClassScoreInput {
  studentId: string
  missions: readonly MissionScoreInput[]
  /**
   * คะแนนรูบริกด่านบอสที่ **ครูยืนยันแล้ว** เท่านั้น
   * ยังไม่ส่งงานหรือครูยังไม่ยืนยัน = 0 ตามสเปกข้อ 9.3
   */
  rubricScore?: number | null
  /** ทำงานชิ้นนี้ในคาบหรือทำที่บ้าน — สเปกขอให้รายงาน E1 แยกสองกลุ่มได้ */
  doneInClass?: boolean
}

export interface InClassScore {
  studentId: string
  /** คะแนนจากภารกิจย่อย (ข้าม = เต็ม) */
  missionPoints: number
  /** คะแนนรูบริกด่านบอสที่ครูยืนยัน */
  rubricPoints: number
  /** X ในสูตร E1 */
  total: number
  max: number
  /** ร้อยละของคนนี้ ใช้ทำตาราง "คะแนนระหว่างเรียนรายคน" */
  percent: number
  /** จำนวนภารกิจที่ข้ามทั้งหมด เก็บไว้ให้ครูตรวจย้อนกับกฎ PL3 */
  skippedCount: number
  /** ในนั้นมีกี่ภารกิจที่ครูเป็นคนสั่งข้าม — ต้องแยกให้เห็น ไม่งั้นอ่าน E1 ผิด */
  teacherSkippedCount: number
}

export interface EfficiencyOptions {
  /** ทับ A ถ้าจะรายงานบนมาตราอื่น */
  inClassMax?: number
  /** ทับ B ถ้าแบบทดสอบที่ใช้จริงไม่ใช่ชุดในไฟล์เนื้อหา */
  postTestMax?: number
  /** ทับคะแนนของภารกิจที่ข้าม */
  skipPoints?: number
  /** ทับเกณฑ์มาตรฐาน 80/80 */
  standard?: number
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function positiveOr(value: unknown, fallback: number): number {
  const n = finite(value, Number.NaN)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * คะแนนระหว่างเรียนของคนเดียว (X ในสูตร E1)
 *
 * กฎตามสเปกข้อ 9.3:
 * - ภารกิจที่ข้าม นับเต็ม (ไม่ใช่ 0) เพราะผู้เรียนแสดงความเข้าใจตั้งแต่ตอนเช็กแล้ว
 * - ภารกิจที่เล่น นับตามจำนวนดาวที่ได้จริง
 * - คะแนนรูบริกนับเฉพาะที่ครูยืนยัน ยังไม่ส่ง = 0
 * ค่าที่เกินเพดานถูกบีบลงเสมอ กันคนเดียวดันค่าเฉลี่ยทั้งห้องด้วยข้อมูลเพี้ยน
 */
export function inClassScore(
  input: InClassScoreInput,
  options: EfficiencyOptions = {},
): InClassScore {
  const skipPoints = positiveOr(options.skipPoints, SKIP_POINTS)
  const missions = Array.isArray(input?.missions) ? input.missions : []

  let missionPoints = 0
  let skippedCount = 0
  let teacherSkippedCount = 0
  for (const mission of missions) {
    if (mission?.skipped) {
      const byTeacher = mission.skippedBy === 'teacher'
      missionPoints += byTeacher ? TEACHER_SKIP_POINTS : skipPoints
      skippedCount += 1
      if (byTeacher) teacherSkippedCount += 1
      continue
    }
    missionPoints += Math.min(Math.max(finite(mission?.stars), 0), skipPoints)
  }
  missionPoints = Math.min(missionPoints, MISSION_POINTS_MAX)

  const rubricPoints = Math.min(Math.max(finite(input?.rubricScore), 0), RUBRIC_POINTS_MAX)
  const max = positiveOr(options.inClassMax, IN_CLASS_MAX)
  const total = missionPoints + rubricPoints

  return {
    studentId: input?.studentId ?? '',
    missionPoints: round2(missionPoints),
    rubricPoints: round2(rubricPoints),
    total: round2(total),
    max,
    percent: round2((total / max) * 100),
    skippedCount,
    teacherSkippedCount,
  }
}

export interface EfficiencyValue {
  /** ผลรวมคะแนนของทั้งห้อง (ΣX หรือ ΣF) */
  sum: number
  /** N */
  n: number
  /** ค่าเฉลี่ยของห้อง */
  mean: number
  /** คะแนนเต็ม (A หรือ B) */
  max: number
  /** ค่าประสิทธิภาพเป็นร้อยละ ทศนิยม 2 ตำแหน่ง */
  percent: number
  /** ผ่านเกณฑ์มาตรฐานหรือไม่ */
  meetsStandard: boolean
  /** คำนวณไม่ได้เพราะอะไร (ห้องว่าง) */
  reason: string | null
}

function efficiencyValue(
  values: readonly number[],
  max: number,
  standard: number,
): EfficiencyValue {
  const list = (Array.isArray(values) ? values : []).filter((v) => Number.isFinite(v))
  const n = list.length
  if (n === 0) {
    return {
      sum: 0,
      n: 0,
      mean: 0,
      max,
      percent: 0,
      meetsStandard: false,
      reason: 'ยังไม่มีข้อมูลผู้เรียน จึงยังคำนวณประสิทธิภาพไม่ได้',
    }
  }
  const sum = list.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const percent = (mean / max) * 100
  return {
    sum: round2(sum),
    n,
    mean: round2(mean),
    max,
    percent: round2(percent),
    meetsStandard: percent >= standard,
    reason: null,
  }
}

/** E1 ประสิทธิภาพของกระบวนการ — คะแนนระหว่างเรียนเฉลี่ยคิดเป็นร้อยละ */
export function efficiencyE1(
  students: readonly InClassScoreInput[],
  options: EfficiencyOptions = {},
): EfficiencyValue {
  const max = positiveOr(options.inClassMax, IN_CLASS_MAX)
  const standard = positiveOr(options.standard, EFFICIENCY_STANDARD)
  const scores = (Array.isArray(students) ? students : []).map(
    (s) => inClassScore(s, options).total,
  )
  return efficiencyValue(scores, max, standard)
}

/** E2 ประสิทธิภาพของผลลัพธ์ — คะแนนแบบทดสอบหลังเรียนเฉลี่ยคิดเป็นร้อยละ */
export function efficiencyE2(
  postScores: readonly number[],
  options: EfficiencyOptions = {},
): EfficiencyValue {
  const max = positiveOr(options.postTestMax, POST_TEST_MAX)
  const standard = positiveOr(options.standard, EFFICIENCY_STANDARD)
  const clamped = (Array.isArray(postScores) ? postScores : [])
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.min(Math.max(v, 0), max))
  return efficiencyValue(clamped, max, standard)
}

export interface MediaEfficiency {
  e1: EfficiencyValue
  e2: EfficiencyValue
  /** ข้อความพร้อมขึ้นสไลด์ เช่น "84.29/83.00" */
  label: string
  /** เกณฑ์ที่ใช้ตัดสิน เช่น "80/80" */
  standardLabel: string
  standard: number
  /** ผ่านเกณฑ์ทั้งสองค่าหรือไม่ */
  meetsStandard: boolean
  /** ประโยคสรุปภาษาไทยที่อ้างตัวเลขจริง */
  summary: string
  /** รายคน เก็บไว้ให้ครูตรวจย้อนได้ว่า E1 มาจากคะแนนของใครบ้าง */
  perStudent: InClassScore[]
}

/**
 * E1/E2 พร้อมกันทีเดียว — ตัวเลขชุดนี้คือคำตอบของตัวชี้วัด K7
 *
 * @param students คะแนนระหว่างเรียนรายคน (ใช้หา E1)
 * @param postScores คะแนนหลังเรียนรายคน (ใช้หา E2) ลำดับไม่จำเป็นต้องตรงกับ students
 */
export function mediaEfficiency(
  students: readonly InClassScoreInput[],
  postScores: readonly number[],
  options: EfficiencyOptions = {},
): MediaEfficiency {
  const standard = positiveOr(options.standard, EFFICIENCY_STANDARD)
  const perStudent = (Array.isArray(students) ? students : []).map((s) => inClassScore(s, options))
  const e1 = efficiencyE1(students, options)
  const e2 = efficiencyE2(postScores, options)
  const meetsStandard = e1.meetsStandard && e2.meetsStandard

  const label = `${e1.percent.toFixed(2)}/${e2.percent.toFixed(2)}`
  const standardLabel = `${standard}/${standard}`

  const summary =
    e1.n === 0 || e2.n === 0
      ? `ยังคำนวณประสิทธิภาพไม่ได้ — มีคะแนนระหว่างเรียน ${e1.n} คน และคะแนนหลังเรียน ${e2.n} คน`
      : `E1/E2 = ${label} จากเกณฑ์ ${standardLabel} · ` +
        `ระหว่างเรียนเฉลี่ย ${e1.mean.toFixed(2)} จาก ${e1.max} คะแนน (${e1.n} คน) · ` +
        `หลังเรียนเฉลี่ย ${e2.mean.toFixed(2)} จาก ${e2.max} คะแนน (${e2.n} คน) · ` +
        (meetsStandard ? 'สูงกว่าเกณฑ์ทั้งสองค่า' : 'ยังไม่ถึงเกณฑ์')

  return { e1, e2, label, standardLabel, standard, meetsStandard, summary, perStudent }
}

/**
 * แยก E1 ของงานที่ทำในคาบกับงานที่ทำที่บ้าน ตามข้อควรระวังท้ายสเปกข้อ 9.3
 * กลุ่มไหนไม่มีคนก็คืนค่าที่บอกเหตุผลไว้ ไม่พังและไม่หารด้วยศูนย์
 */
export function efficiencyE1BySetting(
  students: readonly InClassScoreInput[],
  options: EfficiencyOptions = {},
): { inClass: EfficiencyValue; atHome: EfficiencyValue; all: EfficiencyValue } {
  const list = Array.isArray(students) ? students : []
  return {
    inClass: efficiencyE1(
      list.filter((s) => s?.doneInClass !== false),
      options,
    ),
    atHome: efficiencyE1(
      list.filter((s) => s?.doneInClass === false),
      options,
    ),
    all: efficiencyE1(list, options),
  }
}

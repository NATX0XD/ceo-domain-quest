/**
 * เครื่องยนต์ปรับเหมาะ (Adaptive) ภายใต้แนวคิดการเรียนรู้ส่วนบุคคล (Personalized Learning)
 *
 * กฎเหล็กของไฟล์นี้ — ทุกฟังก์ชันต้องเคารพ:
 * 1. สิ่งที่ระบบคำนวณได้เป็น "ข้อเสนอ" เสมอ ไม่ใช่คำสั่ง ผู้เรียนยับยั้งหรือเปลี่ยนได้ตลอด
 * 2. เก็บ 2 ค่าคู่กันเสมอ — สิ่งที่ระบบเสนอ (suggested) กับสิ่งที่ผู้เรียนเลือกจริง (chosen)
 *    ค่าหลังคือหลักฐานตอนนำเสนอว่าสื่อนี้ไม่ใช่ adaptive ล้วน
 * 3. ไม่มีฟังก์ชันไหนปฏิเสธการเลือกของผู้เรียน ถ้าเขียนแล้วปฏิเสธได้ แปลว่าออกแบบผิด
 *
 * ตรรกะล้วน ไม่ import React / Next / ฐานข้อมูล / fetch และไม่เรียก Date.now()
 * เวลาทุกจุดรับเป็นพารามิเตอร์ จะได้ทดสอบได้และผลลัพธ์ซ้ำเดิมทุกครั้ง
 *
 * อ้างอิงกฎจาก docs/personalized-learning-design.md ข้อ 5.1-5.6
 *
 * ⚠️ โมดูลนี้เป็นฝั่งเซิร์ฟเวอร์เท่านั้น
 * เพราะ recommendLevel ใช้ suggestScaffoldLevel จาก core/quiz.ts (ตามโจทย์ที่ห้ามเขียนเกณฑ์ซ้ำ)
 * และ core/quiz.ts โหลด content/quiz-answers.json ซึ่งมีเฉลย
 * ถ้า client component import ไฟล์นี้ เฉลยจะติดไปกับ bundle เหมือนบั๊ก H1 ที่เพิ่งแก้ไป
 * หน้าจอฝั่งเบราว์เซอร์ให้เรียกผ่าน API หรือ server action แทน
 */
import { z } from 'zod'
import coachThresholdsJson from '../content/coach-thresholds.json' with { type: 'json' }
import rubricJson from '../content/rubric.json' with { type: 'json' }
import selfProfileJson from '../content/self-profile.json' with { type: 'json' }
import { suggestScaffoldLevel } from './quiz'

/**
 * รหัสช่องทางการเรียนรู้ ใช้ค่าเดียวกับ content/self-profile.json และคอลัมน์ profiles.channel
 * หมายเหตุ: ช่อง "สายลงมือเล่น" มีรหัสว่า 'game' ในไฟล์เนื้อหา (บางเอกสารเรียกสั้น ๆ ว่า game)
 */
export type RouteId = 'clip' | 'card' | 'game' | 'buddy'

/** ระดับตัวช่วย 1 = ป้ายครบ, 3 = ไม่มีป้าย ตรงกับ hintsForLevel ใน core/tld-rules.ts */
export type ScaffoldLevel = 1 | 2 | 3

export const ROUTE_IDS: readonly RouteId[] = ['clip', 'card', 'game', 'buddy']

/**
 * ลำดับตัดสินเมื่อคะแนนเท่ากัน — card ก่อนเพราะย้อนอ่านซ้ำได้เอง ไม่ต้องรอใครและไม่กินแบนด์วิดท์
 * ลำดับนี้คงที่ ห้ามสุ่ม เพื่อให้ผู้เรียนคนเดิมตอบเหมือนเดิมแล้วได้ข้อเสนอเดิมเสมอ
 */
const TIE_BREAK_ORDER: readonly RouteId[] = ['card', 'clip', 'game', 'buddy']

type PreferenceChoice = {
  id: string
  weightClip: number
  weightCard: number
  weightGame: number
  weightBuddy: number
}

const preferenceQuestions = selfProfileJson.preferenceQuestions as ReadonlyArray<{
  id: string
  choices: ReadonlyArray<PreferenceChoice>
}>

const preTestMap = selfProfileJson.preTestMap as ReadonlyArray<{
  objectiveId: string
  quizId: string
  topicName: string
}>

const goalOptions = selfProfileJson.goalOptions as ReadonlyArray<{
  id: string
  name: string
  starTarget: number
}>

export type RouteScores = Record<RouteId, number>

export interface RouteRecommendation {
  /** ช่องทางที่ระบบเสนอ — เป็นข้อเสนอเท่านั้น ยังไม่ใช่ค่าที่ใช้จริง */
  suggested: RouteId
  /** คะแนนของทุกช่องทาง เอาไปโชว์ให้ผู้เรียนเห็นว่าทำไมถึงเสนอตัวนี้ */
  scores: RouteScores
  reason: string
}

/** ผลตรวจชุดก่อนเรียน รูปแบบเดียวกับที่ gradeQuiz ใน core/quiz.ts คืนมา */
export interface PreTestResult {
  score: number
  total: number
  wrongIds: string[]
}

export interface LevelRecommendation {
  suggested: ScaffoldLevel
  /** รหัสวัตถุประสงค์ที่ยังอ่อน (obj-1..obj-4) เรียงตามลำดับในไฟล์เนื้อหา */
  weakObjectives: string[]
  reason: string
}

/** ใครเป็นคนเลือกค่านี้จริง ๆ — ใช้เก็บลงคอลัมน์ *_chosen_by */
export type ChosenBy = 'system' | 'student'

export interface LearnerChoiceRecord<T> {
  suggested: T
  chosen: T
  chosenBy: ChosenBy
  /** เวลาที่ผู้เรียนตัดสินใจ (epoch ms) รับเข้ามา ไม่เรียก Date.now() เอง */
  at: number | null
}

export interface LearnerChoiceResult<T> {
  /**
   * ระบบรับการตัดสินใจนี้ไว้หรือไม่ — เป็น true เสมอ
   * มีไว้ให้ผู้เรียกอ่านค่าเดียวจบว่าบันทึกสำเร็จ ไม่ใช่ประตูให้ระบบปฏิเสธผู้เรียน
   */
  accepted: true
  /** ผู้เรียนเปลี่ยนไปจากที่ระบบเสนอหรือไม่ */
  overridden: boolean
  record: LearnerChoiceRecord<T>
}

/**
 * คิดคะแนนช่องทางการเรียนรู้จากคำตอบ 5 ข้อ (ข้อ 5.1 ในเอกสารออกแบบ)
 *
 * @param prefAnswers รหัสคำถาม -> รหัสตัวเลือกที่เลือก ข้อที่ไม่ตอบจะถูกข้าม ไม่นับเป็นศูนย์
 * @param readiness รหัสวัตถุประสงค์ -> ตอบถูกหรือไม่ ใส่หรือไม่ใส่ก็ได้
 *
 * คืนคะแนนของทุกช่องทาง ไม่ใช่แค่ตัวชนะ เพราะหน้าการ์ดตัวตนต้องอธิบายเหตุผลให้ผู้เรียนเห็น
 * ผลลัพธ์คงที่เสมอสำหรับ input เดิม (ไม่มีการสุ่ม) เสมอกันตัดสินด้วย TIE_BREAK_ORDER
 */
export function recommendRoute(
  prefAnswers: Record<string, string | null | undefined> = {},
  readiness: Record<string, boolean> = {},
): RouteRecommendation {
  const scores: RouteScores = { clip: 0, card: 0, game: 0, buddy: 0 }
  let answered = 0

  for (const question of preferenceQuestions) {
    const choiceId = prefAnswers?.[question.id]
    if (!choiceId) continue
    const choice = question.choices.find((c) => c.id === choiceId)
    if (!choice) continue
    answered += 1
    scores.clip += choice.weightClip
    scores.card += choice.weightCard
    scores.game += choice.weightGame
    scores.buddy += choice.weightBuddy
  }

  const readinessKeys = Object.keys(readiness ?? {})
  const wrongCount = readinessKeys.filter((k) => readiness[k] === false).length
  let readinessNote = ''

  // ปรับเฉพาะเมื่อมีผลแบบทดสอบก่อนเรียนจริง ถ้ายังไม่มีผล ห้ามเดาว่าตอบถูกหมด
  if (readinessKeys.length > 0) {
    if (wrongCount >= 3) {
      // ยังไม่มีพื้น ดันไปทางที่มีคนช่วยหรือมีคนอธิบาย การลองผิดลองถูกล้วนจะช้าเกินไป
      scores.buddy += 2
      scores.clip += 1
      scores.game -= 1
      readinessNote = ' และเพราะแบบทดสอบก่อนเรียนยังมีข้อที่พลาดหลายข้อ ระบบจึงเสนอทางที่มีคนช่วยอธิบาย'
    } else if (wrongCount === 0) {
      // พื้นแน่นแล้ว ให้ทางที่เดินได้เร็วด้วยตัวเอง
      scores.game += 2
      scores.card += 1
      readinessNote = ' และเพราะทำแบบทดสอบก่อนเรียนได้ครบทุกข้อ ระบบจึงเสนอทางที่เดินเองได้เร็ว'
    }
  }

  const best = Math.max(...ROUTE_IDS.map((id) => scores[id]))
  const winners = TIE_BREAK_ORDER.filter((id) => scores[id] === best)
  const suggested = winners[0] ?? 'card'

  const reason =
    answered === 0
      ? 'ยังไม่ได้ตอบคำถามรู้จักตัวเอง ระบบจึงเสนอสายอ่านการ์ดไว้ก่อน เพราะย้อนกลับมาอ่านซ้ำเองได้ หนูเปลี่ยนเป็นทางอื่นได้ทุกเมื่อ'
      : `จากคำตอบ ${answered} ข้อ ทางนี้ได้คะแนนสูงสุด ${best} คะแนน${readinessNote} นี่เป็นแค่ข้อเสนอ หนูเลือกทางอื่นได้ตลอด`

  return { suggested, scores, reason }
}

/**
 * เสนอระดับตัวช่วยรวมจากผลแบบทดสอบก่อนเรียน และบอกด้วยว่าอ่อนวัตถุประสงค์ข้อไหน
 * ใช้ suggestScaffoldLevel จาก core/quiz.ts เป็นฐาน ไม่คำนวณเกณฑ์ซ้ำที่นี่
 */
export function recommendLevel(preTestResult: PreTestResult): LevelRecommendation {
  const wrongIds = new Set(preTestResult?.wrongIds ?? [])
  const weak = preTestMap.filter((m) => wrongIds.has(m.quizId))
  const weakObjectives = weak.map((m) => m.objectiveId)
  const suggested = suggestScaffoldLevel(preTestResult?.score ?? Number.NaN)

  const reason =
    weakObjectives.length === 0
      ? 'ตอบถูกครบทุกข้อ ระบบจึงเสนอให้ลองทำเองก่อนโดยไม่เปิดป้ายช่วย ถ้าอยากเปิดตัวช่วย กดเปิดเองได้ทุกเมื่อ'
      : `ยังไม่ชัดเรื่อง ${weak.map((m) => m.topicName).join(' และ ')} ระบบจึงเสนอระดับตัวช่วยที่ ${suggested} ให้ หนูกดปิดตัวช่วยเองได้ถ้าอยากลองเอง`

  return { suggested, weakObjectives, reason }
}

/**
 * บันทึกการตัดสินใจของผู้เรียน — หัวใจของความเป็น Personalized
 *
 * ฟังก์ชันนี้ไม่ปฏิเสธการเลือกของผู้เรียนไม่ว่ากรณีใด แม้ผู้เรียนเลือกสิ่งที่ระบบไม่ได้เสนอ
 * accepted จึงเป็น true เสมอ ส่วน overridden บอกว่าผู้เรียนเปลี่ยนไปจากข้อเสนอหรือรับตามที่เสนอ
 */
export function applyLearnerChoice<T>(
  suggested: T,
  chosen: T,
  at: number | null = null,
): LearnerChoiceResult<T> {
  const overridden = chosen !== suggested
  return {
    accepted: true,
    overridden,
    record: {
      suggested,
      chosen,
      chosenBy: overridden ? 'student' : 'system',
      at,
    },
  }
}

/** แปลงรหัสเป้าหมายเป็นจำนวนดาวเป้า คืน null ถ้าไม่รู้จักรหัสนี้ */
export function goalStarTarget(goal: string | number): number | null {
  if (typeof goal === 'number') return Number.isFinite(goal) ? goal : null
  return goalOptions.find((g) => g.id === goal)?.starTarget ?? null
}

/**
 * ยกเป้าหมายได้เสมอ ลดเป้าไม่ได้ (goalPolicy.canLowerDuringLesson = false)
 * เหตุผล: ถ้าระบบลดเป้าให้เองเมื่อเห็นว่าทำไม่ทัน ผู้เรียนจะรู้สึกว่าถูกตัดสินว่าทำไม่ได้
 * ถ้าจะลดเป้าจริง ๆ ให้ครูเป็นคนคุยกับผู้เรียนเอง ไม่ใช่ระบบตัดสินให้
 */
export function canRaiseGoal(current: string | number, target: string | number): boolean {
  const from = goalStarTarget(current)
  const to = goalStarTarget(target)
  if (from === null || to === null) return false
  return to > from
}

/**
 * ระดับคำใบ้ถัดไปที่ระบบจะปล่อยให้เอง — ปล่อยทีละระดับ ไม่ปล่อยพรวดเดียว
 * ความพยายามที่ผิดเพิ่ม 1 ครั้ง ปลดคำใบ้เพิ่มได้ 1 ระดับ
 * คืน null เมื่อใช้ครบทุกระดับแล้ว หรือยังไม่ถึงจังหวะที่ระบบจะปล่อยเอง
 *
 * ผู้เรียนกดขอคำใบ้เองก่อนถึงเกณฑ์ได้เสมอ — เส้นทางนั้นไม่ผ่านฟังก์ชันนี้
 * ฟังก์ชันนี้ตอบเฉพาะคำถามว่า "ระบบควรยื่นคำใบ้ให้เองหรือยัง"
 */
export function nextHintLevel(attempts: number, hintsUsed: number, maxHints: number): number | null {
  const safeMax = Number.isFinite(maxHints) ? Math.max(0, Math.floor(maxHints)) : 0
  const used = Number.isFinite(hintsUsed) ? Math.max(0, Math.floor(hintsUsed)) : 0
  const tries = Number.isFinite(attempts) ? Math.max(0, Math.floor(attempts)) : 0

  const next = used + 1
  if (next > safeMax) return null // ใช้ครบทุกระดับแล้ว
  if (tries < next) return null // ยังผิดไม่ถึงจำนวนที่จะปลดระดับถัดไป
  return next
}

export interface CoachState {
  /** จำนวนครั้งที่ลองแล้วยังไม่ผ่าน */
  attempts: number
  hintsUsed: number
  maxHints: number
  /** ผ่านภารกิจนี้แล้วหรือยัง ถ้าผ่านแล้วไม่ต้องเรียกครู */
  solved: boolean
  /** เวลาที่ผู้เรียนขยับครั้งล่าสุด (epoch ms) */
  lastActionAt: number
  /** เวลาปัจจุบัน (epoch ms) รับเข้ามา ห้ามเรียก Date.now() ในฟังก์ชัน */
  now: number
}

export type CoachCause = 'many-attempts' | 'idle-too-long' | 'hints-exhausted'

/** ระดับสีของธงบนแผงครู เรียงความเร่งด่วนจากน้อยไปมาก */
export type CoachLevel = 'yellow' | 'orange' | 'red'

export interface CoachSignal {
  flag: boolean
  /** สีธง คืน null เมื่อยังไม่ต้องเตือน */
  level: CoachLevel | null
  cause: CoachCause | null
  /** ข้อความสั้นข้างธงสำหรับครู มาจากไฟล์เกณฑ์ */
  label: string | null
}

const CoachLevelRuleSchema = z.object({
  /** ไม่ขยับกี่วินาทีถึงขึ้นธงสีนี้ null = ไม่ใช้เกณฑ์เวลา */
  idleSeconds: z.number().positive().nullable(),
  /** ลองกี่ครั้งแล้วยังไม่ผ่านถึงขึ้นธงสีนี้ null = ไม่ใช้เกณฑ์จำนวนครั้ง */
  attempts: z.number().int().positive().nullable(),
  /** ใช้คำใบ้ครบทุกระดับแล้วยังไม่ผ่าน ให้ขึ้นธงสีนี้หรือไม่ */
  hintsExhausted: z.boolean(),
  label: z.string().min(1),
})

const CoachThresholdsSchema = z.object({
  levels: z.object({
    yellow: CoachLevelRuleSchema,
    orange: CoachLevelRuleSchema,
    red: CoachLevelRuleSchema,
  }),
})

/**
 * เกณฑ์ธงเตือนครู อ่านจาก content/coach-thresholds.json ไม่ฝังตัวเลขไว้ในโค้ด
 * ทีมจะปรับตัวเลขหลังทดลองสอนจริงโดยไม่ต้องแตะไฟล์นี้
 */
export const coachThresholds = CoachThresholdsSchema.parse(coachThresholdsJson)

/** ไล่จากด่วนสุดไปเบาสุด ตัวแรกที่เข้าเกณฑ์ชนะ */
const COACH_LEVEL_ORDER: readonly CoachLevel[] = ['red', 'orange', 'yellow']

/**
 * ธงเตือนครูให้เข้าไปโค้ช — เป็นการชวนครูเข้าไปคุย ไม่ใช่การลงโทษผู้เรียน
 * ผู้เรียนกดปุ่มขอครูเองได้ตลอดเวลาโดยไม่ต้องรอเกณฑ์พวกนี้
 *
 * เกณฑ์ปัจจุบัน (แก้ได้ที่ content/coach-thresholds.json):
 * เหลือง = ไม่ขยับ 60 วินาที · ส้ม = ไม่ขยับ 90 วินาที หรือลองแล้วไม่ผ่าน 3 ครั้ง
 * แดง = ไม่ขยับ 150 วินาที หรือใช้คำใบ้ครบทุกระดับแล้วยังไม่ผ่าน
 * ตัวเลขสั้นกว่าเดิมเพราะภารกิจย่อยมีเวลาแค่ 4 นาที รอนานกว่านี้ครูเข้าไปช่วยไม่ทัน
 */
export function shouldCoach(state: CoachState): CoachSignal {
  const quiet: CoachSignal = { flag: false, level: null, cause: null, label: null }
  if (!state || state.solved) return quiet

  const attempts = Number.isFinite(state.attempts) ? state.attempts : 0
  const idleSeconds =
    Number.isFinite(state.now) && Number.isFinite(state.lastActionAt)
      ? (state.now - state.lastActionAt) / 1000
      : 0
  const maxHints = Number.isFinite(state.maxHints) ? state.maxHints : 0
  const hintsUsed = Number.isFinite(state.hintsUsed) ? state.hintsUsed : 0
  const hintsExhausted = maxHints > 0 && hintsUsed >= maxHints

  for (const level of COACH_LEVEL_ORDER) {
    const rule = coachThresholds.levels[level]

    if (rule.hintsExhausted && hintsExhausted) {
      return { flag: true, level, cause: 'hints-exhausted', label: rule.label }
    }
    if (rule.idleSeconds !== null && idleSeconds >= rule.idleSeconds) {
      return { flag: true, level, cause: 'idle-too-long', label: rule.label }
    }
    if (rule.attempts !== null && attempts >= rule.attempts) {
      return { flag: true, level, cause: 'many-attempts', label: rule.label }
    }
  }

  return quiet
}

/** ใครเป็นคนสั่งข้ามภารกิจ — ผลต่างกันคนละเรื่อง ห้ามปนกันในรายงาน */
export type SkipBy = 'student' | 'teacher'

export interface SkipRequest {
  by: SkipBy
  /** ตอบข้อที่วัดเรื่องนี้ถูกในเช็กความเข้าใจหรือไม่ (ใช้เฉพาะตอนผู้เรียนกดข้ามเอง) */
  correct?: boolean
  /** ความมั่นใจที่ผู้เรียนบอกไว้ในข้อนั้น 1-3 ตาม confidenceScale */
  confidence?: number
}

export interface MissionResult {
  passed: boolean
  /** จำนวนครั้งที่ลองทั้งหมด รวมครั้งที่ผ่าน */
  attempts: number
  /**
   * จำนวนคำใบ้ที่เปิด — **ไม่มีผลต่อดาว** รับไว้เพื่อความเข้ากันได้กับผู้เรียกเดิม
   * และเพื่อให้ครูเห็นในรายงานว่าใครใช้ตัวช่วยบ้าง (เป็นข้อมูล ไม่ใช่บทลงโทษ)
   */
  hintsUsed?: number
  /** ภารกิจนี้ถูกข้าม ไม่ได้เล่น — ใส่มาแล้ว attempts กับ hintsUsed จะไม่ถูกใช้ */
  skipped?: SkipRequest | null
}

export type Stars = 0 | 1 | 2 | 3

/**
 * กติกาให้ดาวของภารกิจย่อย อ่านจาก content/rubric.json คีย์ missionStars
 * ห้ามเขียนช่วงคะแนนซ้ำในโค้ด ถ้าจะแก้กติกาให้แก้ที่ไฟล์เนื้อหาไฟล์เดียว
 */
const missionStarRule = rubricJson.missionStars as {
  hintsAffectStars: boolean
  notPassedStars: number
  passedMinStars: number
  bands: ReadonlyArray<{ id: string; stars: number; maxWrongAttempts: number | null; label: string }>
}

/** ช่วงดาวของภารกิจย่อย เรียงจากดีสุดลงมา ให้หน้าจอและรายงานอ้างชุดเดียวกัน */
export const missionStarBands = [...missionStarRule.bands].sort(
  (a, b) => b.stars - a.stars,
)

/**
 * กติกาการข้ามภารกิจ อ่านจาก content/rubric.json คีย์ missionStars.skip
 * **นี่คือแหล่งความจริงเดียวของเรื่องข้าม** core/journey.ts และ core/efficiency.ts อ้างที่นี่
 */
const missionSkipRule = (missionStarRule as unknown as {
  skip: {
    requireCorrect: boolean
    requireConfidence: number | 'highest'
    earnedStars: number
    teacherDirectedStars: number
    countsAsObjectivePassed: boolean
    rejectedStars: number
  }
}).skip

/** ดาวที่ได้เมื่อข้ามโดยผ่านเงื่อนไข = เท่ากับทำผ่านเอง */
export const SKIP_EARNED_STARS = missionSkipRule.earnedStars as Stars
/** ดาวที่ได้เมื่อครูสั่งให้ข้าม (T-06) = 0 แต่ยังนับว่าผ่านจุดประสงค์ */
export const SKIP_TEACHER_STARS = missionSkipRule.teacherDirectedStars as Stars

/**
 * ความมั่นใจขั้นต่ำที่ต้องมีจึงจะข้ามเองได้ — 'highest' แปลงเป็นค่าสูงสุดของสเกลจริง
 * อ่านสเกลจาก content/self-profile.json ตรง ๆ (ไม่ใช้ CONFIDENCE_MAX ซึ่งประกาศทีหลังในไฟล์นี้)
 * ถ้าทีมเนื้อหาเปลี่ยนสเกลความมั่นใจเป็น 1-5 ค่านี้ขยับตามเองโดยไม่ต้องแก้โค้ด
 */
export const SKIP_MIN_CONFIDENCE =
  missionSkipRule.requireConfidence === 'highest'
    ? Math.max(
        ...(selfProfileJson.confidenceScale as { levels: ReadonlyArray<{ value: number }> }).levels.map(
          (l) => l.value,
        ),
      )
    : Number(missionSkipRule.requireConfidence)

export type SkipOutcome =
  /** ข้ามได้เพราะพิสูจน์แล้วว่ารู้เรื่องนี้ — ได้ดาวเต็ม */
  | 'earned'
  /** ครูสั่งให้ข้าม — 0 ดาว แต่ผ่านจุดประสงค์ */
  | 'teacher'
  /** ยังไม่เข้าเงื่อนไข ระบบปฏิเสธ ไม่ถือว่าข้าม */
  | 'rejected'

export interface SkipDecision {
  outcome: SkipOutcome
  /** ข้ามได้จริงหรือไม่ — false แปลว่าผู้เรียนต้องทำภารกิจนั้นตามปกติ */
  allowed: boolean
  stars: Stars
  /** นับว่าผ่านจุดประสงค์ข้อนั้นหรือไม่ (สเปกข้อ 1.6 "ผ่าน M1 รวมการข้าม") */
  passed: boolean
  /** เหตุผล เขียนให้ผู้เรียนอ่านได้ ไม่ตำหนิ */
  reason: string
}

/**
 * ตัดสินการข้ามภารกิจหนึ่งครั้ง — **แหล่งความจริงเดียวของเรื่องนี้**
 *
 * 3 กรณีที่ต่างกันคนละเรื่อง และห้ามปนกันในรายงาน:
 *
 * 1. **ผู้เรียนข้ามเองและเข้าเงื่อนไข** (ตอบถูก + บอกว่ามั่นใจ ในเช็กความเข้าใจ)
 *    ได้ดาวเต็มเท่ากับทำผ่านเอง เพราะสเปกข้อ 1.10 นิยามการข้ามว่า
 *    "ภารกิจที่ระบบอนุญาตให้ข้าม เพราะนักเรียนตอบเรื่องนั้นถูกและมั่นใจตอนเช็ก"
 *    การข้ามจึงไม่ใช่การหนีงาน แต่คือการพิสูจน์ว่ารู้แล้ว ให้ 0 ดาวเท่ากับลงโทษคนที่รู้อยู่แล้ว
 *
 * 2. **ครูสั่งให้ข้าม (T-06)** ได้ 0 ดาว เพราะผู้เรียนยังไม่ได้พิสูจน์เอง
 *    แต่ยังนับว่าผ่านจุดประสงค์ เพราะครูมีเหตุผลของครู (เช่น เวลาไม่พอ หรือประเมินด้วยวิธีอื่นแล้ว)
 *
 * 3. **กดข้ามโดยยังไม่เข้าเงื่อนไข** ระบบปฏิเสธ ไม่ใช่ปล่อยให้ข้ามแล้วให้ 0 ดาว
 *    ถ้าปล่อยข้ามฟรี ตัวเลข "ผ่านจุดประสงค์" ของทั้งห้องจะเชื่อไม่ได้เลย
 *
 * หมายเหตุ: นี่เป็นคนละเรื่องกับ `applyLearnerChoice` ที่ห้ามปฏิเสธการเลือกของผู้เรียน
 * ตรงนั้นคือการเลือก "วิธีเรียน" ซึ่งเป็นสิทธิ์ของผู้เรียนเต็มที่
 * ส่วนตรงนี้คือการรับรองว่า "ผ่านจุดประสงค์แล้ว" ซึ่งต้องมีหลักฐาน
 * ผู้เรียนที่ยังไม่เข้าเงื่อนไขไม่ได้ถูกห้ามทำอะไร เขายังเลือกลำดับภารกิจและช่องทางได้เหมือนเดิม
 */
export function evaluateSkip(request: SkipRequest | null | undefined): SkipDecision {
  if (!request) {
    return {
      outcome: 'rejected',
      allowed: false,
      stars: 0,
      passed: false,
      reason: 'ไม่ได้ขอข้ามภารกิจนี้',
    }
  }

  if (request.by === 'teacher') {
    return {
      outcome: 'teacher',
      allowed: true,
      stars: SKIP_TEACHER_STARS,
      passed: missionSkipRule.countsAsObjectivePassed,
      reason: 'ครูให้ข้ามภารกิจนี้ นับว่าผ่านจุดประสงค์ แต่ยังไม่ได้เก็บดาวของภารกิจนี้',
    }
  }

  const correct = request.correct === true
  const confidence = Number.isFinite(request.confidence) ? Number(request.confidence) : 0

  if (missionSkipRule.requireCorrect && !correct) {
    return {
      outcome: 'rejected',
      allowed: false,
      stars: missionSkipRule.rejectedStars as Stars,
      passed: false,
      reason: 'ข้อที่วัดเรื่องนี้ยังตอบไม่ถูกตอนเช็กความเข้าใจ ลองทำภารกิจนี้ดูก่อนนะ เร็วกว่าที่คิด',
    }
  }

  if (confidence < SKIP_MIN_CONFIDENCE) {
    return {
      outcome: 'rejected',
      allowed: false,
      stars: missionSkipRule.rejectedStars as Stars,
      passed: false,
      reason: 'ตอบถูกแล้ว แต่ยังบอกว่าไม่ได้มั่นใจเต็มที่ ลองทำภารกิจนี้ให้ชัวร์อีกทีดีกว่า',
    }
  }

  return {
    outcome: 'earned',
    allowed: true,
    stars: SKIP_EARNED_STARS,
    passed: missionSkipRule.countsAsObjectivePassed,
    reason: 'ตอบเรื่องนี้ถูกและบอกว่ามั่นใจตั้งแต่ตอนเช็ก จึงข้ามได้และได้ดาวเต็มเหมือนทำผ่านเอง',
  }
}


/**
 * ให้ดาวจากผลภารกิจ — **นับเฉพาะจำนวนครั้งที่ตอบยังไม่ถูกเท่านั้น**
 *
 * ตอบถูกครั้งแรก = 3 ดาว · ผิด 1 ครั้งแล้วผ่าน = 2 ดาว · ผิดตั้งแต่ 2 ครั้ง แต่ผ่านแล้ว = 1 ดาว
 *
 * **การเปิดคำใบ้และตัวช่วยไม่มีผลต่อดาวเลย** (สเปกข้อ 2.5 ข้อ 6 และข้อ 2.7)
 * เหตุผล: ถ้าหักดาวเมื่อเปิดตัวช่วย เด็กที่ติดจะไม่กล้ากดดู แล้วนั่งจมอยู่กับความไม่เข้าใจ
 * ซึ่งตรงข้ามกับสิ่งที่ตัวช่วยมีไว้ทำ ตัวช่วยต้องปลอดภัยที่จะใช้เสมอ
 *
 * ผ่านแล้วได้อย่างน้อย 1 ดาวเสมอ ได้ 0 ดาวเฉพาะกรณียังไม่ผ่าน
 */
export function starsFor(missionResult: MissionResult): Stars {
  // ข้ามภารกิจคิดคนละทางกับการเล่น ดูกติกาทั้งหมดที่ evaluateSkip
  if (missionResult?.skipped) return evaluateSkip(missionResult.skipped).stars

  if (!missionResult?.passed) return missionStarRule.notPassedStars as Stars

  const attempts = Number.isFinite(missionResult.attempts) ? Math.max(1, missionResult.attempts) : 1
  // attempts ที่บันทึกรวมครั้งที่ผ่านด้วย จำนวนครั้งที่ตอบยังไม่ถูกจึงเป็น attempts - 1
  const wrongAttempts = Math.max(0, Math.floor(attempts) - 1)

  for (const band of missionStarBands) {
    if (band.maxWrongAttempts === null || wrongAttempts <= band.maxWrongAttempts) {
      return band.stars as Stars
    }
  }
  return missionStarRule.passedMinStars as Stars
}

export type GoalOutcome = 'below' | 'met' | 'exceeded'

/** เทียบดาวที่เก็บได้กับเป้าหมายที่ผู้เรียนตั้งเอง */
export function goalOutcome(starsEarned: number, goalLevel: string | number): GoalOutcome {
  const target = goalStarTarget(goalLevel) ?? 0
  const earned = Number.isFinite(starsEarned) ? starsEarned : 0
  if (earned < target) return 'below'
  if (earned === target) return 'met'
  return 'exceeded'
}

/* ------------------------------------------------------------------ *
 * ความมั่นใจเทียบกับผลจริง (calibration)
 * มาจากภาพ ai-media-rules.png ข้อ 7 และกล่อง "แจ้งครู" มุมขวาล่าง
 * ------------------------------------------------------------------ */

const confidenceLevels = (
  selfProfileJson.confidenceScale as { levels: ReadonlyArray<{ value: number }> }
).levels

/** ค่าความมั่นใจต่ำสุด/สูงสุด อ่านจาก content/self-profile.json ไม่ตรึงไว้ในโค้ด */
export const CONFIDENCE_MIN = Math.min(...confidenceLevels.map((l) => l.value))
export const CONFIDENCE_MAX = Math.max(...confidenceLevels.map((l) => l.value))

/** สิ่งที่ครูควรทำกับเด็กคนนี้ ไม่ใช่การให้คะแนน */
export type CalibrationFlag = 'ควรคุย' | 'ควรชม'

/**
 * รหัสสาเหตุ ใช้จับคู่กับคำถามโค้ชใน content/coach-prompts.json (missionId + reasonId)
 * แผงครูหยิบ "คำถาม" ไปถาม ไม่ใช่ "คำเฉลย" ไปบอก ตามกติกาในไฟล์เนื้อหานั้น
 */
export const CALIBRATION_PROMPT_IDS = {
  overconfidentWrong: 'reason-overconfident-wrong',
  underconfidentRight: 'reason-underconfident-right',
} as const

export interface CalibrationSignal {
  flag: CalibrationFlag | null
  /** เหตุผลภาษาไทยสำหรับแสดงบนแผงครู */
  reason: string | null
  /** รหัสที่เอาไปหาคำถามโค้ชใน content/coach-prompts.json */
  coachPromptId: string | null
}

/**
 * เทียบ "ความมั่นใจที่บอกไว้" กับ "ผลจริง" แล้วบอกครูว่าควรทำอะไร
 *
 * มั่นใจสูงแต่ตอบผิด = เข้าใจผิดแบบฝังหัว อันตรายกว่าเดาผิด เพราะเด็กไม่รู้ตัวว่าต้องแก้
 * มั่นใจต่ำแต่ตอบถูก = ทำได้แล้วแต่ยังไม่เชื่อมั่นในตัวเอง ต้องชมให้เห็นว่าทำได้จริง
 * กรณีที่ความมั่นใจตรงกับผล ไม่ต้องรบกวนครู คืน null
 *
 * ธงนี้ไม่มีผลกับคะแนนและไม่แสดงให้ผู้เรียนเห็นเป็นคำตัดสิน เป็นข้อมูลให้ครูตั้งวงคุย
 */
export function calibrationFlag(confidence: number, correct: boolean): CalibrationSignal {
  const none: CalibrationSignal = { flag: null, reason: null, coachPromptId: null }
  if (!Number.isFinite(confidence)) return none

  if (confidence >= CONFIDENCE_MAX && !correct) {
    return {
      flag: 'ควรคุย',
      reason: 'บอกว่ามั่นใจเต็มที่แต่ตอบผิด เป็นความเข้าใจผิดที่เจ้าตัวยังไม่รู้ว่าผิด ควรชวนคุยก่อนข้ามไปเรื่องอื่น',
      coachPromptId: CALIBRATION_PROMPT_IDS.overconfidentWrong,
    }
  }

  if (confidence <= CONFIDENCE_MIN && correct) {
    return {
      flag: 'ควรชม',
      reason: 'บอกว่าเดาเอาแต่ตอบถูก แปลว่ารู้อยู่แล้วแต่ยังไม่มั่นใจในตัวเอง ควรชมให้เห็นว่าทำได้จริง',
      coachPromptId: CALIBRATION_PROMPT_IDS.underconfidentRight,
    }
  }

  return none
}

/* ------------------------------------------------------------------ *
 * ตัวช่วยที่ได้ผลจริง ถูกแนะนำก่อนในภารกิจถัดไป
 * มาจากภาพ ai-media-rules.png กล่อง "ปรับระหว่างเรียน"
 * ------------------------------------------------------------------ */

export interface ChannelAttempt {
  route: RouteId
  passed: boolean
  stars: number
  hintsUsed: number
  elapsedSeconds: number
}

export interface ChannelRanking {
  route: RouteId
  /** คะแนนความได้ผล ยิ่งมากยิ่งถูกเสนอก่อน */
  score: number
  /** เคยใช้ช่องทางนี้แล้วหรือยัง ยังไม่เคยใช้ก็ยังอยู่ในรายการเสมอ */
  tried: boolean
  attempts: number
}

/**
 * น้ำหนักของ "ได้ผลจริง" — ตั้งจากสิ่งที่สังเกตได้ในคาบ ไม่ใช่ความชอบที่เด็กบอกไว้ตอนต้น
 * ผ่านภารกิจ 2 คะแนน (สำคัญที่สุด เพราะเป้าคือทำได้จริง)
 * ดาว 1 คะแนนเต็มเมื่อได้ 3 ดาว (ทำได้เร็วและสะอาด)
 * คำใบ้หักครั้งละ 0.25 (ต้องพึ่งตัวช่วยมาก = ช่องทางนั้นยังไม่เข้าทาง)
 * เวลาเกิน 3 นาทีต่อภารกิจหัก 0.5 (ช้ากว่างบเวลาของภารกิจย่อย)
 */
const EFFECTIVENESS_WEIGHTS = {
  passed: 2,
  starsFull: 1,
  hintPenalty: 0.25,
  slowPenalty: 0.5,
  slowAfterSeconds: 180,
} as const

function attemptScore(attempt: ChannelAttempt): number {
  const stars = Number.isFinite(attempt.stars) ? Math.max(0, Math.min(3, attempt.stars)) : 0
  const hints = Number.isFinite(attempt.hintsUsed) ? Math.max(0, attempt.hintsUsed) : 0
  const seconds = Number.isFinite(attempt.elapsedSeconds) ? attempt.elapsedSeconds : 0

  let score = attempt.passed ? EFFECTIVENESS_WEIGHTS.passed : 0
  score += (stars / 3) * EFFECTIVENESS_WEIGHTS.starsFull
  score -= hints * EFFECTIVENESS_WEIGHTS.hintPenalty
  if (seconds > EFFECTIVENESS_WEIGHTS.slowAfterSeconds) score -= EFFECTIVENESS_WEIGHTS.slowPenalty
  return score
}

/**
 * เรียงช่องทางตามที่ "ได้ผลจริง" กับผู้เรียนคนนี้ในคาบนี้ เพื่อเสนอก่อนในภารกิจถัดไป
 *
 * **ผลลัพธ์เป็นแค่ลำดับการแนะนำ** คืนครบทั้ง 4 ช่องทางเสมอ ไม่ตัดและไม่ซ่อนช่องทางไหนทิ้ง
 * ผู้เรียนกดเลือกอันไหนก็ได้ รวมถึงอันที่อยู่ท้ายสุด — ถ้าวันไหนฟังก์ชันนี้คืนไม่ครบ 4 แปลว่าออกแบบผิด
 *
 * ช่องทางที่ยังไม่เคยใช้ได้คะแนน 0 (ไม่ใช่ติดลบ) จึงไม่ถูกดันไปท้ายแถวเพราะแค่ยังไม่ได้ลอง
 * คะแนนเท่ากันตัดสินด้วย TIE_BREAK_ORDER เดิม ผลจึงคงที่ทุกครั้ง
 */
export function rankChannelsByEffectiveness(history: ChannelAttempt[]): ChannelRanking[] {
  const list = Array.isArray(history) ? history : []
  const totals = new Map<RouteId, { sum: number; attempts: number }>()

  for (const attempt of list) {
    if (!attempt || !ROUTE_IDS.includes(attempt.route)) continue
    const bucket = totals.get(attempt.route) ?? { sum: 0, attempts: 0 }
    bucket.sum += attemptScore(attempt)
    bucket.attempts += 1
    totals.set(attempt.route, bucket)
  }

  return ROUTE_IDS.map((route) => {
    const bucket = totals.get(route)
    const score = bucket && bucket.attempts > 0 ? bucket.sum / bucket.attempts : 0
    return {
      route,
      score: Math.round(score * 100) / 100,
      tried: Boolean(bucket),
      attempts: bucket?.attempts ?? 0,
    }
  }).sort(
    (a, b) =>
      b.score - a.score || TIE_BREAK_ORDER.indexOf(a.route) - TIE_BREAK_ORDER.indexOf(b.route),
  )
}

/* ------------------------------------------------------------------ *
 * ระดับภารกิจ และภารกิจเสริม
 * มาจากภาพ ai-media-rules.png: ถูก = ท้าทายหรือข้ามได้ · ผิด = ฝึกพื้นฐาน
 * ------------------------------------------------------------------ */

export type MissionLevel = 'basic' | 'challenge'

export interface MissionDifficulty {
  level: MissionLevel
  /** ระบบเสนอให้ข้ามภารกิจนี้ได้หรือไม่ */
  canSkip: boolean
  reason: string
}

/**
 * เลือกระดับภารกิจจากผลก่อนเรียนของวัตถุประสงค์นั้น
 *
 * ตอบถูก = รู้อยู่แล้ว ให้โจทย์ที่ท้าทายขึ้น และเสนอปุ่มข้ามให้ด้วย จะได้ไม่เสียเวลาทำซ้ำ
 * ตอบผิด = ให้ฝึกพื้นฐานก่อน
 *
 * หมายเหตุ canSkip = "ระบบเสนอให้ข้าม" ไม่ใช่ "ระบบอนุญาตให้ข้าม"
 * ทุกภารกิจกดข้ามได้ตลอดอยู่แล้วตามหลักผู้เรียนเลือกเส้นทางเอง ไม่มีภารกิจไหนถูกล็อก
 */
export function missionDifficulty(correctOnPreTest: boolean): MissionDifficulty {
  if (correctOnPreTest) {
    return {
      level: 'challenge',
      canSkip: true,
      reason: 'ตอบข้อที่วัดเรื่องนี้ถูกตั้งแต่ก่อนเรียน ระบบจึงเสนอโจทย์ที่ยากขึ้น และข้ามไปทำอย่างอื่นก่อนก็ได้',
    }
  }
  return {
    level: 'basic',
    canSkip: false,
    reason: 'ข้อที่วัดเรื่องนี้ยังไม่ผ่านตอนก่อนเรียน ระบบจึงเสนอให้เริ่มจากโจทย์พื้นฐาน',
  }
}

/**
 * ภารกิจเสริมเปิดเมื่อผู้เรียน "ตั้งเป้าสูง" ด้วยตัวเอง หรือทำถึงเป้าที่ตั้งไว้แล้ว
 *
 * ปลดล็อกเมื่อเข้าเงื่อนไขข้อใดข้อหนึ่ง:
 * 1. ตั้งเป้าไว้ที่ระดับสูงสุดในไฟล์เนื้อหา (goal-challenge) — เจตนาจะลองของยากตั้งแต่ต้น
 * 2. เก็บดาวถึงเป้าที่ตั้งเองแล้ว — ยังมีเวลาเหลือ ให้มีอะไรทำต่อแทนการนั่งรอเพื่อน
 *
 * เป็นการ "เปิดเพิ่ม" เท่านั้น ไม่ได้บังคับให้ทำ และไม่มีผลลบกับคนที่ไม่ทำ
 */
export function bonusUnlocked(goalLevel: string | number, currentStars: number): boolean {
  const target = goalStarTarget(goalLevel) ?? 0
  const stars = Number.isFinite(currentStars) ? currentStars : 0
  const highestGoal = Math.max(...goalOptions.map((g) => g.starTarget))

  if (target >= highestGoal) return true
  return target > 0 && stars >= target
}

export interface MissionRecord {
  missionId: string
  /** ทำผ่านแล้วหรือยัง */
  passed: boolean
  stars: number
  /** ช่องทางที่ผู้เรียนใช้จริงในภารกิจนี้ */
  route: RouteId
  /** จำนวนครั้งที่สลับช่องทางระหว่างอยู่ในภารกิจนี้ ใส่หรือไม่ใส่ก็ได้ */
  routeSwitches?: number
}

export interface ProgressSummary {
  done: number
  total: number
  stars: number
  /** ช่องทางที่เคยใช้จริง เรียงตามลำดับที่ใช้ครั้งแรก */
  routesUsed: string[]
  /** จำนวนครั้งที่ผู้เรียนสลับช่องทาง — หลักฐานชิ้นสำคัญที่สุดตอนนำเสนอ */
  switchCount: number
}

/**
 * สรุปความคืบหน้าทั้งคาบ
 * switchCount นับทั้งการสลับข้ามภารกิจ (ภารกิจถัดไปใช้คนละช่องทางกับภารกิจก่อนหน้า)
 * และการสลับระหว่างอยู่ในภารกิจเดียวกัน (ฟิลด์ routeSwitches)
 */
export function progressSummary(allMissions: MissionRecord[]): ProgressSummary {
  const missions = Array.isArray(allMissions) ? allMissions : []
  const routesUsed: string[] = []
  let stars = 0
  let done = 0
  let switchCount = 0
  let previousRoute: RouteId | null = null

  for (const mission of missions) {
    if (mission.passed) done += 1
    stars += Number.isFinite(mission.stars) ? mission.stars : 0
    if (mission.route && !routesUsed.includes(mission.route)) routesUsed.push(mission.route)
    if (previousRoute !== null && mission.route && mission.route !== previousRoute) switchCount += 1
    if (mission.route) previousRoute = mission.route
    switchCount += Number.isFinite(mission.routeSwitches) ? (mission.routeSwitches ?? 0) : 0
  }

  return { done, total: missions.length, stars, routesUsed, switchCount }
}

export type TraceEvent =
  | { type: 'route-suggested'; at: number; suggested: string }
  | { type: 'route-chosen'; at: number; suggested: string; chosen: string }
  | { type: 'route-switched'; at: number; from: string; to: string }
  | { type: 'level-suggested'; at: number; suggested: number }
  | { type: 'level-chosen'; at: number; suggested: number; chosen: number }
  | { type: 'goal-raised'; at: number; from: string | number; to: string | number }
  | { type: 'hint-used'; at: number; level: number; triggeredBy: ChosenBy }
  | { type: 'coach-flagged'; at: number; cause: CoachCause }
  | { type: 'mission-passed'; at: number; missionId: string; stars: number }

/** ชื่อช่องทางภาษาไทยสำหรับแสดงผล ถ้าไม่รู้จักให้ใช้รหัสเดิม */
function routeName(id: string): string {
  const channel = (selfProfileJson.channels as ReadonlyArray<{ id: string; shortName: string }>).find(
    (c) => c.id === id,
  )
  return channel?.shortName ?? id
}

function goalName(goal: string | number): string {
  if (typeof goal === 'number') return `${goal} ดาว`
  return goalOptions.find((g) => g.id === goal)?.name ?? goal
}

/**
 * แปลงเวลา epoch ms เป็น HH:MM ตามเวลาไทย (UTC+7) ด้วยเลขล้วน
 * ไม่ใช้ Date เพื่อให้ผลไม่ขึ้นกับ timezone ของเครื่องที่รัน และทดสอบได้แน่นอน
 */
function thaiClock(at: number): string {
  if (!Number.isFinite(at)) return '--:--'
  const minutesOfDay = Math.floor((at + 7 * 60 * 60 * 1000) / 60000) % 1440
  const safe = ((minutesOfDay % 1440) + 1440) % 1440
  const hh = String(Math.floor(safe / 60)).padStart(2, '0')
  const mm = String(safe % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

const CAUSE_TEXT: Record<CoachCause, string> = {
  'many-attempts': 'ลองหลายครั้งแล้วยังไม่ผ่าน',
  'idle-too-long': 'ไม่ขยับนานเกินไป',
  'hints-exhausted': 'ใช้คำใบ้ครบทุกระดับแล้วยังไม่ผ่าน',
}

/**
 * แปลงเหตุการณ์เป็นบรรทัดภาษาไทยที่อ่านรู้เรื่องทันที
 * ใช้โชว์กรรมการได้ตรง ๆ ว่าจุดไหนระบบเสนอ จุดไหนผู้เรียนตัดสินใจเอง
 */
export function adaptiveTrace(events: TraceEvent[]): string[] {
  const list = Array.isArray(events) ? events : []
  return list.map((e) => {
    const time = thaiClock(e.at)
    switch (e.type) {
      case 'route-suggested':
        return `${time} ระบบเสนอเส้นทาง "${routeName(e.suggested)}" (ยังไม่บันทึก รอผู้เรียนตัดสินใจ)`
      case 'route-chosen':
        return e.chosen === e.suggested
          ? `${time} ผู้เรียนรับข้อเสนอ เลือกเส้นทาง "${routeName(e.chosen)}" ตามที่ระบบเสนอ`
          : `${time} ผู้เรียนเปลี่ยนเอง จาก "${routeName(e.suggested)}" ที่ระบบเสนอ ไปเป็น "${routeName(e.chosen)}"`
      case 'route-switched':
        return `${time} ผู้เรียนสลับเส้นทางกลางคัน จาก "${routeName(e.from)}" ไป "${routeName(e.to)}" (ไม่หักดาว ความคืบหน้าไม่รีเซ็ต)`
      case 'level-suggested':
        return `${time} ระบบเสนอระดับตัวช่วยที่ ${e.suggested}`
      case 'level-chosen':
        return e.chosen === e.suggested
          ? `${time} ผู้เรียนรับระดับตัวช่วยที่ ${e.chosen} ตามที่ระบบเสนอ`
          : `${time} ผู้เรียนเปลี่ยนระดับตัวช่วยเอง จากที่ระบบเสนอ ${e.suggested} เป็น ${e.chosen}`
      case 'goal-raised':
        return `${time} ผู้เรียนยกเป้าหมายเอง จาก "${goalName(e.from)}" เป็น "${goalName(e.to)}"`
      case 'hint-used':
        return e.triggeredBy === 'student'
          ? `${time} ผู้เรียนกดขอคำใบ้เอง ระดับ ${e.level}`
          : `${time} ระบบยื่นคำใบ้ระดับ ${e.level} ให้`
      case 'coach-flagged':
        return `${time} ระบบขึ้นธงชวนครูเข้ามาช่วย เพราะ${CAUSE_TEXT[e.cause]}`
      case 'mission-passed':
        return `${time} ผ่านภารกิจ ${e.missionId} ได้ ${e.stars} ดาว`
    }
  })
}

import type { Json } from '@/lib/db/types'
import {
  type LearningRoute,
  type MissionId,
  type MissionProgress,
  type Profile,
  GOAL_LEVEL_STARS,
  getOrCreateMissionProgress,
  getProfile,
  listMissionProgress,
  listProgress,
  listReflections,
  listRouteChanges,
  listSubmissions,
  logEvent,
  listSkips,
  recordAttempt,
  recordLevelOverride,
  recordHint,
  recordProgress,
  recordRouteChange,
  recordSkip,
  recalcStudentStars,
  setMissionStarsAndRecalc,
  saveReflection as saveReflectionRow,
  setConfidence,
  saveSuggestion as saveSuggestionRow,
  setSelfGoal,
  upsertProfile,
} from '@/lib/db/repo'
import type { ScaffoldLevel, StoredShopProfile } from '@/components/shop-profile'

/**
 * สถานะเกมทั้งหมด — **อ่าน/เขียนฐานข้อมูลจริงเท่านั้น**
 *
 * ของเดิมเก็บใน Map ในหน่วยความจำ (components/server/progress-store.ts) ซึ่งมี 2 ปัญหาใหญ่ตามรีวิว R5
 * 1. แผงครูอ่านจาก DB จึงขึ้น 0 คนทั้งคาบ เพราะไม่มีใครเขียน DB เลย
 * 2. นักเรียนล้างคุกกี้ = ได้ state เปล่า ดาวและตัวนับคำใบ้รีเซ็ตหมด
 * ตอนนี้ทุกอย่างผูกกับ students.id ใน DB คุกกี้หายก็เข้าใหม่ด้วยรหัสห้อง + ชื่อเล่น + PIN แล้วได้ของเดิมคืน
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น ห้าม import จาก client component
 * ⚠️ studentId ต้องมาจาก session cookie (dbq_student) เท่านั้น ห้ามรับจาก body หรือ query
 */

/* ---------- โปรไฟล์ร้าน ---------- */

/**
 * โปรไฟล์ร้านอยู่ในคอลัมน์จริงของตาราง profiles แล้ว
 * (is_registered_company · audience · domain_name — migration 20260930000000)
 * ของเดิมเคยฝากไว้ใน readiness->'shop' ชั่วคราว ตอนนี้เลิกใช้แล้ว แต่ยังอ่านของเก่าเผื่อแถวที่บันทึกไว้ก่อนย้าย
 */
const LEGACY_SHOP_KEY = 'shop'

type ReadinessBag = Record<string, unknown>

function readinessOf(profile: Profile | null): ReadinessBag {
  const value = profile?.readiness
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ReadinessBag) : {}
}

export async function loadShopProfile(studentId: string): Promise<StoredShopProfile | null> {
  const profile = await getProfile(studentId)
  if (!profile) return null

  const audience = profile.audience
  if (
    typeof profile.domain_name === 'string' &&
    typeof profile.is_registered_company === 'boolean' &&
    (audience === 'thai' || audience === 'international')
  ) {
    return {
      shopName: profile.business_name ?? '',
      businessTypeId: profile.business_type ?? '',
      domainName: profile.domain_name,
      isRegisteredCompany: profile.is_registered_company,
      audience,
    }
  }

  // แถวเก่าที่บันทึกก่อนมีคอลัมน์จริง
  const legacy = readinessOf(profile)[LEGACY_SHOP_KEY]
  if (!legacy || typeof legacy !== 'object') return null
  const bag = legacy as Record<string, unknown>
  if (
    typeof bag.domainName !== 'string' ||
    typeof bag.isRegisteredCompany !== 'boolean' ||
    (bag.audience !== 'thai' && bag.audience !== 'international')
  ) {
    return null
  }
  return {
    shopName: profile.business_name ?? (typeof bag.shopName === 'string' ? bag.shopName : ''),
    businessTypeId: profile.business_type ?? '',
    domainName: bag.domainName,
    isRegisteredCompany: bag.isRegisteredCompany,
    audience: bag.audience,
  }
}

/**
 * โปรไฟล์ล็อกทันทีที่เริ่มภารกิจแรกหรือยื่นที่สถานี B ครั้งแรก
 * เหตุผล: สถานี B ตัดสินผ่าน/ไม่ผ่านจาก isRegisteredCompany และ audience
 * ถ้าแก้ได้ตลอดเวลา นักเรียนก็ยื่นไม่ผ่าน แล้วกลับไปแก้โปรไฟล์ให้ผ่าน (ช่องโหว่ R5-H4)
 */
export async function isShopProfileLocked(studentId: string): Promise<boolean> {
  const [missions, progress] = await Promise.all([
    listMissionProgress(studentId),
    listProgress(studentId),
  ])
  return (
    missions.some((m) => m.attempts > 0) ||
    progress.some((p) => p.station === 'B' && p.attempts > 0)
  )
}

export async function saveShopProfile(
  studentId: string,
  shop: StoredShopProfile,
): Promise<Profile> {
  const saved = await upsertProfile(studentId, {
    business_name: shop.shopName,
    business_type: shop.businessTypeId,
    domain_name: shop.domainName,
    is_registered_company: shop.isRegisteredCompany,
    audience: shop.audience,
  })
  await logEvent(studentId, 'shop-profile-set', { ...shop } as NonNullable<Json>)
  return saved
}

/* ---------- ภารกิจย่อย m1-m4 ---------- */

export type MissionRowDb = {
  missionId: string
  attempts: number
  hintsUsed: number
  stars: number
  passed: boolean
  channelUsed: LearningRoute | null
}

function toRow(row: MissionProgress): MissionRowDb {
  return {
    missionId: row.mission_id,
    attempts: row.attempts,
    hintsUsed: row.hints_used,
    stars: row.stars,
    passed: row.passed_at !== null,
    channelUsed: (row.channel_used as LearningRoute | null) ?? null,
  }
}

export async function loadMissionRow(
  studentId: string,
  missionId: MissionId,
): Promise<MissionRowDb> {
  return toRow(await getOrCreateMissionProgress(studentId, missionId))
}

export async function loadAllMissionRows(studentId: string): Promise<Map<string, MissionRowDb>> {
  const rows = await listMissionProgress(studentId)
  return new Map(rows.map((r) => [r.mission_id, toRow(r)]))
}

/** ตอบข้อ check 1 ครั้ง — บวก attempts ใน SQL statement เดียว (atomic) */
export async function recordMissionAnswer(
  studentId: string,
  missionId: MissionId,
  correct: boolean,
  channel: LearningRoute | null,
): Promise<MissionRowDb> {
  return toRow(await recordAttempt(studentId, missionId, { correct, channelUsed: channel }))
}

/**
 * ขอคำใบ้ 1 ใบ — บวก hints_used อย่างเดียว ไม่บวก attempts
 * ใช้ RPC increment_mission_hint ที่ฝั่ง DB ทำให้ (atomic) เปิดสองแท็บกดพร้อมกันก็ไม่นับหาย
 */
export async function recordMissionHintDb(
  studentId: string,
  missionId: MissionId,
  maxHints: number,
): Promise<MissionRowDb> {
  return toRow(await recordHint(studentId, missionId, maxHints))
}

/**
 * ให้ดาวภารกิจ แล้ว **ต้องเรียก recalc ทุกครั้ง** ไม่งั้น profiles.earned_stars ค้าง
 * (ฝั่ง DB เตือนไว้ชัด — ใช้ setMissionStarsAndRecalc ที่ทำสองอย่างในตัวเดียว)
 */
export async function setMissionStarsDb(
  studentId: string,
  missionId: MissionId,
  stars: number,
): Promise<void> {
  await setMissionStarsAndRecalc(studentId, missionId, stars)
}

/** ผู้เรียนกดข้ามภารกิจ — ไม่มีเงื่อนไขห้าม ลงตาราง mission_skips ให้แผงครูเห็น */
export async function recordMissionSkipDb(
  studentId: string,
  missionId: MissionId | 'boss',
  reason: string | null = null,
): Promise<void> {
  await recordSkip(studentId, missionId, reason)
}

export async function listSkippedMissions(studentId: string): Promise<string[]> {
  return (await listSkips(studentId)).map((s) => s.mission_id)
}



/* ---------- ดาวรวมของทั้งคาบ ---------- */

/** เพดานดาวของภารกิจใหญ่ (ตรงกับ starBudget.bigMissionMax ใน content/self-profile.json) */
export const BIG_MISSION_MAX_STARS = 3

export interface BigMissionStars {
  stars: number
  /** true = ยังเป็นคะแนนที่ระบบเสนอ ครูยังไม่ได้ยืนยัน */
  pendingTeacher: boolean
  submitted: boolean
}

function scoreOf(value: unknown): { score: number; maxScore: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const bag = value as Record<string, unknown>
  // รูปแบบใหม่เก็บคะแนนถ่วงน้ำหนัก (5-15) รูปแบบเก่าเก็บ score/maxScore
  const score =
    typeof bag.weightedTotal === 'number'
      ? bag.weightedTotal
      : typeof bag.score === 'number'
        ? bag.score
        : null
  if (score === null) return null
  const maxScore =
    typeof bag.weightedMax === 'number' && bag.weightedMax > 0
      ? bag.weightedMax
      : typeof bag.maxScore === 'number' && bag.maxScore > 0
        ? bag.maxScore
        : 3
  return { score, maxScore }
}

/**
 * ดาวของภารกิจใหญ่ — **ให้ทันทีจากคะแนนที่ระบบเสนอ** (มติ master หลัง QA-1)
 * ถ้าครูยืนยันแล้วให้ใช้คะแนนของครูแทนทันที (ปรับขึ้นหรือลงก็ได้)
 * ไม่ให้ 0 รอครูอีกต่อไป เพราะเป้า 10/14 ดาวจะไม่มีทางถึงภายในคาบ
 */
export async function loadBigMissionStars(studentId: string): Promise<BigMissionStars> {
  const [rows, missionRows] = await Promise.all([listSubmissions(studentId), listMissionProgress(studentId)])
  const ceoSubmission = rows.find((r) => r.emphasis_criterion !== null) ?? null

  // CEO teacher-skip has no submission to score, but it is still a completed
  // boss row. Its minimum pass stars are kept in mission_progress like every
  // other teacher-skip so home/map/certificate all read the same state.
  const bossPass = missionRows.find((row) => row.mission_id === 'boss' && row.passed_at !== null)
  if (!ceoSubmission && bossPass) {
    return {
      stars: Math.max(0, Math.min(BIG_MISSION_MAX_STARS, bossPass.stars)),
      pendingTeacher: false,
      submitted: true,
    }
  }
  const ceo = ceoSubmission ?? rows.at(-1) ?? null
  if (!ceo) return { stars: 0, pendingTeacher: false, submitted: false }

  /**
   * ครูยืนยันคะแนนแล้ว = ใช้ดาวที่ครูตัดสินตรง ๆ (ฝั่ง confirm-score คิด stars จาก starBands ให้แล้ว)
   * ถ้าไม่ได้ส่ง stars มาค่อยคิดจากสัดส่วนคะแนน
   */
  const teacherBag =
    ceo.teacher_confirmed_scores &&
    typeof ceo.teacher_confirmed_scores === 'object' &&
    !Array.isArray(ceo.teacher_confirmed_scores)
      ? (ceo.teacher_confirmed_scores as Record<string, unknown>)
      : null
  if (teacherBag && typeof teacherBag.stars === 'number') {
    return {
      stars: Math.max(0, Math.min(BIG_MISSION_MAX_STARS, Math.round(teacherBag.stars))),
      pendingTeacher: false,
      submitted: true,
    }
  }

  const teacher = scoreOf(ceo.teacher_confirmed_scores)

  /**
   * ลำดับความสำคัญของดาวด่านบอส: ครูยืนยัน > คะแนนจากกฎ (ที่นักเรียนเห็นตอนกดส่ง) > อื่น ๆ
   * ผลที่ AI เสนอมาทีหลังอยู่ใต้ `aiProposed` เท่านั้น **ห้ามเอามาคิดดาว**
   * ไม่งั้นดาวของนักเรียนจะเปลี่ยนเองหลังจากที่เขาเห็นไปแล้ว
   */
  const aiBag =
    ceo.ai_scores && typeof ceo.ai_scores === 'object' && !Array.isArray(ceo.ai_scores)
      ? (ceo.ai_scores as Record<string, unknown>)
      : null
  const ruleBag =
    aiBag?.ruleScores && typeof aiBag.ruleScores === 'object' && !Array.isArray(aiBag.ruleScores)
      ? (aiBag.ruleScores as Record<string, unknown>)
      : null
  if (!teacher && ruleBag && typeof ruleBag.stars === 'number') {
    return {
      stars: Math.max(0, Math.min(BIG_MISSION_MAX_STARS, Math.round(ruleBag.stars))),
      pendingTeacher: true,
      submitted: true,
    }
  }

  const proposed = scoreOf(ceo.ai_scores)
  const picked = teacher ?? proposed
  if (!picked) return { stars: 0, pendingTeacher: teacher === null, submitted: true }

  const ratio = Math.max(0, Math.min(1, picked.score / picked.maxScore))
  return {
    stars: Math.round(ratio * BIG_MISSION_MAX_STARS),
    pendingTeacher: teacher === null,
    submitted: true,
  }
}

/**
 * เขียนดาวรวมลง profiles.earned_stars ทุกครั้งที่ดาวเปลี่ยน
 * เพื่อให้เลขบนจอนักเรียนกับเลขบนแผงครู (ซึ่งอ่านคอลัมน์นี้) ตรงกันเสมอ (QA-1 พัง-1)
 *
 * ดาวของภารกิจใหญ่เก็บเป็นแถว mission_progress ของ 'boss' เพื่อให้ RPC recalc_student_stars
 * (ซึ่งบวกจาก mission_progress อย่างเดียว) นับรวมให้เอง ไม่ต้องเขียน earned_stars เองอีก
 */
export async function syncEarnedStars(studentId: string): Promise<number> {
  const big = await loadBigMissionStars(studentId)
  if (big.submitted) {
    await setMissionStarsAndRecalc(studentId, 'boss', big.stars)
  }
  const profile = await recalcStudentStars(studentId)
  return profile.earned_stars
}

/* ---------- สถานี B ---------- */

export type StationBRow = { attempts: number; hintsUsed: number; completed: boolean }

export async function loadStationBDb(studentId: string): Promise<StationBRow> {
  const rows = await listProgress(studentId)
  const row = rows.find((r) => r.station === 'B')
  return {
    attempts: row?.attempts ?? 0,
    hintsUsed: row?.hints_used ?? 0,
    completed: row?.status === 'completed',
  }
}

export async function recordStationBAttemptDb(
  studentId: string,
  accepted: boolean,
): Promise<StationBRow> {
  const before = await loadStationBDb(studentId)
  await recordProgress(studentId, 'B', {
    attempts: before.attempts + 1,
    hints_used: before.hintsUsed,
    status: accepted ? 'completed' : 'in_progress',
    completed_at: accepted ? new Date().toISOString() : null,
  })
  return { attempts: before.attempts + 1, hintsUsed: before.hintsUsed, completed: accepted }
}

export async function recordStationBHintDb(studentId: string): Promise<StationBRow> {
  const before = await loadStationBDb(studentId)
  await recordProgress(studentId, 'B', {
    attempts: before.attempts,
    hints_used: before.hintsUsed + 1,
    status: before.completed ? 'completed' : 'in_progress',
  })
  return { ...before, hintsUsed: before.hintsUsed + 1 }
}

/* ---------- ขั้นที่ 2 รู้จักตัวเอง ---------- */

export interface SelfProfileDb {
  talentId: string | null
  suggestedRoute: LearningRoute | null
  suggestedLevel: ScaffoldLevel | null
  route: LearningRoute | null
  routeChosenBy: 'system' | 'student' | null
  scaffoldLevel: ScaffoldLevel
  goalId: string | null
  goalStars: number | null
  /** เป้าหมายที่ผู้เรียนพิมพ์เอง — คนละเรื่องกับ goalId ที่เลือกจากรายการ ระบบเสนอได้ เขาตั้งเองได้ */
  ownGoalText: string | null
  earnedStars: number
  prefAnswers: Record<string, string>
  routeReason: string | null
  levelReason: string | null
  weakObjectives: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export async function loadSelfProfileDb(studentId: string): Promise<SelfProfileDb> {
  const profile = await getProfile(studentId)
  const bag = asRecord(readinessOf(profile).suggestion)
  const level = profile?.scaffold_level
  return {
    talentId: profile?.talent_id ?? null,
    suggestedRoute: (profile?.channel_suggested as LearningRoute | null) ?? null,
    suggestedLevel: (profile?.level_suggested as ScaffoldLevel | null) ?? null,
    route: (profile?.learning_route as LearningRoute | null) ?? null,
    routeChosenBy: (profile?.channel_chosen_by as 'system' | 'student' | null) ?? null,
    scaffoldLevel: (level === 1 || level === 2 || level === 3 ? level : 1) as ScaffoldLevel,
    goalId: profile?.goal_id ?? null,
    goalStars: profile?.goal_stars ?? null,
    ownGoalText: profile?.own_goal_text ?? null,
    earnedStars: profile?.earned_stars ?? 0,
    prefAnswers: Object.fromEntries(
      Object.entries(asRecord(bag.prefAnswers)).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
    routeReason: typeof bag.routeReason === 'string' ? bag.routeReason : null,
    levelReason: typeof bag.levelReason === 'string' ? bag.levelReason : null,
    weakObjectives: Array.isArray(bag.weakObjectives)
      ? bag.weakObjectives.filter((v): v is string => typeof v === 'string')
      : [],
  }
}

/** เก็บ "ข้อเสนอของระบบ" — ยังไม่ใช่ค่าที่ใช้จริงจนกว่าผู้เรียนจะกดเลือก */
export async function saveSuggestionDb(
  studentId: string,
  input: {
    prefAnswers: Record<string, string>
    talentId: string | null
    suggestedRoute: LearningRoute
    suggestedLevel: ScaffoldLevel
    routeReason: string
    levelReason: string
    weakObjectives: string[]
  },
): Promise<void> {
  await saveSuggestionRow(studentId, {
    channel: input.suggestedRoute,
    level: input.suggestedLevel,
  })
  const profile = await getProfile(studentId)
  const readiness = {
    ...readinessOf(profile),
    suggestion: {
      prefAnswers: input.prefAnswers,
      routeReason: input.routeReason,
      levelReason: input.levelReason,
      weakObjectives: input.weakObjectives,
    },
  }
  await upsertProfile(studentId, {
    talent_id: input.talentId,
    readiness: readiness as NonNullable<Json>,
  })
}

/**
 * เก็บผล **เช็กความเข้าใจ 4 ข้อ (S-05)** + ระดับตัวช่วยที่ระบบเสนอจากผลนั้น
 *
 * ⚠️ ห้ามเขียนลง `pre_test_score` เด็ดขาด — คอลัมน์นั้นเป็นของ **แบบทดสอบวิจัย 10 ข้อ (T-12)**
 *    ถ้าเอามาปนกัน ตัวเลข E1/E2 กับคะแนนพัฒนาการในรายงานจะผิดทั้งชุด
 */
export async function saveCheckResultDb(
  studentId: string,
  input: {
    score: number
    total: number
    setId: string
    suggestedLevel: ScaffoldLevel
    levelReason: string
    weakObjectives: string[]
  },
): Promise<void> {
  await saveSuggestionRow(studentId, { level: input.suggestedLevel })
  const profile = await getProfile(studentId)
  const current = readinessOf(profile)
  const readiness = {
    ...current,
    check: { score: input.score, total: input.total, setId: input.setId },
    suggestion: {
      ...asRecord(current.suggestion),
      levelReason: input.levelReason,
      weakObjectives: input.weakObjectives,
    },
  }
  await upsertProfile(studentId, {
    // ตั้งระดับตัวช่วยตามที่ระบบเสนอไว้ก่อน ผู้เรียนกดเปลี่ยนเองได้ที่ /profile
    scaffold_level: input.suggestedLevel,
    readiness: readiness as NonNullable<Json>,
  })
}

/** เก็บผลแบบทดสอบก่อนเรียน + ระดับตัวช่วยที่ระบบเสนอจากผลนั้น */
export async function savePretestDb(
  studentId: string,
  input: { score: number; suggestedLevel: ScaffoldLevel; weakObjectives: string[]; levelReason: string },
): Promise<void> {
  await saveSuggestionRow(studentId, { level: input.suggestedLevel })
  const profile = await getProfile(studentId)
  const readiness = {
    ...readinessOf(profile),
    pretest: {
      score: input.score,
      weakObjectives: input.weakObjectives,
      levelReason: input.levelReason,
    },
  }
  await upsertProfile(studentId, {
    pre_test_score: input.score,
    // ตั้งระดับตัวช่วยตามที่ระบบเสนอไว้ก่อน ผู้เรียนกดเปลี่ยนเองได้ที่ /profile
    scaffold_level: input.suggestedLevel,
    readiness: readiness as NonNullable<Json>,
  })
}

/** อ่านผลแบบทดสอบก่อนเรียนที่บันทึกไว้ (null = ยังไม่ได้ทำ) */
export async function loadPretestDb(
  studentId: string,
): Promise<{ score: number; weakObjectives: string[]; levelReason: string } | null> {
  const profile = await getProfile(studentId)
  if (!profile || profile.pre_test_score === null) return null
  const bag = asRecord(readinessOf(profile).pretest)
  return {
    score: profile.pre_test_score,
    weakObjectives: Array.isArray(bag.weakObjectives)
      ? bag.weakObjectives.filter((v): v is string => typeof v === 'string')
      : [],
    levelReason: typeof bag.levelReason === 'string' ? bag.levelReason : '',
  }
}

/**
 * ผู้เรียนเลือกช่องทางเอง — รับได้ทุกช่องทางเสมอ ไม่มีการปฏิเสธ
 * เก็บทั้งช่องทางที่ใช้จริงและ "ใครเป็นคนเลือก" เป็นหลักฐาน
 */
export async function chooseRouteDb(
  studentId: string,
  toRoute: LearningRoute,
  chosenBy: 'system' | 'student',
  missionId: MissionId | null = null,
): Promise<void> {
  const profile = await getProfile(studentId)
  const from = (profile?.learning_route as LearningRoute | null) ?? null
  await recordRouteChange(studentId, missionId, from, toRoute, chosenBy)
  await upsertProfile(studentId, { channel_chosen_by: chosenBy })
}

export async function chooseLevelDb(
  studentId: string,
  level: ScaffoldLevel,
  chosenBy: 'system' | 'student',
): Promise<void> {
  if (chosenBy === 'student') {
    await recordLevelOverride(studentId, level)
  } else {
    await upsertProfile(studentId, { scaffold_level: level })
  }
}

export type GoalSaveResult = { ok: true; goalStars: number } | { ok: false; message: string }

export async function chooseGoalDb(
  studentId: string,
  goalId: string,
  goalLevel: 1 | 2 | 3,
): Promise<GoalSaveResult> {
  const profile = await getProfile(studentId)
  const goalStars = GOAL_LEVEL_STARS[goalLevel]
  if (profile?.goal_stars != null && goalStars < profile.goal_stars) {
    return {
      ok: false,
      message: `ระหว่างคาบยกเป้าหมายให้สูงขึ้นได้อย่างเดียว ตอนนี้ตั้งไว้ ${profile.goal_stars} ดาว`,
    }
  }
  await setSelfGoal(studentId, { goalId, goalStars, selfGoalLevel: goalLevel })
  return { ok: true, goalStars }
}

/**
 * เป้าหมายที่ผู้เรียนพิมพ์เอง — หัวใจของ Personalized Learning "ระบบเสนอได้ แต่ผู้เรียนตั้งเป้าเอง"
 *
 * ⚠️ เก็บ **ข้อความเดิมทุกตัวอักษร** ห้ามตัด ห้ามแก้ ห้ามลบเงียบ ๆ
 *    ด่านกรองคำอยู่ที่ route (components/server/moderation.ts) ก่อนจะเรียกฟังก์ชันนี้
 *    ไม่ผ่านด่าน = ไม่เรียกฟังก์ชันนี้เลย แล้วคืนข้อความเดิมกลับไปให้เจ้าตัวเห็น
 * ⚠️ ไม่แตะ goal_id / goal_stars — เป้าที่พิมพ์เองกับเป้าที่เลือกจากรายการอยู่คู่กันได้
 */
export async function saveOwnGoalTextDb(
  studentId: string,
  text: string | null,
): Promise<string | null> {
  const value = text === null || text.trim().length === 0 ? null : text
  // saveSuggestionRow เป็นที่เดียวที่เขียนคอลัมน์ own_goal_text อยู่แล้ว ส่งเฉพาะฟิลด์นี้ฟิลด์เดียว
  await saveSuggestionRow(studentId, { ownGoalText: value })
  return value
}

export async function countRouteSwitches(studentId: string, missionId?: string): Promise<number> {
  const changes = await listRouteChanges(studentId)
  const relevant = missionId ? changes.filter((c) => c.mission_id === missionId) : changes
  return relevant.filter((c) => c.from_route !== null && c.from_route !== c.to_route).length
}

/**
 * บันทึก "ความมั่นใจ" และ "ผลถูก/ผิด" รายวัตถุประสงค์
 * แผงครูอ่านสองค่านี้ในคิวรีเดียว (profiles.confidence / profiles.readiness) แล้วคิดธง calibration เอง
 */
export async function saveObjectiveOutcome(
  studentId: string,
  objectiveId: string,
  input: { confidence?: number; correct: boolean },
): Promise<void> {
  if (typeof input.confidence === 'number') {
    await setConfidence(studentId, { [objectiveId]: input.confidence })
  }
  const profile = await getProfile(studentId)
  const readiness = { ...readinessOf(profile), [objectiveId]: input.correct }
  await upsertProfile(studentId, { readiness: readiness as NonNullable<Json> })
}

/* ---------- ทบทวนตัวเอง ---------- */

export async function loadReflectionDb(studentId: string): Promise<Record<string, string>> {
  const rows = await listReflections(studentId)
  return Object.fromEntries(rows.map((r) => [r.question_id, r.answer_text]))
}

export async function saveReflectionDb(
  studentId: string,
  answers: Record<string, string>,
): Promise<void> {
  for (const [questionId, text] of Object.entries(answers)) {
    await saveReflectionRow(studentId, questionId, text)
  }
}

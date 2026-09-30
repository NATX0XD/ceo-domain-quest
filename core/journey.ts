/**
 * ตัวประกอบร่างเส้นทางหนึ่งคาบเรียน — ต่อชิ้นส่วนที่มีอยู่แล้วให้เป็นเส้นทางเดียวจากต้นจนจบ
 *
 * ไม่มีกฎใหม่ในไฟล์นี้ ทุกการตัดสินใจเรียกของเดิม:
 * core/personalize.ts (เสนอช่องทาง · ระดับตัวช่วย · ดาว · เป้าหมาย) และ core/report.ts (สรุปผล · ใบประกาศ)
 * มีแค่ 2 อย่างที่ไฟล์นี้ทำเอง เพราะยังไม่มีที่ไหนทำ:
 * 1. แปลงคะแนนรูบริกของภารกิจใหญ่เป็นดาว ตามตาราง rubricToStars ใน content/big-mission.json
 * 2. เดินสคริปต์ของผู้เรียน 1 คนตั้งแต่ตอบแบบสำรวจจนถึงใบประกาศ
 *
 * ตรรกะล้วน ไม่ import React / Next / ฐานข้อมูล / fetch และไม่เรียก Date.now()
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น เพราะต่อสายไปถึง core/quiz.ts ที่โหลดไฟล์เฉลย
 */
import bigMissionJson from '../content/big-mission.json' with { type: 'json' }
import {
  WEIGHTED_MAX,
  resolveEmphasisDimension,
  starsFromWeighted,
  weightedTotal,
} from '../lib/ai/rubric'
import selfProfileJson from '../content/self-profile.json' with { type: 'json' }
import {
  type ChannelAttempt,
  type ChannelRanking,
  type ChosenBy,
  type RouteId,
  type TraceEvent,
  adaptiveTrace,
  applyLearnerChoice,
  bonusUnlocked,
  canRaiseGoal,
  goalStarTarget,
  rankChannelsByEffectiveness,
  recommendLevel,
  recommendRoute,
  type SkipBy,
  type SkipOutcome,
  evaluateSkip,
  starsFor,
} from './personalize'
import {
  type RubricBreakdown,
  type CertificateData,
  type MissionInput,
  type StudentReport,
  certificateData,
  encouragement,
  studentReport,
} from './report'

const starScale = bigMissionJson.starScale as {
  missionStarsMax: number
  bigMissionStarsMax: number
  totalStarsMax: number
}

/**
 * ช่วงคะแนนที่แปลงเป็นดาว คะแนนถ่วงน้ำหนักต่ำสุด/สูงสุด และตัวแปลงเป็นดาว
 * **อ้าง lib/ai/rubric.ts ที่เดียว** ไฟล์นี้เคยคัดลอกทั้งตารางและสูตรมาไว้เอง
 * ซึ่งแปลว่าเส้นทางจำลองกับเส้นทางจริงแยกกันเดินได้เงียบ ๆ เมื่อไฟล์เนื้อหาเปลี่ยน
 * (ของเดิมยังฝัง "ไม่ส่งงาน = 0 ดาว" ไว้ในโค้ด ทั้งที่ค่านั้นอยู่ในไฟล์เนื้อหาแล้ว)
 */

const preTestMap = selfProfileJson.preTestMap as ReadonlyArray<{
  objectiveId: string
  quizId: string
}>

export const BIG_MISSION_ID = bigMissionJson.id as string
export const TOTAL_STARS_MAX = starScale.totalStarsMax

/** ผลตรวจชุดก่อนเรียนแตกเป็นรายวัตถุประสงค์ ใช้ป้อน recommendRoute */
export function readinessFromWrongIds(wrongIds: string[]): Record<string, boolean> {
  const wrong = new Set(wrongIds ?? [])
  const readiness: Record<string, boolean> = {}
  for (const row of preTestMap) readiness[row.objectiveId] = !wrong.has(row.quizId)
  return readiness
}

export interface MissionAttemptScript {
  missionId: string
  objectiveId: string
  title?: string
  /**
   * ข้ามภารกิจนี้ — ต้องเข้าเงื่อนไขตาม content/rubric.json คีย์ missionStars.skip
   * ผู้เรียนข้ามเองได้เมื่อตอบข้อที่วัดเรื่องนี้ถูกและบอกว่ามั่นใจตอนเช็กความเข้าใจ
   * ครูสั่งให้ข้ามได้เสมอ (T-06) แต่ได้ 0 ดาว
   */
  skipped?: boolean
  /** ใครเป็นคนสั่งข้าม ไม่ใส่ถือว่าผู้เรียนกดเอง */
  skippedBy?: SkipBy
  /** ตอบข้อที่วัดเรื่องนี้ถูกตอนเช็กความเข้าใจหรือไม่ ไม่ใส่จะอ่านจาก preWrongIds ให้เอง */
  checkCorrect?: boolean
  /** ความมั่นใจที่บอกไว้ในข้อนั้น 1-3 ตาม confidenceScale */
  checkConfidence?: number
  attempts?: number
  hintsUsed?: number
  passed?: boolean
  /** ช่องทางที่ใช้จริงในภารกิจนี้ ไม่ใส่จะใช้ช่องทางที่เลือกไว้ตอนต้น */
  route?: RouteId
  routeSwitches?: number
  /** เวลาที่ใช้กับภารกิจนี้ ใช้จัดอันดับว่าช่องทางไหนได้ผลจริง */
  elapsedSeconds?: number
}

/** คะแนนรายด้านที่ครูหรือ AI ให้ไว้ ใช้แทนการกรอกคะแนนถ่วงน้ำหนักเอง */
export interface BigMissionRubricInput {
  /** รหัสด้าน -> คะแนน 1-3 ตาม content/rubric.json */
  scores: Record<string, number>
  /** ด้านที่ผู้เรียนขอให้ถ่วง 2 เท่า รับได้ทั้ง emphasis-* และ dim-* */
  emphasisCriterion?: string | null
  /** รายละเอียดรายด้านถ้ามี (หลักฐานและข้อเสนอแนะ) ใช้แสดงบนหน้าสรุปผล */
  dimensions?: RubricBreakdown['dimensions']
}

export interface JourneyScript {
  studentId: string
  nickname: string
  shopName: string
  domainName: string
  tldSuffix?: string
  /** คำตอบแบบสำรวจความถนัด 5 ข้อ */
  prefAnswers: Record<string, string>
  /** ช่องทางที่ผู้เรียนเลือกจริง ไม่ใส่ = รับตามที่ระบบเสนอ */
  routeChosen?: RouteId
  preScore: number
  preWrongIds: string[]
  postScore: number
  /** เป้าหมายที่ตั้งตอนต้นคาบ */
  goal: string | number
  /** เป้าหมายใหม่ที่กดยกกลางคัน ระบบยอมให้ยกขึ้นเท่านั้น */
  raiseGoalTo?: string | number
  missions: MissionAttemptScript[]
  bigMission?: {
    submitted: boolean
    /** ข้อเสนอจาก AI ที่ตรวจเบื้องหลังทีหลัง ครูเป็นคนตัดสินว่าจะใช้ไหม */
    aiSuggestion?: RubricBreakdown | null
    /** คะแนนถ่วงน้ำหนักรวม ใส่ตรง ๆ ได้ถ้ามีอยู่แล้ว */
    rubricTotal?: number
    /** หรือใส่คะแนนรายด้าน แล้วให้ระบบถ่วงน้ำหนักและแปลงเป็นดาวให้เอง */
    rubric?: BigMissionRubricInput
  }
  /** คำตอบประเมินตนเองและสะท้อนคิด เก็บไว้เป็นหลักฐาน ไม่มีคะแนน */
  selfAssessment?: Record<string, string>
  reflection?: Record<string, string>
  startedAt: number
  finishedAt: number
}

export interface JourneyResult {
  report: StudentReport
  certificate: CertificateData
  encouragement: string
  /** ช่องทางที่ระบบเสนอตอนต้นคาบ */
  routeSuggested: RouteId
  routeChosen: RouteId
  routeChosenBy: ChosenBy
  /** ผู้เรียนเลือกต่างจากที่ระบบเสนอหรือไม่ */
  overrodeSuggestion: boolean
  suggestedLevel: 1 | 2 | 3
  weakObjectives: string[]
  /** ภารกิจที่ถูกข้ามทั้งหมด รายงานต้องเห็น ไม่ใช่ทำเหมือนไม่เคยมี */
  skippedMissionIds: string[]
  /** ข้ามเองโดยผ่านเงื่อนไข = ได้ดาวเต็ม นับว่าผ่าน */
  skippedEarnedMissionIds: string[]
  /** ครูสั่งให้ข้าม (T-06) = 0 ดาว แต่นับว่าผ่านจุดประสงค์ — **ห้ามปนกับกลุ่มบน** */
  skippedByTeacherMissionIds: string[]
  /** กดข้ามแล้วระบบปฏิเสธเพราะยังไม่เข้าเงื่อนไข ยังต้องทำภารกิจนั้นอยู่ */
  skipRejectedMissionIds: string[]
  goalStart: number
  goalFinal: number
  goalRaised: boolean
  bigMissionStars: number
  /** คะแนนรายด้านของภารกิจใหญ่ ถ้าส่งเข้ามา null = ยังไม่ได้ตรวจรายด้าน */
  rubric: RubricBreakdown | null
  /** ภารกิจเสริมถูกเปิดให้หรือไม่ (ตั้งเป้าสูง หรือทำถึงเป้าที่ตั้งเองแล้ว) — เปิดเพิ่ม ไม่ได้บังคับทำ */
  bonusUnlocked: boolean
  /** ลำดับช่องทางที่ได้ผลจริงกับผู้เรียนคนนี้ ใช้เสนอก่อนในภารกิจถัดไป ครบทุกช่องทางเสมอ */
  channelRanking: ChannelRanking[]
  /** คำตอบประเมินตนเองที่เก็บไว้ ไม่มีคะแนน */
  selfAssessment: Record<string, string>
  reflection: Record<string, string>
  trace: string[]
}

/**
 * @wired-optional เครื่องจำลองทั้งคาบสำหรับเทสต์ ไม่ใช่เส้นทางที่ผู้เรียนเดินจริง
 *   ของจริงเดินผ่าน app/api ทีละก้าว ไฟล์นี้ต่อชิ้นส่วนเดิมให้ครบวงเพื่อพิสูจน์ว่าไม่มีจุดตัน
 *   ถ้าลบ จะไม่เหลือเทสต์ที่เดินตั้งแต่แบบสำรวจจนถึงใบประกาศในครั้งเดียว
 */
/**
 * เดินเส้นทางของผู้เรียน 1 คนตั้งแต่ตอบแบบสำรวจจนถึงใบประกาศ
 * ทุกขั้นเรียกฟังก์ชันจริงจาก core/ และอ่านเนื้อหาจริงจาก content/
 */
export function runJourney(script: JourneyScript): JourneyResult {
  // 1. รู้จักตัวเอง — ระบบเสนอช่องทาง ผู้เรียนเป็นคนเลือก
  const readiness = readinessFromWrongIds(script.preWrongIds)
  const routeSuggestion = recommendRoute(script.prefAnswers, readiness)
  const chosenRoute = script.routeChosen ?? routeSuggestion.suggested
  const choice = applyLearnerChoice(routeSuggestion.suggested, chosenRoute, script.startedAt)

  // 2. ระดับตัวช่วยจากผลก่อนเรียน
  const level = recommendLevel({
    score: script.preScore,
    total: preTestMap.length,
    wrongIds: script.preWrongIds,
  })

  // 3. เป้าหมาย — ยกขึ้นได้ ลดไม่ได้
  const goalStart = goalStarTarget(script.goal) ?? 0
  const wantsRaise = script.raiseGoalTo !== undefined
  const goalRaised = wantsRaise && canRaiseGoal(script.goal, script.raiseGoalTo!)
  const goalFinal = goalRaised ? (goalStarTarget(script.raiseGoalTo!) ?? goalStart) : goalStart

  // 4. ภารกิจย่อย — ข้ามได้ ผิดได้ ขอคำใบ้ได้ สลับช่องทางได้ ไม่มีการล็อก
  const skippedMissionIds: string[] = []
  const skippedEarnedMissionIds: string[] = []
  const skippedByTeacherMissionIds: string[] = []
  const skipRejectedMissionIds: string[] = []

  const missionRows: MissionInput[] = script.missions.map((m) => {
    const route = m.route ?? chosenRoute
    if (m.skipped) {
      const by: SkipBy = m.skippedBy ?? 'student'
      /**
       * ผลเช็กความเข้าใจของเรื่องนี้ — ถ้าสคริปต์ไม่ได้ระบุมา อ่านจาก preWrongIds ให้เอง
       * ความมั่นใจไม่มีค่าตั้งต้นโดยตั้งใจ: ไม่ได้บอกว่ามั่นใจ = ยังข้ามเองไม่ได้
       */
      const decision = evaluateSkip({
        by,
        correct: m.checkCorrect ?? readiness[m.objectiveId] === true,
        confidence: m.checkConfidence,
      })

      skippedMissionIds.push(m.missionId)
      if (decision.outcome === 'earned') skippedEarnedMissionIds.push(m.missionId)
      else if (decision.outcome === 'teacher') skippedByTeacherMissionIds.push(m.missionId)
      else skipRejectedMissionIds.push(m.missionId)

      return {
        missionId: m.missionId,
        objectiveId: m.objectiveId,
        title: m.title,
        // สเปกข้อ 1.6 "ผ่าน M1 (รวมการข้าม)" — ข้ามที่ระบบรับรองแล้วนับว่าผ่านจุดประสงค์
        passed: decision.passed,
        stars: decision.stars,
        skippedBy: decision.allowed ? by : null,
        skipOutcome: decision.outcome as SkipOutcome,
        route,
        routeSwitches: m.routeSwitches,
      }
    }
    const stars = starsFor({
      passed: Boolean(m.passed),
      attempts: m.attempts ?? 1,
      hintsUsed: m.hintsUsed ?? 0,
    })
    return {
      missionId: m.missionId,
      objectiveId: m.objectiveId,
      title: m.title,
      passed: Boolean(m.passed),
      stars,
      route,
      routeSwitches: m.routeSwitches,
    }
  })

  // ช่องทางไหนได้ผลจริงกับผู้เรียนคนนี้ — ใช้เสนอก่อนในภารกิจถัดไป ไม่ตัดช่องทางอื่นทิ้ง
  const channelAttempts: ChannelAttempt[] = script.missions
    .filter((m) => !m.skipped)
    .map((m) => ({
      route: m.route ?? chosenRoute,
      passed: Boolean(m.passed),
      stars: starsFor({
        passed: Boolean(m.passed),
        attempts: m.attempts ?? 1,
        hintsUsed: m.hintsUsed ?? 0,
      }),
      hintsUsed: m.hintsUsed ?? 0,
      elapsedSeconds: m.elapsedSeconds ?? 0,
    }))
  const channelRanking = rankChannelsByEffectiveness(channelAttempts)

  // 5. ภารกิจใหญ่ — นับเป็นอีก 1 แถวเพื่อให้ดาวรวมตรงกับ starScale (12 + 3 = 15)
  const big = script.bigMission
  const submitted = Boolean(big?.submitted)

  /**
   * คะแนนถ่วงน้ำหนักมาได้ 2 ทาง: ใส่ยอดรวมมาตรง ๆ หรือส่งคะแนนรายด้านมาให้ระบบถ่วงเอง
   * สูตรถ่วงน้ำหนักใช้ตัวเดียวกับที่ชั้น AI ใช้ (lib/ai/rubric.ts) ซึ่งอ่านจาก content/rubric.json
   * ไฟล์เดียวกัน จะได้ไม่มีสูตรสองชุดให้เพี้ยนกันทีหลัง
   */
  const bigWeighted = big?.rubric
    ? weightedTotal(big.rubric.scores, big.rubric.emphasisCriterion ?? null)
    : (big?.rubricTotal ?? 0)
  const bigStars = starsFromWeighted(bigWeighted, submitted)

  const bigRubric: RubricBreakdown | null = big?.rubric
    ? {
        dimensions:
          big.rubric.dimensions ??
          Object.entries(big.rubric.scores).map(([id, score]) => ({ id, name: id, score })),
        emphasisDimensionId: resolveEmphasisDimension(big.rubric.emphasisCriterion) ?? null,
        weightedTotal: bigWeighted,
        weightedMax: WEIGHTED_MAX,
        stars: bigStars,
        needsTeacherConfirm: true,
      }
    : null
  const allRows: MissionInput[] = [
    ...missionRows,
    {
      missionId: BIG_MISSION_ID,
      objectiveId: BIG_MISSION_ID,
      title: bigMissionJson.title as string,
      passed: Boolean(big?.submitted),
      stars: bigStars,
      route: chosenRoute,
    },
  ]

  // 6. สรุปผล ใบประกาศ และข้อความให้กำลังใจ
  const report = studentReport(
    {
      studentId: script.studentId,
      nickname: script.nickname,
      shopName: script.shopName,
      domainName: script.domainName,
      tldSuffix: script.tldSuffix,
      goal: goalFinal,
      missions: allRows,
      preScore: script.preScore,
      postScore: script.postScore,
      routeSuggested: routeSuggestion.suggested,
      routeChosen: chosenRoute,
      routeChosenBy: choice.record.chosenBy,
      goalRaisedCount: goalRaised ? 1 : 0,
      rubric: bigRubric,
      rubricAiSuggestion: big?.aiSuggestion ?? null,
      startedAt: script.startedAt,
      finishedAt: script.finishedAt,
      starsMax: TOTAL_STARS_MAX,
    },
    script.finishedAt,
  )

  const events: TraceEvent[] = [
    { type: 'route-suggested', at: script.startedAt, suggested: routeSuggestion.suggested },
    {
      type: 'route-chosen',
      at: script.startedAt,
      suggested: routeSuggestion.suggested,
      chosen: chosenRoute,
    },
    { type: 'level-suggested', at: script.startedAt, suggested: level.suggested },
  ]
  if (goalRaised) {
    events.push({ type: 'goal-raised', at: script.finishedAt, from: goalStart, to: goalFinal })
  }
  for (const row of allRows) {
    if (row.passed) {
      events.push({
        type: 'mission-passed',
        at: script.finishedAt,
        missionId: row.missionId,
        stars: row.stars,
      })
    }
  }

  return {
    report,
    certificate: certificateData(report, script.finishedAt),
    encouragement: encouragement(report),
    routeSuggested: routeSuggestion.suggested,
    routeChosen: chosenRoute,
    routeChosenBy: choice.record.chosenBy,
    overrodeSuggestion: choice.overridden,
    suggestedLevel: level.suggested,
    weakObjectives: level.weakObjectives,
    skippedMissionIds,
    skippedEarnedMissionIds,
    skippedByTeacherMissionIds,
    skipRejectedMissionIds,
    goalStart,
    goalFinal,
    goalRaised,
    bigMissionStars: bigStars,
    rubric: bigRubric,
    bonusUnlocked: bonusUnlocked(goalFinal, report.starsTotal),
    channelRanking,
    selfAssessment: script.selfAssessment ?? {},
    reflection: script.reflection ?? {},
    trace: adaptiveTrace(events),
  }
}

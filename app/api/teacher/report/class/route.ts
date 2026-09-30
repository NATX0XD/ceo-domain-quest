import { NextResponse } from 'next/server'
import missionsJson from '@/content/missions.json'
import surveyJson from '@/content/survey.json'
import { mediaEfficiency, type InClassScoreInput } from '@/core/efficiency'
import {
  classStatistics,
  classSummary,
  objectiveGaps,
  studentReport,
  type RubricBreakdown,
  type StudentReportInput,
} from '@/core/report'
import { descriptive, effectSize, normalizedGain, pairedTTest } from '@/core/statistics'
import type { RouteId } from '@/core/personalize'
import {
  getClassroomReportRaw,
  getOwnedClassroom,
  listClassroomRouteChanges,
  type RawStudentRow,
} from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../../_lib/session-cookie'

/**
 * T-11 รายงานรายห้อง — ตัวเลขสำหรับเอกสารผลการทดลอง
 *
 *   GET /api/teacher/report/class?classroomId=<uuid>
 *
 * **สถิติทั้งหมดคำนวณที่ core/ ที่เดียว** ฝั่งฐานข้อมูลคืนแค่ข้อมูลดิบ (`classroom_report_raw`)
 * ถ้าเขียนสูตรซ้ำใน SQL จะมีสองแหล่งความจริงแล้วตัวเลขบนสไลด์กับบนจอจะไม่ตรงกัน
 *   - E1/E2            → core/efficiency.mediaEfficiency
 *   - t-test / d / <g> → core/statistics
 *   - ผลตามจุดประสงค์  → core/report.studentReport + classSummary + objectiveGaps
 *
 * ⚠️ ครูคนอื่นขอห้องนี้ = repo คืน null แล้วที่นี่ตอบ 404
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MISSION_OBJECTIVE: Record<string, string> = Object.fromEntries(
  missionsJson.missions.map((m) => [m.id, m.objectiveId]),
)
const MISSION_TITLE: Record<string, string> = Object.fromEntries(
  missionsJson.missions.map((m) => [m.id, m.title]),
)

/**
 * ข้อคำถามของแบบสอบถามความพึงพอใจ — เอาเฉพาะข้อมาตราส่วน q1..q8 ที่มีค่าเฉลี่ย/S.D. ให้รายงาน
 * ข้อ 9-10 เป็นข้อความปลายเปิด (`like_text` / `improve_text`) ไม่มีตัวเลขให้แสดงในตาราง
 */
const SURVEY_ITEM_LABELS: Record<string, string> = Object.fromEntries(
  (surveyJson.items as Array<{ column?: string; text?: string; aspect?: string; type?: string }>)
    .filter((i) => i.type === 'rating' && typeof i.column === 'string' && typeof i.text === 'string')
    .map((i) => [i.column as string, i.aspect ? `${i.text} (${i.aspect})` : (i.text as string)]),
)

function asRoute(value: string | null | undefined): RouteId {
  return value === 'clip' || value === 'card' || value === 'game' || value === 'buddy'
    ? value
    : 'card'
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** คะแนนรูบริกที่ **ครูยืนยันแล้ว** เท่านั้นถึงนับเข้า E1 (สเปกข้อ 9.3) */
function confirmedRubricScore(row: RawStudentRow): number | null {
  const scores = row.submission?.teacherScores as Record<string, unknown> | null | undefined
  if (!scores) return null
  const weighted = scores.weightedTotal
  if (typeof weighted === 'number') return weighted
  const legacy = scores.score
  return typeof legacy === 'number' ? legacy : null
}

/**
 * สถิติตัวที่ 6 ของสเปกข้อ 9.4 (ร้อยละความตรงกัน) ต้องมีคะแนนรายด้าน 3 ชุดมาเทียบกัน
 * ทั้งสามชุดเก็บคนละรูปแบบในฐานข้อมูล ตัวแปลงพวกนี้จึงต้องรู้ทั้งสามแบบ
 *
 * ⚠️ `teacher_confirmed_scores.dimensions` เป็น **map** `{ id: คะแนน }`
 * ⚠️ `ai_scores.dimensions` เป็น **array ของ object** `[{ id, score }]` (คนละรูปกัน เคยพลาดมาแล้วที่ T67)
 */
const RUBRIC_ID = /^dim-/

/** แปลงแมป `{ 'dim-x': 3 }` เป็นรายการด้าน — คีย์ที่ไม่ใช่รหัสด้านถูกทิ้ง */
function dimensionsFromMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, number> = {}
  for (const [key, score] of Object.entries(value as Record<string, unknown>)) {
    if (RUBRIC_ID.test(key) && typeof score === 'number' && Number.isFinite(score)) out[key] = score
  }
  return Object.keys(out).length > 0 ? out : null
}

/** แปลง array `[{ id, score }]` ของฝั่งกฎ/AI เป็นรายการด้าน */
function dimensionsFromArray(value: unknown): Record<string, number> | null {
  if (!Array.isArray(value)) return null
  const out: Record<string, number> = {}
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const { id, score } = item as { id?: unknown; score?: unknown }
    if (typeof id === 'string' && typeof score === 'number' && Number.isFinite(score)) out[id] = score
  }
  return Object.keys(out).length > 0 ? out : null
}

function toRubricBreakdown(
  dimensions: Record<string, number> | null,
  bag: Record<string, unknown> | null,
): RubricBreakdown | null {
  if (!dimensions) return null
  return {
    dimensions: Object.entries(dimensions).map(([id, score]) => ({ id, name: id, score })),
    emphasisDimensionId:
      typeof bag?.emphasisDimensionId === 'string' ? bag.emphasisDimensionId : null,
    weightedTotal: num(bag?.weightedTotal),
    weightedMax: num(bag?.weightedMax),
    stars: num(bag?.stars),
    needsTeacherConfirm: true,
  }
}

/** คะแนนที่ครูยืนยัน — ก้อนที่ครูสั่งให้แก้ (`status: 'revise'`) ไม่นับว่ายืนยันแล้ว (กติกาเดียวกับ T65) */
function teacherRubricOf(row: RawStudentRow): RubricBreakdown | null {
  const bag = row.submission?.teacherScores as Record<string, unknown> | null | undefined
  if (!bag || bag.status === 'revise') return null
  return toRubricBreakdown(dimensionsFromMap(bag.dimensions), bag)
}

/** คะแนนที่ระบบเสนอ — ชอบ `aiProposed` ก่อน ถ้าไม่มีค่อยใช้คะแนนของกฎ */
function proposedRubricOf(row: RawStudentRow): RubricBreakdown | null {
  const bag = row.submission?.aiScores as Record<string, unknown> | null | undefined
  if (!bag) return null
  const ai = bag.aiProposed as Record<string, unknown> | null | undefined
  const rules = bag.ruleScores as Record<string, unknown> | null | undefined
  const source = dimensionsFromArray(ai?.dimensions)
    ? ai
    : dimensionsFromArray(rules?.dimensions)
      ? rules
      : bag
  return toRubricBreakdown(dimensionsFromArray(source?.dimensions), source ?? null)
}

/** คะแนนที่ผู้เรียนให้ตัวเอง — เก็บได้ 2 แบบ ใต้คีย์ `dimensions` หรือเป็นแมปแบน ๆ (S-26/T66) */
function selfRubricOf(row: RawStudentRow): Record<string, number> | null {
  const bag = row.submission?.selfScores as Record<string, unknown> | null | undefined
  if (!bag) return null
  return dimensionsFromMap(bag.dimensions) ?? dimensionsFromMap(bag)
}

function toReportInput(row: RawStudentRow): StudentReportInput {
  const skipped = new Set(row.skips.map((s) => s.missionId))
  const missions = row.missions.map((m) => ({
    missionId: m.missionId,
    objectiveId: MISSION_OBJECTIVE[m.missionId] ?? m.missionId,
    title: MISSION_TITLE[m.missionId],
    // ข้ามเพราะตอบเช็กถูกตั้งแต่ต้น ก็ถือว่าผ่านวัตถุประสงค์นั้นตามสเปก T-10
    passed: m.passed || skipped.has(m.missionId),
    stars: num(m.stars),
    route: asRoute(m.channelUsed ?? row.profile?.learningRoute),
  }))

  return {
    studentId: row.studentId,
    nickname: row.nickname,
    shopName: row.profile?.businessName ?? '',
    domainName: row.profile?.domainName ?? row.submission?.domainName ?? '',
    tldSuffix: row.submission?.tld ?? '',
    goal: num(row.profile?.goalStars),
    missions,
    preScore: num(row.profile?.preTestScore),
    postScore: num(row.profile?.postTestScore),
    routeSuggested: row.profile?.channelSuggested ? asRoute(row.profile.channelSuggested) : null,
    routeChosen: row.profile?.learningRoute ? asRoute(row.profile.learningRoute) : null,
    routeChosenBy: row.profile?.channelChosenBy === 'student' ? 'student' : 'system',
    goalRaisedCount: num(row.profile?.goalRaisedCount),
    /**
     * "ครูยืนยันคะแนนแล้ว" ต้องตัดก้อนที่ครูสั่งให้แก้ (`status: 'revise'`) ออก (UAT-7 ข้อ ค-8)
     * ของเดิมเช็กแค่ `confirmedAt` ไม่ null ซึ่งใบที่ครูตีกลับก็ไม่ null เหมือนกัน
     * ทำให้จุดประสงค์ข้อ 5 นับเกินจริงไป 1 คน · กติกาเดียวกับ `isTeacherConfirmed()` (T65)
     */
    rubricConfirmedByTeacher: teacherRubricOf(row) !== null,
    // 3 ชุดนี้มีไว้ให้ classStatistics() คิดร้อยละความตรงกัน (สถิติตัวที่ 6 ของสเปกข้อ 9.4)
    rubric: teacherRubricOf(row),
    rubricAiSuggestion: proposedRubricOf(row),
    selfRubricScores: selfRubricOf(row),
    selfRegulation: {
      goalSet: row.profile?.goalStars !== null && row.profile?.goalStars !== undefined,
      selfAssessed: Boolean(row.submission?.selfScores),
      reflectionAnswered: row.reflectionCount,
    },
  }
}

function toEfficiencyInput(row: RawStudentRow): InClassScoreInput {
  const skipped = new Set(row.skips.map((s) => s.missionId))
  const seen = new Set(row.missions.map((m) => m.missionId))
  const missions = [
    ...row.missions.map((m) => ({
      missionId: m.missionId,
      skipped: skipped.has(m.missionId),
      stars: num(m.stars),
    })),
    // ข้ามโดยไม่เคยเปิดภารกิจ = ไม่มีแถวใน mission_progress แต่ต้องนับเต็มตามกฎ E1
    ...[...skipped].filter((id) => !seen.has(id)).map((id) => ({ missionId: id, skipped: true })),
  ]

  return {
    studentId: row.studentId,
    missions,
    rubricScore: confirmedRubricScore(row),
  }
}

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  const raw = await getClassroomReportRaw(session.teacherId, classroomId)
  if (!raw) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const classroom = await getOwnedClassroom(session.teacherId, classroomId)

  const rows = raw.students
  const reports = rows.map((row) => studentReport(toReportInput(row)))
  const summary = classSummary(reports)

  // ── ประสิทธิภาพของสื่อ E1/E2 (คนที่ยังไม่มีคะแนนหลังเรียนไม่ถูกนับเป็น 0)
  const postScores = rows
    .map((r) => r.profile?.postTestScore)
    .filter((v): v is number => typeof v === 'number')
  const efficiency = mediaEfficiency(rows.map(toEfficiencyInput), postScores)

  // ── สถิติก่อน-หลัง (เฉพาะคนที่มีทั้งสองค่า จึงจะจับคู่ได้)
  const pairs = rows
    .map((r) => ({ pre: r.profile?.preTestScore, post: r.profile?.postTestScore }))
    .filter((p): p is { pre: number; post: number } =>
      typeof p.pre === 'number' && typeof p.post === 'number',
    )
  const tTest = pairedTTest(pairs)
  const preStats = descriptive(pairs.map((p) => p.pre))
  const postStats = descriptive(pairs.map((p) => p.post))
  const quizMax = reports[0]?.quizMax ?? efficiency.e2.max
  const gain = normalizedGain(preStats.mean, postStats.mean, quizMax)

  // ── ผลตามจุดประสงค์ทั้ง 6 ข้อ: 1-4 จากภารกิจ · 5 ครูยืนยันด่านบอส · 6 กำกับตนเองครบ
  const objectives: Record<string, number> = { ...summary.passedByObjective }
  objectives['obj-5'] = reports.filter((r) => r.rubricConfirmedByTeacher).length
  objectives['obj-6'] = reports.filter(
    (r) =>
      r.selfRegulation.goalSet &&
      r.selfRegulation.selfAssessed &&
      r.selfRegulation.reflectionAnswered > 0,
  ).length

  /**
   * ร้อยละของจุดประสงค์ — คิดที่เซิร์ฟเวอร์ (UAT-7 ข้อ ข-12)
   * ของเดิมจอหารเอง ทั้งที่หัวไฟล์ของจอเขียนไว้เองว่า "ไม่คำนวณสถิติเองแม้แต่ค่าเดียว"
   */
  const headcountForRate = reports.length

  // ── หลักฐาน personalized learning
  const chosenDifferent = rows.filter(
    (r) =>
      r.profile?.channelSuggested &&
      r.profile.learningRoute &&
      r.profile.channelSuggested !== r.profile.learningRoute,
  ).length
  /**
   * "เปลี่ยนช่องทางระหว่างเรียน" ต้องนับเฉพาะการเปลี่ยนจริง (UAT-7 ข้อ ค-7)
   *
   * ตาราง `route_changes` เก็บทั้งแถวตอน **ระบบแจกช่องทางครั้งแรก** (`from_route` เป็น null)
   * และแถวที่ย้ำค่าเดิม (from = to) · ของเดิมนับทุกแถว ทำให้หลักฐานการปรับเหมาะบนสไลด์
   * เป่าจาก 2 คนเป็น 7 คน — เกณฑ์ที่ถูกคือตัวเดียวกับ `countRouteSwitches()` ใน game-state
   */
  const routeChangeRows =
    (await listClassroomRouteChanges(session.teacherId, classroomId))?.filter(
      (rc) => rc.from_route !== null && rc.from_route !== rc.to_route,
    ) ?? []
  const switched = new Set(routeChangeRows.map((rc) => rc.student_id)).size
  const raisedGoal = rows.filter((r) => num(r.profile?.goalRaisedCount) > 0).length

  // ── ตัวช่วยที่ได้ผล: ช่องทางไหนคนใช้แล้วผ่านมากที่สุด
  const routeStats: Record<string, { used: number; passed: number; hints: number }> = {}
  for (const row of rows) {
    for (const m of row.missions) {
      const route = asRoute(m.channelUsed ?? row.profile?.learningRoute)
      const bucket = (routeStats[route] ??= { used: 0, passed: 0, hints: 0 })
      bucket.used += 1
      if (m.passed) bucket.passed += 1
      bucket.hints += num(m.hintsUsed)
    }
  }
  const helperEffectiveness = Object.entries(routeStats)
    .map(([route, s]) => ({
      route,
      used: s.used,
      passed: s.passed,
      passRate: s.used > 0 ? Math.round((s.passed / s.used) * 100) / 100 : 0,
      hintsPerMission: s.used > 0 ? Math.round((s.hints / s.used) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.passRate - a.passRate)

  // ── เรื่องที่พลาดบ่อยที่สุด (ภารกิจที่คนผ่านน้อย / ใช้ความพยายามมาก)
  const missionStats: Record<string, { played: number; passed: number; attempts: number }> = {}
  for (const row of rows) {
    for (const m of row.missions) {
      // ด่านบอสไม่เข้าตารางนี้ — เกณฑ์ผ่านคนละแบบ (ผ่านเมื่อครูยืนยัน ไม่ใช่ตอบถูก)
      if (!(m.missionId in MISSION_OBJECTIVE)) continue
      const bucket = (missionStats[m.missionId] ??= { played: 0, passed: 0, attempts: 0 })
      bucket.played += 1
      if (m.passed) bucket.passed += 1
      bucket.attempts += num(m.attempts)
    }
  }
  const hardestMissions = Object.entries(missionStats)
    .map(([missionId, s]) => ({
      missionId,
      objectiveId: MISSION_OBJECTIVE[missionId] ?? missionId,
      title: MISSION_TITLE[missionId] ?? missionId,
      played: s.played,
      passed: s.passed,
      passRate: s.played > 0 ? Math.round((s.passed / s.played) * 100) / 100 : 0,
      attemptsMean: s.played > 0 ? Math.round((s.attempts / s.played) * 100) / 100 : 0,
    }))
    .sort((a, b) => a.passRate - b.passRate || b.attemptsMean - a.attemptsMean)

  return NextResponse.json({
    report: {
      classroomId: raw.classroomId,
      /**
       * E-16 ตัวเลขชุดนี้มาจากห้องสาธิต (นักเรียนหุ่น) — ห้ามอ้างเป็นผลการทดลอง
       * ตัวเลขแยกห้องอยู่แล้วโดยโครงสร้าง (ทุก RPC รับ classroom_id ตัวเดียว ไม่เคยรวมข้ามห้อง)
       * ธงนี้มีไว้ให้หน้าจอกับข้อความที่ก๊อปไปแปะสไลด์ติดป้ายเตือนได้
       */
      isDemo: classroom?.is_demo ?? false,
      headcount: summary.headcount,
      efficiency: {
        e1: efficiency.e1,
        e2: efficiency.e2,
        label: efficiency.label,
        standardLabel: efficiency.standardLabel,
        meetsStandard: efficiency.meetsStandard,
        summary: efficiency.summary,
      },
      tests: {
        quizMax,
        pre: preStats,
        post: postStats,
        pairedTTest: tTest,
        /** มีทั้ง Cohen's d และ Hedges' g (คนละตัวกับ `normalizedGain.hakeG` ของ Hake) */
        effectSize: effectSize(tTest),
        /** คะแนนพัฒนาการแบบปรับมาตรฐานของ Hake — ฟิลด์ `hakeG` ชื่อบอกที่มา ใช้ตัวนั้นเวลาคัดลอกออกไป */
        normalizedGain: gain,
        /**
         * สถิติตัวที่ 6 ของสเปกข้อ 9.4 — ร้อยละความตรงกันของคะแนนรายด้าน
         * นับเป็นคู่รายเกณฑ์เฉพาะคนที่ครูยืนยันแล้วและมีคะแนนอีกฝั่งครบ
         * คนที่ครูยังไม่ตรวจไม่ถูกนับว่า "ต่างกัน" (กติกาอยู่ใน core/report.rubricPairs)
         */
        agreement: classStatistics(reports).agreement,
      },
      objectives,
      /** ร้อยละต่อจุดประสงค์ ปัดเป็นจำนวนเต็มให้แล้ว — จอเอาไปวาดแถบได้เลย ไม่ต้องหารเอง */
      objectivePercents: Object.fromEntries(
        Object.entries(objectives).map(([id, count]) => [
          id,
          headcountForRate > 0 ? Math.round((count / headcountForRate) * 100) : 0,
        ]),
      ),
      avgStars: summary.avgStars,
      avgGain: summary.avgGain,
      objectiveGaps: objectiveGaps(summary),
      hardestMissions,
      helperEffectiveness,
      personalized: {
        chosenDifferentFromSuggestion: chosenDifferent,
        switchedRoute: switched,
        raisedOwnGoal: raisedGoal,
        teacherOverrides: raw.overrides.length,
      },
      buddy: raw.buddy,
      /**
       * ความพึงพอใจ — สเปกข้อ 9.4 แถวแรกขอค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐานของ "คะแนนทุกชนิด ความพึงพอใจ"
       * ค่าเฉลี่ยรวมอย่างเดียวบอกไม่ได้ว่าข้อไหนคะแนนตก จึงติดข้อคำถามไปกับรายข้อให้ครูอ่านรู้เรื่อง
       * (แบบสอบถามไม่มีคำตอบถูกผิด และตาราง survey_responses ไม่มีคอลัมน์ระบุตัวผู้ตอบเลย)
       */
      survey: raw.survey ? { ...raw.survey, itemLabels: SURVEY_ITEM_LABELS } : null,
    },
  })
}

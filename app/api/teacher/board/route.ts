import { NextResponse } from 'next/server'
import { calibrationFlag, shouldCoach, type CoachCause } from '@/core/personalize'
import coachPrompts from '@/content/coach-prompts.json'
import missionsContent from '@/content/missions.json'
import bigMission from '@/content/big-mission.json'
import selfProfileContent from '@/content/self-profile.json'
import {
  getActiveClassSession,
  listClassroomPlanRequests,
  getTeacherBoardWithFlags,
  listPendingReview,
  type BoardFlagMission,
  type MissionId,
  type Submission,
} from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * แผงห้องเรียนสด — อ่านอย่างเดียว หน้าเว็บครู poll ทุก 3 วินาที
 *
 * ⚠️ teacherId มาจาก cookie เท่านั้น · classroomId รับจาก query ได้
 *    getTeacherBoardWithFlags ตรวจ `teacher_id` ใน query เดียวกัน ไม่ใช่เจ้าของ = null = 404
 *
 * ⚠️ ห้ามส่งเฉลยมาที่ฝั่งครูในหน้าเดียวกับคำถามโค้ชเด็ดขาด
 *    `content/missions.json` มีทั้ง `check.choices` และ `hints` — ตรงนี้อ่านเฉพาะ
 *    `title` กับ "จำนวน" ของ hints (เอาไปคิด hintsExhausted) ไม่เคยส่งตัวข้อความออกไป
 *    ตำราให้ครูถาม ไม่ใช่ให้ครูบอกคำตอบ การ์ดโค้ชจึงไม่มีช่องเฉลยและไม่มีปุ่มดูเฉลย
 *
 * เกณฑ์ธง 60/90/150 วินาทีอยู่ใน content/coach-thresholds.json ผ่าน shouldCoach()
 * ไฟล์นี้และชั้น DB ไม่มีตัวเลขเกณฑ์ฝังอยู่เลย
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** จำนวนคำใบ้ต่อภารกิจ — เอาไว้คิดว่า "ใช้คำใบ้ครบแล้วหรือยัง" ไม่ได้เอาข้อความคำใบ้ */
const MAX_HINTS_BY_MISSION: Record<string, number> = Object.fromEntries(
  missionsContent.missions.map((m) => [m.id, m.hints.length]),
)

const MISSION_TITLE: Record<string, string> = {
  ...Object.fromEntries(missionsContent.missions.map((m) => [m.id, m.title])),
  /**
   * `content/missions.json` มีแค่ m1-m4 แถว 'boss' จึงเคยตกมาเป็นรหัสดิบ "boss" บนจอครู
   * (UAT-7 ข้อ ค-2) ชื่อไทยของด่านบอสอยู่ใน `content/big-mission.json` มาตลอด
   */
  boss: bigMission.title,
}

/**
 * เติมค่าจริงลงช่องว่างของการ์ดโค้ช (UAT-7 ข้อ ค-1)
 *
 * `content/coach-prompts.json` เขียนคำถามไว้ว่า "ลูกค้าของร้าน {shopName} ส่วนใหญ่อยู่ที่ไหน"
 * แต่ไม่เคยมีใครแทนค่า ครูจึงเห็นวงเล็บปีกกาดิบ ๆ บนจอ = อาการ "ยังทำไม่เสร็จ/ข้อมูลปลอม"
 * ชื่อร้านจริงอยู่ในแถวเดียวกันอยู่แล้ว (`businessName`) — ยังไม่ตั้งชื่อร้านก็ใช้คำกลาง ๆ แทน
 */
function fillPlaceholders(text: string, shopName: string | null): string {
  return text.replaceAll('{shopName}', shopName?.trim() || 'ร้านของตัวเอง')
}

/** รหัสวัตถุประสงค์ -> ภารกิจ (ชั้น DB เก็บความมั่นใจ/ผลจริงเป็นรายวัตถุประสงค์) */
const MISSION_BY_OBJECTIVE: Record<string, string> = Object.fromEntries(
  selfProfileContent.objectives.map((o) => [o.id, o.missionId]),
)

const OBJECTIVE_SHORT_NAME: Record<string, string> = Object.fromEntries(
  selfProfileContent.objectives.map((o) => [o.id, o.shortName]),
)

/**
 * ชื่อระดับความด่วนเป็นภาษาไทย — **แหล่งเดียวของทั้งระบบ** (UAT-7 ข้อ ข-7)
 * ก่อนหน้านี้พจนานุกรมนี้อยู่ในไฟล์จอ 2 ไฟล์และเขียนไม่เหมือนกัน
 * ("ติดแล้ว" กับ "ติดแล้ว เตรียมเดินไปหา") ครูเห็นคนละคำบนสองจอที่พูดเรื่องเดียวกัน
 */
const ATTENTION_NAME: Record<'red' | 'orange' | 'yellow' | 'green', string> = {
  red: 'ต้องช่วยด่วน',
  orange: 'ติดแล้ว เตรียมเดินไปหา',
  yellow: 'ควรดู',
  green: 'ปกติ',
}

/**
 * ข้อความ "นิ่งมานานแค่ไหน" — คิดที่เซิร์ฟเวอร์ที่เดียว (flow-1 ข้อ 10)
 * เกินคาบไปแล้ว = คนนี้ไม่ได้เข้ามาในคาบนี้ ไม่ใช่ "นิ่ง" กลางคาบ ครูจะได้ไม่ไปตามคนที่ไม่ได้มา
 */
function idleTextOf(idleSeconds: number, away: boolean, joinedBeforeClass: boolean): string {
  if (away) return joinedBeforeClass ? 'ยังไม่ได้เข้ามาในคาบนี้' : 'ไม่ได้ขยับมานานกว่าหนึ่งคาบเรียน'
  if (idleSeconds < 60) return `นิ่งมา ${idleSeconds} วินาที`
  return `นิ่งมา ${Math.floor(idleSeconds / 60)} นาที ${idleSeconds % 60} วินาที`
}

/** แปลงสาเหตุที่ shouldCoach ตรวจได้ ให้ตรงกับ stuckReasons ใน coach-prompts.json */
const CAUSE_TO_REASON: Record<CoachCause, string> = {
  'many-attempts': 'reason-wrong-repeat',
  'idle-too-long': 'reason-no-move',
  'hints-exhausted': 'reason-hints-exhausted',
}

/**
 * การ์ดงานที่รอครูยืนยัน
 * `source` = 'ai' คือ AI เสนอจริง · 'fallback' คือกฎในโค้ดเป็นคนให้คะแนน · 'unknown' คือไม่มีข้อมูล
 * ครูต้องเห็นป้ายนี้ก่อนกดยืนยัน — AI เป็นข้อเสนอเสมอ ครูเป็นคนตัดสิน
 */
function toPendingCard(item: Submission & { nickname: string }) {
  const ai = item.ai_scores as Record<string, unknown> | null
  const rawSource = typeof ai?.source === 'string' ? ai.source : null

  return {
    submissionId: item.id,
    format: item.format,
    domainName: item.domain_name,
    tld: item.tld,
    reasonText: item.reason_text,
    emphasisCriterion: item.emphasis_criterion,
    aiScore: typeof ai?.score === 'number' ? ai.score : null,
    aiMaxScore: typeof ai?.maxScore === 'number' ? ai.maxScore : null,
    aiFeedback: typeof ai?.feedback === 'string' ? ai.feedback : null,
    /** 'ai' | 'fallback' | 'unknown' */
    source: rawSource === 'ai' || rawSource === 'fallback' ? rawSource : 'unknown',
    sourceLabel:
      rawSource === 'ai'
        ? `AI เสนอ${typeof ai?.provider === 'string' ? ` (${ai.provider})` : ''}`
        : rawSource === 'fallback'
          ? 'กฎในระบบเสนอ (ไม่ได้ใช้ AI)'
          : 'ไม่ทราบที่มาของคะแนน',
    selfScores: item.self_scores,
    createdAt: item.created_at,
  }
}

type CoachPrompt = {
  id: string
  missionId: string
  reasonId: string
  question: string
  followUpQuestion: string
  watchFor: string
  avoidSaying: string
}

/** คำถามโค้ชของ (ภารกิจ + สาเหตุ) ถ้าไม่มีเฉพาะภารกิจนั้น ใช้ชุดกลาง missionId = 'any' */
function findPrompt(missionId: string | null, reasonId: string): CoachPrompt | null {
  const prompts = coachPrompts.prompts as CoachPrompt[]
  return (
    prompts.find((p) => p.missionId === missionId && p.reasonId === reasonId) ??
    prompts.find((p) => p.missionId === 'any' && p.reasonId === reasonId) ??
    null
  )
}

function findReasonNote(reasonId: string): { name: string; teacherNote: string } | null {
  const reason = coachPrompts.stuckReasons.find((r) => r.id === reasonId)
  return reason ? { name: reason.name, teacherNote: reason.teacherNote } : null
}

function findEncouragement(reasonId: string): string | null {
  const item = coachPrompts.encouragements.find((e) => e.forReasonId === reasonId)
  return item?.text ?? null
}

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const url = new URL(request.url)
  const classroomId = url.searchParams.get('classroomId')
  if (!classroomId) {
    return errorResponse('bad-request', 'ต้องระบุ classroomId')
  }

  const rows = await getTeacherBoardWithFlags(session.teacherId, classroomId)
  if (!rows) {
    return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
  }

  // งานที่รอครูยืนยันคะแนน — ครูต้องเห็นก่อนกดว่าคะแนนที่เสนอมาจาก AI จริงหรือจากกฎในโค้ด
  const pending = await listPendingReview(session.teacherId, classroomId)
  /**
   * คาบที่เดินอยู่ — ใช้เป็นเพดานของ "นิ่งมานานแค่ไหน" (flow-1 ข้อ 10)
   * ของเดิมนับจากครั้งสุดท้ายที่ขยับ ซึ่งอาจเป็นเมื่อวาน ครูจึงเห็น "นิ่งมา 424 นาที" ในคาบ 60 นาที
   * แล้วธงแดงกลายเป็นเตือนลวงทั้งจอ
   */
  const classSession = await getActiveClassSession(classroomId)
  const sessionStartedMs = classSession ? new Date(classSession.started_at).getTime() : null
  /** ความยาวคาบที่ครูตั้งไว้จริง (นาที) — ไม่มีแผนก็ใช้ความยาวคาบมาตรฐานของระบบ */
  const classSeconds = (classSession?.class_minutes ?? 60) * 60
  const openRequests = (await listClassroomPlanRequests(session.teacherId, classroomId)) ?? []
  const pendingByStudent = new Map<string, ReturnType<typeof toPendingCard>[]>()
  for (const item of pending ?? []) {
    const list = pendingByStudent.get(item.student_id) ?? []
    list.push(toPendingCard(item))
    pendingByStudent.set(item.student_id, list)
  }

  // เวลาที่ใช้ตัดสินธงรับเข้ามาครั้งเดียว ทุกแถวคิดจากนาฬิกาเรือนเดียวกัน
  // `now` ใน query ใช้ตอนทดสอบเท่านั้น (เลื่อนเวลาไปข้างหน้าเพื่อดูธงโดยไม่ต้องรอจริง)
  const nowParam = Number(url.searchParams.get('now'))
  const now = Number.isFinite(nowParam) && nowParam > 0 ? nowParam : Date.now()

  const board = rows.map((row) => {
    const current: BoardFlagMission | null =
      row.missions.find((m) => m.missionId === row.currentMissionId) ?? null

    const helpMission = row.missions
      .filter((m) => !m.solved && m.missionId !== ('boss' as MissionId))
      .reduce<BoardFlagMission | null>(
        (latest, m) => (latest === null || m.lastActionAtMs > latest.lastActionAtMs ? m : latest),
        null,
      )

    const maxHints = current ? (MAX_HINTS_BY_MISSION[current.missionId] ?? 0) : 0
    const signal = shouldCoach({
      attempts: current?.attempts ?? 0,
      hintsUsed: current?.hintsUsed ?? 0,
      maxHints,
      solved: current === null ? true : current.solved,
      lastActionAt: row.lastActionAtMs,
      now,
    })

    // นักเรียนกดขอครูเอง ให้ขึ้นแดงเสมอ ไม่ต้องรอเกณฑ์เวลา
    const reasonId = row.askedForHelp
      ? 'reason-asked-help'
      : signal.cause
        ? CAUSE_TO_REASON[signal.cause]
        : null

    const idleSeconds = Math.max(0, Math.round((now - row.lastActionAtMs) / 1000))
    /**
     * ไม่ได้ขยับเลยตั้งแต่ก่อนเปิดคาบ = ยังไม่เข้ามาในคาบนี้
     * คนกลุ่มนี้ต้องไม่ไปอยู่กลุ่ม "ต้องช่วยด่วน" (flow-1 ข้อ 10) — ครูต้องตามคนที่มาแล้วแต่ติดก่อน
     */
    const joinedBeforeClass = sessionStartedMs !== null && row.lastActionAtMs < sessionStartedMs
    const awayFromClass = !row.askedForHelp && (joinedBeforeClass || idleSeconds > classSeconds)

    const level = row.askedForHelp ? 'red' : awayFromClass ? 'yellow' : signal.level
    const flagged = row.askedForHelp || (!awayFromClass && signal.flag)

    /**
     * ตอนนี้ทำอะไรอยู่ — เขียนตามจริง (flow-1 ข้อ 16)
     * ของเดิมเขียน "ยังไม่เริ่มภารกิจ" ทั้งที่คนนั้นผ่านครบ 4 ภารกิจและส่งด่านบอสแล้ว
     */
    const passedCount = row.missions.filter(
      (m) => m.solved && m.missionId !== ('boss' as MissionId),
    ).length
    const smallMissionTotal = missionsContent.missions.length
    const progressLabel = current
      ? `กำลังทำ ${MISSION_TITLE[current.missionId] ?? current.missionId}`
      : row.pendingReview
        ? `ผ่านแล้ว ${passedCount} จาก ${smallMissionTotal} ภารกิจ และส่งด่านบอสแล้ว`
        : passedCount > 0
          ? `ผ่านแล้ว ${passedCount} จาก ${smallMissionTotal} ภารกิจ · ไม่ได้เปิดภารกิจไหนค้างไว้`
          : awayFromClass
            ? 'ยังไม่ได้เข้ามาในคาบนี้'
            : 'ยังไม่เริ่มภารกิจแรก'

    const prompt = flagged && reasonId ? findPrompt(current?.missionId ?? null, reasonId) : null
    const reason = reasonId ? findReasonNote(reasonId) : null

    return {
      studentId: row.studentId,
      nickname: row.nickname,
      businessName: row.businessName,
      learningRoute: row.learningRoute,
      scaffoldLevel: row.scaffoldLevel,
      goalStars: row.goalStars,
      /** ครูต้องแยกออกว่า "ยังไม่ตั้งเป้า" กับ "ตั้งเป้า 0" ต่างกัน (QA-2 ใหม่-4) */
      goalStatus: row.goalStars === null ? 'ยังไม่ตั้งเป้า' : `เป้า ${row.goalStars} ดาว`,
      earnedStars: row.earnedStars,
      currentMission: current
        ? {
            missionId: current.missionId as MissionId,
            title: MISSION_TITLE[current.missionId] ?? current.missionId,
            attempts: current.attempts,
            hintsUsed: current.hintsUsed,
            maxHints,
            solved: current.solved,
          }
        : null,
      idleSeconds,
      /** ข้อความพร้อมใช้ของ "นิ่งมานานแค่ไหน" — จอไม่ต้องคิดเอง */
      idleLabel: idleTextOf(
        idleSeconds,
        awayFromClass || idleSeconds > classSeconds,
        joinedBeforeClass,
      ),
      awayFromClass,
      /** ประโยคสั้น ๆ ว่าคนนี้กำลังทำอะไรอยู่ (จอไม่ต้องเดาจากหลายฟิลด์) */
      progressLabel,
      /**
       * สำหรับคิดธง calibration ฝั่งหน้าเว็บ (มั่นใจสูงแต่ผิด ควรคุย / มั่นใจต่ำแต่ถูก ควรชม)
       * มีแค่ระดับความมั่นใจกับผลถูกผิดรายวัตถุประสงค์ — **ไม่มีคำตอบของนักเรียนและไม่มีเฉลย**
       */
      confidenceByObjective: row.confidenceByObjective,
      correctByObjective: row.correctByObjective,
      skippedMissions: row.skippedMissions,
      pendingReview: row.pendingReview,
      pendingSubmissions: pendingByStudent.get(row.studentId) ?? [],
      askedForHelp: row.askedForHelp,
      /**
       * ภารกิจที่ธง "ขอครู" ผูกอยู่ = ภารกิจย่อยที่ขยับล่าสุดและยังไม่ผ่าน
       * ตัดแถว 'boss' ออก เพราะด่านบอสไม่มี passed_at จึงถูกนับเป็น "ยังไม่ผ่าน" ตลอด
       * แล้วจะกลืนธงของภารกิจย่อยที่เด็กกำลังติดอยู่จริง
       */
      helpMissionId: row.askedForHelp ? (helpMission?.missionId ?? current?.missionId ?? null) : null,
      /**
       * ธงจากความมั่นใจที่ผู้เรียนกรอกตอนตอบข้อ check คู่กับผลจริง
       * ไม่มีผลกับคะแนน ไม่แสดงเป็นคำตัดสินให้ผู้เรียนเห็น — ให้ครูใช้ตั้งวงคุยเท่านั้น
       */
      calibration: Object.entries(row.confidenceByObjective).flatMap(
        ([objectiveId, confidence]) => {
          const correct = row.correctByObjective[objectiveId]
          if (correct === undefined) return []
          const signal = calibrationFlag(confidence, correct)
          if (!signal.flag || !signal.coachPromptId) return []
          const missionId = MISSION_BY_OBJECTIVE[objectiveId] ?? null
          const coach = findPrompt(missionId, signal.coachPromptId)
          return [
            {
              objectiveId,
              missionId,
              missionTitle:
                (missionId ? MISSION_TITLE[missionId] : null) ??
                OBJECTIVE_SHORT_NAME[objectiveId] ??
                objectiveId,
              flag: signal.flag,
              reason: signal.reason,
              confidence,
              correct,
              coachCard: coach
                ? {
                    question: fillPlaceholders(coach.question, row.businessName),
                    followUpQuestion: fillPlaceholders(coach.followUpQuestion, row.businessName),
                    watchFor: fillPlaceholders(coach.watchFor, row.businessName),
                    avoidSaying: fillPlaceholders(coach.avoidSaying, row.businessName),
                  }
                : null,
            },
          ]
        },
      ),
      /**
       * ระดับความด่วนที่ "เซิร์ฟเวอร์ตัดสินแล้ว" พร้อมชื่อไทย — จอต้องหยิบไปใช้ตรง ๆ
       * ห้ามให้จอคิดเองว่าใครแดงใครส้ม (UAT-7 ข้อ ข-4/ข-5/ข-8)
       * ไม่งั้นหน้า /teacher กับ /teacher/board นับคนละเลขทั้งที่พูดเรื่องเดียวกัน
       */
      attention: {
        level: (level ?? 'green') as 'red' | 'orange' | 'yellow' | 'green',
        name: ATTENTION_NAME[(level ?? 'green') as 'red' | 'orange' | 'yellow' | 'green'],
      },
      flag: {
        flagged,
        level,
        cause: row.askedForHelp ? 'asked-for-help' : signal.cause,
        label: row.askedForHelp ? 'กดขอครูเอง ให้ความสำคัญก่อน' : signal.label,
        reasonId,
        reasonName: reason?.name ?? null,
        teacherNote: reason?.teacherNote ?? null,
      },
      // การ์ดโค้ช: มีแต่คำถามกับสิ่งที่ครูควรสังเกต ไม่มีเฉลยและไม่มีปุ่มดูเฉลย
      coachCard: prompt
        ? {
            id: prompt.id,
            question: fillPlaceholders(prompt.question, row.businessName),
            followUpQuestion: fillPlaceholders(prompt.followUpQuestion, row.businessName),
            watchFor: fillPlaceholders(prompt.watchFor, row.businessName),
            avoidSaying: fillPlaceholders(prompt.avoidSaying, row.businessName),
            encouragement: reasonId ? findEncouragement(reasonId) : null,
          }
        : null,
    }
  })

  /**
   * "ตอนนี้ครูควรทำอะไรต่อ" — **เซิร์ฟเวอร์เป็นคนจัดลำดับความด่วน** (UAT-7 ข้อ ข-6)
   * ของเดิมตรรกะนี้อยู่ในเบราว์เซอร์ คนละที่กับเกณฑ์ธง พอเกณฑ์เปลี่ยนสองฝั่งจะเพี้ยนจากกัน
   * ข้อความเขียนให้ครูอ่านรู้เรื่องทันที และบอกด้วยว่าให้ไปกดที่ไหน (flow-1 ข้อ 2 · 4)
   */
  const needAttention = board.filter((row) => row.attention.level === 'red').length
  const stuck = board.filter((row) => row.attention.level === 'orange').length
  const pendingReviewCount = pending?.length ?? 0
  const requestCount = openRequests.length
  const nextStep = (() => {
    if (needAttention > 0)
      return {
        tone: 'danger' as const,
        text: `เดินไปหา ${needAttention} คนที่ขึ้นแดงก่อน คนอื่นยังรอได้`,
        action: 'help' as const,
        actionLabel: 'ดูว่าใครบ้าง',
      }
    if (requestCount > 0)
      return {
        tone: 'spark' as const,
        text: `มีคำขอเปลี่ยนแผนค้าง ${requestCount} ใบ ตอบให้เด็กรู้ว่าทำอะไรต่อ`,
        action: 'requests' as const,
        actionLabel: 'ไปตอบคำขอ',
      }
    if (stuck > 0)
      return {
        tone: 'spark' as const,
        text: `${stuck} คนเริ่มติด เดินดูรอบห้องได้แล้ว`,
        action: 'help' as const,
        actionLabel: 'ดูว่าใครบ้าง',
      }
    if (pendingReviewCount > 0)
      return {
        tone: 'brand' as const,
        text: `มีงาน ${pendingReviewCount} ชิ้นรอครูยืนยันคะแนน กดเพื่อเปิดตรวจทีละใบ`,
        action: 'review' as const,
        actionLabel: 'เปิดคิวตรวจ',
      }
    return {
      tone: 'quest' as const,
      text: 'ทั้งห้องเดินได้ตามปกติ เดินดูรอบห้องแล้วชมคนที่ทำได้',
      action: null,
      actionLabel: null,
    }
  })()

  return NextResponse.json({
    classroomId,
    now,
    nextStep,
    requests: requestCount,
    students: board.length,
    flagged: board.filter((row) => row.flag.flagged).length,
    needsHelp: board.filter((row) => row.askedForHelp).length,
    /** นับจากระดับความด่วนที่เซิร์ฟเวอร์ตัดสินแล้ว — ทุกจอต้องได้เลขชุดเดียวกันนี้ */
    needAttention,
    stuck,
    watching: board.filter((row) => row.attention.level === 'yellow').length,
    shouldTalk: board.filter((row) => row.calibration.some((c) => c.flag === 'ควรคุย')).length,
    shouldPraise: board.filter((row) => row.calibration.some((c) => c.flag === 'ควรชม')).length,
    pendingReview: pending?.length ?? 0,
    coachRules: coachPrompts.rules,
    board,
  })
}

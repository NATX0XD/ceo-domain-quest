import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { calibrationFlag, starsFor } from '@/core/personalize'
import { messageForCheck } from '@/core/response-messages'
import type { LearningRoute, MissionId } from '@/lib/db/repo'
import { getStudent, logEvent } from '@/lib/db/repo'
import { findMission } from '@/components/missions'
import {
  loadMissionRow,
  recordMissionAnswer,
  saveObjectiveOutcome,
  setMissionStarsDb,
  syncEarnedStars,
} from '@/components/server/game-state'
import { objectiveIdForMission } from '@/components/server/lesson-content'
import { hasShopProfile } from '@/components/server/shop-gate'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../../_lib/session-cookie'

/**
 * ตรวจคำตอบข้อ check ท้ายภารกิจ — ตรวจที่เซิร์ฟเวอร์เท่านั้น
 *
 * ⚠️ เฉลยอยู่ใน content/missions-answers.json ห้ามหลุดไปเบราว์เซอร์
 *    จึงอ่านด้วย dynamic import ตอนเรียกจริง ไม่ import ไว้บนหัวไฟล์
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น ตัวนับ attempts/hints บวกลง DB
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * UX-2 ข้อตรวจเล่นได้ 2 แบบ
 *  - `choiceIndex` ตัวเลือก ก ข ค ง ตามเดิม (คำถามเชิงความคิด เช่น m1 m4)
 *  - `placements` ประกอบชื่อเว็บจากชิ้นส่วนลงช่อง (ข้อที่เป็นโครงสร้างชื่อเว็บ เช่น m2)
 *
 * ⚠️ แบบประกอบชิ้นส่วนตรวจด้วย `gameKey` ที่มีอยู่แล้วใน content/missions-answers.json
 *    **ไม่ได้เพิ่มคีย์เนื้อหาใหม่** และเฉลยยังอยู่ฝั่งเซิร์ฟเวอร์เหมือนเดิมทุกประการ
 * ⚠️ ดาวยังคิดจาก attempts/hints ตัวเดิม (`starsFor`) ไม่ว่าจะเล่นแบบไหน
 */
const RequestSchema = z
  .object({
    checkId: z.string().min(1).optional(),
    choiceIndex: z.number().int().min(0).max(3).optional(),
    /** โหมดประกอบ: คู่ของ "รหัสช่อง" กับ "รหัสชิ้นส่วนที่วางลงไป" */
    placements: z.record(z.string().min(1), z.string().min(1)).optional(),
    channel: z.enum(['clip', 'card', 'game', 'buddy']).optional(),
    /** ความมั่นใจของผู้เรียนก่อนรู้ผล 1 = เดาเอา · 2 = พอได้ · 3 = มั่นใจ (content/self-profile.json) */
    confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  })
  .refine((v) => v.choiceIndex !== undefined || v.placements !== undefined, {
    message: 'ต้องส่ง choiceIndex หรือ placements อย่างใดอย่างหนึ่ง',
  })

const BuildKeySchema = z.object({
  kind: z.literal('build'),
  placements: z.array(z.object({ slot: z.string().min(1), piece: z.string().min(1) })).min(1),
})

const AnswersFileSchema = z.object({
  missions: z
    .array(
      z.object({
        id: z.string().min(1),
        checkId: z.string().min(1),
        answerIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(1),
        starCriteria: z.string().min(1),
        /** เฉลยของการต่อชิ้นส่วน — มีเฉพาะภารกิจที่มินิเกมเป็นแบบ build */
        gameKey: z.unknown().optional(),
      }),
    )
    .min(1),
})

type LoadResult =
  | { ok: true; data: z.infer<typeof AnswersFileSchema> }
  | { ok: false; code: 'answers-file-missing' | 'answers-file-invalid'; message: string }

async function loadAnswers(): Promise<LoadResult> {
  // เขียนเส้นทางตรง ๆ ไม่ประกอบจากตัวแปร ไม่งั้น Turbopack จะ trace ทั้งโปรเจกต์
  const fileUrl = pathToFileURL(join(process.cwd(), 'content', 'missions-answers.json')).href

  let raw: unknown
  try {
    const mod = (await import(/* turbopackIgnore: true */ fileUrl, {
      with: { type: 'json' },
    })) as { default: unknown }
    raw = mod.default
  } catch {
    return {
      ok: false,
      code: 'answers-file-missing',
      message: 'ยังไม่มีไฟล์เฉลย content/missions-answers.json จึงตรวจคำตอบไม่ได้',
    }
  }

  const parsed = AnswersFileSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'answers-file-invalid',
      message:
        'ไฟล์เฉลย content/missions-answers.json รูปแบบไม่ตรงสัญญา ต้องเป็น { missions: [{ id, checkId, answerIndex, explanation, starCriteria }] }',
    }
  }

  return { ok: true, data: parsed.data }
}

/**
 * กันกดรัว/เน็ตช้าแล้วเด็กกดซ้ำ (QA-1 พัง-5)
 * คำตอบเดิมของข้อเดิมภายในหน้าต่างเวลาสั้น ๆ ถือเป็นการกดซ้ำ ไม่นับ attempt ใหม่
 * เก็บบน globalThis เพื่อให้รอด hot reload ตอน dev
 */
const DOUBLE_SUBMIT_WINDOW_MS = 4000

const submitGuard = ((globalThis as typeof globalThis & {
  __dbqSubmitGuard?: Map<string, number>
}).__dbqSubmitGuard ??= new Map<string, number>())

function isDoubleSubmit(key: string, now: number): boolean {
  const last = submitGuard.get(key)
  submitGuard.set(key, now)
  return last !== undefined && now - last < DOUBLE_SUBMIT_WINDOW_MS
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')
  if (!(await hasShopProfile(session.studentId))) return NextResponse.json({ error: 'no-profile', message: 'ยังไม่ได้ตั้งค่าร้าน กลับไปที่หน้า /setup ก่อน', href: '/setup' }, { status: 409 })

  const mission = findMission(id)
  if (!mission) return errorResponse('mission-not-found', 'ไม่พบภารกิจนี้', 404, { missionId: id })

  const parsedBody = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsedBody.success) {
    return errorResponse(
      'bad-request',
      'ต้องส่ง choiceIndex เป็นตัวเลข 0-3 หรือ placements ของโหมดประกอบชิ้นส่วน',
      400,
    )
  }

  const answers = await loadAnswers()
  if (!answers.ok) return errorResponse(answers.code, answers.message, 503)

  const entry = answers.data.missions.find(
    (m) => m.id === mission.id && m.checkId === mission.check.id,
  )
  if (!entry) {
    return errorResponse(
      'answer-not-found',
      `ไฟล์เฉลยยังไม่มีข้อ ${mission.check.id} ของภารกิจ ${mission.id}`,
      503,
    )
  }

  /**
   * ตรวจคำตอบ — สองโหมด ผลลัพธ์ที่ได้คือ `correct` ตัวเดียวกัน ดาวจึงคิดเหมือนกันทุกประการ
   *
   * โหมดประกอบ: คืน `slotResults` เป็นรายช่อง **เฉพาะช่องที่ผู้เรียนวางของลงไปจริง**
   * บอกได้ว่า "ช่องนี้ยังไม่ใช่" แต่ห้ามบอกว่า "ช่องนี้ต้องวางชิ้นไหน" (กติกาเดียวกับ /game)
   */
  const placements = parsedBody.data.placements
  let correct: boolean
  let slotResults: Record<string, boolean> | null = null

  if (placements) {
    const key = BuildKeySchema.safeParse(entry.gameKey)
    if (!key.success) {
      return errorResponse(
        'assemble-key-unavailable',
        'ภารกิจนี้ยังตรวจแบบประกอบชิ้นส่วนไม่ได้ ลองตอบข้อเช็กแบบเลือกตัวเลือกแทนได้เลย',
        503,
      )
    }
    slotResults = {}
    let hit = 0
    for (const p of key.data.placements) {
      const given = placements[p.slot]
      if (given === undefined) continue
      const ok = given === p.piece
      slotResults[p.slot] = ok
      if (ok) hit += 1
    }
    correct = hit === key.data.placements.length
  } else {
    correct = parsedBody.data.choiceIndex === entry.answerIndex
  }

  /** คีย์กันกดรัว — โหมดประกอบใช้ชุดชิ้นส่วนที่วางไว้แทนหมายเลขตัวเลือก */
  const answerKey = placements
    ? Object.entries(placements)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([slot, piece]) => `${slot}=${piece}`)
        .join('|')
    : String(parsedBody.data.choiceIndex)

  /**
   * ผ่านภารกิจนี้ไปแล้ว + ตอบถูกซ้ำ = ไม่นับ attempt ใหม่และไม่แตะดาว (QA-2 ยังพัง-1)
   * เด็กกดซ้ำหรือเน็ตหน่วงแล้วกดใหม่ ต้องไม่เสียดาวที่ได้ไปแล้ว
   */
  const before = await loadMissionRow(session.studentId, mission.id as MissionId)
  if (before.passed && correct) {
    return NextResponse.json({
      correct: true,
      attempts: before.attempts,
      wrong: Math.max(0, before.attempts - 1),
      hintsUsed: before.hintsUsed,
      stars: before.stars,
      passed: true,
      duplicate: true,
      explanation: entry.explanation,
      starCriteria: entry.starCriteria,
      ...(slotResults ? { slotResults } : {}),
    })
  }

  // กดซ้ำคำตอบเดิมภายใน 4 วินาที = ไม่นับครั้งใหม่ คืนผลของครั้งล่าสุดไปเลย
  const guardKey = `${session.studentId}:${mission.id}:${answerKey}`
  if (isDoubleSubmit(guardKey, Date.now())) {
    const current = await loadMissionRow(session.studentId, mission.id as MissionId)
    return NextResponse.json({
      correct,
      attempts: current.attempts,
      wrong: Math.max(0, current.attempts - (current.passed ? 1 : 0)),
      hintsUsed: current.hintsUsed,
      stars: current.stars,
      passed: current.passed,
      duplicate: true,
      ...(slotResults ? { slotResults } : {}),
      ...(correct ? { explanation: entry.explanation, starCriteria: entry.starCriteria } : {}),
    })
  }

  const row = await recordMissionAnswer(
    session.studentId,
    mission.id as MissionId,
    correct,
    (parsedBody.data.channel as LearningRoute | undefined) ?? null,
  )

  // ดาวคิดจากกติกาใน core แล้วเขียนลง DB ให้แผงครูเห็นค่าเดียวกับนักเรียน
  const stars = starsFor({ passed: row.passed, attempts: row.attempts, hintsUsed: row.hintsUsed })
  if (stars !== row.stars) await setMissionStarsDb(session.studentId, mission.id as MissionId, stars)

  const fresh = await loadMissionRow(session.studentId, mission.id as MissionId)
  // ดาวรวมต้องลง profiles.earned_stars ทุกครั้ง แผงครูอ่านคอลัมน์นี้
  await syncEarnedStars(session.studentId)

  /**
   * ความมั่นใจที่ผู้เรียนบอกไว้ + ผลจริง = ธง calibration ให้ครู
   * 'ควรคุย' มั่นใจเต็มที่แต่ผิด · 'ควรชม' บอกว่าเดาแต่ถูก
   * ธงนี้ไม่มีผลกับคะแนนและไม่แสดงเป็นคำตัดสินให้ผู้เรียนเห็น
   */
  let calibration: ReturnType<typeof calibrationFlag> | null = null
  const objectiveId = objectiveIdForMission(mission.id)
  if (objectiveId) {
    // เก็บรายวัตถุประสงค์เสมอ (ผลถูก/ผิด) ส่วนความมั่นใจเก็บเมื่อผู้เรียนกรอกมา
    await saveObjectiveOutcome(session.studentId, objectiveId, {
      confidence: parsedBody.data.confidence,
      correct,
    })
  }
  if (parsedBody.data.confidence !== undefined) {
    calibration = calibrationFlag(parsedBody.data.confidence, correct)
    await logEvent(session.studentId, 'confidence-reported', {
      missionId: mission.id,
      confidence: parsedBody.data.confidence,
      correct,
      flag: calibration.flag,
      coachPromptId: calibration.coachPromptId,
    })
  }

  /**
   * S-19 ข้อความตอบกลับจากคลังใน content/messages.json
   *
   * เดิมหน้าจอเขียนข้อความเองแบบกลาง ๆ อันเดียวใช้ทุกกรณี ตอนนี้เลือกตามสถานการณ์จริง
   * (ถูกครั้งแรก / ถูกหลังพยายาม / ยังไม่ถูกครั้งแรก / ยังไม่ถูกซ้ำ) และ **หมุนตามจำนวนครั้งที่ตอบ
   * ไม่ได้สุ่ม** ตอบผิดรอบ 2 กับรอบ 3 จึงได้คนละประโยค แต่รีเฟรชหน้าแล้วยังได้ประโยคเดิม
   */
  const student = await getStudent(session.studentId).catch(() => null)
  const feedback = messageForCheck(
    { correct, attempts: fresh.attempts, alreadyPassed: false },
    { nickname: student?.nickname ?? null },
  )

  // ส่งคำอธิบายกลับเฉพาะตอนตอบถูก ตอบผิดไม่ส่งอะไรที่ชี้เฉลยได้
  return NextResponse.json({
    correct,
    attempts: fresh.attempts,
    wrong: Math.max(0, fresh.attempts - (fresh.passed ? 1 : 0)),
    hintsUsed: fresh.hintsUsed,
    stars: fresh.stars,
    passed: fresh.passed,
    /** ข้อความพร้อมแสดง เติมชื่อเล่นแล้ว หน้าจอเอาไปขึ้นได้เลยไม่ต้องแต่งต่อ */
    message: feedback.text,
    messageSituation: feedback.situation,
    // ส่งกลับแค่ให้หน้าจอรู้ว่าบันทึกความมั่นใจแล้ว ไม่ส่งคำตัดสินของครูไปให้ผู้เรียน
    confidenceSaved: parsedBody.data.confidence ?? null,
    teacherFlagged: calibration?.flag !== undefined && calibration?.flag !== null,
    /** โหมดประกอบ: ผิดตรงไหนบอกตรงจุด — มีเฉพาะช่องที่วางของไปแล้ว ไม่บอกว่าช่องนั้นต้องวางชิ้นไหน */
    ...(slotResults ? { slotResults } : {}),
    ...(correct ? { explanation: entry.explanation, starCriteria: entry.starCriteria } : {}),
  })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import rubric from '@/content/rubric.json'
import { confirmSubmissionScores, logEvent, teacherSetMissionStars } from '@/lib/db/repo'
import { toRubricDimensionId } from '@/components/server/lesson-content'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ครูยืนยันหรือแก้คะแนนของงานหนึ่งชิ้น — **ครูเป็นคนตัดสินเสมอ AI เป็นแค่ข้อเสนอ**
 *
 * รับคะแนน **รายด้านครบ 4 ด้าน** ตาม content/rubric.json + ด้านที่ถ่วง 2 เท่า
 * แล้วเซิร์ฟเวอร์คำนวณคะแนนรวมถ่วงน้ำหนักและดาวเอง ไม่เชื่อตัวเลขรวมที่ส่งมาจากหน้าจอ
 * (QA-2: เดิม API เก็บแค่ score ก้อนเดียว การแก้รายด้านบนจอจึงไม่ถูกบันทึกจริง)
 *
 * ⚠️ teacherId มาจาก cookie เท่านั้น · SQL ตรวจ EXISTS(งานอยู่ในห้องของครูคนนี้) ใน UPDATE เดียวกัน
 * ฝั่ง DB บันทึกร่องรอยให้: confirmed_by · confirmed_at · ai_scores_snapshot · teacher_changed
 * → เอาไปตอบกรรมการได้ว่าครูแก้ด้านไหนจากที่ AI เสนอบ้าง
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DIMENSION_IDS = rubric.dimensions.map((d) => d.id)
const DIMENSION_NAME: Record<string, string> = Object.fromEntries(
  rubric.dimensions.map((d) => [d.id, d.name]),
)
const MAX_PER_DIMENSION = Math.max(...rubric.dimensions.flatMap((d) => d.levels.map((l) => l.score)))
const MIN_PER_DIMENSION = Math.min(...rubric.dimensions.flatMap((d) => d.levels.map((l) => l.score)))

const ConfirmSchema = z.object({
  submissionId: z.string().uuid(),
  /** รูปแบบใหม่: คะแนนรายด้าน { "dim-naming": 3, ... } ครบทั้ง 4 ด้าน */
  dimensions: z.record(z.string(), z.number().int().min(MIN_PER_DIMENSION).max(MAX_PER_DIMENSION)).optional(),
  /** ด้านที่ถูกถ่วง 2 เท่า — ส่ง dimensionId หรือ emphasis option id ก็ได้ */
  emphasisDimensionId: z.string().optional(),
  /** รูปแบบเดิม (คะแนนก้อนเดียว) ยังรับได้เพื่อไม่ให้หน้าจอเก่าพัง */
  score: z.number().int().min(0).max(100).optional(),
  maxScore: z.number().int().min(1).max(100).optional(),
  /**
   * บังคับเขียนข้อความถึงผู้เรียนอย่างน้อย 1 บรรทัด (judge-qa ข้อ 12 · QA-2 ยังพัง-3)
   * คะแนนที่ไม่มีคำอธิบายไม่ช่วยให้ผู้เรียนรู้ว่าต้องแก้อะไร
   */
  note: z.string().trim().min(1).max(500),
  /** ให้ดาวภารกิจใหญ่ตามคะแนนที่ครูตัดสิน (0-3) ไม่ส่ง = คิดจาก starBands ให้เอง */
  stars: z.number().int().min(0).max(3).optional(),
})

/** คะแนนรวมถ่วงน้ำหนัก = (ด้านที่เน้น x 2) + อีก 3 ด้านรวมกัน — สูตรจาก content/rubric.json */
function weightedTotalOf(dimensions: Record<string, number>, emphasisDimensionId: string | null): number {
  return DIMENSION_IDS.reduce((sum, id) => {
    const value = dimensions[id] ?? 0
    return sum + (id === emphasisDimensionId ? value * 2 : value)
  }, 0)
}

function starsFromWeighted(weighted: number): number {
  const band = rubric.scoring.starBands.find(
    (b) => weighted >= b.minWeighted && weighted <= b.maxWeighted,
  )
  return band?.stars ?? 0
}

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = ConfirmSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse(
      'bad-request',
      `ต้องส่ง submissionId · คะแนนรายด้านครบ 4 ด้าน (${DIMENSION_IDS.join(', ')}) ด้านละ ${MIN_PER_DIMENSION}-${MAX_PER_DIMENSION} · และข้อความถึงผู้เรียนอย่างน้อย 1 บรรทัด`,
    )
  }

  const body = parsed.data
  let scores: Record<string, unknown>

  if (body.dimensions) {
    // แปลงคีย์ให้เป็นรหัสมาตรฐาน `dim-*` ก่อนตรวจ หน้าจอจึงส่ง bm-r* หรือ emphasis-* มาได้เหมือนกัน
    const unknownKeys = Object.keys(body.dimensions).filter((id) => !toRubricDimensionId(id))
    if (unknownKeys.length > 0) {
      return errorResponse('bad-request', `ไม่รู้จักด้าน: ${unknownKeys.join(', ')}`)
    }
    const dimensions: Record<string, number> = Object.fromEntries(
      Object.entries(body.dimensions).map(([id, score]) => [toRubricDimensionId(id) ?? id, score]),
    )

    const missing = DIMENSION_IDS.filter((id) => typeof dimensions[id] !== 'number')
    if (missing.length > 0) {
      return errorResponse('bad-request', `ขาดคะแนนของด้าน: ${missing.join(', ')}`)
    }

    /**
     * รหัสด้านมี 3 ชุดที่ใช้กันจริง: `dim-*` (มาตรฐาน) · `bm-r*` (หน้าด่านบอสส่งมาเป็น focusRubricId)
     * · `emphasis-*` (ตัวเลือกบนหน้าจอครู) — แปลงที่ `toRubricDimensionId()` ที่เดียว
     * เดิมไฟล์นี้มีตารางแม็ปของตัวเองที่รู้จักแค่ `emphasis-*` ส่ง `bm-r2` มาจึงได้ 400 (api5 ข้อ 3)
     */
    const rawEmphasis = body.emphasisDimensionId ?? null
    const emphasisDimensionId = rawEmphasis ? toRubricDimensionId(rawEmphasis) : null
    if (rawEmphasis && !emphasisDimensionId) {
      return errorResponse('bad-request', `ไม่รู้จักด้านที่ถ่วงน้ำหนัก: ${rawEmphasis}`)
    }

    // เซิร์ฟเวอร์คำนวณเอง ไม่รับตัวเลขรวมจากหน้าจอ
    const weightedTotal = weightedTotalOf(dimensions, emphasisDimensionId)
    scores = {
      dimensions,
      dimensionNames: Object.fromEntries(DIMENSION_IDS.map((id) => [id, DIMENSION_NAME[id]])),
      emphasisDimensionId,
      weightedTotal,
      weightedMax: rubric.scoring.weightedMax,
      stars: body.stars ?? starsFromWeighted(weightedTotal),
      note: body.note,
      confirmedByTeacher: true,
    }
  } else if (typeof body.score === 'number') {
    scores = {
      score: body.score,
      maxScore: body.maxScore ?? 3,
      note: body.note,
      confirmedByTeacher: true,
    }
  } else {
    return errorResponse('bad-request', 'ต้องส่ง dimensions (รายด้าน) หรือ score (ก้อนเดียว) อย่างใดอย่างหนึ่ง')
  }

  const submission = await confirmSubmissionScores(
    session.teacherId,
    body.submissionId,
    scores as never,
  )

  if (!submission) {
    return errorResponse('not-found', 'ไม่พบงานชิ้นนี้ในห้องของคุณ', 404)
  }

  /**
   * ดาวของภารกิจใหญ่มาจากคะแนนที่ "ครู" ตัดสิน แล้วคิดดาวรวมใหม่ให้ทุกจอตรงกัน
   *
   * ⚠️ ต้องผ่าน RPC ฝั่งครูเท่านั้น (REVIEW-8 H-1) ของเดิมเรียก setMissionStars ซึ่ง upsert
   * ตาราง mission_progress ตรง ๆ โดยไม่มีธง `app.teacher_write` → เลยวันหมดเขตทำต่อที่บ้าน
   * เมื่อไร ครูกดยืนยันคะแนนแล้วได้ 500 ทุกครั้ง ใบนั้นค้างในคิวตรวจตลอดไป
   */
  const confirmedStars = typeof scores.stars === 'number' ? scores.stars : null
  if (confirmedStars !== null) {
    await teacherSetMissionStars(session.teacherId, submission.student_id, 'boss', confirmedStars)
  }

  /**
   * ครูแก้ด้านไหน "รอบนี้"
   *
   * เทียบกับค่าที่ครูยืนยันไว้ครั้งก่อนเป็นหลัก (`teacher_scores_before` เก็บให้โดย SQL)
   * ถ้าเป็นการยืนยันครั้งแรกจึงค่อยเทียบกับข้อเสนอของกฎ/AI
   *
   * ⚠️ ของเดิมเทียบกับ `ai_scores_snapshot.dimensions` โดยอ่านเป็น map `{dim-x: 3}`
   *    แต่ของจริงเป็น **array ของ object** `[{id, score, ...}]` ค่าที่อ่านได้จึง undefined ทุกตัว
   *    ผลคือขึ้นครบ 4 ด้านเสมอแม้ครูไม่ได้แก้อะไรเลย (result-api5 ข้อ 4)
   */
  const teacherDimensionsOf = (value: unknown): Record<string, number> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const dims = (value as Record<string, unknown>).dimensions
    if (!dims || typeof dims !== 'object' || Array.isArray(dims)) return null
    return dims as Record<string, number>
  }

  /** `ai_scores.dimensions` เป็น array ของ object — แปลงเป็น map ก่อนเทียบ */
  const aiDimensionsOf = (value: unknown): Record<string, number> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const dims = (value as Record<string, unknown>).dimensions
    if (!Array.isArray(dims)) return teacherDimensionsOf(value)
    const out: Record<string, number> = {}
    for (const raw of dims) {
      if (!raw || typeof raw !== 'object') continue
      const row = raw as { id?: unknown; score?: unknown }
      const id = typeof row.id === 'string' ? toRubricDimensionId(row.id) : null
      if (id && typeof row.score === 'number') out[id] = row.score
    }
    return Object.keys(out).length > 0 ? out : null
  }

  const previousTeacher = teacherDimensionsOf(submission.teacher_scores_before)
  const baseline = previousTeacher ?? aiDimensionsOf(submission.ai_scores_snapshot)
  /** เทียบกับอะไร — หน้าจอ/Postman จะได้ตีความ changedDimensions ถูก */
  const changedFrom: 'teacher' | 'ai' | null = previousTeacher
    ? 'teacher'
    : baseline
      ? 'ai'
      : null

  const confirmedDimensions = teacherDimensionsOf(submission.teacher_confirmed_scores)
  const changedDimensions =
    confirmedDimensions && baseline
      ? DIMENSION_IDS.filter((id) => baseline[id] !== confirmedDimensions[id])
      : []

  await logEvent(submission.student_id, 'teacher.score-confirmed', {
    submissionId: submission.id,
    aiScores: submission.ai_scores_snapshot,
    teacherScores: submission.teacher_confirmed_scores,
    teacherChanged: submission.teacher_changed,
    changedDimensions,
    changedFrom,
  })

  return NextResponse.json({
    ok: true,
    submission: {
      id: submission.id,
      needsReview: submission.needs_review,
      /** ค่าที่บันทึกจริงในฐานข้อมูล — หน้าจอเอาไปยืนยันได้ว่าที่แก้ถูกเก็บแล้ว */
      teacherScores: submission.teacher_confirmed_scores,
      aiScores: submission.ai_scores_snapshot,
      teacherChanged: submission.teacher_changed,
      /**
       * ด้านที่ครูแก้ **รอบนี้** — เทียบกับคำตัดสินครั้งก่อนของครูเอง
       * ถ้าเป็นการยืนยันครั้งแรก เทียบกับข้อเสนอของกฎ/AI (ดู `changedFrom`)
       */
      changedDimensions,
      /** 'teacher' = เทียบกับรอบก่อนของครู · 'ai' = ยืนยันครั้งแรก เทียบกับข้อเสนอ · null = ไม่มีอะไรให้เทียบ */
      changedFrom,
      /** คะแนนที่ครูยืนยันไว้ครั้งก่อน (null = ครั้งนี้ครั้งแรก) */
      previousTeacherScores: submission.teacher_scores_before,
      confirmedAt: submission.confirmed_at,
    },
  })
}

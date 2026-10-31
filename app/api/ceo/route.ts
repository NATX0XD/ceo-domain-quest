import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/lib/db/types'
import { listSubmissions, logEvent, saveSubmission, type Submission } from '@/lib/db/repo'
import {
  readTeacherConfirmedScores,
  type TeacherConfirmedScores,
} from '@/lib/db/submission-scores'
import { fallbackGradeReason } from '@/lib/ai'
import { sourceInfo } from '@/components/server/ai'
import { backgroundGrader } from '@/components/server/grade-queue'
import { loadShopProfile, syncEarnedStars } from '@/components/server/game-state'
import {
  bigMission,
  isRubricId,
  isSubmitModeId,
  rubricDimensions,
  toRubricDimensionId,
} from '@/components/server/lesson-content'
import { revisionDimensions, revisionState } from '@/components/server/revision'
import { moderateFields } from '@/components/server/moderation'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../_lib/session-cookie'

/**
 * ภารกิจใหญ่ CEO (ขั้นที่ 4) — ส่งใบเสนอชื่อเว็บลงตาราง submissions
 *
 * ผู้เรียนเลือกเองได้ทั้งรูปแบบการส่งงาน (เขียน/อัดเสียง/ออกแบบ)
 * และด้านของรูบริกที่อยากให้ประเมินหนักเป็นพิเศษ (ถ่วง 2 เท่า) เปลี่ยนได้จนกว่าจะกดส่ง
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ⚠️ คะแนนจริงเป็นของครู ระบบไม่ตัดสินคะแนนภารกิจใหญ่เอง (needs_review = true เสมอ)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODE_TO_FORMAT: Record<string, 'write' | 'voice' | 'design'> = {
  'bm-mode-write': 'write',
  'bm-mode-voice': 'voice',
  'bm-mode-design': 'design',
}

const RequestSchema = z.object({
  modeId: z.string().min(1),
  focusRubricId: z.string().min(1),
  fields: z.record(z.string().min(1), z.string().max(1000)),
  selfAssessment: z.record(z.string().min(1), z.string().max(1000)),
})

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')
  /**
   * ต้องกรองแบบเดียวกับ POST — ใบของสถานี B ไม่มี emphasis_criterion ส่วนใบภารกิจใหญ่บังคับมีเสมอ
   * ถ้าไม่กรอง นักเรียนที่เพิ่งยื่นจดทะเบียนที่ m3 จะเปิดหน้าด่านบอสแล้วเจอว่า "ส่งไปแล้ว" ทั้งที่ยังไม่ได้ส่ง
   */
  const all = await listSubmissions(session.studentId)
  const state = revisionState(all)
  const latest = state.latest
  return NextResponse.json({
    submitted: latest !== null,
    submission: latest
      ? {
          domainName: latest.domain_name,
          tld: latest.tld,
          format: latest.format,
          emphasisCriterion: latest.emphasis_criterion,
          createdAt: latest.created_at,
        }
      : null,
    /**
     * ลูปแก้งาน (สเปกข้อ 3.3) — หน้าจอใช้ตัดสินว่าจะเปิดฟอร์มให้ส่งใหม่ไหม
     * แต่คนที่ตัดสินจริงคือ POST ข้างล่าง หน้าจอแค่แสดงผล
     */
    revision: state.request
      ? {
          note: state.request.note,
          dimensions: revisionDimensions(state.request),
          round: state.roundsUsed + 1,
          roundsLeft: state.roundsLeft,
        }
      : null,
    canResubmit: state.canResubmit,
    versionCount: state.versionCount,
    blockedReason: state.blockedReason,
    /**
     * S-27 ความเห็นที่ระบบเสนอ ให้ **นักเรียนเห็นด้วย** ไม่ใช่เห็นแต่ครู
     * ใช้ผลจากกฎเป็นหลัก (มีทันทีตอนกดส่ง) ถ้า AI ตรวจเสร็จแล้วก็บอกว่ามีความเห็นของ AI ด้วย
     * ⚠️ **ไม่ส่งดาวหรือคะแนนของคนอื่น** และย้ำเสมอว่าเป็นข้อเสนอ ครูเป็นคนตัดสิน
     */
    feedback: latest ? studentFacingFeedback(latest) : null,
  })
}

interface ScoreDimensionView {
  id: string
  name: string
  score: number
  levelLabel: string
  evidence: string
  suggestion: string
  emphasized: boolean
}

/** ป้ายระดับของรูบริกตามคะแนน เช่น 3 = "ดีมาก" — เอามาจาก content/rubric.json ไม่แต่งเอง */
function levelLabelOf(dimensionId: string, score: number): string {
  const dimension = rubricDimensions.find((d) => d.id === dimensionId)
  return dimension?.levels.find((l) => l.score === score)?.label ?? ''
}

/**
 * ความเห็นรายด้านที่เจ้าของงานเห็น (S-27)
 *
 * ⚠️ **ลำดับความจริง: คะแนนของครูมาก่อนเสมอ**
 *    ครูยืนยันแล้ว -> ตัวเลขทุกตัวเป็นของครู · ยังไม่ยืนยัน -> เป็นข้อเสนอจากกฎ/AI และต้องบอกว่ายังรอครู
 *    เคยพลาดมาแล้ว (QA-3 ข้อ 1.1) เพราะไปอ่าน `confirmedByTeacher` จาก `ai_scores` ซึ่งไม่เคยมีคีย์นั้น
 *    ตอนนี้ตัดสินด้วย `readTeacherConfirmedScores()` ที่ lib/db/submission-scores.ts ทางเดียว
 * ⚠️ ไม่ส่งดาวหรือคะแนนของคนอื่นออกไปทุกกรณี
 */
function studentFacingFeedback(submission: Submission) {
  const teacher = readTeacherConfirmedScores(submission)

  const bag =
    submission.ai_scores && typeof submission.ai_scores === 'object' && !Array.isArray(submission.ai_scores)
      ? (submission.ai_scores as Record<string, unknown>)
      : null
  const rule = (bag?.ruleScores ?? null) as Record<string, unknown> | null
  const ai = (bag?.aiProposed ?? null) as Record<string, unknown> | null
  const source = (rule ?? bag) as Record<string, unknown> | null

  const proposed: ScoreDimensionView[] = Array.isArray(source?.dimensions)
    ? (source.dimensions as ScoreDimensionView[])
    : []

  if (teacher) return teacherFacingScores(teacher, proposed)
  if (proposed.length === 0) return null

  return {
    dimensions: proposed.map((d) => ({
      id: d.id,
      name: d.name,
      score: d.score,
      levelLabel: d.levelLabel,
      evidence: d.evidence,
      suggestion: d.suggestion,
      emphasized: d.emphasized,
    })),
    weightedTotal: typeof source?.weightedTotal === 'number' ? source.weightedTotal : null,
    weightedMax: typeof source?.weightedMax === 'number' ? source.weightedMax : null,
    summary: typeof source?.feedback === 'string' ? source.feedback : null,
    /** AI ตรวจเสร็จหรือยัง — บอกเฉย ๆ ไม่ได้เอาคะแนน AI มาแทนของกฎ */
    aiReady: ai !== null,
    aiSummary: ai && typeof ai.feedback === 'string' ? ai.feedback : null,
    teacherConfirmed: false as const,
  }
}

/**
 * ครูยืนยันแล้ว — ตัวเลขทั้งหมดเป็นของครู
 * ข้อความ evidence/suggestion ยืมของกฎมาช่วยอธิบายงานได้ (เป็นคำบรรยายชิ้นงาน ไม่ใช่คำตัดสิน)
 * แต่ **คะแนนกับป้ายระดับต้องคิดจากคะแนนของครูเท่านั้น** ไม่งั้นเลขกับคำจะขัดกันเอง
 */
function teacherFacingScores(
  teacher: TeacherConfirmedScores,
  proposed: readonly ScoreDimensionView[],
) {
  const byId = new Map(proposed.map((d) => [d.id, d]))

  const dimensions: ScoreDimensionView[] = teacher.dimensions
    ? Object.entries(teacher.dimensions).map(([id, score]) => ({
        id,
        name: teacher.dimensionNames[id] ?? byId.get(id)?.name ?? id,
        score,
        levelLabel: levelLabelOf(id, score),
        evidence: byId.get(id)?.evidence ?? '',
        suggestion: byId.get(id)?.suggestion ?? '',
        emphasized: teacher.emphasisDimensionId === id,
      }))
    : []

  // เรียงตามลำดับด้านในรูบริก ไม่ใช่ลำดับคีย์ที่บังเอิญอยู่ใน JSON
  const order = new Map(rubricDimensions.map((d, i) => [d.id, i]))
  dimensions.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))

  return {
    dimensions,
    weightedTotal: teacher.weightedTotal,
    weightedMax: teacher.weightedMax,
    summary: teacher.note,
    /** ครูตัดสินจบแล้ว ไม่ต้องบอกว่า AI กำลังอ่านอยู่อีก */
    aiReady: true as const,
    aiSummary: null,
    teacherConfirmed: true as const,
  }
}

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  /**
   * ส่งซ้ำได้เมื่อครูกด "ส่งกลับให้แก้" เท่านั้น (สเปกข้อ 3.3)
   * ฉบับใหม่เป็น **แถวใหม่** ฉบับเดิมไม่ถูกทับ ครูจึงเทียบได้ว่านักเรียนแก้อะไร
   * เกินโควตารอบแก้แล้วไม่ตัน — ครูติ๊กปลดล็อกให้แก้ต่อได้ที่หน้าครู
   */
  const state = revisionState(await listSubmissions(session.studentId))
  if (!state.canResubmit) {
    return errorResponse(
      state.request ? 'revision-limit' : 'already-submitted',
      state.blockedReason ?? 'ส่งใบเสนอไปแล้ว',
      409,
      state.request
        ? { nextHref: '/result', nextLabel: 'ดูสถานะงานของฉัน', roundsUsed: state.roundsUsed }
        : { nextHref: '/showcase', nextLabel: 'ไปดูผลงานของเพื่อน' },
    )
  }
  const revisionRound = state.versionCount

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'รูปแบบข้อมูลใบเสนอไม่ถูกต้อง', 400)

  const { modeId, focusRubricId, fields, selfAssessment } = parsed.data
  if (!isSubmitModeId(modeId)) return errorResponse('bad-mode', 'ไม่มีรูปแบบการส่งงานนี้', 400)
  if (!isRubricId(focusRubricId)) return errorResponse('bad-rubric', 'ไม่มีด้านนี้ในรูบริก', 400)

  // ตรวจความครบถ้วนที่เซิร์ฟเวอร์ ไม่เชื่อการตรวจของหน้าเว็บ
  const missing = bigMission.fields
    .filter((f) => f.required && (fields[f.id] ?? '').trim().length === 0)
    .map((f) => f.label)
  const missingSelf = bigMission.selfAssessment.filter(
    (s) => (selfAssessment[s.id] ?? '').trim().length === 0,
  ).length

  if (missing.length > 0 || missingSelf > 0) {
    return errorResponse('incomplete', 'ยังกรอกไม่ครบ', 422, {
      missingFields: missing,
      missingSelfAssessment: missingSelf,
    })
  }

  /**
   * ทุกช่องที่นักเรียนพิมพ์ในใบเสนอต้องผ่านตัวกรอง E-11 ก่อนบันทึก
   * ใบนี้ขึ้นผนังผลงานให้เพื่อนเห็น จึงตรวจแบบ "เพื่อนเห็น" (เข้มขึ้น 1 ขั้น)
   * ไม่ผ่าน = ไม่บันทึก แต่คืนข้อความเดิมกลับไปให้แก้ ไม่ลบทิ้งเงียบ ๆ
   */
  const moderated = await moderateFields(
    session.studentId,
    'boss-reason',
    Object.entries(fields).map(([id, text]) => ({ id, text })),
    { forPeers: true },
  )
  if (!moderated.ok && moderated.verdict) {
    return errorResponse('content-flagged', moderated.verdict.message ?? 'ลองเขียนใหม่นะ', 422, {
      field: moderated.failedFieldId,
      original: moderated.verdict.original,
    })
  }

  const domainField = bigMission.fields[0]
  const tldField = bigMission.fields[1]
  /**
   * เหตุผลคือช่องแบบ textarea เท่านั้น (bm-f3..bm-f5)
   * ของเดิมใช้ slice(2) ซึ่งกินช่อง bm-f2b (ช่องข้อความสั้นของ .ไทย) เข้ามาด้วย
   * ทำให้ใบเสนอบนกระดานผลงานขึ้นหัวข้อ "1." ว่างเปล่าแล้วเลขข้อเลื่อนทั้งชุด (QA-2 ใหม่-2)
   */
  const reasonFields = bigMission.fields.filter((f) => f.type === 'textarea')

  const reasonText = reasonFields
    .map((f, i) => `${i + 1}. ${(fields[f.id] ?? '').trim()}`)
    .join('\n')
  const tldValue = (tldField ? fields[tldField.id] : '')?.trim() ?? ''

  /**
   * ให้ชั้น AI เสนอคะแนนเหตุผล — โมเดลล่มหรือช้าเกิน 5 วิ ก็ตกไปทางกฎล้วนเองโดยอัตโนมัติ
   * คะแนนนี้เป็นเพียงข้อเสนอ ครูยืนยันเสมอ (needs_review = true ทุกใบ)
   */
  const shop = await loadShopProfile(session.studentId)

  /**
   * **ให้คะแนนด้วยกฎทันที ไม่รอ AI** (มติ master)
   * นาทีที่ 40-50 นักเรียน 30 คนกดส่งพร้อมกัน ถ้ารอโมเดลจะช้าและโควตาไม่พอ
   * กฎล้วนไม่เรียกเน็ตเลย ตอบทันที ครูจึงเห็นคะแนนได้ทั้งห้องแน่นอน
   * ส่วนคะแนนที่ AI เสนอจะตามมาทีหลัง (ดูหมายเหตุ gradingStatus ข้างล่าง)
   */
  const gradeInput = {
    tldId: tldValue.replace(/^\./, '').replaceAll('.', '-'),
    reasonText,
    domainName: (domainField ? fields[domainField.id] : '')?.trim(),
    businessTypeId: shop?.businessTypeId,
    shopName: shop?.shopName,
    isRegisteredCompany: shop?.isRegisteredCompany,
    audience: shop?.audience,
    // lib/ai รู้จักเฉพาะ dim-* / emphasis-* จึงต้องแปลงจาก bm-r* ก่อน
    emphasisCriterion: toRubricDimensionId(focusRubricId) ?? focusRubricId,
    studentId: session.studentId,
    missionId: 'big-ceo',
    role: 'boss' as const,
  }
  /**
   * ให้คะแนนด้วยกฎทันที แล้วฝากงานเข้าคิวให้ AI ตรวจทีหลัง
   * submit() ไม่แตะเน็ตเลย จึงจบในหลักมิลลิวินาที นักเรียนไม่ต้องรอ
   */
  const graded = fallbackGradeReason(gradeInput, 'not-requested')
  const meta = sourceInfo(graded)

  const submission = await saveSubmission(session.studentId, {
    domainName: (domainField ? fields[domainField.id] : '')?.trim() ?? '',
    tld: tldValue,
    reasonText,
    aiScores: {
      /**
       * ตอนนี้เก็บ "คะแนนจากกฎ" ไว้ก่อน ครูเห็นได้ทันที
       * gradingStatus บอกครูว่าคะแนนที่ AI เสนอยังไม่มา ('pending-ai')
       * พอฝั่ง DB มีฟังก์ชันอัปเดต ai_scores ย้อนหลัง จะเติมช่อง aiProposed แล้วเปลี่ยนเป็น 'done'
       */
      // 'pending-ai' = คะแนนที่เห็นมาจากกฎ งานเข้าคิวรอ AI ตรวจอยู่ (worker เติม aiProposed ให้ทีหลัง)
      gradingStatus: 'pending-ai',
      /** ฉบับที่เท่าไรของคนนี้ (1 = ฉบับแรก) ครูใช้เทียบว่าที่แก้มาดีขึ้นตรงไหน */
      version: revisionRound + 1,
      ruleScores: {
        dimensions: graded.dimensions,
        weightedTotal: graded.weightedTotal,
        weightedMax: graded.weightedMax,
        stars: graded.stars,
        feedback: graded.feedback,
      },
      aiProposed: null,
      // คะแนนรายด้านครบทุกด้าน ครูแก้รายด้านได้ ไม่ใช่แก้ได้แค่ตัวเลขรวม
      dimensions: graded.dimensions,
      emphasisDimensionId: graded.emphasisDimensionId,
      weightedTotal: graded.weightedTotal,
      weightedMax: graded.weightedMax,
      stars: graded.stars,
      score: graded.weightedTotal,
      maxScore: graded.weightedMax,
      feedback: graded.feedback,
      needsTeacherConfirm: graded.needsTeacherConfirm,
      ...meta,
    } as unknown as NonNullable<Json>,
    format: MODE_TO_FORMAT[modeId] ?? 'write',
    emphasisCriterion: focusRubricId,
    selfScores: selfAssessment as NonNullable<Json>,
    needsReview: true,
  })

  /**
   * ฝากงานให้ AI ตรวจเบื้องหลัง — ไม่รอผล ไม่แตะเน็ตในคำขอนี้
   * ถ้าเข้าคิวไม่สำเร็จก็ไม่กระทบนักเรียน เพราะคะแนนจากกฎบันทึกไปแล้ว
   */
  const queued = await backgroundGrader()
    .submit({ ...gradeInput, submissionId: submission.id })
    .then((result) => result.jobId)
    .catch(() => null)

  // ดาวของภารกิจใหญ่ให้ทันทีจากคะแนนที่เสนอ แล้วเขียนดาวรวมลง DB
  const totalStars = await syncEarnedStars(session.studentId)

  await logEvent(session.studentId, 'ceo-submitted', {
    submissionId: submission.id,
    weightedTotal: graded.weightedTotal,
    stars: graded.stars,
    ...meta,
  })

  return NextResponse.json({
    ok: true,
    submitted: true,
    submissionId: submission.id,
    version: revisionRound + 1,
    emphasisCriterion: submission.emphasis_criterion,
    format: submission.format,
    // คะแนนที่เสนอ + ที่มา ครูเป็นคนยืนยันคะแนนจริงเสมอ
    proposedScore: graded.weightedTotal,
    proposedMaxScore: graded.weightedMax,
    proposedStars: graded.stars,
    dimensions: graded.dimensions,
    emphasisDimensionId: graded.emphasisDimensionId,
    feedback: graded.feedback,
    needsTeacherConfirm: graded.needsTeacherConfirm,
    totalStars,
    /** งานที่เข้าคิวให้ AI ตรวจทีหลัง (null = เข้าคิวไม่สำเร็จ ไม่กระทบคะแนนที่ได้ไปแล้ว) */
    gradeJobQueued: queued !== null,
    nextHref: '/reflect',
    ...meta,
  })
}

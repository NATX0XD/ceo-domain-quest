import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/lib/db/types'
import { listSubmissions, logEvent, saveSubmission, withAiSwitch } from '@/lib/db/repo'
import { fallbackGradeReason } from '@/lib/ai'
import { findTld } from '@/core/content'
import { evaluateTld } from '@/core/tld-rules'
import { ai, sourceInfo } from '@/components/server/ai'
import { loadShopProfile, recordStationBAttemptDb } from '@/components/server/game-state'
import { pretestBlockResponse } from '@/components/server/pretest-required'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ยื่นป้ายร้านเข้าช่องที่สถานี B — เซิร์ฟเวอร์ตัดสินเท่านั้น
 *
 * มติ master (รีวิว R7 ข้อ 8): **บังคับพิมพ์เหตุผล** ว่าทำไมนามสกุลนี้เหมาะกับร้าน
 * เพราะการอธิบายเหตุผลคือจุดสอนที่แรงที่สุดของเกม ไม่ส่งเหตุผลมา = 400 ไม่ตัดสินให้
 * เหตุผลที่ยื่นผ่านแล้วถูกเก็บลง submissions.reason_text และให้ชั้น AI เสนอคะแนน (ครูยืนยันเสมอ)
 *
 * ⚠️ รับจาก body ได้แค่ tldId กับ reasonText · โปรไฟล์ร้านและตัวนับอ่านจาก DB ด้วยคุกกี้ dbq_student
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** สั้นกว่านี้ไม่ถือว่าเป็นเหตุผล — ตัวเลขเดียวกับเกณฑ์ข้อแรกของ fallbackGradeReason */
const MIN_REASON_LENGTH = 10

const RequestSchema = z.object({
  tldId: z.string().min(1).max(40),
  reasonText: z.string().max(500).optional(),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const profile = await loadShopProfile(session.studentId)
  if (!profile) {
    return errorResponse('no-profile', 'ยังไม่ได้ตั้งค่าร้าน กลับไปที่หน้า /setup ก่อน', 409)
  }
  const pretestBlocked = await pretestBlockResponse(session.studentId)
  if (pretestBlocked) return pretestBlocked

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง tldId มาด้วย', 400)

  const reasonText = (parsed.data.reasonText ?? '').trim()
  if (reasonText.length < MIN_REASON_LENGTH) {
    return errorResponse(
      'reason-required',
      `ก่อนยื่น ต้องเขียนเหตุผลว่าทำไมนามสกุลนี้เหมาะกับร้านของเรา อย่างน้อย ${MIN_REASON_LENGTH} ตัวอักษร`,
      400,
      { minLength: MIN_REASON_LENGTH },
    )
  }

  const tld = findTld(parsed.data.tldId)
  if (!tld) return errorResponse('tld-not-found', 'ไม่มีช่องนี้', 404)

  const verdict = evaluateTld(tld, profile)
  const station = await recordStationBAttemptDb(session.studentId, verdict.accepted)

  // ให้ชั้น AI เสนอคะแนนเหตุผล — ไม่มีคีย์ก็ตกไปทางกฎล้วนเอง ไม่ throw
  const gradeInput = {
    tldId: tld.id,
    reasonText,
    domainName: profile.domainName,
    businessTypeId: profile.businessTypeId,
    shopName: profile.shopName,
    isRegisteredCompany: profile.isRegisteredCompany,
    audience: profile.audience,
    studentId: session.studentId,
    missionId: 'station-b',
    role: 'boss' as const,
  }
  /** ครูกดปิด AI ทั้งห้อง = ใช้กฎในโค้ดตรวจเหตุผลทันที ไม่เรียกโมเดล (REVIEW-8 H-3) */
  const graded = await withAiSwitch(
    session.studentId,
    () => ai.gradeReason(gradeInput),
    () => fallbackGradeReason(gradeInput, 'not-requested'),
  )
  const meta = sourceInfo(graded)

  await logEvent(session.studentId, 'station-b-reason', {
    tldId: tld.id,
    accepted: verdict.accepted,
    score: graded.weightedTotal,
    ...meta,
  })

  /**
   * บันทึกใบยื่นเมื่อผ่านแล้วเท่านั้น และบันทึกครั้งเดียวต่อคน
   * แถวของสถานี B ไม่มี emphasis_criterion (ภารกิจใหญ่บังคับใส่เสมอ) จึงแยกกันได้ที่ /api/ceo
   */
  let savedSubmissionId: string | null = null
  if (verdict.accepted) {
    const existing = await listSubmissions(session.studentId)
    const alreadyFromStationB = existing.some((s) => s.emphasis_criterion === null)
    if (!alreadyFromStationB) {
      const submission = await saveSubmission(session.studentId, {
        domainName: profile.domainName,
        tld: tld.suffix,
        reasonText,
        aiScores: {
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
        needsReview: true,
        format: 'write',
      })
      savedSubmissionId = submission.id
    }
  }

  return NextResponse.json({
    accepted: verdict.accepted,
    reason: verdict.reason,
    tldId: tld.id,
    suffix: tld.suffix,
    domain: verdict.accepted ? `${profile.domainName}${tld.suffix}` : null,
    attempts: station.attempts,
    hintsUsed: station.hintsUsed,
    submissionId: savedSubmissionId,
    // คะแนนเหตุผลเป็นข้อเสนอ ครูยืนยันเสมอ
    reasonScore: graded.weightedTotal,
    reasonMaxScore: graded.weightedMax,
    reasonFeedback: graded.feedback,
    needsTeacherConfirm: graded.needsTeacherConfirm,
    ...meta,
  })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import rubric from '@/content/rubric.json'
import { confirmSubmissionScores, listSubmissions, logEvent, teacherSetMissionStars } from '@/lib/db/repo'
import { loadBigMissionStars } from '@/components/server/game-state'
import { buildRevisionBag, bigMissionSubmissions } from '@/components/server/revision'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ครูส่งงานกลับให้นักเรียนแก้ (สเปกข้อ 3.3 "ส่งให้ครูยืนยัน --ให้แก้--> กลับไปทำด่านบอส")
 *
 * ครูเลือกด้านที่ต้องแก้ + เขียนความเห็นสั้น ๆ แล้วส่งกลับ
 * นักเรียนแก้แล้วส่งใหม่เป็น **ฉบับใหม่** ฉบับเดิมไม่ถูกทับ ครูจึงเทียบได้ว่าแก้อะไร
 *
 * ⚠️ teacherId จาก cookie เท่านั้น · confirm_submission_scores ตรวจใน SQL ว่างานอยู่ในห้องของครูคนนี้
 * ⚠️ ห้ามเขียนข้อความที่สื่อว่า "ตก" — สเปกข้อ 2.3 บอกว่าไม่มีการตก ทำต่อได้
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DIMENSION_IDS = rubric.dimensions.map((d) => d.id)
const MAX_PER_DIMENSION = Math.max(...rubric.dimensions.flatMap((d) => d.levels.map((l) => l.score)))
const MIN_PER_DIMENSION = Math.min(...rubric.dimensions.flatMap((d) => d.levels.map((l) => l.score)))

const RequestSchema = z.object({
  submissionId: z.string().uuid(),
  /** ด้านที่ขอให้แก้ อย่างน้อย 1 ด้าน */
  dimensionIds: z.array(z.enum(DIMENSION_IDS as [string, ...string[]])).min(1),
  /** คะแนนรายด้านที่ครูให้ไว้ตอนนี้ (ไม่บังคับ) ผู้เรียนจะได้เห็นว่าตอนนี้อยู่ตรงไหน */
  dimensions: z
    .record(z.string(), z.number().int().min(MIN_PER_DIMENSION).max(MAX_PER_DIMENSION))
    .optional(),
  /** ความเห็นถึงผู้เรียน บังคับ ไม่งั้นเด็กไม่รู้ว่าต้องแก้อะไร */
  note: z.string().trim().min(1).max(500),
  /** ติ๊กเมื่อเด็กใช้โควตารอบแก้ครบแล้ว แต่ครูอยากให้แก้ต่อ */
  allowExtraRound: z.boolean().optional(),
})

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse(
      'bad-request',
      `ต้องส่ง submissionId · ด้านที่ให้แก้อย่างน้อย 1 ด้าน (${DIMENSION_IDS.join(', ')}) · และความเห็นถึงผู้เรียนอย่างน้อย 1 บรรทัด`,
    )
  }

  const body = parsed.data
  const unknownScoreKeys = Object.keys(body.dimensions ?? {}).filter(
    (id) => !DIMENSION_IDS.includes(id),
  )
  if (unknownScoreKeys.length > 0) {
    return errorResponse('bad-request', `ไม่รู้จักด้าน: ${unknownScoreKeys.join(', ')}`)
  }

  const bag = buildRevisionBag({
    dimensionIds: body.dimensionIds,
    dimensionScores: body.dimensions ?? null,
    note: body.note,
    overrideLimit: body.allowExtraRound === true,
    // รอบที่เท่าไรเติมหลังรู้ว่างานนี้เป็นของใคร (ดูข้างล่าง)
    round: 0,
    at: new Date().toISOString(),
  })

  /**
   * เขียนสถานะ "ให้แก้" ผ่าน RPC เดียวกับตอนยืนยันคะแนน
   * ผลพลอยได้ที่ต้องการ: needs_review = false → ใบนี้ออกจากคิวครูระหว่างที่เด็กแก้
   * พอเด็กส่งฉบับใหม่ แถวใหม่จะเข้าคิวเองเพราะ needs_review ตั้งต้นเป็น true
   */
  const submission = await confirmSubmissionScores(
    session.teacherId,
    body.submissionId,
    bag as never,
  )
  if (!submission) return errorResponse('not-found', 'ไม่พบงานชิ้นนี้ในห้องของคุณ', 404)

  // รู้เจ้าของงานแล้วถึงนับได้ว่านี่คือรอบที่เท่าไร แล้วเขียนทับก้อนเดิมให้ตัวเลขถูก
  const versions = bigMissionSubmissions(await listSubmissions(submission.student_id))
  const round = Math.max(1, versions.length)
  await confirmSubmissionScores(session.teacherId, body.submissionId, {
    ...bag,
    round,
  } as never)

  /**
   * ส่งกลับให้แก้ = ดาวด่านบอสกลับไปเป็นคะแนนที่กฎเสนอ (ยังไม่ยืนยัน) ต้องเขียนคอลัมน์ดาวรวมใหม่
   * **ที่เส้นทางเขียน** ตรงนี้ ไม่ใช่ปล่อยให้เส้นทางอ่านของนักเรียนไปซิงก์ให้ทีหลัง (REVIEW-8 H-2)
   * ไม่งั้นแผงครูซึ่งอ่าน profiles.earned_stars จะค้างเลขที่ครูเพิ่งถอนไปแล้ว
   */
  const big = await loadBigMissionStars(submission.student_id)
  await teacherSetMissionStars(session.teacherId, submission.student_id, 'boss', big.stars)

  await logEvent(submission.student_id, 'teacher.revision-requested', {
    submissionId: submission.id,
    dimensionIds: body.dimensionIds,
    round,
    allowExtraRound: body.allowExtraRound === true,
  })

  return NextResponse.json({
    ok: true,
    submission: {
      id: submission.id,
      needsReview: submission.needs_review,
      revision: { dimensionIds: body.dimensionIds, note: body.note, round },
    },
  })
}

import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/lib/db/types'
import { getSubmissionForTeacher, listGradeJobsBySubmissions, updateSubmissionAiScores } from '@/lib/db/repo'
import { backgroundGrader, drainQueue } from '@/components/server/grade-queue'
import { loadShopProfile } from '@/components/server/game-state'
import { toRubricDimensionId } from '@/components/server/lesson-content'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ครูสั่งให้ AI ตรวจงานที่ค้าง "กำลังตรวจ" ใหม่ (งานไม่เคยเข้าคิวหรือคิวล้ม)
 * ⚠️ teacherId จากคุกกี้เท่านั้น · ตรวจว่านักเรียนอยู่ในห้องของครูก่อนแตะอะไร
 * คะแนนจากกฎและคะแนนที่ครูยืนยันไม่ถูกแตะ — AI เติมได้แค่ aiProposed
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Schema = z.object({ submissionId: z.string().uuid() })

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = Schema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง submissionId')

  const sub = await getSubmissionForTeacher(session.teacherId, parsed.data.submissionId)
  if (!sub) return errorResponse('not-found', 'ไม่พบงานชิ้นนี้ในห้องของคุณ', 404)
  if (!sub.emphasis_criterion) {
    return errorResponse('unsupported', 'งานชิ้นนี้ไม่ได้ส่งให้ AI ตรวจ', 422)
  }

  const shop = await loadShopProfile(sub.student_id)
  const gradeInput = {
    tldId: (sub.tld ?? '').trim().replace(/^\./, '').replaceAll('.', '-'),
    reasonText: sub.reason_text ?? '',
    domainName: sub.domain_name?.trim(),
    businessTypeId: shop?.businessTypeId,
    shopName: shop?.shopName,
    isRegisteredCompany: shop?.isRegisteredCompany,
    audience: shop?.audience,
    emphasisCriterion: toRubricDimensionId(sub.emphasis_criterion) ?? sub.emphasis_criterion,
    studentId: sub.student_id,
    missionId: 'big-ceo',
    role: 'boss' as const,
  }

  let jobId: string | null = null
  try {
    jobId = (await backgroundGrader().submit({ ...gradeInput, submissionId: sub.id })).jobId
  } catch {
    jobId = null
  }
  if (jobId === null) {
    return errorResponse('queue-failed', 'ส่งงานเข้าคิว AI ไม่สำเร็จ ลองใหม่อีกครั้ง', 503)
  }

  // AI ปิดทั้งห้อง = withAiSwitch ข้ามการเข้าคิวเงียบ ๆ → ไม่มีงานจริงในคิว
  const jobs = await listGradeJobsBySubmissions([sub.id]).catch(() => [])
  if (!jobs.some((j) => j.status === 'pending' || j.status === 'claimed')) {
    return errorResponse('ai-disabled', 'AI ถูกปิดอยู่ จึงไม่ได้เข้าคิวตรวจ', 409)
  }

  const bag =
    sub.ai_scores && typeof sub.ai_scores === 'object' && !Array.isArray(sub.ai_scores)
      ? (sub.ai_scores as Record<string, unknown>)
      : {}
  await updateSubmissionAiScores(
    sub.student_id,
    sub.id,
    { ...bag, gradingStatus: 'pending-ai', aiError: null } as unknown as NonNullable<Json>,
  ).catch(() => null)

  after(async () => {
    try {
      await drainQueue(1)
    } catch {
      // งานยังอยู่ในคิว ครูกดใหม่หรือ drain ทีหลังได้
    }
  })

  return NextResponse.json({ ok: true, queued: true, jobId })
}

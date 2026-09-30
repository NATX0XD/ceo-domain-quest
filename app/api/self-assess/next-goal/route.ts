import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  NEXT_GOAL_OPTIONS,
  NEXT_GOAL_PROMPT,
  OWN_GOAL_MAX_LENGTH,
  confirmNextGoal,
  describeNextGoal,
  normalizeNextGoal,
} from '@/core/next-goal'
import { logEvent } from '@/lib/db/repo'
import {
  NEXT_GOAL_EVENT,
  latestNextGoal,
  reviewOwnGoalText,
} from '../_lib/next-goal-store'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../_lib/session-cookie'

/**
 * S-32 เป้าหมายครั้งหน้า — ผู้เรียนเลือกเองตอนจบคาบ หรือพิมพ์เป้าของตัวเอง
 *
 * ⚠️ studentId มาจากคุกกี้เท่านั้น ห้ามเชื่อ id จาก body
 * ⚠️ เป้าที่พิมพ์เอง **ต้องผ่าน reviewStudentText ทุกครั้ง** และคืนข้อความเดิมกลับไปให้เห็นเสมอ
 * ⚠️ ตัวเลือกสำเร็จรูปใช้ข้อความจากไฟล์เนื้อหา ไม่ใช้ข้อความที่หน้าจอส่งมา (กันแก้ที่ฝั่งเบราว์เซอร์)
 * ⚠️ เป้าครั้งหน้า **ไม่มีผลต่อดาวหรือคะแนนของคาบนี้** เป็นข้อมูลให้ครูเตรียมคาบถัดไป
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SaveSchema = z.object({
  goalId: z.string().min(1),
  ownText: z.string().max(OWN_GOAL_MAX_LENGTH + 50).optional(),
})

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const current = await latestNextGoal(session.studentId).catch(() => null)

  return NextResponse.json({
    ok: true,
    prompt: NEXT_GOAL_PROMPT,
    options: NEXT_GOAL_OPTIONS,
    ownTextMaxLength: OWN_GOAL_MAX_LENGTH,
    current,
    summary: describeNextGoal(current),
  })
}

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = SaveSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง goalId ของเป้าที่เลือก', 400)
  }

  const normalized = normalizeNextGoal(parsed.data)
  if (!normalized.ok) return errorResponse('bad-goal', normalized.message, 400)

  // เฉพาะเป้าที่พิมพ์เองเท่านั้นที่ต้องผ่านด่านกรองคำ ตัวเลือกสำเร็จรูปมาจากไฟล์เนื้อหาอยู่แล้ว
  if (normalized.choice.isOwnText) {
    const verdict = await reviewOwnGoalText(session.studentId, normalized.choice.text)
    if (!verdict.ok) {
      return errorResponse('goal-blocked', verdict.message ?? 'เขียนเป้าใหม่อีกครั้งนะ', 400, {
        original: verdict.original,
        level: verdict.level,
      })
    }
  }

  await logEvent(session.studentId, NEXT_GOAL_EVENT, { ...normalized.choice })

  const current = await latestNextGoal(session.studentId).catch(() => null)

  return NextResponse.json({
    ok: true,
    current: current ?? { ...normalized.choice, savedAt: '', changeCount: 1 },
    summary: describeNextGoal(normalized.choice),
    message: confirmNextGoal(normalized.choice),
  })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findStudentByNickname, setShowcaseLike } from '@/lib/db/repo'
import { attempt } from '@/lib/rate-limit'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * กดใจ (POST) / เลิกใจ (DELETE) ผลงานเพื่อนบนแกลเลอรี /showcase
 *
 * ⚠️ ผู้กดอ่านจากคุกกี้ dbq_student เท่านั้น · ผู้รับค้นด้วย classroomId ของ session (ข้ามห้องไม่ได้)
 * ⚠️ 1 คนต่อ 1 ใจต่อเพื่อน 1 คน — ตารางใช้ primary key (from, to) กดซ้ำไม่เพิ่ม
 * ⚠️ จำนวนใจเป็นแค่ตัวนับบนการ์ด ไม่ใช้จัดอันดับ
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** กดสลับใจรัว ๆ ได้ไม่เกินนี้ใน 10 นาที — พอสำหรับไล่ชมทั้งห้อง แต่กันสคริปต์ยิงถี่ */
const LIKE_LIMIT = 60

const RequestSchema = z.object({ toNickname: z.string().trim().min(1).max(40) })

async function handle(request: Request, liked: boolean) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const limit = attempt(`showcase-like:${session.studentId}`, Date.now(), LIKE_LIMIT)
  if (!limit.allowed) {
    return errorResponse('rate-limited', 'กดใจถี่เกินไป พักสักครู่แล้วลองใหม่', 429, { resetAt: limit.resetAt })
  }

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องบอกชื่อเล่นเพื่อน', 400)

  const friend = await findStudentByNickname(session.classroomId, parsed.data.toNickname)
  if (!friend) return errorResponse('friend-not-found', 'ไม่พบเพื่อนชื่อนี้ในห้องเรา', 404)
  if (friend.id === session.studentId) return errorResponse('self-like', 'กดใจงานตัวเองไม่ได้', 400)

  const saved = await setShowcaseLike(session.studentId, friend.id, liked)
  if (!saved) return errorResponse('friend-not-found', 'ไม่พบเพื่อนชื่อนี้ในห้องเรา', 404)

  return NextResponse.json({ ok: true, likes: saved.likes, liked: saved.liked })
}

export async function POST(request: Request) {
  return handle(request, true)
}

export async function DELETE(request: Request) {
  return handle(request, false)
}

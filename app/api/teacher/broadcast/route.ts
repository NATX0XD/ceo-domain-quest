import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getOwnedClassroom, listBroadcasts, sendBroadcast } from '@/lib/db/repo'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * T-15 ครูส่งข้อความถึงทั้งห้อง
 *
 * ข้อความยาวไม่เกิน 80 ตัวอักษร · ส่งได้ 1 ข้อความทุก 30 วินาที (บังคับใน SQL ไม่ใช่ในหน่วยความจำ
 * เพราะเซิร์ฟเวอร์มีได้หลาย instance) · ส่งถี่เกินตอบ 429
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const BROADCAST_MAX_CHARS = 80
const MIN_SECONDS = 30

/** ข้อความสำเร็จรูปตามสเปก T-15 — หน้าเว็บเอาไปทำปุ่มกดเร็วได้ */
export const BROADCAST_PRESETS = [
  'อีก 5 นาทีไปด่านบอสนะ',
  'ใครติดเรื่อง .co.th ดูจอหน้าห้องแป๊บหนึ่ง',
  'เก่งมากทุกคน เมืองของห้องเราสร้างไปครึ่งเมืองแล้ว!',
  'ส่งงานบอสก่อนหมดเวลานะ ส่งแล้วแก้ตามครูแนะนำได้',
]

const SendSchema = z.object({
  classroomId: z.string().uuid(),
  text: z.string().trim().min(1).max(BROADCAST_MAX_CHARS),
  /** ส่งทั้งห้อง หรือเฉพาะคนที่อยู่ภารกิจนั้น */
  target: z.enum(['all', 'mission']).default('all'),
  targetValue: z.string().trim().max(20).optional(),
})

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  // อ่านประวัติได้เฉพาะห้องของตัวเอง
  const owned = await getOwnedClassroom(session.teacherId, classroomId)
  if (!owned) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const broadcasts = await listBroadcasts(classroomId)
  return NextResponse.json({ broadcasts, presets: BROADCAST_PRESETS, maxChars: BROADCAST_MAX_CHARS })
}

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = SendSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', `ต้องส่ง classroomId และข้อความยาวไม่เกิน ${BROADCAST_MAX_CHARS} ตัวอักษร`)
  }

  const body = parsed.data
  if (body.target === 'mission' && !body.targetValue) {
    return errorResponse('bad-request', 'ส่งเฉพาะกลุ่มต้องระบุ targetValue เช่น m3')
  }

  const sent = await sendBroadcast(
    session.teacherId,
    body.classroomId,
    body.text,
    body.target,
    body.targetValue,
    MIN_SECONDS,
  )

  if (!sent) {
    // แยกไม่ออกระหว่าง "ไม่ใช่ห้องของคุณ" กับ "ส่งถี่เกินไป" จาก SQL เดียว จึงตรวจเจ้าของซ้ำที่นี่
    const owned = await getOwnedClassroom(session.teacherId, body.classroomId)
    if (!owned) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
    return errorResponse('too-fast', `ส่งได้ 1 ข้อความทุก ${MIN_SECONDS} วินาที`, 429)
  }

  return NextResponse.json({ ok: true, broadcast: sent })
}

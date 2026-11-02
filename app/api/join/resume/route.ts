import { NextResponse } from 'next/server'
import { z } from 'zod'
import { studentNicknameSchema } from '../../../../lib/account-validation'
import { attempt, resetAttempts } from '@/lib/rate-limit'
import { verifyPin } from '@/lib/pin'
import { isValidRoomCode, normalizeRoomCode } from '@/lib/room-code'
import { signStudentSession } from '@/lib/session'
import { findOpenClassroomByCode, findStudentByNickname, logEvent } from '@/lib/db/repo'
import { attachStudentSession, errorResponse, readJsonBody } from '../../_lib/session-cookie'

/**
 * ย้ายเครื่อง / ล้างเบราว์เซอร์แล้วเข้าใหม่ — ตรวจรหัส 4 หลักแล้วออก cookie ใบใหม่
 *
 * รหัส 4 หลักมีแค่ 10,000 แบบ จึงจำกัดการลองผิด 5 ครั้งต่อ 10 นาทีต่อ (ห้อง + ชื่อเล่น)
 * ตาม docs/auth-and-roles.md หัวข้อ 4-5
 *
 * ข้อความ error ต้องเหมือนกันทั้งกรณี "ไม่มีชื่อนี้" และ "รหัสผิด"
 * ไม่งั้นคนเดาจะรู้ว่าเดาชื่อถูกแล้ว เหลือแค่เดารหัส
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ResumeSchema = z.object({
  roomCode: z.string().min(1),
  nickname: studentNicknameSchema,
  pin: z.string(),
})

const INVALID_MESSAGE = 'ชื่อเล่นหรือรหัส 4 หลักไม่ถูกต้อง'

export async function POST(request: Request) {
  const parsed = ResumeSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง roomCode, nickname และ pin ให้ครบ')
  }

  const roomCode = normalizeRoomCode(parsed.data.roomCode)
  const nickname = parsed.data.nickname.trim()

  if (!isValidRoomCode(roomCode)) {
    return errorResponse('room-not-found', 'ไม่พบห้องนี้ หรือครูปิดห้องไปแล้ว', 404)
  }

  // นับทุกครั้งที่ "พยายาม" ก่อนตรวจรหัส ไม่ใช่นับเฉพาะตอนผิด
  const limitKey = `resume:${roomCode}:${nickname}`
  const limit = attempt(limitKey)
  if (!limit.allowed) {
    return errorResponse(
      'too-many-attempts',
      'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วค่อยลองใหม่ หรือบอกครูให้ช่วย',
      429,
      { resetAt: limit.resetAt, remaining: 0 },
    )
  }

  const classroom = await findOpenClassroomByCode(roomCode)
  if (!classroom) {
    return errorResponse('room-not-found', 'ไม่พบห้องนี้ หรือครูปิดห้องไปแล้ว', 404)
  }

  const student = await findStudentByNickname(classroom.id, nickname)
  if (!student) {
    return errorResponse('invalid-credentials', INVALID_MESSAGE, 401, {
      remaining: limit.remaining,
    })
  }

  const ok = await verifyPin(parsed.data.pin.trim(), student.pin_hash)
  if (!ok) {
    return errorResponse('invalid-credentials', INVALID_MESSAGE, 401, {
      remaining: limit.remaining,
    })
  }

  resetAttempts(limitKey)
  await logEvent(student.id, 'student.resumed', { roomCode })

  const token = await signStudentSession({
    studentId: student.id,
    classroomId: classroom.id,
  })

  const response = NextResponse.json({
    ok: true,
    nickname: student.nickname,
    roomCode: classroom.room_code,
  })
  return attachStudentSession(response, token)
}

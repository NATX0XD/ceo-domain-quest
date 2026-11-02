import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherPasswordSchema } from '../../../../lib/account-validation'
import { createClassroomWithUniqueCode, signUpTeacher } from '../../../../lib/db/repo'
import { genRoomCode } from '../../../../lib/room-code'
import { attempt } from '../../../../lib/rate-limit'
import { signTeacherSession } from '../../../../lib/session'
import { attachTeacherSession, errorResponse, readJsonBody } from '../../_lib/session-cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SignupSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(320),
    password: teacherPasswordSchema,
    confirmPassword: z.string(),
    inviteCode: z.string().min(1).max(256),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'รหัสผ่านไม่ตรงกัน',
  })

const MAX_SIGNUPS = 5
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
}
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode('teacher-signup-invite'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const [givenHash, expectedHash] = await Promise.all([
    crypto.subtle.sign('HMAC', key, encoder.encode(given)),
    crypto.subtle.sign('HMAC', key, encoder.encode(expected)),
  ])
  const a = new Uint8Array(givenHash)
  const b = new Uint8Array(expectedHash)
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

export async function POST(request: Request) {
  const invite = process.env.TEACHER_INVITE_CODE?.trim()
  if (!invite) return errorResponse('signup-disabled', 'ยังไม่เปิดรับสมัคร', 403)

  const body = await readJsonBody(request)
  const parsed = SignupSchema.safeParse(body)
  const ipLimit = attempt(`teacher-signup:ip:${clientIp(request)}`, Date.now(), MAX_SIGNUPS)
  if (!ipLimit.allowed) return errorResponse('rate-limited', 'ลองสมัครใหม่ภายหลัง', 429)
  if (!parsed.success) return errorResponse('bad-request', 'กรอกข้อมูลสมัครให้ครบและถูกต้อง')

  const email = parsed.data.email.toLowerCase()
  const emailLimit = attempt(`teacher-signup:email:${email}`, Date.now(), MAX_SIGNUPS)
  if (!emailLimit.allowed) return errorResponse('rate-limited', 'ลองสมัครใหม่ภายหลัง', 429)
  if (!(await sameSecret(parsed.data.inviteCode, invite))) {
    return errorResponse('invalid-invite', 'รหัสเชิญไม่ถูกต้อง', 403)
  }

  const result = await signUpTeacher(email, parsed.data.password, parsed.data.displayName)
  if (!result.ok) {
    if (result.reason === 'email-taken') return errorResponse('signup-failed', 'ไม่สามารถสมัครด้วยข้อมูลนี้ได้', 409)
    if (result.reason === 'weak-password') return errorResponse('bad-request', 'รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร')
    return errorResponse('signup-failed', 'สมัครบัญชีไม่สำเร็จ', 400)
  }

  const classroom = await createClassroomWithUniqueCode(result.teacher!.id, genRoomCode)
  const token = await signTeacherSession({ teacherId: result.teacher!.id })
  const response = NextResponse.redirect(new URL('/teacher', request.url), 303)
  attachTeacherSession(response, token)
  response.headers.set('x-starter-room-code', classroom.room_code)
  return response
}

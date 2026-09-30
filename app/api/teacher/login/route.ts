import { NextResponse } from 'next/server'
import { z } from 'zod'
import { signTeacherSession } from '@/lib/session'
import { createAuthClient } from '@/lib/db/client'
import { upsertTeacher } from '@/lib/db/repo'
import { attachTeacherSession, errorResponse, readJsonBody } from '../../_lib/session-cookie'

/**
 * ครูเข้าสู่ระบบด้วยอีเมล + รหัสผ่านของ Supabase Auth
 *
 * รหัสผ่านถูกตรวจด้วย anon key (ไม่ใช่ service_role) แล้วแลกเป็น session cookie ของแอปเอง
 * access token ของ Supabase ไม่ถูกส่งกลับไปเบราว์เซอร์ — หน้าเว็บใช้แค่ cookie httpOnly ใบนี้
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LoginSchema = z.object({
  email: z.string().trim().min(3),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง email และ password')
  }

  const auth = createAuthClient()
  const { data, error } = await auth.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    // ข้อความเดียวกันทุกกรณี ไม่บอกว่าอีเมลมีอยู่จริงหรือไม่
    return errorResponse('invalid-credentials', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401)
  }

  const email = data.user.email ?? parsed.data.email
  const displayName = data.user.user_metadata?.name
  const teacher = await upsertTeacher(
    data.user.id,
    email,
    typeof displayName === 'string' ? displayName : null,
  )

  const token = await signTeacherSession({ teacherId: teacher.id })
  const response = NextResponse.json({
    ok: true,
    teacher: { email: teacher.email, name: teacher.name },
  })
  return attachTeacherSession(response, token)
}

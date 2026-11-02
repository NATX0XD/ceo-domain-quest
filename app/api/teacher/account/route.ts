import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherPasswordSchema } from '../../../../lib/account-validation'
import { createAuthClient, getServiceClient } from '../../../../lib/db/client'
import { getTeacher, updateTeacherName } from '../../../../lib/db/repo'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DisplayNameSchema = z.object({ displayName: z.string().trim().min(1).max(80) })
const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: teacherPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'รหัสผ่านไม่ตรงกัน',
  })
const AccountPatchSchema = z.union([DisplayNameSchema, PasswordSchema])

export async function GET() {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const teacher = await getTeacher(session.teacherId)
  if (!teacher) return unauthorized('ไม่พบบัญชีครูนี้แล้ว')

  return NextResponse.json({
    teacher: { email: teacher.email, displayName: teacher.name ?? '' },
  })
}

export async function PATCH(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = AccountPatchSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ข้อมูลบัญชีไม่ถูกต้อง')

  const body = parsed.data
  if ('displayName' in body) {
    const updated = await getServiceClient().auth.admin.updateUserById(session.teacherId, {
      user_metadata: { name: body.displayName },
    })
    if (updated.error) return errorResponse('account-update-failed', 'บันทึกชื่อที่แสดงไม่สำเร็จ', 400)

    const teacher = await updateTeacherName(session.teacherId, body.displayName)
    if (!teacher) return errorResponse('not-found', 'ไม่พบบัญชีครูนี้แล้ว', 404)

    return NextResponse.json({ ok: true, teacher: { email: teacher.email, displayName: teacher.name } })
  }

  const teacher = await getTeacher(session.teacherId)
  if (!teacher) return unauthorized('ไม่พบบัญชีครูนี้แล้ว')

  const auth = createAuthClient()
  const checked = await auth.auth.signInWithPassword({
    email: teacher.email,
    password: body.currentPassword,
  })
  if (checked.error || !checked.data.user) {
    return errorResponse('invalid-password', 'รหัสผ่านปัจจุบันไม่ถูกต้อง', 401)
  }

  const updated = await getServiceClient().auth.admin.updateUserById(session.teacherId, {
    password: body.newPassword,
  })
  if (updated.error) return errorResponse('account-update-failed', 'เปลี่ยนรหัสผ่านไม่สำเร็จ', 400)

  return NextResponse.json({ ok: true, message: 'เปลี่ยนรหัสผ่านแล้ว' })
}

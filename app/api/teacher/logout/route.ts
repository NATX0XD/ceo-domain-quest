import { NextResponse } from 'next/server'
import { SESSION_COOKIE_OPTIONS, TEACHER_COOKIE } from '@/lib/session'
import { readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ครูออกจากระบบ — ลบคุกกี้ `dbq_teacher` ทิ้ง
 *
 * ทำไมต้องมี: ก่อนหน้านี้ทั้งระบบ **ไม่มีทางออกจากระบบให้ครูกดเลย** ครูที่ยืมเครื่องคนอื่น
 * หรือใช้เครื่องกลางของโรงเรียนจึงค้าง session ไว้จนหมดอายุเอง
 *
 * ⚠️ ลบคุกกี้ด้วยออปชันชุดเดียวกับตอนตั้ง (path/secure/sameSite) ไม่งั้นเบราว์เซอร์ถือว่าคนละใบ
 *    แล้วคุกกี้เดิมจะยังอยู่
 * ⚠️ ไม่มีคุกกี้มาด้วย = 401 เหมือนเส้นอื่นใต้ `/api/teacher/*` ทั้งหมด (ไม่มีข้อยกเว้นให้จำ)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await readTeacherSession())) return unauthorized()

  const response = NextResponse.json({ ok: true })
  response.cookies.set(TEACHER_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
  return response
}

import { NextResponse } from 'next/server'
import { SESSION_COOKIE_OPTIONS, STUDENT_COOKIE } from '../../../../lib/session'
import { readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * นักเรียนออกจากระบบ — ลบคุกกี้ `dbq_student` ทิ้ง (คู่กับ `/api/teacher/logout`)
 *
 * ทำไมต้องมี: ก่อนหน้านี้นักเรียน**ไม่มีทางออกจากระบบเลย** เครื่องกลางของห้องคอมฯ
 * ที่เพื่อนคนถัดไปมานั่งต่อจึงยังเป็นบัญชีของคนก่อนจนคุกกี้หมดอายุเอง (6 ชม.)
 *
 * · session เป็น token ที่เซ็นไว้ในคุกกี้ล้วน ไม่มีแถว session ในฐานข้อมูลให้ลบ
 * · ข้อมูลความคืบหน้าไม่หาย กลับมาด้วยรหัสห้อง + ชื่อเล่น + PIN เดิม (`/api/join/resume`)
 * ⚠️ ลบคุกกี้ด้วยออปชันชุดเดียวกับตอนตั้ง (path/secure/sameSite) ไม่งั้นเบราว์เซอร์ถือว่าคนละใบ
 * ⚠️ ไม่มีคุกกี้นักเรียนมาด้วย = 401 เหมือนเส้นอื่นที่ต้องมี session
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!(await readStudentSession())) return unauthorized('ยังไม่ได้เข้าห้อง')

  const response = NextResponse.json({ ok: true })
  response.cookies.set(STUDENT_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
  return response
}

/**
 * ตัวช่วยอ่าน/เขียน session cookie ของ API route (โฟลเดอร์ `_lib` ไม่ใช่ route)
 *
 * ⚠️ studentId / teacherId ต้องมาจากที่นี่เท่านั้น ห้ามอ่านจาก body หรือ query string
 *    ดู docs/auth-and-roles.md หัวข้อ 6
 */
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE_OPTIONS,
  STUDENT_COOKIE,
  STUDENT_SESSION_SECONDS,
  TEACHER_COOKIE,
  TEACHER_SESSION_SECONDS,
  verifyStudentSession,
  verifyTeacherSession,
  type StudentSession,
  type TeacherSession,
} from '@/lib/session'

export function attachStudentSession<T>(response: NextResponse<T>, token: string): NextResponse<T> {
  response.cookies.set(STUDENT_COOKIE, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: STUDENT_SESSION_SECONDS,
  })
  return response
}

export function attachTeacherSession<T>(response: NextResponse<T>, token: string): NextResponse<T> {
  response.cookies.set(TEACHER_COOKIE, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: TEACHER_SESSION_SECONDS,
  })
  return response
}

export async function readStudentSession(): Promise<StudentSession | null> {
  const jar = await cookies()
  return verifyStudentSession(jar.get(STUDENT_COOKIE)?.value)
}

export async function readTeacherSession(): Promise<TeacherSession | null> {
  const jar = await cookies()
  return verifyTeacherSession(jar.get(TEACHER_COOKIE)?.value)
}

export type ApiError = { error: string; message: string } & Record<string, unknown>

/** รูปแบบ error เดียวกันทุก route: { error, message } + ฟิลด์เสริมถ้ามี */
export function errorResponse(
  error: string,
  message: string,
  status = 400,
  extra: Record<string, unknown> = {},
): NextResponse<ApiError> {
  return NextResponse.json({ error, message, ...extra }, { status })
}

/** 401 มาตรฐานของทุก route ที่ต้องมี session */
export function unauthorized(message = 'ต้องเข้าสู่ระบบก่อน'): NextResponse<ApiError> {
  return errorResponse('unauthorized', message, 401)
}

export async function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null)
}

/**
 * Session token ฝั่งเซิร์ฟเวอร์ — JWT HS256 เก็บใน httpOnly cookie
 *
 * กฎที่ห้ามละเมิด (docs/auth-and-roles.md หัวข้อ 6):
 * ทุกครั้งที่บันทึกข้อมูล เซิร์ฟเวอร์ต้องอ่านว่าใครส่งมาจาก token นี้เท่านั้น
 * ห้ามเชื่อ studentId ที่ส่งมาจาก body ของเบราว์เซอร์เด็ดขาด
 */
import { SignJWT, jwtVerify } from 'jose'

/** ชื่อคุกกี้ของสองบทบาท แยกกันคนละใบ เครื่องเดียวเปิดพร้อมกันได้ตอนครูทดสอบ */
export const STUDENT_COOKIE = 'dbq_student'
export const TEACHER_COOKIE = 'dbq_teacher'

/** นักเรียนอยู่ในคาบเดียว 6 ชั่วโมงเผื่อคาบเช้าถึงคาบบ่าย */
export const STUDENT_SESSION_SECONDS = 6 * 60 * 60
/** ครูใช้ทั้งวันสอน 12 ชั่วโมง */
export const TEACHER_SESSION_SECONDS = 12 * 60 * 60

/**
 * ตัวเลือกคุกกี้ที่ใช้ร่วมกันทั้งสองบทบาท
 * httpOnly กัน JavaScript ฝั่งหน้าเว็บอ่าน token ไปได้
 * sameSite lax ให้กดลิงก์ QR จากแอปกล้องแล้วยัง login อยู่
 * secure เปิดเฉพาะตอน production เพราะ dev รันบน http://localhost
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const

export interface StudentSession {
  role: 'student'
  studentId: string
  classroomId: string
}

export interface TeacherSession {
  role: 'teacher'
  teacherId: string
}

export type SessionPayload = StudentSession | TeacherSession

const ALGORITHM = 'HS256'

/**
 * อ่าน secret ตอนเรียกใช้ ไม่ใช่ตอน import
 * ถ้าอ่านตอน import แล้ว build บนเครื่องที่ไม่มี env จะพังทั้ง build
 * ชื่อ env ห้ามขึ้นต้น NEXT_PUBLIC_ เพราะ Next จะฝังค่าลงไฟล์ฝั่งเบราว์เซอร์ให้ทุกคนอ่านได้
 */
function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'ต้องตั้งค่า SESSION_SECRET ความยาวอย่างน้อย 32 ตัวอักษร ก่อนใช้ระบบเข้าสู่ระบบ',
    )
  }
  return new TextEncoder().encode(secret)
}

async function sign(payload: SessionPayload, seconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt(now)
    .setExpirationTime(now + seconds)
    .sign(getSecret())
}

export function signStudentSession(input: {
  studentId: string
  classroomId: string
}): Promise<string> {
  return sign({ role: 'student', ...input }, STUDENT_SESSION_SECONDS)
}

export function signTeacherSession(input: { teacherId: string }): Promise<string> {
  return sign({ role: 'teacher', ...input }, TEACHER_SESSION_SECONDS)
}

/**
 * ตรวจ token แล้วคืน payload
 * คืน null ทุกกรณีที่ใช้ไม่ได้ — หมดอายุ ลายเซ็นผิด ถูกแก้ระหว่างทาง หรือรูปแบบไม่ตรง
 * ผู้เรียกต้องเช็ก role ก่อนใช้เสมอ เพราะ token ของนักเรียนก็ verify ผ่านเหมือนกัน
 */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALGORITHM] })
    if (payload.role === 'student') {
      if (typeof payload.studentId !== 'string' || typeof payload.classroomId !== 'string') {
        return null
      }
      return { role: 'student', studentId: payload.studentId, classroomId: payload.classroomId }
    }
    if (payload.role === 'teacher') {
      if (typeof payload.teacherId !== 'string') return null
      return { role: 'teacher', teacherId: payload.teacherId }
    }
    return null
  } catch {
    return null
  }
}

/** ใช้ใน API route ที่ต้องเป็นนักเรียนเท่านั้น */
export async function verifyStudentSession(
  token: string | undefined | null,
): Promise<StudentSession | null> {
  const session = await verifySession(token)
  return session?.role === 'student' ? session : null
}

/** ใช้ใน API route ที่ต้องเป็นครูเท่านั้น */
export async function verifyTeacherSession(
  token: string | undefined | null,
): Promise<TeacherSession | null> {
  const session = await verifySession(token)
  return session?.role === 'teacher' ? session : null
}

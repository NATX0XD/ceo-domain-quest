import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  SESSION_COOKIE_OPTIONS,
  STUDENT_COOKIE,
  STUDENT_SESSION_SECONDS,
  TEACHER_COOKIE,
  TEACHER_SESSION_SECONDS,
  signStudentSession,
  signTeacherSession,
  verifySession,
  verifyStudentSession,
  verifyTeacherSession,
} from './session'

beforeAll(() => {
  process.env.SESSION_SECRET = 'secret-สำหรับเทสต์-ยาวพอสมควรเกิน32ตัวอักษรแน่นอน'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ออก token แล้วตรวจกลับ', () => {
  it('token ของนักเรียนคืน payload เดิมครบ', async () => {
    const token = await signStudentSession({ studentId: 'stu-1', classroomId: 'room-9' })
    const payload = await verifySession(token)
    expect(payload).toEqual({ role: 'student', studentId: 'stu-1', classroomId: 'room-9' })
  })

  it('token ของครูคืน payload เดิมครบ', async () => {
    const token = await signTeacherSession({ teacherId: 'tea-1' })
    expect(await verifySession(token)).toEqual({ role: 'teacher', teacherId: 'tea-1' })
  })

  it('แยกบทบาทได้ ครูใช้ token นักเรียนแทนกันไม่ได้', async () => {
    const student = await signStudentSession({ studentId: 'stu-1', classroomId: 'room-9' })
    const teacher = await signTeacherSession({ teacherId: 'tea-1' })
    expect(await verifyTeacherSession(student)).toBeNull()
    expect(await verifyStudentSession(teacher)).toBeNull()
    expect(await verifyStudentSession(student)).not.toBeNull()
  })
})

describe('token ที่ใช้ไม่ได้ต้องคืน null', () => {
  it('token ที่ถูกแก้ตัวอักษรคืน null', async () => {
    const token = await signStudentSession({ studentId: 'stu-1', classroomId: 'room-9' })

    /**
     * แก้ที่ส่วน payload ไม่ใช่ตัวอักษรตัวสุดท้ายของลายเซ็น
     * ลายเซ็น HS256 ยาว 32 ไบต์ = 43 ตัวอักษร base64url ตัวสุดท้ายจึงมีบิตจริงแค่ 2 บิต
     * ที่เหลือเป็นบิตเติม เปลี่ยนตัวสุดท้ายบางค่าจึงถอดกลับได้ไบต์ชุดเดิม แล้ว token ยังใช้ได้อยู่
     * (เทสต์เดิมเขียนแบบนั้น เลยแดงเป็นครั้งคราว) แก้ที่ payload ผลจึงแน่นอนทุกครั้ง
     */
    const [header, payload, signature] = token.split('.')
    const tamperedPayload = payload!.slice(0, -1) + (payload!.endsWith('A') ? 'B' : 'A')
    expect(await verifySession(`${header}.${tamperedPayload}.${signature}`)).toBeNull()
  })

  it('ข้อความมั่ว ค่าว่าง และ undefined คืน null', async () => {
    expect(await verifySession('ของปลอม')).toBeNull()
    expect(await verifySession('')).toBeNull()
    expect(await verifySession(undefined)).toBeNull()
  })

  it('token ของนักเรียนหมดอายุหลัง 6 ชั่วโมง', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-29T08:00:00Z'))
    const token = await signStudentSession({ studentId: 'stu-1', classroomId: 'room-9' })

    vi.advanceTimersByTime((STUDENT_SESSION_SECONDS - 60) * 1000)
    expect(await verifySession(token)).not.toBeNull()

    vi.advanceTimersByTime(120 * 1000)
    expect(await verifySession(token)).toBeNull()
  })

  it('token ของครูอยู่ได้นานกว่า ยังใช้ได้ตอน 6 ชั่วโมงครึ่ง', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-29T08:00:00Z'))
    const token = await signTeacherSession({ teacherId: 'tea-1' })

    vi.advanceTimersByTime(6.5 * 60 * 60 * 1000)
    expect(await verifySession(token)).not.toBeNull()

    vi.advanceTimersByTime((TEACHER_SESSION_SECONDS - 6 * 60 * 60) * 1000)
    expect(await verifySession(token)).toBeNull()
  })
})

describe('ไม่มี SESSION_SECRET ต้องพังตอนเรียกใช้ ไม่ใช่ตอน import', () => {
  it('โยน error เมื่อไม่ได้ตั้งค่า env', async () => {
    const saved = process.env.SESSION_SECRET
    delete process.env.SESSION_SECRET
    await expect(signTeacherSession({ teacherId: 'tea-1' })).rejects.toThrow('SESSION_SECRET')
    process.env.SESSION_SECRET = saved
  })

  it('ชื่อ env ต้องไม่ขึ้นต้นด้วย NEXT_PUBLIC_ เพราะจะรั่วไปฝั่งเบราว์เซอร์', () => {
    expect('SESSION_SECRET'.startsWith('NEXT_PUBLIC_')).toBe(false)
  })
})

describe('ค่าตั้งของคุกกี้', () => {
  it('httpOnly เป็น true เพื่อไม่ให้ JavaScript ฝั่งหน้าเว็บอ่าน token ได้', () => {
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true)
  })

  it('sameSite เป็น lax และ path เป็น /', () => {
    expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('lax')
    expect(SESSION_COOKIE_OPTIONS.path).toBe('/')
  })

  it('secure เปิดเฉพาะตอน production', () => {
    expect(SESSION_COOKIE_OPTIONS.secure).toBe(process.env.NODE_ENV === 'production')
  })

  it('คุกกี้นักเรียนกับครูคนละชื่อ', () => {
    expect(STUDENT_COOKIE).toBe('dbq_student')
    expect(TEACHER_COOKIE).toBe('dbq_teacher')
    expect(STUDENT_COOKIE).not.toBe(TEACHER_COOKIE)
  })
})

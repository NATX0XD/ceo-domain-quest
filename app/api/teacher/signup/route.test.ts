import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllAttempts } from '../../../../lib/rate-limit'
import { NextResponse } from 'next/server'
import { POST } from './route'

const { signUpTeacher, createClassroomWithUniqueCode } = vi.hoisted(() => ({
  signUpTeacher: vi.fn(),
  createClassroomWithUniqueCode: vi.fn(),
}))

vi.mock('../../../../lib/db/repo', () => ({ signUpTeacher, createClassroomWithUniqueCode }))
vi.mock('../../../../lib/session', () => ({
  signTeacherSession: vi.fn(async () => 'signed-session'),
  SESSION_COOKIE_OPTIONS: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
  TEACHER_SESSION_SECONDS: 43200,
  STUDENT_COOKIE: 'dbq_student',
  STUDENT_SESSION_SECONDS: 21600,
  TEACHER_COOKIE: 'dbq_teacher',
  verifyStudentSession: vi.fn(),
  verifyTeacherSession: vi.fn(),
}))
vi.mock('../../_lib/session-cookie', () => ({
  readJsonBody: async (request: Request) => request.json().catch(() => null),
  errorResponse: (error: string, message: string, status = 400) => NextResponse.json({ error, message }, { status }),
  attachTeacherSession: (response: NextResponse, token: string) => {
    response.cookies.set('dbq_teacher', token, { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 43200 })
    return response
  },
}))

function request(body: Record<string, unknown>, ip = '203.0.113.10') {
  return new Request('http://localhost:3000/api/teacher/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const valid = {
  displayName: 'ครูทดสอบ',
  email: 'teacher.signup@example.ac.th',
  password: 'Strong-pass-123',
  confirmPassword: 'Strong-pass-123',
  inviteCode: 'invite-test-code',
}

describe('POST /api/teacher/signup', () => {
  beforeEach(() => {
    clearAllAttempts()
    process.env.TEACHER_INVITE_CODE = 'invite-test-code'
    signUpTeacher.mockReset()
    createClassroomWithUniqueCode.mockReset()
    signUpTeacher.mockResolvedValue({ ok: true, teacher: { id: 'teacher-id', email: valid.email, name: valid.displayName } })
    createClassroomWithUniqueCode.mockResolvedValue({ id: 'classroom-id', room_code: 'AB2345' })
  })

  it('สมัครสำเร็จ สร้างห้อง ตั้ง cookie และ redirect', async () => {
    const response = await POST(request(valid))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost:3000/teacher')
    expect(response.headers.get('set-cookie')).toContain('dbq_teacher=signed-session')
    expect(signUpTeacher).toHaveBeenCalledWith(valid.email, valid.password, valid.displayName)
    expect(createClassroomWithUniqueCode).toHaveBeenCalledWith('teacher-id', expect.any(Function))
  })

  it('ปฏิเสธรหัสเชิญผิด', async () => {
    const response = await POST(request({ ...valid, inviteCode: 'wrong-code' }))
    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe('invalid-invite')
    expect(signUpTeacher).not.toHaveBeenCalled()
  })

  it('ปิดการสมัครเมื่อไม่มี env', async () => {
    delete process.env.TEACHER_INVITE_CODE
    const response = await POST(request(valid))
    expect(response.status).toBe(403)
    expect((await response.json()).message).toBe('ยังไม่เปิดรับสมัคร')
  })

  it('คืนข้อความ generic เมื่ออีเมลซ้ำ', async () => {
    signUpTeacher.mockResolvedValue({ ok: false, reason: 'email-taken' })
    const response = await POST(request(valid))
    expect(response.status).toBe(409)
    expect((await response.json()).message).toBe('ไม่สามารถสมัครด้วยข้อมูลนี้ได้')
  })

  it('ปฏิเสธรหัสผ่านสั้น', async () => {
    const response = await POST(request({ ...valid, password: 'short', confirmPassword: 'short' }))
    expect(response.status).toBe(400)
    expect(signUpTeacher).not.toHaveBeenCalled()
  })

  it('จำกัดความถี่ต่อ IP', async () => {
    for (let i = 0; i < 5; i += 1) await POST(request({ ...valid, inviteCode: 'wrong-code' }))
    const response = await POST(request({ ...valid, inviteCode: 'wrong-code' }))
    expect(response.status).toBe(429)
  })

  it('จำกัดความถี่ต่ออีเมลแม้เปลี่ยน IP', async () => {
    for (let i = 0; i < 5; i += 1) await POST(request({ ...valid, inviteCode: 'wrong-code' }, `203.0.113.${i + 20}`))
    const response = await POST(request({ ...valid, inviteCode: 'wrong-code' }, '203.0.113.99'))
    expect(response.status).toBe(429)
  })
})

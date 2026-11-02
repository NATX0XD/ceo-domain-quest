import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { PATCH, GET } from './route'

const mocks = vi.hoisted(() => ({
  readTeacherSession: vi.fn(),
  getTeacher: vi.fn(),
  updateTeacherName: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUserById: vi.fn(),
}))

vi.mock('../../_lib/session-cookie', () => ({
  readTeacherSession: mocks.readTeacherSession,
  readJsonBody: async (request: Request) => request.json().catch(() => null),
  unauthorized: (message = 'ต้องเข้าสู่ระบบก่อน') => NextResponse.json({ error: 'unauthorized', message }, { status: 401 }),
  errorResponse: (error: string, message: string, status = 400) => NextResponse.json({ error, message }, { status }),
}))
vi.mock('../../../../lib/db/repo', () => ({ getTeacher: mocks.getTeacher, updateTeacherName: mocks.updateTeacherName }))
vi.mock('../../../../lib/db/client', () => ({
  createAuthClient: () => ({ auth: { signInWithPassword: mocks.signInWithPassword } }),
  getServiceClient: () => ({ auth: { admin: { updateUserById: mocks.updateUserById } } }),
}))

const teacher = { id: 'teacher-1', email: 'teacher@example.test', name: 'ครูเดิม' }
const request = (body: Record<string, string>) => new Request('http://localhost/api/teacher/account', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('/api/teacher/account', () => {
  beforeEach(() => {
    mocks.readTeacherSession.mockResolvedValue({ role: 'teacher', teacherId: teacher.id })
    mocks.getTeacher.mockResolvedValue(teacher)
    mocks.updateTeacherName.mockResolvedValue({ ...teacher, name: 'ครูใหม่' })
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: teacher.id } }, error: null })
    mocks.updateUserById.mockResolvedValue({ data: { user: { id: teacher.id } }, error: null })
  })

  it('requires teacher session', async () => {
    mocks.readTeacherSession.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it('returns email and display name without exposing auth data', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ teacher: { email: teacher.email, displayName: teacher.name } })
  })

  it('updates display name in app DB and auth metadata', async () => {
    const response = await PATCH(request({ displayName: 'ครูใหม่' }))
    expect(response.status).toBe(200)
    expect(mocks.updateTeacherName).toHaveBeenCalledWith(teacher.id, 'ครูใหม่')
    expect(mocks.updateUserById).toHaveBeenCalledWith(teacher.id, { user_metadata: { name: 'ครูใหม่' } })
  })

  it('requires current password and enforces the signup minimum', async () => {
    const short = await PATCH(request({ currentPassword: 'old', newPassword: 'short', confirmPassword: 'short' }))
    expect(short.status).toBe(400)
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()

    mocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error: new Error('bad') })
    const wrong = await PATCH(request({ currentPassword: 'wrong', newPassword: 'new-password-123', confirmPassword: 'new-password-123' }))
    expect(wrong.status).toBe(401)
    expect(mocks.updateUserById).not.toHaveBeenCalledWith(teacher.id, { password: 'new-password-123' })
  })

  it('changes password only after current password verification', async () => {
    const response = await PATCH(request({ currentPassword: 'old-password', newPassword: 'new-password-123', confirmPassword: 'new-password-123' }))
    expect(response.status).toBe(200)
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: teacher.email, password: 'old-password' })
    expect(mocks.updateUserById).toHaveBeenCalledWith(teacher.id, { password: 'new-password-123' })
  })
})

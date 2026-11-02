import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from './route'

const mocks = vi.hoisted(() => ({ readStudentSession: vi.fn() }))

vi.mock('../../_lib/session-cookie', () => ({
  readStudentSession: mocks.readStudentSession,
  unauthorized: (message = 'ต้องเข้าสู่ระบบก่อน') =>
    NextResponse.json({ error: 'unauthorized', message }, { status: 401 }),
}))

describe('POST /api/student/logout', () => {
  beforeEach(() => {
    mocks.readStudentSession.mockReset()
  })

  it('returns 401 without a student session and leaves cookies alone', async () => {
    mocks.readStudentSession.mockResolvedValue(null)
    const response = await POST()
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('clears dbq_student with the same path/sameSite/httpOnly it was set with', async () => {
    mocks.readStudentSession.mockResolvedValue({ role: 'student', studentId: 's1', classroomId: 'c1' })
    const response = await POST()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^dbq_student=;/)
    expect(cookie).toMatch(/Max-Age=0/i)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=lax/i)
    expect(cookie).not.toMatch(/dbq_teacher/)
  })
})

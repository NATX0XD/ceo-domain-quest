import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  readTeacherSession: vi.fn(),
  teacherSetMissionPass: vi.fn(),
  logEvent: vi.fn(),
}))

vi.mock('../../../../_lib/session-cookie', () => ({
  readTeacherSession: mocks.readTeacherSession,
  readJsonBody: (request: Request) => request.json().catch(() => null),
  unauthorized: () => NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
  errorResponse: (error: string, message: string, status = 400) => NextResponse.json({ error, message }, { status }),
}))
vi.mock('@/lib/db/repo', () => ({
  teacherSetMissionPass: mocks.teacherSetMissionPass,
  logEvent: mocks.logEvent,
}))

import { POST } from './route'

const STUDENT = '05f72495-343c-4d55-ac6c-acec2364ffc2'
const params = { params: Promise.resolve({ id: STUDENT }) }
const request = (body: unknown) => new Request('http://localhost/api/teacher/student/' + STUDENT + '/mission-pass', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('POST /api/teacher/student/[id]/mission-pass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readTeacherSession.mockResolvedValue({ teacherId: 'teacher-1' })
    mocks.teacherSetMissionPass.mockResolvedValue({
      status: 'passed-by-teacher',
      changed: true,
      source: 'teacher-skip',
      progress: { mission_id: 'm1', passed_at: '2026-11-03T00:00:00.000Z', stars: 1 },
    })
  })

  it('returns 401 without a teacher session', async () => {
    mocks.readTeacherSession.mockResolvedValue(null)
    expect((await POST(request({ missionId: 'm1', action: 'pass' }), params)).status).toBe(401)
    expect(mocks.teacherSetMissionPass).not.toHaveBeenCalled()
  })

  it('returns 404 for a student outside the teacher classroom', async () => {
    mocks.teacherSetMissionPass.mockResolvedValue(null)
    expect((await POST(request({ missionId: 'm1', action: 'pass' }), params)).status).toBe(404)
    expect(mocks.logEvent).not.toHaveBeenCalled()
  })

  it('passes ceo as the canonical boss mission and logs the source', async () => {
    const response = await POST(request({ missionId: 'ceo', action: 'pass' }), params)
    expect(response.status).toBe(200)
    expect(mocks.teacherSetMissionPass).toHaveBeenCalledWith('teacher-1', STUDENT, 'boss', 'pass')
    expect(mocks.logEvent).toHaveBeenCalledWith(STUDENT, 'teacher-mission-pass', expect.objectContaining({ source: 'teacher-skip', missionId: 'ceo' }))
  })

  it.each([
    ['idempotent re-pass', 'already-passed-by-teacher', false],
    ['undo', 'undone', true],
    ['real pass preservation', 'real-pass-preserved', false],
  ])('%s returns the database result', async (_label, status, changed) => {
    mocks.teacherSetMissionPass.mockResolvedValue({ status, changed, source: 'teacher-skip', progress: null })
    const response = await POST(request({ missionId: 'm3', action: status === 'undone' ? 'undo' : 'pass' }), params)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status, changed, source: 'teacher-skip' }))
  })

  it('rejects invalid mission ids', async () => {
    expect((await POST(request({ missionId: 'boss', action: 'pass' }), params)).status).toBe(400)
  })
})

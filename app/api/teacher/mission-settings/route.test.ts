import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  readTeacherSession: vi.fn(),
  getOwnedClassroom: vi.fn(),
  snapshotMissionSettings: vi.fn(),
  getServiceClient: vi.fn(),
}))

vi.mock('../../_lib/session-cookie', () => ({
  readTeacherSession: mocks.readTeacherSession,
  readJsonBody: (request: Request) => request.json().catch(() => null),
  unauthorized: () => NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
  errorResponse: (error: string, message: string, status = 400) => NextResponse.json({ error, message }, { status }),
}))
vi.mock('@/lib/db/repo', () => ({ getOwnedClassroom: mocks.getOwnedClassroom, logEvent: vi.fn() }))
vi.mock('@/lib/db/client', () => ({ getServiceClient: mocks.getServiceClient }))
vi.mock('@/lib/mission-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mission-settings')>('@/lib/mission-settings')
  return { ...actual, snapshotMissionSettings: mocks.snapshotMissionSettings }
})

import { GET } from './route'

describe('teacher mission settings API auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.snapshotMissionSettings.mockResolvedValue({})
  })

  it('rejects a missing teacher session', async () => {
    mocks.readTeacherSession.mockResolvedValue(null)
    expect((await GET(new Request('http://localhost/api/teacher/mission-settings?classroomId=05f72495-343c-4d55-ac6c-acec2364ffc2'))).status).toBe(401)
  })

  it('rejects a classroom the teacher does not own', async () => {
    mocks.readTeacherSession.mockResolvedValue({ teacherId: 'teacher-1' })
    mocks.getOwnedClassroom.mockResolvedValue(null)
    expect((await GET(new Request('http://localhost/api/teacher/mission-settings?classroomId=05f72495-343c-4d55-ac6c-acec2364ffc2'))).status).toBe(404)
  })
})

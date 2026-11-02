import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  readTeacherSession: vi.fn(),
  getOwnedClassroom: vi.fn(),
  getClassroomReportRaw: vi.fn(),
  listPendingReview: vi.fn(),
  listClassroomPlanRequests: vi.fn(),
  loadClassroomLearnResults: vi.fn(),
  teacherAssist: vi.fn(),
}))

vi.mock('../../_lib/session-cookie', () => ({
  readTeacherSession: mocks.readTeacherSession,
  readJsonBody: (request: Request) => request.json().catch(() => null),
  unauthorized: () => NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
  errorResponse: (error: string, message: string, status = 400) => NextResponse.json({ error, message }, { status }),
}))
vi.mock('@/lib/db/repo', () => ({
  getOwnedClassroom: mocks.getOwnedClassroom,
  getClassroomReportRaw: mocks.getClassroomReportRaw,
  listPendingReview: mocks.listPendingReview,
  listClassroomPlanRequests: mocks.listClassroomPlanRequests,
}))
vi.mock('@/components/server/learn-results', () => ({ loadClassroomLearnResults: mocks.loadClassroomLearnResults }))
vi.mock('@/components/server/ai', () => ({ ai: { teacherAssist: mocks.teacherAssist } }))

import { POST } from './route'

const CLASSROOM = '05f72495-343c-4d55-ac6c-acec2364ffc2'
const call = (body: unknown) =>
  POST(new Request('http://localhost/api/teacher/assistant', { method: 'POST', body: JSON.stringify(body) }))
const ask = { classroomId: CLASSROOM, messages: [{ role: 'teacher', text: 'ใครยังไม่เริ่ม' }] }

describe('POST /api/teacher/assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readTeacherSession.mockResolvedValue({ teacherId: 't1' })
    mocks.getOwnedClassroom.mockResolvedValue({ id: CLASSROOM })
    mocks.getClassroomReportRaw.mockResolvedValue({
      classroomId: CLASSROOM,
      students: [{ studentId: 's1', nickname: 'บีม', joinedAt: '', profile: null, missions: [], skips: [], routeChanges: 0, reflectionCount: 0, submission: null, overrides: 0 }],
      survey: null, buddy: { requests: 0, helped: 0, passedAfterHelp: 0 }, overrides: [],
    })
    mocks.listPendingReview.mockResolvedValue([])
    mocks.listClassroomPlanRequests.mockResolvedValue([])
    mocks.loadClassroomLearnResults.mockResolvedValue([])
  })

  it('401 without a session', async () => {
    mocks.readTeacherSession.mockResolvedValue(null)
    expect((await call(ask)).status).toBe(401)
    expect(mocks.teacherAssist).not.toHaveBeenCalled()
  })

  it('404 for another teacher classroom, no data read', async () => {
    mocks.getOwnedClassroom.mockResolvedValue(null)
    expect((await call(ask)).status).toBe(404)
    expect(mocks.getClassroomReportRaw).not.toHaveBeenCalled()
    expect(mocks.teacherAssist).not.toHaveBeenCalled()
  })

  it('400 on bad body / last message from dome', async () => {
    expect((await call({ classroomId: 'x', messages: [] })).status).toBe(400)
    expect((await call({ classroomId: CLASSROOM, messages: [{ role: 'dome', text: 'hi' }] })).status).toBe(400)
  })

  it('returns AI reply and sends no ids to the model', async () => {
    mocks.teacherAssist.mockResolvedValue({ text: '- ตอบแล้วครับ', source: 'ai', provider: 'gemini', fallbackReason: null })
    const res = await call(ask)
    expect(await res.json()).toMatchObject({ reply: '- ตอบแล้วครับ', source: 'ai' })
    const sent = JSON.stringify(mocks.teacherAssist.mock.calls[0]![0])
    expect(sent).toContain('บีม')
    expect(sent).not.toContain('s1')
    expect(sent).not.toContain(CLASSROOM)
  })

  it.each([
    ['AI unavailable', () => mocks.teacherAssist.mockResolvedValue({ text: '', source: 'fallback', provider: 'rules', fallbackReason: 'no-api-key' })],
    ['AI throws', () => mocks.teacherAssist.mockRejectedValue(new Error('boom'))],
  ])('falls back to rules when %s', async (_n, setup) => {
    setup()
    const body = await (await call(ask)).json()
    expect(body.source).toBe('fallback')
    expect(body.reply).toContain('บีม')
  })
})

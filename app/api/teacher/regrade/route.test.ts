import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  readTeacherSession: vi.fn(),
  getSubmissionForTeacher: vi.fn(),
  listGradeJobsBySubmissions: vi.fn(),
  updateSubmissionAiScores: vi.fn(),
  submit: vi.fn(),
  drainQueue: vi.fn(),
}))

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return { ...actual, after: (fn: () => unknown) => void fn() }
})
vi.mock('../../_lib/session-cookie', () => ({
  readTeacherSession: mocks.readTeacherSession,
  readJsonBody: (request: Request) => request.json().catch(() => null),
  unauthorized: () => NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
  errorResponse: (error: string, message: string, status = 400) => NextResponse.json({ error, message }, { status }),
}))
vi.mock('@/lib/db/repo', () => ({
  getSubmissionForTeacher: mocks.getSubmissionForTeacher,
  listGradeJobsBySubmissions: mocks.listGradeJobsBySubmissions,
  updateSubmissionAiScores: mocks.updateSubmissionAiScores,
}))
vi.mock('@/components/server/grade-queue', () => ({
  backgroundGrader: () => ({ submit: mocks.submit }),
  drainQueue: mocks.drainQueue,
}))
vi.mock('@/components/server/game-state', () => ({ loadShopProfile: vi.fn().mockResolvedValue(null) }))

import { POST } from './route'

const ID = '05f72495-343c-4d55-ac6c-acec2364ffc2'
const req = (body: unknown) =>
  new Request('http://localhost/api/teacher/regrade', { method: 'POST', body: JSON.stringify(body) })
const sub = {
  id: ID, student_id: 's1', tld: '.co.th', domain_name: 'shop', reason_text: 'x',
  emphasis_criterion: 'bm-r2', ai_scores: { gradingStatus: 'pending-ai' },
}

describe('POST /api/teacher/regrade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readTeacherSession.mockResolvedValue({ teacherId: 't1' })
    mocks.getSubmissionForTeacher.mockResolvedValue(sub)
    mocks.submit.mockResolvedValue({ jobId: 'j1' })
    mocks.listGradeJobsBySubmissions.mockResolvedValue([{ status: 'pending' }])
    mocks.updateSubmissionAiScores.mockResolvedValue(null)
    mocks.drainQueue.mockResolvedValue({})
  })

  it('401 without teacher session', async () => {
    mocks.readTeacherSession.mockResolvedValue(null)
    expect((await POST(req({ submissionId: ID }))).status).toBe(401)
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it('404 when submission is not in the teacher classroom', async () => {
    mocks.getSubmissionForTeacher.mockResolvedValue(null)
    expect((await POST(req({ submissionId: ID }))).status).toBe(404)
    expect(mocks.getSubmissionForTeacher).toHaveBeenCalledWith('t1', ID)
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it('400 on bad body', async () => {
    expect((await POST(req({ submissionId: 'nope' }))).status).toBe(400)
  })

  it('queues with rebuilt input and drains one job', async () => {
    const res = await POST(req({ submissionId: ID }))
    expect(res.status).toBe(200)
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ submissionId: ID, tldId: 'co-th', studentId: 's1' }))
    expect(mocks.drainQueue).toHaveBeenCalledWith(1)
  })

  it('409 when AI switch is off (no real job)', async () => {
    mocks.listGradeJobsBySubmissions.mockResolvedValue([])
    expect((await POST(req({ submissionId: ID }))).status).toBe(409)
  })
})

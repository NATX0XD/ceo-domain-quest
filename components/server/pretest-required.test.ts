import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  pretestGate: vi.fn(),
  readStudentSession: vi.fn(),
  hasShopProfile: vi.fn(),
  logEvent: vi.fn(),
  loadShopProfile: vi.fn(),
}))

vi.mock('../../lib/db/repo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/db/repo')>()),
  getProfile: mocks.getProfile,
  logEvent: mocks.logEvent,
}))
vi.mock('./game-state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./game-state')>()),
  loadShopProfile: mocks.loadShopProfile,
}))
vi.mock('./posttest-gate', () => ({ pretestGate: mocks.pretestGate }))
vi.mock('./shop-gate', () => ({ hasShopProfile: mocks.hasShopProfile }))
vi.mock('../../app/api/_lib/session-cookie', () => ({
  readStudentSession: mocks.readStudentSession,
  readJsonBody: (req: Request) => req.json().catch(() => null),
  errorResponse: (error: string, message: string, status = 400, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ error, message, ...extra }, { status }),
  unauthorized: (message = 'ต้องเข้าสู่ระบบก่อน') => NextResponse.json({ error: 'unauthorized', message }, { status: 401 }),
}))

import { pretestBlockResponse, pretestRequirement } from './pretest-required'
import { POST as learnPost } from '../../app/api/mission/[id]/learn/route'
import { POST as gamePost } from '../../app/api/mission/[id]/game/route'
import { POST as skipPost } from '../../app/api/mission/[id]/skip/route'
import { POST as checkPost } from '../../app/api/mission/[id]/check/route'
import { POST as switchPost } from '../../app/api/mission/[id]/switch-route/route'
import { POST as stationPost } from '../../app/api/station-b/submit/route'

const ctx = { params: Promise.resolve({ id: 'm1' }) }
const jsonReq = (body: unknown) =>
  new Request('http://localhost/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('pretestRequirement', () => {
  beforeEach(() => {
    mocks.getProfile.mockReset()
    mocks.pretestGate.mockReset()
  })

  it('done when pre_test_score is saved (gate not consulted)', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: 3 })
    expect(await pretestRequirement('s1')).toEqual({ done: true, open: true })
    expect(mocks.pretestGate).not.toHaveBeenCalled()
    expect(await pretestBlockResponse('s1')).toBeNull()
  })

  it('score 0 still counts as done', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: 0 })
    expect((await pretestRequirement('s1')).done).toBe(true)
  })

  it('not done + teacher opened -> 409 asking to do the pretest', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: null })
    mocks.pretestGate.mockResolvedValue({ open: true, reason: null, unlockedForStudent: false })
    const res = await pretestBlockResponse('s1')
    expect(res?.status).toBe(409)
    expect(await res?.json()).toMatchObject({ error: 'pretest-required', href: '/pretest', pretestOpen: true, message: 'ทำแบบทดสอบก่อนเรียนก่อนนะ' })
  })

  it('not done + teacher not opened -> 409 asking to wait', async () => {
    mocks.getProfile.mockResolvedValue(null)
    mocks.pretestGate.mockResolvedValue({ open: false, reason: 'x', unlockedForStudent: false })
    const res = await pretestBlockResponse('s1')
    expect(res?.status).toBe(409)
    expect(await res?.json()).toMatchObject({ href: '/pretest', pretestOpen: false, message: 'รอครูเปิดแบบทดสอบก่อนเรียน' })
  })
})

describe('mission APIs reject students without a pretest', () => {
  beforeEach(() => {
    mocks.readStudentSession.mockResolvedValue({ role: 'student', studentId: 's1', classroomId: 'c1' })
    mocks.hasShopProfile.mockResolvedValue(true)
    mocks.getProfile.mockResolvedValue({ pre_test_score: null })
    mocks.pretestGate.mockResolvedValue({ open: true, reason: null, unlockedForStudent: false })
    mocks.logEvent.mockReset()
  })

  const calls: Array<[string, () => Promise<Response>]> = [
    ['learn', () => learnPost(jsonReq({ action: 'choose', mode: 'do' }), ctx)],
    ['game', () => gamePost(jsonReq({}), ctx)],
    ['skip', () => skipPost(jsonReq({}), ctx)],
    ['check', () => checkPost(jsonReq({}), ctx)],
    ['switch-route', () => switchPost(jsonReq({}), ctx)],
  ]

  it.each(calls)('POST /api/mission/[id]/%s -> 409 {href:/pretest}', async (_name, call) => {
    const res = await call()
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'pretest-required', href: '/pretest' })
    expect(mocks.logEvent).not.toHaveBeenCalled()
  })

  it('POST /api/station-b/submit -> 409 {href:/pretest}', async () => {
    mocks.loadShopProfile.mockResolvedValue({ shopName: 'ร้าน' })
    const res = await stationPost(jsonReq({ tldId: 'com', reasonText: 'เหตุผลยาวพอสมควร' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'pretest-required', href: '/pretest' })
  })

  it('learn route lets a student with a submitted pretest through the gate', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: 2 })
    const res = await learnPost(jsonReq({ action: 'nope' }), ctx)
    // ผ่านด่านแบบทดสอบแล้ว ไปตกที่ตรวจรูปแบบข้อมูลแทน
    expect(res.status).toBe(400)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStudent: vi.fn(),
  getProfile: vi.fn(),
  listSubmissions: vi.fn(),
  listStudentPhaseUnlocks: vi.fn(),
  getActiveClassSession: vi.fn(),
}))

vi.mock('@/lib/db/repo', () => mocks)

import { posttestGate, pretestGate } from './posttest-gate'

describe('ประตูแบบทดสอบหลังเรียน — ไม่ต้องรอครูเปิด', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStudent.mockResolvedValue({ id: 's1', classroom_id: 'c1' })
    mocks.listStudentPhaseUnlocks.mockResolvedValue([])
    mocks.listSubmissions.mockResolvedValue([])
  })

  it('ยังไม่ส่ง CEO = ยังปิด แม้ทำชุดก่อนเรียนแล้ว', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: 6, post_test_score: null })
    const gate = await posttestGate('s1')
    expect(gate.open).toBe(false)
    expect(gate.reason).toContain('CEO')
  })

  it('ยังไม่ทำชุดก่อนเรียน = ยังปิด และบอกให้ทำชุดก่อนเรียนก่อน (ไม่ใช่ให้รอครู)', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: null, post_test_score: null })
    const gate = await posttestGate('s1')
    expect(gate.open).toBe(false)
    expect(gate.reason).toContain('CEO')
    expect(gate.reason).not.toContain('ครูกดเปิด')
  })

  it('ส่ง CEO แล้วและทำ pretest แล้ว = เปิดเองทันที', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: 6, post_test_score: null })
    mocks.listSubmissions.mockResolvedValue([{ id: 'submission-1' }])
    const gate = await posttestGate('s1')
    expect(gate.open).toBe(true)
    expect(gate.byTeacher).toBe(false)
  })

  it('pretest เปิดเสมอโดยไม่ต้องรอครู', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: null, post_test_score: null })
    expect((await pretestGate('s1')).open).toBe(true)
  })
})

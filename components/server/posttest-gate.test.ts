import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStudent: vi.fn(),
  getProfile: vi.fn(),
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
    mocks.getActiveClassSession.mockResolvedValue({ pretest_enabled: false, posttest_enabled: false })
  })

  it('ทำชุดก่อนเรียนแล้ว = เปิดทันที แม้ครูยังไม่กดเปิด', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: 6, post_test_score: null })
    const gate = await posttestGate('s1')
    expect(gate.open).toBe(true)
    expect(gate.reason).toBeNull()
    expect(gate.byTeacher).toBe(false)
  })

  it('ยังไม่ทำชุดก่อนเรียน = ยังปิด และบอกให้ทำชุดก่อนเรียนก่อน (ไม่ใช่ให้รอครู)', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: null, post_test_score: null })
    const gate = await posttestGate('s1')
    expect(gate.open).toBe(false)
    expect(gate.reason).toContain('ก่อนเรียน')
    expect(gate.reason).not.toContain('ครูกดเปิด')
  })

  it('สวิตช์ครูยังเปิดให้ได้ (byTeacher)', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: null, post_test_score: null })
    mocks.getActiveClassSession.mockResolvedValue({ pretest_enabled: false, posttest_enabled: true })
    const gate = await posttestGate('s1')
    expect(gate.open).toBe(true)
    expect(gate.byTeacher).toBe(true)
  })

  it('ชุดก่อนเรียนยังต้องรอครูเปิดเหมือนเดิม', async () => {
    mocks.getProfile.mockResolvedValue({ pre_test_score: null, post_test_score: null })
    expect((await pretestGate('s1')).open).toBe(false)
    mocks.getActiveClassSession.mockResolvedValue({ pretest_enabled: true, posttest_enabled: false })
    expect((await pretestGate('s1')).open).toBe(true)
  })
})

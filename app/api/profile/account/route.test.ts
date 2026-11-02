import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { PATCH } from './route'

const mocks = vi.hoisted(() => ({
  readStudentSession: vi.fn(),
  getStudent: vi.fn(),
  findStudentByNickname: vi.fn(),
  updateStudentNickname: vi.fn(),
  updateStudentPin: vi.fn(),
  moderateJoinNickname: vi.fn(),
  verifyPin: vi.fn(),
  hashPin: vi.fn(),
  certificateEligibility: vi.fn(),
}))

vi.mock('../../_lib/session-cookie', () => ({
  readStudentSession: mocks.readStudentSession,
  readJsonBody: async (request: Request) => request.json().catch(() => null),
  unauthorized: (message = 'ต้องเข้าสู่ระบบก่อน') => NextResponse.json({ error: 'unauthorized', message }, { status: 401 }),
  errorResponse: (error: string, message: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, message, ...extra }, { status }),
}))
vi.mock('../../../../lib/db/repo', () => ({
  getStudent: mocks.getStudent,
  findStudentByNickname: mocks.findStudentByNickname,
  updateStudentNickname: mocks.updateStudentNickname,
  updateStudentPin: mocks.updateStudentPin,
}))
vi.mock('../../../../components/server/moderation', () => ({ moderateJoinNickname: mocks.moderateJoinNickname }))
vi.mock('../../../../lib/pin', () => ({ verifyPin: mocks.verifyPin, hashPin: mocks.hashPin }))
vi.mock('../../../../components/server/certificate-eligibility', () => ({ certificateEligibility: mocks.certificateEligibility }))

const student = { id: 'student-1', classroom_id: 'room-1', nickname: 'เดิม', pin_hash: 'hash' }
const request = (body: Record<string, string>) => new Request('http://localhost/api/profile/account', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('/api/profile/account', () => {
  beforeEach(() => {
    mocks.readStudentSession.mockResolvedValue({ role: 'student', studentId: student.id, classroomId: student.classroom_id })
    mocks.getStudent.mockResolvedValue(student)
    mocks.findStudentByNickname.mockResolvedValue(null)
    mocks.moderateJoinNickname.mockResolvedValue({ ok: true, message: null, original: 'ใหม่' })
    mocks.updateStudentNickname.mockResolvedValue({ ...student, nickname: 'ใหม่' })
    mocks.verifyPin.mockResolvedValue(true)
    mocks.hashPin.mockResolvedValue('new-hash')
    mocks.updateStudentPin.mockResolvedValue(student)
    mocks.certificateEligibility.mockResolvedValue({ eligible: false })
  })

  it('rejects missing session and invalid nickname', async () => {
    mocks.readStudentSession.mockResolvedValue(null)
    expect((await PATCH(request({ nickname: 'ใหม่' }))).status).toBe(401)
    mocks.readStudentSession.mockResolvedValue({ role: 'student', studentId: student.id, classroomId: student.classroom_id })
    expect((await PATCH(request({ nickname: '' }))).status).toBe(400)
  })

  it('renames without changing the PIN and keeps the room unique', async () => {
    const response = await PATCH(request({ nickname: 'ใหม่' }))
    expect(response.status).toBe(200)
    expect(mocks.findStudentByNickname).toHaveBeenCalledWith(student.classroom_id, 'ใหม่')
    expect(mocks.updateStudentNickname).toHaveBeenCalledWith(student.id, student.classroom_id, 'ใหม่')
    expect(mocks.updateStudentPin).not.toHaveBeenCalled()
    expect((await response.json()).message).toContain('ใช้ชื่อใหม่นี้ตอนเข้าห้องครั้งถัดไป')
  })

  it('rejects duplicate or moderated names', async () => {
    mocks.findStudentByNickname.mockResolvedValue({ id: 'other' })
    expect((await PATCH(request({ nickname: 'ซ้ำ' }))).status).toBe(409)
    mocks.findStudentByNickname.mockResolvedValue(null)
    mocks.moderateJoinNickname.mockResolvedValue({ ok: false, message: 'ไม่เหมาะ', original: 'ไม่เหมาะ' })
    expect((await PATCH(request({ nickname: 'ไม่เหมาะ' }))).status).toBe(422)
  })

  it('requires current PIN and stores only a hash for the new PIN', async () => {
    mocks.verifyPin.mockResolvedValue(false)
    expect((await PATCH(request({ currentPin: '0000', newPin: '5678' }))).status).toBe(401)
    mocks.verifyPin.mockResolvedValue(true)
    const response = await PATCH(request({ currentPin: '1234', newPin: '5678' }))
    expect(response.status).toBe(200)
    expect(mocks.verifyPin).toHaveBeenCalledWith('1234', student.pin_hash)
    expect(mocks.hashPin).toHaveBeenCalledWith('5678')
    expect(mocks.updateStudentPin).toHaveBeenCalledWith(student.id, student.classroom_id, 'new-hash')
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ getServiceClient: () => ({}) }))

import { ANSWER_TEXT_MAX, summarizeClassLearn, summarizeStudentLearn, type LearnEventRow } from './learn-results'

const at = (min: number) => new Date(Date.UTC(2026, 9, 30, 9, min)).toISOString()
const ev = (min: number, type: string, payload: Record<string, unknown>): LearnEventRow => ({
  type,
  payload,
  created_at: at(min),
})

describe('summarizeStudentLearn', () => {
  it('ไล่ลำดับเช็กพื้นฐาน เลือก ส่งตรวจ ผ่าน', () => {
    const rows = [
      // ใส่สลับลำดับเวลาเพื่อเช็กว่าเรียงเอง
      ev(5, 'learn-done', { missionId: 'm1', mode: 'read', score: 75 }),
      ev(0, 'learn-warmup', { missionId: 'm1', score: 1, total: 3, recommended: 'watch' }),
      ev(1, 'learn-choose', { missionId: 'm1', mode: 'watch', recommended: 'watch', followed: true }),
      ev(2, 'learn-answer', { missionId: 'm1', mode: 'watch', score: 40, passed: false }),
      ev(3, 'learn-choose', { missionId: 'm1', mode: 'read', recommended: 'watch', followed: false }),
      ev(4, 'learn-answer', { missionId: 'm1', mode: 'read', score: 75, passed: true }),
    ]
    const [m1] = summarizeStudentLearn(rows)
    expect(m1).toMatchObject({
      missionId: 'm1',
      warmupScore: 1,
      warmupTotal: 3,
      recommended: 'watch',
      chosen: 'read',
      followed: false,
      modeSwitches: 1,
      attempts: 2,
      bestScore: 75,
      done: true,
      doneMode: 'read',
      doneScore: 75,
      doneAt: at(5),
      lastActivityAt: at(5),
    })
  })

  it('ข้าม event ที่ไม่มี missionId หรือ mode เพี้ยน และแยกภารกิจ', () => {
    const rows = [
      ev(0, 'learn-warmup', { score: 3 }),
      ev(1, 'learn-choose', { missionId: 'm2', mode: 'fly' }),
      ev(2, 'learn-do', { missionId: 'm3', score: 100, passed: true }),
      ev(3, 'learn-done', { missionId: 'm3', mode: 'do', score: 100 }),
    ]
    const out = summarizeStudentLearn(rows)
    expect(out.map((m) => m.missionId)).toEqual(['m2', 'm3'])
    expect(out[0]).toMatchObject({ chosen: null, attempts: 0, done: false })
    expect(out[1]).toMatchObject({ followed: null, attempts: 1, done: true, doneMode: 'do' })
  })

  it('ผ่านซ้ำได้คะแนนสูงกว่า ยกคะแนนแต่คงเวลาผ่านครั้งแรก', () => {
    const out = summarizeStudentLearn([
      ev(0, 'learn-done', { missionId: 'm1', mode: 'watch', score: 65 }),
      ev(1, 'learn-done', { missionId: 'm1', mode: 'read', score: 90 }),
      ev(2, 'learn-done', { missionId: 'm1', mode: 'do', score: 70 }),
    ])
    expect(out[0]).toMatchObject({ doneScore: 90, doneMode: 'read', doneAt: at(0) })
  })
})

describe('summarizeStudentLearn latestAnswer', () => {
  it('เก็บคำตอบครั้งล่าสุด คะแนนรายข้อ และตัดข้อความยาว', () => {
    const [m1] = summarizeStudentLearn([
      ev(0, 'learn-answer', { missionId: 'm1', mode: 'watch', score: 10, passed: false, answers: { q1: 'เก่า' } }),
      ev(1, 'learn-answer', {
        missionId: 'm1',
        mode: 'read',
        score: 80,
        passed: true,
        perQuestion: [
          { id: 'q1', score: 80, source: 'typhoon' },
          { id: 'q2', score: 0, source: 'rule' },
          { id: 'q3', score: 50 },
        ],
        answers: { q1: 'x'.repeat(ANSWER_TEXT_MAX + 50), q2: '', q3: 'เก่า' },
      }),
      ev(2, 'learn-do', { missionId: 'm1', kind: 'game', score: 100 }),
    ])
    expect(m1?.latestAnswer).toMatchObject({ mode: 'read', score: 80, passed: true, at: at(1) })
    expect(m1?.latestAnswer?.answers[0]).toEqual({
      id: 'q1',
      text: 'x'.repeat(ANSWER_TEXT_MAX),
      score: 80,
      checkedBy: 'ai',
    })
    expect(m1?.latestAnswer?.answers[1]).toEqual({ id: 'q2', text: '', score: 0, checkedBy: 'keyword' })
    // event เก่าก่อนมี AI ช่วยตรวจ ไม่มี source = ไม่ติดป้าย
    expect(m1?.latestAnswer?.answers[2]).toEqual({ id: 'q3', text: 'เก่า', score: 50, checkedBy: null })
  })

  it('ไม่มีคำตอบ = null', () => {
    const [m1] = summarizeStudentLearn([ev(0, 'learn-answer', { missionId: 'm1', mode: 'watch', score: 0 })])
    expect(m1?.latestAnswer).toBeNull()
  })
})

describe('summarizeClassLearn', () => {
  it('นับรายภารกิจทั้งห้อง', () => {
    const a = summarizeStudentLearn([
      ev(0, 'learn-warmup', { missionId: 'm1', score: 3, total: 3, recommended: 'do' }),
      ev(1, 'learn-choose', { missionId: 'm1', mode: 'do', recommended: 'do' }),
      ev(2, 'learn-do', { missionId: 'm1', score: 100 }),
      ev(3, 'learn-done', { missionId: 'm1', mode: 'do', score: 100 }),
    ])
    const b = summarizeStudentLearn([
      ev(0, 'learn-warmup', { missionId: 'm1', score: 2, total: 3, recommended: 'read' }),
      ev(1, 'learn-choose', { missionId: 'm1', mode: 'watch', recommended: 'read' }),
      ev(2, 'learn-answer', { missionId: 'm1', score: 50 }),
      ev(3, 'learn-answer', { missionId: 'm1', score: 70 }),
      ev(4, 'learn-done', { missionId: 'm1', mode: 'watch', score: 70 }),
    ])
    const c = summarizeStudentLearn([ev(0, 'learn-warmup', { missionId: 'm1', score: 0, total: 3, recommended: 'watch' })])
    const [m1] = summarizeClassLearn([
      { studentId: 'a', nickname: 'ก', missions: a },
      { studentId: 'b', nickname: 'ข', missions: b },
      { studentId: 'c', nickname: 'ค', missions: c },
    ])
    expect(m1).toEqual({
      missionId: 'm1',
      warmedUp: 3,
      warmupAvg: 1.67,
      recommended: { watch: 1, read: 1, do: 1 },
      chosen: { watch: 1, read: 0, do: 1 },
      followedRecommendation: 1,
      choseDifferent: 1,
      done: 2,
      doneByMode: { watch: 1, read: 0, do: 1 },
      doneAvgByMode: { watch: 70, read: null, do: 100 },
      attemptsAvg: 1.5,
    })
  })

  it('ห้องว่างคืนรายการว่าง', () => {
    expect(summarizeClassLearn([])).toEqual([])
  })
})

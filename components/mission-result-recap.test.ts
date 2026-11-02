import { describe, expect, it } from 'vitest'
import { missionResultRecap } from './mission-result-recap'

describe('missionResultRecap', () => {
  it('check: first-try correct = full stars, nothing to improve', () => {
    const r = missionResultRecap({ stars: 3, wrong: 0, starSource: 'check', learnScore: null, canReplay: true })
    expect(r.verdict).toBe('ตอบคำถามท้ายภารกิจถูก')
    expect(r.starHow).toContain('ครั้งแรก')
    expect(r.improve).toBeNull()
  })

  it('check: wrong answers explain the lost stars and how to improve', () => {
    const r = missionResultRecap({ stars: 2, wrong: 1, starSource: 'check', learnScore: null, canReplay: true })
    expect(r.starHow).toBe('ตอบผิด 1 ครั้งก่อนตอบถูก จึงได้ 2 ดาว (ถูกครั้งแรกได้ 3 ดาว)')
    expect(r.improve).toContain('เล่นใหม่')
  })

  it('never tells the learner to press replay when there is no replay button', () => {
    const r = missionResultRecap({ stars: 1, wrong: 3, starSource: 'check', learnScore: null, canReplay: false })
    expect(r.improve).not.toContain('เล่นใหม่')
  })

  it('exit-score: stars come from the end-of-mission score', () => {
    const r = missionResultRecap({ stars: 2, wrong: 0, starSource: 'exit-score', learnScore: 70, canReplay: true })
    expect(r.verdict).toBe('ผ่านแบบทดสอบท้ายภารกิจแล้ว')
    expect(r.starHow).toBe('ได้ 70 คะแนน จึงได้ 2 ดาว (90 ขึ้นไปได้ 3 ดาว)')
    expect(r.improve).toContain('90 คะแนน')
  })
})

import { describe, expect, it } from 'vitest'
import {
  ACTIVE_WITHIN_SECONDS,
  BUDDY_SCORE,
  type BuddyCandidate,
  type BuddyRequest,
  MAX_REQUEST_ATTEMPTS,
  buddyIneligibleReason,
  buddyScore,
  findMatch,
} from './buddy'

const REQUEST: BuddyRequest = { studentId: 'stu-1', missionId: 'm3', seatZone: 'A' }

function candidate(over: Partial<BuddyCandidate> = {}): BuddyCandidate {
  return {
    studentId: 'stu-2',
    nickname: 'ก้อง',
    standing: 'passed',
    stars: 3,
    idleSeconds: 10,
    helpingNow: 0,
    helpedCount: 0,
    ...over,
  }
}

describe('คุณสมบัติของคู่หู ต้องครบทุกข้อตามสเปก E-04', () => {
  it('คนที่ผ่านภารกิจแล้วและยังใช้งานอยู่ ผ่านเกณฑ์', () => {
    expect(buddyIneligibleReason(candidate(), REQUEST)).toBeNull()
  })

  it('ตัดคนที่ไม่ได้ใช้งานเกิน 60 วินาที', () => {
    const reason = buddyIneligibleReason(candidate({ idleSeconds: ACTIVE_WITHIN_SECONDS + 1 }), REQUEST)
    expect(reason).toContain('ไม่ได้ใช้งาน')
  })

  it('ตัดคนที่ยังไม่ผ่านภารกิจนั้น', () => {
    expect(buddyIneligibleReason(candidate({ standing: 'in-progress' }), REQUEST)).toBe(
      'ยังไม่ผ่านภารกิจนี้',
    )
    expect(buddyIneligibleReason(candidate({ standing: 'not-started' }), REQUEST)).toBeTruthy()
  })

  it('คนที่ข้ามภารกิจเพราะตอบถูกและมั่นใจ เป็นคู่หูได้', () => {
    expect(buddyIneligibleReason(candidate({ standing: 'skipped-confident' }), REQUEST)).toBeNull()
  })

  it('ตัดคนที่อยู่ในด่านบอสและคนที่กำลังรอครู', () => {
    expect(buddyIneligibleReason(candidate({ inBigMission: true }), REQUEST)).toContain('ด่านบอส')
    expect(buddyIneligibleReason(candidate({ waitingForTeacher: true }), REQUEST)).toContain('เรียกครู')
  })

  it('ตัดคนที่ปิดรับคำขอ และคนที่กำลังช่วยเพื่อนอยู่ 2 คนแล้ว', () => {
    expect(buddyIneligibleReason(candidate({ acceptingRequests: false }), REQUEST)).toContain('ปิดรับ')
    expect(buddyIneligibleReason(candidate({ helpingNow: 2 }), REQUEST)).toContain('กำลังช่วยเพื่อน')
  })

  it('ตัดคนที่เพิ่งปฏิเสธผู้ขอคนนี้ไปไม่ถึง 5 นาที แต่เกิน 5 นาทีแล้วขอได้ใหม่', () => {
    expect(
      buddyIneligibleReason(candidate({ declinedRequesters: { 'stu-1': 120 } }), REQUEST),
    ).toContain('ปฏิเสธ')
    expect(
      buddyIneligibleReason(candidate({ declinedRequesters: { 'stu-1': 301 } }), REQUEST),
    ).toBeNull()
    // ปฏิเสธคนอื่นไม่เกี่ยวกับผู้ขอคนนี้
    expect(
      buddyIneligibleReason(candidate({ declinedRequesters: { 'stu-9': 10 } }), REQUEST),
    ).toBeNull()
  })

  it('ไม่จับคู่กับตัวเอง', () => {
    expect(buddyIneligibleReason(candidate({ studentId: 'stu-1' }), REQUEST)).toBe('เป็นตัวผู้ขอเอง')
  })
})

describe('คะแนนเลือกคู่หู ตรงกับตารางในสเปก', () => {
  it('ผ่าน 3 ดาวได้ 3 · ข้ามเพราะมั่นใจได้ 2 · ผ่าน 2 ดาวได้ 1', () => {
    expect(buddyScore(candidate({ stars: 3 }), { ...REQUEST, seatZone: null })).toBe(3)
    expect(
      buddyScore(candidate({ standing: 'skipped-confident' }), { ...REQUEST, seatZone: null }),
    ).toBe(2)
    expect(buddyScore(candidate({ stars: 2 }), { ...REQUEST, seatZone: null })).toBe(1)
  })

  it('ชอบเรียนกับเพื่อน +1 และนั่งโซนเดียวกัน +1', () => {
    const base = buddyScore(candidate(), { ...REQUEST, seatZone: null })
    expect(buddyScore(candidate({ likesTalking: true }), { ...REQUEST, seatZone: null })).toBe(
      base + BUDDY_SCORE.likesTalking,
    )
    expect(buddyScore(candidate({ seatZone: 'A' }), REQUEST)).toBe(base + BUDDY_SCORE.sameSeatZone)
  })

  it('ช่วยเพื่อนไปแล้วหักครั้งละ 1', () => {
    expect(buddyScore(candidate({ helpedCount: 2 }), { ...REQUEST, seatZone: null })).toBe(1)
  })

  it('ไม่มีผังที่นั่งก็ไม่ให้คะแนนโซน', () => {
    expect(buddyScore(candidate({ seatZone: 'A' }), { ...REQUEST, seatZone: null })).toBe(3)
  })
})

describe('เลือกคู่หู', () => {
  it('เลือกคนคะแนนสูงสุด และคืนคิวไม่เกิน 3 คน', () => {
    const result = findMatch(REQUEST, [
      candidate({ studentId: 'stu-2', stars: 2 }),
      candidate({ studentId: 'stu-3', stars: 3, likesTalking: true, seatZone: 'A' }),
      candidate({ studentId: 'stu-4', stars: 3 }),
      candidate({ studentId: 'stu-5', standing: 'skipped-confident' }),
      candidate({ studentId: 'stu-6', stars: 3 }),
    ])
    expect(result.kind).toBe('buddy')
    expect(result.chosen?.studentId).toBe('stu-3')
    expect(result.queue).toHaveLength(MAX_REQUEST_ATTEMPTS)
    expect(result.chosen?.reason).toContain('คะแนน 5')
  })

  it('**คนที่ช่วยไปแล้วหลายครั้งถูกเลือกน้อยลง** (เกณฑ์ตรวจรับของสเปก)', () => {
    const result = findMatch(REQUEST, [
      candidate({ studentId: 'stu-เก่ง', stars: 3, helpedCount: 3 }),
      candidate({ studentId: 'stu-ใหม่', stars: 3, helpedCount: 0 }),
    ])
    expect(result.chosen?.studentId).toBe('stu-ใหม่')
  })

  it('ผลคงที่ทุกครั้ง ไม่มีการสุ่ม', () => {
    const list = [
      candidate({ studentId: 'stu-5', stars: 3 }),
      candidate({ studentId: 'stu-2', stars: 3 }),
      candidate({ studentId: 'stu-9', stars: 3 }),
    ]
    const runs = Array.from({ length: 20 }, () => findMatch(REQUEST, list))
    for (const run of runs) {
      expect(run.chosen?.studentId).toBe(runs[0]!.chosen?.studentId)
      expect(run.queue.map((q) => q.studentId)).toEqual(runs[0]!.queue.map((q) => q.studentId))
    }
  })

  it('คะแนนเท่ากันตัดสินด้วยคนที่ช่วยมาน้อยกว่าก่อน แล้วจึงเรียงตามรหัส', () => {
    const result = findMatch(REQUEST, [
      candidate({ studentId: 'stu-9', stars: 3, helpedCount: 0 }),
      candidate({ studentId: 'stu-2', stars: 3, helpedCount: 0 }),
    ])
    expect(result.chosen?.studentId).toBe('stu-2')
  })

  it('บอกได้ว่าตัดใครออกเพราะอะไร', () => {
    const result = findMatch(REQUEST, [
      candidate({ studentId: 'stu-2', inBigMission: true }),
      candidate({ studentId: 'stu-3', stars: 3 }),
    ])
    expect(result.ineligible).toEqual([{ studentId: 'stu-2', reason: 'กำลังอยู่ในด่านบอส' }])
  })
})

describe('ไม่มีคู่หู ให้หาคู่คิดแทน', () => {
  it('**ยังไม่มีใครผ่านภารกิจนั้นเลย จับคู่คิดจากคนที่กำลังทำอยู่**', () => {
    const result = findMatch(REQUEST, [
      candidate({ studentId: 'stu-2', standing: 'in-progress' }),
      candidate({ studentId: 'stu-3', standing: 'in-progress', likesTalking: true }),
    ])
    expect(result.kind).toBe('thinking-partner')
    expect(result.chosen?.studentId).toBe('stu-3')
    expect(result.showCard).toBe(false)
    expect(result.reason).toContain('คู่คิด')
  })

  it('ให้ความสำคัญกับคนที่ชอบเรียนกับเพื่อน และผลคงที่', () => {
    const list = [
      candidate({ studentId: 'stu-5', standing: 'in-progress' }),
      candidate({ studentId: 'stu-2', standing: 'in-progress', likesTalking: true }),
    ]
    for (let i = 0; i < 10; i++) {
      expect(findMatch(REQUEST, list).chosen?.studentId).toBe('stu-2')
    }
  })

  it('ไม่จับคนที่อยู่ในคู่อื่นแล้ว', () => {
    const result = findMatch(REQUEST, [
      candidate({ studentId: 'stu-2', standing: 'in-progress', pairedWith: 'stu-7' }),
    ])
    expect(result.kind).toBe('card')
    expect(result.showCard).toBe(true)
  })
})

describe('ไม่มีทั้งคู่หูและคู่คิด', () => {
  it('ห้องมีคนเดียวไม่พัง แสดงการ์ดคู่คิดและปุ่มเรียกครู', () => {
    const result = findMatch(REQUEST, [])
    expect(result.kind).toBe('card')
    expect(result.chosen).toBeNull()
    expect(result.queue).toEqual([])
    expect(result.showCard).toBe(true)
    expect(result.reason).toContain('เรียกครู')
  })

  it('มีเพื่อนแต่ไม่มีใครว่างเลย ก็ยังได้การ์ด ไม่พัง', () => {
    const result = findMatch(REQUEST, [
      candidate({ studentId: 'stu-2', standing: 'not-started' }),
      candidate({ studentId: 'stu-3', idleSeconds: 999 }),
    ])
    expect(result.kind).toBe('card')
    expect(result.ineligible).toHaveLength(2)
  })

  it('ข้อมูลผู้สมัครที่พังไม่ทำให้ระบบล้ม', () => {
    const result = findMatch(REQUEST, [null as unknown as BuddyCandidate, candidate()])
    expect(result.kind).toBe('buddy')
    expect(result.consideredCount).toBe(1)
  })
})

describe('กฎและเงื่อนไขอื่นของสเปก', () => {
  it('ผู้ขอมีคำขอค้างอยู่แล้ว ขอใหม่ไม่ได้ (ครั้งละ 1 คำขอ)', () => {
    const result = findMatch({ ...REQUEST, hasOpenRequest: true }, [candidate()])
    expect(result.blockedByOpenRequest).toBe(true)
    expect(result.chosen).toBeNull()
    expect(result.showCard).toBe(false)
  })

  it('ช่วงทำต่อที่บ้าน ข้ามการจับคู่ไปการ์ดคู่คิดทันที', () => {
    const result = findMatch({ ...REQUEST, atHome: true }, [candidate()])
    expect(result.kind).toBe('card')
    expect(result.reason).toContain('ที่บ้าน')
  })
})

import { describe, expect, it } from 'vitest'
import { matchHeadline, nextHelperToOffer, shouldOpenRequest } from './buddy-flow'
import { findMatch, type BuddyCandidate, type MatchResult, type RankedCandidate } from './buddy'

function ranked(id: string, nickname = id): RankedCandidate {
  return { studentId: id, nickname, score: 3, reason: 'ผ่านภารกิจนี้แล้ว' }
}

function candidate(id: string, extra: Partial<BuddyCandidate> = {}): BuddyCandidate {
  return {
    studentId: id,
    nickname: id,
    standing: 'passed',
    stars: 3,
    idleSeconds: 5,
    ...extra,
  }
}

describe('nextHelperToOffer', () => {
  it('ยังไม่เคยยิง ได้คนแรกในลำดับ และนับเป็นครั้งที่ 1', () => {
    const out = nextHelperToOffer({ queue: [ranked('a'), ranked('b')], attempts: 0 })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.helper.studentId).toBe('a')
    expect(out.attemptNo).toBe(1)
  })

  it('คนแรกปฏิเสธไปแล้ว ข้ามไปคนถัดไป ไม่ยิงซ้ำคนเดิม', () => {
    const out = nextHelperToOffer({
      queue: [ranked('a'), ranked('b'), ranked('c')],
      alreadyOffered: ['a'],
      attempts: 1,
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.helper.studentId).toBe('b')
    expect(out.attemptNo).toBe(2)
  })

  it('ครบ 3 ครั้งแล้วหยุด แม้ยังมีคนเหลือในลำดับ', () => {
    const out = nextHelperToOffer({
      queue: [ranked('a'), ranked('b'), ranked('c'), ranked('d')],
      alreadyOffered: ['a', 'b', 'c'],
      attempts: 3,
    })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('exhausted-attempts')
    expect(out.message).toContain('เรียกครู')
  })

  it('ยังไม่ครบโควตาแต่คนในลำดับถูกยิงไปหมดแล้ว = no-one-left', () => {
    const out = nextHelperToOffer({
      queue: [ranked('a'), ranked('b')],
      alreadyOffered: ['a', 'b'],
      attempts: 2,
    })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('no-one-left')
  })

  it('ลำดับว่างเปล่า = no-one-left ไม่ใช่ข้อผิดพลาด', () => {
    const out = nextHelperToOffer({ queue: [], attempts: 0 })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('no-one-left')
  })

  it('attempts เพี้ยน (ติดลบ / ไม่ใช่ตัวเลข) ถือเป็น 0 ไม่ใช่พัง', () => {
    const a = nextHelperToOffer({ queue: [ranked('a')], attempts: -5 })
    const b = nextHelperToOffer({
      queue: [ranked('a')],
      attempts: Number.NaN as unknown as number,
    })
    expect(a.ok && a.attemptNo).toBe(1)
    expect(b.ok && b.attemptNo).toBe(1)
  })

  it('เรียกซ้ำด้วยข้อมูลชุดเดิมได้คนเดิมทุกครั้ง', () => {
    const input = { queue: [ranked('z'), ranked('a')], alreadyOffered: [], attempts: 1 }
    const first = nextHelperToOffer(input)
    for (let i = 0; i < 20; i += 1) {
      expect(nextHelperToOffer(input)).toEqual(first)
    }
  })
})

describe('shouldOpenRequest', () => {
  it('มีคู่หูให้ยิง = เปิดใบ', () => {
    const match = findMatch({ studentId: 'me', missionId: 'm1' }, [candidate('a')])
    expect(match.kind).toBe('buddy')
    expect(shouldOpenRequest(match)).toBe(true)
  })

  it('ได้แค่การ์ดคู่คิด = ไม่เปิดใบ (ไม่งั้นใบเปล่าจะกินโควตา 1 ใบของผู้เรียน)', () => {
    const match = findMatch({ studentId: 'me', missionId: 'm1' }, [])
    expect(match.kind).toBe('card')
    expect(shouldOpenRequest(match)).toBe(false)
  })

  it('มีใบค้างอยู่แล้ว = ไม่เปิดใบใหม่', () => {
    const match = findMatch({ studentId: 'me', missionId: 'm1', hasOpenRequest: true }, [
      candidate('a'),
    ])
    expect(shouldOpenRequest(match)).toBe(false)
  })

  it('คู่คิด (ยังไม่มีใครผ่าน) = เปิดใบ', () => {
    const match = findMatch({ studentId: 'me', missionId: 'm1' }, [
      candidate('a', { standing: 'in-progress' }),
    ])
    expect(match.kind).toBe('thinking-partner')
    expect(shouldOpenRequest(match)).toBe(true)
  })

  it('ไม่มีผลลัพธ์เลย = ไม่เปิดใบ', () => {
    expect(shouldOpenRequest(null)).toBe(false)
    expect(shouldOpenRequest(undefined)).toBe(false)
  })
})

describe('matchHeadline', () => {
  it('เจอคู่หู บอกชื่อเพื่อนที่กำลังถาม', () => {
    const match = findMatch({ studentId: 'me', missionId: 'm1' }, [candidate('อาร์ม')])
    expect(matchHeadline(match)).toContain('อาร์ม')
  })

  it('อยู่คนเดียวในห้อง ชวนอธิบายเองและบอกว่ากดเรียกครูได้', () => {
    const line = matchHeadline(findMatch({ studentId: 'me', missionId: 'm1' }, []))
    expect(line).toContain('การ์ดคู่คิด')
    expect(line).toContain('เรียกครู')
  })

  it('มีใบค้าง บอกให้ปิดใบเดิมก่อน', () => {
    const match = findMatch({ studentId: 'me', missionId: 'm1', hasOpenRequest: true }, [])
    expect(matchHeadline(match)).toContain('ปิดใบเดิม')
  })

  it('ยิงต่อคนที่ 2 ต้องขึ้นชื่อคนที่ถูกถามจริง ไม่ใช่ชื่อคนแรกของลำดับ', () => {
    const match = findMatch({ studentId: 'me', missionId: 'm1' }, [
      candidate('อาร์ม'),
      candidate('บีม', { stars: 2 }),
    ])
    expect(matchHeadline(match)).toContain('อาร์ม')
    expect(matchHeadline(match, 'บีม')).toContain('บีม')
    expect(matchHeadline(match, 'บีม')).not.toContain('อาร์ม')
  })

  it('ส่งชื่อว่างมาให้ตกกลับไปใช้ชื่อคนแรกของลำดับ ไม่ใช่ช่องว่าง', () => {
    const match = findMatch({ studentId: 'me', missionId: 'm1' }, [candidate('อาร์ม')])
    expect(matchHeadline(match, '   ')).toContain('อาร์ม')
    expect(matchHeadline(match, null)).toContain('อาร์ม')
  })

  it('ไม่มีผลลัพธ์ก็ยังได้ข้อความที่อ่านได้ ไม่ใช่ช่องว่าง', () => {
    expect(matchHeadline(null).length).toBeGreaterThan(0)
  })

  it('ทุกกรณีของ MatchResult ได้ข้อความไม่ว่าง', () => {
    const cases: MatchResult[] = [
      findMatch({ studentId: 'me', missionId: 'm1' }, [candidate('a')]),
      findMatch({ studentId: 'me', missionId: 'm1' }, [candidate('a', { standing: 'in-progress' })]),
      findMatch({ studentId: 'me', missionId: 'm1', atHome: true }, [candidate('a')]),
    ]
    for (const match of cases) expect(matchHeadline(match).trim().length).toBeGreaterThan(0)
  })
})

import { describe, expect, it } from 'vitest'
import { assignCheckSet, joinIndexOf, stableHash } from './check-set'

const SETS = ['set-a', 'set-b'] as const

describe('สลับชุดคำถามตามลำดับการเข้าห้อง', () => {
  it('คนที่ 1 ได้ชุด A คนที่ 2 ได้ชุด B สลับกันไป', () => {
    const got = [0, 1, 2, 3, 4].map(
      (i) => assignCheckSet({ studentId: `s${i}`, joinIndex: i, setIds: SETS }).setId,
    )
    expect(got).toEqual(['set-a', 'set-b', 'set-a', 'set-b', 'set-a'])
  })

  it('บอกว่าใช้ลำดับการเข้าห้องเป็นเกณฑ์', () => {
    expect(assignCheckSet({ studentId: 's1', joinIndex: 3, setIds: SETS }).basis).toBe('join-order')
  })

  it('ลำดับเดิมได้ชุดเดิมเสมอ เรียกกี่ครั้งก็เหมือนเดิม', () => {
    const first = assignCheckSet({ studentId: 'abc', joinIndex: 7, setIds: SETS }).setId
    for (let i = 0; i < 30; i += 1) {
      expect(assignCheckSet({ studentId: 'abc', joinIndex: 7, setIds: SETS }).setId).toBe(first)
    }
  })
})

describe('ไม่รู้ลำดับการเข้าห้อง ใช้รหัสผู้เรียนแทน', () => {
  it('ยังคงที่ต่อคน เข้าใหม่ได้ชุดเดิม', () => {
    const a = assignCheckSet({ studentId: 'student-เอ', setIds: SETS })
    const b = assignCheckSet({ studentId: 'student-เอ', setIds: SETS })
    expect(a.setId).toBe(b.setId)
    expect(a.basis).toBe('student-id')
  })

  it('ลำดับติดลบหรือไม่ใช่จำนวนเต็มก็ตกมาใช้รหัสผู้เรียน', () => {
    expect(assignCheckSet({ studentId: 'x', joinIndex: -1, setIds: SETS }).basis).toBe('student-id')
    expect(assignCheckSet({ studentId: 'x', joinIndex: 1.5, setIds: SETS }).basis).toBe('student-id')
    expect(assignCheckSet({ studentId: 'x', joinIndex: null, setIds: SETS }).basis).toBe('student-id')
  })

  it('กระจายคนลงทั้งสองชุด ไม่ใช่กองอยู่ชุดเดียว', () => {
    const counts: Record<string, number> = { 'set-a': 0, 'set-b': 0 }
    for (let i = 0; i < 200; i += 1) {
      const { setId } = assignCheckSet({ studentId: `นักเรียน-${i}`, setIds: SETS })
      counts[setId] = (counts[setId] ?? 0) + 1
    }
    expect(counts['set-a']).toBeGreaterThan(50)
    expect(counts['set-b']).toBeGreaterThan(50)
  })
})

describe('กรณีขอบ', () => {
  it('มีชุดเดียวคืนชุดนั้นเสมอ', () => {
    expect(assignCheckSet({ studentId: 'x', joinIndex: 9, setIds: ['set-a'] }).setId).toBe('set-a')
  })

  it('ไม่มีชุดเลยคืนค่าว่าง ไม่ throw', () => {
    expect(assignCheckSet({ studentId: 'x', setIds: [] }).setId).toBe('')
  })

  it('รหัสชุดที่ว่างเปล่าถูกกรองทิ้ง', () => {
    expect(assignCheckSet({ studentId: 'x', joinIndex: 1, setIds: ['', 'set-b'] }).setId).toBe('set-b')
  })
})

describe('ตัวช่วยหาลำดับการเข้าห้อง', () => {
  it('คืนตำแหน่งในรายชื่อที่เรียงตามเวลาเข้าแล้ว', () => {
    expect(joinIndexOf('b', ['a', 'b', 'c'])).toBe(1)
    expect(joinIndexOf('a', ['a', 'b', 'c'])).toBe(0)
  })

  it('ไม่เจอชื่อคืน null', () => {
    expect(joinIndexOf('z', ['a', 'b'])).toBeNull()
  })
})

describe('ตัวเลขประจำข้อความ', () => {
  it('ข้อความเดิมได้เลขเดิมเสมอ', () => {
    expect(stableHash('ทดสอบ')).toBe(stableHash('ทดสอบ'))
  })

  it('ข้อความต่างกันได้เลขต่างกัน', () => {
    expect(stableHash('a')).not.toBe(stableHash('b'))
  })

  it('เป็นจำนวนเต็มไม่ติดลบเสมอ', () => {
    for (const s of ['', 'x', 'ยาว ๆ หน่อย นะครับ', '12345']) {
      const h = stableHash(s)
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
    }
  })
})

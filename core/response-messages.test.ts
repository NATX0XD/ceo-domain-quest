import { describe, expect, it } from 'vitest'
import {
  availableSituations,
  fillTokens,
  messageForCheck,
  pickMessage,
  situationForCheck,
} from './response-messages'

describe('คลังข้อความที่โหลดมาจากไฟล์เนื้อหา', () => {
  it('มีครบ 9 สถานการณ์', () => {
    expect(availableSituations()).toHaveLength(9)
  })

  it('ทุกสถานการณ์ที่โค้ดรู้จักมีข้อความจริงในไฟล์', () => {
    const all = [
      'correct-first',
      'correct-after-try',
      'wrong-first',
      'wrong-repeat',
      'passed-via-alt',
      'mission-passed',
      'mission-skipped',
      'boss-passed',
      'teacher-asked-revise',
    ] as const
    for (const s of all) {
      expect(pickMessage({ situation: s })).toBeTruthy()
    }
  })

  it('ไม่มีข้อความไหนใช้คำว่า ผิด กับผู้เรียน', () => {
    const all = ['wrong-first', 'wrong-repeat', 'correct-first', 'mission-skipped'] as const
    for (const s of all) {
      for (let r = 0; r < 3; r += 1) {
        expect(pickMessage({ situation: s, rotation: r })).not.toMatch(/ผิด|พลาด/)
      }
    }
  })
})

describe('เติมสัญลักษณ์ในข้อความ', () => {
  it('เติมชื่อเล่นและชื่อร้านให้ครบ', () => {
    expect(fillTokens('เยี่ยม {ชื่อ} ร้าน{แบรนด์}โตแล้ว', { nickname: 'เอ', brandName: 'ขนมยาย' })).toBe(
      'เยี่ยม เอ ร้านขนมยายโตแล้ว',
    )
  })

  it('ไม่มีค่าก็ต้องไม่ปล่อยสัญลักษณ์หลุดไปหน้าจอ', () => {
    const got = fillTokens('{ชื่อ} กับ {แบรนด์} และ {ตัวละคร}')
    expect(got).not.toContain('{')
    expect(got).not.toContain('}')
  })

  it('ค่าที่เป็นช่องว่างล้วนถือว่าไม่มีค่า', () => {
    expect(fillTokens('{ชื่อ}', { nickname: '   ' })).toBe('CEO')
  })
})

describe('เลือกประโยคแบบไม่สุ่ม', () => {
  it('rotation เดิมได้ประโยคเดิมเสมอ', () => {
    const first = pickMessage({ situation: 'wrong-first', rotation: 0 })
    for (let i = 0; i < 20; i += 1) {
      expect(pickMessage({ situation: 'wrong-first', rotation: 0 })).toBe(first)
    }
  })

  it('rotation ถัดไปได้คนละประโยค ไม่ซ้ำติดกัน', () => {
    const a = pickMessage({ situation: 'wrong-repeat', rotation: 0 })
    const b = pickMessage({ situation: 'wrong-repeat', rotation: 1 })
    expect(a).not.toBe(b)
  })

  it('rotation เกินจำนวนประโยควนกลับมาต้นแถว', () => {
    const a = pickMessage({ situation: 'wrong-repeat', rotation: 0 })
    expect(pickMessage({ situation: 'wrong-repeat', rotation: 3 })).toBe(a)
  })

  it('rotation ติดลบหรือไม่ใช่ตัวเลขก็ยังคืนข้อความได้', () => {
    expect(pickMessage({ situation: 'wrong-first', rotation: -5 })).toBeTruthy()
    expect(pickMessage({ situation: 'wrong-first', rotation: Number.NaN })).toBeTruthy()
  })
})

describe('แปลผลการตรวจคำตอบเป็นสถานการณ์', () => {
  it('ถูกตั้งแต่ครั้งแรก', () => {
    expect(situationForCheck({ correct: true, attempts: 1 })).toBe('correct-first')
  })

  it('ถูกหลังพยายามหลายครั้ง', () => {
    expect(situationForCheck({ correct: true, attempts: 3 })).toBe('correct-after-try')
  })

  it('ยังไม่ถูกครั้งแรก กับยังไม่ถูกซ้ำ ใช้คนละสถานการณ์', () => {
    expect(situationForCheck({ correct: false, attempts: 1 })).toBe('wrong-first')
    expect(situationForCheck({ correct: false, attempts: 2 })).toBe('wrong-repeat')
  })

  it('ผ่านไปแล้วตอบซ้ำ ไม่นับเป็นตอบถูกครั้งแรกอีก', () => {
    expect(situationForCheck({ correct: true, attempts: 1, alreadyPassed: true })).toBe(
      'mission-passed',
    )
  })

  it('attempts เพี้ยนก็ยังตัดสินได้ ไม่ throw', () => {
    expect(situationForCheck({ correct: false, attempts: 0 })).toBe('wrong-first')
    expect(situationForCheck({ correct: false, attempts: Number.NaN })).toBe('wrong-first')
  })
})

describe('ทางลัดที่ route เรียกใช้', () => {
  it('คืนทั้งสถานการณ์และข้อความที่เติมค่าแล้ว', () => {
    const got = messageForCheck({ correct: true, attempts: 1 }, { nickname: 'บี' })
    expect(got.situation).toBe('correct-first')
    expect(got.text).toContain('บี')
  })

  it('ตอบผิดรอบ 2 กับรอบ 3 ได้คนละข้อความ', () => {
    const second = messageForCheck({ correct: false, attempts: 2 }).text
    const third = messageForCheck({ correct: false, attempts: 3 }).text
    expect(second).not.toBe(third)
  })

  it('ข้อความที่ส่งออกไม่มีสัญลักษณ์ค้างเลย', () => {
    for (const attempts of [1, 2, 3, 4]) {
      for (const correct of [true, false]) {
        const text = messageForCheck({ correct, attempts }).text ?? ''
        expect(text).not.toContain('{')
      }
    }
  })
})

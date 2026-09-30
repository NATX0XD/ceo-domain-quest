import { describe, expect, it } from 'vitest'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  genRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from './room-code'

/** ตัวอักษรที่เด็กหลังห้องอ่านจากจอโปรเจกเตอร์แล้วสับสน */
const CONFUSING = ['0', 'O', '1', 'I', 'L']

describe('สร้างรหัสห้องเรียน', () => {
  it('ได้รหัสยาว 6 ตัวเสมอ', () => {
    for (let i = 0; i < 50; i++) {
      expect(genRoomCode()).toHaveLength(ROOM_CODE_LENGTH)
    }
  })

  it('ไม่มีอักขระที่อ่านสับสน 0 O 1 I L เลย', () => {
    for (const ch of CONFUSING) {
      expect(ROOM_CODE_ALPHABET).not.toContain(ch)
    }
    const sample = Array.from({ length: 200 }, () => genRoomCode()).join('')
    for (const ch of CONFUSING) {
      expect(sample).not.toContain(ch)
    }
  })

  it('ใช้แต่ตัวพิมพ์ใหญ่กับตัวเลข จะได้พิมพ์ตามจากจอได้', () => {
    const code = genRoomCode()
    expect(code).toMatch(/^[A-Z2-9]{6}$/)
  })

  it('สุ่มได้ไม่ซ้ำกันในการเรียกติด ๆ กัน', () => {
    const codes = new Set(Array.from({ length: 200 }, () => genRoomCode()))
    expect(codes.size).toBeGreaterThan(190)
  })
})

describe('ทำรหัสห้องให้เป็นรูปแบบมาตรฐาน', () => {
  it('แปลงตัวพิมพ์เล็กเป็นตัวพิมพ์ใหญ่', () => {
    expect(normalizeRoomCode('ab3xy7')).toBe('AB3XY7')
  })

  it('ตัดช่องว่างหัวท้ายที่คีย์บอร์ดมือถือเติมมาให้', () => {
    expect(normalizeRoomCode('  ab3xy7 ')).toBe('AB3XY7')
  })
})

describe('ตรวจรูปแบบรหัสห้อง', () => {
  it('รหัสที่ระบบสร้างเองต้องผ่านเสมอ', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidRoomCode(genRoomCode())).toBe(true)
    }
  })

  it('รหัสที่พิมพ์เป็นตัวเล็กยังใช้ได้', () => {
    expect(isValidRoomCode('ab3xy7')).toBe(true)
  })

  it('ความยาวไม่ครบ 6 หรือมีอักขระต้องห้ามถูกปฏิเสธ', () => {
    expect(isValidRoomCode('AB3XY')).toBe(false)
    expect(isValidRoomCode('AB3XY77')).toBe(false)
    expect(isValidRoomCode('AB3XY0')).toBe(false)
    expect(isValidRoomCode('AB3X-7')).toBe(false)
  })
})

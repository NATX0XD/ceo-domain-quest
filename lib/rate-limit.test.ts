import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_ATTEMPTS, WINDOW_MS, attempt, clearAllAttempts, resetAttempts, sweepExpired } from './rate-limit'

/** เวลาอ้างอิงคงที่ จะได้ไม่ต้องรอจริง 10 นาที */
const T0 = 1_759_000_000_000

beforeEach(() => {
  clearAllAttempts()
})

describe('จำกัดการเดารหัส 5 ครั้งต่อ 10 นาที', () => {
  it('5 ครั้งแรกผ่าน และสิทธิ์ที่เหลือลดลงทีละ 1', () => {
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      const r = attempt('room-9:นิด', T0)
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBe(MAX_ATTEMPTS - i)
    }
  })

  it('ครั้งที่ 6 ถูกปฏิเสธ และไม่เหลือสิทธิ์', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) attempt('room-9:นิด', T0)
    const sixth = attempt('room-9:นิด', T0)
    expect(sixth.allowed).toBe(false)
    expect(sixth.remaining).toBe(0)
  })

  it('บอกเวลาที่จะปลดล็อกให้นักเรียนรู้ว่าต้องรอถึงเมื่อไหร่', () => {
    const first = attempt('room-9:นิด', T0)
    expect(first.resetAt).toBe(T0 + WINDOW_MS)
  })

  it('คนละชื่อเล่นนับแยกกัน ไม่โดนโทษข้ามคน', () => {
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) attempt('room-9:นิด', T0)
    expect(attempt('room-9:ก้อง', T0).allowed).toBe(true)
  })
})

describe('เพดานเฉพาะกิจของบาง key', () => {
  it('ส่ง max มาเองได้ เช่นการรับคนใหม่ทั้งห้องที่กดพร้อมกันต้นคาบ', () => {
    for (let i = 1; i <= 45; i++) {
      expect(attempt('join-room:QUEST9', T0, 45).allowed, `ครั้งที่ ${i}`).toBe(true)
    }
    expect(attempt('join-room:QUEST9', T0, 45).allowed).toBe(false)
  })

  it('ไม่ส่ง max มาก็ยังเป็น 5 ครั้งเหมือนเดิม ไม่กระทบตัวเรียกเดิม', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) attempt('resume:room-9:นิด', T0)
    expect(attempt('resume:room-9:นิด', T0).allowed).toBe(false)
  })
})

describe('หน้าต่างเวลาหมดแล้วเริ่มนับใหม่', () => {
  it('พอเลย 10 นาที กลับมาลองได้อีก', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) attempt('room-9:นิด', T0)
    expect(attempt('room-9:นิด', T0 + WINDOW_MS - 1).allowed).toBe(false)

    const after = attempt('room-9:นิด', T0 + WINDOW_MS)
    expect(after.allowed).toBe(true)
    expect(after.remaining).toBe(MAX_ATTEMPTS - 1)
  })

  it('ยังอยู่ในหน้าต่างเดิม เวลาปลดล็อกไม่ถูกเลื่อนออกไปเรื่อย ๆ', () => {
    attempt('room-9:นิด', T0)
    const second = attempt('room-9:นิด', T0 + 5 * 60 * 1000)
    expect(second.resetAt).toBe(T0 + WINDOW_MS)
  })
})

describe('ล้างตัวนับ', () => {
  it('เข้าสู่ระบบสำเร็จแล้วล้างโทษทิ้ง', () => {
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) attempt('room-9:นิด', T0)
    resetAttempts('room-9:นิด')
    expect(attempt('room-9:นิด', T0).allowed).toBe(true)
  })

  it('เก็บกวาดหน้าต่างที่หมดอายุ กันหน่วยความจำโตไม่หยุด', () => {
    attempt('room-9:นิด', T0)
    attempt('room-9:ก้อง', T0 + WINDOW_MS)
    expect(sweepExpired(T0 + WINDOW_MS)).toBe(1)
    expect(sweepExpired(T0 + WINDOW_MS)).toBe(0)
  })
})

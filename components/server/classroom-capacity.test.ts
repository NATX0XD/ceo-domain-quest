import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CAPACITY_ENV,
  DEFAULT_CLASSROOM_CAPACITY,
  classroomCapacity,
  roomSpaceOf,
} from './classroom-capacity'

/**
 * เพดานจำนวนนักเรียนต่อห้อง — กันคนที่รู้รหัสห้อง 6 ตัวยัดชื่อปลอมเข้ามาไม่จำกัด
 * (UAT-3 ช่องโหว่ข้อ 1) เทสต์ชุดนี้ล็อกสองเรื่องที่พลาดแล้วเจ็บ:
 * ค่าที่อ่านจาก env เพี้ยนแล้วกลายเป็น 0 (ห้องเข้าไม่ได้ทั้งห้อง) และเส้นแบ่ง "เต็ม" เลื่อนไป 1
 */
describe('เพดานจำนวนนักเรียนต่อห้อง', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ไม่ตั้ง env ก็ได้ค่าเริ่มต้นที่พอกับห้องจริง (20-40 คน)', () => {
    vi.stubEnv(CAPACITY_ENV, '')
    expect(classroomCapacity()).toBe(DEFAULT_CLASSROOM_CAPACITY)
    expect(DEFAULT_CLASSROOM_CAPACITY).toBeGreaterThanOrEqual(40)
  })

  it('ตั้ง env เป็นตัวเลขบวกแล้วใช้ค่านั้น', () => {
    vi.stubEnv(CAPACITY_ENV, '35')
    expect(classroomCapacity()).toBe(35)
  })

  it('env เพี้ยนต้องตกกลับไปใช้ค่าเริ่มต้น ห้ามกลายเป็น 0 จนทั้งห้องเข้าไม่ได้', () => {
    for (const bogus of ['', '0', '-5', 'abc', '3.5.1', ' ']) {
      vi.stubEnv(CAPACITY_ENV, bogus)
      expect(classroomCapacity(), `env=${JSON.stringify(bogus)}`).toBe(DEFAULT_CLASSROOM_CAPACITY)
    }
  })

  it('เพดานรายห้องที่ครูตั้งไว้มาก่อน env เสมอ', () => {
    vi.stubEnv(CAPACITY_ENV, '35')
    expect(classroomCapacity(12)).toBe(12)
    // ค่าที่ใช้ไม่ได้ (null / ศูนย์ / เศษส่วน) ต้องไม่ทำให้ห้องตัน
    expect(classroomCapacity(null)).toBe(35)
    expect(classroomCapacity(0)).toBe(35)
    expect(classroomCapacity(12.5)).toBe(35)
  })

  it('เต็มเมื่อจำนวนคนถึงเพดานพอดี ไม่ใช่เกินไปแล้ว 1 คน', () => {
    expect(roomSpaceOf(39, 40).full).toBe(false)
    expect(roomSpaceOf(40, 40).full).toBe(true)
    expect(roomSpaceOf(41, 40).full).toBe(true)
  })

  it('ที่ว่างที่เหลือไม่ติดลบ ห้องที่เกินเพดานอยู่แล้วจึงไม่ทำให้ตัวเลขบนจอครูเพี้ยน', () => {
    expect(roomSpaceOf(39, 40).remaining).toBe(1)
    expect(roomSpaceOf(60, 40).remaining).toBe(0)
  })

  it('ห้องที่เต็มพอดีไม่ใช่ห้องเก่าที่ล้นเพดาน — ต้องได้ข้อความ "ห้องเต็ม" ไม่ใช่ทางผ่อนผัน', () => {
    expect(roomSpaceOf(40, 40).legacyOverflow).toBe(false)
    expect(roomSpaceOf(41, 40).legacyOverflow).toBe(true)
    expect(roomSpaceOf(0, 40).legacyOverflow).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin, verifyPin } from './pin'

describe('ตรวจรูปแบบรหัส 4 หลัก', () => {
  it('ตัวเลข 4 หลักผ่าน รวมถึงที่ขึ้นต้นด้วยศูนย์', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('0000')).toBe(true)
    expect(isValidPin('0042')).toBe(true)
  })

  it('ปฏิเสธรหัสที่มีตัวอักษรปน สั้นไป หรือยาวไป', () => {
    expect(isValidPin('12a4')).toBe(false)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12345')).toBe(false)
  })

  it('ปฏิเสธช่องว่าง ค่าว่าง และเครื่องหมาย', () => {
    expect(isValidPin('')).toBe(false)
    expect(isValidPin('12 4')).toBe(false)
    expect(isValidPin(' 1234')).toBe(false)
    expect(isValidPin('12.4')).toBe(false)
  })
})

describe('เก็บรหัสเป็น hash ไม่เก็บตัวเลขตรง ๆ', () => {
  it('ค่าที่ได้ต้องไม่ใช่ PIN เดิม และต้องเป็น argon2', async () => {
    const hashed = await hashPin('1234')
    expect(hashed).not.toBe('1234')
    expect(hashed).not.toContain('1234')
    expect(hashed.startsWith('$argon2')).toBe(true)
  })

  it('PIN เดียวกันของนักเรียนคนละคนได้ hash ไม่เหมือนกัน', async () => {
    const a = await hashPin('1234')
    const b = await hashPin('1234')
    expect(a).not.toBe(b)
  })

  it('hash รหัสที่ผิดรูปแบบไม่ได้', async () => {
    await expect(hashPin('12a4')).rejects.toThrow()
  })
})

describe('ตรวจรหัสกับ hash ที่เก็บไว้', () => {
  it('รหัสถูกผ่าน', async () => {
    const hashed = await hashPin('4821')
    expect(await verifyPin('4821', hashed)).toBe(true)
  })

  it('รหัสผิดไม่ผ่าน', async () => {
    const hashed = await hashPin('4821')
    expect(await verifyPin('4822', hashed)).toBe(false)
    expect(await verifyPin('0000', hashed)).toBe(false)
  })

  it('รหัสผิดรูปแบบหรือ hash เสียหายคืน false ไม่โยน error', async () => {
    const hashed = await hashPin('4821')
    expect(await verifyPin('48a1', hashed)).toBe(false)
    expect(await verifyPin('4821', 'ของเสีย')).toBe(false)
  })
})

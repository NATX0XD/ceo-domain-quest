/**
 * รหัส 4 หลักของนักเรียน
 *
 * รหัสนี้ไม่ใช่รหัสผ่านหลัก (ตัวระบุตัวตนจริงคือ session cookie)
 * ใช้เฉพาะตอนย้ายเครื่องหรือเผลอล้างข้อมูลเบราว์เซอร์ — ดู docs/auth-and-roles.md หัวข้อ 4
 *
 * เก็บลงฐานข้อมูลต้อง hash เสมอ ห้ามเก็บเป็นตัวเลขตรง ๆ
 * เพราะมีความเป็นไปได้แค่ 10,000 แบบ ใครเปิดตารางดูก็เดาได้หมดทั้งห้อง
 */
import { hash, verify } from '@node-rs/argon2'

export const PIN_LENGTH = 4

/** ตัวเลขล้วน 4 หลักเป๊ะ ห้ามมีช่องว่าง ตัวอักษร หรือเครื่องหมาย */
const PIN_PATTERN = /^\d{4}$/

/**
 * พารามิเตอร์ argon2id ที่เบากว่าค่าเริ่มต้น
 * เพราะรหัสนี้เป็นตัวสำรอง ไม่ใช่กุญแจหลัก และเซิร์ฟเวอร์ต้องรับนักเรียนทั้งห้องเข้าพร้อมกันใน 5 นาที
 * ยังกันการไล่เดาแบบออฟไลน์ได้ เพราะมีชั้น rate limit คุมการลองผิดอยู่แล้ว (lib/rate-limit.ts)
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

export function isValidPin(raw: string): boolean {
  return PIN_PATTERN.test(raw)
}

/** แปลงรหัส 4 หลักเป็น hash สำหรับเก็บลงฐานข้อมูล */
export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error('รหัสต้องเป็นตัวเลข 4 หลักเท่านั้น')
  }
  return hash(pin, ARGON2_OPTIONS)
}

/**
 * ตรวจรหัสที่นักเรียนกรอกกับ hash ที่เก็บไว้
 * คืน false ทุกกรณีที่ตรวจไม่ผ่าน รวมถึงตอน hash ในฐานข้อมูลเสียหาย
 * จะได้ไม่มีข้อความ error รั่วออกไปบอกคนเดาว่าเดาใกล้แล้วหรือยัง
 */
export async function verifyPin(pin: string, hashed: string): Promise<boolean> {
  if (!isValidPin(pin)) return false
  try {
    return await verify(hashed, pin, ARGON2_OPTIONS)
  } catch {
    return false
  }
}

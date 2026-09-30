/**
 * ตัวนับการลองผิดในหน่วยความจำ — กันเพื่อนเดารหัส 4 หลักของกันเอง
 * ตาม docs/auth-and-roles.md หัวข้อ 5: ไม่เกิน 5 ครั้งต่อ 10 นาทีต่อชื่อเล่น
 *
 * เก็บในหน่วยความจำของ process เดียว พอสำหรับใช้ในคาบเรียนที่รันเซิร์ฟเวอร์ตัวเดียว
 * ถ้าวันหนึ่งขยายเป็นหลาย instance ต้องย้ายไปเก็บที่ฐานข้อมูลหรือ Redis แทน
 *
 * รับ now เป็นพารามิเตอร์เสมอ จะได้ทดสอบเวลาได้โดยไม่ต้องรอจริง 10 นาที
 */

export const MAX_ATTEMPTS = 5
export const WINDOW_MS = 10 * 60 * 1000

export interface AttemptResult {
  /** ให้ลองต่อได้หรือไม่ */
  allowed: boolean
  /** เหลือสิทธิ์ลองผิดอีกกี่ครั้งในหน้าต่างเวลานี้ */
  remaining: number
  /** เวลาที่หน้าต่างนี้จะหมด (epoch ms) ใช้บอกนักเรียนว่าให้รอถึงเมื่อไหร่ */
  resetAt: number
}

interface Bucket {
  count: number
  /** เวลาที่หน้าต่างปัจจุบันเริ่มนับ */
  startedAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * นับการลองใช้งาน 1 ครั้งของ key นั้น
 * เรียกทุกครั้งที่ "พยายาม" ไม่ใช่เฉพาะตอนผิด เพื่อให้จำนวนครั้งนับได้จริง
 *
 * @param key ตัวคั่นกลุ่ม เช่น `${classroomId}:${nickname}`
 * @param now เวลาปัจจุบันเป็น epoch ms
 * @param max เพดานของ key นี้ — ค่าเริ่มต้นคือ 5 ครั้งของการเดารหัส
 *            บาง key ไม่ใช่การเดารหัสจึงต้องใช้เพดานคนละตัว เช่นการรับคนใหม่ทั้งห้อง
 *            ซึ่งต้นคาบมีคนกดพร้อมกันทั้งห้องเป็นเรื่องปกติ (ดู app/api/join/route.ts)
 */
export function attempt(
  key: string,
  now: number = Date.now(),
  max: number = MAX_ATTEMPTS,
): AttemptResult {
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    buckets.set(key, { count: 1, startedAt: now })
    return { allowed: true, remaining: Math.max(0, max - 1), resetAt: now + WINDOW_MS }
  }

  const resetAt = bucket.startedAt + WINDOW_MS

  if (bucket.count >= max) {
    return { allowed: false, remaining: 0, resetAt }
  }

  bucket.count += 1
  return { allowed: true, remaining: max - bucket.count, resetAt }
}

/** ล้างตัวนับของ key นั้น เรียกเมื่อเข้าสู่ระบบสำเร็จ จะได้ไม่ค้างโทษไว้ */
export function resetAttempts(key: string): void {
  buckets.delete(key)
}

/** เก็บกวาดหน้าต่างที่หมดอายุแล้ว กัน Map โตไม่หยุดตอนเซิร์ฟเวอร์เปิดค้างทั้งเทอม */
export function sweepExpired(now: number = Date.now()): number {
  let removed = 0
  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= WINDOW_MS) {
      buckets.delete(key)
      removed += 1
    }
  }
  return removed
}

/** ล้างทั้งหมด — ใช้ในเทสต์เท่านั้น */
export function clearAllAttempts(): void {
  buckets.clear()
}

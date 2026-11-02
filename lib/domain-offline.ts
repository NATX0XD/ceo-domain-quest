import known from '../content/known-domains.json'

/**
 * ข้อมูลสำรองของเกมจดโดเมน m4 — ใช้เมื่อค้นออนไลน์ไม่ได้เท่านั้น
 * (registry จำกัดการเรียก ตอบช้าเกิน หรือนักเรียนค้นถี่เกินโควตา)
 *
 * รายชื่อมาจาก scripts/build-known-domains.mjs ที่ตรวจกับ RDAP จริงตามวันที่ checkedAt
 * - อยู่ใน registered = ถูกจดแล้ว
 * - อยู่ใน notFound = ตอนตรวจไม่พบการจด
 * - ไม่อยู่ในรายการ = ไม่รู้จริง ๆ แต่ตอบ "ไม่พบการจด" ให้เกมเดินต่อได้
 * หน้าจอไม่บอกนักเรียนว่าเป็นข้อมูลสำรอง (เจ้าของสั่ง) source: 'offline' มีไว้ให้ทีมตรวจย้อนหลังเท่านั้น
 * ⚠️ ยังห้ามใช้คำว่า "ว่าง" เหมือนผลจริง
 */
const registered = new Set<string>(known.registered)
const notFound = new Set<string>(known.notFound)

export const OFFLINE_CHECKED_AT = known.checkedAt

export type OfflineStatus = 'registered' | 'not-found'

export function offlineStatus(domain: string): { status: OfflineStatus; label: string } {
  const d = domain.toLowerCase()
  if (registered.has(d)) return { status: 'registered', label: 'ถูกจดแล้ว' }
  if (notFound.has(d)) return { status: 'not-found', label: 'ไม่พบการจด' }
  return { status: 'not-found', label: 'ไม่พบการจด' }
}

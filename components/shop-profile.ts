import { z } from 'zod'
import type { ShopProfile } from '@/core/tld-rules'

/**
 * โปรไฟล์ร้านของนักเรียน
 *
 * ⚠️ ห้ามเก็บใน sessionStorage/localStorage อีกต่อไป — ของเดิมเปิด DevTools แก้
 * `isRegisteredCompany` เป็น true แล้วยื่น .co.th ผ่านได้ทันที (รีวิว R2 หัวข้อ H1)
 * ตอนนี้โปรไฟล์อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น เบราว์เซอร์ส่งมาได้ครั้งเดียวตอนบันทึกที่ POST /api/profile
 * และทุกการตัดสินอ่านของจริงจากเซิร์ฟเวอร์ ไม่เชื่อค่าที่ส่งมาใน body อีก
 */
export interface StoredShopProfile extends ShopProfile {
  shopName: string
  businessTypeId: string
}

export const ShopProfileSchema = z.object({
  shopName: z.string().trim().min(1).max(60),
  businessTypeId: z.string().trim().min(1).max(40),
  domainName: z.string().trim().min(1).max(60),
  isRegisteredCompany: z.boolean(),
  audience: z.enum(['thai', 'international']),
})

export type ScaffoldLevel = 1 | 2 | 3

export const DEFAULT_SCAFFOLD_LEVEL: ScaffoldLevel = 2

export function isScaffoldLevel(value: unknown): value is ScaffoldLevel {
  return value === 1 || value === 2 || value === 3
}

/** แปลงค่าระดับตัวช่วยจาก query string — ใช้ได้เฉพาะตอนเปิดโหมดเดโม */
export function levelFromParam(value: string | undefined): ScaffoldLevel | null {
  const parsed = Number(value)
  return isScaffoldLevel(parsed) ? parsed : null
}

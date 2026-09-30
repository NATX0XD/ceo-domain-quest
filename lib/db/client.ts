// ⚠️ SERVER ONLY — ไฟล์นี้ถือ service_role key ซึ่ง bypass RLS ทั้งหมด
// ห้าม import จาก client component หรือไฟล์ที่ถูก bundle ไปฝั่ง browser เด็ดขาด
// (โปรเจกต์ยังไม่มี package `server-only` และห้ามแตะ package.json จึงใช้ guard ด้านล่างแทน)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

const BROWSER_LEAK_MESSAGE =
  'lib/db/client.ts ถูกโหลดในเบราว์เซอร์ — service_role key ห้ามหลุดฝั่ง client ใช้ได้เฉพาะใน API route / server action'

function assertServer(): void {
  if (typeof window !== 'undefined') {
    throw new Error(BROWSER_LEAK_MESSAGE)
  }
}

assertServer()

export type DbClient = SupabaseClient<Database>

let cached: DbClient | null = null

/**
 * Supabase client ฝั่งเซิร์ฟเวอร์ด้วย service_role (bypass RLS)
 * อ่าน env ตอนเรียก ไม่ใช่ตอน import — build ตอนไม่มี .env.local จึงไม่พัง
 */
export function getServiceClient(): DbClient {
  assertServer()
  if (cached) return cached

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('ไม่พบ env SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY (ดู .env.local)')
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'digital-biz-quest' } },
  })
  return cached
}

/**
 * ทิ้ง client ที่จำไว้ แล้วให้สร้างใหม่จาก env ปัจจุบัน
 *
 * @wired-optional ของสำรองสำหรับเทสต์/สคริปต์ที่สลับ SUPABASE_URL กลางคัน —
 * โค้ดที่รันจริงต่อฐานข้อมูลเดียวทั้ง process จึงไม่มีใครต้องเรียก และ **ไม่ควรมีใครเรียก**
 * (เรียกกลางคาบ = คำขอที่ค้างอยู่เปลี่ยนปลายทางกลางทาง)
 */
export function resetServiceClient(): void {
  cached = null
}

/**
 * client ด้วย anon key สำหรับ "ตรวจรหัสผ่านครู" ผ่าน Supabase Auth เท่านั้น
 * สร้างใหม่ทุกครั้งและไม่เก็บ session ไว้ใน process — กัน token ของครูคนหนึ่งค้างไปโผล่ที่ request ของอีกคน
 */
export function createAuthClient(): DbClient {
  assertServer()

  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('ไม่พบ env SUPABASE_URL หรือ SUPABASE_ANON_KEY (ดู .env.local)')
  }

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

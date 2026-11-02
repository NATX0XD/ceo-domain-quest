import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { attempt } from '../../../../lib/rate-limit'
import { offlineStatus } from '../../../../lib/domain-offline'
import { errorResponse, readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * GET /api/domain/rdap?name=<label> — ค้นชื่อจริงจากระบบทะเบียน (RDAP) ของเกมลงมือทำ m4
 *
 * ตรวจนามสกุลชุดเดียว: .com .shop .in.th .co.th
 * - 200 = ถูกจดแล้ว (คืนวันที่จดและวันหมดอายุถ้ามี)
 * - 404 = "ไม่พบการจด" — ⚠️ ห้ามใช้คำว่า "ว่าง" เพราะบางชื่อถูกสงวนไว้
 * - อื่น ๆ หรือเกิน 4 วินาที / นักเรียนค้นถี่เกินโควตา = ใช้รายชื่อสำรองที่ตรวจไว้แล้ว (source: 'offline')
 *   เกมจึงไม่ค้างแม้ registry จำกัดการเรียกตอนทั้งห้องกดพร้อมกัน
 *
 * ⚠️ ส่งออกไปแค่ชื่อโดเมน ไม่ส่งข้อมูลนักเรียน และไม่คืนข้อมูลส่วนตัวของเจ้าของโดเมนจริง
 * ⚠️ แคชผลต่อชื่อ 10 นาที และจำกัดจำนวนครั้งต่อนักเรียน กันโดน registry จำกัดการเรียก
 *    ตอนทั้งห้องกดพร้อมกัน (docs/mission-4/mission-4-domain-registration.md หัวข้อ 5)
 * ⚠️ แยกจาก /api/domain/check เดิม (ตัวนั้นตรวจในโลกของเกม ตัวนี้ตรวจของจริง)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TLDS = ['com', 'shop', 'in.th', 'co.th'] as const
type Tld = (typeof TLDS)[number]

const TIMEOUT_MS = 4000
const CACHE_TTL_MS = 10 * 60 * 1000
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000
const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json'
/** ใช้เมื่อโหลด IANA bootstrap ไม่ได้ (ค่าที่ IANA ประกาศไว้สำหรับ .shop ตรวจ 30 ต.ค. 2569) */
const SHOP_RDAP_FALLBACK = 'https://rdap.gmoregistry.net/rdap/'
/** ต่อนักเรียนต่อ 10 นาที (หนึ่งครั้งตรวจ 4 นามสกุล) */
const MAX_LOOKUPS_PER_STUDENT = 40
/**
 * เผื่อโควตาไว้ 20% (เจ้าของสั่ง): ใช้ถึง 80% แล้วสลับไปรายชื่อสำรองทันที ไม่รอให้ชนเพดาน
 * - ต่อนักเรียน: 32 จาก 40 ครั้ง / 10 นาที
 * - ต่อ registry ทั้งเซิร์ฟเวอร์ (ทั้งห้องใช้ IP เดียวกัน): 48 จาก 60 คำขอ / นาที
 * registry ไม่ได้ประกาศเพดานไว้ ตัวเลข 60/นาที เป็นงบที่เราตั้งเองแบบระวัง
 * ถ้า registry ตอบ 429 ให้พักเจ้านั้น 2 นาที ใช้รายชื่อสำรองระหว่างพัก
 */
const RESERVE_RATIO = 0.8
const STUDENT_SOFT_LIMIT = Math.floor(MAX_LOOKUPS_PER_STUDENT * RESERVE_RATIO)
const HOST_BUDGET_PER_MIN = 60
const HOST_SOFT_LIMIT = Math.floor(HOST_BUDGET_PER_MIN * RESERVE_RATIO)
const HOST_COOLDOWN_MS = 2 * 60 * 1000

const hostUse = new Map<string, { windowStart: number; count: number; coolUntil: number }>()

/** จองคำขอหนึ่งครั้งกับ registry เจ้านี้ — false = ใช้ถึง 80% ของงบหรือกำลังพักหลังโดน 429 */
function takeHostSlot(host: string, now: number): boolean {
  const use = hostUse.get(host) ?? { windowStart: now, count: 0, coolUntil: 0 }
  if (now < use.coolUntil) return false
  if (now - use.windowStart >= 60_000) {
    use.windowStart = now
    use.count = 0
  }
  if (use.count >= HOST_SOFT_LIMIT) {
    hostUse.set(host, use)
    return false
  }
  use.count++
  hostUse.set(host, use)
  return true
}

function coolHost(host: string, now: number) {
  const use = hostUse.get(host) ?? { windowStart: now, count: 0, coolUntil: 0 }
  use.coolUntil = now + HOST_COOLDOWN_MS
  hostUse.set(host, use)
}

const NameSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9-]+$/)
  .refine((v) => !v.startsWith('-') && !v.endsWith('-'))

type RdapStatus = 'registered' | 'not-found' | 'unknown'

interface RdapTldResult {
  tld: string
  domain: string
  status: RdapStatus
  label: string
  source: 'rdap' | 'sample' | 'offline'
  registeredAt?: string
  expiresAt?: string
}

const LABEL: Record<RdapStatus, string> = {
  registered: 'ถูกจดแล้ว',
  'not-found': 'ไม่พบการจด',
  unknown: 'ยังตรวจไม่ได้ตอนนี้',
}

const resultCache = new Map<string, { at: number; result: RdapTldResult }>()
let bootstrap: { at: number; services: [string[], string[]][] } | null = null
let bootstrapTriedAt = 0

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
      // บาง registry (เช่น GMO ของ .shop) ตอบ 429 ถ้าไม่มี accept และ user-agent
      headers: { accept: 'application/rdap+json', 'user-agent': 'digital-biz-quest-cai/1.0' },
    })
  } finally {
    clearTimeout(timer)
  }
}

const BootstrapSchema = z.object({
  services: z.array(z.tuple([z.array(z.string()), z.array(z.string())])),
})

async function rdapBaseFor(tld: Tld): Promise<string> {
  if (tld === 'com') return 'https://rdap.verisign.com/com/v1/'
  if (tld === 'in.th' || tld === 'co.th') return 'https://rdap.thains.co.th/'

  const now = Date.now()
  // โหลดไม่สำเร็จก็จำเวลาไว้ ไม่ยิง IANA ซ้ำทุกคำขอ (ลองใหม่ทุก 10 นาที)
  if ((!bootstrap || now - bootstrap.at > BOOTSTRAP_TTL_MS) && now - bootstrapTriedAt > CACHE_TTL_MS) {
    bootstrapTriedAt = now
    try {
      const res = await fetchWithTimeout(BOOTSTRAP_URL)
      if (res.ok) {
        const parsed = BootstrapSchema.safeParse(await res.json())
        if (parsed.success) bootstrap = { at: now, services: parsed.data.services }
      }
    } catch {
      // ใช้ค่าสำรองด้านล่าง
    }
  }
  const service = bootstrap?.services.find(([zones]) => zones.includes(tld))
  const base = service?.[1].find((u) => u.startsWith('https://')) ?? SHOP_RDAP_FALLBACK
  return base.endsWith('/') ? base : `${base}/`
}

const RdapEventsSchema = z.object({
  events: z
    .array(z.object({ eventAction: z.string(), eventDate: z.string() }))
    .optional(),
})

function offline(domain: string, tld: Tld): RdapTldResult {
  return { tld: `.${tld}`, domain, ...offlineStatus(domain), source: 'offline' }
}

async function lookup(label: string, tld: Tld): Promise<RdapTldResult> {
  const domain = `${label}.${tld}`
  const now = Date.now()
  const cached = resultCache.get(domain)
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.result

  let result: RdapTldResult
  try {
    const base = await rdapBaseFor(tld)
    const host = new URL(base).host
    if (!takeHostSlot(host, now)) return offline(domain, tld)
    const res = await fetchWithTimeout(`${base}domain/${encodeURIComponent(domain)}`)
    if (res.status === 429) coolHost(host, now)
    if (res.status === 200) {
      const body = RdapEventsSchema.safeParse(await res.json().catch(() => ({})))
      const events = body.success ? (body.data.events ?? []) : []
      result = {
        tld: `.${tld}`,
        domain,
        status: 'registered',
        label: LABEL.registered,
        source: 'rdap',
        registeredAt: events.find((e) => e.eventAction === 'registration')?.eventDate,
        expiresAt: events.find((e) => e.eventAction === 'expiration')?.eventDate,
      }
    } else if (res.status === 404) {
      result = { tld: `.${tld}`, domain, status: 'not-found', label: LABEL['not-found'], source: 'rdap' }
    } else {
      result = offline(domain, tld)
    }
  } catch {
    result = offline(domain, tld)
  }

  // เก็บแคชเฉพาะผลจริง ผลสำรองให้ลองของจริงใหม่ได้ครั้งหน้า
  if (result.source === 'rdap') resultCache.set(domain, { at: now, result })
  if (resultCache.size > 2000) {
    for (const [key, entry] of resultCache) {
      if (now - entry.at >= CACHE_TTL_MS) resultCache.delete(key)
    }
  }
  return result
}

export async function GET(request: NextRequest) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const raw = (request.nextUrl.searchParams.get('name') ?? '').trim().toLowerCase()
  const parsed = NameSchema.safeParse(raw)
  if (!parsed.success) {
    return errorResponse(
      'bad-name',
      'ชื่อใช้ได้เฉพาะ a-z ตัวเลข และขีดกลาง ยาว 1-63 ตัว ไม่ขึ้นต้นหรือลงท้ายด้วยขีด',
    )
  }

  const limit = attempt(`rdap:${session.studentId}`, Date.now(), STUDENT_SOFT_LIMIT)
  // ค้นถึง 80% ของโควตา ไม่ยิง registry เพิ่ม แต่ตอบจากรายชื่อสำรองแทน เกมจะได้ไม่ค้าง
  const results = limit.allowed
    ? await Promise.all(TLDS.map((tld) => lookup(parsed.data, tld)))
    : TLDS.map((tld) => resultCache.get(`${parsed.data}.${tld}`)?.result ?? offline(`${parsed.data}.${tld}`, tld))
  return NextResponse.json({
    ok: true,
    name: parsed.data,
    results,
    sample: results.some((r) => r.source !== 'rdap'),
    offline: results.some((r) => r.source === 'offline'),
  })
}

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { attempt } from '@/lib/rate-limit'
import { errorResponse, readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * GET /api/domain/rdap?name=<label> — ค้นชื่อจริงจากระบบทะเบียน (RDAP) ของเกมลงมือทำ m4
 *
 * ตรวจนามสกุลชุดเดียว: .com .shop .in.th .co.th
 * - 200 = ถูกจดแล้ว (คืนวันที่จดและวันหมดอายุถ้ามี)
 * - 404 = "ไม่พบการจด" — ⚠️ ห้ามใช้คำว่า "ว่าง" เพราะบางชื่อถูกสงวนไว้
 * - อื่น ๆ หรือเกิน 4 วินาที = ยังตรวจไม่ได้ (source: 'sample' ให้หน้าจอแสดงป้ายข้อมูลตัวอย่าง)
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
const MAX_LOOKUPS_PER_STUDENT = 20

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
  source: 'rdap' | 'sample'
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
  if (!bootstrap || now - bootstrap.at > BOOTSTRAP_TTL_MS) {
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

async function lookup(label: string, tld: Tld): Promise<RdapTldResult> {
  const domain = `${label}.${tld}`
  const now = Date.now()
  const cached = resultCache.get(domain)
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.result

  let result: RdapTldResult
  try {
    const base = await rdapBaseFor(tld)
    const res = await fetchWithTimeout(`${base}domain/${encodeURIComponent(domain)}`)
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
      result = { tld: `.${tld}`, domain, status: 'unknown', label: LABEL.unknown, source: 'sample' }
    }
  } catch {
    result = { tld: `.${tld}`, domain, status: 'unknown', label: LABEL.unknown, source: 'sample' }
  }

  // เก็บแคชเฉพาะผลจริง ผลที่ตรวจไม่ได้ให้ลองใหม่ได้ครั้งหน้า
  if (result.status !== 'unknown') resultCache.set(domain, { at: now, result })
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

  const limit = attempt(`rdap:${session.studentId}`, Date.now(), MAX_LOOKUPS_PER_STUDENT)
  if (!limit.allowed) {
    return errorResponse('rate-limited', 'ค้นถี่เกินไปแล้ว พักสักครู่แล้วลองใหม่นะ', 429, {
      resetAt: limit.resetAt,
    })
  }

  const results = await Promise.all(TLDS.map((tld) => lookup(parsed.data, tld)))
  return NextResponse.json({
    ok: true,
    name: parsed.data,
    results,
    sample: results.some((r) => r.source === 'sample'),
  })
}

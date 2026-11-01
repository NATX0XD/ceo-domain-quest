/**
 * Launch gate: ตัดสินว่าคำขอนี้ผ่านเข้าแอปได้ไหม (ฟังก์ชันล้วน ทดสอบได้ ไม่แตะ Next)
 * proxy.ts เรียกใช้ที่เดียว — ตั้ง APP_OPEN=true เมื่อพร้อมเปิดให้เล่นจริง
 *
 *  - APP_OPEN=true            เปิดปกติ
 *  - APP_OPEN ไม่ตั้ง         dev = เปิด, production = ปิด
 *  - ปิดอยู่                  หน้าเว็บทุกหน้า -> /landing, API -> 503 {error:'not-open'}
 *  - /preview?key=PREVIEW_KEY ตั้งคุกกี้ 7 วัน ให้เจ้าของ/ผู้ทดสอบใช้แอปเต็มบน production
 */

export const PREVIEW_COOKIE = 'dbq_preview'
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export type GateEnv = {
  appOpen?: string
  nodeEnv?: string
  previewKey?: string
}

export type GateDecision =
  | { type: 'next' }
  | { type: 'rewrite'; to: string }
  | { type: 'redirect'; to: string; setPreviewCookie?: string }
  | { type: 'json'; status: number; body: { error: string } }

export function isAppOpen(env: GateEnv): boolean {
  const flag = (env.appOpen ?? '').trim().toLowerCase()
  if (flag === 'true') return true
  if (flag === '') return env.nodeEnv !== 'production'
  return false
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** เทียบแบบเวลาคงที่ — ทั้งสองฝั่งเป็น hex ความยาวเท่ากันเสมอ */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** ค่าในคุกกี้ = HMAC ของ PREVIEW_KEY (ไม่ใช่ตัวคีย์เอง) — เปลี่ยนคีย์ = คุกกี้เก่าใช้ไม่ได้ */
export async function previewCookieValue(previewKey: string): Promise<string> {
  return hmacHex(previewKey, 'dbq-preview-cookie-v1')
}

export async function isValidPreviewKey(given: string | null | undefined, previewKey: string | undefined): Promise<boolean> {
  if (!previewKey || !given) return false
  // HMAC ทั้งคู่ก่อนเทียบ: ความยาวเท่ากันและไม่รั่วความยาวของคีย์จริง
  const [a, b] = await Promise.all([hmacHex(previewKey, 'dbq-preview-check'), hmacHex(given, 'dbq-preview-check')])
  return constantTimeEqual(a, b)
}

export async function hasValidPreviewCookie(cookie: string | undefined, previewKey: string | undefined): Promise<boolean> {
  if (!previewKey || !cookie) return false
  return constantTimeEqual(await previewCookieValue(previewKey), cookie)
}

const ALWAYS_OPEN_PAGES = ['/landing', '/landing/manual']
const TEACHER_SHARED_APIS = ['/api/plan-request', '/api/plan-request/respond', '/api/jobs/drain']
const STATIC_EXT = /\.[a-z0-9]{2,5}$/i

function isLandingPath(p: string) {
  return ALWAYS_OPEN_PAGES.some((base) => p === base || p.startsWith(`${base}/`))
}

function isTeacherPage(p: string) {
  return p === '/teacher' || p.startsWith('/teacher/')
}

function isTeacherApi(p: string) {
  return p === '/api/teacher' || p.startsWith('/api/teacher/') || TEACHER_SHARED_APIS.includes(p)
}

export async function decideGate(input: {
  pathname: string
  previewKeyParam?: string | null
  cookie?: string
  env: GateEnv
}): Promise<GateDecision> {
  const { pathname, env } = input
  const open = isAppOpen(env)

  if (pathname === '/preview' || pathname === '/preview/') {
    if (open) return { type: 'redirect', to: '/' }
    if (await isValidPreviewKey(input.previewKeyParam, env.previewKey)) {
      return { type: 'redirect', to: '/', setPreviewCookie: await previewCookieValue(env.previewKey as string) }
    }
    return { type: 'redirect', to: '/landing' }
  }

  if (open) return { type: 'next' }

  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico') return { type: 'next' }
  if (isLandingPath(pathname)) return { type: 'next' }
  if (isTeacherPage(pathname) || isTeacherApi(pathname)) return { type: 'next' }
  if (pathname === '/api/health') return { type: 'next' }

  if (await hasValidPreviewCookie(input.cookie, env.previewKey)) return { type: 'next' }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return { type: 'json', status: 503, body: { error: 'not-open' } }
  }
  // ไฟล์ static ใน public/ (รูป ฟอนต์ ไอคอน) — ต้องโหลดได้เพราะหน้า landing ใช้
  if (STATIC_EXT.test(pathname)) return { type: 'next' }

  return { type: 'rewrite', to: '/landing' }
}

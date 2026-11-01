import { describe, expect, it } from 'vitest'
import { decideGate, hasValidPreviewCookie, isAppOpen, previewCookieValue } from './launch-gate'

const prod = { nodeEnv: 'production', previewKey: 'secret-key' }

describe('isAppOpen', () => {
  it('APP_OPEN=true เปิดเสมอ', () => {
    expect(isAppOpen({ appOpen: 'true', nodeEnv: 'production' })).toBe(true)
  })
  it('ไม่ตั้ง: dev เปิด production ปิด', () => {
    expect(isAppOpen({ nodeEnv: 'development' })).toBe(true)
    expect(isAppOpen({ nodeEnv: 'production' })).toBe(false)
    expect(isAppOpen({ appOpen: '', nodeEnv: 'production' })).toBe(false)
  })
  it('ค่าอื่นที่ไม่ใช่ true = ปิด แม้ใน dev', () => {
    expect(isAppOpen({ appOpen: 'false', nodeEnv: 'development' })).toBe(false)
  })
})

describe('decideGate เมื่อปิด', () => {
  it('หน้าเว็บถูก rewrite ไป /landing', async () => {
    for (const pathname of ['/', '/join', '/teacher', '/mission/m1']) {
      expect(await decideGate({ pathname, env: prod })).toEqual({ type: 'rewrite', to: '/landing' })
    }
  })
  it('API ตอบ 503 not-open ยกเว้น health', async () => {
    expect(await decideGate({ pathname: '/api/me', env: prod })).toEqual({ type: 'json', status: 503, body: { error: 'not-open' } })
    expect((await decideGate({ pathname: '/api/teacher/x.json', env: prod })).type).toBe('json')
    expect(await decideGate({ pathname: '/api/health', env: prod })).toEqual({ type: 'next' })
  })
  it('landing และ asset ผ่าน', async () => {
    for (const pathname of ['/landing', '/landing/x', '/landing/manual', '/landing/manual/teacher', '/_next/static/a.js', '/favicon.ico', '/landing/hero.webp', '/dome/mascot/dome-greet.webp', '/robots.txt']) {
      expect(await decideGate({ pathname, env: prod })).toEqual({ type: 'next' })
    }
  })
  it('ชื่อที่ขึ้นต้นเหมือน landing แต่ไม่ใช่ ไม่ผ่าน', async () => {
    expect((await decideGate({ pathname: '/landingx', env: prod })).type).toBe('rewrite')
  })
})

describe('preview', () => {
  it('คีย์ถูก -> redirect / พร้อมคุกกี้ที่เป็น HMAC ไม่ใช่ตัวคีย์', async () => {
    const d = await decideGate({ pathname: '/preview', previewKeyParam: 'secret-key', env: prod })
    expect(d.type).toBe('redirect')
    if (d.type !== 'redirect') return
    expect(d.to).toBe('/')
    expect(d.setPreviewCookie).toBe(await previewCookieValue('secret-key'))
    expect(d.setPreviewCookie).not.toContain('secret-key')
  })
  it('คีย์ผิด/ว่าง/ไม่ตั้ง PREVIEW_KEY -> /landing ไม่มีคุกกี้', async () => {
    for (const [param, previewKey] of [['wrong', 'secret-key'], ['', 'secret-key'], [null, 'secret-key'], ['x', undefined], ['', undefined]] as const) {
      expect(await decideGate({ pathname: '/preview', previewKeyParam: param, env: { nodeEnv: 'production', previewKey } })).toEqual({ type: 'redirect', to: '/landing' })
    }
  })
  it('คุกกี้ถูก ผ่านทั้งหน้าและ API', async () => {
    const cookie = await previewCookieValue('secret-key')
    expect(await decideGate({ pathname: '/join', cookie, env: prod })).toEqual({ type: 'next' })
    expect(await decideGate({ pathname: '/api/me', cookie, env: prod })).toEqual({ type: 'next' })
  })
  it('คุกกี้ปลอม/ของคีย์เก่า ไม่ผ่าน', async () => {
    const old = await previewCookieValue('old-key')
    expect((await decideGate({ pathname: '/join', cookie: old, env: prod })).type).toBe('rewrite')
    expect((await decideGate({ pathname: '/api/me', cookie: 'secret-key', env: prod })).type).toBe('json')
    expect(await hasValidPreviewCookie('abc', undefined)).toBe(false)
  })
  it('เปิดอยู่แล้ว /preview -> /', async () => {
    expect(await decideGate({ pathname: '/preview', previewKeyParam: 'x', env: { appOpen: 'true', previewKey: 'k' } })).toEqual({ type: 'redirect', to: '/' })
  })
})

describe('decideGate เมื่อเปิด', () => {
  it('ผ่านทุกอย่าง', async () => {
    const env = { appOpen: 'true', nodeEnv: 'production' }
    for (const pathname of ['/', '/join', '/api/me', '/teacher']) {
      expect(await decideGate({ pathname, env })).toEqual({ type: 'next' })
    }
  })
  it('dev ไม่ตั้ง APP_OPEN = เปิด', async () => {
    expect(await decideGate({ pathname: '/api/me', env: { nodeEnv: 'development' } })).toEqual({ type: 'next' })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

/**
 * ระบบสำรองของเกมจดโดเมน m4 — ทดสอบด้วยการจำลองทั้งหมด
 * ⚠️ ห้ามทดสอบด้วยการยิง registry จริงถี่ ๆ (เป็นเซิร์ฟเวอร์ของคนอื่น) fetch ถูกแทนในเทสต์นี้ทุกครั้ง
 */
const mocks = vi.hoisted(() => ({ readStudentSession: vi.fn(), attempt: vi.fn() }))

vi.mock('../../_lib/session-cookie', () => ({
  readStudentSession: mocks.readStudentSession,
  unauthorized: (message = 'ต้องเข้าสู่ระบบก่อน') => NextResponse.json({ error: 'unauthorized', message }, { status: 401 }),
  errorResponse: (error: string, message: string, status = 400) => NextResponse.json({ error, message }, { status }),
}))
vi.mock('../../../../lib/rate-limit', () => ({ attempt: mocks.attempt }))
vi.mock('../../../../content/known-domains.json', () => ({
  default: { checkedAt: '2026-11-02', note: '', registered: ['testtaken.com'], notFound: ['testtaken.shop'] },
}))

const fetchMock = vi.fn()
const req = (name: string) => new NextRequest(`http://localhost/api/domain/rdap?name=${name}`)

let GET: typeof import('./route').GET

beforeEach(async () => {
  // โหลด route ใหม่ทุกข้อ ตัวนับงบ registry และแคชจะได้ไม่ค้างข้ามข้อ
  vi.resetModules()
  GET = (await import('./route')).GET
  mocks.readStudentSession.mockResolvedValue({ studentId: 's1' })
  mocks.attempt.mockReturnValue({ allowed: true, resetAt: 0 })
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('GET /api/domain/rdap ระบบสำรอง', () => {
  it('registry ตอบ 429 → ตอบจากรายชื่อสำรอง ไม่มีแถว unknown เกมไม่ค้าง', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429 }))
    const res = await GET(req('testtaken'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const com = body.results.find((r: { tld: string }) => r.tld === '.com')
    expect(com).toMatchObject({ status: 'registered', source: 'offline' })
    expect(body.results.every((r: { status: string }) => r.status !== 'unknown')).toBe(true)
    expect(body.offline).toBe(true)
  })

  it('registry ติดต่อไม่ได้ → ชื่อที่ไม่อยู่ในรายการตอบไม่พบการจด', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))
    const body = await (await GET(req('zzunlisted'))).json()
    expect(body.results.every((r: { status: string; label: string }) => r.status === 'not-found' && r.label === 'ไม่พบการจด')).toBe(true)
  })

  it('นักเรียนค้นเกินโควตา → ไม่ยิง registry เลย แต่ยังตอบ 200 จากรายชื่อสำรอง', async () => {
    mocks.attempt.mockReturnValue({ allowed: false, resetAt: Date.now() + 60_000 })
    const res = await GET(req('testtaken'))
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.results).toHaveLength(4)
  })

  it('registry ตอบ 429 ครั้งหนึ่ง → พักเจ้านั้น ครั้งถัดไปไม่ยิงซ้ำ', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429 }))
    await GET(req('first'))
    const calls = fetchMock.mock.calls.length
    await GET(req('second'))
    expect(fetchMock.mock.calls.length).toBe(calls)
  })

  it('ใช้ถึง 80% ของงบต่อ registry (48 จาก 60/นาที) แล้วหยุดยิง ใช้รายชื่อสำรองแทน', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 404 }))
    for (let i = 0; i < 60; i++) await GET(req(`name${i}`))
    const verisign = fetchMock.mock.calls.filter(([url]) => String(url).includes('verisign')).length
    expect(verisign).toBe(48)
  })

  it('registry ตอบ 200 → คืนวันที่และชื่อผู้รับจด (registrar) ไม่คืนข้อมูลเจ้าของ', async () => {
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          events: [
            { eventAction: 'registration', eventDate: '2019-03-12T00:00:00Z' },
            { eventAction: 'expiration', eventDate: '2027-03-12T00:00:00Z' },
          ],
          entities: [
            { roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'Owner Person']]] },
            { roles: ['registrar'], vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Example Registrar Co.']]] },
          ],
        }),
        { status: 200 },
      ),
    )
    const body = await (await GET(req('mockreg'))).json()
    const com = body.results.find((r: { tld: string }) => r.tld === '.com')
    expect(com).toMatchObject({ status: 'registered', source: 'rdap', registrar: 'Example Registrar Co.', expiresAt: '2027-03-12T00:00:00Z' })
    expect(JSON.stringify(body)).not.toContain('Owner Person')
  })

  it('ยังไม่เข้าห้อง → 401', async () => {
    mocks.readStudentSession.mockResolvedValue(null)
    expect((await GET(req('abc'))).status).toBe(401)
  })
})

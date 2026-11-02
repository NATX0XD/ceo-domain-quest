import { beforeEach, describe, expect, it, vi } from 'vitest'
import { certificateProgressOf } from '@/lib/certificate/progress'
import type { GameCertificateInput } from '@/lib/certificate/game'

/**
 * ดาวบน PDF ต้องเป็นเลขเดียวกับพรีวิว /result และ /home /rewards (lessonSummary().totalStars)
 * เคยพัง: PDF อ่าน profiles.earned_stars (14) แต่หน้าเว็บโชว์ 11
 */
const summary = {
  totalStars: 11,
  maxStars: 15,
  missions: [{ passed: true }, { passed: true }, { passed: true }, { passed: true }],
}
const captured: { input: GameCertificateInput | null } = { input: null }

vi.mock('@/app/api/_lib/session-cookie', async (orig) => ({
  ...(await orig<typeof import('@/app/api/_lib/session-cookie')>()),
  readStudentSession: async () => ({ studentId: 's1' }),
}))
vi.mock('@/lib/db/repo', () => ({
  getStudent: async () => ({ id: 's1', nickname: 'ทดสอบ' }),
  // ค่าเก่าที่ตามหลังอยู่ — ต้องไม่ถูกใช้
  getProfile: async () => ({ earned_stars: 14, business_name: 'ร้านเค้ก', domain_name: 'cake', goal_stars: 10 }),
  listMissionProgress: async () => [
    { mission_id: 'm1', passed_at: '2026-11-02', stars: 3, channel_used: 'card' },
    { mission_id: 'm2', passed_at: '2026-11-02', stars: 3, channel_used: 'card' },
    { mission_id: 'm3', passed_at: '2026-11-02', stars: 3, channel_used: 'card' },
    { mission_id: 'm4', passed_at: '2026-11-02', stars: 3, channel_used: 'card' },
  ],
  listSubmissions: async () => [{ emphasis_criterion: 'x', domain_name: 'cake', tld: '.com' }],
}))
vi.mock('@/components/server/certificate-eligibility', () => ({
  certificateEligibility: async () => ({ eligible: true, score: null }),
}))
vi.mock('@/components/server/lesson-progress', () => ({ lessonSummary: async () => summary }))
vi.mock('@/lib/certificate/font', () => ({ loadThaiFonts: async () => ({}) }))
vi.mock('@/lib/certificate/art', async (orig) => ({
  ...(await orig<typeof import('@/lib/certificate/art')>()),
  loadCertArt: async () => ({}),
}))
vi.mock('@/lib/certificate/game', async (orig) => ({
  ...(await orig<typeof import('@/lib/certificate/game')>()),
  renderGameCertificatePdf: (input: GameCertificateInput) => {
    captured.input = input
    return new Uint8Array([37, 80, 68, 70])
  },
}))

describe('/api/certificate stars', () => {
  beforeEach(() => {
    captured.input = null
  })

  it('PDF input uses the same stars/missions as the /result preview (lessonSummary)', async () => {
    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/certificate'))
    expect(res.status).toBe(200)
    const page = certificateProgressOf(summary) // สิ่งที่ /result ส่งเข้าพรีวิว
    expect(captured.input).toMatchObject(page)
    expect(captured.input?.starsTotal).toBe(11)
    expect(captured.input?.starsMax).toBe(15)
  })
})

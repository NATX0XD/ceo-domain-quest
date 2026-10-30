import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ getServiceClient: () => ({}) }))
vi.mock('@/content/learn-paths.json', async () => {
  const { readFileSync } = await import('node:fs')
  return { default: JSON.parse(readFileSync('content/learn-paths.json', 'utf8')) }
})
import { findLearnPath, scoreCardSort } from './learn-path'

const path = findLearnPath('m1')!

function place(ok: string[]) {
  const zones: Record<string, string> = { C01: 'ZONE_DOMAIN', C02: 'ZONE_DOMAIN', C03: 'ZONE_DNS', C04: 'ZONE_DNS' }
  return Object.fromEntries(
    Object.entries(zones).map(([id, z]) => [id, ok.includes(id) ? z : z === 'ZONE_DNS' ? 'ZONE_DOMAIN' : 'ZONE_DNS']),
  )
}

describe('scoreCardSort', () => {
  it('ถูกครบ = 100 ผ่าน', async () => {
    const r = await scoreCardSort(path, { placements: place(['C01', 'C02', 'C03', 'C04']) })
    expect(r.score).toBe(100)
    expect(r.passed).toBe(true)
    expect(r.detail.wrong).toEqual([])
  })
  it('C01+C03 = 70 ผ่าน', async () => {
    const r = await scoreCardSort(path, { placements: place(['C01', 'C03']) })
    expect(r.score).toBe(70)
    expect(r.passed).toBe(true)
  })
  it('C01+C02 = 50 ยังไม่ผ่าน และบอกการ์ดที่ผิด', async () => {
    const r = await scoreCardSort(path, { placements: place(['C01', 'C02']) })
    expect(r.score).toBe(50)
    expect(r.passed).toBe(false)
    expect(r.detail.wrong).toEqual(['C03', 'C04'])
  })
  it('payload ผิดรูปแบบ = โยน error', async () => {
    await expect(scoreCardSort(path, { nope: 1 })).rejects.toThrow()
  })
})

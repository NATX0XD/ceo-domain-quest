import { describe, expect, it } from 'vitest'
import known from '../content/known-domains.json'
import brands from '../content/known-brands.json'
import { offlineStatus } from '../lib/domain-offline'

/**
 * content/known-domains.json — รายชื่อสำรองของเกมจดโดเมน m4 (สร้างจาก scripts/build-known-domains.mjs)
 * ใช้ตอนค้น RDAP จริงไม่ได้ เกมต้องเดินต่อได้เสมอ
 */
const TLD = /\.(com|shop|in\.th|co\.th)$/

describe('known-domains.json รายชื่อสำรอง m4', () => {
  it('มีวันที่ตรวจ และทุกชื่อเป็นตัวพิมพ์เล็ก ลงท้ายด้วย 4 นามสกุลของเกม', () => {
    expect(known.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    for (const d of [...known.registered, ...known.notFound]) {
      expect(d).toBe(d.toLowerCase())
      expect(d).toMatch(TLD)
    }
  })

  it('ชื่อเดียวกันไม่อยู่ทั้งสองฝั่ง', () => {
    const reg = new Set(known.registered)
    expect(known.notFound.filter((d) => reg.has(d))).toEqual([])
  })

  it('ชื่อที่ถูกจดตอบ registered ชื่อที่ไม่อยู่ในรายการตอบ not-found ให้เกมเดินต่อ', () => {
    const taken = known.registered[0]
    if (taken) expect(offlineStatus(taken.toUpperCase()).status).toBe('registered')
    expect(offlineStatus('zz-not-in-list-qa.in.th')).toEqual({ status: 'not-found', label: 'ไม่พบการจด' })
  })

  it('known-brands.json: แบรนด์ดังที่ไม่อยู่ในรายชื่อตรวจแล้วถือว่าถูกจด เช่น apple', () => {
    expect(brands.brands).toContain('apple')
    const unlisted = brands.brands.flatMap((b) => [`${b}.co.th`, `${b}.in.th`]).find((d) => !known.registered.includes(d) && !known.notFound.includes(d))
    if (unlisted) expect(offlineStatus(unlisted).status).toBe('registered')
  })
})

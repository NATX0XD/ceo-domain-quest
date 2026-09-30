import { describe, expect, it } from 'vitest'
import {
  ALT_ITEM_STARS,
  ALT_OFFER_AFTER_ATTEMPTS,
  altAnswerOutcome,
  altItemForMission,
  altItemForTask,
  missionsWithAltItem,
  shouldOfferAltItem,
} from './alt-item'
import { coachThresholds } from './personalize'

const MISSIONS = ['m1', 'm2', 'm3', 'm4']

describe('กติกาที่อ่านจากไฟล์เนื้อหา ไม่ฝังเลขในโค้ด', () => {
  it('ดาวของข้อสำรองเท่ากับดาวต่ำสุดของการผ่าน (เท่ากับตอนครูกดให้ผ่าน)', () => {
    expect(ALT_ITEM_STARS).toBe(1)
  })

  it('เกณฑ์ "ติดแล้ว" ใช้ชุดเดียวกับธงเตือนครูระดับส้ม', () => {
    expect(ALT_OFFER_AFTER_ATTEMPTS).toBe(coachThresholds.levels.orange.attempts)
    expect(ALT_OFFER_AFTER_ATTEMPTS).toBeGreaterThan(0)
  })

  it('ทุกภารกิจย่อยมีข้อสำรองที่พร้อมใช้จริง', () => {
    expect(missionsWithAltItem(MISSIONS)).toEqual(MISSIONS)
    for (const missionId of MISSIONS) {
      const found = altItemForMission(missionId)
      expect(found?.altItemId).toMatch(/-alt$/)
      expect(altItemForTask(found!.task.id)).toBe(found!.altItemId)
    }
  })

  it('ภารกิจที่ไม่มีอยู่จริง ไม่มีข้อสำรอง และไม่พัง', () => {
    expect(altItemForMission('ไม่มีภารกิจนี้')).toBeNull()
    expect(altItemForTask('ไม่มีโจทย์นี้')).toBeNull()
  })
})

describe('เมื่อไรถึงเสนอข้อสำรอง', () => {
  const base = { missionId: 'm1', attempts: 0 }

  it('ยังลองไม่ถึงเกณฑ์ ไม่เสนอ แต่ขอเองได้', () => {
    const out = shouldOfferAltItem({ ...base, attempts: ALT_OFFER_AFTER_ATTEMPTS - 1 })
    expect(out.offer).toBe(false)
    expect(out.reason).toBe('not-stuck-yet')
    expect(out.canRequest).toBe(true)
  })

  it('ลองครบตามเกณฑ์แล้วยังไม่ผ่าน = เสนอ พร้อมบอกจำนวนดาวล่วงหน้า', () => {
    const out = shouldOfferAltItem({ ...base, attempts: ALT_OFFER_AFTER_ATTEMPTS })
    expect(out.offer).toBe(true)
    expect(out.reason).toBe('stuck')
    expect(out.altItemId).toMatch(/-alt$/)
    expect(out.starsIfPassed).toBe(ALT_ITEM_STARS)
    expect(out.message).toContain(`${ALT_ITEM_STARS} ดาว`)
  })

  it('ใช้คำใบ้ครบทุกระดับแล้วยังไม่ผ่าน ก็ถือว่าติดแล้ว แม้ลองไม่ถึงเกณฑ์', () => {
    const out = shouldOfferAltItem({ ...base, attempts: 1, hintsExhausted: true })
    expect(out.offer).toBe(true)
    expect(out.reason).toBe('stuck')
  })

  it('ผ่านภารกิจแล้ว ไม่เสนอ และไม่ต้องมีปุ่มขอ', () => {
    const out = shouldOfferAltItem({ ...base, attempts: 9, passed: true })
    expect(out.offer).toBe(false)
    expect(out.reason).toBe('already-passed')
    expect(out.canRequest).toBe(false)
  })

  it('ทำข้อสำรองไปแล้ว ไม่เสนอซ้ำ', () => {
    const out = shouldOfferAltItem({ ...base, attempts: 9, altAnswered: true })
    expect(out.reason).toBe('already-used')
    expect(out.canRequest).toBe(false)
  })
})

describe('เป็นข้อเสนอ ไม่ใช่การบังคับ', () => {
  const stuck = { missionId: 'm2', attempts: ALT_OFFER_AFTER_ATTEMPTS }

  it('ปฏิเสธแล้วต้องไม่ยัดเยียดซ้ำ — หน้าจอกลับไปทำข้อเดิมต่อได้', () => {
    const out = shouldOfferAltItem({ ...stuck, declined: true })
    expect(out.offer).toBe(false)
    expect(out.reason).toBe('declined-by-student')
  })

  it('ปฏิเสธไปแล้วก็ยังขอเองได้ทีหลัง ไม่ได้ถูกปิดประตู', () => {
    const declined = shouldOfferAltItem({ ...stuck, declined: true })
    expect(declined.canRequest).toBe(true)

    const asked = shouldOfferAltItem({ ...stuck, declined: true, requested: true })
    expect(asked.offer).toBe(true)
    expect(asked.reason).toBe('student-asked')
  })

  it('ขอเองได้ตั้งแต่ยังไม่ติด ไม่ต้องรอให้ตอบผิดครบก่อน', () => {
    const out = shouldOfferAltItem({ missionId: 'm3', attempts: 0, requested: true })
    expect(out.offer).toBe(true)
    expect(out.reason).toBe('student-asked')
  })

  it('ข้อความชวนต้องบอกทางเลือกทั้งสองทาง และไม่ตำหนิ', () => {
    const message = shouldOfferAltItem({ ...stuck }).message
    expect(message).toContain('ข้อเดิม')
    expect(message).toContain('เลือกเอง')
    for (const word of ['ไม่ได้', 'ทำไม่เป็น', 'ง่ายกว่าเพราะ', 'อ่อน', 'ยอมแพ้']) {
      expect(message).not.toContain(word)
    }
  })

  it('เรียกซ้ำด้วยสถานะเดิมได้ผลเดิมทุกครั้ง ไม่มีการสุ่ม', () => {
    const first = shouldOfferAltItem({ ...stuck })
    for (let i = 0; i < 20; i += 1) expect(shouldOfferAltItem({ ...stuck })).toEqual(first)
  })

  it('attempts เพี้ยนถือเป็น 0 ไม่ใช่พัง', () => {
    for (const attempts of [-5, Number.NaN, undefined as unknown as number]) {
      expect(shouldOfferAltItem({ missionId: 'm1', attempts }).reason).toBe('not-stuck-yet')
    }
  })
})

describe('ผลของการตอบข้อสำรอง', () => {
  it('ตอบถูก = ผ่านด้วย 1 ดาว และใช้ข้อความ "ผ่านด้วยข้อสำรอง"', () => {
    const out = altAnswerOutcome(true)
    expect(out).toEqual({
      passed: true,
      stars: ALT_ITEM_STARS,
      situation: 'passed-via-alt',
      viaAltItem: true,
    })
  })

  it('ตอบยังไม่ถูก = ไม่ผ่าน ไม่หักอะไร และไม่นับว่าใช้ทางสำรองไปแล้ว', () => {
    const out = altAnswerOutcome(false)
    expect(out.passed).toBe(false)
    expect(out.stars).toBe(0)
    expect(out.viaAltItem).toBe(false)
  })
})

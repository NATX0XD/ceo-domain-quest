import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BUSINESS_KIND_IDS,
  SHOP_PHOTO_KINDS,
  SHOP_STAGE_MAX,
  STAGE_REVEAL,
  businessKindFrom,
  shopPhotoSrc,
  shopStageFromCleared,
  type ShopStageLevel,
} from './shop-art'

/**
 * คุมของ 4 อย่างของภาพร้าน
 *  1. ประเภทที่ประกาศว่า "มีภาพต้นฉบับ" ต้องมีไฟล์จริงในดิสก์ — ประกาศเกินแล้วรูปจะแตกบนจอเด็ก
 *  2. ประเภทที่ยังไม่มีภาพต้องคืน null เพื่อให้ตกไปใช้ฉาก SVG ไม่ใช่กล่องว่าง
 *  3. สัดส่วนการเผยต้องไล่จากน้อยไปมาก และจบที่เต็มใบ ไม่งั้นร้านจะ "ถอยหลัง" ตอนผ่านด่าน
 *  4. การแปลงด่านที่ผ่านเป็นขั้นของภาพต้องไม่หลุดช่วง 0-5 ไม่ว่าจะป้อนอะไรเข้ามา
 */

const LEVELS: ShopStageLevel[] = [0, 1, 2, 3, 4, 5]
const PUBLIC_DIR = resolve(__dirname, '..', 'public')

describe('ภาพร้าน — ภาพต้นฉบับกับไฟล์จริง', () => {
  it('ทุกประเภทที่ประกาศว่ามีภาพ ต้องมีไฟล์อยู่จริงและเบาพอ', () => {
    expect(SHOP_PHOTO_KINDS.length).toBeGreaterThan(0)
    let total = 0
    for (const kind of SHOP_PHOTO_KINDS) {
      const src = shopPhotoSrc(kind)
      expect(src, `${kind} ประกาศว่ามีภาพแต่ shopPhotoSrc คืน null`).not.toBeNull()
      const file = resolve(PUBLIC_DIR, src!.replace(/^\//, ''))
      expect(existsSync(file), `ไม่พบไฟล์ ${src}`).toBe(true)
      // ภาพถูกย่อเหลือ 512px แล้ว ไฟล์ละไม่ควรเกิน 200KB ไม่งั้นมือถือโหลดช้า
      const bytes = statSync(file).size
      expect(bytes, `${src} เป็นไฟล์เปล่า`).toBeGreaterThan(1000)
      expect(bytes, `${src} ใหญ่เกินไป (${bytes} ไบต์)`).toBeLessThan(200_000)
      total += bytes
    }
    // รวมทุกใบต้องไม่เกิน 3MB ตามที่เจ้าของกำหนด
    expect(total, `ภาพร้านรวมกัน ${total} ไบต์`).toBeLessThan(3_000_000)
  })

  it('ทุกคู่ (ประเภท × ขั้น) มีทางออกเสมอ ไม่มีคู่ไหนไม่มีอะไรให้วาด', () => {
    for (const kind of BUSINESS_KIND_IDS) {
      const src = shopPhotoSrc(kind)
      // มีภาพ = ใช้ภาพเผยทีละส่วน · ไม่มีภาพ = ตกไปใช้ฉาก SVG ซึ่งรองรับครบ 6 ขั้นอยู่แล้ว
      expect(src === null || src === `/shop/${kind}.jpg`).toBe(true)
      for (const level of LEVELS) {
        expect(typeof STAGE_REVEAL[level]).toBe('number')
      }
    }
  })

  it('ประเภทที่ยังไม่มีภาพคืน null เพื่อให้ตกไปใช้ฉาก SVG', () => {
    for (const kind of BUSINESS_KIND_IDS) {
      const has = SHOP_PHOTO_KINDS.includes(kind)
      expect(shopPhotoSrc(kind) === null).toBe(!has)
    }
  })
})

describe('ภาพร้าน — สัดส่วนการเผย', () => {
  it('ไล่จากไม่เผยเลยไปจนเต็มใบ และไม่ถอยหลัง', () => {
    expect(STAGE_REVEAL[0]).toBe(0)
    expect(STAGE_REVEAL[5]).toBe(1)
    expect(STAGE_REVEAL[4]).toBe(1)
    for (let i = 1; i <= SHOP_STAGE_MAX; i += 1) {
      const prev = STAGE_REVEAL[(i - 1) as ShopStageLevel]
      const now = STAGE_REVEAL[i as ShopStageLevel]
      expect(now, `ขั้น ${i} เผยน้อยกว่าขั้นก่อน`).toBeGreaterThanOrEqual(prev)
      expect(now).toBeLessThanOrEqual(1)
    }
  })
})

describe('ภาพร้าน — การแปลงด่านเป็นขั้น', () => {
  it('อยู่ในช่วง 0 ถึง 5 เสมอ ไม่ว่าจะป้อนอะไร', () => {
    const inputs = [-5, 0, 1, 3, 5, 99, Number.NaN, Number.POSITIVE_INFINITY]
    for (const n of inputs) {
      const level = shopStageFromCleared(n)
      expect(level).toBeGreaterThanOrEqual(0)
      expect(level).toBeLessThanOrEqual(SHOP_STAGE_MAX)
    }
  })

  it('ผ่านครบทุกด่าน = ขั้นสูงสุด · ยังไม่ผ่านเลย = ขั้น 0', () => {
    expect(shopStageFromCleared(0, 5)).toBe(0)
    expect(shopStageFromCleared(5, 5)).toBe(5)
    // จำนวนด่านเปลี่ยนก็ยังเกลี่ยให้เต็มขั้นสุดท้าย
    expect(shopStageFromCleared(4, 4)).toBe(5)
  })

  it('รหัสประเภทที่ไม่รู้จักตกมาที่ประเภทกลาง ๆ ไม่ใช่ค่าว่าง', () => {
    expect(businessKindFrom(null)).toBe('food')
    expect(businessKindFrom('')).toBe('food')
    expect(businessKindFrom('ไม่มีประเภทนี้')).toBe('food')
    expect(businessKindFrom('bakery')).toBe('bakery')
  })
})

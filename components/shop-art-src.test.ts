import { describe, expect, it } from 'vitest'
import {
  BUSINESS_KIND_IDS,
  shopArtFallbackSrc,
  shopArtSrc,
  shopArtStageClamp,
  shopArtStageFromLevel,
} from './shop-art'

describe('shopArtSrc', () => {
  it('ประเภทที่รู้จักได้ไฟล์ของประเภทนั้นตามขั้น', () => {
    for (const id of BUSINESS_KIND_IDS) {
      expect(shopArtSrc(id, 3)).toBe(`/ui/home/shop/${id}-3.webp`)
    }
  })

  it('ประเภทไม่รู้จักหรือยังไม่เลือก ใช้ภาพกลาง', () => {
    expect(shopArtSrc('', 2)).toBe('/ui/home/shop-stage-2.webp')
    expect(shopArtSrc(null, 1)).toBe('/ui/home/shop-stage-1.webp')
    expect(shopArtSrc(undefined, 5)).toBe('/ui/home/shop-stage-5.webp')
    expect(shopArtSrc('../etc', 1)).toBe('/ui/home/shop-stage-1.webp')
  })

  it('ขั้นถูกบีบไว้ที่ 1–5', () => {
    expect(shopArtSrc('game', 0)).toBe('/ui/home/shop/game-1.webp')
    expect(shopArtSrc('game', 9)).toBe('/ui/home/shop/game-5.webp')
    expect(shopArtFallbackSrc(Number.NaN)).toBe('/ui/home/shop-stage-1.webp')
    expect(shopArtStageClamp(-3)).toBe(1)
  })

  it('ขั้นภาพ = ด่านที่ผ่าน + 1 (เหมือนหน้า /home เดิม)', () => {
    expect([0, 1, 2, 3, 4, 5].map(shopArtStageFromLevel)).toEqual([1, 2, 3, 4, 5, 5])
  })
})

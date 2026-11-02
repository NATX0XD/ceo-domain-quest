/**
 * ข้อมูลล้วนของภาพร้าน — **ไม่มี JSX และไม่ import อะไรเลย**
 *
 * แยกออกมาจาก `shop-stages.tsx` เพราะเทสต์ต้องอ่านตารางนี้ได้โดยไม่ต้องลาก
 * component ของหน้าจอทั้งกองเข้ามา (ชุดเทสต์ไม่ได้ตั้ง alias `@/` ไว้)
 */

export const SHOP_STAGE_MAX = 5

/** 0 = ยังไม่ผ่านด่านไหนเลย · 5 = ผ่านครบทุกด่าน */
export type ShopStageLevel = 0 | 1 | 2 | 3 | 4 | 5

/** รหัสประเภทธุรกิจ — ตรงกับ `content/business-types.json` */
export type BusinessKindId =
  | 'bakery'
  | 'clothes'
  | 'coffee'
  | 'secondhand'
  | 'phone-repair'
  | 'flower'
  | 'food'
  | 'game'

export const BUSINESS_KIND_IDS: readonly BusinessKindId[] = [
  'bakery',
  'clothes',
  'coffee',
  'secondhand',
  'phone-repair',
  'flower',
  'food',
  'game',
]

/**
 * แปลง "ด่านที่ผ่านจริง" เป็นขั้นของภาพ — หนึ่งด่านต่อหนึ่งขั้นตรง ๆ
 * ถ้าวันหน้าจำนวนด่านเปลี่ยน (`total` ไม่ใช่ 5) จะเกลี่ยให้พอดี 0–5 ให้เอง
 */
export function shopStageFromCleared(
  cleared: number,
  total: number = SHOP_STAGE_MAX,
): ShopStageLevel {
  if (!Number.isFinite(cleared) || cleared <= 0) return 0
  const safeTotal = Number.isFinite(total) && total > 0 ? total : SHOP_STAGE_MAX
  const scaled = Math.round((Math.min(cleared, safeTotal) / safeTotal) * SHOP_STAGE_MAX)
  return Math.min(SHOP_STAGE_MAX, Math.max(0, scaled)) as ShopStageLevel
}

/** รหัสที่ไม่รู้จัก (หรือยังไม่ได้เลือก) ตกมาที่ร้านกลาง ๆ ไม่ใช่จอว่าง */
export function businessKindFrom(value: string | null | undefined): BusinessKindId {
  return BUSINESS_KIND_IDS.includes(value as BusinessKindId) ? (value as BusinessKindId) : 'food'
}

/* ── ภาพต้นฉบับ (AI) ประเภทละ 1 ใบ ────────────────────────────────────────────

   ## ทำไมใบเดียวต่อประเภท ไม่ใช่ 6 ใบ

   รอบแรกลองยิง FLUX แยกทีละขั้น (48 ใบ) แล้วพบว่า **ได้ร้านคนละหลังทุกใบ**
   เพราะ FLUX schnell เป็น text-to-image ล้วน ไม่มี seed และไม่มี image-to-image
   จะสั่งให้ "หลังเดิมที่สร้างต่อ" ด้วยข้อความอย่างเดียวไม่ได้ (ขั้น 3 ออกมาเป็นบ้านสองชั้น
   ขั้น 5 เป็นซุ้มเล็ก) เจ้าของจึงเลือกวิธีนี้แทน

   **ยิงแค่ร้านที่เสร็จแล้วประเภทละ 1 ใบ → ขั้น 0-4 สร้างจากใบเดียวกันนั้น**
   ด้วยการเผยภาพจากล่างขึ้นบนตาม `STAGE_REVEAL` แล้ววางนั่งร้าน/กรวย/ผ้าคลุมเป็น SVG ทับ
   ผลคือทุกขั้นเป็นร้านหลังเดียวกัน 100% และใช้โควตา AI แค่ 8 ใบ

   ไฟล์อยู่ที่ `public/shop/<ประเภท>.jpg` ย่อ 512px บีบเหลือใบละ ~28-45KB
   มีเทสต์ `components/shop-stages.test.ts` คุมว่าไฟล์ที่ประกาศไว้มีอยู่จริงทุกใบ           */

/** ประเภทที่มีภาพต้นฉบับแล้ว — ประเภทที่ไม่อยู่ในนี้ตกไปใช้ฉาก SVG ทั้งฉาก */
export const SHOP_PHOTO_KINDS: readonly BusinessKindId[] = [
  'bakery',
  'clothes',
  'coffee',
  'secondhand',
  'phone-repair',
  'flower',
  'food',
  'game',
]

/** ภาพต้นฉบับของประเภทนี้ — คืน null เมื่อยังไม่มีภาพ ให้ผู้เรียกวาด SVG แทน */
export function shopPhotoSrc(kind: BusinessKindId): string | null {
  return SHOP_PHOTO_KINDS.includes(kind) ? `/shop/${kind}.jpg` : null
}

/**
 * สัดส่วนที่เผยภาพต้นฉบับในแต่ละขั้น — วัดจาก **ขอบล่างของภาพขึ้นไป**
 *
 * 0 = ยังไม่เผยเลย (เห็นแต่ลานเปล่ากับกองวัสดุที่วาดเป็น SVG)
 * 1 = เห็นภาพเต็มใบ
 *
 * ค่าเหล่านี้เจ้าของกำหนดเอง และตรงกับสัดส่วนจริงในภาพชุดนี้
 * (ฐาน/พื้นร้านอยู่ราว 22% ล่าง · แนวผนังจบราว 40% · สันหลังคาราว 15% บน)
 */
export const STAGE_REVEAL: Record<ShopStageLevel, number> = {
  0: 0,
  1: 0.35,
  2: 0.6,
  3: 0.85,
  4: 1,
  5: 1,
}

/* ── ภาพร้านหน้า /home แยกตามประเภท 5 ขั้น ────────────────────────────────────
   ไฟล์ `public/ui/home/shop/<ประเภท>-<ขั้น>.webp` (720×720 โปร่งใส)
   ประเภทไหนยังไม่มีไฟล์ → ใช้ภาพกลาง `public/ui/home/shop-stage-<ขั้น>.webp` แทน
   (ฝั่งเซิร์ฟเวอร์เช็กไฟล์ด้วย `components/server/shop-art-file.ts`
    ฝั่งเบราว์เซอร์สลับเองตอนโหลดไม่ขึ้นด้วย `components/shop-art-img.tsx`)          */

export type ShopArtStage = 1 | 2 | 3 | 4 | 5

/** ขั้นภาพ 1–5 — ค่าแปลก ๆ (NaN, ติดลบ, เกิน) ถูกบีบเข้าช่วง */
export function shopArtStageClamp(stage: number): ShopArtStage {
  if (!Number.isFinite(stage)) return 1
  return Math.min(SHOP_STAGE_MAX, Math.max(1, Math.round(stage))) as ShopArtStage
}

/** ขั้นภาพของหน้า /home: ยังไม่ผ่านด่านไหน = ขั้น 1 แล้วโตทีละขั้นตามด่านที่ผ่าน */
export function shopArtStageFromLevel(level: number): ShopArtStage {
  return shopArtStageClamp((Number.isFinite(level) ? level : 0) + 1)
}

/** ภาพร้านกลาง (ไม่แยกประเภท) — ใช้เป็นภาพสำรองเสมอ */
export function shopArtFallbackSrc(stage: number): string {
  return `/ui/home/shop-stage-${shopArtStageClamp(stage)}.webp`
}

/** ภาพร้านของประเภทนี้ที่ขั้นนี้ — ประเภทที่ไม่รู้จัก/ยังไม่เลือก คืนภาพกลาง */
export function shopArtSrc(typeId: string | null | undefined, stage: number): string {
  if (!BUSINESS_KIND_IDS.includes(typeId as BusinessKindId)) return shopArtFallbackSrc(stage)
  return `/ui/home/shop/${typeId}-${shopArtStageClamp(stage)}.webp`
}

import { shopArtSrc } from '@/components/shop-art'

/**
 * เลือกภาพร้านตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ — ภาพครบทั้ง 8 ประเภท × 5 ขั้นใน public/ui/home/shop/ แล้ว
 * จึงคืนพาธตรง ๆ ไม่เช็กไฟล์บนดิสก์ (บน Vercel ไฟล์ใน public/ ไม่ได้แพ็กไปกับฟังก์ชัน การเช็กจะพลาด)
 * ประเภทที่ไม่รู้จักหรือยังไม่เลือก shopArtSrc คืนภาพกลางให้เอง
 */
export function resolveShopArt(typeId: string | null | undefined, stage: number): string {
  return shopArtSrc(typeId, stage)
}

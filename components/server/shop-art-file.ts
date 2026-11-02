import { existsSync } from 'node:fs'
import path from 'node:path'
import { shopArtFallbackSrc, shopArtSrc } from '@/components/shop-art'

/**
 * เลือกภาพร้านตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ — มีไฟล์ของประเภทนั้นจริงค่อยใช้ ไม่มีก็ใช้ภาพกลาง
 * (img onError ไม่ทำงานกับรูปที่เรนเดอร์จากเซิร์ฟเวอร์ก่อน hydrate จึงต้องเช็กที่นี่)
 * เจอไฟล์แล้วจำไว้ตลอด · ไม่เจอจำไว้แค่ 60 วินาที เพราะภาพชุดใหม่ทยอยเข้ามา
 */
const MISS_TTL_MS = 60_000
const found = new Set<string>()
const missedAt = new Map<string, number>()

function publicFileExists(src: string): boolean {
  if (found.has(src)) return true
  const missed = missedAt.get(src)
  if (missed !== undefined && Date.now() - missed < MISS_TTL_MS) return false
  const ok = existsSync(path.join(process.cwd(), 'public', ...src.split('/').filter(Boolean)))
  if (ok) {
    found.add(src)
    missedAt.delete(src)
  } else {
    missedAt.set(src, Date.now())
  }
  return ok
}

export function resolveShopArt(typeId: string | null | undefined, stage: number): string {
  const src = shopArtSrc(typeId, stage)
  return publicFileExists(src) ? src : shopArtFallbackSrc(stage)
}

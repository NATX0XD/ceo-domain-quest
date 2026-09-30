import { createAiClient } from '@/lib/ai'
import type { AiMeta } from '@/lib/ai/types'

/**
 * ตัวเชื่อมชั้น AI เข้ากับ API route — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * กติกาที่ห้ามผิด:
 * 1. มีคีย์ AI แล้ว (GEMINI_API_KEY / TYPHOON_API_KEY ใน .env.local — ห้ามพิมพ์ค่าออกมาที่ไหนทั้งสิ้น)
 *    แต่ถ้าโมเดลล่ม ช้าเกิน 5 วินาที โควตาหมด หรือคีย์หาย ทุกอย่างตกไปทาง fallback แบบกฎล้วน
 *    **นั่นคือผลที่ถูกต้อง ไม่ใช่ error** ห้าม throw ห้ามขึ้นข้อความ error ให้นักเรียนเห็น
 *    เน็ตโรงเรียนไม่แน่นอน เส้นทางกฎล้วนคือเส้นทางหลักที่ต้องเดินได้เสมอ
 * 2. ทุก response ที่ส่งกลับหน้าเว็บต้องมี source ('ai' | 'fallback') ติดไปด้วยเสมอ
 *    ครูต้องแยกออกว่าอันไหนโมเดลเสนอ อันไหนกฎในโค้ดเสนอ
 * 3. คะแนนจาก AI เป็น "ข้อเสนอ" ครูยืนยันเสมอ (needsTeacherConfirm เป็น true ตลอดตามสัญญาของ lib/ai)
 */
export const ai = createAiClient()

export interface AiSourceInfo {
  source: AiMeta['source']
  provider: AiMeta['provider']
  fallbackReason: AiMeta['fallbackReason']
}

export function sourceInfo(meta: AiMeta): AiSourceInfo {
  return {
    source: meta.source,
    provider: meta.provider,
    fallbackReason: meta.fallbackReason,
  }
}

/** ป้ายภาษาไทยสั้น ๆ ไว้โชว์บนหน้าจอครู */
export function sourceLabel(info: AiSourceInfo): string {
  if (info.source === 'ai') return `AI เสนอ (${info.provider})`
  const why =
    info.fallbackReason === 'no-api-key'
      ? 'ยังไม่ได้ใส่คีย์ AI'
      : info.fallbackReason === 'quota-exceeded'
        ? 'ใช้โควตา AI ครบแล้ว'
        : info.fallbackReason === 'timeout'
          ? 'AI ตอบช้าเกิน 5 วินาที'
          : info.fallbackReason === 'bad-response'
            ? 'AI ตอบผิดรูปแบบ'
            : info.fallbackReason === 'request-failed'
              ? 'เรียก AI ไม่สำเร็จ'
              : 'ไม่ได้เรียก AI'
  return `กฎในโค้ดเสนอ (${why})`
}

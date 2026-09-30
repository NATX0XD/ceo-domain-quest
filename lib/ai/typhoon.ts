/**
 * ผู้ให้บริการที่ 1 — Typhoon (โมเดลภาษาไทย) ใช้ endpoint แบบ OpenAI-compatible
 *
 * key อ่านจาก process.env.TYPHOON_API_KEY เท่านั้น
 * ห้ามตั้งชื่อ env ขึ้นต้นด้วย NEXT_PUBLIC_ เพราะ Next จะฝังค่าลงไฟล์ฝั่งเบราว์เซอร์ให้ทุกคนอ่านได้
 *
 * ไฟล์นี้ "ยิงแล้วพังก็โยน error ออกไป" ไม่จัดการ fallback เอง
 * คนตัดสินใจว่าจะตกไปใช้ทางสำรองหรือไม่คือ lib/ai/index.ts ที่เดียว
 */
import type { PromptSpec } from './prompts'

export const TYPHOON_BASE_URL = 'https://api.opentyphoon.ai/v1'
/**
 * รุ่นที่ใช้ — ตรวจกับ GET https://api.opentyphoon.ai/v1/models เมื่อ 29 กันยายน 2569
 * คีย์ของโปรเจกต์นี้เรียกได้เฉพาะ typhoon-v2.5-30b-a3b-instruct สำหรับงานแชท
 * (typhoon-v2.1-12b-instruct ที่เอกสารเคยแนะนำ ตอบกลับมาว่า "Model not found" แล้ว)
 */
export const TYPHOON_DEFAULT_MODEL = 'typhoon-v2.5-30b-a3b-instruct'

export interface ProviderCallOptions {
  apiKey: string
  fetchImpl: typeof fetch
  signal?: AbortSignal
  model?: string
  baseUrl?: string
}

/** ดึงเฉพาะก้อน JSON ออกจากข้อความ เผื่อโมเดลห่อด้วย ```json */
export function extractJson(raw: string): unknown {
  const text = (raw ?? '').trim()
  const fenced = text.replace(/^```(?:json)?/i, '').replace(/```$/, '')
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('โมเดลไม่ได้ตอบกลับเป็น JSON')
  }
  return JSON.parse(fenced.slice(start, end + 1))
}

/**
 * เรียก Typhoon แล้วคืนค่า JSON ที่โมเดลตอบ
 * โยน error เมื่อ HTTP ไม่ผ่าน หรือเนื้อหาที่ได้ไม่ใช่ JSON
 */
export async function callTyphoon(
  prompt: PromptSpec,
  options: ProviderCallOptions,
): Promise<unknown> {
  const url = `${options.baseUrl ?? TYPHOON_BASE_URL}/chat/completions`

  const response = await options.fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? TYPHOON_DEFAULT_MODEL,
      temperature: 0.4,
      // ให้คะแนนรายด้าน 4 ด้านพร้อมหลักฐานและข้อเสนอแนะ กินโทเคนมากกว่าคำใบ้สั้น ๆ
      // ตั้งต่ำกว่านี้แล้ว JSON จะถูกตัดกลางคัน แล้ว parse ไม่ผ่าน
      max_tokens: 1400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`Typhoon ตอบกลับมาเป็นสถานะ ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('Typhoon ตอบกลับมาโดยไม่มีเนื้อหา')
  }

  return extractJson(content)
}

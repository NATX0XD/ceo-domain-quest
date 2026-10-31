/**
 * ผู้ให้บริการที่ 2 — Gemini ใช้ structured output บังคับรูปแบบ JSON
 *
 * key อ่านจาก process.env.GEMINI_API_KEY เท่านั้น
 * ห้ามตั้งชื่อ env ขึ้นต้นด้วย NEXT_PUBLIC_ เพราะจะหลุดไปฝั่งเบราว์เซอร์
 *
 * เหมือน typhoon.ts คือพังแล้วโยน error ออกไป ไม่ตัดสินใจเรื่องทางสำรองเอง
 */
import type { PromptSpec } from './prompts'
import { ProviderHttpError, type ProviderCallOptions, extractJson } from './typhoon'

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
/**
 * รุ่นที่ใช้ — เลือกจาก **โควตา RPM ของ free tier** ไม่ใช่ความเก่งของโมเดล
 *
 * ตัวเลขจากหน้า Rate limits ของบัญชีจริง (29 กันยายน 2569):
 *   สาย Flash (3.8 / 3.7 / 3.6 / 3.5 / 3 / 2.5) = **5 RPM**  ← 3.8 Flash ใช้ไป 6/5 แล้ว ติด 429 อยู่
 *   สาย Flash Lite (3.5 / 3.1)                  = **15 RPM** ← มากกว่า 3 เท่า
 *   TPM ของทั้งสองสาย = 250K ซึ่งเหลือเฟือ คอขวดคือ RPM ล้วน ๆ
 *
 * งานของเราคือคำใบ้สั้น ๆ กับให้คะแนนตามรูบริกที่บังคับรูปแบบ JSON ไว้แล้ว
 * Flash Lite เพียงพอ และโควตาสูงกว่าสำคัญกว่าความเก่งของรุ่นในห้องเรียน 30 คน
 * ทับได้จาก env GEMINI_MODEL เมื่อเปิด billing แล้วอยากย้ายไปรุ่นใหญ่
 */
export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash-lite'

/**
 * เรียก Gemini แบบบังคับ responseSchema เพื่อให้ได้ JSON ตามรูปแบบเดียวกับฝั่ง Typhoon
 * ใส่ key ไว้ใน header ไม่ใส่ใน query string จะได้ไม่ติดไปกับ log ของ proxy
 */
export async function callGemini(
  prompt: PromptSpec,
  options: ProviderCallOptions,
): Promise<unknown> {
  const model = options.model ?? GEMINI_DEFAULT_MODEL
  const url = `${options.baseUrl ?? GEMINI_BASE_URL}/models/${model}:generateContent`

  const response = await options.fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': options.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: prompt.schema,
      },
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    let errorStatus: string | undefined
    try {
      const body = (await response.clone().json()) as { error?: { status?: unknown } }
      if (typeof body.error?.status === 'string') errorStatus = body.error.status
    } catch {
      // Keep diagnostics limited to HTTP metadata when the body is not JSON.
    }
    throw new ProviderHttpError(response.status, errorStatus)
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Gemini ตอบกลับมาโดยไม่มีเนื้อหา')
  }

  return extractJson(text)
}

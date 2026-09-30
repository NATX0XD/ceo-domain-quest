/**
 * เวลาตอบจริงของผู้ให้บริการแต่ละเจ้าต่อชนิดงาน — **วัดเอง ไม่ใช่เดา**
 *
 * วัดเมื่อ 30 กันยายน 2569 ยิงตรงไปที่ผู้ให้บริการ ไม่ผ่านลูกโซ่และไม่ผ่านคิว
 * งานละ 3 ครั้งต่อเจ้า เว้น 4.5 วินาทีระหว่างครั้ง ใช้ **มัธยฐาน** เป็นค่าตั้งต้น
 *
 * | งาน | Typhoon (มัธยฐาน / ที่วัดได้) | Gemini (มัธยฐาน / ที่วัดได้) |
 * |---|---|---|
 * | hint     |    811 ms  [1048, 811, 784]       | 1,020 ms [954, 1020, 1056] |
 * | grade    | 13,304 ms  [14759, 13304, 10471]  | 2,240 ms [2331, 2043, 2240] |
 * | customer |    938 ms  [690, 1268, 938]       | 1,017 ms [1017, 1229, 889] |
 * | story    |  9,281 ms  [11113, 9281, 8335]    | 2,934 ms [2758, 3020, 2934] |
 *
 * อ่านตัวเลขนี้ยังไง
 * - งานสั้น (คำใบ้ ลูกค้าจำลอง) สองเจ้าพอ ๆ กัน ต่างกันไม่ถึง 300 ms
 * - งานยาวที่ต้องตอบ JSON หลายชั้น (ตรวจงาน แต่งเรื่อง) **Gemini เร็วกว่า 4-6 เท่า**
 *   เพราะบังคับรูปแบบด้วย responseSchema ได้ ส่วน Typhoon ต้องไล่เขียนจนจบแล้วเราค่อยแกะ JSON
 * - Typhoon เคยวัดได้ ~9.7 วินาทีเมื่อ 29 ก.ย. รอบนี้ 13.3 วินาที **ช้าลงอีก** ค่าจึงต้องอยู่ในโค้ด
 *   ที่แก้ได้ ไม่ใช่ตัวเลขในคอมเมนต์
 *
 * ทับค่าได้จาก env เมื่อผู้ให้บริการเปลี่ยนความเร็ว เช่น `AI_LATENCY_TYPHOON_GRADE=8000`
 * จะได้ไม่ต้องแก้โค้ดกลางคาบ
 */
import type { AiProvider } from './types'

export type MeasurableProvider = Exclude<AiProvider, 'rules'>
export type AiTaskId = 'hint' | 'grade' | 'customer' | 'story'

/** มัธยฐานที่วัดได้จริง 30 กันยายน 2569 (มิลลิวินาที) */
export const MEASURED_LATENCY_MS: Record<MeasurableProvider, Record<AiTaskId, number>> = {
  typhoon: { hint: 811, grade: 13_304, customer: 938, story: 9_281 },
  gemini: { hint: 1_020, grade: 2_240, customer: 1_017, story: 2_934 },
}

/**
 * เผื่อความแกว่งจากค่ามัธยฐานเท่าไร
 *
 * ค่าที่วัดได้แกว่งมากสุดคือ Typhoon งาน grade (10.4 – 14.8 วินาที = +11% จากมัธยฐาน)
 * ตั้ง 1.35 จึงครอบค่าที่เคยเห็นทั้งหมดโดยไม่กินงบเผื่อจนเกินจำเป็น
 */
export const LATENCY_SAFETY = 1.35

function envKey(provider: MeasurableProvider, task: AiTaskId): string {
  return `AI_LATENCY_${provider.toUpperCase()}_${task.toUpperCase()}`
}

/**
 * เวลาที่ **ควรเผื่อ** ให้เจ้านี้ทำงานนี้จนจบ (มัธยฐาน × ตัวเผื่อ)
 * ใช้ตัดสิน 2 เรื่อง: จัดลำดับลูกโซ่ และตัดสินว่างบที่เหลือพอให้เจ้านี้ได้ลองจริงไหม
 */
export function expectedLatencyMs(
  provider: MeasurableProvider,
  task: AiTaskId,
  env: Record<string, string | undefined> = {},
): number {
  const override = Number(env?.[envKey(provider, task)])
  if (Number.isFinite(override) && override > 0) return Math.round(override)
  return Math.round(MEASURED_LATENCY_MS[provider][task] * LATENCY_SAFETY)
}

/**
 * งบเวลาที่เหลือพอให้เจ้านี้ได้ลองจริงไหม
 *
 * **หัวใจของ T61**: เดิมทุกเจ้าถูกยิงเสมอแม้เวลาที่เหลือไม่มีทางพอ
 * ผลคือเผางบไปครึ่งหนึ่งกับเจ้าที่รู้อยู่แล้วว่าตอบไม่ทัน แล้วเจ้าที่ตอบทันไม่เหลือเวลา
 */
export function fitsBudget(
  provider: MeasurableProvider,
  task: AiTaskId,
  budgetMs: number,
  env: Record<string, string | undefined> = {},
): boolean {
  return expectedLatencyMs(provider, task, env) <= budgetMs
}

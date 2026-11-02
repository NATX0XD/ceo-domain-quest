/**
 * ตรวจคำตอบปลายเปิดของเส้นทางเรียนด้วย AI — แกะผลและทางสำรอง
 *
 * ไฟล์นี้ไม่ยิงเน็ตเอง ลูกโซ่ผู้ให้บริการอยู่ที่ lib/ai/index.ts ที่เดียว
 * ผลของโมเดลถูกตรวจด้วย zod ทุกครั้ง รูปแบบเพี้ยน = โยน error ให้ลูกโซ่ลองเจ้าถัดไปหรือใช้กฎล้วน
 */
import { z } from 'zod'
import { sanitizeStudentAnswer } from './prompts'
import { answerIsFutureScope, guardAiText, topicKeywords } from './topic-lock'
import type {
  AiProvider,
  FallbackReason,
  LearnCheckInput,
  LearnCheckItemResult,
  LearnCheckResult,
} from './types'

/** ความยาวคำแนะนำสูงสุดที่ยอมแสดง ยาวกว่านี้ตัดทิ้งแล้วใช้ข้อความจากไฟล์เฉลยแทน */
export const LEARN_FEEDBACK_MAX = 200

/**
 * คำตัดสินที่ห้ามขึ้นจอผู้เรียน (ตรงกับกติกาถ้อยคำใน core/content-audit.test.ts)
 * จับ "ตก" เฉพาะรูปที่เป็นคำตัดสิน ไม่จับ แตกต่าง / แชตกับ
 */
const VERDICT = /(สอบตก|ตกแล้ว|ตกซ้ำ|คุณตก|เธอตก|ล้มเหลว|ไม่ผ่าน|ผิดหมด|ไม่เก่ง|(^|\s)ตก($|\s))/

const RawSchema = z.object({
  results: z.array(z.unknown()),
})

const RawItemSchema = z.object({
  id: z.string(),
  concepts: z.array(z.object({ quote: z.string(), covered: z.boolean() })),
  feedback: z.string().optional(),
})

/** เทียบข้อความแบบไม่สนช่องว่างและตัวพิมพ์ — เหมือน normalizeAnswer ของฝั่งคำสำคัญ */
function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

/** หลักฐานสั้นสุดที่ยอมรับ (ตัวอักษรหลังตัดช่องว่าง) กันโมเดลยกคำเดียวลอย ๆ มาอ้าง */
const EVIDENCE_MIN_CHARS = 2

/**
 * แนวคิดจะนับว่าครอบคลุมได้ **ต่อเมื่อโมเดลยกข้อความที่มีอยู่จริงในคำตอบมาอ้าง**
 * กันทั้งโมเดลใจดีเกิน (เดาแทนนักเรียน) และคำสั่งแทรกที่สั่งให้ตอบ true ทั้งหมดโดยไม่มีเนื้อหา
 */
function verifiedCovered(concepts: { quote: string; covered: boolean }[], answer: string): boolean[] {
  const haystack = squash(sanitizeStudentAnswer(answer))
  return concepts.map(({ quote, covered }) => {
    if (!covered) return false
    const needle = squash(sanitizeStudentAnswer(quote))
    return needle.length >= EVIDENCE_MIN_CHARS && haystack.includes(needle)
  })
}

/** ข้อมูลส่วนตัวที่ห้ามขึ้นจอ: อีเมล เบอร์โทร (เลข 9 หลักขึ้นไป) ลิงก์ที่เหลือหลังตัด markdown */
const PII = /([\w.+-]+@[\w-]+\.[\w.]+|(?:\d[\s-]?){9,}|https?:\/\/|www\.)/i

/** ตัด markdown และลิงก์ออก เหลือข้อความล้วนสำหรับบับเบิลแชต */
export function stripMarkdown(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // [ข้อความ](ลิงก์) → ข้อความ
    .replace(/https?:\/\/\S+|www\.\S+/gi, '') // ลิงก์เปล่า
    .replace(/[*_`~#>|]+/g, '') // ตัวหนา/เอียง/โค้ด/หัวข้อ/อ้างอิง
    .replace(/^\s*[-+]\s+/gm, '') // หัวข้อย่อย
}

export function safeLearnFeedback(text: string | undefined): string | null {
  const clean = stripMarkdown(text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length === 0 || clean.length > LEARN_FEEDBACK_MAX) return null
  if (VERDICT.test(clean)) return null
  if (PII.test(clean)) return null
  return clean
}

/**
 * แปลงผลดิบของโมเดลเป็นผลรายข้อ — รับเฉพาะข้อที่ตรงกับที่ถามจริงและ covered ยาวพอดี
 * ไม่ได้สักข้อ = โยน error (ลูกโซ่จะลองเจ้าถัดไป)
 */
export function parseLearnCheck(
  raw: unknown,
  input: LearnCheckInput,
  provider: Exclude<AiProvider, 'rules'>,
): LearnCheckResult {
  const parsed = RawSchema.safeParse(raw)
  if (!parsed.success) throw new Error('โมเดลไม่ได้ตอบกลับเป็น JSON ที่ใช้ได้')

  const wanted = new Map(input.items.map((item) => [item.id, item]))
  const items: LearnCheckItemResult[] = []
  for (const row of parsed.data.results) {
    const item = RawItemSchema.safeParse(row)
    if (!item.success) continue
    const asked = wanted.get(item.data.id)
    if (!asked || item.data.concepts.length !== asked.concepts.length) continue
    if (items.some((done) => done.id === item.data.id)) continue
    const covered = answerIsFutureScope(input.missionId, asked.answer)
      ? item.data.concepts.map(() => false)
      : verifiedCovered(item.data.concepts, asked.answer)
    // หลักฐานไม่จริงสักแนวคิด = คำแนะนำของโมเดลอาจชมเกินจริง ใช้ข้อความจากไฟล์เฉลยแทน
    const downgraded = covered.some((hit, i) => hit !== item.data.concepts[i]!.covered)
    const feedback = safeLearnFeedback(item.data.feedback)
    items.push({
      id: item.data.id,
      covered,
      feedback: downgraded || !feedback ? null : guardAiText(feedback, topicKeywords(`${asked.question} ${asked.concepts.join(' ')}`), ''),
    })
  }
  if (items.length === 0) throw new Error('โมเดลไม่ได้ตอบกลับเป็น JSON ที่ใช้ได้')

  return { items, source: 'ai', provider, fallbackReason: null }
}

export function fallbackLearnCheck(fallbackReason: FallbackReason = 'no-api-key'): LearnCheckResult {
  return { items: [], source: 'fallback', provider: 'rules', fallbackReason }
}

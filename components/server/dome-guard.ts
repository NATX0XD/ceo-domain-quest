/**
 * ตัวกันเฉลยหลุดจากคำตอบของโดม (ฝั่งเซิร์ฟเวอร์เท่านั้น)
 * อ่านข้อความอธิบายเฉลยจาก content/*-answers.json แล้วเทียบกับคำตอบของโมเดล
 * ถ้าโมเดลคัดลอกประโยคเฉลยมาตรง ๆ (ต่อเนื่อง 30 ตัวอักษรขึ้นไป) หรือบอก "คำตอบคือข้อ N" ให้ถือว่าหลุด
 * ห้าม import จาก client component และห้ามส่งค่าที่อ่านได้ออกไปที่หน้าจอ
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WINDOW = 30
const DIRECT_ANSWER = /(คำตอบ(ที่ถูก)?|ข้อที่ถูก|ตอบ)\s*(คือ|ได้แก่)?\s*(ข้อ|ตัวเลือก)\s*[0-9๑-๙กขคงabcd]\b/i

let cache: string[] | null = null

function collectExplanations(node: unknown, out: string[]): void {
  if (Array.isArray(node)) return node.forEach((n) => collectExplanations(n, out))
  if (typeof node !== 'object' || node === null) return
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key.startsWith('_')) continue
    if ((key === 'explanation' || key === 'orderNote' || key === 'text') && typeof value === 'string') {
      const clean = value.replace(/\s+/g, ' ').trim()
      if (clean.length >= WINDOW) out.push(clean)
    } else collectExplanations(value, out)
  }
}

function loadAnswerTexts(): string[] {
  if (cache) return cache
  const out: string[] = []
  for (const file of ['missions-answers.json', 'check-questions-answers.json']) {
    try {
      collectExplanations(JSON.parse(readFileSync(join(process.cwd(), 'content', file), 'utf8')), out)
    } catch {
      // ไฟล์อ่านไม่ได้ = ไม่มีอะไรให้เทียบ ตัวกันรูปแบบ "คำตอบคือข้อ N" ยังทำงาน
    }
  }
  cache = out
  return out
}

/** เฉพาะเทสต์: ใส่ข้อความเฉลยปลอมเพื่อพิสูจน์ว่าตัวกันจับได้ */
export function setAnswerTextsForTest(texts: string[] | null): void {
  cache = texts
}

export function leaksAnswer(reply: string): boolean {
  const flat = reply.replace(/\s+/g, ' ')
  if (DIRECT_ANSWER.test(flat)) return true
  for (const answer of loadAnswerTexts()) {
    for (let i = 0; i + WINDOW <= answer.length; i += 6) {
      if (flat.includes(answer.slice(i, i + WINDOW))) return true
    }
  }
  return false
}

/**
 * ชนิดข้อมูลของเกมลงมือทำ ด่าน 3 (เคาน์เตอร์รับจดโดเมน)
 * ใช้ร่วมกันทั้งฝั่ง client (counter-game.tsx) และ server (server/learn-counter.ts)
 * ⚠️ ไฟล์นี้มีแค่ type ห้ามใส่เฉลย
 */

export const COUNTER_CATEGORIES = ['gTLD ทั่วไป', 'ccTLD ไทย', 'หมวดเฉพาะที่สงวน'] as const
export type CounterCategory = (typeof COUNTER_CATEGORIES)[number]

export const COUNTER_STAMPS = ['approve', 'suggest', 'first-step', 'reject'] as const
export type CounterStampId = (typeof COUNTER_STAMPS)[number]

export type CounterStep = 'request' | 'interview' | 'tag' | 'stamp'

export type CounterTone = 'brand' | 'quest' | 'spark' | 'reward'

export interface CounterQuestion {
  id: string
  text: string
  reply: string
  /** เอกสารที่ลูกค้ายื่นเมื่อถามข้อนี้ (ถาดเอกสาร S10) */
  docs?: string[]
  /** ประเภทผู้ขอที่รู้จากคำตอบข้อนี้ (ช่องบนการ์ดคำขอ G03) */
  who?: string
  /** สีหน้าลูกค้าตอนตอบข้อนี้ (ไม่ใส่ = neutral) */
  mood?: CounterMood
}

export type CounterMood = 'neutral' | 'happy' | 'confused' | 'upset'

export interface CounterCase {
  id: string
  name: string
  /** id ภาพลูกค้าแบบพิกเซล (c1..c6 ใน /learn/pixel ตาม docs/design-ref/pixel/asset-manifest.md) ต้องตรงเพศ/บทของลูกค้า */
  portrait?: string
  /** คำลงท้ายของลูกค้า (ครับ / ค่ะ / ว่าง) ใช้กับบทพูดที่เกมสร้างเอง */
  particle?: string
  business: string
  tone: CounterTone
  greeting: string
  domains: { name: string; role: string }[]
  questions: CounterQuestion[]
  extensionOptions: string[]
  /** การ์ดเหตุผล 3 ใบ (S14) ไม่บอกว่าใบไหนถูก */
  reasons?: { id: string; text: string }[]
}

export interface CounterData {
  title: string
  intro: string
  maxQuestions: number
  /** จำนวนลูกค้าต่อกะ (เซิร์ฟเวอร์จับจากคลังเคส) */
  shiftSize: number
  /** คำใบ้ของโดม ต่อลูกค้า 1 คน (ชื่อเดิมคงไว้ให้เนื้อหาเก่าใช้ได้) */
  hintsPerShift: number
  handbookSeconds: number
  categories: { id: CounterCategory; label: string; short: string }[]
  stamps: { id: CounterStampId; label: string; hint: string; needsExtension: boolean }[]
  handbook: { category: CounterCategory; floor: string; rows: { suffix: string; who: string }[] }[]
  hints: Record<CounterStep, string[]>
  cases: CounterCase[]
}

/** สิ่งที่ client ส่งไป `POST /api/mission/m3/learn` ใน `{ action:'do', payload }` */
export interface CounterDecision {
  caseId: string
  /** คีย์ = ชื่อโดเมนบนใบคำขอ · ค่า = หมวดที่ผู้เรียนติดป้าย */
  tags: Record<string, CounterCategory>
  /** id คำถามที่ถาม ไม่เกิน 3 */
  asked: string[]
  stamp: CounterStampId
  /** นามสกุลที่เสนอ ใช้กับตรา suggest / first-step */
  extension: string | null
  /** ครั้งที่ตัดสินลูกค้าคนนี้ 1 = ครั้งแรก 2 = ลองแก้อีกครั้ง (ไม่ใส่ = 1) */
  attempt?: 1 | 2
  /** id การ์ดเหตุผลที่เลือก (S14) */
  reason?: string | null
}

export interface CounterPayload {
  decisions: CounterDecision[]
}

export interface CounterCaseResult {
  caseId: string
  tagsCorrect: number
  tagsTotal: number
  stampCorrect: boolean
  askedKeyQuestion: boolean
  explanation: string
  /** เลือกการ์ดเหตุผลตรง (ไม่มีข้อมูล = undefined) ไม่นับในคะแนนผ่าน */
  reasonCorrect?: boolean
  /** คะแนนตราของลูกค้าคนนี้ 2 = ถูกครั้งแรก 1 = ถูกตอนลองแก้ 0 = ยังไม่ถูก */
  points: 0 | 1 | 2
}

export interface CounterGroupResult {
  category: CounterCategory
  correct: number
  total: number
}

/** ผลตรวจทีละลูกค้า (`action: 'step'`) ระหว่างเล่น */
export interface CounterStepResult {
  /** ตราถูก และป้ายถูกทุกใบ */
  correct: boolean
  stampCorrect: boolean
  tagsCorrect: number
  tagsTotal: number
  /** ชื่อโดเมนที่ติดป้ายผิด */
  wrongTags: string[]
  /** การ์ดเหตุผลตรงไหม */
  reasonCorrect?: boolean
  /** มีเฉพาะตอนลองแก้ครั้งที่ 2 แล้วยังไม่ถูก */
  explanation: string
  /** บทลูกค้าตอนตัดสินถูก (บางเคส) */
  line?: string
}

/** ระดับความช่วยเหลือ: คู่มือ 20/15/10 วินาที · ใบ้ 3/2/1 ครั้งต่อลูกค้า */
export type CounterLevel = 'support' | 'standard' | 'challenge'

export const COUNTER_LEVELS: Record<CounterLevel, { handbookSeconds: number; hints: number }> = {
  support: { handbookSeconds: 20, hints: 3 },
  standard: { handbookSeconds: 15, hints: 2 },
  challenge: { handbookSeconds: 10, hints: 1 },
}

/** คะแนนวอร์มอัพ -> ระดับ (ยิ่งได้น้อยยิ่งช่วยมาก) */
export function counterLevelFromWarmup(score: number, total: number): CounterLevel {
  const r = total > 0 ? score / total : 0.5
  return r >= 0.99 ? 'challenge' : r >= 0.5 ? 'standard' : 'support'
}

export interface CounterDetail {
  tagAccuracy: number
  stampAccuracy: number
  cases: CounterCaseResult[]
  /** ตราที่ได้ / เต็ม (2 ต่อลูกค้า) */
  stampPoints: number
  stampMax: number
  /** ผลติดป้ายแยกตามกลุ่ม ใช้เลือกกลุ่มที่ต้องฝึกเพิ่ม */
  groups: CounterGroupResult[]
  error?: string
}

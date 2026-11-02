/**
 * ชนิดข้อมูลของเกม "ลงมือทำ" ด่าน m4 (จดชื่อเว็บ .th)
 *
 * ⚠️ RegistrarData คือส่วนสาธารณะจาก content/learn-registrar.json — ห้ามมีเฉลย
 *    เฉลยอยู่ที่ content/learn-registrar-answers.json อ่านเฉพาะฝั่งเซิร์ฟเวอร์
 */

export interface RegistrarStep {
  id: string
  text: string
  /** ป้ายสั้นบนการ์ดแผงเดินเรื่อง (ไม่มีใช้ text) */
  short?: string
}

export interface RegistrarEvent {
  id: string
  /** จอที่เหตุการณ์เด้ง: ค้นชื่อซ้ำ (R02) · อีเมลขอเอกสารเพิ่ม (R06) · จ่ายเงินเมื่อไร (R07) · ข้ามเวลา 1 ปี (R09) */
  stage: 'search' | 'docs' | 'pay' | 'after-dns'
  title: string
  story: string
  question: string
  choices: string[]
}

export interface RegistrarData {
  title: string
  intro: string
  search: {
    prompt: string
    placeholder: string
    note: string
  }
  board: {
    instruction: string
  }
  steps: RegistrarStep[]
  events: RegistrarEvent[]
  fee: {
    pricePerYear: number
    startCoins: number
    restoreFee: number
    comSample: number
    text: string
    note: string
    comNote: string
  }
  dns: {
    intro: string
    sampleText: string
    nameserverPlaceholders: [string, string]
    successText: string
    reference: { domain: string; nameservers: string[]; checkedAt: string }
  }
  docs: { id: string; label: string }[]
  detective: { question: string; choices: string[] }
  explain: {
    prompt: string
    chips: { id: string; text: string }[]
    reasonPrompt: string
    reasonChoices: Record<string, string[]>
    renewalQuestion: string
    renewalChoices: string[]
    textLabel: string
    textPlaceholder: string
  }
}

export interface RegistrarRuntimeSettings {
  timerSeconds: number
  startCoins: number
  explainPass: number
  eventsPass: number
  tutorialEnabled: boolean
}

export type OwnerType = 'individual' | 'company'

/** บัตรนามสกุลของฉันจากด่าน 3 (ส่งมาเป็น prop ถ้ามี) */
export interface RegistrarCard {
  shop: string
  /** ชื่อภาษาอังกฤษที่ใช้ค้นเริ่มต้น */
  slug: string
  ownerType: OwnerType
  /** นามสกุลที่ร้านมีสิทธิ์จด เช่น .in.th */
  tld: string
}

export const SAMPLE_CARD: RegistrarCard = {
  shop: 'ร้านขนมวาน',
  slug: 'kanomwan',
  ownerType: 'individual',
  tld: '.in.th',
}

/** นามสกุล .th ที่บัตรแต่ละประเภทมีสิทธิ์จด (แสดงให้ผู้เรียนเห็นอยู่แล้วบนบัตร) */
export const ELIGIBLE_TLDS: Record<OwnerType, string[]> = {
  individual: ['.in.th'],
  company: ['.co.th'],
}

/** นามสกุล .th ที่ให้เลือกยื่นในฟอร์ม */
export const TH_TLDS = ['.in.th', '.co.th', '.or.th'] as const

/** คำอธิบายให้บอสที่ส่งตรวจ (เซิร์ฟเวอร์ให้คะแนนรูบริก 4/2/2/2) */
export interface ExplainPayload {
  /** ชิปขั้นตอนที่ผู้เรียนเรียงไว้ */
  order: string[]
  /** รหัสขั้น → ตัวเลือกเหตุผลที่เลือก */
  reasons: Record<string, number>
  /** ตัวเลือกเรื่องต่ออายุ */
  renewal: number | null
  /** คำอธิบายที่พิมพ์เอง (ไม่บังคับ) */
  text?: string
}

/** จังหวะที่ตรวจระหว่างเล่น (POST action 'step') */
export type RegistrarStepPayload =
  | { kind: 'place'; slot: number; stepId: string }
  | { kind: 'event'; eventId: string; choice: number }
  | { kind: 'detect'; choice: number }
  | { kind: 'docs'; ownerType: OwnerType; tld: string; docId: string; round: number }
  | ({ kind: 'explain' } & ExplainPayload)

export interface RubricRow {
  id: 'complete' | 'order' | 'reasons' | 'renewal'
  label: string
  max: number
  got: number
  note: string
}

export type RegistrarStepResult =
  | { kind: 'place'; correct: boolean; reason?: string; hint?: string }
  | { kind: 'event'; eventId: string; correct: boolean; explanation: string }
  | { kind: 'detect'; correct: boolean; explanation: string }
  | { kind: 'docs'; outcome: 'approve' | 'more' | 'reject'; message: string }
  | {
      kind: 'explain'
      rubric: RubricRow[]
      total: number
      followUp: { question: string; reason: string }
    }

/** สิ่งที่ client ส่งให้ scoreRegistrar (ผ่าน action 'do') */
export interface RegistrarPayload {
  order: string[]
  events: Record<string, number>
  searched: boolean
  /** จำนวนครั้งที่วางการ์ดผิดระหว่างเดินเรื่อง */
  misses?: number
  /** เล่นรอบซ่อมมาแล้ว */
  repaired?: boolean
  explain?: ExplainPayload
}

export interface RegistrarDetail {
  order: {
    correct: number
    total: number
    points: number
    /** ผลรายตำแหน่ง เฉพาะตำแหน่งที่ผู้เรียนวางการ์ดไว้ */
    perSlot: { stepId: string; correct: boolean }[]
    /** เหตุผลของแต่ละขั้น คีย์คือรหัสการ์ด */
    reasons: Record<string, string>
    misses: number
  }
  events: {
    correct: number
    total: number
    points: number
    perEvent: { id: string; chosen: number | null; correct: boolean; explanation: string }[]
  }
  explanation: { points: number; max: number; rubric: RubricRow[] }
  stars: number
  searched: boolean
  error?: string
}

export interface RegistrarResult {
  score: number
  passed: boolean
  detail: unknown
}

/**
 * S-32 เป้าหมายครั้งหน้า — ผู้เรียนเลือกเองตอนจบคาบ หรือพิมพ์เป้าของตัวเองก็ได้
 *
 * `content/reflection.json` คีย์ `nextGoals` มีตัวเลือกเขียนไว้แล้วตั้งแต่ต้น แต่ไม่มีใครอ่านเลย
 * ไฟล์นี้ทำให้ตัวเลือกนั้นใช้ได้จริง และบังคับกติกาที่ไฟล์เนื้อหาเขียนไว้เอง
 *
 * กติกาที่ยึด
 * 1. **ทุกตัวเลือกเทียบกับตัวเองเท่านั้น** ห้ามมีตัวเลือกที่เอาไปเทียบกับเพื่อน (`_rule` ในไฟล์เนื้อหา)
 * 2. **พิมพ์เป้าของตัวเองได้** — ตัวเลือกที่มี `allowFreeText` เปิดช่องพิมพ์
 *    ข้อความที่พิมพ์เองต้องผ่านด่านกรองคำทุกครั้ง (ทำที่ route ไม่ใช่ที่นี่)
 * 3. เป้าครั้งหน้า **ไม่มีผลต่อดาวหรือคะแนนของคาบนี้** เป็นข้อมูลให้ครูเตรียมคาบถัดไป
 *
 * ตรรกะล้วน ไม่แตะฐานข้อมูล ไม่เรียก Date.now()
 */
import reflectionJson from '../content/reflection.json' with { type: 'json' }

interface NextGoalItemJson {
  id: string
  text: string
  allowFreeText?: boolean
}

const nextGoalsJson = reflectionJson.nextGoals as unknown as {
  _use?: string
  _rule?: string
  items: NextGoalItemJson[]
}

export interface NextGoalOption {
  id: string
  text: string
  /** ตัวเลือกนี้ให้พิมพ์เป้าของตัวเองแทนได้ */
  allowFreeText: boolean
}

export const NEXT_GOAL_OPTIONS: NextGoalOption[] = nextGoalsJson.items.map((item) => ({
  id: item.id,
  text: item.text,
  allowFreeText: item.allowFreeText === true,
}))

export const NEXT_GOAL_IDS: string[] = NEXT_GOAL_OPTIONS.map((o) => o.id)

/** คำชี้แจงจากไฟล์เนื้อหา ใช้ขึ้นหัวข้อบนหน้าจอ ไม่เขียนซ้ำในโค้ด */
export const NEXT_GOAL_PROMPT: string =
  nextGoalsJson._use ?? 'เลือกเป้าหมายของตัวเองสำหรับคาบถัดไป'

/** ความยาวอย่างน้อยของเป้าที่พิมพ์เอง สั้นกว่านี้ครูอ่านแล้วไม่รู้ว่าอยากทำอะไร */
export const OWN_GOAL_MIN_LENGTH = 4
export const OWN_GOAL_MAX_LENGTH = 200

export function findNextGoalOption(goalId: string): NextGoalOption | undefined {
  return NEXT_GOAL_OPTIONS.find((o) => o.id === goalId)
}

export interface NextGoalChoice {
  goalId: string
  /** ข้อความที่จะแสดง — ของตัวเลือกสำเร็จรูป หรือของที่ผู้เรียนพิมพ์เอง */
  text: string
  /** ผู้เรียนพิมพ์เองหรือเลือกจากรายการ */
  isOwnText: boolean
}

export type NormalizedNextGoal =
  | { ok: true; choice: NextGoalChoice }
  | { ok: false; message: string }

/**
 * ตรวจเป้าที่ผู้เรียนเลือก
 *
 * ตัวเลือกสำเร็จรูป = ใช้ข้อความจากไฟล์เนื้อหา ไม่รับข้อความที่หน้าจอส่งมา (กันแก้ข้อความที่ฝั่งเบราว์เซอร์)
 * ตัวเลือกที่ให้พิมพ์เอง = ต้องมีข้อความจริง ไม่ใช่เว้นว่างแล้วกดผ่าน
 */
export function normalizeNextGoal(input: {
  goalId?: unknown
  ownText?: unknown
}): NormalizedNextGoal {
  const goalId = typeof input?.goalId === 'string' ? input.goalId.trim() : ''
  const option = findNextGoalOption(goalId)
  if (!option) {
    return { ok: false, message: `เลือกเป้าหมายจากรายการก่อนนะ (${NEXT_GOAL_IDS.join(' · ')})` }
  }

  if (!option.allowFreeText) {
    return { ok: true, choice: { goalId: option.id, text: option.text, isOwnText: false } }
  }

  const ownText = typeof input?.ownText === 'string' ? input.ownText.trim() : ''
  if (ownText.length < OWN_GOAL_MIN_LENGTH) {
    return {
      ok: false,
      message: `เลือก "${option.text}" แล้วพิมพ์เป้าของตัวเองด้วยนะ อย่างน้อย ${OWN_GOAL_MIN_LENGTH} ตัวอักษร`,
    }
  }
  if (ownText.length > OWN_GOAL_MAX_LENGTH) {
    return { ok: false, message: `เป้าที่พิมพ์เองยาวได้ไม่เกิน ${OWN_GOAL_MAX_LENGTH} ตัวอักษร` }
  }

  return { ok: true, choice: { goalId: option.id, text: ownText, isOwnText: true } }
}

/** ประโยคเดียวสำหรับแผงครู — บอกด้วยว่าเป็นเป้าที่เด็กคิดเองหรือเลือกจากรายการ */
export function describeNextGoal(choice: NextGoalChoice | null | undefined): string {
  if (!choice) return 'ยังไม่ได้ตั้งเป้าสำหรับคาบหน้า'
  return choice.isOwnText
    ? `ตั้งเป้าเอง: ${choice.text}`
    : `เลือกจากรายการ: ${choice.text}`
}

/** ข้อความยืนยันถึงผู้เรียน — ชมที่การตั้งเป้า ไม่ใช่ตัดสินว่าเป้าดีหรือไม่ดี */
export function confirmNextGoal(choice: NextGoalChoice): string {
  return `เก็บเป้าคาบหน้าไว้แล้ว: ${choice.text} — ครูจะเห็นตอนเตรียมคาบถัดไป เปลี่ยนใจแก้ได้ตลอด`
}

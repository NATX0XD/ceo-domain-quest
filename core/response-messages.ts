/**
 * S-19 คลังข้อความตอบกลับ — ฟังก์ชันล้วน
 *
 * ปัญหาเดิม: `content/messages.json` มีข้อความตอบกลับ 9 สถานการณ์ สถานการณ์ละ 3 ประโยค
 * แต่ไม่มีโค้ดไหนอ่านเลย ผู้เรียนจึงเห็นข้อความกลาง ๆ อันเดียวตลอดทั้งคาบ
 *
 * กติกา 3 ข้อ:
 * 1. **ห้ามสุ่ม** ต้องได้ประโยคเดิมเมื่อสถานะเดิม ไม่อย่างนั้นผู้เรียนที่รีเฟรชหน้าจะเห็นข้อความเปลี่ยน
 *    แล้วนึกว่าระบบตัดสินใหม่ ใช้ "ลำดับที่หมุนไปตามจำนวนครั้งที่ตอบ" แทนการสุ่ม
 * 2. ประโยคไม่ซ้ำติดกัน — ตอบผิดรอบที่ 1 กับรอบที่ 2 ต้องได้คนละประโยค
 * 3. เติม {ชื่อ} {แบรนด์} {ตัวละคร} ให้เรียบร้อยก่อนส่งออก **ห้ามให้สัญลักษณ์หลุดไปถึงหน้าจอ**
 */
import messagesJson from '../content/messages.json' with { type: 'json' }

interface FeedbackGroupRaw {
  id: string
  situation: string
  lines: string[]
}

const groups = (messagesJson.feedback as FeedbackGroupRaw[]).filter(
  (g) => Array.isArray(g?.lines) && g.lines.length > 0,
)

/** สถานการณ์ที่คลังข้อความรองรับ ชื่อตรงกับรหัสในไฟล์เนื้อหา */
export type FeedbackSituation =
  | 'correct-first'
  | 'correct-after-try'
  | 'wrong-first'
  | 'wrong-repeat'
  | 'passed-via-alt'
  | 'mission-passed'
  | 'mission-skipped'
  | 'boss-passed'
  | 'teacher-asked-revise'

const SITUATION_TO_ID: Record<FeedbackSituation, string> = {
  'correct-first': 'msg-correct-first',
  'correct-after-try': 'msg-correct-after-try',
  'wrong-first': 'msg-wrong-first',
  'wrong-repeat': 'msg-wrong-repeat',
  'passed-via-alt': 'msg-passed-via-alt',
  'mission-passed': 'msg-mission-passed',
  'mission-skipped': 'msg-mission-skipped',
  'boss-passed': 'msg-boss-passed',
  'teacher-asked-revise': 'msg-teacher-asked-revise',
}

export interface MessageTokens {
  nickname?: string | null
  brandName?: string | null
  character?: string | null
}

/**
 * เติมสัญลักษณ์ในข้อความ — ช่องที่ไม่มีค่าจะถูกแทนด้วยคำกลาง ๆ ที่อ่านรู้เรื่อง
 * ไม่ปล่อยให้ {แบรนด์} โผล่บนหน้าจอเด็ดขาด
 */
export function fillTokens(text: string, tokens: MessageTokens = {}): string {
  return text
    .replaceAll('{ชื่อ}', (tokens.nickname ?? '').trim() || 'CEO')
    .replaceAll('{แบรนด์}', (tokens.brandName ?? '').trim() || 'ร้านของเรา')
    .replaceAll('{ตัวละคร}', (tokens.character ?? '').trim() || 'เพื่อนร่วมร้าน')
}

export interface PickMessageInput {
  situation: FeedbackSituation
  /**
   * ตัวหมุนเลือกประโยค ปกติใช้จำนวนครั้งที่ตอบไปแล้ว
   * ค่าเดิม = ประโยคเดิมเสมอ · ค่าถัดไป = ประโยคถัดไป จึงไม่ซ้ำติดกัน
   */
  rotation?: number
  tokens?: MessageTokens
}

/** ประโยคตอบกลับหนึ่งประโยค พร้อมแสดงบนหน้าจอแล้ว คืน null เมื่อไม่มีสถานการณ์นี้ในไฟล์ */
export function pickMessage(input: PickMessageInput): string | null {
  const group = groups.find((g) => g.id === SITUATION_TO_ID[input.situation])
  if (!group || group.lines.length === 0) return null

  const raw = input.rotation
  const turn = typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : 0
  // ทำให้เป็นบวกเสมอ กัน rotation ติดลบทำให้ index ติดลบ
  const index = ((turn % group.lines.length) + group.lines.length) % group.lines.length

  return fillTokens(group.lines[index]!, input.tokens)
}

export interface CheckOutcomeInput {
  correct: boolean
  /** จำนวนครั้งที่ตอบไปแล้ว **รวมครั้งนี้** ครั้งแรกคือ 1 */
  attempts: number
  /** ผ่านภารกิจนี้ไปแล้วก่อนหน้านี้ ตอบซ้ำไม่นับใหม่ */
  alreadyPassed?: boolean
}

/** แปลผลการตรวจคำตอบเป็นสถานการณ์ในคลังข้อความ */
export function situationForCheck(input: CheckOutcomeInput): FeedbackSituation {
  const attempts = Number.isFinite(input.attempts) ? Math.max(1, Math.trunc(input.attempts)) : 1

  if (input.correct) {
    if (input.alreadyPassed) return 'mission-passed'
    return attempts <= 1 ? 'correct-first' : 'correct-after-try'
  }
  return attempts <= 1 ? 'wrong-first' : 'wrong-repeat'
}

/** ทางลัดที่ route ใช้จริง — แปลผลแล้วหยิบประโยคในขั้นตอนเดียว */
export function messageForCheck(
  outcome: CheckOutcomeInput,
  tokens: MessageTokens = {},
): { situation: FeedbackSituation; text: string | null } {
  const situation = situationForCheck(outcome)
  return {
    situation,
    // หมุนตามจำนวนครั้งที่ตอบ ตอบผิดรอบ 2 กับรอบ 3 จึงได้คนละประโยค
    text: pickMessage({ situation, rotation: Math.max(0, outcome.attempts - 1), tokens }),
  }
}

/** รหัสสถานการณ์ทั้งหมดที่ไฟล์เนื้อหามีจริง ใช้ในเทสต์และตอนตรวจความครบ */
/**
 * @wired-optional ใช้ตรวจว่าไฟล์เนื้อหามีครบทุกสถานการณ์ ไม่ใช่ทางที่ข้อความเดินจริง
 *   ข้อความจริงไหลผ่าน messageForCheck() ซึ่งเลือกสถานการณ์ให้เอง
 */
export function availableSituations(): string[] {
  return groups.map((g) => g.id)
}

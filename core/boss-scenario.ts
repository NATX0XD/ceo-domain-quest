/**
 * S-22 เลือกแม่แบบสถานการณ์ด่านบอสให้แต่ละคนไม่เหมือนกัน — ฟังก์ชันล้วน ไม่แตะเน็ตและไม่แตะฐานข้อมูล
 *
 * ทำไมต้องมีไฟล์นี้: ก่อนหน้านี้ผู้เรียนทั้งห้องได้ `scenario` ก้อนเดียวกันหมด ต่างกันแค่กฎสิทธิ์จด
 * ซึ่งทำให้ข้ออ้างเรื่อง "หลายเส้นทาง เป้าหมายเดียวกัน" อ่อนลงตรงฉากไคลแม็กซ์พอดี
 *
 * กติกาที่ master ล็อกไว้ (บันทึกอยู่ใน content/big-mission.json คีย์ scenarioTemplates.selection):
 * 1. **ห้ามสุ่ม** ผู้เรียนคนเดิมที่มีคะแนนความแม่นชุดเดิม ต้องได้แม่แบบเดิมทุกครั้งที่เปิดหน้า
 *    ไม่อย่างนั้นคนที่รีโหลดหน้ากลางคันจะเจอโจทย์คนละข้อ
 * 2. เลือกจาก **เรื่องที่ผู้เรียนอ่อนที่สุด** ตามคะแนนความแม่นรายเรื่อง 0-4 (สเปกหัวข้อ 1.10)
 * 3. เสมอกันให้เลือก **เรื่องที่มีลำดับต้นกว่า** obj-1 มาก่อน obj-2 เสมอ
 * 4. เรื่อง 4 มีสองแม่แบบ เลือกตาม **สถานะจดทะเบียนของร้าน** ที่ผู้เรียนกรอกไว้ ไม่ใช่เลือกเอง
 * 5. ยังไม่มีคะแนนความแม่นเลย (ข้ามภารกิจย่อยทั้งหมด) ให้ใช้แม่แบบที่ครอบทั้ง 4 เรื่อง
 *
 * ⚠️ อ่าน content/big-mission.json ตรง ๆ ไม่ผ่าน components/server/lesson-content.ts
 *    เพราะ zod schema ที่นั่นตัดคีย์ที่ไม่รู้จักทิ้ง scenarioTemplates จึงหายไปทั้งก้อน
 */
import bigMissionJson from '../content/big-mission.json' with { type: 'json' }

export interface BossTemplate {
  id: string
  /** รหัสในสเปก เช่น B-T1 ใช้จับคู่กับเรื่องราวจาก lib/ai/story.ts */
  specId: string
  /** จุดประสงค์ที่แม่แบบนี้เน้น หรือ 'all' เมื่อครอบทุกเรื่อง */
  focusObjectiveId: string
  title: string
  scenario: string
  specificTask: string
  /** มีค่าเฉพาะแม่แบบคู่ของเรื่อง 4 ที่แยกตามสถานะจดทะเบียน */
  requiresRegistered?: boolean
  hasChallengeButton?: boolean
  challengeButtonLabel?: string
  noStarterPhrase?: boolean
}

interface SelectionRule {
  mode: string
  topicOrder: string[]
}

const templatesRaw = (bigMissionJson as { scenarioTemplates?: { items?: unknown[] } })
  .scenarioTemplates

export const bossTemplates: BossTemplate[] = ((templatesRaw?.items ?? []) as BossTemplate[]).filter(
  (t) => typeof t?.id === 'string' && typeof t?.scenario === 'string',
)

const selection = ((bigMissionJson as { scenarioTemplates?: { selection?: SelectionRule } })
  .scenarioTemplates?.selection ?? { mode: 'weakest-topic', topicOrder: [] }) as SelectionRule

/** ลำดับเรื่อง ใช้ทั้งตอนตัดสินเสมอและตอนไล่หาเรื่องที่อ่อนที่สุด */
export const TOPIC_ORDER: string[] =
  selection.topicOrder.length > 0 ? [...selection.topicOrder] : ['obj-1', 'obj-2', 'obj-3', 'obj-4']

/** แม่แบบสำรองเมื่อยังไม่มีข้อมูลความแม่นเลย — ตัวที่ครอบทั้ง 4 เรื่อง */
const FALLBACK_TEMPLATE_ID = 'bm-t5'

/** คะแนนความแม่นเต็มของหนึ่งเรื่อง ตามสเปกหัวข้อ 1.10 */
export const TOPIC_ACCURACY_MAX = 4

export interface TopicAccuracyInput {
  /** ตอบข้อของเรื่องนี้ถูกในแบบทดสอบก่อนเรียนไหม */
  pretestCorrect?: boolean | null
  /** ตอบข้อตรวจท้ายภารกิจของเรื่องนี้ถูกไหม (profiles.readiness) */
  checkCorrect?: boolean | null
  /** ดาวที่ได้จากภารกิจของเรื่องนี้ 0-3 */
  missionStars?: number | null
  /** ข้ามภารกิจของเรื่องนี้ไป ยังไม่เคยวัดเลย */
  skipped?: boolean
}

/**
 * คะแนนความแม่นของหนึ่งเรื่อง 0-4 ประกอบจาก 3 สัญญาณที่ระบบเก็บอยู่แล้ว
 *
 * | สัญญาณ | ให้กี่คะแนน |
 * |---|---|
 * | ตอบถูกในแบบทดสอบก่อนเรียน | 1 |
 * | ตอบข้อตรวจท้ายภารกิจถูก | 1 |
 * | ดาวของภารกิจ 1-2 ดวง | 1 · 3 ดวง | 2 |
 *
 * **ไม่มีข้อมูลเลยให้ 0** ซึ่งแปลว่า "อ่อนที่สุด" โดยตั้งใจ เพราะคนที่ข้ามภารกิจไปทั้งเรื่อง
 * คือคนที่ควรได้โจทย์ด่านบอสของเรื่องนั้นมากที่สุด ไม่ใช่คนที่ควรถูกข้ามอีกรอบ
 */
export function topicAccuracy(input: TopicAccuracyInput): number {
  let score = 0
  if (input.pretestCorrect === true) score += 1
  if (input.checkCorrect === true) score += 1

  const stars = typeof input.missionStars === 'number' ? input.missionStars : 0
  if (stars >= 3) score += 2
  else if (stars >= 1) score += 1

  return Math.min(TOPIC_ACCURACY_MAX, score)
}

export interface WeakestTopicInput {
  /** คะแนนความแม่นรายเรื่อง 0-4 · เรื่องที่ไม่มีคีย์ถือว่ายังไม่เคยวัด */
  accuracyByTopic: Record<string, number | null | undefined>
}

/**
 * เรื่องที่อ่อนที่สุด — เสมอกันเลือกเรื่องที่มีลำดับต้นกว่าเสมอ
 * คืน null เมื่อไม่มีเรื่องไหนมีคะแนนเลย (ยังไม่เคยวัดอะไรเลยสักเรื่อง)
 */
export function weakestTopic(input: WeakestTopicInput): string | null {
  let best: { topic: string; score: number } | null = null
  let sawAny = false

  for (const topic of TOPIC_ORDER) {
    const raw = input.accuracyByTopic[topic]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    sawAny = true
    // เข้มงวดกว่า <= เพื่อให้เสมอกันแล้วตัวแรกใน TOPIC_ORDER ชนะ (กติกาข้อ 3)
    if (best === null || raw < best.score) best = { topic, score: raw }
  }

  return sawAny ? (best?.topic ?? null) : null
}

export interface PickBossTemplateInput extends WeakestTopicInput {
  /** ร้านของผู้เรียนจดทะเบียนนิติบุคคลแล้วหรือยัง ใช้เลือกคู่แม่แบบของเรื่อง 4 */
  isRegisteredCompany?: boolean | null
}

export interface BossTemplateChoice {
  template: BossTemplate
  /** เรื่องที่ทำให้ได้แม่แบบนี้ · null = ยังไม่มีข้อมูลจึงใช้แม่แบบครอบทุกเรื่อง */
  weakestObjectiveId: string | null
  reason: 'weakest-topic' | 'no-data'
}

/**
 * เลือกแม่แบบด่านบอสของผู้เรียนหนึ่งคน — **ผลเดิมทุกครั้งเมื่อข้อมูลเข้าเหมือนเดิม**
 * ไม่มีการสุ่ม ไม่มีการอ่านเวลา ไม่มีการอ่านสถานะภายนอก
 */
export function pickBossTemplate(input: PickBossTemplateInput): BossTemplateChoice | null {
  if (bossTemplates.length === 0) return null

  const fallback =
    bossTemplates.find((t) => t.id === FALLBACK_TEMPLATE_ID) ??
    bossTemplates.find((t) => t.focusObjectiveId === 'all') ??
    bossTemplates[0]!

  const weakest = weakestTopic(input)
  if (weakest === null) {
    return { template: fallback, weakestObjectiveId: null, reason: 'no-data' }
  }

  const matches = bossTemplates.filter((t) => t.focusObjectiveId === weakest)
  if (matches.length === 0) {
    return { template: fallback, weakestObjectiveId: weakest, reason: 'weakest-topic' }
  }

  // เรื่องที่มีแม่แบบคู่ (เรื่อง 4) เลือกตามสถานะจดทะเบียนของร้าน ไม่ใช่ให้ผู้เรียนเลือกเอง
  const registered = input.isRegisteredCompany === true
  const byRegistration = matches.find((t) =>
    typeof t.requiresRegistered === 'boolean' ? t.requiresRegistered === registered : false,
  )

  return {
    template: byRegistration ?? matches[0]!,
    weakestObjectiveId: weakest,
    reason: 'weakest-topic',
  }
}

/** รหัสเรื่องราวใน lib/ai/story.ts ที่คู่กับแม่แบบนี้ เช่น bm-t4-registered → B-T4 */
export function storyIdForTemplate(template: BossTemplate): string {
  return template.specId.split(' ')[0] ?? template.specId
}

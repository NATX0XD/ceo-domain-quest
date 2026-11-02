/**
 * บทแนะนำ (โค้ชมาร์ก) ของ Pixel Counter — สั้น 5 ขั้น แสดงเฉพาะลูกค้าคนแรกของรอบแรกเท่านั้น
 * (กะจริงหรือโหมดซ้อม อันไหนมาก่อน) ลูกค้าคนที่ 2 เป็นต้นไปไม่แสดงอีก
 */
export type Tut = 'call' | 'card' | 'ask' | 'tools' | 'stamp'
export const TUT_ORDER: Tut[] = ['call', 'card', 'ask', 'tools', 'stamp']
export const TUT_STEPS = TUT_ORDER.length

export type TutState = {
  caseIndex: number
  page: 'queue' | 'card' | 'interview' | 'stamp'
  asked: number
  hasFeedback: boolean
}

/** ขั้นถัดไปตามสิ่งที่ผู้เล่นทำจริง · null = จบบทแนะนำ · คืน tut เดิม = ยังอยู่ขั้นนี้ */
export function nextTut(tut: Tut, s: TutState): Tut | null {
  if (s.caseIndex > 0) return null
  if (tut === 'call' && s.page !== 'queue') return 'card'
  if (tut === 'card' && s.page === 'interview') return 'ask'
  if (tut === 'card' && s.page === 'stamp') return 'tools'
  if (tut === 'ask' && (s.asked > 0 || s.page === 'stamp')) return 'tools'
  if (tut === 'tools' && s.hasFeedback) return null
  if (tut === 'stamp' && s.hasFeedback) return null
  return tut
}

/** ปุ่ม "ต่อไป" (มีเฉพาะขั้นแนะนำปุ่มหันซ้าย/ขวา ที่ไม่ต้องกดจริง) */
export function skipTut(tut: Tut): Tut | null {
  const i = TUT_ORDER.indexOf(tut)
  return TUT_ORDER[i + 1] ?? null
}

/** เริ่มบทแนะนำไหม: ยังไม่เคยดู และยังอยู่ลูกค้าคนแรก */
export function startTut(enabled: boolean, caseIndex: number): Tut | null {
  return enabled && caseIndex === 0 ? 'call' : null
}

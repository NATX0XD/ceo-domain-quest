import type { CounterDecision } from '../counter-types'

/**
 * ความคืบหน้าของกะ Pixel Counter (ลูกค้าคนที่เท่าไร ตัดสินอะไรไปแล้ว ลองครั้งที่เท่าไร)
 *
 * เก็บไว้นอก PixelShift (ผู้เรียกถือ store ต่อกะ) — ถ้า PixelShift ถูก remount กลางกะ
 * (Fast Refresh ตอนแก้โค้ด, Suspense ฯลฯ) จะกลับมาที่ลูกค้าคนเดิม ไม่เด้งกลับคนที่ 1
 * ตอบผิดต้องอยู่คนเดิมเสมอ (รอบ "ลองตัดสินใหม่") เลื่อนคนถัดไปได้ทาง advance เท่านั้น
 */
export type ShiftProgress = {
  caseIndex: number
  decisions: CounterDecision[]
  points: number
  penalty: number
  attempt: 1 | 2
  wrongHint: string[]
}

export type ProgressStore = {
  get: () => ShiftProgress | undefined
  set: (p: ShiftProgress) => void
}

export const START_PROGRESS: ShiftProgress = { caseIndex: 0, decisions: [], points: 0, penalty: 0, attempt: 1, wrongHint: [] }

/** ค่าเริ่มต้นตอน mount: ใช้ของเดิมถ้ามี แต่กันเลขลูกค้าเกินจำนวนในกะ */
export function restoreProgress(saved: ShiftProgress | undefined, total: number): ShiftProgress {
  if (!saved || total <= 0) return START_PROGRESS
  const caseIndex = Math.min(Math.max(0, Math.floor(saved.caseIndex) || 0), total - 1)
  if (caseIndex !== saved.caseIndex) return { ...saved, caseIndex, attempt: 1, wrongHint: [] }
  return saved
}

/** ผลตรวจลูกค้าคนนี้ — ผิดครั้งแรก = ลองใหม่กับคนเดิม · ไม่เคยเปลี่ยน caseIndex */
export function afterCheck(p: ShiftProgress, r: { correct: boolean; wrongTags: string[] }): { progress: ShiftProgress; retry: boolean } {
  if (!r.correct && p.attempt === 1) return { progress: { ...p, wrongHint: r.wrongTags }, retry: true }
  return { progress: p, retry: false }
}

/** กด "ลองตัดสินใหม่" — ยังเป็นลูกค้าคนเดิม ครั้งที่ 2 */
export function startRetry(p: ShiftProgress): ShiftProgress {
  return { ...p, attempt: 2 }
}

/** ไปลูกค้าคนถัดไป (ไม่ใช่คนสุดท้าย) */
export function advanceProgress(p: ShiftProgress, total: number): ShiftProgress {
  return { ...p, caseIndex: Math.min(p.caseIndex + 1, Math.max(0, total - 1)), attempt: 1, wrongHint: [] }
}

/**
 * หมดเวลาแล้วเลือกเริ่มใหม่ แต่ไม่มีกะใหม่ให้ (โหมดซ้อม) — เริ่มลูกค้าคนนี้ใหม่ ไม่ย้อนไปคนที่ 1
 */
export function restartCurrentCustomer(p: ShiftProgress): ShiftProgress {
  return { ...p, attempt: 1, wrongHint: [] }
}

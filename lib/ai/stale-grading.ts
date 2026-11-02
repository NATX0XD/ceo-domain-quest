/**
 * ตัดสินว่าใบที่ขึ้น "AI กำลังตรวจ" ค้างจริงหรือไม่ (ฟังก์ชันบริสุทธิ์ ทดสอบได้)
 * - pending: มีงานในคิวและยังใหม่ → ให้รอต่อ
 * - stale: ไม่มีงานในคิว / งานล้ม / งานจบแต่ไม่เขียนกลับ / ค้างเกิน STALE_MS → ให้ครูกด "ให้ AI ตรวจตอนนี้"
 * - none: ไม่เกี่ยวกับ AI ที่รอ
 */
export const STALE_MS = 10 * 60 * 1000

export interface JobLike {
  status: string
  updated_at: string
}

export type AiWait = 'none' | 'pending' | 'stale'

export function classifyAiWait(
  gradingStatus: string | undefined,
  hasProposal: boolean,
  jobs: JobLike[],
  now = Date.now(),
): AiWait {
  if (hasProposal) return 'none'
  if (gradingStatus === 'ai-failed') return 'stale'
  if (gradingStatus !== 'pending-ai') return 'none'
  const live = jobs.find((j) => j.status === 'pending' || j.status === 'claimed')
  if (!live) return 'stale'
  const age = now - new Date(live.updated_at).getTime()
  return Number.isFinite(age) && age > STALE_MS ? 'stale' : 'pending'
}

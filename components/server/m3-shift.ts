import { getServiceClient } from '@/lib/db/client'
import { logEvent } from '@/lib/db/repo'
import { LEGACY_SHIFT, drawShift, newShiftSeed, validShift } from './learn-counter'

/**
 * กะของภารกิจ 3 ต่อนักเรียน — เก็บเป็น event `m3-shift` { seed, caseIds }
 * กะล่าสุดคือกะที่ใช้ตรวจคะแนน รีเฟรชหน้าแล้วได้ลูกค้าชุดเดิม
 * เริ่มกะใหม่ (หมดเวลา/เข้ากะใหม่) = จับชุดใหม่แล้วบันทึกทับเป็นแถวใหม่
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น
 */

export const M3_SHIFT_EVENT = 'm3-shift'

export type M3Shift = { seed: number; caseIds: string[] }

export async function readShift(studentId: string): Promise<M3Shift | null> {
  const { data, error } = await getServiceClient()
    .from('events')
    .select('payload')
    .eq('student_id', studentId)
    .eq('type', M3_SHIFT_EVENT)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`readShift: ${error.message}`)
  const p = data?.[0]?.payload as { seed?: unknown; caseIds?: unknown } | undefined
  if (!p || typeof p.seed !== 'number') return null
  const caseIds = Array.isArray(p.caseIds) ? validShift(p.caseIds) : drawShift(p.seed)
  return { seed: p.seed, caseIds }
}

async function seenCaseIds(studentId: string): Promise<string[]> {
  const { data, error } = await getServiceClient()
    .from('events')
    .select('payload')
    .eq('student_id', studentId)
    .eq('type', M3_SHIFT_EVENT)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`seenCaseIds: ${error.message}`)
  const ids = new Set<string>()
  for (const row of data ?? []) {
    const payload = row.payload as { caseIds?: unknown } | null
    if (Array.isArray(payload?.caseIds)) {
      for (const id of validShift(payload.caseIds)) ids.add(id)
    }
  }
  return [...ids]
}

export async function startNewShift(studentId: string, previous?: readonly string[] | null): Promise<M3Shift> {
  const seen = await seenCaseIds(studentId)
  const shift = newShiftSeed(previous, Math.random, seen)
  await logEvent(studentId, M3_SHIFT_EVENT, shift)
  return shift
}

/** กะปัจจุบัน ยังไม่มี = จับใหม่ · DB ล่ม = ชุดสำรอง 3 คน (เล่นต่อได้เสมอ) */
export async function currentShift(studentId: string): Promise<M3Shift> {
  try {
    const current = await readShift(studentId)
    // Migrate shifts created before the 3-customer rule; never render an old 4-customer run.
    if (current && current.caseIds.length === 3) return current
    return await startNewShift(studentId, current?.caseIds)
  } catch (err) {
    console.error('[m3-shift]', err)
    return { seed: 0, caseIds: [...LEGACY_SHIFT] }
  }
}

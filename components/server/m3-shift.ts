import { getServiceClient } from '@/lib/db/client'
import { logEvent } from '@/lib/db/repo'
import { LEGACY_SHIFT, drawShift, newShiftSeed, validShift } from './learn-counter'
import type { CounterRuntimeSettings } from '@/components/learn/counter-types'

/**
 * กะของภารกิจ 3 ต่อนักเรียน — เก็บเป็น event `m3-shift` { seed, caseIds }
 * กะล่าสุดคือกะที่ใช้ตรวจคะแนน รีเฟรชหน้าแล้วได้ลูกค้าชุดเดิม
 * เริ่มกะใหม่ (หมดเวลา/เข้ากะใหม่) = จับชุดใหม่แล้วบันทึกทับเป็นแถวใหม่
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น
 */

export const M3_SHIFT_EVENT = 'm3-shift'

export type M3Shift = { seed: number; caseIds: string[]; settings?: CounterRuntimeSettings }

export async function readShift(studentId: string): Promise<M3Shift | null> {
  const { data, error } = await getServiceClient()
    .from('events')
    .select('payload')
    .eq('student_id', studentId)
    .eq('type', M3_SHIFT_EVENT)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`readShift: ${error.message}`)
  const p = data?.[0]?.payload as { seed?: unknown; caseIds?: unknown; settings?: unknown } | undefined
  if (!p || typeof p.seed !== 'number') return null
  const caseIds = Array.isArray(p.caseIds) ? validShift(p.caseIds) : drawShift(p.seed)
  return { seed: p.seed, caseIds, settings: isSettings(p.settings) ? p.settings : undefined }
}

function isSettings(value: unknown): value is CounterRuntimeSettings {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<CounterRuntimeSettings>
  return typeof s.realCustomers === 'number' && typeof s.customerQuestions === 'number' && typeof s.tagPass === 'number' && typeof s.stampPass === 'number'
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

export async function startNewShift(
  studentId: string,
  previous?: readonly string[] | null,
  settings?: CounterRuntimeSettings,
): Promise<M3Shift> {
  const seen = await seenCaseIds(studentId)
  const size = settings?.realCustomers ?? 2
  const shift = newShiftSeed(previous, Math.random, seen, size)
  const snapshot = settings ?? {
    practiceEnabled: true,
    realCustomers: 2,
    customerSeconds: 180,
    extendSeconds: 60,
    handbookSeconds: 15,
    customerQuestions: 3,
    domeQuota: null,
    hints: 2,
    tagPass: 80,
    stampPass: 60,
  }
  const result = { ...shift, settings: snapshot }
  await logEvent(studentId, M3_SHIFT_EVENT, JSON.parse(JSON.stringify(result)))
  return result
}

/** กะปัจจุบัน ยังไม่มี/เป็นกะเก่า 3 คน = จับใหม่ · DB ล่ม = ชุดสำรอง 2 คน (เล่นต่อได้เสมอ) */
export async function currentShift(studentId: string, settings?: CounterRuntimeSettings): Promise<M3Shift> {
  try {
    const current = await readShift(studentId)
    // A shift keeps its settings snapshot. A changed classroom setting starts a fresh shift.
    if (current && current.caseIds.length === (settings?.realCustomers ?? current.settings?.realCustomers ?? 2)) {
      return current.settings || !settings ? current : { ...current, settings }
    }
    return await startNewShift(studentId, current?.caseIds, settings)
  } catch (err) {
    console.error('[m3-shift]', err)
    return { seed: 0, caseIds: [...LEGACY_SHIFT] }
  }
}

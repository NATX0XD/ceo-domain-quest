import { getServiceClient } from '@/lib/db/client'
import {
  getActiveClassSession,
  getStudent,
  type BuddyOffer,
  type BuddyRequest,
} from '@/lib/db/repo'

/**
 * คำถามเกี่ยวกับคู่หูที่ `lib/db/repo.ts` ยังไม่มีให้ — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ⚠️ ไฟล์นี้อยู่ใต้ `app/api/buddy/_lib` เพราะไม่ใช่ route (Next รู้จักเฉพาะ route.ts)
 *    วางไว้ที่นี่เพื่อให้อยู่ในขอบเขตไฟล์ของ session นี้ ไม่ชนกับ lib/db/** ของ session ฐานข้อมูล
 * ⚠️ อ่านอย่างเดียวทั้งไฟล์ — การเขียนทุกครั้งผ่าน RPC ใน repo ที่ตรวจเจ้าของในคิวรีเดียวกับที่เขียน
 */

/** คนที่ยิงคำขอไปแล้วในใบนี้ (รวมคนที่ปฏิเสธและใบที่หมดเวลา) — ห้ามยิงซ้ำคนเดิม */
export async function listOfferedHelperIds(requestId: string): Promise<string[]> {
  const { data, error } = await getServiceClient()
    .from('buddy_offers')
    .select('helper_id')
    .eq('request_id', requestId)

  if (error) throw new Error(`listOfferedHelperIds: ${error.message}`)
  return (data ?? []).map((row) => row.helper_id)
}

export async function getBuddyRequestById(requestId: string): Promise<BuddyRequest | null> {
  const { data, error } = await getServiceClient()
    .from('buddy_requests')
    .select()
    .eq('id', requestId)
    .maybeSingle()

  if (error) throw new Error(`getBuddyRequestById: ${error.message}`)
  return data
}

/** ใบคำขอที่ผู้ช่วยตอบรับไว้และยังไม่จบ — ฝั่งผู้ช่วยต้องเห็นว่าตัวเองรับปากใครอยู่ */
export async function getAcceptedRequestForHelper(
  helperId: string,
): Promise<BuddyRequest | null> {
  const { data, error } = await getServiceClient()
    .from('buddy_requests')
    .select()
    .eq('helper_id', helperId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getAcceptedRequestForHelper: ${error.message}`)
  return data
}

export async function nicknamesOf(studentIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(studentIds.filter(Boolean))]
  if (ids.length === 0) return {}

  const { data, error } = await getServiceClient()
    .from('students')
    .select('id, nickname')
    .in('id', ids)

  if (error) throw new Error(`nicknamesOf: ${error.message}`)
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.nickname]))
}

/** ใบที่ยิงไปแล้วและยังรอคำตอบอยู่ของใบนี้ — ผู้ขอจะได้รู้ว่ากำลังรอใคร */
export async function getPendingOfferOfRequest(requestId: string): Promise<BuddyOffer | null> {
  const { data, error } = await getServiceClient()
    .from('buddy_offers')
    .select()
    .eq('request_id', requestId)
    .eq('status', 'pending')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`getPendingOfferOfRequest: ${error.message}`)
  return data
}

/**
 * ตอนนี้ห้องอยู่ช่วง "ทำต่อที่บ้าน" หรือยัง — เพื่อนไม่ได้นั่งอยู่ในห้องแล้ว จึงข้ามการจับคู่
 * ไม่มีคาบเปิดอยู่ = ถือว่ายังไม่ถึงช่วงนั้น (ไม่ใช่ข้อผิดพลาด ครูอาจยังไม่ได้กดเปิดคาบ)
 */
export async function isHomePhase(classroomId: string): Promise<boolean> {
  const session = await getActiveClassSession(classroomId).catch(() => null)
  return session?.phase === 'home'
}

/** ห้องของผู้เรียนคนนี้ — ใช้ตรวจว่าขอข้ามห้องไม่ได้ และหาช่วงของคาบ */
export async function classroomOf(studentId: string): Promise<string | null> {
  const student = await getStudent(studentId).catch(() => null)
  return student?.classroom_id ?? null
}

export function secondsLeft(expiresAt: string | null | undefined): number {
  const at = expiresAt ? Date.parse(expiresAt) : Number.NaN
  if (!Number.isFinite(at)) return 0
  return Math.max(0, Math.round((at - Date.now()) / 1000))
}

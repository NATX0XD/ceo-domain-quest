// นำเข้าแบบ path ตรง ไม่ใช่ alias `@/` เพราะโปรเจกต์ยังไม่มี vitest config ที่รู้จัก alias
// (ไฟล์นี้มีเทสต์คู่กันอยู่ที่ classroom-capacity.test.ts)
import { getServiceClient } from '../../lib/db/client'
import type { Student } from '../../lib/db/repo'
import type { TablesInsert } from '../../lib/db/types'

/**
 * เพดานจำนวนนักเรียนต่อห้อง + การรับเข้าห้องแบบ "ชื่อซ้ำไม่รับ"
 *
 * ทำไมต้องมี: รหัสห้อง 6 ตัวถูกฉายบนจอทั้งคาบ ใครจดไปก็ยิง `POST /api/join` ได้
 * ถ้าไม่มีเพดาน คนคนเดียวเขียนลูปสั้น ๆ ก็ยัดชื่อปลอมเข้าห้องได้ไม่จำกัด
 * ครูจะเปิดแผงมาเจอรายชื่อขยะเต็มจอกลางคาบ (UAT-3 ช่องโหว่ข้อ 1 — ยิงจริง 9 ครั้ง ได้นักเรียน 9 แถว)
 *
 * ⚠️ เพดานนี้กันเฉพาะ "คนใหม่" — คนที่อยู่ในห้องแล้วเข้าใหม่ผ่าน `POST /api/join/resume`
 *    ซึ่งไม่แตะเพดานเลย ห้องที่มีคนอยู่แล้วจึงไม่มีทางถูกล็อกออกจากห้องตัวเอง
 */

/** ห้องเรียนจริงของหลักสูตรนี้ราว 20-40 คน เผื่อห้องรวม/ครูทดลองซ้ำไว้พอสมควร */
export const DEFAULT_CLASSROOM_CAPACITY = 60

/** ชื่อ env ที่ใช้ปรับเพดาน — ไม่มีค่าลับ เก็บเป็นตัวเลขล้วน */
export const CAPACITY_ENV = 'CLASSROOM_MAX_STUDENTS'

/**
 * เพดานที่ใช้จริงกับห้องหนึ่ง
 *
 * @param override เพดานรายห้องที่ครูตั้งไว้ (ยังไม่มีคอลัมน์เก็บ — ดู docs/api.md ข้อ 8)
 *                 พอมีคอลัมน์เมื่อไร ส่งค่าเข้ามาตรงนี้ได้เลยโดยไม่ต้องแก้ตัวเรียกฝั่งอื่น
 */
export function classroomCapacity(override?: number | null): number {
  if (typeof override === 'number' && Number.isInteger(override) && override > 0) {
    return override
  }
  // รับเฉพาะจำนวนเต็มบวกล้วน ๆ — parseInt('3.5.1') ได้ 3 ซึ่งเป็นค่าที่ไม่มีใครตั้งใจ
  const raw = (process.env[CAPACITY_ENV] ?? '').trim()
  if (!/^\d+$/.test(raw)) return DEFAULT_CLASSROOM_CAPACITY
  const fromEnv = Number.parseInt(raw, 10)
  return fromEnv > 0 ? fromEnv : DEFAULT_CLASSROOM_CAPACITY
}

export interface RoomSpace {
  /** เพดานที่ใช้กับห้องนี้ */
  capacity: number
  /** จำนวนนักเรียนที่อยู่ในห้องแล้ว */
  count: number
  /** ที่ว่างที่เหลือ (ไม่ติดลบ) */
  remaining: number
  /** true = รับคนใหม่ไม่ได้แล้ว */
  full: boolean
  /**
   * true = ห้องนี้มีคนมากกว่าเพดาน **อยู่ก่อนแล้ว**
   *
   * ห้องที่เปิดหลังมีเพดานไม่มีทางเป็น true ได้เลย เพราะคนที่ทำให้ถึงเพดานพอดีคือคนสุดท้ายที่เข้าได้
   * ค่านี้จึงหมายถึง "ห้องเก่าที่สะสมคนมาก่อนวันที่เพดานมีผล" เท่านั้น เช่นห้องเดโม/ห้องที่ใช้ทดสอบโหลด
   * ห้องพวกนี้**ห้ามถูกล็อกออก** (คนที่อยู่ในนั้นยังต้องเรียนต่อได้) จึงคุมด้วยอัตราแทนเพดาน
   */
  legacyOverflow: boolean
}

/** คำนวณล้วน ๆ แยกไว้ให้เทสต์ได้โดยไม่ต้องมีฐานข้อมูล */
export function roomSpaceOf(count: number, override?: number | null): RoomSpace {
  const capacity = classroomCapacity(override)
  return {
    capacity,
    count,
    remaining: Math.max(0, capacity - count),
    full: count >= capacity,
    legacyOverflow: count > capacity,
  }
}

/**
 * ห้องเก่าที่เกินเพดานอยู่แล้วรับคนใหม่ได้กี่คนต่อ 10 นาที
 *
 * ตั้งให้สูงกว่าห้องเรียนจริงที่กดพร้อมกันต้นคาบ (20-40 คน) จะได้ไม่มีคาบไหนสะดุด
 * แต่ยังปิดการยิงรัวไม่จำกัดซึ่งเป็นตัวช่องโหว่จริง
 */
export const LEGACY_ROOM_JOIN_BURST = 45

/**
 * นับหัวในห้องแบบไม่ดึงแถวกลับมา (`head: true`) — เส้นนี้ถูกยิงทุกครั้งที่มีคนเข้าห้อง
 * ต้นคาบมีคนกดพร้อมกันทั้งห้อง จึงต้องเบาที่สุดเท่าที่ทำได้
 */
export async function roomSpace(classroomId: string, override?: number | null): Promise<RoomSpace> {
  const { count, error } = await getServiceClient()
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('classroom_id', classroomId)

  if (error) throw new Error(`[classroom-capacity] นับจำนวนนักเรียนไม่สำเร็จ: ${error.message}`)
  return roomSpaceOf(count ?? 0, override)
}

const UNIQUE_VIOLATION = '23505'

export type AdmitResult =
  | { ok: true; student: Student }
  /** ชื่อนี้มีคนใช้แล้วในห้องนี้ — **ไม่สร้างแถวใหม่ และไม่เติมเลขท้ายให้** */
  | { ok: false; reason: 'nickname-taken' }

/**
 * รับนักเรียนใหม่เข้าห้องด้วย "ชื่อที่พิมพ์มาเป๊ะ ๆ" เท่านั้น
 *
 * ต่างจาก `repo.joinClassroom()` ที่ชนแล้วเติมเลขท้ายให้เอง (นัท -> นัท2 -> นัท3)
 * การเติมเลขให้เงียบ ๆ ทำให้ทุกคำขอ "สำเร็จ" เสมอ = ยิงชื่อเดิมซ้ำกี่ครั้งก็ได้แถวใหม่ทุกครั้ง
 * ที่นี่จึงพึ่ง `unique (classroom_id, nickname)` ตรง ๆ ให้ฐานข้อมูลเป็นคนตัดสิน
 * ซึ่งกันสองเครื่องที่กดพร้อมกันเป๊ะได้ด้วย (คนที่สองได้ 23505 ไม่ใช่ได้ชื่อเพี้ยน)
 */
export async function admitStudent(input: {
  classroomId: string
  nickname: string
  pinHash: string
}): Promise<AdmitResult> {
  const nickname = input.nickname.trim()
  if (nickname.length === 0) throw new Error('[classroom-capacity] ชื่อเล่นว่าง')

  const row: TablesInsert<'students'> = {
    classroom_id: input.classroomId,
    nickname,
    pin_hash: input.pinHash,
    device_token: null,
  }

  const { data, error } = await getServiceClient().from('students').insert(row).select().single()
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: 'nickname-taken' }
    throw new Error(`[classroom-capacity] เพิ่มนักเรียนไม่สำเร็จ: ${error.message}`)
  }
  return { ok: true, student: data }
}

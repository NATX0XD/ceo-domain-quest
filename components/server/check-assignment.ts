import { assignCheckSet, joinIndexOf, type CheckSetAssignment } from '@/core/check-set'
import { getServiceClient } from '@/lib/db/client'
import { checkSetIds } from '@/components/server/check-questions'

/**
 * S-05 แจกชุดคำถามเช็กความเข้าใจ A/B — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ตรรกะการแจกอยู่ที่ `core/check-set.ts` (ฟังก์ชันล้วน ไม่สุ่ม ไม่อ่านเวลา) ที่นี่ทำแค่
 * หา "ลำดับการเข้าห้อง" มาป้อนให้ เพื่อให้คนที่นั่งติดกันได้คนละชุดจริง
 *
 * ⚠️ **ต้องคงที่ต่อคน** คนเดิมเข้าใหม่ ปิดแท็บ เน็ตหลุด ต้องได้ชุดเดิมเสมอ
 *    ลำดับมาจาก `students.created_at` ซึ่งไม่เปลี่ยนอีกแล้วหลังเข้าห้อง
 *    เพื่อนคนหลังเข้ามาเพิ่มก็ไม่ดันลำดับของคนก่อนหน้า
 * ⚠️ อ่านลำดับไม่ได้ (คิวรีล้ม/ไม่เจอตัวเอง) ไม่ใช่เรื่องคอขาดบาดตาย —
 *    ตกไปใช้รหัสผู้เรียนคำนวณแทน ซึ่งยังคงที่ต่อคนเหมือนกัน
 */

/** รหัสผู้เรียนทั้งห้องเรียงตามเวลาเข้าห้อง — คนแรกของห้องอยู่ลำดับ 0 */
export async function classroomJoinOrder(classroomId: string): Promise<string[]> {
  const { data, error } = await getServiceClient()
    .from('students')
    .select('id, created_at')
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw new Error(`classroomJoinOrder: ${error.message}`)
  return (data ?? []).map((row) => row.id)
}

/**
 * ชุดคำถามของผู้เรียนคนนี้ — ใช้ทั้งตอนส่งโจทย์ไปหน้าจอและตอนตรวจคำตอบ
 * **ต้องเป็นชุดเดียวกันทั้งสองจังหวะ** ไม่งั้นเฉลยกับโจทย์คนละชุดกัน
 */
export async function checkSetForStudent(
  studentId: string,
  classroomId: string,
): Promise<CheckSetAssignment> {
  const setIds = checkSetIds()

  let joinIndex: number | null = null
  try {
    joinIndex = joinIndexOf(studentId, await classroomJoinOrder(classroomId))
  } catch {
    joinIndex = null
  }

  return assignCheckSet({ studentId, joinIndex, setIds })
}

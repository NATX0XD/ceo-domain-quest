import { getServiceClient } from '@/lib/db/client'
import type { ClassSession } from '@/lib/db/repo'

/**
 * สวิตช์แบบทดสอบก่อน/หลังเรียนของคาบ (T-12) — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ฝั่ง DB เพิ่งเพิ่มคอลัมน์ `pretest_enabled` / `posttest_enabled` มาให้
 * แต่ RPC `update_session_settings` ยังรับแค่ ai/allowEarlyBoss/survey/homeDeadline
 * จึงอัปเดต 2 คอลัมน์นี้ตรง ๆ ที่นี่ไปก่อน **พร้อมตรวจเจ้าของห้องในคิวรีเดียวกัน**
 * ⚠️ ถ้าฝั่ง DB เพิ่มพารามิเตอร์ใน RPC เมื่อไร ให้ย้ายไปใช้ RPC แล้วลบไฟล์นี้ทิ้ง
 */
export type TestSwitch = 'pretest' | 'posttest'

export async function setTestEnabled(
  teacherId: string,
  sessionId: string,
  kind: TestSwitch,
  enabled: boolean,
): Promise<ClassSession | null> {
  const client = getServiceClient()

  // ตรวจว่าคาบนี้อยู่ในห้องของครูคนนี้จริงก่อนแตะข้อมูล
  const owner = await client
    .from('class_sessions')
    .select('id, classrooms!inner(teacher_id)')
    .eq('id', sessionId)
    .eq('classrooms.teacher_id', teacherId)
    .maybeSingle()

  if (owner.error) throw new Error(`setTestEnabled(owner): ${owner.error.message}`)
  if (!owner.data) return null

  const patch =
    kind === 'pretest' ? { pretest_enabled: enabled } : { posttest_enabled: enabled }
  const { data, error } = await client
    .from('class_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) throw new Error(`setTestEnabled: ${error.message}`)
  return data
}

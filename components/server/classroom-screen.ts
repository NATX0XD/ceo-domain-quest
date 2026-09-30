import { getServiceClient } from '@/lib/db/client'

/**
 * ตัวเลขรวมของห้องสำหรับ **จอหน้าห้อง** (T-04) — ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * ⚠️ กฎเหล็ก: ทุกค่าที่ออกจากไฟล์นี้เป็น **ภาพรวมของห้อง** ห้ามมีชื่อคนคู่กับคะแนน/ดาว/สถานะรายคน
 *    (สเปก T-04 · หลักไม่มีกระดานจัดอันดับ) ผลงานที่ขึ้นจอมีแค่ชื่อเว็บกับเหตุผล ไม่มีเจ้าของ
 * ⚠️ ผู้เรียกต้องตรวจสิทธิ์เจ้าของห้องมาก่อนแล้ว (route ใช้ getTeacherBoardWithFlags ตรวจให้)
 */

export interface ClassroomScreenStats {
  /** จำนวนคนที่เข้าห้องแล้ว */
  joined: number
  /** จำนวนภารกิจที่ผ่านรวมกันทั้งห้อง (ไม่ใช่จำนวนคน — จะได้นับไม่ได้ว่าใครยังไม่ขยับ) */
  missionsPassed: number
  /** จำนวนใบเสนอของภารกิจใหญ่ที่ส่งเข้ามาแล้ว */
  submitted: number
}

export interface ScreenShowcaseItem {
  domain: string
  reason: string
}

export async function classroomScreenStats(classroomId: string): Promise<ClassroomScreenStats> {
  const client = getServiceClient()

  const students = await client
    .from('students')
    .select('id', { count: 'exact' })
    .eq('classroom_id', classroomId)
  if (students.error) throw new Error(`classroomScreenStats(students): ${students.error.message}`)

  const ids = (students.data ?? []).map((row) => row.id)
  if (ids.length === 0) return { joined: 0, missionsPassed: 0, submitted: 0 }

  const [passed, submissions] = await Promise.all([
    client
      .from('mission_progress')
      .select('student_id', { count: 'exact', head: true })
      .in('student_id', ids)
      .not('passed_at', 'is', null),
    client
      .from('submissions')
      .select('student_id', { count: 'exact', head: true })
      .in('student_id', ids)
      .not('emphasis_criterion', 'is', null),
  ])

  if (passed.error) throw new Error(`classroomScreenStats(passed): ${passed.error.message}`)
  if (submissions.error) {
    throw new Error(`classroomScreenStats(submissions): ${submissions.error.message}`)
  }

  return {
    joined: students.count ?? ids.length,
    missionsPassed: passed.count ?? 0,
    submitted: submissions.count ?? 0,
  }
}

/**
 * ผลงานที่ขึ้นจอตอนครูสรุป — **ไม่มีชื่อเจ้าของ ไม่มีดาว ไม่มีคะแนน**
 * เลือกจากใบล่าสุดของห้อง ไม่ได้เรียงตามคะแนน (ห้ามกลายเป็นตารางอันดับ)
 */
export async function classroomScreenShowcase(
  classroomId: string,
  limit = 3,
): Promise<ScreenShowcaseItem[]> {
  const client = getServiceClient()
  const students = await client.from('students').select('id').eq('classroom_id', classroomId)
  if (students.error) throw new Error(`classroomScreenShowcase: ${students.error.message}`)

  const ids = (students.data ?? []).map((row) => row.id)
  if (ids.length === 0) return []

  const { data, error } = await client
    .from('submissions')
    .select('domain_name, tld, reason_text')
    .in('student_id', ids)
    .not('emphasis_criterion', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`classroomScreenShowcase: ${error.message}`)

  return (data ?? []).map((row) => ({
    domain: `${row.domain_name}${row.tld}`,
    reason: row.reason_text ?? '',
  }))
}

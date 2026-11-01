import { getProfile } from '@/lib/db/repo'
import { posttestGate, pretestGate } from '@/components/server/posttest-gate'

/**
 * ป้ายเตือนแบบทดสอบบนหน้า /home และ /map
 *  - ก่อนเรียน (ยังไม่ผ่านภารกิจไหน) และยังไม่ได้ทำ pretest -> เชิญทำ (ครูยังไม่เปิด = บอกว่ารอ)
 *  - ครูเปิด posttest แล้วและยังไม่ได้ทำ -> เชิญทำ
 * ตัดสินจากฐานข้อมูลและสวิตช์ของครูเท่านั้น
 */
export type TestNudge = {
  kind: 'pretest' | 'posttest'
  href: string
  title: string
  /** true = ครูยังไม่เปิด ทำไม่ได้ตอนนี้ */
  waiting: boolean
}

export async function loadTestNudge(
  studentId: string,
  missionsPassed: number,
): Promise<TestNudge | null> {
  const profile = await getProfile(studentId)
  if (profile && profile.post_test_score === null) {
    const post = await posttestGate(studentId)
    if (post.open) {
      return { kind: 'posttest', href: '/posttest', title: 'แบบทดสอบหลังเรียน', waiting: false }
    }
  }
  if (missionsPassed === 0 && (!profile || profile.pre_test_score === null)) {
    const pre = await pretestGate(studentId)
    return { kind: 'pretest', href: '/pretest', title: 'แบบทดสอบก่อนเรียน', waiting: !pre.open }
  }
  return null
}

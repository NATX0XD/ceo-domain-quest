import { getProfile } from '@/lib/db/repo'
import { posttestGate, pretestGate } from '@/components/server/posttest-gate'

/**
 * ป้ายเตือนแบบทดสอบบนหน้า /home และ /map
 *  - ยังไม่ได้ทำ pretest -> เชิญทำ (ครูยังไม่เปิด = บอกว่ารอ) · ภารกิจล็อกจนกว่าจะส่ง
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

export async function loadTestNudge(studentId: string): Promise<TestNudge | null> {
  const profile = await getProfile(studentId)
  if (profile && profile.post_test_score === null) {
    const post = await posttestGate(studentId)
    if (post.open) {
      return { kind: 'posttest', href: '/posttest', title: 'แบบทดสอบหลังเรียน', waiting: false }
    }
  }
  // ต้องทำแบบทดสอบก่อนเรียนก่อนเข้าภารกิจ (components/server/pretest-required.ts) — เตือนจนกว่าจะส่ง
  if (!profile || profile.pre_test_score === null) {
    const pre = await pretestGate(studentId)
    return { kind: 'pretest', href: '/pretest', title: 'แบบทดสอบก่อนเรียน', waiting: !pre.open }
  }
  return null
}

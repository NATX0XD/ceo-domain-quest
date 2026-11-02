import { getProfile, listSubmissions } from '@/lib/db/repo'
import { posttestGate, pretestGate } from '@/components/server/posttest-gate'

/**
 * ป้ายเตือนแบบทดสอบบนหน้า /home และ /map
 *  - ยังไม่ได้ทำ pretest -> เชิญทำ (ครูยังไม่เปิด = บอกว่ารอ) · ภารกิจล็อกจนกว่าจะส่ง
 *  - ส่งใบเสนอ CEO แล้ว (หรือครูเปิด posttest) และยังไม่ได้ทำ -> เชิญทำ
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
    /**
     * ประตูหลังเรียนเปิดเองหลังทำชุดก่อนเรียน — แต่ป้ายเชิญขึ้นเมื่อส่งใบเสนอ CEO แล้ว
     * (หรือครูกดเปิดเอง) ไม่งั้นป้ายจะชวนทำข้อสอบหลังเรียนตั้งแต่ยังไม่ได้เรียน
     */
    const finishedBoss =
      post.open && post.byTeacher !== true
        ? (await listSubmissions(studentId).catch(() => [])).some(
            (row) => row.emphasis_criterion !== null,
          )
        : false
    if (post.open && (post.byTeacher === true || finishedBoss)) {
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

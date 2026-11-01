/**
 * ประตูของหน้าทบทวนตัวเอง — ทบทวนได้หลังส่งแบบทดสอบหลังเรียนแล้วเท่านั้น
 * ลำดับคาบ: ภารกิจ -> บอส -> แบบทดสอบหลังเรียน -> ทบทวน -> จบ
 * ตรรกะล้วน ไม่แตะฐานข้อมูล · ตัดสินที่เซิร์ฟเวอร์ (app/reflect/page.tsx และ /api/reflect)
 */
export function reflectUnlocked(
  profile: { post_test_score: number | null } | null | undefined,
): boolean {
  return profile?.post_test_score !== null && profile?.post_test_score !== undefined
}

export const REFLECT_LOCKED_MESSAGE = 'ทำแบบทดสอบหลังเรียนให้เสร็จก่อน แล้วค่อยมาทบทวนตัวเองนะ'

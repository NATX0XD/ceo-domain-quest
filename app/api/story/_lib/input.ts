import { loadShopProfile } from '@/components/server/game-state'
import { getStudent } from '@/lib/db/repo'
import type { StoryInput } from '@/lib/ai/types'

/**
 * ประกอบข้อมูลตั้งต้นของเรื่องราวจากสิ่งที่ผู้เรียนกรอกไว้แล้ว — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ทุกช่องเป็นของที่มีอยู่แล้วตอนตั้งค่าร้านเสร็จ จึงฝากงานแต่งเรื่องได้ทันทีที่จุดนั้น
 * และผู้เรียนไม่ต้องกรอกอะไรเพิ่มเลย
 *
 * คืน null เมื่อยังตั้งค่าร้านไม่เสร็จ ผู้เรียกต้องถือว่า "ยังไม่ถึงเวลาแต่งเรื่อง" ไม่ใช่ error
 */
export async function buildStoryInput(studentId: string): Promise<StoryInput | null> {
  const [student, shop] = await Promise.all([getStudent(studentId), loadShopProfile(studentId)])
  if (!shop) return null

  const brandName = shop.shopName.trim()
  if (brandName.length === 0) return null

  return {
    studentId,
    missionId: 'm1',
    role: 'storyteller',
    nickname: student?.nickname ?? '',
    brandName,
    businessTypeId: shop.businessTypeId || undefined,
    isRegisteredCompany: shop.isRegisteredCompany,
    // กลุ่มลูกค้าเดิมของร้าน ใช้เลือกถ้อยคำในเรื่อง ไม่ใช่กลุ่มลูกค้าใหม่ของแม่แบบ B-T3
    customers: shop.audience === 'international' ? 'ลูกค้าไทยและต่างชาติ' : 'ลูกค้าคนไทย',
    /**
     * ต้องส่งเสมอ ไม่งั้นแม่แบบ B-T3 จะได้ประโยคซ้ำคำว่า
     * "มีลูกค้ากลุ่มใหม่ คือลูกค้ากลุ่มใหม่" เพราะ fillPlaceholders() ตกไปใช้คำกลาง ๆ
     */
    newCustomerGroup: newCustomerGroupFor(shop.audience),
  }
}

/**
 * กลุ่มลูกค้าใหม่ของแม่แบบ B-T3 — ตารางแปลงอยู่ใน content/big-mission.json
 * เขียนไว้ตรงนี้เป็นตัวสำรองแบบย่อ เผื่อผู้เรียกไม่ได้อ่านไฟล์เนื้อหา
 */
export function newCustomerGroupFor(audience: 'thai' | 'international'): string {
  return audience === 'international'
    ? 'ลูกค้าคนไทยที่ชอบพิมพ์ภาษาไทย'
    : 'ลูกค้าทั่วประเทศที่สั่งซื้อออนไลน์'
}

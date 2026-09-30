import { buildStoryInput } from '@/app/api/story/_lib/input'
import {
  drainStoriesInBackground,
  enqueueStory,
  storyItemFor,
} from '@/app/api/story/_lib/runner'

/**
 * E-07 + S-16 บทเปิดภารกิจเฉพาะคน — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * หน้าภารกิจเรนเดอร์บทเปิดจากที่นี่ **ครั้งเดียวตอนเปิดหน้า** แล้วถือไว้จนเปลี่ยนภารกิจ
 * (สเปก E-07 ห้ามสลับข้อความระหว่างที่ผู้เรียนกำลังอ่านอยู่ — ถ้าไป fetch ฝั่งเบราว์เซอร์
 *  แล้วข้อความเปลี่ยนกลางคัน เด็กจะอ่านค้างแล้วงงว่าโจทย์เปลี่ยนตอนไหน)
 *
 * **สัญญาข้อเดียวที่ห้ามผิด: คืนข้อความที่อ่านได้เสมอ ผู้เรียนห้ามนั่งรอ**
 * - คิวเสร็จแล้ว → เรื่องที่ AI แต่งให้ร้านของเขาโดยเฉพาะ
 * - ยังไม่เสร็จ / AI ล่ม / อ่านคิวไม่ได้ → ประโยคสำรองที่เติมชื่อร้านจริงแล้ว หรือบทเปิดกลางของภารกิจ
 * - ยังไม่เคยฝากงาน → ฝากให้ตรงนี้ (ตาข่ายรับ) แล้วคืนประโยคสำรองในรอบเดียวกัน
 *   ทางเข้าหลักคือตอนตั้งค่าร้านเสร็จที่ POST /api/profile
 *
 * ตรรกะเดียวกับ `GET /api/mission/[id]/story` ซึ่งยังเปิดไว้ให้เรียกจากที่อื่นได้เหมือนเดิม
 */

export interface MissionStory {
  text: string
  /** true = เรื่องที่ AI แต่งให้ร้านนี้โดยเฉพาะ · false = ประโยคสำรอง */
  personalized: boolean
  source: string
  /** เหตุผลที่ยังไม่ได้เรื่องเฉพาะคน — ใช้ตอนตรวจสอบ ไม่ได้แสดงให้ผู้เรียนเห็น */
  reason: string | null
}

/** รหัสเรื่องใน content/story-seeds.json ของภารกิจย่อย: m1 → M1 (ตรงกับ route เดิม) */
function storyIdForMission(missionId: string): string {
  return missionId.toUpperCase()
}

export async function missionStoryFor(
  studentId: string,
  mission: { id: string; intro: string },
): Promise<MissionStory> {
  const fallback = (reason: string): MissionStory => ({
    text: mission.intro,
    personalized: false,
    source: 'lesson-content',
    reason,
  })

  let input
  try {
    input = await buildStoryInput(studentId)
  } catch {
    return fallback('shop-unavailable')
  }

  // ยังไม่ตั้งค่าร้าน = ยังไม่มีชื่อร้านให้ใส่ในเรื่อง ใช้บทเปิดกลางของภารกิจไปก่อน
  if (!input) return fallback('shop-not-ready')

  try {
    const { reused } = await enqueueStory(studentId, input)
    if (!reused) drainStoriesInBackground(3)

    const item = await storyItemFor(studentId, storyIdForMission(mission.id), input)
    return {
      text: item.text,
      personalized: item.source === 'ai',
      source: item.source,
      reason: item.fallbackReason ?? null,
    }
  } catch {
    return fallback('queue-unavailable')
  }
}

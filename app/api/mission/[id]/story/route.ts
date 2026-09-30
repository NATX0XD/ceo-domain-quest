import { NextResponse } from 'next/server'
import { findMission } from '@/components/missions'
import { readStudentSession, unauthorized } from '../../../_lib/session-cookie'
import { buildStoryInput } from '../../../story/_lib/input'
import {
  drainStoriesInBackground,
  enqueueStory,
  storyItemFor,
} from '../../../story/_lib/runner'

/**
 * S-16 เรื่องเปิดของภารกิจนี้ เฉพาะของผู้เรียนคนนี้
 *
 * **สัญญาข้อเดียวที่ห้ามผิด: ต้องคืนข้อความที่อ่านได้เสมอ ผู้เรียนห้ามนั่งรอ**
 * - เรื่องของ AI เสร็จแล้ว → ได้เรื่องเฉพาะร้านของตัวเอง
 * - ยังไม่เสร็จ หรือ AI ใช้ไม่ได้ → ได้ประโยคสำรองที่เติมชื่อร้านจริงแล้วทันที
 * - ยังไม่เคยฝากงานเลย → **ฝากให้ตรงนี้เลย** แล้วคืนประโยคสำรองในคำขอเดียวกัน
 *   (ทางเข้าหลักคือ POST /api/story ตอนตั้งค่าร้านเสร็จ ตรงนี้เป็นตาข่ายรับ
 *    เผื่อผู้เรียนเข้าภารกิจโดยไม่ผ่านทางนั้น เช่นกดลิงก์ตรงหรือกลับเข้ามาใหม่คนละเครื่อง)
 *
 * ห้ามสลับข้อความระหว่างที่ผู้เรียนกำลังอ่านอยู่ (สเปก E-07 ระบบสำรอง) — หน้าจอจึงควรเรียกครั้งเดียว
 * ตอนเปิดภารกิจ แล้วถือข้อความนั้นไว้จนกว่าจะเปลี่ยนภารกิจ
 *
 * ⚠️ studentId อ่านจากคุกกี้ dbq_student เท่านั้น
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** รหัสเรื่องใน content/story-seeds.json ของภารกิจย่อย: m1 → M1 */
function storyIdForMission(missionId: string): string {
  return missionId.toUpperCase()
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const { id } = await context.params
  const mission = findMission(id)
  if (!mission) {
    return NextResponse.json({ ok: false, code: 'not-found', message: 'ไม่พบภารกิจนี้' }, { status: 404 })
  }

  const storyId = storyIdForMission(mission.id)
  const input = await buildStoryInput(session.studentId)

  /**
   * ยังตั้งค่าร้านไม่เสร็จ = ยังไม่มีชื่อร้านให้ใส่ในเรื่อง
   * คืนบทเปิดกลางของภารกิจจากไฟล์เนื้อหาไปก่อน ไม่ใช่ error และไม่ใช่ช่องว่าง
   */
  if (!input) {
    return NextResponse.json({
      ok: true,
      missionId: mission.id,
      storyId,
      text: mission.intro,
      source: 'lesson-content',
      personalized: false,
      reason: 'shop-not-ready',
    })
  }

  try {
    // ตาข่ายรับ: ไม่เคยฝากงานเลยให้ฝากตรงนี้ แล้วเดินคิวแบบไม่รอผล
    const { reused } = await enqueueStory(session.studentId, input)
    if (!reused) drainStoriesInBackground(3)

    const item = await storyItemFor(session.studentId, storyId, input)

    return NextResponse.json({
      ok: true,
      missionId: mission.id,
      storyId,
      text: item.text,
      source: item.source,
      fallbackReason: item.fallbackReason ?? null,
      /** true = เรื่องที่ AI แต่งให้ร้านนี้โดยเฉพาะ · false = ประโยคสำรองที่เติมชื่อร้านแล้ว */
      personalized: item.source === 'ai',
    })
  } catch {
    // อ่านคิวไม่ได้ก็ยังต้องมีเรื่องให้อ่าน — ตกมาที่บทเปิดกลางของภารกิจ
    return NextResponse.json({
      ok: true,
      missionId: mission.id,
      storyId,
      text: mission.intro,
      source: 'lesson-content',
      personalized: false,
      reason: 'queue-unavailable',
    })
  }
}

import type { Json } from '@/lib/db/types'
import {
  ROUTE_IDS,
  type ChannelAttempt,
  type ChannelRanking,
  type RouteId,
  rankChannelsByEffectiveness,
} from '@/core/personalize'
import { getProfile, listMissionProgress, logEvent, upsertProfile } from '@/lib/db/repo'
import { findChannel } from '@/components/server/lesson-content'

/**
 * E-03 (R1/R3) เสนอช่องทางการเรียนจาก "ได้ผลจริงกับเด็กคนนี้" — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ตอนต้นคาบระบบเสนอช่องทางจากคำตอบความถนัด 5 ข้อ (`recommendRoute` ที่ /api/profile/preferences)
 * ซึ่งเป็น "สิ่งที่เด็กบอกว่าชอบ" พอทำภารกิจไปได้สักพักเรามีของจริงให้ดูแล้ว —
 * ผ่านไหม ได้กี่ดาว เปิดตัวช่วยกี่ครั้ง ใช้เวลานานแค่ไหน — `rankChannelsByEffectiveness()`
 * แปลงสิ่งเหล่านี้เป็นลำดับว่าช่องทางไหนได้ผลกับเขาจริง
 *
 * **กฎที่ห้ามผิด**
 * 1. เป็น **ข้อเสนอ** เท่านั้น ทั้ง 4 ช่องทางยังกดได้ครบทุกอันเสมอ ไม่ซ่อน ไม่ล็อก
 * 2. ยังไม่มีประวัติ = ใช้ข้อเสนอเดิมจากความถนัด ไม่เดาแทนเด็ก
 * 3. **บันทึกทั้งค่าที่ระบบเสนอกับค่าที่ผู้เรียนเลือกจริง** — ข้อเสนอลง
 *    `profiles.readiness.adaptiveChannel` (ไม่ทับ `channel_suggested` ซึ่งเป็นหลักฐานข้อเสนอแรก)
 *    ส่วนค่าที่ผู้เรียนเลือกจริงอยู่ที่ `learning_route` + ตาราง `route_changes` เหมือนเดิม
 */

export interface ChannelAdvice {
  /** ช่องทางที่ระบบเสนอตอนนี้ */
  suggested: RouteId | null
  /** เหตุผลที่เสนอ — null เมื่อยังไม่มีอะไรจะเสนอ */
  reason: string | null
  /** ลำดับครบทั้ง 4 ช่องทาง (ว่างเมื่อยังไม่มีประวัติ) */
  ranking: ChannelRanking[]
  /** จำนวนภารกิจที่มีประวัติให้ดู */
  basedOn: number
  /** true = ยังไม่มีประวัติ จึงใช้ข้อเสนอจากคำตอบความถนัดตอนต้นคาบ */
  fromPreference: boolean
}

interface AdaptiveBag {
  route?: string
  reason?: string
  basedOn?: number
}

function bagOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function secondsBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.round((end - start) / 1000)
}

/**
 * ประวัติการใช้ช่องทางของผู้เรียนคนนี้ — 1 แถวต่อ 1 ภารกิจที่ลงมือทำจริง
 *
 * นับเฉพาะภารกิจที่มี `channel_used` และลงมือแล้ว (attempts > 0 หรือผ่านแล้ว)
 * ภารกิจที่แค่เปิดดูแล้วออกไม่ถูกนับ ไม่งั้นช่องทางที่เปิดผ่าน ๆ จะถูกหักคะแนนฟรี
 */
export async function channelHistory(studentId: string): Promise<ChannelAttempt[]> {
  const rows = await listMissionProgress(studentId)
  const attempts: ChannelAttempt[] = []

  for (const row of rows) {
    const route = row.channel_used as RouteId | null
    if (!route || !ROUTE_IDS.includes(route)) continue
    const passed = row.passed_at !== null
    if (row.attempts <= 0 && !passed) continue

    attempts.push({
      route,
      passed,
      stars: row.stars,
      hintsUsed: row.hints_used,
      elapsedSeconds: secondsBetween(row.started_at, row.passed_at ?? row.updated_at),
    })
  }

  return attempts
}

function reasonFor(top: ChannelRanking, basedOn: number): string {
  const name = findChannel(top.route)?.name ?? top.route
  return `จากที่ทำมาแล้ว ${basedOn} ภารกิจ ${name} เป็นวิธีที่ได้ผลกับเรามากที่สุด ระบบจึงเสนอไว้ก่อน เปลี่ยนเป็นวิธีอื่นได้ทุกเมื่อ ไม่เสียดาว`
}

/**
 * ช่องทางที่ระบบเสนอให้ผู้เรียนคนนี้ตอนนี้
 *
 * เรียกตอนเปิดหน้าภารกิจ ข้อเสนอจึงขยับตามผลจริงระหว่างคาบ ไม่ใช่ค้างอยู่กับคำตอบตอนต้นคาบ
 * เขียนลงฐานข้อมูล **เฉพาะตอนข้อเสนอเปลี่ยน** จะได้ไม่มีอีเวนต์ซ้ำทุกครั้งที่รีเฟรชหน้า
 */
export async function suggestChannel(studentId: string): Promise<ChannelAdvice> {
  const [profile, history] = await Promise.all([
    getProfile(studentId),
    channelHistory(studentId),
  ])

  const preference = (profile?.channel_suggested as RouteId | null) ?? null

  if (history.length === 0) {
    return {
      suggested: preference,
      reason: null,
      ranking: [],
      basedOn: 0,
      fromPreference: true,
    }
  }

  const ranking = rankChannelsByEffectiveness(history)
  const top = ranking[0]
  if (!top) {
    return { suggested: preference, reason: null, ranking, basedOn: 0, fromPreference: true }
  }

  const reason = reasonFor(top, history.length)
  const readiness = bagOf(profile?.readiness)
  const previous = bagOf(readiness.adaptiveChannel) as AdaptiveBag

  if (previous.route !== top.route) {
    try {
      await upsertProfile(studentId, {
        readiness: {
          ...readiness,
          adaptiveChannel: { route: top.route, reason, basedOn: history.length },
        } as NonNullable<Json>,
      })
      // หลักฐาน adaptive: ระบบเปลี่ยนข้อเสนอเมื่อไร เพราะอะไร (ค่าที่ผู้เรียนเลือกจริงอยู่ที่ route_changes)
      await logEvent(studentId, 'channel-suggested', {
        route: top.route,
        basedOn: history.length,
        score: top.score,
        source: 'effectiveness',
      })
    } catch {
      // บันทึกหลักฐานไม่สำเร็จต้องไม่ทำให้หน้าภารกิจเปิดไม่ได้
    }
  }

  return {
    suggested: top.route,
    reason,
    ranking,
    basedOn: history.length,
    fromPreference: false,
  }
}

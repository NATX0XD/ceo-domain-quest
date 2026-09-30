import { getProfile, listMissionProgress } from '@/lib/db/repo'
import { objectiveIdForMission } from '@/components/server/lesson-content'
import {
  TOPIC_ORDER,
  type BossTemplate,
  bossTemplates,
  pickBossTemplate,
  topicAccuracy,
} from '@/core/boss-scenario'

/**
 * S-22 หาแม่แบบด่านบอสของผู้เรียนหนึ่งคน — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ลำดับความสำคัญ 3 ชั้น เรียงจากบนลงล่าง:
 * 1. **ครูสั่งไว้** `profiles.boss_template_id` มีค่า = ครูกดเลือกให้คนนี้เอง ใช้ของครูเสมอ
 *    (คอลัมน์นี้เป็นช่องทางของครูโดยเฉพาะ ระบบ **ห้ามเขียนทับ** ไม่อย่างนั้นจะดูเหมือนครูเป็นคนเลือก)
 * 2. **เรื่องที่ผู้เรียนอ่อนที่สุด** คิดจากคะแนนความแม่นรายเรื่อง 0-4 ตามกติกาใน core/boss-scenario.ts
 * 3. **ยังไม่มีข้อมูลเลย** ใช้แม่แบบที่ครอบทั้ง 4 เรื่อง
 *
 * คะแนนความแม่นประกอบจากสองสัญญาณที่ระบบเก็บอยู่แล้ว คือดาวของภารกิจนั้น
 * และผลถูก/ผิดของข้อตรวจท้ายภารกิจ (`profiles.readiness`)
 */

export interface BossTemplateResult {
  template: BossTemplate
  weakestObjectiveId: string | null
  /** ครูเลือกให้ · ระบบเลือกจากเรื่องที่อ่อนสุด · ยังไม่มีข้อมูล */
  source: 'teacher' | 'weakest-topic' | 'no-data'
  /** คะแนนความแม่นรายเรื่องที่ใช้ตัดสิน เก็บไว้ให้แผงครูอธิบายเหตุผลได้ */
  accuracyByTopic: Record<string, number>
}

function readinessMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, boolean> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'boolean') out[key] = raw
  }
  return out
}

export async function resolveBossTemplate(studentId: string): Promise<BossTemplateResult | null> {
  if (bossTemplates.length === 0) return null

  const [profile, progress] = await Promise.all([
    getProfile(studentId),
    listMissionProgress(studentId),
  ])

  const readiness = readinessMap(profile?.readiness)

  /** ดาวที่ได้ของแต่ละเรื่อง แปลงจากภารกิจเป็นจุดประสงค์ */
  const starsByTopic: Record<string, number> = {}
  for (const row of progress) {
    const objectiveId = objectiveIdForMission(row.mission_id)
    if (!objectiveId) continue
    starsByTopic[objectiveId] = Math.max(starsByTopic[objectiveId] ?? 0, row.stars ?? 0)
  }

  const accuracyByTopic: Record<string, number> = {}
  for (const topic of TOPIC_ORDER) {
    const touched = topic in starsByTopic || topic in readiness
    // เรื่องที่ยังไม่เคยแตะเลยไม่ใส่คีย์ เพื่อให้ weakestTopic() แยกออกระหว่าง "ได้ 0" กับ "ยังไม่เคยวัด"
    if (!touched) continue
    accuracyByTopic[topic] = topicAccuracy({
      checkCorrect: readiness[topic] ?? null,
      missionStars: starsByTopic[topic] ?? 0,
    })
  }

  // ชั้นที่ 1 ครูสั่งไว้
  const forced = profile?.boss_template_id
  if (typeof forced === 'string' && forced.length > 0) {
    const chosen = bossTemplates.find((t) => t.id === forced)
    if (chosen) {
      return {
        template: chosen,
        weakestObjectiveId: chosen.focusObjectiveId === 'all' ? null : chosen.focusObjectiveId,
        source: 'teacher',
        accuracyByTopic,
      }
    }
  }

  // ชั้นที่ 2 และ 3
  const picked = pickBossTemplate({
    accuracyByTopic,
    isRegisteredCompany: profile?.is_registered_company ?? null,
  })
  if (!picked) return null

  return {
    template: picked.template,
    weakestObjectiveId: picked.weakestObjectiveId,
    source: picked.reason === 'no-data' ? 'no-data' : 'weakest-topic',
    accuracyByTopic,
  }
}

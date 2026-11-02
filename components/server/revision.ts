import type { Submission } from '@/lib/db/repo'
import { rubricDimensions, toRubricDimensionId } from './lesson-content'

/**
 * ลูป "ครูให้แก้ → นักเรียนแก้แล้วส่งใหม่" (สเปกข้อ 3.3) — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ทำไมต้องมี: T40 เปลี่ยนใบประกาศเป็น "ต้องได้ระดับ 3 ครบ 4 ด้าน"
 * ถ้าแก้งานไม่ได้ คนที่ได้ 2 ด้านจะไม่มีทางได้ใบเลย ซึ่งขัดข้อความ "ไม่มีการตก ทำต่อได้" บนหน้าจอ
 *
 * เก็บยังไง (ไม่แตะ schema):
 * - คำสั่ง "ให้แก้" เก็บใน `submissions.teacher_confirmed_scores` เป็น `{ status: 'revise', ... }`
 * - นักเรียนแก้แล้วส่งใหม่ = **แถวใหม่** ใน submissions (ฉบับเดิมไม่ถูกทับ ครูเทียบได้)
 * - รอบที่เท่าไร = นับจำนวนแถวใบเสนอของภารกิจใหญ่ของคนนั้น
 */

/** ส่งกลับให้แก้ได้กี่รอบก่อนต้องให้ครูปลดล็อก — กันวนไม่จบ แต่ไม่ตัน */
export const MAX_REVISION_ROUNDS = 3

export interface RevisionRequest {
  /** ด้านที่ครูขอให้แก้ */
  dimensionIds: string[]
  note: string
  requestedAt: string | null
  /** ครูติ๊กปลดล็อกให้แก้เกินโควตาไหม */
  overrideLimit: boolean
}

export interface RevisionDimension {
  id: string
  name: string
  shortName: string
  /** คะแนนที่ครูให้ไว้ตอนสั่งแก้ (ถ้ามี) */
  score: number | null
  /** ทำอะไรถึงจะได้ 3 — descriptor ระดับ 3 จาก content/rubric.json ตรง ๆ ห้ามแต่งเอง */
  whatGetsYouThere: string
}

function bagOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** อ่านคำสั่ง "ให้แก้" ออกจากใบงาน — null = ครูไม่ได้สั่งแก้ใบนี้ */
export function revisionRequestOf(submission: Submission | null): RevisionRequest | null {
  const bag = bagOf(submission?.teacher_confirmed_scores)
  if (!bag || bag.status !== 'revise') return null

  const ids = Array.isArray(bag.reviseDimensionIds)
    ? bag.reviseDimensionIds.filter((v): v is string => typeof v === 'string')
    : []

  return {
    dimensionIds: ids.map((id) => toRubricDimensionId(id) ?? id),
    note: typeof bag.note === 'string' ? bag.note : '',
    requestedAt: typeof bag.requestedAt === 'string' ? bag.requestedAt : null,
    overrideLimit: bag.overrideLimit === true,
  }
}

/** เติมชื่อด้านกับวิธีทำให้ได้ 3 ให้ครบ เพื่อเอาไปแสดงบนหน้าเด็ก */
export function revisionDimensions(request: RevisionRequest | null): RevisionDimension[] {
  if (!request) return []
  const scores = request.dimensionIds
  return [...rubricDimensions]
    .sort((a, b) => a.order - b.order)
    .filter((d) => scores.includes(d.id))
    .map((d) => ({
      id: d.id,
      name: d.name,
      shortName: d.shortName,
      score: null,
      whatGetsYouThere: d.levels.find((l) => l.score === 3)?.descriptor ?? d.question,
    }))
}

/** ใบเสนอของภารกิจใหญ่ทุกฉบับ ใหม่สุดอยู่หน้าสุด (listSubmissions เรียง created_at DESC มาแล้ว) */
export function bigMissionSubmissions(rows: Submission[]): Submission[] {
  return rows.filter((row) => row.emphasis_criterion !== null)
}

export interface RevisionState {
  /** ฉบับล่าสุด (null = ยังไม่เคยส่ง) */
  latest: Submission | null
  /** ส่งมาแล้วกี่ฉบับ */
  versionCount: number
  /** ครูสั่งให้แก้ฉบับล่าสุดอยู่หรือเปล่า */
  request: RevisionRequest | null
  /** ส่งใหม่ได้ไหมตอนนี้ */
  canResubmit: boolean
  /** แก้มาแล้วกี่รอบ (ฉบับแรกไม่นับเป็นรอบแก้) */
  roundsUsed: number
  /** เหลือโควตาอีกกี่รอบ (นับ overrideLimit ของครูแล้ว) */
  roundsLeft: number
  /** เหตุผลที่ส่งใหม่ไม่ได้ — ใช้เป็นข้อความบอกผู้เรียน ห้ามสื่อว่าตก */
  blockedReason: string | null
}

export function revisionState(rows: Submission[], maxRevisionRounds = MAX_REVISION_ROUNDS): RevisionState {
  const versions = bigMissionSubmissions(rows)
  const latest = versions[0] ?? null
  const request = revisionRequestOf(latest)
  const roundsUsed = Math.max(0, versions.length - 1)
  const limit = request?.overrideLimit ? roundsUsed + 1 : Math.max(0, maxRevisionRounds)
  const roundsLeft = Math.max(0, limit - roundsUsed)

  if (!latest) {
    return {
      latest: null,
      versionCount: 0,
      request: null,
      canResubmit: true,
      roundsUsed: 0,
      roundsLeft: Math.max(0, maxRevisionRounds),
      blockedReason: null,
    }
  }

  if (!request) {
    return {
      latest,
      versionCount: versions.length,
      request: null,
      canResubmit: false,
      roundsUsed,
      roundsLeft,
      blockedReason:
        'ส่งใบเสนอไปแล้ว แก้เองไม่ได้ ถ้าอยากแก้ให้ยกมือบอกครู ครูจะกดส่งงานกลับมาให้แก้ได้ทันที',
    }
  }

  if (roundsLeft <= 0) {
    return {
      latest,
      versionCount: versions.length,
      request,
      canResubmit: false,
      roundsUsed,
      roundsLeft: 0,
      blockedReason:
        `แก้มาแล้ว ${roundsUsed} รอบ ครบโควตาที่ระบบเปิดไว้ ` +
        'ยกมือบอกครูได้เลย ครูกดเปิดให้แก้ต่อได้ ไม่ได้ปิดตายและคะแนนที่ทำได้แล้วไม่หายไปไหน',
    }
  }

  return {
    latest,
    versionCount: versions.length,
    request,
    canResubmit: true,
    roundsUsed,
    roundsLeft,
    blockedReason: null,
  }
}

/**
 * ก้อนที่เขียนลง teacher_confirmed_scores ตอนครูกด "ส่งกลับให้แก้"
 * เก็บคะแนนรายด้านที่ครูให้ไว้ด้วย ผู้เรียนจะได้เห็นว่าตอนนี้อยู่ตรงไหนของแต่ละด้าน
 */
export function buildRevisionBag(input: {
  dimensionIds: string[]
  dimensionScores: Record<string, number> | null
  note: string
  overrideLimit: boolean
  round: number
  at: string
}) {
  return {
    status: 'revise' as const,
    reviseDimensionIds: input.dimensionIds,
    dimensions: input.dimensionScores ?? undefined,
    note: input.note,
    overrideLimit: input.overrideLimit,
    round: input.round,
    requestedAt: input.at,
  }
}

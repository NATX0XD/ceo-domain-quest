import { type Submission, listSubmissions } from '@/lib/db/repo'
import { missions } from '@/components/missions'
import { readTeacherConfirmedScores } from '@/lib/db/submission-scores'
import { loadAllMissionRows } from './game-state'
import { rubricDimensions, toRubricDimensionId } from './lesson-content'
import { revisionRequestOf } from './revision'

/**
 * ใครได้ใบประกาศ — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * มติเจ้าของโปรเจกต์ (2 พ.ย. 2569 — แทนมติ T40 เดิม):
 * ออกใบให้ **ทันที** เมื่อผ่านภารกิจย่อยครบทุกข้อ และส่งใบเสนอ CEO แล้ว — ไม่ต้องรอครูยืนยัน
 * คะแนนที่เด็กเห็นคือคะแนนตรวจอัตโนมัติ (AI ถ้าตรวจเสร็จ ไม่งั้นคะแนนจากกฎ)
 * ครูยังยืนยัน/ปรับคะแนน/ส่งกลับให้แก้ได้ภายหลังเหมือนเดิม แต่ไม่ใช่ประตูของใบประกาศอีกต่อไป
 *
 * ⚠️ สเปกเขียนชัดว่า "ไม่มีการตก ทำต่อได้" — ทุกข้อความที่ออกจากไฟล์นี้จึงห้ามสื่อว่าตกหรือสอบไม่ผ่าน
 *    ให้บอกว่าเหลืออีกกี่ด้าน ขาดด้านไหน และทำอะไรต่อถึงจะได้ (ใช้ descriptor ระดับ 3 ของรูบริกตรง ๆ)
 * ⚠️ studentId ต้องมาจาก session cookie เสมอ ห้ามรับจาก query หรือ body
 */

/** คะแนนขั้นต่ำต่อด้านที่ถือว่าผ่านรูบริก (รูบริกเต็ม 3 ต่อด้าน) */
export const PASS_LEVEL = 3

export type CertificateStatus =
  /** ยังไม่ได้ส่งใบเสนอของภารกิจใหญ่ */
  | 'not-submitted'
  /** ส่งแล้ว แต่ครูยังไม่ได้ยืนยันคะแนน */
  | 'pending-teacher'
  /** ครูยืนยันแล้ว แต่ยังมีด้านที่ไม่ถึงระดับ 3 — ยังทำต่อได้ ไม่ใช่ตก */
  | 'keep-going'
  /** ผ่านครบทุกด้าน ออกใบได้ */
  | 'passed'

export interface DimensionStanding {
  id: string
  name: string
  shortName: string
  /** คะแนนที่ครูยืนยัน (null = ครูยังไม่ได้ให้ด้านนี้) */
  score: number | null
  passed: boolean
  /** ทำอะไรถึงจะได้ระดับ 3 — ข้อความจากรูบริกโดยตรง ไม่ได้แต่งเอง */
  whatGetsYouThere: string
}

/** คะแนนใบเสนอ CEO ที่แสดงให้ผู้เรียนเห็น — ครูยืนยัน > AI ตรวจเสร็จ > กฎ */
export interface CeoScore {
  source: 'teacher' | 'ai' | 'rules'
  weightedTotal: number
  weightedMax: number
  percent: number
  /** true = AI ยังตรวจอยู่ (ตอนนี้โชว์คะแนนจากกฎไปก่อน) */
  grading: boolean
}

export interface CertificateEligibility {
  status: CertificateStatus
  eligible: boolean
  /** ภารกิจย่อยผ่านครบทุกข้อแล้วหรือยัง */
  missionsDone: boolean
  /** คะแนนใบเสนอ CEO ล่าสุด (null = ยังไม่ส่ง) */
  score: CeoScore | null
  dimensions: DimensionStanding[]
  /** ด้านที่ยังไม่ถึงระดับ 3 */
  missing: DimensionStanding[]
  passedCount: number
  totalCount: number
  /** ข้อความที่แสดงให้ผู้เรียนเห็น — ให้กำลังใจเสมอ ไม่มีคำว่าตก */
  message: string
  /** ปุ่มถัดไปที่ควรกด */
  nextHref: string
  nextLabel: string
}

function readDimensionScores(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const bag = (value as Record<string, unknown>).dimensions
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return null

  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(bag as Record<string, unknown>)) {
    if (typeof raw !== 'number') continue
    // ของเก่าอาจเก็บเป็น bm-r* — แปลงให้เป็น dim-* ก่อนเทียบเสมอ
    const id = toRubricDimensionId(key) ?? key
    out[id] = raw
  }
  return Object.keys(out).length > 0 ? out : null
}

function standing(scores: Record<string, number> | null): DimensionStanding[] {
  return [...rubricDimensions]
    .sort((a, b) => a.order - b.order)
    .map((d) => {
      const score = scores?.[d.id] ?? null
      return {
        id: d.id,
        name: d.name,
        shortName: d.shortName,
        score,
        passed: score !== null && score >= PASS_LEVEL,
        whatGetsYouThere:
          d.levels.find((l) => l.score === PASS_LEVEL)?.descriptor ?? d.question,
      }
    })
}

/**
 * สถานะใบประกาศของนักเรียนคนนี้ — อ่านฐานข้อมูลให้แล้วส่งต่อให้ตัวคิดล้วน ๆ ข้างล่าง
 * อ่านจากใบเสนอของภารกิจใหญ่ (แถวที่มี emphasis_criterion) เท่านั้น
 * ใบของสถานี B ไม่นับ เพราะเป็นคนละงานกัน
 */
export async function certificateEligibility(studentId: string): Promise<CertificateEligibility> {
  const [rows, missionRows] = await Promise.all([listSubmissions(studentId), loadAllMissionRows(studentId)])
  return certificateStandingOf(rows, { missionsDone: allMissionsPassed(missionRows) })
}

/** ภารกิจย่อยทุกข้อผ่านแล้ว (ครูกดข้ามให้ก็นับเป็นผ่าน) */
export function allMissionsPassed(rowsById: ReadonlyMap<string, { passed: boolean }>): boolean {
  return missions.every((m) => rowsById.get(m.id)?.passed === true)
}

function bagOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function totalsOf(bag: Record<string, unknown> | null): { total: number; max: number } | null {
  if (!bag) return null
  const total = bag.weightedTotal ?? bag.score
  const max = bag.weightedMax ?? bag.maxScore
  if (typeof total !== 'number' || typeof max !== 'number' || !Number.isFinite(total) || !(max > 0)) return null
  return { total, max }
}

/**
 * คะแนนที่ผู้เรียนเห็น — ครูยืนยันแล้วใช้ของครู · AI ตรวจเสร็จใช้ของ AI · นอกนั้นใช้คะแนนจากกฎ
 * (คะแนนจากกฎบันทึกตั้งแต่ตอนกดส่งเสมอ จึงไม่มีวันว่าง)
 */
export function ceoScoreOf(ceo: Submission | null): CeoScore | null {
  if (!ceo) return null
  const make = (source: CeoScore['source'], t: { total: number; max: number }, grading = false): CeoScore => ({
    source,
    weightedTotal: t.total,
    weightedMax: t.max,
    percent: Math.max(0, Math.min(100, Math.round((t.total / t.max) * 100))),
    grading,
  })
  const teacher = readTeacherConfirmedScores(ceo)
  if (teacher && teacher.weightedTotal !== null && teacher.weightedMax) {
    return make('teacher', { total: teacher.weightedTotal, max: teacher.weightedMax })
  }
  const ai = bagOf(ceo.ai_scores)
  const aiTotals = totalsOf(bagOf(ai?.aiProposed))
  if (ai?.gradingStatus === 'done' && aiTotals) return make('ai', aiTotals)
  const rules = totalsOf(bagOf(ai?.ruleScores)) ?? totalsOf(ai)
  if (!rules) return null
  return make('rules', rules, ai?.gradingStatus === 'pending-ai')
}

/**
 * ตัวคิดล้วน ๆ — รับแถว `submissions` ที่อ่านมาแล้ว ไม่แตะฐานข้อมูลเอง
 *
 * แยกออกมาเพื่อให้ `GET /api/grade/status` ที่ถูก poll ทุกไม่กี่วินาที
 * อ่านฐานข้อมูล **ครั้งเดียว** แล้วใช้แถวชุดเดิมคิดทั้งสถานะการตรวจและสถานะใบประกาศ
 * (ถ้าเรียก `certificateEligibility()` ตรง ๆ จะกลายเป็นอ่านซ้ำสองรอบต่อการ poll หนึ่งครั้ง)
 */
export function certificateStandingOf(
  rows: readonly Submission[],
  opts: { missionsDone?: boolean } = {},
): CertificateEligibility {
  const ceo = rows.find((row) => row.emphasis_criterion !== null) ?? null
  const missionsDone = opts.missionsDone ?? true

  if (!ceo) {
    return {
      status: 'not-submitted',
      eligible: false,
      missionsDone,
      score: null,
      dimensions: standing(null),
      missing: standing(null),
      passedCount: 0,
      totalCount: rubricDimensions.length,
      message:
        'ยังไม่ได้ส่งใบเสนอชื่อเว็บ ส่งเมื่อไรก็ได้ ไม่มีหมดเวลา ส่งแล้วครูจะอ่านให้แล้วบอกว่าต่อยอดตรงไหนได้อีก',
      nextHref: '/ceo',
      nextLabel: 'ไปทำใบเสนอชื่อเว็บ',
    }
  }

  const scores = readDimensionScores(ceo.teacher_confirmed_scores)
  const dimensions = standing(scores)
  const score = ceoScoreOf(ceo)
  /** ส่งใบเสนอแล้ว + ภารกิจย่อยครบ = ได้ใบทันที ครูจะยืนยัน/ปรับ/สั่งแก้ทีหลังก็ไม่ดึงใบคืน */
  const eligible = missionsDone
  const certNext = eligible
    ? { nextHref: '/api/certificate', nextLabel: 'ดาวน์โหลดเกียรติบัตร' }
    : { nextHref: '/map', nextLabel: 'ทำภารกิจย่อยให้ครบ' }
  const missing = dimensions.filter((d) => !d.passed)
  const passedCount = dimensions.length - missing.length

  /**
   * ครูกด "ส่งกลับให้แก้" = ยังไม่ใช่คะแนนสุดท้าย ต้องเป็น keep-going เสมอ
   * แม้ครูจะเผลอให้ 3 ครบทุกด้านตอนสั่งแก้ก็ตาม (สถานะนำหน้าคะแนน)
   */
  const revision = revisionRequestOf(ceo)
  if (revision) {
    const asked = dimensions.filter((d) => revision.dimensionIds.includes(d.id))
    const toFix = asked.length > 0 ? asked : missing
    const names = toFix.map((d) => d.shortName).join(' และ ')
    return {
      status: 'keep-going',
      eligible,
      missionsDone,
      score,
      dimensions,
      missing: toFix,
      passedCount: dimensions.length - toFix.length,
      totalCount: dimensions.length,
      message:
        (names ? `ครูส่งงานกลับมาให้แก้ ${toFix.length} ด้านคือ ${names} ` : 'ครูส่งงานกลับมาให้แก้ ') +
        (revision.note ? `· ครูบอกว่า "${revision.note}" ` : '') +
        'แก้แล้วส่งใหม่ได้เลย ฉบับเดิมยังอยู่ ครูจะเห็นว่าเราพัฒนาตรงไหน',
      nextHref: '/ceo',
      nextLabel: 'ไปแก้งานแล้วส่งใหม่',
    }
  }

  if (ceo.teacher_confirmed_scores === null) {
    return {
      status: 'pending-teacher',
      eligible,
      missionsDone,
      score,
      dimensions,
      missing,
      passedCount: 0,
      totalCount: dimensions.length,
      message: eligible
        ? 'ส่งงานเรียบร้อย ระบบตรวจให้แล้ว รับเกียรติบัตรได้เลย'
        : 'ส่งงานเรียบร้อยแล้ว เหลือภารกิจย่อยอีกนิด ทำให้ครบแล้วรับเกียรติบัตรได้ทันที',
      ...certNext,
    }
  }

  if (missing.length === 0) {
    return {
      status: 'passed',
      eligible,
      missionsDone,
      score,
      dimensions,
      missing,
      passedCount,
      totalCount: dimensions.length,
      message: 'ครูยืนยันแล้วว่าทำได้ครบทั้ง 4 ด้าน ใบประกาศเป็นของเราแล้ว',
      ...certNext,
    }
  }

  /**
   * ยังไม่ครบ — ข้อความต้องบอก 3 อย่าง: ทำได้แล้วกี่ด้าน · เหลือด้านไหน · แก้แล้วส่งใหม่ได้
   * ห้ามใช้คำว่า "ไม่ผ่าน" หรือ "ตก" (สเปกข้อ 2.3)
   */
  const names = missing.map((d) => d.shortName).join(' และ ')
  return {
    status: 'keep-going',
    eligible,
    missionsDone,
    score,
    dimensions,
    missing,
    passedCount,
    totalCount: dimensions.length,
    message:
      `ทำได้แล้ว ${passedCount} จาก ${dimensions.length} ด้าน เหลืออีก ${missing.length} ด้านคือ ${names} ` +
      'แก้แล้วบอกครูให้ดูใหม่ได้เลย ไม่มีคำว่าสาย และคะแนนที่ทำได้แล้วไม่หายไปไหน',
    nextHref: '/ceo',
    nextLabel: 'กลับไปแก้งานของฉัน',
  }
}

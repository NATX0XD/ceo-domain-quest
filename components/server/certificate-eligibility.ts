import { type Submission, listSubmissions } from '@/lib/db/repo'
import { rubricDimensions, toRubricDimensionId } from './lesson-content'
import { revisionRequestOf } from './revision'

/**
 * ใครได้ใบประกาศ — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * มติเจ้าของโปรเจกต์ (สเปกข้อ 2.3 Competency-Based Progression + ข้อ 1.6 จุดประสงค์ข้อ 5):
 * ออกใบให้เมื่อ **ครูยืนยันคะแนนแล้ว และได้ระดับ 3 ขึ้นไปครบทั้ง 4 ด้าน** เท่านั้น
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

export interface CertificateEligibility {
  status: CertificateStatus
  eligible: boolean
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
  return certificateStandingOf(await listSubmissions(studentId))
}

/**
 * ตัวคิดล้วน ๆ — รับแถว `submissions` ที่อ่านมาแล้ว ไม่แตะฐานข้อมูลเอง
 *
 * แยกออกมาเพื่อให้ `GET /api/grade/status` ที่ถูก poll ทุกไม่กี่วินาที
 * อ่านฐานข้อมูล **ครั้งเดียว** แล้วใช้แถวชุดเดิมคิดทั้งสถานะการตรวจและสถานะใบประกาศ
 * (ถ้าเรียก `certificateEligibility()` ตรง ๆ จะกลายเป็นอ่านซ้ำสองรอบต่อการ poll หนึ่งครั้ง)
 */
export function certificateStandingOf(rows: readonly Submission[]): CertificateEligibility {
  const ceo = rows.find((row) => row.emphasis_criterion !== null) ?? null

  if (!ceo) {
    return {
      status: 'not-submitted',
      eligible: false,
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
      eligible: false,
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
      eligible: false,
      dimensions,
      missing,
      passedCount: 0,
      totalCount: dimensions.length,
      message:
        'ส่งงานเรียบร้อยแล้ว กำลังรอครูอ่านและยืนยันคะแนน ระหว่างรอไปดูผลงานของเพื่อนหรือเก็บดาวภารกิจอื่นต่อได้เลย',
      nextHref: '/showcase',
      nextLabel: 'ไปดูผลงานของเพื่อน',
    }
  }

  if (missing.length === 0) {
    return {
      status: 'passed',
      eligible: true,
      dimensions,
      missing,
      passedCount,
      totalCount: dimensions.length,
      message: 'ครูยืนยันแล้วว่าทำได้ครบทั้ง 4 ด้าน ใบประกาศเป็นของเราแล้ว',
      nextHref: '/api/certificate',
      nextLabel: 'โหลดใบประกาศ',
    }
  }

  /**
   * ยังไม่ครบ — ข้อความต้องบอก 3 อย่าง: ทำได้แล้วกี่ด้าน · เหลือด้านไหน · แก้แล้วส่งใหม่ได้
   * ห้ามใช้คำว่า "ไม่ผ่าน" หรือ "ตก" (สเปกข้อ 2.3)
   */
  const names = missing.map((d) => d.shortName).join(' และ ')
  return {
    status: 'keep-going',
    eligible: false,
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

import type { Tables } from './types'

/**
 * ทางเดียวที่ถูกสำหรับอ่าน "คะแนนที่ครูยืนยันแล้ว" ของใบเสนอภารกิจใหญ่
 *
 * ทำไมต้องมีไฟล์นี้: ตาราง `submissions` มีคอลัมน์คะแนน 2 ตัวที่ชื่อชวนสับสน
 *
 *   ai_scores                 ข้อเสนอจากกฎ/AI — **ไม่ใช่คะแนนจริง** ระบบเขียนเองตอนเด็กกดส่ง
 *   teacher_confirmed_scores  คะแนนของครู — ครูเท่านั้นที่เขียน และเป็นคะแนนจริงเสมอ
 *
 * เคยพลาดมาแล้วจริง (QA-3 ข้อ 1.1): `app/api/ceo/route.ts` อ่าน `confirmedByTeacher`
 * จาก `ai_scores` ซึ่งไม่มีคีย์นั้นอยู่เลย ผลคือเด็กที่ครูยืนยัน 15/15 และรับใบประกาศไปแล้ว
 * ยังเห็นหน้าจอขึ้นว่า "AI กำลังช่วยอ่านงานนี้อีกรอบ" พร้อมคะแนน 11/15 ที่มาจากกฎ
 * ขัดกับมติหลักของโปรเจกต์ที่ว่า **ครูเป็นคนตัดสินเสมอ**
 *
 * กติกาที่ไฟล์นี้บังคับ:
 *   1. อ่านจาก `teacher_confirmed_scores` เท่านั้น ไม่มีทางลัดไปอ่าน `ai_scores`
 *   2. ก้อน `{ status: 'revise' }` **ไม่ใช่คะแนนสุดท้าย** — ครูสั่งแก้ ไม่ใช่ครูยืนยัน
 *      ต่อให้ครูเผลอให้ 3 ครบทุกด้านตอนสั่งแก้ ก็ยังถือว่ายังไม่ยืนยัน
 *      (กติกาเดียวกับ components/server/certificate-eligibility.ts เป๊ะ ๆ ไม่งั้นใบประกาศกับหน้าเด็กจะพูดคนละเรื่อง)
 *   3. รองรับทั้งก้อนรายด้าน 4 ด้าน (ของใหม่) และก้อนคะแนนเดี่ยว `{ score, maxScore }` (ของเก่าในฐานข้อมูล)
 *
 * ฝั่ง SQL ปิดประตูที่ผิดไว้ด้วย constraint `submissions_ai_scores_no_teacher_flag`
 * (migration 20261001280000) — เขียน `confirmedByTeacher` ลง `ai_scores` แล้วแถวจะถูกปฏิเสธทันที
 */

type SubmissionRow = Pick<Tables<'submissions'>, 'teacher_confirmed_scores'>

export interface TeacherConfirmedScores {
  /** รหัสด้าน -> คะแนน 0-3 · null = ก้อนเก่าที่เก็บคะแนนรวมอย่างเดียว */
  dimensions: Record<string, number> | null
  dimensionNames: Record<string, string>
  /** ด้านที่ถ่วง 2 เท่าตามที่ผู้เรียนขอ */
  emphasisDimensionId: string | null
  weightedTotal: number | null
  weightedMax: number | null
  stars: number | null
  /** ข้อความที่ครูเขียนถึงผู้เรียน */
  note: string | null
}

function bagOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringMap(value: unknown): Record<string, string> {
  const bag = bagOf(value)
  if (!bag) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(bag)) {
    if (typeof raw === 'string') out[key] = raw
  }
  return out
}

function numberMap(value: unknown): Record<string, number> | null {
  const bag = bagOf(value)
  if (!bag) return null
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(bag)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = raw
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * คะแนนที่ครูยืนยันแล้ว — `null` แปลว่า **ยังไม่ยืนยัน** (ยังไม่ตรวจ หรือครูสั่งให้แก้)
 * ห้ามตีความ null ว่า "เอาคะแนนของกฎมาโชว์แทน" ได้เด็ดขาด
 */
export function readTeacherConfirmedScores(
  submission: SubmissionRow | null | undefined,
): TeacherConfirmedScores | null {
  const bag = bagOf(submission?.teacher_confirmed_scores)
  if (!bag) return null
  // ครูกด "ส่งกลับให้แก้" = สถานะนำหน้าคะแนน ยังไม่ใช่คำตัดสิน
  if (bag.status === 'revise') return null

  const dimensions = numberMap(bag.dimensions)
  const legacyScore = numberOrNull(bag.score)

  return {
    dimensions,
    dimensionNames: stringMap(bag.dimensionNames),
    emphasisDimensionId:
      typeof bag.emphasisDimensionId === 'string' ? bag.emphasisDimensionId : null,
    weightedTotal: numberOrNull(bag.weightedTotal) ?? legacyScore,
    weightedMax: numberOrNull(bag.weightedMax) ?? numberOrNull(bag.maxScore),
    stars: numberOrNull(bag.stars),
    note: typeof bag.note === 'string' ? bag.note : null,
  }
}

/** ครูยืนยันคะแนนใบนี้แล้วหรือยัง — ใช้แทนการไปงมคีย์ `confirmedByTeacher` เอง */
export function isTeacherConfirmed(submission: SubmissionRow | null | undefined): boolean {
  return readTeacherConfirmedScores(submission) !== null
}

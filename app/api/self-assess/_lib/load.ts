import {
  calibrationRecordsFrom,
  compareThreeSources,
  selfAssessForm,
  type ThreeSourceTable,
} from '@/core/self-assess'
import { OBJECTIVE_SHORT_NAMES } from '@/core/report'
import { getProfile, listSubmissions, type Submission } from '@/lib/db/repo'

/**
 * ตัวช่วยของวงจรประเมินตนเอง 3 แหล่ง — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ⚠️ อยู่ใต้ `app/api/self-assess/_lib` เพราะไม่ใช่ route (Next รู้จักเฉพาะ route.ts)
 *    วางไว้ที่นี่เพื่อให้อยู่ในขอบเขตไฟล์ของ session นี้ ไม่ชนกับ components/server/** ของ session อื่น
 * ⚠️ อ่านอย่างเดียว การเขียนทำผ่าน repo (`saveSelfAssessment`) ซึ่งมี student_id อยู่ในเงื่อนไข UPDATE
 */

type Bag = Record<string, unknown>

function bagOf(value: unknown): Bag | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Bag) : null
}

/**
 * แปลงคะแนนรายด้านที่เก็บได้ 2 รูปแบบให้เป็นรูปเดียว
 * - อาร์เรย์ `[{ id, score }]` (ของ lib/ai และคะแนนจากกฎ)
 * - ออบเจกต์ `{ 'dim-naming': 3 }` (ของฝั่งครูและของที่ผู้เรียนให้ตัวเอง)
 */
export function dimensionBag(value: unknown): Record<string, number> | null {
  if (Array.isArray(value)) {
    const rows = value
      .map((row) => bagOf(row))
      .filter((row): row is Bag => row !== null)
      .filter((row) => typeof row.id === 'string' && Number.isFinite(Number(row.score)))
    if (rows.length === 0) return null
    return Object.fromEntries(rows.map((row) => [row.id as string, Number(row.score)]))
  }

  const bag = bagOf(value)
  if (!bag) return null
  const entries = Object.entries(bag).filter(([, score]) => Number.isFinite(Number(score)))
  return entries.length > 0 ? Object.fromEntries(entries.map(([id, s]) => [id, Number(s)])) : null
}

/**
 * คะแนนที่ผู้เรียนให้ตัวเอง (S-26) — อ่านจากคีย์ `dimensions` เท่านั้น
 *
 * ⚠️ คอลัมน์ `self_scores` ถูกใช้มาก่อนแล้วโดยด่านบอส เก็บ **คำตอบแบบพิมพ์** ของ 3 คำถาม
 *    (`{ 'bm-self1': '...' }`) และของเก่ายังมีรูปแบบ `{ relevance: 3 }` ค้างอยู่
 *    ถ้าอ่านทั้งก้อนแบบเหมารวม คะแนนรายด้านจะปนกับของเดิม จึงอ่านเฉพาะคีย์ที่เราเขียนเอง
 */
export function selfScoresOf(submission: Submission | null): Record<string, number> | null {
  const bag = bagOf(submission?.self_scores)
  return bag ? dimensionBag(bag.dimensions) : null
}

/** ก้อนเดิมทั้งหมดใน self_scores — ใช้ตอนเขียนทับเพื่อ **ไม่ลบคำตอบแบบพิมพ์ของด่านบอส** */
export function selfScoresRawOf(submission: Submission | null): Record<string, unknown> {
  return bagOf(submission?.self_scores) ?? {}
}

export function selfSavedAtOf(submission: Submission | null): string | null {
  const bag = bagOf(submission?.self_scores)
  return typeof bag?.savedAt === 'string' ? bag.savedAt : null
}

/**
 * คะแนนที่ "ระบบเสนอ" — คือชุดที่ผู้เรียนเห็นตอนส่งงาน (กฎล้วน) ไม่ใช่ข้อเสนอของ AI ที่ตามมาทีหลัง
 * ถ้าครูกดยืนยันไปแล้ว ระบบจะย้ายชุดนั้นไว้ที่ ai_scores_snapshot จึงอ่านสำรองจากที่นั่นด้วย
 */
export function systemScoresOf(submission: Submission | null): Record<string, number> | null {
  const live = bagOf(submission?.ai_scores)
  const snapshot = bagOf(submission?.ai_scores_snapshot)
  return dimensionBag(live?.dimensions) ?? dimensionBag(snapshot?.dimensions)
}

export interface TeacherConfirmed {
  scores: Record<string, number> | null
  note: string | null
  confirmed: boolean
}

/**
 * คะแนนที่ครูยืนยัน — **นับเฉพาะตอนกดยืนยันจริงเท่านั้น**
 * คอลัมน์เดียวกันนี้ถูกใช้เก็บคำสั่ง "ส่งกลับให้แก้" ด้วย (`status: 'revise'`)
 * ถ้าไม่แยกออก ผู้เรียนจะเห็นคอลัมน์ครูทั้งที่ครูยังไม่ได้ยืนยันคะแนน
 */
export function teacherScoresOf(submission: Submission | null): TeacherConfirmed {
  const bag = bagOf(submission?.teacher_confirmed_scores)
  const confirmed = bag?.confirmedByTeacher === true && bag?.status !== 'revise'
  return {
    scores: confirmed ? dimensionBag(bag?.dimensions) : null,
    note: typeof bag?.note === 'string' && bag.note.trim().length > 0 ? bag.note.trim() : null,
    confirmed,
  }
}

/** งานชิ้นล่าสุดของผู้เรียน (listSubmissions เรียงใหม่สุดก่อนอยู่แล้ว) */
export async function latestSubmission(studentId: string): Promise<Submission | null> {
  const rows = await listSubmissions(studentId)
  return rows[0] ?? null
}

/** งานชิ้นหนึ่งของผู้เรียนคนนี้ — id ของเพื่อนจะหาไม่เจอ เพราะอ่านจากรายการของเจ้าตัวเท่านั้น */
export async function submissionOf(
  studentId: string,
  submissionId: string,
): Promise<Submission | null> {
  const rows = await listSubmissions(studentId)
  return rows.find((row) => row.id === submissionId) ?? null
}

export interface SelfAssessView {
  submissionId: string | null
  form: ReturnType<typeof selfAssessForm>
  self: { scores: Record<string, number> | null; savedAt: string | null }
  table: ThreeSourceTable
}

/** ทุกอย่างที่หน้าจอของผู้เรียนต้องใช้ ในคำขอเดียว */
export function buildView(submission: Submission | null): SelfAssessView {
  const teacher = teacherScoresOf(submission)
  const self = selfScoresOf(submission)

  return {
    submissionId: submission?.id ?? null,
    form: selfAssessForm(),
    self: { scores: self, savedAt: selfSavedAtOf(submission) },
    table: compareThreeSources({
      self,
      system: systemScoresOf(submission),
      teacher: teacher.scores,
      teacherNote: teacher.note,
      teacherConfirmed: teacher.confirmed,
    }),
  }
}

/**
 * ธงการรู้ตัวของผู้เรียนหนึ่งคน (S-33) — **ข้อมูลของครู**
 * อ่านความมั่นใจกับผลถูกผิดรายจุดประสงค์จาก `profiles` ซึ่งหน้าตรวจคำตอบเขียนไว้ให้แล้ว
 */
export async function calibrationRecordsOf(studentId: string) {
  const profile = await getProfile(studentId).catch(() => null)
  return calibrationRecordsFrom(
    bagOf(profile?.confidence) ?? {},
    bagOf(profile?.readiness) ?? {},
    OBJECTIVE_SHORT_NAMES,
  )
}

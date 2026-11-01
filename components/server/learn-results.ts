import { getServiceClient } from '@/lib/db/client'

/**
 * ผลเส้นทางเรียน (ดู / อ่าน / ลงมือทำ) สำหรับแผงครู — รายคนและรายห้อง
 *
 * อ่านจากตาราง events อย่างเดียว (ชนิด learn-*) ไม่แตะโครงสร้างฐานข้อมูล
 * ไฟล์นี้ไม่ import เนื้อหา learn-paths.json เพื่อให้ทดสอบส่วนสรุปผลได้แยก
 * ชื่อ event ต้องตรงกับ LEARN_EVENTS ใน learn-path.ts
 */

export const LEARN_RESULT_MODES = ['watch', 'read', 'do'] as const
export type LearnResultMode = (typeof LEARN_RESULT_MODES)[number]

export const LEARN_EVENT_TYPES = [
  'learn-warmup',
  'learn-choose',
  'learn-answer',
  'learn-do',
  'learn-done',
] as const

export interface LearnEventRow {
  type: string
  payload: unknown
  created_at: string
}

/** คำตอบปลายเปิดครั้งล่าสุดของภารกิจ (ข้อความตัดที่ ANSWER_TEXT_MAX ตัวอักษรต่อข้อ) */
export interface LatestLearnAnswer {
  mode: LearnResultMode
  score: number | null
  passed: boolean | null
  at: string
  answers: { id: string; text: string; score: number | null; checkedBy: LearnAnswerCheckedBy }[]
}

/** ใครตรวจข้อนี้ — 'ai' = AI ช่วยตรวจ · 'keyword' = คำสำคัญล้วน · null = event เก่าที่ยังไม่บันทึก */
export type LearnAnswerCheckedBy = 'ai' | 'keyword' | null

function checkedByOf(source: unknown): LearnAnswerCheckedBy {
  if (source === 'typhoon' || source === 'gemini') return 'ai'
  if (source === 'rule') return 'keyword'
  return null
}

export const ANSWER_TEXT_MAX = 1000

export interface StudentMissionLearn {
  missionId: string
  warmupScore: number | null
  warmupTotal: number | null
  recommended: LearnResultMode | null
  /** วิธีที่เลือกล่าสุด */
  chosen: LearnResultMode | null
  /** เลือกตามที่ระบบแนะนำไหม (ครั้งล่าสุด) — null = ยังไม่ได้เลือกหรือยังไม่ได้เช็กพื้นฐาน */
  followed: boolean | null
  /** จำนวนครั้งที่เปลี่ยนวิธีเรียนในภารกิจนี้ (เลือกต่างจากครั้งก่อน) */
  modeSwitches: number
  /** จำนวนครั้งที่ส่งตรวจ (คำตอบปลายเปิด + ลงมือทำ) */
  attempts: number
  /** คะแนนสูงสุดที่เคยได้จากการส่งตรวจ */
  bestScore: number | null
  done: boolean
  doneMode: LearnResultMode | null
  doneScore: number | null
  doneAt: string | null
  lastActivityAt: string | null
  latestAnswer: LatestLearnAnswer | null
}

export interface StudentLearnResult {
  studentId: string
  nickname: string
  missions: StudentMissionLearn[]
}

export interface MissionLearnSummary {
  missionId: string
  warmedUp: number
  warmupAvg: number | null
  recommended: Record<LearnResultMode, number>
  chosen: Record<LearnResultMode, number>
  followedRecommendation: number
  choseDifferent: number
  done: number
  doneByMode: Record<LearnResultMode, number>
  /** คะแนนเฉลี่ยตอนผ่าน แยกตามวิธีเรียน — null = ยังไม่มีคนผ่านด้วยวิธีนั้น */
  doneAvgByMode: Record<LearnResultMode, number | null>
  attemptsAvg: number | null
}

function isAdaptiveMission(missionId: string): boolean {
  return missionId === 'm1' || missionId === 'm2'
}

function bag(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asMode(value: unknown): LearnResultMode | null {
  return (LEARN_RESULT_MODES as readonly unknown[]).includes(value) ? (value as LearnResultMode) : null
}

function finite(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

function emptyMission(missionId: string): StudentMissionLearn {
  return {
    missionId,
    warmupScore: null,
    warmupTotal: null,
    recommended: null,
    chosen: null,
    followed: null,
    modeSwitches: 0,
    attempts: 0,
    bestScore: null,
    done: false,
    doneMode: null,
    doneScore: null,
    doneAt: null,
    lastActivityAt: null,
    latestAnswer: null,
  }
}

function latestAnswerOf(p: Record<string, unknown>, mode: LearnResultMode, at: string): LatestLearnAnswer | null {
  const texts = bag(p.answers)
  const scores = new Map<string, number | null>()
  const checkers = new Map<string, LearnAnswerCheckedBy>()
  if (Array.isArray(p.perQuestion)) {
    for (const q of p.perQuestion) {
      const b = bag(q)
      if (typeof b.id === 'string') {
        scores.set(b.id, finite(b.score))
        checkers.set(b.id, checkedByOf(b.source))
      }
    }
  }
  const answers = Object.entries(texts)
    .filter(([, v]) => typeof v === 'string')
    .map(([id, v]) => ({
      id,
      text: (v as string).slice(0, ANSWER_TEXT_MAX),
      score: scores.get(id) ?? null,
      checkedBy: checkers.get(id) ?? null,
    }))
  if (answers.length === 0) return null
  return { mode, score: finite(p.score), passed: typeof p.passed === 'boolean' ? p.passed : null, at, answers }
}

/** สรุป event ของนักเรียนหนึ่งคนเป็นสถานะรายภารกิจ (เรียงตามรหัสภารกิจ) */
export function summarizeStudentLearn(rows: readonly LearnEventRow[]): StudentMissionLearn[] {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const byMission = new Map<string, StudentMissionLearn>()

  for (const row of sorted) {
    const p = bag(row.payload)
    const missionId = typeof p.missionId === 'string' ? p.missionId : null
    if (!missionId) continue
    let m = byMission.get(missionId)
    if (!m) {
      m = emptyMission(missionId)
      byMission.set(missionId, m)
    }
    m.lastActivityAt = row.created_at

    switch (row.type) {
      case 'learn-warmup': {
        m.warmupScore = finite(p.score)
        m.warmupTotal = finite(p.total)
        m.recommended = asMode(p.recommended)
        break
      }
      case 'learn-choose': {
        const mode = asMode(p.mode)
        if (!mode) break
        if (m.chosen && m.chosen !== mode) m.modeSwitches += 1
        m.chosen = mode
        const rec = asMode(p.recommended) ?? m.recommended
        m.followed = rec ? rec === mode : null
        break
      }
      case 'learn-answer':
      case 'learn-do': {
        m.attempts += 1
        if (row.type === 'learn-answer') {
          const mode = asMode(p.mode)
          const latest = mode ? latestAnswerOf(p, mode, row.created_at) : null
          if (latest) m.latestAnswer = latest
        }
        const score = finite(p.score)
        if (score !== null && (m.bestScore === null || score > m.bestScore)) m.bestScore = score
        break
      }
      case 'learn-done': {
        const mode = asMode(p.mode)
        const score = finite(p.score)
        if (!mode) break
        // เก็บครั้งแรกที่ผ่าน (เวลาที่ผ่าน) แต่ยกคะแนนขึ้นถ้าผ่านซ้ำได้สูงกว่า
        if (!m.done) {
          m.done = true
          m.doneMode = mode
          m.doneScore = score
          m.doneAt = row.created_at
        } else if (score !== null && (m.doneScore === null || score > m.doneScore)) {
          m.doneScore = score
          m.doneMode = mode
        }
        break
      }
    }
  }

  return [...byMission.values()].sort((a, b) => a.missionId.localeCompare(b.missionId))
}

function zeroModes<T>(value: T): Record<LearnResultMode, T> {
  return { watch: value, read: value, do: value }
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
}

/** สรุปทั้งห้องรายภารกิจ — ตัวเลขคิดที่เซิร์ฟเวอร์ จอแค่วาด */
export function summarizeClassLearn(students: readonly StudentLearnResult[]): MissionLearnSummary[] {
  const groups = new Map<string, StudentMissionLearn[]>()
  for (const s of students) {
    for (const m of s.missions) {
      const list = groups.get(m.missionId) ?? []
      list.push(m)
      groups.set(m.missionId, list)
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([missionId, list]) => {
      const recommended = zeroModes(0)
      const chosen = zeroModes(0)
      const doneByMode = zeroModes(0)
      const doneScores: Record<LearnResultMode, number[]> = { watch: [], read: [], do: [] }
      const warmups: number[] = []
      const attempts: number[] = []
      let followed = 0
      let different = 0
      let done = 0

      for (const m of list) {
        if (m.warmupScore !== null) warmups.push(m.warmupScore)
        if (m.recommended) recommended[m.recommended] += 1
        if (m.chosen) chosen[m.chosen] += 1
        if (isAdaptiveMission(m.missionId) && m.followed === true) followed += 1
        if (isAdaptiveMission(m.missionId) && m.followed === false) different += 1
        if (m.attempts > 0) attempts.push(m.attempts)
        if (m.done && m.doneMode) {
          done += 1
          doneByMode[m.doneMode] += 1
          if (m.doneScore !== null) doneScores[m.doneMode].push(m.doneScore)
        }
      }

      return {
        missionId,
        warmedUp: warmups.length,
        warmupAvg: avg(warmups),
        recommended,
        chosen,
        followedRecommendation: followed,
        choseDifferent: different,
        done,
        doneByMode,
        doneAvgByMode: {
          watch: avg(doneScores.watch),
          read: avg(doneScores.read),
          do: avg(doneScores.do),
        },
        attemptsAvg: avg(attempts),
      }
    })
}

/**
 * อ่าน event learn-* ของทั้งห้องในคิวรีเดียว และตรวจเจ้าของห้องในคิวรีเดียวกัน
 * null = ไม่ใช่ห้องของครูคนนี้ · ส่ง studentId มาเพื่อดูคนเดียว (คนนอกห้อง = รายการว่าง)
 */
export async function loadClassroomLearnResults(
  teacherId: string,
  classroomId: string,
  studentId?: string,
): Promise<StudentLearnResult[] | null> {
  let query = getServiceClient()
    .from('classrooms')
    .select('id, students(id, nickname, events(type, payload, created_at))')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .in('students.events.type', [...LEARN_EVENT_TYPES])
  if (studentId) query = query.eq('students.id', studentId)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(`loadClassroomLearnResults: ${error.message}`)
  if (!data) return null

  return data.students
    .map((s) => ({
      studentId: s.id,
      nickname: s.nickname,
      missions: summarizeStudentLearn(s.events as LearnEventRow[]),
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'th'))
}

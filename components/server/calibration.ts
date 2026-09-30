import coachPrompts from '../../content/coach-prompts.json' with { type: 'json' }
import { calibrationFlag } from '@/core/personalize'
import { getProfile, getTeacherBoardWithFlags, listMissionProgress } from '@/lib/db/repo'
import { missions } from '@/components/missions'

/**
 * ธง "ควรคุย / ควรชม" ของทั้งห้อง — ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * input คือความมั่นใจที่ผู้เรียนกรอกตอนตอบข้อ check (profiles.confidence รายภารกิจ)
 * คู่กับผลจริง (mission_progress.passed_at) แล้วให้ core/personalize ตัดสินว่าครูควรทำอะไร
 *
 * ⚠️ ธงนี้ไม่มีผลกับคะแนน และไม่แสดงเป็นคำตัดสินให้ผู้เรียนเห็น
 * ⚠️ การ์ดโค้ชมีแต่ "คำถาม" ที่ครูเอาไปถาม ไม่มีเฉลย (กติกาใน content/coach-prompts.json)
 * ⚠️ teacherId ต้องมาจากคุกกี้ครู — getTeacherBoardWithFlags ตรวจเจ้าของห้องให้ในคิวรีเดียว
 */
export interface CalibrationRow {
  studentId: string
  nickname: string
  missionId: string
  missionTitle: string
  confidence: number
  correct: boolean
  flag: 'ควรคุย' | 'ควรชม'
  reason: string
  coach: { question: string; followUpQuestion: string; watchFor: string; avoidSaying: string } | null
}

const prompts = coachPrompts.prompts as ReadonlyArray<{
  id: string
  missionId: string
  reasonId: string
  question: string
  followUpQuestion: string
  watchFor: string
  avoidSaying: string
}>

function findCoach(missionId: string, reasonId: string) {
  const exact = prompts.find((p) => p.missionId === missionId && p.reasonId === reasonId)
  const any = exact ?? prompts.find((p) => p.reasonId === reasonId)
  return any
    ? {
        question: any.question,
        followUpQuestion: any.followUpQuestion,
        watchFor: any.watchFor,
        avoidSaying: any.avoidSaying,
      }
    : null
}

function confidenceOf(value: unknown, missionId: string): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = (value as Record<string, unknown>)[missionId]
  return typeof raw === 'number' ? raw : null
}

export async function listCalibrationFlags(
  teacherId: string,
  classroomId: string,
): Promise<CalibrationRow[] | null> {
  const board = await getTeacherBoardWithFlags(teacherId, classroomId)
  if (!board) return null

  const titleOf = new Map(missions.map((m) => [m.id, m.title]))
  const rows: CalibrationRow[] = []

  // ห้องหนึ่งไม่เกินไม่กี่สิบคน อ่านทีละคนพอไหว (ถ้าห้องใหญ่ขึ้นค่อยขอ repo ทำคิวรีเดียว)
  for (const student of board) {
    const [profile, progress] = await Promise.all([
      getProfile(student.studentId),
      listMissionProgress(student.studentId),
    ])
    if (!profile) continue

    for (const mission of progress) {
      const confidence = confidenceOf(profile.confidence, mission.mission_id)
      if (confidence === null) continue
      const signal = calibrationFlag(confidence, mission.passed_at !== null)
      if (!signal.flag || !signal.coachPromptId) continue
      rows.push({
        studentId: student.studentId,
        nickname: student.nickname,
        missionId: mission.mission_id,
        missionTitle: titleOf.get(mission.mission_id) ?? mission.mission_id,
        confidence,
        correct: mission.passed_at !== null,
        flag: signal.flag,
        reason: signal.reason ?? '',
        coach: findCoach(mission.mission_id, signal.coachPromptId),
      })
    }
  }

  return rows
}

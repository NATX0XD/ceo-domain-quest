// ⚠️ SERVER ONLY — ชั้นนี้วิ่งด้วย service_role ซึ่ง **ข้าม RLS ทุกตาราง**
//
// แปลว่า policy ที่เขียนไว้ใน migration ไม่ช่วยอะไรเลยเมื่อเรียกผ่านไฟล์นี้
// การตรวจสิทธิ์ทั้งหมดจึงต้องทำ "ในชั้นนี้เอง" และต้องตรวจอยู่ใน query เดียวกับที่อ่าน/เขียน
// (เช่น `.eq('teacher_id', teacherId)` หรือ EXISTS ใน SQL function) ห้าม query แยกแล้วค่อยเทียบใน JS
// เพราะระหว่างสอง query ค่าอาจเปลี่ยน และเผลอลืมเช็กได้ง่าย
//
// กฎเหล็ก 2 ข้อ:
//  1. `studentId` / `teacherId` ที่ส่งเข้าฟังก์ชันต้องเป็นค่าที่เซิร์ฟเวอร์ยืนยันแล้วเท่านั้น
//     (session cookie httpOnly ของนักเรียน / Supabase Auth session ของครู)
//     ห้ามรับจาก request body หรือ query string เด็ดขาด — ดู docs/auth-and-roles.md ข้อ 6
//  2. ฟังก์ชันที่แตะข้อมูลของ "ห้อง" ต้องรับ `teacherId` เป็นพารามิเตอร์บังคับเสมอ
//     คืน `null` เมื่อไม่ใช่เจ้าของหรือไม่มีแถวนั้น (API route ควรแปลงเป็น 404/403)

import { getServiceClient } from './client'
import type { Json, Tables, TablesInsert } from './types'

export type Teacher = Tables<'teachers'>
export type MissionSkip = Tables<'mission_skips'>
export type ChatMessage = Tables<'chat_messages'>
export type VoiceSubmission = Tables<'voice_submissions'>
export type Classroom = Tables<'classrooms'>
export type Student = Tables<'students'>
export type Profile = Tables<'profiles'>
export type Progress = Tables<'progress'>
export type Submission = Tables<'submissions'>
export type GameEvent = Tables<'events'>
export type RouteChange = Tables<'route_changes'>
export type Reflection = Tables<'reflections'>
export type MissionProgress = Tables<'mission_progress'>
export type PeerFeedback = Tables<'peer_feedback'>
export type GradeJob = Tables<'grade_jobs'>

export const STATIONS = ['A', 'B', 'C'] as const
export type Station = (typeof STATIONS)[number]

export const PROGRESS_STATUSES = ['not_started', 'in_progress', 'needs_help', 'completed'] as const
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number]

export const CLASSROOM_STATUSES = ['open', 'locked', 'closed'] as const
export type ClassroomStatus = (typeof CLASSROOM_STATUSES)[number]

// canonical คือ 'game' (content/missions.json ใช้ channels.game) — 'minigame' ถูกตัดออกจาก DB แล้ว
export const LEARNING_ROUTES = ['clip', 'card', 'game', 'buddy'] as const
export type LearningRoute = (typeof LEARNING_ROUTES)[number]

/** ดาวเต็ม 15 = ภารกิจย่อย 4 x 3 ดาว + ภารกิจใหญ่ 3 ดาว */
export const MAX_TOTAL_STARS = 15
export const MAX_MISSION_STARS = 3

/** เป้าหมายที่นักเรียนตั้งเอง: ระดับ 1 = 6 ดาว · 2 = 10 ดาว · 3 = 14 ดาว (ตรงกับ CHECK ในฐานข้อมูล) */
export const GOAL_LEVEL_STARS: Record<1 | 2 | 3, number> = { 1: 6, 2: 10, 3: 14 }
export const GOAL_LEVEL_IDS: Record<1 | 2 | 3, string> = {
  1: 'goal-basic',
  2: 'goal-good',
  3: 'goal-challenge',
}
export type GoalLevel = 1 | 2 | 3

export const MISSION_IDS = ['m1', 'm2', 'm3', 'm4'] as const
export type MissionId = (typeof MISSION_IDS)[number]

/** ภารกิจย่อย 4 ภารกิจ + ภารกิจใหญ่ — ดาวเก็บในตาราง mission_progress ทั้งหมด (5 x 3 = 15) */
export const MISSION_TARGETS = ['m1', 'm2', 'm3', 'm4', 'boss'] as const
export type MissionTarget = (typeof MISSION_TARGETS)[number]

/** ข้ามได้ทั้งภารกิจย่อยและด่านบอส */
export type SkipTarget = MissionTarget

export type ChatRole = 'dome' | 'student'
export type ChatSource = 'ai' | 'fallback' | 'scripted'

export type RouteChosenBy = 'system' | 'student'

/** กลุ่มลูกค้าหลักของร้าน — หนึ่งใน 3 คำตอบตั้งต้นที่ evaluateTld ใช้ */
export const AUDIENCES = ['thai', 'international'] as const
export type ShopAudience = (typeof AUDIENCES)[number]

/** จำนวนครั้งสูงสุดที่ยอมเติมเลขท้ายชื่อเล่นเมื่อชนกัน (นัท -> นัท2 -> นัท3 ...) */
const MAX_NICKNAME_ATTEMPTS = 50

const UNIQUE_VIOLATION = '23505'

function fail(action: string, error: { message: string; code?: string }): never {
  throw new Error(`[db] ${action} ล้มเหลว: ${error.message}${error.code ? ` (${error.code})` : ''}`)
}

// ----------------------------------------------------------------- classroom

export async function createClassroom(teacherId: string, roomCode: string): Promise<Classroom> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .insert({ teacher_id: teacherId, room_code: roomCode.toUpperCase() })
    .select()
    .single()

  if (error) fail('createClassroom', error)
  return data
}

/**
 * E-16 ห้องสาธิตสำหรับขึ้นเวที — ติดป้าย `is_demo` ตั้งแต่แถวแรกที่สร้าง
 *
 * ป้ายนี้ติดได้ตอนสร้างเท่านั้น: trigger `classrooms_guard_demo_flag` ปฏิเสธการติดป้าย
 * ให้ห้องที่มีนักเรียนอยู่แล้ว ห้องเรียนจริงจึงกลายเป็นห้องสาธิต (แล้วโดนกดล้าง) ไม่ได้
 */
export async function createDemoClassroom(
  teacherId: string,
  roomCode: string,
): Promise<Classroom> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .insert({ teacher_id: teacherId, room_code: roomCode.toUpperCase(), is_demo: true })
    .select()
    .single()

  if (error) fail('createDemoClassroom', error)
  return data
}

/**
 * สร้างห้องด้วยรหัสที่สุ่มมา ถ้าชนรหัสเดิมให้สุ่มใหม่
 * `generate` คือ genRoomCode() จาก lib/room-code.ts (ชั้นนี้ไม่ import เอง จะได้ไม่ผูกกับ UI)
 */
export async function createClassroomWithUniqueCode(
  teacherId: string,
  generate: () => string,
  maxAttempts = 5,
): Promise<Classroom> {
  const db = getServiceClient()

  for (let i = 0; i < maxAttempts; i += 1) {
    const { data, error } = await db
      .from('classrooms')
      .insert({ teacher_id: teacherId, room_code: generate().toUpperCase() })
      .select()
      .single()

    if (!error) return data
    if (error.code !== UNIQUE_VIOLATION) fail('createClassroomWithUniqueCode', error)
  }

  throw new Error(`[db] createClassroomWithUniqueCode: สุ่มรหัสห้องชนกัน ${maxAttempts} ครั้งติด`)
}

/** ครู login แล้วผูกแถวในตาราง teachers ให้ตรงกับ auth.users */
export async function upsertTeacher(
  teacherId: string,
  email: string,
  name?: string | null,
): Promise<Teacher> {
  // ไม่ส่งคีย์ name ตอนไม่มีค่า จะได้ไม่ทับชื่อเดิมที่ครูตั้งไว้ด้วย null
  const row: TablesInsert<'teachers'> = name ? { id: teacherId, email, name } : { id: teacherId, email }

  const { data, error } = await getServiceClient()
    .from('teachers')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()

  if (error) fail('upsertTeacher', error)
  return data
}

export async function getTeacher(teacherId: string): Promise<Teacher | null> {
  const { data, error } = await getServiceClient()
    .from('teachers')
    .select()
    .eq('id', teacherId)
    .maybeSingle()

  if (error) fail('getTeacher', error)
  return data
}

/** Update only the teacher row owned by the authenticated session. */
export async function updateTeacherName(teacherId: string, name: string): Promise<Teacher | null> {
  const { data, error } = await getServiceClient()
    .from('teachers')
    .update({ name })
    .eq('id', teacherId)
    .select()
    .maybeSingle()

  if (error) fail('updateTeacherName', error)
  return data
}

/**
 * อ่านห้องจาก id ตรง ๆ — ไม่มีการตรวจเจ้าของ
 * ใช้ได้เฉพาะกับ classroomId ที่มาจาก session cookie ของนักเรียนเท่านั้น
 * ฝั่งครูให้ใช้ getOwnedClassroom()
 */
export async function getClassroomById(classroomId: string): Promise<Classroom | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .select()
    .eq('id', classroomId)
    .maybeSingle()

  if (error) fail('getClassroomById', error)
  return data
}

/**
 * หาห้องที่ "เข้าได้จริง" จากรหัส 6 ตัว — ใช้ตอนนักเรียนเข้าห้อง จึงไม่ต้องมี teacherId
 * คืน null ถ้าไม่เจอ / status ไม่ใช่ 'open' / เลยเวลา closes_at แล้ว
 */
export async function findOpenClassroomByCode(code: string): Promise<Classroom | null> {
  const roomCode = code.trim().toUpperCase()
  if (roomCode.length !== 6) return null

  const { data, error } = await getServiceClient()
    .from('classrooms')
    .select()
    .eq('room_code', roomCode)
    .eq('status', 'open' satisfies ClassroomStatus)
    .maybeSingle()

  if (error) fail('findOpenClassroomByCode', error)
  if (!data) return null
  if (data.closes_at !== null && new Date(data.closes_at).getTime() <= Date.now()) return null
  return data
}

/** อ่านห้องพร้อมตรวจเจ้าของใน query เดียว — null = ไม่ใช่ห้องของครูคนนี้ */
export async function getOwnedClassroom(
  teacherId: string,
  classroomId: string,
): Promise<Classroom | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .select()
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (error) fail('getOwnedClassroom', error)
  return data
}

export async function listClassroomsByTeacher(teacherId: string): Promise<Classroom[]> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .select()
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) fail('listClassroomsByTeacher', error)
  return data
}

/** ปิดห้อง — เงื่อนไขเจ้าของอยู่ใน UPDATE เดียวกัน คืน null ถ้าไม่ใช่ห้องของครูคนนี้ */
export async function closeClassroom(
  teacherId: string,
  classroomId: string,
): Promise<Classroom | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .update({ status: 'closed' satisfies ClassroomStatus, closes_at: new Date().toISOString() })
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .select()
    .maybeSingle()

  if (error) fail('closeClassroom', error)
  return data
}

/** ล็อก/ปลดล็อกห้องระหว่างคาบ — ตรวจเจ้าของใน UPDATE เดียวกัน */
export async function setClassroomStatus(
  teacherId: string,
  classroomId: string,
  status: ClassroomStatus,
): Promise<Classroom | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .update({ status })
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .select()
    .maybeSingle()

  if (error) fail('setClassroomStatus', error)
  return data
}

// ------------------------------------------------------------------ students

export type JoinClassroomInput = {
  classroomId: string
  nickname: string
  /** argon2 hash ของ PIN 4 หลัก — ห้ามส่ง PIN ดิบเข้ามา */
  pinHash: string
  deviceToken?: string | null
}

/**
 * เข้าห้อง: สร้างแถวนักเรียนใหม่
 * ชื่อเล่นซ้ำในห้องเดียวกัน = เติมเลขท้ายอัตโนมัติ (นัท -> นัท2 -> นัท3)
 * คืนแถวนักเรียนจริง ซึ่ง `nickname` คือชื่อที่ถูกใช้จริงหลังกันชนแล้ว
 *
 * `classroomId` ต้องมาจาก findOpenClassroomByCode() ฝั่งเซิร์ฟเวอร์ ห้ามรับจาก body
 */
export async function joinClassroom(input: JoinClassroomInput): Promise<Student> {
  const db = getServiceClient()
  const base = input.nickname.trim()
  if (base.length === 0) throw new Error('[db] joinClassroom: ชื่อเล่นว่าง')

  for (let attempt = 1; attempt <= MAX_NICKNAME_ATTEMPTS; attempt += 1) {
    const nickname = attempt === 1 ? base : `${base}${attempt}`
    const row: TablesInsert<'students'> = {
      classroom_id: input.classroomId,
      nickname,
      pin_hash: input.pinHash,
      device_token: input.deviceToken ?? null,
    }

    const { data, error } = await db.from('students').insert(row).select().single()
    if (!error) return data
    // ชนกับ UNIQUE(classroom_id, nickname) เท่านั้นที่วนต่อ error อื่นโยนทิ้งทันที
    if (error.code !== UNIQUE_VIOLATION) fail('joinClassroom', error)
  }

  throw new Error(`[db] joinClassroom: ชื่อเล่น "${base}" ชนเกิน ${MAX_NICKNAME_ATTEMPTS} ครั้ง`)
}

export async function getStudent(studentId: string): Promise<Student | null> {
  const { data, error } = await getServiceClient()
    .from('students')
    .select()
    .eq('id', studentId)
    .maybeSingle()

  if (error) fail('getStudent', error)
  return data
}

/** ใช้ตอนนักเรียนย้ายเครื่อง: หาแถวจากห้อง + ชื่อเล่น เพื่อเอา pin_hash ไปตรวจ */
export async function findStudentByNickname(
  classroomId: string,
  nickname: string,
): Promise<Student | null> {
  const { data, error } = await getServiceClient()
    .from('students')
    .select()
    .eq('classroom_id', classroomId)
    .eq('nickname', nickname.trim())
    .maybeSingle()

  if (error) fail('findStudentByNickname', error)
  return data
}

/** Rename the current student without changing the PIN or device session. */
export async function updateStudentNickname(
  studentId: string,
  classroomId: string,
  nickname: string,
): Promise<Student | null> {
  const { data, error } = await getServiceClient()
    .from('students')
    .update({ nickname })
    .eq('id', studentId)
    .eq('classroom_id', classroomId)
    .select()
    .maybeSingle()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return null
    fail('updateStudentNickname', error)
  }
  return data
}

/** Change the current student's PIN hash; the active session remains valid. */
export async function updateStudentPin(
  studentId: string,
  classroomId: string,
  pinHash: string,
): Promise<Student | null> {
  const { data, error } = await getServiceClient()
    .from('students')
    .update({ pin_hash: pinHash, must_change_pin: false, pin_reset_at: null, pin_reset_by: null })
    .eq('id', studentId)
    .eq('classroom_id', classroomId)
    .select()
    .maybeSingle()

  if (error) fail('updateStudentPin', error)
  return data
}

/** Owner-only bulk-create primitive. It never stores a raw PIN. */
export async function createPrecreatedStudent(input: {
  classroomId: string
  nickname: string
  pinHash: string
}): Promise<Student> {
  const { data, error } = await getServiceClient()
    .from('students')
    .insert({ classroom_id: input.classroomId, nickname: input.nickname, pin_hash: input.pinHash })
    .select()
    .single()

  if (error) fail('createPrecreatedStudent', error)
  return data
}

/** ครูเตะนักเรียนออก — ตรวจว่านักเรียนอยู่ในห้องของครูคนนี้ใน DELETE เดียวกัน */
export async function removeStudent(
  teacherId: string,
  classroomId: string,
  studentId: string,
): Promise<Student | null> {
  const owned = await getOwnedClassroom(teacherId, classroomId)
  if (!owned) return null

  const { data, error } = await getServiceClient()
    .from('students')
    .delete()
    .eq('id', studentId)
    .eq('classroom_id', classroomId)
    .select()
    .maybeSingle()

  if (error) fail('removeStudent', error)
  return data
}

// ------------------------------------------------------------------ profiles

export type ProfilePatch = {
  business_name?: string | null
  business_type?: string | null
  /** ความมั่นใจรายวัตถุประสงค์ {"obj-1":3,...} (รอบ 4 เปลี่ยนจากเลขก้อนเดียวเป็น jsonb) */
  confidence?: NonNullable<Json>
  pre_test_score?: number | null
  post_test_score?: number | null
  scaffold_level?: number
  talent_id?: string | null
  readiness?: NonNullable<Json>
  level_by_objective?: NonNullable<Json>
  earned_stars?: number
  channel_chosen_by?: RouteChosenBy | null
  /** 3 คำตอบตั้งต้นของนักเรียน — เป็น input ของ evaluateTld ฝั่งเซิร์ฟเวอร์ */
  is_registered_company?: boolean | null
  audience?: ShopAudience | null
  domain_name?: string | null
}

export async function upsertProfile(studentId: string, patch: ProfilePatch): Promise<Profile> {
  const { data, error } = await getServiceClient()
    .from('profiles')
    .upsert(
      { student_id: studentId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'student_id' },
    )
    .select()
    .single()

  if (error) fail('upsertProfile', error)
  return data
}

export async function getProfile(studentId: string): Promise<Profile | null> {
  const { data, error } = await getServiceClient()
    .from('profiles')
    .select()
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) fail('getProfile', error)
  return data
}

// ------------------------------------------------------------------ progress

export type ProgressPatch = {
  status?: ProgressStatus
  attempts?: number
  hints_used?: number
  started_at?: string | null
  completed_at?: string | null
}

/** upsert ตาม UNIQUE(student_id, station) */
export async function recordProgress(
  studentId: string,
  station: Station,
  patch: ProgressPatch,
): Promise<Progress> {
  const { data, error } = await getServiceClient()
    .from('progress')
    .upsert({ student_id: studentId, station, ...patch }, { onConflict: 'student_id,station' })
    .select()
    .single()

  if (error) fail('recordProgress', error)
  return data
}

export async function listProgress(studentId: string): Promise<Progress[]> {
  const { data, error } = await getServiceClient()
    .from('progress')
    .select()
    .eq('student_id', studentId)
    .order('station')

  if (error) fail('listProgress', error)
  return data
}

// --------------------------------------------------------------- submissions

export const SUBMISSION_FORMATS = ['write', 'voice', 'design'] as const
export type SubmissionFormat = (typeof SUBMISSION_FORMATS)[number]

export type SaveSubmissionInput = {
  domainName: string
  tld: string
  reasonText?: string | null
  /** คะแนนที่ AI เสนอ — ครูยืนยันทีหลังเสมอ */
  aiScores?: Json | null
  needsReview?: boolean
  /** รูปแบบส่งงานที่นักเรียนเลือกเอง */
  format?: SubmissionFormat
  /** ด้านในรูบริกที่นักเรียนขอให้ถ่วงน้ำหนัก 2 เท่า */
  emphasisCriterion?: string | null
  /** คะแนนที่นักเรียนประเมินตัวเอง */
  selfScores?: Json | null
}

export async function saveSubmission(
  studentId: string,
  input: SaveSubmissionInput,
): Promise<Submission> {
  const { data, error } = await getServiceClient()
    .from('submissions')
    .insert({
      student_id: studentId,
      domain_name: input.domainName,
      tld: input.tld,
      reason_text: input.reasonText ?? null,
      ai_scores: input.aiScores ?? null,
      needs_review: input.needsReview ?? true,
      format: input.format ?? 'write',
      emphasis_criterion: input.emphasisCriterion ?? null,
      self_scores: input.selfScores ?? null,
    })
    .select()
    .single()

  if (error) fail('saveSubmission', error)
  return data
}

/**
 * นักเรียนประเมินตัวเองบนงานที่ตัวเองส่ง
 * `student_id` อยู่ในเงื่อนไข UPDATE ด้วย — ส่ง submissionId ของเพื่อนมาก็แก้ไม่ได้ (คืน null)
 */
export async function saveSelfAssessment(
  studentId: string,
  submissionId: string,
  selfScores: Json,
): Promise<Submission | null> {
  const { data, error } = await getServiceClient()
    .from('submissions')
    .update({ self_scores: selfScores, updated_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('student_id', studentId)
    .select()
    .maybeSingle()

  if (error) fail('saveSelfAssessment', error)
  return data
}

/**
 * นักเรียนเปลี่ยนด้านที่ขอให้ถ่วงน้ำหนัก 2 เท่า — นับจำนวนครั้งที่เปลี่ยนไว้เป็นหลักฐาน
 * คืน null ถ้างานชิ้นนั้นไม่ใช่ของนักเรียนคนนี้
 */
export async function setEmphasisCriterion(
  studentId: string,
  submissionId: string,
  criterion: string,
): Promise<Submission | null> {
  const current = await getServiceClient()
    .from('submissions')
    .select('emphasis_criterion, emphasis_changed_count')
    .eq('id', submissionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (current.error) fail('setEmphasisCriterion', current.error)
  if (!current.data) return null

  const changed = current.data.emphasis_criterion !== null &&
    current.data.emphasis_criterion !== criterion

  const { data, error } = await getServiceClient()
    .from('submissions')
    .update({
      emphasis_criterion: criterion,
      emphasis_changed_count: current.data.emphasis_changed_count + (changed ? 1 : 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .eq('student_id', studentId)
    .select()
    .maybeSingle()

  if (error) fail('setEmphasisCriterion', error)
  return data
}

/**
 * ครูกดยืนยัน/แก้คะแนน
 * ความเป็นเจ้าของตรวจด้วย EXISTS ภายใน UPDATE เดียวกัน (SQL function confirm_submission_scores)
 * คืน null = งานชิ้นนี้ไม่ได้อยู่ในห้องของครูคนนี้ หรือไม่มีอยู่จริง
 */
export async function confirmSubmissionScores(
  teacherId: string,
  submissionId: string,
  scores: Json,
): Promise<Submission | null> {
  const { data, error } = await getServiceClient().rpc('confirm_submission_scores', {
    p_teacher_id: teacherId,
    p_submission_id: submissionId,
    p_scores: scores,
  })

  if (error) fail('confirmSubmissionScores', error)
  return data[0] ?? null
}

export async function listSubmissions(studentId: string): Promise<Submission[]> {
  const { data, error } = await getServiceClient()
    .from('submissions')
    .select()
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) fail('listSubmissions', error)
  return data
}

/** คิวงานที่รอครูตรวจทั้งห้อง — ตรวจเจ้าของห้องใน query เดียว คืน null ถ้าไม่ใช่เจ้าของ */
export async function listPendingReview(
  teacherId: string,
  classroomId: string,
): Promise<Array<Submission & { nickname: string }> | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .select('id, students(nickname, submissions(*))')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (error) fail('listPendingReview', error)
  if (!data) return null

  return data.students.flatMap((student) =>
    student.submissions
      .filter((s) => s.needs_review)
      .map((s) => ({ ...s, nickname: student.nickname })),
  )
}

// -------------------------------------------------------------------- events

export async function logEvent(
  studentId: string,
  type: string,
  payload: NonNullable<Json> = {},
): Promise<void> {
  const { error } = await getServiceClient()
    .from('events')
    .insert({ student_id: studentId, type, payload })

  if (error) fail('logEvent', error)
}

// ------------------------------------------------ personalized: learning route

export type SwitchRouteOptions = {
  missionId?: MissionId | null
  chosenBy?: RouteChosenBy
}

/**
 * สลับช่องทางการเรียนรู้ + เขียนหลักฐานลง route_changes ในทรานแซกชันเดียว
 * ครั้งแรกที่ระบบแนะนำก็บันทึกด้วย (from_route = null) — ตารางนี้คือหลักฐานว่า personalized จริง
 */
export async function switchLearningRoute(
  studentId: string,
  toRoute: LearningRoute,
  options: SwitchRouteOptions = {},
): Promise<RouteChange> {
  const { data, error } = await getServiceClient().rpc('switch_learning_route', {
    p_student_id: studentId,
    p_to_route: toRoute,
    p_mission_id: options.missionId ?? undefined,
    p_chosen_by: options.chosenBy ?? 'student',
  })

  if (error) fail('switchLearningRoute', error)
  const row = data[0]
  if (!row) throw new Error('[db] switchLearningRoute: ไม่ได้แถว route_changes กลับมา')
  return row
}

/**
 * บันทึกการเปลี่ยนช่องทางแบบระบุ from เองได้ (null = ใช้ค่าที่อยู่ใน profiles ตอนนั้น)
 * `changedBy` แยกให้ชัดว่า 'system' คือระบบแนะนำ หรือ 'student' คือเด็กกดเปลี่ยนเอง
 * — คู่ค่านี้คือหลักฐานว่าเป็น personalized ไม่ใช่ adaptive ล้วน
 */
export async function recordRouteChange(
  studentId: string,
  missionId: MissionId | null,
  fromRoute: LearningRoute | null,
  toRoute: LearningRoute,
  changedBy: RouteChosenBy,
): Promise<RouteChange> {
  const { data, error } = await getServiceClient().rpc('record_route_change', {
    p_student_id: studentId,
    p_to_route: toRoute,
    p_from_route: fromRoute ?? undefined,
    p_mission_id: missionId ?? undefined,
    p_changed_by: changedBy,
  })

  if (error) fail('recordRouteChange', error)
  const row = data[0]
  if (!row) throw new Error('[db] recordRouteChange: ไม่ได้แถว route_changes กลับมา')
  return row
}

export async function listRouteChanges(studentId: string): Promise<RouteChange[]> {
  const { data, error } = await getServiceClient()
    .from('route_changes')
    .select()
    .eq('student_id', studentId)
    .order('changed_at')

  if (error) fail('listRouteChanges', error)
  return data
}

/** สรุปการสลับช่องทางทั้งห้อง ไว้โชว์ตอนนำเสนอ — null = ไม่ใช่ห้องของครูคนนี้ */
export async function listClassroomRouteChanges(
  teacherId: string,
  classroomId: string,
): Promise<Array<RouteChange & { nickname: string }> | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .select('id, students(nickname, route_changes(*))')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (error) fail('listClassroomRouteChanges', error)
  if (!data) return null

  return data.students
    .flatMap((student) =>
      student.route_changes.map((rc) => ({ ...rc, nickname: student.nickname })),
    )
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
}

// --------------------------------------------------- personalized: เป้าหมายเอง

export type SelfGoalInput = {
  goalId: string
  goalStars: number
  selfGoalLevel: number
}

/**
 * นักเรียนตั้ง/ยกเป้าหมายเอง — ยกขึ้นได้อย่างเดียวระหว่างคาบ (goalPolicy ใน self-profile.json)
 * ถ้าขอลดเป้า SQL จะ raise exception ออกมาเป็น error ของฟังก์ชันนี้
 * ตอนยกเป้าสำเร็จ DB จะ stamp goal_raised_at + บวก goal_raised_count ให้เอง
 */
export async function setSelfGoal(studentId: string, input: SelfGoalInput): Promise<Profile> {
  const { data, error } = await getServiceClient().rpc('set_self_goal', {
    p_student_id: studentId,
    p_goal_id: input.goalId,
    p_goal_stars: input.goalStars,
    p_self_goal_level: input.selfGoalLevel,
  })

  if (error) fail('setSelfGoal', error)
  const row = data[0]
  if (!row) throw new Error('[db] setSelfGoal: ไม่ได้แถว profiles กลับมา')
  return row
}

export type RaiseGoalResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'lower-not-allowed'; message: string; currentStars: number | null }

/**
 * ยกเป้าหมายเป็นระดับใหม่ (1 = 6 ดาว · 2 = 10 ดาว · 3 = 14 ดาว)
 *
 * ระหว่างคาบยกขึ้นได้อย่างเดียว ลดไม่ได้ (content/self-profile.json goalPolicy)
 * ฝั่ง DB กันไว้ด้วย exception 23514 — ตรงนี้แปลงเป็นผลลัพธ์ที่อ่านรู้เรื่อง
 * ไม่โยน error ดิบให้ API route ไปเดาเอง
 */
export async function raiseGoal(studentId: string, newLevel: GoalLevel): Promise<RaiseGoalResult> {
  const goalStars = GOAL_LEVEL_STARS[newLevel]
  const current = await getProfile(studentId)

  if (current?.goal_stars != null && goalStars < current.goal_stars) {
    return {
      ok: false,
      reason: 'lower-not-allowed',
      message: `ระหว่างคาบยกเป้าหมายให้สูงขึ้นได้อย่างเดียว ตอนนี้ตั้งไว้ ${current.goal_stars} ดาว ขอใหม่ ${goalStars} ดาว`,
      currentStars: current.goal_stars,
    }
  }

  const profile = await setSelfGoal(studentId, {
    goalId: GOAL_LEVEL_IDS[newLevel],
    goalStars,
    selfGoalLevel: newLevel,
  })
  return { ok: true, profile }
}

/** ระบบเสนออะไรไว้ก่อนที่นักเรียนจะเลือกเอง — คู่เทียบของ learning_route / scaffold_level */
export async function saveSuggestion(
  studentId: string,
  suggestion: { channel?: LearningRoute; level?: GoalLevel; ownGoalText?: string | null },
): Promise<Profile> {
  const { data, error } = await getServiceClient()
    .from('profiles')
    .upsert(
      {
        student_id: studentId,
        channel_suggested: suggestion.channel,
        level_suggested: suggestion.level,
        own_goal_text: suggestion.ownGoalText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' },
    )
    .select()
    .single()

  if (error) fail('saveSuggestion', error)
  return data
}

/**
 * นักเรียนเปลี่ยนระดับตัวช่วยเอง — ต่อท้าย level_overridden_by_student ไว้เป็นหลักฐาน
 * (เก็บว่าเปลี่ยนจากอะไรเป็นอะไร ตอนไหน ภารกิจไหน)
 */
export async function recordLevelOverride(
  studentId: string,
  toLevel: GoalLevel,
  missionId: MissionId | null = null,
): Promise<Profile | null> {
  const { data, error } = await getServiceClient().rpc('record_level_override', {
    p_student_id: studentId,
    p_to_level: toLevel,
    p_mission_id: missionId ?? undefined,
  })

  if (error) fail('recordLevelOverride', error)
  return data[0] ?? null
}

// ------------------------------------------------- personalized: ภารกิจย่อย m1-m4

export type MissionProgressPatch = {
  channel_used?: LearningRoute | null
  attempts?: number
  hints_used?: number
  stars?: number
  passed_at?: string | null
}

/** upsert ตาม UNIQUE(student_id, mission_id) */
export async function upsertMissionProgress(
  studentId: string,
  missionId: MissionTarget,
  patch: MissionProgressPatch,
): Promise<MissionProgress> {
  const { data, error } = await getServiceClient()
    .from('mission_progress')
    .upsert(
      {
        student_id: studentId,
        mission_id: missionId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,mission_id' },
    )
    .select()
    .single()

  if (error) fail('upsertMissionProgress', error)
  return data
}

/** อ่านความคืบหน้าของภารกิจ ถ้ายังไม่มีให้สร้างแถวเปล่าไว้ (แทน Map ในหน่วยความจำของหน้าเว็บ) */
export async function getOrCreateMissionProgress(
  studentId: string,
  missionId: MissionTarget,
  channelUsed: LearningRoute | null = null,
): Promise<MissionProgress> {
  const existing = await getServiceClient()
    .from('mission_progress')
    .select()
    .eq('student_id', studentId)
    .eq('mission_id', missionId)
    .maybeSingle()

  if (existing.error) fail('getOrCreateMissionProgress', existing.error)
  if (existing.data) return existing.data

  return upsertMissionProgress(studentId, missionId, { channel_used: channelUsed })
}

export type AttemptInput = {
  correct: boolean
  channelUsed?: LearningRoute | null
}

/**
 * นับความพยายาม 1 ครั้งของภารกิจย่อย — บวกใน SQL statement เดียว (atomic)
 * ห้ามอ่านค่าเก่ามาบวกใน JS แล้วเขียนกลับ เพราะนักเรียนเปิดสองแท็บแล้วยิงพร้อมกันจะนับหาย
 *
 * **ไม่แตะ hints_used** — การขอคำใบ้ไม่ใช่การตอบผิด ให้ใช้ recordHint() แทน
 * คืนค่า attempts / hints_used ล่าสุดหลังบวกแล้ว
 */
export async function recordAttempt(
  studentId: string,
  missionId: MissionTarget,
  input: AttemptInput,
): Promise<MissionProgress> {
  const { data, error } = await getServiceClient().rpc('record_mission_attempt', {
    p_student_id: studentId,
    p_mission_id: missionId,
    p_correct: input.correct,
    p_channel: input.channelUsed ?? undefined,
  })

  if (error) fail('recordAttempt', error)
  const row = data[0]
  if (!row) throw new Error('[db] recordAttempt: ไม่ได้แถว mission_progress กลับมา')
  return row
}

/**
 * นักเรียนกดขอคำใบ้ 1 ใบ — บวก hints_used อย่างเดียว **ไม่บวก attempts**
 * บวกใน SQL statement เดียว (atomic) เปิดสองแท็บกดพร้อมกันก็ไม่นับหาย
 * `maxHints` ใส่เพดานของภารกิจนั้น (จำนวน hints ใน content/missions.json) กันนับเกิน
 */
export async function recordHint(
  studentId: string,
  missionId: MissionTarget,
  maxHints?: number,
): Promise<MissionProgress> {
  const { data, error } = await getServiceClient().rpc('increment_mission_hint', {
    p_student_id: studentId,
    p_mission_id: missionId,
    p_max_hints: maxHints,
  })

  if (error) fail('recordHint', error)
  const row = data[0]
  if (!row) throw new Error('[db] recordHint: ไม่ได้แถว mission_progress กลับมา')
  return row
}

/** ให้ดาวภารกิจ (0-3) — ตรรกะคิดดาวอยู่ฝั่ง core ไม่ใช่ที่นี่ */
export async function setMissionStars(
  studentId: string,
  missionId: MissionTarget,
  stars: number,
): Promise<MissionProgress> {
  return upsertMissionProgress(studentId, missionId, { stars })
}

export async function listMissionProgress(studentId: string): Promise<MissionProgress[]> {
  const { data, error } = await getServiceClient()
    .from('mission_progress')
    .select()
    .eq('student_id', studentId)
    .order('mission_id')

  if (error) fail('listMissionProgress', error)
  return data
}

// -------------------------------------------------- personalized: ทบทวนตัวเอง

/** ตอบซ้ำคำถามเดิม = ทับคำตอบเดิม (UNIQUE student_id, question_id) */
export async function saveReflection(
  studentId: string,
  questionId: string,
  answerText: string,
): Promise<Reflection> {
  const { data, error } = await getServiceClient()
    .from('reflections')
    .upsert(
      { student_id: studentId, question_id: questionId, answer_text: answerText },
      { onConflict: 'student_id,question_id' },
    )
    .select()
    .single()

  if (error) fail('saveReflection', error)
  return data
}

export async function listReflections(studentId: string): Promise<Reflection[]> {
  const { data, error } = await getServiceClient()
    .from('reflections')
    .select()
    .eq('student_id', studentId)
    .order('question_id')

  if (error) fail('listReflections', error)
  return data
}

// ------------------------------------------------- personalized: เพื่อนชมเพื่อน

export type PeerFeedbackInput = {
  praiseText?: string
  suggestText?: string
}

/**
 * เพื่อนให้ฟีดแบ็กเพื่อน — SQL ตรวจว่าทั้งสองคนอยู่ห้องเดียวกันใน INSERT เดียวกัน
 * `fromStudentId` ต้องมาจาก session cookie เท่านั้น คืน null = ไม่ได้อยู่ห้องเดียวกัน
 */
export async function addPeerFeedback(
  fromStudentId: string,
  toStudentId: string,
  input: PeerFeedbackInput = {},
): Promise<PeerFeedback | null> {
  const { data, error } = await getServiceClient().rpc('add_peer_feedback', {
    p_from_student_id: fromStudentId,
    p_to_student_id: toStudentId,
    p_praise_text: input.praiseText ?? '',
    p_suggest_text: input.suggestText ?? '',
  })

  if (error) fail('addPeerFeedback', error)
  return data[0] ?? null
}

/** ชื่อที่ฝั่งหน้าเว็บเรียกใช้ — ตัวเดียวกับ addPeerFeedback */
export const savePeerFeedback = addPeerFeedback

export async function listPeerFeedbackFor(studentId: string): Promise<PeerFeedback[]> {
  const { data, error } = await getServiceClient()
    .from('peer_feedback')
    .select()
    .eq('to_student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) fail('listPeerFeedbackFor', error)
  return data
}

// ------------------------------------------------------------- teacher board

export type BoardStation = {
  status: ProgressStatus
  attempts: number
  hintsUsed: number
  completedAt: string | null
}

export type BoardMission = {
  stars: number
  channelUsed: string | null
  passedAt: string | null
}

export type BoardRow = {
  studentId: string
  nickname: string
  businessName: string | null
  scaffoldLevel: number
  joinedAt: string
  /** สถานะราย station — station ที่ยังไม่เริ่มจะไม่มีคีย์ */
  stations: Partial<Record<Station, BoardStation>>
  /** ภารกิจย่อย m1-m4 ของเส้นทางใหม่ */
  missions: Partial<Record<MissionId, BoardMission>>
  learningRoute: string | null
  routeSwitches: number
  selfGoalLevel: number | null
  goalStars: number | null
  earnedStars: number
  goalRaisedAt: string | null
  /** กดขอความช่วยเหลือ = มี station ไหนสักอันเป็น needs_help */
  needsHelp: boolean
  /** จำนวนงานที่ยังรอครูยืนยันคะแนน */
  pendingReview: number
  completedStations: number
}

/**
 * แผงห้องเรียนสดของครู
 * เงื่อนไขเจ้าของ (`teacher_id = teacherId`) อยู่ใน query เดียวกับที่ดึงนักเรียน
 * คืน null = ไม่ใช่ห้องของครูคนนี้ หรือไม่มีห้องนี้ (ห้องว่างจะได้ [] ไม่ใช่ null)
 */
export async function listClassroomBoard(
  teacherId: string,
  classroomId: string,
): Promise<BoardRow[] | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    // ต้องเป็น string literal ก้อนเดียว ไม่งั้น supabase-js อ่าน type ของผลลัพธ์ไม่ออก
    .select(
      'id, students(id, nickname, created_at, profiles(business_name, scaffold_level, learning_route, channel_switches, self_goal_level, goal_stars, earned_stars, goal_raised_at), progress(station, status, attempts, hints_used, completed_at), mission_progress(mission_id, stars, channel_used, passed_at), submissions(id, needs_review))',
    )
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (error) fail('listClassroomBoard', error)
  if (!data) return null

  const rows: BoardRow[] = data.students.map((row) => {
    const stations: Partial<Record<Station, BoardStation>> = {}
    for (const p of row.progress) {
      stations[p.station as Station] = {
        status: p.status as ProgressStatus,
        attempts: p.attempts,
        hintsUsed: p.hints_used,
        completedAt: p.completed_at,
      }
    }

    const missions: Partial<Record<MissionId, BoardMission>> = {}
    for (const m of row.mission_progress) {
      missions[m.mission_id as MissionId] = {
        stars: m.stars,
        channelUsed: m.channel_used,
        passedAt: m.passed_at,
      }
    }

    const stationValues = Object.values(stations)
    return {
      studentId: row.id,
      nickname: row.nickname,
      businessName: row.profiles?.business_name ?? null,
      scaffoldLevel: row.profiles?.scaffold_level ?? 1,
      joinedAt: row.created_at,
      stations,
      missions,
      learningRoute: row.profiles?.learning_route ?? null,
      routeSwitches: row.profiles?.channel_switches ?? 0,
      selfGoalLevel: row.profiles?.self_goal_level ?? null,
      goalStars: row.profiles?.goal_stars ?? null,
      earnedStars: row.profiles?.earned_stars ?? 0,
      goalRaisedAt: row.profiles?.goal_raised_at ?? null,
      needsHelp: stationValues.some((s) => s.status === 'needs_help'),
      pendingReview: row.submissions.filter((s) => s.needs_review).length,
      completedStations: stationValues.filter((s) => s.status === 'completed').length,
    }
  })

  return rows.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
}

// -------------------------------------------------- ข้ามภารกิจ (ต้องมีร่องรอย)

/** ใครเป็นคนตัดสินใจข้าม — รายงานต้องแยกสองอย่างนี้ ไม่งั้น E1 นับการตัดสินใจของครูเป็นผลของเด็ก */
export type SkippedBy = 'student' | 'teacher'

/**
 * นักเรียนกด "ข้ามภารกิจนี้" — ข้ามได้จริงตามหลักผู้เรียนเป็นเจ้าของการเรียนรู้
 * แต่ทุกครั้งต้องทิ้งร่องรอยไว้ ครูจะได้ตามได้ว่าใครข้ามอะไรตอนไหน
 * studentId ต้องมาจาก session cookie เท่านั้น
 *
 * RPC เขียนทั้ง `mission_skips` และ `mission_progress.skipped_by` ในธุรกรรมเดียว
 * (boss ไม่มีแถวใน mission_progress จึงบันทึกแค่ร่องรอยการข้าม)
 */
export async function recordSkip(
  studentId: string,
  missionId: SkipTarget,
  reason?: string | null,
  by: SkippedBy = 'student',
): Promise<MissionSkip> {
  const { data, error } = await getServiceClient().rpc('record_mission_skip', {
    p_student_id: studentId,
    p_mission_id: missionId,
    p_reason: reason ?? undefined,
    p_by: by,
  })

  if (error) fail('recordSkip', error)
  const row = data[0]
  if (!row) fail('recordSkip', { message: 'ไม่ได้แถวการข้ามกลับมา' })
  return row
}

/**
 * ครูสั่งข้ามภารกิจแทนนักเรียน — ตรวจเจ้าของห้องในคิวรีเดียวกับที่เขียน
 * ไม่ใช่เจ้าของ = คืน null และไม่มีแถวไหนถูกแตะ
 * บันทึก `teacher_overrides` action `skip-mission` ให้เอง (ค่าเดิม ค่าใหม่ ใครสั่ง ตอนไหน)
 */
export async function teacherSkipMission(
  teacherId: string,
  studentId: string,
  missionId: SkipTarget,
  reason: OverrideReason = 'coached',
  note?: string | null,
): Promise<MissionSkip | null> {
  const { data, error } = await getServiceClient().rpc('teacher_skip_mission', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_mission_id: missionId,
    p_reason: reason,
    p_note: note ?? undefined,
  })

  if (error) fail('teacherSkipMission', error)
  return data[0] ?? null
}

export async function listSkips(studentId: string): Promise<MissionSkip[]> {
  const { data, error } = await getServiceClient()
    .from('mission_skips')
    .select()
    .eq('student_id', studentId)
    .order('skipped_at')

  if (error) fail('listSkips', error)
  return data
}

// --------------------------------------------------------- แชทกับโดม (หลักฐาน)

export async function saveChatMessage(
  studentId: string,
  role: ChatRole,
  text: string,
  source: ChatSource = 'scripted',
): Promise<ChatMessage> {
  const { data, error } = await getServiceClient()
    .from('chat_messages')
    .insert({ student_id: studentId, role, text, source })
    .select()
    .single()

  if (error) fail('saveChatMessage', error)
  return data
}

export async function listChatMessages(studentId: string, limit = 200): Promise<ChatMessage[]> {
  const { data, error } = await getServiceClient()
    .from('chat_messages')
    .select()
    .eq('student_id', studentId)
    .order('created_at')
    .limit(limit)

  if (error) fail('listChatMessages', error)
  return data
}

/** ข้อความล่าสุด n ข้อความ เรียงเก่า → ใหม่ — ใช้เป็นบริบทสั้น ๆ ให้โดม */
export async function listRecentChatMessages(studentId: string, n = 6): Promise<ChatMessage[]> {
  const { data, error } = await getServiceClient()
    .from('chat_messages')
    .select()
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(n)

  if (error) fail('listRecentChatMessages', error)
  return [...data].reverse()
}

// ------------------------------------------------------- ด่านบอส: อัดเสียงนำเสนอ

export type VoiceSubmissionInput = {
  durationSec: number
  transcriptText?: string | null
  /** path ใน storage ไม่ใช่ตัวไฟล์ — ตารางไม่เก็บไฟล์เสียง */
  storagePath?: string | null
}

export async function saveVoiceSubmission(
  studentId: string,
  input: VoiceSubmissionInput,
): Promise<VoiceSubmission> {
  const { data, error } = await getServiceClient()
    .from('voice_submissions')
    .insert({
      student_id: studentId,
      duration_sec: Math.max(0, Math.round(input.durationSec)),
      transcript_text: input.transcriptText ?? null,
      storage_path: input.storagePath ?? null,
    })
    .select()
    .single()

  if (error) fail('saveVoiceSubmission', error)
  return data
}

export async function listVoiceSubmissions(studentId: string): Promise<VoiceSubmission[]> {
  const { data, error } = await getServiceClient()
    .from('voice_submissions')
    .select()
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) fail('listVoiceSubmissions', error)
  return data
}

// ------------------------------------------------- ความมั่นใจรายวัตถุประสงค์

/**
 * ตั้งความมั่นใจรายวัตถุประสงค์ (obj-1..obj-4) — merge ทับเฉพาะคีย์ที่ส่งมา
 * ค่าที่เก็บก่อนรอบ 4 อยู่ใต้คีย์ "overall" ไม่ถูกลบทิ้ง
 */
export async function setConfidence(
  studentId: string,
  patch: Record<string, number>,
): Promise<Profile> {
  const current = await getProfile(studentId)
  const base: Record<string, Json> =
    current && typeof current.confidence === 'object' && !Array.isArray(current.confidence)
      ? (current.confidence as Record<string, Json>)
      : {}

  const { data, error } = await getServiceClient()
    .from('profiles')
    .upsert(
      {
        student_id: studentId,
        confidence: { ...base, ...patch },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' },
    )
    .select()
    .single()

  if (error) fail('setConfidence', error)
  return data
}

/** ใครเป็นคนเปิด/ปิดตัวช่วย — student = เด็กกดเอง · system = ระบบปรับให้ */
export async function setHintsToggledBy(
  studentId: string,
  by: RouteChosenBy,
): Promise<Profile> {
  const { data, error } = await getServiceClient()
    .from('profiles')
    .upsert(
      { student_id: studentId, hints_toggled_by: by, updated_at: new Date().toISOString() },
      { onConflict: 'student_id' },
    )
    .select()
    .single()

  if (error) fail('setHintsToggledBy', error)
  return data
}

// --------------------------------------------- แผงครู: ข้อมูลดิบสำหรับคิดธงสี

export type BoardFlagMission = {
  missionId: MissionId
  attempts: number
  hintsUsed: number
  stars: number
  solved: boolean
  channelUsed: string | null
  /** เวลาที่ขยับล่าสุดของภารกิจนี้ (epoch ms) */
  lastActionAtMs: number
}

/** คีย์วัตถุประสงค์ obj-1 .. obj-4 เท่านั้น — กันคีย์อื่นใน jsonb หลุดออกไป */
const OBJECTIVE_KEY = /^obj-\d+$/

function pickObjectiveNumbers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (OBJECTIVE_KEY.test(k) && typeof v === 'number') out[k] = v
  }
  return out
}

function pickObjectiveBooleans(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (OBJECTIVE_KEY.test(k) && typeof v === 'boolean') out[k] = v
  }
  return out
}

export type BoardFlagRow = {
  studentId: string
  nickname: string
  businessName: string | null
  learningRoute: string | null
  scaffoldLevel: number
  goalStars: number | null
  earnedStars: number
  /** นักเรียนกดปุ่มขอครูเอง (station ไหนก็ตามที่เป็น needs_help) */
  askedForHelp: boolean
  /**
   * ความมั่นใจที่นักเรียนบอกเอง รายวัตถุประสงค์ (obj-1..obj-4)
   * ใช้คู่กับ correctByObjective เพื่อคิดธง calibration (มั่นใจสูงแต่ผิด / มั่นใจต่ำแต่ถูก)
   */
  confidenceByObjective: Record<string, number>
  /** ผลถูก/ผิดรายวัตถุประสงค์ — **ไม่ใช่คำตอบของนักเรียน และไม่ใช่เฉลย** */
  correctByObjective: Record<string, boolean>
  missions: BoardFlagMission[]
  /** ภารกิจที่กำลังทำอยู่ = ภารกิจที่ยังไม่ผ่านและขยับล่าสุดที่สุด */
  currentMissionId: MissionId | null
  /** ขยับล่าสุดของนักเรียนคนนี้ทั้งคน (epoch ms) — รวม event ล่าสุดด้วย */
  lastActionAtMs: number
  skippedMissions: { missionId: string; skippedAt: string; reason: string | null }[]
  pendingReview: number
}

/**
 * ข้อมูลดิบให้ core/personalize.ts `shouldCoach()` เอาไปตัดสินธงสี
 *
 * ⚠️ ชั้นนี้ **ไม่ตัดสินธง และไม่รู้จักเลข 60/90/150** — เกณฑ์อยู่ที่ content/coach-thresholds.json
 *    ห้ามเขียนเกณฑ์เวลาเป็น SQL หรือฝังตัวเลขไว้ในไฟล์นี้
 *
 * เงื่อนไขเจ้าของห้องอยู่ใน query เดียวกัน คืน null = ไม่ใช่ห้องของครูคนนี้
 */
export async function getTeacherBoardWithFlags(
  teacherId: string,
  classroomId: string,
): Promise<BoardFlagRow[] | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    // ต้องเป็น string literal ก้อนเดียว ไม่งั้น supabase-js อ่าน type ของผลลัพธ์ไม่ออก
    .select(
      'id, students(id, nickname, created_at, profiles(business_name, learning_route, scaffold_level, goal_stars, earned_stars, confidence, readiness, updated_at), mission_progress(mission_id, attempts, hints_used, stars, passed_at, channel_used, updated_at), progress(status), mission_skips(mission_id, skipped_at, reason), submissions(id, needs_review), events(created_at))',
    )
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (error) fail('getTeacherBoardWithFlags', error)
  if (!data) return null

  const rows: BoardFlagRow[] = data.students.map((student) => {
    const missions: BoardFlagMission[] = student.mission_progress.map((m) => ({
      missionId: m.mission_id as MissionId,
      attempts: m.attempts,
      hintsUsed: m.hints_used,
      stars: m.stars,
      solved: m.passed_at !== null,
      channelUsed: m.channel_used,
      lastActionAtMs: new Date(m.updated_at).getTime(),
    }))

    const openMissions = missions.filter((m) => !m.solved)
    const current = openMissions.reduce<BoardFlagMission | null>(
      (latest, m) => (latest === null || m.lastActionAtMs > latest.lastActionAtMs ? m : latest),
      null,
    )

    const eventTimes = student.events.map((e) => new Date(e.created_at).getTime())
    const lastActionAtMs = Math.max(
      new Date(student.created_at).getTime(),
      ...missions.map((m) => m.lastActionAtMs),
      ...eventTimes,
    )

    return {
      studentId: student.id,
      nickname: student.nickname,
      businessName: student.profiles?.business_name ?? null,
      learningRoute: student.profiles?.learning_route ?? null,
      scaffoldLevel: student.profiles?.scaffold_level ?? 1,
      goalStars: student.profiles?.goal_stars ?? null,
      earnedStars: student.profiles?.earned_stars ?? 0,
      askedForHelp: student.progress.some((p) => p.status === 'needs_help'),
      // กรองเอาเฉพาะคีย์ obj-* ออกมา — readiness ยังมีคีย์ 'shop' (คำตอบของนักเรียน) ปนอยู่
      // ตรงนี้คือด่านที่กันไม่ให้คำตอบหลุดไปฝั่งครู
      confidenceByObjective: pickObjectiveNumbers(student.profiles?.confidence),
      correctByObjective: pickObjectiveBooleans(student.profiles?.readiness),
      missions,
      currentMissionId: current?.missionId ?? null,
      lastActionAtMs,
      skippedMissions: student.mission_skips.map((s) => ({
        missionId: s.mission_id,
        skippedAt: s.skipped_at,
        reason: s.reason,
      })),
      pendingReview: student.submissions.filter((s) => s.needs_review).length,
    }
  })

  return rows.sort((a, b) => a.nickname.localeCompare(b.nickname, 'th'))
}

// ------------------------------------------------- ไฟล์เสียงด่านบอส (Storage)

/** bucket แบบ private — เสียงเด็กเป็นข้อมูลส่วนบุคคล anon แตะไม่ได้เลย */
export const VOICE_BUCKET = 'voice-submissions'

/** 2 MiB — เสียงพูด 2 นาทีปกติราว 1 MB (ตรงกับ file_size_limit ของ bucket) */
export const MAX_VOICE_BYTES = 2 * 1024 * 1024

export const VOICE_MIME_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

export type UploadVoiceInput = {
  mimeType: string
  durationSec?: number
  transcriptText?: string | null
}

export type UploadVoiceResult =
  | { ok: true; storagePath: string; submission: VoiceSubmission }
  | { ok: false; reason: 'too-large' | 'bad-type'; message: string }

/**
 * อัปโหลดไฟล์เสียงของนักเรียน 1 ไฟล์ แล้วบันทึกแถวใน voice_submissions
 *
 * path เป็น `<studentId>/<uuid>.<ext>` เสมอ — policy ของ storage อ่าน student_id จากโฟลเดอร์ชั้นแรก
 * ห้ามเปลี่ยนรูปแบบ path โดยไม่แก้ migration
 * `studentId` ต้องมาจาก session cookie เท่านั้น
 */
export async function uploadVoice(
  studentId: string,
  data: ArrayBuffer | Uint8Array,
  input: UploadVoiceInput,
): Promise<UploadVoiceResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)

  if (bytes.byteLength > MAX_VOICE_BYTES) {
    const mb = (bytes.byteLength / 1024 / 1024).toFixed(2)
    return {
      ok: false,
      reason: 'too-large',
      message: `ไฟล์เสียงใหญ่ ${mb} MB เกินเพดาน 2 MB — อัดใหม่ให้สั้นลงหรือใช้คุณภาพต่ำลง`,
    }
  }

  const ext = VOICE_MIME_TYPES[input.mimeType]
  if (!ext) {
    return {
      ok: false,
      reason: 'bad-type',
      message: `ชนิดไฟล์ ${input.mimeType} ใช้ไม่ได้ — รับเฉพาะ ${Object.keys(VOICE_MIME_TYPES).join(', ')}`,
    }
  }

  const db = getServiceClient()
  const storagePath = `${studentId}/${crypto.randomUUID()}.${ext}`

  const uploaded = await db.storage.from(VOICE_BUCKET).upload(storagePath, bytes, {
    contentType: input.mimeType,
    upsert: false,
  })
  if (uploaded.error) fail('uploadVoice', uploaded.error)

  const submission = await saveVoiceSubmission(studentId, {
    durationSec: input.durationSec ?? 0,
    transcriptText: input.transcriptText ?? null,
    storagePath,
  })

  return { ok: true, storagePath, submission }
}

/** อายุลิงก์เสียงแบบสั้น — พอให้ครูกดฟังในคาบ ไม่พอให้ส่งต่อ */
export const VOICE_URL_TTL_SECONDS = 300

async function signVoicePath(storagePath: string, expiresIn: number): Promise<string> {
  const { data, error } = await getServiceClient()
    .storage.from(VOICE_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data) fail('signVoicePath', error ?? { message: 'ไม่ได้ URL กลับมา' })
  return data.signedUrl
}

/**
 * URL อายุสั้นให้ครูฟัง — ตรวจว่านักเรียนเจ้าของไฟล์อยู่ในห้องของครูคนนี้ใน query เดียวกัน
 * คืน null = ไม่ใช่ห้องของครูคนนี้ / ไม่มีแถว / แถวไม่มีไฟล์
 */
export async function getSignedVoiceUrl(
  teacherId: string,
  voiceSubmissionId: string,
  expiresIn = VOICE_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await getServiceClient()
    .from('voice_submissions')
    .select('storage_path, students!inner(classroom_id, classrooms!inner(teacher_id))')
    .eq('id', voiceSubmissionId)
    .eq('students.classrooms.teacher_id', teacherId)
    .maybeSingle()

  if (error) fail('getSignedVoiceUrl', error)
  if (!data?.storage_path) return null
  return signVoicePath(data.storage_path, expiresIn)
}

/** URL อายุสั้นให้นักเรียนฟังงานของตัวเอง — studentId ต้องมาจาก session cookie */
export async function getOwnSignedVoiceUrl(
  studentId: string,
  voiceSubmissionId: string,
  expiresIn = VOICE_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await getServiceClient()
    .from('voice_submissions')
    .select('storage_path')
    .eq('id', voiceSubmissionId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) fail('getOwnSignedVoiceUrl', error)
  if (!data?.storage_path) return null
  return signVoicePath(data.storage_path, expiresIn)
}

/** รายการเสียงของทั้งห้องให้ครูกดฟัง — ตรวจเจ้าของห้องใน query เดียว */
export async function listClassroomVoiceSubmissions(
  teacherId: string,
  classroomId: string,
): Promise<Array<VoiceSubmission & { nickname: string }> | null> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .select('id, students(nickname, voice_submissions(*))')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (error) fail('listClassroomVoiceSubmissions', error)
  if (!data) return null

  return data.students
    .flatMap((s) => s.voice_submissions.map((v) => ({ ...v, nickname: s.nickname })))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

// ------------------------------------------------------ ดาวรวม (ค่าเดียวที่ทุกจออ่าน)

/**
 * คำนวณดาวรวมใหม่จากแหล่งจริง (mission_progress ทั้ง m1-m4 และ boss) แล้วเขียนลง
 * `profiles.earned_stars` — **คำนวณใหม่ทุกครั้ง ไม่ใช่บวกสะสม** ครูแก้คะแนนแล้วเรียกซ้ำได้เลย
 *
 * เรียกทุกครั้งที่ดาวของภารกิจใดเปลี่ยน (setMissionStars / ครูยืนยันคะแนน)
 * ไม่งั้นจอเด็กกับแผงครูจะไม่ตรงกัน (QA เจอ 8/15 บนจอเด็ก แต่แผงครูขึ้น 0)
 */
export async function recalcStudentStars(studentId: string): Promise<Profile> {
  const { data, error } = await getServiceClient().rpc('recalc_student_stars', {
    p_student_id: studentId,
  })

  if (error) fail('recalcStudentStars', error)
  const row = data[0]
  if (!row) throw new Error('[db] recalcStudentStars: ไม่ได้แถว profiles กลับมา')
  return row
}

/**
 * **ฝั่งครู** ตั้งดาวภารกิจแล้วคิดดาวรวมใหม่ในธุรกรรมเดียว (REVIEW-8 H-1)
 *
 * ห้ามใช้ `setMissionStars` + `recalcStudentStars` จากเส้นทางของครู เพราะตัวแรกเป็น upsert
 * ตารางตรง ๆ ที่ไม่มีธง `app.teacher_write` → หลังเลยวันหมดเขตทำต่อที่บ้าน trigger ตีกลับ
 * → ครูกดยืนยันคะแนนไม่ได้เลย ทั้งที่กติกาคือครูตรวจงานต่อหลังคาบได้
 *
 * RPC ตรวจเจ้าของห้องในฟังก์ชันเดียวกับที่เขียน — ไม่ใช่เจ้าของคืน null (เว็บแปลงเป็น 404)
 */
export async function teacherSetMissionStars(
  teacherId: string,
  studentId: string,
  missionId: MissionTarget,
  stars: number,
): Promise<Profile | null> {
  const { data, error } = await getServiceClient().rpc('teacher_set_mission_stars', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_mission_id: missionId,
    p_stars: stars,
  })

  if (error) fail('teacherSetMissionStars', error)
  return data[0] ?? null
}

/**
 * ครูเปิดให้ใช้ AI ในคาบนี้อยู่ไหม (REVIEW-8 H-3)
 *
 * ไม่มีคาบเดินอยู่ = เปิด (ค่าตั้งต้น) — ปิดเมื่อครูกดปิดเท่านั้น
 * ทุกจุดที่จะเรียกโมเดลต้องถามตัวนี้ก่อน ปิดแล้วต้องตกไปใช้ทางสำรองแบบกฎล้วนทันที
 * อ่านไม่ได้ด้วยเหตุใดก็ตาม = ถือว่าเปิด แล้วให้ชั้น lib/ai ตัดสินใจ fallback ตามเงื่อนไขเดิม
 */
export async function isAiEnabledForStudent(studentId: string): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc('session_ai_enabled', {
    p_student_id: studentId,
  })

  if (error) fail('isAiEnabledForStudent', error)
  return data !== false
}

/**
 * **ประตู AI ที่เดียวของทั้งระบบ** — ทุกจุดที่จะเรียกโมเดลต้องผ่านตัวนี้
 *
 * ห้ามเขียน `if (await isAiEnabledForStudent(...))` เองที่ปลายทาง เพราะเงื่อนไขที่ก๊อปไว้หลายที่
 * จะเลื่อนหลุดจากกันเมื่อมีคนแก้ที่เดียว (มติ master คืน 30 ก.ย. หลังเจอปัญหานี้ 3 รอบ)
 * ตอนนี้มีผู้ใช้ 4 จุด: คำใบ้ · ลูกค้าจำลองสถานี B · คิวแต่งเรื่อง · คิวตรวจงานเบื้องหลัง
 *
 * ปิดแล้ว **ไม่แตะเครือข่ายเลย** จึงได้ผลจากกฎทันที ไม่ใช่รอครบงบเวลา 5 วินาทีก่อนตก fallback
 * เปิดกลับก็ใช้ AI ได้ทันทีในคำขอถัดไป เพราะอ่านค่าสดจากฐานข้อมูลทุกครั้ง ไม่มีแคชในหน่วยความจำ
 */
export async function withAiSwitch<T>(
  studentId: string,
  useAi: () => Promise<T>,
  useRules: () => T | Promise<T>,
): Promise<T> {
  return (await isAiEnabledForStudent(studentId)) ? useAi() : useRules()
}

/** ให้ดาวภารกิจแล้วอัปเดตดาวรวมให้ในคราวเดียว — ใช้ตัวนี้แทน setMissionStars เปล่า ๆ */
export async function setMissionStarsAndRecalc(
  studentId: string,
  missionId: MissionTarget,
  stars: number,
): Promise<{ mission: MissionProgress; profile: Profile }> {
  const mission = await setMissionStars(studentId, missionId, stars)
  const profile = await recalcStudentStars(studentId)
  return { mission, profile }
}

// -------------------------------------------- กระดานโชว์ผลงานเพื่อน (ห้ามเปรียบเทียบ)

export type ShowcaseItem = {
  nickname: string
  domainName: string
  tld: string
  reasonText: string | null
}

/**
 * ผลงานของเพื่อนในห้องเดียวกัน — ชื่อเล่น · ชื่อโดเมน · นามสกุล · เหตุผล เท่านั้น
 *
 * **ไม่คืนดาว คะแนน หรือสถานะผ่าน/ไม่ผ่านของใครทั้งสิ้น** ตำราห้ามเปรียบเทียบผู้เรียนกันเอง
 * SQL function เลือกมาแค่ 4 คอลัมน์นี้ จึงไม่มีทางหลุดแม้แก้โค้ดฝั่ง TS ผิด
 *
 * `studentId` (จาก session cookie) ใช้ยืนยันว่าอยู่ห้องนี้จริง — คนนอกห้องได้ [] เสมอ
 */
export async function listClassroomShowcase(
  classroomId: string,
  studentId: string,
): Promise<ShowcaseItem[]> {
  const { data, error } = await getServiceClient().rpc('classroom_showcase', {
    p_classroom_id: classroomId,
    p_student_id: studentId,
  })

  if (error) fail('listClassroomShowcase', error)

  return data.map((row) => ({
    nickname: row.nickname,
    domainName: row.domain_name,
    tld: row.tld,
    reasonText: row.reason_text,
  }))
}

/** ของเสริมบนการ์ดแกลเลอรีผลงานเพื่อน — ชื่อร้าน · ประเภท (เลือกภาพร้าน) · ใจ · จำนวนคำชมที่ไม่ถูกซ่อน */
export type ShowcaseExtra = {
  nickname: string
  businessName: string | null
  businessType: string | null
  likes: number
  likedByMe: boolean
  praises: number
}

/**
 * คนนอกห้องได้ [] เสมอ · ถ้าฐานข้อมูลยังไม่มีฟังก์ชันนี้ (ยังไม่ push migration) คืน [] แทนการพัง
 * แกลเลอรียังเปิดได้ แค่ไม่มีภาพร้านตามประเภทกับตัวนับ
 */
export async function listShowcaseExtras(
  classroomId: string,
  studentId: string,
): Promise<ShowcaseExtra[]> {
  const { data, error } = await getServiceClient().rpc('classroom_showcase_extras', {
    p_classroom_id: classroomId,
    p_student_id: studentId,
  })
  if (error) {
    console.warn('[listShowcaseExtras]', error.message)
    return []
  }
  return (data ?? []).map((row) => ({
    nickname: row.nickname,
    businessName: row.business_name ?? null,
    businessType: row.business_type ?? null,
    likes: row.likes ?? 0,
    likedByMe: row.liked_by_me === true,
    praises: row.praises ?? 0,
  }))
}

/** กดใจ/เลิกใจ — null = ไม่ได้อยู่ห้องเดียวกัน */
export async function setShowcaseLike(
  fromStudentId: string,
  toStudentId: string,
  liked: boolean,
): Promise<{ likes: number; liked: boolean } | null> {
  const { data, error } = await getServiceClient().rpc('set_showcase_like', {
    p_from_student_id: fromStudentId,
    p_to_student_id: toStudentId,
    p_liked: liked,
  })
  if (error) fail('setShowcaseLike', error)
  const row = data?.[0]
  return row ? { likes: row.likes ?? 0, liked: row.liked === true } : null
}

/** ครูดูจำนวนใจของแต่ละคนในห้องตัวเอง · ห้องไม่ใช่ของครู = [] */
export async function listTeacherShowcaseLikes(
  teacherId: string,
  classroomId: string,
): Promise<Array<{ nickname: string; likes: number }>> {
  const { data, error } = await getServiceClient().rpc('teacher_showcase_likes', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })
  if (error) {
    console.warn('[listTeacherShowcaseLikes]', error.message)
    return []
  }
  return (data ?? []).map((row) => ({ nickname: row.nickname, likes: row.likes ?? 0 }))
}

// --------------------------------------------- นโยบายเก็บไฟล์เสียง 90 วัน (PDPA)

/** ครูสั่งลบไฟล์เสียงก่อนครบกำหนด — ลบทั้งไฟล์ใน bucket และแถวใน DB · null = ไม่ใช่ห้องของครูคนนี้ */
export async function deleteVoiceSubmission(
  teacherId: string,
  voiceSubmissionId: string,
): Promise<{ id: string; storagePath: string | null } | null> {
  const db = getServiceClient()
  const { data, error } = await db.rpc('delete_voice_submission', {
    p_teacher_id: teacherId,
    p_voice_id: voiceSubmissionId,
  })

  if (error) fail('deleteVoiceSubmission', error)
  const row = data[0]
  if (!row) return null

  if (row.storage_path) {
    const removed = await db.storage.from(VOICE_BUCKET).remove([row.storage_path])
    if (removed.error) fail('deleteVoiceSubmission (ลบไฟล์)', removed.error)
  }
  return { id: row.id, storagePath: row.storage_path }
}

/**
 * ลบไฟล์เสียงที่ครบ 90 วันแล้วทั้งแถวและไฟล์ — ให้ cron เรียกวันละครั้ง
 * ดูวิธีตั้ง cron ใน docs/deploy.md หัวข้อ "นโยบายเก็บไฟล์เสียง"
 */
export async function purgeExpiredVoiceSubmissions(): Promise<{
  rows: number
  files: number
  paths: string[]
}> {
  const db = getServiceClient()
  const { data, error } = await db.rpc('expire_voice_submissions')
  if (error) fail('purgeExpiredVoiceSubmissions', error)

  const paths = data
    .map((row) => row.storage_path)
    .filter((p): p is string => typeof p === 'string' && p.length > 0)

  let files = 0
  if (paths.length > 0) {
    const removed = await db.storage.from(VOICE_BUCKET).remove(paths)
    if (removed.error) fail('purgeExpiredVoiceSubmissions (ลบไฟล์)', removed.error)
    files = removed.data?.length ?? 0
  }

  return { rows: data.length, files, paths }
}

/**
 * ครูลบห้องเรียนทั้งห้อง — ลบไฟล์เสียงใน bucket ก่อน แล้วค่อยลบแถวห้อง
 * แถวลูกทุกตาราง (students · profiles · progress · submissions · events · route_changes ·
 * reflections · mission_progress · peer_feedback · mission_skips · chat_messages ·
 * voice_submissions) หายตาม FK on delete cascade
 * คืน null = ไม่ใช่ห้องของครูคนนี้
 */
export async function deleteClassroom(
  teacherId: string,
  classroomId: string,
): Promise<{ deletedFiles: number } | null> {
  const db = getServiceClient()

  const paths = await db.rpc('classroom_voice_paths', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })
  if (paths.error) fail('deleteClassroom (อ่านไฟล์เสียง)', paths.error)

  const owned = await getOwnedClassroom(teacherId, classroomId)
  if (!owned) return null

  const list = paths.data
    .map((row) => row.storage_path)
    .filter((p): p is string => typeof p === 'string' && p.length > 0)

  let deletedFiles = 0
  if (list.length > 0) {
    const removed = await db.storage.from(VOICE_BUCKET).remove(list)
    if (removed.error) fail('deleteClassroom (ลบไฟล์เสียง)', removed.error)
    deletedFiles = removed.data?.length ?? 0
  }

  const { error } = await db
    .from('classrooms')
    .delete()
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
  if (error) fail('deleteClassroom', error)

  return { deletedFiles }
}

export interface DemoResetCounts {
  students: number
  planRequests: number
  broadcasts: number
  flags: number
  quizItems: number
  surveys: number
  sessions: number
  voiceFiles: number
}

/**
 * E-16 ล้างห้องสาธิตกลับเป็นห้องว่าง — ใช้ตอนสาธิตสดแล้วห้องเละ
 *
 * **การตัดสินว่าล้างได้ไหมอยู่ใน SQL ไม่ใช่ที่นี่** (`reset_demo_classroom`)
 * ชั้นนี้ทำแค่แปล errcode ที่ฐานข้อมูลโยนมาเป็นเหตุผลให้ route ตอบสถานะให้ถูก
 *   - 'not-found' = ไม่ใช่ห้องของครูคนนี้ (หรือไม่มีห้องนี้)  -> 404
 *   - 'not-demo'  = ห้องเรียนจริง ล้างไม่ได้เด็ดขาด           -> 403
 */
export async function resetDemoClassroom(
  teacherId: string,
  classroomId: string,
): Promise<{ ok: true; counts: DemoResetCounts } | { ok: false; reason: 'not-found' | 'not-demo' }> {
  const db = getServiceClient()

  // อ่านรายการไฟล์เสียงก่อนลบแถว ไม่งั้นแถวหายแล้วหา path ไม่เจอ ไฟล์ค้างใน bucket ตลอดไป
  const paths = await db.rpc('classroom_voice_paths', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })
  if (paths.error) fail('resetDemoClassroom (อ่านไฟล์เสียง)', paths.error)

  const { data, error } = await db.rpc('reset_demo_classroom', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })
  if (error) {
    if (error.code === 'P0002') return { ok: false, reason: 'not-found' }
    if (error.code === '42501') return { ok: false, reason: 'not-demo' }
    fail('resetDemoClassroom', error)
  }

  const list = paths.data
    .map((row) => row.storage_path)
    .filter((p): p is string => typeof p === 'string' && p.length > 0)

  let voiceFiles = 0
  if (list.length > 0) {
    const removed = await db.storage.from(VOICE_BUCKET).remove(list)
    if (removed.error) fail('resetDemoClassroom (ลบไฟล์เสียง)', removed.error)
    voiceFiles = removed.data?.length ?? 0
  }

  const row = data?.[0]
  return {
    ok: true,
    counts: {
      students: row?.deleted_students ?? 0,
      planRequests: row?.deleted_plan_requests ?? 0,
      broadcasts: row?.deleted_broadcasts ?? 0,
      flags: row?.deleted_flags ?? 0,
      quizItems: row?.deleted_quiz_items ?? 0,
      surveys: row?.deleted_surveys ?? 0,
      sessions: row?.deleted_sessions ?? 0,
      voiceFiles,
    },
  }
}

// ----------------------------------------------- คิวตรวจงานด้วย AI (grade_jobs)

export const GRADE_JOB_STATUSES = ['pending', 'claimed', 'done', 'failed'] as const
export type GradeJobStatus = (typeof GRADE_JOB_STATUSES)[number]

/** ลองสูงสุดกี่ครั้งต่อ 1 งานก่อนปักเป็น failed — ครูยังให้คะแนนเองได้เสมอ */
export const GRADE_JOB_MAX_ATTEMPTS = 3

/** งานที่ claimed ค้างเกินกี่นาทีถือว่า worker ตาย ให้ดึงกลับเข้าคิว */
export const GRADE_JOB_STALE_MINUTES = 5

/**
 * เข้าคิวให้ AI ตรวจงานเบื้องหลัง
 * `studentId` ต้องมาจาก session cookie · คิวอยู่ในตาราง เซิร์ฟเวอร์ดับแล้วงานไม่หาย
 */
export async function enqueueGradeJob(
  studentId: string,
  submissionId: string | null,
  input: NonNullable<Json> = {},
): Promise<GradeJob> {
  const { data, error } = await getServiceClient()
    .from('grade_jobs')
    .insert({ student_id: studentId, submission_id: submissionId, input })
    .select()
    .single()

  if (error) fail('enqueueGradeJob', error)
  return data
}

/**
 * หยิบงานถัดไปมาทำ — atomic ด้วย `for update skip locked` ใน SQL
 * worker หลายตัวเรียกพร้อมกันจะได้คนละงานเสมอ · คืน null เมื่อคิวว่าง
 */
export async function claimNextGradeJob(
  maxAttempts = GRADE_JOB_MAX_ATTEMPTS,
): Promise<GradeJob | null> {
  const { data, error } = await getServiceClient().rpc('claim_next_grade_job', {
    p_max_attempts: maxAttempts,
  })

  if (error) fail('claimNextGradeJob', error)
  return data[0] ?? null
}

/** ดึงงานที่ worker ตายคางับไว้กลับเข้าคิว — เรียกจาก cron หรือตอน worker เริ่มรอบใหม่ */
export async function reclaimStaleGradeJobs(
  olderThanMinutes = GRADE_JOB_STALE_MINUTES,
): Promise<GradeJob[]> {
  const { data, error } = await getServiceClient().rpc('reclaim_stale_grade_jobs', {
    p_older_than_minutes: olderThanMinutes,
  })

  if (error) fail('reclaimStaleGradeJobs', error)
  return data
}

export async function completeGradeJob(jobId: string, aiResult: NonNullable<Json>): Promise<GradeJob | null> {
  const { data, error } = await getServiceClient().rpc('complete_grade_job', {
    p_job_id: jobId,
    p_ai_result: aiResult,
  })

  if (error) fail('completeGradeJob', error)
  return data[0] ?? null
}

/** งานพัง — ยังไม่ครบโควตาจะกลับไป pending เอง ครบแล้วปักเป็น failed */
export async function failGradeJob(
  jobId: string,
  message: string,
  maxAttempts = GRADE_JOB_MAX_ATTEMPTS,
): Promise<GradeJob | null> {
  const { data, error } = await getServiceClient().rpc('fail_grade_job', {
    p_job_id: jobId,
    p_error: message.slice(0, 500),
    p_max_attempts: maxAttempts,
  })

  if (error) fail('failGradeJob', error)
  return data[0] ?? null
}

export async function listGradeJobs(
  studentId: string,
  status?: GradeJobStatus,
): Promise<GradeJob[]> {
  const query = getServiceClient()
    .from('grade_jobs')
    .select()
    .eq('student_id', studentId)
    .order('created_at')

  const { data, error } = status ? await query.eq('status', status) : await query
  if (error) fail('listGradeJobs', error)
  return data
}

/**
 * เติมคะแนนที่ AI เสนอย้อนหลังลงงานที่ส่งไปแล้ว (worker ตรวจเสร็จทีหลัง)
 *
 * `student_id` อยู่ในเงื่อนไข UPDATE ด้วย — ส่ง submissionId ของคนอื่นมาก็เขียนไม่ได้ (คืน null)
 * ไม่แตะ `teacher_confirmed_scores` และไม่ปลด `needs_review` — ครูยังต้องเป็นคนตัดสินเสมอ
 */
export async function updateSubmissionAiScores(
  studentId: string,
  submissionId: string,
  aiScores: NonNullable<Json>,
): Promise<Submission | null> {
  const { data, error } = await getServiceClient()
    .from('submissions')
    .update({ ai_scores: aiScores, updated_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('student_id', studentId)
    .select()
    .maybeSingle()

  if (error) fail('updateSubmissionAiScores', error)
  return data
}

// ═══════════════════════════════════ T-03 ครูควบคุมช่วงของคาบและเวลา
//
// "ช่วงของห้อง" คือเพดานสูงสุดที่ครูเปิดให้ทำ (สเปกข้อ 3.2) ส่วนตำแหน่งจริงของนักเรียน
// อยู่ที่ mission_progress ของแต่ละคน ครูปลดล็อกให้รายคนก่อนทั้งห้องได้ด้วย unlockStudentPhase()
//
// ทุกฟังก์ชันในหมวดนี้ตรวจความเป็นเจ้าของห้อง **ใน SQL คิวรีเดียวกับที่เขียน**
// ไม่ใช่เจ้าของ = คืน null ให้ API route แปลงเป็น 404

export type ClassSession = Tables<'class_sessions'>
export type SessionPhaseChange = Tables<'session_phase_changes'>
export type StudentPhaseUnlock = Tables<'student_phase_unlocks'>
export type BuddyRequest = Tables<'buddy_requests'>
export type BuddyOffer = Tables<'buddy_offers'>
export type SurveyResponse = Tables<'survey_responses'>

/** ช่วงของคาบตามสเปกข้อ 3.2 เรียงตามลำดับจริง — ห้ามสลับลำดับ หน้าเว็บใช้ index นี้เทียบว่าเลยช่วงไหนแล้ว */
export const SESSION_PHASES = [
  'wait',
  'onboard',
  'mission',
  'boss',
  'summary',
  'reflect',
  'end',
  'home',
] as const
export type SessionPhase = (typeof SESSION_PHASES)[number]

/** ชื่อช่วงบนจอครู (สเปกข้อ 3.2) */
export const SESSION_PHASE_LABELS: Record<SessionPhase, string> = {
  wait: 'รอเริ่ม (ครูสอนสไลด์)',
  onboard: 'รู้จักตัวเอง',
  mission: 'ภารกิจย่อย',
  boss: 'ด่านบอส',
  summary: 'ครูสรุป (ดูจอหน้าห้อง)',
  reflect: 'สะท้อนคิด',
  end: 'จบคาบ',
  home: 'ทำต่อที่บ้าน',
}

/** ช่วงที่ปลดล็อกให้รายคนได้ — 'wait' กับ 'end' ไม่มีความหมายในระดับรายคน */
export const UNLOCKABLE_PHASES = [
  'onboard',
  'mission',
  'boss',
  'summary',
  'reflect',
  'home',
] as const
export type UnlockablePhase = (typeof UNLOCKABLE_PHASES)[number]

/** ย้อนการย้ายช่วงได้ภายในกี่วินาที (สเปก T-03 = 30) */
export const PHASE_UNDO_SECONDS = 30
/** ผู้ช่วยมีเวลาตอบคำขอคู่หูกี่วินาที (สเปก S-41 = 60) */
export const BUDDY_OFFER_SECONDS = 60
/** ส่งคำขอคู่หูได้สูงสุดกี่คนต่อหนึ่งใบ (สเปก E-04 = 3) */
export const BUDDY_MAX_OFFERS = 3

export function isSessionPhase(value: string): value is SessionPhase {
  return (SESSION_PHASES as readonly string[]).includes(value)
}

/** ช่วง a ไปไกลกว่าหรือเท่ากับ b ไหม — ใช้ตัดสินว่านักเรียนเข้าหน้านั้นได้หรือยัง */
export function phaseAtLeast(current: SessionPhase, required: SessionPhase): boolean {
  return SESSION_PHASES.indexOf(current) >= SESSION_PHASES.indexOf(required)
}

/** เปิดคาบของห้อง หรือคืนคาบที่กำลังเดินอยู่ (หนึ่งห้องมีคาบค้างได้ครั้งละ 1 คาบ) */
export async function ensureClassSession(
  teacherId: string,
  classroomId: string,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('ensure_class_session', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('ensureClassSession', error)
  return data[0] ?? null
}

/**
 * อ่านคาบที่กำลังเดินอยู่ของห้อง — **ไม่ต้องมี teacherId** เพราะฝั่งนักเรียนก็ต้องรู้ว่าห้องอยู่ช่วงไหน
 * คืนเฉพาะข้อมูลช่วงและนาฬิกา ไม่มีข้อมูลของนักเรียนคนอื่นปนมา
 */
export async function getActiveClassSession(classroomId: string): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient()
    .from('class_sessions')
    .select()
    .eq('classroom_id', classroomId)
    .is('ended_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) fail('getActiveClassSession', error)
  return data
}

/** ย้ายทั้งห้องไปช่วงใหม่ (ข้ามช่วงได้) — ส่ง timerSeconds เพื่อตั้งนาฬิกาของช่วงนั้นพร้อมกัน */
export async function setSessionPhase(
  teacherId: string,
  sessionId: string,
  phase: SessionPhase,
  timerSeconds: number | null = null,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('set_session_phase', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_phase: phase,
    p_timer_seconds: timerSeconds ?? undefined,
  })

  if (error) fail('setSessionPhase', error)
  return data[0] ?? null
}

/** ย้อนการย้ายช่วงล่าสุด เผื่อครูกดพลาด — เลยเวลาแล้วคืน null */
export async function revertSessionPhase(
  teacherId: string,
  sessionId: string,
  withinSeconds = PHASE_UNDO_SECONDS,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('revert_session_phase', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_within_seconds: withinSeconds,
  })

  if (error) fail('revertSessionPhase', error)
  return data[0] ?? null
}

/** ปุ่ม "ตั้งใหม่" — ตั้งนาฬิกาของช่วงปัจจุบันเป็นกี่วินาที (null = ไม่มีนาฬิกา) */
export async function setSessionTimer(
  teacherId: string,
  sessionId: string,
  seconds: number,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('set_session_timer', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_seconds: seconds,
  })

  if (error) fail('setSessionTimer', error)
  return data[0] ?? null
}

/** ปุ่ม +1 / +3 / +5 นาที — ใช้ได้ทั้งตอนนาฬิกาเดินและตอนหยุดอยู่ */
export async function extendSessionTimer(
  teacherId: string,
  sessionId: string,
  addSeconds: number,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('extend_session_timer', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_add_seconds: addSeconds,
  })

  if (error) fail('extendSessionTimer', error)
  return data[0] ?? null
}

/** ปุ่ม ⏸ หยุด / เดินต่อ — หยุดแล้วเวลาที่เหลือถูกเก็บไว้ ไม่ไหลต่อ */
export async function pauseSessionTimer(
  teacherId: string,
  sessionId: string,
  paused: boolean,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('pause_session_timer', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_paused: paused,
  })

  if (error) fail('pauseSessionTimer', error)
  return data[0] ?? null
}

/** ปุ่ม 📺 ให้ทุกคนดูจอหน้าห้อง — ขึ้นหน้าพักทุกเครื่องโดยไม่เปลี่ยนช่วง */
export async function setFocusScreen(
  teacherId: string,
  sessionId: string,
  on: boolean,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('set_focus_screen', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_on: on,
  })

  if (error) fail('setFocusScreen', error)
  return data[0] ?? null
}

/** ตั้งค่าคาบ (T-02) — ส่งเฉพาะค่าที่จะเปลี่ยน ที่เหลือคงเดิม */
export async function updateSessionSettings(
  teacherId: string,
  sessionId: string,
  settings: {
    aiEnabled?: boolean
    allowEarlyBoss?: boolean
    surveyEnabled?: boolean
    homeDeadline?: string
  },
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('update_session_settings', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_ai_enabled: settings.aiEnabled,
    p_allow_early_boss: settings.allowEarlyBoss,
    p_survey_enabled: settings.surveyEnabled,
    p_home_deadline: settings.homeDeadline,
  })

  if (error) fail('updateSessionSettings', error)
  return data[0] ?? null
}

/** ช่วงที่ตั้งเวลาได้ — 'end' กับ 'home' ไม่มีนาฬิกา */
export const TIMED_PHASES = ['wait', 'onboard', 'mission', 'boss', 'summary', 'reflect'] as const
export type TimedPhase = (typeof TIMED_PHASES)[number]

/**
 * แผนเวลาตั้งต้น 60 นาที (docs/lesson-plan.md ขั้นที่ 1-6)
 * ตัวเลขชุดเดียวกับ `public.default_phase_minutes()` ใน SQL — แก้ที่ไหนต้องแก้ทั้งสองที่
 */
export const DEFAULT_PHASE_MINUTES: Record<TimedPhase, number> = {
  wait: 15,
  onboard: 5,
  mission: 20,
  boss: 10,
  summary: 5,
  reflect: 5,
}

/**
 * ครูตั้งค่าคาบที่เหลือ (T-02) — ตรวจเจ้าของห้องในคิวรีเดียวกับที่เขียน ไม่ใช่เจ้าของคืน null
 *
 * - `classMinutes` อย่างเดียว = โหมดคาบสั้น/ยาว ระบบย่อขยายทุกช่วงตามสัดส่วนแผน 60 นาที
 *   (ย่อแบบกลไก ไม่ใช่แผนการสอนใหม่ — ครูปรับรายช่วงต่อได้)
 * - `phaseMinutes` ส่งเฉพาะช่วงที่แก้ เช่น `{ mission: 25 }` ระบบผสมทับของเดิม
 */
export async function setClassPlan(
  teacherId: string,
  sessionId: string,
  plan: {
    classMinutes?: number
    phaseMinutes?: Partial<Record<TimedPhase, number>>
    allowSkipMissions?: boolean
  },
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('set_class_plan', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_class_minutes: plan.classMinutes,
    p_phase_minutes: plan.phaseMinutes as Json | undefined,
    p_allow_skip_missions: plan.allowSkipMissions,
  })

  if (error) fail('setClassPlan', error)
  return data[0] ?? null
}

/**
 * ตั้ง/ล้างวันหมดเขตทำต่อที่บ้าน (S-37) — ส่ง null = ล้าง กลับไปเขียนได้เรื่อย ๆ
 * ใช้ตัวนี้แทน `updateSessionSettings({ homeDeadline })` เมื่อจะล้างค่า
 * (ตัวนั้นใช้ coalesce ฝั่ง SQL จึงล้างเป็น null ไม่ได้)
 *
 * ประตูหมดเขตบังคับด้วย trigger ในฐานข้อมูล ไม่ใช่ที่หน้าเว็บ
 */
export async function setHomeDeadline(
  teacherId: string,
  sessionId: string,
  deadline: string | null,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('set_home_deadline', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    // ไม่ส่งค่า = ใช้ค่าตั้งต้น null ของ RPC = ล้างวันหมดเขต
    p_deadline: deadline ?? undefined,
  })

  if (error) fail('setHomeDeadline', error)
  return data[0] ?? null
}

/** ปิดคาบจริง (หมดช่วงทำต่อที่บ้านแล้ว) — ปิดแล้วเปิดคาบใหม่ของห้องเดิมได้ */
export async function closeClassSession(
  teacherId: string,
  sessionId: string,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('close_class_session', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
  })

  if (error) fail('closeClassSession', error)
  return data[0] ?? null
}

export async function listSessionPhaseChanges(
  teacherId: string,
  sessionId: string,
): Promise<SessionPhaseChange[]> {
  const session = await getServiceClient()
    .from('class_sessions')
    .select('id, classrooms!inner(teacher_id)')
    .eq('id', sessionId)
    .eq('classrooms.teacher_id', teacherId)
    .maybeSingle()

  if (session.error) fail('listSessionPhaseChanges', session.error)
  if (!session.data) return []

  const { data, error } = await getServiceClient()
    .from('session_phase_changes')
    .select()
    .eq('session_id', sessionId)
    .order('changed_at', { ascending: false })

  if (error) fail('listSessionPhaseChanges', error)
  return data
}

/** ปลดล็อกช่วงให้นักเรียนรายคน (เช่น เปิดด่านบอสให้คนที่พร้อมก่อนทั้งห้อง) */
export async function unlockStudentPhase(
  teacherId: string,
  studentId: string,
  phase: UnlockablePhase,
  note?: string,
): Promise<StudentPhaseUnlock | null> {
  const { data, error } = await getServiceClient().rpc('unlock_student_phase', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_phase: phase,
    p_note: note,
  })

  if (error) fail('unlockStudentPhase', error)
  return data[0] ?? null
}

export async function revokeStudentPhaseUnlock(
  teacherId: string,
  studentId: string,
  phase: UnlockablePhase,
): Promise<StudentPhaseUnlock | null> {
  const { data, error } = await getServiceClient().rpc('revoke_student_phase_unlock', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_phase: phase,
  })

  if (error) fail('revokeStudentPhaseUnlock', error)
  return data[0] ?? null
}

/** ช่วงที่นักเรียนคนนี้ถูกปลดล็อกไว้เป็นพิเศษ (ยังไม่ถูกยกเลิก) */
export async function listStudentPhaseUnlocks(studentId: string): Promise<StudentPhaseUnlock[]> {
  const { data, error } = await getServiceClient()
    .from('student_phase_unlocks')
    .select()
    .eq('student_id', studentId)
    .is('revoked_at', null)

  if (error) fail('listStudentPhaseUnlocks', error)
  return data
}

/** นักเรียนยังใช้งานอยู่ — E-04 ใช้เกณฑ์ "ใช้งานใน 60 วินาทีที่ผ่านมา" ตัดสินว่าขอคู่หูได้ไหม */
export async function touchStudentPresence(
  studentId: string,
  screen?: string,
): Promise<void> {
  const { error } = await getServiceClient().rpc('touch_student_presence', {
    p_student_id: studentId,
    p_screen: screen,
  })

  if (error) fail('touchStudentPresence', error)
}

// ═════════════════════════════════════ S-40 แบบสอบถามความพึงพอใจ
//
// คำตอบไม่ผูกกับชื่อผู้ตอบโดยการออกแบบ: survey_responses ไม่มีคอลัมน์ student_id เลย
// ระบบจำแค่ "ใครตอบแล้ว" ไว้ใน survey_completions เพื่อกันตอบซ้ำ

export const SURVEY_SCALE_ITEMS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'] as const
export type SurveyScaleItem = (typeof SURVEY_SCALE_ITEMS)[number]

export interface SurveyItemSummary {
  n: number
  mean: number | null
  sd: number | null
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>
}

export interface SurveySummary {
  responses: number
  completed: number
  overallMean: number | null
  items: Record<string, SurveyItemSummary>
  openEnded: { like: string[]; improve: string[] }
}

/** เกณฑ์แปลผลค่าเฉลี่ยตามสเปก S-40 */
export function interpretSurveyMean(mean: number | null): string {
  if (mean === null) return 'ยังไม่มีข้อมูล'
  if (mean >= 4.51) return 'มากที่สุด'
  if (mean >= 3.51) return 'มาก'
  if (mean >= 2.51) return 'ปานกลาง'
  if (mean >= 1.51) return 'น้อย'
  return 'น้อยที่สุด'
}

/**
 * ส่งแบบสอบถาม — คืน false เมื่อคนนี้ตอบไปแล้ว (ตอบได้ครั้งเดียว)
 * `likeText` / `improveText` คือต้นฉบับที่เก็บไว้ · `*Safe` คือฉบับที่ผ่านตัวกรองคำไม่เหมาะสมซึ่งครูเห็น
 */
export async function submitSurveyResponse(
  studentId: string,
  scores: Record<SurveyScaleItem, number>,
  openEnded: {
    likeText?: string | null
    improveText?: string | null
    likeTextSafe?: string | null
    improveTextSafe?: string | null
  } = {},
): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc('submit_survey_response', {
    p_student_id: studentId,
    p_scores: scores,
    p_like_text: openEnded.likeText ?? undefined,
    p_improve_text: openEnded.improveText ?? undefined,
    p_like_text_safe: openEnded.likeTextSafe ?? undefined,
    p_improve_text_safe: openEnded.improveTextSafe ?? undefined,
  })

  if (error) fail('submitSurveyResponse', error)
  return data === true
}

/** ตอบแบบสอบถามไปแล้วหรือยัง (ใช้ตัดสินว่าจะขึ้นแบบสอบถามอีกไหม) */
export async function hasSubmittedSurvey(studentId: string): Promise<boolean> {
  const { data, error } = await getServiceClient()
    .from('survey_completions')
    .select('student_id')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) fail('hasSubmittedSurvey', error)
  return data !== null
}

/** สรุปแบบสอบถามให้ครู — **ไม่มีชื่อผู้ตอบ** และข้อความที่คืนเป็นฉบับกรองคำแล้ว */
export async function getSurveySummary(
  teacherId: string,
  classroomId: string,
): Promise<SurveySummary | null> {
  const { data, error } = await getServiceClient().rpc('survey_summary', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('getSurveySummary', error)
  return (data as unknown as SurveySummary | null) ?? null
}

// ══════════════════════════════════════ E-04 / S-41 คู่หูและคู่คิด

export interface BuddyCandidate {
  student_id: string
  nickname: string
  score: number
}

/** หาคนที่เป็นคู่หูได้ตามเกณฑ์ E-04 เรียงตามคะแนน (คนที่ช่วยไปแล้วถูกเลือกน้อยลง) */
export async function findBuddyCandidates(
  studentId: string,
  missionId: string,
  limit = BUDDY_MAX_OFFERS,
): Promise<BuddyCandidate[]> {
  const { data, error } = await getServiceClient().rpc('find_buddy_candidates', {
    p_student_id: studentId,
    p_mission_id: missionId,
    p_limit: limit,
  })

  if (error) fail('findBuddyCandidates', error)
  return data as BuddyCandidate[]
}

/** เปิดคำขอคู่หูใบใหม่ — มีคำขอที่ยังไม่จบอยู่แล้วจะคืน null (กติกา E-04: ครั้งละ 1 ใบ) */
export async function createBuddyRequest(
  studentId: string,
  missionId: string,
  kind: 'buddy' | 'thinking-partner' = 'buddy',
): Promise<BuddyRequest | null> {
  const { data, error } = await getServiceClient().rpc('create_buddy_request', {
    p_student_id: studentId,
    p_mission_id: missionId,
    p_kind: kind,
  })

  if (error) fail('createBuddyRequest', error)
  return data[0] ?? null
}

/** ส่งคำขอไปที่ผู้ช่วยคนถัดไป (ลองได้สูงสุด 3 คน · ตอบภายใน 60 วินาที) */
export async function offerBuddyRequest(
  requestId: string,
  helperId: string,
  matchScore: number | null = null,
  seconds = BUDDY_OFFER_SECONDS,
): Promise<BuddyOffer | null> {
  const { data, error } = await getServiceClient().rpc('offer_buddy_request', {
    p_request_id: requestId,
    p_helper_id: helperId,
    p_match_score: matchScore ?? undefined,
    p_seconds: seconds,
  })

  if (error) fail('offerBuddyRequest', error)
  return data[0] ?? null
}

/** ผู้ช่วยกด "ช่วยได้" / "ตอนนี้ไม่สะดวก" — ตอบแทนคนอื่นไม่ได้ (helperId อยู่ในเงื่อนไข UPDATE) */
export async function respondBuddyOffer(
  helperId: string,
  offerId: string,
  accept: boolean,
): Promise<BuddyOffer | null> {
  const { data, error } = await getServiceClient().rpc('respond_buddy_offer', {
    p_helper_id: helperId,
    p_offer_id: offerId,
    p_accept: accept,
  })

  if (error) fail('respondBuddyOffer', error)
  return data[0] ?? null
}

/** ผู้ขอปิดคำขอ — เก็บผลตอบรับและผลว่าผ่านภารกิจไหมหลังเพื่อนช่วย (ไม่มีผลต่อดาวของใคร) */
export async function completeBuddyRequest(
  studentId: string,
  requestId: string,
  feedback: 'helpful' | 'ok' | null = null,
  passedAfter: boolean | null = null,
): Promise<BuddyRequest | null> {
  const { data, error } = await getServiceClient().rpc('complete_buddy_request', {
    p_student_id: studentId,
    p_request_id: requestId,
    p_feedback: feedback ?? undefined,
    p_passed_after: passedAfter ?? undefined,
  })

  if (error) fail('completeBuddyRequest', error)
  return data[0] ?? null
}

/** คำขอที่ไม่มีใครตอบใน 60 วินาที — ให้หมดอายุแล้วกลับไปหาคนถัดไป */
export async function expireBuddyOffers(): Promise<number> {
  const { data, error } = await getServiceClient().rpc('expire_buddy_offers')
  if (error) fail('expireBuddyOffers', error)
  return data ?? 0
}

/** คำขอที่ค้างอยู่ของนักเรียนคนหนึ่ง (ใบที่ยังไม่จบมีได้ใบเดียว) */
export async function getOpenBuddyRequest(studentId: string): Promise<BuddyRequest | null> {
  const { data, error } = await getServiceClient()
    .from('buddy_requests')
    .select()
    .eq('requester_id', studentId)
    .in('status', ['searching', 'pending', 'accepted'])
    .maybeSingle()

  if (error) fail('getOpenBuddyRequest', error)
  return data
}

/** คำขอที่รอคนนี้ตอบอยู่ — หน้าเว็บของผู้ช่วยเอาไปขึ้นแผ่นคำขอ (S-41) */
export async function listPendingBuddyOffers(helperId: string): Promise<BuddyOffer[]> {
  const { data, error } = await getServiceClient()
    .from('buddy_offers')
    .select()
    .eq('helper_id', helperId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('sent_at')

  if (error) fail('listPendingBuddyOffers', error)
  return data
}

/** ครูดูว่าใครช่วยใคร เรื่องอะไร และผู้ขอผ่านไหมหลังได้รับความช่วยเหลือ (T-05, T-10) */
export async function listClassroomBuddyLog(
  teacherId: string,
  classroomId: string,
): Promise<BuddyRequest[]> {
  const owner = await getServiceClient()
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (owner.error) fail('listClassroomBuddyLog', owner.error)
  if (!owner.data) return []

  const { data, error } = await getServiceClient()
    .from('buddy_requests')
    .select()
    .eq('classroom_id', classroomId)
    .order('created_at', { ascending: false })

  if (error) fail('listClassroomBuddyLog', error)
  return data
}

// ═══════════════════════════════════ T-10 / T-11 รายงานของครู
//
// ทั้งสองฟังก์ชันตรวจเจ้าของใน SQL ก่อนอ่านอะไรทั้งสิ้น ไม่ใช่เจ้าของ = คืน null
// **ห้ามคืนข้อมูลข้ามห้องเด็ดขาด** — ทุก subquery ผูกกับ roster ของห้องนั้นเท่านั้น

export interface StudentReport {
  student: { id: string; nickname: string; classroomId: string; joinedAt: string }
  profile: Record<string, Json> | null
  tests: { pre: number | null; post: number | null; gain: number | null }
  stars: { earned: number | null; goalStars: number | null; goalLevel: number | null }
  missions: {
    missionId: string
    channelUsed: string | null
    attempts: number
    hintsUsed: number
    stars: number | null
    passedAt: string | null
    startedAt: string | null
    secondsSpent: number | null
  }[]
  skips: { missionId: string; reason: string | null; skippedAt: string }[]
  routeChanges: {
    count: number
    items: {
      missionId: string | null
      from: string | null
      to: string
      changedBy: string | null
      changedAt: string
    }[]
  }
  boss: Record<string, Json>[]
  reflections: { questionId: string; answer: string; createdAt: string }[]
  peerFeedback: { given: number; received: number }
  buddy: { helpedOthers: number; askedForHelp: number; passedAfterHelp: number }
  confidence: Record<string, number> | null
}

/** รายงานรายคน (T-10) — รอบเดียวจบ ไม่ยิงทีละตาราง */
export async function getStudentReport(
  teacherId: string,
  studentId: string,
): Promise<StudentReport | null> {
  const { data, error } = await getServiceClient().rpc('student_report', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
  })

  if (error) fail('getStudentReport', error)
  return (data as unknown as StudentReport | null) ?? null
}

export interface ClassroomReport {
  classroomId: string
  students: number
  tests: Record<string, number | null>
  stars: Record<string, number | null>
  routes: Record<string, number>
  routeSuggestedVsChosen: { followedSuggestion: number; choseDifferent: number }
  routeChanges: { total: number; students: number }
  missions: Record<string, Record<string, number | null>>
  skips: Record<string, number>
  boss: Record<string, number>
  buddy: Record<string, number>
  reflections: number
  survey: SurveySummary | null
}

/** รายงานรายห้อง (T-11) — ตัวเลขรวมของห้อง ไม่มีการจัดอันดับผู้เรียน */
export async function getClassroomReport(
  teacherId: string,
  classroomId: string,
): Promise<ClassroomReport | null> {
  const { data, error } = await getServiceClient().rpc('classroom_report', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('getClassroomReport', error)
  return (data as unknown as ClassroomReport | null) ?? null
}

// ═══════════════════════════ T-06 ครูดูและปรับแผนรายคน (หลักฐานการแก้)
//
// สเปกหลักการใช้ AI ข้อ 7: "ครูแก้ได้" — ทุกการแก้เขียน `teacher_overrides`
// ในทรานแซกชันเดียวกับการแก้จริง เก็บทั้ง **ค่าเดิม ค่าใหม่ ใครแก้ เมื่อไร และเหตุผล**
// ไม่ใช่เจ้าของห้อง = ไม่แก้และ **ไม่เขียนประวัติ** (กันปลอมหลักฐาน)

export type TeacherOverride = Tables<'teacher_overrides'>
export type TeacherNote = Tables<'teacher_notes'>
export type Broadcast = Tables<'broadcasts'>

/** เหตุผลสั้นที่ครูต้องเลือกทุกครั้งที่แก้ (สเปก T-06 บังคับ) */
export const OVERRIDE_REASONS = ['coached', 'device', 'level-fit', 'other'] as const
export type OverrideReason = (typeof OVERRIDE_REASONS)[number]

export const OVERRIDE_REASON_LABELS: Record<OverrideReason, string> = {
  coached: 'โค้ชแล้วเข้าใจ',
  device: 'ปัญหาเครื่อง',
  'level-fit': 'เหมาะกับระดับอื่น',
  other: 'อื่น ๆ',
}

export const OVERRIDE_ACTIONS = [
  'mission-level',
  'allow-skip',
  'force-pass',
  'boss-template',
  'open-boss',
  'unlock-business',
  'reset-pin',
  'scaffold',
  'confirm-score',
] as const
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number]

/** ครูปรับระดับความยากของภารกิจให้นักเรียนคนเดียว */
export async function teacherSetMissionLevel(
  teacherId: string,
  studentId: string,
  missionId: string,
  level: number,
  reason: OverrideReason = 'level-fit',
  note?: string,
): Promise<MissionProgress | null> {
  const { data, error } = await getServiceClient().rpc('teacher_set_mission_level', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_mission_id: missionId,
    p_level: level,
    p_reason: reason,
    p_note: note,
  })

  if (error) fail('teacherSetMissionLevel', error)
  return data[0] ?? null
}

/** ครูอนุญาต/ไม่อนุญาตให้ข้ามภารกิจนี้ (ตอบคำขอจากนักเรียน หรือตั้งเอง) */
export async function teacherAllowSkip(
  teacherId: string,
  studentId: string,
  missionId: string,
  allow: boolean,
  reason: OverrideReason = 'coached',
  note?: string,
): Promise<MissionProgress | null> {
  const { data, error } = await getServiceClient().rpc('teacher_allow_skip', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_mission_id: missionId,
    p_allow: allow,
    p_reason: reason,
    p_note: note,
  })

  if (error) fail('teacherAllowSkip', error)
  return data[0] ?? null
}

/** "ให้ผ่านข้อนี้" — ได้ 1 ดาวเท่าการใช้ข้อสำรอง และไม่ลดดาวที่เคยทำได้เอง */
export async function teacherForcePass(
  teacherId: string,
  studentId: string,
  missionId: string,
  reason: OverrideReason = 'coached',
  note?: string,
): Promise<MissionProgress | null> {
  const { data, error } = await getServiceClient().rpc('teacher_force_pass', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_mission_id: missionId,
    p_reason: reason,
    p_note: note,
  })

  if (error) fail('teacherForcePass', error)
  return data[0] ?? null
}

/**
 * รีเซ็ตรหัส 4 หลัก — ส่งเข้ามาเป็น **hash แล้วเท่านั้น** (argon2 จาก lib/pin.ts)
 * ฐานข้อมูลไม่เคยเห็นรหัสจริง และประวัติก็ไม่เก็บรหัสทั้งเก่าและใหม่
 */
export async function teacherResetPin(
  teacherId: string,
  studentId: string,
  pinHash: string,
  reason: OverrideReason = 'device',
  note?: string,
): Promise<Student | null> {
  const { data, error } = await getServiceClient().rpc('teacher_reset_pin', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_pin_hash: pinHash,
    p_reason: reason,
    p_note: note,
  })

  if (error) fail('teacherResetPin', error)
  return data[0] ?? null
}

/** เปลี่ยนตัวช่วยที่แนะนำ (ช่องทางและ/หรือระดับตัวช่วย) */
export async function teacherSetScaffold(
  teacherId: string,
  studentId: string,
  input: { channel?: LearningRoute; level?: number },
  reason: OverrideReason = 'level-fit',
  note?: string,
): Promise<Profile | null> {
  const { data, error } = await getServiceClient().rpc('teacher_set_scaffold', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_channel: input.channel,
    p_level: input.level,
    p_reason: reason,
    p_note: note,
  })

  if (error) fail('teacherSetScaffold', error)
  return data[0] ?? null
}

/** ปลดล็อกให้นักเรียนกลับไปแก้ข้อมูลธุรกิจได้อีกครั้ง */
export async function teacherUnlockBusiness(
  teacherId: string,
  studentId: string,
  unlocked = true,
  reason: OverrideReason = 'coached',
  note?: string,
): Promise<Profile | null> {
  const { data, error } = await getServiceClient().rpc('teacher_unlock_business', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_unlocked: unlocked,
    p_reason: reason,
    p_note: note,
  })

  if (error) fail('teacherUnlockBusiness', error)
  return data[0] ?? null
}

/** เปลี่ยนแม่แบบสถานการณ์ของด่านบอสให้นักเรียนคนนี้ */
export async function teacherSetBossTemplate(
  teacherId: string,
  studentId: string,
  templateId: string,
  reason: OverrideReason = 'level-fit',
  note?: string,
): Promise<Profile | null> {
  const { data, error } = await getServiceClient().rpc('teacher_set_boss_template', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_template_id: templateId,
    p_reason: reason,
    p_note: note,
  })

  if (error) fail('teacherSetBossTemplate', error)
  return data[0] ?? null
}

/** เปิดด่านบอสให้คนนี้ก่อนทั้งห้อง (ต่อกับ student_phase_unlocks ของ T-03 และลงประวัติให้ด้วย) */
export async function teacherOpenBoss(
  teacherId: string,
  studentId: string,
  reason: OverrideReason = 'coached',
  note?: string,
): Promise<StudentPhaseUnlock | null> {
  const { data, error } = await getServiceClient().rpc('teacher_open_boss', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_reason: reason,
    p_note: note,
  })

  if (error) fail('teacherOpenBoss', error)
  return data[0] ?? null
}

/** T-07 บันทึกการโค้ช — เห็นเฉพาะครู และไปแสดงในรายงานรายคน */
export async function teacherAddNote(
  teacherId: string,
  studentId: string,
  chips: string[] = [],
  text?: string,
): Promise<TeacherNote | null> {
  const { data, error } = await getServiceClient().rpc('teacher_add_note', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_chips: chips,
    p_text: text,
  })

  if (error) fail('teacherAddNote', error)
  return data[0] ?? null
}

export async function listTeacherNotes(
  teacherId: string,
  studentId: string,
): Promise<TeacherNote[]> {
  const { data, error } = await getServiceClient()
    .from('teacher_notes')
    .select('*, students!inner(classroom_id, classrooms!inner(teacher_id))')
    .eq('student_id', studentId)
    .eq('students.classrooms.teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) fail('listTeacherNotes', error)
  return data as unknown as TeacherNote[]
}

/** ประวัติการแก้ของครูสำหรับนักเรียนคนหนึ่ง — หลักฐานว่า "ครูแก้การตัดสินใจของระบบได้" */
export async function listStudentOverrides(
  teacherId: string,
  studentId: string,
): Promise<TeacherOverride[]> {
  const { data, error } = await getServiceClient().rpc('student_override_history', {
    p_teacher_id: teacherId,
    p_student_id: studentId,
  })

  if (error) fail('listStudentOverrides', error)
  return data
}

// ═══════════════════════════════════════ T-09 ดูแลผนังผลงาน

/** ซ่อน/เลิกซ่อนความเห็นของเพื่อน — ซ่อนเท่านั้น ไม่ลบข้อความต้นฉบับ */
export async function teacherHideFeedback(
  teacherId: string,
  feedbackId: string,
  hidden: boolean,
  reason?: string,
): Promise<PeerFeedback | null> {
  const { data, error } = await getServiceClient().rpc('teacher_hide_feedback', {
    p_teacher_id: teacherId,
    p_feedback_id: feedbackId,
    p_hidden: hidden,
    p_reason: reason,
  })

  if (error) fail('teacherHideFeedback', error)
  return data[0] ?? null
}

/** ปักหมุดผลงานขึ้นจอหน้าห้อง · hideName = ไม่แสดงชื่อเจ้าของ */
export async function teacherPinSubmission(
  teacherId: string,
  submissionId: string,
  pinned: boolean,
  hideName = false,
): Promise<Submission | null> {
  const { data, error } = await getServiceClient().rpc('teacher_pin_submission', {
    p_teacher_id: teacherId,
    p_submission_id: submissionId,
    p_pinned: pinned,
    p_hide_name: hideName,
  })

  if (error) fail('teacherPinSubmission', error)
  return data[0] ?? null
}

export interface PinnedShowcaseRow {
  submission_id: string
  nickname: string | null
  domain_name: string | null
  tld: string | null
  reason_text: string | null
  pinned_at: string | null
}

/** ผลงานที่ปักหมุด — ไม่มีดาว ไม่มีคะแนน ไม่จัดอันดับใคร (ตำราห้ามเปรียบเทียบผู้เรียน) */
export async function listPinnedShowcase(
  teacherId: string,
  classroomId: string,
): Promise<PinnedShowcaseRow[]> {
  const { data, error } = await getServiceClient().rpc('pinned_showcase', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('listPinnedShowcase', error)
  return data as PinnedShowcaseRow[]
}

/** ใครยังไม่ได้รับความเห็นจากเพื่อนเลย — ครูจะได้ชวนเพื่อนไปเขียนให้ */
export async function listStudentsWithoutFeedback(
  teacherId: string,
  classroomId: string,
): Promise<{ student_id: string; nickname: string }[]> {
  const { data, error } = await getServiceClient().rpc('students_without_feedback', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('listStudentsWithoutFeedback', error)
  return data as { student_id: string; nickname: string }[]
}

/** ความเห็นทั้งห้องพร้อมสถานะซ่อน — ครูใช้ไล่ดูว่ามีอะไรไม่เหมาะสมไหม */
export async function listClassroomFeedback(
  teacherId: string,
  classroomId: string,
): Promise<PeerFeedback[]> {
  /**
   * ⚠️ ห้ามกลับไปดึง id นักเรียนทุกคนมาแล้วยัดเข้า `.in('to_student_id', ids)`
   *    ห้อง 277 คนทำให้ query string ทะลุลิมิต PostgREST -> "URI too long" แล้วแผงครู 500 ทั้งหน้า
   *    (เจอจริงกับห้อง QUEST9 · ดู migration 20261001270000)
   * RPC นี้ join ใน SQL และตรวจเจ้าของห้องในคิวรีเดียวกับการอ่าน
   */
  const { data, error } = await getServiceClient().rpc('classroom_peer_feedback', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('listClassroomFeedback', error)
  return data ?? []
}

// ═══════════════════════════ T-15 ส่งข้อความถึงทั้งห้อง

/** ส่งข้อความ (≤80 ตัวอักษร) — ถี่เกิน 1 ข้อความต่อ 30 วินาทีจะคืน null ให้ API ตอบ 429 */
export async function sendBroadcast(
  teacherId: string,
  classroomId: string,
  text: string,
  target: 'all' | 'mission' = 'all',
  targetValue?: string,
  minSeconds = 30,
): Promise<Broadcast | null> {
  const { data, error } = await getServiceClient().rpc('send_broadcast', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
    p_text: text,
    p_target: target,
    p_target_value: targetValue,
    p_min_seconds: minSeconds,
  })

  if (error) fail('sendBroadcast', error)
  return data[0] ?? null
}

/** ประวัติข้อความของห้อง — นักเรียนเปิดอ่านซ้ำได้ตามสเปก T-15 */
export async function listBroadcasts(classroomId: string, limit = 20): Promise<Broadcast[]> {
  const { data, error } = await getServiceClient()
    .from('broadcasts')
    .select()
    .eq('classroom_id', classroomId)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) fail('listBroadcasts', error)
  return data
}

// ═══════════════════ T-12 สวิตช์แบบทดสอบก่อน/หลังเรียน (แยกจาก phase)
//
// ⚠️ อย่าสับสนกับ "เช็กความเข้าใจ 4 ข้อ" ตอนรู้จักตัวเอง — อันนั้นใช้เลือกระดับตัวช่วย
//    ไม่ใช่ข้อสอบวิจัย และไม่มีสวิตช์

export type TestWindow = 'pre' | 'post'

/** ครูเปิด/ปิดแบบทดสอบโดยไม่ย้ายช่วงของคาบ (แบบทดสอบก่อนเรียนเปิดได้ตั้งแต่ช่วง 'wait') */
export async function setTestWindow(
  teacherId: string,
  sessionId: string,
  which: TestWindow,
  enabled: boolean,
): Promise<ClassSession | null> {
  const { data, error } = await getServiceClient().rpc('set_test_window', {
    p_teacher_id: teacherId,
    p_session_id: sessionId,
    p_which: which,
    p_enabled: enabled,
  })

  if (error) fail('setTestWindow', error)
  return data[0] ?? null
}

// ═══════════════════════ T-11 ข้อมูลดิบของรายงานรายห้อง
//
// **ไม่คำนวณสถิติใน SQL** — ฟังก์ชันนี้คืนข้อมูลดิบรายคน แล้วให้ core/ คำนวณที่เดียว
// (core/efficiency.ts = E1/E2 · core/statistics.ts = t-test/effect size/normalized gain
//  · core/report.ts = ผลตามจุดประสงค์)

export interface RawMissionRow {
  missionId: string
  channelUsed: string | null
  attempts: number
  hintsUsed: number
  stars: number | null
  passed: boolean
  levelOverride: number | null
  forcedPass: boolean
  /** ใครสั่งข้ามข้อนี้ — student = เด็กเลือกเอง · teacher = ครูสั่ง · null = ไม่ได้ข้าม */
  skippedBy: SkippedBy | null
  startedAt: string | null
  passedAt: string | null
  secondsSpent: number | null
}

export interface RawStudentRow {
  studentId: string
  nickname: string
  joinedAt: string
  profile: {
    businessName: string | null
    domainName: string | null
    preTestScore: number | null
    postTestScore: number | null
    earnedStars: number | null
    goalStars: number | null
    selfGoalLevel: number | null
    goalRaisedCount: number | null
    learningRoute: string | null
    channelSuggested: string | null
    channelChosenBy: string | null
    channelSwitches: number | null
    scaffoldLevel: number | null
    hintsToggledBy: string | null
    confidence: Record<string, number> | null
  } | null
  missions: RawMissionRow[]
  skips: { missionId: string; reason: string | null }[]
  routeChanges: number
  reflectionCount: number
  submission: {
    id: string
    domainName: string | null
    tld: string | null
    format: string | null
    selfScores: Record<string, Json> | null
    teacherScores: Record<string, Json> | null
    aiScores: Record<string, Json> | null
    teacherChanged: boolean | null
    confirmedAt: string | null
  } | null
  overrides: number
}

export interface ClassroomReportRaw {
  classroomId: string
  students: RawStudentRow[]
  survey: SurveySummary | null
  buddy: { requests: number; helped: number; passedAfterHelp: number }
  overrides: { action: string; target: string | null; reason: string; createdAt: string }[]
}

/** ข้อมูลดิบทั้งห้องในรอบเดียว — ตรวจเจ้าของก่อนอ่าน ไม่ใช่เจ้าของคืน null */
export async function getClassroomReportRaw(
  teacherId: string,
  classroomId: string,
): Promise<ClassroomReportRaw | null> {
  const { data, error } = await getServiceClient().rpc('classroom_report_raw', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('getClassroomReportRaw', error)
  return (data as unknown as ClassroomReportRaw | null) ?? null
}

/** เหตุการณ์ทั้งห้อง — ใช้ส่งออก CSV (T-13) เท่านั้น */
export async function listClassroomEvents(
  teacherId: string,
  classroomId: string,
  limit = 5000,
): Promise<(GameEvent & { nickname?: string })[]> {
  const owner = await getServiceClient()
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (owner.error) fail('listClassroomEvents', owner.error)
  if (!owner.data) return []

  const { data, error } = await getServiceClient()
    .from('events')
    .select('*, students!inner(nickname, classroom_id)')
    .eq('students.classroom_id', classroomId)
    .order('created_at')
    .limit(limit)

  if (error) fail('listClassroomEvents', error)
  return data as unknown as (GameEvent & { nickname?: string })[]
}

/** คำตอบสะท้อนคิดทั้งห้อง — ใช้ส่งออก CSV (T-13) */
export async function listClassroomReflections(
  teacherId: string,
  classroomId: string,
): Promise<(Reflection & { nickname?: string })[]> {
  const owner = await getServiceClient()
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (owner.error) fail('listClassroomReflections', owner.error)
  if (!owner.data) return []

  const { data, error } = await getServiceClient()
    .from('reflections')
    .select('*, students!inner(nickname, classroom_id)')
    .eq('students.classroom_id', classroomId)
    .order('created_at')

  if (error) fail('listClassroomReflections', error)
  return data as unknown as (Reflection & { nickname?: string })[]
}

/** คำตอบแบบสอบถามแบบไม่มีชื่อ — ใช้ส่งออก CSV (T-13) · ตารางไม่มี student_id อยู่แล้ว */
export async function listSurveyResponses(
  teacherId: string,
  classroomId: string,
): Promise<SurveyResponse[]> {
  const owner = await getServiceClient()
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (owner.error) fail('listSurveyResponses', owner.error)
  if (!owner.data) return []

  const { data, error } = await getServiceClient()
    .from('survey_responses')
    .select()
    .eq('classroom_id', classroomId)
    .order('created_at')

  if (error) fail('listSurveyResponses', error)
  return data
}

/** T-09 เปิด/ปิดผนังผลงานทั้งห้อง — ตรวจเจ้าของในคิวรีเดียวกับที่เขียน */
export async function setShowcaseEnabled(
  teacherId: string,
  classroomId: string,
  enabled: boolean,
): Promise<ClassSession | null> {
  const owner = await getServiceClient()
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (owner.error) fail('setShowcaseEnabled', owner.error)
  if (!owner.data) return null

  const { data, error } = await getServiceClient()
    .from('class_sessions')
    .update({ showcase_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('classroom_id', classroomId)
    .is('ended_at', null)
    .select()
    .maybeSingle()

  if (error) fail('setShowcaseEnabled', error)
  return data
}

// ═══════════════════════════ คิวสร้างเรื่องราวเฉพาะคน (story_jobs)
//
// โครงเดียวกับ grade_jobs แต่สถานะใช้คำเดียวกับ lib/ai/story-queue.ts
// (pending | running | done | failed) จะได้เสียบเข้า `StoryJobStore` ได้โดยไม่ต้องแม็ปชื่อ
// AI ถูกเรียกครั้งเดียวต่อนักเรียนหนึ่งคนแล้วได้เรื่องราวครบ 10 เรื่อง

export type StoryJob = Tables<'story_jobs'>
export type StoryJobStatus = 'pending' | 'running' | 'done' | 'failed'

export const STORY_JOB_MAX_ATTEMPTS = 3
export const STORY_JOB_STALE_MINUTES = 5

export async function enqueueStoryJob(
  studentId: string,
  input: NonNullable<Json> = {},
): Promise<StoryJob> {
  const { data, error } = await getServiceClient()
    .from('story_jobs')
    .insert({ student_id: studentId, input })
    .select()
    .single()

  if (error) fail('enqueueStoryJob', error)
  return data
}

/**
 * หยิบงานถัดไปแบบ atomic (`for update skip locked`)
 * คืน null ได้ทั้งตอนคิวว่างและตอนทุกแถวถูกล็อกอยู่ — worker ต้อง retry ไม่ใช่สรุปว่าคิวหมด
 */
export async function claimNextStoryJob(
  maxAttempts = STORY_JOB_MAX_ATTEMPTS,
): Promise<StoryJob | null> {
  const { data, error } = await getServiceClient().rpc('claim_next_story_job', {
    p_max_attempts: maxAttempts,
  })

  if (error) fail('claimNextStoryJob', error)
  return data[0] ?? null
}

/** งานที่ worker ตายคาไว้ (running ค้างเกิน N นาที) กลับเข้าคิว */
export async function reclaimStaleStoryJobs(
  olderThanMinutes = STORY_JOB_STALE_MINUTES,
): Promise<StoryJob[]> {
  const { data, error } = await getServiceClient().rpc('reclaim_stale_story_jobs', {
    p_older_than_minutes: olderThanMinutes,
  })

  if (error) fail('reclaimStaleStoryJobs', error)
  return data
}

export async function completeStoryJob(
  jobId: string,
  result: NonNullable<Json>,
): Promise<StoryJob | null> {
  const { data, error } = await getServiceClient().rpc('complete_story_job', {
    p_job_id: jobId,
    p_result: result,
  })

  if (error) fail('completeStoryJob', error)
  return data[0] ?? null
}

/** `retry = false` เมื่อความผิดพลาดนั้นลองซ้ำไปก็พังเหมือนเดิม (เช่นข้อมูลตั้งต้นไม่ครบ) */
export async function failStoryJob(
  jobId: string,
  message: string,
  retry = true,
  maxAttempts = STORY_JOB_MAX_ATTEMPTS,
): Promise<StoryJob | null> {
  const { data, error } = await getServiceClient().rpc('fail_story_job', {
    p_job_id: jobId,
    p_error: message.slice(0, 500),
    p_retry: retry,
    p_max_attempts: maxAttempts,
  })

  if (error) fail('failStoryJob', error)
  return data[0] ?? null
}

export async function getStoryJob(jobId: string): Promise<StoryJob | null> {
  const { data, error } = await getServiceClient()
    .from('story_jobs')
    .select()
    .eq('id', jobId)
    .maybeSingle()

  if (error) fail('getStoryJob', error)
  return data
}

/** เรื่องราวล่าสุดของนักเรียน — งานที่เสร็จแล้วมาก่อนเสมอ (StoryJobStore.findByStudent) */
export async function findStudentStoryJob(studentId: string): Promise<StoryJob | null> {
  const { data, error } = await getServiceClient().rpc('find_student_story_job', {
    p_student_id: studentId,
  })

  if (error) fail('findStudentStoryJob', error)
  return data[0] ?? null
}

export async function countStoryJobsByStatus(): Promise<Record<StoryJobStatus, number>> {
  const { data, error } = await getServiceClient().from('story_jobs').select('status')
  if (error) fail('countStoryJobsByStatus', error)

  const counts: Record<StoryJobStatus, number> = { pending: 0, running: 0, done: 0, failed: 0 }
  for (const row of data) counts[row.status as StoryJobStatus] += 1
  return counts
}

// ═════════════════════════ ธงคำไม่เหมาะสมถึงแผงครู (content_flags)
//
// ผลการกรองมาจาก core/content-filter.ts · ตารางนี้เก็บไว้ให้ครูตัดสิน
// **ห้ามลบข้อความของนักเรียน** — `original_text` เก็บต้นฉบับเสมอ
// ครูเห็นข้อความเต็ม **เฉพาะระดับ 3** ระดับ 1-2 เห็นฉบับปิดบางส่วน (บังคับใน SQL)

export type ContentFlag = Tables<'content_flags'>
export type FlagLevel = 1 | 2 | 3

export interface TeacherContentFlag {
  id: string
  /** null = ธงตอนพิมพ์ชื่อเล่นเข้าห้อง ยังไม่มีแถวนักเรียน */
  student_id: string | null
  /** ธงก่อนเข้าห้องคืนป้ายคงที่ '(ยังไม่ได้เข้าห้อง)' ไม่ใช่ชื่อที่เด็กพิมพ์ */
  nickname: string
  context: string
  level: number
  categories: string[]
  /** ข้อความที่ครูเห็น — เต็มเมื่อระดับ 3 · ปิดบางส่วนเมื่อระดับ 1-2 */
  text_for_teacher: string | null
  is_full_text: boolean
  resolved_at: string | null
  created_at: string
}

/** บันทึกธงหนึ่งใบ (ระดับ 0 = ผ่าน ไม่ต้องเรียก) */
export async function recordContentFlag(
  studentId: string,
  input: {
    context: string
    level: FlagLevel
    categories?: string[]
    maskedText?: string | null
    originalText: string
  },
): Promise<ContentFlag | null> {
  const { data, error } = await getServiceClient().rpc('record_content_flag', {
    p_student_id: studentId,
    p_context: input.context,
    p_level: input.level,
    p_categories: input.categories ?? [],
    p_masked_text: input.maskedText ?? undefined,
    p_original_text: input.originalText,
  })

  if (error) fail('recordContentFlag', error)
  return data[0] ?? null
}

/**
 * ธงตอนพิมพ์ชื่อเล่นเข้าห้อง — ยังไม่มีแถวนักเรียน จึงผูกกับห้องแทน
 *
 * ใช้ที่ `app/api/join` ตรงจังหวะที่ `checkContent()` ไม่ผ่าน **ก่อน** สร้างนักเรียน
 * ถ้าไม่บันทึกตรงนี้ ครูจะไม่มีทางรู้เลยว่ามีคนพยายามใช้ชื่อไม่เหมาะสม เพราะคำขอถูกปฏิเสธไปแล้ว
 * context ถูกตรึงเป็น 'join-nickname' ที่ฝั่ง SQL · classroom_id ผิด = คืน null ไม่สร้างธงลอย
 */
export async function recordPreJoinContentFlag(
  classroomId: string,
  input: {
    level: FlagLevel
    categories?: string[]
    maskedText?: string | null
    originalText: string
  },
): Promise<ContentFlag | null> {
  const { data, error } = await getServiceClient().rpc('record_pre_join_content_flag', {
    p_classroom_id: classroomId,
    p_level: input.level,
    p_categories: input.categories ?? [],
    p_masked_text: input.maskedText ?? undefined,
    p_original_text: input.originalText,
  })

  if (error) fail('recordPreJoinContentFlag', error)
  return data[0] ?? null
}

/**
 * ธงของห้องสำหรับแผงครู — คิวรีตรงกับ index `(classroom_id, level desc, created_at desc)`
 * ส่ง `since` เพื่อดึงเฉพาะธงใหม่หลังรอบที่แล้ว (ทำให้ poll ถี่ ๆ ได้โดยไม่กินแรง)
 */
export async function listClassroomContentFlags(
  teacherId: string,
  classroomId: string,
  options: { minLevel?: FlagLevel; since?: string; includeResolved?: boolean } = {},
): Promise<TeacherContentFlag[]> {
  const { data, error } = await getServiceClient().rpc('classroom_content_flags', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
    p_min_level: options.minLevel ?? 1,
    p_since: options.since,
    p_include_resolved: options.includeResolved ?? false,
  })

  if (error) fail('listClassroomContentFlags', error)
  return data as TeacherContentFlag[]
}

/** ครูดูแลเรียบร้อยแล้ว — ปิดธง ไม่ลบข้อความ */
export async function resolveContentFlag(
  teacherId: string,
  flagId: string,
  note?: string,
): Promise<ContentFlag | null> {
  const { data, error } = await getServiceClient().rpc('resolve_content_flag', {
    p_teacher_id: teacherId,
    p_flag_id: flagId,
    p_note: note,
  })

  if (error) fail('resolveContentFlag', error)
  return data[0] ?? null
}

// ═════════════════════════ คำขอเปลี่ยนแผนจากนักเรียน (S-08)
//
// "ระบบเสนอ ผู้เรียนเลือก" — ใบนี้คือหลักฐานว่าผู้เรียนเป็นเจ้าของการเรียนของตัวเอง
// เก็บทั้งสิ่งที่ขอ (requestedValue) และสิ่งที่ได้จริง (grantedValue) ไว้คู่กัน
// เหตุผลที่นักเรียนพิมพ์เป็นข้อความของเด็ก — ครูตอบแล้วก็ไม่ลบ

export type PlanRequest = Tables<'plan_requests'>
/** ขออะไร: เปลี่ยนระดับ · เปลี่ยนช่องทาง · ขอข้าม · ขอเวลาเพิ่ม */
export type PlanRequestKind = 'level' | 'channel' | 'skip' | 'time'
/** ครูตอบ: ให้ · ไม่ให้ · ให้แบบอื่น (เก็บทั้งที่ขอและที่ได้) */
export type PlanRequestStatus = 'approved' | 'rejected' | 'changed'

export interface TeacherPlanRequest {
  id: string
  student_id: string
  nickname: string
  kind: string
  mission_id: string | null
  requested_value: string | null
  reason: string
  status: string
  granted_value: string | null
  teacher_response: string | null
  responded_at: string | null
  created_at: string
}

/**
 * นักเรียนยื่นคำขอ — studentId ต้องมาจาก session cookie เท่านั้น
 * เรื่องเดียวกันของภารกิจเดียวกันค้างได้ใบเดียว (unique index ฝั่ง SQL กดรัวแล้วใบที่สองถูกปฏิเสธ)
 */
export async function createPlanRequest(
  studentId: string,
  input: {
    kind: PlanRequestKind
    reason: string
    requestedValue?: string | null
    missionId?: string | null
  },
): Promise<PlanRequest | null> {
  const { data, error } = await getServiceClient().rpc('create_plan_request', {
    p_student_id: studentId,
    p_kind: input.kind,
    p_reason: input.reason,
    p_requested_value: input.requestedValue ?? undefined,
    p_mission_id: input.missionId ?? undefined,
  })

  if (error) fail('createPlanRequest', error)
  return data[0] ?? null
}

/** คำขอของห้องสำหรับแผงครู — ยังไม่ตอบขึ้นก่อน เก่าสุดก่อน · ไม่ใช่เจ้าของห้องได้ 0 แถว */
export async function listClassroomPlanRequests(
  teacherId: string,
  classroomId: string,
  options: { includeAnswered?: boolean } = {},
): Promise<TeacherPlanRequest[] | null> {
  /**
   * คืน `null` = ไม่ใช่ห้องของครูคนนี้ (route ตอบ 404 เหมือน endpoint ครูตัวอื่น)
   * แยกจาก `[]` ที่แปลว่าเป็นห้องของเราจริงแต่ยังไม่มีใครขออะไร
   * สิทธิ์จริงยังบังคับใน RPC คิวรีเดียวกับที่อ่านอยู่แล้ว คิวรีนี้มีไว้แยกสองกรณีเท่านั้น
   */
  const owned = await getServiceClient()
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (owned.error) fail('listClassroomPlanRequests', owned.error)
  if (!owned.data) return null

  const { data, error } = await getServiceClient().rpc('classroom_plan_requests', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
    p_include_answered: options.includeAnswered ?? false,
  })

  if (error) fail('listClassroomPlanRequests', error)
  return data as TeacherPlanRequest[]
}

/**
 * ครูตอบคำขอ — ตรวจเจ้าของห้องในคิวรีเดียวกับที่เขียน ไม่ใช่เจ้าของหรือตอบไปแล้วคืน null
 * ไม่ส่ง grantedValue = ถือว่าให้ตามที่ขอ
 */
export async function respondPlanRequest(
  teacherId: string,
  requestId: string,
  answer: { status: PlanRequestStatus; response?: string | null; grantedValue?: string | null },
): Promise<PlanRequest | null> {
  const { data, error } = await getServiceClient().rpc('respond_plan_request', {
    p_teacher_id: teacherId,
    p_request_id: requestId,
    p_status: answer.status,
    p_response: answer.response ?? undefined,
    p_granted_value: answer.grantedValue ?? undefined,
  })

  if (error) fail('respondPlanRequest', error)
  return data[0] ?? null
}

/** เลยวันหมดเขตทำต่อที่บ้านของห้องนี้หรือยัง — ใช้บอกผู้ใช้ล่วงหน้า ตัวบังคับจริงคือ trigger */
export async function isHomeWriteBlocked(studentId: string): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc('home_write_blocked', {
    p_student_id: studentId,
  })

  if (error) fail('isHomeWriteBlocked', error)
  return data === true
}

// ══════════════════════ E-04 / S-41 ข้อมูลดิบให้ core/buddy.ts (T54)
//
// **ห้ามคิดคะแนนซ้ำใน SQL** — เกณฑ์คัดและตารางคะแนนอยู่ที่ core/buddy.ts ที่เดียว
// ฟังก์ชันชุดนี้ส่งข้อมูลดิบไปให้ แล้วให้ core เป็นคนตอบว่าใครเหมาะและเพราะอะไร

/** ตรงกับ `BuddyCandidate` ของ core/buddy.ts — ส่งเข้า `rankBuddyCandidates` ได้เลย */
export interface BuddyCandidateInput {
  studentId: string
  nickname: string
  standing: 'passed' | 'skipped-confident' | 'in-progress' | 'not-started'
  stars?: number
  idleSeconds: number
  inBigMission: boolean
  waitingForTeacher: boolean
  acceptingRequests: boolean
  helpingNow: number
  helpedCount: number
  likesTalking: boolean
  seatZone: string | null
  pairedWith: string | null
  declinedRequesters: Record<string, number>
}

/**
 * เพื่อนร่วมห้องทุกคนพร้อมข้อมูลที่ core ต้องใช้ตัดสิน (ยังไม่คัด ยังไม่เรียง)
 *
 * `seatZone` เป็น null เสมอ — ระบบยังไม่มีผังที่นั่ง core รองรับ null อยู่แล้ว
 * `declinedRequesters` มีเฉพาะคีย์ของผู้ขอคนนี้ เพราะ core ใช้แค่คีย์นั้นในการตัดสิน
 */
export async function getBuddyCandidatesRaw(
  studentId: string,
  missionId: string,
): Promise<BuddyCandidateInput[]> {
  const { data, error } = await getServiceClient().rpc('buddy_candidates_raw', {
    p_student_id: studentId,
    p_mission_id: missionId,
  })

  if (error) fail('getBuddyCandidatesRaw', error)

  return data.map((row) => ({
    studentId: row.student_id,
    nickname: row.nickname,
    standing: row.standing as BuddyCandidateInput['standing'],
    stars: row.stars ?? undefined,
    idleSeconds: row.idle_seconds,
    inBigMission: row.in_big_mission,
    waitingForTeacher: row.waiting_for_teacher,
    acceptingRequests: row.accepting_requests,
    helpingNow: row.helping_now,
    helpedCount: row.helped_count,
    likesTalking: row.likes_talking,
    seatZone: null,
    pairedWith: row.paired_with,
    declinedRequesters:
      row.declined_seconds_ago === null ? {} : { [studentId]: row.declined_seconds_ago },
  }))
}

/** ผู้ขอยกเลิกคำขอของตัวเอง — ใบของคนอื่นยกเลิกไม่ได้ · แผ่นคำขอที่ค้างบนจอเพื่อนถูกปิดให้ด้วย */
export async function cancelBuddyRequest(
  studentId: string,
  requestId: string,
): Promise<BuddyRequest | null> {
  const { data, error } = await getServiceClient().rpc('cancel_buddy_request', {
    p_student_id: studentId,
    p_request_id: requestId,
  })

  if (error) fail('cancelBuddyRequest', error)
  return data[0] ?? null
}

export interface OpenBuddyRequestRow {
  id: string
  requester_id: string
  requester: string
  helper_id: string | null
  helper: string | null
  mission_id: string
  kind: string
  status: string
  attempts: number
  waiting_seconds: number
  created_at: string
}

/** คำขอที่ยังไม่จบในห้องนี้ — ครูดูได้เฉพาะห้องตัวเอง ไม่ใช่เจ้าของได้ 0 แถว */
export async function listClassroomOpenBuddyRequests(
  teacherId: string,
  classroomId: string,
): Promise<OpenBuddyRequestRow[]> {
  const { data, error } = await getServiceClient().rpc('classroom_open_buddy_requests', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('listClassroomOpenBuddyRequests', error)
  return data as OpenBuddyRequestRow[]
}

/** ใครช่วยเพื่อนไปกี่ครั้ง — core ใช้กระจายภาระ (คนที่ช่วยบ่อยถูกเลือกน้อยลง) */
export async function listBuddyHelpedCounts(
  classroomId: string,
): Promise<{ student_id: string; nickname: string; helped_count: number; helping_now: number }[]> {
  const { data, error } = await getServiceClient().rpc('classroom_buddy_helped_counts', {
    p_classroom_id: classroomId,
  })

  if (error) fail('listBuddyHelpedCounts', error)
  return data
}

// ══════════════════════ T-01 ครูสมัครเอง + ลืมรหัส (T54)
//
// **รหัสผ่านไม่เคยถูกเก็บในฐานข้อมูลนี้** — อยู่ที่ Supabase Auth (แฮช bcrypt ของ GoTrue) เท่านั้น
// โทเคนรีเซ็ตเก็บเฉพาะ sha256 ของตัวโทเคน · ตัวจริงคืนให้ผู้เรียกครั้งเดียวตอนออก

export interface TeacherSignUpResult {
  ok: boolean
  teacher?: Teacher
  /** 'email-taken' = มีบัญชีนี้แล้ว · 'weak-password' = รหัสสั้นเกินเกณฑ์ของ Supabase */
  reason?: 'email-taken' | 'weak-password' | 'failed'
  message?: string
}

/**
 * ครูสมัครบัญชีเอง — สร้างผู้ใช้ใน Supabase Auth แล้วผูกแถว `teachers`
 * รหัสผ่านถูกส่งต่อให้ Auth แฮชเอง โค้ดนี้ไม่เก็บ ไม่ log และไม่ส่งกลับ
 */
export async function signUpTeacher(
  email: string,
  password: string,
  name?: string | null,
): Promise<TeacherSignUpResult> {
  const { data, error } = await getServiceClient().auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  })

  if (error || !data.user) {
    const raw = error?.message ?? ''
    const reason = /already|registered|exists/i.test(raw)
      ? 'email-taken'
      : /password/i.test(raw)
        ? 'weak-password'
        : 'failed'
    return { ok: false, reason, message: raw }
  }

  const teacher = await upsertTeacher(data.user.id, data.user.email ?? email, name ?? null)
  return { ok: true, teacher }
}

export interface PasswordResetTicket {
  /** ตัวโทเคนจริง — ส่งต่อให้ครูทางลิงก์ แล้วห้ามเก็บไว้ที่ไหนอีก */
  token: string
  expiresAt: string
  teacherId: string
}

/**
 * ขอโทเคนรีเซ็ตรหัส — คืน null เมื่อไม่มีบัญชีนี้
 * ⚠️ ผู้เรียกต้องตอบผู้ใช้ด้วยข้อความเดียวกันทั้งสองกรณี ห้ามบอกว่าอีเมลนี้มีอยู่จริงไหม
 * ใบเก่าที่ยังไม่ถูกใช้ถูกปิดทิ้งอัตโนมัติ — ขอใหม่แล้วลิงก์เก่าใช้ไม่ได้
 */
export async function issueTeacherPasswordReset(
  email: string,
  ttlMinutes = 30,
): Promise<PasswordResetTicket | null> {
  const { data, error } = await getServiceClient().rpc('issue_teacher_password_reset', {
    p_email: email,
    p_ttl_minutes: ttlMinutes,
  })

  if (error) fail('issueTeacherPasswordReset', error)
  const row = data[0]
  if (!row) return null
  return { token: row.token, expiresAt: row.expires_at, teacherId: row.teacher_id }
}

/** โทเคนยังใช้ได้ไหม (ไม่กินโทเคน) — ใช้ตอนเปิดหน้าตั้งรหัสใหม่ */
export async function verifyTeacherPasswordReset(
  token: string,
): Promise<{ teacherId: string; email: string; expiresAt: string } | null> {
  const { data, error } = await getServiceClient().rpc('verify_teacher_password_reset', {
    p_token: token,
  })

  if (error) fail('verifyTeacherPasswordReset', error)
  const row = data[0]
  if (!row) return null
  return { teacherId: row.teacher_id, email: row.email, expiresAt: row.expires_at }
}

/**
 * ตั้งรหัสใหม่ด้วยโทเคน — กินโทเคนก่อนเสมอ (ใช้ได้ครั้งเดียวจริง ยิงพร้อมกันก็ผ่านได้ใบเดียว)
 * โทเคนไม่ถูกต้อง/หมดอายุ/ถูกใช้แล้ว = คืน false โดยไม่แตะรหัสผ่านของใคร
 */
export async function resetTeacherPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc('consume_teacher_password_reset', {
    p_token: token,
  })

  if (error) fail('resetTeacherPasswordWithToken', error)
  const row = data[0]
  if (!row) return false

  const updated = await getServiceClient().auth.admin.updateUserById(row.teacher_id, {
    password: newPassword,
  })

  if (updated.error) fail('resetTeacherPasswordWithToken', updated.error)
  return true
}

/** เก็บกวาดใบรีเซ็ตเก่า — เรียกรวมกับงานเก็บกวาดอื่นได้ */
export async function purgeTeacherPasswordResets(olderThanHours = 24): Promise<number> {
  const { data, error } = await getServiceClient().rpc('purge_teacher_password_resets', {
    p_older_than_hours: olderThanHours,
  })

  if (error) fail('purgeTeacherPasswordResets', error)
  return data ?? 0
}

// ------------------------------------------------- คำตอบรายข้อของแบบทดสอบ

/** ชุดข้อสอบคู่ขนาน 2 ชุด — pre = ชุด A ก่อนเรียน · post = ชุด B หลังเรียน */
export type QuizSetKey = 'pre' | 'post'

/** คำตอบหนึ่งข้อ — `correct` ต้องมาจาก core/quiz.gradeQuiz() ฝั่งเซิร์ฟเวอร์เท่านั้น */
export interface QuizItemResponseInput {
  itemId: string
  /** ตัวเลือกที่กด 0-3 · null = ไม่ได้ตอบ */
  choiceIndex: number | null
  correct: boolean
}

/**
 * บันทึกคำตอบรายข้อทั้งชุดในครั้งเดียว — ใช้ต่อกับ core/statistics.itemAnalysis()
 *
 * ⚠️ ห้ามเรียกด้วยค่าที่รับตรงจากเบราว์เซอร์: `correct` ต้องเป็นผลของ `gradeQuiz()`
 *    ไม่งั้นเด็กยิง POST เองแล้วประกาศว่าตัวเองตอบถูกได้ทุกข้อ ค่าความยากทั้งชุดเพี้ยน
 * classroom_id เติมจากตาราง students ฝั่ง SQL — ไม่รับจาก request body
 * ทำซ้ำไม่ทับของเดิม (unique student_id+quiz_set+item_id · on conflict do nothing)
 *
 * คืนจำนวนแถวที่เพิ่มจริง (0 = เคยบันทึกไปแล้ว หรือไม่พบนักเรียนคนนี้)
 */
export async function recordQuizItemResponses(
  studentId: string,
  quizSet: QuizSetKey,
  items: readonly QuizItemResponseInput[],
): Promise<number> {
  if (items.length === 0) return 0

  const { data, error } = await getServiceClient().rpc('record_quiz_item_responses', {
    p_student_id: studentId,
    p_quiz_set: quizSet,
    p_items: items.map((i) => ({
      itemId: i.itemId,
      choiceIndex: i.choiceIndex,
      correct: i.correct,
    })),
  })

  if (error) fail('recordQuizItemResponses', error)
  return data ?? 0
}

/** แผ่นคำตอบหนึ่งคนหนึ่งชุด — รูปแบบเดียวกับ ItemResponseSheet ของ core/statistics.ts */
export interface ClassroomQuizItemSheets {
  /** ชุด -> รายคน -> (รหัสข้อ -> ตอบถูกหรือไม่) */
  pre: Record<string, boolean>[]
  post: Record<string, boolean>[]
}

/**
 * แผ่นคำตอบของทั้งห้อง แยกตามชุด — ป้อนเข้า `itemAnalysis()` ได้ตรง ๆ
 *
 * **ไม่มี choice_index ติดมา** โดยตั้งใจ เพราะ (รหัสข้อ + ตัวเลือก + ตอบถูก) = เฉลยข้อนั้น
 * ครูคนอื่นขอห้องนี้ = SQL คืน 0 แถว (ตรวจเจ้าของในคิวรีเดียวกัน) แยกจาก "ห้องที่ยังไม่มีใครทำ"
 * ไม่ได้ ผู้เรียกจึงควรตรวจสิทธิ์ห้องด้วย `getClassroomReportRaw()` ก่อนเสมอ
 */
export async function getClassroomQuizItemSheets(
  teacherId: string,
  classroomId: string,
): Promise<ClassroomQuizItemSheets> {
  const { data, error } = await getServiceClient().rpc('classroom_quiz_item_sheets', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('getClassroomQuizItemSheets', error)

  // จัดกลุ่ม ชุด -> คน -> ข้อ · ห้ามรวมสองชุดเข้าด้วยกัน ไม่งั้นค่าความยากมั่ว (ข้อสอบคนละฉบับ)
  const bySet: Record<QuizSetKey, Map<string, Record<string, boolean>>> = {
    pre: new Map(),
    post: new Map(),
  }

  for (const row of data ?? []) {
    const set = row.quiz_set === 'post' ? 'post' : 'pre'
    const sheet = bySet[set].get(row.student_id) ?? {}
    sheet[row.item_id] = row.is_correct === true
    bySet[set].set(row.student_id, sheet)
  }

  return {
    pre: [...bySet.pre.values()],
    post: [...bySet.post.values()],
  }
}

// ------------------------------------------- ตัวเลขรวมของห้อง (ไม่ยิง .in(ids))

export interface ClassroomScreenStats {
  /** จำนวนคนที่เข้าห้องแล้ว */
  joined: number
  /** จำนวนภารกิจที่ผ่านรวมทั้งห้อง ไม่ใช่จำนวนคน */
  missionsPassed: number
  /** จำนวนใบเสนอของภารกิจใหญ่ที่ส่งเข้ามาแล้ว */
  submitted: number
}

/**
 * ตัวเลขรวมของจอหน้าห้อง (T-04) — คิดจบใน SQL คิวรีเดียว
 *
 * ⚠️ เป็นภาพรวมของห้องล้วน ๆ ไม่มีชื่อคนคู่กับดาวหรือคะแนน (สเปก T-04 ห้ามมีกระดานจัดอันดับ)
 * ⚠️ ห้ามกลับไปดึง id นักเรียนทุกคนมายิง `.in('student_id', ids)` — ห้อง 277 คนพังด้วย URI too long
 * ครูคนอื่น = คืน null ให้ route ตอบ 404
 */
export async function getClassroomScreenStats(
  teacherId: string,
  classroomId: string,
): Promise<ClassroomScreenStats | null> {
  const { data, error } = await getServiceClient().rpc('classroom_screen_stats', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('getClassroomScreenStats', error)
  const row = data?.[0]
  if (!row) return null

  return {
    joined: row.joined ?? 0,
    missionsPassed: row.missions_passed ?? 0,
    submitted: row.submitted ?? 0,
  }
}

/** ข้อมูลดิบรายคนสำหรับคิด E1/E2 — รูปแบบตรงกับ MissionScoreInput ของ core/efficiency.ts */
export interface EfficiencyRawRow {
  studentId: string
  missions: { missionId: string; stars: number }[]
  /** คะแนนรูบริกที่ครูยืนยัน (ยังไม่แตะ = null) — ผู้เรียกต้องตีความ status เอง */
  rubricScores: unknown
  preScore: number | null
  postScore: number | null
}

/**
 * ข้อมูลดิบของทั้งห้องสำหรับ E1/E2 — **คิวรีเดียว ไม่ใช่ 3 คิวรีต่อคน**
 *
 * ของเดิมยิง getProfile + listMissionProgress + listSubmissions ต่อนักเรียนหนึ่งคน
 * ห้อง 277 คน = 831 รอบไปกลับ วัดได้ 3,623 ms เกินเกณฑ์สเปกข้อ 9.5 (แผงครูไม่เกิน 3 วินาที)
 *
 * ⚠️ **ไม่มีสูตรอยู่ในนี้** E1/E2 คิดที่ core/efficiency.mediaEfficiency ที่เดียวเหมือนเดิม
 * ครูคนอื่น = คืน null ให้ route ตอบ 404 (แยกจากห้องว่างที่คืน [])
 */
export async function getClassroomEfficiencyRaw(
  teacherId: string,
  classroomId: string,
): Promise<EfficiencyRawRow[] | null> {
  const owned = await getServiceClient()
    .from('classrooms')
    .select('id')
    .eq('id', classroomId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (owned.error) fail('getClassroomEfficiencyRaw', owned.error)
  if (!owned.data) return null

  const { data, error } = await getServiceClient().rpc('classroom_efficiency_raw', {
    p_teacher_id: teacherId,
    p_classroom_id: classroomId,
  })

  if (error) fail('getClassroomEfficiencyRaw', error)

  return (data ?? []).map((row) => ({
    studentId: row.student_id,
    missions: Array.isArray(row.missions)
      ? (row.missions as { missionId: string; stars: number }[])
      : [],
    rubricScores: row.rubric_scores,
    preScore: row.pre_test_score,
    postScore: row.post_test_score,
  }))
}

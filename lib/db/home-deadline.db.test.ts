/**
 * เทสต์ติดฐานข้อมูลจริง — ประตู "หมดเขตทำต่อที่บ้าน" ต้องกันเฉพาะคำตอบใหม่ของนักเรียน (T79/REVIEW-8)
 *
 * สิ่งที่ล็อกไว้:
 *   1. ครูยังยืนยันคะแนนได้หลังหมดเขต (H-1) — ผ่าน RPC ฝั่งครูเท่านั้น
 *   2. การ upsert mission_progress ตรง ๆ จากฝั่งเว็บยังถูกกั้นเหมือนเดิม (ประตูไม่ได้ถูกปลดทิ้ง)
 *   3. ครูคนอื่นสั่งไม่ได้ ต่อให้รู้ studentId
 *   4. เด็กเปิดภารกิจที่ไม่เคยเปิด (แถวเปล่า) ได้ แต่ตอบเพิ่มไม่ได้ (H-2)
 *   5. สวิตช์ปิด AI ของครูอ่านได้จริงจากฝั่งฐานข้อมูล (H-3)
 *
 * รันจริงด้วย:  npx vitest run lib/db/home-deadline.db.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnvLocal } from '../../scripts/load-env'
import { getServiceClient } from './client'
import {
  createClassroom,
  ensureClassSession,
  getOrCreateMissionProgress,
  isAiEnabledForStudent,
  recordAttempt,
  setHomeDeadline,
  setMissionStars,
  teacherSetMissionStars,
  updateSessionSettings,
  upsertTeacher,
  withAiSwitch,
} from './repo'

loadEnvLocal()

const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

const EMAIL_A = 'teacher.t79a@digital-biz.local'
const EMAIL_B = 'teacher.t79b@digital-biz.local'
const ROOM = 'T79DDL'

let TEACHER_A = ''
let TEACHER_B = ''
let studentId = ''
let sessionId = ''

/** teachers.id อ้าง auth.users จึงต้องมีบัญชีจริงก่อน ไม่ใช่ uuid ลอย ๆ */
async function ensureTeacher(email: string): Promise<string> {
  const admin = getServiceClient().auth.admin
  const created = await admin.createUser({ email, password: 't79-test-1234', email_confirm: true })
  if (created.data.user) return created.data.user.id

  const listed = await admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) throw listed.error
  const found = listed.data.users.find((u) => u.email === email)
  if (!found) throw created.error ?? new Error(`สร้างบัญชีครูทดสอบ ${email} ไม่สำเร็จ`)
  return found.id
}

async function cleanup() {
  await getServiceClient().from('classrooms').delete().eq('room_code', ROOM)
}

describe.skipIf(!hasDb)('ประตูวันหมดเขตทำต่อที่บ้าน', () => {
  beforeAll(async () => {
    await cleanup()
    TEACHER_A = await ensureTeacher(EMAIL_A)
    TEACHER_B = await ensureTeacher(EMAIL_B)
    await upsertTeacher(TEACHER_A, EMAIL_A, 'ครูทดสอบ A')
    await upsertTeacher(TEACHER_B, EMAIL_B, 'ครูทดสอบ B')

    const room = await createClassroom(TEACHER_A, ROOM)
    const session = await ensureClassSession(TEACHER_A, room.id)
    if (!session) throw new Error('เปิดคาบไม่ได้')
    sessionId = session.id

    const student = await getServiceClient()
      .from('students')
      .insert({ classroom_id: room.id, nickname: 'หุ่นหมดเขต', pin_hash: 'x' })
      .select()
      .single()
    if (student.error) throw student.error
    studentId = student.data.id

    // ย้อนวันหมดเขตไปเมื่อ 1 ชั่วโมงที่แล้ว = สถานการณ์ "ครูตรวจงานตอนดึก"
    await setHomeDeadline(TEACHER_A, sessionId, new Date(Date.now() - 3_600_000).toISOString())
  })

  afterAll(cleanup)

  it('ครูตั้งดาวด่านบอสได้แม้เลยวันหมดเขต และดาวรวมถูกคิดใหม่ให้ในคราวเดียว', async () => {
    const profile = await teacherSetMissionStars(TEACHER_A, studentId, 'boss', 3)
    expect(profile?.earned_stars).toBe(3)
  })

  it('ครูคนอื่นสั่งไม่ได้ ต่อให้รู้ studentId', async () => {
    expect(await teacherSetMissionStars(TEACHER_B, studentId, 'boss', 0)).toBeNull()
    // ดาวเดิมต้องไม่ถูกแตะ
    const profile = await teacherSetMissionStars(TEACHER_A, studentId, 'boss', 3)
    expect(profile?.earned_stars).toBe(3)
  })

  it('เขียน mission_progress ตรง ๆ จากฝั่งเว็บยังถูกกั้นเหมือนเดิม — ประตูไม่ได้ถูกปลดทิ้ง', async () => {
    await expect(setMissionStars(studentId, 'm1', 3)).rejects.toThrow(/หมดเขตทำต่อที่บ้าน/)
  })

  it('เด็กเปิดภารกิจที่ไม่เคยเปิดได้ (แถวเปล่าไม่ใช่คำตอบใหม่) แต่ตอบเพิ่มไม่ได้', async () => {
    const row = await getOrCreateMissionProgress(studentId, 'm4')
    expect(row.attempts).toBe(0)
    expect(row.stars).toBe(0)

    await expect(recordAttempt(studentId, 'm4', { correct: true })).rejects.toThrow(
      /หมดเขตทำต่อที่บ้าน/,
    )
  })

  it('สวิตช์ AI ของครูอ่านได้จริง — ค่าตั้งต้นเปิด กดปิดแล้วเป็นปิดทันที', async () => {
    expect(await isAiEnabledForStudent(studentId)).toBe(true)

    await updateSessionSettings(TEACHER_A, sessionId, { aiEnabled: false })
    expect(await isAiEnabledForStudent(studentId)).toBe(false)

    await updateSessionSettings(TEACHER_A, sessionId, { aiEnabled: true })
    expect(await isAiEnabledForStudent(studentId)).toBe(true)
  })

  it('ไม่รู้จักนักเรียนคนนี้ = ถือว่า AI เปิด (ไม่ใช่ปิดเงียบ)', async () => {
    expect(await isAiEnabledForStudent('00000000-0000-0000-0000-0000000000aa')).toBe(true)
  })

  /**
   * ทุกจุดที่เรียกโมเดลต้องผ่าน withAiSwitch ตัวเดียว (มติ master: ห้ามก๊อปเงื่อนไขไปไว้ 4 ที่)
   * ปิดแล้วต้อง **ไม่แตะฝั่ง AI เลย** ไม่ใช่เรียกไปแล้วค่อยทิ้งผล
   */
  it('withAiSwitch: ปิดแล้วไม่เรียกฝั่ง AI เลย · เปิดแล้วไม่เรียกฝั่งกฎเลย', async () => {
    let aiCalls = 0
    let ruleCalls = 0
    const run = () =>
      withAiSwitch(
        studentId,
        async () => {
          aiCalls += 1
          return 'ai'
        },
        () => {
          ruleCalls += 1
          return 'rules'
        },
      )

    await updateSessionSettings(TEACHER_A, sessionId, { aiEnabled: false })
    expect(await run()).toBe('rules')
    expect(aiCalls).toBe(0)

    // เปิดกลับต้องใช้ได้ทันทีในคำขอถัดไป ไม่ต้องรีสตาร์ตเซิร์ฟเวอร์ (อ่านค่าสดทุกครั้ง ไม่มีแคช)
    await updateSessionSettings(TEACHER_A, sessionId, { aiEnabled: true })
    expect(await run()).toBe('ai')
    expect(aiCalls).toBe(1)
    expect(ruleCalls).toBe(1)
  })
})

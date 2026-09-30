/**
 * เทสต์ติดฐานข้อมูลจริง — คำตอบรายข้อของแบบทดสอบ (T59)
 *
 *   เขียนแล้วอ่านกลับได้ แยกชุด pre กับ post ไม่ปนกัน
 *   ยิงซ้ำไม่ทับคำตอบเดิม (แบบทดสอบทำได้ครั้งเดียว)
 *   นักเรียนที่ไม่มีอยู่จริง = ไม่เกิดแถวลอย
 *   ครูคนอื่นอ่านห้องนี้ = 0 แถว
 *   ค่า p กับ r ที่ core คำนวณจากของจริงตรงกับที่คิดมือ
 *
 * ไฟล์นี้ **ข้ามตัวเองเมื่อไม่มี env ของฐานข้อมูล** (`npm test` ของคนอื่นจึงไม่พัง)
 * รันจริงด้วย:  npx vitest run lib/db/quiz-items.db.test.ts
 */
import { afterAll, describe, expect, it } from 'vitest'
import { loadEnvLocal } from '../../scripts/load-env'
import { itemAnalysis } from '../../core/statistics'
import { getServiceClient } from './client'
import { getClassroomQuizItemSheets, recordQuizItemResponses } from './repo'

loadEnvLocal()

const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

const TEACHER_A = 'e6ccd4cc-e799-413f-bf8e-fe285938ba8e'
const TEACHER_B = '5947c389-f395-4f51-9700-a271ea07089f'
const ROOM = 'cccccccc-0000-4000-8000-0000000059a1'
const GHOST = 'dddddddd-0000-4000-8000-000000005900'

/** 4 คน: ตอบถูก 3 / 2 / 1 / 0 ข้อ นับจากข้อแรก — คิดค่า p กับ r ด้วยมือได้ทันที */
const STUDENTS = [
  'dddddddd-0000-4000-8000-0000000059a1',
  'dddddddd-0000-4000-8000-0000000059a2',
  'dddddddd-0000-4000-8000-0000000059a3',
  'dddddddd-0000-4000-8000-0000000059a4',
]
const CORRECT_COUNT = [3, 2, 1, 0]
const ITEMS = ['q1', 'q2', 'q3']

async function seed() {
  const db = getServiceClient()
  await db.from('classrooms').delete().eq('id', ROOM)
  await db.from('classrooms').insert({ id: ROOM, teacher_id: TEACHER_A, room_code: 'T59AA1' })
  await db.from('students').insert(
    STUDENTS.map((id, i) => ({
      id,
      classroom_id: ROOM,
      nickname: `t59-${i + 1}`,
      pin_hash: 'x',
    })),
  )
}

function sheetFor(i: number) {
  return ITEMS.map((itemId, k) => ({
    itemId,
    choiceIndex: k % 4,
    correct: k < CORRECT_COUNT[i]!,
  }))
}

describe.skipIf(!hasDb)('คำตอบรายข้อของแบบทดสอบ', () => {
  afterAll(async () => {
    if (!hasDb) return
    await getServiceClient().from('classrooms').delete().eq('id', ROOM)
  })

  it('เขียนแล้วอ่านกลับได้ แยกชุด pre กับ post ไม่ปนกัน', async () => {
    await seed()
    for (let i = 0; i < STUDENTS.length; i++) {
      expect(await recordQuizItemResponses(STUDENTS[i]!, 'pre', sheetFor(i))).toBe(3)
    }
    // ชุดหลังเรียนของคนเดียวกัน รหัสข้อชื่อซ้ำกันได้เพราะแยกด้วย quiz_set
    expect(await recordQuizItemResponses(STUDENTS[0]!, 'post', sheetFor(3))).toBe(3)

    const sheets = await getClassroomQuizItemSheets(TEACHER_A, ROOM)
    expect(sheets.pre).toHaveLength(4)
    expect(sheets.post).toHaveLength(1)
    expect(sheets.pre[0]).toEqual({ q1: true, q2: true, q3: true })
    expect(sheets.post[0]).toEqual({ q1: false, q2: false, q3: false })
  })

  it('ยิงซ้ำไม่ทับคำตอบเดิม', async () => {
    // คนแรกเคยตอบถูกครบ 3 ข้อ ยิงใหม่เป็นผิดหมดต้องไม่เปลี่ยนอะไร
    expect(await recordQuizItemResponses(STUDENTS[0]!, 'pre', sheetFor(3))).toBe(0)
    const sheets = await getClassroomQuizItemSheets(TEACHER_A, ROOM)
    expect(sheets.pre.filter((s) => s.q1 === true)).toHaveLength(3)
  })

  it('นักเรียนที่ไม่มีอยู่จริง ไม่เกิดแถวลอย', async () => {
    expect(await recordQuizItemResponses(GHOST, 'pre', sheetFor(0))).toBe(0)
  })

  it('ครูคนอื่นอ่านห้องนี้ไม่ได้', async () => {
    const stolen = await getClassroomQuizItemSheets(TEACHER_B, ROOM)
    expect(stolen.pre).toHaveLength(0)
    expect(stolen.post).toHaveLength(0)
  })

  it('ค่าความยาก p กับอำนาจจำแนก r ที่ core คิดจากของจริง ตรงกับที่คิดมือ', async () => {
    const sheets = await getClassroomQuizItemSheets(TEACHER_A, ROOM)
    const stats = itemAnalysis(sheets.pre.map((correctByItem) => ({ correctByItem })))
    const byId = new Map(stats.map((s) => [s.itemId, s]))

    // q1 ถูก 3 จาก 4 คน · q2 ถูก 2 · q3 ถูก 1
    expect(byId.get('q1')?.difficulty).toBe(0.75)
    expect(byId.get('q2')?.difficulty).toBe(0.5)
    expect(byId.get('q3')?.difficulty).toBe(0.25)

    // 4 คน ตัดกลุ่มละ floor(4 x 0.27) = 1 คน · คนบนสุดถูกหมด คนล่างสุดผิดหมด
    expect(byId.get('q1')?.discrimination).toBe(1)
    expect(byId.get('q3')?.discrimination).toBe(1)

    // เกณฑ์สเปกข้อ 9.4: ความยาก 0.20-0.80 · อำนาจจำแนกตั้งแต่ 0.20
    expect(byId.get('q1')?.usable).toBe(true)
    expect(byId.get('q3')?.usable).toBe(true)
  })
})

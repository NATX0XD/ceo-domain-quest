/**
 * เทสต์ติดฐานข้อมูลจริง — `confirm_submission_scores` ต้องเก็บคะแนนที่ครูยืนยันไว้ครั้งก่อน (T67)
 *
 * ทำไมต้องมี: `changedDimensions` เคยขึ้นครบ 4 ด้านเสมอ เพราะไม่มีใครเก็บค่าเดิมของครูไว้เลย
 * ฝั่งเว็บจึงไปเทียบกับคะแนนของกฎแทน (ซึ่งเป็น array คนละรูปแบบ) แล้วได้ undefined ทุกตัว
 *
 * รันจริงด้วย:  npx vitest run lib/db/confirm-scores.db.test.ts
 */
import { afterAll, describe, expect, it } from 'vitest'
import { loadEnvLocal } from '../../scripts/load-env'
import { getServiceClient } from './client'
import { confirmSubmissionScores } from './repo'

loadEnvLocal()

const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

const TEACHER_A = 'e6ccd4cc-e799-413f-bf8e-fe285938ba8e'
const TEACHER_B = '5947c389-f395-4f51-9700-a271ea07089f'
const ROOM = 'cccccccc-0000-4000-8000-0000000067a1'
const STUDENT = 'dddddddd-0000-4000-8000-0000000067a1'
const SUBMISSION = 'eeeeeeee-0000-4000-8000-0000000067a1'

function bag(dimensions: Record<string, number>, note: string) {
  return { dimensions, note, confirmedByTeacher: true } as never
}

async function seed() {
  const db = getServiceClient()
  await db.from('classrooms').delete().eq('id', ROOM)
  await db.from('classrooms').insert({ id: ROOM, teacher_id: TEACHER_A, room_code: 'T67AA1' })
  await db.from('students').insert({ id: STUDENT, classroom_id: ROOM, nickname: 't67', pin_hash: 'x' })
  await db.from('submissions').insert({
    id: SUBMISSION,
    student_id: STUDENT,
    domain_name: 't67shop',
    tld: '.com',
    emphasis_criterion: 'dim-naming',
    needs_review: true,
    // รูปแบบจริงของคะแนนจากกฎ: dimensions เป็น **array ของ object** ไม่ใช่ map
    ai_scores: {
      weightedTotal: 11,
      dimensions: [
        { id: 'dim-naming', score: 2 },
        { id: 'dim-tld-fit', score: 2 },
      ],
    } as never,
  })
}

describe.skipIf(!hasDb)('confirm_submission_scores เก็บคะแนนครูรอบก่อน', () => {
  afterAll(async () => {
    if (!hasDb) return
    await getServiceClient().from('classrooms').delete().eq('id', ROOM)
  })

  it('ยืนยันครั้งแรก ยังไม่มีค่าเดิม', async () => {
    await seed()
    const row = await confirmSubmissionScores(
      TEACHER_A,
      SUBMISSION,
      bag({ 'dim-naming': 2, 'dim-tld-fit': 2 }, 'ครั้งแรก'),
    )
    expect(row?.teacher_scores_before).toBeNull()
    expect((row?.teacher_confirmed_scores as { note: string }).note).toBe('ครั้งแรก')
  })

  it('ยืนยันรอบสอง เก็บค่าของรอบแรกไว้ให้เทียบ', async () => {
    const row = await confirmSubmissionScores(
      TEACHER_A,
      SUBMISSION,
      bag({ 'dim-naming': 3, 'dim-tld-fit': 2 }, 'แก้ด้านชื่อ'),
    )
    const before = row?.teacher_scores_before as { dimensions: Record<string, number> }
    expect(before.dimensions).toEqual({ 'dim-naming': 2, 'dim-tld-fit': 2 })

    // เทียบแบบเดียวกับที่ route ทำ — ต้องได้ด้านเดียว ไม่ใช่ทุกด้าน
    const now = (row?.teacher_confirmed_scores as { dimensions: Record<string, number> }).dimensions
    const changed = Object.keys(now).filter((id) => before.dimensions[id] !== now[id])
    expect(changed).toEqual(['dim-naming'])
  })

  it('กดยืนยันซ้ำโดยไม่แก้อะไร ไม่มีด้านไหนเปลี่ยน', async () => {
    const row = await confirmSubmissionScores(
      TEACHER_A,
      SUBMISSION,
      bag({ 'dim-naming': 3, 'dim-tld-fit': 2 }, 'กดซ้ำเฉย ๆ'),
    )
    const before = (row?.teacher_scores_before as { dimensions: Record<string, number> }).dimensions
    const now = (row?.teacher_confirmed_scores as { dimensions: Record<string, number> }).dimensions
    expect(Object.keys(now).filter((id) => before[id] !== now[id])).toEqual([])
  })

  it('ครูคนอื่นยืนยันงานในห้องที่ไม่ใช่ของตัวเองไม่ได้', async () => {
    expect(await confirmSubmissionScores(TEACHER_B, SUBMISSION, bag({ 'dim-naming': 1 }, 'ขโมย'))).toBeNull()
    // และของเดิมต้องไม่ถูกแตะ
    const { data } = await getServiceClient()
      .from('submissions')
      .select('teacher_confirmed_scores')
      .eq('id', SUBMISSION)
      .single()
    expect((data?.teacher_confirmed_scores as { note: string }).note).toBe('กดซ้ำเฉย ๆ')
  })
})

/**
 * เทสต์ติดฐานข้อมูลจริง — ปุ่มล้างห้องสาธิตต้องถูกกันที่ชั้นฐานข้อมูล ไม่ใช่แค่ซ่อนปุ่ม (T71/E-16)
 *
 * สิ่งที่ล็อกไว้:
 *   1. ห้องเรียนจริงล้างไม่ได้ ต่อให้เป็นครูเจ้าของห้องเอง
 *   2. ห้องเรียนจริงจะถูกติดป้าย is_demo ย้อนหลังไม่ได้ (ไม่งั้นป้ายกลายเป็นประตูหลัง)
 *   3. ครูคนอื่นล้างห้องสาธิตของคนอื่นไม่ได้
 *
 * รันจริงด้วย:  npx vitest run lib/db/demo-reset.db.test.ts
 */
import { afterAll, describe, expect, it } from 'vitest'
import { loadEnvLocal } from '../../scripts/load-env'
import { getServiceClient } from './client'
import { createDemoClassroom, resetDemoClassroom } from './repo'

loadEnvLocal()

const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

const TEACHER_A = 'e6ccd4cc-e799-413f-bf8e-fe285938ba8e'
const TEACHER_B = '5947c389-f395-4f51-9700-a271ea07089f'
const DEMO_ROOM = 'T71DMO'
const REAL_ROOM = 'T71RAL'

async function cleanup() {
  const db = getServiceClient()
  await db.from('classrooms').delete().in('room_code', [DEMO_ROOM, REAL_ROOM])
}

describe.skipIf(!hasDb)('ล้างห้องสาธิต (reset_demo_classroom)', () => {
  afterAll(cleanup)

  it('ห้องสาธิตล้างได้ และนักเรียนหายไปจริง', async () => {
    await cleanup()
    const room = await createDemoClassroom(TEACHER_A, DEMO_ROOM)
    expect(room.is_demo).toBe(true)

    const db = getServiceClient()
    await db.from('students').insert([
      { classroom_id: room.id, nickname: 'หุ่น1', pin_hash: 'x' },
      { classroom_id: room.id, nickname: 'หุ่น2', pin_hash: 'x' },
    ])

    const wiped = await resetDemoClassroom(TEACHER_A, room.id)
    expect(wiped.ok).toBe(true)
    if (wiped.ok) expect(wiped.counts.students).toBe(2)

    const left = await db.from('students').select('id').eq('classroom_id', room.id)
    expect(left.data).toEqual([])
    // ห้องยังอยู่ พร้อมให้เติมหุ่นชุดใหม่ทันที ไม่ใช่ลบห้องทิ้ง
    const still = await db.from('classrooms').select('id').eq('id', room.id).maybeSingle()
    expect(still.data?.id).toBe(room.id)
  })

  it('ห้องเรียนจริงล้างไม่ได้ แม้เป็นครูเจ้าของห้องเอง', async () => {
    const db = getServiceClient()
    const real = await db
      .from('classrooms')
      .insert({ teacher_id: TEACHER_A, room_code: REAL_ROOM })
      .select()
      .single()
    if (real.error) throw real.error
    expect(real.data.is_demo).toBe(false)

    await db.from('students').insert({ classroom_id: real.data.id, nickname: 'เด็กจริง', pin_hash: 'x' })

    const blocked = await resetDemoClassroom(TEACHER_A, real.data.id)
    expect(blocked).toEqual({ ok: false, reason: 'not-demo' })

    const left = await db.from('students').select('id').eq('classroom_id', real.data.id)
    expect(left.data).toHaveLength(1)
  })

  it('ติดป้ายห้องสาธิตย้อนหลังให้ห้องที่มีนักเรียนแล้วไม่ได้', async () => {
    const db = getServiceClient()
    const room = await db.from('classrooms').select('id').eq('room_code', REAL_ROOM).single()
    const relabel = await db.from('classrooms').update({ is_demo: true }).eq('id', room.data!.id)
    expect(relabel.error?.message).toContain('ติดป้ายห้องสาธิตย้อนหลังไม่ได้')

    const after = await db.from('classrooms').select('is_demo').eq('id', room.data!.id).single()
    expect(after.data?.is_demo).toBe(false)
  })

  it('ครูคนอื่นล้างห้องสาธิตของคนอื่นไม่ได้ (แยกจาก "ไม่ใช่ห้องสาธิต")', async () => {
    const db = getServiceClient()
    const room = await db.from('classrooms').select('id').eq('room_code', DEMO_ROOM).single()
    expect(await resetDemoClassroom(TEACHER_B, room.data!.id)).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })
})

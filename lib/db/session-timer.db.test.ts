/**
 * เทสต์ติดฐานข้อมูลจริง — ยืนยันกติกา "นาฬิกาจากแผนเวลา" ของ set_session_phase ทั้งสองทาง (T54)
 *
 *   ห้องที่ครูไม่เคยตั้งเวลาเอง  ไม่ส่งวินาทีมา = **ไม่มีนาฬิกา** (พฤติกรรมเดิมก่อน T52 เป๊ะ)
 *   ห้องที่ครูตั้งเวลาเองแล้ว    ไม่ส่งวินาทีมา = หยิบนาทีของช่วงนั้นจากแผน
 *   ส่งวินาทีมาเอง              ชนะแผนเสมอ ทั้งสองแบบ
 *
 * ไฟล์นี้ **ข้ามตัวเองเมื่อไม่มี env ของฐานข้อมูล** (`npm test` ของคนอื่นจึงไม่พัง)
 * รันจริงด้วย:  npx vitest run lib/db/session-timer.db.test.ts   (ต้องมี .env.local และ supabase ขึ้นอยู่)
 */
import { afterAll, describe, expect, it } from 'vitest'
import { loadEnvLocal } from '../../scripts/load-env'
import { getServiceClient } from './client'
import { setClassPlan, setSessionPhase, DEFAULT_PHASE_MINUTES } from './repo'

loadEnvLocal()

const hasDb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

const TEACHER = 'e6ccd4cc-e799-413f-bf8e-fe285938ba8e'
const PLAIN_ROOM = 'cccccccc-0000-4000-8000-0000000054a1'
const PLAN_ROOM = 'cccccccc-0000-4000-8000-0000000054a2'
const PLAIN_SESSION = 'eeeeeeee-0000-4000-8000-0000000054a1'
const PLAN_SESSION = 'eeeeeeee-0000-4000-8000-0000000054a2'

/** เหลือเวลาอีกกี่นาทีนับจากตอนนี้ (ปัดเข้าใกล้ที่สุด) */
function minutesLeft(timerEndAt: string | null): number | null {
  if (!timerEndAt) return null
  return Math.round((new Date(timerEndAt).getTime() - Date.now()) / 60_000)
}

async function seed() {
  const db = getServiceClient()
  await db.from('classrooms').delete().in('id', [PLAIN_ROOM, PLAN_ROOM])
  await db.from('classrooms').insert([
    { id: PLAIN_ROOM, teacher_id: TEACHER, room_code: 'T54AA1' },
    { id: PLAN_ROOM, teacher_id: TEACHER, room_code: 'T54AA2' },
  ])
  await db.from('class_sessions').insert([
    { id: PLAIN_SESSION, classroom_id: PLAIN_ROOM, phase: 'wait' },
    { id: PLAN_SESSION, classroom_id: PLAN_ROOM, phase: 'wait' },
  ])
}

describe.skipIf(!hasDb)('set_session_phase หยิบเวลาจากแผนเฉพาะห้องที่ครูตั้งเอง', () => {
  afterAll(async () => {
    if (!hasDb) return
    await getServiceClient().from('classrooms').delete().in('id', [PLAIN_ROOM, PLAN_ROOM])
  })

  it('ห้องที่ครูไม่เคยตั้งเวลาเอง: ไม่ส่งวินาที = ไม่มีนาฬิกา (เหมือนเดิมเป๊ะ)', async () => {
    await seed()
    const moved = await setSessionPhase(TEACHER, PLAIN_SESSION, 'mission')
    expect(moved?.phase).toBe('mission')
    expect(moved?.phase_minutes_custom).toBe(false)
    expect(moved?.timer_end_at).toBeNull()
  })

  it('ห้องที่ครูไม่เคยตั้งเวลาเอง: ส่งวินาทีมา = ตั้งนาฬิกาตามนั้น', async () => {
    const moved = await setSessionPhase(TEACHER, PLAIN_SESSION, 'boss', 300)
    expect(minutesLeft(moved?.timer_end_at ?? null)).toBe(5)
  })

  it('ครูตั้งเวลาเองแล้ว: ไม่ส่งวินาที = หยิบนาทีของช่วงนั้นจากแผน', async () => {
    const planned = await setClassPlan(TEACHER, PLAN_SESSION, { phaseMinutes: { mission: 18 } })
    expect(planned?.phase_minutes_custom).toBe(true)

    const moved = await setSessionPhase(TEACHER, PLAN_SESSION, 'mission')
    expect(minutesLeft(moved?.timer_end_at ?? null)).toBe(18)
  })

  it('ครูตั้งเวลาเองแล้ว: ช่วงที่ไม่ได้แก้ ใช้ค่าในแผนของช่วงนั้น', async () => {
    const moved = await setSessionPhase(TEACHER, PLAN_SESSION, 'boss')
    expect(minutesLeft(moved?.timer_end_at ?? null)).toBe(DEFAULT_PHASE_MINUTES.boss)
  })

  it('ครูตั้งเวลาเองแล้ว: ส่งวินาทีมาเอง ชนะแผนเสมอ', async () => {
    const moved = await setSessionPhase(TEACHER, PLAN_SESSION, 'mission', 120)
    expect(minutesLeft(moved?.timer_end_at ?? null)).toBe(2)
  })

  it('ช่วงที่ไม่มีในแผน (end/home) ไม่ตั้งนาฬิกาให้ แม้ครูตั้งค่าเองแล้ว', async () => {
    const moved = await setSessionPhase(TEACHER, PLAN_SESSION, 'end')
    expect(moved?.timer_end_at).toBeNull()
  })

  it('คาบสั้นแล้วสั่งย้ายช่วง: นาฬิกาตรงกับแผนที่ย่อไว้', async () => {
    const planned = await setClassPlan(TEACHER, PLAN_SESSION, { classMinutes: 45 })
    const missionMinutes = (planned?.phase_minutes as Record<string, number>).mission

    const moved = await setSessionPhase(TEACHER, PLAN_SESSION, 'mission')
    expect(minutesLeft(moved?.timer_end_at ?? null)).toBe(missionMinutes)
  })
})

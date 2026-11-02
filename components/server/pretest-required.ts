import { NextResponse } from 'next/server'
import { getProfile } from '../../lib/db/repo'
import { pretestGate } from './posttest-gate'

/**
 * ต้องทำแบบทดสอบก่อนเรียนก่อนเข้าภารกิจ (เจ้าของสั่ง — ใช้จริงในห้อง)
 *
 * ทำแล้ว = `profiles.pre_test_score` ไม่เป็น null (POST /api/pretest เขียนค่านี้ครั้งเดียว)
 * ยังไม่ทำ → ภารกิจ/เส้นทางเรียนทุกด่านปิด ทั้งหน้าเว็บและ API
 * ครูยังไม่เปิดแบบทดสอบ (`class_sessions.pretest_enabled`) → บอกให้รอครูเปิด
 *
 * ⚠️ ตัดสินฝั่งเซิร์ฟเวอร์เสมอ หน้าเว็บแค่แสดงผล ยิง API ตรงก็ไม่ผ่าน
 */
export const PRETEST_HREF = '/pretest'
export const PRETEST_TODO_MESSAGE = 'ทำแบบทดสอบก่อนเรียนก่อนนะ'
export const PRETEST_WAIT_MESSAGE = 'รอครูเปิดแบบทดสอบก่อนเรียน'

export interface PretestRequirement {
  /** ส่งแบบทดสอบก่อนเรียนแล้ว = เข้าภารกิจได้ */
  done: boolean
  /** ครูเปิดแบบทดสอบให้คนนี้แล้ว (ทั้งห้องหรือรายคน) */
  open: boolean
}

export async function pretestRequirement(studentId: string): Promise<PretestRequirement> {
  const profile = await getProfile(studentId)
  if (profile && profile.pre_test_score !== null) return { done: true, open: true }
  const gate = await pretestGate(studentId)
  return { done: false, open: gate.open }
}

export function pretestBlockedMessage(req: PretestRequirement): string {
  return req.open ? PRETEST_TODO_MESSAGE : PRETEST_WAIT_MESSAGE
}

/** ใช้ใน API ของภารกิจ: คืน 409 + href '/pretest' เมื่อยังไม่ได้ทำ · null = ผ่าน */
export async function pretestBlockResponse(studentId: string): Promise<NextResponse | null> {
  const req = await pretestRequirement(studentId)
  if (req.done) return null
  return NextResponse.json(
    {
      error: 'pretest-required',
      message: pretestBlockedMessage(req),
      href: PRETEST_HREF,
      pretestOpen: req.open,
    },
    { status: 409 },
  )
}

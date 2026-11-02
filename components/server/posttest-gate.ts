import { getProfile, getStudent, listSubmissions } from '@/lib/db/repo'

/**
 * ประตูของแบบทดสอบก่อน/หลังเรียน (T-12) — ชุดก่อนเรียน **ครูเป็นคนกดเปิด**
 * ชุดหลังเรียนเปิดเองทันทีเมื่อทำชุดก่อนเรียนแล้ว (สวิตช์ครูยังเปิดได้ แต่ไม่บล็อกนักเรียน)
 *
 * ใช้สวิตช์ของคาบโดยตรง: `class_sessions.pretest_enabled` และ `posttest_enabled`
 * (เดิมผูกกับ `phase` ชั่วคราวเพราะยังไม่มีคอลัมน์ ตอนนี้ฝั่ง DB ทำมาแล้วจึงเลิกผูกกับ phase
 *  ผลข้างเคียงที่หายไป: ครูกดเปิดแบบทดสอบแล้วทั้งห้องไม่เด้งไปช่วงอื่นอีกต่อไป)
 *
 * ⚠️ ตัดสินฝั่งเซิร์ฟเวอร์เท่านั้น หน้าเว็บแค่แสดงผล เดา URL แล้วยิง POST ตรงก็ไม่ผ่าน
 */

export type TestKind = 'pretest' | 'posttest'

export interface TestGate {
  open: boolean
  /** เหตุผลที่ยังไม่เปิด — บอกว่าต้องรออะไร ไม่ใช่บอกว่าห้าม */
  reason: string | null
  /** ครูเปิดให้คนนี้ก่อนทั้งห้องหรือเปล่า */
  unlockedForStudent: boolean
  /** ครูกดเปิด (ทั้งห้องหรือรายคน) — false = เปิดเองเพราะทำแบบทดสอบก่อนเรียนแล้ว */
  byTeacher?: boolean
}

const CLOSED_MESSAGE = 'ทำภารกิจ CEO ให้เสร็จก่อน แล้วแบบทดสอบหลังเรียนจะเปิดให้เอง'

export async function testGate(studentId: string, kind: TestKind): Promise<TestGate> {
  const student = await getStudent(studentId)
  if (!student) {
    return {
      open: false,
      reason: 'ไม่พบข้อมูลนักเรียนคนนี้ ให้เข้าห้องใหม่',
      unlockedForStudent: false,
    }
  }

  if (kind === 'pretest') return { open: true, reason: null, unlockedForStudent: false, byTeacher: false }
  const [profile, submissions] = await Promise.all([getProfile(studentId), listSubmissions(studentId)])
  const ready = profile?.pre_test_score !== null && submissions.length > 0
  return ready
    ? { open: true, reason: null, unlockedForStudent: false, byTeacher: false }
    : { open: false, reason: CLOSED_MESSAGE, unlockedForStudent: false }
}

/** ทางลัดเดิมของแบบทดสอบหลังเรียน — หน้าและ route เดิมเรียกชื่อนี้อยู่ */
export async function posttestGate(studentId: string): Promise<TestGate & { phase: null }> {
  const gate = await testGate(studentId, 'posttest')
  return { ...gate, phase: null }
}

export async function pretestGate(studentId: string): Promise<TestGate> {
  return testGate(studentId, 'pretest')
}

export { REFLECT_LOCKED_MESSAGE, reflectUnlocked } from '@/core/reflect-gate'

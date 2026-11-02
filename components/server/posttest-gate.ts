import { getActiveClassSession, getProfile, getStudent, listStudentPhaseUnlocks } from '@/lib/db/repo'

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

/** ครูปลดล็อกรายคนก่อนทั้งห้องได้ด้วยช่วงนี้ (ตาราง student_phase_unlocks) */
const UNLOCK_PHASE = 'reflect'

export interface TestGate {
  open: boolean
  /** เหตุผลที่ยังไม่เปิด — บอกว่าต้องรออะไร ไม่ใช่บอกว่าห้าม */
  reason: string | null
  /** ครูเปิดให้คนนี้ก่อนทั้งห้องหรือเปล่า */
  unlockedForStudent: boolean
  /** ครูกดเปิด (ทั้งห้องหรือรายคน) — false = เปิดเองเพราะทำแบบทดสอบก่อนเรียนแล้ว */
  byTeacher?: boolean
}

const CLOSED_MESSAGE: Record<TestKind, string> = {
  pretest:
    'แบบทดสอบก่อนเรียนจะเปิดตอนครูกดเปิดให้ทั้งห้องก่อนเริ่มคาบ ระหว่างนี้ยังไม่ต้องทำอะไรครับ',
  posttest: 'ทำแบบทดสอบก่อนเรียนก่อนนะ แล้วแบบทดสอบหลังเรียนจะเปิดให้เอง',
}

export async function testGate(studentId: string, kind: TestKind): Promise<TestGate> {
  const student = await getStudent(studentId)
  if (!student) {
    return {
      open: false,
      reason: 'ไม่พบข้อมูลนักเรียนคนนี้ ให้เข้าห้องใหม่',
      unlockedForStudent: false,
    }
  }

  const unlocks = await listStudentPhaseUnlocks(studentId)
  const unlockedForStudent = unlocks.some(
    (row) => row.phase === UNLOCK_PHASE && row.revoked_at === null,
  )

  const session = student.classroom_id ? await getActiveClassSession(student.classroom_id) : null
  const enabled =
    kind === 'pretest' ? session?.pretest_enabled === true : session?.posttest_enabled === true

  if (enabled || unlockedForStudent) {
    return { open: true, reason: null, unlockedForStudent, byTeacher: true }
  }

  /**
   * แบบทดสอบหลังเรียน **ไม่ต้องรอครูเปิด** (เจ้าของสั่ง) — ทำได้ทันทีที่ทำชุดก่อนเรียนแล้ว
   * เด็กที่จบด่านบอสเร็วจะได้ทำต่อเลย ไม่ต้องนั่งรอทั้งห้อง · สวิตช์ของครูยังเปิดให้ได้ แต่ไม่ใช่ประตู
   * ต้องมีคะแนนก่อนเรียนก่อน ไม่งั้นเทียบก่อน-หลัง (E1/E2) ไม่ได้
   */
  if (kind === 'posttest') {
    const profile = await getProfile(studentId)
    if (profile && profile.pre_test_score !== null) {
      return { open: true, reason: null, unlockedForStudent, byTeacher: false }
    }
  }

  return { open: false, reason: CLOSED_MESSAGE[kind], unlockedForStudent }
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

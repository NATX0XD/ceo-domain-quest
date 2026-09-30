import { NextResponse } from 'next/server'
import {
  SESSION_PHASE_LABELS,
  getActiveClassSession,
  getStudent,
  isSessionPhase,
} from '@/lib/db/repo'
import { readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * ช่วงของคาบ + นาฬิกา สำหรับ **จอนักเรียน** (S-11)
 *
 * ครูเป็นคนคุมช่วงและเวลาทั้งหมด (T-03) หน้านี้อ่านอย่างเดียว
 * ⚠️ ห้ามจับเวลารายข้อ (สเปกข้อ 2.7) นาฬิกามีเฉพาะระดับ "ช่วงกิจกรรม" เท่านั้น
 * ⚠️ คืนเฉพาะข้อมูลของห้อง ไม่มีข้อมูลของเพื่อนคนไหนปนมาเลย
 * ⚠️ studentId มาจากคุกกี้ dbq_student เท่านั้น
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** เตือนล่วงหน้าเมื่อเหลือกี่วินาที (สเปก S-11 ข้อ 2 = 2 นาที) */
const WARN_SECONDS = 120

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const student = await getStudent(session.studentId)
  const classSession = student?.classroom_id
    ? await getActiveClassSession(student.classroom_id)
    : null

  if (!classSession) {
    // ครูยังไม่ได้เปิดคาบ — ไม่มีนาฬิกา ไม่มีหน้าพัก เรียนไปตามปกติได้
    return NextResponse.json({ active: false, phase: null, restMode: false })
  }

  const phase = isSessionPhase(classSession.phase) ? classSession.phase : 'wait'
  const endsAtMs = classSession.timer_end_at ? new Date(classSession.timer_end_at).getTime() : null
  const paused = classSession.timer_paused_seconds !== null

  /**
   * หยุดนาฬิกาไว้ = ใช้วินาทีที่ค้างไว้ตรง ๆ ไม่ไหลต่อ
   * ไม่ได้หยุด = นับจากเวลาสิ้นสุดที่ครูตั้ง (เซิร์ฟเวอร์ส่งวินาทีที่เหลือไปให้ ไม่ให้เบราว์เซอร์คิดจากนาฬิกาเครื่องตัวเอง)
   */
  const remainingSeconds = paused
    ? (classSession.timer_paused_seconds ?? 0)
    : endsAtMs === null
      ? null
      : Math.max(0, Math.round((endsAtMs - Date.now()) / 1000))

  return NextResponse.json({
    active: true,
    phase,
    phaseLabel: SESSION_PHASE_LABELS[phase] ?? phase,
    remainingSeconds,
    paused,
    /** ช่วงทำต่อที่บ้านไม่แสดงนาฬิกา (กฎ S-11) */
    showClock: phase !== 'home' && remainingSeconds !== null,
    warn: remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= WARN_SECONDS,
    /**
     * หน้าพัก "ดูจอหน้าห้องนะ" — ขึ้นตอนช่วงครูสรุป หรือตอนครูกดปุ่ม 📺 (สเปก T-03 · SC-23)
     * เด็กยังกด "กลับไปทำต่อ" เองได้ ระบบไม่ล็อกเครื่อง
     */
    restMode: phase === 'summary' || classSession.focus_screen === true,
    restReason: phase === 'summary' ? 'ช่วงครูสรุป' : 'ครูขอให้ดูจอหน้าห้อง',
  })
}

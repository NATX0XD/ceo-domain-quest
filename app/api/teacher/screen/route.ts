import { NextResponse } from 'next/server'
import {
  SESSION_PHASE_LABELS,
  getActiveClassSession,
  getClassroomScreenStats,
  isSessionPhase,
  listPinnedShowcase,
} from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * T-04 ข้อมูลสำหรับ **จอหน้าห้อง** (โปรเจกเตอร์)
 *
 * ⚠️ กฎเหล็ก: **ห้ามมีชื่อคนคู่กับคะแนน ดาว หรือสถานะรายคน** ทุกค่าที่คืนเป็นภาพรวมของห้อง
 *    (สเปก T-04 · หลักไม่มีกระดานจัดอันดับ) ผลงานที่ขึ้นจอมีแค่ชื่อเว็บกับเหตุผล
 * ⚠️ teacherId จาก cookie · getTeacherBoardWithFlags ตรวจเจ้าของห้องใน query เดียว ไม่ใช่เจ้าของ = 404
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** ผลงานที่ขึ้นจอตอนครูสรุป — สเปกบอก 2-3 ชิ้น */
const SHOWCASE_ON_SCREEN = 3

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  /**
   * ตรวจสิทธิ์เจ้าของห้อง **ในคิวรีเดียวกับที่นับตัวเลข** (คืน null = ไม่ใช่ห้องของครูคนนี้)
   * ของเดิมเรียก getTeacherBoardWithFlags มาตรวจสิทธิ์อย่างเดียว ทั้งที่มันลากข้อมูลรายคนทั้งห้องมาด้วย
   * (ห้อง 277 คน = 373 KB ที่ทิ้งทันที) จอหน้าห้องไม่ต้องรู้จักใครเป็นรายคนอยู่แล้ว
   */
  const stats = await getClassroomScreenStats(session.teacherId, classroomId)
  if (!stats) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const classSession = await getActiveClassSession(classroomId)
  const phase = classSession && isSessionPhase(classSession.phase) ? classSession.phase : 'wait'
  const endsAtMs = classSession?.timer_end_at ? new Date(classSession.timer_end_at).getTime() : null
  const paused = classSession?.timer_paused_seconds != null
  const remainingSeconds = paused
    ? (classSession?.timer_paused_seconds ?? 0)
    : endsAtMs === null
      ? null
      : Math.max(0, Math.round((endsAtMs - Date.now()) / 1000))

  /**
   * ขึ้นจอเฉพาะผลงานที่ **ครูปักหมุดเอง** (มติ T47) ไม่ใช่ใบล่าสุดอัตโนมัติ
   * ครูปักหมุดแบบซ่อนชื่อได้ → RPC คืน nickname เป็น null มาให้เลย
   * ⚠️ ไม่มีดาวและไม่มีคะแนนติดไปด้วยทุกกรณี
   */
  const pinned = await listPinnedShowcase(session.teacherId, classroomId)
  const showcase = pinned.slice(0, SHOWCASE_ON_SCREEN).map((row) => ({
    domain: `${row.domain_name ?? ''}${row.tld ?? ''}`,
    reason: row.reason_text ?? '',
    nickname: row.nickname,
  }))

  return NextResponse.json({
    ok: true,
    phase,
    phaseLabel: SESSION_PHASE_LABELS[phase] ?? phase,
    remainingSeconds,
    paused,
    focusScreen: classSession?.focus_screen === true,
    ...stats,
    showcase,
  })
}

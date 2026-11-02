import { NextResponse } from 'next/server'
import { LIVE_CONTROL_ENABLED, liveControlNotFound } from '@/lib/teacher-features'
import { z } from 'zod'
import {
  SESSION_PHASES,
  SESSION_PHASE_LABELS,
  UNLOCKABLE_PHASES,
  closeClassSession,
  ensureClassSession,
  extendSessionTimer,
  listSessionPhaseChanges,
  pauseSessionTimer,
  revertSessionPhase,
  revokeStudentPhaseUnlock,
  setFocusScreen,
  setTestWindow,
  setSessionPhase,
  setSessionTimer,
  unlockStudentPhase,
  updateSessionSettings,
} from '@/lib/db/repo'
import { setTestEnabled } from '@/components/server/class-session-admin'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * T-03 ครูควบคุมช่วงของคาบและเวลา
 *
 * "ช่วงของห้อง" คือเพดานสูงสุดที่ครูเปิดให้ทำ (สเปกข้อ 3.2) ครูย้ายทั้งห้องได้ในแตะเดียว
 * ปลดล็อกให้รายคนก่อนได้ และย้อนการย้ายช่วงล่าสุดได้ภายใน 30 วินาทีเผื่อกดพลาด
 *
 * ⚠️ teacherId มาจาก cookie เท่านั้น · ทุกคำสั่งส่งผ่าน repo ที่ตรวจเจ้าของห้องใน SQL คิวรีเดียวกัน
 *    ไม่ใช่เจ้าของ = 404 (ไม่บอกว่าคาบนั้นมีจริงไหม)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NOT_FOUND = 'ไม่พบคาบนี้ในห้องของคุณ'

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('open'),
    classroomId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('phase'),
    sessionId: z.string().uuid(),
    phase: z.enum(SESSION_PHASES),
    /** ตั้งนาฬิกาของช่วงใหม่พร้อมกัน (วินาที) ไม่ส่ง = ช่วงนั้นไม่มีนาฬิกา */
    timerSeconds: z.number().int().min(0).max(7200).optional(),
  }),
  z.object({ action: z.literal('revert'), sessionId: z.string().uuid() }),
  z.object({
    action: z.literal('timer'),
    sessionId: z.string().uuid(),
    seconds: z.number().int().min(0).max(7200),
  }),
  z.object({
    action: z.literal('extend'),
    sessionId: z.string().uuid(),
    /** ปุ่ม +1 / +3 / +5 นาที */
    addSeconds: z.number().int().min(1).max(1800),
  }),
  z.object({
    action: z.literal('pause'),
    sessionId: z.string().uuid(),
    paused: z.boolean(),
  }),
  z.object({
    action: z.literal('focus'),
    sessionId: z.string().uuid(),
    on: z.boolean(),
  }),
  z.object({
    action: z.literal('settings'),
    sessionId: z.string().uuid(),
    aiEnabled: z.boolean().optional(),
    allowEarlyBoss: z.boolean().optional(),
    surveyEnabled: z.boolean().optional(),
    homeDeadline: z.string().datetime().optional(),
  }),
  z.object({ action: z.literal('close'), sessionId: z.string().uuid() }),
  z.object({
    /** เปิด/ปิดแบบทดสอบก่อนหรือหลังเรียน (T-12) — ครูเป็นคนกด ไม่ผูกกับช่วงของคาบแล้ว */
    action: z.literal('test'),
    sessionId: z.string().uuid(),
    kind: z.enum(['pretest', 'posttest']),
    enabled: z.boolean(),
  }),
  z.object({
    /**
     * T-12 เปิด/ปิดแบบทดสอบ 10 ข้อ — **ไม่ผูกกับช่วงของคาบ**
     * กดเปิดแล้วทั้งห้องต้องไม่เด้งไปช่วงอื่น และแบบทดสอบก่อนเรียนเปิดได้ตั้งแต่ช่วง 'wait'
     * (คนละอย่างกับเช็กความเข้าใจ 4 ข้อตอนรู้จักตัวเอง ซึ่งไม่มีสวิตช์)
     */
    action: z.literal('test-window'),
    sessionId: z.string().uuid(),
    which: z.enum(['pre', 'post']),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal('unlock-student'),
    studentId: z.string().uuid(),
    phase: z.enum(UNLOCKABLE_PHASES),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal('lock-student'),
    studentId: z.string().uuid(),
    phase: z.enum(UNLOCKABLE_PHASES),
  }),
])

/** เปิดคาบของห้อง (หรือคืนคาบที่กำลังเดินอยู่) พร้อมประวัติการย้ายช่วง */
export async function GET(request: Request) {
  if (!LIVE_CONTROL_ENABLED) return liveControlNotFound()
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  const classSession = await ensureClassSession(session.teacherId, classroomId)
  if (!classSession) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const changes = await listSessionPhaseChanges(session.teacherId, classSession.id)
  return NextResponse.json({
    session: classSession,
    phases: SESSION_PHASES.map((phase) => ({ phase, label: SESSION_PHASE_LABELS[phase] })),
    changes,
  })
}

export async function POST(request: Request) {
  if (!LIVE_CONTROL_ENABLED) return liveControlNotFound()
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = ActionSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse(
      'bad-request',
      `action ไม่ถูกต้อง — ใช้ open | phase | revert | timer | extend | pause | focus | settings | test-window | close | unlock-student | lock-student (ช่วง: ${SESSION_PHASES.join(', ')})`,
    )
  }

  const body = parsed.data
  const teacherId = session.teacherId

  switch (body.action) {
    case 'open': {
      const result = await ensureClassSession(teacherId, body.classroomId)
      if (!result) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'phase': {
      const result = await setSessionPhase(
        teacherId,
        body.sessionId,
        body.phase,
        body.timerSeconds ?? null,
      )
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'revert': {
      const result = await revertSessionPhase(teacherId, body.sessionId)
      if (!result) {
        return errorResponse('too-late', 'ย้อนการย้ายช่วงได้ภายใน 30 วินาทีเท่านั้น', 409)
      }
      return NextResponse.json({ ok: true, session: result })
    }
    case 'timer': {
      const result = await setSessionTimer(teacherId, body.sessionId, body.seconds)
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'extend': {
      const result = await extendSessionTimer(teacherId, body.sessionId, body.addSeconds)
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'pause': {
      const result = await pauseSessionTimer(teacherId, body.sessionId, body.paused)
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'focus': {
      const result = await setFocusScreen(teacherId, body.sessionId, body.on)
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'settings': {
      const result = await updateSessionSettings(teacherId, body.sessionId, {
        aiEnabled: body.aiEnabled,
        allowEarlyBoss: body.allowEarlyBoss,
        surveyEnabled: body.surveyEnabled,
        homeDeadline: body.homeDeadline,
      })
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'test': {
      const result = await setTestEnabled(teacherId, body.sessionId, body.kind, body.enabled)
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'close': {
      const result = await closeClassSession(teacherId, body.sessionId)
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'test-window': {
      const result = await setTestWindow(teacherId, body.sessionId, body.which, body.enabled)
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, session: result })
    }
    case 'unlock-student': {
      const result = await unlockStudentPhase(teacherId, body.studentId, body.phase, body.note)
      if (!result) return errorResponse('not-found', 'ไม่พบนักเรียนคนนี้ในห้องของคุณ', 404)
      return NextResponse.json({ ok: true, unlock: result })
    }
    case 'lock-student': {
      const result = await revokeStudentPhaseUnlock(teacherId, body.studentId, body.phase)
      if (!result) return errorResponse('not-found', 'ไม่พบการปลดล็อกที่ยังใช้อยู่', 404)
      return NextResponse.json({ ok: true, unlock: result })
    }
  }
}

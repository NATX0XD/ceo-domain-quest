import { NextResponse } from 'next/server'
import { z } from 'zod'
import { PIN_LENGTH, hashPin } from '@/lib/pin'
import {
  LEARNING_ROUTES,
  MISSION_TARGETS,
  OVERRIDE_REASONS,
  OVERRIDE_REASON_LABELS,
  getStudentReport,
  listStudentOverrides,
  listStudentPhaseUnlocks,
  listTeacherNotes,
  removeStudent,
  teacherAddNote,
  teacherAllowSkip,
  teacherForcePass,
  teacherOpenBoss,
  teacherResetPin,
  teacherSetBossTemplate,
  teacherSetMissionLevel,
  teacherSetScaffold,
  teacherUnlockBusiness,
} from '@/lib/db/repo'
import { teacherSkipMissionNow } from '@/components/server/mission-skip'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * T-06 ครูดูและปรับแผนรายคน · T-07 บันทึกการโค้ช
 *
 * **ทุกการแก้ถูกบันทึกเป็นหลักฐาน** — `teacher_overrides` เก็บค่าเดิม ค่าใหม่ ใครแก้ เมื่อไร
 * และเหตุผลสั้นที่ครูต้องเลือกทุกครั้ง (สเปก T-06) เอาไปตอบกรรมการได้ว่า "ครูแก้การตัดสินใจของระบบได้"
 *
 * ⚠️ teacherId มาจาก cookie เท่านั้น · ทุก rpc ตรวจว่านักเรียนอยู่ห้องของครูคนนี้ในคำสั่งเดียวกัน
 *    ไม่ใช่เจ้าของ = ไม่แก้ ไม่เขียนประวัติ และตอบ 404
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NOT_FOUND = 'ไม่พบนักเรียนคนนี้ในห้องของคุณ'

const reason = z.enum(OVERRIDE_REASONS).default('other')
const note = z.string().trim().max(200).optional()
const studentId = z.string().uuid()
const missionId = z.enum(MISSION_TARGETS)

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mission-level'),
    studentId,
    missionId,
    level: z.number().int().min(1).max(3),
    reason,
    note,
  }),
  z.object({ action: z.literal('allow-skip'), studentId, missionId, allow: z.boolean(), reason, note }),
  /**
   * ครูสั่งข้ามให้เลย — ต่างจาก allow-skip ที่แค่ "เปิดสิทธิ์" แล้วรอเด็กกดเอง
   * ใช้ตอนเวลาไม่พอ หรือครูประเมินเรื่องนั้นด้วยวิธีอื่นไปแล้ว
   */
  z.object({ action: z.literal('skip-mission'), studentId, missionId, reason, note }),
  z.object({ action: z.literal('force-pass'), studentId, missionId, reason, note }),
  z.object({
    action: z.literal('scaffold'),
    studentId,
    channel: z.enum(LEARNING_ROUTES).optional(),
    level: z.number().int().min(1).max(3).optional(),
    reason,
    note,
  }),
  z.object({ action: z.literal('unlock-business'), studentId, unlocked: z.boolean().default(true), reason, note }),
  z.object({ action: z.literal('boss-template'), studentId, templateId: z.string().trim().min(1).max(60), reason, note }),
  z.object({ action: z.literal('open-boss'), studentId, reason, note }),
  z.object({ action: z.literal('reset-pin'), studentId, reason, note }),
  z.object({
    action: z.literal('note'),
    studentId,
    chips: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
    text: z.string().trim().max(500).optional(),
  }),
])

/** รหัสชั่วคราว 4 หลัก — ไม่ขึ้นต้นด้วย 0 และไม่ใช่เลขซ้ำทั้งหมด เพื่อให้พิมพ์ง่ายและไม่เดาง่ายเกิน */
function makeTempPin(): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  const value = 1000 + (bytes[0]! % 9000)
  const pin = String(value).padStart(PIN_LENGTH, '0')
  return /^(\d)\1+$/.test(pin) ? makeTempPin() : pin
}

/** หน้ารายคนของครู: รายงาน + ประวัติการแก้ + บันทึกการโค้ช + ช่วงที่ถูกปลดล็อกให้ */
export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const id = new URL(request.url).searchParams.get('studentId')
  if (!id) return errorResponse('bad-request', 'ต้องส่ง studentId')

  const report = await getStudentReport(session.teacherId, id)
  if (!report) return errorResponse('not-found', NOT_FOUND, 404)

  const [overrides, notes, unlocks] = await Promise.all([
    listStudentOverrides(session.teacherId, id),
    listTeacherNotes(session.teacherId, id),
    listStudentPhaseUnlocks(id),
  ])

  return NextResponse.json({
    report,
    overrides,
    notes,
    unlocks,
    reasonOptions: OVERRIDE_REASONS.map((value) => ({ value, label: OVERRIDE_REASON_LABELS[value] })),
  })
}

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = ActionSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse(
      'bad-request',
      `action ไม่ถูกต้อง — ใช้ mission-level | allow-skip | skip-mission | force-pass | scaffold | unlock-business | boss-template | open-boss | reset-pin | note และต้องส่งเหตุผล (${OVERRIDE_REASONS.join(' | ')})`,
    )
  }

  const body = parsed.data
  const teacherId = session.teacherId

  switch (body.action) {
    case 'mission-level': {
      const row = await teacherSetMissionLevel(
        teacherId, body.studentId, body.missionId, body.level, body.reason, body.note,
      )
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, missionProgress: row })
    }
    case 'allow-skip': {
      const row = await teacherAllowSkip(
        teacherId, body.studentId, body.missionId, body.allow, body.reason, body.note,
      )
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, missionProgress: row })
    }
    /**
     * ครูสั่งข้ามแทนนักเรียน — 0 ดาว แต่นับว่าผ่านจุดประสงค์ (content/rubric.json missionStars.skip)
     * แยกจาก "เด็กข้ามเองเพราะพิสูจน์แล้วว่ารู้" ซึ่งได้ 3 ดาว — รายงานต้องไม่ปนสองอย่างนี้
     */
    case 'skip-mission': {
      const result = await teacherSkipMissionNow(
        teacherId, body.studentId, body.missionId, body.reason, body.note,
      )
      if (!result) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({
        ok: true,
        missionId: body.missionId,
        skippedBy: 'teacher',
        stars: result.applied?.stars ?? 0,
        passed: result.applied?.passed ?? false,
        reason: result.decision.reason,
        skippedAt: result.skippedAt,
      })
    }
    case 'force-pass': {
      const row = await teacherForcePass(teacherId, body.studentId, body.missionId, body.reason, body.note)
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, missionProgress: row })
    }
    case 'scaffold': {
      if (!body.channel && body.level === undefined) {
        return errorResponse('bad-request', 'ต้องส่ง channel หรือ level อย่างน้อยหนึ่งอย่าง')
      }
      const row = await teacherSetScaffold(
        teacherId, body.studentId, { channel: body.channel, level: body.level }, body.reason, body.note,
      )
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, profile: row })
    }
    case 'unlock-business': {
      const row = await teacherUnlockBusiness(teacherId, body.studentId, body.unlocked, body.reason, body.note)
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, profile: row })
    }
    case 'boss-template': {
      const row = await teacherSetBossTemplate(teacherId, body.studentId, body.templateId, body.reason, body.note)
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, profile: row })
    }
    case 'open-boss': {
      const row = await teacherOpenBoss(teacherId, body.studentId, body.reason, body.note)
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, unlock: row })
    }
    case 'reset-pin': {
      // สร้างรหัสชั่วคราวที่นี่ แล้วส่งเข้าฐานข้อมูลเป็น hash เท่านั้น
      const tempPin = makeTempPin()
      const row = await teacherResetPin(
        teacherId, body.studentId, await hashPin(tempPin), body.reason, body.note,
      )
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({
        ok: true,
        /** บอกครูครั้งเดียวเพื่อบอกต่อให้นักเรียน — ฐานข้อมูลเก็บแต่ hash */
        tempPin,
        student: { id: row.id, nickname: row.nickname, mustChangePin: row.must_change_pin },
      })
    }
    case 'note': {
      const row = await teacherAddNote(teacherId, body.studentId, body.chips, body.text)
      if (!row) return errorResponse('not-found', NOT_FOUND, 404)
      return NextResponse.json({ ok: true, note: row })
    }
  }
}

const RemoveSchema = z.object({ studentId, classroomId: z.string().uuid() })

/**
 * ครูลบนักเรียนออกจากห้อง (สมัครชื่อผิด สมัครซ้ำ) — หน้าจอถามยืนยันก่อนส่งมาเสมอ
 * removeStudent ตรวจว่าห้องเป็นของครูคนนี้และนักเรียนอยู่ห้องนั้นใน DELETE เดียวกัน
 */
export async function DELETE(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = RemoveSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง studentId และ classroomId')

  const row = await removeStudent(session.teacherId, parsed.data.classroomId, parsed.data.studentId)
  if (!row) return errorResponse('not-found', NOT_FOUND, 404)
  return NextResponse.json({ ok: true, removed: { id: row.id, nickname: row.nickname } })
}

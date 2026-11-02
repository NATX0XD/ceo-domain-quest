import { NextResponse } from 'next/server'
import { z } from 'zod'
import { studentNicknameSchema, studentPinSchema } from '../../../../lib/account-validation'
import { hashPin, verifyPin } from '../../../../lib/pin'
import {
  findStudentByNickname,
  getStudent,
  updateStudentNickname,
  updateStudentPin,
} from '../../../../lib/db/repo'
import { moderateJoinNickname } from '../../../../components/server/moderation'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../../_lib/session-cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RenameSchema = z.object({ nickname: studentNicknameSchema })
const PinSchema = z.object({
  currentPin: z.string(),
  newPin: studentPinSchema,
})
const AccountPatchSchema = z.union([RenameSchema, PinSchema])

export async function PATCH(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const parsed = AccountPatchSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ข้อมูลบัญชีไม่ถูกต้อง')

  const student = await getStudent(session.studentId)
  if (!student || student.classroom_id !== session.classroomId) {
    return unauthorized('ไม่พบข้อมูลนักเรียนคนนี้แล้ว')
  }

  const body = parsed.data
  if ('nickname' in body) {
    if (body.nickname === student.nickname) {
      return NextResponse.json({ ok: true, nickname: student.nickname, message: 'ชื่อเล่นยังเหมือนเดิม' })
    }

    if (await findStudentByNickname(session.classroomId, body.nickname)) {
      return errorResponse('nickname-taken', `ในห้องนี้มีคนใช้ชื่อ "${body.nickname}" แล้ว ลองตั้งชื่ออื่นนะ`, 409, { field: 'nickname' })
    }

    const verdict = await moderateJoinNickname(session.classroomId, body.nickname)
    if (!verdict.ok) {
      return errorResponse('content-flagged', verdict.message ?? 'ชื่อนี้ยังใช้ในห้องไม่ได้ ลองชื่ออื่นนะ', 422, {
        field: 'nickname',
        original: verdict.original,
      })
    }

    const updated = await updateStudentNickname(session.studentId, session.classroomId, body.nickname)
    if (!updated) return errorResponse('nickname-taken', 'ชื่อนี้ถูกใช้ไปแล้ว ลองตั้งชื่ออื่นนะ', 409, { field: 'nickname' })
    return NextResponse.json({
      ok: true,
      nickname: updated.nickname,
      message: 'เปลี่ยนชื่อแล้ว ใช้ชื่อใหม่นี้ตอนเข้าห้องครั้งถัดไป',
    })
  }

  if (!(await verifyPin(body.currentPin.trim(), student.pin_hash))) {
    return errorResponse('invalid-pin', 'PIN ปัจจุบันไม่ถูกต้อง', 401)
  }

  const pinHash = await hashPin(body.newPin)
  const updated = await updateStudentPin(session.studentId, session.classroomId, pinHash)
  if (!updated) return errorResponse('not-found', 'ไม่พบข้อมูลนักเรียนคนนี้แล้ว', 404)

  return NextResponse.json({ ok: true, message: 'เปลี่ยน PIN แล้ว' })
}

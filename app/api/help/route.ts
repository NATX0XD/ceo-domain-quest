import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listMissionProgress, logEvent, recordProgress } from '@/lib/db/repo'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * ผู้เรียนกด "ขอให้ครูช่วย" — ขึ้นธงแดงบนแผงครูทันที ไม่ต้องรอเกณฑ์เวลา
 *
 * ⚠️ การขอครู **ไม่ใช่ช่องทางการเรียนที่ 5** ค่า canonical ของ channel ยังเป็น clip|card|game|buddy เท่านั้น
 *    จึงไม่แตะคอลัมน์ channel/learning_route เลย — บันทึกเป็นสถานะ needs_help ของ progress แทน
 *    (แผงครูอ่าน askedForHelp จาก "มี station ไหนเป็น needs_help") พร้อม event ไว้ให้ครูตามย้อนหลัง
 * ⚠️ ตาราง progress มีแค่ station A/B/C ไม่มีคอลัมน์บอกว่าขอครูตอนอยู่ภารกิจไหน
 *    จึงใช้แถว station 'C' เป็น "ช่องธง" อย่างเดียว (ไม่ได้ใช้เป็นสถานะของสถานีจริงแล้ว)
 *    ส่วน "ภารกิจที่ขอตอนนั้น" บันทึกเป็น event และคืนกลับไปให้หน้าจอ
 *    แผงครูจับคู่ธงกับภารกิจที่นักเรียนกำลังทำอยู่ (currentMission) ให้เองอีกชั้น
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HELP_STATION = 'C' as const

const RequestSchema = z.object({
  missionId: z.string().min(1).max(40).optional(),
  cancel: z.boolean().optional(),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'รูปแบบคำขอไม่ถูกต้อง', 400)

  const cancel = parsed.data.cancel === true

  /**
   * ภารกิจที่ขอครู = ที่ส่งมาจากหน้าจอ ถ้าไม่ส่งมาให้เดาจากภารกิจที่ขยับล่าสุดและยังไม่ผ่าน
   * (ตรรกะเดียวกับที่แผงครูใช้หา currentMission) ธงจะได้ผูกกับภารกิจจริง ไม่ใช่ลอย ๆ
   */
  let missionId = parsed.data.missionId ?? null
  if (!cancel && !missionId) {
    const rows = await listMissionProgress(session.studentId)
    const open = rows.filter((r) => r.passed_at === null)
    const latest = open.reduce<(typeof open)[number] | null>(
      (best, row) =>
        best === null || new Date(row.updated_at) > new Date(best.updated_at) ? row : best,
      null,
    )
    missionId = latest?.mission_id ?? null
  }

  await recordProgress(session.studentId, HELP_STATION, {
    status: cancel ? 'in_progress' : 'needs_help',
  })
  await logEvent(session.studentId, cancel ? 'help-cancelled' : 'help-requested', {
    missionId,
  })

  return NextResponse.json({
    ok: true,
    askedForHelp: !cancel,
    missionId,
    message: cancel
      ? 'ยกเลิกการเรียกครูแล้ว'
      : 'เรียกครูแล้ว ครูเห็นชื่อเราขึ้นสีแดงบนจอแล้ว ระหว่างรอทำข้อต่อไปได้เลย',
  })
}

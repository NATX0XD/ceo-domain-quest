import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addPeerFeedback, findStudentByNickname } from '@/lib/db/repo'
import { moderateFields } from '@/components/server/moderation'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ขั้นที่ 5 — ให้ความเห็นเพื่อน: ชม 1 ข้อ + เสนอแนะ 1 ข้อ (กิจกรรมเสริม ไม่บังคับ)
 *
 * ⚠️ ผู้ส่งอ่านจากคุกกี้ dbq_student เท่านั้น ห้ามรับ fromStudentId จาก body
 * ⚠️ ผู้รับต้องอยู่ในห้องเดียวกัน (ค้นด้วย classroomId ของ session) ส่งข้ามห้องไม่ได้
 * ⚠️ ที่นี่ไม่มีคะแนนหรือดาวของใครทั้งสิ้น — ตำราห้ามเอาผู้เรียนมาเปรียบเทียบกัน
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  toNickname: z.string().trim().min(1).max(40),
  praiseText: z.string().max(400).optional(),
  suggestText: z.string().max(400).optional(),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องบอกชื่อเล่นเพื่อน และเขียนอย่างน้อย 1 ช่อง', 400)
  }

  const praiseText = (parsed.data.praiseText ?? '').trim()
  const suggestText = (parsed.data.suggestText ?? '').trim()
  if (praiseText.length === 0 && suggestText.length === 0) {
    return errorResponse('empty-feedback', 'เขียนคำชมหรือข้อเสนอแนะอย่างน้อย 1 ช่อง', 400)
  }

  /**
   * ข้อความนี้เพื่อนจะเห็นบนผนังผลงาน จึงตรวจแบบเข้มขึ้น 1 ขั้น (safeToShowPeers)
   * ไม่ผ่าน = ไม่ขึ้นผนัง แต่ข้อความเดิมยังคืนกลับไปให้เจ้าตัวแก้เอง
   */
  const checked = await moderateFields(
    session.studentId,
    'peer-feedback',
    [
      { id: 'praiseText', text: praiseText },
      { id: 'suggestText', text: suggestText },
    ],
    { forPeers: true },
  )
  if (!checked.ok && checked.verdict) {
    return errorResponse('content-flagged', checked.verdict.message ?? 'ลองเขียนใหม่นะ', 422, {
      field: checked.failedFieldId,
      original: checked.verdict.original,
    })
  }

  const friend = await findStudentByNickname(session.classroomId, parsed.data.toNickname)
  if (!friend) {
    return errorResponse('friend-not-found', 'ไม่พบเพื่อนชื่อนี้ในห้องเรา ลองเช็กตัวสะกดอีกที', 404)
  }
  if (friend.id === session.studentId) {
    return errorResponse('self-feedback', 'ให้ความเห็นตัวเองไม่ได้ ลองเลือกเพื่อนคนอื่นดู', 400)
  }

  const saved = await addPeerFeedback(session.studentId, friend.id, { praiseText, suggestText })
  if (!saved) {
    return errorResponse('save-failed', 'บันทึกความเห็นไม่สำเร็จ ลองใหม่อีกครั้ง', 409)
  }

  return NextResponse.json({ ok: true, toNickname: friend.nickname })
}

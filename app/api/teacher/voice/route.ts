import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  deleteVoiceSubmission,
  getSignedVoiceUrl,
  listClassroomVoiceSubmissions,
} from '@/lib/db/repo'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ไฟล์เสียงด่านบอสของทั้งห้อง — ครูฟังและสั่งลบก่อนครบกำหนดได้
 *
 * ⚠️ teacherId มาจาก cookie เท่านั้น ทุกฟังก์ชันตรวจเจ้าของห้องในชั้น repo
 * นโยบายเก็บ: ลบอัตโนมัติเมื่อครบ 90 วัน (voice_submissions.expires_at) ครูสั่งลบก่อนได้
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DeleteSchema = z.object({ voiceSubmissionId: z.string().uuid() })

/** GET ?classroomId=... — รายการเสียงทั้งห้อง พร้อม URL อายุสั้นให้กดฟัง */
export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องระบุ classroomId')

  const rows = await listClassroomVoiceSubmissions(session.teacherId, classroomId)
  if (!rows) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  const items = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      nickname: row.nickname,
      durationSec: row.duration_sec,
      transcriptText: row.transcript_text,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      url: await getSignedVoiceUrl(session.teacherId, row.id),
    })),
  )

  return NextResponse.json({ classroomId, count: items.length, voices: items })
}

/** DELETE — ครูสั่งลบไฟล์เสียงหนึ่งไฟล์ก่อนครบกำหนด (ลบทั้งไฟล์และแถว) */
export async function DELETE(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = DeleteSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง voiceSubmissionId')

  const removed = await deleteVoiceSubmission(session.teacherId, parsed.data.voiceSubmissionId)
  if (!removed) return errorResponse('not-found', 'ไม่พบไฟล์เสียงนี้ในห้องของคุณ', 404)

  return NextResponse.json({ ok: true, deleted: removed.id })
}

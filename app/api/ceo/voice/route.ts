import { NextResponse } from 'next/server'
import { MAX_VOICE_BYTES, VOICE_MIME_TYPES, logEvent, uploadVoice } from '@/lib/db/repo'
import { errorResponse, readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * อัปโหลดไฟล์เสียงนำเสนอของด่านบอส (bucket ส่วนตัว จำกัด 2 MB เฉพาะไฟล์เสียง)
 *
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น · path ในสตอเรจฝั่ง repo เป็น <studentId>/<uuid>.<ext>
 * ⚠️ อัปโหลดพังต้องไม่ทำให้ผู้เรียนตัน — คืน error ที่บอกสาเหตุชัด แล้วหน้าจอสลับไปโหมดพิมพ์ได้ทันที
 * รับเป็น multipart/form-data ฟิลด์ `audio` (+ `durationSec` ถ้ามี)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse('bad-request', 'ส่งไฟล์เสียงมาไม่ถูกรูปแบบ', 400)
  }

  const file = form.get('audio')
  if (!(file instanceof File)) {
    return errorResponse('no-file', 'ไม่พบไฟล์เสียง ลองอัดใหม่อีกครั้ง หรือพิมพ์คำตอบแทนได้เลย', 400)
  }

  if (file.size > MAX_VOICE_BYTES) {
    return errorResponse(
      'too-large',
      `ไฟล์เสียงใหญ่เกิน ${Math.round(MAX_VOICE_BYTES / 1024 / 1024)} MB อัดใหม่ให้สั้นลง หรือพิมพ์คำตอบแทนได้`,
      413,
    )
  }

  // ชนิดไฟล์ของ MediaRecorder มักมี codec ต่อท้าย เช่น audio/webm;codecs=opus
  const mimeType = (file.type || 'audio/webm').split(';')[0]?.trim() ?? 'audio/webm'
  if (!VOICE_MIME_TYPES[mimeType]) {
    return errorResponse(
      'bad-type',
      `ชนิดไฟล์ ${mimeType} ใช้ไม่ได้ รับเฉพาะ ${Object.keys(VOICE_MIME_TYPES).join(', ')} — พิมพ์คำตอบแทนได้เลย`,
      415,
    )
  }

  const durationRaw = Number(form.get('durationSec'))
  const durationSec = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : 0

  const result = await uploadVoice(session.studentId, await file.arrayBuffer(), {
    mimeType,
    durationSec,
  })

  if (!result.ok) {
    return errorResponse(result.reason, `${result.message} — พิมพ์คำตอบแทนได้เลย ไม่ต้องรอ`, 400)
  }

  await logEvent(session.studentId, 'voice-uploaded', {
    durationSec,
    mimeType,
    storagePath: result.storagePath,
  })

  return NextResponse.json({
    ok: true,
    durationSec,
    submissionId: result.submission.id,
    message: 'ส่งไฟล์เสียงให้ครูแล้ว',
  })
}

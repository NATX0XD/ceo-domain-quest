import { NextResponse } from 'next/server'
import { z } from 'zod'
import { moderateStudentText } from '@/components/server/moderation'
import {
  CERTIFICATE_DISPLAY_NAME_MAX_LENGTH,
  saveCertificateDisplayName,
} from '@/lib/certificate/profile'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../../_lib/session-cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  certificateDisplayName: z.string().trim().min(1).max(CERTIFICATE_DISPLAY_NAME_MAX_LENGTH),
  confirmed: z.literal(true),
})

/** บันทึกชื่อจริงจาก modal ผลลัพธ์ — นักเรียนแก้/ล้างเองไม่ได้ */
export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const parsed = BodySchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ตรวจตัวสะกดแล้วกดยืนยันก่อนนะ')

  const verdict = await moderateStudentText(
    session.studentId,
    'certificate-name',
    parsed.data.certificateDisplayName,
  )
  if (!verdict.ok) {
    return errorResponse('content-flagged', verdict.message ?? 'ลองใช้ชื่อที่สุภาพขึ้นนะ', 422, {
      field: 'certificateDisplayName',
      original: verdict.original,
    })
  }

  if (!(await saveCertificateDisplayName(session.studentId, parsed.data.certificateDisplayName))) {
    return errorResponse('certificate-name-locked', 'ชื่อบนเกียรติบัตรถูกตั้งไว้แล้ว ถ้าต้องการแก้ให้บอกครู', 409)
  }

  return NextResponse.json({ ok: true, certificateDisplayName: parsed.data.certificateDisplayName })
}

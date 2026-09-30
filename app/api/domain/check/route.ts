import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logEvent } from '@/lib/db/repo'
import { checkDomainAvailability } from '@/components/server/domain-registry'
import { loadShopProfile } from '@/components/server/game-state'
import { moderateStudentText } from '@/components/server/moderation'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * S-23 + E-06 "ชื่อนี้ว่างไหม" — ปุ่มตรวจก่อนจด
 *
 * ตรวจ 4 ชั้นตามลำดับ (ลำดับสำคัญ ดู components/server/domain-registry.ts):
 * 1. ตัด URL ที่ก๊อปมาวางให้เหลือชื่อจริงก่อน แล้วบอกด้วยว่าตัดอะไรไป
 * 2. ชื่อต้องห้าม (แบรนด์คนอื่น · ชื่อในแบบฝึก · คำสงวนทางเทคนิค) จาก content/reserved-names.json
 * 3. ถูกจดไปแล้วในโลกของเกม (content/taken-domains.json)
 * 4. เพื่อนในห้องเดียวกันจดไปก่อน — **ใครจดก่อนได้ก่อน**
 *
 * ⚠️ ตรวจอย่างเดียว **ไม่จดให้ และไม่แก้ชื่อของเด็ก** การจดจริงเกิดตอนบันทึกโปรไฟล์ที่ /api/profile
 * ⚠️ ชนแล้วต้องมีชื่อที่ยังว่างเสนอกลับไปเสมอ ไม่ปล่อยให้เด็กค้าง
 * ⚠️ คืนแค่ชื่อเล่นของเพื่อนที่จดไปก่อน **ไม่คืนดาวหรือคะแนนของใคร**
 * ⚠️ studentId กับ classroomId มาจากคุกกี้ dbq_student เท่านั้น ห้ามรับจาก body
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  name: z.string().max(200),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง name เป็นข้อความ')

  /**
   * ชื่อเว็บก็เป็นข้อความที่เด็กพิมพ์เอง และขึ้นให้เพื่อนเห็นบนผนังผลงาน
   * จึงผ่านด่านกรองคำก่อนเหมือนช่องอื่น — ไม่ผ่าน = คืนข้อความเดิมกลับไป ไม่ตรวจต่อ
   */
  const verdict = await moderateStudentText(
    session.studentId,
    'brand-name',
    parsed.data.name,
    { forPeers: true },
  )
  if (!verdict.ok) {
    return errorResponse('content-flagged', verdict.message ?? 'ลองใช้คำอื่นดูนะ', 422, {
      field: 'name',
      original: verdict.original,
      famousBrands: verdict.famousBrands,
    })
  }

  // ใช้ชื่อร้านกับประเภทธุรกิจเป็นคำหลักของกฎ "ตรงกับร้าน" (ไฟดวงที่ 4)
  const profile = await loadShopProfile(session.studentId)
  const keywords = [profile?.shopName, profile?.businessTypeId].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )

  const result = await checkDomainAvailability(
    session.studentId,
    session.classroomId,
    parsed.data.name,
    keywords,
  )

  await logEvent(session.studentId, 'domain-checked', {
    name: result.name,
    status: result.status,
    available: result.available,
  })

  return NextResponse.json({ ok: true, ...result })
}

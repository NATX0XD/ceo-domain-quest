import { NextResponse } from 'next/server'
import { z } from 'zod'
import { touchStudentPresence } from '@/lib/db/repo'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * จุดเต้นของหัวใจของนักเรียน — เขียน `students.last_seen_at` ให้เป็นปัจจุบัน
 *
 * **ทำไมต้องมี**: เกณฑ์คัดคู่หู (E-04) คือ "ใช้งานใน 60 วินาทีที่ผ่านมา" ซึ่ง
 * `buddy_candidates_raw` อ่านจาก `last_seen_at` ตรง ๆ ถ้าไม่มีใครเขียนคอลัมน์นี้
 * ทุกคนจะได้ `idle_seconds = 999999` แล้ว **ไม่มีใครเข้าเกณฑ์เป็นคู่หูได้เลยสักคน
 * โดยไม่มี error ให้เห็น** (บั๊กเงียบที่ T57 ฝากไว้)
 *
 * ⚠️ studentId มาจากคุกกี้ dbq_student เท่านั้น ห้ามรับ id จาก body
 * ⚠️ route นี้ต้องเบาที่สุดในระบบ — เด็กทั้งห้องยิงเข้ามาทุก 30 วินาทีพร้อมกัน
 *    จึงไม่อ่านโปรไฟล์ ไม่อ่านคาบ ไม่เขียน event log มีแค่ UPDATE แถวเดียว
 * ⚠️ ไม่คืนข้อมูลของใครกลับไปเลย (คืนแค่ ok) กันไม่ให้กลายเป็นช่องส่องเพื่อน
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  /** หน้าที่เปิดอยู่ เช่น "/mission/m1" — ครูใช้ดูว่าเด็กค้างอยู่หน้าไหน (T-05) */
  screen: z.string().trim().max(64).optional(),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  // ไม่ใช่ 500 และไม่ใช่ ok — หน้าจอใช้ 401 เป็นสัญญาณให้ "หยุดเต้น" ถาวร
  // (หน้าที่ไม่ได้เข้าห้อง เช่น /join /teacher จะได้ไม่ยิงซ้ำทุก 30 วินาทีเปล่า ๆ)
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  const parsed = BodySchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'screen ต้องเป็นข้อความไม่เกิน 64 ตัวอักษร', 400)

  const screen = parsed.data.screen
  await touchStudentPresence(session.studentId, screen && screen.length > 0 ? screen : undefined)

  return NextResponse.json({ ok: true })
}

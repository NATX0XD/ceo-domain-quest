import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  type FlagLevel,
  getOwnedClassroom,
  listClassroomContentFlags,
  resolveContentFlag,
} from '@/lib/db/repo'
import { errorResponse, readJsonBody, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * ธงคำไม่เหมาะสมถึงแผงครู (E-11 ชั้นแจ้งครู)
 *
 * ⚠️ ครูเห็นข้อความเต็ม **เฉพาะระดับ 3** ระดับ 1-2 เห็นฉบับปิดบางส่วน — ฝั่ง SQL บังคับให้แล้ว
 *    ไฟล์นี้จึงห้ามไปดึง `original_text` เองเด็ดขาด ใช้ `text_for_teacher` ที่ RPC คืนมาอย่างเดียว
 * ⚠️ teacherId จาก cookie · RPC ตรวจเจ้าของห้องให้ในคิวรีเดียว
 *    แต่ RPC คืนลิสต์ว่างทั้งตอน "ไม่มีธง" และตอน "ไม่ใช่ห้องของครูคนนี้" — แยกไม่ออก
 *    จึงเช็กเจ้าของห้องก่อนแล้วตอบ 404 แบบเดียวกับ route ครูตัวอื่น (ไม่บอกว่าห้องนั้นมีจริงไหม)
 * ⚠️ "ดูแลแล้ว" = ปิดธง **ไม่ลบข้อความของนักเรียน**
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ResolveSchema = z.object({
  flagId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
})

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const url = new URL(request.url)
  const classroomId = url.searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  const owned = await getOwnedClassroom(session.teacherId, classroomId)
  if (!owned) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  /**
   * minLevel — ระดับต่ำสุดที่จะเอามาแสดง (1-3) ค่าตั้งต้น 1 = เหมือนเดิมทุกอย่าง
   * ใช้ตอนครูอยากดูเฉพาะเรื่องหนัก เช่น `?minLevel=3` ระหว่างคาบที่ยุ่ง
   * ค่าที่ส่งมานอกช่วงถูกบีบเข้ากรอบ ไม่ใช่ตอบ error เพราะไม่ใช่เรื่องคอขาดบาดตาย
   */
  const rawMinLevel = Number(url.searchParams.get('minLevel'))
  const minLevel = (
    Number.isFinite(rawMinLevel) ? Math.min(3, Math.max(1, Math.floor(rawMinLevel))) : 1
  ) as FlagLevel

  const since = url.searchParams.get('since') ?? undefined
  const flags = await listClassroomContentFlags(session.teacherId, classroomId, {
    minLevel,
    since,
  })

  return NextResponse.json({ ok: true, minLevel, flags, checkedAt: new Date().toISOString() })
}

export async function POST(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const parsed = ResolveSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง flagId')

  const resolved = await resolveContentFlag(session.teacherId, parsed.data.flagId, parsed.data.note)
  if (!resolved) return errorResponse('not-found', 'ไม่พบธงใบนี้ในห้องของคุณ', 404)

  return NextResponse.json({ ok: true, flagId: resolved.id })
}

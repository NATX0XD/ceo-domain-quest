import { NextResponse } from 'next/server'
import { z } from 'zod'
import { studentNicknameSchema } from '../../../lib/account-validation'
import { attempt } from '@/lib/rate-limit'
import { hashPin } from '@/lib/pin'
import { isValidRoomCode, normalizeRoomCode } from '@/lib/room-code'
import { signStudentSession } from '@/lib/session'
import { findOpenClassroomByCode, findStudentByNickname, logEvent } from '@/lib/db/repo'
import { moderateJoinNickname } from '@/components/server/moderation'
import {
  LEGACY_ROOM_JOIN_BURST,
  admitStudent,
  roomSpace,
} from '@/components/server/classroom-capacity'
import { attachStudentSession, errorResponse, readJsonBody } from '../_lib/session-cookie'

/**
 * นักเรียนเข้าห้องครั้งแรก — ออก session cookie httpOnly ให้เครื่องนั้น
 *
 * ⚠️ ห้ามรับ studentId จาก body เด็ดขาด เซิร์ฟเวอร์สร้างแถวเองแล้วผูกลง cookie
 *
 * เส้นนี้เป็นทางเดียวที่สร้างแถวนักเรียนใหม่ได้ และเปิดให้คนที่รู้รหัสห้อง 6 ตัวยิงได้เสมอ
 * จึงมีเกราะ 3 ชั้นซ้อนกัน (UAT-3 ช่องโหว่ข้อ 1) — ถอดชั้นใดชั้นหนึ่งออก อีกสองชั้นยังเอาไม่อยู่
 *   1. ตัวนับ 5 ครั้ง/10 นาที ต่อ (ห้อง + ชื่อเล่น) ที่ **ไม่ถูกล้างเมื่อเข้าสำเร็จ**
 *   2. เพดานจำนวนนักเรียนต่อห้อง (`components/server/classroom-capacity.ts`)
 *   3. ชื่อซ้ำ = ปฏิเสธให้ไปตั้งชื่อใหม่ **ไม่เติมเลขท้ายให้เงียบ ๆ**
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JoinSchema = z.object({
  roomCode: z.string().min(1),
  nickname: studentNicknameSchema,
  pin: z.string(),
})

export async function POST(request: Request) {
  const parsed = JoinSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', 'ต้องส่ง roomCode, nickname และ pin ให้ครบ')
  }

  const roomCode = normalizeRoomCode(parsed.data.roomCode)
  const nickname = parsed.data.nickname.trim()

  if (!isValidRoomCode(roomCode)) {
    return errorResponse('room-not-found', 'ไม่พบห้องนี้ หรือครูปิดห้องไปแล้ว', 404)
  }

  /**
   * กันยิงรัว — นับต่อ (รหัสห้อง + ชื่อเล่น) เหมือนฝั่ง resume
   *
   * ⚠️ **ห้ามล้างตัวนับเมื่อเข้าห้องสำเร็จ** เด็กคนหนึ่งเข้าห้องครั้งเดียวก็พอ
   * การเข้าสำเร็จรัว ๆ จากเครื่องเดียวด้วยชื่อเดิมไม่ใช่การใช้งานปกติ แต่คือสัญญาณที่ต้องจำกัด
   * (ของเดิมเรียก resetAttempts() ตรงนี้ ตัวนับจึงถูกล้างทุกครั้ง = ไม่มีเพดานเลย)
   */
  const limitKey = `join:${roomCode}:${nickname}`
  const limit = attempt(limitKey)
  if (!limit.allowed) {
    return errorResponse(
      'too-many-attempts',
      'ลองเข้าห้องถี่เกินไป รอสักครู่แล้วลองใหม่ ถ้าเข้าไม่ได้จริง ๆ บอกครูให้ช่วยนะ',
      429,
      { resetAt: limit.resetAt },
    )
  }

  const pin = parsed.data.pin.trim()
  let pinHash: string
  try {
    pinHash = await hashPin(pin)
  } catch {
    return errorResponse('bad-pin', 'รหัสต้องเป็นตัวเลข 4 หลักเท่านั้น')
  }

  const classroom = await findOpenClassroomByCode(roomCode)
  if (!classroom) {
    return errorResponse('room-not-found', 'ไม่พบห้องนี้ หรือครูปิดห้องไปแล้ว', 404)
  }

  /**
   * ชื่อซ้ำ = บอกให้เปลี่ยนเอง ไม่เติมเลขท้ายให้
   *
   * ของเดิมชนแล้วได้ "นัท2" อัตโนมัติ ผลคือ **ทุกคำขอสำเร็จเสมอ** ยิงชื่อเดิม 9 ครั้งได้นักเรียน 9 แถว
   * และเด็กที่พิมพ์ชื่อชนเพื่อนก็ไม่มีทางรู้ว่าตัวเองกลายเป็นชื่ออื่นไปแล้ว จนกว่าจะเห็นบนจอ
   * เช็กก่อนตรงนี้เพื่อให้ได้ข้อความที่อ่านรู้เรื่อง ส่วนกรณีสองเครื่องกดพร้อมกันเป๊ะ
   * `admitStudent()` ยังกันซ้ำอีกชั้นด้วย unique index ของฐานข้อมูล
   */
  if (await findStudentByNickname(classroom.id, nickname)) {
    return errorResponse(
      'nickname-taken',
      `ในห้องนี้มีคนใช้ชื่อ "${nickname}" แล้ว ถ้านี่คือชื่อของเธอเอง ให้กดสลับไปโหมด "เคยเข้าห้องแล้ว" แล้วใส่รหัส 4 หลักเดิม ถ้าไม่ใช่ ลองเติมชื่อให้ต่างออกไปอีกนิดนะ`,
      409,
      { field: 'nickname' },
    )
  }

  /**
   * เพดานจำนวนคนต่อห้อง — กันคนนอกยัดชื่อปลอมจนแผงครูใช้งานไม่ได้
   * นับเฉพาะตอนรับ "คนใหม่" คนที่อยู่ในห้องแล้วกลับเข้ามาใช้ `/api/join/resume` ซึ่งไม่ผ่านด่านนี้
   * ห้องที่คนเต็มอยู่แล้วจึงยังเรียนต่อได้ตามปกติทุกคน
   */
  const space = await roomSpace(classroom.id)
  if (space.legacyOverflow) {
    /**
     * ห้องที่มีคนเกินเพดานมาก่อนวันที่เพดานมีผล (ห้องเดโม/ห้องที่เคยใช้ทดสอบโหลด)
     * ล็อกทิ้งไม่ได้เพราะคนในห้องยังเรียนอยู่ จึงคุมด้วย "อัตราการรับคนใหม่" แทนเพดาน
     * ห้องที่เปิดหลังจากนี้ไม่มีทางมาถึงกิ่งนี้ — คนที่ทำให้ครบเพดานพอดีคือคนสุดท้ายที่เข้าได้
     */
    const burst = attempt(`join-room:${roomCode}`, Date.now(), LEGACY_ROOM_JOIN_BURST)
    if (!burst.allowed) {
      return errorResponse(
        'room-too-busy',
        'ตอนนี้มีคนเข้าห้องนี้พร้อมกันเยอะมาก รอสักครู่แล้วลองใหม่ ถ้ายังเข้าไม่ได้ให้บอกครู',
        429,
        { resetAt: burst.resetAt, capacity: space.capacity, count: space.count },
      )
    }
  } else if (space.full) {
    return errorResponse(
      'room-full',
      `ห้องนี้รับได้ ${space.capacity} คน และตอนนี้เต็มแล้ว บอกครูให้ช่วยดูรายชื่อในห้องก่อนนะ ถ้าเธอเคยเข้าห้องนี้แล้ว ให้กดสลับไปโหมด "เคยเข้าห้องแล้ว" ได้เลย`,
      409,
      { capacity: space.capacity, count: space.count },
    )
  }

  /**
   * ชื่อเล่นเป็นข้อความที่เด็กพิมพ์เอง และเพื่อนทั้งห้องเห็นบนผนังผลงาน จึงตรวจแบบ "เพื่อนเห็น"
   * ยังไม่มี studentId (ยังไม่ได้สร้างแถว) จึงผูกธงกับ **ห้อง** แทน ผ่าน RPC record_pre_join_content_flag
   * ครูจะได้เห็นว่ามีคนพยายามใช้ชื่อแบบนั้น แม้คำขอจะถูกปฏิเสธไปก่อนสร้างนักเรียน
   * ไม่ผ่าน = ไม่สร้างนักเรียน — คืนข้อความเดิมพร้อมเหตุผลให้พิมพ์ใหม่ ห้ามแก้ชื่อให้เงียบ ๆ
   */
  const nicknameCheck = await moderateJoinNickname(classroom.id, nickname)
  if (!nicknameCheck.ok) {
    return errorResponse(
      'content-flagged',
      nicknameCheck.message ?? 'ชื่อนี้ใช้ในห้องเรียนไม่ได้ ลองตั้งชื่ออื่นดูนะ',
      422,
      { field: 'nickname', original: nicknameCheck.original },
    )
  }

  const admitted = await admitStudent({
    classroomId: classroom.id,
    nickname,
    pinHash,
  })
  if (!admitted.ok) {
    // แพ้การชิงชื่อกับอีกเครื่องที่กดพร้อมกัน — ข้อความเดียวกับด่านเช็กชื่อซ้ำข้างบน
    return errorResponse(
      'nickname-taken',
      `ในห้องนี้มีคนใช้ชื่อ "${nickname}" แล้ว ถ้านี่คือชื่อของเธอเอง ให้กดสลับไปโหมด "เคยเข้าห้องแล้ว" แล้วใส่รหัส 4 หลักเดิม ถ้าไม่ใช่ ลองเติมชื่อให้ต่างออกไปอีกนิดนะ`,
      409,
      { field: 'nickname' },
    )
  }
  const student = admitted.student

  await logEvent(student.id, 'student.joined', { roomCode, nickname: student.nickname })

  const token = await signStudentSession({
    studentId: student.id,
    classroomId: classroom.id,
  })

  const response = NextResponse.json({
    ok: true,
    nickname: student.nickname,
    /** เลิกเติมเลขท้ายให้แล้ว ชื่อที่ได้จึงตรงกับที่พิมพ์มาเสมอ — คงช่องไว้ให้หน้าจอเดิมไม่พัง */
    renamed: false,
    roomCode: classroom.room_code,
    /** ที่ว่างที่เหลือหลังรับคนนี้เข้าไปแล้ว ใช้บอกครูว่าห้องใกล้เต็ม — null = ห้องเก่าที่เกินเพดานมาก่อน */
    seatsLeft: space.legacyOverflow ? null : Math.max(0, space.remaining - 1),
    capacity: space.capacity,
  })
  return attachStudentSession(response, token)
}

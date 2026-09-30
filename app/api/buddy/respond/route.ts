import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findMatch } from '@/core/buddy'
import { nextHelperToOffer } from '@/core/buddy-flow'
import {
  getBuddyCandidatesRaw,
  logEvent,
  offerBuddyRequest,
  respondBuddyOffer,
  touchStudentPresence,
} from '@/lib/db/repo'
import {
  classroomOf,
  getBuddyRequestById,
  isHomePhase,
  listOfferedHelperIds,
  nicknamesOf,
} from '../_lib/store'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../_lib/session-cookie'

/**
 * ผู้ช่วยกด "ช่วยได้" หรือ "ตอนนี้ไม่สะดวก" บนแผ่นคำขอของตัวเอง
 *
 * ⚠️ helperId มาจากคุกกี้เท่านั้น — `respond_buddy_offer` มี `helper_id` อยู่ในเงื่อนไข UPDATE
 *    ตอบแทนคนอื่นจึงคืน 0 แถว ไม่ใช่แค่เช็กที่ชั้นนี้
 * ⚠️ ปฏิเสธแล้ว **ต้องยิงต่อให้คนถัดไปทันที** ไม่งั้นผู้ขอจะค้างอยู่หน้าจอรอเฉย ๆ
 *    จนกว่าจะกดขอใหม่เอง ซึ่งขัดกับเป้า "หาเพื่อนที่เหมาะที่สุดได้ภายใน 10 วินาที"
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  offerId: z.string().uuid(),
  accept: z.boolean(),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง offerId กับ accept มาด้วย', 400)

  // ตอบแผ่นคำขอ = ยังนั่งอยู่จริง ต่อสัญญาณ "ใช้งานใน 60 วินาที" ให้ด้วยเลย
  await touchStudentPresence(session.studentId).catch(() => undefined)

  const offer = await respondBuddyOffer(session.studentId, parsed.data.offerId, parsed.data.accept)
  if (!offer) {
    return errorResponse(
      'offer-not-open',
      'แผ่นคำขอนี้หมดเวลาไปแล้ว หรือไม่ใช่คำขอที่ส่งมาหาเรา',
      409,
    )
  }

  const buddyRequest = await getBuddyRequestById(offer.request_id)
  const names = await nicknamesOf(buddyRequest ? [buddyRequest.requester_id] : [])
  const requesterNickname = buddyRequest ? (names[buddyRequest.requester_id] ?? 'เพื่อน') : 'เพื่อน'

  await logEvent(session.studentId, parsed.data.accept ? 'buddy-accepted' : 'buddy-declined', {
    requestId: offer.request_id,
    missionId: buddyRequest?.mission_id ?? null,
  }).catch(() => undefined)

  if (parsed.data.accept) {
    return NextResponse.json({
      ok: true,
      accepted: true,
      missionId: buddyRequest?.mission_id ?? null,
      requesterNickname,
      message: `ไปช่วย ${requesterNickname} ได้เลย อธิบายด้วยคำของเราเองก็พอ ไม่ต้องบอกคำตอบตรง ๆ`,
    })
  }

  /**
   * ปฏิเสธแล้วยิงต่อให้คนถัดไป — SQL ตั้งใบกลับเป็น 'searching' ให้เองเมื่อยังไม่ครบ 3 ครั้ง
   * ครบ 3 ครั้งแล้วใบจะเป็น 'no-helper' ตรงนั้นผู้ขอจะได้การ์ดคู่คิดกับปุ่มเรียกครูแทน
   */
  let passedOn = false
  if (buddyRequest && buddyRequest.status === 'searching') {
    const classroomId = await classroomOf(buddyRequest.requester_id)
    const atHome = classroomId ? await isHomePhase(classroomId) : false
    const candidates = await getBuddyCandidatesRaw(
      buddyRequest.requester_id,
      buddyRequest.mission_id,
    ).catch(() => [])

    const match = findMatch(
      { studentId: buddyRequest.requester_id, missionId: buddyRequest.mission_id, atHome },
      candidates,
    )
    const offered = await listOfferedHelperIds(buddyRequest.id)

    for (let i = 0; i < match.queue.length; i += 1) {
      const next = nextHelperToOffer({
        queue: match.queue,
        alreadyOffered: offered,
        attempts: buddyRequest.attempts + i,
      })
      if (!next.ok) break

      const sentOffer = await offerBuddyRequest(
        buddyRequest.id,
        next.helper.studentId,
        next.helper.score,
      )
      offered.push(next.helper.studentId)
      if (sentOffer) {
        passedOn = true
        break
      }
    }
  }

  return NextResponse.json({
    ok: true,
    accepted: false,
    /** ส่งต่อให้เพื่อนคนถัดไปแล้วหรือยัง — ผู้ช่วยที่ปฏิเสธไม่ต้องรู้สึกว่าตัวเองทำเพื่อนค้าง */
    passedOn,
    message: passedOn
      ? 'ไม่เป็นไร ระบบถามเพื่อนคนถัดไปให้แล้ว'
      : 'ไม่เป็นไร ตอนนี้ยังไม่มีเพื่อนคนอื่นว่าง ระบบจะให้เขาเรียกครูแทน',
  })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findMatch } from '@/core/buddy'
import { matchHeadline, nextHelperToOffer, shouldOpenRequest } from '@/core/buddy-flow'
import {
  cancelBuddyRequest,
  createBuddyRequest,
  expireBuddyOffers,
  getBuddyCandidatesRaw,
  getOpenBuddyRequest,
  getStudent,
  listPendingBuddyOffers,
  logEvent,
  offerBuddyRequest,
  touchStudentPresence,
  MISSION_TARGETS,
} from '@/lib/db/repo'
import {
  classroomOf,
  getAcceptedRequestForHelper,
  getBuddyRequestById,
  getPendingOfferOfRequest,
  isHomePhase,
  listOfferedHelperIds,
  nicknamesOf,
  secondsLeft,
} from './_lib/store'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * E-04 / S-41 ขอคู่หู — ปิดวงจร "ขอ → เพื่อนเห็นบนเครื่องตัวเอง → กดรับ → รู้ทั้งสองฝั่ง"
 *
 * ⚠️ studentId มาจากคุกกี้ dbq_student เท่านั้น ห้ามเชื่อ id จาก body
 *    ผู้ช่วยข้ามห้องเป็นไปไม่ได้ 2 ชั้น: `buddy_candidates_raw` join ที่ห้องของผู้ขอ
 *    และ `offer_buddy_request` ตรวจห้องซ้ำอีกครั้งในคำสั่งเดียวกับที่เขียน
 * ⚠️ เกณฑ์คัดและตารางคะแนนอยู่ที่ `core/buddy.ts` ที่เดียว ห้ามคิดคะแนนซ้ำที่นี่หรือใน SQL
 * ⚠️ ไม่มีใครเข้าเกณฑ์ = **ไม่เปิดใบคำขอ** แต่คืนการ์ดคู่คิดกับปุ่มเรียกครูเสมอ ห้ามปล่อยจอค้าง
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AskSchema = z.object({
  missionId: z.enum(MISSION_TARGETS),
})

/** สิ่งที่หน้าจอของผู้ขอต้องรู้ — ไม่มี id ของเพื่อนคนอื่นหลุดออกไป มีแต่ชื่อเล่น */
async function requesterView(requestId: string) {
  const request = await getBuddyRequestById(requestId)
  if (!request) return null

  const offer = await getPendingOfferOfRequest(requestId)
  const ids = [request.helper_id, offer?.helper_id].filter((v): v is string => Boolean(v))
  const names = await nicknamesOf(ids)

  return {
    id: request.id,
    missionId: request.mission_id,
    kind: request.kind,
    status: request.status,
    attempts: request.attempts,
    /** เพื่อนที่รับปากแล้ว (status = accepted) */
    helperNickname: request.helper_id ? (names[request.helper_id] ?? null) : null,
    /** เพื่อนที่กำลังถูกถามอยู่ตอนนี้ ยังไม่ตอบ */
    waitingFor: offer
      ? { nickname: names[offer.helper_id] ?? 'เพื่อน', secondsLeft: secondsLeft(offer.expires_at) }
      : null,
    createdAt: request.created_at,
  }
}

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = AskSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return errorResponse('bad-request', `missionId ต้องเป็นหนึ่งใน ${MISSION_TARGETS.join(' ')}`, 400)
  }
  const missionId = parsed.data.missionId

  const classroomId = await classroomOf(session.studentId)
  if (!classroomId) return errorResponse('student-not-found', 'ไม่พบที่นั่งของผู้เรียนคนนี้', 404)

  // เก็บกวาดใบที่เพื่อนไม่ตอบใน 60 วินาทีก่อน ไม่งั้นใบค้างจะกันไม่ให้ยิงคนถัดไป
  await expireBuddyOffers().catch(() => 0)
  await touchStudentPresence(session.studentId).catch(() => undefined)

  const [existing, atHome, candidates] = await Promise.all([
    getOpenBuddyRequest(session.studentId),
    isHomePhase(classroomId),
    getBuddyCandidatesRaw(session.studentId, missionId).catch(() => []),
  ])

  /**
   * ใบเดิมที่ยัง "หาอยู่" แต่ไม่มีใครค้างตอบ = เพื่อนคนก่อนหมดเวลาหรือปฏิเสธไปแล้ว
   *
   * กรณีนี้ต้อง **ยิงต่อบนใบเดิม** ไม่ใช่ตอบว่า "มีใบค้างอยู่แล้ว" แล้วจบ
   * ถ้าตอบแบบนั้นผู้เรียนจะค้างอยู่หน้าจอถาวร กดขอใหม่ก็ไม่ได้เพราะติดกติกาใบละ 1 ใบ
   */
  const livePendingOffer = existing ? await getPendingOfferOfRequest(existing.id) : null
  const resumable =
    existing !== null &&
    existing.status === 'searching' &&
    livePendingOffer === null &&
    existing.mission_id === missionId

  const match = findMatch(
    {
      studentId: session.studentId,
      missionId,
      hasOpenRequest: Boolean(existing) && !resumable,
      atHome,
    },
    candidates,
  )

  // มีใบค้างที่ยังเดินอยู่จริง — คืนสถานะใบเดิมไปให้ดู ไม่เปิดใบใหม่ (กติกา E-04: ครั้งละ 1 ใบ)
  if (match.blockedByOpenRequest && existing) {
    return NextResponse.json({
      ok: true,
      kind: existing.kind,
      headline:
        existing.mission_id === missionId
          ? matchHeadline(match)
          : `ยังมีคำขอค้างอยู่ที่ ${existing.mission_id} ปิดใบนั้นก่อนถึงจะขอเรื่องใหม่ได้`,
      request: await requesterView(existing.id),
      showCard: false,
      teacherHelpAvailable: true,
      consideredCount: match.consideredCount,
    })
  }

  /**
   * ไม่มีใครเข้าเกณฑ์เลย (อยู่คนเดียวในห้อง / เพื่อนติดด่านบอสกันหมด / ช่วงทำต่อที่บ้าน)
   * ต้องได้การ์ดคู่คิดกับปุ่มเรียกครูทันที **ไม่เปิดใบคำขอ** เพราะใบเปล่าจะกินโควตา 1 ใบ
   * แล้วผู้เรียนจะกดขอใหม่ตอนเพื่อนว่างไม่ได้
   */
  if (!shouldOpenRequest(match)) {
    /**
     * ใบเดิมที่หาต่อไม่ได้แล้วต้องปิด ไม่ใช่ทิ้งค้าง — ไม่งั้นผู้เรียนจะติดกติกา "ใบละ 1 ใบ"
     * ไปตลอดคาบ ทั้งที่หน้าจอบอกให้ไปเรียกครูแล้ว
     */
    if (resumable && existing) {
      await cancelBuddyRequest(session.studentId, existing.id).catch(() => null)
    }

    await logEvent(session.studentId, 'buddy-no-match', {
      missionId,
      consideredCount: match.consideredCount,
      atHome,
    }).catch(() => undefined)

    return NextResponse.json({
      ok: true,
      kind: 'card',
      headline: matchHeadline(match),
      request: null,
      showCard: true,
      teacherHelpAvailable: true,
      consideredCount: match.consideredCount,
      reason: match.reason,
    })
  }

  // ใบเดิมที่หาต่อได้ ใช้ใบเดิม ไม่เปิดใบใหม่ — จำนวนครั้งที่ถามเพื่อนจะได้นับต่อเนื่องถูกต้อง
  const opened = resumable
    ? existing
    : await createBuddyRequest(session.studentId, missionId, match.kind as 'buddy' | 'thinking-partner')
  // ใบชนกับใบที่เพิ่งเปิดจากการกดรัว — ใช้ใบที่มีอยู่แล้ว ไม่ถือเป็นข้อผิดพลาด
  const openRequest = opened ?? (await getOpenBuddyRequest(session.studentId))
  if (!openRequest) {
    return errorResponse('buddy-request-failed', 'เปิดคำขอไม่สำเร็จ ลองกดใหม่อีกครั้ง', 503)
  }

  /**
   * ยิงคำขอ **ทีละคน** ตามลำดับของ core — คนแรกที่ยิงสำเร็จคือคนที่รอคำตอบ
   * วนต่อเมื่อ RPC คืนค่าว่าง (เคยยิงคนนี้ไปแล้วในใบเดียวกัน) ไม่ใช่วนยิงทุกคนรวดเดียว
   */
  const offered = await listOfferedHelperIds(openRequest.id)
  let sentTo: string | null = null
  for (let i = 0; i < match.queue.length; i += 1) {
    const next = nextHelperToOffer({
      queue: match.queue,
      alreadyOffered: offered,
      attempts: openRequest.attempts + i,
    })
    if (!next.ok) break

    const offer = await offerBuddyRequest(openRequest.id, next.helper.studentId, next.helper.score)
    offered.push(next.helper.studentId)
    if (offer) {
      sentTo = next.helper.nickname
      break
    }
  }

  await logEvent(session.studentId, 'buddy-requested', {
    missionId,
    kind: match.kind,
    requestId: openRequest.id,
    resumed: resumable,
    sent: sentTo !== null,
  }).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    kind: match.kind,
    // บอกชื่อคนที่ถูกถามจริง ไม่ใช่คนแรกของลำดับ — ตอนยิงต่อคนที่ 2/3 สองชื่อนี้ไม่ตรงกัน
    headline:
      sentTo !== null
        ? matchHeadline(match, sentTo)
        : 'เพิ่งถามเพื่อนไปแล้วรอบหนึ่ง รออีกครู่นะ ระหว่างรอทำข้อต่อไปได้เลย',
    request: await requesterView(openRequest.id),
    showCard: false,
    teacherHelpAvailable: true,
    consideredCount: match.consideredCount,
  })
}

/**
 * สถานะคู่หูของผู้เรียนคนนี้ — หน้าจอ poll ตัวนี้ตัวเดียวพอ ได้ทั้ง 2 บทบาท
 * `myRequest` = ใบที่ตัวเองขอ · `incoming` = แผ่นคำขอที่เพื่อนส่งมารอเราตอบ
 */
export async function GET(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  await expireBuddyOffers().catch(() => 0)

  /**
   * เกณฑ์ E-04 คือ "ใช้งานใน 60 วินาทีที่ผ่านมา" ซึ่งอ่านจาก `students.last_seen_at`
   * หน้าจอที่มีแผงคู่หู poll ตัวนี้ทุก 4 วินาที การ poll จึงเป็นสัญญาณว่ายังนั่งอยู่จริง
   * ⚠️ ถ้าไม่ต่อตรงนี้ จะไม่มีใครใน 'buddy_candidates_raw' ผ่านเกณฑ์เลยสักคน เพราะ
   *    `touch_student_presence` ยังไม่มีผู้เรียกที่อื่นในโปรเจกต์ (ดู result-t57.md ข้อค้าง)
   */
  const screen = new URL(request.url).searchParams.get('screen')
  await touchStudentPresence(session.studentId, screen ?? undefined).catch(() => undefined)

  const [open, offers, helpingRequest, student] = await Promise.all([
    getOpenBuddyRequest(session.studentId),
    listPendingBuddyOffers(session.studentId),
    getAcceptedRequestForHelper(session.studentId),
    getStudent(session.studentId),
  ])

  // แผ่นคำขอบนเครื่องเพื่อน ต้องบอกให้ครบว่าใครขอ เรื่องอะไร เหลือเวลาเท่าไร
  const requests = await Promise.all(offers.map((offer) => getBuddyRequestById(offer.request_id)))
  const requesterIds = requests.filter(Boolean).map((r) => r!.requester_id)
  if (helpingRequest) requesterIds.push(helpingRequest.requester_id)
  const names = await nicknamesOf(requesterIds)

  const incoming = offers
    .map((offer, index) => {
      const req = requests[index]
      if (!req) return null
      return {
        offerId: offer.id,
        missionId: req.mission_id,
        kind: req.kind,
        requesterNickname: names[req.requester_id] ?? 'เพื่อน',
        secondsLeft: secondsLeft(offer.expires_at),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  return NextResponse.json({
    ok: true,
    myRequest: open ? await requesterView(open.id) : null,
    incoming,
    /** ใบที่เรารับปากช่วยแล้วและยังไม่จบ — ผู้ช่วยต้องเห็นว่ากำลังช่วยใครอยู่ */
    helping: helpingRequest
      ? {
          id: helpingRequest.id,
          missionId: helpingRequest.mission_id,
          requesterNickname: names[helpingRequest.requester_id] ?? 'เพื่อน',
        }
      : null,
    /** ตราพี่เลี้ยง — ช่วยเพื่อนไปแล้วกี่ครั้งในคาบนี้ (ไม่ใช่ดาว ไม่เอาไปเทียบกับเพื่อน) */
    helpedCount: student?.buddy_helped_count ?? 0,
  })
}

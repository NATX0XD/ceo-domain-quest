/**
 * E-04 ตรรกะจับคู่คู่หูและคู่คิด — ตรรกะล้วน ไม่แตะฐานข้อมูล ไม่เรียก Date.now()
 *
 * **คู่หู** = เพื่อนที่ผ่านภารกิจนั้นแล้ว มาช่วยอธิบาย
 * **คู่คิด** = เพื่อนที่กำลังทำภารกิจเดียวกันอยู่ ใช้เมื่อยังไม่มีใครผ่าน ชวนกันคิดไปด้วยกัน
 *
 * เป้าของฟีเจอร์นี้ตามสเปก: หาเพื่อนที่เหมาะที่สุดได้ภายใน 10 วินาที
 * และ **กระจายภาระ ไม่ให้คนเก่งคนเดียวถูกขอตลอดคาบ** (จึงมีคะแนนลบตามจำนวนครั้งที่ช่วยไปแล้ว)
 *
 * ⚠️ สเปกเขียนว่า "ถ้าคะแนนเท่ากันสุ่ม" แต่โจทย์ของงานนี้กำหนดว่าห้ามสุ่ม
 * ไฟล์นี้จึงตัดสินคะแนนเท่ากันด้วยลำดับคงที่แทน: ช่วยเพื่อนมาน้อยกว่าได้ก่อน แล้วจึงเรียงตามรหัสนักเรียน
 * ผลจึงเหมือนเดิมทุกครั้งที่เรียกด้วยข้อมูลชุดเดิม ตรวจย้อนได้ และเทสต์ได้จริง
 * ข้อดีเพิ่มเติมคือเกณฑ์ตัวแรกช่วยกระจายภาระได้ตรงกว่าการสุ่ม
 */

/** สถานะของภารกิจที่เพื่อนคนหนึ่งมีต่อภารกิจที่ผู้ขอกำลังติดอยู่ */
export type MissionStanding =
  /** เล่นผ่านแล้ว */
  | 'passed'
  /** ข้ามเพราะตอบถูกและมั่นใจตั้งแต่ตอนเช็กความเข้าใจ */
  | 'skipped-confident'
  /** กำลังทำภารกิจนี้อยู่ */
  | 'in-progress'
  /** ยังไม่ได้เริ่ม */
  | 'not-started'

export interface BuddyCandidate {
  studentId: string
  nickname: string
  /** สถานะของเพื่อนคนนี้ต่อภารกิจที่ผู้ขอติดอยู่ */
  standing: MissionStanding
  /** ดาวที่ได้จากภารกิจนั้น ใช้เฉพาะเมื่อ standing เป็น passed */
  stars?: number
  /** ใช้งานล่าสุดเมื่อกี่วินาทีที่แล้ว ต้องไม่เกิน 60 วินาที */
  idleSeconds: number
  /** กำลังอยู่ในด่านบอสหรือไม่ — อยู่แล้วห้ามรบกวน */
  inBigMission?: boolean
  /** กดปุ่มเรียกครูค้างไว้หรือไม่ — รอครูอยู่ ห้ามรบกวน */
  waitingForTeacher?: boolean
  /** เปิดรับคำขอคู่หูไว้หรือไม่ ค่าเริ่มต้นคือเปิด */
  acceptingRequests?: boolean
  /** กำลังช่วยเพื่อนอยู่กี่คนตอนนี้ */
  helpingNow?: number
  /** ช่วยเพื่อนไปแล้วกี่ครั้งในคาบนี้ ใช้กระจายภาระ */
  helpedCount?: number
  /** ชอบเรียนกับเพื่อนหรือไม่ (ช่องทาง buddy / talk) */
  likesTalking?: boolean
  /** โซนที่นั่งตามผังที่ครูกำหนด ไม่มีผังก็เว้นว่างได้ */
  seatZone?: string | null
  /** รหัสคู่ที่จับอยู่แล้ว ถ้ามีค่าแปลว่าไม่ว่าง (ใช้กับคู่คิด) */
  pairedWith?: string | null
  /** ปฏิเสธผู้ขอคนไหนไปเมื่อกี่วินาทีที่แล้ว เช่น { 'stu-3': 120 } */
  declinedRequesters?: Record<string, number>
}

export interface BuddyRequest {
  studentId: string
  /** ภารกิจที่กำลังติด */
  missionId: string
  /** โซนที่นั่งของผู้ขอ ใช้ให้คะแนนคนที่นั่งโซนเดียวกัน */
  seatZone?: string | null
  /** ผู้ขอมีคำขอที่ยังไม่จบค้างอยู่หรือไม่ — มีได้ครั้งละ 1 คำขอ */
  hasOpenRequest?: boolean
  /** ตอนนี้อยู่ในช่วงทำต่อที่บ้านหรือไม่ — ถ้าใช่ ข้ามขั้นจับคู่ทันที */
  atHome?: boolean
}

/** คะแนนตามตารางในสเปก E-04 อ่านค่าได้จากที่นี่ที่เดียว */
export const BUDDY_SCORE = {
  passedThreeStars: 3,
  skippedConfident: 2,
  passedTwoStars: 1,
  likesTalking: 1,
  sameSeatZone: 1,
  helpedBefore: -1,
} as const

/** เพื่อนต้องใช้งานอยู่ในช่วงกี่วินาทีที่ผ่านมา */
export const ACTIVE_WITHIN_SECONDS = 60
/** ช่วงเวลาที่การปฏิเสธยังมีผล */
export const DECLINE_COOLDOWN_SECONDS = 5 * 60
/** ช่วยเพื่อนพร้อมกันได้ไม่เกินกี่คน */
export const MAX_HELPING_NOW = 2
/** ส่งคำขอทีละคน ลองได้สูงสุดกี่คน */
export const MAX_REQUEST_ATTEMPTS = 3

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export interface Ineligible {
  studentId: string
  /** เหตุผลที่ไม่เข้าเกณฑ์ ใช้ตอบครูได้ว่าทำไมไม่จับคู่กับคนนี้ */
  reason: string
}

/**
 * ผู้ที่เป็นคู่หูได้ต้องครบทุกข้อตามสเปก
 * คืนเหตุผลเมื่อไม่ผ่าน เพื่อให้ตรวจย้อนได้ว่าตัดใครออกเพราะอะไร
 */
export function buddyIneligibleReason(
  candidate: BuddyCandidate,
  request: BuddyRequest,
): string | null {
  if (candidate.studentId === request.studentId) return 'เป็นตัวผู้ขอเอง'
  if (finite(candidate.idleSeconds, Number.POSITIVE_INFINITY) > ACTIVE_WITHIN_SECONDS) {
    return `ไม่ได้ใช้งานในช่วง ${ACTIVE_WITHIN_SECONDS} วินาทีที่ผ่านมา`
  }
  if (candidate.standing !== 'passed' && candidate.standing !== 'skipped-confident') {
    return 'ยังไม่ผ่านภารกิจนี้'
  }
  if (candidate.inBigMission) return 'กำลังอยู่ในด่านบอส'
  if (candidate.waitingForTeacher) return 'กำลังรอครูจากปุ่มเรียกครู'
  if (candidate.acceptingRequests === false) return 'ปิดรับคำขอคู่หูไว้'
  if (finite(candidate.helpingNow) >= MAX_HELPING_NOW) {
    return `กำลังช่วยเพื่อนอยู่ ${finite(candidate.helpingNow)} คนแล้ว`
  }
  const declinedAt = candidate.declinedRequesters?.[request.studentId]
  if (typeof declinedAt === 'number' && declinedAt <= DECLINE_COOLDOWN_SECONDS) {
    return 'เพิ่งปฏิเสธผู้ขอคนนี้ไปไม่ถึง 5 นาที'
  }
  return null
}

/** คะแนนของผู้ที่ผ่านเกณฑ์แล้ว ตามตารางในสเปก */
export function buddyScore(candidate: BuddyCandidate, request: BuddyRequest): number {
  let score = 0

  if (candidate.standing === 'passed') {
    const stars = finite(candidate.stars)
    if (stars >= 3) score += BUDDY_SCORE.passedThreeStars
    else if (stars >= 2) score += BUDDY_SCORE.passedTwoStars
  } else if (candidate.standing === 'skipped-confident') {
    score += BUDDY_SCORE.skippedConfident
  }

  if (candidate.likesTalking) score += BUDDY_SCORE.likesTalking
  // ให้คะแนนโซนที่นั่งเฉพาะเมื่อครูกำหนดผังไว้จริงทั้งสองฝั่ง
  if (request.seatZone && candidate.seatZone && request.seatZone === candidate.seatZone) {
    score += BUDDY_SCORE.sameSeatZone
  }
  score += finite(candidate.helpedCount) * BUDDY_SCORE.helpedBefore

  return score
}

export interface RankedCandidate {
  studentId: string
  nickname: string
  score: number
  /** เหตุผลที่เลือกคนนี้ ใช้แสดงให้ครูดูและตอบคำถาม "ทำไมถึงเป็นคนนี้" */
  reason: string
}

function buddyReason(candidate: BuddyCandidate, request: BuddyRequest, score: number): string {
  const parts: string[] = []
  if (candidate.standing === 'passed') parts.push(`ผ่านภารกิจนี้แล้ว ได้ ${finite(candidate.stars)} ดาว`)
  else parts.push('ข้ามภารกิจนี้เพราะตอบถูกตั้งแต่ตอนเช็ก')
  if (candidate.likesTalking) parts.push('ชอบเรียนกับเพื่อน')
  if (request.seatZone && candidate.seatZone === request.seatZone) parts.push('นั่งโซนเดียวกัน')
  const helped = finite(candidate.helpedCount)
  if (helped > 0) parts.push(`ช่วยเพื่อนไปแล้ว ${helped} ครั้งในคาบนี้`)
  return `${parts.join(' · ')} (คะแนน ${score})`
}

/**
 * เรียงผู้สมัครเป็นคู่หูจากเหมาะที่สุดลงมา
 * คะแนนเท่ากันเรียงด้วยลำดับคงที่: ช่วยมาน้อยกว่าได้ก่อน แล้วจึงเรียงตามรหัสนักเรียน
 */
function rankBuddies(candidates: BuddyCandidate[], request: BuddyRequest): RankedCandidate[] {
  return candidates
    .map((c) => ({ candidate: c, score: buddyScore(c, request) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        finite(a.candidate.helpedCount) - finite(b.candidate.helpedCount) ||
        a.candidate.studentId.localeCompare(b.candidate.studentId),
    )
    .map(({ candidate, score }) => ({
      studentId: candidate.studentId,
      nickname: candidate.nickname,
      score,
      reason: buddyReason(candidate, request, score),
    }))
}

export type MatchKind = 'buddy' | 'thinking-partner' | 'card'

export interface MatchResult {
  kind: MatchKind
  /** คนที่ถูกเลือกเป็นอันดับแรก null เมื่อไม่มีใครเลย */
  chosen: RankedCandidate | null
  /**
   * ลำดับผู้ที่จะถูกขอ ส่งคำขอทีละคนตามลำดับนี้ สูงสุด 3 คน (สเปก S-41)
   * ถ้าคนแรกปฏิเสธ ผู้เรียกใช้คนถัดไปได้เลยโดยไม่ต้องคำนวณใหม่
   */
  queue: RankedCandidate[]
  /** จำนวนคนที่พิจารณาทั้งหมด */
  consideredCount: number
  /** คนที่ถูกตัดออก พร้อมเหตุผล ใช้ตรวจย้อนและทำแผงครู */
  ineligible: Ineligible[]
  /** คำอธิบายผลโดยรวมเป็นภาษาไทย */
  reason: string
  /** ต้องแสดงการ์ดคู่คิดให้ลองอธิบายเองพร้อมปุ่มเรียกครูหรือไม่ */
  showCard: boolean
  /** ผู้ขอมีคำขอค้างอยู่แล้วหรือไม่ — มีได้ครั้งละ 1 คำขอ */
  blockedByOpenRequest: boolean
}

/**
 * ผู้ที่เป็นคู่คิดได้ — กำลังทำภารกิจเดียวกันอยู่ และไม่ได้อยู่ในคู่อื่น
 * ไม่ต้องผ่านภารกิจ เพราะจุดประสงค์คือช่วยกันคิด ไม่ใช่มาสอน
 */
export function thinkingPartnerIneligibleReason(
  candidate: BuddyCandidate,
  request: BuddyRequest,
): string | null {
  if (candidate.studentId === request.studentId) return 'เป็นตัวผู้ขอเอง'
  if (finite(candidate.idleSeconds, Number.POSITIVE_INFINITY) > ACTIVE_WITHIN_SECONDS) {
    return `ไม่ได้ใช้งานในช่วง ${ACTIVE_WITHIN_SECONDS} วินาทีที่ผ่านมา`
  }
  if (candidate.standing !== 'in-progress') return 'ไม่ได้ทำภารกิจเดียวกันอยู่'
  if (candidate.pairedWith) return 'อยู่ในคู่อื่นแล้ว'
  if (candidate.inBigMission) return 'กำลังอยู่ในด่านบอส'
  if (candidate.waitingForTeacher) return 'กำลังรอครูจากปุ่มเรียกครู'
  if (candidate.acceptingRequests === false) return 'ปิดรับคำขอไว้'
  const declinedAt = candidate.declinedRequesters?.[request.studentId]
  if (typeof declinedAt === 'number' && declinedAt <= DECLINE_COOLDOWN_SECONDS) {
    return 'เพิ่งปฏิเสธผู้ขอคนนี้ไปไม่ถึง 5 นาที'
  }
  return null
}

/**
 * เรียงคู่คิด — ให้ความสำคัญกับคนที่ชอบเรียนกับเพื่อนก่อน ตามสเปก
 * คะแนนเท่ากันเรียงตามรหัสนักเรียน ผลคงที่ทุกครั้ง
 */
function rankThinkingPartners(
  candidates: BuddyCandidate[],
  request: BuddyRequest,
): RankedCandidate[] {
  return candidates
    .map((c) => ({
      candidate: c,
      score: (c.likesTalking ? BUDDY_SCORE.likesTalking : 0) +
        (request.seatZone && c.seatZone === request.seatZone ? BUDDY_SCORE.sameSeatZone : 0),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.studentId.localeCompare(b.candidate.studentId))
    .map(({ candidate, score }) => ({
      studentId: candidate.studentId,
      nickname: candidate.nickname,
      score,
      reason: `กำลังทำภารกิจเดียวกันอยู่${candidate.likesTalking ? ' · ชอบเรียนกับเพื่อน' : ''} (คะแนน ${score})`,
    }))
}

/**
 * หาคู่ให้ผู้ขอหนึ่งคน — ลำดับการหาตามสเปก E-04
 *
 * 1. หาคู่หู (เพื่อนที่ผ่านภารกิจนั้นแล้ว)
 * 2. ไม่มีคู่หู ให้หาคู่คิด (เพื่อนที่กำลังทำภารกิจเดียวกัน และไม่ได้อยู่ในคู่อื่น)
 * 3. ไม่มีทั้งคู่ ให้แสดงการ์ดคู่คิดพร้อมปุ่มเรียกครู
 * 4. ช่วงทำต่อที่บ้าน ข้ามขั้นจับคู่ทันที
 *
 * **ผลคงที่ทุกครั้ง ไม่มีการสุ่ม** เรียกซ้ำด้วยข้อมูลชุดเดิมได้คำตอบเดิมเสมอ
 */
export function findMatch(
  request: BuddyRequest,
  candidates: readonly BuddyCandidate[] = [],
): MatchResult {
  const list = (Array.isArray(candidates) ? candidates : []).filter(
    (c): c is BuddyCandidate => Boolean(c?.studentId),
  )

  const empty: MatchResult = {
    kind: 'card',
    chosen: null,
    queue: [],
    consideredCount: list.length,
    ineligible: [],
    reason: '',
    showCard: true,
    blockedByOpenRequest: false,
  }

  // ทำต่อที่บ้าน ไม่มีเพื่อนอยู่ในห้องให้ขอ ข้ามไปการ์ดคู่คิดทันที
  if (request?.atHome) {
    return { ...empty, reason: 'ช่วงทำต่อที่บ้าน ข้ามการจับคู่ ไปที่การ์ดคู่คิดแทน' }
  }

  // ผู้ขอมีคำขอค้างอยู่แล้ว ต้องปิดอันเดิมก่อน (สเปก: ครั้งละ 1 คำขอ)
  if (request?.hasOpenRequest) {
    return {
      ...empty,
      reason: 'ผู้ขอมีคำขอคู่หูที่ยังไม่จบอยู่แล้ว ขอใหม่ได้เมื่อคำขอเดิมจบ',
      showCard: false,
      blockedByOpenRequest: true,
    }
  }

  const ineligible: Ineligible[] = []
  const eligibleBuddies: BuddyCandidate[] = []
  for (const candidate of list) {
    const reason = buddyIneligibleReason(candidate, request)
    if (reason) ineligible.push({ studentId: candidate.studentId, reason })
    else eligibleBuddies.push(candidate)
  }

  if (eligibleBuddies.length > 0) {
    const ranked = rankBuddies(eligibleBuddies, request)
    const queue = ranked.slice(0, MAX_REQUEST_ATTEMPTS)
    return {
      kind: 'buddy',
      chosen: queue[0] ?? null,
      queue,
      consideredCount: list.length,
      ineligible,
      reason: `พบคู่หู ${ranked.length} คน ส่งคำขอทีละคนได้สูงสุด ${queue.length} คน`,
      showCard: false,
      blockedByOpenRequest: false,
    }
  }

  // ไม่มีคู่หู หาคู่คิดแทน
  const eligiblePartners = list.filter(
    (candidate) => thinkingPartnerIneligibleReason(candidate, request) === null,
  )

  if (eligiblePartners.length > 0) {
    const ranked = rankThinkingPartners(eligiblePartners, request)
    const queue = ranked.slice(0, MAX_REQUEST_ATTEMPTS)
    return {
      kind: 'thinking-partner',
      chosen: queue[0] ?? null,
      queue,
      consideredCount: list.length,
      ineligible,
      reason: `ยังไม่มีใครผ่านภารกิจนี้ จึงชวนเพื่อนที่กำลังทำอยู่ด้วยกัน ${ranked.length} คน มาเป็นคู่คิด`,
      showCard: false,
      blockedByOpenRequest: false,
    }
  }

  return {
    ...empty,
    ineligible,
    reason:
      list.length === 0
        ? 'ยังไม่มีเพื่อนคนอื่นอยู่ในห้องตอนนี้ แสดงการ์ดคู่คิดและปุ่มเรียกครูแทน'
        : 'ตอนนี้ยังไม่มีทั้งคู่หูและคู่คิดที่ว่าง แสดงการ์ดคู่คิดและปุ่มเรียกครูแทน',
  }
}

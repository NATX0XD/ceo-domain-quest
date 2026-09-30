/**
 * E-04 / S-41 ขั้นตอนการยิงคำขอคู่หูทีละคน — ตรรกะล้วน ไม่แตะฐานข้อมูล ไม่เรียก Date.now()
 *
 * `core/buddy.ts` ตอบว่า "ใครเหมาะบ้าง เรียงยังไง" แล้วจบ
 * ไฟล์นี้ตอบคำถามถัดมาที่ route ต้องใช้จริง: **คนที่ยิงไปแล้วไม่ยิงซ้ำ และครบ 3 คนแล้วต้องหยุด**
 * แยกออกมาเพราะข้อมูล "ยิงไปหาใครแล้วบ้าง" อยู่ในตาราง `buddy_offers` ไม่ได้อยู่ใน MatchResult
 *
 * กติกาเดียวกับฝั่ง SQL: `offer_buddy_request` ปฏิเสธเองเมื่อ attempts ครบ 3 หรือเคยยิงคนนี้ไปแล้ว
 * ที่นี่ตัดสินก่อนถึงฐานข้อมูล จะได้บอกผู้เรียนได้ว่าเพราะอะไร ไม่ใช่เงียบไปเฉย ๆ
 */
import { MAX_REQUEST_ATTEMPTS, type MatchResult, type RankedCandidate } from './buddy'

export interface NextOfferInput {
  /** ลำดับผู้ช่วยจาก `findMatch()` — เรียงมาแล้ว ห้ามเรียงใหม่ */
  queue: readonly RankedCandidate[]
  /** รหัสคนที่ยิงคำขอไปแล้วในใบนี้ (รวมคนที่ปฏิเสธไปแล้ว) */
  alreadyOffered?: readonly string[]
  /** ยิงไปแล้วกี่ครั้งในใบนี้ ตรงกับคอลัมน์ attempts */
  attempts?: number
}

export type NextOfferOutcome =
  | { ok: true; helper: RankedCandidate; attemptNo: number }
  | { ok: false; reason: 'exhausted-attempts' | 'no-one-left'; message: string }

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * คนถัดไปที่จะยิงคำขอให้ — คงที่ทุกครั้ง ไม่มีการสุ่ม
 *
 * คืน `exhausted-attempts` เมื่อครบโควตา 3 คนแล้ว (ต้องขึ้นการ์ดคู่คิดกับปุ่มเรียกครูแทน)
 * คืน `no-one-left` เมื่อยังไม่ครบโควตาแต่คนในลำดับถูกยิงไปหมดแล้ว
 */
export function nextHelperToOffer(input: NextOfferInput): NextOfferOutcome {
  const attempts = Math.max(0, Math.trunc(finite(input?.attempts)))
  if (attempts >= MAX_REQUEST_ATTEMPTS) {
    return {
      ok: false,
      reason: 'exhausted-attempts',
      message: `ถามเพื่อนครบ ${MAX_REQUEST_ATTEMPTS} คนแล้ว ตอนนี้ยังไม่มีใครว่าง ลองอธิบายเองในการ์ดคู่คิด หรือกดเรียกครูได้เลย`,
    }
  }

  const offered = new Set(input?.alreadyOffered ?? [])
  const queue = Array.isArray(input?.queue) ? input.queue : []
  const helper = queue.find((c) => Boolean(c?.studentId) && !offered.has(c.studentId))

  if (!helper) {
    return {
      ok: false,
      reason: 'no-one-left',
      message: 'ถามเพื่อนที่ว่างอยู่ไปหมดแล้ว ลองอธิบายเองในการ์ดคู่คิด หรือกดเรียกครูได้เลย',
    }
  }

  return { ok: true, helper, attemptNo: attempts + 1 }
}

/**
 * ผลของ `findMatch()` นี้ควรเปิดใบคำขอในฐานข้อมูลไหม
 *
 * ไม่เปิดใบเมื่อไม่มีใครให้ยิงคำขอ — ใบที่เปิดทิ้งไว้โดยไม่มีผู้ช่วยจะไปกิน
 * กติกา "ผู้ขอมีใบค้างได้ครั้งละ 1 ใบ" ทำให้กดขอใหม่ตอนเพื่อนว่างแล้วไม่ได้
 */
export function shouldOpenRequest(match: MatchResult | null | undefined): boolean {
  if (!match) return false
  if (match.blockedByOpenRequest) return false
  return match.kind !== 'card' && match.queue.length > 0
}

/**
 * ข้อความสรุปผลการหาคู่ที่หน้าจอเอาไปขึ้นได้เลย — ไม่ตำหนิใคร บอกทางออกเสมอ
 *
 * @param askingNickname ชื่อคนที่ **ยิงคำขอไปจริง** ส่งมาด้วยเสมอเมื่อยิงต่อคนที่ 2 หรือ 3
 *   ไม่ส่งจะไปเอาชื่อคนแรกของลำดับมาแสดง ซึ่งไม่ใช่คนที่กำลังรอคำตอบอยู่จริง
 */
export function matchHeadline(
  match: MatchResult | null | undefined,
  askingNickname?: string | null,
): string {
  if (!match) return 'ยังหาเพื่อนไม่ได้ตอนนี้ กดเรียกครูได้เลย'
  if (match.blockedByOpenRequest) return 'มีคำขออยู่แล้ว 1 ใบ ปิดใบเดิมก่อนถึงจะขอใหม่ได้'
  const who = (askingNickname ?? '').trim() || match.chosen?.nickname || 'เพื่อน'
  if (match.kind === 'buddy') {
    return `กำลังถาม ${who} ให้ — เพื่อนคนนี้ผ่านภารกิจนี้ไปแล้ว`
  }
  if (match.kind === 'thinking-partner') {
    return `ยังไม่มีใครผ่านข้อนี้ ชวน ${who} มาคิดไปด้วยกันนะ`
  }
  return 'ตอนนี้ยังไม่มีเพื่อนว่าง ลองอธิบายเองในการ์ดคู่คิด ถ้ายังติดกดเรียกครูได้เลย'
}

/**
 * กฎการเลือกนามสกุลโดเมน — ใช้ที่สถานี B (สำนักงานจดทะเบียน)
 *
 * ตรรกะล้วน ไม่ import React / Next / ฐานข้อมูล
 */
import { type Tld, fillMessage, rejectMessages, reservedReason, tlds } from './content'

/** ข้อมูลร้านที่นักเรียนกรอกไว้ตอนต้นเกม ตรงกับ 3 คำถามในภาพ flow */
export interface ShopProfile {
  /** จดทะเบียนนิติบุคคลแล้วหรือยัง */
  isRegisteredCompany: boolean
  /** ลูกค้าอยู่ที่ไหน */
  audience: 'thai' | 'international'
  /** ชื่อโดเมนที่ตั้งไว้จากสถานี A */
  domainName: string
}

export interface TldVerdict {
  tldId: string
  accepted: boolean
  /** เหตุผลที่เจ้าหน้าที่ดีดกลับ แสดงให้นักเรียนเห็น */
  reason: string | null
}

const THAI_SCRIPT = /[฀-๿]/

/** ตรวจว่ายื่นป้ายเข้าช่องนี้ได้หรือไม่ */
export function evaluateTld(tld: Tld, profile: ShopProfile): TldVerdict {
  // หมวดสงวน (.ac.th .go.th .or.th .net.th .mi.th) ตัดจบก่อนเงื่อนไขอื่นทุกข้อ
  // ร้านของนักเรียนจดไม่ได้ไม่ว่าจะจดทะเบียนบริษัท ตั้งชื่ออักษรไทย หรือขายใครก็ตาม
  const reserved = reservedReason(tld)
  if (reserved) {
    return { tldId: tld.id, accepted: false, reason: reserved }
  }

  if (tld.requiresCompany && !profile.isRegisteredCompany) {
    return {
      tldId: tld.id,
      accepted: false,
      reason: fillMessage(rejectMessages.needsCompany, tld.suffix),
    }
  }

  if (tld.requiresThaiScript && !THAI_SCRIPT.test(profile.domainName)) {
    return {
      tldId: tld.id,
      accepted: false,
      reason: fillMessage(rejectMessages.needsThaiScript, tld.suffix),
    }
  }

  if (tld.thaiOnlyAudience && profile.audience === 'international') {
    return {
      tldId: tld.id,
      accepted: false,
      reason: fillMessage(rejectMessages.audienceMismatch, tld.suffix),
    }
  }

  return { tldId: tld.id, accepted: true, reason: null }
}

/** ตรวจทุกช่องพร้อมกัน ใช้สร้างหน้าจอและใช้ตรวจว่าโจทย์มีทางออกหรือไม่ */
export function evaluateAll(profile: ShopProfile): TldVerdict[] {
  return tlds.map((t) => evaluateTld(t, profile))
}

/** รายการนามสกุลที่ยื่นผ่านได้ — ต้องมีอย่างน้อย 1 เสมอ ไม่งั้นโจทย์ตัน */
/**
 * @wired-optional ใช้ตรวจว่าโจทย์ทุกโปรไฟล์มีทางออกอย่างน้อย 1 ช่อง (กันโจทย์ตัน)
 *   สถานี B ตรวจทีละช่องด้วย evaluateTld() ไม่ได้ขอรายการรวม
 */
export function acceptableTldIds(profile: ShopProfile): string[] {
  return evaluateAll(profile)
    .filter((v) => v.accepted)
    .map((v) => v.tldId)
}

/**
 * ตัวช่วยที่แสดงในแต่ละช่อง ปรับตามระดับผู้เรียน
 * ระดับ 1 เห็นทุกอย่าง ระดับ 3 ไม่เห็นอะไรเลย ต้องจำจากที่ครูสอน
 */
export function hintsForLevel(tld: Tld, level: 1 | 2 | 3) {
  if (level === 1) {
    return { whoCanRegister: tld.whoCanRegister, goodFor: tld.goodFor, watchOut: tld.watchOut }
  }
  if (level === 2) {
    return { whoCanRegister: tld.whoCanRegister, goodFor: null, watchOut: null }
  }
  return { whoCanRegister: null, goodFor: null, watchOut: null }
}

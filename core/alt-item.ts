/**
 * S-20 ข้อสำรอง — ทางผ่านจุดประสงค์สำหรับผู้เรียนที่ติดจริง ๆ
 *
 * ปัญหาเดิม: ติดข้อเดิมแล้วตัน เหลือทางเดียวคือรอครูเดินมาถึง
 * ซึ่งในคาบ 60 นาทีที่ครูดูแล 30 คน แปลว่าอาจไม่ได้ผ่านจุดประสงค์นั้นเลยทั้งที่พอทำได้
 *
 * หลักที่ยึด 4 ข้อ
 * 1. **เป็นข้อเสนอ ไม่ใช่การบังคับ** — ปฏิเสธแล้วกลับไปลองข้อเดิมต่อได้เสมอ
 *    และถ้าเปลี่ยนใจภายหลังก็ขอเองได้ตลอด (มติหลัก "ระบบเสนอ ผู้เรียนเลือก")
 * 2. **ผ่านด้วยข้อสำรองได้ 1 ดาว** เท่ากับตอนครูกดให้ผ่าน อ่านจาก content/rubric.json
 *    (`missionStars.passedMinStars`) ไม่ฝังเลขในโค้ด
 * 3. **เกณฑ์ว่าเมื่อไรถึงเสนอ อ่านจากไฟล์เนื้อหา** — ใช้เกณฑ์ "ติดแล้ว" ชุดเดียวกับธงเตือนครู
 *    (`content/coach-thresholds.json` ระดับส้ม) ผู้เรียนกับครูจึงเห็นสัญญาณเดียวกัน ไม่ใช่คนละเกณฑ์
 * 4. ข้อสำรองที่ทีมเนื้อหายังเขียนไม่ครบ **ห้ามเสนอ** (ดู altItemReady ใน core/content-library.ts)
 *
 * ตรรกะล้วน ไม่แตะฐานข้อมูล ไม่เรียก Date.now()
 */
import rubricJson from '../content/rubric.json' with { type: 'json' }
import { altItemReady, findMissionTask, tasksForMission, type MissionTask } from './content-library'
import { coachThresholds } from './personalize'

/**
 * ดาวที่ได้เมื่อผ่านด้วยข้อสำรอง = ดาวต่ำสุดของการผ่าน (ปกติ 1)
 * ตรงกับกติกาที่ครูใช้ตอนกดให้ผ่าน — ผ่านแล้วต้องได้อย่างน้อย 1 ดาวเสมอ
 */
export const ALT_ITEM_STARS: number = (
  rubricJson.missionStars as unknown as { passedMinStars: number }
).passedMinStars

/**
 * จำนวนครั้งที่ตอบยังไม่ถูก ที่ถือว่า "ติดแล้ว" จนควรเสนอข้อสำรอง
 *
 * อ่านจากเกณฑ์ธงส้มใน content/coach-thresholds.json ("ติดแล้ว เตรียมเดินไปหา")
 * ถ้าทีมเนื้อหาเพิ่มคีย์เฉพาะของข้อสำรองภายหลัง ให้เปลี่ยนมาอ่านคีย์นั้นแทน (ดู result-t69.md)
 */
export const ALT_OFFER_AFTER_ATTEMPTS: number = coachThresholds.levels.orange.attempts ?? 3

export interface AltOfferState {
  /** ภารกิจที่กำลังทำ */
  missionId: string
  /** ลองแล้วยังไม่ผ่านกี่ครั้ง */
  attempts: number
  /** ผ่านภารกิจนี้ไปแล้วหรือยัง */
  passed?: boolean
  /** ใช้คำใบ้ครบทุกระดับแล้วยังไม่ผ่านหรือไม่ */
  hintsExhausted?: boolean
  /** ผู้เรียนเคยปฏิเสธข้อเสนอนี้ไปแล้วหรือยัง */
  declined?: boolean
  /** ผู้เรียนกดขอข้อสำรองเอง — ขอเมื่อไรก็ได้ ไม่ต้องรอเข้าเกณฑ์ */
  requested?: boolean
  /** ทำข้อสำรองของภารกิจนี้ไปแล้วหรือยัง */
  altAnswered?: boolean
}

export type AltOfferReason =
  /** ยังไม่ถึงเกณฑ์ ยังไม่ต้องเสนอ */
  | 'not-stuck-yet'
  /** ผ่านภารกิจนี้แล้ว ไม่ต้องใช้ทางสำรอง */
  | 'already-passed'
  /** ทำข้อสำรองไปแล้ว */
  | 'already-used'
  /** ภารกิจนี้ยังไม่มีข้อสำรองที่พร้อมใช้ */
  | 'no-alt-item'
  /** ผู้เรียนปฏิเสธไปแล้ว รอให้ขอเอง */
  | 'declined-by-student'
  /** ถึงเกณฑ์ติดแล้ว */
  | 'stuck'
  /** ผู้เรียนขอเอง */
  | 'student-asked'

export interface AltOffer {
  /** ควรขึ้นข้อเสนอบนหน้าจอตอนนี้ไหม */
  offer: boolean
  reason: AltOfferReason
  /** รหัสโจทย์หลักที่ข้อสำรองนี้ผูกอยู่ */
  taskId: string | null
  /** รหัสข้อสำรอง */
  altItemId: string | null
  /** ผู้เรียนกดขอข้อสำรองเองได้ไหม (ปฏิเสธไปแล้วก็ยังขอได้) */
  canRequest: boolean
  /** ข้อความชวน ไม่ตำหนิ ไม่บอกว่าเขาทำไม่ได้ */
  message: string
  /** ดาวที่จะได้ถ้าผ่านด้วยข้อสำรอง บอกล่วงหน้าเสมอ ไม่ให้รู้ทีหลัง */
  starsIfPassed: number
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** ข้อสำรองที่พร้อมใช้ของภารกิจนี้ — เอาโจทย์แรกที่มีข้อสำรองครบ */
export function altItemForMission(
  missionId: string,
): { task: MissionTask; altItemId: string } | null {
  const task = tasksForMission(missionId).find((t) => altItemReady(t))
  return task?.altItem ? { task, altItemId: task.altItem.id } : null
}

export function altItemForTask(taskId: string): string | null {
  const task = findMissionTask(taskId)
  return task && altItemReady(task) ? (task.altItem?.id ?? null) : null
}

/**
 * ควรเสนอข้อสำรองตอนนี้ไหม — **คืนคำตอบเดิมทุกครั้งสำหรับสถานะเดิม ไม่มีการสุ่ม**
 *
 * ลำดับการตัดสิน: ผ่านแล้ว / ใช้ไปแล้ว → ไม่ต้องเสนอ · ไม่มีข้อสำรองพร้อมใช้ → เสนอไม่ได้
 * · ผู้เรียนขอเอง → เสนอทันทีไม่ต้องรอเกณฑ์ · ปฏิเสธไปแล้ว → ไม่ยัดเยียดซ้ำ แต่ยังขอเองได้
 */
export function shouldOfferAltItem(state: AltOfferState): AltOffer {
  const available = altItemForMission(state?.missionId ?? '')
  const base = {
    taskId: available?.task.id ?? null,
    altItemId: available?.altItemId ?? null,
    starsIfPassed: ALT_ITEM_STARS,
  }

  if (state?.passed) {
    return { ...base, offer: false, reason: 'already-passed', canRequest: false, message: '' }
  }
  if (state?.altAnswered) {
    return { ...base, offer: false, reason: 'already-used', canRequest: false, message: '' }
  }
  if (!available) {
    return {
      ...base,
      offer: false,
      reason: 'no-alt-item',
      canRequest: false,
      message: '',
    }
  }

  const attempts = Math.max(0, Math.trunc(finite(state?.attempts)))
  const stuck = attempts >= ALT_OFFER_AFTER_ATTEMPTS || state?.hintsExhausted === true

  if (state?.requested) {
    return {
      ...base,
      offer: true,
      reason: 'student-asked',
      canRequest: true,
      message: offerMessage(base.starsIfPassed),
    }
  }

  if (state?.declined) {
    // ปฏิเสธแล้วไม่ยัดเยียดซ้ำ แต่ปุ่ม "ขอข้อสำรอง" ยังอยู่ให้กดเองเมื่อไรก็ได้
    return {
      ...base,
      offer: false,
      reason: 'declined-by-student',
      canRequest: true,
      message: '',
    }
  }

  if (!stuck) {
    return { ...base, offer: false, reason: 'not-stuck-yet', canRequest: true, message: '' }
  }

  return { ...base, offer: true, reason: 'stuck', canRequest: true, message: offerMessage(base.starsIfPassed) }
}

/**
 * ข้อความของข้อเสนอ — **บอกทางเลือกทั้งสองทางเสมอ** และบอกจำนวนดาวล่วงหน้า
 * ห้ามเขียนทำนองว่าทำข้อเดิมไม่ได้ หรือข้อนี้ง่ายกว่าเพราะเขาอ่อน
 */
function offerMessage(stars: number): string {
  return `ข้อนี้มีอีกแบบให้ลองนะ เป็นคนละวิธีถามเรื่องเดียวกัน ผ่านแล้วได้ ${stars} ดาว หรือจะลองข้อเดิมต่อก็ได้ เลือกเองเลย`
}

export interface AltAnswerOutcome {
  passed: boolean
  stars: number
  /** รหัสสถานการณ์ของคลังข้อความ (content/messages.json) */
  situation: 'passed-via-alt' | 'wrong-repeat'
  /** ผ่านด้วยข้อสำรองหรือไม่ — ต้องบันทึกแยกจากการผ่านข้อหลัก ไม่งั้นรายงานปนกัน */
  viaAltItem: boolean
}

/**
 * ผลของการตอบข้อสำรองหนึ่งครั้ง
 *
 * ตอบถูก = ผ่านจุดประสงค์นั้นด้วย 1 ดาว (เท่ากับตอนครูกดให้ผ่าน)
 * ตอบยังไม่ถูก = **ไม่ลงโทษอะไรเลย** ยังกลับไปทำข้อเดิมต่อได้ และยังขอครูได้เหมือนเดิม
 */
export function altAnswerOutcome(correct: boolean): AltAnswerOutcome {
  return correct
    ? { passed: true, stars: ALT_ITEM_STARS, situation: 'passed-via-alt', viaAltItem: true }
    : { passed: false, stars: 0, situation: 'wrong-repeat', viaAltItem: false }
}

/** ข้อสำรองของทุกภารกิจที่พร้อมใช้จริง ใช้ตรวจความครบของเนื้อหาและทำรายงานให้ทีมเนื้อหา */
export function missionsWithAltItem(missionIds: readonly string[]): string[] {
  return missionIds.filter((id) => altItemForMission(id) !== null)
}

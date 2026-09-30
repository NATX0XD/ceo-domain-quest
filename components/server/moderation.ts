import { reviewStudentText, type ReviewOutcome } from '@/core/content-filter'
import { recordContentFlag, recordPreJoinContentFlag, type FlagLevel } from '@/lib/db/repo'

/**
 * ด่านกรองคำของทุกช่องที่นักเรียนพิมพ์ได้ (E-11) — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * **หลักที่ห้ามผิด: ไม่ลบและไม่แก้ข้อความของนักเรียนเงียบ ๆ**
 * ทุกครั้งที่ไม่ผ่าน route ต้องคืนข้อความเดิมกลับไปให้เด็กเห็น พร้อมบอกว่าทำไมถึงถูกทัก
 * (`core/content-filter.ts` คืน `original` มาให้ครบทุกตัวอักษรอยู่แล้ว ห้ามตัดทิ้งระหว่างทาง)
 *
 * ระดับ 2-3 ถูกบันทึกลง `content_flags` ทันทีในคำขอเดียวกัน แผงครู poll ทุก 3 วินาทีจึงเห็นทัน
 * ครูเห็นข้อความเต็มเฉพาะระดับ 3 · ระดับ 1-2 เห็นฉบับปิดบางส่วน (ฝั่ง SQL บังคับให้อีกชั้น)
 */

/** ช่องที่พิมพ์ได้ทั้งหมด — ใช้เป็น `context` ของธง ครูจะได้รู้ว่ามาจากหน้าไหน */
export type ModerationContext =
  | 'brand-name'
  | 'nickname'
  | 'boss-reason'
  | 'reflection'
  | 'peer-feedback'
  | 'dome-chat'
  | 'self-goal'
  | 'survey-open'

export interface ModerationVerdict {
  /** บันทึกต่อได้ไหม */
  ok: boolean
  level: number
  /** ข้อความบอกนักเรียน — ไม่ตำหนิ บอกทางออกเสมอ (null เมื่อผ่าน) */
  message: string | null
  /** ข้อความเดิมของนักเรียน คืนกลับไปให้เห็นบนจอเสมอ ห้ามกลืนหาย */
  original: string
  /** ชื่อแบรนด์ของผู้อื่นที่เจอ — ไม่ใช่การทำผิด แต่ควรชวนคุยเรื่องเครื่องหมายการค้า */
  famousBrands: string[]
  hasPersonalInfo: boolean
  /** บันทึกธงถึงครูไปแล้วไหม */
  flagged: boolean
}

function verdictOf(outcome: ReviewOutcome, flagged: boolean): ModerationVerdict {
  return {
    ok: outcome.accepted,
    level: outcome.level,
    message: outcome.accepted
      ? null
      : (outcome.studentMessage ??
        'ข้อความนี้ยังไม่เหมาะจะขึ้นให้เพื่อนเห็น ลองเขียนใหม่ด้วยคำที่สุภาพขึ้นนะ'),
    original: outcome.result.original,
    famousBrands: outcome.famousBrands,
    hasPersonalInfo: outcome.hasPersonalInfo,
    flagged,
  }
}

/**
 * ตรวจข้อความหนึ่งก้อน แล้วบันทึกธงให้ครูถ้าต้องแจ้ง
 *
 * @param forPeers true เมื่อข้อความนี้จะขึ้นให้เพื่อนเห็น (ผนังผลงาน/ความเห็นเพื่อน)
 *   จะเข้มขึ้น 1 ขั้นตาม `safeToShowPeers()` — ระดับ 1 ที่ปกติแค่เตือน จะไม่ปล่อยขึ้นจอ
 */
export async function moderateStudentText(
  studentId: string,
  context: ModerationContext,
  text: string,
  options: { forPeers?: boolean } = {},
): Promise<ModerationVerdict> {
  const value = text ?? ''
  if (value.trim().length === 0) {
    return {
      ok: true,
      level: 0,
      message: null,
      original: value,
      famousBrands: [],
      hasPersonalInfo: false,
      flagged: false,
    }
  }

  /**
   * ด่านเดียวของ core — `reviewStudentText()` รวมชั้น 1-3 แล้วตัดสินให้เสร็จ
   * (รวมกฎ "เพื่อนเห็น" ที่เข้มขึ้น 1 ขั้นไว้ในตัว) ที่นี่จึงเหลือแค่บันทึกธงกับแปลงรูปผลลัพธ์
   */
  const outcome = reviewStudentText(value, {
    field: context,
    studentId,
    sharedWithPeers: options.forPeers === true,
  })

  /**
   * บันทึกธงตอนนี้เลย ไม่ใช่งานเบื้องหลัง — เกณฑ์ตรวจรับคือระดับ 3 ต้องถึงแผงครูใน 3 วินาที
   * เขียนธงไม่สำเร็จก็ไม่ทำให้คำขอของเด็กพัง (เด็กยังได้ข้อความบอกเหมือนเดิม)
   * ⚠️ ระดับ 1 ไม่แจ้งครูตามสเปก (`outcome.flag` เป็น null เอง) — สถิติอย่างเดียว
   */
  let flagged = false
  if (outcome.flag !== null) {
    try {
      await recordContentFlag(studentId, {
        context,
        level: outcome.flag.level as FlagLevel,
        categories: outcome.flag.categories,
        maskedText: outcome.flag.teacherText,
        originalText: outcome.result.original,
      })
      flagged = true
    } catch {
      flagged = false
    }
  }

  return verdictOf(outcome, flagged)
}

/**
 * ตรวจหลายช่องพร้อมกัน (เช่น เหตุผล 3 ข้อของด่านบอส) — คืนช่องแรกที่ไม่ผ่าน
 * ธงถูกบันทึกครบทุกช่องที่ติด ไม่ใช่แค่ช่องแรก ครูจะได้เห็นภาพจริง
 */
export async function moderateFields(
  studentId: string,
  context: ModerationContext,
  fields: { id: string; text: string }[],
  options: { forPeers?: boolean } = {},
): Promise<{ ok: boolean; failedFieldId: string | null; verdict: ModerationVerdict | null }> {
  let first: { id: string; verdict: ModerationVerdict } | null = null

  for (const field of fields) {
    const verdict = await moderateStudentText(studentId, context, field.text, options)
    if (!verdict.ok && first === null) first = { id: field.id, verdict }
  }

  return first === null
    ? { ok: true, failedFieldId: null, verdict: null }
    : { ok: false, failedFieldId: first.id, verdict: first.verdict }
}

/**
 * ชื่อเล่นตอนพิมพ์เข้าห้อง — ตรวจ **ก่อน** มีแถวนักเรียน
 *
 * ตอนนี้ยังไม่มี `studentId` ให้ผูกธง จึงผูกกับห้องแทนผ่าน `recordPreJoinContentFlag()`
 * (RPC ตรึง context เป็น 'join-nickname' ให้เอง · ห้องผิด = ไม่สร้างธงลอย)
 * ถ้าไม่บันทึกตรงนี้ ครูจะไม่มีทางรู้เลยว่ามีคนพยายามใช้ชื่อแบบนั้น เพราะคำขอถูกปฏิเสธไปก่อนแล้ว
 *
 * ⚠️ ตรวจแบบ "เพื่อนเห็น" เสมอ ชื่อเล่นขึ้นบนผนังผลงานและจอหน้าห้อง
 * ⚠️ บันทึกธงไม่สำเร็จต้องไม่ทำให้เด็กเข้าห้องไม่ได้ — ธงเป็นงานรอง คำตอบของเด็กคืองานหลัก
 */
export async function moderateJoinNickname(
  classroomId: string,
  nickname: string,
): Promise<ModerationVerdict> {
  const outcome = reviewStudentText(nickname ?? '', {
    field: 'join-nickname',
    sharedWithPeers: true,
  })

  let flagged = false
  if (outcome.flag !== null) {
    try {
      await recordPreJoinContentFlag(classroomId, {
        level: outcome.flag.level as FlagLevel,
        categories: outcome.flag.categories,
        maskedText: outcome.flag.teacherText,
        originalText: outcome.result.original,
      })
      flagged = true
    } catch {
      flagged = false
    }
  }

  return verdictOf(outcome, flagged)
}

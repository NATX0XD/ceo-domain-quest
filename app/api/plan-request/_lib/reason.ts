import { reviewStudentText } from '@/core/content-filter'
import { getServiceClient } from '@/lib/db/client'
import { recordContentFlag, type FlagLevel, type PlanRequest } from '@/lib/db/repo'

/**
 * ตัวช่วยของ S-08 ที่ไม่มีใน repo — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ⚠️ อยู่ใต้ `app/api/plan-request/_lib` เพราะไม่ใช่ route และเพื่อไม่ชนกับไฟล์ของ session อื่น
 */

/** ป้ายช่องของธง — ครูจะได้รู้ว่าคำที่ติดมาจากช่อง "เหตุผลที่ขอเปลี่ยนแผน" */
export const PLAN_REASON_CONTEXT = 'plan-request-reason'

export interface ReasonVerdict {
  ok: boolean
  /** ข้อความบอกผู้เรียน — ไม่ตำหนิ บอกทางออกเสมอ (null เมื่อผ่าน) */
  message: string | null
  /** ข้อความเดิมของผู้เรียน คืนกลับไปให้เห็นบนจอเสมอ **ห้ามกลืนหาย** */
  original: string
  level: number
  flagged: boolean
}

/**
 * เหตุผลที่ผู้เรียนพิมพ์เองต้องผ่านด่านกรองคำเสมอ (E-11)
 *
 * ใบคำขอเป็นข้อความที่ครูอ่านแน่นอน จึงไม่ใช่ช่องที่ปล่อยผ่านได้
 * ระดับ 2-3 บันทึกธงถึงครูทันทีในคำขอเดียวกัน (เกณฑ์: ระดับ 3 ถึงแผงครูใน 3 วินาที)
 * เขียนธงไม่สำเร็จต้องไม่ทำให้คำขอของเด็กพัง — เด็กยังได้ข้อความบอกเหมือนเดิม
 */
export async function reviewReason(studentId: string, text: string): Promise<ReasonVerdict> {
  const value = text ?? ''
  const outcome = reviewStudentText(value, {
    field: PLAN_REASON_CONTEXT,
    studentId,
    // ใบคำขอเห็นกันแค่เด็กกับครู ไม่ขึ้นผนังผลงาน จึงไม่ต้องเข้มระดับ "เพื่อนเห็น"
    sharedWithPeers: false,
  })

  let flagged = false
  if (outcome.flag !== null) {
    try {
      await recordContentFlag(studentId, {
        context: PLAN_REASON_CONTEXT,
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

  return {
    ok: outcome.accepted,
    message: outcome.accepted
      ? null
      : (outcome.studentMessage ?? 'ลองเขียนเหตุผลใหม่ด้วยคำที่สุภาพขึ้นนะ ครูจะได้ช่วยได้ตรงจุด'),
    original: outcome.result.original,
    level: outcome.level,
    flagged,
  }
}

/** ใบคำขอของผู้เรียนคนนี้เอง — ใบที่ยังไม่ตอบขึ้นก่อน แล้วเรียงใหม่สุดก่อน */
export async function listOwnPlanRequests(studentId: string): Promise<PlanRequest[]> {
  const { data, error } = await getServiceClient()
    .from('plan_requests')
    .select()
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(`listOwnPlanRequests: ${error.message}`)
  return data ?? []
}

import { reviewStudentText } from '@/core/content-filter'
import type { NextGoalChoice } from '@/core/next-goal'
import { getServiceClient } from '@/lib/db/client'
import { recordContentFlag, type FlagLevel } from '@/lib/db/repo'

/**
 * ที่เก็บ "เป้าหมายครั้งหน้า" (S-32) — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * ⚠️ **ไม่เก็บลงตาราง `reflections`** ทั้งที่ตัวเลือกอยู่ในไฟล์เนื้อหาเดียวกัน
 *    เพราะรายงานรายคนนับจำนวนแถวในตารางนั้นเป็น `reflectionCount` ตรง ๆ
 *    ซึ่งเป็นตัวตัดสินการผ่านจุดประสงค์ข้อ 6 — เพิ่มแถวเข้าไปเท่ากับทำให้เด็กผ่านข้อ 6
 *    ทั้งที่ยังตอบคำถามสะท้อนคิดไม่ครบ ตัวเลขทั้งห้องจะเชื่อไม่ได้
 *
 * จึงเก็บเป็น event แทน — ไม่ต้องแก้ตาราง (ซึ่งอยู่นอกขอบเขตของ session นี้)
 * และได้ประวัติการเปลี่ยนใจติดมาด้วย อ่านใบล่าสุดเป็นค่าที่ใช้จริง
 */

export const NEXT_GOAL_EVENT = 'next-goal-chosen'
/** ป้ายช่องของธงคำไม่เหมาะสม ครูจะได้รู้ว่าคำที่ติดมาจากช่อง "เป้าหมายคาบหน้า" */
export const NEXT_GOAL_CONTEXT = 'next-goal'

export interface StoredNextGoal extends NextGoalChoice {
  savedAt: string
  /** เปลี่ยนใจมาแล้วกี่ครั้ง (นับรวมครั้งแรก) */
  changeCount: number
}

/** เป้าครั้งหน้าที่ใช้อยู่จริงของผู้เรียนคนนี้ = ใบล่าสุด */
export async function latestNextGoal(studentId: string): Promise<StoredNextGoal | null> {
  const { data, error } = await getServiceClient()
    .from('events')
    .select('payload, created_at')
    .eq('student_id', studentId)
    .eq('type', NEXT_GOAL_EVENT)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(`latestNextGoal: ${error.message}`)
  const rows = data ?? []
  const newest = rows[0]?.payload as Record<string, unknown> | null | undefined
  if (!newest || typeof newest.goalId !== 'string' || typeof newest.text !== 'string') return null

  return {
    goalId: newest.goalId,
    text: newest.text,
    isOwnText: newest.isOwnText === true,
    savedAt: String(rows[0]?.created_at ?? ''),
    changeCount: rows.length,
  }
}

export interface GoalTextVerdict {
  ok: boolean
  /** ข้อความบอกผู้เรียน — ไม่ตำหนิ บอกทางออกเสมอ (null เมื่อผ่าน) */
  message: string | null
  /** ข้อความเดิมของผู้เรียน คืนกลับไปให้เห็นบนจอเสมอ **ห้ามกลืนหาย** */
  original: string
  level: number
  flagged: boolean
}

/**
 * เป้าที่ผู้เรียนพิมพ์เอง **ต้องผ่าน `reviewStudentText()` ทุกครั้ง** ไม่มีทางลัด
 * ระดับ 2-3 บันทึกธงถึงครูทันทีในคำขอเดียวกัน · เขียนธงไม่สำเร็จต้องไม่ทำให้คำขอของเด็กพัง
 */
export async function reviewOwnGoalText(
  studentId: string,
  text: string,
): Promise<GoalTextVerdict> {
  const outcome = reviewStudentText(text ?? '', {
    field: NEXT_GOAL_CONTEXT,
    studentId,
    // เป้าคาบหน้าเห็นกันแค่เด็กกับครู ไม่ขึ้นผนังผลงาน จึงไม่ต้องเข้มระดับ "เพื่อนเห็น"
    sharedWithPeers: false,
  })

  let flagged = false
  if (outcome.flag !== null) {
    try {
      await recordContentFlag(studentId, {
        context: NEXT_GOAL_CONTEXT,
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
      : (outcome.studentMessage ?? 'ลองเขียนเป้าใหม่ด้วยคำที่สุภาพขึ้นนะ'),
    original: outcome.result.original,
    level: outcome.level,
    flagged,
  }
}

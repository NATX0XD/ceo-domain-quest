import { NextResponse } from 'next/server'
import { logEvent } from '@/lib/db/repo'
import { errorResponse, readStudentSession, unauthorized } from '../_lib/session-cookie'
import { buildStoryInput } from './_lib/input'
import { drainStoriesInBackground, enqueueStory, storyQueueStatus } from './_lib/runner'

/**
 * E-07 + S-16 ฝากงานแต่งเรื่องเฉพาะคน
 *
 * เรียกทันทีที่ผู้เรียน **ตั้งค่าร้านเสร็จ** ตามสเปกหัวข้อ 3.1 นาทีที่ 15-20
 * ("สร้างเรื่องราวล่วงหน้าเบื้องหลัง") ระหว่างนั้นผู้เรียนเดินไปทำเช็กความเข้าใจและตั้งเป้าต่อ
 * ซึ่งกินเวลาราว 1-2 นาที **ผู้เรียนจึงไม่เคยนั่งรอเรื่องราวเลย**
 *
 * กติกา 3 ข้อ:
 * 1. **คืนทันที** ไม่รอ AI ตอบ เรียก drain แบบไม่รอผลเพื่อให้เรื่องเสร็จเร็วโดยไม่ค้างคำขอนี้
 * 2. **ฝากซ้ำไม่บวมคิว** มีงานที่ยังไม่ล้มเหลวอยู่แล้วให้ใช้ของเดิม
 * 3. **ยังตั้งค่าร้านไม่เสร็จไม่ใช่ error** คืน 200 พร้อม enqueued:false เพราะหน้าจอที่เรียกมา
 *    อาจเรียกเผื่อไว้ก่อน ไม่ควรขึ้นข้อความแดงให้ผู้เรียนเห็น
 *
 * ⚠️ studentId อ่านจากคุกกี้ dbq_student เท่านั้น ไม่รับจาก body
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const input = await buildStoryInput(session.studentId)
  if (!input) {
    return NextResponse.json({
      ok: true,
      enqueued: false,
      reason: 'shop-not-ready',
      message: 'ยังตั้งค่าร้านไม่เสร็จ เรื่องราวจะถูกแต่งให้ทันทีที่ตั้งชื่อร้านแล้ว',
    })
  }

  try {
    const { jobId, reused } = await enqueueStory(session.studentId, input)

    // ไม่ await โดยตั้งใจ — ผู้เรียนต้องได้คำตอบกลับทันที ไม่รอ AI
    if (!reused) drainStoriesInBackground()

    await logEvent(session.studentId, 'story-enqueued', { jobId, reused })

    return NextResponse.json({ ok: true, enqueued: true, reused, jobId })
  } catch {
    /**
     * ฝากงานไม่สำเร็จ **ไม่ใช่เรื่องที่ผู้เรียนต้องรับรู้** เพราะเส้นทางประโยคสำรอง
     * ยังเดินได้ครบทุกภารกิจอยู่แล้ว ตอบ 200 แล้วปล่อยให้เล่นต่อ
     */
    return NextResponse.json({
      ok: true,
      enqueued: false,
      reason: 'enqueue-failed',
      message: 'ยังฝากงานแต่งเรื่องไม่ได้ ระบบจะใช้เรื่องสำรองไปก่อน เล่นต่อได้ตามปกติ',
    })
  }
}

/** สถานะคิวแบบย่อ ใช้ตอนทดสอบและให้แผงครูดูว่าเรื่องแต่งไปถึงไหนแล้ว */
export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  try {
    return NextResponse.json({ ok: true, queue: await storyQueueStatus() })
  } catch {
    return errorResponse('queue-unavailable', 'อ่านสถานะคิวไม่ได้', 503)
  }
}

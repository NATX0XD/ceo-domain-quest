import { NextResponse } from 'next/server'
import { countGradeJobsByStatus, drainQueue } from '@/components/server/grade-queue'
import { errorResponse, readJsonBody, readTeacherSession } from '../../_lib/session-cookie'

/**
 * worker ของคิวตรวจงานด้วย AI — ยิงซ้ำได้เรื่อย ๆ (idempotent)
 *
 * ทุกครั้งที่เรียกจะ: ดึงงานค้างของ worker ที่ตายกลับเข้าคิว → แล้วตรวจจนคิวว่าง
 * ⚠️ ห้ามให้ใครก็ยิงได้ — ต้องเป็นครูที่ล็อกอินอยู่ หรือมี header `x-worker-secret`
 *    ที่ตรงกับ `GRADE_WORKER_SECRET` ใน .env.local (ห้ามตั้งชื่อขึ้นต้น NEXT_PUBLIC_)
 * ⚠️ ผลที่ AI เสนอถูกเก็บคู่ขนานใน submissions.ai_scores.aiProposed
 *    ไม่แตะดาวที่นักเรียนเห็นไปแล้ว และไม่แตะคะแนนที่ครูยืนยัน
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * ไม่ให้รอบเดียวกินเวลานานเกินไป เรียกซ้ำได้ถ้ายังมีงานเหลือ
 *
 * ตัวเลขนี้มาจากเวลาจริง: ตรวจ 1 งาน ~9-17 วินาที ทำพร้อมกัน 2 งาน
 * 20 งานต่อรอบ ≈ 2 นาที/รอบ · ห้อง 30 คน = 2 รอบ ≈ 3-4 นาที
 * ครูสรุปท้ายคาบนาทีที่ 50-55 จึงทันถ้าแผงครูเปิดค้างไว้ตั้งแต่เด็กเริ่มส่ง
 */
const MAX_JOBS_PER_CALL = 20

async function isAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.GRADE_WORKER_SECRET?.trim()
  if (secret && request.headers.get('x-worker-secret')?.trim() === secret) return true
  return (await readTeacherSession()) !== null
}

function denied() {
  return errorResponse(
    'unauthorized',
    'ต้องเป็นครูที่ล็อกอินอยู่ หรือส่ง x-worker-secret ให้ตรงกับที่ตั้งไว้ในเซิร์ฟเวอร์',
    401,
  )
}

/** ดูว่าคิวเหลือเท่าไร — เบา เรียกถี่ได้ แผงครูใช้ตัดสินใจว่าจะยิง drain รอบต่อไปไหม */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return denied()

  const counts = await countGradeJobsByStatus()
  return NextResponse.json({ ok: true, ...counts })
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return denied()

  const body = await readJsonBody(request)
  const asked =
    body && typeof body === 'object' && typeof (body as { max?: unknown }).max === 'number'
      ? Math.floor((body as { max: number }).max)
      : MAX_JOBS_PER_CALL
  const maxJobs = Math.min(MAX_JOBS_PER_CALL, Math.max(1, asked))

  const summary = await drainQueue(maxJobs)
  const counts = await countGradeJobsByStatus()
  return NextResponse.json({ ok: true, ...summary, queue: counts })
}

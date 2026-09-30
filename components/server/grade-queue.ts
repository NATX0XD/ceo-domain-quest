import type { Json } from '@/lib/db/types'
import { getServiceClient } from '@/lib/db/client'
import {
  type GradeJob as GradeJobRow,
  claimNextGradeJob,
  completeGradeJob,
  enqueueGradeJob,
  failGradeJob,
  withAiSwitch,
  listGradeJobs,
  reclaimStaleGradeJobs,
  reclaimStaleStoryJobs,
  updateSubmissionAiScores,
} from '@/lib/db/repo'
import {
  BACKGROUND_TIMEOUT_MS,
  BackgroundGrader,
  type GradeJob,
  type GradeJobStatus,
  type GradeJobStore,
} from '@/lib/ai/grade-queue'
import { createAiClient } from '@/lib/ai'
import type { GradeReasonInput, GradeReasonResult } from '@/lib/ai/types'

/**
 * ต่อคิวตรวจงานเบื้องหลังเข้ากับฐานข้อมูลจริง — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * กติกาที่ห้ามผิด:
 * 1. นักเรียนได้คะแนนจากกฎทันทีตอนกดส่ง ไม่รอ AI เลย (งาน AI แค่เข้าคิวไว้)
 * 2. ผลที่ AI เสนอมาทีหลังเป็น "ข้อเสนอคู่ขนาน" เก็บไว้ใต้คีย์ `aiProposed`
 *    **ห้ามแตะดาวที่นักเรียนเห็นไปแล้ว และห้ามแตะคะแนนที่ครูยืนยัน**
 * 3. คิวอยู่ในตาราง `grade_jobs` เซิร์ฟเวอร์ดับแล้วงานไม่หาย
 *    worker ตายกลางทาง → `reclaimStaleGradeJobs()` ดึงกลับเข้าคิวรอบถัดไป
 */

/** สถานะในตารางใช้คำว่า claimed ส่วนชั้น lib/ai ใช้ running — แปลงให้ตรงกันที่นี่ */
function toLibStatus(status: string): GradeJobStatus {
  if (status === 'claimed') return 'running'
  if (status === 'done' || status === 'failed' || status === 'pending') return status
  return 'pending'
}

function toLibJob(row: GradeJobRow): GradeJob {
  const input = (row.input ?? {}) as unknown as GradeReasonInput
  return {
    id: row.id,
    studentId: row.student_id,
    submissionId: row.submission_id ?? '',
    input,
    status: toLibStatus(row.status),
    attempts: row.attempts,
    aiResult: (row.ai_result ?? null) as unknown as GradeReasonResult | null,
    error: row.error,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

/**
 * ที่เก็บคิวจริงบนตาราง grade_jobs
 *
 * ⚠️ `claimNext` คืน null ได้ทั้งตอน "คิวว่างจริง" และตอน "แถวถูกล็อกโดย worker ตัวอื่น"
 *    (RPC ใช้ FOR UPDATE SKIP LOCKED) ผู้เรียกจึงต้องลองซ้ำก่อนสรุปว่าคิวหมด — ดู `drainQueue()`
 */
export class DbGradeJobStore implements GradeJobStore {
  async enqueue(job: GradeJob): Promise<void> {
    /**
     * ครูกดปิด AI ทั้งห้อง = **ไม่ฝากงานตรวจเข้าคิวเลย** (REVIEW-8 H-3)
     * นักเรียนไม่กระทบอะไร เพราะคะแนนจากกฎถูกบันทึกและแสดงไปตั้งแต่ตอนกดส่งแล้ว
     * (งานที่เข้าคิวไว้ก่อนครูกดปิดยังเดินจนจบ — เป็นงานที่ฝากไปตอน AI ยังเปิดอยู่)
     */
    await withAiSwitch(
      job.studentId,
      () =>
        enqueueGradeJob(job.studentId, job.submissionId || null, job.input as unknown as NonNullable<Json>),
      () => undefined,
    )
  }

  async claimNext(): Promise<GradeJob | null> {
    const row = await claimNextGradeJob()
    return row ? toLibJob(row) : null
  }

  async complete(jobId: string, aiResult: GradeReasonResult): Promise<void> {
    await completeGradeJob(jobId, aiResult as unknown as NonNullable<Json>)
  }

  async fail(jobId: string, error: string): Promise<void> {
    // จำนวนครั้งที่ลองและการตัดสินว่าจะ retry หรือปักตาย ทำใน SQL ให้แล้ว
    await failGradeJob(jobId, error)
  }

  async get(): Promise<GradeJob | null> {
    // ยังไม่มีที่ไหนเรียกใช้ — คิวทำงานผ่าน claim/complete/fail เท่านั้น
    return null
  }

  async listByStudent(studentId: string): Promise<GradeJob[]> {
    return (await listGradeJobs(studentId)).map(toLibJob)
  }

  async countByStatus(): Promise<Record<GradeJobStatus, number>> {
    return countGradeJobsByStatus()
  }
}

/**
 * นับงานในคิวแยกตามสถานะ — ใช้โชว์ตัวเลขเล็ก ๆ บนแผงครู ("รอตรวจ n · กำลังตรวจ n")
 * นับด้วย `head: true` จึงไม่ดึงแถวจริงกลับมา เรียกถี่ได้
 * ⚠️ เป็นข้อมูลรวมทั้งระบบ ไม่ผูกกับนักเรียนคนไหน จึงไม่มีอะไรรั่วถึงผู้เรียน
 */
export async function countGradeJobsByStatus(): Promise<Record<GradeJobStatus, number>> {
  const client = getServiceClient()
  const rows = ['pending', 'claimed', 'done', 'failed'] as const
  const [pending = 0, claimed = 0, done = 0, failed = 0] = await Promise.all(
    rows.map(async (status) => {
      const { count, error } = await client
        .from('grade_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
      if (error) throw new Error(`countGradeJobsByStatus(${status}): ${error.message}`)
      return count ?? 0
    }),
  )
  return { pending, running: claimed, done, failed }
}

/**
 * ตัวตรวจเบื้องหลัง — ใช้งบเวลา 60 วินาที ไม่ใช่ 5 วินาทีของฝั่งนักเรียน
 * ไม่มีใครนั่งรอหน้าจอ จึงยอมให้โมเดลคิดนานได้
 */
const grader = new BackgroundGrader({
  client: createAiClient({ timeoutMs: BACKGROUND_TIMEOUT_MS }),
  store: new DbGradeJobStore(),
  onJobDone: (job) => {
    // เขียนผลกลับเข้าใบงาน โดยไม่รอให้ drain เสร็จ (พังก็แค่ไม่มีผล AI ไม่กระทบนักเรียน)
    void writeAiResultBack(job)
  },
})

export function backgroundGrader(): BackgroundGrader {
  return grader
}

/**
 * เติมผลที่ AI เสนอกลับเข้า `submissions.ai_scores`
 *
 * ⚠️ เก็บไว้ใต้ `aiProposed` เท่านั้น **ไม่แตะฟิลด์ระดับบนสุดที่เป็นผลจากกฎ**
 *    เพราะดาวของนักเรียนคิดจาก `ruleScores` และดาวสุดท้ายคิดจากคะแนนที่ครูยืนยัน
 *    (บั๊กที่เพิ่งเจอ: ถ้าเขียนทับระดับบนสุด ดาวที่ครูให้จะถูกกลบตอนคำนวณใหม่)
 */
async function writeAiResultBack(job: GradeJob): Promise<void> {
  if (!job.submissionId || !job.studentId) return
  const { listSubmissions } = await import('@/lib/db/repo')
  const rows = await listSubmissions(job.studentId)
  const target = rows.find((row) => row.id === job.submissionId)
  if (!target) return

  const current =
    target.ai_scores && typeof target.ai_scores === 'object' && !Array.isArray(target.ai_scores)
      ? (target.ai_scores as Record<string, unknown>)
      : {}

  const merged = {
    ...current,
    gradingStatus: job.status === 'done' ? 'done' : 'ai-failed',
    aiProposed:
      job.status === 'done' && job.aiResult
        ? {
            dimensions: job.aiResult.dimensions,
            emphasisDimensionId: job.aiResult.emphasisDimensionId,
            weightedTotal: job.aiResult.weightedTotal,
            weightedMax: job.aiResult.weightedMax,
            stars: job.aiResult.stars,
            feedback: job.aiResult.feedback,
            source: job.aiResult.source,
            provider: job.aiResult.provider,
          }
        : null,
    aiError: job.status === 'done' ? null : job.error,
  }

  await updateSubmissionAiScores(
    job.studentId,
    job.submissionId,
    merged as unknown as NonNullable<Json>,
  )
}

export interface DrainSummary {
  reclaimed: number
  /** งานแต่งเรื่องเฉพาะคนที่ค้างสถานะ running แล้วถูกดึงกลับเข้าคิวรอบนี้ */
  reclaimedStory: number
  processed: number
  /** true = มีรอบก่อนหน้ายังวิ่งอยู่ในเซิร์ฟเวอร์ตัวนี้ รอบนี้เลยไม่ทำอะไร */
  skipped?: boolean
}

/**
 * กันยิงซ้อน **ในเซิร์ฟเวอร์ตัวเดียวกัน**
 *
 * ครูเปิดแผงทิ้งไว้หลายแท็บ/กดปุ่มรัวได้ ถ้าปล่อยให้ drain วิ่งซ้อนกันจะเปลือง
 * โควตา AI ฟรี ๆ (งานเดิมโดน SKIP LOCKED ก็จริง แต่ยังเสียรอบเรียก DB)
 * ข้ามเครื่อง/ข้ามโพรเซสยังพึ่ง `for update skip locked` ใน SQL เหมือนเดิม
 */
let inFlight: Promise<DrainSummary> | null = null

/**
 * รอบทำงานของ worker
 *
 * 1. ดึงงานที่ worker ตัวก่อนตายคาไว้กลับเข้าคิวก่อนเสมอ ไม่งั้นงานค้างตลอดไป
 *    **ทำทั้งสองคิว** — คิวตรวจงาน (grade_jobs) และคิวแต่งเรื่องเฉพาะคน (story_jobs)
 *    คิวแต่งเรื่องไม่มี worker ของตัวเอง ถ้าไม่ดึงที่นี่ งานที่ค้าง running จะค้างถาวร
 * 2. drain ซ้ำอีกรอบเมื่อรอบแรกไม่ได้งานเลย เพราะ null อาจแปลว่า "โดน SKIP LOCKED"
 *    ไม่ใช่ "คิวว่างจริง" (คำเตือนจากฝั่ง DB)
 */
export async function drainQueue(maxJobs = 50): Promise<DrainSummary> {
  if (inFlight) return { reclaimed: 0, reclaimedStory: 0, processed: 0, skipped: true }

  inFlight = (async () => {
    const [reclaimed, reclaimedStory] = await Promise.all([
      reclaimStaleGradeJobs(),
      // คิวแต่งเรื่องล้มไม่ควรทำให้คิวตรวจงานล้มตาม — งานตรวจคือสิ่งที่ครูรออยู่
      reclaimStaleStoryJobs().catch(() => []),
    ])

    let processed = 0
    for (let round = 0; round < 2; round += 1) {
      const result = await grader.drain(maxJobs - processed)
      processed += result.processed
      if (result.processed > 0) break
    }

    return { reclaimed: reclaimed.length, reclaimedStory: reclaimedStory.length, processed }
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

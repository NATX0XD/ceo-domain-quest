import { createAiClient } from '@/lib/ai'
import {
  claimNextStoryJob,
  completeStoryJob,
  countStoryJobsByStatus,
  enqueueStoryJob,
  failStoryJob,
  findStudentStoryJob,
  getStoryJob,
  withAiSwitch,
  type StoryJob as StoryJobRow,
} from '@/lib/db/repo'
import {
  StoryQueue,
  type StoryJob,
  type StoryJobStatus,
  type StoryJobStore,
} from '@/lib/ai/story-queue'
import type { StoryInput, StoryItem, StoryResult } from '@/lib/ai/types'
import type { Json } from '@/lib/db/types'

/**
 * ต่อคิวแต่งเรื่องเฉพาะคน (E-07 + S-16) เข้ากับฐานข้อมูลจริง — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * โครงเดียวกับ components/server/grade-queue.ts ที่ทำกับคิวตรวจงาน ต่างกัน 3 อย่าง:
 * 1. งานนี้ **ไม่มีใครนั่งรอ** ผู้เรียนเดินไปทำเช็กความเข้าใจและตั้งเป้าต่อระหว่างที่เรื่องกำลังแต่ง
 * 2. เรียก AI **ครั้งเดียวต่อนักเรียน** ได้เรื่องครบ 10 เรื่องในทีเดียว (M1-M4 + B-T1..B-T6)
 *    แล้วเก็บใช้ทั้งคาบ ตามสเปก E-07 การทำงานข้อ 2
 * 3. **เปิดภารกิจก่อนเรื่องเสร็จต้องได้เรื่องอ่านทันที** `storyFor()` คืนประโยคสำรองที่เติมชื่อร้าน
 *    ของผู้เรียนแล้ว ไม่ใช่ตัวหมุนรอ และห้ามสลับข้อความระหว่างที่ผู้เรียนกำลังอ่านอยู่
 *
 * ⚠️ ไฟล์นี้อยู่ใต้ app/api/story/_lib เพราะไม่ใช่ route (Next รู้จักเฉพาะ route.ts)
 *    วางไว้ที่นี่เพื่อให้อยู่ในขอบเขตไฟล์ของ session นี้ ไม่ชนกับ components/server/** ของ session อื่น
 */

function toStatus(value: string): StoryJobStatus {
  return value === 'running' || value === 'done' || value === 'failed' ? value : 'pending'
}

function toMillis(value: string | null): number {
  const at = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(at) ? at : 0
}

/** แถวในตาราง story_jobs → รูปแบบที่ StoryQueue เข้าใจ */
function toJob(row: StoryJobRow): StoryJob {
  return {
    id: row.id,
    studentId: row.student_id,
    input: (row.input ?? {}) as unknown as StoryInput,
    status: toStatus(row.status),
    attempts: row.attempts ?? 0,
    result: (row.result as StoryResult | null) ?? null,
    error: row.error ?? null,
    createdAt: toMillis(row.created_at),
    updatedAt: toMillis(row.updated_at ?? row.created_at),
  }
}

/**
 * ที่เก็บคิวที่ทนการรีสตาร์ต — ทุกคำสั่งวิ่งลงตาราง story_jobs จริง
 *
 * หมายเหตุเรื่อง enqueue: `StoryQueue.enqueue()` สร้างรหัสงานมาเองในหน่วยความจำ
 * แต่ฐานข้อมูลเป็นคนออกรหัสจริง เราจึงไม่ใช้รหัสที่คิวสร้างมา และให้ `enqueueStory()`
 * ด้านล่างเป็นทางเข้าเดียวแทน จะได้ไม่มีรหัสสองชุดให้สับสน
 */
export class DbStoryJobStore implements StoryJobStore {
  async enqueue(job: StoryJob): Promise<void> {
    await enqueueStoryJob(job.studentId, job.input as unknown as NonNullable<Json>)
  }

  async claimNext(): Promise<StoryJob | null> {
    const row = await claimNextStoryJob()
    return row ? toJob(row) : null
  }

  async complete(jobId: string, result: StoryResult): Promise<void> {
    await completeStoryJob(jobId, result as unknown as NonNullable<Json>)
  }

  async fail(jobId: string, error: string, _now: number, retry: boolean): Promise<void> {
    await failStoryJob(jobId, error, retry)
  }

  async get(jobId: string): Promise<StoryJob | null> {
    const row = await getStoryJob(jobId)
    return row ? toJob(row) : null
  }

  async findByStudent(studentId: string): Promise<StoryJob | null> {
    const row = await findStudentStoryJob(studentId)
    return row ? toJob(row) : null
  }

  async countByStatus(): Promise<Record<StoryJobStatus, number>> {
    return countStoryJobsByStatus()
  }
}

export const storyStore = new DbStoryJobStore()

/**
 * ตัวเชื่อม AI ของคิวนี้ — **ไม่ตั้งงบเวลาเอง**
 *
 * เดิมต้องส่ง `timeoutMs: STORY_TIMEOUT_MS` เข้าไปเอง เพราะชั้น AI ใช้ค่าเดียว 5 วินาทีกับทุกงาน
 * ซึ่งไม่เคยพอสำหรับงานนี้ (ขอเรื่องราว 10 เรื่องในการเรียกครั้งเดียว) และเคยตกเป็น timeout ครบ 3 ครั้ง
 *
 * ตั้งแต่ T61 งบเวลาแยกตามชนิดงานอยู่ที่ `TASK_TIMEOUT_MS` ใน lib/ai/index.ts แล้ว
 * งาน story ได้ `BACKGROUND_TIMEOUT_MS` เองโดยอัตโนมัติ ที่นี่จึงไม่ต้องตั้งซ้ำ
 * (T69: เลิกตั้งงบเวลาซ้ำนอกทางกลาง เหลือแหล่งความจริงเดียว)
 */
const storyAi = createAiClient()

export const storyQueue = new StoryQueue({ client: storyAi, store: storyStore })

/**
 * ฝากงานแต่งเรื่องของผู้เรียนหนึ่งคน — คืนทันที ไม่รอ AI
 * มีงานที่ยังไม่ล้มเหลวอยู่แล้วก็ไม่ฝากซ้ำ กันคิวบวมตอนผู้เรียนกดตั้งค่าร้านหลายรอบ
 */
export async function enqueueStory(
  studentId: string,
  input: StoryInput,
): Promise<{ jobId: string; reused: boolean }> {
  /**
   * ครูกดปิด AI ทั้งห้อง = **ไม่ฝากงานแต่งเรื่องเลย** (REVIEW-8 H-3)
   *
   * โยนออกไปแทนการเงียบ ๆ เพราะทั้งสองผู้เรียก (`/api/story`, `/api/profile`) ถือว่า
   * "ฝากงานไม่ได้" คือเส้นทางปกติที่ตกไปใช้ **ประโยคสำรองที่เติมชื่อร้านจริงแล้ว** อยู่แล้ว
   * ผู้เรียนจึงยังได้เรื่องเปิดของทุกภารกิจเหมือนเดิม ไม่เห็นข้อความผิดพลาดและไม่เห็นตัวหมุนรอ
   */
  return withAiSwitch(
    studentId,
    async () => {
      const existing = await findStudentStoryJob(studentId)
      if (existing && existing.status !== 'failed') {
        return { jobId: existing.id, reused: true }
      }

      const row = await enqueueStoryJob(studentId, {
        ...input,
        studentId,
      } as unknown as NonNullable<Json>)

      return { jobId: row.id, reused: false }
    },
    () => {
      throw new Error('[story] ครูปิด AI ของคาบนี้ไว้ — ใช้ประโยคสำรองแทน ไม่ฝากงานเข้าคิว')
    },
  )
}

/**
 * เรื่องเปิดของโจทย์หนึ่งข้อ — **คืนข้อความที่อ่านได้เสมอ ไม่ว่าคิวจะเสร็จหรือยัง**
 * ยังไม่เสร็จ = ประโยคสำรองที่เติมชื่อร้านจริงแล้ว ผู้เรียนจึงไม่เคยเห็นหน้าจอว่างหรือตัวหมุนรอ
 */
export async function storyItemFor(
  studentId: string,
  storyId: string,
  input: StoryInput,
): Promise<StoryItem> {
  return storyQueue.storyFor(studentId, storyId, { ...input, studentId })
}

/**
 * เดินคิวให้เรื่องเสร็จ — เรียกแบบไม่รอผลจาก route ที่ฝากงาน
 * จับ error ทิ้งทั้งหมดโดยตั้งใจ เพราะงานเบื้องหลังล้มไม่ควรทำให้คำขอของผู้เรียนพัง
 * (คิวมีกติกาลองใหม่ของตัวเองอยู่แล้ว และเส้นทางประโยคสำรองยังเดินได้เสมอ)
 */
export function drainStoriesInBackground(maxJobs = 5): void {
  void storyQueue.drain(maxJobs).catch(() => undefined)
}

export async function storyQueueStatus(): Promise<Record<StoryJobStatus, number>> {
  return storyQueue.status()
}

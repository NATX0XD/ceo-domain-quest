/**
 * คิวสร้างเรื่องราวเบื้องหลัง (E-07) — โครงเดียวกับ lib/ai/grade-queue.ts
 *
 * ทำไมต้องเป็นคิวเบื้องหลัง: สเปกหัวข้อ 3.1 นาทีที่ 15-20 เขียนว่า "สร้างเรื่องราวล่วงหน้าเบื้องหลัง"
 * และ E-07 ข้อ 1 ระบุว่าเริ่มทันทีที่นักเรียนตอบข้อ 6 ของแชต ระหว่างที่นักเรียนกำลังทำเช็กความเข้าใจ
 * และตั้งเป้าอยู่ ซึ่งกินเวลาประมาณ 1-2 นาที **นักเรียนจึงไม่เคยนั่งรอเรื่องราวเลย**
 *
 * กติกา 3 ข้อของไฟล์นี้:
 * 1. `enqueue()` คืนทันที ไม่แตะเน็ต นักเรียนเดินต่อไปทำอย่างอื่นได้เลย
 * 2. งานเบื้องหลังไม่มีเส้นตาย 5 วินาทีของฝั่งนักเรียน ใช้ STORY_TIMEOUT_MS แทน
 * 3. **เปิดภารกิจก่อนเรื่องราวเสร็จก็ต้องได้เรื่องอ่าน** — `storyFor()` คืนประโยคสำรองทันที
 *    และห้ามสลับข้อความระหว่างที่นักเรียนกำลังอ่านอยู่ (สเปก E-07 ระบบสำรอง)
 */
import { BACKGROUND_TIMEOUT_MS } from './index'
import { fallbackStorySet } from './story'
import type { AiClient, StoryInput, StoryItem, StoryResult } from './types'

export type StoryJobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface StoryJob {
  id: string
  studentId: string
  input: StoryInput
  status: StoryJobStatus
  attempts: number
  /** ชุดเรื่องราวที่สร้างเสร็จแล้ว มีค่าเมื่อ status เป็น done */
  result: StoryResult | null
  error: string | null
  createdAt: number
  updatedAt: number
}

/**
 * ที่เก็บสถานะคิว — **ต้องทนการรีสตาร์ต** เหมือน GradeJobStore
 * ตัวจริงต้องเก็บลงฐานข้อมูล (ตาราง story_jobs) ซึ่งเป็นงานของ session ฐานข้อมูล
 * ดูรายการคอลัมน์ที่ขอไว้ใน result-t42.md
 */
export interface StoryJobStore {
  enqueue(job: StoryJob): Promise<void>
  claimNext(now: number): Promise<StoryJob | null>
  complete(jobId: string, result: StoryResult, now: number): Promise<void>
  fail(jobId: string, error: string, now: number, retry: boolean): Promise<void>
  get(jobId: string): Promise<StoryJob | null>
  /** เรื่องราวของนักเรียนคนนี้ ใช้ตอนเปิดภารกิจ */
  findByStudent(studentId: string): Promise<StoryJob | null>
  countByStatus(): Promise<Record<StoryJobStatus, number>>
}

/** ที่เก็บในหน่วยความจำ ใช้ในเทสต์และตอนยังไม่ได้ต่อฐานข้อมูล หายเมื่อรีสตาร์ต */
export class InMemoryStoryJobStore implements StoryJobStore {
  private readonly jobs = new Map<string, StoryJob>()

  async enqueue(job: StoryJob): Promise<void> {
    this.jobs.set(job.id, { ...job })
  }

  async claimNext(now: number): Promise<StoryJob | null> {
    for (const job of this.jobs.values()) {
      if (job.status === 'pending') {
        const claimed = { ...job, status: 'running' as const, attempts: job.attempts + 1, updatedAt: now }
        this.jobs.set(job.id, claimed)
        return claimed
      }
    }
    return null
  }

  async complete(jobId: string, result: StoryResult, now: number): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return
    this.jobs.set(jobId, { ...job, status: 'done', result, error: null, updatedAt: now })
  }

  async fail(jobId: string, error: string, now: number, retry: boolean): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return
    this.jobs.set(jobId, { ...job, status: retry ? 'pending' : 'failed', error, updatedAt: now })
  }

  async get(jobId: string): Promise<StoryJob | null> {
    return this.jobs.get(jobId) ?? null
  }

  async findByStudent(studentId: string): Promise<StoryJob | null> {
    const rows = [...this.jobs.values()]
      .filter((j) => j.studentId === studentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
    return rows[0] ?? null
  }

  async countByStatus(): Promise<Record<StoryJobStatus, number>> {
    const counts: Record<StoryJobStatus, number> = { pending: 0, running: 0, done: 0, failed: 0 }
    for (const job of this.jobs.values()) counts[job.status] += 1
    return counts
  }
}

/**
 * งบเวลาของฝั่งเบื้องหลัง — ยาวได้เพราะไม่มีใครนั่งรอ
 *
 * ไม่ตั้งเลขเอง ใช้ค่ากลางจาก `lib/ai/index.ts` ที่เดียว (T69)
 * ผู้เรียกที่ไม่ส่ง timeoutMs มาเองก็ได้ค่านี้อยู่แล้ว เพราะ TASK_TIMEOUT_MS.story ชี้มาที่ตัวเดียวกัน
 */
export const STORY_TIMEOUT_MS = BACKGROUND_TIMEOUT_MS

export const DEFAULT_STORY_MAX_ATTEMPTS = 3

export interface StoryQueueOptions {
  client: AiClient
  store: StoryJobStore
  now?: () => number
  maxAttempts?: number
  concurrency?: number
  onJobDone?: (job: StoryJob) => void
}

/**
 * ตัวสร้างเรื่องราวเบื้องหลัง
 * ผู้เรียก (route ฝั่งเซิร์ฟเวอร์) เรียก `enqueue()` ตอนนักเรียนตอบแชตข้อสุดท้าย
 * แล้วเรียก `drain()` จากงานเบื้องหลังหรือแผงครู เหมือนที่ทำกับคิวตรวจงาน
 */
export class StoryQueue {
  private readonly client: AiClient
  private readonly store: StoryJobStore
  private readonly now: () => number
  private readonly maxAttempts: number
  private readonly concurrency: number
  private readonly onJobDone?: (job: StoryJob) => void
  private sequence = 0

  constructor(options: StoryQueueOptions) {
    this.client = options.client
    this.store = options.store
    this.now = options.now ?? (() => Date.now())
    this.maxAttempts = options.maxAttempts ?? DEFAULT_STORY_MAX_ATTEMPTS
    this.concurrency = Math.max(1, options.concurrency ?? 2)
    this.onJobDone = options.onJobDone
  }

  /** ฝากงานไว้ให้สร้างทีหลัง — ต้องไม่รอเน็ตเลยแม้แต่นิดเดียว */
  async enqueue(input: StoryInput): Promise<{ jobId: string }> {
    const at = this.now()
    this.sequence += 1
    const jobId = `story-${input.studentId ?? 'unknown'}-${this.sequence}`

    await this.store.enqueue({
      id: jobId,
      studentId: input.studentId ?? '',
      input,
      status: 'pending',
      attempts: 0,
      result: null,
      error: null,
      createdAt: at,
      updatedAt: at,
    })

    return { jobId }
  }

  private async processOne(): Promise<boolean> {
    const job = await this.store.claimNext(this.now())
    if (!job) return false

    try {
      const result = await this.client.storyFor(job.input)
      if (result.source !== 'ai') {
        // ยังไม่ได้เรื่องจาก AI จริง โยนกลับเข้าคิวไว้ลองใหม่
        throw new Error(`ยังไม่ได้เรื่องราวจาก AI (${result.fallbackReason})`)
      }
      await this.store.complete(job.id, result, this.now())
      this.onJobDone?.({ ...job, status: 'done', result, updatedAt: this.now() })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retry = job.attempts < this.maxAttempts
      await this.store.fail(job.id, message, this.now(), retry)
      if (!retry) this.onJobDone?.({ ...job, status: 'failed', error: message, updatedAt: this.now() })
    }
    return true
  }

  /** สร้างจนคิวว่าง @param maxJobs กันวนไม่จบเมื่อมีงานถูกโยนกลับเข้าคิวซ้ำ ๆ */
  async drain(maxJobs = 500): Promise<{ processed: number }> {
    let processed = 0
    while (processed < maxJobs) {
      const batch = await Promise.all(
        Array.from({ length: this.concurrency }, () => this.processOne()),
      )
      const worked = batch.filter(Boolean).length
      if (worked === 0) break
      processed += worked
    }
    return { processed }
  }

  /**
   * เรื่องราวของโจทย์หนึ่งข้อ **ต้องคืนข้อความที่อ่านได้เสมอ ไม่ว่าคิวจะเสร็จหรือยัง**
   * ยังไม่เสร็จ = ได้ประโยคสำรองที่เติมข้อมูลจริงของนักเรียนแล้ว ไม่ใช่ช่องว่างหรือตัวโหลด
   */
  async storyFor(studentId: string, storyId: string, input: StoryInput): Promise<StoryItem> {
    const job = await this.store.findByStudent(studentId)
    const ready = job?.status === 'done' ? job.result : null
    const fromQueue = ready?.stories.find((s) => s.id === storyId)
    if (fromQueue) return fromQueue

    const fallback = fallbackStorySet(input, job ? 'not-requested' : 'no-api-key')
    return (
      fallback.stories.find((s) => s.id === storyId) ?? {
        id: storyId,
        kind: 'mission',
        missionId: null,
        text: fallback.stories[0]?.text ?? '',
        source: 'fallback',
        fallbackReason: 'not-requested',
      }
    )
  }

  status(): Promise<Record<StoryJobStatus, number>> {
    return this.store.countByStatus()
  }
}

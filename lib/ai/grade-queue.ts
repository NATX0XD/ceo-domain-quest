/**
 * คิวตรวจงานเบื้องหลัง — ย้ายการตรวจด้วย AI ออกจากการรอของนักเรียน
 *
 * ทำไม: นาทีที่ 40-50 นักเรียน 30 คนกดส่งงานพร้อมกัน ถ้ารอ AI ตรวจสด ๆ
 * ต่อให้ยืดงบเป็น 10 วินาทีก็ยังคอขวด และเด็กนั่งมองจอค้างคือบทเรียนพัง
 * ส่วนครูตรวจยืนยันคะแนนตอนนาทีที่ 50-55 หรือหลังคาบ ความหน่วงตรงนั้นไม่กระทบใคร
 *
 * กติกา 3 ข้อของไฟล์นี้:
 * 1. **นักเรียนได้ผลจากกฎทันที** (0 มิลลิวินาที) พร้อมดาว ไม่ต้องรอ AI เลย
 * 2. AI ตรวจทีหลังแบบไม่มีเส้นตาย 5 วินาที ทยอยไปตามโควตาจริงของผู้ให้บริการ
 * 3. **ผลของ AI เป็นข้อเสนอคู่ขนาน ห้ามไปเปลี่ยนดาวที่นักเรียนเห็นไปแล้ว**
 *    ครูเห็นทั้งสองค่าพร้อมป้ายว่าอันไหนมาจากกฎ อันไหน AI เสนอ แล้วครูเป็นคนตัดสิน
 */
import { fallbackGradeReason } from './fallback'
import type { AiClient, GradeReasonInput, GradeReasonResult } from './types'

export type GradeJobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface GradeJob {
  id: string
  studentId: string
  /** รหัสใบงานในตาราง submissions ใช้เขียนผลกลับไปที่แถวเดิม */
  submissionId: string
  input: GradeReasonInput
  status: GradeJobStatus
  /** จำนวนครั้งที่ลองตรวจแล้ว ใช้กันงานที่พังซ้ำ ๆ วนไม่จบ */
  attempts: number
  /** ผลที่ AI เสนอ มีค่าเมื่อ status เป็น done */
  aiResult: GradeReasonResult | null
  /** เหตุผลที่ตรวจไม่สำเร็จ มีค่าเมื่อ status เป็น failed */
  error: string | null
  createdAt: number
  updatedAt: number
}

/**
 * ที่เก็บสถานะคิว — **ต้องทนการรีสตาร์ต** งานที่ค้างต้องไม่หายเมื่อเซิร์ฟเวอร์ดับ
 * ตอนนี้มีตัวในหน่วยความจำไว้ใช้ทดสอบ ส่วนตัวจริงต้องเก็บลงฐานข้อมูล
 * (ดูรายการคอลัมน์ที่ต้องขอไว้ใน result-t31.md — เป็นของอีก session)
 */
export interface GradeJobStore {
  enqueue(job: GradeJob): Promise<void>
  /** หยิบงานที่รอคิวมา 1 ชิ้นแล้วทำเครื่องหมายว่ากำลังตรวจ คืน null เมื่อคิวว่าง */
  claimNext(now: number): Promise<GradeJob | null>
  complete(jobId: string, aiResult: GradeReasonResult, now: number): Promise<void>
  fail(jobId: string, error: string, now: number, retry: boolean): Promise<void>
  get(jobId: string): Promise<GradeJob | null>
  /** งานของนักเรียนคนนี้ ใช้ให้แผงครูดึงผลที่ AI เสนอมาแสดงคู่กับผลจากกฎ */
  listByStudent(studentId: string): Promise<GradeJob[]>
  countByStatus(): Promise<Record<GradeJobStatus, number>>
}

/** ที่เก็บในหน่วยความจำ — ใช้ในเทสต์และตอนยังไม่ได้ต่อฐานข้อมูล หายเมื่อรีสตาร์ต */
export class InMemoryGradeJobStore implements GradeJobStore {
  private readonly jobs = new Map<string, GradeJob>()

  async enqueue(job: GradeJob): Promise<void> {
    this.jobs.set(job.id, { ...job })
  }

  async claimNext(now: number): Promise<GradeJob | null> {
    for (const job of this.jobs.values()) {
      if (job.status === 'pending') {
        const claimed = { ...job, status: 'running' as const, attempts: job.attempts + 1, updatedAt: now }
        this.jobs.set(job.id, claimed)
        return claimed
      }
    }
    return null
  }

  async complete(jobId: string, aiResult: GradeReasonResult, now: number): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return
    this.jobs.set(jobId, { ...job, status: 'done', aiResult, error: null, updatedAt: now })
  }

  async fail(jobId: string, error: string, now: number, retry: boolean): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return
    this.jobs.set(jobId, { ...job, status: retry ? 'pending' : 'failed', error, updatedAt: now })
  }

  async get(jobId: string): Promise<GradeJob | null> {
    return this.jobs.get(jobId) ?? null
  }

  async listByStudent(studentId: string): Promise<GradeJob[]> {
    return [...this.jobs.values()].filter((j) => j.studentId === studentId)
  }

  async countByStatus(): Promise<Record<GradeJobStatus, number>> {
    const counts: Record<GradeJobStatus, number> = { pending: 0, running: 0, done: 0, failed: 0 }
    for (const job of this.jobs.values()) counts[job.status] += 1
    return counts
  }
}

/** ผลที่ส่งกลับให้นักเรียนทันทีตอนกดส่ง */
export interface SubmitResult {
  /** ผลจากกฎล้วน คำนวณเสร็จในทันที นี่คือคะแนนและดาวที่นักเรียนเห็น */
  rules: GradeReasonResult
  /** รหัสงานในคิว ใช้ตามผลที่ AI เสนอทีหลัง */
  jobId: string
}

export interface BackgroundGraderOptions {
  client: AiClient
  store: GradeJobStore
  /** เวลาปัจจุบัน ใส่ของปลอมได้ในเทสต์ */
  now?: () => number
  /** ลองตรวจซ้ำได้กี่ครั้งก่อนยอมแพ้ */
  maxAttempts?: number
  /** ตรวจพร้อมกันกี่งาน ตั้งต่ำไว้เพราะคิวจำกัดอัตราคุมอยู่แล้ว */
  concurrency?: number
  onJobDone?: (job: GradeJob) => void
}

export const DEFAULT_MAX_ATTEMPTS = 3

/**
 * งบเวลาของฝั่งเบื้องหลัง — ยาวได้เพราะไม่มีใครนั่งรอหน้าจอ
 * ต้องสร้าง AiClient ด้วยค่านี้ ไม่ใช่ค่า 5 วินาทีของฝั่งนักเรียน
 * ไม่งั้นการตรวจจะ timeout ทุกงานแล้วไม่ได้ผลจาก AI เลย
 */
export { BACKGROUND_TIMEOUT_MS } from './index'

/**
 * ตัวตรวจงานเบื้องหลัง
 * ไม่มีเส้นตาย 5 วินาทีเหมือนฝั่งนักเรียน เพราะไม่มีใครนั่งรออยู่หน้าจอ
 * ถ้าผู้ให้บริการคิวเต็ม งานจะถูกโยนกลับเข้าคิวแล้วลองใหม่รอบถัดไป
 */
export class BackgroundGrader {
  private readonly client: AiClient
  private readonly store: GradeJobStore
  private readonly now: () => number
  private readonly maxAttempts: number
  private readonly concurrency: number
  private readonly onJobDone?: (job: GradeJob) => void
  private sequence = 0

  constructor(options: BackgroundGraderOptions) {
    this.client = options.client
    this.store = options.store
    this.now = options.now ?? (() => Date.now())
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.concurrency = Math.max(1, options.concurrency ?? 2)
    this.onJobDone = options.onJobDone
  }

  /**
   * นักเรียนกดส่งงาน — ได้ผลจากกฎกลับไปทันที แล้วฝากงานไว้ให้ AI ตรวจทีหลัง
   * ฟังก์ชันนี้ต้องไม่รอเน็ตเลยแม้แต่นิดเดียว
   */
  async submit(input: GradeReasonInput & { submissionId: string }): Promise<SubmitResult> {
    const rules = fallbackGradeReason(input, 'not-requested')
    const at = this.now()
    this.sequence += 1
    const jobId = `grade-${input.submissionId}-${this.sequence}`

    await this.store.enqueue({
      id: jobId,
      studentId: input.studentId ?? '',
      submissionId: input.submissionId,
      input,
      status: 'pending',
      attempts: 0,
      aiResult: null,
      error: null,
      createdAt: at,
      updatedAt: at,
    })

    return { rules, jobId }
  }

  /** ตรวจงานที่ค้างอยู่ 1 ชิ้น คืน false เมื่อคิวว่าง */
  private async processOne(): Promise<boolean> {
    const job = await this.store.claimNext(this.now())
    if (!job) return false

    try {
      const aiResult = await this.client.gradeReason(job.input)
      if (aiResult.source !== 'ai') {
        // ยังไม่ได้ AI จริง (คิวเต็มหรือผู้ให้บริการล่ม) โยนกลับเข้าคิวไว้ลองใหม่
        throw new Error(`ยังไม่ได้ผลจาก AI (${aiResult.fallbackReason})`)
      }
      await this.store.complete(job.id, aiResult, this.now())
      this.onJobDone?.({ ...job, status: 'done', aiResult, updatedAt: this.now() })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retry = job.attempts < this.maxAttempts
      await this.store.fail(job.id, message, this.now(), retry)
      if (!retry) this.onJobDone?.({ ...job, status: 'failed', error: message, updatedAt: this.now() })
    }
    return true
  }

  /**
   * ตรวจจนคิวว่าง — ใช้ตอนครูกด "ให้ AI ช่วยตรวจทั้งห้อง" หรือตอนรันเป็นงานเบื้องหลัง
   * @param maxJobs กันวนไม่จบเมื่อมีงานถูกโยนกลับเข้าคิวซ้ำ ๆ
   */
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

  /** ผลที่ AI เสนอสำหรับนักเรียนคนนี้ (ล่าสุดก่อน) — แผงครูใช้แสดงคู่กับผลจากกฎ */
  async aiSuggestionFor(studentId: string): Promise<GradeReasonResult | null> {
    const jobs = await this.store.listByStudent(studentId)
    const done = jobs.filter((j) => j.status === 'done' && j.aiResult).sort((a, b) => b.updatedAt - a.updatedAt)
    return done[0]?.aiResult ?? null
  }

  status(): Promise<Record<GradeJobStatus, number>> {
    return this.store.countByStatus()
  }
}

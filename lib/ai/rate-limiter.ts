/**
 * คิวจำกัดอัตราฝั่งเซิร์ฟเวอร์ — กันยิงพรวดจนโดน 429 ตอนนักเรียนทั้งห้องกดพร้อมกัน
 *
 * ทำไมต้องมี: ห้องหนึ่งมี 30 คน ถ้ากดขอคำใบ้พร้อมกันแล้วเรายิงออกไปทั้ง 30 คำขอในวินาทีเดียว
 * ผู้ให้บริการจะตอบ 429 แทบทั้งหมด ผลคือทั้งห้องตกไปใช้กฎล้วนพร้อมกันโดยไม่จำเป็น
 * คิวนี้ทำให้คำขอไหลออกตามลิมิตจริงของแต่ละเจ้า
 *
 * **กฎเหล็ก: ถ้าต้องรอคิวนานเกินงบเวลาที่เหลือ ให้ข้ามผู้ให้บริการนั้นทันที**
 * นักเรียนนั่งมองหน้าจอค้างคือบทเรียนพัง การตอบด้วยกฎล้วนใน 0 วินาทีดีกว่ารอ AI 5 วินาที
 *
 * ลิมิตจริง ณ 29 กันยายน 2569 (ดู result-t30.md สำหรับที่มา):
 * - Typhoon typhoon-v2.5-30b-a3b-instruct = 5 RPS · 200 RPM
 * - Gemini free tier สาย Flash Lite = 15 RPM · สาย Flash = 5 RPM (คอขวดคือ RPM ไม่ใช่ TPM)
 */

export interface RateLimit {
  /** คำขอต่อวินาที */
  rps: number
  /** คำขอต่อนาที */
  rpm: number
}

export interface LimiterOptions {
  /** ฟังก์ชันอ่านเวลาปัจจุบัน ใส่ของปลอมได้ในเทสต์ */
  now?: () => number
  /** ฟังก์ชันหน่วงเวลา ใส่ของปลอมได้ในเทสต์ */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * คิวแบบหน้าต่างเลื่อน 2 ชั้น (วินาทีและนาที) ต่อผู้ให้บริการหนึ่งเจ้า
 * เก็บเวลาที่ยิงไปแล้วไว้ในหน่วยความจำของ process เดียว เหมือน lib/rate-limit.ts
 */
export class ProviderRateLimiter {
  private readonly history = new Map<string, number[]>()
  private readonly limits = new Map<string, RateLimit>()
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(limits: Record<string, RateLimit>, options: LimiterOptions = {}) {
    for (const [key, limit] of Object.entries(limits)) this.limits.set(key, limit)
    this.now = options.now ?? (() => Date.now())
    this.sleep = options.sleep ?? defaultSleep
  }

  /**
   * ต้องรออีกกี่มิลลิวินาทีถึงจะยิงคำขอถัดไปได้โดยไม่เกินลิมิต
   *
   * คิดจาก **ช่องที่ถูกจองไว้แล้ว** ซึ่งเป็นเวลาในอนาคตได้ (ดู acquire)
   * สูตร: ช่องใหม่ต้องอยู่หลังช่องที่ `rps` ช่องก่อนหน้าอย่างน้อย 1 วินาที
   * และหลังช่องที่ `rpm` ช่องก่อนหน้าอย่างน้อย 1 นาที
   */
  waitMs(provider: string, at: number = this.now()): number {
    const limit = this.limits.get(provider)
    if (!limit) return 0

    const stamps = (this.history.get(provider) ?? []).filter((t) => at - t < 60_000)
    this.history.set(provider, stamps)

    const rpsIndex = limit.rps > 0 ? stamps.length - limit.rps : -1
    const rpmIndex = limit.rpm > 0 ? stamps.length - limit.rpm : -1
    const earliestByRps = rpsIndex >= 0 ? stamps[rpsIndex]! + 1000 : at
    const earliestByRpm = rpmIndex >= 0 ? stamps[rpmIndex]! + 60_000 : at

    return Math.max(0, earliestByRps - at, earliestByRpm - at)
  }

  /**
   * ขอคิวสำหรับยิง 1 คำขอ
   * @param budgetMs เวลาที่เหลือให้รอได้ ถ้าคิวยาวกว่านี้จะคืน false ทันทีเพื่อให้ผู้เรียกไปใช้ทางอื่น
   * @returns true เมื่อจองคิวได้แล้ว (บันทึกเวลาไว้เรียบร้อย) · false เมื่อรอไม่ไหว
   */
  async acquire(provider: string, budgetMs: number): Promise<boolean> {
    const at = this.now()
    const wait = this.waitMs(provider, at)
    if (wait > budgetMs) return false

    /**
     * **จองคิวทันที ไม่ใช่หลังนอนตื่น**
     *
     * ของเดิมนอนก่อนแล้วค่อยบันทึกเวลา ผลคือคำขอที่มาพร้อมกัน 30 คำขอ
     * เห็นคิวว่างเหมือนกันหมด (ยังไม่มีใครบันทึกอะไรเลย) แล้วยิงออกไปพรวดเดียวทั้งหมด
     * คิวจึงไม่เคยกันอะไรได้จริงในกรณีเดียวกับที่มันถูกเขียนขึ้นมาเพื่อกัน
     *
     * บันทึกเวลา **ของช่องที่จองได้** (ตอนนี้ + เวลารอ) ไว้ก่อนนอน คนถัดไปจึงเห็นช่องที่ถูกจองแล้ว
     * ค่าที่บันทึกเป็นเวลาในอนาคตได้ หน้าต่างเลื่อนคิดจาก `at - t` จึงยังนับถูกและยังเรียงจากน้อยไปมาก
     */
    const slotAt = at + wait
    const stamps = this.history.get(provider) ?? []
    stamps.push(slotAt)
    this.history.set(provider, stamps)

    if (wait > 0) await this.sleep(wait)
    return true
  }

  /** ล้างประวัติ ใช้ตอนเริ่มคาบใหม่และในเทสต์ */
  reset(provider?: string): void {
    if (provider) this.history.delete(provider)
    else this.history.clear()
  }

  /** จำนวนคำขอที่ยิงไปแล้วในนาทีที่ผ่านมา ใช้ทำแผงสถานะให้ครูดู */
  usedInLastMinute(provider: string, at: number = this.now()): number {
    return (this.history.get(provider) ?? []).filter((t) => at - t < 60_000).length
  }
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * ลิมิตเริ่มต้นที่ปลอดภัย อ่านทับได้จาก env เมื่อเปิด billing หรือย้าย tier
 * ตั้งต่ำกว่าลิมิตจริงเล็กน้อยเผื่อคำขอจากเครื่องอื่นที่ใช้คีย์เดียวกัน
 */
export function limitsFromEnv(env: Record<string, string | undefined> = {}): Record<string, RateLimit> {
  return {
    typhoon: {
      rps: readNumber(env.TYPHOON_RPS, 4), // ลิมิตจริง 5 RPS
      rpm: readNumber(env.TYPHOON_RPM, 180), // ลิมิตจริง 200 RPM
    },
    gemini: {
      /**
       * คอขวดจริงของ free tier คือ **RPM ไม่ใช่ RPS** (Google ไม่ประกาศลิมิตต่อวินาที)
       * ค่านี้จึงมีไว้ "เกลี่ยให้ไม่กระแทก" เฉย ๆ ตั้งไว้ 1 แล้วคำขอที่ 3 ต้องรอ 2 วินาที
       * ซึ่งเกินงบของงานที่ผู้เรียนนั่งรอ ทั้งที่เพดานรายนาทียังเหลือ — เสียโอกาสเปล่า
       * ตั้ง 3 จึงรับชุดที่กดพร้อมกันได้จริงโดยยังไม่ทะลุเพดานรายนาที
       */
      rps: readNumber(env.GEMINI_RPS, 3),
      rpm: readNumber(env.GEMINI_RPM, 12), // free tier สาย Flash Lite = 15 RPM
    },
  }
}

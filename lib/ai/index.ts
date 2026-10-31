/**
 * ตัวเลือกเส้นทางของชั้น AI — ที่เดียวในระบบที่ตัดสินใจว่าจะเรียกโมเดลหรือใช้กฎล้วน
 *
 * กติกา:
 * 1. ไม่มี API key → ใช้ทางสำรองทันที **ไม่แตะเน็ตเลยแม้แต่ครั้งเดียว**
 * 2. มี key → เรียกพร้อม timeout 5 วินาที พังหรือช้าเกิน ตกไปใช้ทางสำรองเสมอ
 * 3. ไม่ throw ให้ผู้ใช้เห็นไม่ว่ากรณีใด กลางคาบเรียนห้ามมีหน้าจอ error
 * 4. จำกัดจำนวนครั้งต่อคนต่อคาบ กันทั้งการเล่นนอกเรื่องและค่าใช้จ่ายบานปลาย
 *
 * ผลลัพธ์ทุกก้อนมี source ติดมาเสมอ ครูจึงแยกออกว่าอันไหน AI เสนอ อันไหนกฎล้วน
 * และคะแนนทุกก้อนมี needsTeacherConfirm เป็น true — AI ไม่เคยตัดสินเอง
 */
import {
  buildGradeResult,
  fallbackGradeReason,
  fallbackHint,
  fallbackSimulateCustomer,
} from './fallback'
import { callGemini } from './gemini'
import { callCloudflare } from './cloudflare'
import { fallbackLearnCheck, parseLearnCheck } from './learn-check'
import {
  gradeReasonPrompt,
  hintPrompt,
  learnCheckPrompt,
  simulateCustomerPrompt,
  storyPrompt,
} from './prompts'
import {
  RUBRIC_DIMENSION_IDS,
  clampDimensionScore,
  findDimension,
  levelLabel,
  resolveEmphasisDimension,
} from './rubric'
import { expectedLatencyMs, fitsBudget, type AiTaskId } from './latency'
import { ProviderRateLimiter, limitsFromEnv } from './rate-limiter'
import { buildStoryResult, fallbackStorySet } from './story'
import { callTyphoon } from './typhoon'
import { containsTopicViolation, guardAiText, topicKeywords } from './topic-lock'
import type {
  AiClient,
  AiProvider,
  FallbackReason,
  GradeReasonInput,
  GradeReasonResult,
  HintInput,
  HintResult,
  LearnCheckInput,
  LearnCheckResult,
  RubricDimensionScore,
  SimulateCustomerInput,
  SimulateCustomerResult,
  StoryInput,
  StoryResult,
} from './types'

export const DEFAULT_TIMEOUT_MS = 5000
export const DEFAULT_MAX_CALLS_PER_STUDENT = 12

/**
 * งบเวลาของงานที่อยู่ในคิวเบื้องหลัง — **แหล่งความจริงเดียวของทั้งระบบ**
 *
 * ยาวได้เพราะไม่มีใครนั่งรอหน้าจอ (ตรวจงานเบื้องหลัง · แต่งเรื่องเฉพาะคน)
 * เดิมเลข 60_000 ถูกเขียนซ้ำไว้ 2 ที่ (story-queue กับ grade-queue) ซึ่งเลื่อนหลุดจากกันได้
 * ตอนนี้ทั้งสองไฟล์ re-export ค่านี้ ไม่มีใครตั้งเลขเอง
 */
export const BACKGROUND_TIMEOUT_MS = 60_000

/**
 * งบเวลาตั้งต้น **แยกตามบริบท ไม่ใช่ค่าเดียวทั้งระบบ**
 *
 * - คำใบ้ / ลูกค้าจำลอง / ตรวจงานที่สถานี = ผู้เรียนนั่งรอหน้าจอ ต้องจบใน 5 วินาที
 * - แต่งเรื่องเฉพาะคน = งานคิวเบื้องหลัง **ไม่มีใครนั่งรอ** ให้เวลายาวได้
 *   (คิวตรวจงานเบื้องหลังส่ง timeoutMs ของตัวเองมาอยู่แล้ว ดู BACKGROUND_TIMEOUT_MS)
 *
 * ผู้เรียกที่ส่ง `timeoutMs` มาเองยังชนะตารางนี้เสมอ
 */
export const TASK_TIMEOUT_MS: Record<AiTask, number> = {
  hint: DEFAULT_TIMEOUT_MS,
  customer: DEFAULT_TIMEOUT_MS,
  grade: DEFAULT_TIMEOUT_MS,
  story: BACKGROUND_TIMEOUT_MS,
  /** ตรวจคำตอบปลายเปิดของเส้นทางเรียน — ผู้เรียนรอผลอยู่หน้าจอ */
  learnCheck: DEFAULT_TIMEOUT_MS,
}

/** เวลาที่กันไว้ให้คำขอจริงหลังรอคิว ถ้าเหลือน้อยกว่านี้ไม่ต้องเข้าคิวแล้ว ไปใช้ทางถัดไปเลย */
const CALL_RESERVE_MS = 700
/** กันเวลาไว้ให้ผลลัพธ์เดินทางกลับถึงผู้เรียกภายในงบ ไม่ทะลุแม้แต่มิลลิวินาทีเดียว */
const DEADLINE_MARGIN_MS = 50

type EnvLike = Record<string, string | undefined>

export interface AiClientDeps {
  /** ตัวแปรสภาพแวดล้อม ใส่เองได้ในเทสต์ ปกติใช้ process.env */
  env?: EnvLike
  /** ตัวยิง HTTP ใส่ของปลอมได้ในเทสต์ ไม่ใส่จะใช้ fetch ของ runtime */
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxCallsPerStudent?: number
  /** เรียกทุกครั้งที่ลองผู้ให้บริการหนึ่งชั้นจบ ใช้ log ว่าใครพังเพราะอะไร */
  onAttempt?: (attempt: ProviderAttempt) => void
  /** คิวจำกัดอัตรา ใส่ของตัวเองได้ในเทสต์ ไม่ใส่จะใช้คิวกลางที่แชร์ทั้ง process */
  limiter?: ProviderRateLimiter
}

/**
 * คิวกลางที่ทุก request ในเซิร์ฟเวอร์เดียวกันใช้ร่วมกัน
 * ต้องเป็นตัวเดียวทั้ง process ไม่งั้นนักเรียน 30 คนจะได้คิวคนละใบแล้วยิงพรวดเหมือนเดิม
 */
let sharedLimiter: ProviderRateLimiter | null = null
const providerBreakers = new Map<string, number>()

function getSharedLimiter(env: EnvLike): ProviderRateLimiter {
  if (!sharedLimiter) sharedLimiter = new ProviderRateLimiter(limitsFromEnv(env))
  return sharedLimiter
}

/** ล้างคิว ใช้ตอนเริ่มคาบใหม่และในเทสต์ */
export function resetAiRateLimiter(): void {
  sharedLimiter = null
  providerBreakers.clear()
}

interface ResolvedProvider {
  provider: Exclude<AiProvider, 'rules'>
  apiKey: string
  accountId?: string
}

export interface ProviderRegistryEntry {
  provider: Exclude<AiProvider, 'rules'>
  adultOnly: boolean
  configured: (env: EnvLike) => boolean
}

export const PROVIDER_REGISTRY: readonly ProviderRegistryEntry[] = [
  { provider: 'typhoon', adultOnly: false, configured: (env) => Boolean(env.TYPHOON_API_KEY?.trim()) },
  { provider: 'gemini', adultOnly: true, configured: (env) => Boolean(env.GEMINI_API_KEY?.trim()) },
  { provider: 'cloudflare', adultOnly: false, configured: (env) => Boolean(env.CF_ACCOUNT_ID?.trim() && env.CF_AI_TOKEN?.trim()) },
]

/** ผู้ให้บริการที่ policy ห้ามใช้กับผู้เยาว์จนกว่าจะตรวจเงื่อนไขล่าสุดและเปิดโหมดที่เหมาะสม */
export const ADULT_ONLY_PROVIDERS = ['gemini', 'groq'] as const

/** ชนิดงานที่เรียกโมเดล ใช้เลือกผู้ให้บริการที่เหมาะกับงานนั้น */
export type AiTask = AiTaskId

/**
 * เลือกผู้ให้บริการจาก key ที่มีจริง คืน null เมื่อไม่มี key เลย
 * ลำดับขึ้นกับ **ชนิดงานและงบเวลาที่มีจริง** ดู providerChain
 */
export function resolveProvider(
  env: EnvLike,
  task: AiTask = 'grade',
  budgetMs: number = TASK_TIMEOUT_MS[task],
): ResolvedProvider | null {
  return providerChain(env, task, budgetMs)[0] ?? null
}

/**
 * ลำดับผู้ให้บริการที่จะลองทีละตัว — **ตัดสินจากเวลาตอบที่วัดได้จริงกับงบเวลาที่มี**
 *
 * เดิมพารามิเตอร์ `task` ถูกรับมาแล้วทิ้ง ทุกงานจึงได้ลำดับ typhoon → gemini เหมือนกันหมด
 * ผลคืองานตรวจคำตอบ (Typhoon ใช้ 13.3 วินาที) ถูกยิงเป็นชั้นแรกในงบ 5 วินาที
 * **หมดเวลา 100% ทุกครั้ง** แล้วยังเผางบไปครึ่งหนึ่ง เหลือให้ Gemini ไม่พอทำงาน
 *
 * กติกาใหม่ 2 ชั้น (ตัวเลขจาก lib/ai/latency.ts ซึ่งวัดเองเมื่อ 30 กันยายน 2569)
 * 1. **ตัดคนที่ทำไม่ทันออกไปท้ายแถว** — เจ้าที่เวลาตอบเกินงบ ไม่ควรได้เป็นชั้นแรก
 * 2. **ในกลุ่มที่ทำทัน เรียงตามความจุ ไม่ใช่ความเร็ว** — เร็วกว่า 1 วินาทีไม่มีความหมาย
 *    ถ้ารับพร้อมกันได้แค่คนเดียว Typhoon 4 RPS รับห้อง 30 คนไหว Gemini free tier 1 RPS ไม่ไหว
 *    (อ่านความจุจาก limitsFromEnv ตัวเดียวกับที่คิวใช้ ปรับผ่าน env ได้เมื่อเปิด billing)
 *
 * ผลที่ได้ต่อชนิดงาน เมื่อมีคีย์ทั้งสองเจ้า
 * | งาน | งบ 5 วินาที (ผู้เรียนรอ) | งบ 60 วินาที (คิวเบื้องหลัง) |
 * |---|---|---|
 * | คำใบ้ / ลูกค้าจำลอง | typhoon → gemini | typhoon → gemini |
 * | ตรวจคำตอบ | **gemini → typhoon** (typhoon 13.3 วิ ไม่ทัน) | typhoon → gemini |
 * | แต่งเรื่อง | **gemini → typhoon** | typhoon → gemini |
 * | ตรวจคำตอบเส้นทางเรียน (learnCheck) | typhoon → gemini (typhoon ~3.2 วิ ทันงบ) | typhoon → gemini |
 *
 * มีคีย์เจ้าเดียวก็ได้ลูกโซ่ยาว 1 ตัว ไม่มีคีย์เลยได้อาร์เรย์ว่าง = ใช้กฎทันทีโดยไม่แตะเน็ต
 */
export function providerChain(
  env: EnvLike,
  task: AiTask = 'grade',
  budgetMs: number = TASK_TIMEOUT_MS[task],
): ResolvedProvider[] {
  const chain: ResolvedProvider[] = []
  const typhoon = env?.TYPHOON_API_KEY?.trim()
  const gemini = env?.GEMINI_API_KEY?.trim()
  if (typhoon) chain.push({ provider: 'typhoon', apiKey: typhoon })
  if (gemini && env?.AI_MINORS_MODE !== '1') chain.push({ provider: 'gemini', apiKey: gemini })
  const cloudflareToken = env?.CF_AI_TOKEN?.trim()
  const cloudflareAccount = env?.CF_ACCOUNT_ID?.trim()
  if (cloudflareToken && cloudflareAccount) {
    chain.push({ provider: 'cloudflare', apiKey: cloudflareToken, accountId: cloudflareAccount })
  }
  if (chain.length < 2) return chain

  const limits = limitsFromEnv(env)
  const speed = (p: ResolvedProvider) => expectedLatencyMs(p.provider, task, env)

  return [...chain].sort((a, b) => {
    const aFits = fitsBudget(a.provider, task, budgetMs, env)
    const bFits = fitsBudget(b.provider, task, budgetMs, env)
    if (aFits !== bFits) return aFits ? -1 : 1
    // ไม่ทันทั้งคู่ = ไม่มีใครดีจริง เอาคนที่เร็วที่สุดไว้ก่อน อย่างน้อยมีโอกาสมากที่สุด
    if (!aFits) return speed(a) - speed(b)
    // ทำทันทั้งคู่ = เอาคนที่รับพร้อมกันได้มากกว่าไว้ก่อน ห้องเรียน 30 คนคอขวดอยู่ที่ความจุ
    const byCapacity = (limits[b.provider]?.rps ?? 0) - (limits[a.provider]?.rps ?? 0)
    return byCapacity !== 0 ? byCapacity : speed(a) - speed(b)
  })
}

/** บันทึกว่าแต่ละชั้นในลูกโซ่พังเพราะอะไร ใช้ตอบครูและตอน debug */
export interface ProviderAttempt {
  provider: Exclude<AiProvider, 'rules'>
  ok: boolean
  ms: number
  reason?: FallbackReason
  /** ข้อความ error ดิบ ใช้ตอน debug ไม่เคยแสดงให้ผู้เรียนเห็น */
  detail?: string
}

function readLimit(env: EnvLike, fallbackValue: number): number {
  const raw = Number(env?.AI_MAX_CALLS_PER_STUDENT)
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallbackValue
}

/** ตัวนับโควตารายคนต่อคาบ อยู่ในหน่วยความจำของ process เดียวเหมือน lib/rate-limit.ts */
const callCounts = new Map<string, number>()

/** ล้างตัวนับโควตา — ใช้ตอนเริ่มคาบใหม่และในเทสต์ */
export function resetAiQuota(studentId?: string): void {
  if (studentId) callCounts.delete(studentId)
  else callCounts.clear()
}

export function aiCallsUsed(studentId: string): number {
  return callCounts.get(studentId) ?? 0
}

/** ยิงคำขอพร้อมกำหนดเวลา ถ้าช้าเกินให้ยกเลิกคำขอด้วย AbortController */
async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('timeout'))
    }, timeoutMs)
  })

  try {
    return await Promise.race([run(controller.signal), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** แปลงผลที่โมเดลจัดรูปเป็นออบเจกต์ {"dim-naming": {...}} ให้กลายเป็นอาร์เรย์ที่เราคาดไว้ */
function toDimensionRows(data: unknown): unknown[] {
  const bag = (data as { dimensions?: unknown })?.dimensions ?? data
  if (typeof bag !== 'object' || bag === null) return []
  return Object.entries(bag as Record<string, unknown>)
    .filter(([key]) => RUBRIC_DIMENSION_IDS.includes(key))
    .map(([key, value]) =>
      typeof value === 'object' && value !== null ? { id: key, ...(value as object) } : value,
    )
}

function toFallbackReason(error: unknown): FallbackReason {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'timeout') return 'timeout'
  if (message.includes('JSON') || message.includes('เนื้อหา')) return 'bad-response'
  return 'request-failed'
}

export function createAiClient(deps: AiClientDeps = {}): AiClient {
  const env = deps.env ?? (process.env as EnvLike)
  const maxCalls = deps.maxCallsPerStudent ?? readLimit(env, DEFAULT_MAX_CALLS_PER_STUDENT)
  const limiter = deps.limiter ?? getSharedLimiter(env)

  /**
   * งบเวลาของงานหนึ่งชนิด — ผู้เรียกที่ส่ง timeoutMs มาเองชนะเสมอ
   * ไม่ส่งมาจะได้ค่าตามบริบทของงานนั้น (งานที่ผู้เรียนรอ 5 วินาที · งานคิวเบื้องหลังยาวกว่าได้)
   */
  function budgetFor(task: AiTask): number {
    return deps.timeoutMs ?? TASK_TIMEOUT_MS[task]
  }

  /**
   * เช็กว่าเรียกโมเดลได้หรือไม่ และนับโควตาให้เรียบร้อยก่อนยิง
   * คืนเหตุผลของการไม่เรียก เพื่อเอาไปติดกับผลลัพธ์ให้ครูเห็น
   */
  function gate(studentId: string | undefined, task: AiTask): ResolvedProvider[] | FallbackReason {
    const chain = providerChain(env, task, budgetFor(task))
    if (chain.length === 0) return 'no-api-key' // ไม่มี key แปลว่าไม่ต้องแตะ fetch เลย
    if (!deps.fetchImpl && typeof fetch !== 'function') return 'request-failed'

    if (studentId) {
      const used = callCounts.get(studentId) ?? 0
      if (used >= maxCalls) return 'quota-exceeded'
      callCounts.set(studentId, used + 1)
    }
    return chain
  }

  /**
   * ลองผู้ให้บริการทีละตัวตามลูกโซ่ จนกว่าจะมีตัวใดตอบในรูปแบบที่ใช้ได้
   *
   * **งบเวลารวมทั้งลูกโซ่ต้องไม่เกิน timeoutMs (ค่าเริ่มต้น 5 วินาที)** เพราะนักเรียนรออยู่หน้าจอ
   * แบ่งงบให้แต่ละชั้นจากเวลาที่เหลือหารจำนวนชั้นที่ยังไม่ได้ลอง ตัวแรกพังเร็วตัวหลังจึงได้เวลาเพิ่ม
   * @param parse แปลงผลดิบของโมเดลเป็นผลลัพธ์ที่ใช้ได้ โยน error ถ้ารูปแบบใช้ไม่ได้
   */
  async function runChain<T>(
    chain: ResolvedProvider[],
    task: AiTask,
    buildPrompt: () => ReturnType<typeof hintPrompt>,
    parse: (raw: unknown, provider: Exclude<AiProvider, 'rules'>) => T,
  ): Promise<{ value: T | null; attempts: ProviderAttempt[]; lastReason: FallbackReason }> {
    const attempts: ProviderAttempt[] = []
    const startedAt = Date.now()
    const timeoutMs = budgetFor(task)
    let lastReason: FallbackReason = 'request-failed'
    /** ยิงจริงไปแล้วอย่างน้อย 1 เจ้าหรือยัง — ใช้ตัดสินว่าข้ามเจ้าที่ช้าเกินงบได้ไหม */
    let triedAnyProvider = false

    for (let i = 0; i < chain.length; i++) {
      const resolved = chain[i]!
      const breakerUntil = providerBreakers.get(resolved.provider) ?? 0
      if (breakerUntil > Date.now()) {
        const skipped: ProviderAttempt = { provider: resolved.provider, ok: false, ms: 0, reason: 'request-failed', detail: 'provider circuit breaker ยังทำงานอยู่' }
        attempts.push(skipped)
        deps.onAttempt?.(skipped)
        lastReason = 'request-failed'
        continue
      }
      const elapsed = Date.now() - startedAt
      const remaining = timeoutMs - elapsed
      if (remaining <= 0) {
        attempts.push({ provider: resolved.provider, ok: false, ms: 0, reason: 'timeout' })
        lastReason = 'timeout'
        break
      }

      const expected = expectedLatencyMs(resolved.provider, task, env)

      /**
       * แบ่งงบแบบ **เผื่อเฉพาะชั้นถัดไปที่ยังมีโอกาสจริง**
       *
       * ของเดิมหารเวลาที่เหลือด้วยจำนวนชั้นเสมอ (5000/2 = 2500) ซึ่งผิดสองทาง:
       * ชั้นแรกที่ตอบทันอยู่แล้วโดนบีบเหลือครึ่งเดียว และชั้นถัดไปที่ยังไงก็ไม่ทัน
       * ก็ยังถูกกันเวลาไว้ให้เปล่า ๆ
       * ตอนนี้กันไว้ให้ชั้นถัดไปเฉพาะเมื่อ **เวลาที่เหลือพอให้ทั้งคู่ได้ลองจริง**
       * ไม่งั้นชั้นนี้ได้งบที่เหลือทั้งก้อน
       */
      const reserve = chain.slice(i + 1).reduce((need, next) => {
        if (need > 0) return need
        const nextExpected = expectedLatencyMs(next.provider, task, env)
        return nextExpected + expected + DEADLINE_MARGIN_MS <= remaining ? nextExpected : 0
      }, 0)
      const slice = remaining - reserve

      /**
       * งบที่เหลือไม่พอให้เจ้านี้ตอบทันแน่ ๆ = **ข้ามไปเลย อย่าเผางบทิ้ง**
       * นี่คือต้นเหตุเดิมที่ทำให้ตรวจคำตอบไม่เคยได้ AI: Typhoon ใช้ 13.3 วินาที
       * แต่ถูกยิงด้วยงบ 2.5 วินาที หมดเวลาทุกครั้งแล้วกินงบไปครึ่งหนึ่งของทั้งลูกโซ่
       *
       * ⚠️ ข้ามได้ **เฉพาะเมื่อมีเจ้าอื่นในลูกโซ่ที่ทำทันจริง** เท่านั้น
       *    ไม่งั้นตารางเวลาที่ล้าสมัยจะปิดสวิตช์ AI ทั้งระบบโดยไม่เคยลองยิงสักครั้ง
       *    ผู้ให้บริการอาจเร็วกว่าที่วัดไว้เมื่อวาน — ต้องให้โอกาสเสมอถ้าไม่มีทางเลือกอื่น
       */
      const laterOptionFits = chain
        .slice(i + 1)
        .some((other) => fitsBudget(other.provider, task, remaining, env))
      if (expected > slice && (laterOptionFits || triedAnyProvider)) {
        lastReason = 'timeout'
        const tooSlow: ProviderAttempt = {
          provider: resolved.provider,
          ok: false,
          ms: 0,
          reason: 'timeout',
          detail: `งบที่เหลือ ${slice} ms ไม่พอกับเวลาตอบที่วัดได้ ${expected} ms ของงาน ${task} จึงข้ามไปโดยไม่ยิง`,
        }
        attempts.push(tooSlow)
        deps.onAttempt?.(tooSlow)
        continue
      }

      const attemptStart = Date.now()

      /**
       * เข้าคิวก่อนยิง คิวยาวเกินงบเวลาที่เหลือ = ข้ามเจ้านี้ไปเลย ไม่ให้นักเรียนนั่งรอ
       * กันเวลาไว้ให้คำขอจริงตามเวลาตอบที่วัดได้ (อย่างน้อย CALL_RESERVE_MS)
       * ไม่งั้นรอคิวจนหมดงบแล้วยังไม่ได้ยิงเลย
       */
      const queueBudget =
        Math.min(slice, remaining) - Math.max(CALL_RESERVE_MS, expected + DEADLINE_MARGIN_MS)
      const gotSlot =
        limiter.waitMs(resolved.provider) === 0
          ? // คิวว่างอยู่แล้ว ยิงได้เลยไม่ต้องคิดเรื่องงบเวลารอ
            await limiter.acquire(resolved.provider, 0)
          : queueBudget > 0 && (await limiter.acquire(resolved.provider, queueBudget))
      if (!gotSlot) {
        lastReason = 'rate-limited'
        const skipped: ProviderAttempt = {
          provider: resolved.provider,
          ok: false,
          ms: Date.now() - attemptStart,
          reason: 'rate-limited',
          detail: 'คิวยาวเกินงบเวลาที่เหลือ ข้ามไปใช้ทางถัดไป',
        }
        attempts.push(skipped)
        deps.onAttempt?.(skipped)
        continue
      }

      // เวลาที่เหลือจริงหลังรอคิว — ต้องคิดใหม่ ไม่งั้นคำขอจะทะลุงบ 5 วินาทีเพราะไปหมดเวลากับคิว
      const afterQueue = timeoutMs - (Date.now() - startedAt)
      if (afterQueue <= 0) {
        lastReason = 'timeout'
        const late: ProviderAttempt = {
          provider: resolved.provider,
          ok: false,
          ms: Date.now() - attemptStart,
          reason: 'timeout',
          detail: 'หมดงบเวลาไปกับการรอคิว',
        }
        attempts.push(late)
        deps.onAttempt?.(late)
        break
      }

      try {
        triedAnyProvider = true
        // หัก DEADLINE_MARGIN_MS เพื่อให้ผลลัพธ์กลับถึงผู้เรียกภายในงบพอดี ไม่ใช่เกินไป 1-2 มิลลิวินาที
        const callBudget = Math.max(200, Math.min(slice, afterQueue) - DEADLINE_MARGIN_MS)
        const raw = await withTimeout(callBudget, (signal) => {
          // ชื่อรุ่นทับได้จาก env เผื่อผู้ให้บริการปลดระวางรุ่นกลางเทอม จะได้ไม่ต้องแก้โค้ด
          const options = {
            apiKey: resolved.apiKey,
            fetchImpl: deps.fetchImpl ?? fetch,
            signal,
            model:
              resolved.provider === 'gemini'
                ? env?.GEMINI_MODEL?.trim() || undefined
                : resolved.provider === 'typhoon'
                  ? env?.TYPHOON_MODEL?.trim() || undefined
                  : env?.CF_AI_MODEL?.trim() || undefined,
            baseUrl:
              resolved.provider === 'cloudflare'
                ? env?.CF_AI_BASE_URL?.trim() || undefined
                : undefined,
          }
          if (resolved.provider === 'gemini') return callGemini(buildPrompt(), options)
          if (resolved.provider === 'cloudflare') {
            return callCloudflare(buildPrompt(), { ...options, accountId: resolved.accountId! })
          }
          return callTyphoon(buildPrompt(), options)
        })
        const value = parse(raw, resolved.provider)
        const okAttempt: ProviderAttempt = {
          provider: resolved.provider,
          ok: true,
          ms: Date.now() - attemptStart,
        }
        attempts.push(okAttempt)
        deps.onAttempt?.(okAttempt)
        return { value, attempts, lastReason }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        if (/สถานะ (429|5\d\d)\b/.test(detail)) providerBreakers.set(resolved.provider, Date.now() + 60_000)
        lastReason = toFallbackReason(error)
        const failed: ProviderAttempt = {
          provider: resolved.provider,
          ok: false,
          ms: Date.now() - attemptStart,
          reason: lastReason,
          detail,
        }
        attempts.push(failed)
        deps.onAttempt?.(failed)
      }
    }

    return { value: null, attempts, lastReason }
  }

  return {
    async hintFor(input: HintInput): Promise<HintResult> {
      const gated = gate(input?.studentId, 'hint')
      if (typeof gated === 'string') return fallbackHint(input, gated)

      const { value, lastReason } = await runChain(
        gated,
        'hint',
        () => hintPrompt(input),
        (raw, provider): HintResult => {
          const data = raw as { text?: unknown; hint?: unknown }
          // Typhoon ไม่มี schema บังคับเหมือน Gemini บางครั้งตั้งชื่อคีย์เองเป็น hint
          const hintText = typeof data?.text === 'string' ? data.text : data?.hint
          if (typeof hintText !== 'string' || hintText.trim().length === 0) {
            throw new Error('โมเดลไม่ได้ตอบกลับเป็น JSON ที่ใช้ได้')
          }
          const safeText = guardAiText(hintText, topicKeywords(`${input.missionId} ${input.draftName ?? ''} ${(input.keywords ?? []).join(' ')}`), fallbackHint(input, 'bad-response').text)
          if (safeText === fallbackHint(input, 'bad-response').text && hintText.trim() !== safeText) throw new Error('คำตอบหลุดหัวข้อหรือไม่ปลอดภัย')
          return {
            text: safeText,
            level: Math.max(1, Math.floor(input?.hintLevel ?? 1)),
            source: 'ai',
            provider,
            fallbackReason: null,
          }
        },
      )

      return value ?? fallbackHint(input, lastReason)
    },

    async gradeReason(input: GradeReasonInput): Promise<GradeReasonResult> {
      const gated = gate(input?.studentId, 'grade')
      if (typeof gated === 'string') return fallbackGradeReason(input, gated)

      const emphasisDimensionId = resolveEmphasisDimension(input?.emphasisCriterion)
      const { value, lastReason } = await runChain(
        gated,
        'grade',
        () => gradeReasonPrompt(input),
        (raw, provider): GradeReasonResult => {
          const data = raw as { dimensions?: unknown }
          // รับได้ทั้งอาร์เรย์ (ตามที่ขอ) และแบบที่โมเดลจัดเป็นออบเจกต์คีย์ตามรหัสด้าน
          const rows: unknown[] = Array.isArray(data?.dimensions)
            ? data.dimensions
            : toDimensionRows(data)

          // โมเดลต้องให้คะแนนครบทุกด้านตามไฟล์เนื้อหา ขาดด้านไหนถือว่าใช้ไม่ได้ ไปลองเจ้าถัดไป
          const dimensions: RubricDimensionScore[] = RUBRIC_DIMENSION_IDS.map((id) => {
            const row = rows.find(
              (r): r is Record<string, unknown> =>
                typeof r === 'object' && r !== null && (r as Record<string, unknown>).id === id,
            )
            const score = Number(row?.score)
            const evidence = typeof row?.evidence === 'string' ? row.evidence.trim() : ''
            const suggestion = typeof row?.suggestion === 'string' ? row.suggestion.trim() : ''
            if (!row || !Number.isFinite(score) || evidence.length === 0 || suggestion.length === 0) {
              throw new Error('โมเดลไม่ได้ตอบกลับเป็น JSON ที่ใช้ได้')
            }
            const clamped = clampDimensionScore(score)
            return {
              id,
              name: findDimension(id)?.name ?? id,
              score: clamped,
              levelLabel: levelLabel(id, clamped),
              evidence,
              suggestion,
              emphasized: id === emphasisDimensionId,
            }
          })

          if (containsTopicViolation(dimensions.flatMap((d) => [d.evidence, d.suggestion]), topicKeywords(`${input.tldId} ${input.domainName ?? ''} ${input.businessTypeId ?? ''} ${input.reasonText}`))) {
            throw new Error('คำตอบหลุดหัวข้อหรือไม่ปลอดภัย')
          }

          // คะแนนถ่วงน้ำหนักและดาวคำนวณฝั่งเราเสมอ ไม่เชื่อเลขคณิตของโมเดล
          return buildGradeResult(dimensions, emphasisDimensionId, {
            source: 'ai',
            provider,
            fallbackReason: null,
          })
        },
      )

      return value ?? fallbackGradeReason(input, lastReason)
    },

    /**
     * E-07 สร้างเรื่องราวเฉพาะคนครบ 10 เรื่องในการเรียกครั้งเดียว
     *
     * งานนี้ **ไม่มีใครนั่งรอหน้าจอ** เพราะสร้างล่วงหน้าเบื้องหลังตั้งแต่ช่วงรู้จักตัวเอง
     * (สเปกหัวข้อ 3.1 นาทีที่ 15-20) ผู้เรียกจึงควรตั้ง timeoutMs ให้ยาวกว่างบ 5 วินาทีของฝั่งนักเรียน
     * ดู STORY_TIMEOUT_MS ใน lib/ai/story-queue.ts
     *
     * ทุกเรื่องที่ไม่ผ่านรายการตรวจของสเปกถูกแทนด้วยประโยคสำรองเป็นรายเรื่อง
     * ผลลัพธ์จึงมีครบ 10 เรื่องเสมอ ไม่ว่าจะมีคีย์หรือไม่
     */
    async storyFor(input: StoryInput): Promise<StoryResult> {
      const gated = gate(input?.studentId, 'story')
      if (typeof gated === 'string') return fallbackStorySet(input, gated)

      const { value, lastReason } = await runChain(
        gated,
        'story',
        () => storyPrompt(input),
        (raw, provider): StoryResult => {
          const data = raw as Parameters<typeof buildStoryResult>[0]
          if (typeof data !== 'object' || data === null || typeof data.intros !== 'object') {
            throw new Error('โมเดลไม่ได้ตอบกลับเป็น JSON ที่ใช้ได้')
          }
          const result = buildStoryResult(data, input, provider)
          // ไม่มีเรื่องไหนผ่านการตรวจเลย ถือว่าเจ้านี้ใช้ไม่ได้ ไปลองเจ้าถัดไปในลูกโซ่
          if (result.source !== 'ai') {
            throw new Error('เรื่องราวจาก AI ไม่ผ่านการตรวจเนื้อหา')
          }
          return result
        },
      )

      return value ?? fallbackStorySet(input, lastReason)
    },

    async simulateCustomer(input: SimulateCustomerInput): Promise<SimulateCustomerResult> {
      const gated = gate(input?.studentId, 'customer')
      if (typeof gated === 'string') return fallbackSimulateCustomer(input, gated)

      const { value, lastReason } = await runChain(
        gated,
        'customer',
        () => simulateCustomerPrompt(input),
        (raw, provider): SimulateCustomerResult => {
          const data = raw as { typed?: unknown; comment?: unknown }
          if (typeof data?.typed !== 'string' || typeof data?.comment !== 'string') {
            throw new Error('โมเดลไม่ได้ตอบกลับเป็น JSON ที่ใช้ได้')
          }
          const safeComment = guardAiText(data.comment, topicKeywords(input.domainName), fallbackSimulateCustomer(input, 'bad-response').comment)
          if (safeComment === fallbackSimulateCustomer(input, 'bad-response').comment && data.comment.trim() !== safeComment) throw new Error('คำตอบหลุดหัวข้อหรือไม่ปลอดภัย')
          const expected = (input?.domainName ?? '').trim().toLowerCase()
          const typed = data.typed.trim().toLowerCase()
          return {
            typed,
            correct: typed === expected,
            comment: safeComment,
            source: 'ai',
            provider,
            fallbackReason: null,
          }
        },
      )

      return value ?? fallbackSimulateCustomer(input, lastReason)
    },

    /**
     * ตรวจคำตอบปลายเปิดของเส้นทางเรียน — ผู้เรียนรอผลอยู่ งบ 5 วินาที นับโควตา 1 ครั้งต่อการส่ง
     * ลำดับผู้ให้บริการตาม providerChain (Typhoon ก่อนเมื่อทำทันงบ แล้ว Gemini) ไม่ได้ผล = items ว่าง
     */
    async learnCheck(input: LearnCheckInput): Promise<LearnCheckResult> {
      if (!input?.items?.length) return fallbackLearnCheck('not-requested')
      const gated = gate(input.studentId, 'learnCheck')
      if (typeof gated === 'string') return fallbackLearnCheck(gated)

      const { value, lastReason } = await runChain(
        gated,
        'learnCheck',
        () => learnCheckPrompt(input),
        (raw, provider) => parseLearnCheck(raw, input, provider),
      )
      return value ?? fallbackLearnCheck(lastReason)
    },
  }
}

export * from './types'
export { fallbackGradeReason, fallbackHint, fallbackSimulateCustomer } from './fallback'
export { fallbackLearnCheck } from './learn-check'

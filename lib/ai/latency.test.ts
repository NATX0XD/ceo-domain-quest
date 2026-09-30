import { describe, expect, it } from 'vitest'
import { LATENCY_SAFETY, MEASURED_LATENCY_MS, expectedLatencyMs, fitsBudget } from './latency'
import { TASK_TIMEOUT_MS } from './index'

describe('ตารางเวลาตอบที่วัดเอง', () => {
  it('ครบทั้ง 2 เจ้า 4 ชนิดงาน และเป็นตัวเลขบวกทั้งหมด', () => {
    for (const provider of ['typhoon', 'gemini'] as const) {
      for (const task of ['hint', 'grade', 'customer', 'story'] as const) {
        expect(MEASURED_LATENCY_MS[provider][task]).toBeGreaterThan(0)
      }
    }
  })

  it('เผื่อความแกว่งจากมัธยฐานตามตัวคูณที่ประกาศไว้', () => {
    expect(expectedLatencyMs('gemini', 'grade')).toBe(
      Math.round(MEASURED_LATENCY_MS.gemini.grade * LATENCY_SAFETY),
    )
  })

  it('ทับค่าจาก env ได้ เมื่อผู้ให้บริการเปลี่ยนความเร็วกลางคาบ', () => {
    expect(expectedLatencyMs('typhoon', 'grade', { AI_LATENCY_TYPHOON_GRADE: '1200' })).toBe(1200)
    // ค่าเพี้ยน (ติดลบ / ไม่ใช่ตัวเลข) ต้องตกกลับไปใช้ค่าที่วัดไว้ ไม่ใช่พัง
    expect(expectedLatencyMs('typhoon', 'grade', { AI_LATENCY_TYPHOON_GRADE: '-5' })).toBeGreaterThan(0)
    expect(expectedLatencyMs('typhoon', 'grade', { AI_LATENCY_TYPHOON_GRADE: 'เร็ว' })).toBeGreaterThan(0)
  })
})

describe('งบเวลาพอให้เจ้านี้ได้ลองจริงไหม', () => {
  it('งานตรวจคำตอบในงบ 5 วินาที — Gemini ทัน Typhoon ไม่ทัน (นี่คือต้นเหตุของ T61)', () => {
    expect(fitsBudget('gemini', 'grade', 5000)).toBe(true)
    expect(fitsBudget('typhoon', 'grade', 5000)).toBe(false)
  })

  it('งานเดียวกันในคิวเบื้องหลัง 60 วินาที — ทันทั้งคู่', () => {
    expect(fitsBudget('gemini', 'grade', 60_000)).toBe(true)
    expect(fitsBudget('typhoon', 'grade', 60_000)).toBe(true)
  })

  it('งานสั้นทันทั้งคู่ตั้งแต่ในงบ 5 วินาที', () => {
    for (const task of ['hint', 'customer'] as const) {
      expect(fitsBudget('typhoon', task, 5000)).toBe(true)
      expect(fitsBudget('gemini', task, 5000)).toBe(true)
    }
  })
})

describe('งบเวลาตั้งต้นแยกตามบริบท', () => {
  it('งานที่ผู้เรียนนั่งรอ = 5 วินาที · งานคิวเบื้องหลัง = ยาวกว่า', () => {
    expect(TASK_TIMEOUT_MS.hint).toBe(5000)
    expect(TASK_TIMEOUT_MS.customer).toBe(5000)
    expect(TASK_TIMEOUT_MS.grade).toBe(5000)
    expect(TASK_TIMEOUT_MS.story).toBeGreaterThan(TASK_TIMEOUT_MS.hint)
  })

  it('งบตั้งต้นของทุกงานต้องพอให้มีอย่างน้อย 1 เจ้าทำทัน ไม่งั้นงานนั้นไม่มีทางได้ AI เลย', () => {
    for (const task of ['hint', 'grade', 'customer', 'story'] as const) {
      const budget = TASK_TIMEOUT_MS[task]
      expect(fitsBudget('gemini', task, budget) || fitsBudget('typhoon', task, budget)).toBe(true)
    }
  })
})

/**
 * T69 — งบเวลาของงานคิวเบื้องหลังต้องมีแหล่งความจริงเดียว
 * เดิมเลข 60_000 ถูกเขียนซ้ำใน story-queue กับ grade-queue ซึ่งเลื่อนหลุดจากกันได้
 */
describe('งบเวลาเบื้องหลังมีที่เดียว', () => {
  it('story-queue กับ grade-queue อ้างค่าเดียวกับ lib/ai/index.ts', async () => {
    const { BACKGROUND_TIMEOUT_MS } = await import('./index')
    const { STORY_TIMEOUT_MS } = await import('./story-queue')
    const gradeQueue = await import('./grade-queue')

    expect(STORY_TIMEOUT_MS).toBe(BACKGROUND_TIMEOUT_MS)
    expect(gradeQueue.BACKGROUND_TIMEOUT_MS).toBe(BACKGROUND_TIMEOUT_MS)
    // งาน story ที่ไม่ได้ส่ง timeoutMs มาเอง ต้องได้งบเบื้องหลังโดยอัตโนมัติ
    expect(TASK_TIMEOUT_MS.story).toBe(BACKGROUND_TIMEOUT_MS)
  })
})

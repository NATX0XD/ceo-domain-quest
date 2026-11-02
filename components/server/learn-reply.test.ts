import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ getServiceClient: () => ({}) }))
vi.mock('@/content/learn-paths.json', async () => {
  const { readFileSync } = await import('node:fs')
  return { default: JSON.parse(readFileSync('content/learn-paths.json', 'utf8')) }
})
import { aiCallsUsed, createAiClient, resetAiQuota, resetAiRateLimiter } from '../../lib/ai/index'
import type { LearnCheckResult } from '../../lib/ai/types'
import { findLearnPath } from './learn-path'
import { DOME_REPLY_FALLBACK, domeLearnReply } from './learn-reply'

/** โดมตอบกลับรายข้อ — fetch ปลอมทั้งหมด ไม่ยิงเน็ตจริง */
const path = findLearnPath('m1')!
const QUESTION_ID = 'm1-rq1'
const ANSWER = 'คือการสื่อสาร'

function typhoonClient(feedback: string) {
  const payload = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            results: [
              {
                id: QUESTION_ID,
                concepts: [
                  { quote: 'คือการสื่อสาร', covered: true },
                  { quote: '', covered: false },
                ],
                feedback,
              },
            ],
          }),
        },
      },
    ],
  }
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch
  return { fetchImpl, checker: createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl }) }
}

beforeEach(() => {
  resetAiQuota()
  resetAiRateLimiter()
})

describe('domeLearnReply', () => {
  it('AI ตอบรับและสะท้อนคำของนักเรียน โดยไม่ตัดสิน', async () => {
    const { checker, fetchImpl } = typhoonClient('โดมรับฟังคำว่า "การสื่อสาร" ไว้แล้วครับ ไปข้อถัดไปกัน')
    const r = await domeLearnReply(path, 'read', QUESTION_ID, ANSWER, { checker })
    expect(r).toMatchObject({
      reply: 'โดมรับฟังคำว่า "การสื่อสาร" ไว้แล้วครับ ไปข้อถัดไปกัน',
      source: 'ai',
      provider: 'typhoon',
      fallbackReason: null,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(aiCallsUsed('stu-1')).toBe(0)
  })

  it('AI ช้าเกินงบ = neutral echo ไม่ใช่ rubric feedback', async () => {
    const slow = { learnCheck: () => new Promise<LearnCheckResult>(() => {}) }
    const r = await domeLearnReply(path, 'read', QUESTION_ID, ANSWER, { checker: slow, budgetMs: 30 })
    expect(r).toMatchObject({ source: 'fallback', fallbackReason: 'timeout' })
    expect(r?.reply).toBe('โดมจดคำตอบ "คือการสื่อสาร" ไว้แล้วครับ ไปข้อถัดไปกัน')
    expect(r?.reply).not.toContain('ถูกต้อง')
    expect(r?.reply).not.toContain('ยังไม่ครบ')
  })

  it.each([
    ['คำตัดสิน', 'คำตอบถูกต้องแล้วครับ ไปข้อถัดไปกัน'],
    ['คำใบ้', 'โดมรับฟังแล้วครับ ลองคิดต่อเรื่องชื่อเว็บไซต์นะครับ'],
    ['วลี rubric', 'โดมรับฟังคำว่า ชื่อเว็บ ไว้แล้วครับ ไปข้อถัดไปกัน'],
  ])('AI มี%s = fallback neutral echo', async (_label, feedback) => {
    const { checker } = typhoonClient(feedback)
    const r = await domeLearnReply(path, 'read', QUESTION_ID, ANSWER, { checker })
    expect(r).toMatchObject({ source: 'fallback', fallbackReason: 'filtered' })
    expect(r?.reply).toBe('โดมจดคำตอบ "คือการสื่อสาร" ไว้แล้วครับ ไปข้อถัดไปกัน')
  })

  it('AI พัง / ไม่มีคีย์ / คำตอบสั้นเกิน = neutral fallback ไม่ throw', async () => {
    const fetchImpl = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    const broken = createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl })
    expect((await domeLearnReply(path, 'read', QUESTION_ID, ANSWER, { checker: broken }))?.source).toBe('fallback')

    const noKey = createAiClient({ env: {} })
    expect(await domeLearnReply(path, 'read', QUESTION_ID, ANSWER, { checker: noKey })).toMatchObject({
      source: 'fallback',
      fallbackReason: 'no-api-key',
      reply: 'โดมจดคำตอบ "คือการสื่อสาร" ไว้แล้วครับ ไปข้อถัดไปกัน',
    })
    expect(await domeLearnReply(path, 'read', QUESTION_ID, 'ok', { checker: noKey })).toMatchObject({
      source: 'fallback',
      fallbackReason: 'too-short',
      reply: DOME_REPLY_FALLBACK.read,
    })
  })

  it('คำตอบติดตัวกรอง = generic neutral line', async () => {
    const noKey = createAiClient({ env: {} })
    const r = await domeLearnReply(path, 'read', QUESTION_ID, 'พนัน', { checker: noKey })
    expect(r).toMatchObject({ source: 'fallback', fallbackReason: 'no-api-key', reply: DOME_REPLY_FALLBACK.read })
  })

  it('ข้อที่ไม่มีในโหมดนี้ = null', async () => {
    expect(await domeLearnReply(path, 'read', 'nope', ANSWER, { checker: null })).toBeNull()
  })
})

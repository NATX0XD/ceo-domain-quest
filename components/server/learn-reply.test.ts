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

/** โดมตอบกลับรายข้อ — fetch ปลอมทั้งหมด ไม่ยิงเน็ตจริง · m1-wq2 = DNS (ค้นหา / IP / เซิร์ฟเวอร์) */
const path = findLearnPath('m1')!
const ANSWER = 'DNS ช่วยค้นหาเว็บที่เราพิมพ์ชื่อลงไป'

function typhoonClient(feedback: string) {
  const payload = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            results: [
              {
                id: 'm1-wq2',
                concepts: [
                  { quote: 'ช่วยค้นหาเว็บ', covered: true },
                  { quote: '', covered: false },
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
  it('AI ตอบได้ = คำตอบกลับจริงของโดม source ai และไม่กินโควตาตรวจงาน', async () => {
    const fb = 'บอกได้ดีว่า DNS ช่วยค้นหาเว็บครับ ลองคิดต่อว่าชื่อนั้นถูกแปลงไปเป็นอะไรนะครับ'
    const { checker, fetchImpl } = typhoonClient(fb)
    const r = await domeLearnReply(path, 'watch', 'm1-wq2', ANSWER, { checker })
    expect(r).toMatchObject({ reply: fb, source: 'ai', provider: 'typhoon', fallbackReason: null })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(aiCallsUsed('stu-1')).toBe(0)
  })

  it('AI ช้าเกินงบ = ข้อความเดิม (timeout)', async () => {
    const slow = { learnCheck: () => new Promise<LearnCheckResult>(() => {}) }
    const r = await domeLearnReply(path, 'watch', 'm1-wq2', ANSWER, { checker: slow, budgetMs: 30 })
    expect(r).toMatchObject({ reply: DOME_REPLY_FALLBACK.watch, source: 'fallback', fallbackReason: 'timeout' })
  })

  it('AI เผยวลีเฉลย = ข้อความเดิม (filtered)', async () => {
    const { checker } = typhoonClient('DNS เป็นระบบช่วยค้นหาหมายเลข IP ที่สัมพันธ์กับชื่อโดเมนครับ')
    const r = await domeLearnReply(path, 'watch', 'm1-wq2', ANSWER, { checker })
    expect(r).toMatchObject({ reply: DOME_REPLY_FALLBACK.watch, source: 'fallback', fallbackReason: 'filtered' })
  })

  it('AI ชมว่าครบทั้งที่ยังขาด = ข้อความเดิม', async () => {
    const { checker } = typhoonClient('ตอบครบถ้วนแล้วครับ เยี่ยมมาก')
    const r = await domeLearnReply(path, 'watch', 'm1-wq2', ANSWER, { checker })
    expect(r?.source).toBe('fallback')
  })

  it('AI พัง (HTTP 500) / ไม่มีคีย์ / คำตอบสั้นเกิน = ข้อความเดิม ไม่ throw', async () => {
    const fetchImpl = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    const broken = createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl })
    expect((await domeLearnReply(path, 'watch', 'm1-wq2', ANSWER, { checker: broken }))?.source).toBe('fallback')
    const noKey = createAiClient({ env: {} })
    expect(await domeLearnReply(path, 'watch', 'm1-wq2', ANSWER, { checker: noKey })).toMatchObject({ source: 'fallback', fallbackReason: 'no-api-key' })
    expect(await domeLearnReply(path, 'watch', 'm1-wq2', 'ok', { checker: noKey })).toMatchObject({ fallbackReason: 'too-short' })
  })

  it('ข้อที่ไม่มีในโหมดนี้ = null', async () => {
    expect(await domeLearnReply(path, 'watch', 'nope', ANSWER, { checker: null })).toBeNull()
  })
})

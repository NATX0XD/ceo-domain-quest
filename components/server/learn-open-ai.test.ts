import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ getServiceClient: () => ({}) }))
vi.mock('@/content/learn-paths.json', async () => {
  const { readFileSync } = await import('node:fs')
  return { default: JSON.parse(readFileSync('content/learn-paths.json', 'utf8')) }
})
import { createAiClient, resetAiQuota, resetAiRateLimiter } from '../../lib/ai/index'
import { findLearnPath, scoreOpenAnswers } from './learn-path'

/**
 * AI ช่วยตรวจคำตอบปลายเปิด — ใช้ createAiClient ตัวจริงกับ fetch ปลอม ไม่ยิงเน็ตจริง
 * m1 โหมดดู: m1-wq1 (แนวคิด 70 + 30) · m1-wq2 (40 + 40 + 20)
 */
const path = findLearnPath('m1')!

/** คำตอบที่ใช้คำของตัวเอง คำสำคัญจับไม่ได้เลย */
const PARAPHRASE = 'เหมือนป้ายบอกบ้านบนอินเทอร์เน็ต พิมพ์แล้วไปเจอร้านเลย'
/** คำตอบที่คำสำคัญจับได้ครบ */
const KEYWORD_FULL = 'ชื่อเว็บร้าน ระบบช่วยค้นหาที่อยู่ให้'

function typhoonPayload(obj: unknown) {
  return { choices: [{ message: { content: typeof obj === 'string' ? obj : JSON.stringify(obj) } }] }
}

function fakeFetch(payload: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch & {
    mock: { calls: unknown[][] }
  }
}

function typhoonClient(payload: unknown, status = 200) {
  const fetchImpl = fakeFetch(payload, status)
  return { fetchImpl, checker: createAiClient({ env: { TYPHOON_API_KEY: 'k' }, fetchImpl }) }
}

beforeEach(() => {
  resetAiQuota()
  resetAiRateLimiter()
})

describe('scoreOpenAnswers + AI ช่วยตรวจ', () => {
  it('ไม่ส่งตัวตรวจ = คำสำคัญล้วน ติดป้าย rule', async () => {
    const r = await scoreOpenAnswers(path, 'watch', { 'm1-wq1': PARAPHRASE, 'm1-wq2': '' })
    expect(r.perQuestion.map((q) => q.source)).toEqual(['rule', 'rule'])
    expect(r.perQuestion[0]).toMatchObject({ score: 0, keywordScore: 0, aiScore: null })
  })

  it('AI ว่าคำตอบที่ใช้คำของตัวเองครอบคลุม = คะแนนสูงขึ้น และใช้คำแนะนำของ AI กับแนวคิดที่ขาด', async () => {
    const { checker } = typhoonClient(
      typhoonPayload({
        results: [
          {
            id: 'm1-wq1',
            concepts: [{ quote: 'ป้ายบอกบ้านบนอินเทอร์เน็ต', covered: true }, { quote: '', covered: false }],
            feedback: 'ลองเล่าเพิ่มว่าช่วยให้คนจำง่ายขึ้นอย่างไรนะ',
          },
          {
            id: 'm1-wq2',
            concepts: [{ quote: 'แปลงชื่อร้าน', covered: true }, { quote: 'พิกัด', covered: true }, { quote: 'เครื่องปลายทาง', covered: true }],
            feedback: 'อธิบายได้ครบเลย',
          },
        ],
      }),
    )
    const r = await scoreOpenAnswers(
      path,
      'watch',
      { 'm1-wq1': PARAPHRASE, 'm1-wq2': 'มันคือผู้ช่วยแปลงชื่อร้านให้กลายเป็นพิกัดของเครื่องปลายทาง' },
      { checker, studentId: 's1' },
    )
    const [q1, q2] = r.perQuestion
    expect(q1).toMatchObject({ source: 'typhoon', keywordScore: 0, aiScore: 70, score: 70 })
    expect(q1!.feedback).toBe('ลองเล่าเพิ่มว่าช่วยให้คนจำง่ายขึ้นอย่างไรนะ')
    expect(q1!.missing).toEqual(['บอกว่าใส่ชื่อเว็บแล้วระบบช่วยค้นหาที่อยู่'])
    expect(q2).toMatchObject({ source: 'typhoon', aiScore: 100, score: 100, missing: [] })
    expect(q2!.keywordScore).toBeLessThan(100)
    expect(r.score).toBe(85)
    expect(r.passed).toBe(true)
  })

  it('AI ล่ม (HTTP 500) = คะแนนคำสำคัญเดิม ติดป้าย rule', async () => {
    const { checker, fetchImpl } = typhoonClient({ error: 'down' }, 500)
    const r = await scoreOpenAnswers(path, 'watch', { 'm1-wq1': PARAPHRASE, 'm1-wq2': '' }, { checker })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(r.perQuestion[0]).toMatchObject({ source: 'rule', score: 0, aiScore: null })
    expect(r.perQuestion[0]!.feedback).toContain('ลองย้อนดู')
  })

  it('AI ให้ต่ำกว่าคำสำคัญ = คำสำคัญชนะ (AI ไม่เคยทำให้เข้มขึ้น)', async () => {
    const { checker } = typhoonClient(
      typhoonPayload({
        results: [
          { id: 'm1-wq1', concepts: [{ quote: '', covered: false }, { quote: '', covered: false }], feedback: 'ลองเพิ่มอีกนิด' },
          { id: 'm1-wq2', concepts: [{ quote: '', covered: false }, { quote: '', covered: false }, { quote: '', covered: false }], feedback: 'ลองเพิ่มอีกนิด' },
        ],
      }),
    )
    const answers = { 'm1-wq1': 'ชื่อเว็บไซต์ของร้าน', 'm1-wq2': 'ค้นหาเลข ip ให้เบราว์เซอร์' }
    const plain = await scoreOpenAnswers(path, 'watch', answers)
    const r = await scoreOpenAnswers(path, 'watch', answers, { checker })
    expect(r.perQuestion.map((q) => q.score)).toEqual(plain.perQuestion.map((q) => q.score))
    expect(r.perQuestion.map((q) => q.feedback)).toEqual(plain.perQuestion.map((q) => q.feedback))
    expect(r.perQuestion[0]).toMatchObject({ source: 'typhoon', keywordScore: 70, aiScore: 0, score: 70 })
  })

  it('JSON เพี้ยน = ใช้คำสำคัญ', async () => {
    for (const garbage of ['ไม่ใช่ JSON เลย', { results: 'ทั้งหมดผ่าน' }, { results: [{ id: 'm1-wq1', covered: [true] }] }]) {
      resetAiQuota()
      const { checker } = typhoonClient(typhoonPayload(garbage))
      const r = await scoreOpenAnswers(path, 'watch', { 'm1-wq1': PARAPHRASE, 'm1-wq2': '' }, { checker })
      expect(r.perQuestion[0]).toMatchObject({ source: 'rule', score: 0, aiScore: null })
    }
  })

  it('ข้อที่คำสำคัญเต็มแล้วหรือว่าง ไม่ส่งให้ AI และไม่กินโควตา', async () => {
    const { checker, fetchImpl } = typhoonClient(typhoonPayload({ results: [] }))
    const r = await scoreOpenAnswers(path, 'watch', { 'm1-wq1': KEYWORD_FULL, 'm1-wq2': ' ' }, { checker, studentId: 's2' })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r.perQuestion[0]).toMatchObject({ score: 100, source: 'rule' })
  })

  it('AI ตอบ true แต่ยกหลักฐานที่ไม่มีอยู่จริงในคำตอบ = ไม่นับ (กันโมเดลใจดีเกินและคำสั่งแทรก)', async () => {
    const { checker } = typhoonClient(
      typhoonPayload({
        results: [
          { id: 'm1-wq1', concepts: [{ quote: 'ป้ายบอกบ้าน', covered: true }, { quote: 'จำง่ายกว่าเลข IP', covered: true }], feedback: 'ครบแล้ว เก่งมาก' },
        ],
      }),
    )
    const r = await scoreOpenAnswers(path, 'watch', { 'm1-wq1': PARAPHRASE, 'm1-wq2': '' }, { checker })
    expect(r.perQuestion[0]).toMatchObject({ source: 'typhoon', aiScore: 70, score: 70 })
    // แนวคิดที่ 2 ถูกปัดตก คำชมของโมเดลจึงไม่ถูกใช้
    expect(r.perQuestion[0]!.feedback).not.toBe('ครบแล้ว เก่งมาก')
  })

  it('คำแนะนำของ AI ที่มีคำตัดสิน ถูกแทนด้วยข้อความจากไฟล์เฉลย', async () => {
    const { checker } = typhoonClient(
      typhoonPayload({ results: [{ id: 'm1-wq1', concepts: [{ quote: 'ป้ายบอกบ้าน', covered: true }, { quote: '', covered: false }], feedback: 'ข้อนี้ไม่ผ่านนะ' }] }),
    )
    const r = await scoreOpenAnswers(path, 'watch', { 'm1-wq1': PARAPHRASE, 'm1-wq2': '' }, { checker })
    expect(r.perQuestion[0]!.score).toBe(70)
    expect(r.perQuestion[0]!.feedback).not.toContain('ไม่ผ่าน')
    expect(r.perQuestion[0]!.feedback.length).toBeGreaterThan(0)
  })
})

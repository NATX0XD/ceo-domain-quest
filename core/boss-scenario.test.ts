import { describe, expect, it } from 'vitest'
import {
  TOPIC_ACCURACY_MAX,
  TOPIC_ORDER,
  bossTemplates,
  pickBossTemplate,
  storyIdForTemplate,
  topicAccuracy,
  weakestTopic,
} from './boss-scenario'

describe('แม่แบบด่านบอสที่โหลดมาจากไฟล์เนื้อหา', () => {
  it('มีครบ 7 แม่แบบ และรหัสไม่ซ้ำกัน', () => {
    expect(bossTemplates).toHaveLength(7)
    const ids = bossTemplates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ทุกแม่แบบมีเรื่องราวและงานเฉพาะ ไม่มีช่องว่าง', () => {
    for (const t of bossTemplates) {
      expect(t.scenario.length).toBeGreaterThan(20)
      expect(t.specificTask.length).toBeGreaterThan(5)
    }
  })

  it('ทุกเรื่องใน TOPIC_ORDER มีแม่แบบของตัวเองอย่างน้อย 1 อัน', () => {
    for (const topic of TOPIC_ORDER) {
      expect(bossTemplates.some((t) => t.focusObjectiveId === topic)).toBe(true)
    }
  })

  it('เรื่อง 4 มีแม่แบบคู่ แยกตามสถานะจดทะเบียน', () => {
    const pair = bossTemplates.filter((t) => t.focusObjectiveId === 'obj-4')
    expect(pair).toHaveLength(2)
    expect(pair.map((t) => t.requiresRegistered).sort()).toEqual([false, true])
  })
})

describe('คะแนนความแม่นรายเรื่อง 0-4', () => {
  it('ไม่มีข้อมูลเลยได้ 0 — คนที่ข้ามทั้งเรื่องคือคนที่อ่อนที่สุด', () => {
    expect(topicAccuracy({})).toBe(0)
    expect(topicAccuracy({ skipped: true })).toBe(0)
  })

  it('เก็บครบทุกสัญญาณได้เต็ม 4', () => {
    expect(topicAccuracy({ pretestCorrect: true, checkCorrect: true, missionStars: 3 })).toBe(
      TOPIC_ACCURACY_MAX,
    )
  })

  it('ดาว 1 หรือ 2 ดวงได้ 1 คะแนน ส่วน 3 ดวงได้ 2', () => {
    expect(topicAccuracy({ missionStars: 1 })).toBe(1)
    expect(topicAccuracy({ missionStars: 2 })).toBe(1)
    expect(topicAccuracy({ missionStars: 3 })).toBe(2)
  })

  it('ตอบถูกก่อนเรียนอย่างเดียวได้ 1 ตอบถูกข้อตรวจอย่างเดียวได้ 1', () => {
    expect(topicAccuracy({ pretestCorrect: true })).toBe(1)
    expect(topicAccuracy({ checkCorrect: true })).toBe(1)
  })

  it('ค่าที่ไม่ใช่ตัวเลขหรือเกินเพดานไม่ทำให้คะแนนพุ่ง', () => {
    expect(topicAccuracy({ missionStars: 99 })).toBe(2)
    expect(topicAccuracy({ missionStars: null, pretestCorrect: null })).toBe(0)
  })
})

describe('หาเรื่องที่อ่อนที่สุด', () => {
  it('เลือกเรื่องที่คะแนนต่ำสุด', () => {
    expect(
      weakestTopic({ accuracyByTopic: { 'obj-1': 4, 'obj-2': 1, 'obj-3': 3, 'obj-4': 2 } }),
    ).toBe('obj-2')
  })

  it('เสมอกันให้เลือกเรื่องที่ลำดับต้นกว่าเสมอ', () => {
    expect(
      weakestTopic({ accuracyByTopic: { 'obj-1': 2, 'obj-2': 2, 'obj-3': 2, 'obj-4': 2 } }),
    ).toBe('obj-1')
    expect(weakestTopic({ accuracyByTopic: { 'obj-3': 0, 'obj-2': 0 } })).toBe('obj-2')
  })

  it('ไม่มีข้อมูลเลยคืน null', () => {
    expect(weakestTopic({ accuracyByTopic: {} })).toBeNull()
    expect(weakestTopic({ accuracyByTopic: { 'obj-1': null, 'obj-2': undefined } })).toBeNull()
  })

  it('เรื่องที่ไม่มีคีย์ถูกข้าม ไม่ถือว่าได้ 0', () => {
    expect(weakestTopic({ accuracyByTopic: { 'obj-3': 1 } })).toBe('obj-3')
  })
})

describe('เลือกแม่แบบให้ผู้เรียนหนึ่งคน', () => {
  it('ได้แม่แบบของเรื่องที่อ่อนที่สุด', () => {
    const got = pickBossTemplate({
      accuracyByTopic: { 'obj-1': 4, 'obj-2': 0, 'obj-3': 3, 'obj-4': 4 },
    })
    expect(got?.template.focusObjectiveId).toBe('obj-2')
    expect(got?.weakestObjectiveId).toBe('obj-2')
    expect(got?.reason).toBe('weakest-topic')
  })

  it('อ่อนเรื่อง 4 และร้านยังไม่จดทะเบียน ได้แม่แบบฝั่งยังไม่จดทะเบียน', () => {
    const got = pickBossTemplate({
      accuracyByTopic: { 'obj-1': 4, 'obj-2': 4, 'obj-3': 4, 'obj-4': 0 },
      isRegisteredCompany: false,
    })
    expect(got?.template.requiresRegistered).toBe(false)
    expect(got?.template.id).toBe('bm-t4-unregistered')
  })

  it('อ่อนเรื่อง 4 และร้านจดทะเบียนแล้ว ได้แม่แบบอีกฝั่ง', () => {
    const got = pickBossTemplate({
      accuracyByTopic: { 'obj-1': 4, 'obj-2': 4, 'obj-3': 4, 'obj-4': 0 },
      isRegisteredCompany: true,
    })
    expect(got?.template.requiresRegistered).toBe(true)
    expect(got?.template.id).toBe('bm-t4-registered')
  })

  it('ยังไม่มีข้อมูลเลยได้แม่แบบที่ครอบทั้ง 4 เรื่อง', () => {
    const got = pickBossTemplate({ accuracyByTopic: {} })
    expect(got?.reason).toBe('no-data')
    expect(got?.weakestObjectiveId).toBeNull()
    expect(got?.template.focusObjectiveId).toBe('all')
  })

  it('เรียกซ้ำด้วยข้อมูลเดิมต้องได้แม่แบบเดิมเสมอ ห้ามสุ่ม', () => {
    const input = {
      accuracyByTopic: { 'obj-1': 1, 'obj-2': 1, 'obj-3': 4, 'obj-4': 2 },
      isRegisteredCompany: false,
    }
    const first = pickBossTemplate(input)
    for (let i = 0; i < 25; i += 1) {
      expect(pickBossTemplate(input)?.template.id).toBe(first?.template.id)
    }
  })

  it('ผู้เรียนที่อ่อนคนละเรื่องได้คนละแม่แบบจริง', () => {
    const a = pickBossTemplate({ accuracyByTopic: { 'obj-1': 0, 'obj-2': 4, 'obj-3': 4, 'obj-4': 4 } })
    const b = pickBossTemplate({ accuracyByTopic: { 'obj-1': 4, 'obj-2': 4, 'obj-3': 0, 'obj-4': 4 } })
    expect(a?.template.id).not.toBe(b?.template.id)
  })
})

describe('จับคู่แม่แบบกับรหัสเรื่องราวของ AI', () => {
  it('ตัดวงเล็บกำกับออก เหลือรหัสที่ lib/ai/story.ts รู้จัก', () => {
    const t4 = bossTemplates.find((t) => t.id === 'bm-t4-registered')!
    expect(storyIdForTemplate(t4)).toBe('B-T4')
  })

  it('แม่แบบที่ไม่มีวงเล็บคืนรหัสเดิม', () => {
    const t1 = bossTemplates.find((t) => t.id === 'bm-t1')!
    expect(storyIdForTemplate(t1)).toBe('B-T1')
  })
})

import { describe, expect, it } from 'vitest'
import reflectionJson from '../content/reflection.json' with { type: 'json' }
import {
  OPTIONAL_REFLECTION_IDS,
  REQUIRED_REFLECTION_COUNT,
  REQUIRED_REFLECTION_IDS,
  TOTAL_REFLECTION_COUNT,
  isRequiredReflection,
  reflectionQuestionRules,
  reflectionSubmitCheck,
  reflectionSubmitPolicy,
} from './reflection'
import { REFLECTION_QUESTION_COUNT } from './report'

/** คำตอบที่ยาวพอทุกข้อ ใช้เป็นฐานแล้วค่อยเอาบางข้อออก */
function longAnswers(): Record<string, string> {
  return Object.fromEntries(
    reflectionQuestionRules.map((q) => [q.id, 'ก'.repeat(Math.max(1, q.minLength))]),
  )
}

describe('จำนวนข้อที่บังคับมาจากไฟล์เนื้อหา ไม่ได้ฝังไว้ในโค้ด', () => {
  it('อ่านรหัสข้อที่บังคับจาก submitPolicy.requiredQuestionIds ตรง ๆ', () => {
    expect(REQUIRED_REFLECTION_IDS).toEqual(reflectionJson.submitPolicy.requiredQuestionIds)
    expect(REQUIRED_REFLECTION_COUNT).toBe(reflectionJson.submitPolicy.requiredQuestionIds.length)
  })

  it('ค่าเริ่มต้นตรงกับแผนการสอน คือตอบ 2 ข้อในคาบ จากทั้งหมด 3 ข้อ', () => {
    expect(REQUIRED_REFLECTION_COUNT).toBe(2)
    expect(TOTAL_REFLECTION_COUNT).toBe(3)
    expect(OPTIONAL_REFLECTION_IDS).toEqual(['reflect-3'])
  })

  it('ข้อที่บังคับกับข้อของแถมรวมกันได้ครบทุกข้อ ไม่มีข้อไหนตกหล่นหรือนับซ้ำ', () => {
    expect([...REQUIRED_REFLECTION_IDS, ...OPTIONAL_REFLECTION_IDS].sort()).toEqual(
      reflectionQuestionRules.map((q) => q.id).sort(),
    )
    expect(isRequiredReflection('reflect-1')).toBe(true)
    expect(isRequiredReflection('reflect-3')).toBe(false)
    expect(isRequiredReflection('ไม่มีข้อนี้')).toBe(false)
  })

  it('เกณฑ์ผ่านจุดประสงค์ข้อ 6 ใช้เกณฑ์เดียวกับตอนกดส่ง ไม่ใช่คนละเกณฑ์', () => {
    // ถ้าสองค่านี้หลุดออกจากกัน รายงานจะบอกว่าไม่มีใครผ่าน obj-6 ทั้งที่ทุกคนทำตามแผนครบ
    expect(REFLECTION_QUESTION_COUNT).toBe(REQUIRED_REFLECTION_COUNT)
    // จำนวนข้อทั้งหมดต้องมากกว่าหรือเท่ากับเกณฑ์เสมอ ไม่งั้นไม่มีใครตอบครบได้
    expect(TOTAL_REFLECTION_COUNT).toBeGreaterThanOrEqual(REQUIRED_REFLECTION_COUNT)
  })
})

describe('ตรวจก่อนกดส่ง', () => {
  it('ตอบ 2 ข้อที่บังคับ ส่งผ่าน แม้ข้อที่ 3 ยังว่าง', () => {
    const answers = longAnswers()
    delete answers['reflect-3']
    const check = reflectionSubmitCheck(answers)
    expect(check.ok).toBe(true)
    expect(check.missing).toEqual([])
    expect(check.message).toBe(reflectionSubmitPolicy.readyMessage)
  })

  it('ตอบครบทั้ง 3 ข้อ ก็ยังส่งผ่าน', () => {
    expect(reflectionSubmitCheck(longAnswers()).ok).toBe(true)
  })

  it('ข้อของแถมที่พิมพ์ไว้สั้น ๆ ไม่กันการส่ง', () => {
    const answers = longAnswers()
    answers['reflect-3'] = 'ก'
    expect(reflectionSubmitCheck(answers).ok).toBe(true)
  })

  it('ตอบแค่ 1 ข้อ ต้องบอกชัดว่าขาดข้อไหนและขาดกี่ตัวอักษร ไม่ใช่แค่ว่าสั้นเกินไป', () => {
    const answers = longAnswers()
    delete answers['reflect-2']
    delete answers['reflect-3']
    const check = reflectionSubmitCheck(answers)
    expect(check.ok).toBe(false)
    expect(check.missing).toHaveLength(1)

    const gap = check.missing[0]!
    const rule = reflectionQuestionRules.find((q) => q.id === 'reflect-2')!
    expect(gap.id).toBe('reflect-2')
    expect(gap.order).toBe(rule.order)
    expect(gap.have).toBe(0)
    expect(gap.need).toBe(rule.minLength)
    expect(check.message).toContain(String(rule.order))
    expect(check.message).toContain(String(rule.minLength))
  })

  it('ยังไม่ตอบอะไรเลย บอกครบทุกข้อที่บังคับ เรียงตามลำดับข้อ', () => {
    const check = reflectionSubmitCheck({})
    expect(check.ok).toBe(false)
    expect(check.missing.map((m) => m.id)).toEqual(REQUIRED_REFLECTION_IDS)
    expect(check.missing.map((m) => m.order)).toEqual(
      [...check.missing.map((m) => m.order)].sort((a, b) => a - b),
    )
  })

  it('ช่องว่างล้วนไม่นับเป็นคำตอบ และค่าที่ไม่ใช่ข้อความก็ไม่ทำให้พัง', () => {
    const spaces = reflectionSubmitCheck({ 'reflect-1': '     ', 'reflect-2': '\n\n' })
    expect(spaces.ok).toBe(false)
    expect(spaces.missing).toHaveLength(2)
    expect(reflectionSubmitCheck({ 'reflect-1': null, 'reflect-2': undefined }).ok).toBe(false)
  })

  it('ข้อความทุกแบบห้ามมีคำตัดสินว่าตกหรือไม่ผ่าน', () => {
    const forbidden = /ไม่ผ่าน|สอบตก|ตกแล้ว|ล้มเหลว|ผิด/
    expect(reflectionSubmitCheck({}).message).not.toMatch(forbidden)
    expect(reflectionSubmitCheck(longAnswers()).message).not.toMatch(forbidden)
    expect(reflectionSubmitPolicy.optionalHint).not.toMatch(forbidden)
    expect(reflectionSubmitPolicy.optionalChipLabel).not.toMatch(forbidden)
    for (const gap of reflectionSubmitCheck({}).missing) {
      expect(gap.text).not.toMatch(forbidden)
    }
  })

  it('รายการรหัสที่คืนกลับไปให้หน้าจอ ตรงกับกติกาในไฟล์เนื้อหาทุกครั้ง', () => {
    for (const check of [reflectionSubmitCheck({}), reflectionSubmitCheck(longAnswers())]) {
      expect(check.requiredIds).toEqual(REQUIRED_REFLECTION_IDS)
      expect(check.optionalIds).toEqual(OPTIONAL_REFLECTION_IDS)
    }
  })
})

describe('กติกาในไฟล์เนื้อหาต้องใช้งานได้จริง', () => {
  it('ทุกรหัสที่บังคับมีข้ออยู่จริง และมีอย่างน้อย 1 ข้อ', () => {
    expect(REQUIRED_REFLECTION_COUNT).toBeGreaterThan(0)
    for (const id of REQUIRED_REFLECTION_IDS) {
      expect(reflectionQuestionRules.some((q) => q.id === id)).toBe(true)
    }
  })

  it('แม่แบบข้อความมีช่องแทนค่าครบ ไม่งั้นผู้เรียนจะไม่รู้ว่าขาดเท่าไร', () => {
    expect(reflectionSubmitPolicy.missingIntro).toContain('{count}')
    expect(reflectionSubmitPolicy.missingItemTemplate).toContain('{order}')
    expect(reflectionSubmitPolicy.missingItemTemplate).toContain('{need}')
  })

  it('ข้อความที่ขึ้นจอต้องแทนค่าครบ ไม่มีวงเล็บปีกกาหลุดไปให้ผู้เรียนเห็น', () => {
    expect(reflectionSubmitCheck({}).message).not.toMatch(/[{}]/)
    for (const gap of reflectionSubmitCheck({}).missing) {
      expect(gap.text).not.toMatch(/[{}]/)
    }
  })
})

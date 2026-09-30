import { describe, expect, it } from 'vitest'
import {
  NEXT_GOAL_IDS,
  NEXT_GOAL_OPTIONS,
  NEXT_GOAL_PROMPT,
  OWN_GOAL_MAX_LENGTH,
  OWN_GOAL_MIN_LENGTH,
  confirmNextGoal,
  describeNextGoal,
  findNextGoalOption,
  normalizeNextGoal,
} from './next-goal'

const freeTextOption = NEXT_GOAL_OPTIONS.find((o) => o.allowFreeText)!
const fixedOption = NEXT_GOAL_OPTIONS.find((o) => !o.allowFreeText)!

describe('ตัวเลือกเป้าครั้งหน้าอ่านจากไฟล์เนื้อหา', () => {
  it('มีตัวเลือกจริงและรหัสไม่ซ้ำ', () => {
    expect(NEXT_GOAL_OPTIONS.length).toBeGreaterThanOrEqual(2)
    expect(new Set(NEXT_GOAL_IDS).size).toBe(NEXT_GOAL_IDS.length)
    for (const option of NEXT_GOAL_OPTIONS) expect(option.text.length).toBeGreaterThan(0)
  })

  it('มีช่องให้พิมพ์เป้าของตัวเองอย่างน้อย 1 ตัวเลือก', () => {
    expect(freeTextOption).toBeTruthy()
  })

  it('ไม่มีตัวเลือกไหนชวนเทียบกับเพื่อน ตามกติกาในไฟล์เนื้อหา', () => {
    for (const option of NEXT_GOAL_OPTIONS) {
      for (const word of ['เก่งกว่า', 'ชนะเพื่อน', 'มากกว่าเพื่อน', 'แข่ง', 'ที่หนึ่ง']) {
        expect(option.text).not.toContain(word)
      }
    }
  })

  it('คำชี้แจงมาจากไฟล์เนื้อหา ไม่ใช่ข้อความว่าง', () => {
    expect(NEXT_GOAL_PROMPT.trim().length).toBeGreaterThan(0)
  })
})

describe('ตรวจเป้าที่ผู้เรียนเลือก', () => {
  it('เลือกตัวเลือกสำเร็จรูป = ใช้ข้อความจากไฟล์เนื้อหา ไม่ใช่ข้อความที่หน้าจอส่งมา', () => {
    const out = normalizeNextGoal({ goalId: fixedOption.id, ownText: 'ข้อความปลอมจากเบราว์เซอร์' })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.choice.text).toBe(fixedOption.text)
    expect(out.choice.isOwnText).toBe(false)
  })

  it('เลือกช่องพิมพ์เอง = เก็บข้อความของผู้เรียนตรงตัว', () => {
    const out = normalizeNextGoal({ goalId: freeTextOption.id, ownText: '  อยากอธิบายให้เพื่อนฟังได้  ' })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.choice.text).toBe('อยากอธิบายให้เพื่อนฟังได้')
    expect(out.choice.isOwnText).toBe(true)
  })

  it('เลือกช่องพิมพ์เองแต่ไม่พิมพ์อะไร ไม่ผ่าน และบอกว่าต้องทำอะไรต่อ', () => {
    const out = normalizeNextGoal({ goalId: freeTextOption.id, ownText: '   ' })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.message).toContain(`${OWN_GOAL_MIN_LENGTH}`)
  })

  it('เป้าที่พิมพ์เองยาวเกินเพดาน ไม่ผ่าน', () => {
    const out = normalizeNextGoal({
      goalId: freeTextOption.id,
      ownText: 'ก'.repeat(OWN_GOAL_MAX_LENGTH + 1),
    })
    expect(out.ok).toBe(false)
  })

  it('รหัสเป้าที่ไม่รู้จักหรือไม่ได้ส่งมา ไม่ผ่าน และไม่พัง', () => {
    for (const bad of [{}, { goalId: '' }, { goalId: 'goal-ไม่มีจริง' }, { goalId: 7 }]) {
      const out = normalizeNextGoal(bad as { goalId?: unknown })
      expect(out.ok).toBe(false)
    }
  })

  it('หาตัวเลือกจากรหัสได้ และรหัสมั่วคืน undefined', () => {
    expect(findNextGoalOption(fixedOption.id)?.text).toBe(fixedOption.text)
    expect(findNextGoalOption('ไม่มี')).toBeUndefined()
  })
})

describe('ข้อความสำหรับครูและผู้เรียน', () => {
  it('ครูอ่านแล้วรู้ว่าเด็กคิดเองหรือเลือกจากรายการ', () => {
    expect(describeNextGoal({ goalId: 'x', text: 'ลองข้อท้าทาย', isOwnText: false })).toContain(
      'เลือกจากรายการ',
    )
    expect(describeNextGoal({ goalId: 'x', text: 'อยากช่วยเพื่อน', isOwnText: true })).toContain(
      'ตั้งเป้าเอง',
    )
  })

  it('ยังไม่ได้ตั้งเป้าก็ยังมีข้อความให้ครูอ่าน ไม่ใช่ช่องว่าง', () => {
    expect(describeNextGoal(null).trim().length).toBeGreaterThan(0)
    expect(describeNextGoal(undefined).trim().length).toBeGreaterThan(0)
  })

  it('ข้อความยืนยันบอกว่าแก้ได้ และไม่ตัดสินว่าเป้าดีหรือไม่ดี', () => {
    const text = confirmNextGoal({ goalId: 'x', text: 'ใช้คำใบ้น้อยลง', isOwnText: false })
    expect(text).toContain('ใช้คำใบ้น้อยลง')
    expect(text).toContain('เปลี่ยนใจ')
    for (const word of ['เป้าน้อยไป', 'ควรตั้งให้สูงกว่านี้', 'ง่ายเกินไป']) {
      expect(text).not.toContain(word)
    }
  })
})

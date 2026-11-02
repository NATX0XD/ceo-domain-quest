import { describe, expect, it } from 'vitest'
import { stripFeedbackScorePrefix } from './review-feedback'

describe('stripFeedbackScorePrefix', () => {
  it('removes the leading Thai score recap and separator', () => {
    expect(stripFeedbackScorePrefix('ได้ 3 ดาว จากคะแนนถ่วงน้ำหนัก 14 เต็ม 15 · ชื่อจำง่ายมาก')).toBe('ชื่อจำง่ายมาก')
  })

  it('leaves feedback without a score recap unchanged', () => {
    expect(stripFeedbackScorePrefix('ลองบอกกลุ่มลูกค้าให้ชัดขึ้น')).toBe('ลองบอกกลุ่มลูกค้าให้ชัดขึ้น')
  })
})

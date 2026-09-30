import { describe, expect, it } from 'vitest'
import { isTeacherConfirmed, readTeacherConfirmedScores } from './submission-scores'

/**
 * กันบั๊ก QA-3 ข้อ 1.1 กลับมา: หน้าเด็กเคยอ่านธง "ครูยืนยันแล้ว" จากคอลัมน์ ai_scores
 * ทำให้เด็กที่ครูให้ 15/15 และรับใบประกาศไปแล้ว ยังเห็นคะแนน 11/15 ของกฎ
 */

function row(teacher: unknown) {
  return { teacher_confirmed_scores: teacher as never }
}

describe('อ่านคะแนนที่ครูยืนยัน', () => {
  it('ยังไม่ตรวจ = ยังไม่ยืนยัน', () => {
    expect(readTeacherConfirmedScores(row(null))).toBeNull()
    expect(isTeacherConfirmed(row(null))).toBe(false)
    expect(isTeacherConfirmed(null)).toBe(false)
  })

  it('ครูสั่งให้แก้ ไม่ใช่ครูยืนยัน ต่อให้ให้ 3 ครบทุกด้าน', () => {
    const revise = row({
      status: 'revise',
      reviseDimensionIds: ['dim-customer-reason'],
      dimensions: { 'dim-naming': 3, 'dim-tld-fit': 3, 'dim-customer-reason': 3, 'dim-business-link': 3 },
      note: 'เขียนเพิ่มว่าลูกค้าเป็นใคร',
    })
    expect(readTeacherConfirmedScores(revise)).toBeNull()
    expect(isTeacherConfirmed(revise)).toBe(false)
  })

  it('ยืนยันรายด้าน 4 ด้าน อ่านได้ครบ', () => {
    const confirmed = readTeacherConfirmedScores(
      row({
        dimensions: { 'dim-naming': 3, 'dim-tld-fit': 3, 'dim-customer-reason': 3, 'dim-business-link': 3 },
        dimensionNames: { 'dim-naming': 'ชื่อจำง่ายและสะกดถูกกฎ' },
        emphasisDimensionId: 'dim-naming',
        weightedTotal: 15,
        weightedMax: 15,
        stars: 3,
        note: 'ผ่านครบ 4 ด้าน',
        confirmedByTeacher: true,
      }),
    )
    expect(confirmed).not.toBeNull()
    expect(confirmed?.weightedTotal).toBe(15)
    expect(confirmed?.weightedMax).toBe(15)
    expect(confirmed?.dimensions?.['dim-naming']).toBe(3)
    expect(confirmed?.emphasisDimensionId).toBe('dim-naming')
    expect(confirmed?.note).toBe('ผ่านครบ 4 ด้าน')
  })

  it('ก้อนเก่าที่เก็บคะแนนรวมอย่างเดียว ยังอ่านได้', () => {
    const legacy = readTeacherConfirmedScores(
      row({ score: 2, maxScore: 3, note: 'ลองเพิ่มว่าลูกค้าเป็นใคร', confirmedByTeacher: true }),
    )
    expect(legacy?.weightedTotal).toBe(2)
    expect(legacy?.weightedMax).toBe(3)
    expect(legacy?.dimensions).toBeNull()
  })

  it('ธง confirmedByTeacher ที่อยู่ใน ai_scores ไม่มีผลอะไรทั้งสิ้น', () => {
    // ก้อนนี้คือรูปแบบที่เคยทำให้พลาด — คีย์อยู่ถูก แต่ผิดคอลัมน์
    const aiOnly = { ai_scores: { confirmedByTeacher: true, weightedTotal: 11 } }
    expect(isTeacherConfirmed(aiOnly as never)).toBe(false)
  })
})

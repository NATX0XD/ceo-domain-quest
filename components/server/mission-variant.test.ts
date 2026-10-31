import { describe, expect, it } from 'vitest'
import { findMission } from '../missions'
import { assemblePlanOf } from './mission-check-mode'
import { m2VariantFor, personalizeM2Mission, shuffleForStudent } from './mission-variant'

describe('รูปแบบ M2 ต่อผู้เรียน', () => {
  it('ให้ variant เดิมกับคนเดิม และเปลี่ยนได้เมื่อ student id ต่างกัน', () => {
    const first = m2VariantFor('student-a')
    expect(m2VariantFor('student-a')).toEqual(first)
    expect(m2VariantFor('student-b')).not.toEqual(first)
  })

  it('เปลี่ยนตัวอย่างในเนื้อหาแต่ไม่เปลี่ยนโครงสร้างสามส่วน', () => {
    const mission = findMission('m2')!
    const variant = m2VariantFor('student-a')
    const personalized = personalizeM2Mission(mission, variant)
    const game = personalized.channels.game
    const pieces = game.items.filter((item) => (item as { type?: string }).type === 'piece') as { text: string }[]

    expect(pieces.map((piece) => piece.text).join(' ')).toContain(variant.suffix)
    expect(personalized.channels.clip.script).toContain(variant.suffix)
    expect(personalized.channels.clip.script).not.toContain('kanomwan')
  })

  it('สลับชิ้นส่วนเหมือนเดิมเมื่อใช้ seed เดิม', () => {
    const pieces = ['www.', 'shop', '.com', 'https://', '/menu']
    expect(shuffleForStudent(pieces, 'student-a')).toEqual(shuffleForStudent(pieces, 'student-a'))
    expect(shuffleForStudent(pieces, 'student-a')).not.toEqual(shuffleForStudent(pieces, 'student-b'))
  })

  it('ยังคงใช้ piece id และช่องเดิมให้ server ตรวจคำตอบได้', () => {
    const mission = findMission('m2')!
    const base = assemblePlanOf(mission, 'student-a')!
    expect(base.slots.map((slot) => slot.id)).toEqual(['m2-g-slot1', 'm2-g-slot2', 'm2-g-slot3'])
    expect(new Set(base.pieces.map((piece) => piece.id))).toEqual(
      new Set(['m2-g-p1', 'm2-g-p2', 'm2-g-p3', 'm2-g-p4', 'm2-g-p5', 'm2-g-p6']),
    )
  })
})

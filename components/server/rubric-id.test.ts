import { describe, expect, it } from 'vitest'
import rubricJson from '../../content/rubric.json' with { type: 'json' }
import {
  isRubricId,
  rubricDimensions,
  toEmphasisOptionId,
  toRubricDimensionId,
} from './lesson-content'

/**
 * ตัวแปลงรหัสด้านของรูบริกต้องมีที่เดียว และต้องรับได้ครบทั้ง 3 ชุดรหัส
 *
 * ที่ต้องมีเทสต์ชุดนี้เพราะเคยพลาดมาแล้ว: หน้าด่านบอสเก็บ `focusRubricId` เป็น `bm-r*`
 * แต่ปลายทางที่ครูยืนยันคะแนนรับเฉพาะ `dim-*` / `emphasis-*` ส่งตรง ๆ แล้วได้ 400
 * เทสต์นี้ล็อกไว้ว่าตัวแปลงตัวเดียวรับได้หมดทุกชุด จะได้ไม่มีใครไปสร้างตารางแม็ปของตัวเองขึ้นมาอีก
 */
describe('ตัวแปลงรหัสด้านของรูบริก', () => {
  const dimensionIds = rubricDimensions.map((d) => d.id)
  const emphasisOptions = rubricJson.emphasis.options

  it('รหัสมาตรฐาน dim-* ส่งเข้ามาแล้วได้ตัวเดิมกลับไป', () => {
    for (const id of dimensionIds) {
      expect(toRubricDimensionId(id), `แปลง ${id} ไม่ได้`).toBe(id)
    }
  })

  it('รหัสเดิมของหน้าด่านบอส bm-r* แปลงเป็น dim-* ได้ครบทุกด้าน', () => {
    for (const dimension of rubricDimensions) {
      if (!dimension.sourceId) continue
      expect(
        toRubricDimensionId(dimension.sourceId),
        `${dimension.sourceId} ควรแปลงเป็น ${dimension.id}`,
      ).toBe(dimension.id)
    }
  })

  it('ทุกด้านต้องมี sourceId ไม่งั้น focusRubricId ของหน้าด่านบอสจะแปลงไม่ได้', () => {
    const missing = rubricDimensions.filter((d) => !d.sourceId).map((d) => d.id)
    expect(missing, 'ด้านที่ยังไม่มี sourceId').toEqual([])
  })

  it('รหัสตัวเลือกบนหน้าจอครู emphasis-* แปลงเป็น dim-* ได้ครบทุกด้าน', () => {
    for (const option of emphasisOptions) {
      expect(
        toRubricDimensionId(option.id),
        `${option.id} ควรแปลงเป็น ${option.dimensionId}`,
      ).toBe(option.dimensionId)
    }
  })

  it('แปลงกลับเป็น emphasis-* ได้จากรหัสทุกชุด', () => {
    for (const option of emphasisOptions) {
      // จาก dim-*
      expect(toEmphasisOptionId(option.dimensionId)).toBe(option.id)
      // จาก emphasis-* เอง
      expect(toEmphasisOptionId(option.id)).toBe(option.id)
    }
    // จาก bm-r* ของด้านเดียวกัน ต้องได้ emphasis-* ของด้านนั้น
    for (const dimension of rubricDimensions) {
      if (!dimension.sourceId) continue
      const expected = emphasisOptions.find((o) => o.dimensionId === dimension.id)?.id
      expect(toEmphasisOptionId(dimension.sourceId)).toBe(expected)
    }
  })

  it('รหัสที่ไม่รู้จักต้องคืน null ไม่ใช่เดาเป็นด้านแรก', () => {
    for (const bogus of ['dim-ไม่มีจริง', 'bm-r99', 'emphasis-ไม่มีจริง', '', 'naming']) {
      expect(toRubricDimensionId(bogus), `${bogus} ไม่ควรแปลงได้`).toBeNull()
      expect(toEmphasisOptionId(bogus), `${bogus} ไม่ควรแปลงได้`).toBeNull()
      expect(isRubricId(bogus)).toBe(false)
    }
  })

  it('isRubricId ยอมรับรหัสทั้ง 3 ชุด', () => {
    const everyShape = [
      ...dimensionIds,
      ...rubricDimensions.flatMap((d) => (d.sourceId ? [d.sourceId] : [])),
      ...emphasisOptions.map((o) => o.id),
    ]
    for (const id of everyShape) {
      expect(isRubricId(id), `${id} ควรเป็นรหัสที่รู้จัก`).toBe(true)
    }
  })

  it('แปลงกี่รอบก็ได้ค่าเดิม (ส่งผลลัพธ์กลับเข้าไปใหม่ต้องไม่เพี้ยน)', () => {
    for (const option of emphasisOptions) {
      const once = toRubricDimensionId(option.id)
      expect(once).not.toBeNull()
      expect(toRubricDimensionId(once as string)).toBe(once)
    }
  })
})

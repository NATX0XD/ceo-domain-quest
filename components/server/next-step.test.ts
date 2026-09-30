import { describe, expect, it } from 'vitest'
import { studentNextStep } from './next-step'

/**
 * ล็อกกติกาที่พังมาแล้วของจริง (flow-1.md ข้อ 1)
 *
 * งานชิ้นเดียวเคยขึ้น 3 สถานะคนละอย่างใน 3 จอ เพราะแต่ละจอเขียนเงื่อนไขเอง
 * เทสต์ชุดนี้ไม่ได้ตรวจความสวยของถ้อยคำ แต่ตรวจ **ความหมาย** ที่ห้ามขัดกันเอง:
 * ตอนที่ต้องลงมือ ห้ามมีคำว่า "รอ" และปุ่มต้องพาไปทำสิ่งที่ประโยคบอก
 */
describe('แหล่งความจริงเดียวของ "ตอนนี้ต้องทำอะไรต่อ"', () => {
  it('ครูส่งกลับมาให้แก้ = สั่งให้ลงมือ ห้ามมีคำว่ารอ และปุ่มต้องไปแก้งาน', () => {
    const step = studentNextStep({ status: 'keep-going', missingCount: 2 })
    expect(step.tone).toBe('act')
    expect(step.line).not.toMatch(/รอ/)
    expect(step.line).toContain('2 ด้าน')
    expect(step.primary.href).toBe('/ceo')
    expect(step.badge).toContain('2 ด้าน')
  })

  it('ยังรอครูอ่าน = บอกให้รอ แต่ต้องบอกด้วยว่าระหว่างรอทำอะไรได้', () => {
    const step = studentNextStep({ status: 'pending-teacher' })
    expect(step.tone).toBe('wait')
    expect(step.line).toMatch(/ระหว่างรอ/)
    expect(step.secondary).not.toBeNull()
  })

  it('ยังมีภารกิจย่อยค้าง ต้องพูดถึงภารกิจนั้นก่อน ไม่พูดเรื่องด่านบอส', () => {
    const step = studentNextStep({
      status: 'not-submitted',
      nextMission: { id: 'm3', title: 'จดชื่อเว็บ', order: 3 },
    })
    expect(step.primary.href).toBe('/mission/m3')
    expect(step.line).toContain('ภารกิจที่ 3')
    expect(step.line).not.toContain('ด่านบอส')
  })

  it('ทุกสถานะต้องมีทางไปต่อเสมอ และปุ่มหลักต้องมีคำกริยา', () => {
    for (const status of ['not-submitted', 'pending-teacher', 'keep-going', 'passed'] as const) {
      const step = studentNextStep({ status, missingCount: 1 })
      expect(step.primary.href.startsWith('/')).toBe(true)
      expect(step.primary.label.length).toBeGreaterThan(2)
      expect(step.line.length).toBeGreaterThan(10)
    }
  })

  it('จอ /ceo เองต้องไม่ได้ปุ่มที่พากลับมาหน้าเดิมแบบไร้ความหมาย', () => {
    const onBoss = studentNextStep({ status: 'pending-teacher', onBossScreen: true })
    expect(onBoss.primary.href).not.toBe('/ceo')
  })
})

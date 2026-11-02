import { describe, expect, it } from 'vitest'
import { answersAskedSuffix, matchIntent, smallTalkReply } from './counter-intent'

const ALL = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']

describe('matchIntent จับคำถามที่พิมพ์เองเฉพาะเมื่อเกี่ยวจริง', () => {
  it.each([
    ['จดทะเบียนบริษัทหรือยังครับ', 'q1'],
    ['เป็นบริษัทไหม', 'q1'],
    ['มีเอกสารอะไรบ้าง', 'q2'],
    ['มีหนังสือรับรองบริษัทไหม', 'q2'],
    ['ถือบัตรประชาชนมาไหม', 'q2'],
    ['เป็นหน่วยงานราชการหรือเปล่า', 'q3'],
    ['เป็นมูลนิธิไหม', 'q3'],
    ['มีโดเมน .th อยู่แล้วไหม', 'q4'],
    ['เคยจดชื่อเว็บมาก่อนไหม', 'q4'],
    ['จด VAT ไหม', 'q5'],
    ['มีเครื่องหมายการค้าไหม', 'q5'],
    ['จะเอาเว็บไปใช้ทำอะไร', 'q6'],
  ])('"%s" → %s', (text, id) => {
    expect(matchIntent(text, ALL)).toBe(id)
  })

  it.each(['กินข้าวหรือยัง', 'สบายดีไหม', 'วันนี้อากาศร้อนจัง', 'ชอบเล่นเกมอะไร', 'asdf', 'อืม', '555'])(
    'ไม่เกี่ยว "%s" → null (ไม่เสียสิทธิ์ถาม)',
    (text) => {
      expect(matchIntent(text, ALL)).toBeNull()
    },
  )

  it('เลือกได้เฉพาะ id ที่ส่งมา', () => {
    expect(matchIntent('มีเอกสารอะไรบ้าง', ['q1', 'q3'])).toBeNull()
  })
})

describe('smallTalkReply ลูกค้าตอบนอกเรื่องตามบท', () => {
  it('ตอบเรื่องกินข้าวแบบธรรมชาติ แล้วชวนกลับมาเรื่องจดชื่อเว็บ พร้อมคำลงท้ายตามเพศ', () => {
    const r = smallTalkReply('กินข้าวหรือยัง', 'ครับ')
    expect(r.reply).toBe('ยังเลยครับ แต่วันนี้มาเรื่องจดชื่อเว็บนะครับ')
    expect(smallTalkReply('กินข้าวยัง', 'ค่ะ').reply).not.toMatch(/ครับ/)
  })
  it('เรื่องที่ไม่รู้จัก = สีหน้าสงสัย และไม่มีคำลงท้ายซ้อน', () => {
    const r = smallTalkReply('qwerty', 'ค่ะ')
    expect(r.mood).toBe('confused')
    expect(r.reply).not.toMatch(/ค่ะค่ะ/)
    expect(r.reply).toMatch(/จดชื่อเว็บ/)
  })
})

describe('answersAskedSuffix', () => {
  const hb = [{ rows: [{ suffix: '.com .net .org' }, { suffix: '.in.th' }, { suffix: '.or.th' }, { suffix: '.net.th' }] }]
  it('ถาม .or.th แต่ตอบเรื่อง .in.th = ตอบผิดเรื่อง', () => {
    expect(answersAskedSuffix('.or.th ใครจดได้บ้าง', '.in.th ใช้บัตรประชาชนจดได้เลย', hb)).toBe(false)
    expect(answersAskedSuffix('.or.th ใครจดได้บ้าง', '.or.th สำหรับมูลนิธิหรือสมาคม', hb)).toBe(true)
  })
  it('.net.th ไม่ถูกนับเป็น .net และคำถามทั่วไปผ่านเสมอ', () => {
    expect(answersAskedSuffix('.net.th คืออะไร', 'ผู้ได้รับใบอนุญาต .net.th', hb)).toBe(true)
    expect(answersAskedSuffix('ต้องใช้เอกสารอะไร', 'ดูคู่มือนะ', hb)).toBe(true)
  })
})

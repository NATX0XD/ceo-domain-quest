import { describe, expect, it } from 'vitest'
import { MAX_LENGTH, checkDomainName, nextHint, normalize } from './domain-rules'

const SHOP = ['shop', 'cake', 'bakery']

function idsFailing(raw: string, keywords: string[] = SHOP) {
  return checkDomainName(raw, keywords)
    .results.filter((r) => !r.passed)
    .map((r) => r.id)
}

describe('normalize', () => {
  it('ตัดช่องว่างหัวท้ายและแปลงเป็นตัวพิมพ์เล็ก', () => {
    expect(normalize('  CakeShop  ')).toBe('cakeshop')
  })
})

describe('กฎข้อ 1 ความยาว', () => {
  it('สั้นกว่า 3 ตัวไม่ผ่าน', () => {
    expect(idsFailing('ab')).toContain('length')
  })

  it('ยาวเกิน 20 ตัวไม่ผ่าน', () => {
    expect(idsFailing('cake'.repeat(6))).toContain('length')
  })

  it('ยาว 20 ตัวพอดีผ่าน', () => {
    const name = 'cakeshop'.padEnd(MAX_LENGTH, 'x')
    expect(idsFailing(name)).not.toContain('length')
  })
})

describe('กฎข้อ 2 อักขระที่ใช้ได้', () => {
  it('มีช่องว่างไม่ผ่าน และบอกให้ใช้ขีดกลางแทน', () => {
    const check = checkDomainName('cake shop', SHOP)
    const charset = check.results.find((r) => r.id === 'charset')!
    expect(charset.passed).toBe(false)
    expect(charset.message).toContain('ขีดกลาง')
  })

  it('ตัวอักษรไทยไม่ผ่าน และแนะนำนามสกุล .ไทย', () => {
    const check = checkDomainName('ร้านเค้ก', SHOP)
    const charset = check.results.find((r) => r.id === 'charset')!
    expect(charset.passed).toBe(false)
    expect(charset.message).toContain('.ไทย')
  })

  it('อักขระพิเศษไม่ผ่าน', () => {
    expect(idsFailing('cake@shop')).toContain('charset')
  })

  it('ขีดกลางนำหน้าหรือปิดท้ายไม่ผ่าน', () => {
    expect(idsFailing('-cakeshop')).toContain('charset')
    expect(idsFailing('cakeshop-')).toContain('charset')
  })

  it('ตัวเลขและขีดกลางตรงกลางผ่าน', () => {
    expect(idsFailing('cake-shop24')).not.toContain('charset')
  })
})

describe('กฎข้อ 3 อ่านออกเสียงได้', () => {
  it('ตัวอักษรซ้ำติดกัน 3 ตัวไม่ผ่าน', () => {
    expect(idsFailing('shopppcake')).toContain('pronounceable')
  })

  it('ซ้ำติดกัน 2 ตัวยังผ่าน', () => {
    expect(idsFailing('shoppcake')).not.toContain('pronounceable')
  })

  it('ขีดกลางเกิน 1 ตัวไม่ผ่าน', () => {
    expect(idsFailing('my-cake-shop')).toContain('pronounceable')
  })
})

describe('กฎข้อ 4 สื่อถึงธุรกิจ', () => {
  it('ไม่มีคำสำคัญของธุรกิจไม่ผ่าน', () => {
    expect(idsFailing('somchai123')).toContain('relevant')
  })

  it('มีคำสำคัญผ่าน', () => {
    expect(idsFailing('cakelover')).not.toContain('relevant')
  })

  it('ยังไม่ได้เลือกประเภทธุรกิจถือว่ายังไม่ผ่าน', () => {
    expect(idsFailing('cakeshop', [])).toContain('relevant')
  })
})

describe('คะแนนรวมและมาตรวัด', () => {
  it('ชื่อที่ดีได้ครบ 4 ขีด', () => {
    const check = checkDomainName('cakeshop', SHOP)
    expect(check.score).toBe(4)
    expect(check.allPassed).toBe(true)
    expect(nextHint(check)).toBeNull()
  })

  it('ชื่อว่างได้ 0 ขีด', () => {
    const check = checkDomainName('', SHOP)
    expect(check.score).toBe(0)
    expect(check.allPassed).toBe(false)
  })

  it('คืนคำใบ้ข้อแรกที่ยังไม่ผ่าน', () => {
    const check = checkDomainName('ab', SHOP)
    expect(nextHint(check)).toContain('อย่างน้อย')
  })

  it('ผลลัพธ์มีครบ 4 ข้อเสมอ', () => {
    expect(checkDomainName('x', []).results).toHaveLength(4)
  })
})

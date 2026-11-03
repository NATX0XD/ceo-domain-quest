import { describe, expect, it } from 'vitest'
import type { CertificateData } from '../../core/report'
import { shopLabel } from '../../core/shop-name'
import {
  MARGIN_MM,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  certificateLayout,
  clampText,
  fitFontSize,
  thaiDate,
} from './data'

/** 29 กันยายน 2569 เวลา 10:00 ตามเวลาไทย */
const ISSUED_AT = Date.UTC(2026, 8, 29, 3, 0, 0)

function makeData(over: Partial<CertificateData> = {}): CertificateData {
  return {
    eligible: true,
    nickname: 'นิด',
    shopName: 'ขนมหวาน',
    domainFull: 'kanomwan.in.th',
    starsTotal: 12,
    starsMax: 15,
    level: 'ทำได้ดี',
    lines: [],
    issuedAt: ISSUED_AT,
    ...over,
  }
}

function block(layout: ReturnType<typeof certificateLayout>, id: string) {
  return layout.blocks.find((b) => b.id === id)
}

describe('วันที่แบบไทย', () => {
  it('แปลงเป็นวันเดือนปีพุทธศักราชได้ถูก', () => {
    expect(thaiDate(ISSUED_AT)).toBe('29 กันยายน 2569')
  })

  it('ข้ามวันตามเวลาไทย ไม่ใช่เวลาสากล', () => {
    // 23:30 ตามเวลาไทยของวันที่ 29 ยังต้องเป็นวันที่ 29
    expect(thaiDate(Date.UTC(2026, 8, 29, 16, 30))).toBe('29 กันยายน 2569')
    expect(thaiDate(Date.UTC(2026, 8, 29, 17, 30))).toBe('30 กันยายน 2569')
  })

  it('ค่าที่อ่านไม่ได้คืนข้อความว่าง ไม่พัง', () => {
    expect(thaiDate(Number.NaN)).toBe('')
  })
})

describe('คุมข้อความไม่ให้ล้นกระดาษ', () => {
  it('ชื่อสั้นใช้ขนาดตัวอักษรเต็ม', () => {
    expect(fitFontSize('นิด', 261, 32)).toBe(32)
  })

  it('ชื่อยาวมากถูกย่อขนาดลง แต่ไม่เล็กกว่าที่อ่านออก', () => {
    const longName = 'น้องน้ำหวานคนสวยแห่งห้องเรียนออนไลน์วิทยาลัยเทคนิคกาญจนบุรี'
    const size = fitFontSize(longName, 261, 32)
    expect(size).toBeLessThan(32)
    expect(size).toBeGreaterThanOrEqual(10)
  })

  it('ข้อความที่ยาวเกินจริงถูกตัดด้วยจุดไข่ปลา', () => {
    expect(clampText('abcdefghij', 5)).toBe('abcd…')
    expect(clampText('สั้น', 10)).toBe('สั้น')
  })
})

describe('โครงใบประกาศ', () => {
  const layout = certificateLayout(makeData())

  it('เป็น A4 แนวนอน ขนาดถูกต้อง', () => {
    expect(layout.pageSize).toBe('a4')
    expect(layout.orientation).toBe('landscape')
    expect(layout.widthMm).toBe(PAGE_WIDTH_MM)
    expect(layout.heightMm).toBe(PAGE_HEIGHT_MM)
  })

  it('มีข้อความครบตามแบบ ทั้งหัวเรื่อง ชื่อ ร้าน ดาว วันที่ วิชา และสถานศึกษา', () => {
    expect(block(layout, 'title')?.text).toBe('เกียรติบัตร')
    expect(block(layout, 'subtitle')?.text).toBe('นักธุรกิจออนไลน์รุ่นเยาว์')
    expect(block(layout, 'nickname')?.text).toBe('นิด')
    expect(block(layout, 'shop')?.text).toContain('ขนมหวาน')
    expect(block(layout, 'shop')?.text).toContain('kanomwan.in.th')
    expect(block(layout, 'level')).toBeUndefined()
    expect(block(layout, 'issued-at')?.text).toContain('29 กันยายน 2569')
    expect(block(layout, 'course')?.text).toContain('21910-2002')
    // เกียรติบัตรไม่ระบุชื่อโรงเรียน/มหาวิทยาลัย
    expect(block(layout, 'school')).toBeUndefined()
  })

  it('ทุกข้อความอยู่ในกรอบกระดาษ ไม่ล้นขอบ', () => {
    for (const b of layout.blocks) {
      expect(b.y).toBeGreaterThan(0)
      expect(b.y).toBeLessThan(PAGE_HEIGHT_MM)
      expect(b.maxWidth).toBeLessThanOrEqual(PAGE_WIDTH_MM - MARGIN_MM * 2)
      expect(b.x - b.maxWidth / 2).toBeGreaterThanOrEqual(MARGIN_MM - 0.001)
    }
  })

  it('ดาวที่เก็บได้และดาวเต็มถูกส่งต่อให้ตัววาด', () => {
    expect(layout.stars.filled).toBe(12)
    expect(layout.stars.total).toBe(15)
  })

  it('ชื่อเล่นยาวมากถูกย่อขนาด ไม่ใช่ปล่อยให้ล้น', () => {
    const long = certificateLayout(
      makeData({ nickname: 'น้องน้ำหวานคนสวยแห่งห้องเรียนออนไลน์วิทยาลัยเทคนิคกาญจนบุรี' }),
    )
    expect(block(long, 'nickname')!.size).toBeLessThan(block(layout, 'nickname')!.size)
  })

  it('ชื่อร้านภาษาไทยถูกส่งต่อโดยไม่ถูกแปลงรูป', () => {
    const thai = certificateLayout(makeData({ shopName: 'ขนมหวานบ้านสวน', domainFull: '' }))
    expect(block(thai, 'shop')?.text).toBe('ร้าน ขนมหวานบ้านสวน')
  })

  /** เด็กไทยตั้งชื่อร้านขึ้นต้นด้วยคำว่า "ร้าน" เป็นปกติ ใบประกาศต้องไม่ขึ้นว่า "ร้าน ร้าน…" */
  describe('คำว่า "ร้าน" ต้องไม่ซ้ำ', () => {
    it('ชื่อที่ขึ้นต้นด้วย "ร้าน" อยู่แล้ว ไม่ถูกเติมซ้ำ', () => {
      expect(shopLabel('ร้านขนมหวานบ้านสวน')).toBe('ร้านขนมหวานบ้านสวน')
      expect(shopLabel('ร้าน กาแฟแม่')).toBe('ร้าน กาแฟแม่')
      const onCert = certificateLayout(
        makeData({ shopName: 'ร้านของผู้เรียน8', domainFull: 'evidenceshop.com' }),
      )
      expect(block(onCert, 'shop')?.text).toBe('ร้านของผู้เรียน8 · evidenceshop.com')
      expect(block(onCert, 'shop')?.text).not.toContain('ร้าน ร้าน')
    })

    it('ชื่อที่ยังไม่มีคำว่า "ร้าน" ยังได้คำนำหน้าเหมือนเดิม', () => {
      expect(shopLabel('กาแฟแม่')).toBe('ร้าน กาแฟแม่')
      const onCert = certificateLayout(
        makeData({ shopName: 'ขนมพี่หนู', domainFull: 'kanompeenu.com' }),
      )
      expect(block(onCert, 'shop')?.text).toBe('ร้าน ขนมพี่หนู · kanompeenu.com')
    })

    it('ยังไม่ได้ตั้งชื่อร้านแต่จดโดเมนแล้ว ไม่ขึ้นคำว่า "ร้าน" ลอย ๆ นำหน้าจุดคั่น', () => {
      const onCert = certificateLayout(makeData({ shopName: '', domainFull: 'myshop.com' }))
      expect(block(onCert, 'shop')?.text).toBe('myshop.com')
      expect(shopLabel('   ')).toBe('')
    })
  })
})

describe('ใบประกาศออกให้ทุกคนที่เข้าร่วม', () => {
  it('ได้ 0 ดาวก็ยังได้โครงใบประกาศครบ ไม่โยน error', () => {
    const layout = certificateLayout(makeData({ starsTotal: 0, level: 'เข้าร่วม' }))
    expect(layout.blocks.length).toBeGreaterThan(0)
    expect(block(layout, 'nickname')?.text).toBe('นิด')
    expect(layout.stars.filled).toBe(0)
  })

  it('ยังไม่ได้จดโดเมน ก็ยังมีบรรทัดแทนให้ ไม่เว้นว่าง', () => {
    const layout = certificateLayout(makeData({ shopName: '', domainFull: '' }))
    expect(block(layout, 'shop')?.text.length).toBeGreaterThan(0)
  })

  it('ไม่มีวันที่ ก็ไม่พิมพ์บรรทัดวันที่ แต่ใบประกาศยังออกได้', () => {
    const layout = certificateLayout(makeData({ issuedAt: null }))
    expect(block(layout, 'issued-at')).toBeUndefined()
    expect(block(layout, 'title')?.text).toBe('เกียรติบัตร')
  })

  it('ใส่ชื่อวิชาทับได้จากหน้าจอ และไม่มีบรรทัดชื่อสถานศึกษา', () => {
    const layout = certificateLayout(makeData(), { courseName: 'วิชาทดสอบ' })
    expect(block(layout, 'course')?.text).toBe('วิชาทดสอบ')
    expect(block(layout, 'school')).toBeUndefined()
  })

  it('ใช้ชื่อที่ผู้เรียนกำหนดบนเกียรติบัตรแทนชื่อเล่นได้', () => {
    const layout = certificateLayout(makeData({ nickname: 'อาร์ม' }), { displayName: 'อาร์ม ใจดี' })
    expect(block(layout, 'nickname')?.text).toBe('อาร์ม ใจดี')
  })
})

import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import type { CertificateData } from '../../core/report'
import { certificateLayout } from './data'
import { type ThaiFontSet, loadThaiFonts, toBase64 } from './font'
import { certificateFileName, renderCertificate, renderCertificatePdf } from './render'

/** อ่านไฟล์ฟอนต์จริงจาก public/fonts ไม่ mock เพราะจุดที่จะพังคือฟอนต์ */
const diskLoader = (fileName: string) => readFile(`public/fonts/${fileName}`)

let fonts: ThaiFontSet

beforeAll(async () => {
  fonts = await loadThaiFonts(diskLoader)
})

function makeData(over: Partial<CertificateData> = {}): CertificateData {
  return {
    eligible: true,
    nickname: 'ผู้เรียน',
    shopName: 'ขนมบ้านยาย',
    domainFull: 'kanombanyai.in.th',
    starsTotal: 12,
    starsMax: 15,
    level: 'ทำได้ดี',
    lines: [],
    issuedAt: Date.UTC(2026, 8, 29, 3, 0, 0),
    ...over,
  }
}

/**
 * ดึงข้อความกลับออกมาจาก PDF เพื่อพิสูจน์ว่าภาษาไทยไม่เพี้ยน
 *
 * jsPDF เขียนข้อความเป็นรหัสกลิฟของฟอนต์ที่ฝังไว้ (Identity-H) อ่านตรง ๆ ไม่ได้
 * แต่มันแนบตาราง ToUnicode มาด้วย จึงแปลงรหัสกลิฟกลับเป็นตัวอักษรได้
 * วิธีนี้ทำให้เทสต์ตรวจเองได้โดยไม่ต้องพึ่งโปรแกรมภายนอกอย่าง pdftotext
 */
function extractText(pdf: Uint8Array): string {
  const raw = Buffer.from(pdf).toString('latin1')

  const glyphToChar = new Map<string, string>()
  for (const block of raw.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1]!.matchAll(/<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4,})>/g)) {
      const glyph = pair[1]!.toLowerCase()
      if (glyphToChar.has(glyph)) continue
      const codeUnits = pair[2]!.match(/.{4}/g) ?? []
      glyphToChar.set(glyph, codeUnits.map((u) => String.fromCharCode(Number.parseInt(u, 16))).join(''))
    }
  }

  const lines: string[] = []
  for (const shown of raw.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g)) {
    const glyphs = shown[1]!.match(/.{4}/g) ?? []
    lines.push(glyphs.map((g) => glyphToChar.get(g.toLowerCase()) ?? '�').join(''))
  }
  return lines.join('\n')
}

describe('สร้างไฟล์ PDF ได้จริง', () => {
  it('ได้ไฟล์ PDF ที่มีขนาดมากกว่าศูนย์ และขึ้นต้นด้วยหัวไฟล์ PDF', () => {
    const pdf = renderCertificate(makeData(), fonts)
    expect(pdf.length).toBeGreaterThan(1000)
    expect(Buffer.from(pdf.slice(0, 5)).toString('latin1')).toBe('%PDF-')
  })

  it('ไม่ส่งฟอนต์ไทยมาต้องโยน error ไม่ใช่วาดใบที่ข้อความไทยหายทั้งใบ', () => {
    expect(() =>
      renderCertificatePdf(certificateLayout(makeData()), { regularBase64: '', boldBase64: '' }),
    ).toThrow('ฟอนต์ไทย')
  })

  it('ชื่อไฟล์ที่เสนอตอนดาวน์โหลดมีชื่อเล่นของผู้เรียน และไม่มีอักขระต้องห้าม', () => {
    expect(certificateFileName(makeData({ nickname: 'นิด' }))).toBe('เกียรติบัตร-นิด.pdf')
    expect(certificateFileName(makeData({ nickname: 'a/b c' }))).toBe('เกียรติบัตร-a-b-c.pdf')
    expect(certificateFileName(makeData({ nickname: '' }))).toBe('เกียรติบัตร-ผู้เรียน.pdf')
  })
})

describe('ภาษาไทยใน PDF ต้องไม่เพี้ยน', () => {
  const text = () => extractText(renderCertificate(makeData(), fonts))

  it('คำที่มีสระบน สระล่าง และวรรณยุกต์ซ้อน ดึงกลับมาได้ตรงตัวอักษรเดิม', () => {
    const extracted = text()
    for (const word of [
      'เกียรติบัตร',
      'นักธุรกิจออนไลน์รุ่นเยาว์',
      'ผู้เรียน',
      'ขนมบ้านยาย',
    ]) {
      expect(extracted).toContain(word)
    }
  })

  it('ไม่มีอักขระที่แปลงกลับไม่ได้ปนอยู่เลย', () => {
    expect(text()).not.toContain('�')
  })

  it('ตัวเลข วันที่ไทย และชื่อโดเมนอังกฤษอยู่ครบ', () => {
    const extracted = text()
    expect(extracted).toContain('kanombanyai.in.th')
    expect(extracted).toContain('29 กันยายน 2569')
    expect(extracted).toContain('21910-2002')
    expect(extracted).not.toContain('ทำได้ดี')
    expect(extracted).not.toContain('ระดับ')
  })

  it('ชื่อร้านภาษาไทยที่มีวรรณยุกต์บนสระ ออกมาเรียงอักขระเหมือนต้นฉบับทุกตัว', () => {
    const shopName = 'ร้านขนมป้าน้อยแสนอร่อย'
    const extracted = extractText(renderCertificate(makeData({ shopName }), fonts))
    expect(extracted).toContain(shopName)
    expect([...shopName].every((ch) => extracted.includes(ch))).toBe(true)
  })
})

describe('ใบประกาศให้ทุกคนที่เข้าร่วม', () => {
  it('ได้ 0 ดาวก็ยังออกไฟล์ PDF ได้ และมีชื่อผู้เรียนอยู่บนใบ', () => {
    const pdf = renderCertificate(makeData({ starsTotal: 0, level: 'เข้าร่วม' }), fonts)
    const extracted = extractText(pdf)
    expect(pdf.length).toBeGreaterThan(1000)
    expect(extracted).toContain('ผู้เรียน')
    expect(extracted).not.toContain('ระดับ')
  })

  it('ยังไม่มีชื่อร้านและยังไม่ได้จดโดเมน ก็ยังออกใบได้', () => {
    const pdf = renderCertificate(makeData({ shopName: '', domainFull: '' }), fonts)
    expect(pdf.length).toBeGreaterThan(1000)
    expect(extractText(pdf)).toContain('เกียรติบัตร')
  })
})

describe('ชื่อยาวต้องไม่ล้นขอบกระดาษ', () => {
  const longNickname = 'น้องน้ำหวานคนสวยแห่งห้องเรียนออนไลน์วิทยาลัยเทคนิคกาญจนบุรี'

  it('ชื่อเล่นยาวมากยังอยู่ครบบนใบ ไม่ถูกตัดหาย', () => {
    const extracted = extractText(renderCertificate(makeData({ nickname: longNickname }), fonts))
    expect(extracted).toContain(longNickname)
  })

  it('ความกว้างจริงของทุกบรรทัดไม่เกินกรอบที่กำหนดไว้', async () => {
    const { jsPDF } = await import('jspdf')
    const layout = certificateLayout(
      makeData({ nickname: longNickname, shopName: 'ร้านขนมหวานบ้านสวนของคุณยายที่ชื่อยาวมากจริง ๆ' }),
    )
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.addFileToVFS('Sarabun-Regular.ttf', fonts.regularBase64)
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
    doc.addFileToVFS('Sarabun-Bold.ttf', fonts.boldBase64)
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold')

    for (const blockItem of layout.blocks) {
      doc.setFont('Sarabun', blockItem.bold ? 'bold' : 'normal')
      // ตัววาดย่อขนาดซ้ำได้อีกชั้น ที่นี่ตรวจว่าขนาดที่ data.ts เสนอมาไม่ได้เกินกรอบเกินไปจนย่อไม่ไหว
      let size = blockItem.size
      doc.setFontSize(size)
      while (size > 8 && doc.getTextWidth(blockItem.text) > blockItem.maxWidth) {
        size -= 1
        doc.setFontSize(size)
      }
      expect(doc.getTextWidth(blockItem.text)).toBeLessThanOrEqual(blockItem.maxWidth)
      expect(size).toBeGreaterThanOrEqual(8)
    }
  })
})

describe('ฟอนต์ที่ฝังลงไฟล์', () => {
  it('ฟอนต์ไทยถูกฝังลงใน PDF จริง ไม่ได้อ้างฟอนต์ของเครื่องที่เปิดไฟล์', () => {
    const raw = Buffer.from(renderCertificate(makeData(), fonts)).toString('latin1')
    expect(raw).toContain('FontFile2')
    expect(raw).toContain('Identity-H')
  })

  it('แปลงไบต์เป็น base64 ได้ถูกต้องทั้งกรณีที่ความยาวหาร 3 ไม่ลงตัว', () => {
    expect(toBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu')
    expect(toBase64(new Uint8Array([77, 97]))).toBe('TWE=')
    expect(toBase64(new Uint8Array([77]))).toBe('TQ==')
  })

  it('โหลดฟอนต์จากดิสก์ได้ทั้งสองน้ำหนัก และได้ base64 ที่ยาวพอเป็นไฟล์ฟอนต์จริง', () => {
    expect(fonts.regularBase64.length).toBeGreaterThan(10_000)
    expect(fonts.boldBase64.length).toBeGreaterThan(10_000)
    expect(fonts.regularBase64).not.toBe(fonts.boldBase64)
  })
})

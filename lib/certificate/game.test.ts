import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { type ThaiFontSet, loadThaiFonts } from './font'
import { type GameCertificateInput, gameCertificateContent, renderGameCertificatePdf } from './game'

let fonts: ThaiFontSet
beforeAll(async () => {
  fonts = await loadThaiFonts((f) => readFile(`public/fonts/${f}`))
})

const input: GameCertificateInput = {
  nickname: 'Nattawat',
  shopName: 'ร้านร่ายมนต์',
  domainFull: 'raimon.in.th',
  starsTotal: 12,
  starsMax: 15,
  missionsPassed: 4,
  missionsTotal: 4,
  ceoScore: { total: 11, max: 15, source: 'ai' },
  issuedAt: Date.UTC(2026, 10, 2, 5),
}

describe('เกียรติบัตรแบบเกม', () => {
  it('ข้อความครบ: ชื่อ ร้าน+โดเมน ภารกิจ คะแนน CEO วิชา วันที่ พ.ศ.', () => {
    const c = gameCertificateContent(input)
    expect(c.nickname).toBe('Nattawat')
    // ชื่อร้านที่ขึ้นต้นด้วย "ร้าน" อยู่แล้วต้องไม่ซ้ำเป็น "ร้านร้าน"
    expect(c.shopLine).toBe('CEO ร้านร่ายมนต์ · raimon.in.th')
    expect(c.achievement).toContain('4/4')
    expect(c.scoreLine).toContain('11/15')
    expect(c.scoreLine).toContain('ตรวจอัตโนมัติ')
    expect(c.course).toContain('21910-2002')
    expect(c.date).toBe('ให้ไว้ ณ วันที่ 2 พฤศจิกายน 2569')
    expect(c.starsFilled).toBe(12)
    expect(c.starsTotal).toBe(15)
  })

  it('ไม่มีรูปประกอบเลยก็ยังวาด PDF ได้ (รูปทรงสำรอง)', () => {
    const pdf = renderGameCertificatePdf(input, fonts, {})
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-')
  })

  it('ไม่มีฟอนต์ไทย = โยน error ไม่ออกใบเปล่า', () => {
    expect(() => renderGameCertificatePdf(input, { regularBase64: '', boldBase64: '' })).toThrow()
  })
})

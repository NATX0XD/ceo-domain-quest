/**
 * เกียรติบัตรแบบเกม (A4 แนวนอน) — ใช้ทั้ง PDF (/api/certificate) และพรีวิวบนหน้า /result
 *
 * `gameCertificateContent()` คือข้อความชุดเดียวที่ทั้งสองที่ใช้ ไม่ให้ PDF กับหน้าเว็บพูดคนละอย่าง
 * `renderGameCertificatePdf()` วาดด้วย jsPDF + ภาพจาก public/ui/cert/ (ไม่มีรูปไหนก็วาดรูปทรงแทน)
 */
import { jsPDF } from 'jspdf'
import { DEFAULT_COURSE_NAME, DEFAULT_SCHOOL_NAME, PAGE_HEIGHT_MM, PAGE_WIDTH_MM, thaiDate } from './data'
import { THAI_FONT_NAME, type ThaiFontSet } from './font'
import type { CertArt, CertImage, CertTheme } from './art'

export interface GameCertificateInput {
  nickname: string
  /** ชื่อเต็มบนใบประกาศ; ว่างหรือไม่ส่ง = ใช้ nickname */
  displayName?: string
  shopName: string
  /** ชื่อเว็บเต็มจากใบเสนอ CEO เช่น mycake.co.th */
  domainFull: string
  starsTotal: number
  starsMax: number
  missionsPassed: number
  missionsTotal: number
  ceoScore: { total: number; max: number; source: 'teacher' | 'ai' | 'rules' } | null
  issuedAt: number
  courseName?: string
  schoolName?: string
}

export interface GameCertificateContent {
  title: string
  product: string
  presentTo: string
  nickname: string
  shopLine: string
  achievement: string
  scoreLine: string | null
  starsFilled: number
  starsTotal: number
  starsLabel: string
  course: string
  school: string
  date: string
}

function clean(value: string | null | undefined, max: number): string {
  const v = (value ?? '').trim().replace(/\s+/g, ' ')
  return v.length > max ? `${v.slice(0, max - 1)}…` : v
}

export function gameCertificateContent(input: GameCertificateInput): GameCertificateContent {
  const starsTotal = Math.max(0, Math.round(input.starsMax || 15))
  const starsFilled = Math.max(0, Math.min(starsTotal, Math.round(input.starsTotal || 0)))
  const shop = clean(input.shopName, 40)
  const domain = clean(input.domainFull, 48)
  const shopLabel = shop.startsWith('ร้าน') ? shop : `ร้าน${shop}`
  const shopLine = shop && domain ? `CEO ${shopLabel} · ${domain}` : shop ? `CEO ${shopLabel}` : domain ? `เจ้าของชื่อเว็บ ${domain}` : 'CEO ผู้ตั้งชื่อเว็บให้ร้านของตัวเอง'
  const score = input.ceoScore
  const displayName = input.displayName
    ? clean(input.displayName, 60) || 'ผู้เรียน'
    : clean(input.nickname, 32) || 'ผู้เรียน'
  return {
    title: 'เกียรติบัตร',
    product: 'CEO Domain Quest',
    presentTo: 'ขอมอบเกียรติบัตรนี้ให้ไว้เพื่อแสดงว่า',
    nickname: displayName,
    shopLine,
    achievement: `ผ่านภารกิจครบ ${input.missionsPassed}/${input.missionsTotal} ด่าน และส่งใบเสนอด่านบอส CEO แล้ว`,
    scoreLine: score
      ? `คะแนนใบเสนอ CEO ${score.total}/${score.max}${score.source === 'teacher' ? ' (ครูยืนยันแล้ว)' : ' (ตรวจอัตโนมัติ)'}`
      : null,
    starsFilled,
    starsTotal,
    starsLabel: `เก็บดาวได้ ${starsFilled} จาก ${starsTotal} ดวง`,
    course: input.courseName ?? DEFAULT_COURSE_NAME,
    school: input.schoolName ?? DEFAULT_SCHOOL_NAME,
    date: `ให้ไว้ ณ วันที่ ${thaiDate(input.issuedAt)}`,
  }
}

const W = PAGE_WIDTH_MM
const H = PAGE_HEIGHT_MM
const CX = W / 2

type RGB = [number, number, number]
const BROWN: RGB = [92, 52, 22]
const INK: RGB = [58, 33, 14]
const MUTED: RGB = [120, 86, 52]
const GOLD: RGB = [214, 158, 36]
const GOLD_DARK: RGB = [160, 104, 18]
const CREAM: RGB = [255, 248, 228]
const RIBBON: RGB = [186, 52, 42]
const RIBBON_DARK: RGB = [128, 30, 26]
const LEAF: RGB = [86, 150, 62]

function fill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2])
}
function stroke(doc: jsPDF, c: RGB) {
  doc.setDrawColor(c[0], c[1], c[2])
}
function color(doc: jsPDF, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2])
}

function poly(doc: jsPDF, pts: [number, number][], style: 'F' | 'S' | 'FD') {
  const [start, ...rest] = pts
  const lines: [number, number][] = []
  let prev = start!
  for (const p of rest) {
    lines.push([p[0] - prev[0], p[1] - prev[1]])
    prev = p
  }
  doc.lines(lines, start![0], start![1], [1, 1], style, true)
}

function starPts(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)])
  }
  return pts
}

/** วางรูปให้พอดีกล่อง (contain) กึ่งกลาง */
function image(doc: jsPDF, img: CertImage, x: number, y: number, w: number, h: number) {
  let iw = w
  let ih = w / img.aspect
  if (ih > h) {
    ih = h
    iw = h * img.aspect
  }
  doc.addImage(img.data, img.format, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, undefined, 'FAST')
}

function drawBackground(doc: jsPDF, art: CertArt) {
  if (art.bg) {
    doc.addImage(art.bg.data, art.bg.format, 0, 0, W, H, undefined, 'FAST')
    return
  }
  // กระดาษ + กรอบไม้ + เส้นทอง + ใบไม้มุม
  fill(doc, [246, 226, 186])
  doc.rect(0, 0, W, H, 'F')
  fill(doc, BROWN)
  doc.rect(4, 4, W - 8, H - 8, 'F')
  fill(doc, [252, 241, 214])
  doc.rect(12, 12, W - 24, H - 24, 'F')
  stroke(doc, GOLD)
  doc.setLineWidth(1)
  doc.rect(16, 16, W - 32, H - 32, 'S')
  doc.setLineWidth(0.3)
  doc.rect(18, 18, W - 36, H - 36, 'S')
  fill(doc, LEAF)
  for (const [x, y] of [
    [12, 12],
    [W - 12, 12],
    [12, H - 12],
    [W - 12, H - 12],
  ] as const) {
    doc.circle(x, y, 7, 'F')
    fill(doc, GOLD)
    doc.circle(x, y, 3, 'F')
    fill(doc, LEAF)
  }
}

function drawRibbon(doc: jsPDF, art: CertArt, title: string) {
  const w = 150
  const h = 30
  const x = CX - w / 2
  const y = 16
  if (art.ribbon) {
    // ป้ายไม้ว่างตรงกลาง (ภาพกว้าง:สูง ≈ 3:1) — วางให้สูง 50 มม. แล้วเขียนชื่อสีน้ำตาลเข้มลงบนป้าย
    image(doc, art.ribbon, CX - 90, 10, 180, 50)
    doc.setFont(THAI_FONT_NAME, 'bold')
    doc.setFontSize(30)
    color(doc, BROWN)
    doc.text(title, CX, 38.5, { align: 'center' })
    return
  } else {
    fill(doc, RIBBON_DARK)
    poly(doc, [[x - 12, y + 8], [x + 8, y + 8], [x + 8, y + h + 4], [x - 12, y + h + 4], [x - 4, y + 18 + 4]], 'F')
    poly(doc, [[x + w + 12, y + 8], [x + w - 8, y + 8], [x + w - 8, y + h + 4], [x + w + 12, y + h + 4], [x + w + 4, y + 18 + 4]], 'F')
    fill(doc, RIBBON)
    doc.roundedRect(x, y, w, h, 3, 3, 'F')
    stroke(doc, GOLD)
    doc.setLineWidth(0.6)
    doc.roundedRect(x + 2, y + 2, w - 4, h - 4, 2, 2, 'S')
  }
  doc.setFont(THAI_FONT_NAME, 'bold')
  doc.setFontSize(34)
  color(doc, CREAM)
  doc.text(title, CX, y + h / 2 + 4.2, { align: 'center' })
}

function drawSeal(doc: jsPDF, art: CertArt, x: number, y: number, size: number) {
  if (art.seal) {
    image(doc, art.seal, x, y, size, size)
    return
  }
  const cx = x + size / 2
  const cy = y + size / 2
  fill(doc, RIBBON)
  poly(doc, [[cx - 9, cy + 6], [cx - 3, cy + 6], [cx - 6, cy + size / 2 + 6], [cx - 12, cy + size / 2 + 2]], 'F')
  poly(doc, [[cx + 9, cy + 6], [cx + 3, cy + 6], [cx + 6, cy + size / 2 + 6], [cx + 12, cy + size / 2 + 2]], 'F')
  fill(doc, GOLD)
  doc.circle(cx, cy, size / 2 - 2, 'F')
  stroke(doc, GOLD_DARK)
  doc.setLineWidth(0.8)
  doc.circle(cx, cy, size / 2 - 5, 'S')
  fill(doc, CREAM)
  poly(doc, starPts(cx, cy - 2, size / 6), 'F')
  doc.setFont(THAI_FONT_NAME, 'bold')
  doc.setFontSize(9)
  color(doc, BROWN)
  doc.text('CEO', cx, cy + size / 4, { align: 'center' })
}

function drawDome(doc: jsPDF, art: CertArt, x: number, y: number, w: number, h: number) {
  if (art.dome) {
    image(doc, art.dome, x, y, w, h)
    return
  }
  // โดมแบบย่อ: ตัวกลมสีม่วง + ม้วนเกียรติบัตร
  const cx = x + w / 2
  const cy = y + h * 0.55
  fill(doc, [150, 110, 220])
  doc.circle(cx, cy, w * 0.32, 'F')
  fill(doc, [255, 255, 255])
  doc.circle(cx - 5, cy - 3, 3, 'F')
  doc.circle(cx + 5, cy - 3, 3, 'F')
  fill(doc, INK)
  doc.circle(cx - 5, cy - 3, 1.4, 'F')
  doc.circle(cx + 5, cy - 3, 1.4, 'F')
  fill(doc, CREAM)
  stroke(doc, GOLD_DARK)
  doc.setLineWidth(0.4)
  doc.roundedRect(cx + w * 0.18, cy + 2, 16, 6, 3, 3, 'FD')
  fill(doc, RIBBON)
  doc.rect(cx + w * 0.18 + 7, cy + 2, 2, 6, 'F')
}

function drawStars(doc: jsPDF, art: CertArt, filled: number, total: number, y: number) {
  if (total <= 0) return
  const size = 8.5
  const gap = Math.min(10.5, 190 / total)
  const start = CX - (gap * (total - 1)) / 2
  for (let i = 0; i < total; i++) {
    const on = i < filled
    const img = on ? art.starFull : art.starEmpty
    const cx = start + gap * i
    if (img) {
      image(doc, img, cx - size / 2, y - size / 2, size, size)
      continue
    }
    fill(doc, on ? GOLD : [236, 222, 196])
    stroke(doc, on ? GOLD_DARK : [196, 172, 132])
    doc.setLineWidth(0.4)
    poly(doc, starPts(cx, y, size / 2), 'FD')
  }
}

/** เขียนข้อความกึ่งกลาง ย่อขนาดเองถ้ายาวเกินความกว้างที่ให้ */
function centered(doc: jsPDF, text: string, y: number, size: number, maxWidth: number, bold = false, c: RGB = INK) {
  doc.setFont(THAI_FONT_NAME, bold ? 'bold' : 'normal')
  let s = size
  doc.setFontSize(s)
  while (s > 8 && doc.getTextWidth(text) > maxWidth) {
    s -= 1
    doc.setFontSize(s)
  }
  color(doc, c)
  doc.text(text, CX, y, { align: 'center' })
}

/** ตำแหน่งโดม/ตรา (มม.) ต่อธีม — พรีวิว HTML ใช้ค่าชุดเดียวกัน */
export const DECOR_POS = {
  classic: { dome: { x: 30, y: 124, w: 42, h: 52 }, seal: { x: W - 74, y: 126, size: 44 } },
  domain: { dome: { x: 60, y: 136, w: 36, h: 42 }, seal: { x: W - 94, y: 137, size: 36 } },
} as const satisfies Record<CertTheme, unknown>

export function renderGameCertificatePdf(
  input: GameCertificateInput,
  fonts: ThaiFontSet,
  art: CertArt = {},
  theme: CertTheme = 'classic',
): Uint8Array {
  if (!fonts?.regularBase64 || !fonts?.boldBase64) {
    throw new Error('ต้องโหลดฟอนต์ไทยก่อนวาดใบประกาศ ไม่งั้นข้อความไทยจะหายทั้งใบ')
  }
  const c = gameCertificateContent(input)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  doc.addFileToVFS('Sarabun-Regular.ttf', fonts.regularBase64)
  doc.addFont('Sarabun-Regular.ttf', THAI_FONT_NAME, 'normal')
  doc.addFileToVFS('Sarabun-Bold.ttf', fonts.boldBase64)
  doc.addFont('Sarabun-Bold.ttf', THAI_FONT_NAME, 'bold')
  doc.setProperties({ title: `${c.title} ${c.nickname} — ${c.product}` })

  drawBackground(doc, art)
  if (theme === 'domain' && art.bg) {
    // พื้นหลังธีมโดเมนมีป้ายไม้ว่างด้านบนอยู่แล้ว เขียนชื่อลงป้ายตรง ๆ
    doc.setFont(THAI_FONT_NAME, 'bold')
    doc.setFontSize(28)
    color(doc, BROWN)
    doc.text(c.title, CX, 31, { align: 'center' })
  } else {
    drawRibbon(doc, art, c.title)
  }

  const textW = 170
  centered(doc, c.product, 59, 16, textW, true, GOLD_DARK)
  centered(doc, c.presentTo, 68, 13, textW, false, MUTED)
  centered(doc, c.nickname, 86, 40, textW, true, BROWN)
  // เส้นใต้ชื่อ
  stroke(doc, GOLD)
  doc.setLineWidth(0.6)
  doc.line(CX - 60, 91, CX + 60, 91)
  centered(doc, c.shopLine, 100, 15, textW, true, INK)
  centered(doc, c.achievement, 109, 13, textW, false, INK)
  if (c.scoreLine) centered(doc, c.scoreLine, 117, 13, textW, true, GOLD_DARK)

  drawStars(doc, art, c.starsFilled, c.starsTotal, 129)
  centered(doc, c.starsLabel, 140, 11, textW, false, MUTED)

  centered(doc, c.course, 152, 12, textW, true, INK)
  centered(doc, c.school, 159, 11, textW, false, MUTED)
  centered(doc, c.date, 168, 12, textW, false, INK)

  // ธีมโดเมนมีลาย DNS/ร้านโดเมนที่มุมล่าง — ขยับโดมกับตราเข้าในกระดาษ ไม่ให้ทับกัน
  const pos = DECOR_POS[theme]
  drawDome(doc, art, pos.dome.x, pos.dome.y, pos.dome.w, pos.dome.h)
  drawSeal(doc, art, pos.seal.x, pos.seal.y, pos.seal.size)

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
}

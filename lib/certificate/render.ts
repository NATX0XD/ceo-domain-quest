/**
 * วาดใบประกาศเป็น PDF ด้วย jsPDF — A4 แนวนอน
 *
 * ไฟล์นี้มีหน้าที่เดียวคือเอาโครงจาก lib/certificate/data.ts ไปลงกระดาษ
 * ไม่มีการตัดสินว่าใครได้ใบประกาศหรือไม่ได้ — ทุกคนที่เข้าร่วมได้ใบประกาศ
 * ระดับความสำเร็จแสดงด้วยจำนวนดาวที่ระบายทึบ ไม่ใช่การตัดสิทธิ์
 */
import { jsPDF } from 'jspdf'
import type { CertificateData } from '../../core/report'
import { type CertificateLayout, type LayoutOptions, certificateLayout } from './data'
import { THAI_FONT_NAME, type ThaiFontSet } from './font'

const REGULAR_VFS = 'Sarabun-Regular.ttf'
const BOLD_VFS = 'Sarabun-Bold.ttf'

/** สีที่ใช้บนใบประกาศ เก็บเป็น RGB เพราะ jsPDF รับเป็นตัวเลข */
const INK = { r: 30, g: 41, b: 59 } // slate-800
const ACCENT = { r: 217, g: 119, b: 6 } // amber-600
const MUTED = { r: 100, g: 116, b: 139 } // slate-500

/** วาดดาว 5 แฉก 1 ดวง ระบายทึบเมื่อเก็บได้ ถ้ายังไม่ได้ให้วาดแค่เส้นขอบ */
function drawStar(doc: jsPDF, cx: number, cy: number, radius: number, filled: boolean): void {
  const points: [number, number][] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45
    const angle = (Math.PI / 5) * i - Math.PI / 2
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }

  const [start, ...rest] = points
  const lines = rest.map(([x, y], index) => {
    const [px, py] = index === 0 ? start! : rest[index - 1]!
    return [x - px, y - py] as [number, number]
  })
  // ปิดรูปด้วยการลากกลับไปจุดเริ่ม
  const last = rest[rest.length - 1]!
  lines.push([start![0] - last[0], start![1] - last[1]])

  doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.lines(lines, start![0], start![1], [1, 1], filled ? 'F' : 'S', true)
}

/** วาดแถวดาวให้อยู่กึ่งกลางหน้า ดาวเยอะก็ยังไม่ล้นขอบเพราะบีบระยะห่างให้พอดีกรอบ */
function drawStarRow(doc: jsPDF, layout: CertificateLayout): void {
  const { filled, total, x, y, size } = layout.stars
  if (total <= 0) return

  const maxRowWidth = layout.widthMm - 40
  const gap = Math.min(size * 1.6, maxRowWidth / total)
  const rowWidth = gap * (total - 1)
  const startX = x - rowWidth / 2
  const radius = Math.min(size / 2, gap / 2.4)

  for (let i = 0; i < total; i++) {
    drawStar(doc, startX + gap * i, y, radius, i < filled)
  }
}

export interface RenderOptions extends LayoutOptions {
  /** ใส่กรอบรอบใบประกาศหรือไม่ ปิดได้เมื่อจะพิมพ์ลงกระดาษที่มีกรอบอยู่แล้ว */
  withBorder?: boolean
}

/**
 * วาด PDF จากโครงที่เตรียมไว้ คืนไบต์ของไฟล์ PDF
 * ต้องส่งฟอนต์ไทยเข้ามาเสมอ ถ้าไม่ส่ง ข้อความไทยจะหายทั้งใบ จึงโยน error ไปเลยแทนที่จะวาดใบเปล่า
 */
export function renderCertificatePdf(
  layout: CertificateLayout,
  fonts: ThaiFontSet,
  options: RenderOptions = {},
): Uint8Array {
  if (!fonts?.regularBase64 || !fonts?.boldBase64) {
    throw new Error('ต้องโหลดฟอนต์ไทยก่อนวาดใบประกาศ ไม่งั้นข้อความไทยจะหายทั้งใบ')
  }

  const doc = new jsPDF({ orientation: layout.orientation, unit: 'mm', format: layout.pageSize })

  doc.addFileToVFS(REGULAR_VFS, fonts.regularBase64)
  doc.addFont(REGULAR_VFS, THAI_FONT_NAME, 'normal')
  doc.addFileToVFS(BOLD_VFS, fonts.boldBase64)
  doc.addFont(BOLD_VFS, THAI_FONT_NAME, 'bold')

  if (options.withBorder !== false) {
    doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b)
    doc.setLineWidth(1.2)
    doc.rect(10, 10, layout.widthMm - 20, layout.heightMm - 20)
    doc.setLineWidth(0.3)
    doc.rect(13, 13, layout.widthMm - 26, layout.heightMm - 26)
  }

  for (const blockItem of layout.blocks) {
    doc.setFont(THAI_FONT_NAME, blockItem.bold ? 'bold' : 'normal')
    doc.setFontSize(blockItem.size)

    if (blockItem.id === 'title') doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
    else if (blockItem.id === 'course' || blockItem.id === 'issued-at') {
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    } else doc.setTextColor(INK.r, INK.g, INK.b)

    // ย่อขนาดซ้ำจากความกว้างจริงของฟอนต์ ตัวเลขที่คำนวณไว้ใน data.ts เป็นแค่ขอบเขตบน
    let size = blockItem.size
    while (size > 8 && doc.getTextWidth(blockItem.text) > blockItem.maxWidth) {
      size -= 1
      doc.setFontSize(size)
    }

    doc.text(blockItem.text, blockItem.x, blockItem.y, { align: blockItem.align })
  }

  drawStarRow(doc, layout)

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
}

/** ทางลัดที่ใช้บ่อย: จากข้อมูลใบประกาศไปเป็นไบต์ PDF ในขั้นตอนเดียว */
export function renderCertificate(
  data: CertificateData,
  fonts: ThaiFontSet,
  options: RenderOptions = {},
): Uint8Array {
  return renderCertificatePdf(certificateLayout(data, options), fonts, options)
}

/** ชื่อไฟล์ที่เสนอตอนดาวน์โหลด ใช้ชื่อบนเกียรติบัตรเพื่อไม่ให้ไฟล์ทับกันตอนครูเก็บรวม */
export function certificateFileName(data: CertificateData, displayName?: string): string {
  const name = (displayName || data?.nickname || '').trim().replace(/[\\/:*?"<>|\s]+/g, '-')
  return `เกียรติบัตร-${name || 'ผู้เรียน'}.pdf`
}

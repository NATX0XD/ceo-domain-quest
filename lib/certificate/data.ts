/**
 * โครงของใบประกาศ — แยก "ข้อมูลและตำแหน่ง" ออกจาก "การวาด" ให้ขาดจากกัน
 *
 * ไฟล์นี้เป็นตรรกะล้วน ไม่ import jsPDF ไม่แตะ DOM ไม่เรียก Date.now()
 * ทดสอบตำแหน่ง ขนาดตัวอักษร และการตัดคำได้โดยไม่ต้องสร้าง PDF จริง
 * ตัววาด (lib/certificate/render.ts) มีหน้าที่เดียวคือรับโครงนี้ไปลงกระดาษ
 *
 * ใบประกาศออกให้ทุกคนที่เข้าร่วม ไม่ใช่เฉพาะคนผ่าน
 * ระดับความสำเร็จแสดงด้วยจำนวนดาว ไม่ใช่การตัดสิทธิ์ใครออกจากใบประกาศ
 */
import type { CertificateData } from '../../core/report'
import { shopLabel } from '../../core/shop-name'

/** A4 แนวนอน หน่วยมิลลิเมตร */
export const PAGE_WIDTH_MM = 297
export const PAGE_HEIGHT_MM = 210
export const MARGIN_MM = 18

export type TextAlign = 'left' | 'center' | 'right'

export interface TextBlock {
  id: string
  text: string
  /** ตำแหน่งบนกระดาษ หน่วยมิลลิเมตร */
  x: number
  y: number
  /** ขนาดตัวอักษร หน่วย pt */
  size: number
  bold: boolean
  align: TextAlign
  /** ความกว้างสูงสุดที่ข้อความนี้กินได้ ตัววาดต้องไม่ปล่อยให้ล้น */
  maxWidth: number
}

export interface StarRow {
  filled: number
  total: number
  x: number
  y: number
  size: number
}

export interface CertificateLayout {
  pageSize: 'a4'
  orientation: 'landscape'
  widthMm: number
  heightMm: number
  blocks: TextBlock[]
  stars: StarRow
}

export interface LayoutOptions {
  /** ชื่อวิชา ใส่ทับได้จากหน้าจอ */
  courseName?: string
  /** ชื่อเต็มบนเกียรติบัตร; ว่างหรือไม่ส่ง = ใช้ nickname */
  displayName?: string
  /** วันที่ออกใบประกาศ (epoch ms) ไม่ส่งมาจะไม่พิมพ์บรรทัดวันที่ */
  issuedAt?: number | null
}

export const DEFAULT_COURSE_NAME = 'วิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล'

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

/**
 * แปลง epoch ms เป็นวันที่ไทยแบบ "29 กันยายน 2569"
 * คำนวณด้วยเลขล้วนตามเวลาไทย (UTC+7) ไม่ใช้ Date เพื่อให้ผลไม่ขึ้นกับ timezone ของเครื่องที่รัน
 */
export function thaiDate(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return ''
  const days = Math.floor((epochMs + 7 * 60 * 60 * 1000) / 86_400_000)

  // อัลกอริทึม civil-from-days ของ Howard Hinnant นับจาก 1970-01-01
  let z = days + 719_468
  const era = Math.floor(z / 146_097)
  const doe = z - era * 146_097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  const year = m <= 2 ? y + 1 : y

  return `${d} ${THAI_MONTHS[m - 1]} ${year + 543}`
}

/**
 * ลดขนาดตัวอักษรเมื่อข้อความยาวเกินความกว้างที่มีอยู่
 * ชื่อที่ผู้เรียนกำหนดเองยาว ๆ ต้องไม่ล้นขอบกระดาษ
 *
 * ประมาณความกว้างจากจำนวนอักขระ เพราะฟอนต์ไทยที่ฝังไว้เป็นความกว้างไม่คงที่
 * ตัววาดจะวัดความกว้างจริงอีกชั้นแล้วย่อซ้ำได้ ค่าที่นี่คือขอบเขตบนที่ปลอดภัย
 */
export function fitFontSize(text: string, maxWidthMm: number, baseSize: number): number {
  const length = (text ?? '').trim().length
  if (length === 0) return baseSize
  // ตัวอักษรขนาด 1 pt กว้างประมาณ 0.19 มม. โดยเฉลี่ยสำหรับฟอนต์ไทย
  const estimatedWidth = length * baseSize * 0.19
  if (estimatedWidth <= maxWidthMm) return baseSize
  const scaled = (maxWidthMm / (length * 0.19))
  return Math.max(10, Math.floor(scaled))
}

/** ตัดข้อความที่ยาวเกินจริง ๆ ด้วยจุดไข่ปลา ใช้เป็นด่านสุดท้ายหลังย่อขนาดแล้วยังไม่พอ */
export function clampText(text: string, maxChars: number): string {
  const value = (text ?? '').trim()
  if (value.length <= maxChars) return value
  return `${value.slice(0, Math.max(1, maxChars - 1))}…`
}

/**
 * แปลงข้อมูลใบประกาศจาก core/report.ts เป็นโครงที่พร้อมวาด
 * ทุกคนที่เข้าร่วมได้ใบประกาศ ฟังก์ชันนี้จึงไม่มีทางคืน null หรือโยน error เพราะดาวน้อย
 */
export function certificateLayout(
  data: CertificateData,
  options: LayoutOptions = {},
): CertificateLayout {
  const centerX = PAGE_WIDTH_MM / 2
  const contentWidth = PAGE_WIDTH_MM - MARGIN_MM * 2
  const nickname = clampText(options.displayName || data?.nickname || '', 60)
  const shopName = (data?.shopName ?? '').trim()
  const domainFull = (data?.domainFull ?? '').trim()
  const starsTotal = Number.isFinite(data?.starsTotal) ? data.starsTotal : 0
  const starsMax = Number.isFinite(data?.starsMax) && data.starsMax > 0 ? data.starsMax : 0

  const shopTitle = shopLabel(shopName)
  const shopLine =
    shopTitle && domainFull
      ? `${shopTitle} · ${domainFull}`
      : shopTitle || domainFull || 'ผู้ร่วมเดินทางในภารกิจตั้งชื่อเว็บของร้านตัวเอง'

  const issuedAt = options.issuedAt ?? data?.issuedAt ?? null

  const blocks: TextBlock[] = [
    {
      id: 'title',
      text: 'เกียรติบัตร',
      x: centerX,
      y: 46,
      size: 40,
      bold: true,
      align: 'center',
      maxWidth: contentWidth,
    },
    {
      id: 'subtitle',
      text: 'นักธุรกิจออนไลน์รุ่นเยาว์',
      x: centerX,
      y: 62,
      size: 20,
      bold: false,
      align: 'center',
      maxWidth: contentWidth,
    },
    {
      id: 'given-to',
      text: 'ขอมอบให้',
      x: centerX,
      y: 82,
      size: 14,
      bold: false,
      align: 'center',
      maxWidth: contentWidth,
    },
    {
      id: 'nickname',
      text: nickname,
      x: centerX,
      y: 100,
      size: fitFontSize(nickname, contentWidth, 32),
      bold: true,
      align: 'center',
      maxWidth: contentWidth,
    },
    {
      id: 'shop',
      text: clampText(shopLine, 90),
      x: centerX,
      y: 116,
      size: fitFontSize(shopLine, contentWidth, 16),
      bold: false,
      align: 'center',
      maxWidth: contentWidth,
    },
    {
      id: 'course',
      text: options.courseName ?? DEFAULT_COURSE_NAME,
      x: centerX,
      y: 168,
      size: 12,
      bold: false,
      align: 'center',
      maxWidth: contentWidth,
    },
  ]

  if (issuedAt !== null && Number.isFinite(issuedAt)) {
    blocks.push({
      id: 'issued-at',
      text: `ออกให้ ณ วันที่ ${thaiDate(issuedAt)}`,
      x: centerX,
      y: 177,
      size: 12,
      bold: false,
      align: 'center',
      maxWidth: contentWidth,
    })
  }

  return {
    pageSize: 'a4',
    orientation: 'landscape',
    widthMm: PAGE_WIDTH_MM,
    heightMm: PAGE_HEIGHT_MM,
    blocks,
    stars: { filled: starsTotal, total: starsMax, x: centerX, y: 148, size: 7 },
  }
}

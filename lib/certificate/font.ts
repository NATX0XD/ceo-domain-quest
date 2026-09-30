/**
 * ฟอนต์ไทยสำหรับใบประกาศ PDF
 *
 * jsPDF ใช้ฟอนต์มาตรฐาน 14 ตัวของ PDF ซึ่งไม่มีอักขระไทยเลย
 * ถ้าไม่ฝังฟอนต์ ข้อความไทยจะออกมาเป็นช่องว่างหรือเครื่องหมายคำถามทั้งใบ
 * จึงต้องฝัง Sarabun (SIL Open Font License) ที่ subset ไว้แล้วใน public/fonts/
 *
 * ไฟล์ฟอนต์ไม่ได้ถูก import เข้ามาเป็น base64 ในโค้ด แต่โหลดตอนใช้งานจริง
 * เพราะ base64 ของ TTF ทั้งสองน้ำหนักรวมกันราว 100 KB ถ้าฝังในบันเดิลจะติดไปทุกหน้าที่ไม่ได้ใช้
 * หน้าที่ต้องออกใบประกาศค่อยโหลดเอง
 */

export const FONT_BASE_PATH = '/fonts'
export const SARABUN_REGULAR_FILE = 'Sarabun-Regular-subset.ttf'
export const SARABUN_BOLD_FILE = 'Sarabun-Bold-subset.ttf'

/** ชื่อฟอนต์ที่ลงทะเบียนไว้ใน jsPDF ต้องตรงกันทั้งตอน addFont และ setFont */
export const THAI_FONT_NAME = 'Sarabun'

export interface ThaiFontSet {
  /** เนื้อไฟล์ TTF เข้ารหัส base64 พร้อมส่งให้ jsPDF */
  regularBase64: string
  boldBase64: string
}

/** ตัวโหลดไฟล์ฟอนต์ เปลี่ยนได้ตามที่รัน เบราว์เซอร์ใช้ fetch ส่วนเทสต์อ่านจากดิสก์ */
export type FontBytesLoader = (fileName: string) => Promise<ArrayBuffer | Uint8Array>

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * แปลงไบต์เป็น base64 โดยไม่พึ่ง Buffer ของ Node หรือ btoa ของเบราว์เซอร์
 * โค้ดชุดนี้ต้องรันได้ทั้งสองฝั่ง และไฟล์ฟอนต์ใหญ่พอที่ btoa แบบต่อสตริงจะพังบางเบราว์เซอร์
 */
export function toBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let out = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]

    out += BASE64_CHARS[b0 >> 2]
    out += BASE64_CHARS[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)]
    out += b1 === undefined ? '=' : BASE64_CHARS[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)]
    out += b2 === undefined ? '=' : BASE64_CHARS[b2 & 0x3f]
  }

  return out
}

/** ตัวโหลดสำหรับเบราว์เซอร์ ดึงไฟล์จาก public/fonts ผ่าน fetch */
export function browserFontLoader(basePath: string = FONT_BASE_PATH): FontBytesLoader {
  return async (fileName: string) => {
    const response = await fetch(`${basePath}/${fileName}`)
    if (!response.ok) {
      throw new Error(`โหลดฟอนต์ ${fileName} ไม่สำเร็จ (สถานะ ${response.status})`)
    }
    return response.arrayBuffer()
  }
}

/**
 * โหลดฟอนต์ไทยทั้งสองน้ำหนักแล้วแปลงเป็น base64
 * ถ้าโหลดไม่สำเร็จให้โยน error ออกไปเลย ไม่ต้องวาดใบประกาศเป็นภาษาต่างดาวให้นักเรียน
 */
export async function loadThaiFonts(
  loader: FontBytesLoader = browserFontLoader(),
): Promise<ThaiFontSet> {
  const [regular, bold] = await Promise.all([
    loader(SARABUN_REGULAR_FILE),
    loader(SARABUN_BOLD_FILE),
  ])

  return { regularBase64: toBase64(regular), boldBase64: toBase64(bold) }
}

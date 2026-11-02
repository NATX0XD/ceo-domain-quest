/**
 * ภาพประกอบเกียรติบัตรแบบเกม — อยู่ที่ public/ui/cert/*.webp (ฝั่งเซิร์ฟเวอร์เท่านั้น)
 *
 * ทุกไฟล์ไม่บังคับ: ไฟล์ไหนยังไม่มี ตัววาด PDF และหน้า /result จะวาดรูปทรงง่าย ๆ แทนเอง
 * ไฟล์ webp ถูกแปลงเป็น PNG/JPEG ด้วย sharp (มากับ next) เพราะ jsPDF อ่าน webp ได้ไม่ครบทุกแบบ
 * โหลดสำเร็จแล้วเก็บไว้ต่อ process · ไฟล์ที่ยังไม่มีจะถูกเช็กใหม่ทุกครั้ง (รูปมาทีหลังไม่ต้องรีสตาร์ต)
 */
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export const CERT_ART = {
  bg: 'cert-bg.webp',
  ribbon: 'cert-ribbon.webp',
  seal: 'cert-seal.webp',
  dome: 'cert-dome.webp',
  starFull: 'cert-star-full.webp',
  starEmpty: 'cert-star-empty.webp',
} as const

export type CertArtKey = keyof typeof CERT_ART

/**
 * ธีมเกียรติบัตร — `classic` = ดีไซน์ปัจจุบัน (ค่าเริ่มต้น) · `domain` = ลายเกี่ยวกับโดเมน/DNS
 * เจ้าของยังไม่เลือก จึงสลับดูได้ด้วย ?theme=domain ทั้งหน้า /result และ /api/certificate
 */
export const CERT_THEMES = ['classic', 'domain'] as const
export type CertTheme = (typeof CERT_THEMES)[number]
export const CERT_THEME: CertTheme = 'classic'

export function resolveCertTheme(value: unknown): CertTheme {
  const v = Array.isArray(value) ? value[0] : value
  return (CERT_THEMES as readonly string[]).includes(String(v)) ? (v as CertTheme) : CERT_THEME
}

/**
 * ไฟล์จริงของแต่ละชิ้นตามธีม — ธีม domain ใช้พื้นหลังที่วาดลาย www/DNS/.co.th ไว้ในตัวแล้ว
 * และมีป้ายไม้ว่างด้านบนสำหรับชื่อเกียรติบัตร จึงไม่ใช้ริบบิ้นแยก
 * (cert-corner-domain.webp ไม่ได้ใช้: กลับด้านทำเป็นสี่มุมแล้วตัวหนังสือในรูปกลับด้าน และซ้ำกับลายในพื้นหลัง)
 */
function fileFor(key: CertArtKey, theme: CertTheme): string | null {
  if (theme === 'domain') {
    if (key === 'bg') return 'cert-bg-domain.webp'
    if (key === 'ribbon') return null
  }
  return CERT_ART[key]
}

export const CERT_ART_URL_BASE = '/ui/cert'

/** รูปที่พร้อมให้ jsPDF.addImage — data คือ base64 ล้วน ไม่มี prefix */
export interface CertImage {
  data: string
  format: 'PNG' | 'JPEG'
  /** สัดส่วนกว้าง/สูงของรูปจริง ใช้วางรูปไม่ให้บิด */
  aspect: number
}

export type CertArt = Partial<Record<CertArtKey, CertImage>>

function artPath(file: string): string {
  return path.join(process.cwd(), 'public', 'ui', 'cert', file)
}

/** ไฟล์ไหนมีอยู่จริงบ้าง (ตามธีม) — หน้า /result ใช้ตัดสินว่าจะวาดรูปทรงสำรองหรือใช้รูป */
export function certArtPresence(theme: CertTheme = CERT_THEME): Record<CertArtKey, string | null> {
  const out = {} as Record<CertArtKey, string | null>
  for (const key of Object.keys(CERT_ART) as CertArtKey[]) {
    const file = fileFor(key, theme)
    out[key] = file && existsSync(artPath(file)) ? `${CERT_ART_URL_BASE}/${file}` : null
  }
  return out
}

/** ความกว้างสูงสุด (px) ต่อชิ้น — พอคมบน A4 แต่ไม่ให้ PDF บวม */
const MAX_WIDTH: Record<CertArtKey, number> = {
  bg: 2000,
  ribbon: 1400,
  seal: 480,
  dome: 560,
  starFull: 128,
  starEmpty: 128,
}

const cache = new Map<string, CertImage>()

async function loadOne(key: CertArtKey, file: string): Promise<CertImage | null> {
  const full = artPath(file)
  let mtime: number
  try {
    mtime = (await stat(full)).mtimeMs
  } catch {
    return null
  }
  const cacheKey = `${file}:${mtime}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  try {
    const sharp = (await import('sharp')).default
    const opaque = key === 'bg'
    const pipeline = sharp(await readFile(full)).resize({ width: MAX_WIDTH[key], withoutEnlargement: true })
    const { data, info } = opaque
      ? await pipeline.flatten({ background: '#fbf1dc' }).jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true })
      : await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    const image: CertImage = {
      data: data.toString('base64'),
      format: opaque ? 'JPEG' : 'PNG',
      aspect: info.width / Math.max(1, info.height),
    }
    cache.set(cacheKey, image)
    return image
  } catch {
    // แปลงไม่ได้ = ใช้รูปทรงสำรอง ใบประกาศต้องออกได้เสมอ
    return null
  }
}

export async function loadCertArt(theme: CertTheme = CERT_THEME): Promise<CertArt> {
  const keys = Object.keys(CERT_ART) as CertArtKey[]
  const loaded = await Promise.all(
    keys.map((k) => {
      const file = fileFor(k, theme)
      return file ? loadOne(k, file) : Promise.resolve(null)
    }),
  )
  const art: CertArt = {}
  keys.forEach((k, i) => {
    const img = loaded[i]
    if (img) art[k] = img
  })
  return art
}

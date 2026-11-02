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

/** ไฟล์ไหนมีอยู่จริงบ้าง — หน้า /result ใช้ตัดสินว่าจะวาดรูปทรงสำรองหรือใช้รูป */
export function certArtPresence(): Record<CertArtKey, boolean> {
  const out = {} as Record<CertArtKey, boolean>
  for (const [key, file] of Object.entries(CERT_ART) as [CertArtKey, string][]) {
    out[key] = existsSync(artPath(file))
  }
  return out
}

/** ความกว้างสูงสุด (px) ต่อชิ้น — พอคมบน A4 แต่ไม่ให้ PDF บวม */
const MAX_WIDTH: Record<CertArtKey, number> = {
  bg: 2400,
  ribbon: 1400,
  seal: 600,
  dome: 700,
  starFull: 128,
  starEmpty: 128,
}

const cache = new Map<string, CertImage>()

async function loadOne(key: CertArtKey): Promise<CertImage | null> {
  const file = artPath(CERT_ART[key])
  let mtime: number
  try {
    mtime = (await stat(file)).mtimeMs
  } catch {
    return null
  }
  const cacheKey = `${key}:${mtime}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  try {
    const sharp = (await import('sharp')).default
    const opaque = key === 'bg'
    const pipeline = sharp(await readFile(file)).resize({ width: MAX_WIDTH[key], withoutEnlargement: true })
    const { data, info } = opaque
      ? await pipeline.flatten({ background: '#fbf1dc' }).jpeg({ quality: 84 }).toBuffer({ resolveWithObject: true })
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

export async function loadCertArt(): Promise<CertArt> {
  const keys = Object.keys(CERT_ART) as CertArtKey[]
  const loaded = await Promise.all(keys.map((k) => loadOne(k)))
  const art: CertArt = {}
  keys.forEach((k, i) => {
    const img = loaded[i]
    if (img) art[k] = img
  })
  return art
}

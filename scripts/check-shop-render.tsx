/**
 * พิสูจน์ว่า **ทุกคู่ (ประเภทธุรกิจ × ขั้น) เรนเดอร์ได้จริง** ไม่ใช่แค่ไฟล์ภาพมีอยู่
 *
 *   npx tsx scripts/check-shop-render.tsx
 *
 * เทสต์ใน `components/shop-stages.test.ts` คุมได้แค่ชั้นข้อมูล (ไฟล์มีจริง สัดส่วนถูก)
 * สคริปต์นี้เรนเดอร์ component จริงทั้ง 48 คู่แล้วตรวจผลลัพธ์ ถ้าเรขาคณิตคำนวณพลาด
 * (เช่น NaN ไหลเข้า `points` หรือ mask ที่อ้างถึงไม่มีอยู่จริง) จะจับได้ตรงนี้
 *
 * ไม่ต้องเพิ่มหน้าเว็บสำหรับดูตัวอย่าง — การเพิ่มหน้าใหม่จะทำให้ตัวเลขวัด "ทุกหน้าไม่เลื่อน"
 * เพี้ยนไปด้วย และหน้ารวมตาราง 48 ช่องยังไงก็ต้องเลื่อน ซึ่งผิดกติกา UX-1
 */
import { renderToStaticMarkup } from 'react-dom/server'
import {
  BUSINESS_KIND_IDS,
  SHOP_STAGE_MAX,
  ShopStages,
  shopPhotoSrc,
  type ShopStageLevel,
} from '../components/shop-stages'

const LEVELS = Array.from({ length: SHOP_STAGE_MAX + 1 }, (_, i) => i as ShopStageLevel)

let failed = 0
let checked = 0

for (const kind of BUSINESS_KIND_IDS) {
  const photo = shopPhotoSrc(kind)
  for (const level of LEVELS) {
    checked += 1
    const where = `${kind} ขั้น ${level}`
    let html = ''
    try {
      html = renderToStaticMarkup(<ShopStages level={level} kind={kind} />)
    } catch (err) {
      console.error(`✗ ${where} — เรนเดอร์ไม่ผ่าน: ${(err as Error).message}`)
      failed += 1
      continue
    }

    const problems: string[] = []
    if (!html.startsWith('<svg')) problems.push('ผลลัพธ์ไม่ใช่ svg')
    if (html.length < 400) problems.push(`ผลลัพธ์สั้นผิดปกติ (${html.length} ตัวอักษร)`)
    if (/NaN|Infinity|undefined/.test(html)) problems.push('มีตัวเลขเสีย (NaN/Infinity/undefined) อยู่ในภาพ')

    if (photo) {
      // ขั้น 0 จงใจยังไม่เผยภาพ — เห็นแต่ลานเปล่าที่วาดเอง
      const shouldShowPhoto = level > 0
      const hasPhoto = html.includes(photo)
      if (shouldShowPhoto !== hasPhoto) {
        problems.push(shouldShowPhoto ? 'ควรมีภาพต้นฉบับแต่ไม่มี' : 'ขั้น 0 ไม่ควรมีภาพแต่กลับมี')
      }
      // ทุก mask ที่ถูกอ้างถึง ต้องถูกประกาศไว้ในภาพเดียวกัน ไม่งั้นบางเบราว์เซอร์จะซ่อนภาพทั้งใบ
      for (const [, id] of html.matchAll(/mask="url\(#([^)]+)\)"/g)) {
        if (!html.includes(`id="${id}"`)) problems.push(`อ้างถึง mask ${id} ที่ไม่ได้ประกาศ`)
      }
      for (const [, id] of html.matchAll(/fill="url\(#([^)]+)\)"/g)) {
        if (!html.includes(`id="${id}"`)) problems.push(`อ้างถึง gradient ${id} ที่ไม่ได้ประกาศ`)
      }
    }

    if (problems.length > 0) {
      console.error(`✗ ${where} — ${problems.join(' · ')}`)
      failed += 1
    }
  }
}

console.log(`ตรวจ ${checked} คู่ (ประเภท × ขั้น) — ผ่าน ${checked - failed} · ไม่ผ่าน ${failed}`)
process.exit(failed === 0 ? 0 : 1)

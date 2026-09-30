import { z } from 'zod'
import introJson from '@/content/intro-cards.json'

/**
 * S-02 คำแนะนำการใช้งาน — อ่านจาก `content/intro-cards.json` แหล่งเดียว
 *
 * ⚠️ ห้ามพิมพ์ข้อความการ์ดซ้ำไว้ในโค้ด ทีมเนื้อหาเป็นคนแก้ไฟล์นั้นเอง
 * ⚠️ ใบที่ 3 ต้องมีประโยค "ไม่มีการจัดอันดับ" เสมอ — เป็นหลักของสื่อนี้
 */
const FileSchema = z.object({
  meta: z.object({
    title: z.string().min(1),
    skipLabel: z.string().min(1),
    nextLabel: z.string().min(1),
    startLabel: z.string().min(1),
  }),
  cards: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().positive(),
        icon: z.string().min(1),
        title: z.string().min(1),
        lines: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
})

const introFile = FileSchema.parse(introJson)

export interface IntroCardContent {
  id: string
  icon: string
  title: string
  lines: string[]
}

export const introCards: IntroCardContent[] = [...introFile.cards]
  .sort((a, b) => a.order - b.order)
  .map((card) => ({ id: card.id, icon: card.icon, title: card.title, lines: [...card.lines] }))

export const introLabels = {
  skip: introFile.meta.skipLabel,
  next: introFile.meta.nextLabel,
  start: introFile.meta.startLabel,
}

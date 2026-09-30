/**
 * โหลดและตรวจไฟล์เนื้อหา JSON
 *
 * ทุกไฟล์ใน content/ แก้ได้โดยไม่ต้องแตะโค้ด แต่ต้องผ่าน schema ข้างล่างนี้
 * ถ้าแก้ผิดรูปแบบ แอปจะพังทันทีตอนเริ่มพร้อมข้อความบอกว่าผิดตรงไหน
 * ดีกว่าปล่อยให้พังกลางคาบเรียน
 */
import { z } from 'zod'
import businessTypesJson from '../content/business-types.json' with { type: 'json' }
import tldsJson from '../content/tlds.json' with { type: 'json' }

const BusinessTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
})

/** หมวดของนามสกุลโดเมน ใช้สอนวัตถุประสงค์ "จำแนกประเภทของโดเมนเนมได้" */
export const TLD_CATEGORIES = ['gTLD ทั่วไป', 'ccTLD ไทย', 'หมวดเฉพาะที่สงวน'] as const

const TldSchema = z.object({
  id: z.string().min(1),
  suffix: z.string().startsWith('.'),
  label: z.string().min(1),
  category: z.enum(TLD_CATEGORIES),
  whoCanRegister: z.string().min(1),
  goodFor: z.string().min(1),
  watchOut: z.string().min(1),
  requiresCompany: z.boolean(),
  requiresThaiScript: z.boolean(),
  thaiOnlyAudience: z.boolean(),
  /** หมวดที่สงวนไว้ให้หน่วยงานเฉพาะ ร้านของนักเรียนจดไม่ได้ไม่ว่าโปรไฟล์เป็นแบบไหน */
  reserved: z.boolean(),
  /** ใครใช้หมวดนี้ได้ ต้องมีค่าเมื่อ reserved เป็น true เพื่อบอกเหตุผลให้นักเรียนเข้าใจ */
  reservedFor: z.string().min(1).nullable(),
})

const RejectMessagesSchema = z.object({
  needsCompany: z.string().includes('{suffix}'),
  needsThaiScript: z.string().includes('{suffix}'),
  audienceMismatch: z.string().includes('{suffix}'),
  reserved: z.string().includes('{suffix}').includes('{reservedFor}'),
})

export type BusinessType = z.infer<typeof BusinessTypeSchema>
export type Tld = z.infer<typeof TldSchema>
export type RejectMessages = z.infer<typeof RejectMessagesSchema>

export const businessTypes: BusinessType[] = z
  .array(BusinessTypeSchema)
  .min(1)
  .parse(businessTypesJson.items)

export const tlds: Tld[] = z
  .array(TldSchema)
  .min(1)
  .refine(
    (items) => items.every((t) => !t.reserved || t.reservedFor !== null),
    'หมวดที่ตั้ง reserved เป็น true ต้องระบุ reservedFor ว่าใครใช้ได้',
  )
  .parse(tldsJson.items)

export const rejectMessages: RejectMessages = RejectMessagesSchema.parse(tldsJson.rejectMessages)

/**
 * แบบทดสอบไม่ถูก re-export จากไฟล์นี้โดยตั้งใจ
 * ถ้า re-export เมื่อไหร่ เฉลยจะถูก bundle ตามไปทุกหน้าที่ import '@/core/content'
 * ซึ่งรวมถึง client component แล้วนักเรียนเปิด DevTools อ่านเฉลยได้ทั้งชุด
 * ฝั่งเซิร์ฟเวอร์ที่ต้องใช้เฉลย ให้ import จาก '@/core/quiz' ตรง ๆ
 */

export function findBusinessType(id: string): BusinessType | undefined {
  return businessTypes.find((b) => b.id === id)
}

export function findTld(id: string): Tld | undefined {
  return tlds.find((t) => t.id === id)
}

/** แทนที่ {suffix} ในข้อความปฏิเสธด้วยนามสกุลจริง */
export function fillMessage(template: string, suffix: string): string {
  return template.replaceAll('{suffix}', suffix)
}

export type TldCategory = (typeof TLD_CATEGORIES)[number]

/**
 * นามสกุลทั้งหมดในหมวดที่ระบุ
 *
 * @wired-optional ตัวช่วยสำหรับหน้าจำแนกประเภทโดเมนที่ยังไม่ได้ทำ — สถานี B เปิดทุกช่องอยู่แล้ว
 *   เพราะ evaluateTld() ดีดหมวดสงวนออกพร้อมเหตุผลตั้งแต่เงื่อนไขแรก จึงไม่ต้องกรองรายการก่อน
 */
export function tldsByCategory(category: TldCategory): Tld[] {
  return tlds.filter((t) => t.category === category)
}

/**
 * เหตุผลที่เจ้าหน้าที่ดีดกลับเพราะเป็นหมวดสงวน คืน null ถ้าหมวดนี้ไม่ได้สงวน
 * แยกจาก fillMessage เพราะข้อความนี้มีตัวแปรสองตัว
 */
export function reservedReason(tld: Tld): string | null {
  if (!tld.reserved || tld.reservedFor === null) return null
  return rejectMessages.reserved
    .replaceAll('{suffix}', tld.suffix)
    .replaceAll('{reservedFor}', tld.reservedFor)
}

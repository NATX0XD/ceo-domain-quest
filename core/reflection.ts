/**
 * กติกาการส่งคำตอบทบทวนตัวเอง (ขั้นที่ 6) — ตรรกะล้วน ไม่แตะฐานข้อมูลและไม่แตะคุกกี้
 *
 * **ทำไมต้องมีไฟล์นี้** เดิม `app/api/reflect/route.ts` บังคับให้ตอบครบ "ทุกข้อ" ในไฟล์เนื้อหา
 * แต่แผนการสอน (`docs/lesson-plan.md` บรรทัด 150) ให้ตอบ 2 ข้อในคาบ ข้อที่เหลือทำต่อที่บ้าน
 * ผลคือนักเรียนที่ทำตามแผนกดส่งไม่ผ่าน แล้วการ์ดสรุปดาวกับลิงก์ใบประกาศไม่ขึ้นเลย (QA-3 ข้อ 1.2)
 *
 * จำนวนข้อที่บังคับจึงต้องมาจาก `content/reflection.json` คีย์ `submitPolicy.requiredQuestionIds`
 * **ห้ามฝังตัวเลขไว้ในโค้ด** ครูเพิ่มหรือลดรหัสในไฟล์เนื้อหาได้เอง ระบบขยับตามทันที
 *
 * ไฟล์นี้ไม่มีเฉลยและไม่มีข้อมูลนักเรียน ฝั่งเบราว์เซอร์ import ได้
 */
import { z } from 'zod'
import reflectionJson from '../content/reflection.json' with { type: 'json' }

const QuestionSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  minLength: z.number().int().nonnegative(),
  maxLength: z.number().int().positive(),
})

const SubmitPolicySchema = z.object({
  id: z.string().min(1),
  specRef: z.string().min(1),
  /** รหัสข้อที่ต้องตอบก่อนกดส่งได้ ข้อที่ไม่อยู่ในรายการนี้เป็นของแถม */
  requiredQuestionIds: z.array(z.string().min(1)).min(1),
  optionalChipLabel: z.string().min(1),
  optionalHint: z.string().min(1),
  readyMessage: z.string().min(1),
  /** ใช้ {count} = จำนวนข้อที่ยังขาด */
  missingIntro: z.string().min(1).includes('{count}'),
  /** ใช้ {order} = ลำดับข้อ และ {need} = จำนวนตัวอักษรที่ยังขาด */
  missingItemTemplate: z.string().min(1).includes('{order}').includes('{need}'),
  missingOutro: z.string().min(1),
})

/**
 * หัวข้อของบล็อกสถานะใบประกาศบนหน้าทบทวนตัวเอง
 * อ่านที่นี่เพราะ schema ใน components/server/lesson-content.ts ไม่ได้รับคีย์นี้
 * (zod ตัดคีย์ที่ไม่รู้จักออก) และไฟล์นั้นอยู่นอกขอบเขตที่แก้ได้รอบนี้
 */
export const CERTIFICATE_STATUS_LABEL: string = z
  .string()
  .min(1)
  .parse(reflectionJson.closing.certificateStatusLabel)

export type ReflectionQuestionRule = z.infer<typeof QuestionSchema>
export type ReflectionSubmitPolicy = z.infer<typeof SubmitPolicySchema>

export const reflectionQuestionRules: ReflectionQuestionRule[] = z
  .array(QuestionSchema)
  .min(1)
  .parse(reflectionJson.questions)
  .slice()
  .sort((a, b) => a.order - b.order)

export const reflectionSubmitPolicy: ReflectionSubmitPolicy = SubmitPolicySchema.parse(
  reflectionJson.submitPolicy,
)

/**
 * รหัสที่ระบุไว้ในกติกาต้องมีข้ออยู่จริง
 * ถ้าครูพิมพ์รหัสผิด ให้พังตั้งแต่โหลดไฟล์ ดีกว่าปล่อยให้บังคับข้อที่ไม่มีอยู่
 * แล้วนักเรียนกดส่งไม่ผ่านตลอดกาลโดยไม่มีใครรู้สาเหตุ
 */
for (const id of reflectionSubmitPolicy.requiredQuestionIds) {
  if (!reflectionQuestionRules.some((q) => q.id === id)) {
    throw new Error(
      `content/reflection.json submitPolicy.requiredQuestionIds มีรหัส ${id} ซึ่งไม่มีอยู่ใน questions`,
    )
  }
}

/** รหัสข้อที่ต้องตอบในคาบ เรียงตามลำดับข้อในไฟล์เนื้อหา */
export const REQUIRED_REFLECTION_IDS: string[] = reflectionQuestionRules
  .filter((q) => reflectionSubmitPolicy.requiredQuestionIds.includes(q.id))
  .map((q) => q.id)

/** จำนวนข้อที่ต้องตอบในคาบ — อ่านจากไฟล์เนื้อหา ไม่ใช่จำนวนข้อทั้งหมด */
export const REQUIRED_REFLECTION_COUNT: number = REQUIRED_REFLECTION_IDS.length

/** จำนวนข้อทั้งหมดที่มีในคลัง รวมข้อของแถม */
/**
 * @wired-optional แหล่งความจริงของ "มีทั้งหมดกี่ข้อ" — core/report.ts อ้างค่านี้ไปทำ reflectionProgress
 *   ตัวเลขนี้ไม่ใช่เกณฑ์ผ่าน เกณฑ์ผ่านคือ REQUIRED_REFLECTION_COUNT
 */
export const TOTAL_REFLECTION_COUNT: number = reflectionQuestionRules.length

/** รหัสข้อของแถม ทำหรือไม่ทำก็ส่งได้ */
export const OPTIONAL_REFLECTION_IDS: string[] = reflectionQuestionRules
  .filter((q) => !REQUIRED_REFLECTION_IDS.includes(q.id))
  .map((q) => q.id)

export function isRequiredReflection(questionId: string): boolean {
  return REQUIRED_REFLECTION_IDS.includes(questionId)
}

export interface ReflectionGap {
  id: string
  order: number
  minLength: number
  /** ความยาวที่ตอบมาแล้ว หลังตัดช่องว่างหัวท้าย */
  have: number
  /** ขออีกกี่ตัวอักษร */
  need: number
  /** ข้อความบอกผู้เรียนของข้อนี้ มาจากไฟล์เนื้อหา */
  text: string
}

export interface ReflectionSubmitCheck {
  ok: boolean
  /** ข้อที่บังคับแต่ยังสั้นเกินไป เรียงตามลำดับข้อ */
  missing: ReflectionGap[]
  /** ข้อความเดียวที่เอาไปขึ้นจอได้เลย บอกว่าขาดอะไรและขาดเท่าไร */
  message: string
  requiredIds: string[]
  optionalIds: string[]
}

function lengthOf(value: unknown): number {
  return typeof value === 'string' ? value.trim().length : 0
}

/**
 * ส่งได้หรือยัง
 *
 * นับเฉพาะข้อที่อยู่ใน `requiredQuestionIds` ข้อของแถมไม่เคยกันการส่ง
 * แม้ผู้เรียนจะพิมพ์ไว้สั้น ๆ ก็ตาม เพราะแผนการสอนถือว่าเป็นงานที่ทำต่อที่บ้านได้
 *
 * ข้อความที่คืนออกไปต้องบอกให้ครบว่า **ข้อไหน ขออีกกี่ตัวอักษร** ไม่ใช่แค่ว่า "ยังสั้นเกินไป"
 * เพราะหน้าจอเอาไปขึ้นตรง ๆ และผู้เรียนต้องรู้ว่าต้องทำอะไรต่อ
 */
export function reflectionSubmitCheck(
  answers: Readonly<Record<string, string | null | undefined>>,
): ReflectionSubmitCheck {
  const missing: ReflectionGap[] = []
  for (const question of reflectionQuestionRules) {
    if (!isRequiredReflection(question.id)) continue
    const have = lengthOf(answers?.[question.id])
    if (have >= question.minLength) continue
    const need = question.minLength - have
    missing.push({
      id: question.id,
      order: question.order,
      minLength: question.minLength,
      have,
      need,
      text: reflectionSubmitPolicy.missingItemTemplate
        .replaceAll('{order}', String(question.order))
        .replaceAll('{need}', String(need)),
    })
  }

  if (missing.length === 0) {
    return {
      ok: true,
      missing,
      message: reflectionSubmitPolicy.readyMessage,
      requiredIds: REQUIRED_REFLECTION_IDS,
      optionalIds: OPTIONAL_REFLECTION_IDS,
    }
  }

  const intro = reflectionSubmitPolicy.missingIntro.replaceAll('{count}', String(missing.length))
  const items = missing.map((m) => m.text).join(' · ')
  return {
    ok: false,
    missing,
    message: `${intro} — ${items} · ${reflectionSubmitPolicy.missingOutro}`,
    requiredIds: REQUIRED_REFLECTION_IDS,
    optionalIds: OPTIONAL_REFLECTION_IDS,
  }
}

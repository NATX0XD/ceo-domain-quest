/**
 * คำสั่งที่ส่งให้โมเดล และรูปแบบ JSON ที่บังคับให้ตอบกลับมา
 * แยกไว้ไฟล์เดียวเพื่อให้ Typhoon กับ Gemini ใช้ถ้อยคำเดียวกัน ผลจะได้เทียบกันได้
 *
 * กติกาที่เขียนย้ำในทุก prompt:
 * - คำใบ้ห้ามมีคำตอบอยู่ในประโยค ต้องเป็นคำถามหรือคำชี้ทางเท่านั้น
 * - คะแนนที่โมเดลให้เป็นข้อเสนอ ครูเป็นคนยืนยัน
 */
import { RUBRIC_DIMENSION_IDS, resolveEmphasisDimension, rubricDimensions } from './rubric'
import { PROMPT_RULES, STORY_IDS, resolveCategory, storySeedBrief } from './story'
import type { GradeReasonInput, HintInput, SimulateCustomerInput, StoryInput } from './types'

export interface PromptSpec {
  system: string
  user: string
  /** JSON Schema สำหรับ structured output ของ Gemini และ response_format ของ Typhoon */
  schema: Record<string, unknown>
}

const THAI_TEACHER_SYSTEM =
  'คุณเป็นผู้ช่วยครูวิชาคอมพิวเตอร์ธุรกิจของนักเรียน ปวช. ปี 1 ในประเทศไทย ' +
  'ตอบเป็นภาษาไทยที่นักเรียนอ่านเข้าใจ สั้น กระชับ ไม่ดุ ไม่ตำหนิ ' +
  'ตอบกลับเป็น JSON ตามโครงสร้างที่กำหนดเท่านั้น ห้ามมีข้อความอื่นนอก JSON'

export function hintPrompt(input: HintInput): PromptSpec {
  return {
    system: THAI_TEACHER_SYSTEM,
    user: [
      `นักเรียนกำลังทำภารกิจ ${input.missionId} และขอคำใบ้ระดับ ${input.hintLevel}`,
      input.draftName ? `ชื่อโดเมนที่พิมพ์ค้างไว้: ${input.draftName}` : 'ยังไม่ได้พิมพ์ชื่อโดเมน',
      input.keywords?.length ? `ประเภทธุรกิจมีคำสำคัญ: ${input.keywords.join(', ')}` : '',
      'เขียนคำใบ้ 1 ประโยค ห้ามมีคำตอบอยู่ในประโยค ให้เป็นคำถามย้อนกลับหรือชี้จุดที่ควรกลับไปดู',
      'ตอบเป็น JSON รูปแบบนี้เท่านั้น ห้ามเปลี่ยนชื่อคีย์: {"text": "คำใบ้ของคุณ"}',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  }
}

/**
 * บอกเกณฑ์รายด้านให้โมเดลจากไฟล์เนื้อหาโดยตรง ไม่เขียนเกณฑ์ซ้ำในโค้ด
 * ครูแก้ถ้อยคำใน content/rubric.json แล้ว prompt เปลี่ยนตามทันที
 */
function rubricBrief(): string {
  return rubricDimensions
    .map((d) => {
      const levels = d.levels
        .map((l) => `${l.score} = ${l.label}: ${l.descriptor}`)
        .join('\n    ')
      return `- ${d.id} (${d.name}) — ${d.question}\n    ${levels}`
    })
    .join('\n')
}

export function gradeReasonPrompt(input: GradeReasonInput): PromptSpec {
  const emphasized = resolveEmphasisDimension(input.emphasisCriterion)

  return {
    system: THAI_TEACHER_SYSTEM,
    user: [
      'ตรวจใบเสนอชื่อเว็บของนักเรียนตามรูบริก 4 ด้านข้างล่างนี้ ให้คะแนนทุกด้าน ด้านละ 1 ถึง 3',
      '',
      'สิ่งที่นักเรียนส่งมา:',
      `- ชื่อโดเมนที่เสนอ: ${input.domainName ?? '(ยังไม่ได้กรอก)'}`,
      `- นามสกุลที่เลือก (รหัส): ${input.tldId || '(ยังไม่ได้เลือก)'}`,
      `- ชื่อร้าน: ${input.shopName ?? '(ยังไม่ได้ตั้ง)'}`,
      `- ประเภทธุรกิจ (รหัส): ${input.businessTypeId ?? '(ยังไม่ได้เลือก)'}`,
      `- เหตุผลที่เขียน: "${input.reasonText}"`,
      '',
      'เกณฑ์รายด้าน:',
      rubricBrief(),
      '',
      emphasized
        ? `นักเรียนขอให้เน้นด้าน ${emphasized} เป็นพิเศษ ให้ตรวจด้านนั้นละเอียดกว่าด้านอื่น (ระบบเป็นผู้คูณน้ำหนักเอง ไม่ต้องคูณให้)`
        : 'นักเรียนยังไม่ได้เลือกด้านที่อยากให้เน้น',
      '',
      'ทุกด้านต้องมี evidence ที่ยกข้อความหรือสิ่งที่นักเรียนเขียนมาอ้างจริง ห้ามแต่งขึ้นเอง',
      'และต้องมี suggestion ที่บอกว่าทำอะไรต่อได้ 1 อย่าง เขียนเชิงสร้างสรรค์ ห้ามตำหนิและห้ามเปรียบเทียบกับเพื่อน',
      'คะแนนนี้เป็นข้อเสนอให้ครูพิจารณา ครูเป็นผู้ตัดสินสุดท้าย ห้ามคำนวณคะแนนรวมหรือดาวเอง',
      '',
      'ตอบเป็น JSON รูปแบบนี้เท่านั้น ห้ามเปลี่ยนชื่อคีย์และต้องมีครบทั้ง 4 ด้าน:',
      `{"dimensions": [${RUBRIC_DIMENSION_IDS.map((id) => `{"id": "${id}", "score": 1-3, "evidence": "...", "suggestion": "..."}`).join(', ')}]}`,
    ].join('\n'),
    schema: {
      type: 'object',
      properties: {
        dimensions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', enum: RUBRIC_DIMENSION_IDS },
              score: { type: 'integer', minimum: 1, maximum: 3 },
              evidence: { type: 'string' },
              suggestion: { type: 'string' },
            },
            required: ['id', 'score', 'evidence', 'suggestion'],
          },
        },
      },
      required: ['dimensions'],
    },
  }
}

export function simulateCustomerPrompt(input: SimulateCustomerInput): PromptSpec {
  return {
    system: THAI_TEACHER_SYSTEM,
    user: [
      `สวมบทเป็นลูกค้าคนที่ ${(input.customerIndex ?? 0) + 1} ที่ได้ยินเจ้าของร้านบอกชื่อเว็บด้วยปากเปล่าว่า "${input.domainName}"`,
      'พิมพ์ชื่อที่ได้ยินลงมือถือตามความเข้าใจของคนทั่วไป ถ้าชื่อกำกวม เช่น มีเลขที่ออกเสียงเหมือนคำ มีขีดกลาง หรือมีตัวอักษรซ้ำ ให้พิมพ์ผิดตามจริง',
      'ตอบว่าพิมพ์อะไรลงไป และพูด 1 ประโยคสั้นแบบลูกค้าจริง',
    ].join('\n'),
    schema: {
      type: 'object',
      properties: {
        typed: { type: 'string' },
        comment: { type: 'string' },
      },
      required: ['typed', 'comment'],
    },
  }
}

/**
 * E-07 เรื่องราวเฉพาะคน — เรียกครั้งเดียวได้ครบ 10 เรื่อง
 *
 * **ไม่ส่งชื่อเล่นของนักเรียนออกไป** ตามสเปก E-07 ข้อมูลเข้า
 * ให้โมเดลเขียนสัญลักษณ์ {ชื่อ} ไว้ แล้วระบบแทนด้วยชื่อเล่นตอนแสดงผลเอง
 *
 * กติกาทั้ง 8 ข้ออ่านจาก content/story-seeds.json ไม่เขียนซ้ำในโค้ด
 * ครูแก้ถ้อยคำในไฟล์เนื้อหาแล้ว prompt เปลี่ยนตามทันที
 */
export function storyPrompt(input: StoryInput): PromptSpec {
  const category = resolveCategory(input)
  const registered = input.isRegisteredCompany ? 'จดทะเบียนแล้ว' : 'ยังไม่จดทะเบียน'

  return {
    system: THAI_TEACHER_SYSTEM,
    user: [
      'คุณเขียน "ส่วนเล่าเรื่อง" ประกอบโจทย์ให้นักเรียน ปวช.1 ที่สวมบทบาทเป็น CEO',
      `ข้อมูล: แบรนด์=${input.brandName} ธุรกิจ=${input.description ?? '-'}`,
      `        ลูกค้า=${input.customers ?? '-'} จดทะเบียนการค้า=${registered}`,
      `        หมวดธุรกิจ=${category.name} ตัวละครในเรื่อง=${category.character}`,
      'กติกา',
      ...PROMPT_RULES.map((rule, i) => `${i + 1}. ${rule}`),
      `ต้องเขียนครบทุกรหัสต่อไปนี้: ${STORY_IDS.join(' · ')}`,
      'แก่นเรื่องของแต่ละรหัส',
      storySeedBrief(input),
      'ตอบเป็น JSON รูปแบบนี้เท่านั้น ห้ามเปลี่ยนชื่อคีย์:',
      '{"brand_slug": "...", "brand_slug_alternatives": ["...", "..."], ' +
        `"intros": {${STORY_IDS.map((id) => `"${id}": "..."`).join(', ')}}, ` +
        '"safety": {"famous_brand": false, "inappropriate": false}}',
    ].join('\n'),
    schema: {
      type: 'object',
      properties: {
        brand_slug: { type: 'string' },
        brand_slug_alternatives: { type: 'array', items: { type: 'string' } },
        intros: {
          type: 'object',
          properties: Object.fromEntries(STORY_IDS.map((id) => [id, { type: 'string' }])),
          required: STORY_IDS,
        },
        safety: {
          type: 'object',
          properties: {
            famous_brand: { type: 'boolean' },
            inappropriate: { type: 'boolean' },
          },
          required: ['famous_brand', 'inappropriate'],
        },
      },
      required: ['brand_slug', 'intros', 'safety'],
    },
  }
}

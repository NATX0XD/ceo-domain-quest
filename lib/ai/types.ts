/**
 * สัญญากลางของชั้นเรียก AI
 *
 * กฎ 2 ข้อที่ทุกฟังก์ชันในชั้นนี้ต้องเคารพ:
 * 1. ผลลัพธ์ที่คืนออกไปต้องเป็น type เดียวกันเสมอ ไม่ว่ามาจาก AI หรือจากทางสำรองแบบกฎล้วน
 *    หน้าจอจึงไม่ต้องรู้เลยว่าวันนี้มี API key หรือไม่
 * 2. ทุกผลลัพธ์ต้องมีฟิลด์ `source` ติดมาด้วยเสมอ — ครูต้องรู้ว่าอันไหน AI เสนอ อันไหนกฎล้วน
 *    และ **ครูเป็นผู้ยืนยันคะแนนเสมอ AI ไม่เคยตัดสินเอง** (ดู needsTeacherConfirm)
 */

/** มาจากไหน — 'ai' คือโมเดลตอบ, 'fallback' คือกฎในโค้ดตอบ */
export type AiSource = 'ai' | 'fallback'

export type AiProvider = 'typhoon' | 'gemini' | 'cloudflare' | 'rules'

/** เหตุผลที่ตกมาใช้ทางสำรอง เก็บไว้ให้ครูและ log อ่านได้ */
export type FallbackReason =
  | 'no-api-key'
  | 'quota-exceeded'
  /** คิวของผู้ให้บริการยาวเกินงบเวลา จึงข้ามไปใช้ทางถัดไปโดยไม่รอ */
  | 'rate-limited'
  | 'timeout'
  | 'request-failed'
  | 'bad-response'
  | 'not-requested'

export interface AiMeta {
  source: AiSource
  provider: AiProvider
  /** มีค่าเมื่อ source เป็น 'fallback' เท่านั้น */
  fallbackReason: FallbackReason | null
}

export interface HintInput {
  missionId: string
  role?: import('./topic-lock').AiRoleId
  /** ระดับคำใบ้ที่ขอ เริ่มที่ 1 */
  hintLevel: number
  /** ชื่อโดเมนที่นักเรียนพิมพ์ค้างไว้ ใช้ทำคำใบ้ให้ตรงกับสิ่งที่เขาทำอยู่ */
  draftName?: string
  /** คำสำคัญของประเภทธุรกิจที่นักเรียนเลือกไว้ */
  keywords?: string[]
  /** ใช้นับโควตารายคน */
  studentId?: string
}

export interface HintResult extends AiMeta {
  text: string
  level: number
}

export interface GradeReasonInput {
  /** รหัสนามสกุลที่นักเรียนยื่น เช่น co-th */
  tldId: string
  /** เหตุผลที่นักเรียนพิมพ์ว่าทำไมนามสกุลนี้เหมาะกับร้าน */
  reasonText: string
  /** ชื่อโดเมนที่เสนอ ใช้ตรวจด้าน "ชื่อจำง่ายและสะกดถูกกฎ" */
  domainName?: string
  /** ประเภทธุรกิจที่นักเรียนเลือกไว้ตอนต้นเกม ใช้ตรวจด้าน "เชื่อมโยงกับธุรกิจตัวเอง" */
  businessTypeId?: string
  /** ชื่อร้านที่นักเรียนตั้ง */
  shopName?: string
  /** จดทะเบียนนิติบุคคลแล้วหรือยัง ใช้ตรวจด้าน "นามสกุลเหมาะกับประเภทธุรกิจ" */
  isRegisteredCompany?: boolean
  audience?: 'thai' | 'international'
  /** ด้านที่ผู้เรียนขอให้ถ่วง 2 เท่า รับได้ทั้ง emphasis-* และ dim-* */
  emphasisCriterion?: string | null
  studentId?: string
  missionId?: string
  role?: import('./topic-lock').AiRoleId
}

export interface RubricDimensionScore {
  /** รหัสด้านตาม content/rubric.json เช่น dim-naming */
  id: string
  name: string
  /** คะแนนของด้านนี้ 1-3 ตามระดับในไฟล์เนื้อหา */
  score: number
  /** ชื่อระดับที่ได้ เช่น ดีมาก / พอใช้ / ต้องแก้ */
  levelLabel: string
  /** ยกสิ่งที่นักเรียนเขียนหรือเลือกมาอ้าง เพื่อให้ครูเห็นว่าคะแนนนี้มาจากอะไร */
  evidence: string
  /** ข้อเสนอแนะเชิงสร้างสรรค์ บอกว่าทำอะไรต่อได้ ห้ามตำหนิ */
  suggestion: string
  /** ด้านนี้ถูกผู้เรียนเลือกให้ถ่วง 2 เท่าหรือไม่ */
  emphasized: boolean
}

export interface GradeReasonResult extends AiMeta {
  /** คะแนนรายด้าน ครบทุกด้านตาม content/rubric.json เสมอ */
  dimensions: RubricDimensionScore[]
  /** ด้านที่ถูกถ่วง 2 เท่า null = ผู้เรียนยังไม่ได้เลือก */
  emphasisDimensionId: string | null
  /** คะแนนถ่วงน้ำหนัก 5-15 ตามสูตรในไฟล์เนื้อหา */
  weightedTotal: number
  weightedMax: number
  /** ดาวของภารกิจใหญ่ 0-3 แปลงจาก weightedTotal ด้วย starBands เท่านั้น */
  stars: number
  feedback: string
  /**
   * เป็น true เสมอโดยตั้งใจ — คะแนนทุกก้อนต้องผ่านการยืนยันของครูก่อนบันทึก
   * ไม่ว่าจะมาจาก AI หรือจากกฎล้วน
   */
  needsTeacherConfirm: true
}

export interface SimulateCustomerInput {
  /** ชื่อโดเมนที่นักเรียนบอกลูกค้า */
  domainName: string
  /** ลูกค้าคนที่เท่าไหร่ ใช้ให้ผลต่างกันแบบคงที่ ไม่ต้องสุ่ม */
  customerIndex?: number
  studentId?: string
  missionId?: string
  role?: import('./topic-lock').AiRoleId
}

export interface SimulateCustomerResult extends AiMeta {
  /** สิ่งที่ลูกค้าพิมพ์ลงมือถือจริง ๆ */
  typed: string
  /** พิมพ์ตรงกับชื่อจริงหรือไม่ */
  correct: boolean
  /** คำพูดของลูกค้า 1 บรรทัด */
  comment: string
}

/**
 * ข้อมูลเข้าของ E-07 เรื่องราวเฉพาะคน
 * ⚠️ `nickname` **ห้ามส่งออกไปให้ AI** ระบบเติมแทนสัญลักษณ์ {ชื่อ} ตอนแสดงผลเท่านั้น
 */
export interface StoryInput {
  studentId?: string
  missionId?: string
  role?: import('./topic-lock').AiRoleId
  /** ชื่อเล่นของนักเรียน ใช้เติม {ชื่อ} ฝั่งเรา ไม่เคยอยู่ใน prompt */
  nickname: string
  /** ชื่อแบรนด์ที่นักเรียนตั้ง */
  brandName: string
  /** คำอธิบายธุรกิจแบบสั้น */
  description?: string
  /** กลุ่มลูกค้าที่นักเรียนเขียนไว้ */
  customers?: string
  /** ประเภทธุรกิจที่เลือกจาก content/business-types.json */
  businessTypeId?: string
  /** ระบุหมวดของ story-seeds.json ตรง ๆ ใช้ตอนครูแก้หมวดเอง */
  categoryId?: string
  /** จดทะเบียนนิติบุคคลแล้วหรือยัง ใช้เลือกแม่แบบ B-T4 */
  isRegisteredCompany?: boolean
  /** กลุ่มลูกค้าใหม่ ใช้กับแม่แบบ B-T3 */
  newCustomerGroup?: string
}

/** เรื่องราวหนึ่งเรื่อง ผูกกับรหัสโจทย์ M1-M4 หรือแม่แบบด่านบอส B-T1 ถึง B-T6 */
export interface StoryItem {
  id: string
  kind: 'mission' | 'boss'
  /** รหัสภารกิจใน content/missions.json ถ้าเรื่องนี้เป็นของภารกิจย่อย */
  missionId: string | null
  /** ข้อความที่พร้อมแสดง แทนสัญลักษณ์เรียบร้อยแล้ว */
  text: string
  source: AiSource
  fallbackReason: FallbackReason | null
  /** เหตุผลที่เรื่องของ AI ถูกปัดทิ้ง มีค่าเมื่อ source เป็น fallback ทั้งที่เรียก AI สำเร็จ */
  rejectReason?: string | null
}

export interface StoryResult extends AiMeta {
  /** หมวดธุรกิจที่จัดได้ จัดไม่ได้ใช้หมวด "อื่น ๆ" */
  categoryId: string
  categoryName: string
  /** ตัวละครในเรื่องตามหมวดธุรกิจ */
  character: string
  /** ชื่อภาษาอังกฤษของแบรนด์สำหรับใช้ในโจทย์ null = ต้องให้นักเรียนพิมพ์เอง */
  brandSlug: string | null
  brandSlugAlternatives: string[]
  /** true เมื่อ brandSlug ใช้ไม่ได้ เลขาโดมต้องถามนักเรียน */
  needsBrandSlugFromStudent: boolean
  /**
   * ประโยคที่เลขาโดมใช้ถามนักเรียนเมื่อคิดชื่อภาษาอังกฤษให้ไม่ได้ (ชื่อร้านเป็นอักษรไทยล้วน)
   * ข้อความมาจาก content/story-seeds.json คีย์ slugFallbackPrompt หน้าจอห้ามแต่งเอง
   * null เมื่อ brandSlug ใช้ได้อยู่แล้ว จึงไม่ต้องถามอะไร
   */
  brandSlugPrompt: string | null
  /** ครบ 10 เรื่องเสมอ เรื่องที่ไม่ผ่านการตรวจถูกแทนด้วยประโยคสำรองเป็นรายเรื่อง */
  stories: StoryItem[]
  /** ธงความปลอดภัยที่ AI รายงานกลับมา ใช้ต่อกับ E-11 ชั้นที่ 3 */
  safety: { famousBrand: boolean; inappropriate: boolean }
}

/**
 * ตรวจคำตอบปลายเปิดของเส้นทางเรียน (ดู / อ่าน) ว่าครอบคลุมแนวคิดสำคัญข้อไหนบ้าง
 * ส่งหลายข้อในการเรียกครั้งเดียว ใช้โควตาแค่ 1 ครั้งต่อการส่งตรวจ
 *
 * ⚠️ แนวคิดสำคัญมาจากไฟล์เฉลยฝั่งเซิร์ฟเวอร์ ห้ามส่งผลดิบนี้ออกไปเบราว์เซอร์
 * ⚠️ AI เป็นแค่ตัวช่วยจับคำตอบที่ใช้คำต่างจากคำสำคัญ คะแนนสุดท้ายไม่มีวันต่ำกว่าการตรวจด้วยคำสำคัญ
 */
export interface LearnCheckItemInput {
  /** รหัสข้อ เช่น m1-wq1 */
  id: string
  question: string
  /** แนวคิดที่คำตอบควรมี เรียงตามไฟล์เฉลย */
  concepts: string[]
  answer: string
  /** คำสำคัญของแนวคิดที่นักเรียนยังไม่ได้พูด — ห้ามโมเดลใช้ใน feedback (กันเฉลยหลุด) ส่งไปผู้ให้บริการเท่านั้น ไม่ออกเบราว์เซอร์ */
  avoid?: string[]
}

export interface LearnCheckInput {
  items: LearnCheckItemInput[]
  studentId?: string
  missionId?: string
  role?: import('./topic-lock').AiRoleId
}

export interface LearnCheckItemResult {
  id: string
  /** ครอบคลุมแนวคิดแต่ละข้อหรือไม่ ยาวเท่ากับ concepts ของข้อนั้นเสมอ */
  covered: boolean[]
  /** ประโยคแนะนำสั้น ๆ 1 ประโยค null = ถ้อยคำใช้ไม่ได้ ให้ใช้ข้อความจากไฟล์เฉลยแทน */
  feedback: string | null
}

export interface LearnCheckResult extends AiMeta {
  /** เฉพาะข้อที่โมเดลตอบมาครบถ้วน ข้อที่ไม่มีในนี้ใช้ผลจากคำสำคัญล้วน */
  items: LearnCheckItemResult[]
}

export type DomeChatMode = 'current' | 'earlier' | 'general'

export interface DomeChatInput {
  missionId: string
  message: string
  mode: DomeChatMode
  shopName?: string | null
  /** บทสนทนาล่าสุดสั้น ๆ เรียงเก่า → ใหม่ */
  history?: Array<{ role: 'student' | 'dome'; text: string }>
}

export interface DomeChatResult extends AiMeta {
  /** ว่างเมื่อ source เป็น 'fallback' ให้ผู้เรียกใช้บทสำรองของตัวเอง */
  text: string
  /** 'off' = โมเดลบอกว่าเรื่องนอกวิชา ผู้เรียกต้องปฏิเสธด้วยบทของโดม */
  scope: 'on' | 'off'
}

export interface AiClient {
  domeChat(input: DomeChatInput): Promise<DomeChatResult>
  hintFor(input: HintInput): Promise<HintResult>
  gradeReason(input: GradeReasonInput): Promise<GradeReasonResult>
  simulateCustomer(input: SimulateCustomerInput): Promise<SimulateCustomerResult>
  /** E-07 สร้างเรื่องราวเฉพาะคนครบ 10 เรื่องในการเรียกครั้งเดียว */
  storyFor(input: StoryInput): Promise<StoryResult>
  /** ตรวจคำตอบปลายเปิดของเส้นทางเรียน — ไม่ได้ผล = items ว่าง ไม่ throw */
  learnCheck(input: LearnCheckInput): Promise<LearnCheckResult>
}

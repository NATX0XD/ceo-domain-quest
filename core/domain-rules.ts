/**
 * กฎการตั้งชื่อโดเมน — ใช้ที่สถานี A (โรงทำป้าย)
 *
 * ไฟล์นี้เป็นตรรกะล้วน ไม่ import อะไรจาก React / Next / ฐานข้อมูล
 * ทดสอบได้โดยไม่ต้องเปิดเบราว์เซอร์ และเรียกใช้ได้ทั้งฝั่งเบราว์เซอร์และฝั่งเซิร์ฟเวอร์
 */

/** รหัสของกฎแต่ละข้อ ตรงกับ 4 ขีดบนมาตรวัด "ป้ายสว่าง" */
export type RuleId = 'length' | 'charset' | 'pronounceable' | 'relevant'

export interface RuleResult {
  id: RuleId
  passed: boolean
  /** ข้อความที่แสดงให้นักเรียนเห็นเมื่อยังไม่ผ่าน */
  message: string
}

export interface DomainCheck {
  results: RuleResult[]
  /** จำนวนขีดที่ติดสว่าง 0-4 */
  score: number
  /** ผ่านครบทุกข้อหรือยัง */
  allPassed: boolean
}

export const MIN_LENGTH = 3
export const MAX_LENGTH = 20

/** อักขระที่อนุญาต: a-z, 0-9 และขีดกลาง */
const ALLOWED = /^[a-z0-9-]+$/
/** ตัวอักษรเดียวกันซ้ำติดกันเกิน 2 ตัว เช่น shoppp */
const TRIPLE_REPEAT = /(.)\1{2,}/

/**
 * ทำให้ชื่อเป็นรูปแบบมาตรฐานก่อนตรวจ
 * ตัดช่องว่างหัวท้าย และแปลงเป็นตัวพิมพ์เล็ก เพราะชื่อโดเมนไม่สนตัวพิมพ์ใหญ่เล็ก
 */
export function normalize(raw: string): string {
  return raw.trim().toLowerCase()
}

function checkLength(name: string): RuleResult {
  const passed = name.length >= MIN_LENGTH && name.length <= MAX_LENGTH
  return {
    id: 'length',
    passed,
    message: passed
      ? `ความยาว ${name.length} ตัวอักษร กำลังดี`
      : name.length < MIN_LENGTH
        ? `สั้นไป ต้องมีอย่างน้อย ${MIN_LENGTH} ตัวอักษร`
        : `ยาวไป ต้องไม่เกิน ${MAX_LENGTH} ตัวอักษร คนจำไม่ไหว`,
  }
}

function checkCharset(name: string): RuleResult {
  if (name.length === 0) {
    return { id: 'charset', passed: false, message: 'ยังไม่ได้ใส่ชื่อ' }
  }
  if (/\s/.test(name)) {
    return { id: 'charset', passed: false, message: 'ชื่อโดเมนมีช่องว่างไม่ได้ ลองใช้ขีดกลางแทน' }
  }
  if (/[฀-๿]/.test(name)) {
    return {
      id: 'charset',
      passed: false,
      message: 'นามสกุลนี้ใช้ตัวอักษรไทยไม่ได้ ถ้าอยากใช้ภาษาไทยต้องเลือกนามสกุล .ไทย',
    }
  }
  if (name.startsWith('-') || name.endsWith('-')) {
    return { id: 'charset', passed: false, message: 'ขีดกลางอยู่หน้าสุดหรือท้ายสุดไม่ได้' }
  }
  const passed = ALLOWED.test(name)
  return {
    id: 'charset',
    passed,
    message: passed
      ? 'ใช้อักขระถูกต้องทั้งหมด'
      : 'ใช้ได้เฉพาะ a-z ตัวเลข และขีดกลางเท่านั้น',
  }
}

function checkPronounceable(name: string): RuleResult {
  if (name.length === 0) {
    return { id: 'pronounceable', passed: false, message: 'ยังไม่ได้ใส่ชื่อ' }
  }
  if (TRIPLE_REPEAT.test(name)) {
    return {
      id: 'pronounceable',
      passed: false,
      message: 'มีตัวอักษรซ้ำติดกันเกิน 2 ตัว ลูกค้าจะพิมพ์ผิด',
    }
  }
  const hyphens = (name.match(/-/g) ?? []).length
  if (hyphens > 1) {
    return {
      id: 'pronounceable',
      passed: false,
      message: 'ขีดกลางเกิน 1 ตัว เวลาบอกปากเปล่าลูกค้าจะงง',
    }
  }
  return { id: 'pronounceable', passed: true, message: 'อ่านออกเสียงและพิมพ์ตามได้' }
}

/**
 * ตรวจว่าชื่อสื่อถึงประเภทธุรกิจหรือไม่
 * ใช้คำสำคัญก่อนเสมอ ไม่ต้องเรียก AI
 * ถ้าคำสำคัญไม่ชัด ให้ส่งค่า needsReview เพื่อให้ AI หรือครูช่วยตัดสินทีหลัง
 */
function checkRelevant(name: string, keywords: string[]): RuleResult {
  if (keywords.length === 0) {
    return { id: 'relevant', passed: false, message: 'ยังไม่ได้เลือกประเภทธุรกิจ' }
  }
  const hit = keywords.some((k) => name.includes(k.toLowerCase()))
  return {
    id: 'relevant',
    passed: hit,
    message: hit
      ? 'ชื่อสื่อถึงธุรกิจของหนูแล้ว'
      : 'ชื่อยังไม่บอกว่าร้านขายอะไร ลองใส่คำที่เกี่ยวกับสินค้าเข้าไป',
  }
}

/**
 * ตรวจชื่อโดเมนตามกฎทั้ง 4 ข้อ
 *
 * @param raw ชื่อที่นักเรียนพิมพ์ (ยังไม่ normalize)
 * @param keywords คำสำคัญของประเภทธุรกิจที่นักเรียนเลือกไว้ตอนต้นเกม
 */
export function checkDomainName(raw: string, keywords: string[] = []): DomainCheck {
  const name = normalize(raw)
  const results: RuleResult[] = [
    checkLength(name),
    checkCharset(name),
    checkPronounceable(name),
    checkRelevant(name, keywords),
  ]
  const score = results.filter((r) => r.passed).length
  return { results, score, allPassed: score === results.length }
}

/**
 * คืนคำใบ้ข้อถัดไปที่ควรแก้ — ใช้เป็นทางสำรองเมื่อเรียก AI ไม่ได้
 * คืน null เมื่อผ่านครบทุกข้อ
 */
export function nextHint(check: DomainCheck): string | null {
  return check.results.find((r) => !r.passed)?.message ?? null
}

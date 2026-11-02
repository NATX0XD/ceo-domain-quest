/**
 * E-11 กรองเนื้อหาและดูแลความปลอดภัย — ใช้กับทุกช่องที่นักเรียนพิมพ์ และทุกข้อความที่ AI สร้าง
 *
 * ช่องที่ต้องผ่านตัวนี้: ชื่อแบรนด์ · เหตุผลของภารกิจใหญ่ · คำตอบสะท้อนคิด · ความเห็นที่เพื่อนเห็น · แชตกับโดม
 * และข้อความทุกก้อนจาก AI ก่อนแสดง (ชั้นที่ 5 ในตารางสเปก)
 *
 * **หลักที่ห้ามผิด: ไม่ลบและไม่แก้ข้อความของนักเรียนเงียบ ๆ**
 * ฟังก์ชันในไฟล์นี้คืนข้อความเดิมกลับไปพร้อมธงและข้อความที่จะบอกนักเรียนเสมอ
 * ผู้เรียก (route ฝั่งเซิร์ฟเวอร์) เป็นคนตัดสินว่าจะไม่บันทึก ให้พิมพ์ใหม่ หรือแจ้งครู
 * ตามตาราง "การจัดการตามระดับ" ในสเปก E-11 — การลบทิ้งเงียบ ๆ ทำให้เด็กงงว่าข้อความหายไปไหน
 * และครูไม่มีทางรู้ว่าเกิดอะไรขึ้นในห้องเลย
 *
 * ชั้นการกรองที่ทำในไฟล์นี้คือชั้น 1 (รายการคำ) · 2 (ข้อมูลส่วนตัว) · 3 (แบรนด์ของผู้อื่น)
 * ชั้น 4 (AI ตรวจความหมาย) อยู่ที่ lib/ai และต้องเรียกหลังจากชั้น 1-3 ผ่านแล้วเท่านั้น
 *
 * รายการคำทั้งหมดอยู่ใน content/content-filter.json ครูแก้เองได้ ไม่ฝังคำไว้ในโค้ด
 * ตรรกะล้วน ไม่แตะฐานข้อมูล ไม่เรียก Date.now()
 *
 * ------------------------------------------------------------------
 * วิธีเรียกจาก route ฝั่งเซิร์ฟเวอร์ — ก๊อปไปใช้ได้เลย
 * ------------------------------------------------------------------
 *
 * **1. ช่องที่นักเรียนพิมพ์ทุกช่อง (ชื่อแบรนด์ · เหตุผล · สะท้อนคิด · แชตกับโดม)**
 * ใช้ `reviewStudentText()` ตัวเดียวจบ ได้ทั้งคำตัดสิน ข้อความตอบนักเรียน และแถวที่จะบันทึกแจ้งครู
 *
 * ```ts
 * const review = reviewStudentText(body.reasonText, {
 *   field: 'reason',            // ชื่อช่อง ใช้บอกครูว่ามาจากหน้าไหน
 *   studentId: session.studentId,
 * })
 * if (!review.accepted) {
 *   if (review.flag) await repo.insertContentFlag(review.flag)   // ระดับ 2-3 เท่านั้นที่มี flag
 *   return NextResponse.json({ error: review.studentMessage }, { status: 400 })
 * }
 * // ผ่านแล้วค่อยบันทึกข้อความเดิม (review.result.original) ห้ามบันทึกข้อความที่ถูกแก้
 * ```
 *
 * **2. ข้อความที่เพื่อนจะเห็น (ผนังผลงาน · ความเห็นเพื่อน)** ใส่ `sharedWithPeers: true`
 * เข้มขึ้น 1 ขั้น: ระดับ 1 ที่ปกติแค่เตือน จะไม่ถูกปล่อยขึ้นจอเพื่อน
 *
 * ```ts
 * const review = reviewStudentText(body.comment, {
 *   field: 'peer-comment',
 *   studentId: session.studentId,
 *   sharedWithPeers: true,
 * })
 * ```
 *
 * **3. กรองรายการก่อนขึ้นผนังผลงาน** (ข้อความเก่าที่บันทึกไว้ก่อนมีตัวกรอง อาจมีของไม่ผ่านปนอยู่)
 *
 * ```ts
 * const safeItems = items.filter((item) => safeToShowPeers(item.comment))
 * ```
 *
 * **4. ข้อความที่ AI สร้าง ก่อนส่งให้ผู้เรียนเห็น**
 *
 * ```ts
 * const gate = gateAiText(aiText)
 * const shown = gate.usable ? aiText : fallbackText   // ไม่ผ่าน = สลับข้อความสำรอง ไม่ใช่เซ็นเซอร์บางส่วน
 * ```
 *
 * **5. ชื่อแบรนด์ที่อาจไปชนแบรนด์ของผู้อื่น** — ไม่ใช่การทำผิด ให้ชวนคุยเรื่องเครื่องหมายการค้า
 *
 * ```ts
 * const review = reviewStudentText(body.brandName, { field: 'brand-name' })
 * if (review.famousBrands.length > 0) {
 *   return NextResponse.json({ ok: true, notice: review.famousBrandMessage })
 * }
 * ```
 */
import filterJson from '../content/content-filter.json' with { type: 'json' }

/** 0 ผ่าน · 1 เบา · 2 กลาง · 3 สูง ตามตารางในสเปก E-11 */
export type FilterLevel = 0 | 1 | 2 | 3

export interface FilterMatch {
  /** รหัสกลุ่มคำหรือรูปแบบที่จับได้ เช่น w-gambling หรือ p-phone */
  ruleId: string
  /** ชื่อกลุ่มที่อ่านรู้เรื่อง ใช้เขียนบันทึกให้ครู */
  category: string
  level: FilterLevel
  /** คำหรือรูปแบบที่ตรงในรายการ ไม่ใช่ข้อความของนักเรียนทั้งก้อน */
  term: string
}

export interface FilterResult {
  /** ผ่านทั้งหมดหรือไม่ — ok = true เมื่อ level เป็น 0 และไม่มีข้อมูลส่วนตัว */
  ok: boolean
  level: FilterLevel
  /** เจอข้อมูลส่วนตัวหรือไม่ จัดการคนละทางกับคำไม่เหมาะสม (ไม่แจ้งครู) */
  hasPersonalInfo: boolean
  matches: FilterMatch[]
  /** พบชื่อแบรนด์ของผู้อื่น (ชั้นที่ 3) — ไม่ใช่การทำผิด แต่ต้องชวนคุยเรื่องเครื่องหมายการค้า */
  famousBrands: string[]
  /** ข้อความที่แสดงให้นักเรียนเห็น — ไม่ตำหนิ บอกทางออกเสมอ */
  studentMessage: string | null
  /** ต้องแจ้งครูหรือไม่ */
  notifyTeacher: boolean
  /** ความสำคัญของการแจ้งครู ใช้จัดลำดับบนแผงครู */
  teacherPriority: 'medium' | 'high' | null
  /** ข้อความแบบปิดบางส่วนสำหรับให้ครูดู (ระดับ 2) ระดับ 3 ให้ครูเห็นเต็มเพื่อดูแลได้ถูก */
  teacherText: string | null
  /** ข้อความเดิมของนักเรียน ไม่ถูกแก้ ไม่ถูกตัด */
  original: string
}

const meta = filterJson.meta as {
  levels: ReadonlyArray<{
    level: number
    id: string
    label: string
    notifyTeacher: boolean
    teacherPriority?: string
    maskInTeacherView?: boolean
    recordStat?: boolean
  }>
}

const wordGroups = filterJson.words as ReadonlyArray<{
  id: string
  level: number
  category: string
  terms: readonly string[]
  /**
   * true = เทียบแบบหาชิ้นส่วนกลางคำ แม้เป็นคำอังกฤษ — ใช้กับคำหยาบที่ชอบซ่อนในชื่อเว็บ
   * (ชื่อเว็บไม่มีช่องว่าง เช่น mykuyyshop.in.th) ซึ่งการเทียบแบบมีขอบเขตของคำจับไม่ได้
   */
  embedded?: boolean
  /** คำปกติที่มีคำต้องห้ามอยู่ข้างใน (เช่น kuytiew = ก๋วยเตี๋ยว) ตัดออกจากข้อความก่อนเทียบกลุ่มนี้ */
  allow?: readonly string[]
}>

const personalPatterns = filterJson.personalInfoPatterns as ReadonlyArray<{
  id: string
  label: string
  pattern: string
}>

const famousBrandTerms = (filterJson.famousBrands as { terms: readonly string[] }).terms
const messages = filterJson.messages as Record<string, string>
const leetMap = filterJson.leetMap as Record<string, string>
const stripCharacters = new Set(filterJson.stripCharacters.split(''))
const repeatLimit = filterJson.repeatLimit as number

/** ระดับสูงสุดที่ไฟล์เนื้อหานิยามไว้ ใช้ให้แน่ใจว่าไม่มีคำกลุ่มไหนหลุดช่วง */
/**
 * @wired-optional ค่าขอบบนสำหรับตรวจว่าไม่มีคำกลุ่มไหนหลุดช่วงระดับ ใช้ในเทสต์เนื้อหา
 *   ตัวกรองจริงเทียบระดับรายคำ ไม่ได้อ้างค่าสูงสุด
 */
export const MAX_FILTER_LEVEL = Math.max(...meta.levels.map((l) => l.level)) as FilterLevel

function levelConfig(level: FilterLevel) {
  return meta.levels.find((l) => l.level === level) ?? meta.levels[0]!
}

/**
 * ทำข้อความให้เป็นรูปมาตรฐานก่อนเทียบรายการคำ
 *
 * ตัดช่องว่าง จุด ขีด และอักขระคั่นอื่น · ยุบตัวอักษรซ้ำติดกัน · แปลงเลขที่ใช้แทนตัวอักษร
 * เพื่อให้ "พ น ั น" "พ.นัน" "พนันนนนน" และ "c4sino" ถูกจับได้เหมือน "พนัน" กับ "casino"
 *
 * **ใช้เฉพาะตอนเทียบเท่านั้น ไม่เคยเอาผลนี้ไปบันทึกทับข้อความของนักเรียน**
 */
export function normalizeForFilter(text: string): string {
  const lower = (text ?? '').toLowerCase()
  let out = ''
  let previous = ''
  let repeat = 0

  for (const char of lower) {
    if (stripCharacters.has(char)) continue
    const mapped = leetMap[char] ?? char
    if (mapped === previous) {
      repeat += 1
      // ตัวซ้ำเกินเพดานถูกยุบทิ้ง เหลือไว้เท่าเพดาน
      if (repeat >= repeatLimit) continue
    } else {
      repeat = 0
    }
    out += mapped
    previous = mapped
  }
  return out
}

/** ตัดตัวซ้ำในคำของรายการด้วยกติกาเดียวกัน ไม่งั้นคำที่มีตัวซ้ำอยู่แล้วจะเทียบไม่ตรง */
function normalizedTerm(term: string): string {
  return normalizeForFilter(term)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * คำในรายการปรากฏในข้อความหรือไม่
 *
 * **คำอังกฤษต้องเทียบแบบมีขอบเขตของคำ** ไม่ใช่หาชิ้นส่วนกลางคำ
 * เพราะการตัดขีดกลางออกทำให้ `hints-exhausted` กลายเป็น `hintsexhausted`
 * ซึ่งมีคำว่า sex อยู่กลางคำ แล้วรหัสภายในของเราเองจะติดตัวกรองทั้งที่ไม่มีอะไรผิด
 * (เจอจริงตอนสแกนคลังเนื้อหา 2,412 ก้อน)
 *
 * ส่วนคำไทยเขียนติดกันไม่มีช่องว่างอยู่แล้ว จึงยังเทียบแบบหาชิ้นส่วนเหมือนเดิม
 */
function containsTerm(haystack: string, term: string, embedded = false): boolean {
  const needle = normalizedTerm(term)
  if (needle.length === 0) return false
  if (embedded || !/^[a-z0-9-]+$/.test(needle)) return haystack.includes(needle)
  return new RegExp(`(?<![a-z0-9])${escapeRegex(needle)}(?![a-z0-9])`).test(haystack)
}

/** ชั้นที่ 2 — ตรวจข้อมูลส่วนตัวจากข้อความเดิม ไม่ใช้รูปมาตรฐาน เพราะการตัดจุดทำให้อีเมลเพี้ยน */
function findPersonalInfo(text: string): FilterMatch[] {
  const found: FilterMatch[] = []
  const lower = (text ?? '').toLowerCase()
  /**
   * เบอร์โทรและเลขบัตรมักพิมพ์คั่นด้วยขีดหรือเว้นวรรค จึงต่อเลขที่ถูกคั่นกลับเข้าด้วยกันก่อนตรวจ
   * **ต่อเฉพาะตัวคั่นที่อยู่ระหว่างตัวเลขสองตัวเท่านั้น** ถ้าตัดช่องว่างทั้งประโยคทิ้ง
   * เลขคนละชุดในประโยคเดียวกันจะมาต่อกันเองจนยาวครบ 13 หลัก แล้วถูกกล่าวหาว่าเป็นเลขบัตรประชาชน
   * (เจอจริงตอนสแกนคลังเนื้อหา — ประโยคที่เขียนว่า "ข้อ 1-8 ... q1 ถึง q8 ... ข้อ 9")
   */
  const digitsOnly = lower.replace(/(?<=\d)[\s-]+(?=\d)/g, '')

  for (const rule of personalPatterns) {
    const regex = new RegExp(rule.pattern)
    const target = rule.id === 'p-email' || rule.id === 'p-address' ? lower : digitsOnly
    if (regex.test(target)) {
      found.push({ ruleId: rule.id, category: rule.label, level: 0, term: rule.label })
    }
  }
  return found
}

/** ชั้นที่ 1 — เทียบรายการคำด้วยรูปมาตรฐาน */
function findBannedWords(normalized: string): FilterMatch[] {
  const found: FilterMatch[] = []
  for (const group of wordGroups) {
    let haystack = normalized
    for (const allowed of group.allow ?? []) {
      const word = normalizedTerm(allowed)
      if (word.length > 0) haystack = haystack.split(word).join(' ')
    }
    for (const term of group.terms) {
      if (containsTerm(haystack, term, group.embedded === true)) {
        found.push({
          ruleId: group.id,
          category: group.category,
          level: group.level as FilterLevel,
          term,
        })
      }
    }
  }
  return found
}

/** ชั้นที่ 3 — ชื่อแบรนด์ของผู้อื่น คืนรายชื่อที่เจอ ไม่ใช่การทำผิดของนักเรียน */
export function findFamousBrands(text: string): string[] {
  const normalized = normalizeForFilter(text)
  const found: string[] = []
  for (const term of famousBrandTerms) {
    if (containsTerm(normalized, term) && !found.includes(term)) {
      found.push(term)
    }
  }
  return found
}

/**
 * ปิดบางส่วนของข้อความสำหรับให้ครูดูในระดับ 2
 * เก็บตัวแรกและตัวท้ายของทุกคำไว้ ครูจึงพอเดาบริบทได้โดยไม่ต้องอ่านคำหยาบเต็ม ๆ บนจอหน้าห้อง
 */
export function maskText(text: string): string {
  return (text ?? '')
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token) || token.length <= 2) return token
      return `${token[0]}${'•'.repeat(token.length - 2)}${token[token.length - 1]}`
    })
    .join('')
}

export interface FilterOptions {
  /**
   * ข้อความนี้จะถูกคนอื่นเห็นหรือไม่ (ผนังผลงาน ความเห็นเพื่อน)
   * ถ้าใช่ ระดับ 1 ก็ต้องกันไม่ให้ขึ้นจอเพื่อน แม้จะไม่แจ้งครูก็ตาม
   */
  sharedWithPeers?: boolean
  /** ข้อความนี้มาจาก AI ไม่ใช่จากนักเรียน — ไม่ต้องมีข้อความบอกนักเรียน ให้ใช้ข้อความสำรองแทน */
  fromAi?: boolean
}

/**
 * ตรวจข้อความหนึ่งก้อนผ่านชั้น 1-3
 *
 * คืนผลครบทุกอย่างที่ผู้เรียกต้องใช้ตัดสินใจ **แต่ไม่ตัดสินใจแทน และไม่แก้ข้อความ**
 * ระดับที่ได้คือระดับสูงสุดที่เจอ ถ้าเจอทั้งคำหยาบทั่วไปและคำกลั่นแกล้ง จะได้ระดับ 3
 */
export function checkContent(text: string, options: FilterOptions = {}): FilterResult {
  const original = text ?? ''
  const normalized = normalizeForFilter(original)

  const wordMatches = findBannedWords(normalized)
  const personalMatches = findPersonalInfo(original)
  const famousBrands = findFamousBrands(original)

  const level = (wordMatches.reduce<number>((max, m) => Math.max(max, m.level), 0) ||
    0) as FilterLevel
  const hasPersonalInfo = personalMatches.length > 0
  const config = levelConfig(level)

  let studentMessage: string | null = null
  if (options.fromAi) {
    // ข้อความจาก AI ไม่ต้องบอกนักเรียน ผู้เรียกต้องสลับไปใช้ข้อความสำรองแทนเงียบ ๆ
    studentMessage = null
  } else if (level === 3) {
    studentMessage = messages.critical!
  } else if (level === 2) {
    studentMessage = messages.severe!
  } else if (level === 1) {
    studentMessage = messages.mild!
  } else if (hasPersonalInfo) {
    studentMessage = messages.personal!
  }

  // ข้อมูลส่วนตัวไม่แจ้งครูตามสเปก แต่ยังต้องบอกนักเรียนให้เอาออก
  const notifyTeacher = config.notifyTeacher === true
  const teacherPriority = notifyTeacher
    ? ((config.teacherPriority ?? 'medium') as 'medium' | 'high')
    : null
  const teacherText = notifyTeacher
    ? config.maskInTeacherView
      ? maskText(original)
      : original
    : null

  const ok = level === 0 && !hasPersonalInfo

  return {
    ok,
    level,
    hasPersonalInfo,
    matches: [...wordMatches, ...personalMatches],
    famousBrands,
    studentMessage,
    notifyTeacher,
    teacherPriority,
    teacherText,
    original,
  }
}

/**
 * ข้อความนี้ให้เพื่อนเห็นได้ไหม — ใช้กับผนังผลงานและความเห็นของเพื่อนโดยเฉพาะ
 * เข้มกว่าปกติ 1 ขั้น: ระดับ 1 ที่ปกติแค่เตือน จะไม่ถูกปล่อยขึ้นจอให้เพื่อนเห็น
 */
export function safeToShowPeers(text: string): boolean {
  const result = checkContent(text, { sharedWithPeers: true })
  return result.level === 0 && !result.hasPersonalInfo
}

export interface AiTextGate {
  /** ใช้ข้อความจาก AI ได้ไหม */
  usable: boolean
  /** เหตุผลที่ใช้ไม่ได้ ใช้เขียน log ให้ครูตรวจย้อน */
  reason: string | null
  result: FilterResult
}

/**
 * ชั้นที่ 5 — ข้อความที่ AI สร้างต้องผ่านชั้น 1-3 ก่อนแสดง
 * ไม่ผ่าน = ผู้เรียกต้องสลับไปใช้ข้อความสำรอง ไม่ใช่แสดงข้อความที่ถูกเซ็นเซอร์บางส่วน
 */
export function gateAiText(text: string): AiTextGate {
  const result = checkContent(text, { fromAi: true })
  if (result.level > 0) {
    return { usable: false, reason: `ข้อความจาก AI ติดตัวกรองระดับ ${result.level}`, result }
  }
  if (result.hasPersonalInfo) {
    return { usable: false, reason: 'ข้อความจาก AI มีสิ่งที่ดูเหมือนข้อมูลส่วนตัว', result }
  }
  if (result.famousBrands.length > 0) {
    return {
      usable: false,
      reason: `ข้อความจาก AI พาดพิงแบรนด์ของผู้อื่น (${result.famousBrands.join(', ')})`,
      result,
    }
  }
  return { usable: true, reason: null, result }
}

/** ข้อความชวนคุยเรื่องเครื่องหมายการค้า เมื่อนักเรียนอยากเป็น CEO ของแบรนด์ดัง */
export function famousBrandMessage(brands: string[]): string {
  return brands.length > 0 ? messages.famousBrand! : messages.maybeFamousBrand!
}

/**
 * แถวที่พร้อมบันทึกลงตาราง content_flags ให้ครูเห็น
 * มีค่าเฉพาะระดับ 2 และ 3 เท่านั้น ระดับ 1 กับข้อมูลส่วนตัวไม่แจ้งครูตามสเปก
 */
export interface ContentFlag {
  studentId: string | null
  /** ช่องที่พิมพ์มา เช่น reason · reflection · peer-comment · brand-name · dome-chat */
  field: string
  level: FilterLevel
  priority: 'medium' | 'high'
  /** กลุ่มคำที่เจอ ใช้ทำสถิติให้ครู ไม่ต้องอ่านข้อความเต็มก็รู้ว่าเรื่องอะไร */
  categories: string[]
  /** ข้อความที่ครูเห็น — ระดับ 2 ปิดบางส่วน ระดับ 3 เต็ม เพื่อให้ดูแลได้ถูก */
  teacherText: string
}

export interface ReviewOptions {
  /** ชื่อช่องที่พิมพ์มา ใช้บอกครูว่ามาจากหน้าไหน */
  field: string
  studentId?: string | null
  /** ข้อความนี้จะถูกเพื่อนเห็นหรือไม่ (ผนังผลงาน ความเห็นเพื่อน) */
  sharedWithPeers?: boolean
}

export interface ReviewOutcome {
  /** บันทึกและแสดงได้หรือไม่ */
  accepted: boolean
  level: FilterLevel
  hasPersonalInfo: boolean
  /** ข้อความที่ส่งกลับให้นักเรียน null เมื่อผ่านทุกด่าน */
  studentMessage: string | null
  /** แถวที่จะบันทึกแจ้งครู null เมื่อไม่ต้องแจ้ง */
  flag: ContentFlag | null
  /**
   * ต้องนับสถิติไว้ให้ครูดูภายหลังหรือไม่ (ระดับ 1 ตามสเปก "บันทึกสถิติ ไม่แจ้ง")
   * ฝั่งเว็บบันทึกลง content_flags ได้เหมือนกัน แต่ห้ามเด้งแจ้งเตือนครูกลางคาบ
   */
  recordStat: boolean
  /** แบรนด์ของผู้อื่นที่เจอ — ไม่ทำให้ตก แต่ต้องชวนคุย */
  famousBrands: string[]
  famousBrandMessage: string | null
  /** ผลดิบ ถ้าต้องดูรายละเอียดเพิ่ม · `result.original` คือข้อความเดิมที่ต้องเอาไปบันทึก */
  result: FilterResult
}

/**
 * ด่านเดียวที่ route ฝั่งเซิร์ฟเวอร์ต้องเรียก — รวมทุกชั้นและแปลงเป็นคำตัดสินที่เอาไปใช้ได้เลย
 *
 * **ยังคงหลักเดิม: ไม่แก้และไม่ลบข้อความของนักเรียน**
 * ฟังก์ชันนี้แค่บอกว่ารับได้หรือไม่ ข้อความที่จะบันทึกคือ `result.original` เสมอ
 *
 * การตัดสิน:
 * - ระดับ 0 และไม่มีข้อมูลส่วนตัว = รับ
 * - มีข้อมูลส่วนตัว = ไม่รับ บอกนักเรียนให้เอาออก **ไม่แจ้งครู** ตามตารางในสเปก
 * - ระดับ 1 = ไม่รับ ชวนให้เปลี่ยนคำ ไม่แจ้งครู (สเปกให้บันทึกสถิติอย่างเดียว)
 * - ระดับ 2 = ไม่รับ + แจ้งครู medium พร้อมข้อความปิดบางส่วน
 * - ระดับ 3 = ไม่รับ + แจ้งครู high พร้อมข้อความเต็ม (เกณฑ์สเปก: ถึงแผงครูภายใน 3 วินาที)
 */
export function reviewStudentText(text: string, options: ReviewOptions): ReviewOutcome {
  const result = checkContent(text, { sharedWithPeers: options?.sharedWithPeers })

  const blockedByPeerRule = Boolean(options?.sharedWithPeers) && result.level >= 1
  const accepted = result.ok && !blockedByPeerRule

  const flag: ContentFlag | null = result.notifyTeacher
    ? {
        studentId: options?.studentId ?? null,
        field: options?.field ?? 'unknown',
        level: result.level,
        priority: result.teacherPriority ?? 'medium',
        // ไม่เคยเป็น null เมื่อ notifyTeacher เป็น true แต่กันไว้ให้ชนิดข้อมูลตรง
        categories: [...new Set(result.matches.filter((m) => m.level > 0).map((m) => m.category))],
        teacherText: result.teacherText ?? result.original,
      }
    : null

  return {
    accepted,
    level: result.level,
    hasPersonalInfo: result.hasPersonalInfo,
    studentMessage: result.studentMessage,
    flag,
    recordStat: result.level >= 1,
    famousBrands: result.famousBrands,
    famousBrandMessage:
      result.famousBrands.length > 0 ? famousBrandMessage(result.famousBrands) : null,
    result,
  }
}

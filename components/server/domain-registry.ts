import { z } from 'zod'
import reservedJson from '@/content/reserved-names.json' with { type: 'json' }
import { MAX_LENGTH, MIN_LENGTH, checkDomainName, type DomainCheck } from '@/core/domain-rules'
import { isDomainTaken } from '@/core/quiz'
import { getServiceClient } from '@/lib/db/client'

/**
 * ทะเบียนชื่อเว็บ (S-23 + E-06) — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * โมเมนต์สอนของเรื่องนี้คือ "ใครจดก่อนได้ก่อน" จึงต้องมีทะเบียนจริง 2 ชั้น:
 * 1. **โลกของเกม** — `content/taken-domains.json` ผ่าน `isDomainTaken()` ของ core/quiz
 * 2. **ห้องเรียนจริง** — ชื่อที่เพื่อนในห้องเดียวกันจดไปแล้ว (`profiles.domain_name`)
 *    เจ้าของคือคนที่บันทึกก่อน เรียงด้วย `profiles.updated_at` ไม่ใช่ใครกดทีหลังแล้วแย่งได้
 *
 * บวกชั้นชื่อต้องห้ามจาก `content/reserved-names.json` (แบรนด์คนอื่น · ชื่อในแบบฝึก · คำสงวนทางเทคนิค)
 *
 * ⚠️ ชนแล้วต้อง **เสนอชื่อที่ยังว่างให้ด้วยเสมอ** ไม่ใช่บอกแค่ว่าใช้ไม่ได้
 *    เด็กที่โดนปฏิเสธเฉย ๆ กลางคาบจะค้างอยู่ตรงนั้นจนหมดเวลา
 * ⚠️ ไม่แก้และไม่บันทึกชื่อแทนเด็ก ฟังก์ชันนี้ตอบอย่างเดียวว่าว่างหรือไม่ว่าง
 */

/* ----------------------------------------------------- ชื่อต้องห้ามจากไฟล์เนื้อหา */

const ReservedSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        matchMode: z.enum(['exact', 'contains']),
        message: z.string().min(1),
        items: z.array(z.string().min(1)),
      }),
    )
    .min(1),
})

const reserved = ReservedSchema.parse(reservedJson)

export interface ReservedHit {
  groupId: string
  label: string
  message: string
  term: string
}

/**
 * ชื่อนี้ชนรายการชื่อต้องห้ามไหม
 *
 * ⚠️ โหมดการเทียบมาจากไฟล์เนื้อหา ห้ามเปลี่ยนเองในโค้ด — กลุ่ม brand/reserved เทียบ **ตรงทั้งคำ**
 *    เพราะชื่อสุจริตอย่าง `bankhanomyai` มีคำว่า `bank` อยู่ข้างใน ถ้าเทียบแบบ contains จะโดนกันผิด
 */
export function reservedNameHit(name: string): ReservedHit | null {
  const value = name.trim().toLowerCase()
  if (value.length === 0) return null

  for (const group of reserved.groups) {
    for (const term of group.items) {
      const t = term.trim().toLowerCase()
      if (t.length === 0) continue
      const hit = group.matchMode === 'exact' ? value === t : value.includes(t)
      if (hit) {
        return { groupId: group.id, label: group.label, message: group.message, term: t }
      }
    }
  }
  return null
}

/* ------------------------------------------------- ตัด URL ที่เด็กวางมาให้เหลือชื่อจริง */

/** นามสกุลที่ตัดท้ายออกได้ เมื่อเด็กวางโดเมนเต็ม ๆ มา (ครอบคลุม .co.th .in.th .ac.th ด้วย) */
const TRAILING_TLD = /\.(com|net|org|info|co|in|ac|go|or|shop|store|online|site|th|xyz)(\.[a-z]{2,})?$/

export interface ExtractedDomain {
  /** ชื่อจริงที่เหลือหลังตัด */
  name: string
  /** สิ่งที่ถูกตัดออก ใช้บอกเด็กตรง ๆ ว่าระบบตัดอะไรให้ (ไม่ตัดเงียบ ๆ) */
  removed: string[]
}

/**
 * ตัด URL ที่ผู้เรียนก๊อปมาวางให้เหลือ "ชื่อจริง" ก่อนตรวจ (E-06 ขั้นที่ 1)
 *
 * เด็กวาง `https://www.mycake.com/menu?x=1#top` มา ต้องได้ `mycake`
 * **ไม่เขียนทับสิ่งที่เด็กพิมพ์** ผู้เรียกต้องบอกเสมอว่าตัดอะไรไปบ้าง (`removed`)
 *
 * ⚠️ อยู่ที่นี่แทนที่จะไปแก้ `core/domain-rules.ts normalize()` เพราะ core/ ไม่ได้อยู่ในขอบเขตรอบนี้
 *    ที่ถูกต้องระยะยาวคือย้ายไปเป็นขั้นแรกของ normalize() แล้วให้ทุกที่ได้ผลเหมือนกัน
 */
export function extractDomainName(raw: string): ExtractedDomain {
  const removed: string[] = []
  let value = (raw ?? '').trim().toLowerCase()

  const scheme = value.match(/^[a-z][a-z0-9+.-]*:\/\//)
  if (scheme) {
    removed.push(scheme[0])
    value = value.slice(scheme[0].length)
  }

  const cut = value.search(/[/?#]/)
  if (cut >= 0) {
    if (value.slice(cut).length > 0) removed.push(value.slice(cut))
    value = value.slice(0, cut)
  }

  if (value.startsWith('www.')) {
    removed.push('www.')
    value = value.slice(4)
  }

  const tld = value.match(TRAILING_TLD)
  if (tld) {
    removed.push(tld[0])
    value = value.slice(0, value.length - tld[0].length)
  }

  // เหลือ label สุดท้ายอย่างเดียว เช่น shop.mycake -> mycake
  const dot = value.lastIndexOf('.')
  if (dot >= 0) {
    removed.push(value.slice(0, dot + 1))
    value = value.slice(dot + 1)
  }

  return { name: value.trim(), removed }
}

/* ----------------------------------------------------------- ทะเบียนของห้องเรียน */

export interface ClassmateClaim {
  name: string
  nickname: string
  studentId: string
  claimedAt: string
}

/**
 * ชื่อที่เพื่อนในห้องเดียวกันจดไปแล้ว — **ไม่รวมของตัวเอง**
 *
 * เรียงตามเวลาที่บันทึก คนแรกที่จดชื่อนั้นคือเจ้าของ คนที่มาทีหลังจดซ้ำไม่ได้
 * คืนชื่อเล่นมาด้วยเพื่อให้บอกได้ว่า "เพื่อนจดไปแล้ว" — **ไม่คืนดาวหรือคะแนนของใครทั้งสิ้น**
 */
export async function classmateClaims(
  classroomId: string,
  exceptStudentId: string,
): Promise<ClassmateClaim[]> {
  const { data, error } = await getServiceClient()
    .from('students')
    .select('id, nickname, profiles(domain_name, updated_at)')
    .eq('classroom_id', classroomId)

  if (error) throw new Error(`classmateClaims: ${error.message}`)

  const claims: ClassmateClaim[] = []
  for (const row of data ?? []) {
    if (row.id === exceptStudentId) continue
    const profile = row.profiles as { domain_name: string | null; updated_at: string } | null
    const name = extractDomainName(profile?.domain_name ?? '').name
    if (name.length === 0) continue
    claims.push({
      name,
      nickname: row.nickname,
      studentId: row.id,
      claimedAt: profile?.updated_at ?? '',
    })
  }

  // จดก่อนได้ก่อน — คนแรกในลิสต์คือเจ้าของชื่อนั้น
  claims.sort((a, b) => a.claimedAt.localeCompare(b.claimedAt))
  return claims
}

/* ---------------------------------------------------------------- ข้อเสนอชื่อว่าง */

/**
 * คำต่อท้ายที่ใช้เสนอชื่อสำรอง
 * เป็นคำกลาง ๆ ที่ไม่ผูกกับประเภทธุรกิจ เพื่อไม่ไปแต่งเรื่องร้านของเด็กแทนเขา
 * ทีมเนื้อหาย้ายเข้า content/ ได้ถ้าอยากคุมคำเอง
 */
const SUFFIXES = ['shop', 'store', 'online', 'thai', 'hub', 'club']

function usable(name: string, taken: (n: string) => boolean): boolean {
  if (name.length < MIN_LENGTH || name.length > MAX_LENGTH) return false
  if (reservedNameHit(name) !== null) return false
  if (taken(name)) return false
  return checkDomainName(name).results.find((r) => r.id === 'charset')?.passed === true
}

/**
 * เสนอชื่อที่ยังว่าง — ต่อยอดจากชื่อที่เด็กคิดมาเอง ไม่ใช่ตั้งชื่อใหม่ให้
 * เรียงจาก "ใกล้ของเดิมที่สุด" ไปหาไกล: เติมคำต่อท้าย -> ใส่ขีดกลาง -> เติมตัวเลข
 */
export function suggestFreeNames(
  base: string,
  taken: (name: string) => boolean,
  limit = 3,
): string[] {
  const seed = base.trim().toLowerCase()
  if (seed.length === 0) return []

  const out: string[] = []
  const push = (candidate: string) => {
    if (out.length >= limit) return
    if (out.includes(candidate)) return
    if (usable(candidate, taken)) out.push(candidate)
  }

  for (const suffix of SUFFIXES) push(`${seed}${suffix}`)
  for (const suffix of SUFFIXES) push(`${seed}-${suffix}`)
  for (let n = 2; n <= 9; n += 1) push(`${seed}${n}`)

  return out
}

/* ------------------------------------------------------------------ ด่านตรวจรวม */

export type DomainStatus = 'available' | 'empty' | 'reserved' | 'taken-world' | 'taken-classroom'

export interface DomainAvailability {
  /** ที่เด็กพิมพ์หรือวางมาจริง ๆ — เก็บไว้เสมอ ห้ามกลืนหาย */
  input: string
  /** ชื่อจริงหลังตัด URL แล้ว */
  name: string
  /** ส่วนที่ถูกตัดออกจากที่วางมา (บอกเด็กว่าตัดอะไรไป) */
  removed: string[]
  available: boolean
  status: DomainStatus
  message: string
  /** ไฟ 4 ดวงของกฎการตั้งชื่อ (ยาว · อักขระ · อ่านออกเสียง · ตรงกับร้าน) */
  rules: DomainCheck
  /** ชื่อเล่นของเพื่อนที่จดไปก่อน — มีเฉพาะตอนชนกับคนในห้อง */
  takenByNickname: string | null
  /** ชื่อที่ยังว่าง เสนอให้เลือกต่อ */
  suggestions: string[]
}

/**
 * ชื่อนี้ยังว่างไหม — รวมทุกชั้นแล้วตอบเป็นคำตัดสินเดียวที่เอาไปแสดงได้เลย
 *
 * ลำดับการตรวจสำคัญ: ตัด URL ก่อน แล้วค่อยดูว่าว่างไหม
 * ไม่งั้นเด็กที่วาง `www.mycake.com` มาจะถูกบอกว่า "ใช้อักขระผิด" ทั้งที่ชื่อจริงไม่มีปัญหา
 */
export async function checkDomainAvailability(
  studentId: string,
  classroomId: string,
  raw: string,
  keywords: string[] = [],
): Promise<DomainAvailability> {
  const { name, removed } = extractDomainName(raw ?? '')
  const rules = checkDomainName(name, keywords)

  const base: Omit<DomainAvailability, 'available' | 'status' | 'message'> = {
    input: raw ?? '',
    name,
    removed,
    rules,
    takenByNickname: null,
    suggestions: [],
  }

  if (name.length === 0) {
    return {
      ...base,
      available: false,
      status: 'empty',
      message: 'ยังไม่ได้ใส่ชื่อ ลองพิมพ์ชื่อที่อยากจดดูนะ',
    }
  }

  const claims = await classmateClaims(classroomId, studentId)
  const claimByName = new Map<string, ClassmateClaim>()
  for (const claim of claims) if (!claimByName.has(claim.name)) claimByName.set(claim.name, claim)

  const taken = (candidate: string) => isDomainTaken(candidate) || claimByName.has(candidate)
  const suggestions = () => suggestFreeNames(name, taken)

  const hit = reservedNameHit(name)
  if (hit) {
    return { ...base, available: false, status: 'reserved', message: hit.message, suggestions: suggestions() }
  }

  if (isDomainTaken(name)) {
    return {
      ...base,
      available: false,
      status: 'taken-world',
      message: `ชื่อ ${name} ถูกจดไปแล้ว ใครจดก่อนได้ก่อน ลองชื่อที่ยังว่างดูนะ`,
      suggestions: suggestions(),
    }
  }

  const mine = claimByName.get(name)
  if (mine) {
    return {
      ...base,
      available: false,
      status: 'taken-classroom',
      message: `ชื่อ ${name} เพื่อนในห้องจดไปก่อนแล้ว (${mine.nickname}) ใครจดก่อนได้ก่อน ลองชื่อที่ยังว่างดูนะ`,
      takenByNickname: mine.nickname,
      suggestions: suggestions(),
    }
  }

  return {
    ...base,
    available: true,
    status: 'available',
    message: `ชื่อ ${name} ยังว่าง จดได้เลย`,
  }
}

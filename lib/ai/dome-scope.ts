/**
 * จัดหมวดข้อความที่นักเรียนพิมพ์หาโดม ก่อนส่งเข้าโมเดล (กฎล้วน ไม่แตะเน็ต)
 * - unsafe / injection / personal / answer-seek / offtopic / later = โดมปฏิเสธหรือเลื่อนเองด้วยบทของโดม ไม่เสียโควตา AI
 * - current / earlier / general = ส่งให้โมเดลตอบ โดยบอกโหมดให้ตรงกับภารกิจของนักเรียน
 */
import { MISSION_ORDER_IDS, missionIndex, missionKeywords, normalizeMissionId, type MissionId } from './topic-lock'

export type DomeScope =
  | 'current'
  | 'earlier'
  | 'general'
  | 'later'
  | 'offtopic'
  | 'unsafe'
  | 'injection'
  | 'personal'
  | 'answer-seek'

const UNSAFE = ['ฆ่าตัวตาย', 'ทำร้าย', 'โป๊', 'อนาจาร', 'ยาเสพติด', 'ข่มขืน', 'ฆ่า', 'กัญชา', 'ฆ่าตัว']
const INJECTION = [
  'ignore', 'system prompt', 'jailbreak', 'developer mode', 'ลืมกฎ', 'ลืมคำสั่ง', 'เปิดเผยคำสั่ง', 'แสดง system',
  'ทำตามคำสั่งในข้อความ', 'คำสั่งระบบ', 'ข้ามกฎ', 'ไม่ต้องสนใจกฎ', 'เฉลยทั้งหมด', 'you are now', 'pretend',
]
const ANSWER_SEEK = ['บอกเฉลย', 'ขอเฉลย', 'เฉลยหน่อย', 'บอกคำตอบ', 'ขอคำตอบ', 'คำตอบข้อ', 'ตอบให้หน่อย', 'tell me the answer', 'give me the answer', 'ตอบข้อไหน', 'ข้อไหนถูก', 'เฉลยข้อ']
const PERSONAL_WORDS = ['เลขบัตร', 'บัตรประชาชน', 'ที่อยู่บ้าน', 'เบอร์โทร', 'เบอร์มือถือ', 'รหัสผ่าน', 'พาสเวิร์ด', 'password', 'เลขบัญชี', 'ไลน์ไอดี', 'line id', 'เฟซบุ๊กส่วนตัว']
const PERSONAL_PATTERNS = [/\b0\d{1,2}[- ]?\d{3}[- ]?\d{4}\b/, /\b\d{13}\b/, /\b\d{1}-?\d{4}-?\d{5}-?\d{2}-?\d{1}\b/, /[\w.+-]+@[\w-]+\.[\w.]+/]
const OFFTOPIC = ['การเมือง', 'หุ้น', 'พนัน', 'หวย', 'สูตรอาหาร', 'เกมออนไลน์', 'ดารา', 'ข่าววันนี้', 'ความรัก', 'แฟน', 'ทำการบ้านวิชา', 'คริปโต', 'บอลคืนนี้', 'ฟุตบอล', 'ดูดวง', 'เขียนโค้ด', 'ช่วยทำการบ้าน', 'แต่งเพลง', 'แต่งกลอน']
/** คำที่บอกว่าอยู่ในเรื่องของโครงการนี้ (ไม่ใช้ตัดสินภารกิจ) */
const ON_TOPIC = ['โดเมน', 'domain', 'เว็บ', 'ร้าน', 'ภารกิจ', 'ธุรกิจ', 'ขาย', 'ลูกค้า', 'คำใบ้', 'ใบ้', 'งง', 'ไม่เข้าใจ', 'ชื่อ', 'จด', 'ดาว', 'เรียน']

function hit(lower: string, term: string): boolean {
  const t = term.toLowerCase()
  if (/^[a-z0-9 ]+$/.test(t) && t.length <= 3) return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(lower)
  return lower.includes(t)
}
const any = (lower: string, terms: string[]) => terms.some((t) => hit(lower, t))

export function classifyDomeMessage(message: string, missionId?: string | null): DomeScope {
  const lower = (message ?? '').toLowerCase()
  if (any(lower, UNSAFE)) return 'unsafe'
  if (any(lower, INJECTION)) return 'injection'
  if (any(lower, PERSONAL_WORDS) || PERSONAL_PATTERNS.some((re) => re.test(message))) return 'personal'
  if (any(lower, ANSWER_SEEK)) return 'answer-seek'

  const current = normalizeMissionId(missionId)
  const idx = missionIndex(current)
  const keywordsOf = (ids: MissionId[]) => ids.flatMap((id) => missionKeywords(id))
  const currentHit = any(lower, missionKeywords(current))
  const earlierHit = current !== 'm5' && any(lower, keywordsOf([...MISSION_ORDER_IDS].slice(0, idx)))
  const laterHit = any(lower, keywordsOf([...MISSION_ORDER_IDS].slice(idx + 1)))

  if (currentHit) return 'current'
  if (earlierHit) return 'earlier'
  if (laterHit) return 'later'
  if (any(lower, OFFTOPIC) && !any(lower, ON_TOPIC)) return 'offtopic'
  return 'general'
}

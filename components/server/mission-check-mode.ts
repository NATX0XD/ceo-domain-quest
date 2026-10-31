import type { Mission } from '../missions'
import { shuffleForStudent } from './mission-variant'

/**
 * UX-2 — ข้อตรวจท้ายภารกิจเล่นแบบไหน
 *
 * mockup จอที่ 4 เป็น "ประกอบชื่อเว็บจากชิ้นส่วนที่แตะเลือก" ไม่ใช่ข้อสอบ ก ข ค ง
 * แต่เนื้อหาบางภารกิจเป็นคำถามเชิงความคิดจริง ๆ (เช่น m1 นิยามของชื่อโดเมน · m4 เงื่อนไขการจดทะเบียน)
 * ซึ่งฝืนแปลงเป็นการประกอบชิ้นส่วนแล้วจะกลายเป็นเกมทายคำ ไม่ได้วัดสิ่งที่ตั้งใจวัด
 * ที่นี่จึงตัดสินจาก **รูปร่างของเนื้อหา** ว่าข้อไหนเหมาะกับการประกอบ
 *
 * ⚠️ **ตัดสินจากไฟล์เนื้อหาสาธารณะเท่านั้น (`content/missions.json`)**
 *    ห้ามอ่าน `missions-answers.json` ที่นี่เด็ดขาด เพราะผลของฟังก์ชันนี้ถูกส่งไปให้หน้าจอ
 *    ถ้าโหมดถูกตัดสินจากเฉลย โหมดก็จะกลายเป็นใบ้เฉลยไปด้วย
 * ⚠️ ของที่ส่งออกจากไฟล์นี้มีแต่สิ่งที่หน้าจอต้องใช้วาด (ช่อง · ชิ้นส่วน · ป้าย)
 *    **ไม่มีคำตอบที่ถูกอยู่ในนี้เลย** การตัดสินถูก/ผิดยังอยู่ที่ route ฝั่งเซิร์ฟเวอร์เหมือนเดิม
 */

export type CheckMode =
  /** ตัวเลือก ก ข ค ง ตามเดิม — ใช้กับคำถามเชิงความคิดและเชิงกติกา */
  | 'choice'
  /** ประกอบชื่อเว็บจากชิ้นส่วนลงช่อง (host / domain / tld) — ใช้กับข้อที่เป็นโครงสร้างชื่อเว็บ */
  | 'assemble-build'

export interface AssembleSlot {
  id: string
  label: string
}

export interface AssemblePiece {
  id: string
  text: string
}

export interface AssemblePlan {
  mode: 'assemble-build'
  /** ช่องที่ต้องเติม เรียงจากซ้ายไปขวาเหมือนที่อ่านชื่อเว็บจริง */
  slots: AssembleSlot[]
  /** ชิ้นส่วนให้แตะเลือก — มีชิ้นหลอกปนอยู่ด้วยตามไฟล์เนื้อหา ลำดับตามไฟล์ ไม่สุ่ม */
  pieces: AssemblePiece[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** มินิเกมของภารกิจนี้เป็นแบบต่อชิ้นส่วน และมีช่องกับชิ้นส่วนครบ */
function hasBuildPieces(mission: Mission): boolean {
  if (mission.channels.game.kind !== 'build') return false
  const items = mission.channels.game.items.map(asRecord)
  return items.some((i) => i.type === 'slot') && items.some((i) => i.type === 'piece')
}

export function checkModeOf(mission: Mission): CheckMode {
  return hasBuildPieces(mission) ? 'assemble-build' : 'choice'
}

/**
 * แผนการวาดของโหมดประกอบ — `null` เมื่อภารกิจนี้ยังเป็นตัวเลือก ก ข ค ง
 *
 * เอาช่องกับชิ้นส่วนจากมินิเกมแบบต่อชิ้นส่วนที่มีอยู่แล้วในไฟล์เนื้อหา **ไม่ต้องเพิ่มคีย์เนื้อหาใหม่**
 * ชิ้นหลอกก็มาจากไฟล์เนื้อหาเช่นกัน ลำดับตามไฟล์ ไม่สุ่ม (รีเฟรชแล้วชิ้นส่วนอยู่ที่เดิม)
 */
export function assemblePlanOf(mission: Mission, studentId?: string): AssemblePlan | null {
  if (checkModeOf(mission) !== 'assemble-build') return null

  const items = mission.channels.game.items.map(asRecord)
  return {
    mode: 'assemble-build',
    slots: items
      .filter((i) => i.type === 'slot')
      .map((i) => ({ id: str(i.id) ?? '', label: str(i.label) ?? '' })),
    pieces: (studentId ? shuffleForStudent(items, studentId) : items)
      .filter((i) => i.type === 'piece')
      .map((i) => ({ id: str(i.id) ?? '', text: str(i.text) ?? '' })),
  }
}

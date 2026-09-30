/**
 * S-05 แจกชุดคำถามเช็กความเข้าใจแบบสลับชุด — ฟังก์ชันล้วน
 *
 * ปัญหาเดิม: ไฟล์เนื้อหามี 2 ชุด (A เป็นชุดหลัก B เป็นชุดคู่ขนาน) แต่ระบบแจกชุด A ให้ทุกคน
 * ข้ออ้าง "ลดการลอกกันในห้อง" จึงใช้ไม่ได้จริง เพราะคนนั่งติดกันเห็นโจทย์เดียวกันหมด
 *
 * กติกา 2 ข้อที่ห้ามผิด:
 * 1. **คงที่ต่อคน** ผู้เรียนคนเดิมต้องได้ชุดเดิมทุกครั้ง ปิดแท็บแล้วเข้าใหม่ก็ต้องได้ชุดเดิม
 *    ไม่อย่างนั้นคนที่เน็ตหลุดกลางคันจะเจอโจทย์คนละชุดแล้วคำตอบที่ตอบไปแล้วใช้ไม่ได้
 * 2. **ห้ามสุ่ม** ทุกอย่างคำนวณจากค่าที่นิ่งอยู่แล้ว ไม่อ่านเวลา ไม่อ่านตัวเลขสุ่ม
 *
 * วิธีแจก: สลับตามลำดับการเข้าห้อง คนที่ 1 ได้ชุดแรก คนที่ 2 ได้ชุดถัดไป วนไปเรื่อย ๆ
 * ถ้าไม่รู้ลำดับ (เช่นหน้าจอที่ไม่ได้ดึงลำดับมาด้วย) ใช้รหัสผู้เรียนคำนวณแทน
 * ซึ่งยังคงที่ต่อคนเหมือนกัน แค่ไม่การันตีว่าคนนั่งติดกันจะได้คนละชุด
 */

/**
 * ตัวเลขประจำข้อความแบบคงที่ — ใช้ตอนไม่รู้ลำดับการเข้าห้อง
 * เป็น FNV-1a 32 บิต เลือกเพราะสั้น อ่านออก และให้ผลเดิมทุกเครื่องทุกครั้ง
 * **ไม่ได้ใช้เพื่อความปลอดภัย** ใช้แค่กระจายคนให้ทั่วสองชุดเท่านั้น
 */
export function stableHash(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export interface AssignCheckSetInput {
  /** รหัสผู้เรียน ใช้เป็นตัวสำรองเมื่อไม่รู้ลำดับการเข้าห้อง */
  studentId: string
  /**
   * ลำดับการเข้าห้องเริ่มจาก 0 — คนแรกของห้องคือ 0
   * ไม่ส่งมา หรือส่งค่าที่ไม่ใช่จำนวนเต็มไม่ติดลบ จะตกไปใช้รหัสผู้เรียนแทน
   */
  joinIndex?: number | null
  /** รหัสชุดทั้งหมดที่มีในไฟล์เนื้อหา เรียงตามลำดับในไฟล์ */
  setIds: readonly string[]
}

export interface CheckSetAssignment {
  setId: string
  /** มาจากลำดับการเข้าห้อง หรือมาจากรหัสผู้เรียน */
  basis: 'join-order' | 'student-id'
}

/**
 * ชุดคำถามของผู้เรียนหนึ่งคน — ผลเดิมทุกครั้งเมื่อข้อมูลเข้าเหมือนเดิม
 * มีชุดเดียวก็คืนชุดนั้น ไม่ต้องคิดอะไร
 */
export function assignCheckSet(input: AssignCheckSetInput): CheckSetAssignment {
  const sets = input.setIds.filter((s) => typeof s === 'string' && s.length > 0)
  if (sets.length === 0) return { setId: '', basis: 'student-id' }
  if (sets.length === 1) return { setId: sets[0]!, basis: 'join-order' }

  const index = input.joinIndex
  if (typeof index === 'number' && Number.isInteger(index) && index >= 0) {
    return { setId: sets[index % sets.length]!, basis: 'join-order' }
  }

  return {
    setId: sets[stableHash(input.studentId) % sets.length]!,
    basis: 'student-id',
  }
}

/**
 * ลำดับการเข้าห้องจากรายชื่อที่เรียงตามเวลาเข้าแล้ว
 * คืน null เมื่อไม่เจอคนนี้ในรายชื่อ ผู้เรียกจะได้ตกไปใช้รหัสผู้เรียนแทน
 */
export function joinIndexOf(studentId: string, orderedStudentIds: readonly string[]): number | null {
  const at = orderedStudentIds.indexOf(studentId)
  return at < 0 ? null : at
}

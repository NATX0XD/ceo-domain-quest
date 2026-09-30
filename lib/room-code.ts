/**
 * รหัสห้องเรียน 6 ตัว — ครูฉายขึ้นจอโปรเจกเตอร์ นักเรียนพิมพ์ตามจากหลังห้อง
 *
 * ตรรกะล้วน ไม่แตะฐานข้อมูล
 */
import { customAlphabet } from 'nanoid'

/**
 * ตัวอักษรที่ใช้สร้างรหัส — ตัด 0 O 1 I L ออกทั้งหมด
 * เพราะบนจอโปรเจกเตอร์เด็กหลังห้องแยกไม่ออกว่าเลขศูนย์หรือตัวโอ
 * เหลือ 31 ตัว: รหัส 6 หลักสุ่มได้ราว 887 ล้านแบบ พอเหลือเฟือสำหรับห้องที่เปิดพร้อมกัน
 */
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export const ROOM_CODE_LENGTH = 6

const nano = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH)

/** สุ่มรหัสห้องใหม่ ไม่การันตีว่าไม่ซ้ำของเดิม ผู้เรียกต้องเช็กกับฐานข้อมูลเอง */
export function genRoomCode(): string {
  return nano()
}

/**
 * ทำรหัสที่นักเรียนพิมพ์ให้เป็นรูปแบบมาตรฐานก่อนนำไปค้น
 * ตัดช่องว่างหัวท้าย และแปลงเป็นตัวพิมพ์ใหญ่ เพราะคีย์บอร์ดมือถือชอบขึ้นต้นด้วยตัวเล็ก
 */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/** รหัสอยู่ในรูปแบบที่เป็นไปได้หรือไม่ ใช้กันไม่ให้ยิงฐานข้อมูลฟรี ๆ */
export function isValidRoomCode(raw: string): boolean {
  const code = normalizeRoomCode(raw)
  if (code.length !== ROOM_CODE_LENGTH) return false
  return [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))
}

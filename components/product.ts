/**
 * ชื่อผลงาน — แหล่งเดียวของทั้งแอป
 *
 * มติเจ้าของโปรเจกต์ (T40): ใช้ **CEO Domain Quest** เป็นชื่อหลัก (ชื่อชั่วคราว)
 * ส่วนไทย "ภารกิจ CEO ตั้งชื่อเว็บ" เป็นชื่อรอง
 * ถ้าจะเปลี่ยนชื่ออีกรอบ แก้ที่ไฟล์นี้ไฟล์เดียว อย่าพิมพ์ชื่อซ้ำลงหน้าอื่น
 */
export const PRODUCT_NAME_EN = 'CEO Domain Quest'
export const PRODUCT_NAME_TH = 'ภารกิจ CEO ตั้งชื่อเว็บ'

/** ชื่อเต็มสำหรับหัวเว็บและที่ที่มีที่ว่างพอ */
export const PRODUCT_NAME_FULL = `${PRODUCT_NAME_EN} — ${PRODUCT_NAME_TH}`

/** ชื่อแท็บของหน้าย่อย เช่น pageTitle('หน้าหลัก') = "หน้าหลัก — CEO Domain Quest" */
export function pageTitle(page: string): string {
  return `${page} — ${PRODUCT_NAME_EN}`
}

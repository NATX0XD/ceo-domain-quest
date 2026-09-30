/**
 * ต่อ className แบบเบา ๆ โดยไม่เพิ่ม dependency ใหม่เข้าโปรเจกต์
 *
 * ไม่ทำ conflict-resolution แบบ tailwind-merge — ทุก component ในโฟลเดอร์นี้
 * จึงวาง `className` ที่ผู้เรียกส่งมาไว้ "ท้ายสุด" เสมอ เพื่อให้ utility ของผู้เรียก
 * ชนะ utility ตั้งต้นตามลำดับของ CSS
 */
export type ClassValue = string | false | null | undefined

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}

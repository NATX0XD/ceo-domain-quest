/**
 * ตรรกะล้วนของ "คีย์บอร์ดมือถือเปิดอยู่ไหม / กินพื้นที่เท่าไร" — แยกจาก DOM เพื่อทดสอบได้
 * ใช้กับ components/keyboard-inset.tsx ที่เอาไปเขียนลง CSS var บน <html>
 */

export type KeyboardInput = {
  /** ความสูง visualViewport ที่ใหญ่ที่สุดที่เคยเห็นตอนไม่มีคีย์บอร์ด (ใช้เป็นฐาน) */
  baseline: number
  vvHeight: number
  vvOffsetTop: number
  vvScale: number
  /** กำลังโฟกัสช่องพิมพ์อยู่ */
  editableFocused: boolean
  /** ความสูง layout viewport (window.innerHeight) */
  layoutHeight: number
}

export type KeyboardState = {
  open: boolean
  /** ความสูงที่คีย์บอร์ดบังจากท้ายจอ (px) */
  inset: number
  /** ความสูงพื้นที่ที่ใช้ได้จริง (px) — ใช้แทน 100dvh ตอนคีย์บอร์ดเปิด */
  appHeight: number
  /** ระยะที่ visual viewport ถูกเลื่อนลงจากบนสุดของ layout viewport (iOS) */
  top: number
}

/** คีย์บอร์ดจริงสูงอย่างน้อย ~200px; แถบ URL ที่ยุบ/ขยายไม่เกิน ~100px */
export const KEYBOARD_MIN_PX = 140

export function computeKeyboard(i: KeyboardInput): KeyboardState {
  const shrink = i.baseline - i.vvHeight
  // ซูมด้วยนิ้ว (scale > 1) ทำให้ vv.height เล็กลงโดยไม่ใช่คีย์บอร์ด
  const open = i.editableFocused && i.vvScale <= 1.01 && shrink > KEYBOARD_MIN_PX
  if (!open) return { open: false, inset: 0, appHeight: i.vvHeight, top: 0 }
  return {
    open: true,
    inset: Math.max(0, Math.round(shrink)),
    appHeight: Math.round(i.vvHeight),
    top: Math.max(0, Math.round(i.vvOffsetTop)),
  }
}

/** ช่องที่เรียกคีย์บอร์ดขึ้นมา (ไม่รวม checkbox/radio/range/ปุ่ม) */
export function isTextEntry(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) {
    if (el.readOnly || el.disabled) return false
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image', 'hidden'].includes(el.type)
  }
  return el instanceof HTMLElement && el.isContentEditable
}

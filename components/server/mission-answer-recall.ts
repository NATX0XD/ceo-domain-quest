import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Mission } from '../missions'
import { assemblePlanOf } from './mission-check-mode'

/**
 * "ภารกิจนี้เราตอบว่าอะไรไป" — สำหรับภารกิจที่ **ผ่านไปแล้วเท่านั้น**
 *
 * ## ทำไมต้องมี
 *
 * เด็กเปิดภารกิจเก่าย้อนกลับมาดู แล้วจอไม่บอกอะไรเลยว่าเคยตอบอะไร (flow-1.md ข้อ 3)
 * ตารางฐานข้อมูล `mission_progress` เก็บแค่ attempts / hints / stars ไม่ได้เก็บคำตอบที่เลือก
 * และการเพิ่มคอลัมน์เป็นงานของ session db ไม่ใช่ของหน้าจอ
 *
 * แต่ **ผ่านแล้วแปลว่าคำตอบที่เลือกคือคำตอบที่ถูก** จึงอ่านจากไฟล์เฉลยได้เลย
 * ไม่ต้องรอ migration และได้ค่าตรงกับที่เด็กกดจริงเสมอ
 *
 * ## กติกาความปลอดภัย (ห้ามผ่อน)
 *
 * ⚠️ เรียกได้ **เฉพาะเมื่อ `mission_progress.passed_at` มีค่าแล้ว** ผู้เรียนคนนั้นตอบถูกไปแล้วจริง ๆ
 *    ผู้เรียกต้องเช็กเงื่อนไขนี้เอง ฟังก์ชันนี้ไม่ได้อ่านฐานข้อมูลและไม่รู้จักผู้เรียน
 * ⚠️ อ่านไฟล์เฉลยด้วย dynamic import ตอนเรียกจริง **ห้าม import ไว้บนหัวไฟล์**
 *    (รูปแบบเดียวกับ `app/api/mission/[id]/check/route.ts` — ถ้า import ตรง ๆ Turbopack
 *     จะลากทั้งไฟล์เฉลยเข้าบันเดิล แล้ว `npm run check:leaks` จะจับได้ทันที)
 * ⚠️ คืนค่าเป็น **ข้อความอ่านเล่น ๆ ของคำตอบเดียว** เช่น "ข้อ ก" ไม่ใช่เฉลยของภารกิจอื่น
 */

/** ตัวอักษรนำหน้าตัวเลือก ตรงกับที่หน้าจอภารกิจใช้ (ครูอ้างถึงข้อได้ตอนพูดหน้าห้อง) */
const CHOICE_MARKERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

interface AnswerEntry {
  id: string
  checkId: string
  answerIndex: number
  gameKey?: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function loadEntries(): Promise<AnswerEntry[]> {
  // เขียนเส้นทางตรง ๆ ไม่ประกอบจากตัวแปร ไม่งั้น Turbopack จะ trace ทั้งโปรเจกต์
  const fileUrl = pathToFileURL(join(process.cwd(), 'content', 'missions-answers.json')).href
  try {
    const mod = (await import(/* turbopackIgnore: true */ fileUrl, {
      with: { type: 'json' },
    })) as { default: unknown }
    const missions = asRecord(mod.default).missions
    if (!Array.isArray(missions)) return []
    return missions.map((m) => {
      const row = asRecord(m)
      return {
        id: typeof row.id === 'string' ? row.id : '',
        checkId: typeof row.checkId === 'string' ? row.checkId : '',
        answerIndex: typeof row.answerIndex === 'number' ? row.answerIndex : -1,
        gameKey: row.gameKey,
      }
    })
  } catch {
    // ไม่มีไฟล์เฉลย = แค่ไม่บอกว่าตอบอะไรไป หน้าจอส่วนอื่นยังใช้งานได้ปกติ
    return []
  }
}

/**
 * ข้อความสั้น ๆ ว่าคำตอบที่ผ่านคืออะไร — `null` เมื่ออ่านไม่ได้ (จอจะไม่พูดถึงเรื่องนี้เลย)
 *
 * โหมดตัวเลือก → "ข้อ ก" · โหมดประกอบชิ้นส่วน → ชื่อเว็บที่ประกอบเสร็จ เช่น "www.beam .com"
 */
export async function passedAnswerLabel(mission: Mission): Promise<string | null> {
  const entries = await loadEntries()
  const entry = entries.find((e) => e.id === mission.id && e.checkId === mission.check.id)
  if (!entry) return null

  const plan = assemblePlanOf(mission)
  if (plan) {
    const key = asRecord(entry.gameKey)
    if (key.kind !== 'build' || !Array.isArray(key.placements)) return null
    const bySlot = new Map<string, string>()
    for (const p of key.placements) {
      const row = asRecord(p)
      if (typeof row.slot === 'string' && typeof row.piece === 'string') {
        bySlot.set(row.slot, row.piece)
      }
    }
    const text = plan.slots
      .map((slot) => plan.pieces.find((piece) => piece.id === bySlot.get(slot.id))?.text)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .join(' ')
    return text.length > 0 ? text : null
  }

  const marker = CHOICE_MARKERS[entry.answerIndex]
  return marker ? `ข้อ ${marker}` : null
}

import type { GameData, GameKind } from '@/components/mission-game'
import type { Mission } from '@/components/missions'
import { shuffleForStudent } from './mission-variant'

/**
 * แปลง items ของมินิเกมใน content/missions.json ให้เป็นรูปที่หน้าจอใช้ได้
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์ — ไม่มีเฉลยอยู่ในผลลัพธ์นี้เลย (เฉลยอยู่ใน missions-answers.json)
 * ทุกข้อความมาจากไฟล์เนื้อหา ห้าม hardcode ชิ้นส่วนใน JSX
 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function buildGameData(mission: Mission, studentId?: string): GameData | null {
  const game = mission.channels.game
  const kind = game.kind as GameKind
  const items = game.items.map(asRecord)

  if (kind === 'match') {
    const left = items.filter((i) => i.side === 'left')
    const right = items.filter((i) => i.side === 'right')
    return {
      kind,
      instruction: game.instruction,
      targets: left.map((i) => ({ id: str(i.id) ?? '', label: str(i.text) ?? '' })),
      chips: right.map((i) => ({ id: str(i.id) ?? '', text: str(i.text) ?? '' })),
      manyPerTarget: false,
    }
  }

  if (kind === 'build') {
    return {
      kind,
      instruction: game.instruction,
      targets: items
        .filter((i) => i.type === 'slot')
        .map((i) => ({ id: str(i.id) ?? '', label: str(i.label) ?? '' })),
      chips: (studentId ? shuffleForStudent(items, studentId) : items)
        .filter((i) => i.type === 'piece')
        .map((i) => ({ id: str(i.id) ?? '', text: str(i.text) ?? '' })),
      manyPerTarget: false,
    }
  }

  if (kind === 'sort') {
    return {
      kind,
      instruction: game.instruction,
      targets: items
        .filter((i) => i.type === 'category')
        .map((i) => ({
          id: str(i.id) ?? '',
          label: str(i.label) ?? '',
          note: str(i.rule) ?? undefined,
        })),
      chips: items
        .filter((i) => i.type !== 'category')
        .map((i) => ({
          id: str(i.id) ?? '',
          text: str(i.suffix) ?? str(i.text) ?? '',
          note: str(i.example) ?? undefined,
        })),
      manyPerTarget: true,
    }
  }

  if (kind === 'order') {
    return {
      kind,
      instruction: game.instruction,
      targets: [],
      chips: items.map((i) => ({ id: str(i.id) ?? '', text: str(i.text) ?? '' })),
      manyPerTarget: false,
    }
  }

  return null
}

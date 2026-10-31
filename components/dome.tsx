import type { ReactNode } from 'react'
import {
  DomeAvatar as DomeAvatarUI,
  DomeSays,
  type DomeMood,
} from '@/components/ui'

/**
 * "โดม" เลขาส่วนตัวมอนสเตอร์สีม่วงของทีม
 *
 * ภาพตัวละครอยู่ที่ `public/dome/mascot/dome-{greet,cheer,happy}.webp`
 * ไฟล์นี้เหลือหน้าที่แค่รักษา API เดิม (`DomeAvatar` / `DomeBubble`) ให้หน้าที่เรียกอยู่แล้วไม่พัง
 * โค้ดใหม่ควรเรียก `DomeSays` / `SpeechBubble` จาก `@/components/ui` ตรง ๆ
 * เพราะเลือกอารมณ์ของโดมได้ และผูกกล่องคำพูดกับรูปให้เอง
 */

export type { DomeMood }

export function DomeAvatar({
  size = 64,
  mood = 'greet',
  decorative = false,
}: {
  size?: number
  mood?: DomeMood
  decorative?: boolean
}) {
  return <DomeAvatarUI size={size} mood={mood} decorative={decorative} />
}

/** กล่องคำพูดของโดม ใช้ซ้ำได้ทุกหน้า */
export function DomeBubble({
  children,
  compact = false,
  mood = 'greet',
  live = false,
}: {
  children: ReactNode
  compact?: boolean
  mood?: DomeMood
  live?: boolean
}) {
  return (
    <DomeSays mood={mood} avatarSize={compact ? 56 : 80} live={live}>
      {children}
    </DomeSays>
  )
}

import { z } from 'zod'
// ใช้ไฟล์เนื้อหาจริง m1-m4 อย่างเดียว (ไฟล์ตัวอย่างชั่วคราวถูกลบทิ้งแล้ว)
import missionsJson from '../content/missions.json' with { type: 'json' }

/**
 * สัญญาโครงสร้างของ content/missions.json — ห้ามแก้รูปแบบเอง ต้องตรงกับที่ตกลงกันไว้
 *
 * ไฟล์นี้ "ไม่มีเฉลย" จึงส่งให้เบราว์เซอร์ได้
 * เฉลยอยู่ที่ content/missions-answers.json อ่านได้เฉพาะใน app/api/mission/[id]/check/route.ts
 */
const ClipChannelSchema = z.object({
  title: z.string().min(1),
  durationSec: z.number().int().positive(),
  script: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1),
})

const CardChannelSchema = z.object({
  title: z.string().min(1),
  cards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(1),
})

export const GAME_KINDS = ['sort', 'match', 'build', 'check', 'order'] as const

const GameChannelSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(GAME_KINDS),
  instruction: z.string().min(1),
  items: z.array(z.unknown()).min(1),
})

const BuddyChannelSchema = z.object({
  title: z.string().min(1),
  roleA: z.string().min(1),
  roleB: z.string().min(1),
  talkPrompts: z.array(z.string().min(1)).min(1),
})

const MissionSchema = z.object({
  id: z.string().min(1),
  objective: z.string().min(1),
  title: z.string().min(1),
  minutes: z.number().int().positive(),
  intro: z.string().min(1),
  channels: z.object({
    clip: ClipChannelSchema,
    card: CardChannelSchema,
    game: GameChannelSchema,
    buddy: BuddyChannelSchema,
  }),
  check: z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    /** 4 ตัวเลือกพอดี ไม่มี answerIndex ในไฟล์นี้โดยตั้งใจ */
    choices: z.array(z.string().min(1)).length(4),
  }),
  hints: z.array(z.string().min(1)).min(1),
  stuckMessage: z.string().min(1),
})

const MissionsFileSchema = z.object({ missions: z.array(MissionSchema).min(1) })

export type Mission = z.infer<typeof MissionSchema>
export type MissionCheck = Mission['check']
export type ChannelId = keyof Mission['channels']

export const missions: Mission[] = MissionsFileSchema.parse(missionsJson).missions

export function findMission(id: string): Mission | undefined {
  return missions.find((m) => m.id === id)
}

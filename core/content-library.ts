/**
 * คลังเนื้อหาตามสเปกหัวข้อ 11 — ส่วนที่เปิดเผยได้
 *
 * ไฟล์นี้โหลดเฉพาะเนื้อหาที่ส่งไปเบราว์เซอร์ได้ ไม่มีเฉลยแม้แต่ข้อเดียว
 * เฉลยของภารกิจเสริมและโจทย์ภารกิจอยู่ที่ core/content-library-answers.ts ซึ่งกันไม่ให้ import จากเบราว์เซอร์
 *
 * ครอบคลุม
 * - 11.3 โจทย์ภารกิจ 2 ระดับ บทคลิปแบบตารางฉาก และการ์ดพี่เลี้ยง  → content/mission-tasks.json
 * - 11.5 คำสำคัญสำรองรายจุดประสงค์ ใช้ตอน AI ใช้ไม่ได้            → content/rubric.json
 * - 11.7 ภารกิจเสริม X1 X2 X3                                    → content/bonus-missions.json
 * - 11.12 คำถามโค้ชตามความเข้าใจผิด และบทสอนเสริม 3 นาที           → content/coach-prompts.json
 * - 11.13 รายชื่อที่สงวนไว้                                       → content/reserved-names.json
 *
 * ทุกไฟล์ถูกตรวจด้วย schema ตอนโหลด ถ้าทีมเนื้อหาแก้ผิดรูปแบบ แอปจะพังตั้งแต่เริ่ม
 * พร้อมข้อความบอกว่าผิดตรงไหน ดีกว่าพังกลางคาบเรียน
 */
import { z } from 'zod'
import bonusMissionsJson from '../content/bonus-missions.json' with { type: 'json' }
import coachPromptsJson from '../content/coach-prompts.json' with { type: 'json' }
import missionTasksJson from '../content/mission-tasks.json' with { type: 'json' }
import reservedNamesJson from '../content/reserved-names.json' with { type: 'json' }
import rubricJson from '../content/rubric.json' with { type: 'json' }

/* ------------------------------------------------------------------ *
 * 11.3 โจทย์ภารกิจ
 * ------------------------------------------------------------------ */

/** ระดับความยากของโจทย์ ใช้กับ E-03 ที่จัดความยากตามผลเช็กความเข้าใจ */
export const TASK_LEVELS = ['basic', 'challenge'] as const
export type TaskLevel = (typeof TASK_LEVELS)[number]

const ClipSceneSchema = z.object({
  n: z.number().int().positive(),
  visual: z.string().min(1),
  voice: z.string().min(1),
})

const MentorCardSchema = z.object({
  id: z.string().min(1),
  /** สเปกหัวข้อ 11.3 เขียนการ์ดพี่เลี้ยงไว้ 3 ข้อทุกภารกิจ */
  tips: z.array(z.string().min(1)).length(3),
})

/**
 * ข้อสำรอง ใช้เมื่อผู้เรียนตอบยังไม่ถูกหลายครั้งในข้อหลัก
 * choices ว่างได้ เพราะบางข้อสเปกบอกว่า "เลือกหนึ่งข้อจาก 3 ตัวเลือก" แต่ไม่ได้เขียนตัวเลือกไว้
 * ข้อแบบนั้นถือว่ายังใช้ไม่ได้ ดู altItemReady() ข้างล่าง
 */
const AltItemSchema = z.object({
  id: z.string().min(1),
  format: z.string().min(1),
  instruction: z.string().min(1),
  choices: z.array(z.string().min(1)).optional(),
  cards: z.array(z.string().min(1)).optional(),
  labels: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).optional(),
  target: z.string().optional(),
  slots: z.array(z.string()).optional(),
  _incompleteNote: z.string().optional(),
})

const MissionTaskSchema = z.object({
  id: z.string().min(1),
  level: z.enum(TASK_LEVELS),
  format: z.string().min(1),
  instruction: z.string().optional(),
  instructionWhenNotRegistered: z.string().optional(),
  instructionWhenRegistered: z.string().optional(),
  chooseCount: z.number().int().positive().optional(),
  choices: z.array(z.string().min(1)).optional(),
  passRule: z.string().optional(),
  /** สเปกให้คำใบ้ 2 ขั้นทุกข้อ ยกเว้นข้อเขียนของ M1 ที่ให้คำใบ้ตามประเด็นที่ขาด 3 ข้อ */
  hints: z.array(z.string().min(1)).min(2),
  altItem: AltItemSchema.nullable().optional(),
})

const MissionTaskGroupSchema = z.object({
  id: z.string().min(1),
  objectiveId: z.string().min(1),
  specRef: z.string().min(1),
  title: z.string().min(1),
  clip: z.object({
    approxSeconds: z.number().int().positive(),
    scenes: z.array(ClipSceneSchema).min(1),
  }),
  mentorCard: MentorCardSchema,
  tasks: z.array(MissionTaskSchema).min(1),
})

export type ClipScene = z.infer<typeof ClipSceneSchema>
export type MentorCard = z.infer<typeof MentorCardSchema>
export type AltItem = z.infer<typeof AltItemSchema>
export type MissionTask = z.infer<typeof MissionTaskSchema>
export type MissionTaskGroup = z.infer<typeof MissionTaskGroupSchema>

export const missionTaskGroups: MissionTaskGroup[] = z
  .array(MissionTaskGroupSchema)
  .min(1)
  .parse(missionTasksJson.missions)

/** โจทย์ทั้งหมดเรียงตามภารกิจ */
export const missionTasks: MissionTask[] = missionTaskGroups.flatMap((m) => m.tasks)

export function tasksForMission(missionId: string, level?: TaskLevel): MissionTask[] {
  const group = missionTaskGroups.find((m) => m.id === missionId)
  if (!group) return []
  return level ? group.tasks.filter((t) => t.level === level) : group.tasks
}

export function findMissionTask(taskId: string): MissionTask | undefined {
  return missionTasks.find((t) => t.id === taskId)
}

export function clipScenes(missionId: string): ClipScene[] {
  return missionTaskGroups.find((m) => m.id === missionId)?.clip.scenes ?? []
}

export function mentorCard(missionId: string): MentorCard | undefined {
  return missionTaskGroups.find((m) => m.id === missionId)?.mentorCard
}

/**
 * ข้อสำรองข้อนี้เอาไปแสดงได้จริงหรือยัง
 *
 * สเปกบางข้อเขียนแค่ว่า "เลือกหนึ่งข้อจาก 3 ตัวเลือก" โดยไม่ได้เขียนตัวเลือกไว้
 * ถ้าปล่อยให้หน้าจอหยิบไปใช้ ผู้เรียนจะเจอข้อที่ไม่มีตัวเลือกให้เลือก
 * จึงต้องเช็กก่อนทุกครั้ง แล้วถอยไปใช้ทางอื่น เช่น แสดงเฉลยพร้อมคำอธิบายแทน
 */
export function altItemReady(task: MissionTask): boolean {
  const alt = task.altItem
  if (!alt) return false
  if (alt._incompleteNote) return false
  const hasChoices = (alt.choices?.length ?? 0) > 0
  const hasCards = (alt.cards?.length ?? 0) > 0
  const hasLabels = (alt.labels?.length ?? 0) > 0
  return hasChoices || hasCards || hasLabels
}

/** ข้อสำรองที่ยังเขียนไม่เสร็จ ใช้เตือนทีมเนื้อหาและใช้ในเทสต์ */
/**
 * @wired-optional เครื่องมือตรวจความครบของไฟล์เนื้อหา ไม่ได้อยู่บนเส้นทางที่ผู้เรียนเดิน
 *   เส้นทางจริงเรียก altItemReady() ทีละข้ออยู่แล้ว ตัวนี้ตอบคำถามทีมเนื้อหาว่า "เหลือข้อไหนยังไม่เสร็จ"
 */
export function incompleteAltItemIds(): string[] {
  return missionTasks.filter((t) => t.altItem && !altItemReady(t)).map((t) => t.altItem!.id)
}

/* ------------------------------------------------------------------ *
 * 11.7 ภารกิจเสริม
 * ------------------------------------------------------------------ */

const BonusItemSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  question: z.string().min(1),
  chooseCount: z.number().int().positive().optional(),
  choices: z.array(z.string().min(1)).optional(),
  groups: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) }).passthrough()).optional(),
  cards: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).optional(),
  misspellRules: z
    .array(z.object({ id: z.string().min(1), find: z.string(), replace: z.string(), note: z.string().min(1) }))
    .optional(),
  example: z.string().optional(),
  tldSuffix: z.string().optional(),
  checkedBy: z.string().optional(),
  generatedChoiceNote: z.string().optional(),
  noAnswerKeyNote: z.string().optional(),
})

const BonusMissionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  specRef: z.string().min(1),
  objectiveId: z.string().min(1),
  objectiveNote: z.string().min(1),
  /** สเปกหัวข้อ 11.7 ให้ภารกิจเสริมละ 2 ข้อทุกภารกิจ */
  items: z.array(BonusItemSchema).length(2),
})

export type BonusItem = z.infer<typeof BonusItemSchema>
export type BonusMission = z.infer<typeof BonusMissionSchema>

export const bonusMissions: BonusMission[] = z
  .array(BonusMissionSchema)
  .min(1)
  .parse(bonusMissionsJson.missions)

/** ภารกิจเสริมไม่นับดาว ตามสเปกหัวข้อ 11.7 อ่านค่าจากไฟล์ ไม่ตรึงไว้ในโค้ด */
export const BONUS_COUNTS_STARS: boolean = z.boolean().parse(bonusMissionsJson.meta.countsStars)

export function findBonusMission(id: string): BonusMission | undefined {
  return bonusMissions.find((m) => m.id === id)
}

/* ------------------------------------------------------------------ *
 * 11.12 คำถามโค้ชตามความเข้าใจผิด และบทสอนเสริม 3 นาที
 * ------------------------------------------------------------------ */

const MisconceptionSchema = z.object({
  id: z.string().min(1),
  objectiveId: z.string().min(1),
  misconception: z.string().min(1),
  coachQuestion: z.string().min(1),
})

const MiniLessonSchema = z.object({
  id: z.string().min(1),
  objectiveId: z.string().min(1),
  missionId: z.string().min(1),
  usedBy: z.string().min(1),
  /** บทสอนเสริมยาว 3 นาที นาทีละ 1 กิจกรรม ตามตารางในสเปกหัวข้อ 11.12 */
  minutes: z.array(z.string().min(1)).length(3),
})

export type Misconception = z.infer<typeof MisconceptionSchema>
export type MiniLesson = z.infer<typeof MiniLessonSchema>

export const misconceptions: Misconception[] = z
  .array(MisconceptionSchema)
  .min(1)
  .parse(coachPromptsJson.misconceptions)

export const miniLessons: MiniLesson[] = z
  .array(MiniLessonSchema)
  .min(1)
  .parse(coachPromptsJson.miniLessons)

export function misconceptionsForObjective(objectiveId: string): Misconception[] {
  return misconceptions.filter((m) => m.objectiveId === objectiveId)
}

export function miniLessonForObjective(objectiveId: string): MiniLesson | undefined {
  return miniLessons.find((m) => m.objectiveId === objectiveId)
}

/* ------------------------------------------------------------------ *
 * 11.5 คำสำคัญสำรองรายจุดประสงค์
 * ------------------------------------------------------------------ */

const ObjectiveKeywordsSchema = z.object({
  id: z.string().min(1),
  objectiveId: z.string().min(1),
  specTopic: z.string().min(1),
  specId: z.string().min(1),
  countsWhen: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
})

export type ObjectiveKeywords = z.infer<typeof ObjectiveKeywordsSchema>

export const objectiveKeywords: ObjectiveKeywords[] = z
  .array(ObjectiveKeywordsSchema)
  .min(1)
  .parse(rubricJson.objectiveKeywords)

/**
 * ผู้เรียนพูดถึงจุดประสงค์ข้อไหนบ้าง ตรวจด้วยคำสำคัญล้วน ๆ
 * ใช้เป็นตัวสำรองเมื่อ AI ใช้ไม่ได้ ไม่ใช่ตัวตัดสินคะแนนรูบริก
 * เทียบแบบไม่สนตัวพิมพ์ใหญ่เล็ก เพราะคำสำคัญมีทั้งไทยและอังกฤษปนกัน
 */
export function objectivesMentioned(text: string): string[] {
  const hay = (text ?? '').toLowerCase()
  if (hay.trim().length === 0) return []
  return objectiveKeywords
    .filter((o) => o.keywords.some((k) => hay.includes(k.toLowerCase())))
    .map((o) => o.objectiveId)
}

/* ------------------------------------------------------------------ *
 * 11.13 รายชื่อที่สงวนไว้
 * ------------------------------------------------------------------ */

/**
 * exact เทียบตรงทั้งคำเท่านั้น เพราะชื่อสุจริตอย่าง bankhanomyai มีคำว่า bank อยู่ข้างใน
 * contains เทียบแบบมีอยู่ในชื่อ ใช้กับกลุ่มคำไม่เหมาะสมตามสเปกหัวข้อ 11.13
 */
export const RESERVED_MATCH_MODES = ['exact', 'contains'] as const
export type ReservedMatchMode = (typeof RESERVED_MATCH_MODES)[number]

const ReservedGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  matchMode: z.enum(RESERVED_MATCH_MODES),
  message: z.string().min(1),
  needsTeacherReview: z.boolean(),
  targetCount: z.number().int().positive().optional(),
  note: z.string().optional(),
  items: z.array(z.string().min(1)),
})

export type ReservedGroup = z.infer<typeof ReservedGroupSchema>

export const reservedGroups: ReservedGroup[] = z
  .array(ReservedGroupSchema)
  .min(1)
  .parse(reservedNamesJson.groups)

export interface ReservedNameCheck {
  /** ใช้ชื่อนี้ได้ไหม */
  reserved: boolean
  groupId: string | null
  /** ข้อความที่แสดงให้ผู้เรียน มาจากไฟล์เนื้อหา ไม่ได้เขียนในโค้ด */
  message: string | null
  /** คำที่ชนเข้า ใช้บอกครูว่าชนคำไหน ไม่ต้องแสดงให้ผู้เรียน */
  matchedTerm: string | null
  needsTeacherReview: boolean
}

const OK: ReservedNameCheck = {
  reserved: false,
  groupId: null,
  message: null,
  matchedTerm: null,
  needsTeacherReview: false,
}

/**
 * ชื่อนี้ชนรายชื่อที่สงวนไว้ไหม
 *
 * ตรวจตามลำดับกลุ่มในไฟล์ กลุ่มแรกที่ชนเป็นผู้ชนะ เพื่อให้ผลเดิมทุกครั้ง
 * ไม่ตัดขีดหรืออักขระอื่นทิ้งก่อนเทียบ เพราะชื่อโดเมนใช้ขีดได้จริง และการตัดทิ้งจะทำให้
 * ชื่อสุจริตชนคำสงวนโดยไม่ตั้งใจ (เคสเดียวกับที่เจอใน core/content-filter.ts)
 */
export function checkReservedName(rawName: string): ReservedNameCheck {
  const name = (rawName ?? '').trim().toLowerCase()
  if (name.length === 0) return OK
  for (const group of reservedGroups) {
    for (const item of group.items) {
      const term = item.trim().toLowerCase()
      if (term.length === 0) continue
      const hit = group.matchMode === 'exact' ? name === term : name.includes(term)
      if (hit) {
        return {
          reserved: true,
          groupId: group.id,
          message: group.message,
          matchedTerm: term,
          needsTeacherReview: group.needsTeacherReview,
        }
      }
    }
  }
  return OK
}

export interface ReservedListGap {
  groupId: string
  label: string
  have: number
  want: number | null
  note: string
}

/**
 * กลุ่มไหนยังมีรายการไม่ครบ
 *
 * มีไว้เพราะกลุ่มคำไม่เหมาะสมตั้งใจเว้นว่างให้ครูเติมเอง ถ้าไม่มีตัวบอก
 * ฝั่งหน้าเว็บจะเข้าใจว่า "ตรวจแล้วไม่เจอ" ทั้งที่จริงคือ "ยังไม่มีอะไรให้ตรวจ"
 * การกรองคำไม่เหมาะสมตัวจริงอยู่ที่ core/content-filter.ts ซึ่งมีรายการของตัวเอง
 */
export function reservedListGaps(): ReservedListGap[] {
  const gaps: ReservedListGap[] = []
  for (const group of reservedGroups) {
    const want = group.targetCount ?? null
    if (group.items.length === 0) {
      gaps.push({
        groupId: group.id,
        label: group.label,
        have: 0,
        want,
        note: 'ยังไม่มีรายการเลย การตรวจกลุ่มนี้จึงผ่านทุกชื่อ ห้ามเข้าใจว่ากรองทำงานแล้ว',
      })
    } else if (want !== null && group.items.length < want) {
      gaps.push({
        groupId: group.id,
        label: group.label,
        have: group.items.length,
        want,
        note: 'ยังไม่ครบตามจำนวนที่สเปกขอ',
      })
    }
  }
  return gaps
}

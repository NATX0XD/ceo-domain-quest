import { z } from 'zod'
import { getServiceClient } from '@/lib/db/client'

export const MISSION_SETTING_IDS = ['m1', 'm2', 'm3', 'm4', 'ceo'] as const
export type MissionSettingId = (typeof MISSION_SETTING_IDS)[number]

const modes = z.object({ watch: z.boolean(), read: z.boolean(), do: z.boolean() }).refine(
  (value) => value.watch || value.read || value.do,
  { message: 'ต้องเปิดอย่างน้อยหนึ่งโหมด' },
)
const submitModes = z.object({ write: z.boolean(), voice: z.boolean(), design: z.boolean() }).refine(
  (value) => value.write || value.voice || value.design,
  { message: 'ต้องเปิดอย่างน้อยหนึ่งรูปแบบ' },
)

export const DEFAULTS = {
  m1: { passScore: 60, modesEnabled: { watch: true, read: true, do: true }, aiFeedback: true },
  m2: { textAttempts: 4, exitQuestions: 3, passScore: 60, simStages: 4, aiFeedback: true },
  m3: {
    practiceEnabled: true,
    realCustomers: 2,
    customerSeconds: 180,
    extendSeconds: 60,
    handbookSeconds: 15,
    customerQuestions: 3,
    domeQuota: null,
    hints: 2,
    tagPass: 80,
    stampPass: 60,
  },
  m4: {
    timerSeconds: 270,
    startCoins: 4000,
    explainPass: 7,
    eventsPass: 3,
    tutorialEnabled: true,
  },
  ceo: { aiGrading: true, revisions: 3, submitModes: { write: true, voice: true, design: true } },
} as const

export const MISSION_SETTINGS_SCHEMAS = {
  m1: z.object({
    passScore: z.number().int().min(50).max(100),
    modesEnabled: modes,
    aiFeedback: z.boolean(),
  }),
  m2: z.object({
    textAttempts: z.number().int().min(1).max(6),
    exitQuestions: z.number().int().min(1).max(3),
    passScore: z.number().int().min(50).max(100),
    simStages: z.number().int().min(1).max(4),
    aiFeedback: z.boolean(),
  }),
  m3: z.object({
    practiceEnabled: z.boolean(),
    realCustomers: z.number().int().min(1).max(6),
    customerSeconds: z.number().int().min(60).max(600),
    extendSeconds: z.number().int().min(0).max(180),
    handbookSeconds: z.number().int().min(5).max(120),
    customerQuestions: z.number().int().min(0).max(6),
    domeQuota: z.number().int().min(0).max(20).nullable(),
    hints: z.number().int().min(0).max(5),
    tagPass: z.number().int().min(50).max(100),
    stampPass: z.number().int().min(50).max(100),
  }),
  m4: z.object({
    timerSeconds: z.number().int().min(120).max(900),
    startCoins: z.number().int().min(1000).max(20000),
    explainPass: z.number().int().min(5).max(10),
    eventsPass: z.number().int().min(2).max(4),
    tutorialEnabled: z.boolean(),
  }),
  ceo: z.object({
    aiGrading: z.boolean(),
    revisions: z.number().int().min(0).max(5),
    submitModes,
  }),
} as const

export type MissionSettings = {
  [K in MissionSettingId]: z.infer<(typeof MISSION_SETTINGS_SCHEMAS)[K]>
}

export const MISSION_META = {
  m1: { label: 'ด่าน 1 · รู้จักชื่อโดเมน', help: 'กำหนดรูปแบบการเรียนและเกณฑ์ผ่านของด่านแรก' },
  m2: { label: 'ด่าน 2 · เลือกนามสกุล', help: 'ตั้งจำนวนครั้งฝึกและด่านจำลองที่ผู้เรียนต้องผ่าน' },
  m3: { label: 'ด่าน 3 · เจ้าหน้าที่จดทะเบียน', help: 'ปรับจำนวนลูกค้า เวลา และเกณฑ์การทำงานหน้าร้าน' },
  m4: { label: 'ด่าน 4 · ค้นหาชื่อที่ใช่', help: 'กำหนดเวลา เหรียญเริ่มต้น และเกณฑ์อธิบายเหตุผล' },
  ceo: { label: 'CEO · เสนอแผนธุรกิจ', help: 'ตั้งค่ารูปแบบส่งงานและรอบแก้ไขของภารกิจใหญ่' },
} as const

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback
  return Math.min(max, Math.max(min, number))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function boolBag(value: unknown, fallback: { watch: boolean; read: boolean; do: boolean }) {
  const bag = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const result = { watch: bool(bag.watch, fallback.watch), read: bool(bag.read, fallback.read), do: bool(bag.do, fallback.do) }
  if (!result.watch && !result.read && !result.do) result.watch = true
  return result
}

function submitBag(value: unknown, fallback: { write: boolean; voice: boolean; design: boolean }) {
  const bag = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const result = { write: bool(bag.write, fallback.write), voice: bool(bag.voice, fallback.voice), design: bool(bag.design, fallback.design) }
  if (!result.write && !result.voice && !result.design) result.write = true
  return result
}

export function clampMissionSettings<M extends MissionSettingId>(missionId: M, input: unknown): MissionSettings[M] {
  const base = DEFAULTS[missionId] as Record<string, unknown>
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
  const merged: Record<string, unknown> = { ...base, ...value }
  if (missionId === 'm1') {
    merged.passScore = clampNumber(merged.passScore, 60, 50, 100)
    merged.modesEnabled = boolBag(value.modesEnabled, DEFAULTS.m1.modesEnabled)
    merged.aiFeedback = bool(merged.aiFeedback, true)
  } else if (missionId === 'm2') {
    merged.textAttempts = clampNumber(merged.textAttempts, 4, 1, 6)
    merged.exitQuestions = clampNumber(merged.exitQuestions, 3, 1, 3)
    merged.passScore = clampNumber(merged.passScore, 60, 50, 100)
    merged.simStages = clampNumber(merged.simStages, 4, 1, 4)
    merged.aiFeedback = bool(merged.aiFeedback, true)
  } else if (missionId === 'm3') {
    for (const [key, fallback, min, max] of [
      ['realCustomers', 2, 1, 6], ['customerSeconds', 180, 60, 600], ['extendSeconds', 60, 0, 180],
      ['handbookSeconds', 15, 5, 120], ['customerQuestions', 3, 0, 6], ['hints', 2, 0, 5],
      ['tagPass', 80, 50, 100], ['stampPass', 60, 50, 100],
    ] as const) merged[key] = clampNumber(merged[key], fallback, min, max)
    merged.practiceEnabled = bool(merged.practiceEnabled, true)
    merged.domeQuota = merged.domeQuota === null ? null : clampNumber(merged.domeQuota, 0, 0, 20)
  } else if (missionId === 'm4') {
    merged.timerSeconds = clampNumber(merged.timerSeconds, 270, 120, 900)
    merged.startCoins = clampNumber(merged.startCoins, 4000, 1000, 20000)
    merged.explainPass = clampNumber(merged.explainPass, 7, 5, 10)
    merged.eventsPass = clampNumber(merged.eventsPass, 3, 2, 4)
    merged.tutorialEnabled = bool(merged.tutorialEnabled, true)
  } else {
    merged.aiGrading = bool(merged.aiGrading, true)
    merged.revisions = clampNumber(merged.revisions, 3, 0, 5)
    merged.submitModes = submitBag(value.submitModes, DEFAULTS.ceo.submitModes)
  }
  return MISSION_SETTINGS_SCHEMAS[missionId].parse(merged) as MissionSettings[M]
}

export async function getMissionSettings<M extends MissionSettingId>(classroomId: string, missionId: M): Promise<MissionSettings[M]> {
  try {
    const { data, error } = await getServiceClient()
      .from('classroom_mission_settings')
      .select('settings')
      .eq('classroom_id', classroomId)
      .eq('mission_id', missionId)
      .maybeSingle()
    if (error) {
      if (/does not exist|relation/i.test(error.message)) return clampMissionSettings(missionId, {})
      throw error
    }
    return clampMissionSettings(missionId, data?.settings ?? {})
  } catch (error) {
    if (error instanceof Error && /does not exist|relation|missing/i.test(error.message)) {
      return clampMissionSettings(missionId, {})
    }
    throw error
  }
}

export async function snapshotMissionSettings(classroomId: string) {
  const entries = await Promise.all(MISSION_SETTING_IDS.map(async (missionId) => [
    missionId,
    {
      ...MISSION_META[missionId],
      defaults: DEFAULTS[missionId],
      settings: await getMissionSettings(classroomId, missionId),
    },
  ] as const))
  return Object.fromEntries(entries) as Record<MissionSettingId, {
    label: string
    help: string
    defaults: MissionSettings[MissionSettingId]
    settings: MissionSettings[MissionSettingId]
  }>
}

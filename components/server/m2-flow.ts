import { z } from 'zod'
import type { MissionId } from '@/lib/db/repo'
import { getStudent, logEvent } from '@/lib/db/repo'
import { loadMissionRow, recordMissionAnswer, setMissionStarsDb } from '@/components/server/game-state'
import { ai } from '@/components/server/ai'
import { findLearnPath, scoreOpenAnswers } from '@/components/server/learn-path'
import { DEFAULTS, getMissionSettings, type MissionSettings } from '@/lib/mission-settings'

const StopSchema = z.object({
  kind: z.literal('stop'),
  stop: z.number().int().min(0).max(2),
  answer: z.string().min(1).max(80),
  attempt: z.number().int().min(1).max(3),
})

const PostSchema = z.object({
  kind: z.literal('post'),
  q: z.number().int().min(0).max(0),
  answer: z.string().min(1).max(40),
})

const DragSchema = z.object({
  kind: z.literal('visual-drag'),
  placements: z.record(z.string(), z.string()),
})

const TextSchema = z.object({
  kind: z.literal('text'),
  mode: z.enum(['watch', 'read']).default('read'),
  questionId: z.string().min(1).max(40),
  answer: z.string().max(1000),
  attempt: z.number().int().min(1).max(6),
})

const SimSchema = z.object({
  kind: z.literal('sim'),
  stage: z.number().int().min(0).max(4),
  placements: z.record(z.string(), z.string()).optional(),
  order: z.array(z.string()).optional(),
})

const ExitSchema = z.object({
  kind: z.literal('exit'),
  answers: z.array(z.number().int().min(0).max(2)).min(1).max(3),
  stageScore: z.number().min(0).max(70),
  repair: z.boolean().optional().default(false),
})

const NotebookSchema = z.object({ kind: z.literal('notebook'), text: z.string().min(1).max(1200) })

export const M2ExitQuestions = [
  { id: 'm2-exit-1', prompt: 'ใน news.islandtimes.org ส่วนใดคือชื่อเว็บ (SLD)?', choices: ['news', 'islandtimes', 'org'] },
  { id: 'm2-exit-2', prompt: 'ใน shop.kanombanyai.com คอมพิวเตอร์อ่านชื่อเว็บนี้จากทางไหน?', choices: ['ซ้ายไปขวา', 'ขวาไปซ้าย', 'เริ่มตรงกลาง'] },
  { id: 'm2-exit-3', prompt: 'ใน booking.kanombanyai.com ส่วนใดคือบริการย่อย (Subdomain)?', choices: ['booking', 'kanombanyai', 'com'] },
] as const
const EXIT_ANSWERS = [1, 1, 0] as const

// stop 1: pick the right-most piece · stop 2: drag the three cards into order · stop 3: pick the booking name
const STOP_ANSWERS = ['tld', 'shop.kanombanyai.com', 'subdomain'] as const
const STOP_HINTS = [
  'ลองดูชื่อเว็บจากขวาสุด ส่วนที่บอกกลุ่มใหญ่ของเว็บอยู่ตรงนั้น',
  'ห้องย่อย shop อยู่ซ้ายสุด ชื่อร้านอยู่ตรงกลาง และกลุ่มใหญ่ com อยู่ขวาสุดนะ',
  'หน้าจองเค้กเป็นบริการย่อย ต้องเปลี่ยนแค่ส่วนซ้ายสุดเป็น booking ส่วนชื่อร้านกับ com เหมือนเดิม',
] as const
const STOP_EXPLANATIONS = [
  'ส่วนขวาสุดคือ TLD เช่น .com เป็นกลุ่มใหญ่ของชื่อเว็บ',
  'เรียงเป็น shop.kanombanyai.com เพราะคอมพิวเตอร์อ่านจากขวาไปซ้าย เริ่มจาก com แล้วค่อยหา kanombanyai และ shop',
  'booking.kanombanyai.com ถูกต้อง เพราะ booking อยู่ซ้ายสุดเป็น Subdomain ที่แยกบริการย่อยของร้าน',
] as const

export type M2StepResult =
  | { kind: 'stop'; correct: boolean; phase: 'hint' | 'rewatch' | 'explain'; hint?: string; from?: number; to?: number; explanation?: string }
  | { kind: 'drag'; passed: boolean; score: number; wrong: string[]; feedback: string }
  | { kind: 'text'; correct: boolean; score: number; feedback: string; hint?: string; reveal?: string; reason?: string; source: string }
  | { kind: 'sim'; correct: boolean; reason?: string; wrong?: string[] }
  | { kind: 'post'; correct: boolean; explanation: string }
  | { kind: 'notebook'; saved: true }
  | { kind: 'exit'; score: number; exitScore: number; grade: 'A' | 'B' | 'C'; passed: boolean; stars: number }

function stopResult(input: z.infer<typeof StopSchema>): Extract<M2StepResult, { kind: 'stop' }> {
  const correct = input.answer === STOP_ANSWERS[input.stop]
  if (correct) {
    return { kind: 'stop', correct: true, phase: 'explain', explanation: STOP_EXPLANATIONS[input.stop] }
  }
  if (input.attempt === 1) return { kind: 'stop', correct: false, phase: 'hint', hint: STOP_HINTS[input.stop] }
  if (input.attempt === 2) {
    const ranges = [[2, 3], [4, 5], [6, 7]] as const
    const [from, to] = ranges[input.stop] ?? [1, 1]
    return { kind: 'stop', correct: false, phase: 'rewatch', from, to, hint: 'ย้อนดูช่วงสำคัญ แล้วกลับมาตอบข้อเดิมอีกครั้งนะ' }
  }
  return { kind: 'stop', correct: false, phase: 'explain', explanation: STOP_EXPLANATIONS[input.stop] }
}

async function textResult(studentId: string, input: z.infer<typeof TextSchema>, settings: MissionSettings['m2']): Promise<Extract<M2StepResult, { kind: 'text' }>> {
  const path = findLearnPath('m2')
  if (!path || (path[input.mode].questions as readonly { id: string }[]).every((q) => q.id !== input.questionId)) {
    throw new Error('m2 text question not found')
  }
  const result = await scoreOpenAnswers(path, input.mode, { [input.questionId]: input.answer }, {
    checker: settings.aiFeedback ? ai : null,
    studentId,
    passScore: settings.passScore,
  })
  const item = result.perQuestion.find((q) => q.id === input.questionId)
  if (!item) throw new Error('m2 text score missing')
  const correct = item.score > settings.passScore
  const reveals: Record<string, string> = {
    'm2-rq1': 'parts คือ Subdomain, forcespeed คือ SLD ชื่อหลัก และ .com คือ TLD ที่บอกกลุ่มใหญ่',
    'm2-rq2': 'เริ่มจาก .com ทางขวาสุด แล้วอ่านย้อนมาที่ชื่อหลักตรงกลาง ก่อนถึงบริการย่อยทางซ้าย',
    'm2-rq3': 'TLD อยู่ขวาสุด, SLD อยู่ตรงกลาง และ Subdomain อยู่ซ้ายสุดของชื่อเว็บ',
  }
  await logEvent(studentId, 'learn-answer', {
    missionId: 'm2', mode: input.mode, score: item.score, passed: correct,
    perQuestion: [{ id: item.id, score: item.score, source: item.source, keywordScore: item.keywordScore, aiScore: item.aiScore }],
    answers: { [input.questionId]: input.answer },
  })
  if (correct) return { kind: 'text', correct: true, score: item.score, feedback: item.feedback, source: item.source }
  if (input.attempt < settings.textAttempts) {
    const question = path[input.mode].questions.find((q) => q.id === input.questionId)
    return { kind: 'text', correct: false, score: item.score, feedback: item.feedback, hint: question?.hint ?? 'ลองย้อนอ่านบทเรียนช่วงนี้อีกครั้งนะ', source: item.source }
  }
  return { kind: 'text', correct: false, score: item.score, feedback: item.feedback, reveal: reveals[input.questionId] ?? 'กลับไปดูสรุปบทเรียน แล้วลองอธิบายใหม่อีกครั้ง', reason: item.feedback, source: item.source }
}

function simResult(input: z.infer<typeof SimSchema>): Extract<M2StepResult, { kind: 'sim' }> {
  const expected: Record<number, Array<Record<string, string> | string[]>> = {
    0: [{ slot1: 'parts' }],
    1: [{ slot1: 'parts', slot2: 'forcespeed', slot3: 'com' }, { slot1: 'shop', slot2: 'ployflower', slot3: 'com' }],
    2: [{ slot1: 'Subdomain', slot2: 'SLD', slot3: 'TLD' }],
    // Keep the original canonical values, and accept the teammate's storyboard labels too.
    3: [['com', 'forcespeed', 'parts'], ['com', 'ittimbeach', 'order']],
    4: [
      { slot1: 'kanombanyai', slot2: 'co', slot3: 'th', slot4: 'booking' },
      { slot1: 'menu', slot2: 'kafaethai', slot3: 'co', slot4: 'th' },
    ],
  }
  const expectedStage = expected[input.stage]
  const answer = expectedStage?.some((candidate) =>
    Array.isArray(candidate)
      ? JSON.stringify(input.order ?? []) === JSON.stringify(candidate)
      : Object.entries(candidate).every(([key, value]) => input.placements?.[key] === value),
  ) ?? false
  if (answer) return { kind: 'sim', correct: true }
  // closest map candidate → which slots are wrong (per-slot ✓/✗ on the board)
  const maps = (expectedStage ?? []).filter((c): c is Record<string, string> => !Array.isArray(c))
  const best = maps.sort((a, b) => score(b) - score(a))[0]
  function score(c: Record<string, string>) {
    return Object.entries(c).filter(([k, v]) => input.placements?.[k] === v).length
  }
  const wrong = best ? Object.keys(best).filter((k) => input.placements?.[k] !== best[k]) : undefined
  if (input.stage === 4 && Object.values(input.placements ?? {}).some((v) => v === 'www' || v === '.com' || v === 'com')) {
    return { kind: 'sim', correct: false, wrong, reason: 'ชิ้นนี้เป็นตัวหลอก: www คือโฮสต์ที่ไม่ใช่ชิ้นของโจทย์ และ .com ไม่ใช่ช่องของ .co.th' }
  }
  return { kind: 'sim', correct: false, wrong, reason: SIM_RETRY[input.stage] ?? SIM_RETRY[1] }
}

/** คำแนะนำเมื่อจัดผิดครั้งแรก แยกตามด่าน (ไม่บอกคำตอบ) */
const SIM_RETRY: Record<number, string> = {
  0: 'ลองดูป้ายกำกับใต้ช่องอีกครั้ง แล้ววางชิ้นที่ตรงกับป้ายนะ',
  1: 'ลองจัดใหม่โดยดูป้ายกำกับและลูกศรอ่านจากขวาไปซ้ายนะ',
  2: 'ลองนึกว่าชิ้นไหนบอกกลุ่มใหญ่ ชิ้นไหนเป็นชื่อหลัก และชิ้นไหนเป็นบริการย่อย แล้วติดป้ายใหม่นะ',
  3: 'คอมพิวเตอร์เริ่มอ่านจากชิ้นที่บอกกลุ่มใหญ่ก่อน ลองเรียงลำดับการอ่านใหม่นะ',
  4: 'ชื่อนี้มีนามสกุล 2 ชิ้น ลองดูว่าชิ้นไหนเป็นชื่อร้าน ชิ้นไหนเป็นบริการย่อย แล้ววางใหม่นะ',
}

async function exitResult(studentId: string, input: z.infer<typeof ExitSchema>, settings: MissionSettings['m2']): Promise<Extract<M2StepResult, { kind: 'exit' }>> {
  if (input.answers.length !== settings.exitQuestions) throw new Error('m2 exit question count mismatch')
  const correct = EXIT_ANSWERS.slice(0, settings.exitQuestions).filter((answer, i) => input.answers[i] === answer).length
  const exitScore = Math.round((correct / settings.exitQuestions) * 30)
  const score = Math.max(0, Math.min(100, Math.round(input.stageScore) + exitScore))
  // A zero-answer Exit Check is the storyboard's “almost there” ending even when
  // the learner completed the practice board. This keeps the repair drill reachable.
  const grade = correct === 0 ? 'C' : score >= 90 ? 'A' : score >= settings.passScore ? 'B' : 'C'
  const passed = grade !== 'C'
  const stars = grade === 'A' ? 3 : grade === 'B' ? 2 : 0
  await logEvent(studentId, 'learn-m2-exit', { missionId: 'm2', score, exitScore, grade, passed, answers: input.answers, repair: input.repair })
  // เล่นซ้ำหลังผ่านแล้ว = เก็บดาวที่ดีที่สุดไว้ รอบใหม่ที่ได้น้อยกว่าห้ามลดดาวเดิม
  const before = await loadMissionRow(studentId, 'm2' as MissionId)
  await recordMissionAnswer(studentId, 'm2' as MissionId, passed, 'game')
  const keptStars = before.passed ? Math.max(before.stars, stars) : stars
  if (!before.passed || keptStars !== before.stars) await setMissionStarsDb(studentId, 'm2' as MissionId, keptStars)
  if (passed) await logEvent(studentId, 'learn-done', { missionId: 'm2', mode: 'do', score })
  return { kind: 'exit', score, exitScore, grade, passed, stars }
}

async function settingsForStudent(studentId: string): Promise<MissionSettings['m2']> {
  const student = await getStudent(studentId)
  return student ? getMissionSettings(student.classroom_id, 'm2') : DEFAULTS.m2
}

export async function handleM2Step(studentId: string, payload: unknown, providedSettings?: MissionSettings['m2']): Promise<M2StepResult> {
  const parsed = z.discriminatedUnion('kind', [StopSchema, PostSchema, DragSchema, TextSchema, SimSchema, ExitSchema, NotebookSchema]).parse(payload)
  const settings = providedSettings ?? (await settingsForStudent(studentId))
  if (parsed.kind === 'stop') return stopResult(parsed)
  if (parsed.kind === 'post') {
    // post-clip question 1: kanombanyai.com vs kanombanyai.net — the TLD differs, so not the same site
    return {
      kind: 'post',
      correct: parsed.answer === 'different',
      explanation: '.com กับ .net เป็นคนละส่วนขวาสุด จึงเป็นคนละเว็บได้ ต้องดูให้ครบทุกส่วน',
    }
  }
  if (parsed.kind === 'text') return textResult(studentId, parsed, settings)
  if (parsed.kind === 'sim') {
    if (parsed.stage > settings.simStages) return { kind: 'sim', correct: false, reason: 'ด่านจำลองนี้ถูกปิดไว้ตามการตั้งค่าของครู' }
    return simResult(parsed)
  }
  if (parsed.kind === 'visual-drag') {
    const expected: Record<string, string> = { slot1: 'booking', slot2: 'kanombanyai', slot3: '.com' }
    const wrong = Object.keys(expected).filter((slot) => parsed.placements[slot] !== expected[slot])
    const score = Math.round(((3 - wrong.length) / 3) * 70)
    return { kind: 'drag', passed: wrong.length === 0, score, wrong, feedback: wrong.length === 0 ? 'ต่อชื่อเว็บครบแล้ว อ่านจากขวาไปซ้ายได้เลย' : 'มีชิ้นส่วนที่ยังไม่ตรง ลองดูป้าย Subdomain, SLD และ TLD อีกครั้ง' }
  }
  if (parsed.kind === 'notebook') {
    await logEvent(studentId, 'learn-m2-notebook', { missionId: 'm2', text: parsed.text })
    return { kind: 'notebook', saved: true }
  }
  return exitResult(studentId, parsed, settings)
}


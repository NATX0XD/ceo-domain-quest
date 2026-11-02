import { z } from 'zod'
import type { MissionId } from '@/lib/db/repo'
import { logEvent } from '@/lib/db/repo'
import { recordMissionAnswer, setMissionStarsDb } from '@/components/server/game-state'
import { ai } from '@/components/server/ai'
import { findLearnPath, scoreOpenAnswers } from '@/components/server/learn-path'

const StopSchema = z.object({
  kind: z.literal('stop'),
  stop: z.number().int().min(0).max(2),
  answer: z.string().min(1).max(80),
  attempt: z.number().int().min(1).max(3),
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
  attempt: z.number().int().min(1).max(4),
})

const SimSchema = z.object({
  kind: z.literal('sim'),
  stage: z.number().int().min(0).max(4),
  placements: z.record(z.string(), z.string()).optional(),
  order: z.array(z.string()).optional(),
})

const ExitSchema = z.object({
  kind: z.literal('exit'),
  answers: z.array(z.number().int().min(0).max(3)).length(3),
  stageScore: z.number().min(0).max(70),
  repair: z.boolean().optional().default(false),
})

const NotebookSchema = z.object({ kind: z.literal('notebook'), text: z.string().min(1).max(1200) })

export const M2ExitQuestions = [
  { id: 'm2-exit-1', prompt: 'ส่วนที่อยู่ขวาสุดของชื่อเว็บเรียกว่าอะไร', choices: ['Subdomain', 'SLD', 'TLD', 'URL ทั้งชุด'] },
  { id: 'm2-exit-2', prompt: 'ชื่อโดเมนควรไล่ลำดับความสำคัญจากทางไหน', choices: ['ซ้ายไปขวา', 'ขวาไปซ้าย', 'ตรงกลางออกสองข้าง', 'อ่านทางไหนก็ได้'] },
  { id: 'm2-exit-3', prompt: 'ใน booking.kanombanyai.com ส่วนใดเป็นบริการย่อย', choices: ['.com', 'kanombanyai', 'booking', 'ทั้งชื่อ'] },
] as const

const STOP_ANSWERS = ['tld', 'rtl', 'subdomain'] as const
const STOP_HINTS = [
  'ลองดูชื่อเว็บจากขวาสุด ส่วนที่บอกกลุ่มใหญ่ของเว็บอยู่ตรงนั้น',
  'ระบบโดเมนเหมือนจ่าหน้าซอง เริ่มจากพื้นที่ใหญ่ก่อน แล้วค่อยย้อนมาหาส่วนย่อย',
  'ส่วนซ้ายสุดใช้แยกบริการย่อย เช่น หน้าสั่งซื้อหรือหน้า booking',
] as const
const STOP_EXPLANATIONS = [
  'ส่วนขวาสุดคือ TLD เช่น .com เป็นกลุ่มใหญ่ของชื่อเว็บ',
  'ต้องอ่านจากขวาไปซ้าย เริ่มจาก TLD แล้วค่อยย้อนมาที่ SLD และ Subdomain',
  'booking อยู่ซ้ายสุด จึงเป็น Subdomain ที่ใช้แยกบริการย่อยของเว็บ',
] as const

export type M2StepResult =
  | { kind: 'stop'; correct: boolean; phase: 'hint' | 'rewatch' | 'explain'; hint?: string; from?: number; to?: number; explanation?: string }
  | { kind: 'drag'; passed: boolean; score: number; wrong: string[]; feedback: string }
  | { kind: 'text'; correct: boolean; score: number; feedback: string; hint?: string; reveal?: string; reason?: string; source: string }
  | { kind: 'sim'; correct: boolean; reason?: string }
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

async function textResult(studentId: string, input: z.infer<typeof TextSchema>): Promise<Extract<M2StepResult, { kind: 'text' }>> {
  const path = findLearnPath('m2')
  if (!path || (path[input.mode].questions as readonly { id: string }[]).every((q) => q.id !== input.questionId)) {
    throw new Error('m2 text question not found')
  }
  const result = await scoreOpenAnswers(path, input.mode, { [input.questionId]: input.answer }, { checker: ai, studentId })
  const item = result.perQuestion.find((q) => q.id === input.questionId)
  if (!item) throw new Error('m2 text score missing')
  const correct = item.score > 60
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
  if (input.attempt <= 2) {
    const question = path[input.mode].questions.find((q) => q.id === input.questionId)
    return { kind: 'text', correct: false, score: item.score, feedback: item.feedback, hint: question?.hint ?? 'ลองย้อนอ่านบทเรียนช่วงนี้อีกครั้งนะ', source: item.source }
  }
  return { kind: 'text', correct: false, score: item.score, feedback: item.feedback, reveal: reveals[input.questionId] ?? 'กลับไปดูสรุปบทเรียน แล้วลองอธิบายใหม่อีกครั้ง', reason: item.feedback, source: item.source }
}

function simResult(input: z.infer<typeof SimSchema>): Extract<M2StepResult, { kind: 'sim' }> {
  const expected: Record<number, Record<string, string> | string[]> = {
    0: { slot1: 'parts' },
    1: { slot1: 'parts', slot2: 'forcespeed', slot3: 'com' },
    2: { slot1: 'Subdomain', slot2: 'SLD', slot3: 'TLD' },
    3: ['com', 'forcespeed', 'parts'],
    4: { slot1: 'kanombanyai', slot2: 'co', slot3: 'th', slot4: 'booking' },
  }
  const expectedStage = expected[input.stage]
  const answer = Array.isArray(expectedStage)
    ? JSON.stringify(input.order ?? []) === JSON.stringify(expectedStage)
    : Object.entries(expectedStage as Record<string, string>).every(([key, value]) => input.placements?.[key] === value)
  if (answer) return { kind: 'sim', correct: true }
  if (input.stage === 4 && Object.values(input.placements ?? {}).some((v) => v === 'www' || v === '.com' || v === 'com')) {
    return { kind: 'sim', correct: false, reason: 'ชิ้นนี้เป็นตัวหลอก: www คือโฮสต์ที่ไม่ใช่ชิ้นของโจทย์ และ .com ไม่ใช่ช่องของ .co.th' }
  }
  return { kind: 'sim', correct: false, reason: 'ลองจัดใหม่โดยดูป้ายกำกับและลูกศรอ่านจากขวาไปซ้ายนะ' }
}

async function exitResult(studentId: string, input: z.infer<typeof ExitSchema>): Promise<Extract<M2StepResult, { kind: 'exit' }>> {
  const correct = [2, 1, 2].filter((answer, i) => input.answers[i] === answer).length
  const exitScore = Math.round((correct / 3) * 30)
  const score = Math.max(0, Math.min(100, Math.round(input.stageScore) + exitScore))
  const grade = score >= 90 ? 'A' : score >= 60 ? 'B' : 'C'
  const passed = grade !== 'C'
  const stars = grade === 'A' ? 3 : grade === 'B' ? 2 : 0
  await logEvent(studentId, 'learn-m2-exit', { missionId: 'm2', score, exitScore, grade, passed, answers: input.answers, repair: input.repair })
  await recordMissionAnswer(studentId, 'm2' as MissionId, passed, 'game')
  await setMissionStarsDb(studentId, 'm2' as MissionId, stars)
  if (passed) await logEvent(studentId, 'learn-done', { missionId: 'm2', mode: 'do', score })
  return { kind: 'exit', score, exitScore, grade, passed, stars }
}

export async function handleM2Step(studentId: string, payload: unknown): Promise<M2StepResult> {
  const parsed = z.discriminatedUnion('kind', [StopSchema, DragSchema, TextSchema, SimSchema, ExitSchema, NotebookSchema]).parse(payload)
  if (parsed.kind === 'stop') return stopResult(parsed)
  if (parsed.kind === 'text') return textResult(studentId, parsed)
  if (parsed.kind === 'sim') return simResult(parsed)
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
  return exitResult(studentId, parsed)
}


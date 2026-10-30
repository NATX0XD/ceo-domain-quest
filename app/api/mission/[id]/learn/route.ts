import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { MissionId } from '@/lib/db/repo'
import { getProfile, logEvent, switchLearningRoute } from '@/lib/db/repo'
import { findMission } from '@/components/missions'
import {
  scoreCardSort,
  LEARN_EVENTS,
  LEARN_MODES,
  MODE_TO_ROUTE,
  findLearnPath,
  loadLearnState,
  recentGameSolved,
  scoreOpenAnswers,
  scoreWarmup,
} from '@/components/server/learn-path'
import { checkCounterStep, scoreCounter } from '@/components/server/learn-counter'
import { checkRegistrarStep, scoreRegistrar } from '@/components/server/learn-registrar'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../../_lib/session-cookie'

/**
 * เส้นทางเรียนก่อนเข้าภารกิจ (ดู / อ่าน / ลงมือทำ) — สเปก docs/learn-path-spec.md
 *
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ⚠️ ตรวจทุกอย่างที่เซิร์ฟเวอร์ เฉลยไม่ออกไปเบราว์เซอร์
 * ⚠️ ทุกวิธีเรียนเลือกได้เสมอ ระบบแค่แนะนำ แล้วบันทึกทั้งค่าที่แนะนำกับค่าที่เลือกจริง
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('warmup'), answers: z.array(z.number().int().min(-1).max(3)).length(3) }),
  z.object({ action: z.literal('choose'), mode: z.enum(LEARN_MODES) }),
  z.object({
    action: z.literal('answer'),
    mode: z.enum(['watch', 'read']),
    answers: z
      .record(z.string().min(1).max(40), z.string().max(1000))
      .refine((o) => Object.keys(o).length <= 10, 'ส่งคำตอบได้ไม่เกิน 10 ข้อ'),
  }),
  z.object({ action: z.literal('do'), payload: z.unknown() }),
  /** ตรวจทีละจังหวะระหว่างเล่น (ลูกค้าทีละคนของด่าน 3 · เหตุการณ์/คำอธิบายบอสของด่าน 4) */
  z.object({ action: z.literal('step'), payload: z.unknown() }),
])

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const mission = findMission(id)
  const path = findLearnPath(id)
  if (!mission || !path) return errorResponse('mission-not-found', 'ไม่พบภารกิจนี้', 404)

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'รูปแบบข้อมูลไม่ถูกต้อง', 400)
  const body = parsed.data
  const studentId = session.studentId
  const missionId = mission.id

  try {
    if (body.action === 'warmup') {
      const result = await scoreWarmup(path, body.answers)
      await logEvent(studentId, LEARN_EVENTS.warmup, {
        missionId,
        score: result.score,
        total: result.total,
        recommended: result.recommended,
        reason: result.reason,
        answers: body.answers,
      })
      return NextResponse.json(result)
    }

    if (body.action === 'choose') {
      const state = await loadLearnState(studentId, missionId)
      const route = MODE_TO_ROUTE[body.mode]
      const before = await getProfile(studentId)
      if (before?.learning_route !== route) {
        await switchLearningRoute(studentId, route, { missionId: missionId as MissionId, chosenBy: 'student' })
      }
      await logEvent(studentId, LEARN_EVENTS.choose, {
        missionId,
        mode: body.mode,
        recommended: state.warmup?.recommended ?? null,
        followed: state.warmup ? state.warmup.recommended === body.mode : null,
      })
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'answer') {
      // เก็บเฉพาะข้อที่มีอยู่จริงในวิธีเรียนนี้ กันส่งคีย์แปลก ๆ มาถมตาราง events
      const answers = Object.fromEntries(
        path[body.mode].questions.map((q) => [q.id, body.answers[q.id] ?? '']),
      )
      const result = await scoreOpenAnswers(path, body.mode, answers)
      await logEvent(studentId, LEARN_EVENTS.answer, {
        missionId,
        mode: body.mode,
        score: result.score,
        passed: result.passed,
        perQuestion: result.perQuestion.map((q) => ({ id: q.id, score: q.score })),
        answers,
      })
      if (result.passed) await logEvent(studentId, LEARN_EVENTS.done, { missionId, mode: body.mode, score: result.score })
      return NextResponse.json(result)
    }

    if (body.action === 'step') {
      const step =
        path.do.kind === 'counter'
          ? checkCounterStep(body.payload)
          : path.do.kind === 'registrar'
            ? checkRegistrarStep(body.payload)
            : null
      if (!step) return errorResponse('bad-request', 'ด่านนี้ไม่มีการตรวจทีละจังหวะ', 400)
      await logEvent(studentId, 'learn-step', { missionId, kind: path.do.kind, step: step.log ?? null })
      return NextResponse.json(step.result)
    }

    // action === 'do'
    let result: { score: number; passed: boolean; detail: unknown }
    if (path.do.kind === 'counter') {
      result = scoreCounter(body.payload)
    } else if (path.do.kind === 'registrar') {
      result = scoreRegistrar(body.payload)
    } else if (path.do.kind === 'cards') {
      result = await scoreCardSort(path, body.payload)
    } else {
      const solved = await recentGameSolved(studentId, missionId)
      result = { score: solved ? 100 : 0, passed: solved, detail: null }
    }
    await logEvent(studentId, LEARN_EVENTS.do, {
      missionId,
      kind: path.do.kind,
      score: result.score,
      passed: result.passed,
    })
    if (result.passed) await logEvent(studentId, LEARN_EVENTS.done, { missionId, mode: 'do', score: result.score })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return errorResponse('bad-request', 'รูปแบบคำตอบไม่ถูกต้อง', 400)
    console.error('[learn]', err)
    return errorResponse('learn-unavailable', 'ระบบตรวจยังไม่พร้อม ลองใหม่อีกครั้ง', 503)
  }
}

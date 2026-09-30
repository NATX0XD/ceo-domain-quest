import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { MissionId } from '@/lib/db/repo'
import { logEvent } from '@/lib/db/repo'
import { findMission } from '@/components/missions'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../../../_lib/session-cookie'

/**
 * ตรวจมินิเกมของภารกิจ — **ตรวจที่เซิร์ฟเวอร์เท่านั้น**
 *
 * เฉลยของเกม (gameKey) อยู่ใน content/missions-answers.json ห้ามหลุดไปเบราว์เซอร์
 * จึงอ่านด้วย dynamic import ตอนเรียกจริง เหมือนข้อ check
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ⚠️ คืนผลเป็นรายช่อง **เฉพาะช่องที่ผู้เรียนวางของลงไปจริง** ว่าถูกหรือผิด
 *    ช่องที่ยังไม่ได้วางจะไม่อยู่ใน results เลย — ห้ามส่งเฉลยของช่องที่ยังไม่ได้ตอบออกไป
 *    (บอกว่า "ช่องนี้ผิด" ได้ แต่ห้ามบอกว่า "ช่องนี้ต้องวางชิ้นไหน")
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  /** match/build/sort: คู่ของ "ช่อง/หมวด" กับ "ชิ้นส่วน" · order: ลำดับรหัสขั้นตอน */
  placements: z.record(z.string().min(1), z.string().min(1)).optional(),
  order: z.array(z.string().min(1)).optional(),
})

const GameKeySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('match'),
    pairs: z.array(z.object({ left: z.string(), right: z.string() })),
  }),
  z.object({
    kind: z.literal('build'),
    placements: z.array(z.object({ slot: z.string(), piece: z.string() })),
    distractors: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('sort'),
    placements: z.array(z.object({ item: z.string(), category: z.string() })),
  }),
  z.object({ kind: z.literal('order'), order: z.array(z.string()) }),
])

const AnswersFileSchema = z.object({
  missions: z.array(z.object({ id: z.string(), gameKey: GameKeySchema.optional() })),
})

async function loadGameKey(missionId: string) {
  const fileUrl = pathToFileURL(join(process.cwd(), 'content', 'missions-answers.json')).href
  try {
    const mod = (await import(/* turbopackIgnore: true */ fileUrl, {
      with: { type: 'json' },
    })) as { default: unknown }
    const parsed = AnswersFileSchema.safeParse(mod.default)
    if (!parsed.success) return null
    return parsed.data.missions.find((m) => m.id === missionId)?.gameKey ?? null
  } catch {
    return null
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const mission = findMission(id)
  if (!mission) return errorResponse('mission-not-found', 'ไม่พบภารกิจนี้', 404)

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'รูปแบบคำตอบของเกมไม่ถูกต้อง', 400)

  const key = await loadGameKey(mission.id)
  if (!key) {
    return errorResponse(
      'game-key-unavailable',
      'ยังตรวจมินิเกมของภารกิจนี้ไม่ได้ (ไม่มีเฉลยเกมในไฟล์เนื้อหา) ลองทำข้อเช็กท้ายภารกิจแทนได้เลย',
      503,
    )
  }

  const placements = parsed.data.placements ?? {}
  let total = 0
  let correctCount = 0
  /** ผลรายช่อง: คีย์คือสิ่งที่ผู้เรียนวางไว้จริงเท่านั้น (ช่อง/ชิ้นส่วน/ลำดับ) */
  const results: Record<string, boolean> = {}

  if (key.kind === 'match') {
    total = key.pairs.length
    for (const pair of key.pairs) {
      const given = placements[pair.left]
      if (given === undefined) continue
      const ok = given === pair.right
      results[pair.left] = ok
      if (ok) correctCount += 1
    }
  } else if (key.kind === 'build') {
    total = key.placements.length
    for (const p of key.placements) {
      const given = placements[p.slot]
      if (given === undefined) continue
      const ok = given === p.piece
      results[p.slot] = ok
      if (ok) correctCount += 1
    }
  } else if (key.kind === 'sort') {
    total = key.placements.length
    for (const p of key.placements) {
      const given = placements[p.item]
      if (given === undefined) continue
      const ok = given === p.category
      // เกมจัดหมวดคีย์คือ "ชิ้นส่วน" หน้าจอเอาไปทำสีของชิปที่วางไว้ในหมวด
      results[p.item] = ok
      if (ok) correctCount += 1
    }
  } else {
    total = key.order.length
    const given = parsed.data.order ?? []
    key.order.forEach((stepId, i) => {
      const placedId = given[i]
      if (placedId === undefined) return
      const ok = placedId === stepId
      // คีย์คือชิ้นที่ผู้เรียนวางไว้ตำแหน่งนั้น ไม่ใช่ชิ้นที่ "ควรอยู่" ตรงนั้น
      results[placedId] = ok
      if (ok) correctCount += 1
    })
  }

  const allCorrect = total > 0 && correctCount === total
  await logEvent(session.studentId, 'mission-game-checked', {
    missionId: mission.id as MissionId,
    kind: key.kind,
    correctCount,
    total,
  })

  // results มีเฉพาะช่องที่วางแล้ว — ช่องที่ยังว่างไม่ถูกเปิดเผยอะไรทั้งสิ้น
  return NextResponse.json({ allCorrect, correctCount, total, kind: key.kind, results })
}

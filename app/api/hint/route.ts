import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { MissionId } from '@/lib/db/repo'
import { logEvent, withAiSwitch } from '@/lib/db/repo'
import { findBusinessType } from '@/core/content'
import { findMission } from '@/components/missions'
import { ai, sourceInfo } from '@/components/server/ai'
import { fallbackHint } from '@/lib/ai'
import {
  loadMissionRow,
  loadShopProfile,
  loadStationBDb,
  recordMissionHintDb,
  recordStationBHintDb,
} from '@/components/server/game-state'
import { errorResponse, readJsonBody, readStudentSession, unauthorized } from '../_lib/session-cookie'

/**
 * ขอคำใบ้ถัดไป — ผ่านชั้น AI (lib/ai) ทุกครั้ง
 *
 * มีคีย์ AI แล้ว คำใบ้จึงมาจากโมเดลได้ (source: 'ai') ส่วนตอนโมเดลล่ม/ช้าเกิน/โควตาหมด
 * `hintFor()` ตกไปทางกฎล้วนเองโดยอัตโนมัติ (source: 'fallback') ผู้เรียนยังได้คำใบ้เหมือนเดิม
 * นั่นคือผลที่ถูกต้อง ไม่ใช่ error — นักเรียนยังได้คำใบ้เหมือนเดิมทุกประการ
 *
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 * ⚠️ ส่งคำใบ้ทีละใบ ห้ามส่งทั้งชุดไปเบราว์เซอร์
 * ⚠️ ขอคำใบ้ไม่บวก attempts (รอ RPC increment_mission_hint จากฝั่ง DB)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const STATION_B_HINT_ID = 'station-b'

const RequestSchema = z.object({ missionId: z.string().min(1).max(40) })

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ต้องส่ง missionId มาด้วย', 400)

  const { missionId } = parsed.data

  if (missionId === STATION_B_HINT_ID) {
    const before = await loadStationBDb(session.studentId)
    if (before.hintsUsed >= 2) {
      return NextResponse.json({
        scope: STATION_B_HINT_ID,
        hintsUsed: before.hintsUsed,
        exhausted: true,
        // ตัวช่วยของสถานี B เป็นการเปิดป้ายเงื่อนไขจากไฟล์เนื้อหา ไม่ได้เรียกโมเดล
        source: 'fallback',
        provider: 'rules',
        fallbackReason: 'not-requested',
      })
    }
    const station = await recordStationBHintDb(session.studentId)
    return NextResponse.json({
      scope: STATION_B_HINT_ID,
      hintsUsed: station.hintsUsed,
      exhausted: station.hintsUsed >= 2,
      source: 'fallback',
      provider: 'rules',
      fallbackReason: 'not-requested',
    })
  }

  const mission = findMission(missionId)
  if (!mission) return errorResponse('mission-not-found', 'ไม่พบภารกิจนี้', 404)

  const before = await loadMissionRow(session.studentId, mission.id as MissionId)
  if (before.hintsUsed >= mission.hints.length) {
    return NextResponse.json({
      scope: 'mission',
      hint: null,
      hintsUsed: before.hintsUsed,
      total: mission.hints.length,
      exhausted: true,
      source: 'fallback',
      provider: 'rules',
      fallbackReason: 'not-requested',
    })
  }

  const after = await recordMissionHintDb(
    session.studentId,
    mission.id as MissionId,
    mission.hints.length,
  )

  // ให้ชั้น AI เป็นคนตัดสินว่าจะใช้โมเดลหรือกฎ หน้าเว็บไม่ต้องรู้ว่าวันนี้มีคีย์หรือไม่
  const profile = await loadShopProfile(session.studentId)
  const businessType = profile ? findBusinessType(profile.businessTypeId) : undefined
  const hintInput = {
    missionId: mission.id,
    role: 'dome' as const,
    hintLevel: after.hintsUsed,
    studentId: session.studentId,
    draftName: profile?.domainName,
    keywords: businessType?.keywords ?? [],
  }
  /**
   * ครูกดปิด AI ทั้งห้อง = **ไม่เรียกโมเดลเลย** ใช้กฎในโค้ดทันที (REVIEW-8 H-3)
   * ไม่ใช่ยิงไปแล้วรอ timeout 5 วินาทีต่อคน — คำใบ้ต้องมาทันทีเหมือนเดิม
   * เด็กไม่รู้และไม่ต้องรู้ว่าวันนี้ครูปิด AI ไว้ ได้คำใบ้เหมือนเดิมทุกประการ
   */
  const result = await withAiSwitch(
    session.studentId,
    () => ai.hintFor(hintInput),
    () => fallbackHint(hintInput, 'not-requested'),
  )

  const meta = sourceInfo(result)
  // เก็บที่มาของคำใบ้ไว้ให้ครูตรวจย้อนหลังได้ว่าอันไหน AI อันไหนกฎ
  await logEvent(session.studentId, 'hint-served', {
    missionId: mission.id,
    level: result.level,
    ...meta,
  })

  return NextResponse.json({
    scope: 'mission',
    hint: result.text,
    hintsUsed: after.hintsUsed,
    total: mission.hints.length,
    exhausted: after.hintsUsed >= mission.hints.length,
    ...meta,
  })
}

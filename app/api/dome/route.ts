import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAiEnabledForStudent, listRecentChatMessages, saveChatMessage } from '@/lib/db/repo'
import { askDome, domeQuickReplies } from '@/components/server/dome-brain'
import { loadSelfProfileDb, loadShopProfile } from '@/components/server/game-state'
import { counterHandbookFacts } from '@/components/server/learn-counter'
import { lessonSummary } from '@/components/server/lesson-progress'
import { moderateStudentText } from '@/components/server/moderation'
import {
  errorResponse,
  readJsonBody,
  readStudentSession,
  unauthorized,
} from '../_lib/session-cookie'

/**
 * คุยกับเลขาโดม
 *
 * ตอบด้วย AI จริงผ่านชั้น lib/ai (Typhoon · Gemini · Cloudflare ตามคีย์ที่ตั้งไว้ พร้อม failover)
 * ภายใต้ตัวกันหัวข้อตามภารกิจของนักเรียน ถ้าทุกเจ้าล้ม/ติดลิมิต/ไม่มีคีย์ ตกไปใช้กฎใน dome-brain.ts
 * ⚠️ studentId และภารกิจปัจจุบันมาจากฝั่งเซิร์ฟเวอร์ (คุกกี้ + ความคืบหน้าใน DB) ไม่เชื่อ missionId จากหน้าจอ
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** ลิมิตต่อคน: เรียกโมเดลได้ไม่เกิน N ครั้งต่อหน้าต่าง 60 วินาที เกินแล้วโดมตอบด้วยกฎ (ไม่ error) */
const AI_PER_MINUTE = Math.max(1, Number(process.env.DOME_AI_PER_MINUTE) || 8)
const WINDOW_MS = 60_000
const recentCalls = new Map<string, number[]>()

function takeAiSlot(studentId: string, now = Date.now()): boolean {
  const calls = (recentCalls.get(studentId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (calls.length >= AI_PER_MINUTE) {
    recentCalls.set(studentId, calls)
    return false
  }
  calls.push(now)
  recentCalls.set(studentId, calls)
  return true
}

const RequestSchema = z.object({
  message: z.string().max(500).default(''),
  quickReplyId: z.string().max(40).nullable().optional(),
  missionId: z.string().regex(/^m[1-5]$/).optional(),
  /** ถามจากโต๊ะ m3: เซิร์ฟเวอร์แนบคู่มือเอง (ไม่รับข้อความ context จากหน้าจอ) */
  desk: z.literal('m3-handbook').optional(),
})

export async function POST(request: Request) {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน')

  const parsed = RequestSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) return errorResponse('bad-request', 'ข้อความยาวเกินไปหรือรูปแบบไม่ถูกต้อง', 400)

  /**
   * ข้อความที่เด็กพิมพ์คุยกับโดมก็ต้องผ่านตัวกรอง E-11 เหมือนช่องอื่น
   * ไม่ผ่าน = ไม่ส่งเข้าโมเดลและไม่บันทึกลงประวัติ แต่คืนข้อความเดิมกลับไปให้เด็กแก้เอง
   */
  const verdict = await moderateStudentText(session.studentId, 'dome-chat', parsed.data.message)
  if (!verdict.ok) {
    return errorResponse('content-flagged', verdict.message ?? 'ลองพิมพ์ใหม่ด้วยคำอื่นนะ', 422, {
      original: verdict.original,
    })
  }

  const [profile, selfProfile, summary, recent, aiOn] = await Promise.all([
    loadShopProfile(session.studentId),
    loadSelfProfileDb(session.studentId),
    lessonSummary(session.studentId),
    listRecentChatMessages(session.studentId, 6),
    // ครูปิด AI ทั้งห้องได้ที่หน้าตั้งค่า — ปิดแล้วโดมตอบด้วยกฎ (เหมือนคำใบ้)
    isAiEnabledForStudent(session.studentId),
  ])
  // ภารกิจปัจจุบัน = ภารกิจแรกที่ยังไม่ผ่านตามข้อมูลจริงใน DB (ตรงกับที่หน้า /dome ใช้)
  const missionId = summary.missions.find((mission) => !mission.passed)?.id ?? 'm5'
  const reply = await askDome({
    message: parsed.data.message,
    quickReplyId: parsed.data.quickReplyId ?? null,
    shopName: profile?.shopName ?? null,
    selfProfileDone: selfProfile.route !== null,
    missionId,
    role: 'dome',
    context: parsed.data.desk === 'm3-handbook' ? counterHandbookFacts() : undefined,
    history: recent.map((m) => ({ role: m.role === 'student' ? 'student' : 'dome', text: m.text })),
    allowAi: () => aiOn && takeAiSlot(session.studentId),
  })

  // เก็บบทสนทนาไว้เป็นหลักฐานให้ครูดูย้อนหลังได้ (source บอกว่ามาจากสคริปต์หรือ AI)
  const source = reply.source === 'ai' ? 'ai' : 'scripted'
  if (parsed.data.message.trim().length > 0) {
    await saveChatMessage(session.studentId, 'student', parsed.data.message.trim(), 'scripted')
  }
  await saveChatMessage(session.studentId, 'dome', reply.reply, source)

  return NextResponse.json({ ...reply, quickReplies: domeQuickReplies() })
}

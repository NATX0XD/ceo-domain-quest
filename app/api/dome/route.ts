import { NextResponse } from 'next/server'
import { z } from 'zod'
import { saveChatMessage } from '@/lib/db/repo'
import { askDome, domeQuickReplies } from '@/components/server/dome-brain'
import { loadShopProfile } from '@/components/server/game-state'
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
 * ตอบด้วยบทสนทนาแบบกฎในโค้ด (source: 'fallback') เสมอ ยังไม่ได้ต่อโมเดลกับโดม
 * ถ้าจะให้โดมใช้โมเดล ให้สลับที่ components/server/dome-brain.ts ที่เดียว หน้าจอไม่ต้องแก้
 * ⚠️ studentId จากคุกกี้ dbq_student เท่านั้น
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  message: z.string().max(500).default(''),
  quickReplyId: z.string().max(40).nullable().optional(),
  missionId: z.string().regex(/^m[1-5]$/).optional(),
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

  const profile = await loadShopProfile(session.studentId)
  const reply = await askDome({
    message: parsed.data.message,
    quickReplyId: parsed.data.quickReplyId ?? null,
    shopName: profile?.shopName ?? null,
    missionId: parsed.data.missionId ?? 'm1',
    role: 'dome',
  })

  // เก็บบทสนทนาไว้เป็นหลักฐานให้ครูดูย้อนหลังได้ (source บอกว่ามาจากสคริปต์หรือ AI)
  const source = reply.source === 'ai' ? 'ai' : 'scripted'
  if (parsed.data.message.trim().length > 0) {
    await saveChatMessage(session.studentId, 'student', parsed.data.message.trim(), 'scripted')
  }
  await saveChatMessage(session.studentId, 'dome', reply.reply, source)

  return NextResponse.json({ ...reply, quickReplies: domeQuickReplies() })
}

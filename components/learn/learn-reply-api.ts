/**
 * ขอคำตอบกลับรายข้อของโดม (`POST /api/mission/[id]/learn/reply`) ฝั่งเบราว์เซอร์
 * ไม่ใช่การตรวจคะแนน · ช้าเกินงบหรือพัง = ข้อความเดิมแบบตายตัว ไม่ขวางการตอบข้อถัดไป
 */

export const DOME_REPLY_FIXED: Record<'watch' | 'read', string> = {
  watch: 'โดมจดคำตอบไว้แล้วครับ ไปคำถามต่อไปกัน',
  read: 'โดมจดคำตอบไว้แล้วครับ ไปข้อถัดไปกัน',
}

/** งบฝั่งเซิร์ฟเวอร์ 7 วินาที + เผื่อเดินทาง */
export const DOME_REPLY_CLIENT_TIMEOUT_MS = 8500

export async function fetchDomeReply(
  missionId: string,
  body: { mode: 'watch' | 'read'; questionId: string; answer: string },
): Promise<{ reply: string; source: 'ai' | 'fallback' }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOME_REPLY_CLIENT_TIMEOUT_MS)
  try {
    const res = await fetch(`/api/mission/${encodeURIComponent(missionId)}/learn/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => null)) as { reply?: unknown; source?: unknown } | null
    if (res.ok && typeof data?.reply === 'string' && data.reply.trim()) {
      return { reply: data.reply.trim(), source: data.source === 'ai' ? 'ai' : 'fallback' }
    }
  } catch {
    /* หมดเวลา/ต่อเน็ตไม่ได้ = ข้อความเดิม */
  } finally {
    clearTimeout(timer)
  }
  return { reply: DOME_REPLY_FIXED[body.mode], source: 'fallback' }
}

/**
 * ตัวช่วยเรียก `POST /api/mission/[id]/learn` ฝั่งเบราว์เซอร์ (สเปก docs/learn-path-spec.md)
 * ⚠️ ไฟล์นี้ใช้ฝั่ง client เท่านั้น ห้าม import อะไรจาก components/server แบบค่าจริง
 */

export type LearnModeId = 'watch' | 'read' | 'do'

export interface WarmupResponse {
  score: number
  total: number
  recommended: LearnModeId
  reason: string
  perQuestion: boolean[]
}

export interface AnswerResponse {
  score: number
  passed: boolean
  perQuestion: { id: string; score: number; feedback: string; missing: string[] }[]
}

export interface DoResponse {
  score: number
  passed: boolean
  detail: unknown
}

export type LearnBody =
  | { action: 'warmup'; answers: number[] }
  | { action: 'choose'; mode: LearnModeId }
  | { action: 'answer'; mode: 'watch' | 'read'; answers: Record<string, string> }
  | { action: 'do'; payload: unknown }
  | { action: 'step'; payload: unknown }

export type LearnPost<T> = { ok: true; data: T } | { ok: false; message: string }

export async function postLearn<T>(missionId: string, body: LearnBody): Promise<LearnPost<T>> {
  try {
    const res = await fetch(`/api/mission/${encodeURIComponent(missionId)}/learn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as (T & { message?: string }) | null
    if (!res.ok || !data) {
      const fallback =
        res.status === 401 ? 'ยังไม่ได้เข้าห้อง ใส่รหัสห้องกับ PIN ที่หน้า /join ก่อน' : 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง'
      return { ok: false, message: data?.message ?? fallback }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, message: 'ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง' }
  }
}

export const MODE_LABEL: Record<LearnModeId, string> = {
  watch: 'ดู',
  read: 'อ่าน',
  do: 'ลงมือทำ',
}

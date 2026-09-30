'use client'

import { useState } from 'react'
import { Card, cn } from '../../components/ui'

/**
 * สวิตช์ "ใช้ AI ช่วยคิดในคาบนี้" (REVIEW-8 H-3)
 *
 * คอลัมน์ `class_sessions.ai_enabled` มีมาตั้งแต่ต้น API ก็รับค่ามาตลอด
 * แต่**ไม่มีปุ่มให้ครูกด และไม่มีใครอ่านค่าไปใช้** ครูจึงปิด AI เองไม่ได้เลย
 * ทั้งที่คำตอบกรรมการข้อ 37 (AI ช้า/ล่มกลางคาบ) บอกว่าครูปิดได้
 *
 * ปิดแล้วเกิดอะไร: ทุกจุดที่เรียกโมเดล (คำใบ้ · ลูกค้าจำลองสถานี B · เรื่องเล่า · คิวตรวจงาน)
 * ตกไปใช้ **กฎล้วนในโค้ด** ทันทีในคำขอถัดไป ไม่ใช่รอ timeout 5 วินาทีต่อคน
 * ด่านที่บังคับจริงอยู่ฝั่งเซิร์ฟเวอร์ (`session_ai_enabled`) ไม่ใช่ที่ปุ่มนี้
 *
 * ปุ่มนี้ **ไม่ทำให้เด็กเห็นข้อความ error** — เด็กได้คำใบ้เหมือนเดิม แค่มาจากกฎแทนโมเดล
 */

interface AiSwitchProps {
  /** คาบที่กำลังเดินอยู่ของห้องที่เลือก — ยังไม่เปิดคาบ = null */
  sessionId: string | null
  aiEnabled: boolean
}

export function AiSwitch({ sessionId, aiEnabled }: AiSwitchProps) {
  const [enabled, setEnabled] = useState(aiEnabled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!sessionId) return null

  async function toggle() {
    const next = !enabled
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'settings', sessionId, aiEnabled: next }),
      })
      const json = (await res.json().catch(() => null)) as {
        message?: string
        session?: { ai_enabled?: boolean }
      } | null
      if (!res.ok) {
        setError(json?.message ?? `เปลี่ยนไม่สำเร็จ (สถานะ ${res.status})`)
        return
      }
      // เชื่อค่าที่เซิร์ฟเวอร์ตอบกลับ ไม่ใช่ค่าที่เราเพิ่งส่งไป
      setEnabled(json?.session?.ai_enabled ?? next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เปลี่ยนไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card tone={enabled ? 'plain' : 'danger'} className="mt-4" role="region" aria-label="สวิตช์ AI">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-label font-extrabold tracking-wide text-ink-muted">AI ช่วยคิดในคาบนี้</p>
          <p className="mt-1 text-body text-pretty text-ink">
            {enabled ? (
              <>
                <strong>เปิดอยู่</strong> · คำใบ้ ลูกค้าจำลอง และคิวตรวจงานจะลองถาม AI ก่อน
                ถ้า AI ช้าหรือล่มจะตกไปใช้กฎในโค้ดให้เอง
              </>
            ) : (
              <>
                <strong>ปิดอยู่</strong> · ทั้งห้องใช้<strong>กฎในโค้ด</strong>ล้วน ไม่มีการเรียก AI เลย
                นักเรียนยังได้คำใบ้และคะแนนเสนอเหมือนเดิม และไม่เห็นข้อความผิดพลาดใด ๆ
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={!enabled}
          className={cn(
            'btn-base px-4 disabled:opacity-60',
            enabled
              ? 'bg-surface-raised text-danger-700 ring-2 ring-danger-500 ring-inset hover:bg-danger-100'
              : 'bg-brand-600 text-ink-onbrand shadow-soft-1',
          )}
        >
          {busy ? 'กำลังเปลี่ยน…' : enabled ? 'ปิด AI ทั้งห้อง' : 'เปิด AI อีกครั้ง'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-label font-bold text-danger-700">
          {error}
        </p>
      ) : null}
    </Card>
  )
}

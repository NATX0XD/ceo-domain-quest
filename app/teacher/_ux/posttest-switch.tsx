'use client'

import { useEffect, useState } from 'react'
import { Chip, Icon3d } from './v2'

/**
 * สวิตช์เปิด-ปิดแบบทดสอบหลังเรียนบนแผงคุมคาบ + ตัวนับทำแล้ว/ทั้งห้อง
 * เปิดแล้วเครื่องนักเรียนที่รออยู่เดินต่อเอง (หน้า /posttest ถามเซิร์ฟเวอร์ทุก 4 วินาที)
 * ⚠️ ปุ่มนี้แค่ยิงคำสั่ง เซิร์ฟเวอร์เป็นคนตัดสินว่าใครเปิดได้
 */
export function PosttestSwitch({
  classroomId,
  sessionId,
  enabled,
  busy,
  onToggle,
}: {
  classroomId: string | null
  sessionId: string | null
  enabled: boolean
  busy: boolean
  onToggle: (next: boolean) => void
}) {
  const [counts, setCounts] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (!classroomId) return
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/teacher/efficiency?classroomId=${classroomId}`)
        if (!res.ok || !alive) return
        const d = (await res.json()) as { postTestDone?: number; studentCount?: number }
        setCounts({ done: d.postTestDone ?? 0, total: d.studentCount ?? 0 })
      } catch {
        // เงียบไว้ รอบหน้าลองใหม่
      }
    }
    void load()
    const id = setInterval(load, 6000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [classroomId, enabled])

  if (!sessionId) return null

  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={enabled}
      onClick={() => onToggle(!enabled)}
      className="t2-toggle focus-ring shrink-0"
      data-testid="posttest-switch"
    >
      <Icon3d name="bullseye" size={36} />
      <span>แบบทดสอบหลังเรียน</span>
      <span className="ml-auto flex items-center gap-2">
        {counts ? (
          <Chip tone={counts.total > 0 && counts.done === counts.total ? 'green' : 'sky'}>
            ทำแล้ว {counts.done}/{counts.total}
          </Chip>
        ) : null}
        <Chip tone={enabled ? 'green' : 'yellow'}>{enabled ? 'เปิดอยู่ · กดเพื่อปิด' : 'ปิดอยู่ · กดเพื่อเปิด'}</Chip>
      </span>
    </button>
  )
}

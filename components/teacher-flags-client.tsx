'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckIcon } from '@/components/ui'
import { Icon3d, InfoTip } from '@/app/teacher/_ux/v2'

/**
 * ธงคำไม่เหมาะสมบนแผงครู (E-11)
 *
 * ⚠️ ข้อความที่แสดงคือ `text_for_teacher` ที่เซิร์ฟเวอร์ตัดสินมาแล้ว
 *    ระดับ 3 เห็นเต็ม · ระดับ 1-2 เห็นแบบปิดบางส่วน — หน้าจอห้ามไปประกอบข้อความเอง
 * ⚠️ "ดูแลแล้ว" = ปิดธง ไม่ได้ลบข้อความของนักเรียน
 * poll ทุก 3 วินาที ตามเกณฑ์ "ระดับ 3 ต้องถึงแผงครูภายใน 3 วินาที"
 */
const POLL_MS = 3000

interface Flag {
  id: string
  student_id: string
  nickname: string
  context: string
  level: number
  categories: string[]
  text_for_teacher: string | null
  is_full_text: boolean
  created_at: string
}

/** ชื่อช่องที่พิมพ์ — ให้ครูรู้ว่ามาจากหน้าไหน */
const CONTEXT_LABEL: Record<string, string> = {
  'brand-name': 'ชื่อร้าน',
  nickname: 'ชื่อเล่น',
  'boss-reason': 'ใบเสนอด่านบอส',
  reflection: 'คำตอบทบทวนตัวเอง',
  'peer-feedback': 'ความเห็นถึงเพื่อน',
  'dome-chat': 'แชตกับโดม',
  'self-goal': 'เป้าหมายของตัวเอง',
  'survey-open': 'แบบสอบถาม',
}

export function TeacherFlagsClient({ classroomId }: { classroomId: string | null }) {
  const [flags, setFlags] = useState<Flag[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/flags?classroomId=${classroomId}`)
      if (!res.ok) return
      const data = (await res.json()) as { flags?: Flag[] }
      setFlags(data.flags ?? [])
    } catch {
      // เน็ตสะดุด รอบหน้าค่อยว่ากัน
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  async function resolve(flagId: string) {
    setBusyId(flagId)
    setError(null)
    try {
      const res = await fetch('/api/teacher/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flagId }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null
        setError(data?.message ?? 'ปิดธงไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setFlags((rows) => rows.filter((row) => row.id !== flagId))
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  if (!classroomId || flags.length === 0) return null

  return (
    <section className="t2-card shrink-0" style={{ background: '#fdeceb', borderColor: '#eba7a3' }}>
      <h3 className="t2-card-title" style={{ marginBottom: '0.75rem' }}>
        <Icon3d name="warning" size={32} />
        ต้องดูแล {flags.length} รายการ
        <InfoTip
          label="เรื่องข้อความที่ต้องดูแล"
          text="ระบบไม่ได้ลบข้อความของนักเรียน ระดับ 3 ครูเห็นข้อความเต็มเพื่อดูแลได้ถูก ระดับต่ำกว่านั้นเห็นแบบปิดบางส่วน"
        />
      </h3>

      <ul aria-live="polite" className="flex flex-col gap-2">
        {flags.map((flag) => (
          <li key={flag.id} className="rounded-[18px] bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-label font-extrabold text-ink">
                {flag.nickname}
                <span className="ml-2 text-note font-bold text-ink-muted">
                  {CONTEXT_LABEL[flag.context] ?? flag.context}
                </span>
              </p>
              <span className="t2-chip" data-tone={flag.level >= 3 ? 'red' : 'orange'}>
                ระดับ {flag.level}
                {flag.is_full_text ? ' · เต็ม' : ' · ปิดบางส่วน'}
              </span>
            </div>

            <p className="mt-2 rounded-[14px] bg-[#f6f2e8] p-2 text-label break-words text-ink">
              {flag.text_for_teacher ?? '(ไม่มีข้อความ)'}
            </p>

            {flag.categories.length > 0 ? (
              <p className="mt-1 text-note font-bold text-ink-muted">กลุ่มคำ: {flag.categories.join(' · ')}</p>
            ) : null}

            <button
              type="button"
              className="t2-btn mt-2 focus-ring"
              data-size="sm"
              disabled={busyId === flag.id}
              onClick={() => resolve(flag.id)}
            >
              <CheckIcon width={18} height={18} aria-hidden />
              {busyId === flag.id ? 'กำลังปิดธง…' : 'ดูแลแล้ว'}
            </button>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-3 text-label font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
    </section>
  )
}

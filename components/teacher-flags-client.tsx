'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, Button, CheckIcon, cn } from '@/components/ui'

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
    <section className="mt-4 rounded-2xl bg-danger-100 p-4 ring-1 ring-danger-300 ring-inset">
      <h3 className="flex items-center gap-2 text-body-lg font-bold text-danger-700">
        <AlertIcon width={22} height={22} aria-hidden />
        ข้อความที่ต้องดูแล {flags.length} รายการ
      </h3>
      <p className="mt-1 text-label text-ink-muted">
        ระบบไม่ได้ลบข้อความของนักเรียน · ระดับ 3 ครูเห็นข้อความเต็มเพื่อดูแลได้ถูก
        ระดับต่ำกว่านั้นเห็นแบบปิดบางส่วน
      </p>

      <ul aria-live="polite" className="mt-3 flex flex-col gap-2">
        {flags.map((flag) => (
          <li
            key={flag.id}
            className="rounded-xl bg-surface-raised p-3 ring-1 ring-line ring-inset"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-body font-bold text-ink">
                {flag.nickname}
                <span className="ml-2 text-label font-semibold text-ink-muted">
                  {CONTEXT_LABEL[flag.context] ?? flag.context}
                </span>
              </p>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full px-3 py-1 text-label font-bold',
                  flag.level >= 3
                    ? 'bg-danger-100 text-danger-700'
                    : 'bg-spark-100 text-spark-700',
                )}
              >
                ระดับ {flag.level}
                {flag.is_full_text ? ' · ข้อความเต็ม' : ' · ปิดบางส่วน'}
              </span>
            </div>

            <p className="mt-2 rounded-lg bg-surface-sunken p-2 text-body break-words text-ink">
              {flag.text_for_teacher ?? '(ไม่มีข้อความ)'}
            </p>

            {flag.categories.length > 0 ? (
              <p className="mt-1 text-note text-ink-muted">กลุ่มคำ: {flag.categories.join(' · ')}</p>
            ) : null}

            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={busyId === flag.id}
              loading={busyId === flag.id}
              loadingLabel="กำลังปิดธง"
              leadingIcon={<CheckIcon width={18} height={18} />}
              onClick={() => resolve(flag.id)}
            >
              ดูแลแล้ว
            </Button>
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

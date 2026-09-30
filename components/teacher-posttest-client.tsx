'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, Button, CheckIcon, cn } from '@/components/ui'

/**
 * ครูกดเปิดแบบทดสอบก่อน/หลังเรียน (T-12) + ดู E1/E2 ของห้อง
 *
 * ใช้สวิตช์ `pretest_enabled` / `posttest_enabled` ของคาบโดยตรง (POST /api/teacher/session action=test)
 * **ไม่ผูกกับช่วงของคาบแล้ว** — กดเปิดแบบทดสอบจึงไม่ทำให้ทั้งห้องเด้งไปช่วงอื่น
 *
 * ⚠️ ปุ่มนี้แค่ยิงคำสั่ง เซิร์ฟเวอร์เป็นคนตัดสินว่าใครเปิดได้และนักเรียนคนไหนทำได้
 */

interface SessionInfo {
  id: string
  phase: string
  pretest_enabled: boolean
  posttest_enabled: boolean
}

interface Efficiency {
  label: string
  standardLabel: string
  meetsStandard: boolean
  summary: string
  postTestDone: number
  studentCount: number
}

export function TeacherPosttestClient({ classroomId }: { classroomId: string | null }) {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [efficiency, setEfficiency] = useState<Efficiency | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const [sessionRes, effRes] = await Promise.all([
        fetch(`/api/teacher/session?classroomId=${classroomId}`),
        fetch(`/api/teacher/efficiency?classroomId=${classroomId}`),
      ])
      if (sessionRes.ok) {
        const data = (await sessionRes.json()) as { session?: SessionInfo }
        setSession(data.session ?? null)
      }
      if (effRes.ok) {
        const data = (await effRes.json()) as Efficiency
        setEfficiency(data)
      }
    } catch {
      // เงียบไว้ ครูกดปุ่มโหลดใหม่ได้
    }
  }, [classroomId])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleTest(kind: 'pretest' | 'posttest', enabled: boolean) {
    if (!session || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'test', sessionId: session.id, kind, enabled }),
      })
      const data = (await res.json().catch(() => null)) as {
        message?: string
        session?: SessionInfo
      } | null
      if (!res.ok) {
        setError(data?.message ?? 'สั่งเปิด/ปิดแบบทดสอบไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      if (data?.session) setSession(data.session)
      await load()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  if (!classroomId) return null

  const opened = session?.posttest_enabled === true
  const preOpened = session?.pretest_enabled === true

  return (
    <div className="mt-4 rounded-2xl bg-surface-raised p-4 ring-1 ring-line ring-inset">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-label font-bold text-ink">
            <span
              aria-hidden="true"
              className={cn(
                'inline-block size-2.5 shrink-0 rounded-full',
                opened ? 'bg-quest-500' : 'bg-spark-500',
              )}
            />
            แบบทดสอบหลังเรียน {opened ? 'เปิดให้ทำแล้ว' : 'ยังไม่เปิด'}
          </p>
          <p className="mt-1 text-label text-ink-muted">
            {opened
              ? `นักเรียนเข้า /posttest ได้แล้ว · ทำไปแล้ว ${efficiency?.postTestDone ?? 0} จาก ${efficiency?.studentCount ?? 0} คน`
              : 'กดเปิดเมื่อสอนจบคาบ นักเรียนถึงจะทำได้ (ทำได้คนละครั้งเดียว)'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant={preOpened ? 'primary' : 'secondary'}
            onClick={() => toggleTest('pretest', !preOpened)}
            disabled={busy || session === null}
            loading={busy}
            loadingLabel="กำลังสั่ง"
            leadingIcon={preOpened ? <CheckIcon width={20} height={20} /> : undefined}
          >
            {preOpened ? 'ปิดแบบทดสอบก่อนเรียน' : 'เปิดแบบทดสอบก่อนเรียน'}
          </Button>
          <Button
            variant={opened ? 'primary' : 'secondary'}
            onClick={() => toggleTest('posttest', !opened)}
            disabled={busy || session === null}
            loading={busy}
            loadingLabel="กำลังสั่ง"
            leadingIcon={opened ? <CheckIcon width={20} height={20} /> : undefined}
          >
            {opened ? 'ปิดแบบทดสอบหลังเรียน' : 'เปิดแบบทดสอบหลังเรียน'}
          </Button>
        </div>
      </div>

      {/* ตัวเลขสำหรับตอบกรรมการ — คิดที่เซิร์ฟเวอร์ด้วย core/efficiency.ts */}
      {efficiency ? (
        <div className="mt-3 rounded-xl bg-surface-sunken p-3">
          <p className="text-label font-bold text-ink">
            ประสิทธิภาพสื่อ E1/E2 = {efficiency.label} (เกณฑ์ {efficiency.standardLabel}){' '}
            {efficiency.meetsStandard ? '· ผ่านเกณฑ์' : '· ยังไม่ถึงเกณฑ์'}
          </p>
          <p className="mt-1 text-note text-ink-muted">{efficiency.summary}</p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-danger-100 p-3 text-label font-semibold text-danger-700"
        >
          <AlertIcon width={18} height={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

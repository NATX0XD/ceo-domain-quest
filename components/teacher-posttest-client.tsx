'use client'

import { useCallback, useEffect, useState } from 'react'
import { Chip, Icon3d, InfoTip } from '@/app/teacher/_ux/v2'

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

  if (!classroomId) return null

  const opened = session?.posttest_enabled === true
  const preOpened = session?.pretest_enabled === true
  const done = efficiency?.postTestDone ?? 0
  const total = efficiency?.studentCount ?? 0

  return (
    <section className="t2-card" aria-label="แบบทดสอบหลังเรียน">
      <div className="flex flex-wrap items-center gap-3">
        <Icon3d name="bar-chart" size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-label font-extrabold text-ink">
            ทำแบบทดสอบหลังเรียนแล้ว {done}/{total} คน
            <Chip tone={opened ? 'green' : 'yellow'}>{opened ? 'หลังเรียน เปิด' : 'หลังเรียน ยังไม่เปิด'}</Chip>
            <Chip tone={preOpened ? 'green' : undefined}>{preOpened ? 'ก่อนเรียน เปิด' : 'ก่อนเรียน ปิด'}</Chip>
          </p>
          {/* ตัวเลขสำหรับตอบกรรมการ — คิดที่เซิร์ฟเวอร์ด้วย core/efficiency.ts */}
          {efficiency ? (
            <p className="mt-1 text-label font-bold text-ink-muted">
              E1/E2 = {efficiency.label} · เกณฑ์ {efficiency.standardLabel} ·{' '}
              {efficiency.meetsStandard ? 'ผ่านเกณฑ์' : 'ยังไม่ถึงเกณฑ์'}
            </p>
          ) : null}
        </div>
        <InfoTip
          label="เรื่องแบบทดสอบ"
          align="end"
          text="เปิด-ปิดแบบทดสอบได้ที่สวิตช์ของคาบด้านบน นักเรียนทำได้คนละครั้งเดียวที่ /posttest"
        />
      </div>

      {efficiency?.summary ? <p className="sr-only">{efficiency.summary}</p> : null}

    </section>
  )
}

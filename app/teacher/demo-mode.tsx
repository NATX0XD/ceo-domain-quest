'use client'

import { useState } from 'react'
import { Icon3d, InfoTip } from './_ux/v2'
import { Button } from './_ux/ui'

/**
 * E-16 โหมดสาธิต — ป้ายบอกว่านี่ไม่ใช่ข้อมูลเด็กจริง + ปุ่มล้างกลับค่าเริ่มต้น
 *
 * ทำไมต้องมีป้าย: วันแข่งกรรมการดูจอเดียวกับครู ถ้าไม่ติดป้าย ตัวเลขห้องหุ่นจะถูกเข้าใจว่า
 * เป็นผลการทดลองจริง — ป้ายนี้จึงขึ้นทุกหน้าของครูที่กำลังเลือกห้องสาธิตอยู่ ไม่ใช่แค่หน้าเดียว
 *
 * ทำไมต้องยืนยันก่อนล้าง: ปุ่มนี้ลบนักเรียนทั้งห้อง กดพลาดกลางเวทีแล้วกู้ไม่ได้
 * จึงต้องกด 2 จังหวะ และจังหวะที่ 2 ส่ง `roomCode` ไปให้เซิร์ฟเวอร์เทียบกับห้องที่เลือกจริง
 *
 * ⚠️ ปุ่มนี้ **ไม่ใช่** ด่านกันห้องเรียนจริง — ด่านจริงอยู่ที่ `reset_demo_classroom` ในฐานข้อมูล
 *    ซึ่งปฏิเสธห้องที่ไม่ได้ติดป้าย is_demo ต่อให้ยิง API ตรงข้ามหน้าจอนี้ไปก็ล้างไม่ได้
 */

interface DemoModeProps {
  classroomId: string | null
  roomCode: string | null
  isDemo: boolean
  /** true = แสดงปุ่มล้างด้วย (แผงครูหน้าแรก) · false = ป้ายอย่างเดียว (หน้ารายงาน/แผงสด) */
  showReset?: boolean
}

interface ResetResponse {
  ok?: boolean
  message?: string
  elapsedMs?: number
  cleared?: { students?: number }
  seeded?: { students?: number; pendingReview?: number; planRequests?: number }
}

export function DemoModeBanner({ classroomId, roomCode, isDemo, showReset = false }: DemoModeProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isDemo) return null

  async function reset() {
    if (!classroomId || !roomCode) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await fetch('/api/teacher/demo-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classroomId, roomCode }),
      })
      const json = (await res.json().catch(() => null)) as (ResetResponse & { message?: string }) | null
      if (!res.ok) {
        setError(json?.message ?? `ล้างไม่สำเร็จ (สถานะ ${res.status})`)
        return
      }
      setDone(
        `${json?.message ?? 'ล้างห้องสาธิตแล้ว'} · นักเรียนหุ่น ${json?.seeded?.students ?? 0} คน · ` +
          `รอตรวจ ${json?.seeded?.pendingReview ?? 0} ใบ · ใช้เวลา ${json?.elapsedMs ?? 0} ms`,
      )
      setConfirming(false)
      /**
       * โหลดหน้าใหม่ทั้งหน้า ไม่ใช่ router.refresh()
       * เพราะบนจอนี้มีทั้งส่วนที่เซิร์ฟเวอร์เรนเดอร์ (คิวตรวจ) และส่วนที่ poll เอง (แผงคำขอ/ธง)
       * รีเฟรชครึ่งเดียวแล้วเหลือเลขเก่าค้างบนเวทีดูแย่กว่ารอโหลดอีกหนึ่งวินาที
       */
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ล้างไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      role="region"
      aria-label="โหมดสาธิต"
      className="mb-4 flex shrink-0 items-start gap-3 rounded-xl border px-4 py-3"
      style={{ background: 'var(--s-warn-soft)', borderColor: 'var(--s-warn)' }}
    >
      <span aria-hidden className="mt-0.5 shrink-0"><Icon3d name="performing-arts" size={28} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-[var(--s-warn-ink)]">
          <span className="mr-2 rounded-md bg-[var(--s-warn)] px-1.5 py-0.5 text-[12px] font-bold tracking-wide text-white">DEMO</span>
          โหมดสาธิต · ห้อง {roomCode ?? '-'}
        </p>
        <p className="mt-0.5 text-[14px] text-pretty text-[var(--s-warn-ink)]">
          ข้อมูลเป็น<strong>นักเรียนหุ่น</strong> ·{' '}
          <strong>ห้ามนำตัวเลขจากห้องนี้ไปอ้างเป็นผลการทดลอง</strong>
        </p>

        {showReset ? (
          <div className="mt-3">
            {confirming ? (
              <div className="rounded-lg border border-[var(--c-line)] bg-white p-3">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[var(--c-ink)]">
                  ล้างห้อง {roomCode} กลับค่าเริ่มต้นใช่ไหม
                  <InfoTip
                    label="เรื่องการล้างห้อง"
                    text="นักเรียนหุ่นทั้งห้องกับงานที่ทำไว้จะถูกลบแล้วสร้างใหม่ชุดเดิม กู้ของเดิมกลับไม่ได้ ห้องเรียนจริงกดปุ่มนี้ไม่ได้อยู่แล้ว"
                  />
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={busy}
                    className="inline-flex h-9 items-center rounded-lg bg-[var(--s-danger)] px-3 text-[14px] font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none disabled:opacity-50"
                  >
                    {busy ? 'กำลังล้าง…' : 'ใช่ ล้างเลย'}
                  </button>
                  <Button size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                    ไม่ล้าง
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                kind="danger"
                size="sm"
                onClick={() => {
                  setConfirming(true)
                  setDone(null)
                  setError(null)
                }}
              >
                ล้างห้องสาธิตกลับค่าเริ่มต้น
              </Button>
            )}

            {done ? (
              <p role="status" className="mt-2 text-[14px] font-medium text-[var(--c-ink)]">
                {done}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-2 text-[14px] font-medium text-[var(--s-danger-ink)]">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

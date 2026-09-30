'use client'

import { useState } from 'react'
import { AlertIcon, Card, cn } from '../../components/ui'

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
    <Card tone="danger" className="mt-4" role="region" aria-label="โหมดสาธิต">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-danger-700">
          <AlertIcon width={24} height={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label font-extrabold tracking-wide text-danger-700">
            โหมดสาธิต · ห้อง {roomCode ?? '-'}
          </p>
          <p className="mt-1 text-body text-pretty text-ink">
            ข้อมูลในห้องนี้เป็น<strong>นักเรียนหุ่น</strong>ที่ระบบสร้างขึ้นเพื่อสาธิต
            ไม่ใช่ข้อมูลของนักเรียนจริง และ<strong>ห้ามนำตัวเลขจากห้องนี้ไปอ้างเป็นผลการทดลอง</strong>
          </p>

          {showReset ? (
            <div className="mt-3">
              {confirming ? (
                <div className="rounded-xl bg-surface-raised p-3 ring-2 ring-danger-500 ring-inset">
                  <p className="text-body font-bold text-ink">
                    ล้างห้อง {roomCode} กลับค่าเริ่มต้นใช่ไหม
                  </p>
                  <p className="mt-1 text-label text-ink-muted">
                    นักเรียนหุ่นทั้งห้องกับงานที่ทำไว้จะถูกลบแล้วสร้างใหม่ชุดเดิม กู้ของเดิมกลับไม่ได้
                    · ห้องเรียนจริงกดปุ่มนี้ไม่ได้อยู่แล้ว
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={reset}
                      disabled={busy}
                      className="btn-base bg-danger-600 px-4 text-ink-onbrand shadow-soft-1 disabled:opacity-60"
                    >
                      {busy ? 'กำลังล้าง…' : 'ใช่ ล้างเลย'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={busy}
                      className="btn-base bg-surface-raised px-4 text-ink ring-2 ring-line-contrast ring-inset"
                    >
                      ไม่ล้าง
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(true)
                    setDone(null)
                    setError(null)
                  }}
                  className={cn(
                    'btn-base bg-surface-raised px-4 text-danger-700',
                    'ring-2 ring-danger-500 ring-inset hover:bg-danger-100',
                  )}
                >
                  ล้างห้องสาธิตกลับค่าเริ่มต้น
                </button>
              )}

              {done ? (
                <p role="status" className="mt-2 text-label font-bold text-ink">
                  {done}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="mt-2 text-label font-bold text-danger-700">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

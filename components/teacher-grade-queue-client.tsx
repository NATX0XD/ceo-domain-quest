'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon, Button, CheckIcon, ClockIcon, RefreshIcon, cn } from '@/components/ui'

/**
 * ตัวปลุก worker ตรวจงาน — ใช้แผงครูที่เปิดค้างอยู่แล้วเป็นตัวเดินคิว
 *
 * ทำไมไม่ใช้ cron: ครูเปิดแผงนี้ทิ้งไว้ทั้งคาบอยู่แล้ว ไม่ต้องพึ่งบริการภายนอก
 * ไม่ต้องตั้งอะไรตอน deploy และครูไม่ต้องกดอะไรเพิ่ม
 *
 * กติกาที่ห้ามผิด:
 * 1. **ห้ามยิง drain ซ้อนกัน** — รอบก่อนยังไม่จบ ห้ามเริ่มรอบใหม่ (กันทั้งปุ่มและตัวตั้งเวลา)
 *    ฝั่งเซิร์ฟเวอร์มีกันซ้อนอีกชั้น (`drainQueue` คืน `skipped: true`) เผื่อครูเปิดหลายแท็บ
 * 2. ปิดแท็บได้ตลอด งานที่ค้างจะถูก `reclaimStaleGradeJobs()` ดึงกลับเข้าคิวรอบหน้า
 * 3. หน้านี้แค่ "ปลุก" ไม่ได้ตัดสินคะแนนเอง ทุกอย่างตัดสินฝั่งเซิร์ฟเวอร์
 */

/** ถามจำนวนงานในคิวถี่ได้ เพราะเป็นแค่ count() ไม่ได้ดึงแถว */
const STATUS_POLL_MS = 5_000
/** เว้นช่วงหลัง drain จบ ก่อนเริ่มรอบถัดไป — กันยิงรัวตอนคิวว่าง */
const IDLE_GAP_MS = 4_000

interface QueueCounts {
  pending: number
  running: number
  done: number
  failed: number
}

interface DrainResult {
  reclaimed?: number
  processed?: number
  skipped?: boolean
  queue?: QueueCounts
  message?: string
}

export function TeacherGradeQueueClient() {
  const router = useRouter()
  const [counts, setCounts] = useState<QueueCounts | null>(null)
  const [running, setRunning] = useState(false)
  const [doneThisSession, setDoneThisSession] = useState(0)
  const [error, setError] = useState<string | null>(null)

  /** กันยิงซ้อน — ต้องเป็น ref ไม่ใช่ state เพราะ state อัปเดตช้ากว่าการกดปุ่มรัว */
  const busyRef = useRef(false)
  const aliveRef = useRef(true)

  const runDrain = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setRunning(true)
    try {
      const res = await fetch('/api/jobs/drain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => null)) as DrainResult | null
      if (!res.ok) {
        setError(data?.message ?? 'สั่งตรวจไม่สำเร็จ ลองกดปุ่มตรวจเดี๋ยวนี้อีกครั้ง')
        return
      }
      setError(null)
      if (data?.queue) setCounts(data.queue)
      const processed = data?.processed ?? 0
      if (processed > 0) {
        setDoneThisSession((n) => n + processed)
        // ผลที่ AI เสนอเพิ่งถูกเขียนลงใบงาน ต้องรีเฟรชการ์ดฝั่งเซิร์ฟเวอร์ให้ครูเห็น
        router.refresh()
      }
    } catch {
      setError('ต่อเซิร์ฟเวอร์ไม่ได้ คิวจะเดินต่อเมื่อเน็ตกลับมา')
    } finally {
      busyRef.current = false
      setRunning(false)
    }
  }, [router])

  useEffect(() => {
    aliveRef.current = true

    async function loop() {
      while (aliveRef.current) {
        try {
          const res = await fetch('/api/jobs/drain', { method: 'GET' })
          if (res.ok) {
            const data = (await res.json()) as QueueCounts
            if (!aliveRef.current) return
            setCounts(data)
            // งาน claimed ที่ค้างจากแท็บที่ปิดไปก็นับรวม รอบ drain จะ reclaim ให้เอง
            if (data.pending + data.running > 0) {
              await runDrain()
              await sleep(IDLE_GAP_MS)
              continue
            }
          }
        } catch {
          // เน็ตสะดุด รอบหน้าค่อยว่ากัน ไม่ต้องขึ้นข้อความรบกวนครู
        }
        await sleep(STATUS_POLL_MS)
      }
    }

    void loop()
    return () => {
      aliveRef.current = false
    }
  }, [runDrain])

  const waiting = (counts?.pending ?? 0) + (counts?.running ?? 0)

  return (
    <div className="mb-4 rounded-2xl bg-surface-raised p-4 ring-1 ring-line ring-inset">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-label font-bold text-ink">
            <span
              aria-hidden="true"
              className={cn(
                'inline-block size-2.5 shrink-0 rounded-full',
                running || counts === null
                  ? 'animate-pulse bg-brand-600'
                  : waiting > 0
                    ? 'bg-spark-500'
                    : 'bg-quest-500',
              )}
            />
            {/* เพิ่งเปิดหน้า ยังไม่รู้จำนวนคิว — ห้ามขึ้นว่า "อ่านครบแล้ว" เพราะอาจมีงานค้างอยู่
                ⚠️ ทุกคำในกล่องนี้ต้องมีคำว่า "AI" กำกับ ไม่งั้นครูอ่านสลับกับช่อง "รอครูยืนยัน"
                   ข้างบน แล้วเห็นเลขสองตัวขัดกันบนจอเดียว (flow-1.md ข้อ 7) */}
            {running
              ? 'AI กำลังอ่านงานอยู่…'
              : counts === null
                ? 'กำลังดูคิวของ AI…'
                : waiting > 0
                  ? 'มีงานรอให้ AI อ่าน'
                  : 'AI อ่านงานล่วงหน้าให้ครู'}
          </p>
          {/* aria-live เพื่อให้ครูที่ใช้โปรแกรมอ่านจอรู้ว่าคิวขยับ */}
          <p aria-live="polite" className="mt-1 text-label text-ink-muted">
            {counts === null
              ? 'กำลังนับงานในคิวของ AI'
              : waiting === 0
                ? `AI อ่านครบแล้ว ไม่มีงานค้างในคิว AI · อ่านไปแล้ว ${doneThisSession} ชิ้นตั้งแต่เปิดหน้านี้`
                : `คิวของ AI: รออ่าน ${counts.pending} ชิ้น · กำลังอ่าน ${counts.running} ชิ้น · อ่านไปแล้ว ${doneThisSession} ชิ้นตั้งแต่เปิดหน้านี้`}
            {counts && counts.failed > 0 ? ` · AI อ่านไม่สำเร็จ ${counts.failed} ชิ้น` : ''}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={runDrain}
          disabled={running}
          loading={running}
          loadingLabel="AI กำลังอ่าน"
          leadingIcon={<RefreshIcon width={20} height={20} />}
        >
          {/* ของเดิมเขียนว่า "ตรวจเดี๋ยวนี้" ครูกดแล้วคาดว่าจะได้ตรวจงานเอง
              แต่จริง ๆ เป็นการสั่งให้ AI ไล่อ่านคิวเบื้องหลัง (flow-1.md ข้อ 6) */}
          ให้ AI อ่านงานที่ค้างเดี๋ยวนี้
        </Button>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-label text-ink-muted">
        {waiting > 0 ? (
          <ClockIcon width={16} height={16} aria-hidden className="mt-0.5 shrink-0" />
        ) : (
          <CheckIcon width={16} height={16} aria-hidden className="mt-0.5 shrink-0 text-quest-600" />
        )}
        <span>
          กล่องนี้เป็นคิวของ AI ล้วน ๆ ไม่ใช่งานที่รอครูยืนยัน · เปิดหน้านี้ค้างไว้ระบบจะทยอยให้ AI
          อ่านเอง ปิดแท็บแล้วงานไม่หาย เปิดใหม่เมื่อไรก็อ่านต่อจากเดิม ·
          คะแนนของ AI เป็นแค่ข้อเสนอ ครูยืนยันเสมอ
        </span>
      </p>

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

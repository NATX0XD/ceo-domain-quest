'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, ClockIcon, DomeAvatar, InfoIcon, cn } from '@/components/ui'
import { PresenceHeartbeat } from '@/components/presence-client'

/**
 * S-11 นาฬิกาช่วงกิจกรรม + หน้าพัก "ดูจอหน้าห้องนะ" (SC-23)
 *
 * ⚠️ **ห้ามจับเวลารายข้อ** (สเปกข้อ 2.7) นาฬิกานี้เป็นของ "ช่วงกิจกรรม" ทั้งห้องเท่านั้น
 * ⚠️ สีคงที่ ไม่เปลี่ยนเป็นแดงตอนใกล้หมด เพื่อลดความกดดัน (กฎ S-11)
 * เวลาที่เหลือมาจากเซิร์ฟเวอร์ ไม่ได้คิดจากนาฬิกาของเครื่องเด็ก (เครื่องตั้งเวลาเพี้ยนก็ยังตรงกันทั้งห้อง)
 */

/** ถามเซิร์ฟเวอร์ทุกกี่วินาที — เกณฑ์ตรวจรับคือเปลี่ยนตามครูภายใน 3 วินาที */
const POLL_MS = 3000

interface SessionState {
  active: boolean
  phase: string | null
  phaseLabel?: string
  remainingSeconds?: number | null
  paused?: boolean
  showClock?: boolean
  warn?: boolean
  restMode?: boolean
  restReason?: string
}

function mmss(total: number): string {
  const safe = Math.max(0, total)
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function SessionClock() {
  const [state, setState] = useState<SessionState | null>(null)
  /** นับถอยหลังในเครื่องระหว่างรอบ poll เพื่อให้ตัวเลขเดินลื่น ค่าจริงยังมาจากเซิร์ฟเวอร์ทุก 3 วินาที */
  const [seconds, setSeconds] = useState<number | null>(null)
  /** เด็กกด "กลับไปทำต่อ" เอง — ปิดหน้าพักเฉพาะเครื่องนี้ จนกว่าครูจะสั่งใหม่ */
  const [dismissedRest, setDismissedRest] = useState(false)
  const restKeyRef = useRef<string>('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/session')
      if (!res.ok) return
      const data = (await res.json()) as SessionState
      setState(data)
      setSeconds(typeof data.remainingSeconds === 'number' ? data.remainingSeconds : null)

      // ครูสั่งพักรอบใหม่ (เปลี่ยนช่วง หรือกดปุ่มจอหน้าห้องอีกครั้ง) = หน้าพักกลับมาใหม่
      const key = `${data.phase}:${data.restMode}`
      if (key !== restKeyRef.current) {
        restKeyRef.current = key
        setDismissedRest(false)
      }
    } catch {
      // เน็ตสะดุด รอบหน้าค่อยว่ากัน ไม่ขึ้นข้อความรบกวนเด็ก
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (seconds === null || state?.paused) return
    const id = setInterval(() => setSeconds((s) => (s === null ? null : Math.max(0, s - 1))), 1000)
    return () => clearInterval(id)
  }, [seconds === null, state?.paused])

  /**
   * ครูยังไม่เปิดคาบ = ไม่มีแถบเวลาให้แสดง **แต่จุดเต้นของหัวใจต้องเต้นต่อ**
   * เพราะเกณฑ์คู่หูดูแค่ว่า "ยังนั่งอยู่ไหม" ไม่ได้ผูกกับคาบ
   */
  if (!state?.active) return <PresenceHeartbeat />

  const showRest = state.restMode === true && !dismissedRest

  return (
    <>
      {/* E-04 บอกเซิร์ฟเวอร์ว่ายังนั่งอยู่ — ตัวนี้อยู่ที่เดียวแต่ครบทุกหน้าของนักเรียน
          เพราะ SessionClock ถูกเรนเดอร์ในชั้น header ของ StudentShell ทุกหน้า */}
      <PresenceHeartbeat />
      {/* แถบช่วงและนาฬิกา อยู่บนสุดของทุกหน้า (สเปกข้อ 5.1 ตารางส่วนประกอบหน้าจอ)
          ไม่ต้อง sticky แล้ว — อยู่ในชั้น header ของ AppShell ซึ่งอยู่กับที่โดยตัวมันเอง */}
      <div
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-2 bg-brand-50 px-4 py-2 text-label ring-1 ring-brand-100 ring-inset"
      >
        <p className="flex min-w-0 items-center gap-1.5 font-bold text-brand-700">
          <ClockIcon width={16} height={16} aria-hidden className="shrink-0" />
          {state.phaseLabel ?? 'ช่วงของคาบ'}
        </p>
        {state.showClock && seconds !== null ? (
          <p className="shrink-0 font-bold tabular-nums text-ink">
            {state.paused ? 'หยุดเวลาไว้ ' : 'เหลือ '}
            {mmss(seconds)}
          </p>
        ) : null}
      </div>

      {/* เหลือ 2 นาที บอกเบา ๆ และย้ำว่าระบบบันทึกให้แล้ว (S-11 ข้อ 2) */}
      {state.warn && !showRest ? (
        <p
          role="status"
          className="mx-4 mt-2 mb-1 flex items-start gap-2 rounded-xl bg-spark-50 p-3 text-label text-ink ring-1 ring-spark-100 ring-inset"
        >
          <InfoIcon width={18} height={18} aria-hidden className="mt-0.5 shrink-0 text-spark-700" />
          <span>อีก 2 นาทีจะไปช่วงถัดไป ระบบบันทึกงานให้แล้ว</span>
        </p>
      ) : null}

      {/* หน้าพัก — ทับทั้งจอ แต่ไม่ล็อกเครื่อง เด็กกดกลับไปทำต่อเองได้ */}
      {showRest ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ดูจอหน้าห้อง"
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-surface px-6 text-center',
          )}
        >
          <DomeAvatar mood="greet" size={140} decorative />
          <p className="text-label font-bold text-brand-700">{state.restReason}</p>
          <h2 className="text-hero font-extrabold text-balance text-ink">ดูจอหน้าห้องนะ</h2>
          <p className="max-w-[24rem] text-body text-pretty text-ink-muted">
            งานของเราถูกบันทึกไว้แล้ว ไม่หายไปไหน เดี๋ยวกลับมาทำต่อได้เลย
          </p>
          {state.showClock && seconds !== null ? (
            <p className="text-title font-extrabold tabular-nums text-ink">{mmss(seconds)}</p>
          ) : null}
          <Button variant="secondary" onClick={() => setDismissedRest(true)}>
            กลับไปทำต่อ
          </Button>
        </div>
      ) : null}
    </>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertIcon, Button, CheckIcon, ClockIcon, cn } from '@/components/ui'

/**
 * T-03 ครูคุมช่วงของคาบและเวลา
 *
 * ทุกคำสั่งยิงไป `POST /api/teacher/session` ซึ่งตรวจเจ้าของห้องใน SQL
 * หน้านี้ไม่ตัดสินอะไรเอง แค่ส่งคำสั่งแล้วแสดงสถานะที่เซิร์ฟเวอร์ตอบกลับ
 *
 * ⚠️ ปิดคาบต้องกด 2 ครั้ง (กฎ T-03) · ย้อนช่วงได้ภายใน 30 วินาที
 * ⚠️ "ให้ทุกคนดูจอหน้าห้อง" ไม่ล็อกเครื่องเด็ก เด็กกดกลับไปทำต่อเองได้ (SC-23)
 */

/** ถามสถานะทุกกี่วินาที — เกณฑ์ตรวจรับคือทุกเครื่องเปลี่ยนตามภายใน 3 วินาที */
const POLL_MS = 3000

/** เวลาตั้งต้นของแต่ละช่วง (นาที) ตามตารางเวลาคาบในสเปกข้อ 11.x */
const PHASE_MINUTES: Record<string, number> = {
  wait: 0,
  onboard: 5,
  mission: 20,
  boss: 10,
  summary: 5,
  reflect: 5,
  end: 0,
  home: 0,
}

interface PhaseOption {
  phase: string
  label: string
}

interface SessionInfo {
  id: string
  phase: string
  timer_end_at: string | null
  timer_paused_seconds: number | null
  focus_screen: boolean
  survey_enabled: boolean
  ended_at: string | null
}

function mmss(total: number | null): string {
  if (total === null) return '—'
  const safe = Math.max(0, total)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function TeacherSessionClient({ classroomId }: { classroomId: string | null }) {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [phases, setPhases] = useState<PhaseOption[]>([])
  const [seconds, setSeconds] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const lastPhaseChangeRef = useRef<number>(0)
  const [undoLeft, setUndoLeft] = useState(0)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/session?classroomId=${classroomId}`)
      if (!res.ok) return
      const data = (await res.json()) as { session?: SessionInfo; phases?: PhaseOption[] }
      if (data.session) {
        setSession(data.session)
        const paused = data.session.timer_paused_seconds !== null
        setSeconds(
          paused
            ? data.session.timer_paused_seconds
            : data.session.timer_end_at
              ? Math.max(
                  0,
                  Math.round((new Date(data.session.timer_end_at).getTime() - Date.now()) / 1000),
                )
              : null,
        )
      }
      if (data.phases) setPhases(data.phases)
    } catch {
      // เงียบไว้ รอบถัดไปค่อยลองใหม่
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  // นับถอยหลังในเครื่องให้ตัวเลขเดินลื่น ค่าจริงยังมาจากเซิร์ฟเวอร์ทุกรอบ poll
  useEffect(() => {
    if (seconds === null || session?.timer_paused_seconds !== null) return
    const id = setInterval(() => setSeconds((s) => (s === null ? null : Math.max(0, s - 1))), 1000)
    return () => clearInterval(id)
  }, [seconds === null, session?.timer_paused_seconds])

  // ตัวนับ "ย้อนช่วงได้อีกกี่วินาที" — ฝั่งเซิร์ฟเวอร์เป็นคนตัดสินจริงว่าเกิน 30 วินาทีหรือยัง
  useEffect(() => {
    const id = setInterval(() => {
      const left = 30 - Math.round((Date.now() - lastPhaseChangeRef.current) / 1000)
      setUndoLeft(lastPhaseChangeRef.current === 0 ? 0 : Math.max(0, left))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      if (busy) return null
      setBusy(true)
      setError(null)
      try {
        const res = await fetch('/api/teacher/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          message?: string
          session?: SessionInfo
        } | null
        if (!res.ok || !data?.ok) {
          setError(data?.message ?? 'สั่งงานไม่สำเร็จ ลองใหม่อีกครั้ง')
          return null
        }
        if (data.session) setSession(data.session)
        await load()
        return data
      } catch {
        setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
        return null
      } finally {
        setBusy(false)
      }
    },
    [busy, load],
  )

  if (!classroomId) return null

  if (!session) {
    return (
      <div className="mt-4 rounded-2xl bg-surface-raised p-4 ring-1 ring-line ring-inset">
        <p className="text-label text-ink-muted">กำลังอ่านสถานะคาบ…</p>
      </div>
    )
  }

  const paused = session.timer_paused_seconds !== null

  return (
    <div className="mt-4 rounded-2xl bg-surface-raised p-4 ring-1 ring-line ring-inset">
      <h3 className="text-body-lg font-bold text-ink">ช่วงของคาบ</h3>
      <p className="mt-1 text-label text-ink-muted">
        กดย้ายทั้งห้องได้ในแตะเดียว ข้ามช่วงได้ · เครื่องนักเรียนเปลี่ยนตามภายใน 3 วินาที
      </p>

      {/* แถวช่วง — ช่วงปัจจุบันมีทั้งสีและไอคอนกำกับ ไม่ได้สื่อด้วยสีอย่างเดียว */}
      <ul className="mt-3 flex flex-wrap gap-2">
        {phases.map((p) => (
          <li key={p.phase}>
            <Button
              variant={p.phase === session.phase ? 'primary' : 'secondary'}
              size="sm"
              disabled={busy}
              leadingIcon={
                p.phase === session.phase ? <CheckIcon width={16} height={16} /> : undefined
              }
              onClick={async () => {
                const minutes = PHASE_MINUTES[p.phase] ?? 0
                const done = await send({
                  action: 'phase',
                  sessionId: session.id,
                  phase: p.phase,
                  ...(minutes > 0 ? { timerSeconds: minutes * 60 } : {}),
                })
                if (done) lastPhaseChangeRef.current = Date.now()
              }}
            >
              {p.label}
            </Button>
          </li>
        ))}
      </ul>

      {/* นาฬิกาของช่วง + ปุ่มคุมเวลา */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface-sunken p-3">
        <p className="flex min-w-0 items-center gap-2 text-body font-bold text-ink">
          <ClockIcon width={20} height={20} aria-hidden className="shrink-0" />
          <span className="tabular-nums">
            {paused ? 'หยุดไว้ที่ ' : 'เหลือ '}
            {mmss(seconds)}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {[1, 3, 5].map((m) => (
            <Button
              key={m}
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => send({ action: 'extend', sessionId: session.id, addSeconds: m * 60 })}
            >
              +{m} นาที
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => send({ action: 'pause', sessionId: session.id, paused: !paused })}
          >
            {paused ? 'เดินต่อ' : 'หยุด'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              send({
                action: 'timer',
                sessionId: session.id,
                seconds: (PHASE_MINUTES[session.phase] ?? 5) * 60,
              })
            }
          >
            ตั้งใหม่
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant={session.focus_screen ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => send({ action: 'focus', sessionId: session.id, on: !session.focus_screen })}
        >
          {session.focus_screen ? 'เลิกให้ดูจอหน้าห้อง' : 'ให้ทุกคนดูจอหน้าห้อง'}
        </Button>

        <Button
          variant="secondary"
          disabled={busy || undoLeft <= 0}
          onClick={async () => {
            const done = await send({ action: 'revert', sessionId: session.id })
            if (done) lastPhaseChangeRef.current = 0
          }}
        >
          ย้อนการย้ายช่วง{undoLeft > 0 ? ` (${undoLeft} วินาที)` : ''}
        </Button>

        {/* แบบสอบถามความพึงพอใจ — ค่าเริ่มต้นปิด ครูเป็นคนเปิด (S-40 ข้อ 1 · T-02) */}
        <Button
          variant={session.survey_enabled ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() =>
            send({
              action: 'settings',
              sessionId: session.id,
              surveyEnabled: !session.survey_enabled,
            })
          }
        >
          {session.survey_enabled ? 'ปิดแบบสอบถาม' : 'เปิดแบบสอบถามความพึงพอใจ'}
        </Button>

        {/* ปิดคาบต้องกดยืนยัน 2 ครั้ง */}
        <Button
          variant={confirmClose ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={async () => {
            if (!confirmClose) {
              setConfirmClose(true)
              return
            }
            await send({ action: 'close', sessionId: session.id })
            setConfirmClose(false)
          }}
        >
          {confirmClose ? 'กดอีกครั้งเพื่อปิดคาบจริง' : 'ปิดคาบ'}
        </Button>
      </div>

      <p className={cn('mt-3 text-label', session.focus_screen ? 'text-brand-700' : 'text-ink-muted')}>
        {session.focus_screen
          ? 'ตอนนี้จอนักเรียนขึ้นหน้าพัก "ดูจอหน้าห้องนะ" ทุกเครื่อง'
          : 'ช่วง "ครูสรุป" จอนักเรียนจะขึ้นหน้าพักให้เองโดยไม่ต้องกดปุ่มนี้'}
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

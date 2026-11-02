'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CHANNEL_LABELS,
  LEARNING_CHANNELS,
  MAX_EXTRA_MINUTES,
  MIN_EXTRA_MINUTES,
  PLAN_REQUEST_LABELS,
  type PlanRequestKind,
  type PlanRequestStatus,
} from '../../../core/plan-request'
import { Icon3d, InfoTip } from '../_ux/v2'
import { StatusBadge } from '../_ux/ui'

/**
 * S-08 คำขอเปลี่ยนแผนจากผู้เรียน — ฝั่งครู
 *
 * ก่อนหน้านี้ตาราง + API ครบตั้งแต่ T52/T57 แต่ **ไม่มีหน้าจอไหนเรียกเลย** (QA-3 ข้อ 1.3)
 * ข้อความที่ API ตอบเด็กว่า "ครูเห็นบนแผงของครูทันที" จึงยังไม่จริง — จอนี้ทำให้มันจริง
 *
 * วางไว้ในแผงห้องเรียนสดเพราะครูเฝ้าจอนั้นอยู่แล้วระหว่างคาบ ไม่ต้องสลับหน้า
 *
 * ⚠️ **เหตุผลที่เด็กพิมพ์เองต้องขึ้นเต็ม ๆ ห้ามตัดคำ** ครูตัดสินจากคำของเด็ก ไม่ใช่จากป้ายชนิดคำขอ
 * ⚠️ หน้าจอไม่ตัดสินอะไรเอง ทุกปุ่มยิงไป `/api/plan-request/respond` ซึ่งตรวจเจ้าของห้องใน SQL คำสั่งเดียว
 * ⚠️ เก็บทั้งสิ่งที่ขอและสิ่งที่ครูให้จริง — "ให้แบบอื่นแทน" จึงบังคับให้เลือกค่าก่อนกดได้
 */

const POLL_MS = 5000

interface PlanRequestRow {
  id: string
  studentId: string
  nickname: string | null
  kind: PlanRequestKind
  missionId: string | null
  requestedValue: string | null
  reason: string
  status: string
  grantedValue: string | null
  teacherResponse: string | null
  respondedAt: string | null
  createdAt: string
  summary: string
}

interface PlanRequestResponse {
  ok: boolean
  role: string
  pendingCount: number
  requests: PlanRequestRow[]
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอครูตอบ',
  approved: 'ครูให้ตามที่ขอ',
  rejected: 'ครูยังไม่ให้รอบนี้',
  changed: 'ครูให้แบบอื่นแทน',
}

function waitedText(createdAt: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 1000))
  if (seconds < 60) return 'เพิ่งขอเมื่อครู่'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `รอมาแล้ว ${minutes} นาที`
  return `รอมาแล้ว ${Math.round(minutes / 60)} ชั่วโมง`
}

/** ตัวเลือกที่ครูหยิบให้แทนได้ ตรงกับค่าที่ normalizeRequestedValue ยอมรับ */
function optionsFor(kind: PlanRequestKind): { value: string; label: string }[] {
  if (kind === 'level') return [1, 2, 3].map((n) => ({ value: String(n), label: `ระดับ ${n}` }))
  if (kind === 'channel') {
    return LEARNING_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))
  }
  if (kind === 'time') {
    return [3, 5, 10, MAX_EXTRA_MINUTES]
      .filter((n) => n >= MIN_EXTRA_MINUTES && n <= MAX_EXTRA_MINUTES)
      .map((n) => ({ value: String(n), label: `${n} นาที` }))
  }
  // 'skip' ไม่มีค่าให้เลือก ตัวคำขอเองคือคำตอบอยู่แล้ว
  return []
}

export function PlanRequests({
  classroomId,
  initialData = null,
}: {
  classroomId: string | null
  /** ใส่ค่าเริ่มต้นได้เพื่อให้เทสต์เรนเดอร์ตรวจได้โดยไม่ต้องยิงเครือข่าย */
  initialData?: PlanRequestResponse | null
}) {
  const [data, setData] = useState<PlanRequestResponse | null>(initialData)
  const [showAnswered, setShowAnswered] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** ค่าที่ครูเลือกจะให้แทน และข้อความตอบกลับ แยกตามใบคำขอ */
  const [granted, setGranted] = useState<Record<string, string>>({})
  const [replies, setReplies] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(
        `/api/plan-request?classroomId=${classroomId}${showAnswered ? '&all=1' : ''}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return
      setData((await res.json()) as PlanRequestResponse)
    } catch {
      // เน็ตสะดุดรอบเดียว ไม่ต้องล้างของเดิมทิ้ง
    }
  }, [classroomId, showAnswered])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  async function answer(row: PlanRequestRow, status: PlanRequestStatus) {
    if (busyId) return
    const grantedValue = granted[row.id] ?? null

    if (status === 'changed' && !grantedValue) {
      setError('เลือก “ให้แบบอื่นแทน” ต้องกดเลือกก่อนว่าจะให้อะไรแทน เด็กจะได้รู้ว่าต้องทำอะไรต่อ')
      return
    }

    setBusyId(row.id)
    setError(null)
    try {
      const res = await fetch('/api/plan-request/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestId: row.id,
          status,
          kind: row.kind,
          response: (replies[row.id] ?? '').trim() || null,
          grantedValue: status === 'changed' ? grantedValue : null,
        }),
      })
      const body = (await res.json().catch(() => null)) as
        | { answer?: string; message?: string }
        | null

      if (!res.ok) {
        setError(body?.message ?? 'ตอบคำขอไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      // ประโยคเดียวกับที่เด็กจะเห็นบนจอ ครูจะได้ไม่เข้าใจคนละอย่าง
      setNotice(`${row.nickname ?? 'ผู้เรียน'}: ${body?.answer ?? 'ตอบคำขอแล้ว'}`)
      setReplies((prev) => ({ ...prev, [row.id]: '' }))
      await load()
    } catch {
      setError('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  if (!classroomId) return null

  const rows = data?.requests ?? []
  const pending = rows.filter((r) => r.status === 'pending')
  const answered = rows.filter((r) => r.status !== 'pending')

  const initial = (name: string | null) => Array.from((name ?? 'ผ').trim())[0] ?? '?'

  return (
    <section className="t2-card" aria-label="คำขอเปลี่ยนแผนจากผู้เรียน">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t2-card-title" style={{ margin: 0 }}>
          <Icon3d name="speech-balloon" size={36} />
          คำขอจากนักเรียน
          {pending.length > 0 ? <StatusBadge status="atrisk">รอตอบ {pending.length}</StatusBadge> : null}
          <InfoTip
            label="เรื่องคำขอ"
            text="นักเรียนขอเปลี่ยนระดับ เปลี่ยนช่องทาง ขอข้าม หรือขอเวลาเพิ่มได้จากหน้าของตัวเอง แล้วคำขอจะเด้งขึ้นตรงนี้เอง"
          />
        </h2>
        <button
          type="button"
          onClick={() => setShowAnswered((v) => !v)}
          className="t2-btn focus-ring"
          data-size="sm"
        >
          {showAnswered ? 'เฉพาะที่รอตอบ' : 'ดูที่ตอบแล้ว'}
        </button>
      </div>

      {notice ? (
        <p className="t2-note mt-3" data-tone="quest">
          <Icon3d name="check-mark-button" size={28} />
          <span>{notice}</span>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="t2-note mt-3" data-tone="danger">
          <Icon3d name="warning" size={28} />
          <span>{error}</span>
        </p>
      ) : null}

      {pending.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-label font-extrabold text-ink">
          <Icon3d name="sparkles" size={28} />
          ยังไม่มีคำขอที่รอตอบ
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {pending.map((row) => {
            const options = optionsFor(row.kind)
            const picked = granted[row.id] ?? ''
            return (
              <li key={row.id} className="rounded-xl border border-[var(--c-line)] bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="t2-avatar" aria-hidden>
                    {initial(row.nickname)}
                  </span>
                  <p className="min-w-0 flex-1 text-body-lg font-extrabold text-ink">
                    {row.nickname ?? 'ผู้เรียน'}
                    <span className="ml-2 align-middle">
                      <StatusBadge status="inprogress">{PLAN_REQUEST_LABELS[row.kind]}</StatusBadge>
                    </span>
                  </p>
                  <StatusBadge status="atrisk">{waitedText(row.createdAt)}</StatusBadge>
                </div>

                <p className="mt-2 text-label font-extrabold text-ink">{row.summary}</p>

                {/* ข้อความของเด็ก — ขึ้นเต็ม ไม่ตัด ไม่ย่อ */}
                <blockquote className="mt-2 rounded-lg bg-[var(--c-sunken)] p-3 text-label text-pretty text-ink">
                  “{row.reason}”
                </blockquote>

                <label htmlFor={`reply-${row.id}`} className="mt-3 block text-label font-extrabold text-ink">
                  ตอบกลับสั้น ๆ (ไม่ใส่ก็ได้)
                </label>
                <textarea
                  id={`reply-${row.id}`}
                  rows={2}
                  maxLength={300}
                  value={replies[row.id] ?? ''}
                  onChange={(e) => setReplies((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  placeholder="เช่น ลองระดับนี้ก่อน ถ้ายังยากบอกครูอีกที"
                  className="mt-1 w-full rounded-lg bg-white p-3 text-label text-ink border border-[var(--c-line-strong)] outline-none placeholder:text-ink-subtle focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
                />

                {options.length > 0 ? (
                  <fieldset className="mt-3">
                    <legend className="text-label font-extrabold text-ink">
                      ถ้าจะให้แบบอื่นแทน เลือกสิ่งที่ให้จริง
                    </legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {options.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() =>
                            setGranted((prev) => ({
                              ...prev,
                              [row.id]: prev[row.id] === o.value ? '' : o.value,
                            }))
                          }
                          aria-pressed={picked === o.value}
                          className="t2-tab focus-ring"
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void answer(row, 'approved')}
                    className="t2-btn focus-ring"
                    data-kind="primary"
                  >
                    ให้ตามที่ขอ
                  </button>
                  {options.length > 0 ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void answer(row, 'changed')}
                      className="t2-btn focus-ring"
                      data-kind="soft"
                    >
                      ให้แบบอื่นแทน
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void answer(row, 'rejected')}
                    className="t2-btn focus-ring"
                  >
                    ยังไม่ให้รอบนี้
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showAnswered && answered.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {answered.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--c-line)] bg-white p-3">
              <p className="text-label font-extrabold text-ink">
                {row.nickname ?? 'ผู้เรียน'} · {row.summary}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-note text-ink-muted">
                <StatusBadge status={row.status === 'rejected' ? 'notstarted' : row.status === 'changed' ? 'inprogress' : 'passed'}>{STATUS_LABEL[row.status] ?? row.status}</StatusBadge>
                {row.grantedValue ? `ให้จริง ${row.grantedValue}` : null}
                {row.teacherResponse ? `ครูบอกว่า “${row.teacherResponse}”` : null}
              </p>
              <p className="mt-1 text-note text-ink-muted">เด็กเขียนว่า “{row.reason}”</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, Button, Card, CheckIcon, Chip, ClockIcon, InfoIcon, cn } from '@/components/ui'

/**
 * S-08 ผู้เรียนขอเปลี่ยนแผนเอง — หลักฐานว่า "ระบบเสนอ ผู้เรียนเลือก" ไม่ใช่ระบบบังคับ
 *
 * ⚠️ หน้าจอไม่ตัดสินอะไรเลย ส่งไปให้ `POST /api/plan-request` ตรวจครบทุกข้อ
 *    (ค่าที่ขอถูกไหม · เหตุผลผ่านด่านกรองคำไหม · ขอซ้ำใบเดิมหรือเปล่า)
 * ⚠️ ประโยค `summary` กับ `answer` เซิร์ฟเวอร์ประกอบมาแล้ว **ห้ามประกอบเอง**
 *    เด็กกับครูต้องเห็นประโยคเดียวกัน ไม่งั้นเข้าใจคนละอย่าง (สัญญาใน result-t57.md)
 * ⚠️ **ห้ามลบหรือแก้ข้อความที่เด็กพิมพ์** — โดนด่านกรองคำก็คืนข้อความเดิมไว้ในช่อง
 *    พร้อมบอกว่าต้องแก้ตรงไหน ไม่ใช่ล้างช่องทิ้ง
 */

/** ถามคำตอบครูทุกกี่มิลลิวินาที — ถามเฉพาะตอนแผงเปิดและยังมีใบค้างอยู่ */
const POLL_MS = 8000
const REASON_MAX = 500

type Kind = 'level' | 'channel' | 'skip' | 'time'

interface MyRequest {
  id: string
  kind: string
  missionId: string | null
  status: string
  createdAt: string
  /** ประโยคที่เซิร์ฟเวอร์ประกอบมาแล้ว เช่น "ขอเปลี่ยนช่องทางการเรียน เป็น เรียนกับเพื่อน (ภารกิจที่ 3)" */
  summary: string
  /** คำตอบของครูเป็นภาษาคน — null = ยังรอครูตอบ */
  answer: string | null
}

const KIND_TABS: { id: Kind; label: string; help: string }[] = [
  { id: 'level', label: 'เปลี่ยนระดับตัวช่วย', help: 'ยากไปหรือง่ายไป ขอปรับให้พอดีกับเราได้' },
  { id: 'channel', label: 'เปลี่ยนช่องทางเรียน', help: 'อยากลองอีกแบบที่เข้าใจง่ายกว่าสำหรับเรา' },
  { id: 'skip', label: 'ขอข้ามภารกิจนี้', help: 'ทำเรื่องนี้ได้อยู่แล้ว อยากไปต่อเลย' },
  { id: 'time', label: 'ขอเวลาเพิ่ม', help: 'ยังทำไม่ทัน ขอเวลาอีกนิดเดียว' },
]

/** ค่าที่เลือกได้ของแต่ละเรื่อง — ต้องตรงกับที่ `core/plan-request.ts` ยอมรับ */
const LEVEL_CHOICES = [
  { value: '1', label: 'ระดับ 1 ช่วยเยอะ' },
  { value: '2', label: 'ระดับ 2 ช่วยปานกลาง' },
  { value: '3', label: 'ระดับ 3 ช่วยน้อย' },
]
const CHANNEL_CHOICES = [
  { value: 'clip', label: 'ดูคลิป' },
  { value: 'card', label: 'อ่านการ์ด' },
  { value: 'game', label: 'เล่นเกม' },
  { value: 'buddy', label: 'เรียนกับเพื่อน' },
]
const MINUTE_CHOICES = [
  { value: '5', label: '5 นาที' },
  { value: '10', label: '10 นาที' },
  { value: '15', label: '15 นาที' },
]

function choicesOf(kind: Kind): { value: string; label: string }[] {
  if (kind === 'level') return LEVEL_CHOICES
  if (kind === 'channel') return CHANNEL_CHOICES
  if (kind === 'time') return MINUTE_CHOICES
  return []
}

function statusLabel(status: string): { text: string; tone: 'wait' | 'yes' | 'no' } {
  if (status === 'approved') return { text: 'ครูให้แล้ว', tone: 'yes' }
  if (status === 'changed') return { text: 'ครูให้แบบอื่นแทน', tone: 'yes' }
  if (status === 'rejected') return { text: 'ครูยังไม่ให้รอบนี้', tone: 'no' }
  return { text: 'รอครูตอบ', tone: 'wait' }
}

export interface PlanRequestPanelProps {
  /** ภารกิจที่กำลังทำอยู่ — ติดไปกับใบคำขอ ครูจะได้รู้ว่าเรื่องไหน */
  missionId?: string | null
  className?: string
}

export function PlanRequestPanel({ missionId = null, className }: PlanRequestPanelProps) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('level')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [requests, setRequests] = useState<MyRequest[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/plan-request')
      if (!res.ok) return
      const data = (await res.json()) as { requests?: MyRequest[] }
      setRequests(data.requests ?? [])
    } catch {
      // เน็ตสะดุด รอบหน้าค่อยว่ากัน ไม่ขึ้นข้อความรบกวนเด็ก
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  /** ถามซ้ำเฉพาะตอนมีใบค้างจริง ๆ — ครูตอบเมื่อไหร่เด็กเห็นเองภายใน 8 วินาที */
  const waiting = requests.some((row) => row.answer === null)
  useEffect(() => {
    if (!open || !waiting) return
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [open, waiting, load])

  const choices = choicesOf(kind)
  const needsValue = choices.length > 0
  const ready = reason.trim().length > 0 && (!needsValue || value.length > 0)

  async function submit() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    setSent(null)
    try {
      const res = await fetch('/api/plan-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          requestedValue: needsValue ? value : undefined,
          missionId: missionId ?? undefined,
          reason: reason.trim(),
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; original?: string; request?: { summary?: string } }
        | null

      if (!res.ok || data?.ok !== true) {
        /**
         * โดนด่านกรองคำ (400 reason-blocked) — เซิร์ฟเวอร์คืนข้อความเดิมมาด้วย
         * เอากลับเข้าช่องเสมอ ห้ามให้สิ่งที่เด็กพิมพ์หายไปเฉย ๆ
         */
        if (typeof data?.original === 'string') setReason(data.original)
        setError(data?.message ?? 'ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setSent(data.request?.summary ?? 'ส่งคำขอถึงครูแล้ว')
      setReason('')
      setValue('')
      await load()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองส่งใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'btn-base min-h-14 w-full rounded-xl bg-surface-raised text-body font-bold text-brand-700 shadow-soft-1 ring-2 ring-brand-100 ring-inset hover:bg-brand-50',
          className,
        )}
      >
        <InfoIcon width={22} height={22} aria-hidden className="shrink-0" />
        <span className="min-w-0 text-pretty">
          ขอเปลี่ยนแผนกับครู
          {waiting ? ' (มีใบรอครูตอบอยู่)' : ''}
        </span>
      </button>
    )
  }

  return (
    <Card as="section" tone="brand" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-title-sm font-bold text-balance text-ink">ขอเปลี่ยนแผนกับครู</h3>
          <p className="mt-1 text-label text-pretty text-ink-muted">
            บอกครูได้ตรง ๆ ว่าอยากปรับอะไร ครูเป็นคนตัดสิน ขอแล้วไม่ได้ก็ไม่เสียดาว
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          ปิด
        </Button>
      </div>

      {/* 1. เรื่องที่จะขอ */}
      <fieldset className="mt-4">
        <legend className="text-body font-bold text-ink">อยากขอเรื่องอะไร</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {KIND_TABS.map((tab) => (
            <Chip
              key={tab.id}
              tone="brand"
              selected={kind === tab.id}
              onSelect={() => {
                setKind(tab.id)
                setValue('')
                setError(null)
                setSent(null)
              }}
            >
              {tab.label}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-label text-pretty text-ink-muted">
          {KIND_TABS.find((t) => t.id === kind)?.help}
        </p>
      </fieldset>

      {/* 2. ค่าที่ขอ (ข้ามภารกิจไม่ต้องเลือกอะไร) */}
      {needsValue ? (
        <fieldset className="mt-4">
          <legend className="text-body font-bold text-ink">
            {kind === 'time' ? 'ขอเพิ่มกี่นาที' : 'อยากเปลี่ยนเป็นอะไร'}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {choices.map((choice) => (
              <Chip
                key={choice.value}
                tone="quest"
                selected={value === choice.value}
                onSelect={() => setValue(choice.value)}
              >
                {choice.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* 3. เหตุผลที่เด็กพิมพ์เอง — ช่องนี้คือหัวใจของ S-08 */}
      <div className="mt-4">
        <label htmlFor="plan-reason" className="block text-body font-bold text-ink">
          บอกครูหน่อยว่าเพราะอะไร
        </label>
        <textarea
          id="plan-reason"
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เช่น อ่านการ์ดแล้วยังไม่เข้าใจ อยากลองถามเพื่อนดู"
          className="mt-2 min-h-14 w-full resize-y rounded-sm bg-surface-raised px-4 py-3 text-body text-ink ring-2 ring-line-contrast ring-inset outline-none placeholder:text-ink-subtle focus:ring-brand-500 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
        />
        <p className="mt-1 text-right text-label tabular-nums text-ink-muted">
          {reason.trim().length}/{REASON_MAX}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-spark-50 p-4 text-body text-pretty text-spark-700 ring-1 ring-spark-200 ring-inset"
        >
          <AlertIcon width={20} height={20} aria-hidden className="mt-1 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
        </p>
      ) : null}

      {sent ? (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl bg-quest-50 p-4 text-body text-pretty text-quest-700 ring-1 ring-quest-100 ring-inset"
        >
          <CheckIcon width={20} height={20} aria-hidden className="mt-1 shrink-0" />
          <span className="min-w-0 flex-1">ส่งถึงครูแล้ว: {sent}</span>
        </p>
      ) : null}

      <Button
        className="mt-4"
        variant="primary"
        size="lg"
        fullWidth
        onClick={submit}
        disabled={!ready || busy}
        loading={busy}
        loadingLabel="กำลังส่งคำขอ"
      >
        {ready ? 'ส่งคำขอให้ครู' : 'เลือกเรื่องแล้วเขียนเหตุผลก่อน'}
      </Button>

      {/* 4. ใบที่เคยขอ + คำตอบครู */}
      {requests.length > 0 ? (
        <div className="mt-5">
          <h4 className="text-body font-bold text-ink">คำขอของเรา</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {requests.map((row) => {
              const badge = statusLabel(row.status)
              return (
                <li key={row.id} className="rounded-xl bg-surface-raised p-3 shadow-soft-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-label font-bold',
                        badge.tone === 'yes'
                          ? 'bg-quest-100 text-quest-700'
                          : badge.tone === 'no'
                            ? 'bg-spark-100 text-spark-700'
                            : 'bg-surface-sunken text-ink-muted',
                      )}
                    >
                      {badge.tone === 'wait' ? (
                        <ClockIcon width={16} height={16} aria-hidden />
                      ) : (
                        <CheckIcon width={16} height={16} aria-hidden />
                      )}
                      {badge.text}
                    </span>
                  </p>
                  {/* ประโยคจากเซิร์ฟเวอร์ทั้งคู่ — ครูเห็นประโยคเดียวกันนี้บนแผงของครู */}
                  <p className="mt-1.5 text-body text-pretty text-ink">{row.summary}</p>
                  {row.answer ? (
                    <p className="mt-1 text-body text-pretty text-brand-700">{row.answer}</p>
                  ) : (
                    <p className="mt-1 text-label text-ink-muted">
                      ระหว่างรอครูตอบ ทำข้อต่อไปได้เลย คำตอบจะมาขึ้นตรงนี้เอง
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}

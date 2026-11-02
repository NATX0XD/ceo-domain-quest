'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertIcon,
  CheckIcon,
} from '@/components/ui'

/**
 * ฟอร์มให้ครูยืนยันหรือแก้คะแนนของงาน 1 ชิ้น → POST /api/teacher/confirm-score
 *
 * ⚠️ ครูเป็นคนตัดสินเสมอ คะแนนที่ระบบเสนอเป็นแค่ค่าเริ่มต้นในช่อง แก้ขึ้นลงได้
 * ⚠️ teacherId อ่านจากคุกกี้ฝั่งเซิร์ฟเวอร์ · SQL ตรวจว่างานชิ้นนี้อยู่ในห้องของครูคนนี้จริง
 */
export interface RubricDimensionView {
  id: string
  name: string
  score: number
  levelLabel: string
  evidence: string
  suggestion: string
  emphasized: boolean
}

export const DEFAULT_NOTE = 'ครูตรวจแล้ว ยืนยันคะแนนนี้'

export function TeacherConfirmScore({
  submissionId,
  maxScore,
  confirmed,
  dimensions,
  savedScores = null,
  roundsUsed = 0,
  maxRounds = 3,
  nextHref = null,
}: {
  submissionId: string
  /** ไม่ใช้แสดงแล้ว (ปุ่มยืนยันใช้ผลรวมรายด้านเอง) เก็บไว้ให้ผู้เรียกเดิมไม่พัง */
  proposedScore?: number
  maxScore: number
  confirmed: boolean
  /** แก้มาแล้วกี่รอบ ใช้บอกครูว่าต้องติ๊กปลดล็อกไหม */
  roundsUsed?: number
  maxRounds?: number
  /** หลังยืนยันให้ไปงานถัดไปในคิวทันที */
  nextHref?: string | null
  /** คะแนนที่ครูยืนยันไว้จริงในฐานข้อมูล (อ่านกลับมาแสดง ไม่ใช่ค่าที่พิมพ์ค้างไว้) */
  savedScores?: {
    score?: number
    maxScore?: number
    stars?: number
    note?: string | null
    dimensionScores?: Record<string, number> | null
  } | null
  /** คะแนนรายด้านที่ระบบเสนอ ครูแก้ได้ทีละด้าน ไม่ใช่แก้ได้แค่ตัวเลขรวม */
  dimensions: RubricDimensionView[]
}) {
  const emphasisDimensionId = dimensions.find((d) => d.emphasized)?.id ?? null
  const router = useRouter()
  const [dimScores, setDimScores] = useState<Record<string, number>>(
    Object.fromEntries(dimensions.map((d) => [d.id, d.score])),
  )
  // คะแนนรวม = ผลรวมทุกด้าน + ด้านที่ถ่วง 2 เท่านับซ้ำอีกครั้ง (สูตรเดียวกับไฟล์เนื้อหา)
  const computedTotal = dimensions.reduce(
    (sum, d) => sum + (dimScores[d.id] ?? d.score) * (d.emphasized ? 2 : 1),
    0,
  )
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(confirmed)
  const [open, setOpen] = useState(false)
  const [reviseDims, setReviseDims] = useState<string[]>([])
  const [reviseNote, setReviseNote] = useState('')
  const [allowExtra, setAllowExtra] = useState(false)
  const [sentBack, setSentBack] = useState(false)
  /** ค่าที่เซิร์ฟเวอร์ตอบกลับหลังบันทึก = แถวจริงใน DB (UPDATE ... RETURNING) */
  const [savedFromServer, setSavedFromServer] = useState<typeof savedScores>(null)

  async function confirm(quick = false) {
    const finalNote = note.trim() || DEFAULT_NOTE
    const missing = dimensions.filter((d) => typeof dimScores[d.id] !== 'number')
    void quick
    if (dimensions.length > 0 && missing.length > 0) {
      setError('ให้คะแนนให้ครบทุกด้านก่อนบันทึก')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher/confirm-score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          /**
           * ส่ง "คะแนนรายด้าน" ขึ้นไป เซิร์ฟเวอร์คำนวณคะแนนถ่วงน้ำหนักและดาวเอง
           * หน้าจอไม่ได้ตัดสินตัวเลขรวม (ช่องรวมบนจอเป็นแค่ตัวอย่างให้ครูเห็นก่อนกด)
           */
          dimensions: dimScores,
          emphasisDimensionId: emphasisDimensionId ?? undefined,
          note: finalNote,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            message?: string
            submission?: {
              teacherScores?: {
                dimensions?: Record<string, number>
                weightedTotal?: number
                weightedMax?: number
                stars?: number
                note?: string | null
              } | null
            }
          }
        | null
      if (!res.ok) {
        setError(data?.message ?? 'ยืนยันคะแนนไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      const saved = data?.submission?.teacherScores ?? null
      if (saved) {
        setSavedFromServer({
          score: saved.weightedTotal,
          maxScore: saved.weightedMax,
          stars: saved.stars,
          note: saved.note ?? null,
          dimensionScores: saved.dimensions ?? null,
        })
      }
      setDone(true)
      if (nextHref) router.push(nextHref)
      else router.refresh()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  /**
   * ส่งกลับให้แก้ (สเปกข้อ 3.3) — ครูเลือกด้านที่ต้องแก้ + เขียนความเห็น
   * ไม่ใช่การตัดสินว่าตก งานจะออกจากคิวครูจนกว่านักเรียนจะส่งฉบับใหม่เข้ามา
   */
  async function sendBack() {
    if (reviseDims.length === 0) {
      setError('เลือกด้านที่ต้องแก้อย่างน้อย 1 ด้าน')
      return
    }
    if (reviseNote.trim().length === 0) {
      setError('เขียนบอกผู้เรียนสั้น ๆ ว่าให้แก้อะไร')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher/request-revision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          dimensionIds: reviseDims,
          // ส่งคะแนนรายด้านที่ครูให้ไว้ตอนนี้ไปด้วย ผู้เรียนจะได้เห็นว่าอยู่ตรงไหนของแต่ละด้าน
          dimensions: dimensions.length > 0 ? dimScores : undefined,
          note: reviseNote.trim(),
          allowExtraRound: allowExtra,
        }),
      })
      const data = (await res.json().catch(() => null)) as { message?: string } | null
      if (!res.ok) {
        setError(data?.message ?? 'ส่งกลับให้แก้ไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setSentBack(true)
      router.refresh()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  const saved = savedFromServer ?? savedScores
  const changed = dimensions.some((d) => (dimScores[d.id] ?? d.score) !== d.score)

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void confirm(true)}
          disabled={busy}
          className="t2-btn focus-ring"
          data-kind="primary"
        >
          <CheckIcon width={20} height={20} aria-hidden />
          {busy ? 'กำลังบันทึก…' : done ? 'ยืนยันอีกครั้ง' : changed ? `ยืนยันคะแนนที่ปรับ ${computedTotal}/${maxScore}` : 'ยืนยันคะแนนนี้'}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="t2-btn focus-ring"
          data-kind="soft"
        >
          ปรับคะแนน
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-xl border border-[var(--c-line)] bg-[var(--c-bg)] p-3">
          {dimensions.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {dimensions.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5" title={`${d.evidence} · ${d.suggestion}`}>
                  <p className="m-0 min-w-0 flex-1 text-label font-bold text-ink">
                    {d.name}
                    {d.emphasized ? <span className="t2-chip ml-2" data-tone="yellow">×2</span> : null}
                    <span className="ml-2 text-note font-medium text-ink-muted">ระบบ {d.score} · {d.levelLabel}</span>
                  </p>
                  <select
                    aria-label={`คะแนนด้าน ${d.name}`}
                    value={dimScores[d.id] ?? d.score}
                    onChange={(e) => setDimScores({ ...dimScores, [d.id]: Number(e.target.value) })}
                    className="min-h-10 min-w-16 shrink-0 rounded-xl bg-[var(--c-brand-soft)] px-3 text-body font-extrabold text-[var(--c-brand)] ring-2 ring-[var(--c-brand-ring)] ring-inset outline-none focus-ring"
                  >
                    {[1, 2, 3].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </li>
              ))}
              <li className="text-right text-label font-extrabold text-ink">รวมถ่วงน้ำหนัก {computedTotal} / {maxScore}</li>
            </ul>
          ) : null}

          <label htmlFor={`note-${submissionId}`} className="mt-2 block text-label font-bold text-ink">
            ข้อความถึงนักเรียน (ไม่บังคับ)
          </label>
          <textarea
            id={`note-${submissionId}`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น เหตุผลชัดมาก ลองเพิ่มว่าลูกค้าเป็นใครอีกนิด"
            className="mt-1 w-full rounded-xl border border-[var(--c-line)] bg-white p-2.5 text-body text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
          />

          <details className="mt-2">
            <summary className="flex min-h-10 cursor-pointer items-center text-label font-bold text-brand-700">
              ส่งกลับให้แก้ · แก้มาแล้ว {roundsUsed}/{maxRounds} รอบ
            </summary>
            <p className="mt-1 text-note text-ink-muted">เลือกด้านที่ต้องแก้ นักเรียนส่งใหม่เป็นฉบับใหม่ ฉบับเดิมยังอยู่ให้ครูเทียบ</p>
            <ul className="mt-2 flex list-none flex-col gap-1.5 p-0">
              {dimensions.map((d) => (
                <li key={d.id}>
                  <label className="flex min-h-10 items-center gap-3 rounded-lg bg-white px-3 text-label text-ink">
                    <input
                      type="checkbox"
                      className="shrink-0 accent-brand-600"
                      checked={reviseDims.includes(d.id)}
                      onChange={(e) =>
                        setReviseDims((prev) => (e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id)))
                      }
                    />
                    <span className="min-w-0">{d.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <textarea
              aria-label="บอกนักเรียนว่าให้แก้อะไร"
              rows={2}
              maxLength={500}
              value={reviseNote}
              onChange={(e) => setReviseNote(e.target.value)}
              placeholder="บอกนักเรียนสั้น ๆ ว่าให้แก้อะไร (บังคับ)"
              className="mt-2 w-full rounded-xl border border-[var(--c-line)] bg-white p-2.5 text-body text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
            />
            {roundsUsed >= maxRounds ? (
              <label className="mt-2 flex min-h-10 items-center gap-3 rounded-lg bg-spark-50 px-3 text-label text-ink">
                <input type="checkbox" className="shrink-0 accent-brand-600" checked={allowExtra} onChange={(e) => setAllowExtra(e.target.checked)} />
                <span>รอบแก้ครบแล้ว — ติ๊กเพื่อเปิดให้แก้เพิ่มอีก 1 รอบ</span>
              </label>
            ) : null}
            <button type="button" onClick={sendBack} disabled={busy} className="t2-btn mt-2 focus-ring" data-kind="soft">
              {busy ? 'กำลังส่งกลับ…' : 'ส่งกลับให้แก้'}
            </button>
            {sentBack ? <p className="mt-2 text-label font-bold text-quest-700">ส่งกลับให้แก้แล้ว งานจะกลับเข้าคิวเมื่อนักเรียนส่งฉบับใหม่</p> : null}
          </details>
        </div>
      ) : null}

      {saved ? (
        <p className="mt-2 flex items-start gap-2 text-label font-bold text-quest-700">
          <CheckIcon width={18} height={18} className="mt-0.5 shrink-0" />
          <span>
            ครูยืนยันแล้ว {saved.score ?? '-'}/{saved.maxScore ?? maxScore}
            {saved.stars !== undefined ? ` · ${saved.stars} ดาว` : ''}
            {saved.note ? ` · “${saved.note}”` : ''}
          </span>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-danger-100 p-2.5 text-label font-bold text-danger-700">
          <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

/** ยืนยันทุกงานในคิวตามคะแนนที่แสดง — วนเรียก confirm-score ทีละชิ้นพร้อมแถบความคืบหน้า */
export interface BulkItem {
  submissionId: string
  dimensions: Record<string, number>
  emphasisDimensionId: string | null
}

export function BulkConfirm({ items }: { items: BulkItem[] }) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null)
  const running = progress !== null && progress.done + progress.failed < items.length

  async function run() {
    setAsking(false)
    setProgress({ done: 0, failed: 0 })
    let done = 0
    let failed = 0
    for (const it of items) {
      try {
        const res = await fetch('/api/teacher/confirm-score', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            submissionId: it.submissionId,
            dimensions: it.dimensions,
            emphasisDimensionId: it.emphasisDimensionId ?? undefined,
            note: DEFAULT_NOTE,
          }),
        })
        if (res.ok) done++
        else failed++
      } catch {
        failed++
      }
      setProgress({ done, failed })
    }
    router.refresh()
  }

  if (items.length === 0) return null
  return (
    <div className="border-t border-[var(--c-line)] px-3 py-2">
      {asking ? (
        <div role="alertdialog" aria-label="ยืนยันทั้งหมด" className="text-label text-ink">
          <p className="m-0 font-bold">ยืนยัน {items.length} งานตามคะแนนระบบ?</p>
          <p className="m-0 text-note text-ink-muted">นักเรียนได้คะแนนนี้อยู่แล้ว ครูแก้ทีหลังได้</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void run()} className="t2-btn focus-ring" data-kind="primary">ยืนยันทั้งหมด</button>
            <button type="button" onClick={() => setAsking(false)} className="t2-btn focus-ring" data-kind="soft">ยกเลิก</button>
          </div>
        </div>
      ) : progress ? (
        <p className="m-0 text-label font-bold text-ink" aria-live="polite">
          {running ? 'กำลังยืนยัน ' : 'ยืนยันแล้ว '}{progress.done}/{items.length}
          {progress.failed > 0 ? ` · ไม่สำเร็จ ${progress.failed}` : ''}
        </p>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="text-label font-bold text-[var(--c-brand)] underline-offset-2 hover:underline focus-ring">
          ยืนยันทั้งหมดตามคะแนนระบบ
        </button>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  TextField,
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

export function TeacherConfirmScore({
  submissionId,
  proposedScore,
  maxScore,
  confirmed,
  dimensions,
  savedScores = null,
  roundsUsed = 0,
  maxRounds = 3,
}: {
  submissionId: string
  proposedScore: number
  maxScore: number
  confirmed: boolean
  /** แก้มาแล้วกี่รอบ ใช้บอกครูว่าต้องติ๊กปลดล็อกไหม */
  roundsUsed?: number
  maxRounds?: number
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
  const [score, setScore] = useState(String(proposedScore))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(confirmed)
  const [reviseDims, setReviseDims] = useState<string[]>([])
  const [reviseNote, setReviseNote] = useState('')
  const [allowExtra, setAllowExtra] = useState(false)
  const [sentBack, setSentBack] = useState(false)
  /** ค่าที่เซิร์ฟเวอร์ตอบกลับหลังบันทึก = แถวจริงใน DB (UPDATE ... RETURNING) */
  const [savedFromServer, setSavedFromServer] = useState<typeof savedScores>(null)

  async function confirm() {
    if (note.trim().length === 0) {
      setError('เขียนข้อความถึงผู้เรียนอย่างน้อย 1 บรรทัดก่อนบันทึกคะแนน')
      return
    }
    const missing = dimensions.filter((d) => typeof dimScores[d.id] !== 'number')
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
          note: note.trim(),
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
      router.refresh()
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

  return (
    <div className="mt-4 rounded-2xl border border-[var(--c-line)] bg-[var(--c-bg)] p-4">
      {dimensions.length > 0 ? (
        <ul className="mb-4 flex flex-col gap-2">
          {dimensions.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-[var(--c-line)] bg-white p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-label font-extrabold text-ink">
                  {d.name}
                  {d.emphasized ? <span className="t2-chip" data-tone="yellow">เน้น ×2</span> : null}
                  <span className="t2-chip" data-tone="lilac">
                    ระบบเสนอ {d.score} · {d.levelLabel}
                  </span>
                </p>
                <select
                  aria-label={`คะแนนด้าน ${d.name}`}
                  value={dimScores[d.id] ?? d.score}
                  onChange={(e) => {
                    const next = { ...dimScores, [d.id]: Number(e.target.value) }
                    setDimScores(next)
                    const total = dimensions.reduce(
                      (sum, dim) => sum + (next[dim.id] ?? dim.score) * (dim.emphasized ? 2 : 1),
                      0,
                    )
                    setScore(String(total))
                  }}
                  className="min-h-11 min-w-16 shrink-0 rounded-xl bg-[var(--c-brand-soft)] px-4 text-body font-extrabold text-[var(--c-brand)] ring-2 ring-[var(--c-brand-ring)] ring-inset outline-none focus-ring"
                >
                  {[1, 2, 3].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <details className="mt-1">
                <summary className="flex min-h-11 cursor-pointer items-center text-note font-extrabold text-brand-700">
                  หลักฐาน · ข้อเสนอแนะ
                </summary>
                <p className="text-label text-ink-muted">
                  <span className="font-bold text-ink">ยกมาอ้าง: </span>
                  {d.evidence}
                </p>
                <p className="mt-1 text-label text-brand-700">ข้อเสนอแนะ: {d.suggestion}</p>
              </details>
            </li>
          ))}
          <li className="text-right text-label font-extrabold text-ink">
            รวมถ่วงน้ำหนัก {computedTotal} / {maxScore}
          </li>
        </ul>
      ) : null}

      {/* ก่อน → หลัง: คะแนนที่ระบบเสนอ เทียบกับคะแนนที่ครูกำลังจะยืนยัน */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--c-line)] bg-white p-3">
        <div className="min-w-0 flex-1">
          <p className="text-note font-bold text-ink-muted">ระบบเสนอ</p>
          <p className="text-body-lg font-bold tabular-nums text-ink-muted">
            {proposedScore}
            <span className="text-label"> / {maxScore}</span>
          </p>
        </div>
        <ChevronRightIcon width={20} height={20} aria-hidden className="shrink-0 text-ink-subtle" />
        <div className="min-w-0 flex-1 text-right">
          <p className="text-note font-bold text-brand-700">ครูกำลังจะยืนยัน</p>
          <p className="text-body-lg font-extrabold tabular-nums text-ink">
            {score === '' ? '—' : score}
            <span className="text-label"> / {maxScore}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <TextField
          id={`score-${submissionId}`}
          label="คะแนนของครู"
          type="number"
          inputMode="numeric"
          min={0}
          max={maxScore}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          center
          hint={`ใส่ได้ 0 ถึง ${maxScore}`}
          className="w-full max-w-[11rem]"
          inputClassName="text-title font-extrabold tabular-nums"
        />

        <div>
          <label
            htmlFor={`note-${submissionId}`}
            className="block text-label font-extrabold text-ink"
          >
            ข้อความถึงผู้เรียน (บังคับ)
          </label>
          <textarea
            id={`note-${submissionId}`}
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น เหตุผลข้อ 2 ชัดมาก ลองเพิ่มว่าลูกค้าเป็นใครอีกนิด"
            className="mt-2 w-full rounded-xl border border-[var(--c-line)] bg-white p-3 text-body text-ink ring-2 ring-line-contrast ring-inset outline-none placeholder:text-ink-subtle focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus focus:ring-brand-500"
          />
        </div>

        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="t2-btn focus-ring"
          data-kind="primary"
          data-block="true"
        >
          <CheckIcon width={20} height={20} aria-hidden />
          {busy ? 'กำลังบันทึก…' : done ? 'ยืนยันอีกครั้ง' : 'ยืนยันคะแนน'}
        </button>
      </div>

      {/* ทางที่สองของครู: ยังไม่ให้คะแนนสุดท้าย แต่ส่งกลับไปให้แก้ก่อน (สเปกข้อ 3.3) */}
      <details className="mt-3 rounded-xl border border-[var(--c-line)] bg-white p-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-label font-extrabold text-ink">
          ส่งกลับให้แก้ · แก้มาแล้ว {roundsUsed}/{maxRounds} รอบ
        </summary>
        <p className="mt-1 text-note text-ink-muted">
          เลือกด้านที่ต้องแก้ นักเรียนส่งใหม่เป็นฉบับใหม่ ฉบับเดิมยังอยู่ให้ครูเทียบ
        </p>

        <fieldset className="mt-3">
          <legend className="text-label font-bold text-ink">ด้านที่ต้องแก้</legend>
          <ul className="mt-2 flex flex-col gap-2">
            {dimensions.map((d) => (
              <li key={d.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg bg-surface-sunken px-3 text-body text-ink">
                  <input
                    type="checkbox"
                    className="tap-target shrink-0 accent-brand-600"
                    checked={reviseDims.includes(d.id)}
                    onChange={(e) =>
                      setReviseDims((prev) =>
                        e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id),
                      )
                    }
                  />
                  <span className="min-w-0">{d.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <label htmlFor={`revise-note-${submissionId}`} className="mt-3 block text-label font-bold text-ink">
          บอกผู้เรียนสั้น ๆ ว่าให้แก้อะไร (บังคับ)
        </label>
        <textarea
          id={`revise-note-${submissionId}`}
          rows={2}
          maxLength={500}
          value={reviseNote}
          onChange={(e) => setReviseNote(e.target.value)}
          placeholder="เช่น เขียนเพิ่มว่าลูกค้าเป็นใคร แล้วส่งกลับมาได้เลย"
          className="mt-2 w-full rounded-xl bg-white p-3 text-body text-ink ring-2 ring-line-contrast ring-inset outline-none placeholder:text-ink-subtle focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus focus:ring-brand-500"
        />

        {roundsUsed >= maxRounds ? (
          <label className="mt-3 flex min-h-11 items-center gap-3 rounded-lg bg-spark-50 px-3 text-label text-ink">
            <input
              type="checkbox"
              className="tap-target shrink-0 accent-brand-600"
              checked={allowExtra}
              onChange={(e) => setAllowExtra(e.target.checked)}
            />
            <span>ใช้โควตารอบแก้ครบแล้ว — ติ๊กเพื่อเปิดให้แก้เพิ่มอีก 1 รอบ</span>
          </label>
        ) : null}

        <button
          type="button"
          onClick={sendBack}
          disabled={busy}
          className="t2-btn mt-3 focus-ring"
          data-kind="soft"
          data-block="true"
        >
          {busy ? 'กำลังส่งกลับ…' : 'ส่งกลับให้แก้'}
        </button>

        {sentBack ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-quest-50 p-3 text-label font-bold text-quest-700">
            <CheckIcon width={20} height={20} className="mt-0.5 shrink-0" />
            <span>ส่งกลับให้แก้แล้ว งานจะกลับเข้าคิวเมื่อนักเรียนส่งฉบับใหม่</span>
          </p>
        ) : null}
      </details>

      {(savedFromServer ?? savedScores) ? (
        /* ค่าที่ "บันทึกจริง" อ่านกลับมาจากฐานข้อมูล ไม่ใช่ค่าที่ค้างอยู่ในช่องกรอก */
        <div className="mt-3 rounded-xl bg-quest-50 p-3 text-label text-quest-700 ring-1 ring-quest-100 ring-inset">
          <p className="flex items-start gap-2 font-bold">
            <CheckIcon width={20} height={20} className="mt-0.5 shrink-0" />
            <span>
              บันทึกแล้ว {(savedFromServer ?? savedScores)?.score ?? '-'}/
              {(savedFromServer ?? savedScores)?.maxScore ?? maxScore}
              {(savedFromServer ?? savedScores)?.stars !== undefined
                ? ` · ${(savedFromServer ?? savedScores)?.stars} ดาว`
                : ''}{' '}
              · ดาวของผู้เรียนอัปเดตตามคะแนนนี้
            </span>
          </p>
          {(savedFromServer ?? savedScores)?.dimensionScores ? (
            <p className="mt-1 text-note">
              รายด้านที่บันทึก:{' '}
              {dimensions
                .map(
                  (d) =>
                    `${d.name} ${(savedFromServer ?? savedScores)?.dimensionScores?.[d.id] ?? '-'}`,
                )
                .join(' · ')}
            </p>
          ) : null}
          {(savedFromServer ?? savedScores)?.note ? (
            <p className="mt-1 text-note">
              ข้อความถึงผู้เรียน: {(savedFromServer ?? savedScores)?.note}
            </p>
          ) : null}
        </div>
      ) : done ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-quest-50 p-3 text-label font-bold text-quest-700 ring-1 ring-quest-100 ring-inset">
          <CheckIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <span>ยืนยันแล้ว กำลังโหลดค่าที่บันทึก…</span>
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-danger-100 p-3 text-label font-bold text-danger-700"
        >
          <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

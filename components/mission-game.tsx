'use client'

import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  AlertIcon,
  Button,
  CheckIcon,
  ChevronRightIcon,
  GripIcon,
  InfoIcon,
} from '@/components/ui'

/**
 * มินิเกมของภารกิจ — ลากวางได้จริงบนมือถือ (Pointer Events + elementFromPoint)
 * และแตะเลือกชิ้นส่วนแล้วแตะช่องก็ได้ สำหรับคนที่ลากไม่ถนัดหรือใช้คีย์บอร์ด
 *
 * ⚠️ ไม่มีเฉลยอยู่ในไฟล์นี้ ทุกการตรวจส่งไป POST /api/mission/[id]/game
 * ⚠️ ชิ้นส่วนและช่องทั้งหมดมาจาก content/missions.json ผ่าน props ห้าม hardcode
 * ⚠️ เซิร์ฟเวอร์ส่ง `results` เป็นผลรายช่อง **เฉพาะช่องที่วางของแล้ว** (ถูก/ผิด)
 *    ช่องที่ยังไม่ได้วางจะไม่มีในผล — หน้าจอจึงบอกได้ว่าช่องไหนผิด โดยไม่รู้เฉลยของช่องที่ยังว่าง
 */
export type GameKind = 'match' | 'build' | 'sort' | 'order' | 'check'

export interface GameTarget {
  id: string
  label: string
  note?: string
}

export interface GameChip {
  id: string
  text: string
  note?: string
}

export interface GameData {
  kind: GameKind
  instruction: string
  targets: GameTarget[]
  chips: GameChip[]
  /** true = หลายชิ้นใส่ช่องเดียวกันได้ (เกมจัดหมวด) */
  manyPerTarget: boolean
}

interface GameResult {
  allCorrect: boolean
  correctCount: number
  total: number
  /** คีย์ = ช่อง (หรือชิ้นส่วนในเกมจัดหมวด/เรียงลำดับ) ที่วางแล้ว · ค่า = วางถูกหรือไม่ */
  results?: Record<string, boolean>
}

export function MissionGame({
  missionId,
  data,
  onSolved,
}: {
  missionId: string
  data: GameData
  onSolved?: () => void
}) {
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [order, setOrder] = useState<string[]>(data.chips.map((c) => c.id))
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const isOrder = data.kind === 'order'

  const chipById = useMemo(
    () => new Map(data.chips.map((c) => [c.id, c])),
    [data.chips],
  )

  const placedChipIds = useMemo(() => new Set(Object.values(placed)), [placed])
  const chipsLeft = data.manyPerTarget
    ? data.chips.filter((c) => !placed[c.id])
    : data.chips.filter((c) => !placedChipIds.has(c.id))

  function place(chipId: string, targetId: string) {
    setPlaced((prev) => {
      const next = { ...prev }
      if (data.manyPerTarget) {
        // เกมจัดหมวด: คีย์คือชิ้นส่วน ค่าคือหมวด
        next[chipId] = targetId
      } else {
        // เกมจับคู่/ประกอบ: คีย์คือช่อง ค่าคือชิ้นส่วน (ช่องละ 1 ชิ้น)
        for (const [slot, piece] of Object.entries(next)) {
          if (piece === chipId) delete next[slot]
        }
        next[targetId] = chipId
      }
      return next
    })
    setSelected(null)
    setResult(null)
  }

  function clearTarget(targetId: string) {
    setPlaced((prev) => {
      const next = { ...prev }
      if (data.manyPerTarget) {
        for (const [chip, cat] of Object.entries(next)) if (cat === targetId) delete next[chip]
      } else {
        delete next[targetId]
      }
      return next
    })
    setResult(null)
  }

  function moveStep(index: number, delta: number) {
    setOrder((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      const a = next[index]
      const b = next[target]
      if (a === undefined || b === undefined) return prev
      next[index] = b
      next[target] = a
      return next
    })
    setResult(null)
  }

  function onPointerDown(chipId: string) {
    setDragging(chipId)
    setSelected(chipId)
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!dragging) return
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const dropZone = element?.closest('[data-drop-id]')
    setHoverTarget(dropZone?.getAttribute('data-drop-id') ?? null)
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!dragging) return
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const dropId = element?.closest('[data-drop-id]')?.getAttribute('data-drop-id')
    if (dropId) place(dragging, dropId)
    setDragging(null)
    setHoverTarget(null)
  }

  async function check() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/mission/${missionId}/game`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isOrder ? { order } : { placements: placed }),
      })
      const data2 = (await res.json().catch(() => null)) as
        | (GameResult & { message?: string })
        | null
      if (!res.ok || !data2) {
        setMessage(data2?.message ?? 'ตรวจคำตอบไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setResult(data2)
      if (data2.allCorrect) onSolved?.()
    } catch {
      setMessage('ต่อเน็ตไม่ได้ ลองตรวจใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setDragging(null)
        setHoverTarget(null)
      }}
      className="touch-none select-none"
    >
      <p className="text-body text-pretty text-ink">{data.instruction}</p>
      <p className="mt-1 flex items-start gap-2 text-label text-pretty text-ink-muted">
        <GripIcon width={18} height={18} aria-hidden className="mt-0.5 shrink-0" />
        <span className="min-w-0">ลากชิ้นส่วนไปวางได้เลย หรือจะแตะชิ้นส่วนก่อนแล้วแตะช่องก็ได้</span>
      </p>

      {isOrder ? (
        <ol className="mt-4 flex flex-col gap-2">
          {order.map((chipId, index) => (
            <li
              key={chipId}
              className="flex items-start gap-2 rounded-2xl bg-surface-raised p-3 shadow-soft-1 ring-1 ring-line ring-inset"
            >
              <span
                aria-hidden="true"
                className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-body font-bold text-brand-700"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 pt-1.5 text-body text-pretty text-ink">
                {chipById.get(chipId)?.text ?? chipId}
              </span>
              <span className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  aria-label={`เลื่อนขั้นที่ ${index + 1} ขึ้น`}
                  onClick={() => moveStep(index, -1)}
                  className="btn-base size-11 rounded-md bg-surface-sunken px-0 text-ink"
                >
                  <ChevronRightIcon width={20} height={20} aria-hidden className="-rotate-90" />
                </button>
                <button
                  type="button"
                  aria-label={`เลื่อนขั้นที่ ${index + 1} ลง`}
                  onClick={() => moveStep(index, 1)}
                  className="btn-base size-11 rounded-md bg-surface-sunken px-0 text-ink"
                >
                  <ChevronRightIcon width={20} height={20} aria-hidden className="rotate-90" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {data.targets.map((target) => {
              const inTarget = data.manyPerTarget
                ? Object.entries(placed)
                    .filter(([, cat]) => cat === target.id)
                    .map(([chip]) => chip)
                : placed[target.id]
                  ? [placed[target.id] as string]
                  : []
              const hovering = hoverTarget === target.id
              /**
               * ผลรายช่องจากเซิร์ฟเวอร์ — เกมจัดหมวดคีย์เป็นชิ้นส่วน ที่เหลือคีย์เป็นช่อง
               * undefined = ยังไม่ได้ตรวจ หรือช่องนี้ยังไม่ได้วางอะไร
               */
              const verdict = data.manyPerTarget
                ? inTarget.length > 0
                  ? inTarget.every((chipId) => result?.results?.[chipId] === true)
                    ? true
                    : inTarget.some((chipId) => result?.results?.[chipId] === false)
                      ? false
                      : undefined
                  : undefined
                : result?.results?.[target.id]
              const solved = verdict === true
              const wrong = verdict === false
              const waiting = selected !== null && inTarget.length === 0
              return (
                <li key={target.id}>
                  <div
                    data-drop-id={target.id}
                    onClick={() => {
                      if (selected) place(selected, target.id)
                    }}
                    className={`rounded-2xl p-4 ring-2 ring-inset transition-colors duration-200 motion-reduce:transition-none ${
                      solved
                        ? 'bg-quest-50 ring-quest-500'
                        : wrong
                          ? 'bg-danger-100 ring-danger-500'
                          : hovering
                          ? 'bg-brand-50 ring-brand-500'
                          : waiting
                            ? 'cursor-pointer bg-surface-sunken ring-brand-300 ring-dashed'
                            : 'bg-surface-raised ring-line-contrast ring-dashed'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-body font-bold text-pretty text-ink">
                        {target.label}
                      </p>
                      {solved ? (
                        <span className="flex shrink-0 items-center gap-1 text-label font-bold text-quest-700">
                          <CheckIcon width={20} height={20} aria-hidden />
                          ถูกแล้ว
                        </span>
                      ) : wrong ? (
                        /* บอกว่าช่องนี้ยังไม่ถูก แต่ไม่บอกว่าต้องวางชิ้นไหน */
                        <span className="flex shrink-0 items-center gap-1 text-label font-bold text-danger-700">
                          <AlertIcon width={20} height={20} aria-hidden />
                          ยังไม่ถูก
                        </span>
                      ) : null}
                    </div>
                    {target.note ? (
                      <p className="mt-1 text-label text-pretty text-ink-muted">{target.note}</p>
                    ) : null}

                    <div className="mt-3 flex min-h-14 flex-wrap items-center gap-2">
                      {inTarget.length === 0 ? (
                        <span
                          className={`inline-flex min-h-12 items-center rounded-full px-4 text-label font-bold ${
                            waiting ? 'text-brand-700' : 'text-ink-subtle'
                          }`}
                        >
                          {waiting ? 'แตะตรงนี้เพื่อวาง' : 'วางตรงนี้'}
                        </span>
                      ) : (
                        inTarget.map((chipId) => (
                          <span
                            key={chipId}
                            className={`inline-flex min-h-12 items-center rounded-full px-4 text-body font-bold shadow-soft-1 ring-2 ring-inset ${
                              solved
                                ? 'bg-quest-600 text-ink-onbrand ring-quest-700'
                                : 'bg-brand-600 text-ink-onbrand ring-brand-700'
                            }`}
                          >
                            {chipById.get(chipId)?.text ?? chipId}
                          </span>
                        ))
                      )}
                    </div>

                    {inTarget.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => clearTarget(target.id)}
                        className="btn-base mt-2 min-h-11 rounded-md px-3 text-label font-bold text-brand-700 underline"
                      >
                        เอาออก
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            {chipsLeft.map((chip) => {
              const isSelected = selected === chip.id
              const isDragging = dragging === chip.id
              return (
                <motion.button
                  key={chip.id}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onPointerDown={() => onPointerDown(chip.id)}
                  onClick={() => setSelected(chip.id)}
                  aria-pressed={isSelected}
                  aria-roledescription="ชิปที่ลากวางได้"
                  className={`inline-flex min-h-14 cursor-grab items-center gap-2 rounded-full px-4 py-2 text-body font-bold ring-2 ring-inset transition-[background-color,color,box-shadow] duration-200 select-none focus-ring active:cursor-grabbing motion-reduce:transition-none ${
                    isDragging
                      ? 'bg-brand-600 text-ink-onbrand shadow-lift ring-brand-700'
                      : isSelected
                        ? 'bg-brand-100 text-brand-700 shadow-soft-2 ring-brand-500'
                        : 'bg-surface-raised text-ink shadow-soft-1 ring-line-contrast'
                  }`}
                >
                  <GripIcon width={18} height={18} aria-hidden className="shrink-0 opacity-70" />
                  <span className="min-w-0 text-left">
                    {chip.text}
                    {chip.note ? (
                      <span className="mt-0.5 block text-label font-normal opacity-80">
                        {chip.note}
                      </span>
                    ) : null}
                  </span>
                </motion.button>
              )
            })}
            {chipsLeft.length === 0 ? (
              <p className="flex items-center gap-2 text-label font-semibold text-quest-700">
                <CheckIcon width={20} height={20} aria-hidden />
                วางครบทุกชิ้นแล้ว กดตรวจคำตอบได้เลย
              </p>
            ) : null}
          </div>
        </>
      )}

      <Button
        variant="success"
        size="md"
        fullWidth
        className="mt-5"
        onClick={check}
        loading={busy}
        loadingLabel="กำลังตรวจคำตอบ"
        leadingIcon={busy ? undefined : <CheckIcon width={22} height={22} />}
      >
        {busy ? 'กำลังตรวจ…' : 'ตรวจคำตอบ'}
      </Button>

      {result ? (
        <p
          role="status"
          className={`mt-3 flex gap-2 rounded-2xl p-4 text-body text-pretty ring-1 ring-inset ${
            result.allCorrect
              ? 'bg-quest-50 text-quest-700 ring-quest-200'
              : 'bg-spark-50 text-spark-700 ring-spark-100'
          }`}
        >
          {result.allCorrect ? (
            <CheckIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0" />
          ) : (
            <AlertIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0" />
          )}
          <span className="min-w-0">
            {result.allCorrect
              ? `ถูกหมดเลย ${result.correctCount} จาก ${result.total}`
              : `ถูกแล้ว ${result.correctCount} จาก ${result.total} ลองสลับดูอีกที`}
          </span>
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 flex gap-2 rounded-2xl bg-surface-sunken p-4 text-body text-pretty text-ink ring-1 ring-line ring-inset">
          <InfoIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
          <span className="min-w-0">{message}</span>
        </p>
      ) : null}
    </div>
  )
}

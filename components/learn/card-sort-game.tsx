'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { AlertIcon, Button, CheckIcon, DomeAvatar, LightbulbIcon, RefreshIcon, StarIcon, cn } from '@/components/ui'
import { Confetti, CountUp, Float, Shake, buzz } from './app/fx'
import type { DoResponse } from './learn-path-api'

/**
 * ภารกิจจับคู่ความหมาย (do.kind cards) — docs/teammates/OBJ01_Do_DragDrop_Learning_Flow.md
 * D01 รับภารกิจ · D03 ลาก/แตะจัดการ์ดลงช่อง · D04 ตรวจ (เซิร์ฟเวอร์) · D05 ผ่าน · D06 โดมช่วยเฉพาะจุด
 * ⚠️ ไม่มีเฉลยในไฟล์นี้ ระหว่างจัดไม่บอกถูกผิด เซิร์ฟเวอร์ตรวจแล้วบอกเฉพาะ "ใบไหนยังไม่ใช่"
 */

export interface CardSortData {
  zones: { id: string; title: string }[]
  cards: { id: string; text: string }[]
}

interface CardDetail {
  correct: string[]
  wrong: string[]
  feedback: string
  hint: string
}

type Phase = 'intro' | 'play' | 'result'

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function CardSortGame({
  data,
  mission,
  storageKey,
  onSubmit,
  onChangeMode,
  onLater,
}: {
  data: CardSortData
  mission: string
  /** เก็บตำแหน่งการ์ดในแท็บนี้ รีโหลดแล้วจัดต่อได้ */
  storageKey?: string
  onSubmit: (payload: unknown) => Promise<DoResponse>
  onChangeMode: () => void
  onLater: () => void
}) {
  const reduce = useReducedMotion()
  const order = useMemo(() => shuffle(data.cards), [data.cards])
  const [phase, setPhase] = useState<Phase>('intro')
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [result, setResult] = useState<DoResponse | null>(null)
  const [attempt, setAttempt] = useState(1)
  const [hintOpen, setHintOpen] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const [shake, setShake] = useState(0)
  const [fire, setFire] = useState(0)
  const [showReview, setShowReview] = useState(false)
  const [restored, setRestored] = useState(false)
  const zoneRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!storageKey) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as {
        phase?: string
        placed?: Record<string, string>
      } | null
      if (saved?.placed) {
        const valid = Object.fromEntries(
          Object.entries(saved.placed).filter(
            ([c, z]) => data.cards.some((x) => x.id === c) && data.zones.some((x) => x.id === z),
          ),
        )
        setPlaced(valid)
        if (saved.phase === 'play') setPhase('play')
      }
    } catch {
      /* ข้าม */
    }
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- อ่านครั้งเดียว
  }, [])
  useEffect(() => {
    if (!storageKey || !restored) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ phase: phase === 'intro' ? 'intro' : 'play', placed }))
    } catch {
      /* ข้าม */
    }
  }, [storageKey, restored, phase, placed])

  const detail = (result?.detail ?? null) as CardDetail | null
  const count = Object.keys(placed).length
  const total = data.cards.length
  const tray = order.filter((c) => !placed[c.id])

  function put(cardId: string, zoneId: string) {
    buzz()
    setPlaced((p) => ({ ...p, [cardId]: zoneId }))
    setSelected(null)
  }
  function back(cardId: string) {
    setPlaced((p) => {
      const next = { ...p }
      delete next[cardId]
      return next
    })
    setSelected(null)
  }

  /** ปล่อยการ์ด: อยู่ในช่องไหนก็ลงช่องนั้น ไม่เป๊ะก็ดูดเข้าช่องที่ใกล้ในระยะ 90px */
  function drop(cardId: string, x: number, y: number) {
    let best: { id: string; d: number } | null = null
    for (const z of data.zones) {
      const r = zoneRefs.current[z.id]?.getBoundingClientRect()
      if (!r) continue
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
      const d = Math.hypot(dx, dy)
      if (!best || d < best.d) best = { id: z.id, d }
    }
    if (best && best.d <= 90) put(cardId, best.id)
  }

  async function check() {
    setBusy(true)
    setSendError(false)
    try {
      const res = await onSubmit({ placements: placed })
      setResult(res)
      setPhase('result')
      setHintOpen(false)
      if (res.passed) setFire((f) => f + 1)
      else setShake((s) => s + 1)
    } catch {
      setSendError(true)
    } finally {
      setBusy(false)
    }
  }

  function retry() {
    setAttempt(2)
    setPhase('play')
    setResult(null)
    setHintOpen(false)
    setHintUsed(false)
  }

  function reset() {
    setPlaced({})
    setSelected(null)
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-col gap-4 rounded-[24px] bg-white/95 p-5 text-center shadow-soft-2 ring-1 ring-white/70 backdrop-blur-xl">
        <Float className="self-center">
          <DomeAvatar mood="cheer" size={96} decorative />
        </Float>
        <h3 className="text-title-sm font-extrabold text-ink">ภารกิจจับคู่ความหมาย</h3>
        <p className="text-body text-ink">ช่วยมีนนำคำอธิบายไปวางใต้คำศัพท์ที่ถูกต้อง</p>
        <p className="mx-auto rounded-full bg-brand-50 px-4 py-1.5 text-label font-bold text-brand-700">
          มี {total} การ์ด • ไม่จับเวลา
        </p>
        <Button size="lg" fullWidth onClick={() => setPhase('play')}>
          เริ่มภารกิจ
        </Button>
      </div>
    )
  }

  if (phase === 'result' && detail && result) {
    const wrongSet = new Set(detail.wrong)
    const passed = result.passed
    return (
      <div className="relative flex flex-col gap-3">
        <Confetti fire={fire} />
        <Shake trigger={passed ? 0 : shake}>
          <div
            className={cn(
              'flex flex-col gap-3 rounded-[24px] p-5 shadow-soft-2 ring-1 backdrop-blur-xl',
              passed ? 'bg-quest-50/95 ring-quest-200' : 'bg-spark-50/95 ring-spark-200',
            )}
            role="status"
          >
            <p className="flex items-center gap-2 text-body-lg font-extrabold text-ink">
              {passed ? (
                <CheckIcon width={24} height={24} aria-hidden className="text-quest-700" />
              ) : (
                <AlertIcon width={24} height={24} aria-hidden className="text-spark-700" />
              )}
              {passed ? 'ผ่านภารกิจแล้ว' : 'ยังไม่ครบ ลองอีกครั้งนะ'}
            </p>
            <p className="flex items-center gap-2 text-title font-extrabold text-ink">
              <StarIcon width={28} height={28} aria-hidden className="text-reward-500" />
              คะแนนของฉัน <CountUp value={result.score} />%
            </p>
            {passed ? <p className="text-label text-ink-muted">ได้คะแนนมากกว่า 60% จึงผ่านกิจกรรมนี้แล้ว</p> : null}
            <div className="flex items-start gap-3">
              <Float>
                <DomeAvatar mood={passed ? 'happy' : 'cheer'} size={56} decorative />
              </Float>
              <p className="rounded-2xl bg-white px-4 py-3 text-body text-ink shadow-soft-1">{detail.feedback}</p>
            </div>
            {passed ? (
              <ul className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-3 text-label text-ink">
                <li>โดเมนเนม = ชื่อที่ใช้ระบุ/เข้าเว็บไซต์</li>
                <li>DNS = ระบบช่วยค้นหาที่อยู่ IP จากชื่อโดเมน</li>
              </ul>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="การ์ดที่ควรทบทวน">
                {data.cards
                  .filter((c) => wrongSet.has(c.id))
                  .map((c) => (
                    <li key={c.id} className="rounded-2xl bg-white px-4 py-3 text-body text-ink ring-2 ring-spark-400">
                      {c.text}
                    </li>
                  ))}
              </ul>
            )}
            {!passed && hintOpen ? (
              <p className="flex items-start gap-2 rounded-2xl bg-reward-100 px-4 py-3 text-body text-ink">
                <LightbulbIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0 text-reward-700" />
                {detail.hint}
              </p>
            ) : null}
            {passed && detail.wrong.length > 0 ? (
              <div className="flex flex-col gap-2" aria-label="การ์ดที่ยังวางไม่ตรง">
                <p className="text-label font-bold text-ink">การ์ดที่ยังวางไม่ตรง ลองทบทวนอีกนิดนะ</p>
                <ul className="flex flex-col gap-2">
                  {data.cards
                    .filter((c) => wrongSet.has(c.id))
                    .map((c) => (
                      <li
                        key={c.id}
                        className="rounded-2xl bg-white px-4 py-3 text-body text-ink ring-2 ring-spark-400"
                      >
                        <span className="mb-1 block w-fit rounded-full bg-spark-100 px-2.5 py-0.5 text-label font-bold text-spark-700">
                          ควรทบทวน
                        </span>
                        {c.text}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            {passed ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowReview((v) => !v)}
                  className="min-h-11 self-start rounded-full bg-white px-4 text-label font-bold text-brand-700 transition-transform active:scale-95 focus-ring"
                >
                  {showReview ? 'ซ่อนการจับคู่' : 'ดูการจับคู่และคำแนะนำ'}
                </button>
                {showReview ? (
                  <ul className="flex flex-col gap-2">
                    {data.zones.map((z) => (
                      <li key={z.id} className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-label font-extrabold text-brand-700">{z.title}</p>
                        <ul className="mt-1 list-disc pl-5 text-label text-ink">
                          {data.cards
                            .filter((c) => placed[c.id] === z.id)
                            .map((c) => (
                              <li key={c.id} className={wrongSet.has(c.id) ? 'font-bold text-spark-700' : undefined}>
                                {c.text}
                                {wrongSet.has(c.id) ? ' (ควรทบทวน)' : ''}
                              </li>
                            ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : attempt === 1 ? (
              <div className="flex flex-col gap-2">
                <Button size="lg" fullWidth onClick={retry} leadingIcon={<RefreshIcon width={22} height={22} />}>
                  แก้การจับคู่
                </Button>
                {!hintUsed ? (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setHintOpen(true)
                      setHintUsed(true)
                    }}
                  >
                    ขอคำใบ้
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-body font-bold text-ink">ยังมีบางจุดที่ควรทบทวนครับ</p>
                <Button size="md" fullWidth onClick={onChangeMode}>
                  ลองเส้นทางดูหรืออ่าน
                </Button>
                <Button variant="secondary" size="md" fullWidth onClick={onChangeMode}>
                  กลับไปทบทวนเรื่องนี้
                </Button>
                <Button variant="ghost" size="md" fullWidth onClick={onLater}>
                  บันทึกไว้เรียนต่อ
                </Button>
              </div>
            )}
          </div>
        </Shake>
      </div>
    )
  }

  const markWrong = attempt === 2 && detail ? new Set(detail.wrong) : new Set<string>()

  return (
    <div className="flex flex-col gap-3" data-mission={mission}>
      <div className="rounded-[22px] bg-white px-4 py-3 shadow-soft-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h3 className="text-title-sm font-extrabold text-ink">จับคู่ความหมายให้ถูกต้อง</h3>
          <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-label font-extrabold whitespace-nowrap text-brand-700 tabular-nums">
            จัดแล้ว {count}/{total} ใบ
          </span>
        </div>
        <p className="mt-1 text-label text-ink-muted">ลากการ์ดหรือแตะการ์ดแล้วเลือกกลุ่ม</p>
      </div>

      {data.zones.map((z) => {
        const inside = data.cards.filter((c) => placed[c.id] === z.id)
        return (
          <div
            key={z.id}
            ref={(el) => {
              zoneRefs.current[z.id] = el
            }}
            data-zone-id={z.id}
            role="group"
            aria-label={z.title}
            onClick={() => selected && put(selected, z.id)}
            className={cn(
              'flex min-h-28 flex-col gap-2 rounded-[22px] bg-white/95 p-3 ring-2 ring-dashed backdrop-blur-xl transition-colors',
              selected ? 'ring-brand-500' : 'ring-brand-200',
            )}
          >
            <p className="flex items-center justify-between gap-2 text-body font-extrabold text-brand-700">
              <span className="min-w-0 text-pretty">{z.title}</span>
              <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-label whitespace-nowrap text-ink tabular-nums">
                {inside.length} ใบ
              </span>
            </p>
            {inside.length === 0 ? <p className="py-2 text-center text-label text-ink-muted">วางการ์ดที่นี่</p> : null}
            {inside.map((c) => (
              <CardChip
                key={c.id}
                text={c.text}
                warn={markWrong.has(c.id)}
                selected={selected === c.id}
                reduce={!!reduce}
                onTap={() => (selected === c.id ? setSelected(null) : setSelected(c.id))}
                onDrop={(x, y) => drop(c.id, x, y)}
                action={{ label: 'ย้ายกลับ', onClick: () => back(c.id) }}
              />
            ))}
          </div>
        )
      })}

      <div className="flex flex-col gap-2 rounded-[22px] bg-white/95 p-3 shadow-soft-1 backdrop-blur-xl">
        <p className="text-label font-bold text-ink">การ์ดรอจัด</p>
        {tray.length === 0 ? <p className="py-2 text-center text-label text-ink-muted">จัดครบทุกใบแล้ว</p> : null}
        {tray.map((c) => (
          <CardChip
            key={c.id}
            text={c.text}
            selected={selected === c.id}
            reduce={!!reduce}
            onTap={() => (selected === c.id ? setSelected(null) : setSelected(c.id))}
            onDrop={(x, y) => drop(c.id, x, y)}
          />
        ))}
        {selected ? (
          <div className="flex flex-col gap-2 pt-1" role="group" aria-label="เลือกกลุ่มให้การ์ด">
            {data.zones.map((z) => (
              <Button
                key={z.id}
                variant="secondary"
                size="md"
                fullWidth
                className="whitespace-nowrap"
                onClick={() => put(selected, z.id)}
              >
                {z.title}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {sendError ? (
        <p role="alert" className="flex items-center gap-2 text-label font-bold text-danger-700">
          <AlertIcon width={20} height={20} aria-hidden />
          ส่งไม่สำเร็จ ลองกดตรวจคำตอบอีกครั้ง
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="ghost" size="lg" className="bg-white shadow-soft-1" onClick={reset} disabled={count === 0 || busy}>
          เริ่มใหม่
        </Button>
        <Button
          size="lg"
          className="flex-1"
          disabled={count < total || busy}
          loading={busy}
          loadingLabel="กำลังตรวจ"
          onClick={check}
          leadingIcon={busy ? undefined : <CheckIcon width={22} height={22} />}
        >
          ตรวจคำตอบ
        </Button>
      </div>
    </div>
  )
}

function CardChip({
  text,
  selected,
  warn,
  reduce,
  onTap,
  onDrop,
  action,
}: {
  text: string
  selected: boolean
  warn?: boolean
  reduce: boolean
  onTap: () => void
  onDrop: (x: number, y: number) => void
  action?: { label: string; onClick: () => void }
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div className="flex items-stretch gap-2">
      <motion.button
        type="button"
        layout={!reduce}
        drag
        dragSnapToOrigin
        dragElastic={0.2}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        whileDrag={{ scale: 1.04, zIndex: 20 }}
        onDragStart={() => setDragging(true)}
        onDragEnd={(e) => {
          setDragging(false)
          const p = e as PointerEvent
          const pt = 'clientX' in p ? p : (e as unknown as TouchEvent).changedTouches?.[0]
          if (pt) onDrop(pt.clientX, pt.clientY)
        }}
        onTap={onTap}
        aria-pressed={selected}
        className={cn(
          'min-h-14 flex-1 touch-none rounded-2xl bg-white px-4 py-3 text-left text-body font-bold text-ink shadow-soft-1 ring-2 select-none',
          selected ? 'scale-[1.02] bg-brand-50 ring-4 ring-brand-500' : warn ? 'ring-spark-500' : 'ring-line',
          dragging && 'shadow-soft-3',
        )}
      >
        {selected ? <span className="mb-0.5 block text-label font-extrabold text-brand-700">เลือกอยู่</span> : null}
        {text}
      </motion.button>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-11 shrink-0 rounded-2xl px-3 text-label font-bold text-brand-700 transition-transform active:scale-95 focus-ring"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}

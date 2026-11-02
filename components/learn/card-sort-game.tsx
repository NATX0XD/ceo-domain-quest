'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { AlertIcon, Button, CheckIcon, DomeAvatar, LightbulbIcon, RefreshIcon, StarIcon, cn } from '@/components/ui'
import { Confetti, CountUp, Float, Shake, buzz } from './app/fx'
import './card-sort-game.css'
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
  onPassed,
}: {
  data: CardSortData
  mission: string
  /** เก็บตำแหน่งการ์ดในแท็บนี้ รีโหลดแล้วจัดต่อได้ */
  storageKey?: string
  onSubmit: (payload: unknown) => Promise<DoResponse>
  onChangeMode: () => void
  onLater: () => void
  /** มีให้ = ผ่านแล้วส่งต่อให้หน้าสรุปรวมของเส้นทางเรียน ไม่แสดงจอผลซ้ำในเกม */
  onPassed?: (res: DoResponse) => void
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
  const [bump, setBump] = useState<Record<string, number>>({})
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
    setBump((b) => ({ ...b, [zoneId]: (b[zoneId] ?? 0) + 1 }))
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
      if (res.passed) {
        setFire((f) => f + 1)
        onPassed?.(res)
      } else setShake((s) => s + 1)
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
      <div className="cs-intro relative flex flex-col items-center gap-3 overflow-hidden rounded-[28px] p-5 text-center">
        <Float className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- มาสคอตทางการ */}
          <img src="/dome/mascot/dome-cheer.webp" alt="" aria-hidden="true" draggable={false} className="select-none" style={{ height: 112, width: 'auto', maxWidth: 'none' }} />
        </Float>
        <p className="relative z-10 rounded-full bg-white/80 px-3 py-0.5 text-label font-extrabold text-[#7a4b00]">ลงมือทำ · เกมจับคู่</p>
        <h3 className="relative z-10 font-display text-[1.6rem] font-extrabold leading-tight text-[#3a1a6e]">จับคู่ความหมาย</h3>
        <p className="relative z-10 text-body text-[#4a3a2a]">ช่วยมีนนำการ์ดคำอธิบายไปวางในกล่องคำศัพท์ที่ถูกต้อง</p>
        <div className="relative z-10 grid w-full grid-cols-2 gap-2">
          {data.zones.map((z, i) => {
            const t = zoneTheme(z.id, i)
            return (
              <div key={z.id} className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5" style={{ backgroundColor: t.bg, boxShadow: `inset 0 0 0 2px ${t.ring}55` }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D */}
                <img src={t.icon} alt="" aria-hidden="true" className="size-11" draggable={false} />
                <span className="text-label font-extrabold leading-tight" style={{ color: t.ink }}>{z.title}</span>
              </div>
            )
          })}
        </div>
        <p className="relative z-10 flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-label font-bold text-[#5a3d00] shadow-soft-1">
          {total} การ์ด · ไม่จับเวลา · ผิดได้ แก้ได้
        </p>
        <Button size="lg" fullWidth onClick={() => setPhase('play')} className="relative z-10">
          เริ่มเล่น
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
                <DomeAvatar mood={passed ? 'celebrate' : 'encourage'} size={56} decorative />
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
  const pct = total ? Math.round((count / total) * 100) : 0

  return (
    <div className="flex flex-col gap-3" data-mission={mission}>
      <div className="cs-head rounded-[22px] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 text-title-sm font-extrabold text-[#3a1a6e]">จับคู่ความหมายให้ถูกต้อง</h3>
          <motion.span
            key={count}
            initial={reduce ? false : { scale: 1.35 }}
            animate={{ scale: 1 }}
            className="shrink-0 rounded-full bg-[#7c4dd6] px-3 py-1 text-label font-extrabold whitespace-nowrap text-white tabular-nums shadow-[0_3px_0_#5a2fb0]"
          >
            {count}/{total} ใบ
          </motion.span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#ece3fb]" aria-hidden="true">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[#ffb21e] to-[#f26b1d]" animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 200, damping: 24 }} />
        </div>
        <p className="mt-1.5 text-label font-semibold text-[#5b4a82]">
          {selected ? 'แตะกล่องที่ใช่ เพื่อวางการ์ดที่เลือก' : 'แตะการ์ดด้านล่าง แล้วแตะกล่องที่ใช่ (หรือลากไปวาง)'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {data.zones.map((z, zi) => {
          const inside = data.cards.filter((c) => placed[c.id] === z.id)
          const t = zoneTheme(z.id, zi)
          return (
            <motion.div
              key={z.id}
              ref={(el) => {
                zoneRefs.current[z.id] = el
              }}
              data-zone-id={z.id}
              role="group"
              aria-label={z.title}
              onClick={() => selected && put(selected, z.id)}
              className={cn('cs-zone relative flex min-h-28 flex-col gap-2 rounded-[24px] p-3', selected && 'cs-zone-target')}
              style={{ backgroundColor: t.bg, ['--cs-ring' as string]: t.ring }}
            >
              {bump[z.id] && !reduce ? (
                <motion.span
                  key={bump[z.id]}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[24px]"
                  style={{ boxShadow: `0 0 0 4px ${t.ring}, 0 0 26px ${t.ring}` }}
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                />
              ) : null}
              <div className="flex items-center gap-2.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/85 shadow-[0_3px_0_rgba(0,0,0,0.08)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D */}
                  <img src={t.icon} alt="" aria-hidden="true" className="size-9" draggable={false} />
                </span>
                <span className="min-w-0 flex-1 text-body-lg font-extrabold leading-tight text-pretty" style={{ color: t.ink }}>
                  {z.title}
                </span>
                <motion.span
                  key={inside.length}
                  initial={reduce ? false : { scale: 1.5 }}
                  animate={{ scale: 1 }}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-body font-extrabold text-white tabular-nums"
                  style={{ backgroundColor: t.ring }}
                  aria-label={`${inside.length} ใบ`}
                >
                  {inside.length}
                </motion.span>
              </div>
              {inside.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed px-3 py-3 text-center text-label font-bold" style={{ borderColor: `${t.ring}66`, color: t.ink }}>
                  {selected ? 'แตะที่นี่เพื่อวาง' : 'ยังว่าง วางการ์ดที่นี่'}
                </p>
              ) : null}
              {inside.map((c) => (
                <CardChip
                  key={c.id}
                  text={c.text}
                  warn={markWrong.has(c.id)}
                  selected={selected === c.id}
                  reduce={!!reduce}
                  tone={t}
                  onTap={() => (selected === c.id ? setSelected(null) : setSelected(c.id))}
                  onDrop={(x, y) => drop(c.id, x, y)}
                  action={{ label: 'ย้ายกลับ', onClick: () => back(c.id) }}
                />
              ))}
            </motion.div>
          )
        })}
      </div>

      <div className="cs-tray flex flex-col gap-2 rounded-[24px] p-3">
        <p className="flex items-center gap-2 text-label font-extrabold text-[#5a3d00]">
          {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D */}
          <img src="/icons/3d/package.webp" alt="" aria-hidden="true" className="size-6" />
          การ์ดรอจัด {tray.length > 0 ? `(${tray.length})` : ''}
        </p>
        {tray.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-2 text-center text-label font-bold text-[#12633a]">
            {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D */}
            <img src="/icons/3d/check-mark-button.webp" alt="" aria-hidden="true" className="size-6" />
            จัดครบทุกใบแล้ว กดตรวจคำตอบได้เลย
          </p>
        ) : null}
        {tray.map((c, i) => (
          <CardChip
            key={c.id}
            text={c.text}
            selected={selected === c.id}
            reduce={!!reduce}
            tone={TRAY_TONES[i % TRAY_TONES.length]!}
            onTap={() => (selected === c.id ? setSelected(null) : setSelected(c.id))}
            onDrop={(x, y) => drop(c.id, x, y)}
          />
        ))}
        {selected ? (
          <div className="grid grid-cols-2 gap-2 pt-1" role="group" aria-label="เลือกกลุ่มให้การ์ด">
            {data.zones.map((z, zi) => {
              const t = zoneTheme(z.id, zi)
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => put(selected, z.id)}
                  className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl px-2 text-label font-extrabold text-white transition-transform active:translate-y-[2px]"
                  style={{ backgroundColor: t.ring, boxShadow: `0 4px 0 ${t.ink}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D */}
                  <img src={t.icon} alt="" aria-hidden="true" className="size-6" />
                  <span className="min-w-0 truncate">{z.title}</span>
                </button>
              )
            })}
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
          {count < total ? `จัดอีก ${total - count} ใบ` : 'ตรวจคำตอบ'}
        </Button>
      </div>
    </div>
  )
}

interface Tone {
  bg: string
  ring: string
  ink: string
  icon: string
}

const ZONE_TONES: Tone[] = [
  { bg: '#e2f1ff', ring: '#2f7de1', ink: '#123f7a', icon: '/icons/3d/memo.webp' },
  { bg: '#e3f8e8', ring: '#1f9d55', ink: '#0f5132', icon: '/icons/3d/magnifying-glass-tilted-left.webp' },
  { bg: '#fdeedd', ring: '#e07a1f', ink: '#6b3606', icon: '/icons/3d/bullseye.webp' },
]
const ZONE_BY_ID: Record<string, number> = { ZONE_DOMAIN: 0, ZONE_DNS: 1 }
function zoneTheme(id: string, index: number): Tone {
  return ZONE_TONES[ZONE_BY_ID[id] ?? index % ZONE_TONES.length]!
}
const TRAY_TONES: Tone[] = [
  { bg: '#fff6d6', ring: '#f2b705', ink: '#5a3d00', icon: '' },
  { bg: '#fde7f1', ring: '#e2588f', ink: '#6b1238', icon: '' },
  { bg: '#efe6ff', ring: '#8a5cf0', ink: '#3a1a6e', icon: '' },
  { bg: '#ddf6f4', ring: '#16a3a0', ink: '#0b4f4d', icon: '' },
]

function CardChip({
  text,
  selected,
  warn,
  reduce,
  tone,
  onTap,
  onDrop,
  action,
}: {
  text: string
  selected: boolean
  warn?: boolean
  reduce: boolean
  tone: Tone
  onTap: () => void
  onDrop: (x: number, y: number) => void
  action?: { label: string; onClick: () => void }
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <motion.div
      className="flex items-stretch gap-2"
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    >
      <motion.button
        type="button"
        drag
        dragSnapToOrigin
        dragElastic={0.2}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        whileDrag={{ scale: 1.05, rotate: -2, zIndex: 20 }}
        animate={reduce ? undefined : { y: selected ? -3 : 0 }}
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
          'relative min-h-14 flex-1 touch-none overflow-hidden rounded-2xl py-3 pl-5 pr-4 text-left text-body font-bold select-none',
          dragging && 'shadow-soft-3',
        )}
        style={{
          backgroundColor: selected ? '#fff' : tone.bg,
          color: tone.ink,
          boxShadow: selected
            ? '0 0 0 4px #f26b1d, 0 8px 18px rgba(242,107,29,0.35)'
            : warn
              ? '0 0 0 3px #f59e0b, 0 3px 0 rgba(0,0,0,0.08)'
              : `0 0 0 2px ${tone.ring}55, 0 3px 0 ${tone.ring}66`,
        }}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2" style={{ backgroundColor: selected ? '#f26b1d' : tone.ring }} />
        {selected ? (
          <span className="mb-0.5 block text-label font-extrabold text-[#c2410c]">เลือกอยู่ · แตะกล่องที่ใช่</span>
        ) : warn ? (
          <span className="mb-0.5 block text-label font-extrabold text-[#b45309]">ลองย้ายใบนี้ดู</span>
        ) : null}
        {text}
      </motion.button>
      {action ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            action.onClick()
          }}
          aria-label={`${action.label} ${text}`}
          className="min-h-11 shrink-0 rounded-2xl bg-white/70 px-2.5 text-label font-bold text-[#5b4a82] transition-transform active:scale-95 focus-ring"
        >
          {action.label}
        </button>
      ) : null}
    </motion.div>
  )
}

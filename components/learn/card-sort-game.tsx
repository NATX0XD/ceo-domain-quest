'use client'

/* eslint-disable @next/next/no-img-element -- ภาพสถิตจาก public/ */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertIcon, CheckIcon, ChevronRightIcon, LightbulbIcon, RefreshIcon, cn } from '@/components/ui'
import { Confetti, CountUp, Shake, buzz } from './app/fx'
import { DomeSays, M1Board, M1Button } from './m1/m1-shell'
import './card-sort-game.css'
import type { DoResponse } from './learn-path-api'

/**
 * ภารกิจจับคู่ความหมาย (do.kind cards) — docs/teammates/OBJ01_Do_DragDrop_Learning_Flow.md
 * D01+D02 รับภารกิจ+วิธีเล่น · D03 ลาก/แตะจัดการ์ดลงช่อง · D04 ตรวจ (เซิร์ฟเวอร์) · D05 ผ่าน · D06 โดมช่วยเฉพาะจุด
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

const ZONE_TONE: Record<string, string> = { ZONE_DOMAIN: 'is-a', ZONE_DNS: 'is-b' }

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
  /** ผ่านแล้วกดไปต่อ = ส่งต่อให้เส้นทางเรียน */
  onPassed?: (res: DoResponse) => void
}) {
  const reduce = useReducedMotion()
  const [order, setOrder] = useState(data.cards)
  const [phase, setPhase] = useState<Phase>('intro')
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [result, setResult] = useState<DoResponse | null>(null)
  const [attempt, setAttempt] = useState(1)
  const [lastWrong, setLastWrong] = useState<string[]>([])
  const [hintOpen, setHintOpen] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const [playHint, setPlayHint] = useState(false)
  const [shake, setShake] = useState(0)
  const [fire, setFire] = useState(0)
  const [showReview, setShowReview] = useState(false)
  const [restored, setRestored] = useState(false)
  const [bump, setBump] = useState<Record<string, number>>({})
  const zoneRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // สุ่มลำดับการ์ดหลังเปิดหน้า (ไม่สุ่มตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ จะได้ไม่ขึ้นเตือน hydration)
  useEffect(() => {
    setOrder(shuffle(data.cards))
  }, [data.cards])

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

  /** หาช่องที่อยู่ใต้นิ้ว ไม่เป๊ะก็ดูดเข้าช่องที่ใกล้ในระยะ 90px */
  function zoneAt(x: number, y: number): string | null {
    let best: { id: string; d: number } | null = null
    for (const z of data.zones) {
      const r = zoneRefs.current[z.id]?.getBoundingClientRect()
      if (!r) continue
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
      const d = Math.hypot(dx, dy)
      if (!best || d < best.d) best = { id: z.id, d }
    }
    return best && best.d <= 90 ? best.id : null
  }
  function drop(cardId: string, x: number, y: number) {
    setHover(null)
    const z = zoneAt(x, y)
    if (z) put(cardId, z)
  }

  async function check() {
    setBusy(true)
    setSendError(false)
    try {
      const res = await onSubmit({ placements: placed })
      setResult(res)
      setLastWrong(((res.detail ?? null) as CardDetail | null)?.wrong ?? [])
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

  /* ---------------------------------------------------------- D01 + D02 */
  if (phase === 'intro') {
    return (
      <div className="m1-stack" data-mission={mission}>
        <M1Board className="cs-brief">
          <p className="m1-kicker">ด่านที่ 1 · ลงมือทำ</p>
          <h2 className="m1-board-title">ภารกิจจับคู่ความหมาย</h2>
          <div className="m1-art cs-brief-art">
            <img src="/learn/m1/watch-s1.webp" alt="มีนกำลังเตรียมการ์ดคำอธิบายในร้านขนมบ้านยาย" draggable={false} />
            <span className="cs-float-card cs-fc-1" aria-hidden />
            <span className="cs-float-card cs-fc-2" aria-hidden />
            <span className="cs-float-card cs-fc-3" aria-hidden />
            <span className="m1-art-tag">มีนถือการ์ดคำอธิบาย</span>
          </div>
          <p className="m1-lead">ช่วยมีนนำคำอธิบายไปวางใต้คำศัพท์ที่ถูกต้อง</p>
          <div className="cs-howto" aria-label="วิธีเล่น">
            <div className="cs-howto-demo" aria-hidden>
              <span className="cs-demo-zone">
                <b>โดเมนเนม</b>
              </span>
              <span className="cs-demo-zone is-b">
                <b>DNS</b>
              </span>
              <span className="cs-demo-card" />
              <span className="cs-demo-hand">👆</span>
            </div>
            <p>แตะหรือจับการ์ดแล้วนำไปวางในกลุ่ม <b>โดเมนเนม</b> หรือ <b>DNS</b> จนครบ 4 ใบครับ</p>
          </div>
          <div className="m1-chip-row">
            <span className="m1-chip">
              <img src="/icons/3d/package.webp" alt="" aria-hidden />
              มี {total} การ์ด • ไม่จับเวลา
            </span>
            <span className="m1-chip is-purple">
              <img src="/icons/3d/trophy.webp" alt="" aria-hidden />
              เกิน 60% ผ่าน
            </span>
          </div>
        </M1Board>
        <DomeSays mood="cheer" size={88}>
          พร้อมช่วยมีนจัดการ์ดไหมครับ? ลากหรือแตะจัดคำอธิบายให้ตรงกับโดเมนเนมและ DNS ได้เลย
        </DomeSays>
        <div className="cs-actions">
          <M1Button fullWidth onClick={() => setPhase('play')} trailingIcon={<ChevronRightIcon width={22} height={22} />}>
            เริ่มภารกิจ
          </M1Button>
          <M1Button variant="secondary" size="md" fullWidth onClick={onChangeMode}>
            ย้อนกลับ
          </M1Button>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------- D05 / D06 */
  if (phase === 'result' && detail && result) {
    const wrongSet = new Set(detail.wrong)
    const passed = result.passed
    return (
      <div className="m1-stack" data-mission={mission}>
        <Confetti fire={fire} />
        <Shake trigger={passed ? 0 : shake}>
          <div className={cn('lr-score', passed ? 'is-pass' : 'is-retry')} role="status">
            <div className="lr-ring" style={{ ['--p' as string]: `${result.score}` }}>
              <span>
                <CountUp value={result.score} />%
              </span>
            </div>
            <div className="min-w-0">
              <p className="lr-label">คะแนนของฉัน</p>
              <p className="lr-status">
                {passed ? <CheckIcon width={22} height={22} aria-hidden /> : <AlertIcon width={22} height={22} aria-hidden />}
                {passed ? 'ผ่านภารกิจแล้ว' : 'ยังไม่ผ่าน ลองอีกครั้งนะ'}
              </p>
              <p className="lr-note">
                {passed ? 'ได้คะแนนมากกว่า 60% จึงผ่านกิจกรรมนี้แล้ว' : attempt === 1 ? 'แก้การจับคู่ได้อีก 1 รอบ' : 'ใช้รอบแก้ครบแล้ว'}
              </p>
            </div>
          </div>
        </Shake>
        <div className="lr-dome">
          <img
            src={`/dome/mascot/dome-${passed ? 'celebrate' : 'think'}.webp`}
            alt=""
            aria-hidden
            style={{ width: 72, height: 'auto', maxWidth: 'none' }}
          />
          <p className="lr-bubble">{detail.feedback}</p>
        </div>
        {passed ? (
          <M1Board className="cs-recap" kicker="สรุปสั้น ๆ">
            <ul>
              <li>
                <b>โดเมนเนม</b> = ชื่อที่ใช้ระบุ/เข้าเว็บไซต์
              </li>
              <li>
                <b>DNS</b> = ระบบช่วยค้นหาที่อยู่ IP จากชื่อโดเมน
              </li>
            </ul>
          </M1Board>
        ) : (
          <M1Board className="cs-wrong" kicker="การ์ดที่ควรย้าย">
            <ul aria-label="การ์ดที่ควรทบทวน">
              {data.cards
                .filter((c) => wrongSet.has(c.id))
                .map((c) => (
                  <li key={c.id}>{c.text}</li>
                ))}
            </ul>
            {hintOpen ? (
              <p className="cs-hint">
                <LightbulbIcon width={22} height={22} aria-hidden />
                {detail.hint}
              </p>
            ) : null}
          </M1Board>
        )}
        {passed && detail.wrong.length > 0 ? (
          <p className="m1-review-note">ยังวางไม่ตรง {detail.wrong.length} ใบ ไม่ต้องแก้ก็ผ่านแล้ว ดูการจับคู่ด้านล่างเพื่อทบทวนได้</p>
        ) : null}
        {passed && showReview ? (
          <M1Board kicker="การจับคู่ของฉัน">
            <ul className="cs-review">
              {data.zones.map((z) => (
                <li key={z.id}>
                  <b>{z.title}</b>
                  <ul>
                    {data.cards
                      .filter((c) => placed[c.id] === z.id)
                      .map((c) => (
                        <li key={c.id} className={wrongSet.has(c.id) ? 'is-wrong' : undefined}>
                          {c.text}
                          {wrongSet.has(c.id) ? ' (ควรทบทวน)' : ''}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </M1Board>
        ) : null}
        <div className="cs-actions">
          {passed ? (
            <>
              {onPassed ? (
                <M1Button variant="success" fullWidth onClick={() => onPassed(result)} trailingIcon={<ChevronRightIcon width={22} height={22} />}>
                  ไปต่อ: คำถามท้ายภารกิจ
                </M1Button>
              ) : null}
              <M1Button variant="secondary" size="md" fullWidth onClick={() => setShowReview((v) => !v)}>
                {showReview ? 'ซ่อนการจับคู่' : 'ดูการจับคู่และคำแนะนำ'}
              </M1Button>
            </>
          ) : attempt === 1 ? (
            <>
              <M1Button fullWidth onClick={retry} leadingIcon={<RefreshIcon width={22} height={22} />}>
                แก้การจับคู่
              </M1Button>
              {!hintUsed ? (
                <M1Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setHintOpen(true)
                    setHintUsed(true)
                  }}
                >
                  ขอคำใบ้
                </M1Button>
              ) : null}
            </>
          ) : (
            <>
              <p className="cs-stop">ยังมีบางจุดที่ควรทบทวนครับ</p>
              <M1Button fullWidth onClick={onChangeMode}>
                ลองเส้นทางดูหรืออ่าน
              </M1Button>
              <M1Button variant="secondary" size="md" fullWidth onClick={onLater}>
                บันทึกไว้เรียนต่อ
              </M1Button>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------- D03 */
  const markWrong = attempt === 2 ? new Set(lastWrong) : new Set<string>()
  const pct = total ? Math.round((count / total) * 100) : 0

  return (
    <div className="m1-stack cs-play" data-mission={mission}>
      <M1Board className="cs-head">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m1-board-title cs-head-title">จับคู่ความหมายให้ถูกต้อง</h2>
          <button
            type="button"
            className="cs-hint-btn"
            onClick={() => setPlayHint((v) => !v)}
            aria-expanded={playHint}
          >
            <img src="/learn/m1/kit/icon_hint.webp" alt="" aria-hidden />
            ขอคำใบ้
          </button>
        </div>
        <p className="cs-help">
          {selected ? 'เลือกการ์ดแล้ว แตะกลุ่มที่ใช่เพื่อวาง' : 'ลากการ์ดหรือแตะเพื่อเลือกกลุ่ม'}
        </p>
        <AnimatePresence initial={false}>
          {playHint ? (
            <motion.p
              className="cs-hint"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? undefined : { height: 0, opacity: 0 }}
            >
              <LightbulbIcon width={20} height={20} aria-hidden />
              <span>ลองดูว่าการ์ดไหนพูดถึง <b>ชื่อ</b> และใบไหนพูดถึง <b>ระบบค้นหาที่อยู่</b> ครับ</span>
            </motion.p>
          ) : null}
        </AnimatePresence>
        <div className="cs-progress" aria-hidden="true">
          <motion.span animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 200, damping: 24 }} />
        </div>
        <p className="cs-count" aria-live="polite">
          จัดแล้ว <b>{count}/{total}</b> ใบ
        </p>
      </M1Board>

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
            aria-label={`${z.title} มี ${inside.length} ใบ`}
            onClick={() => selected && put(selected, z.id)}
            className={cn('cs-zone', ZONE_TONE[z.id] ?? 'is-a', selected && 'is-target', hover === z.id && 'is-hover')}
          >
            {bump[z.id] && !reduce ? <span key={bump[z.id]} className="cs-zone-flash" aria-hidden /> : null}
            <div className="cs-zone-head">
              <span className="cs-zone-title">{z.title}</span>
              <span className="cs-zone-count">{inside.length} ใบ</span>
            </div>
            {inside.length === 0 ? (
              <p className="cs-zone-empty">{selected ? 'แตะที่นี่เพื่อวาง' : 'วางการ์ดที่นี่'}</p>
            ) : null}
            {inside.map((c) => (
              <CardChip
                key={c.id}
                text={c.text}
                warn={markWrong.has(c.id)}
                selected={selected === c.id}
                reduce={!!reduce}
                onTap={() => setSelected((v) => (v === c.id ? null : c.id))}
                onMove={(x, y) => setHover(zoneAt(x, y))}
                onDrop={(x, y) => drop(c.id, x, y)}
                action={{ label: 'ย้ายกลับ', onClick: () => back(c.id) }}
              />
            ))}
          </div>
        )
      })}

      <div className="cs-tray">
        <p className="cs-tray-title">
          <img src="/icons/3d/package.webp" alt="" aria-hidden />
          การ์ดรอจัด {tray.length > 0 ? `(${tray.length})` : ''}
        </p>
        {tray.length === 0 ? (
          <p className="cs-tray-done">
            <img src="/icons/3d/check-mark-button.webp" alt="" aria-hidden />
            จัดครบทุกใบแล้ว กดตรวจคำตอบได้เลย
          </p>
        ) : null}
        {tray.map((c) => (
          <CardChip
            key={c.id}
            text={c.text}
            selected={selected === c.id}
            reduce={!!reduce}
            onTap={() => setSelected((v) => (v === c.id ? null : c.id))}
            onMove={(x, y) => setHover(zoneAt(x, y))}
            onDrop={(x, y) => drop(c.id, x, y)}
          />
        ))}
        {selected ? (
          <div className="cs-pick" role="group" aria-label="เลือกกลุ่มให้การ์ด">
            {data.zones.map((z) => (
              <button key={z.id} type="button" onClick={() => put(selected, z.id)} className={cn('cs-pick-btn', ZONE_TONE[z.id] ?? 'is-a')}>
                วางใน {z.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {sendError ? (
        <p role="alert" className="m1-error">
          ส่งไม่สำเร็จ ลองกดตรวจคำตอบอีกครั้ง
        </p>
      ) : null}
      {busy ? (
        <p className="cs-checking" role="status">
          <span className="m1-btn-spin" aria-hidden />
          โดมกำลังสรุปคำแนะนำ...
        </p>
      ) : null}
      <div className="cs-actions cs-actions-row">
        <M1Button variant="secondary" size="md" onClick={reset} disabled={count === 0 || busy}>
          เริ่มใหม่
        </M1Button>
        <M1Button
          variant={count < total ? 'primary' : 'success'}
          size="md"
          className="flex-1"
          disabled={count < total || busy}
          loading={busy}
          loadingLabel="กำลังตรวจ"
          onClick={check}
          leadingIcon={<CheckIcon width={20} height={20} />}
        >
          {count < total ? `จัดอีก ${total - count} ใบ` : 'ตรวจคำตอบ'}
        </M1Button>
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
  onMove,
  onDrop,
  action,
}: {
  text: string
  selected: boolean
  warn?: boolean
  reduce: boolean
  onTap: () => void
  onMove: (x: number, y: number) => void
  onDrop: (x: number, y: number) => void
  action?: { label: string; onClick: () => void }
}) {
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pointerRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)

  function end(event: ReactPointerEvent<HTMLButtonElement>, cancel = false) {
    const p = pointerRef.current
    if (!p || p.id !== event.pointerId) return
    pointerRef.current = null
    setDragging(false)
    setOffset({ x: 0, y: 0 })
    if (cancel) return
    if (p.moved) onDrop(event.clientX, event.clientY)
    else onTap()
  }

  return (
    <motion.div
      className="cs-card-row"
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      style={{ zIndex: dragging ? 30 : undefined, position: 'relative' }}
    >
      <button
        type="button"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
        }}
        onPointerMove={(event) => {
          const p = pointerRef.current
          if (!p || p.id !== event.pointerId) return
          const x = event.clientX - p.x
          const y = event.clientY - p.y
          if (!p.moved && Math.hypot(x, y) > 6) {
            p.moved = true
            setDragging(true)
          }
          if (p.moved) {
            setOffset({ x, y })
            onMove(event.clientX, event.clientY)
          }
        }}
        onPointerUp={(event) => end(event)}
        onPointerCancel={(event) => end(event, true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onTap()
          }
        }}
        onClick={(event) => event.stopPropagation()}
        aria-pressed={selected}
        className={cn('cs-card', selected && 'is-selected', warn && 'is-warn', dragging && 'is-dragging')}
        style={dragging ? { transform: `translate(${offset.x}px, ${offset.y}px) rotate(-2deg) scale(1.04)` } : undefined}
      >
        <span className="cs-card-grip" aria-hidden>
          ⋮⋮
        </span>
        <span className="cs-card-text">
          {selected ? <span className="cs-card-flag">เลือกอยู่ · แตะกลุ่มที่ใช่</span> : warn ? <span className="cs-card-flag is-warn">ลองย้ายใบนี้ดู</span> : null}
          {text}
        </span>
      </button>
      {action ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            action.onClick()
          }}
          aria-label={`${action.label} ${text}`}
          className="cs-card-back"
        >
          ↩︎
          <span>{action.label}</span>
        </button>
      ) : null}
    </motion.div>
  )
}

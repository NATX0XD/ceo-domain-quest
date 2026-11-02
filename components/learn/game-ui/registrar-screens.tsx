'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckIcon, InfoIcon, cn } from '@/components/ui'
import { CountUp, GameButton, buzz, useGameMotion } from './index'
import {
  ArtIcon,
  ClipPanel,
  Glyph,
  INPUT,
  PixelDome,
  PixelImg,
  QuizBody,
  QuizSheet,
  SCENE_NOTE,
  Say,
  Sheets,
  Stamp,
  thaiDate,
  usePixelSrc,
  type QuizCheck,
} from './registrar-ui'
import {
  ELIGIBLE_TLDS,
  TH_TLDS,
  type RegistrarCard,
  type RegistrarData,
  type RegistrarEvent,
  type RegistrarStepPayload,
  type RegistrarStepResult,
} from '../registrar-types'

export type Check = (p: RegistrarStepPayload) => Promise<RegistrarStepResult | null>
const SCROLL = 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3'

const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i

export function eventQuiz(check: Check, eventId: string): QuizCheck {
  return async (choice) => {
    const r = await check({ kind: 'event', eventId, choice })
    return r && r.kind === 'event' ? { correct: r.correct, explanation: r.explanation } : null
  }
}

/** ไอคอนของการ์ดแต่ละขั้น: ภาพพิกเซล icon-*.webp ถ้ามี ไม่มีใช้ไอคอน 3D เดิม */
const STEP_ICON: Record<string, [string, string]> = {
  'st-account': ['icon-account', 'bust-in-silhouette'],
  'st-menu': ['icon-menu', 'television'],
  'st-search': ['icon-search', 'magnifying-glass-tilted-left'],
  'st-form': ['icon-form', 'memo'],
  'st-docs': ['icon-docs', 'clipboard'],
  'st-review': ['icon-review', 'eyes'],
  'st-email': ['icon-mail', 'bell'],
  'st-pay': ['icon-pay', 'handshake'],
  'st-confirm': ['icon-confirm', 'check-mark-button'],
  'st-dns': ['icon-dns', 'gear'],
}

export function StepIcon({ id, size = 26 }: { id: string; size?: number }) {
  const [px, fb] = STEP_ICON[id] ?? ['icon-form', 'memo']
  return <PixelImg name={px} fallback={`/icons/3d/${fb}.webp`} className="m4-step-icon" style={{ width: size, height: size }} />
}

/** ─── R02 ค้นชื่อจริง + R03 นักสืบโดเมน ─── */

type RdapRow = {
  tld: string
  domain: string
  status: 'registered' | 'not-found' | 'unknown'
  label: string
  source: 'rdap' | 'sample' | 'offline'
  registeredAt?: string
  expiresAt?: string
  registrar?: string
  simulated?: boolean
}

const SIM_DATES = { registeredAt: '2021-03-14T00:00:00Z', expiresAt: '2027-03-14T00:00:00Z', registrar: 'ผู้รับจดตัวอย่างในเกม' }

export function SearchScreen({
  data,
  card,
  check,
  takenEvent,
  takenDone,
  onTakenDone,
  onSearched,
  onPick,
}: {
  data: RegistrarData
  card: RegistrarCard
  check: Check
  takenEvent: RegistrarEvent | undefined
  takenDone: boolean
  onTakenDone: (choice: number, correct: boolean) => void
  onSearched: () => void
  onPick: (name: string, tld: string) => void
}) {
  const { reduce, spring } = useGameMotion()
  const [name, setName] = useState(card.slug)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<RdapRow[] | null>(null)
  const [queried, setQueried] = useState('')
  const [takenName, setTakenName] = useState<string | null>(null)
  const injected = useRef(false)
  const [detail, setDetail] = useState<RdapRow | null>(null)
  const [mode, setMode] = useState<'results' | 'detect' | 'taken' | 'info'>('results')
  const [detectDone, setDetectDone] = useState(false)
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const [clockNow, setClockNow] = useState(() => Date.now())

  const eligible = ELIGIBLE_TLDS[card.ownerType]
  const retrySeconds = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - clockNow) / 1000))

  useEffect(() => {
    if (retryAt === null) return
    const timer = window.setInterval(() => {
      const now = Date.now()
      setClockNow(now)
      if (now >= retryAt) setRetryAt(null)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [retryAt])

  async function search() {
    if (retrySeconds > 0 || busy) return
    const value = name.trim().toLowerCase()
    if (!NAME_RE.test(value)) {
      setErr('ใช้ได้เฉพาะ a-z ตัวเลข และขีดกลาง ยาว 1-63 ตัว ไม่ขึ้นต้นหรือลงท้ายด้วยขีด')
      return
    }
    setErr(null)
    setNote(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/domain/rdap?name=${encodeURIComponent(value)}`, { cache: 'no-store' })
      const body = (await res.json().catch(() => null)) as { results?: RdapRow[]; message?: string; resetAt?: number } | null
      if (!res.ok || !body?.results) {
        if (res.status === 429 && typeof body?.resetAt === 'number') {
          setRetryAt(body.resetAt)
          setClockNow(Date.now())
        }
        setNote(body?.message ?? 'ตอนนี้ค้นไม่ได้ ลองอีกครั้ง')
        return
      }
      let list = body.results
      // ทุกคนต้องเจอเหตุการณ์ชื่อซ้ำ 1 ครั้ง: ถ้านามสกุลตามบัตรไม่ซ้ำเลย ระบบใส่ชื่อจำลองที่ซ้ำให้
      const ownUnknown = list.some((r) => r.tld === card.tld && r.status === 'unknown')
      if (ownUnknown) setNote(`ตรวจ ${card.tld} ไม่ได้ตอนนี้ กดค้นอีกครั้งเพื่อตรวจใหม่`)
      // ชื่อที่ถูกจดจริงที่นามสกุลตามบัตรทำหน้าที่เป็นเหตุการณ์ชื่อซ้ำอยู่แล้ว ไม่ต้องจำลองทับชื่ออื่น
      if (list.some((r) => r.tld === card.tld && r.status === 'registered')) injected.current = true
      if (!injected.current && !takenDone && !ownUnknown) {
        injected.current = true
        const target = list.find((r) => r.tld === card.tld && r.status === 'not-found')
        if (target) {
          list = list.map((r) =>
            r === target ? { ...r, status: 'registered', label: 'ถูกจดแล้ว', source: 'sample', simulated: true, ...SIM_DATES } : r,
          )
        }
      }
      setRows(list)
      setQueried(value)
      onSearched()
    } catch {
      setNote('ตอนนี้ค้นไม่ได้ ลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  function open(r: RdapRow) {
    buzz()
    setDetail(r)
    if (!detectDone) setMode('detect')
    else if (!takenDone && takenEvent) setMode('taken')
    else setMode('info')
  }

  const canUseHere = takenDone && queried !== takenName

  if ((mode === 'detect' || mode === 'info') && detail) {
    return (
      <div className={`${SCROLL} m4-screen`}>
        <ClipPanel title="นักสืบโดเมน">
          <p className="m4-domain-pill">{detail.domain}</p>
          <dl className="m4-facts">
            <div>
              <Glyph kind="check" className="text-[#2f9e57]" />
              <dt>สถานะ</dt>
              <dd className="text-[#1d7a3e]">ถูกจดแล้ว ใช้งานอยู่</dd>
            </div>
            <div>
              <Glyph kind="calendar" className="text-[#6b4fd8]" />
              <dt>วันที่จด</dt>
              <dd>{thaiDate(detail.registeredAt) ?? 'ระบบไม่ได้แจ้ง'}</dd>
            </div>
            <div>
              <Glyph kind="clock" className="text-[#6b4fd8]" />
              <dt>วันหมดอายุ</dt>
              <dd>{thaiDate(detail.expiresAt) ?? 'ระบบไม่ได้แจ้ง'}</dd>
            </div>
            <div>
              <Glyph kind="building" className="text-[#6b4fd8]" />
              <dt>
                ผู้รับจด <small>(registrar)</small>
              </dt>
              <dd className="break-words">{detail.registrar ?? 'ระบบไม่ได้แจ้ง'}</dd>
            </div>
          </dl>
          {detail.simulated ? <p className="mt-1 text-label text-[#6b5a43]">ชื่อนี้เป็นเหตุการณ์จำลองในเกม</p> : null}
        </ClipPanel>
        {mode === 'detect' ? (
          <>
            <Say mood="thinking" className="m4-say-right">{data.detective.question}</Say>
            <QuizBody
              question={data.detective.question}
              showQuestion={false}
              choices={data.detective.choices}
              retry
              check={async (choice) => {
                const r = await check({ kind: 'detect', choice })
                return r && r.kind === 'detect' ? r : null
              }}
              onDone={() => {
                setDetectDone(true)
                setMode(takenEvent && !takenDone ? 'taken' : 'results')
              }}
            />
          </>
        ) : (
          <GameButton className="w-full" onClick={() => setMode('results')}>
            ‹ กลับไปผลค้น
          </GameButton>
        )}
      </div>
    )
  }

  if (mode === 'taken' && takenEvent) {
    return (
      <div className={`${SCROLL} m4-screen`}>
        <ClipPanel title={takenEvent.title}>
          <p className="m4-story">
            {detail?.simulated ? `เมื่อสักครู่มีคนยื่นจดชื่อ ${detail.domain} ไปก่อนแล้ว (เหตุการณ์จำลองในเกม)` : `ชื่อ ${detail?.domain ?? queried} ถูกจดไปแล้ว`}
          </p>
        </ClipPanel>
        <Say mood="thinking">{takenEvent.question}</Say>
        <QuizBody
          question={takenEvent.question}
          showQuestion={false}
          choices={takenEvent.choices}
          check={eventQuiz(check, takenEvent.id)}
          doneLabel="คิดชื่อใหม่ แล้วค้นอีกครั้ง"
          onDone={(choice, correct) => {
            onTakenDone(choice, correct)
            setTakenName(queried)
            setMode('results')
            setDetail(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className={`${SCROLL} m4-screen m4-search-screen`}>
      <ClipPanel title="ค้นชื่อจริง">
        <div className="m4-search-row">
          <ArtIcon px="icon-search" glyph="search" size={28} className="text-[#6b4fd8]" />
          <input
            className="m4-search-input"
            aria-label="ชื่อร้านภาษาอังกฤษ"
            placeholder={data.search.placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            maxLength={63}
            aria-invalid={err ? true : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search()
            }}
          />
          <button type="button" className="m4-search-go" disabled={busy || retrySeconds > 0} onClick={() => void search()}>
            {busy ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : 'ค้น'}
          </button>
        </div>
        {err ? (
          <p role="alert" className="mt-1.5 text-label font-bold text-[#b5521b]">
            {err}
          </p>
        ) : null}
        {rows ? (
          <p className="m4-real-pill">
            <Glyph kind="server" size={16} /> ข้อมูลจริงจากระบบทะเบียน
          </p>
        ) : (
          <p className="mt-2 text-label text-pretty text-[#4a3d7a]">
            {data.search.prompt}
            <span className="mt-0.5 block text-[#6b5a43]">{data.search.note}</span>
          </p>
        )}
        {rows ? (
          <ul className="m4-results" aria-label={`ผลค้น ${queried}`}>
            {rows.map((r, i) => {
              const thTld = r.tld.endsWith('.th')
              const mine = eligible.includes(r.tld)
              const noRight = thTld && r.status !== 'registered' && !mine
              const tone = r.status === 'registered' ? 'red' : noRight ? 'orange' : r.status === 'not-found' ? 'green' : 'gray'
              const label = r.status === 'unknown' ? 'ตรวจไม่ได้' : noRight ? (card.ownerType === 'individual' ? 'ต้องเป็นนิติบุคคล' : 'ไม่ตรงกับบัตร') : r.label
              const pickable = thTld && r.status === 'not-found' && !noRight
              const sub =
                r.status === 'registered'
                  ? 'แตะเพื่อสืบ'
                  : r.status === 'unknown'
                    ? 'แตะเพื่อค้นใหม่'
                    : pickable
                      ? canUseHere
                        ? 'ตรงกับบัตร แตะเพื่อยื่นจด'
                        : 'ตรงกับบัตรของฉัน'
                      : null
              const action =
                r.status === 'registered'
                  ? () => open(r)
                  : r.status === 'unknown'
                    ? () => void search()
                    : pickable && canUseHere
                      ? () => onPick(queried, r.tld)
                      : null
              const inner = (
                <>
                  <span className="m4-result-domain">{r.domain}</span>
                  <span className={cn('m4-result-status', `is-${tone}`)}>
                    <span className="flex items-center gap-1">
                      <Glyph kind={tone === 'green' ? 'check' : tone === 'red' ? 'cross' : 'warn'} size={16} />
                      {label}
                    </span>
                    {sub ? <small>{sub}</small> : null}
                  </span>
                </>
              )
              return (
                <motion.li
                  key={`${queried}-${r.domain}`}
                  initial={reduce ? false : { x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ ...spring, delay: reduce ? 0 : i * 0.09 }}
                >
                  {action ? (
                    <button type="button" onClick={action} disabled={busy} className={cn('m4-result-row is-action', pickable && canUseHere && 'is-pick', mine && 'is-mine')}>
                      {inner}
                    </button>
                  ) : (
                    <div className={cn('m4-result-row', mine && 'is-mine')}>{inner}</div>
                  )}
                </motion.li>
              )
            })}
          </ul>
        ) : null}
        {rows ? (
          <p className={cn('mt-2 text-label font-bold text-pretty', canUseHere ? 'text-[#4a3d7a]' : 'text-[#8a4b00]')}>
            {canUseHere
              ? 'ไม่พบการจด แปลว่าระบบทะเบียนยังไม่มีชื่อนี้ แตะแถวนามสกุลตามบัตรเพื่อยื่นจด'
              : takenDone
                ? 'ชื่อนี้ถูกจดแล้วที่นามสกุลตามบัตร คิดชื่อใหม่ แล้วค้นอีกครั้ง'
                : 'แตะแถวที่ถูกจดแล้ว เพื่อสืบข้อมูลก่อนเลือกชื่อไปยื่นจด'}
          </p>
        ) : null}
      </ClipPanel>

      {note ? (
        <p role="status" className={cn(SCENE_NOTE, 'flex items-start gap-2 text-[#b5521b]')}>
          <InfoIcon width={18} height={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            {note}
            {retrySeconds > 0 ? ` ลองใหม่ได้ใน ${retrySeconds} วินาที` : ''}
          </span>
        </p>
      ) : null}

      {rows ? <Say mood="thinking">ชื่อเดียวกัน ทำไมแต่ละนามสกุลผลไม่เหมือนกันนะ</Say> : null}
    </div>
  )
}

/** ─── R04 แผงเดินเรื่อง ─── */

type Drag = { id: string; x: number; y: number; ox: number; oy: number; phase: 'drag' | 'snap' | 'back' }

export function RouteBoard({
  data,
  placed,
  placing,
  hint,
  onPlace,
}: {
  data: RegistrarData
  placed: string[]
  placing: string | null
  hint: string | null
  onPlace: (stepId: string) => void
}) {
  const { reduce, spring } = useGameMotion()
  const total = data.steps.length
  const short = useMemo(() => new Map(data.steps.map((s) => [s.id, s.short ?? s.text])), [data.steps])
  const full = useMemo(() => new Map(data.steps.map((s) => [s.id, s.text])), [data.steps])
  const nextRef = useRef<HTMLLIElement | null>(null)
  const [shake, setShake] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [over, setOver] = useState(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const suppressClick = useRef(false)
  const tray = data.steps.filter((s) => !placed.includes(s.id))
  const [route, setRoute] = useState<'th' | 'com'>('th')

  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [placed.length, reduce])

  useEffect(() => {
    if (!hint) return
    setShake(placing)
  }, [hint, placing])

  // วางผิด: การ์ดที่ snap ค้างไว้เด้งกลับที่เดิม
  useEffect(() => {
    if (placing === null) setDrag((d) => (d && d.phase === 'snap' ? { ...d, phase: 'back' } : d))
  }, [placing])

  const dragging = drag?.phase === 'drag' ? drag.id : null
  useEffect(() => {
    if (!dragging) return
    const hit = (x: number, y: number) => {
      const t = nextRef.current?.getBoundingClientRect()
      return !!t && x >= t.left - 8 && x <= t.right + 8 && y >= t.top - 10 && y <= t.bottom + 10
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.buttons === 0) return
      const point = { x: event.clientX, y: event.clientY }
      if (!moved.current) {
        const start = dragStart.current
        if (start && Math.hypot(point.x - start.x, point.y - start.y) > 6) moved.current = true
      }
      if (moved.current) {
        event.preventDefault()
        setDrag((d) => (d ? { ...d, x: point.x, y: point.y } : d))
        setOver(hit(point.x, point.y))
      }
    }
    const up = (event: PointerEvent) => {
      const wasMoved = moved.current
      dragStart.current = null
      moved.current = false
      setOver(false)
      if (!wasMoved) {
        setDrag(null)
        return
      }
      suppressClick.current = true
      if (hit(event.clientX, event.clientY)) {
        const t = nextRef.current!.getBoundingClientRect()
        buzz()
        setDrag((d) => (d ? { ...d, x: t.left + t.width / 2 + 18, y: t.top + t.height / 2, phase: 'snap' } : d))
        onPlace(dragging)
      } else {
        setDrag((d) => (d ? { ...d, phase: 'back' } : d))
      }
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, onPlace])

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, stepId: string) {
    if (placing || drag) return
    moved.current = false
    const r = event.currentTarget.getBoundingClientRect()
    dragStart.current = { x: event.clientX, y: event.clientY }
    setDrag({ id: stepId, x: event.clientX, y: event.clientY, ox: r.left + r.width / 2, oy: r.top + r.height / 2, phase: 'drag' })
  }

  const ghostTarget = drag ? (drag.phase === 'back' ? { x: drag.ox, y: drag.oy } : { x: drag.x, y: drag.y }) : null

  return (
    <div className={`${SCROLL} m4-screen m4-route-screen`}>
      {hint ? (
        <Say mood="thinking" className="m4-route-hint">
          <span role="status" className="font-bold">
            {hint}
          </span>
        </Say>
      ) : null}

      <ClipPanel title="แผงเดินเรื่อง" className="m4-route-paper">
        <div className="m4-tabs" role="tablist" aria-label="เส้นทางการจด">
          {(['th', 'com'] as const).map((kind) => (
            <button key={kind} type="button" role="tab" aria-selected={route === kind} onClick={() => setRoute(kind)} className={cn(route === kind && 'is-on')}>
              เส้นทาง .{kind}
            </button>
          ))}
        </div>
        {route === 'com' ? (
          <p className="m4-com-note">เส้นทาง .com จ่ายก่อนใส่ตะกร้า ไม่ต้องแนบเอกสาร · รอบนี้เดินเส้นทาง .th ตามบัตรนามสกุลของร้าน</p>
        ) : null}
        <p className="sr-only">{data.board.instruction}</p>
        <ol className="m4-slots" aria-live="polite">
          {Array.from({ length: total }, (_, i) => {
            const id = placed[i]
            const isNext = i === placed.length
            return (
              <li key={i} ref={isNext ? nextRef : undefined} className={cn('m4-slot', id && 'is-done', isNext && 'is-next', isNext && over && 'is-over')} aria-current={isNext ? 'step' : undefined}>
                <span className="m4-slot-no" aria-hidden="true">
                  {i + 1}
                </span>
                {id ? (
                  <motion.span initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="m4-slot-card" title={full.get(id)}>
                    <StepIcon id={id} size={22} />
                    <span className="min-w-0 flex-1 truncate">{short.get(id)}</span>
                    <Glyph kind="check" size={18} className="text-[#2f9e57]" />
                  </motion.span>
                ) : (
                  <span className="m4-slot-empty">{isNext ? (over ? 'ปล่อยเลย' : '?') : '?'}</span>
                )}
              </li>
            )
          })}
        </ol>
      </ClipPanel>

      <div className="m4-tray">
        <p className="m4-tray-tag">ตัวเลือกขั้นตอน (ลากไปวางในช่อง หรือแตะ)</p>
        <ul className="m4-tray-grid" aria-label="ตัวเลือกขั้นตอน">
          {tray.map((s) => (
            <motion.li
              key={s.id}
              layout={!reduce}
              animate={shake === s.id && !reduce ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              onAnimationComplete={() => setShake((v) => (v === s.id ? null : v))}
              className={cn(drag?.id === s.id && 'is-lifted')}
            >
              <button
                type="button"
                disabled={placing !== null}
                aria-label={s.text}
                aria-grabbed={drag?.id === s.id}
                onPointerDown={(event) => startDrag(event, s.id)}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false
                    return
                  }
                  buzz()
                  onPlace(s.id)
                }}
                className="m4-tray-card"
              >
                <StepIcon id={s.id} size={26} />
                <span>{s.short ?? s.text}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
      {drag && ghostTarget ? (
        <motion.div
          className="m4-drag-ghost"
          initial={false}
          animate={ghostTarget}
          transition={drag.phase === 'drag' || reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 26 }}
          onAnimationComplete={() => drag.phase === 'back' && setDrag(null)}
        >
          <div className={cn('m4-tray-card is-ghost', drag.phase === 'snap' && 'is-snap')}>
            <StepIcon id={drag.id} size={26} />
            <span>{short.get(drag.id)}</span>
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}

/** ─── ขั้นสั้น ๆ: สมัครบัญชี / เมนู / รอตรวจ / อีเมลยืนยัน ─── */

export function MiniStep({
  title,
  body,
  action,
  autoMs,
  onDone,
  reason,
}: {
  title: string
  body: string
  action: string
  autoMs?: number
  onDone: () => void
  reason?: string
}) {
  const { reduce } = useGameMotion()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  function run() {
    setState('busy')
    timer.current = window.setTimeout(() => setState('done'), reduce ? 150 : (autoMs ?? 900))
  }

  return (
    <div className={`${SCROLL} m4-screen m4-mini-screen`}>
      <ClipPanel title={title}>
        <p className="text-body text-pretty">{body}</p>
        <div className="m4-meter mt-3" aria-hidden="true">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: state === 'idle' ? '0%' : state === 'busy' ? '70%' : '100%' }}
            transition={reduce ? { duration: 0 } : { duration: state === 'busy' ? (autoMs ?? 900) / 1000 : 0.25 }}
          />
        </div>
        {state === 'done' ? (
          <p role="status" className="mt-2 flex items-start gap-2 text-body font-extrabold text-[#1d7a3e]">
            <CheckIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0" />
            <span>เรียบร้อย{reason ? ` · ${reason}` : ''}</span>
          </p>
        ) : null}
      </ClipPanel>
      {state === 'done' ? (
        <GameButton onClick={onDone}>ไปต่อ ›</GameButton>
      ) : (
        <GameButton loading={state === 'busy'} onClick={run}>
          {action}
        </GameButton>
      )}
    </div>
  )
}

/** ─── R05 ใบขอจด: ข้อมูลผู้ขอ + แนบเอกสาร ─── */

export type FormValue = { applicant: string; email: string; years: 1 | 2 | 3 }

export function FormPanel({ domain, value, onChange, onDone }: { domain: string; value: FormValue; onChange: (v: FormValue) => void; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null)
  function next() {
    if (value.applicant.trim().length < 2) return setErr('ใส่ชื่อผู้ขอจดอย่างน้อย 2 ตัวอักษร')
    if (!/^\S+@\S+\.\S+$/.test(value.email.trim())) return setErr('ใส่อีเมลให้ถูกรูปแบบ เช่น name@example.com')
    setErr(null)
    onDone()
  }
  return (
    <div className={`${SCROLL} m4-screen m4-form-screen`}>
      <ClipPanel title={<span className="m4-title-domain">ใบขอจด {domain}</span>}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="m4-field-label">ชื่อผู้ขอ</span>
            <input className={INPUT} value={value.applicant} maxLength={60} onChange={(e) => onChange({ ...value, applicant: e.target.value })} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="m4-field-label">อีเมล</span>
            <input className={INPUT} type="email" value={value.email} maxLength={80} onChange={(e) => onChange({ ...value, email: e.target.value })} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </label>
          <YearsPicker value={value.years} onChange={(years) => onChange({ ...value, years })} />
          {err ? (
            <p role="alert" className="text-label font-bold text-spark-700">
              {err}
            </p>
          ) : null}
        </div>
      </ClipPanel>
      <GameButton onClick={next}>บันทึกข้อมูลผู้ขอจด</GameButton>
    </div>
  )
}

function YearsPicker({ value, onChange }: { value: 1 | 2 | 3; onChange: (y: 1 | 2 | 3) => void }) {
  return (
    <fieldset>
      <legend className="m4-field-label">ระยะเวลาจดทะเบียน</legend>
      <div role="radiogroup" className="mt-1 grid grid-cols-3 gap-2">
        {([1, 2, 3] as const).map((y) => (
          <button
            key={y}
            type="button"
            role="radio"
            aria-checked={value === y}
            onClick={() => {
              buzz()
              onChange(y)
            }}
            className={cn('m4-radio', value === y && 'is-on')}
          >
            <span className="m4-radio-dot" aria-hidden="true" />
            {y} ปี
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export type Submission = { tld: string; docId: string }

const DOC_ART: Record<string, string> = { 'doc-id': 'doc-idcard', 'doc-company': 'doc-company', 'doc-trade': 'doc-trade' }

export function DocsPanel({
  data,
  domainName,
  initialTld,
  initialDoc,
  note,
  form,
  onSubmit,
}: {
  data: RegistrarData
  /** ชื่อโดเมนที่ค้นไว้ ไม่มีนามสกุล — นามสกุลที่แสดงต้องตามที่ผู้เรียนกำลังเลือกในฟอร์มนี้ */
  domainName: string
  initialTld: string
  initialDoc?: string
  note?: string
  /** ข้อมูลผู้ขอที่กรอกไว้ขั้นก่อน (แสดงเป็นสรุปบนใบขอจด) */
  form?: FormValue
  onSubmit: (s: Submission) => void
}) {
  const { reduce, spring } = useGameMotion()
  const [tld, setTld] = useState(initialTld)
  const [doc, setDoc] = useState<string | null>(initialDoc ?? null)
  const [reviewed, setReviewed] = useState(false)
  const domainLabel = `${domainName}${tld}`
  return (
    <div className={`${SCROLL} m4-screen m4-docs-screen`}>
      {note ? (
        <Say mood="thinking">
          <span className="font-bold">{note}</span>
        </Say>
      ) : null}
      <ClipPanel title={<span className="m4-title-domain">ใบขอจด {domainLabel}</span>}>
        <div className="flex flex-col gap-2.5">
          {form ? (
            <dl className="m4-form-summary">
              <div>
                <dt>ชื่อผู้ขอ</dt>
                <dd>{form.applicant || '-'}</dd>
              </div>
              <div>
                <dt>อีเมล</dt>
                <dd>{form.email || '-'}</dd>
              </div>
              <div>
                <dt>ระยะเวลา</dt>
                <dd>{form.years} ปี</dd>
              </div>
            </dl>
          ) : null}
          <fieldset>
            <legend className="m4-field-label">นามสกุลที่ขอจด</legend>
            <div role="radiogroup" className="mt-1 grid grid-cols-3 gap-2">
              {TH_TLDS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tld === t}
                  onClick={() => {
                    buzz()
                    setTld(t)
                    setReviewed(false)
                  }}
                  className={cn('m4-radio', tld === t && 'is-on')}
                >
                  <span className="m4-radio-dot" aria-hidden="true" />
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="m4-attach">
            <legend>แนบเอกสาร</legend>
            <div role="radiogroup" className="grid grid-cols-3 gap-2">
              {data.docs.map((d) => {
                const on = doc === d.id
                return (
                  <motion.button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={d.label}
                    whileTap={reduce ? undefined : { scale: 0.96 }}
                    animate={on && !reduce ? { y: -4 } : { y: 0 }}
                    transition={spring}
                    onClick={() => {
                      buzz()
                      setDoc(d.id)
                      setReviewed(false)
                    }}
                    className={cn('m4-doc-card', on && 'is-on')}
                  >
                    <DocImage id={d.id} />
                    <span className="text-pretty">{d.label}</span>
                    <span aria-hidden="true" className="m4-doc-tick">
                      {on ? <CheckIcon width={14} height={14} /> : null}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </fieldset>
          {reviewed ? (
            <p role="status" className="m4-review-note">
              ตรวจก่อนส่ง: ขอจด <b>{domainLabel}</b> แนบ <b>{data.docs.find((d) => d.id === doc)?.label}</b> ถ้าถูกต้องกดส่งคำขอได้
            </p>
          ) : null}
        </div>
      </ClipPanel>
      {reviewed ? (
        <GameButton onClick={() => doc && onSubmit({ tld, docId: doc })}>ส่งคำขอให้เจ้าหน้าที่ ›</GameButton>
      ) : (
        <GameButton disabled={!doc} onClick={() => setReviewed(true)}>
          ตรวจข้อมูลก่อนส่ง
        </GameButton>
      )}
    </div>
  )
}

function DocImage({ id }: { id: string }) {
  const src = usePixelSrc(DOC_ART[id] ?? 'doc-trade', '')
  return (
    <span className="m4-doc-art">
      {/* eslint-disable-next-line @next/next/no-img-element -- ภาพเอกสารสถิตใน public */}
      {src ? <img src={src} alt="" aria-hidden draggable={false} className="m4-px" /> : <DocArt id={id} />}
    </span>
  )
}

/** ─── R06 กล่องอีเมล ─── */

export function EmailScreen({
  data,
  check,
  domainName,
  ownerType,
  submission,
  form,
  docsEvent,
  docsDone,
  onDocsDone,
  onResubmit,
  onApproved,
}: {
  data: RegistrarData
  check: Check
  domainName: string
  ownerType: 'individual' | 'company'
  submission: Submission
  form?: FormValue
  docsEvent: RegistrarEvent | undefined
  docsDone: boolean
  onDocsDone: (choice: number, correct: boolean) => void
  onResubmit: (s: Submission) => void
  onApproved: () => void
}) {
  const { reduce, spring } = useGameMotion()
  // ชื่อที่ขึ้นบนหน้าจอต้องเป็นนามสกุลที่ยื่นจริง (submission.tld) ไม่ใช่นามสกุลที่ค้นไว้ตอนแรก
  const domainLabel = `${domainName}${submission.tld}`
  const [round, setRound] = useState(0)
  const [mail, setMail] = useState<{ outcome: 'approve' | 'more' | 'reject'; message: string } | null>(null)
  const [fail, setFail] = useState(false)
  const [asking, setAsking] = useState(false)
  const [resubmit, setResubmit] = useState(false)
  const [rev, setRev] = useState(0)
  const [wait, setWait] = useState(true)

  useEffect(() => {
    let live = true
    setWait(true)
    const t = window.setTimeout(() => live && setWait(false), reduce ? 0 : 1200)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [rev, reduce])

  useEffect(() => {
    if (wait) return
    let live = true
    setFail(false)
    void (async () => {
      const r = await check({ kind: 'docs', ownerType, tld: submission.tld, docId: submission.docId, round })
      if (!live) return
      if (!r || r.kind !== 'docs') return setFail(true)
      setMail({ outcome: r.outcome, message: r.message })
      if (r.outcome === 'more' && !docsDone) setAsking(true)
    })()
    return () => {
      live = false
    }
    // รันครั้งเดียวต่อรอบการส่ง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wait, round, submission.tld, submission.docId])

  if (resubmit) {
    return (
      <DocsPanel
        data={data}
        domainName={domainName}
        form={form}
        initialTld={mail?.outcome === 'reject' ? (ownerType === 'company' ? '.co.th' : '.in.th') : submission.tld}
        note={mail?.outcome === 'reject' ? 'กลับไปเลือกนามสกุลที่ร้านมีสิทธิ์จดตามบัตร แล้วแนบเอกสารใหม่' : 'ส่งเอกสารที่ถูกต้องและชัดเจนอีกครั้ง'}
        onSubmit={(s) => {
          onResubmit(s)
          setMail(null)
          setResubmit(false)
          setRound((n) => n + 1)
          setRev((n) => n + 1)
        }}
      />
    )
  }

  const subject = mail?.outcome === 'approve' ? 'อนุมัติคำขอ' : mail?.outcome === 'reject' ? 'ไม่อนุมัติคำขอ' : 'ขอเอกสารเพิ่ม'
  return (
    <div className={`${SCROLL} m4-screen m4-email-screen`}>
      <motion.div className="m4-laptop" initial={reduce ? false : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
        <div className="m4-laptop-screen">
          <div className="m4-mail-bar">
            <Glyph kind="mail" size={18} />
            <b>กล่องอีเมล</b>
            <span aria-hidden="true">•••</span>
          </div>
          <div className="m4-mail-body">
            <ul className="m4-mail-list" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className={cn(i === 0 && 'is-on', i === 0 && !wait && mail && 'is-new')}>
                  <Glyph kind="mail" size={14} />
                  {i === 0 ? <small>ผู้รับจด</small> : <i />}
                </li>
              ))}
            </ul>
            <div className="m4-mail-read" aria-live="polite">
              {wait ? (
                <p className="flex items-center gap-2 text-label font-bold" role="status">
                  <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-[#6b4fd8] border-t-transparent" />
                  เจ้าหน้าที่กำลังตรวจคำขอ {domainLabel}
                </p>
              ) : fail ? (
                <div className="flex flex-col gap-2">
                  <p role="alert" className="text-label font-bold text-spark-700">
                    ตรวจอีเมลไม่ได้ตอนนี้ ลองใหม่อีกครั้ง
                  </p>
                  <button type="button" className="m4-mini-btn" onClick={() => setRev((n) => n + 1)}>
                    ลองใหม่
                  </button>
                </div>
              ) : mail ? (
                <motion.div initial={reduce ? false : { y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="relative">
                  <p className="m4-mail-from">
                    <Glyph kind="mail" size={16} /> <b>ผู้ให้บริการรับจดทะเบียน</b>
                  </p>
                  <p className="m4-mail-subject">
                    เรื่อง: <b className={cn(mail.outcome === 'approve' ? 'text-[#1d7a3e]' : mail.outcome === 'reject' ? 'text-[#b3261e]' : 'text-[#8a4b00]')}>{subject}</b>
                  </p>
                  <p className="text-label text-pretty">{mail.message}</p>
                  <p className="mt-1 text-[11px] text-pretty text-[#6b5a43]">
                    คำขอ: {domainLabel} · แนบ {data.docs.find((d) => d.id === submission.docId)?.label ?? 'เอกสาร'}
                  </p>
                  {mail.outcome === 'approve' ? <Stamp kind="approve" label="อนุมัติ" className="m4-mail-stamp" /> : null}
                  {mail.outcome === 'reject' ? <Stamp kind="reject" label="ไม่อนุมัติ" className="m4-mail-stamp" /> : null}
                </motion.div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="m4-laptop-base" aria-hidden="true" />
      </motion.div>

      {asking && docsEvent && mail ? (
        <div className="flex flex-col gap-2">
          <Say mood="thinking">{docsEvent.question}</Say>
          <QuizBody
            question={docsEvent.question}
            showQuestion={false}
            choices={docsEvent.choices}
            check={eventQuiz(check, docsEvent.id)}
            onDone={(choice, correct) => {
              onDocsDone(choice, correct)
              setAsking(false)
            }}
          />
        </div>
      ) : null}

      <div className="m4-outcomes" aria-label="ผลที่อาจเกิดขึ้น">
        <p>ผลที่อาจเกิดขึ้น</p>
        <ul>
          {([
            ['approve', 'check', 'อนุมัติ', 'เอกสารถูกต้อง ดำเนินการต่อ'],
            ['more', 'list', 'ขอเอกสารเพิ่ม', 'เอกสารไม่ครบหรือไม่ชัด'],
            ['reject', 'cross', 'ไม่อนุมัติ', 'ไม่มีสิทธิ์ตามบัตร'],
          ] as const).map(([k, icon, t, d]) => (
            <li key={k} className={cn(`is-${k}`, mail?.outcome === k && 'is-now')} aria-current={mail?.outcome === k ? 'true' : undefined}>
              <Glyph kind={icon} size={22} />
              <b>{t}</b>
              <small>{d}</small>
            </li>
          ))}
        </ul>
      </div>
      {mail?.outcome === 'approve' ? <GameButton onClick={onApproved}>ได้รับอนุมัติ ไปชำระค่าธรรมเนียม ›</GameButton> : null}
      {mail && mail.outcome !== 'approve' && !asking ? (
        <GameButton onClick={() => setResubmit(true)}>{mail.outcome === 'reject' ? 'กลับไปเลือกนามสกุลที่มีสิทธิ์' : 'เลือกเอกสารที่ถูกแล้วส่งใหม่'}</GameButton>
      ) : null}
    </div>
  )
}

/** ─── R07 ใบแจ้งค่าธรรมเนียม ─── */

export function PayScreen({
  data,
  check,
  coins,
  years,
  domain,
  payEvent,
  payDone,
  onPayEventDone,
  onPaid,
  onContinue,
}: {
  data: RegistrarData
  check: Check
  coins: number
  years: number
  domain: string
  payEvent: RegistrarEvent | undefined
  payDone: boolean
  onPayEventDone: (choice: number, correct: boolean) => void
  onPaid: (amount: number) => void
  onContinue: () => void
}) {
  const { reduce } = useGameMotion()
  const amount = data.fee.pricePerYear * years
  const [paid, setPaid] = useState(false)
  const [burst, setBurst] = useState(false)
  const [asked, setAsked] = useState(payDone || !payEvent)
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  function pay() {
    if (coins < amount || paid) return
    setPaid(true)
    setBurst(true)
    onPaid(amount)
    timer.current = window.setTimeout(() => setBurst(false), 1400)
  }

  return (
    <div className={`${SCROLL} m4-screen m4-pay-screen`}>
      <ClipPanel title="ใบแจ้งค่าธรรมเนียม" className="m4-invoice">
        {asked ? <Stamp kind="approve" label="อนุมัติแล้ว" className="m4-invoice-stamp" /> : null}
        <p className="m4-field-label">ชื่อโดเมน</p>
        <p className="m4-invoice-domain">{domain}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <p className="m4-field-label">ระยะเวลาจดทะเบียน</p>
            <p className="m4-invoice-box">{years} ปี</p>
          </div>
          <div>
            <p className="m4-field-label">ค่าธรรมเนียม</p>
            <p className="m4-invoice-box">{amount.toLocaleString('th-TH')} บาท</p>
          </div>
        </div>
        <p className="mt-1 text-center text-label font-bold text-[#4a3d7a]">รวมภาษีแล้ว · ในเกมจ่ายเป็นเหรียญ 1 เหรียญ = 1 บาท</p>
        <p className="mt-1 flex items-center justify-between gap-2 border-t-2 border-dashed border-[#cfc4f3] pt-1.5 text-label font-bold">
          <span>เหรียญในกระเป๋า</span>
          <span aria-live="polite" className="tabular-nums">
            <CountUp to={coins} suffix=" เหรียญ" />
          </span>
        </p>
        {paid ? <Stamp kind="paid" label="ชำระแล้ว" delay={0.1} className="m4-paid-stamp" /> : null}
        <AnimatePresence>
          {burst
            ? Array.from({ length: 8 }, (_, i) => (
                <motion.span
                  key={i}
                  aria-hidden="true"
                  initial={{ x: 0, y: 60, opacity: 1, scale: 1 }}
                  animate={{ x: (i - 3.5) * 24, y: -110 - (i % 3) * 22, opacity: 0, scale: 0.7, rotate: 180 }}
                  transition={{ duration: reduce ? 0 : 1.1, delay: i * 0.05, ease: 'easeOut' }}
                  className="m4-coin m4-coin-fly"
                />
              ))
            : null}
        </AnimatePresence>
      </ClipPanel>

      <div className="m4-pay-row">
        <div className="m4-sign-dome">
          <PixelDome mood="sign" size={96} />
          <span className="m4-dome-sign">
            เส้นทาง .th
            <br />
            จ่ายหลังอนุมัติ
          </span>
        </div>
        <div className="m4-compare">
          <p>เปรียบเทียบทางเลือก</p>
          <div>
            <ArtIcon px="icon-globe" glyph="globe" size={24} className="text-[#6b4fd8]" />
            <span>
              เส้นทาง .com จ่ายก่อน ใช้ได้ทันที
              <small> ({data.fee.comSample} เหรียญตัวอย่าง)</small>
            </span>
          </div>
        </div>
      </div>

      {paid ? (
        <GameButton onClick={onContinue}>ไปรับอีเมลยืนยัน ›</GameButton>
      ) : (
        <GameButton disabled={!asked || coins < amount} onClick={pay}>
          <span className="m4-coin" aria-hidden="true" />
          {asked ? `จ่าย ${amount.toLocaleString('th-TH')} เหรียญจำลอง` : 'ตอบเพื่อนก่อนจึงจ่ายได้'}
        </GameButton>
      )}
      <Sheets>
        {!asked && payEvent ? (
          <QuizSheet
            key="pay"
            kicker="เพื่อนถาม"
            icon="/icons/3d/speech-balloon.webp"
            title={payEvent.title}
            story={payEvent.story}
            question={payEvent.question}
            choices={payEvent.choices}
            check={eventQuiz(check, payEvent.id)}
            onDone={(choice, correct) => {
              onPayEventDone(choice, correct)
              setAsked(true)
            }}
          />
        ) : null}
      </Sheets>
    </div>
  )
}

/** ─── R08 ตั้ง DNS ─── */

export function DnsScreen({ data, onDone }: { data: RegistrarData; onDone: () => void }) {
  const { reduce, spring } = useGameMotion()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [state, setState] = useState<'edit' | 'testing' | 'ok'>('edit')
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])
  const ref = data.dns.reference
  const ph = data.dns.nameserverPlaceholders

  function save() {
    const x = a.trim().toLowerCase()
    const y = b.trim().toLowerCase()
    if (!HOST_RE.test(x) || !HOST_RE.test(y)) return setErr('ใส่ชื่อ Nameserver ให้ครบทั้ง 2 ช่อง เช่น ns1.webhost-example.com')
    if (x === y) return setErr('Nameserver 2 ตัวต้องไม่ซ้ำกัน')
    setErr(null)
    setState('testing')
    timer.current = window.setTimeout(() => setState('ok'), reduce ? 200 : 1600)
  }

  return (
    <div className={`${SCROLL} m4-screen m4-dns-screen`}>
      <ClipPanel title="ตั้งค่า DNS">
        <p className="-mt-1 text-center text-label font-semibold text-pretty text-[#4a3d7a]">{data.dns.intro}</p>
        <div className="mt-2 flex flex-col gap-2">
          {([['Nameserver 1', a, setA, 0], ['Nameserver 2', b, setB, 1]] as const).map(([label, val, set, i]) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="m4-field-label">{label}</span>
              <input className={cn(INPUT, 'font-mono')} placeholder={ph[i]} value={val} onChange={(e) => set(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={state !== 'edit'} />
            </label>
          ))}
        </div>
        <div className="m4-ns-sample">
          <p>ผู้ให้บริการเว็บส่งมา (แตะเพื่อใส่)</p>
          <div>
            {ph.map((n, i) => (
              <button
                key={n}
                type="button"
                disabled={state !== 'edit'}
                onClick={() => {
                  buzz()
                  if (i === 0) setA(n)
                  else setB(n)
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {err ? (
          <p role="alert" className="mt-1 text-label font-bold text-[#b5521b]">
            {err}
          </p>
        ) : null}
        <div className="m4-real-box">
          <p>
            <b>ดูของจริง</b> ตัวอย่างจาก <span className="font-mono">{ref.domain}</span> ใช้
          </p>
          <p className="font-mono">{ref.nameservers.slice(0, 2).join(' · ')}</p>
          <small>ตรวจเมื่อ {ref.checkedAt}</small>
        </div>
        <ol className={cn('m4-dns-diagram', state !== 'edit' && 'is-run', state === 'ok' && 'is-live')} aria-label="ชื่อเว็บชี้ไปที่ DNS แล้วไปถึงเว็บร้าน">
          {([
            ['globe', 'icon-globe', 'ชื่อเว็บ'],
            ['server', 'icon-server', 'DNS'],
            ['shop', 'icon-shop', 'เว็บร้าน'],
          ] as const).map(([g, px, label]) => (
            <li key={label}>
              <span className="m4-dns-node">
                <ArtIcon px={px} glyph={g} size={32} />
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </ClipPanel>
      {state === 'ok' ? (
        <motion.div role="status" initial={reduce ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="m4-live-banner">
          <Glyph kind="check" size={30} />
          <span>
            <b>เว็บเปิดได้แล้ว</b>
            <small>{data.dns.successText}</small>
          </span>
        </motion.div>
      ) : null}
      {state === 'ok' ? (
        <GameButton onClick={onDone}>ข้ามเวลาไป 1 ปี ›</GameButton>
      ) : (
        <GameButton loading={state === 'testing'} onClick={save}>
          บันทึกและทดสอบ
        </GameButton>
      )}
    </div>
  )
}

/** ภาพเอกสารพิกเซล: บัตรประชาชน / หนังสือรับรองบริษัท / ใบทะเบียนพาณิชย์ */
function DocArt({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 48 36" width={48} height={36} aria-hidden="true" shapeRendering="crispEdges">
      {id === 'doc-id' ? (
        <>
          <rect x="1" y="3" width="46" height="30" fill="#bfe3ff" stroke="#24164f" strokeWidth="2" />
          <rect x="5" y="9" width="12" height="14" fill="#6b4fd8" />
          <rect x="21" y="10" width="22" height="3" fill="#24164f" />
          <rect x="21" y="16" width="18" height="3" fill="#6b5a43" />
          <rect x="21" y="22" width="14" height="3" fill="#6b5a43" />
        </>
      ) : id === 'doc-company' ? (
        <>
          <rect x="6" y="1" width="36" height="34" fill="#fff6dc" stroke="#24164f" strokeWidth="2" />
          <rect x="12" y="7" width="24" height="3" fill="#24164f" />
          <rect x="12" y="14" width="24" height="2" fill="#6b5a43" />
          <rect x="12" y="19" width="16" height="2" fill="#6b5a43" />
          <circle cx="34" cy="27" r="5" fill="#ffcf4a" stroke="#b8860b" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="6" y="1" width="36" height="34" fill="#e6f7e0" stroke="#24164f" strokeWidth="2" />
          <rect x="10" y="5" width="28" height="7" fill="#c0392b" />
          <rect x="12" y="17" width="24" height="2" fill="#6b5a43" />
          <rect x="12" y="22" width="20" height="2" fill="#6b5a43" />
          <rect x="12" y="27" width="12" height="2" fill="#6b5a43" />
        </>
      )}
    </svg>
  )
}


'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertIcon, CheckIcon, GlobeIcon, InfoIcon, cn } from '@/components/ui'
import { CountUp, GameButton, PixelPanel, buzz, useGameMotion } from './index'
import { INPUT, INPUT_LIGHT, PIXEL_BOX, QuizSheet, SCENE_NOTE, Say, Sheets, thaiDate, type QuizCheck } from './registrar-ui'
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

/** ─── R02 ค้นชื่อจริง + R03 นักสืบโดเมน ─── */

type RdapRow = {
  tld: string
  domain: string
  status: 'registered' | 'not-found' | 'unknown'
  label: string
  source: 'rdap' | 'sample'
  registeredAt?: string
  expiresAt?: string
  simulated?: boolean
}

const SIM_DATES = { registeredAt: '2021-03-14T00:00:00Z', expiresAt: '2027-03-14T00:00:00Z' }

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
  const [sheet, setSheet] = useState<'detect' | 'taken' | null>(null)
  const [detectDone, setDetectDone] = useState(false)

  const eligible = ELIGIBLE_TLDS[card.ownerType]

  async function search() {
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
      const body = (await res.json().catch(() => null)) as { results?: RdapRow[]; message?: string } | null
      if (!res.ok || !body?.results) {
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
    setDetail(r)
    if (!detectDone) setSheet('detect')
    else if (!takenDone && takenEvent) setSheet('taken')
  }

  const canUseHere = takenDone && queried !== takenName

  return (
    <div className={SCROLL}>
      <PixelPanel variant="dark" className={cn(PIXEL_BOX, "flex flex-col gap-2.5")}>
        <p className="text-title-sm font-extrabold">ค้นชื่อจริงหลายนามสกุล</p>
        <p className="text-body text-[#d8c9ff]">{data.search.prompt}</p>
        <label className="flex flex-col gap-1">
          <span className="text-label font-bold text-[#d8c9ff]">ชื่อร้านภาษาอังกฤษ</span>
          <input
            className={INPUT}
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
          <span className="text-label text-[#a998d9]">{data.search.note}</span>
        </label>
        {err ? (
          <p role="alert" className="text-label font-bold text-[#ffb870]">
            {err}
          </p>
        ) : null}
        <GameButton variant="primary" loading={busy} onClick={() => void search()}>
          <GlobeIcon width={20} height={20} aria-hidden /> ค้นชื่อจริง
        </GameButton>
      </PixelPanel>

      {note ? (
        <p role="status" className={cn(SCENE_NOTE, 'flex items-start gap-2 text-[#ffb870]')}>
          <InfoIcon width={18} height={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>{note}</span>
        </p>
      ) : null}

      {rows ? (
        <PixelPanel variant="paper" className="flex flex-col gap-2 p-3" aria-label="ผลค้นชื่อจริง">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-body font-extrabold">ผลค้น {queried}</span>
            <span className="whitespace-nowrap text-label text-[#6b5a43]">ข้อมูลจริงจากระบบทะเบียน</span>
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => {
              const thTld = r.tld.endsWith('.th')
              const noRight = thTld && r.status !== 'registered' && !eligible.includes(r.tld)
              const tone = r.status === 'registered' ? 'red' : noRight ? 'orange' : r.status === 'not-found' ? 'green' : 'gray'
              const label = noRight ? 'ไม่มีสิทธิ์ตามบัตร' : r.label
              return (
                <motion.li
                  key={`${queried}-${r.domain}`}
                  initial={reduce ? false : { x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ ...spring, delay: reduce ? 0 : i * 0.08 }}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-xl border-2 p-2.5',
                    tone === 'red' && 'border-[#d97a6a] bg-[#ffe9e3]',
                    tone === 'green' && 'border-quest-500 bg-quest-50',
                    tone === 'orange' && 'border-[#d9a066] bg-[#fff0dc]',
                    tone === 'gray' && 'border-[#c9b68c] bg-[#f1e6c8]',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-0.5 shrink-0">
                      {tone === 'green' ? <CheckIcon width={22} height={22} className="text-quest-700" /> : tone === 'gray' ? <InfoIcon width={22} height={22} /> : <AlertIcon width={22} height={22} className="text-spark-700" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-extrabold break-all">{r.domain}</span>
                      <span className="block text-label font-bold">
                        {r.status === 'unknown' ? 'ตรวจไม่ได้ตอนนี้ ลองอีกครั้ง' : label}
                        {r.source === 'sample' && r.status !== 'unknown' ? ' (ข้อมูลตัวอย่าง)' : ''}
                      </span>
                    </span>
                  </div>
                  {r.status === 'registered' ? (
                    <button
                      type="button"
                      onClick={() => open(r)}
                      className="min-h-11 rounded-lg border-2 border-[#7a5a3a] bg-white px-3 text-label font-extrabold focus-visible:outline-3 focus-visible:outline-focus"
                    >
                      ดู {r.domain}
                    </button>
                  ) : r.status === 'unknown' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void search()}
                      className="min-h-11 rounded-lg border-2 border-[#7a5a3a] bg-white px-3 text-label font-extrabold focus-visible:outline-3 focus-visible:outline-focus disabled:opacity-60"
                    >
                      ลองค้นอีกครั้ง
                    </button>
                  ) : thTld && r.status === 'not-found' && !noRight ? (
                    <button
                      type="button"
                      disabled={!canUseHere}
                      onClick={() => onPick(queried, r.tld)}
                      className="min-h-11 rounded-lg border-2 border-[#3b1d8f] bg-[#7c4dff] px-3 text-label font-extrabold text-white focus-visible:outline-3 focus-visible:outline-focus disabled:opacity-45"
                    >
                      ใช้ {r.domain} ยื่นจด
                    </button>
                  ) : null}
                </motion.li>
              )
            })}
          </ul>
          <p className="text-label text-[#6b5a43]">
            ไม่พบการจด หมายถึงระบบทะเบียนยังไม่มีชื่อนี้ แต่บางชื่ออาจถูกสงวนไว้ · ชื่อเดียวกันคนละนามสกุลถือเป็นคนละชื่อ
          </p>
          {!canUseHere ? (
            <p className="text-label font-bold text-[#8a4b00]">
              {takenDone ? 'ชื่อนี้ถูกจดแล้วที่นามสกุลตามบัตร คิดชื่อใหม่ แล้วค้นอีกครั้ง' : 'เปิดดูข้อมูลของชื่อที่ถูกจดแล้วก่อน แล้วจึงเลือกชื่อไปยื่นจด'}
            </p>
          ) : null}
        </PixelPanel>
      ) : null}

      {rows ? (
        <Say who="dome">ชื่อเดียวกัน ทำไมแต่ละนามสกุลได้ผลไม่เหมือนกัน คิดดูก่อนเลือกชื่อ</Say>
      ) : null}

      <Sheets>
        {detail && !sheet ? (
          <DetectiveCard key="card" row={detail} onClose={() => setDetail(null)} />
        ) : null}
        {sheet === 'detect' && detail ? (
          <QuizSheet
            key="detect"
            kicker="นักสืบโดเมน"
            title={detail.domain}
            story={`สถานะ ถูกจดแล้ว · จดเมื่อ ${thaiDate(detail.registeredAt) ?? 'ไม่ทราบ'} · หมดอายุ ${thaiDate(detail.expiresAt) ?? 'ไม่ทราบ'}${detail.simulated ? ' (ข้อมูลตัวอย่าง)' : ''}`}
            question={data.detective.question}
            choices={data.detective.choices}
            retry
            check={async (choice) => {
              const r = await check({ kind: 'detect', choice })
              return r && r.kind === 'detect' ? r : null
            }}
            onDone={() => {
              setDetectDone(true)
              setSheet(takenEvent && !takenDone ? 'taken' : null)
            }}
          />
        ) : null}
        {sheet === 'taken' && takenEvent ? (
          <QuizSheet
            key="taken"
            title={takenEvent.title}
            story={detail?.simulated ? `เมื่อสักครู่มีคนยื่นจดชื่อ ${detail.domain} ไปก่อนแล้ว (เหตุการณ์จำลองในเกม)` : `ชื่อ ${detail?.domain ?? queried} ถูกจดไปแล้ว`}
            question={takenEvent.question}
            choices={takenEvent.choices}
            check={eventQuiz(check, takenEvent.id)}
            onDone={(choice, correct) => {
              onTakenDone(choice, correct)
              setTakenName(queried)
              setSheet(null)
              setDetail(null)
            }}
            doneLabel="คิดชื่อใหม่ แล้วค้นอีกครั้ง"
          />
        ) : null}
      </Sheets>
    </div>
  )
}

function DetectiveCard({ row, onClose }: { row: RdapRow; onClose: () => void }) {
  const { reduce, spring } = useGameMotion()
  return (
    <motion.div className="absolute inset-0 z-40 flex items-end bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="ข้อมูลโดเมน"
        initial={reduce ? false : { y: '100%' }}
        animate={{ y: 0 }}
        exit={reduce ? undefined : { y: '100%' }}
        transition={spring}
        className="flex w-full flex-col gap-3 rounded-t-3xl border-[3px] border-b-0 border-[#7a5a3a] bg-[#fff8e6] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[#3a2a18]"
      >
        <p className="text-label font-bold text-[#7a5a2c]">นักสืบโดเมน</p>
        <p className="text-title-sm font-extrabold break-all">{row.domain}</p>
        <dl className="grid grid-cols-2 gap-y-1.5 text-body">
          <dt className="text-[#6b5a43]">สถานะ</dt>
          <dd className="text-right font-extrabold">ถูกจดแล้ว</dd>
          <dt className="text-[#6b5a43]">วันที่จด</dt>
          <dd className="text-right font-extrabold">{thaiDate(row.registeredAt) ?? 'ระบบไม่ได้แจ้ง'}</dd>
          <dt className="text-[#6b5a43]">วันหมดอายุ</dt>
          <dd className="text-right font-extrabold">{thaiDate(row.expiresAt) ?? 'ระบบไม่ได้แจ้ง'}</dd>
          <dt className="text-[#6b5a43]">ที่มา</dt>
          <dd className="text-right font-extrabold">{row.source === 'rdap' ? 'ระบบทะเบียนจริง (RDAP)' : 'ข้อมูลตัวอย่าง'}</dd>
        </dl>
        <GameButton variant="primary" onClick={onClose}>
          ปิด
        </GameButton>
      </motion.div>
    </motion.div>
  )
}

/** ─── R04 แผงเดินเรื่อง ─── */

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
  const text = useMemo(() => new Map(data.steps.map((s) => [s.id, s.text])), [data.steps])
  const nextRef = useRef<HTMLLIElement | null>(null)
  const [shake, setShake] = useState<string | null>(null)
  const tray = data.steps.filter((s) => !placed.includes(s.id))

  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [placed.length, reduce])

  useEffect(() => {
    if (!hint) return
    // เด้งการ์ดที่เพิ่งวางผิดให้สั่น
    setShake(placing)
  }, [hint, placing])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-2">
      <PixelPanel variant="paper" className="flex min-h-0 flex-1 flex-col p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-title-sm font-extrabold">แผงเดินเรื่อง</p>
          <p className="rounded-lg bg-[#3b1d8f] px-2.5 py-1 text-label font-extrabold text-white" aria-live="polite">
            เส้นทาง .th · {placed.length}/{total}
          </p>
        </div>
        <p className="mt-1 text-label text-[#6b5a43]">{data.board.instruction}</p>
        {/* ช่องที่ยังไม่ถึงคิวย่อเป็น 2 คอลัมน์ แผงจึงไม่ดันถาดการ์ดลงใต้จอ */}
        <ol className="mt-2 flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto pr-1">
          {Array.from({ length: total }, (_, i) => {
            const id = placed[i]
            const isNext = i === placed.length
            return (
              <li key={i} ref={isNext ? nextRef : undefined} className={cn('flex items-center gap-2', !id && !isNext ? 'w-[calc(50%-0.1875rem)]' : 'w-full', isNext && 'scroll-mt-24 scroll-mb-6')} aria-current={isNext ? 'step' : undefined}>
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full border-2 text-body font-extrabold',
                    id ? 'border-[#3b1d8f] bg-[#7c4dff] text-white' : isNext ? 'border-[#b8860b] bg-[#ffcf4a] text-[#4a3000]' : 'border-[#c9b68c] bg-[#f1e6c8] text-[#5c4228]',
                  )}
                >
                  {i + 1}
                </span>
                {id ? (
                  <motion.span
                    initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={spring}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-[#b9a8ea] bg-[#ece4ff] px-2.5 py-1 text-body font-bold text-pretty"
                  >
                    <span className="min-w-0 flex-1">{text.get(id)}</span>
                    <CheckIcon width={20} height={20} aria-hidden className="shrink-0 text-quest-700" />
                  </motion.span>
                ) : (
                  <motion.span
                    animate={isNext && !reduce ? { boxShadow: ['0 0 0 0 rgba(255,207,74,0.0)', '0 0 0 5px rgba(255,207,74,0.55)', '0 0 0 0 rgba(255,207,74,0.0)'] } : undefined}
                    transition={isNext ? { duration: 1.6, repeat: Infinity } : undefined}
                    className={cn(
                      'grid min-h-11 min-w-0 flex-1 place-items-center rounded-xl border-2 border-dashed text-body font-extrabold',
                      isNext ? 'border-[#b8860b] bg-[#fff3c4] text-[#5c4228]' : 'border-[#d9c7a0] bg-[#f6eed8] text-[#6b5a43]',
                    )}
                  >
                    {isNext ? 'วางการ์ดขั้นที่ ' + (i + 1) + ' ที่นี่' : '?'}
                  </motion.span>
                )}
              </li>
            )
          })}
        </ol>
      </PixelPanel>

      {hint ? (
        <Say who="dome" mood="greet">
          <span role="status" className="font-bold">
            {hint}
          </span>
        </Say>
      ) : null}

      {/* ถาดอยู่ใน flow ของแผงเสมอ จึงกันพื้นที่ไว้จริงและไม่บังแถวความคืบหน้าบนมือถือ */}
      <div className={cn(PIXEL_BOX, "relative shrink-0 p-2.5")}>
        <p className="flex items-baseline justify-between gap-2 px-0.5">
          <span className="text-label font-extrabold text-[#ffcf4a]">แตะการ์ดขั้นถัดไป</span>
          <span className="whitespace-nowrap text-label text-[#d8c9ff]">เหลือ {tray.length} ใบ เลื่อนดู</span>
        </p>
        <ul className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1.5" aria-label="ตัวเลือกขั้นตอน">
          {tray.map((s) => (
            <motion.li
              key={s.id}
              layout={!reduce}
              animate={shake === s.id && !reduce ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              onAnimationComplete={() => setShake((v) => (v === s.id ? null : v))}
              className="flex w-[72%] max-w-64 shrink-0 snap-start"
            >
              <button
                type="button"
                disabled={placing !== null}
                onClick={() => {
                  buzz()
                  onPlace(s.id)
                }}
                className="flex min-h-16 w-full items-center rounded-xl border-2 border-[#b8860b] bg-[#fff6dc] px-2.5 py-1.5 text-left text-label font-bold text-pretty text-[#2a1748] shadow-[0_3px_0_#b8860b] focus-visible:outline-3 focus-visible:outline-focus disabled:opacity-60"
              >
                {s.text}
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
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
  /** ถ้ามีค่า จะทำงานเองแล้วเปิดปุ่มไปต่อเมื่อครบเวลา */
  autoMs?: number
  onDone: () => void
  reason?: string
}) {
  const { reduce, spring } = useGameMotion()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  function run() {
    setState('busy')
    timer.current = window.setTimeout(() => setState('done'), reduce ? 150 : (autoMs ?? 900))
  }

  return (
    <div className={SCROLL}>
      <PixelPanel variant="paper" className="flex flex-col gap-3" initial={reduce ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
        <p className="text-title-sm font-extrabold">{title}</p>
        <p className="text-body text-pretty">{body}</p>
        <div className="h-3 overflow-hidden rounded-full border-2 border-[#7a5a3a] bg-[#f1e6c8]" aria-hidden="true">
          <motion.div
            className="h-full bg-[#7c4dff]"
            initial={{ width: '0%' }}
            animate={{ width: state === 'idle' ? '0%' : state === 'busy' ? '70%' : '100%' }}
            transition={reduce ? { duration: 0 } : { duration: state === 'busy' ? (autoMs ?? 900) / 1000 : 0.25 }}
          />
        </div>
        {state === 'done' ? (
          <p role="status" className="flex items-start gap-2 text-body font-extrabold text-quest-700">
            <CheckIcon width={22} height={22} aria-hidden className="mt-0.5 shrink-0" />
            <span>เรียบร้อย{reason ? ` · ${reason}` : ''}</span>
          </p>
        ) : null}
      </PixelPanel>
      {state === 'done' ? (
        <GameButton variant="gold" onClick={onDone}>
          ไปต่อ
        </GameButton>
      ) : (
        <GameButton variant="primary" loading={state === 'busy'} onClick={run}>
          {action}
        </GameButton>
      )}
    </div>
  )
}

/** ─── R05 ฟอร์มและเอกสาร ─── */

export type FormValue = { applicant: string; email: string; years: 1 | 2 }

export function FormPanel({ domain, value, onChange, onDone }: { domain: string; value: FormValue; onChange: (v: FormValue) => void; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null)
  function next() {
    if (value.applicant.trim().length < 2) return setErr('ใส่ชื่อผู้ขอจดอย่างน้อย 2 ตัวอักษร')
    if (!/^\S+@\S+\.\S+$/.test(value.email.trim())) return setErr('ใส่อีเมลให้ถูกรูปแบบ เช่น name@example.com')
    setErr(null)
    onDone()
  }
  return (
    <div className={SCROLL}>
      <PixelPanel variant="paper" className="flex flex-col gap-3">
        <p className="text-title-sm font-extrabold">ใบขอจดทะเบียน {domain}</p>
        <label className="flex flex-col gap-1">
          <span className="text-label font-bold">ชื่อผู้ขอจด</span>
          <input className={INPUT_LIGHT} value={value.applicant} maxLength={60} onChange={(e) => onChange({ ...value, applicant: e.target.value })} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label font-bold">อีเมลรับผลตรวจ</span>
          <input className={INPUT_LIGHT} type="email" value={value.email} maxLength={80} onChange={(e) => onChange({ ...value, email: e.target.value })} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </label>
        <fieldset>
          <legend className="text-label font-bold">จำนวนปีที่จด</legend>
          <div role="radiogroup" className="mt-1 grid grid-cols-2 gap-2">
            {([1, 2] as const).map((y) => (
              <button
                key={y}
                type="button"
                role="radio"
                aria-checked={value.years === y}
                onClick={() => {
                  buzz()
                  onChange({ ...value, years: y })
                }}
                className={cn('min-h-12 rounded-xl border-2 text-body font-extrabold focus-visible:outline-3 focus-visible:outline-focus', value.years === y ? 'border-[#3b1d8f] bg-[#ece4ff] shadow-[0_3px_0_#3b1d8f]' : 'border-[#c9b68c] bg-white')}
              >
                {y} ปี
              </button>
            ))}
          </div>
        </fieldset>
        {err ? (
          <p role="alert" className="text-label font-bold text-spark-700">
            {err}
          </p>
        ) : null}
      </PixelPanel>
      <GameButton variant="gold" onClick={next}>
        บันทึกข้อมูลผู้ขอจด
      </GameButton>
    </div>
  )
}

export type Submission = { tld: string; docId: string }

export function DocsPanel({
  data,
  domainName,
  initialTld,
  initialDoc,
  note,
  onSubmit,
}: {
  data: RegistrarData
  /** ชื่อโดเมนที่ค้นไว้ ไม่มีนามสกุล — นามสกุลที่แสดงต้องตามที่ผู้เรียนกำลังเลือกในฟอร์มนี้ */
  domainName: string
  initialTld: string
  initialDoc?: string
  note?: string
  onSubmit: (s: Submission) => void
}) {
  const { reduce, spring } = useGameMotion()
  const [tld, setTld] = useState(initialTld)
  const [doc, setDoc] = useState<string | null>(initialDoc ?? null)
  const [reviewed, setReviewed] = useState(false)
  const domainLabel = `${domainName}${tld}`
  return (
    <div className={SCROLL}>
      {note ? (
        <Say who="dome" mood="greet">
          <span className="font-bold">{note}</span>
        </Say>
      ) : null}
      <PixelPanel variant="paper" className="flex flex-col gap-3">
        <p className="text-title-sm font-extrabold">แนบเอกสารยืนยันตัวตน</p>
        <fieldset>
          <legend className="text-label font-bold">นามสกุลที่ขอจด ({domainLabel})</legend>
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
                className={cn('min-h-12 rounded-xl border-2 text-label font-extrabold focus-visible:outline-3 focus-visible:outline-focus', tld === t ? 'border-[#3b1d8f] bg-[#ece4ff] shadow-[0_3px_0_#3b1d8f]' : 'border-[#c9b68c] bg-white')}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-label font-bold">ถาดเอกสาร เลือก 1 ใบให้ตรงกับนามสกุล</legend>
          <div role="radiogroup" className="mt-1 grid grid-cols-3 gap-2">
            {data.docs.map((d) => {
              const on = doc === d.id
              return (
                <motion.button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={d.label}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  animate={on && !reduce ? { y: -3 } : { y: 0 }}
                  transition={spring}
                  onClick={() => {
                    buzz()
                    setDoc(d.id)
                    setReviewed(false)
                  }}
                  className={cn('relative flex min-h-28 flex-col items-center gap-1.5 rounded-md border-4 px-1.5 py-2 text-center text-label font-extrabold leading-tight focus-visible:outline-3 focus-visible:outline-focus', on ? 'border-[#3b1d8f] bg-[#ece4ff] shadow-[0_4px_0_#3b1d8f]' : 'border-[#0e0720] bg-white shadow-[0_4px_0_#c9b68c]')}
                >
                  <DocArt id={d.id} />
                  <span className="text-pretty">{d.label}</span>
                  {on ? (
                    <span aria-hidden="true" className="absolute -top-2 -right-2 grid size-7 -rotate-12 place-items-center rounded-full border-2 border-[#0e0720] bg-quest-500 text-white shadow-[0_2px_0_#0e0720]">
                      <CheckIcon width={16} height={16} />
                    </span>
                  ) : null}
                </motion.button>
              )
            })}
          </div>
        </fieldset>
        {reviewed ? (
          <p role="status" className="rounded-xl bg-[#f1e6c8] p-3 text-label font-semibold">
            ตรวจก่อนส่ง: ขอจด {domainLabel} พร้อมแนบ {data.docs.find((d) => d.id === doc)?.label} ถ้าตรวจแล้วถูกต้องกดส่งคำขอได้
          </p>
        ) : null}
      </PixelPanel>
      {reviewed ? (
        <GameButton variant="gold" onClick={() => doc && onSubmit({ tld, docId: doc })}>
          ส่งคำขอให้เจ้าหน้าที่
        </GameButton>
      ) : (
        <GameButton variant="primary" disabled={!doc} onClick={() => setReviewed(true)}>
          ตรวจข้อมูลก่อนส่ง
        </GameButton>
      )}
    </div>
  )
}

/** ─── R06 กล่องอีเมล (ขั้นรับอีเมลแจ้งผล) ─── */

export function EmailScreen({
  data,
  check,
  domainName,
  ownerType,
  submission,
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
  const [sheet, setSheet] = useState(false)
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
      if (r.outcome === 'more' && !docsDone) setSheet(true)
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

  const tone = mail?.outcome === 'approve' ? 'ok' : mail?.outcome === 'reject' ? 'no' : 'more'
  return (
    <div className={SCROLL}>
      <PixelPanel variant="dark" className={cn(PIXEL_BOX, "flex flex-col gap-1")}>
        <p className="text-label font-extrabold text-[#ffcf4a]">กล่องอีเมล</p>
        <p className="text-label text-[#d8c9ff]">รอเจ้าหน้าที่ตรวจคำขอ {domainLabel}</p>
      </PixelPanel>
      {wait ? (
        <PixelPanel variant="paper" className="flex items-center gap-3">
          <span aria-hidden="true" className="size-6 animate-spin rounded-full border-4 border-[#7c4dff] border-t-transparent" />
          <p className="text-body font-bold" role="status">
            เจ้าหน้าที่กำลังตรวจคำขอและเอกสาร
          </p>
        </PixelPanel>
      ) : null}
      {fail ? (
        <PixelPanel variant="paper" className="flex flex-col gap-2">
          <p role="alert" className="text-body font-bold text-spark-700">
            ตรวจอีเมลไม่ได้ตอนนี้ ลองใหม่อีกครั้ง
          </p>
          <GameButton variant="primary" onClick={() => setRev((n) => n + 1)}>
            ลองใหม่
          </GameButton>
        </PixelPanel>
      ) : null}
      {mail ? (
        <motion.div initial={reduce ? false : { y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
          <PixelPanel
            variant="paper"
            className={cn('flex flex-col gap-2', tone === 'ok' && 'border-quest-600', tone === 'no' && 'border-spark-600')}
          >
            <p className="text-label font-bold text-[#7a5a2c]">อีเมลจากผู้ให้บริการรับจดทะเบียน</p>
            <p className={cn('text-title-sm font-extrabold', tone === 'ok' ? 'text-quest-700' : tone === 'no' ? 'text-spark-700' : 'text-[#8a4b00]')}>
              {tone === 'ok' ? 'ผลตรวจ: อนุมัติ' : tone === 'no' ? 'ผลตรวจ: ไม่อนุมัติ' : 'ผลตรวจ: ขอเอกสารเพิ่ม'}
            </p>
            <p className="text-body text-pretty">{mail.message}</p>
            <p className="text-label text-pretty text-[#6b5a43]">
              คำขอที่ส่ง: {domainLabel} · แนบ {data.docs.find((d) => d.id === submission.docId)?.label ?? 'เอกสาร'}
            </p>
          </PixelPanel>
        </motion.div>
      ) : null}
      {mail?.outcome === 'approve' ? (
        <GameButton variant="gold" onClick={onApproved}>
          ได้รับอนุมัติ ไปชำระค่าธรรมเนียม
        </GameButton>
      ) : null}
      {mail && mail.outcome !== 'approve' && !sheet ? (
        <GameButton variant="primary" onClick={() => setResubmit(true)}>
          {mail.outcome === 'reject' ? 'กลับไปเลือกนามสกุลที่มีสิทธิ์' : 'เลือกเอกสารที่ถูกแล้วส่งใหม่'}
        </GameButton>
      ) : null}
      <Sheets>
        {sheet && docsEvent && mail ? (
          <QuizSheet
            key="docs"
            title={docsEvent.title}
            story={mail.message}
            question={docsEvent.question}
            choices={docsEvent.choices}
            check={eventQuiz(check, docsEvent.id)}
            onDone={(choice, correct) => {
              onDocsDone(choice, correct)
              setSheet(false)
            }}
          />
        ) : null}
      </Sheets>
    </div>
  )
}

/** ─── R07 ชำระเงิน ─── */

export function PayScreen({
  data,
  check,
  coins,
  years,
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
  payEvent: RegistrarEvent | undefined
  payDone: boolean
  onPayEventDone: (choice: number, correct: boolean) => void
  onPaid: (amount: number) => void
  onContinue: () => void
}) {
  const { reduce, spring } = useGameMotion()
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
    <div className={SCROLL}>
      <PixelPanel variant="paper" className="relative" initial={reduce ? false : { y: 60, rotate: 2, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={spring}>
        <div className="flex min-h-9 items-center justify-between gap-2">
          <p className="text-label font-extrabold tracking-wide text-[#7a5a2c]">ใบแจ้งค่าธรรมเนียม</p>
          {paid ? (
            <motion.span
              initial={reduce ? false : { scale: 2.4, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: -6 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 18 }}
              className="shrink-0 whitespace-nowrap rounded-lg border-[3px] border-quest-700 bg-quest-50 px-2.5 text-body font-extrabold text-quest-700"
              aria-hidden="true"
            >
              จ่ายแล้ว
            </motion.span>
          ) : null}
        </div>
        <p className="mt-1 text-body text-pretty">{data.fee.text}</p>
        <dl className="mt-3 grid grid-cols-2 gap-y-1.5 border-t-2 border-dashed border-[#d9c7a0] pt-3 text-body">
          <dt className="text-[#6b5a43]">จำนวนปี</dt>
          <dd className="text-right font-extrabold">{years} ปี</dd>
          <dt className="text-[#6b5a43]">ยอดที่ต้องจ่าย</dt>
          <dd className="text-right font-extrabold">{amount.toLocaleString('th-TH')} เหรียญ</dd>
          <dt className="text-[#6b5a43]">เหรียญในกระเป๋า</dt>
          <dd className="text-right font-extrabold" aria-live="polite">
            <CountUp to={coins} suffix=" เหรียญ" />
          </dd>
        </dl>
        <p className="mt-3 flex items-start gap-2 text-label text-[#6b5a43]">
          <InfoIcon width={18} height={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>{data.fee.note}</span>
        </p>
        <AnimatePresence>
          {burst
            ? Array.from({ length: 7 }, (_, i) => (
                <motion.span
                  key={i}
                  aria-hidden="true"
                  initial={{ x: 0, y: 40, opacity: 1, scale: 1 }}
                  animate={{ x: (i - 3) * 22, y: -90 - (i % 3) * 18, opacity: 0, scale: 0.7, rotate: 180 }}
                  transition={{ duration: 1.1, delay: i * 0.06, ease: 'easeOut' }}
                  className="pointer-events-none absolute right-1/2 bottom-6 size-6 rounded-full border-2 border-[#b8860b] bg-[#ffe27a]"
                />
              ))
            : null}
        </AnimatePresence>
      </PixelPanel>

      <PixelPanel variant="dark" className={cn(PIXEL_BOX, "flex flex-col gap-1")}>
        <p className="text-label font-extrabold text-[#ffcf4a]">เทียบกับเส้นทาง .com</p>
        <p className="text-label text-pretty text-[#d8c9ff]">{data.fee.comNote}</p>
        <div className="mt-1 grid grid-cols-2 gap-2 text-label">
          <p className="rounded-lg bg-[#2a1748] p-2">
            <span className="block font-extrabold text-[#ffcf4a]">.th</span>ตรวจก่อน จ่ายหลังอนุมัติ
          </p>
          <p className="rounded-lg bg-[#2a1748] p-2">
            <span className="block font-extrabold text-[#ffcf4a]">.com</span>จ่ายก่อน ใช้ได้ทันที ({data.fee.comSample} เหรียญตัวอย่าง)
          </p>
        </div>
      </PixelPanel>

      {paid ? (
        <p role="status" className={cn(SCENE_NOTE, 'flex items-center gap-2 text-body font-extrabold text-[#8cf0b0]')}>
          <CheckIcon width={22} height={22} aria-hidden className="shrink-0" /> จ่ายแล้ว ระบบกำลังออกอีเมลยืนยัน
        </p>
      ) : null}
      {paid ? (
        <GameButton variant="gold" onClick={onContinue}>
          ไปรับอีเมลยืนยัน
        </GameButton>
      ) : (
        <GameButton variant="primary" disabled={!asked || coins < amount} onClick={pay}>
          {asked ? `จ่ายด้วยเหรียญ ${amount.toLocaleString('th-TH')} เหรียญ` : 'ตอบเพื่อนก่อนจึงจ่ายได้'}
        </GameButton>
      )}
      <Sheets>
        {!asked && payEvent ? (
          <QuizSheet
            key="pay"
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
  // ข้อความตัวอย่างมีชื่อโฮสต์ยาว ตัดบรรทัดกลางชื่อได้ จึงแยกเป็นรายการ (รูปแบบ "นำ: ... (ท้าย)")
  const sample = (() => {
    const t = data.dns.sampleText
    const i = t.indexOf(':')
    if (i < 0 || !data.dns.nameserverPlaceholders.every((n) => t.includes(n))) return null
    const tail = t.match(/\(([^)]*)\)\s*$/)?.[1] ?? ''
    return { lead: t.slice(0, i).trim(), tail }
  })()

  function save() {
    const x = a.trim().toLowerCase()
    const y = b.trim().toLowerCase()
    if (!HOST_RE.test(x) || !HOST_RE.test(y)) return setErr('ใส่ชื่อ Nameserver ให้ครบทั้ง 2 ช่อง เช่น ns1.webhost-example.com')
    if (x === y) return setErr('Nameserver 2 ตัวต้องไม่ซ้ำกัน')
    setErr(null)
    setState('testing')
    timer.current = window.setTimeout(() => setState('ok'), reduce ? 200 : 1400)
  }

  return (
    <div className={SCROLL}>
      <Say who="dome" mood="greet">
        {data.dns.intro}
      </Say>
      <PixelPanel variant="dark" className={cn(PIXEL_BOX, "flex flex-col gap-3")}>
        <p className="text-body font-extrabold text-[#8cf0b0]">ตั้งค่า DNS ของโดเมน</p>
        {sample ? (
          <div className="rounded-xl bg-[#1b0f36] p-2.5">
            <p className="text-label text-pretty text-[#d8c9ff]">{sample.lead}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {data.dns.nameserverPlaceholders.map((n, i) => (
                <li key={n} className="flex flex-wrap items-baseline gap-x-2 text-label">
                  <span className="whitespace-nowrap text-[#d8c9ff]">Nameserver {i + 1}</span>
                  <span className="font-mono font-bold whitespace-nowrap text-[#efe6ff]">{n}</span>
                </li>
              ))}
            </ul>
            {sample.tail ? <p className="mt-1 text-label text-[#d8c9ff]">{sample.tail}</p> : null}
          </div>
        ) : (
          <p className="text-label text-pretty text-[#d8c9ff]">{data.dns.sampleText}</p>
        )}
        {([['Nameserver 1', a, setA, 0], ['Nameserver 2', b, setB, 1]] as const).map(([label, val, set, i]) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="text-label font-bold">{label}</span>
            <input className={cn(INPUT, 'font-mono')} placeholder={data.dns.nameserverPlaceholders[i]} value={val} onChange={(e) => set(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={state !== 'edit'} />
          </label>
        ))}
        {err ? (
          <p role="alert" className="text-label font-bold text-[#ffb870]">
            {err}
          </p>
        ) : null}
        <div className="rounded-xl border-2 border-dashed border-[#5b4698] p-2.5">
          <p className="text-label font-bold text-[#ffcf4a]">
            ดูของจริง: Nameserver ของ <span className="font-mono whitespace-nowrap">{ref.domain}</span>
          </p>
          <ul className="mt-1 font-mono text-label text-[#d8c9ff]">
            {ref.nameservers.map((n) => (
              <li key={n} className="whitespace-nowrap">{n}</li>
            ))}
          </ul>
          <p className="mt-1 text-label text-[#a998d9]">ตรวจเมื่อ {ref.checkedAt}</p>
        </div>
      </PixelPanel>
      {state === 'testing' ? (
        <p role="status" className={cn(SCENE_NOTE, 'flex items-center gap-2 text-body text-[#efe6ff]')}>
          <span aria-hidden="true" className="size-5 shrink-0 animate-spin rounded-full border-4 border-[#7c4dff] border-t-transparent" />
          กำลังทดสอบเปิดเว็บ
        </p>
      ) : null}
      {state === 'ok' ? (
        <motion.div role="status" initial={reduce ? false : { scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="overflow-hidden rounded-2xl border-[3px] border-[#8cf0b0] bg-[#0e0720]">
          <div className="flex items-center gap-2 bg-[#241446] px-3 py-1.5 text-label font-bold">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-[#8cf0b0]" />
            เว็บเปิดได้แล้ว
          </div>
          <p className="p-3 text-body font-extrabold text-[#8cf0b0]">{data.dns.successText}</p>
        </motion.div>
      ) : null}
      {state === 'ok' ? (
        <GameButton variant="gold" onClick={onDone}>
          ข้ามเวลาไป 1 ปี
        </GameButton>
      ) : (
        <GameButton variant="primary" loading={state === 'testing'} onClick={save}>
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
          <rect x="1" y="3" width="46" height="30" fill="#bfe3ff" stroke="#0e0720" strokeWidth="2" />
          <rect x="5" y="9" width="12" height="14" fill="#7c4dff" />
          <rect x="21" y="10" width="22" height="3" fill="#0e0720" />
          <rect x="21" y="16" width="18" height="3" fill="#6b5a43" />
          <rect x="21" y="22" width="14" height="3" fill="#6b5a43" />
        </>
      ) : id === 'doc-company' ? (
        <>
          <rect x="6" y="1" width="36" height="34" fill="#fff6dc" stroke="#0e0720" strokeWidth="2" />
          <rect x="12" y="7" width="24" height="3" fill="#0e0720" />
          <rect x="12" y="14" width="24" height="2" fill="#6b5a43" />
          <rect x="12" y="19" width="16" height="2" fill="#6b5a43" />
          <circle cx="34" cy="27" r="5" fill="#ffcf4a" stroke="#b8860b" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="6" y="1" width="36" height="34" fill="#e6f7e0" stroke="#0e0720" strokeWidth="2" />
          <rect x="10" y="5" width="28" height="7" fill="#4caf50" />
          <rect x="12" y="17" width="24" height="2" fill="#6b5a43" />
          <rect x="12" y="22" width="20" height="2" fill="#6b5a43" />
          <rect x="12" y="27" width="12" height="2" fill="#6b5a43" />
        </>
      )}
    </svg>
  )
}

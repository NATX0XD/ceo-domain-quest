'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Reorder, motion, useDragControls } from 'motion/react'
import { AlertIcon, CheckIcon, cn } from '@/components/ui'
import { CountUp, GameButton, Stars, buzz, useGameMotion } from './index'
import { ArtIcon, BossSprite, ClipPanel, Glyph, PixelDome, PixelImg, QuizBody, SCENE_NOTE, Say } from './registrar-ui'
import { StepIcon, eventQuiz, type Check } from './registrar-screens'
import type { ExplainPayload, RegistrarData, RegistrarDetail, RegistrarEvent, RegistrarResult, RubricRow } from '../registrar-types'

const SCROLL = 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3'
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const DAY = 24 * 60 * 60 * 1000

/** ─── R09 ข้ามเวลา 1 ปี ─── */

function CalendarFlip({ onDone }: { onDone: () => void }) {
  const { reduce } = useGameMotion()
  // หน้าปฏิทินรายเดือนจากวันนี้ ไปถึงวันที่เหลือ 30 วันก่อนครบ 1 ปี
  const pages = useMemo(() => {
    const now = Date.now()
    const end = new Date(now + 335 * DAY)
    const list = Array.from({ length: 11 }, (_, k) => {
      const d = new Date(now)
      d.setMonth(d.getMonth() + k)
      return d
    })
    list.push(end)
    return list
  }, [])
  const last = pages.length - 1
  const end = pages[last]!
  const step = 0.17
  useEffect(() => {
    const t = window.setTimeout(onDone, reduce ? 200 : 600 + last * step * 1000 + 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="m4-calendar" role="img" aria-label={`ข้ามเวลาไปถึงวันที่ ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear() + 543}`}>
      <span className="m4-calendar-rings" aria-hidden="true" />
      {pages.map((d, k) => {
        const flip = k < last
        return (
          <motion.div
            key={k}
            className="m4-calendar-page"
            style={{ zIndex: pages.length - k }}
            initial={false}
            animate={flip && !reduce ? { rotateX: -105, y: -18, opacity: 0 } : { rotateX: 0, opacity: flip ? 0 : 1 }}
            transition={reduce ? { duration: 0 } : { duration: 0.22, delay: 0.5 + k * step, ease: 'easeIn' }}
          >
            <small>พ.ศ. {d.getFullYear() + 543}</small>
            <b>{d.getDate()}</b>
            <span>{MONTHS[d.getMonth()]}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

export function TimeScreen({
  data,
  check,
  coins,
  domain,
  expireEvent,
  onAnswer,
  onSpend,
  onDone,
}: {
  data: RegistrarData
  check: Check
  coins: number
  domain: string
  years?: number
  expireEvent: RegistrarEvent | undefined
  onAnswer: (choice: number, correct: boolean) => void
  onSpend: (amount: number) => void
  onDone: () => void
}) {
  const { reduce, spring } = useGameMotion()
  const [view, setView] = useState<'calendar' | 'choose' | 'renewed' | 'lapsed' | 'restored'>('calendar')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const fee = data.fee.pricePerYear

  async function decide(choice: 0 | 1) {
    if (!expireEvent) return
    setBusy(true)
    setErr(null)
    const r = await check({ kind: 'event', eventId: expireEvent.id, choice })
    setBusy(false)
    if (!r || r.kind !== 'event') return setErr('ตรวจไม่ได้ตอนนี้ ลองกดอีกครั้ง')
    onAnswer(choice, r.correct)
    setNote(r.explanation)
    if (choice === 0) {
      onSpend(fee)
      setView('renewed')
    } else setView('lapsed')
  }

  return (
    <div className={`${SCROLL} m4-screen m4-time-screen`}>
      <motion.p
        className="m4-year-sign"
        initial={reduce ? false : { y: -30, scale: 0.6, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 14 }}
      >
        1 ปีต่อมา
      </motion.p>
      <div className="m4-time-row">
        <PixelDome mood={view === 'renewed' || view === 'restored' ? 'happy' : 'worried'} size={110} />
        <CalendarFlip onDone={() => setView((v) => (v === 'calendar' ? 'choose' : v))} />
      </div>

      {view === 'choose' ? (
        <>
          <ClipPanel className="m4-expire-card">
            <span className="m4-globe-tile mx-auto" aria-hidden="true">
              <ArtIcon px="icon-globe" glyph="globe" size={38} />
            </span>
            <p className="m4-expire-domain">{domain}</p>
            <p className="text-center text-body font-bold">จะหมดอายุในอีก</p>
            <motion.p className="m4-days" initial={reduce ? false : { scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: reduce ? 0 : 0.2 }}>
              <b>30</b> วัน
            </motion.p>
            <p className="text-center text-label text-pretty text-[#4a3d7a]">{expireEvent?.question}</p>
          </ClipPanel>
          {err ? (
            <p role="alert" className={cn(SCENE_NOTE, 'text-[#b5521b]')}>
              {err}
            </p>
          ) : null}
          <div className="m4-dock-pair">
            <GameButton loading={busy} disabled={coins < fee} onClick={() => void decide(0)}>
              <span className="m4-coin" aria-hidden="true" />
              ต่ออายุ {fee.toLocaleString('th-TH')} เหรียญ
            </GameButton>
            <GameButton variant="paper" disabled={busy} onClick={() => void decide(1)}>
              ปล่อยไว้ก่อน
            </GameButton>
          </div>
          {coins < fee ? <p className={cn(SCENE_NOTE, 'text-[#b5521b]')}>เหรียญไม่พอต่ออายุ ต้องเลือกปล่อยไว้</p> : null}
        </>
      ) : null}

      {view === 'renewed' ? (
        <>
          <ClipPanel>
            <p className="flex items-center gap-2 text-title-sm font-extrabold text-[#1d7a3e]">
              <CheckIcon width={24} height={24} aria-hidden /> ต่ออายุแล้ว เว็บยังอยู่
            </p>
            <p className="mt-1 text-body text-pretty">{note}</p>
          </ClipPanel>
          <GameButton onClick={onDone}>ไปอธิบายให้บอสฟัง ›</GameButton>
        </>
      ) : null}

      {view === 'lapsed' || view === 'restored' ? (
        <>
          <motion.div initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className={cn('m4-site-state', view === 'lapsed' ? 'is-down' : 'is-up')}>
            <p>
              <span aria-hidden="true" />
              {view === 'lapsed' ? 'หน้าเว็บของร้าน: ถูกระงับ' : 'หน้าเว็บของร้าน: กลับมาแล้ว'}
            </p>
            <b>{view === 'lapsed' ? 'ชื่อนี้หมดอายุและถูกระงับ เปิดเว็บไม่ได้ และอาจมีคนอื่นมาจดต่อ' : 'กู้คืนชื่อสำเร็จ เว็บเปิดได้อีกครั้ง'}</b>
          </motion.div>
          <ClipPanel pop={false}>
            <p className="text-body text-pretty">{note}</p>
            <p className="mt-2 border-t-2 border-dashed border-[#cfc4f3] pt-2 text-label text-[#6b5a43]">การปล่อยหมดอายุบันทึกไว้ว่าพลาด แต่ไม่ตัดคะแนนหนัก</p>
          </ClipPanel>
          {view === 'lapsed' ? (
            <GameButton
              disabled={coins < data.fee.restoreFee}
              onClick={() => {
                onSpend(data.fee.restoreFee)
                setView('restored')
              }}
            >
              เลือกใหม่: กู้คืนชื่อ {data.fee.restoreFee.toLocaleString('th-TH')} เหรียญ
            </GameButton>
          ) : (
            <GameButton onClick={onDone}>ไปอธิบายให้บอสฟัง ›</GameButton>
          )}
          {view === 'lapsed' && coins < data.fee.restoreFee ? (
            <GameButton variant="paper" onClick={onDone}>
              เหรียญไม่พอกู้คืน ไปอธิบายให้บอสฟัง
            </GameButton>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/** ─── R10 อธิบายให้บอสฟัง ─── */

function ExplainRow({
  id,
  index,
  text,
  reasoned,
  focused,
  count,
  onFocus,
  onMove,
}: {
  id: string
  index: number
  text: string
  reasoned: boolean
  focused: boolean
  count: number
  onFocus: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const controls = useDragControls()
  const { reduce } = useGameMotion()
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className={cn('m4-explain-row', focused && 'is-focus')}
      whileDrag={reduce ? undefined : { scale: 1.03, boxShadow: '0 10px 18px rgb(36 22 79 / .28)', zIndex: 5 }}
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
    >
      <span className="m4-explain-no" aria-hidden="true">
        {index + 1}
      </span>
      <button type="button" className="m4-explain-text" aria-pressed={focused} onClick={onFocus}>
        <StepIcon id={id} size={22} />
        <span className="min-w-0 flex-1 text-pretty">{text}</span>
        <span className={cn('m4-reason-dot', reasoned && 'is-on')} aria-label={reasoned ? 'เลือกเหตุผลแล้ว' : 'ยังไม่เลือกเหตุผล'} />
      </button>
      <button
        type="button"
        className="m4-explain-handle"
        aria-label={`ย้ายขั้นที่ ${index + 1} ลากขึ้นลง หรือกดลูกศรขึ้นลง`}
        onPointerDown={(e) => {
          e.preventDefault()
          buzz()
          controls.start(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' && index > 0) {
            e.preventDefault()
            onMove(-1)
          } else if (e.key === 'ArrowDown' && index < count - 1) {
            e.preventDefault()
            onMove(1)
          }
        }}
      >
        <span aria-hidden="true" />
      </button>
    </Reorder.Item>
  )
}

export function ExplainScreen({
  data,
  check,
  eventsCorrect,
  eventsTotal,
  onProceed,
  onRepair,
}: {
  data: RegistrarData
  check: Check
  eventsCorrect: number
  eventsTotal: number
  onProceed: (ex: ExplainPayload) => void
  onRepair: () => void
}) {
  const { reduce, spring } = useGameMotion()
  const ex = data.explain
  const [order, setOrder] = useState<string[]>(() => ex.chips.map((c) => c.id))
  const [reasons, setReasons] = useState<Record<string, number>>({})
  const [renewal, setRenewal] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [res, setRes] = useState<{ rubric: RubricRow[]; total: number; followUp: { question: string; reason: string } } | null>(null)
  const top = useRef<HTMLDivElement | null>(null)

  const chipText = new Map(ex.chips.map((c) => [c.id, c.text]))
  const reasonCount = Object.keys(reasons).length
  const meter = Math.min(10, 4 + Math.min(4, Math.round((reasonCount / Math.max(1, order.length)) * 4)) + (renewal !== null ? 1 : 0) + (text.trim().length >= 40 ? 1 : 0))
  const payload: ExplainPayload = { order, reasons, renewal, text: text.trim() ? text.trim() : undefined }

  function move(id: string, dir: -1 | 1) {
    setOrder((o) => {
      const i = o.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= o.length) return o
      const next = [...o]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  async function submit() {
    setBusy(true)
    setErr(null)
    const r = await check({ kind: 'explain', ...payload })
    setBusy(false)
    if (!r || r.kind !== 'explain') return setErr('ส่งให้บอสไม่ได้ตอนนี้ ลองกดอีกครั้ง')
    setRes(r)
    top.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  const passing = res !== null && res.total >= 7 && eventsCorrect >= 3

  return (
    <div className={`${SCROLL} m4-screen m4-explain-screen`}>
      <div ref={top} />
      <div className="m4-boss-row">
        <BossSprite mood={passing ? 'smile' : 'neutral'} size={128} />
        <motion.p className="m4-boss-bubble" initial={reduce ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: reduce ? 0 : 0.3 }} key={res ? 'r' : 'p'}>
          {res ? (passing ? 'เข้าใจชัดเจน ขอบใจที่อธิบาย' : 'ยังมีบางจุดที่อยากให้ลองอีกรอบ') : ex.prompt}
        </motion.p>
      </div>

      {res ? (
        <>
          <ClipPanel title="คะแนนคำอธิบาย">
            <p className="text-center text-title-sm font-extrabold text-[#3d2a8a]">
              <CountUp to={res.total} /> <span className="text-body">/ 10</span>
              <span className="block text-label font-bold text-[#6b5a43]">ต้องได้อย่างน้อย 7</span>
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {res.rubric.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-0.5 shrink-0">
                    {r.got >= r.max ? <CheckIcon width={20} height={20} className="text-[#1d7a3e]" /> : <AlertIcon width={20} height={20} className="text-spark-700" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-body font-bold text-pretty">{r.label}</span>
                      <span className="m4-score-chip">
                        {r.got}/{r.max}
                      </span>
                    </span>
                    <span className="block text-label text-pretty text-[#6b5a43]">{r.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-start justify-between gap-2 border-t-2 border-dashed border-[#cfc4f3] pt-2">
              <span className="min-w-0 text-label font-bold text-pretty">รับมือเหตุการณ์ถูก (ต้องอย่างน้อย 3)</span>
              <span className="m4-score-chip">
                {eventsCorrect}/{eventsTotal}
              </span>
            </p>
          </ClipPanel>
          {res.followUp.question ? (
            <ClipPanel tone="lilac" pop={false}>
              <p className="text-label font-extrabold text-[#6b4fd8]">บอสถามต่อ</p>
              <p className="text-body font-bold text-pretty">{res.followUp.question}</p>
              {res.followUp.reason ? <p className="mt-1 text-label text-pretty text-[#4a3d7a]">คำตอบที่บอสอยากได้ยิน: {res.followUp.reason}</p> : null}
            </ClipPanel>
          ) : null}
          {passing ? <GameButton onClick={() => onProceed(payload)}>รับใบรับรองจดชื่อเว็บ ›</GameButton> : <GameButton onClick={onRepair}>ไปรอบซ่อมเฉพาะจุดที่พลาด ›</GameButton>}
        </>
      ) : (
        <ClipPanel title="อธิบายขั้นตอนให้บอสฟัง">
          <p className="-mt-1 mb-1.5 text-center text-label font-semibold text-[#4a3d7a]">ลาก ⋮⋮ เรียงขั้นให้ถูก แล้วแตะแต่ละขั้นเพื่อเลือกเหตุผล</p>
          <Reorder.Group axis="y" values={order} onReorder={setOrder} className="m4-explain-list" aria-label="ลำดับขั้นตอน">
            {order.map((id, i) => (
              <ExplainRow
                key={id}
                id={id}
                index={i}
                count={order.length}
                text={chipText.get(id) ?? id}
                reasoned={reasons[id] !== undefined}
                focused={focus === id}
                onFocus={() => {
                  buzz()
                  setFocus(id)
                }}
                onMove={(dir) => move(id, dir)}
              />
            ))}
          </Reorder.Group>

          <div className="m4-explain-section">
            <p className="m4-field-label">
              อธิบายเหตุผลของแต่ละขั้น <span className="font-semibold text-[#6b5a43]">(เลือกแล้ว {reasonCount}/{order.length})</span>
            </p>
            {focus ? (
              <fieldset className="m4-reason-box">
                <legend>
                  {ex.reasonPrompt}: {chipText.get(focus)}
                </legend>
                <div role="radiogroup" className="flex flex-col gap-1.5">
                  {(ex.reasonChoices[focus] ?? []).map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={reasons[focus] === i}
                      onClick={() => {
                        buzz()
                        setReasons((r) => ({ ...r, [focus]: i }))
                        // ไปขั้นถัดไปที่ยังไม่มีเหตุผลให้อัตโนมัติ
                        const nextId = order.find((x) => x !== focus && reasons[x] === undefined)
                        if (nextId && !reduce) window.setTimeout(() => setFocus(nextId), 260)
                      }}
                      className={cn('m4-choice is-small', reasons[focus] === i && 'is-on')}
                    >
                      <span className="min-w-0 flex-1 text-pretty">{c}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-label text-[#6b5a43]">แตะขั้นในรายการด้านบนเพื่อเลือกเหตุผลของขั้นนั้น</p>
            )}
          </div>

          <fieldset className="m4-explain-section">
            <legend className="m4-field-label">{ex.renewalQuestion}</legend>
            <div role="radiogroup" className="mt-1 flex flex-col gap-1.5">
              {ex.renewalChoices.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={renewal === i}
                  onClick={() => {
                    buzz()
                    setRenewal(i)
                  }}
                  className={cn('m4-choice is-small', renewal === i && 'is-on')}
                >
                  <span className="min-w-0 flex-1 text-pretty">{c}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="m4-explain-section flex flex-col gap-1">
            <span className="m4-field-label">{ex.textLabel}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1500} placeholder={ex.textPlaceholder} className="m4-textarea" />
          </label>

          <div className="m4-explain-section">
            <div className="flex items-center justify-between gap-2 text-label font-extrabold">
              <span>ความครบถ้วน</span>
              <span aria-live="polite" className="tabular-nums">
                {meter}/10
              </span>
            </div>
            <div className="m4-blocks" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={meter} aria-label="ความครบถ้วนของคำอธิบาย">
              {Array.from({ length: 10 }, (_, i) => (
                <motion.span key={i} animate={{ backgroundColor: i < meter ? '#6b4fd8' : '#e4ddfb' }} transition={reduce ? { duration: 0 } : { duration: 0.2, delay: i * 0.02 }} />
              ))}
            </div>
          </div>
          {err ? (
            <p role="alert" className="mt-2 text-label font-bold text-spark-700">
              {err}
            </p>
          ) : null}
          <GameButton className="mt-3 w-full" loading={busy} onClick={() => void submit()}>
            ส่งคำอธิบาย
          </GameButton>
        </ClipPanel>
      )}
    </div>
  )
}

/** ─── รอบซ่อม: เล่นเฉพาะเหตุการณ์ที่พลาด ─── */

export function RepairScreen({
  missed,
  check,
  onAnswer,
  onFinish,
}: {
  missed: RegistrarEvent[]
  check: Check
  onAnswer: (id: string, choice: number, correct: boolean) => void
  onFinish: () => void
}) {
  const [i, setI] = useState(0)
  const ev = missed[i]
  return (
    <div className={`${SCROLL} m4-screen`}>
      <Say who="boss">รอบซ่อม เล่นเฉพาะเหตุการณ์ที่ยังรับมือไม่ถูก ตอบใหม่แล้วค่อยกลับไปอธิบายอีกครั้ง</Say>
      {ev ? (
        <motion.div key={ev.id} className="flex flex-col gap-3" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <ClipPanel title={ev.title}>
            <p className="text-center text-label font-bold text-[#6b4fd8]">
              รอบซ่อม {i + 1}/{missed.length}
            </p>
            <p className="m4-story">{ev.story}</p>
          </ClipPanel>
          <QuizBody
            question={ev.question}
            choices={ev.choices}
            check={eventQuiz(check, ev.id)}
            onDone={(choice, correct) => {
              onAnswer(ev.id, choice, correct)
              if (i + 1 >= missed.length) onFinish()
              else setI(i + 1)
            }}
            doneLabel={i + 1 >= missed.length ? 'กลับไปอธิบายให้บอสฟัง' : 'เหตุการณ์ถัดไป'}
          />
        </motion.div>
      ) : null}
    </div>
  )
}

/** ─── R11 ผ่านด่าน ─── */

export function ClearScreen({ result, shop, domain }: { result: RegistrarResult; shop: string; domain: string }) {
  const { reduce, spring } = useGameMotion()
  const d = result.detail as Partial<RegistrarDetail> | null
  const stars = typeof d?.stars === 'number' ? d.stars : result.passed ? 2 : 0
  const why = !result.passed
    ? null
    : stars >= 3
      ? 'ครบ 3 ดาว: ทุกขั้นถูกตั้งแต่ครั้งแรก และอธิบายให้บอสได้ 9 จาก 10 ขึ้นไป'
      : stars === 2
        ? 'ได้ 2 ดาว: ผ่านเกณฑ์ แต่ยังมีขั้นที่ต้องแก้ หรืออธิบายได้ต่ำกว่า 9 จาก 10'
        : 'ได้ 1 ดาว: ผ่านหลังเข้ารอบซ่อม เล่นใหม่ให้ถูกตั้งแต่ครั้งแรกเพื่อได้ 3 ดาว'
  const stats: { icon: 'list' | 'shield' | 'book'; label: string; value: string }[] = d?.order && d.events && d.explanation
    ? [
        { icon: 'list', label: 'เรียงขั้นตอนถูก', value: `${d.order.correct}/${d.order.total}` },
        { icon: 'shield', label: 'รับมือเหตุการณ์', value: `${d.events.correct}/${d.events.total}` },
        { icon: 'book', label: 'อธิบายครบ', value: `${d.explanation.points}/10` },
      ]
    : []
  return (
    <div className={`${SCROLL} m4-screen m4-clear-screen`}>
      <ClipPanel title={result.passed ? 'จดชื่อเว็บสำเร็จ' : 'ยังไม่ถึงเกณฑ์'}>
        <p className="m4-domain-pill" title={shop}>
          {domain}
        </p>
        <div className="m4-stars">
          <Stars count={stars} size={46} />
        </div>
        {stats.length ? (
          <ul className="m4-stats">
            {stats.map((s, i) => (
              <motion.li key={s.label} initial={reduce ? false : { x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...spring, delay: reduce ? 0 : 1.2 + i * 0.15 }}>
                <Glyph kind={s.icon} size={22} className="text-[#6b4fd8]" />
                <span>{s.label}</span>
                <b>{s.value}</b>
              </motion.li>
            ))}
          </ul>
        ) : null}
        {result.passed ? (
          <motion.div className="m4-title-badge" initial={reduce ? false : { scale: 0.5, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: reduce ? 0 : 1.8 }}>
            <span className="m4-medal" aria-hidden="true">
              <PixelImg name="badge-ceo" fallback="/icons/3d/crown.webp" />
            </span>
            <span>
              <small>ได้รับฉายา</small>
              <b>CEO ตัวจริง</b>
            </span>
          </motion.div>
        ) : null}
        <p className="mt-2 text-center text-label font-bold text-[#4a3d7a]">
          คะแนน <CountUp to={result.score} /> จาก 100{why ? ` · ${why}` : ''}
        </p>
        {!result.passed ? <p className="mt-1 text-center text-label text-[#6b5a43]">ลองกลับไปอธิบายให้บอสฟังอีกรอบได้เลย</p> : null}
      </ClipPanel>
      {result.passed ? <PixelDome mood="cheer" size={130} className="m4-clear-dome" /> : null}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertIcon, CheckIcon, cn } from '@/components/ui'
import { CountUp, GameButton, PixelPanel, Stars, buzz, useGameMotion } from './index'
import { PIXEL_BOX, QuizSheet, Say, Sheets } from './registrar-ui'
import { eventQuiz, type Check } from './registrar-screens'
import type { ExplainPayload, RegistrarData, RegistrarDetail, RegistrarEvent, RegistrarResult, RubricRow } from '../registrar-types'

const SCROLL = 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3'
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** ─── R09 ข้ามเวลา 1 ปี ─── */

export function TimeScreen({
  data,
  check,
  coins,
  expireEvent,
  onAnswer,
  onSpend,
  onDone,
}: {
  data: RegistrarData
  check: Check
  coins: number
  expireEvent: RegistrarEvent | undefined
  onAnswer: (choice: number, correct: boolean) => void
  onSpend: (amount: number) => void
  onDone: () => void
}) {
  const { reduce, spring } = useGameMotion()
  const year = new Date().getFullYear() + 543
  const [view, setView] = useState<'calendar' | 'choose' | 'renewed' | 'lapsed' | 'restored'>('calendar')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const fee = data.fee.pricePerYear

  useEffect(() => {
    if (view !== 'calendar') return
    const t = window.setTimeout(() => setView('choose'), reduce ? 300 : 2400)
    return () => window.clearTimeout(t)
  }, [view, reduce])

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

  if (view === 'calendar') {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-6" role="status" aria-label={`ข้ามเวลาไป 1 ปี เป็นปี ${year + 1}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-56 overflow-hidden rounded-2xl border-[3px] border-[#7a5a3a] bg-[#fff8e6] text-center text-[#3a2a18] shadow-[0_6px_0_#5c4228] [perspective:600px]">
            <div className="bg-[#c44a4a] py-1 text-label font-extrabold tracking-widest text-white">ปฏิทิน</div>
            <div className="relative h-28">
              {(reduce ? [11] : Array.from({ length: 12 }, (_, i) => i)).map((m) => (
                <motion.div
                  key={m}
                  className="absolute inset-0 grid place-items-center bg-[#fff8e6] [transform-origin:top] [backface-visibility:hidden]"
                  style={{ zIndex: 12 - m }}
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: reduce ? 0 : -180 }}
                  transition={{ duration: 0.16, delay: m * 0.16, ease: 'easeIn' }}
                >
                  <span className="text-title font-extrabold">{MONTHS[m]}</span>
                </motion.div>
              ))}
              <div className="absolute inset-0 grid place-items-center bg-[#fff8e6]">
                <span className="text-title font-extrabold text-brand-700">{year + 1}</span>
              </div>
            </div>
          </div>
          <p className="text-title-sm font-extrabold text-[#ffcf4a]">ผ่านไป 1 ปี</p>
        </div>
      </div>
    )
  }

  return (
    <div className={SCROLL}>
      {view === 'choose' ? (
        <>
          <PixelPanel variant="paper" className="flex flex-col gap-2 rounded-md border-4 border-[#0e0720] shadow-[0_0_0_2px_#7a5a3a,0_6px_0_2px_#0e0720]" initial={reduce ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
            <p className="text-label font-bold text-[#8a6a3c]">แจ้งเตือนจากผู้ให้บริการ</p>
            <p className="text-title-sm font-extrabold text-balance">ชื่อเว็บจะหมดอายุในอีก 30 วัน</p>
            <p className="text-body text-pretty">{expireEvent?.story}</p>
            <p className="text-body font-bold">{expireEvent?.question}</p>
          </PixelPanel>
          {err ? (
            <p role="alert" className="text-label font-bold text-[#ffb870]">
              {err}
            </p>
          ) : null}
          <GameButton variant="gold" loading={busy} disabled={coins < fee} onClick={() => void decide(0)}>
            ต่ออายุ ({fee.toLocaleString('th-TH')} เหรียญ)
          </GameButton>
          <GameButton variant="dark" disabled={busy} onClick={() => void decide(1)}>
            ปล่อยไว้ก่อน
          </GameButton>
          {coins < fee ? <p className="text-label text-[#ffb870]">เหรียญไม่พอต่ออายุ ต้องเลือกปล่อยไว้</p> : null}
        </>
      ) : null}

      {view === 'renewed' ? (
        <>
          <PixelPanel variant="paper" className="flex flex-col gap-2 rounded-md border-4 border-[#0e0720] shadow-[0_0_0_2px_#7a5a3a,0_6px_0_2px_#0e0720]">
            <p className="flex items-center gap-2 text-title-sm font-extrabold text-quest-700">
              <CheckIcon width={24} height={24} aria-hidden /> ต่ออายุแล้ว เว็บยังอยู่
            </p>
            <p className="text-body text-pretty">{note}</p>
          </PixelPanel>
          <GameButton variant="gold" onClick={onDone}>
            ไปอธิบายให้บอสฟัง
          </GameButton>
        </>
      ) : null}

      {view === 'lapsed' || view === 'restored' ? (
        <>
          <motion.div initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="overflow-hidden rounded-2xl border-[3px] border-[#d97a6a] bg-[#0e0720]">
            <div className="flex items-center gap-2 bg-[#3a1620] px-3 py-1.5 text-label font-bold">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-[#ff8a7a]" />
              {view === 'lapsed' ? 'หน้าเว็บของร้าน: ถูกระงับ' : 'หน้าเว็บของร้าน: กลับมาแล้ว'}
            </div>
            <p className="p-3 text-body font-bold text-pretty">
              {view === 'lapsed' ? 'ชื่อนี้หมดอายุและถูกระงับ เปิดเว็บไม่ได้ และอาจมีคนอื่นมาจดต่อ' : 'กู้คืนชื่อสำเร็จ เว็บเปิดได้อีกครั้ง'}
            </p>
          </motion.div>
          <PixelPanel variant="paper">
            <p className="text-body text-pretty">{note}</p>
          </PixelPanel>
          {view === 'lapsed' ? (
            <GameButton
              variant="gold"
              disabled={coins < data.fee.restoreFee}
              onClick={() => {
                onSpend(data.fee.restoreFee)
                setView('restored')
              }}
            >
              เลือกใหม่: กู้คืนชื่อ {data.fee.restoreFee.toLocaleString('th-TH')} เหรียญ
            </GameButton>
          ) : (
            <GameButton variant="gold" onClick={onDone}>
              ไปอธิบายให้บอสฟัง
            </GameButton>
          )}
          {view === 'lapsed' && coins < data.fee.restoreFee ? (
            <GameButton variant="dark" onClick={onDone}>
              เหรียญไม่พอกู้คืน ไปอธิบายให้บอสฟัง
            </GameButton>
          ) : null}
          <p className="text-label text-[#a998d9]">การปล่อยหมดอายุบันทึกไว้ว่าพลาด แต่ไม่ตัดคะแนนหนัก</p>
        </>
      ) : null}
    </div>
  )
}

/** ─── R10 อธิบายให้บอสฟัง ─── */

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
  const [order, setOrder] = useState<string[]>([])
  const [reasons, setReasons] = useState<Record<string, number>>({})
  const [renewal, setRenewal] = useState<number | null>(null)
  const [typed, setTyped] = useState(false)
  const [text, setText] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [res, setRes] = useState<{ rubric: RubricRow[]; total: number; followUp: { question: string; reason: string } } | null>(null)
  const top = useRef<HTMLDivElement | null>(null)

  const chipText = new Map(ex.chips.map((c) => [c.id, c.text]))
  const pool = ex.chips.filter((c) => !order.includes(c.id))
  const meter = Math.min(10, order.length + Math.min(2, Object.keys(reasons).length) + (renewal !== null ? 1 : 0) + (text.trim().length >= 60 ? 1 : 0))
  const payload: ExplainPayload = { order, reasons, renewal, text: typed && text.trim() ? text.trim() : undefined }

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
    <div className={SCROLL}>
      <div ref={top} />
      <Say who="boss">{res ? (passing ? 'เข้าใจชัดเจน ขอบใจที่อธิบาย' : 'ยังมีบางจุดที่อยากให้ลองอีกรอบ') : ex.prompt}</Say>

      {res ? (
        <>
          <PixelPanel variant="paper" className="flex flex-col gap-2.5 rounded-md border-4 border-[#0e0720] shadow-[0_0_0_2px_#7a5a3a,0_6px_0_2px_#0e0720]" initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
            <p className="text-body font-extrabold">
              คะแนนคำอธิบาย <CountUp to={res.total} /> จาก 10 (ต้องได้อย่างน้อย 7)
            </p>
            <ul className="flex flex-col gap-2">
              {res.rubric.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-0.5 shrink-0">
                    {r.got >= r.max ? <CheckIcon width={20} height={20} className="text-quest-700" /> : <AlertIcon width={20} height={20} className="text-spark-700" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold">
                      {r.label} {r.got}/{r.max}
                    </span>
                    <span className="block text-label text-pretty text-[#6b5a43]">{r.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-label font-bold text-[#6b5a43]">
              รับมือเหตุการณ์ถูก {eventsCorrect} จาก {eventsTotal} (ต้องอย่างน้อย 3)
            </p>
          </PixelPanel>
          {res.followUp.question ? (
            <PixelPanel variant="dark" className={cn(PIXEL_BOX, "flex flex-col gap-1.5")}>
              <p className="text-label font-extrabold text-[#ffcf4a]">บอสถามต่อ</p>
              <p className="text-body font-bold text-pretty">{res.followUp.question}</p>
              {res.followUp.reason ? <p className="text-label text-pretty text-[#d8c9ff]">คำตอบที่บอสอยากได้ยิน: {res.followUp.reason}</p> : null}
            </PixelPanel>
          ) : null}
          {passing ? (
            <GameButton variant="gold" onClick={() => onProceed(payload)}>
              รับใบรับรองจดชื่อเว็บ
            </GameButton>
          ) : (
            <GameButton variant="gold" onClick={onRepair}>
              ไปรอบซ่อมเฉพาะจุดที่พลาด
            </GameButton>
          )}
        </>
      ) : (
        <PixelPanel variant="paper" className="flex flex-col gap-3">
          <p className="text-title-sm font-extrabold">อธิบายขั้นตอนให้บอสฟัง</p>
          <div>
            <p className="text-label font-bold">แตะชิปตามลำดับที่ต้องทำ</p>
            <ul className="mt-1.5 flex flex-wrap gap-2" aria-label="ชิปขั้นตอน">
              {pool.map((c) => (
                <li key={c.id}>
                  <motion.button
                    type="button"
                    layout={!reduce}
                    whileTap={reduce ? undefined : { scale: 0.95 }}
                    onClick={() => {
                      buzz()
                      setOrder((o) => [...o, c.id])
                    }}
                    className="min-h-11 rounded-xl border-2 border-[#b8860b] bg-[#fff6dc] px-3 py-1.5 text-label font-bold text-pretty shadow-[0_3px_0_#b8860b] focus-visible:outline-3 focus-visible:outline-focus"
                  >
                    {c.text}
                  </motion.button>
                </li>
              ))}
              {pool.length === 0 ? <li className="text-label text-[#6b5a43]">วางชิปครบแล้ว</li> : null}
            </ul>
          </div>

          <ol className="flex flex-col gap-1.5" aria-label="ลำดับที่เรียงไว้">
            {order.map((id, i) => (
              <li key={id} className="flex items-center gap-2">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#3b1d8f] text-label font-extrabold text-white">
                  {i + 1}
                </span>
                <button
                  type="button"
                  aria-pressed={focus === id}
                  onClick={() => setFocus(focus === id ? null : id)}
                  className={cn('flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 px-2.5 py-1 text-left text-label font-bold text-pretty focus-visible:outline-3 focus-visible:outline-focus', focus === id ? 'border-[#3b1d8f] bg-[#ece4ff]' : 'border-[#c9b68c] bg-white')}
                >
                  <span className="min-w-0 flex-1">{chipText.get(id)}</span>
                  {reasons[id] !== undefined ? <CheckIcon width={18} height={18} aria-hidden className="shrink-0 text-quest-700" /> : null}
                </button>
                <button
                  type="button"
                  aria-label={`เอาขั้นที่ ${i + 1} ออก`}
                  onClick={() => {
                    setOrder((o) => o.filter((x) => x !== id))
                    setFocus((f) => (f === id ? null : f))
                  }}
                  className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-[#c9b68c] bg-[#f1e6c8] text-body font-extrabold focus-visible:outline-3 focus-visible:outline-focus"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>

          {focus ? (
            <fieldset className="rounded-xl bg-[#f1e6c8] p-2.5">
              <legend className="px-1 text-label font-extrabold">{ex.reasonPrompt}: {chipText.get(focus)}</legend>
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
                    }}
                    className={cn('min-h-11 rounded-lg border-2 px-2.5 py-1.5 text-left text-label font-semibold text-pretty focus-visible:outline-3 focus-visible:outline-focus', reasons[focus] === i ? 'border-[#3b1d8f] bg-[#ece4ff]' : 'border-[#c9b68c] bg-white')}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : order.length > 0 ? (
            <p className="text-label text-[#6b5a43]">แตะขั้นในลำดับเพื่อเลือกเหตุผลของขั้นนั้น</p>
          ) : null}

          <fieldset>
            <legend className="text-label font-extrabold">{ex.renewalQuestion}</legend>
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
                  className={cn('min-h-11 rounded-lg border-2 px-2.5 py-1.5 text-left text-label font-semibold text-pretty focus-visible:outline-3 focus-visible:outline-focus', renewal === i ? 'border-[#3b1d8f] bg-[#ece4ff]' : 'border-[#c9b68c] bg-white')}
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>

          {typed ? (
            <label className="flex flex-col gap-1">
              <span className="text-label font-extrabold">{ex.textLabel}</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                maxLength={1500}
                placeholder={ex.textPlaceholder}
                className="min-h-24 w-full rounded-xl border-2 border-[#7a5a3a] bg-white p-2.5 text-body text-[#3a2a18] focus-visible:outline-3 focus-visible:outline-focus"
              />
            </label>
          ) : (
            <button type="button" onClick={() => setTyped(true)} className="min-h-11 rounded-xl border-2 border-dashed border-[#7a5a3a] px-3 text-label font-extrabold focus-visible:outline-3 focus-visible:outline-focus">
              พิมพ์อธิบายเองเพิ่ม (ระดับท้าทาย)
            </button>
          )}

          <div>
            <div className="flex items-center justify-between text-label font-extrabold">
              <span>ความครบถ้วน</span>
              <span aria-live="polite">{meter}/10</span>
            </div>
            <div className="mt-1 h-4 overflow-hidden rounded-md border-2 border-[#3b1d8f] bg-[#ece4ff]" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={meter} aria-label="ความครบถ้วนของคำอธิบาย">
              <motion.div className="h-full bg-[#7c4dff]" animate={{ width: `${meter * 10}%` }} transition={reduce ? { duration: 0 } : { duration: 0.3 }} />
            </div>
          </div>
          {err ? (
            <p role="alert" className="text-label font-bold text-spark-700">
              {err}
            </p>
          ) : null}
          <GameButton variant="primary" disabled={order.length === 0} loading={busy} onClick={() => void submit()}>
            ส่งคำอธิบาย
          </GameButton>
        </PixelPanel>
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
    <div className={SCROLL}>
      <Say who="boss">รอบซ่อม เล่นเฉพาะเหตุการณ์ที่ยังรับมือไม่ถูก ตอบใหม่แล้วค่อยกลับไปอธิบายอีกครั้ง</Say>
      <Sheets>
        {ev ? (
          <QuizSheet
            key={ev.id}
            kicker={`รอบซ่อม ${i + 1}/${missed.length}`}
            title={ev.title}
            story={ev.story}
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
        ) : null}
      </Sheets>
    </div>
  )
}

/** ─── R11 จบด่านบอส ─── */

export function ClearScreen({ result, shop, domain }: { result: RegistrarResult; shop: string; domain: string }) {
  const { reduce, spring } = useGameMotion()
  const d = result.detail as Partial<RegistrarDetail> | null
  const stars = typeof d?.stars === 'number' ? d.stars : result.passed ? 2 : 0
  const why = !result.passed
    ? null
    : stars >= 3
      ? 'ครบ 3 ดาว: ทุกขั้นถูกตั้งแต่ครั้งแรก และอธิบายให้บอสได้ 9 จาก 10 ขึ้นไป'
      : stars === 2
        ? 'ได้ 2 ดาว: ผ่านเกณฑ์ แต่ยังมีขั้นที่ต้องแก้ หรืออธิบายได้ต่ำกว่า 9 จาก 10 อีกนิดเดียวจะได้ 3 ดาว'
        : 'ได้ 1 ดาว: ผ่านเกณฑ์หลังเข้ารอบซ่อมเหตุการณ์ ดาวสูงสุดของรอบซ่อมคือ 1 ดวง เล่นใหม่ให้ถูกตั้งแต่ครั้งแรกเพื่อได้ 3 ดาว'
  return (
    <div className={SCROLL}>
      <Say who="boss">{result.passed ? 'ยินดีด้วย ร้านของเธอมีชื่อเว็บเป็นของตัวเองแล้ว' : 'ยังไม่ถึงเกณฑ์ ลองกลับไปอธิบายอีกรอบได้เลย'}</Say>
      <PixelPanel variant="paper" className="flex flex-col items-center gap-2 text-center" initial={reduce ? false : { scale: 0.85, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={spring}>
        <p className="text-label font-extrabold tracking-widest text-[#8a6a3c]">ใบรับรอง</p>
        <p className="text-title font-extrabold text-balance text-[#3b1d8f]">จดชื่อเว็บสำเร็จ</p>
        <p className="text-body">
          {shop} ใช้ชื่อ <span className="font-extrabold break-all">{domain}</span>
        </p>
        <Stars count={stars} />
        {why ? <p className="text-label font-bold text-pretty text-[#3a2a18]">{why}</p> : null}
        <p className="text-title-sm font-extrabold">
          <CountUp to={result.score} /> <span className="text-label font-bold text-[#6b5a43]">จาก 100</span>
        </p>
        {d?.order && d.events && d.explanation ? (
          <ul className="w-full text-left text-label text-[#6b5a43]">
            <li>วางการ์ดถูกครั้งแรก {d.order.points}/20</li>
            <li>รับมือเหตุการณ์ {d.events.correct}/{d.events.total} ได้ {d.events.points}/30</li>
            <li>อธิบายให้บอส {d.explanation.points}/10 ได้ {Math.round(d.explanation.points * 5)}/50</li>
          </ul>
        ) : null}
        {result.passed ? <p className="rounded-lg bg-[#ece4ff] px-3 py-1 text-label font-extrabold text-[#3b1d8f]">ได้ป้าย CEO ตัวจริง</p> : null}
      </PixelPanel>
    </div>
  )
}

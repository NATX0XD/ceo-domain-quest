'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { CountUp, GameButton, useGameMotion } from './game-ui'
import { BossHud, BossShell, BossSign, M4_ASSET, SCENE_NOTE, Say } from './game-ui/registrar-ui'
import {
  DnsScreen,
  DocsPanel,
  EmailScreen,
  FormPanel,
  MiniStep,
  PayScreen,
  RouteBoard,
  SearchScreen,
  type Check,
  type FormValue,
  type Submission,
} from './game-ui/registrar-screens'
import { ClearScreen, ExplainScreen, RepairScreen, TimeScreen } from './game-ui/registrar-finale'
import './registrar-game.css'
import {
  SAMPLE_CARD,
  type ExplainPayload,
  type RegistrarCard,
  type RegistrarData,
  type RegistrarPayload,
  type RegistrarResult,
  type RegistrarStepPayload,
  type RegistrarStepResult,
} from './registrar-types'

export type { RegistrarData } from './registrar-types'

/**
 * เกมลงมือทำ m4 ด่านบอส "จดชื่อเว็บของร้านฉัน" — จดจริง (ข้อมูล RDAP) จ่ายจำลอง อธิบายเอง
 * ตาม docs/mission-4/mission-4-domain-registration.md จอ R01-R11
 *
 *  R01 เปิดด่าน → R04 แผงเดินเรื่อง 10 ช่อง (วางการ์ดขั้นถัดไปถูกก่อนจึงเล่นขั้นนั้น)
 *    ขั้น 3 ค้นชื่อจริง R02 + นักสืบโดเมน R03 · ขั้น 4-5 ฟอร์ม+เอกสาร R05 · ขั้น 6-7 อีเมล R06
 *    ขั้น 8 จ่ายเหรียญ R07 · ขั้น 10 DNS R08 → ข้ามเวลา 1 ปี R09 → อธิบายให้บอส R10 → ใบรับรอง R11
 *
 * ⚠️ ไม่มีเฉลยในไฟล์นี้ ทุกการตรวจเรียก onStep (action 'step') และ onSubmit (action 'do') ที่เซิร์ฟเวอร์
 * ⚠️ ไม่มีเงินจริง เหรียญทั้งหมดเป็นของในเกม · ผลค้น 404 ขึ้นว่า "ไม่พบการจด" เสมอ ห้ามใช้คำว่าว่าง
 */

type View = 'rules' | 'intro' | 'board' | 'play' | 'time' | 'explain' | 'repair' | 'clear'

type Props = {
  data: RegistrarData
  onSubmit: (payload: RegistrarPayload) => Promise<RegistrarResult>
  /** ตรวจทีละจังหวะ (POST action 'step') คืน result จากเซิร์ฟเวอร์ */
  onStep?: (payload: RegistrarStepPayload) => Promise<unknown>
  /** บัตรนามสกุลของฉันจากด่าน 3 ถ้าไม่ส่งมาใช้ธุรกิจตัวอย่าง */
  card?: RegistrarCard | null
}

type EventLog = Record<string, { choice: number; correct: boolean }>

export function RegistrarGame({ data, onSubmit, onStep, card }: Props) {
  const { reduce, spring, slide } = useGameMotion()
  const router = useRouter()
  const myCard = card ?? SAMPLE_CARD
  const total = data.steps.length
  const stepText = useMemo(() => new Map(data.steps.map((s) => [s.id, s.text])), [data.steps])
  const ev = (stage: string) => data.events.find((e) => e.stage === stage)

  const [view, setView] = useState<View>('rules')
  const [placed, setPlaced] = useState<string[]>([])
  const [placing, setPlacing] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [reasonLine, setReasonLine] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)
  const [events, setEvents] = useState<EventLog>({})
  const [coins, setCoins] = useState(data.fee.startCoins)
  const [searched, setSearched] = useState(false)
  const [domain, setDomain] = useState<{ name: string; tld: string } | null>(null)
  const [form, setForm] = useState<FormValue>({ applicant: '', email: '', years: 1 })
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [repaired, setRepaired] = useState(false)
  const [repairIds, setRepairIds] = useState<string[]>([])
  const [explainKey, setExplainKey] = useState(0)
  const [explainDone, setExplainDone] = useState<ExplainPayload | null>(null)
  const [result, setResult] = useState<RegistrarResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const alive = useRef(true)
  const [sec, setSec] = useState(270)
  useEffect(() => {
    const t = window.setInterval(() => setSec((n) => Math.max(0, n - 1)), 1000)
    return () => window.clearInterval(t)
  }, [])
  const clock = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const current = placed.length > 0 && view === 'play' ? placed[placed.length - 1] : null
  const domainLabel = domain ? `${domain.name}${domain.tld}` : `${myCard.slug}${myCard.tld}`

  /** เรียกเซิร์ฟเวอร์ตรวจ ล้มเหลวคืน null (หน้าจอแสดงปุ่มลองใหม่เอง) */
  const check: Check = async (p) => {
    if (!onStep) {
      setStepError('ระบบตรวจยังไม่พร้อม ลองเข้าหน้านี้ใหม่อีกครั้ง')
      return null
    }
    try {
      const r = (await onStep(p)) as RegistrarStepResult | null
      setStepError(null)
      return r && typeof r === 'object' && 'kind' in r ? r : null
    } catch {
      return null
    }
  }

  function record(id: string, choice: number, correct: boolean, overwrite = false) {
    setEvents((e) => (e[id] && !overwrite ? e : { ...e, [id]: { choice, correct } }))
  }

  async function place(stepId: string) {
    if (placing) return
    setPlacing(stepId)
    setHint(null)
    const r = await check({ kind: 'place', slot: placed.length, stepId })
    if (!alive.current) return
    if (!r || r.kind !== 'place') {
      setHint('ตรวจไม่ได้ตอนนี้ ลองวางการ์ดอีกครั้ง')
      setPlacing(null)
      return
    }
    if (r.correct) {
      setPlaced((p) => [...p, stepId])
      setReasonLine(r.reason ?? null)
      setPlacing(null)
      setView('play')
    } else {
      setMisses((m) => m + 1)
      setHint(r.hint ?? 'ลองคิดดูว่าขั้นนี้ต้องมีอะไรเกิดขึ้นก่อน')
      window.setTimeout(() => alive.current && setPlacing(null), reduce ? 0 : 380)
    }
  }

  /** จบขั้นที่กำลังเล่น: ครบ 10 ขั้นไปข้ามเวลา ไม่ครบกลับแผง */
  function advance() {
    setReasonLine(null)
    setView(placed.length >= total ? 'time' : 'board')
  }

  async function finish(ex: ExplainPayload) {
    setExplainDone(ex)
    setSubmitting(true)
    setSubmitError(null)
    try {
      const r = await onSubmit({
        order: placed,
        events: Object.fromEntries(Object.entries(events).map(([k, v]) => [k, v.choice])),
        searched,
        misses,
        repaired,
        explain: ex,
      })
      if (!alive.current) return
      setResult(r)
      setView('clear')
    } catch {
      if (alive.current) setSubmitError('ส่งผลไม่สำเร็จ ลองกดอีกครั้ง')
    } finally {
      if (alive.current) setSubmitting(false)
    }
  }

  const eventsCorrect = data.events.filter((e) => events[e.id]?.correct).length
  const missedEvents = data.events.filter((e) => !events[e.id]?.correct)

  function repair() {
    setRepaired(true)
    if (eventsCorrect < 3) {
      setRepairIds(missedEvents.map((e) => e.id))
      setView('repair')
    }
    else {
      setExplainKey((k) => k + 1)
      setView('explain')
    }
  }

  const stepNow = view === 'time' || view === 'explain' || view === 'repair' || view === 'clear' ? total : Math.min(placed.length + (view === 'board' ? 1 : 0), total)
  const STEP_STAGE: Record<string, string> = {
    'st-account': 'สมัครบัญชี',
    'st-menu': 'เมนูจดทะเบียน',
    'st-search': 'ค้นชื่อจริง',
    'st-form': 'กรอกใบขอจด',
    'st-docs': 'แนบเอกสาร',
    'st-review': 'รอเจ้าหน้าที่ตรวจ',
    'st-email': 'กล่องอีเมล',
    'st-pay': 'ใบแจ้งค่าธรรมเนียม',
    'st-confirm': 'อีเมลยืนยัน',
    'st-dns': 'ตั้งค่า DNS',
  }
  const stageName =
    view === 'time'
      ? '1 ปีต่อมา'
      : view === 'explain' || view === 'repair'
        ? 'อธิบายให้บอสฟัง'
        : view === 'clear'
          ? 'จบด่าน'
          : view === 'board'
            ? 'แผงเดินเรื่อง'
            : current
              ? (STEP_STAGE[current] ?? 'ด่านบอส')
              : 'ค้นชื่อจริง'

  // ─── กติกา (infographic) ───
  if (view === 'rules') {
    const rules = [
      { icon: 'magnifying-glass-tilted-left', title: 'ค้นชื่อจริง', body: 'ผลมาจากระบบทะเบียนจริง' },
      { icon: 'clipboard', title: `เรียงการ์ด ${total} ขั้น`, body: 'ลากการ์ดลงช่องที่กะพริบ' },
      { icon: 'bell', title: `รับมือ ${data.events.length} เหตุการณ์`, body: 'อีเมล เอกสาร ค่าธรรมเนียม' },
      { icon: 'crown', title: 'อธิบายให้บอสฟัง', body: 'เรียงขั้นพร้อมบอกเหตุผล' },
    ]
    return (
      <BossShell stage="กติกาด่านบอส">
        <div className="m4-content">
          <motion.section className="m4-rules-board" initial={reduce ? false : { y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
            <span className="m4-kicker">กติกา · ด่านบอส</span>
            <h2>{data.title}</h2>
            <p className="m4-rules-lead">จดจริงด้วยข้อมูลโดเมนจริง จ่ายด้วยเหรียญจำลอง ทำครบ 4 อย่างนี้</p>
            <ol className="m4-rules-path">
              {rules.map((r, i) => (
                <motion.li
                  key={r.icon}
                  initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 20, delay: 0.12 + i * 0.1 }}
                >
                  <span className="m4-rules-no">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
                  <img src={`/icons/3d/${r.icon}.webp`} alt="" aria-hidden draggable={false} />
                  <b>{r.title}</b>
                  <small>{r.body}</small>
                </motion.li>
              ))}
            </ol>
            <div className="m4-rules-strip">
              <span>
                <span className="m4-coin" aria-hidden="true" />
                <b>{data.fee.startCoins.toLocaleString('th-TH')}</b> เหรียญจำลอง
              </span>
              <span>
                {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
                <img src="/icons/3d/stopwatch.webp" alt="" aria-hidden />
                <b>04:30</b> นาที
              </span>
              <span>
                {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอนสถิตใน public */}
                <img src="/icons/3d/glowing-star.webp" alt="" aria-hidden />
                สูงสุด <b>3</b> ดาว
              </span>
            </div>
            <Say>ไม่มีเงินจริงนะครับ 1 เหรียญเท่ากับ 1 บาท วางการ์ดผิดได้ การ์ดจะเด้งกลับพร้อมคำใบ้</Say>
          </motion.section>
        </div>
        <div className="m4-dock">
          <GameButton className="w-full" onClick={() => setView('intro')}>
            ไปหน้าห้องบอส →
          </GameButton>
        </div>
      </BossShell>
    )
  }

  // ─── R01 เปิดด่านบอส ───
  if (view === 'intro') {
    return (
      <BossShell stage="เปิดด่านบอส">
        <BossHud step={0} total={total} coins={coins} coinNode={<CountUp to={coins} />} timer={clock} />
        <div className="m4-content m4-intro">
          <motion.div className="m4-intro-office" initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ภาพอาคารสถิตใน public */}
            <img src="/learn/m3/domain-building.webp" alt="" aria-hidden draggable={false} />
            <span className="m4-intro-office-sign">สำนักงานรับจดชื่อเว็บ</span>
            <BossSign className="m4-intro-boss" />
          </motion.div>
          <div className="m4-intro-row">
            <motion.img
              className="m4-intro-dome"
              src={M4_ASSET('dome_cheer')}
              alt="โดม"
              draggable={false}
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={reduce ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="m4-ticket"
              initial={reduce ? false : { y: 30, rotate: -8, opacity: 0 }}
              animate={{ y: 0, rotate: -4, opacity: 1 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 16, delay: 0.25 }}
            >
              <small>บัตรนามสกุลของฉัน</small>
              <strong>{myCard.tld}</strong>
              <span>
                {myCard.shop} · {myCard.ownerType === 'company' ? 'นิติบุคคล' : 'บุคคลทั่วไป'}
              </span>
            </motion.div>
          </div>
          <Say bare>
            บอสให้ไปจดชื่อเว็บ <b>{myCard.slug}{myCard.tld}</b> ให้ร้านเรา ใช้ข้อมูลโดเมนจริง จ่ายด้วยเหรียญในเกม
            {!card ? <span className="mt-0.5 block text-[#7a5a2c]">ไม่มีบัตรจากด่าน 3 จึงใช้ร้านตัวอย่างแทน</span> : null}
          </Say>
        </div>
        <div className="m4-dock">
          <GameButton className="w-full" onClick={() => setView('play')}>
            เริ่มเดินเรื่อง →
          </GameButton>
        </div>
      </BossShell>
    )
  }

  const submissionNow: Submission = submission ?? { tld: domain?.tld ?? myCard.tld, docId: '' }

  return (
    <BossShell stage={stageName}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <BossHud stage={stageName} step={stepNow} total={total} coins={coins} coinNode={<CountUp to={coins} />} timer={clock} />
        {stepError ? (
          <p role="alert" className={`${SCENE_NOTE} mx-3 mb-2 text-[#b5521b]`}>
            {stepError}
          </p>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${view}-${view === 'play' ? current : explainKey}`}
            initial={reduce ? false : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? undefined : { x: -40, opacity: 0 }}
            transition={slide}
            className="flex min-h-0 flex-1 flex-col"
          >
            {view === 'board' ? <RouteBoard data={data} placed={placed} placing={placing} hint={hint} onPlace={(id) => void place(id)} /> : null}

            {view === 'play' && !current ? (
              <SearchScreen
                data={data}
                card={myCard}
                check={check}
                takenEvent={ev('search')}
                takenDone={Boolean(events['ev-taken'])}
                onTakenDone={(choice, correct) => record('ev-taken', choice, correct)}
                onSearched={() => setSearched(true)}
                onPick={(name, tld) => {
                  setDomain({ name, tld })
                  // R02/R03 happen before the R04 route board; entering the registrar
                  // and opening its menu are implicit in that hand-off.
                  setPlaced(['st-account', 'st-menu', 'st-search'])
                  setView('board')
                }}
              />
            ) : null}

            {view === 'play' && current ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 px-3 pb-2">
                  <Say who="dome" mood="cheer">
                    <span className="font-extrabold">ขั้นที่ {placed.length}: {stepText.get(current)}</span>
                    {reasonLine ? <span className="mt-0.5 block font-normal text-[#d8c9ff]">ทำไม: {reasonLine}</span> : null}
                  </Say>
                </div>
                {current === 'st-account' ? (
                  <MiniStep title="สมัครบัญชีหรือเข้าสู่ระบบ" body="เข้าระบบของผู้ให้บริการรับจดทะเบียนด้วยบัญชีของร้าน ระบบจะได้รู้ว่าใครเป็นผู้ยื่นคำขอ" action="เข้าสู่ระบบด้วยบัญชีร้าน" onDone={advance} />
                ) : null}
                {current === 'st-menu' ? <MiniStep title="เมนูจดทะเบียนโดเมน" body="เปิดเมนูจดทะเบียนโดเมนเพื่อเริ่มคำขอใหม่" action="เปิดเมนูจดทะเบียนโดเมน" onDone={advance} /> : null}
                {current === 'st-search' ? (
                  <SearchScreen
                    data={data}
                    card={myCard}
                    check={check}
                    takenEvent={ev('search')}
                    takenDone={Boolean(events['ev-taken'])}
                    onTakenDone={(choice, correct) => record('ev-taken', choice, correct)}
                    onSearched={() => setSearched(true)}
                    onPick={(name, tld) => {
                      setDomain({ name, tld })
                      advance()
                    }}
                  />
                ) : null}
                {current === 'st-form' ? (
                  <FormPanel domain={domainLabel} value={form} onChange={setForm} onDone={advance} />
                ) : null}
                {current === 'st-docs' ? (
                  <DocsPanel
                    data={data}
                    domainName={domain?.name ?? myCard.slug}
                    initialTld={domain?.tld ?? myCard.tld}
                    onSubmit={(s) => {
                      setSubmission(s)
                      advance()
                    }}
                  />
                ) : null}
                {current === 'st-review' ? (
                  <MiniStep title="เจ้าหน้าที่ตรวจคำขอ" body="เจ้าหน้าที่กำลังตรวจคำขอและเอกสารที่แนบมา ว่าร้านมีสิทธิ์จดนามสกุลนี้จริงไหม" action="ส่งให้เจ้าหน้าที่ตรวจ" autoMs={1500} onDone={advance} />
                ) : null}
                {current === 'st-email' ? (
                  <EmailScreen
                    data={data}
                    check={check}
                    domainName={domain?.name ?? myCard.slug}
                    ownerType={myCard.ownerType}
                    submission={submissionNow}
                    docsEvent={ev('docs')}
                    docsDone={Boolean(events['ev-docs'])}
                    onDocsDone={(choice, correct) => record('ev-docs', choice, correct)}
                    onResubmit={(s) => setSubmission(s)}
                    onApproved={advance}
                  />
                ) : null}
                {current === 'st-pay' ? (
                  <PayScreen
                    data={data}
                    check={check}
                    coins={coins}
                    years={form.years}
                    payEvent={ev('pay')}
                    payDone={Boolean(events['ev-pay'])}
                    onPayEventDone={(choice, correct) => record('ev-pay', choice, correct)}
                    onPaid={(amount) => setCoins((c) => c - amount)}
                    onContinue={advance}
                  />
                ) : null}
                {current === 'st-confirm' ? (
                  <MiniStep
                    title="อีเมลยืนยันจดสำเร็จ"
                    body={`ชื่อ ${domainLabel} เป็นของร้านแล้ว จดไว้ ${form.years} ปี ต้องต่ออายุก่อนหมดอายุทุกครั้ง`}
                    action="เปิดอีเมลยืนยัน"
                    onDone={advance}
                  />
                ) : null}
                {current === 'st-dns' ? <DnsScreen data={data} onDone={advance} /> : null}
              </div>
            ) : null}

            {view === 'time' ? (
              <div className="m4-finale-screen m4-time-screen">
              <TimeScreen
                data={data}
                check={check}
                coins={coins}
                expireEvent={ev('after-dns')}
                onAnswer={(choice, correct) => record('ev-expire', choice, correct)}
                onSpend={(n) => setCoins((c) => c - n)}
                onDone={() => setView('explain')}
              />
              </div>
            ) : null}

            {view === 'repair' ? (
              <div className="m4-finale-screen m4-repair-screen">
              <RepairScreen
                missed={data.events.filter((e) => repairIds.includes(e.id))}
                check={check}
                onAnswer={(id, choice, correct) => record(id, choice, correct, true)}
                onFinish={() => {
                  setExplainKey((k) => k + 1)
                  setView('explain')
                }}
              />
              </div>
            ) : null}

            {view === 'explain' ? (
              <div className="m4-finale-screen flex min-h-0 flex-1 flex-col">
                <ExplainScreen data={data} check={check} eventsCorrect={eventsCorrect} eventsTotal={data.events.length} onProceed={(ex) => void finish(ex)} onRepair={repair} />
                {submitError ? (
                  <div className="px-3 pb-3">
                    <p role="alert" className={`${SCENE_NOTE} mb-2 text-[#b5521b]`}>
                      {submitError}
                    </p>
                    <GameButton variant="gold" className="w-full" loading={submitting} onClick={() => explainDone && void finish(explainDone)}>
                      ส่งผลอีกครั้ง
                    </GameButton>
                  </div>
                ) : null}
              </div>
            ) : null}

            {view === 'clear' && result ? (
              <div className="m4-finale-screen flex min-h-0 flex-1 flex-col">
                <ClearScreen result={result} shop={myCard.shop} domain={domainLabel} />
                <div className="m4-dock">
                  {result.passed ? (
                    <div className="m4-dock-pair">
                      <GameButton variant="paper" onClick={() => router.push('/map')}>
                        กลับแผนที่
                      </GameButton>
                      <GameButton
                        onClick={() => {
                          router.push('/mission/m4')
                          router.refresh()
                        }}
                      >
                        ไปด่านหลัก →
                      </GameButton>
                    </div>
                  ) : (
                    <GameButton
                      className="w-full"
                      onClick={() => {
                        setResult(null)
                        setExplainKey((k) => k + 1)
                        setView('explain')
                      }}
                    >
                      อธิบายให้บอสฟังอีกครั้ง
                    </GameButton>
                  )}
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </BossShell>
  )
}

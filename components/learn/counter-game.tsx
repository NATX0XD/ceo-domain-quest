'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/components/ui'
import { ConveyorDrill, type DrillItem } from './game-ui/conveyor-drill'
import { CounterFinalSelf, CounterOnboarding } from './game-ui/counter-prep'
import { Cta, DomeSay, M3Stage, M3_ASSET, Panel, sfx, useDragDrop } from './game-ui/counter-shell'
import { CountUp, Stars, useGameMotion } from './game-ui'
import {
  COUNTER_LEVELS,
  type CounterCase,
  type CounterCaseResult,
  type CounterCategory,
  type CounterData,
  type CounterDecision,
  type CounterDetail,
  type CounterLevel,
  type CounterStampId,
  type CounterStep,
  type CounterStepResult,
} from './counter-types'

export type { CounterData, CounterLevel } from './counter-types'

/**
 * เกมลงมือทำ ด่าน 3 — เคาน์เตอร์รับจดโดเมน (หน้าตาแบบสตอรีบอร์ดภารกิจที่ 2)
 *
 * S01–S08 เริ่มภารกิจ บทฝึก เตรียมตัว → S09–S16 ลูกค้าทีละคน → S17 ลูกค้าคนสุดท้ายคือตัวเอง → S18/S19 รายงานปิดกะ → S20 สายพาน
 * ลูกค้า 1 คน: มาถึง อ่านใบคำขอ → ลากป้ายประเภท → สัมภาษณ์ (ไม่เกิน 3 คำถาม) → ประทับตรา + นามสกุล + เหตุผล
 * ⚠️ ไม่มีเฉลยในไฟล์นี้ ตรวจทีละลูกค้าผ่าน `onCheck` และส่งทั้งกะครั้งเดียวผ่าน `onSubmit`
 */

type SubmitResult = { score: number; passed: boolean; detail: unknown }

const STEP_LABEL: Record<CounterStep, string> = {
  request: 'อ่านใบคำขอ',
  tag: 'ติดป้ายประเภท',
  interview: 'สัมภาษณ์',
  stamp: 'ประทับตรา',
}

const STAMP_ICON: Record<CounterStampId, string> = {
  approve: 'check-mark-button',
  suggest: 'light-bulb',
  'first-step': 'chequered-flag',
  reject: 'warning',
}

const REASONS = [
  'ลูกค้ามีเอกสารตรงเงื่อนไขของนามสกุลที่ขอ',
  'ลูกค้ายังขาดเอกสาร จึงควรใช้นามสกุลที่เขามีสิทธิ์',
  'ลูกค้าไม่ใช่หน่วยงานที่หมวดสงวนรับ หรือข้อมูลไม่ตรงความจริง',
]

function isDetail(value: unknown): value is CounterDetail {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as CounterDetail).cases) &&
    typeof (value as CounterDetail).tagAccuracy === 'number'
  )
}

type CheckFn = (decision: CounterDecision) => Promise<CounterStepResult>

type ViewDomain = { name: string; role: string; label: string }
type ViewCase = Omit<CounterCase, 'domains'> & { domains: ViewDomain[] }

type Feedback =
  | { kind: 'right'; points: number }
  | { kind: 'retry'; wrongTags: string[]; stampWrong: boolean }
  | { kind: 'explain'; text: string; points: number }

function toView(c: CounterCase): ViewCase {
  return { ...c, domains: c.domains.map((d) => ({ ...d, label: d.name })) }
}

function pickWeak(groups: CounterDetail['groups'] | undefined): CounterCategory[] {
  const weak = (groups ?? []).filter((g) => g.total > 0 && g.correct / g.total < 0.8)
  return weak.map((g) => g.category)
}

function buildDrill(data: CounterData, focus: CounterCategory[]): DrillItem[] {
  const pool = data.handbook.flatMap((f) =>
    f.rows.flatMap((r) => r.suffix.split(/\s+/).filter(Boolean).map((label) => ({ label, bin: f.category as string }))),
  )
  const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5)
  const mine = shuffle(pool.filter((i) => focus.includes(i.bin as CounterCategory)))
  const other = shuffle(pool.filter((i) => !focus.includes(i.bin as CounterCategory)))
  return shuffle([...mine.slice(0, 6), ...other.slice(0, 2)])
}

/** จับคำถามที่พิมพ์เองกับคำถามสำเร็จรูปที่ใกล้ที่สุด (ใช้แทน AI เมื่อไม่มี) */
function matchQuestion(text: string, qs: { id: string; text: string }[]): string | null {
  const grams = (s: string) => {
    const t = s.replace(/\s+/g, '').toLowerCase()
    const set = new Set<string>()
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
    return set
  }
  const mine = grams(text)
  if (mine.size === 0) return null
  let best: { id: string; score: number } | null = null
  for (const q of qs) {
    const g = grams(q.text)
    let hit = 0
    for (const x of mine) if (g.has(x)) hit++
    const score = hit / Math.max(4, Math.min(mine.size, g.size))
    if (!best || score > best.score) best = { id: q.id, score }
  }
  return best && best.score >= 0.3 ? best.id : null
}

type Page = 'arrive' | 'tag' | 'interview' | 'stamp'
type Stage = 'onboarding' | 'play' | 'final' | 'report' | 'drill' | 'practice' | 'ready'

export function CounterGame({
  data,
  onSubmit,
  onCheck,
  level,
  shopName,
  business,
  onExit,
  onFinish,
}: {
  data: CounterData
  onSubmit: (payload: unknown) => Promise<SubmitResult>
  /** ตรวจทีละลูกค้า (action: 'step') ถ้าไม่ส่งมา เกมจะไม่มีรอบลองแก้ */
  onCheck?: (decision: CounterDecision) => Promise<CounterStepResult>
  /** ระดับตามคะแนนวอร์มอัพ ไม่ส่ง = ใช้ค่าในเนื้อหา */
  level?: CounterLevel
  /** ธุรกิจของผู้เล่น ใช้กับลูกค้าคนสุดท้าย (S17) */
  shopName?: string
  business?: string
  /** ปุ่มกลมย้อนกลับ ไม่ส่ง = ถามยืนยันแล้วกลับแผนที่ */
  onExit?: () => void
  /** ผ่านด่านแล้วกดไปต่อ ไม่ส่ง = กลับแผนที่พร้อมฉลองเกาะ */
  onFinish?: () => void
}) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('onboarding')
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [drillItems, setDrillItems] = useState<DrillItem[]>([])
  const [practiceCases, setPracticeCases] = useState<ViewCase[]>([])
  const [stats, setStats] = useState({ handbook: 0, dome: 0 })
  const [selfCard, setSelfCard] = useState<{ extension: string; reason: string } | null>(null)
  const [rounds, setRounds] = useState(0)
  const bump = (k: 'handbook' | 'dome') => setStats((x) => ({ ...x, [k]: x[k] + 1 }))

  const cases = useMemo(() => data.cases.map((c) => toView(c)), [data.cases])
  const lv = level ? COUNTER_LEVELS[level] : { handbookSeconds: data.handbookSeconds, hints: data.hintsPerShift }
  const detail = result && isDetail(result.detail) ? result.detail : null

  async function finishShift(all: CounterDecision[]) {
    const r = await onSubmit({ decisions: all })
    setResult(r)
    setStage(selfCard ? 'report' : 'final')
  }

  function startRemedial() {
    const byId = new Map((detail?.cases ?? []).map((c) => [c.caseId, c]))
    const missed = cases.filter((c) => {
      const r = byId.get(c.id)
      return r && !(r.stampCorrect && r.tagsCorrect === r.tagsTotal)
    })
    setPracticeCases(missed.slice(0, 2))
    const weak = pickWeak(detail?.groups)
    setDrillItems(buildDrill(data, weak.length > 0 ? weak : data.categories.map((c) => c.id)))
    setStage('drill')
  }

  function newShift() {
    setResult(null)
    setStats({ handbook: 0, dome: 0 })
    setRounds((n) => n + 1)
    setRun((n) => n + 1)
    setStage('play')
  }

  const finish = onFinish ?? (() => router.push('/map?done=m3'))

  if (stage === 'onboarding') {
    return <CounterOnboarding data={data} onReady={() => setStage('play')} onExit={onExit} />
  }

  if (stage === 'final') {
    return (
      <CounterFinalSelf
        shopName={shopName}
        business={business}
        onExit={onExit}
        onDone={(card) => {
          sfx('win')
          setSelfCard(card)
          setStage('report')
        }}
      />
    )
  }

  if (stage === 'report' && result) {
    return (
      <ResultView
        data={data}
        result={result}
        stats={stats}
        selfCard={selfCard}
        rounds={rounds}
        onExit={onExit}
        onRemedial={startRemedial}
        onRetry={newShift}
        onFinish={finish}
      />
    )
  }

  if (stage === 'drill') {
    return (
      <ConveyorDrill
        items={drillItems}
        bins={data.categories.map((c) => ({ id: c.id, label: c.label }))}
        onExit={onExit}
        onDone={() => setStage(practiceCases.length > 0 ? 'practice' : 'ready')}
      />
    )
  }

  if (stage === 'ready') {
    return (
      <M3Stage pill="ฝึกเสร็จแล้ว" onBack={onExit} bg="counter" dock={<Cta onClick={newShift}>เข้ากะใหม่ →</Cta>}>
        <Panel kicker="พร้อมแล้ว" title="ลูกค้าชุดเดิมกลับมาอีกรอบ">
          <p className="m3s-lead">คุณฝึกหมวดที่พลาดแล้ว เข้ากะใหม่เพื่อส่งรายงานปิดกะอีกครั้ง</p>
        </Panel>
        <DomeSay>รอบนี้ถามว่าเขาเป็นใครก่อนทุกครั้งนะครับ แล้วเปิดคู่มือเมื่อไม่แน่ใจ</DomeSay>
      </M3Stage>
    )
  }

  if (stage === 'practice') {
    return (
      <Shift
        key="practice"
        data={data}
        cases={practiceCases}
        practice
        hbSeconds={lv.handbookSeconds}
        hintsTotal={lv.hints}
        onCheck={onCheck}
        onExit={onExit}
        onComplete={async () => setStage('ready')}
      />
    )
  }

  return (
    <Shift
      key={`run-${run}`}
      data={data}
      cases={cases}
      hbSeconds={lv.handbookSeconds}
      hintsTotal={lv.hints}
      onCheck={onCheck}
      onStat={bump}
      onExit={onExit}
      onComplete={finishShift}
    />
  )
}

type Mood = 'neutral' | 'happy' | 'confused'

/** รายชื่อภาพลูกค้าที่จะลอง ตามอารมณ์ (ไม่มีไฟล์อารมณ์ก็ถอยไปภาพปกติ) */
function customerSrcs(index: number, mood: Mood): string[] {
  const base = `/learn/m3/customer-${(index % 4) + 1}`
  return mood === 'neutral' ? [`${base}.png`] : [`${base}-${mood}.png`, `${base}.png`]
}

function Customer({ index, mood, name, reduce }: { index: number; mood: Mood; name: string; reduce: boolean }) {
  const srcs = customerSrcs(index, mood)
  const [i, setI] = useState(0)
  return (
    <motion.img
      key={`${index}-${mood}`}
      src={srcs[i]}
      alt={`ลูกค้า ${name}`}
      draggable={false}
      onError={() => setI((n) => Math.min(n + 1, srcs.length - 1))}
      className="m3s-customer"
      initial={reduce ? false : { x: 80, opacity: 0 }}
      animate={mood === 'happy' && !reduce ? { x: 0, opacity: 1, y: [0, -14, 0] } : { x: 0, opacity: 1 }}
      transition={{ default: { type: 'spring', stiffness: 260, damping: 22 }, y: { duration: 0.7, ease: 'easeOut' } }}
    />
  )
}

function Shift({
  data,
  cases,
  practice = false,
  hbSeconds,
  hintsTotal,
  onCheck,
  onComplete,
  onStat,
  onExit,
}: {
  data: CounterData
  cases: ViewCase[]
  practice?: boolean
  onStat?: (k: 'handbook' | 'dome') => void
  hbSeconds: number
  hintsTotal: number
  onCheck?: CheckFn
  onExit?: () => void
  onComplete: (all: CounterDecision[]) => Promise<void>
}) {
  const { reduce, spring } = useGameMotion()
  const [caseIndex, setCaseIndex] = useState(0)
  const [page, setPage] = useState<Page>('arrive')
  const step: CounterStep = page === 'arrive' ? 'request' : page
  const [asked, setAsked] = useState<string[]>([])
  const [askMode, setAskMode] = useState<'chips' | 'type'>('chips')
  const [typed, setTyped] = useState('')
  const [miss, setMiss] = useState<string | null>(null)
  const [tags, setTags] = useState<Record<string, CounterCategory>>({})
  const [stamp, setStamp] = useState<CounterStampId | null>(null)
  const [extension, setExtension] = useState<string | null>(null)
  const [reason, setReason] = useState<number | null>(null)
  const [decisions, setDecisions] = useState<CounterDecision[]>([])
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [points, setPoints] = useState(0)
  const [wrongHint, setWrongHint] = useState<string[]>([])
  const [hintsLeft, setHintsLeft] = useState(hintsTotal)
  const [hintLog, setHintLog] = useState<string[]>([])
  const [sheet, setSheet] = useState<'book' | 'dome' | null>(null)
  const [stamping, setStamping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stampTimer = useRef<number | null>(null)
  const chatRef = useRef<HTMLUListElement | null>(null)

  const current = cases[caseIndex]
  const total = cases.length
  const isLast = caseIndex === total - 1
  const stampInfo = data.stamps.find((s) => s.id === stamp)
  const needsExt = stampInfo?.needsExtension ?? false
  const allTagged = current ? current.domains.every((d) => tags[d.name]) : false
  const canStamp = stamp != null && (!needsExt || extension != null) && reason != null

  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    const id = window.setTimeout(() => (el.scrollTop = el.scrollHeight), 750)
    return () => window.clearTimeout(id)
  }, [asked.length, miss])

  useEffect(
    () => () => {
      if (stampTimer.current) window.clearTimeout(stampTimer.current)
    },
    [],
  )

  // เลือกตรา/นามสกุลแล้ว เลื่อนขั้นถัดไป (นามสกุล เหตุผล) เข้ามาในจอ
  useEffect(() => {
    if (!stamp) return
    const id = window.setTimeout(() => {
      const subs = document.querySelectorAll('.m3s-stamp-panel .m3s-sub')
      const target = needsExt && !extension ? subs[0] : subs[subs.length - 1]
      target?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [stamp, extension, needsExt, reduce])

  const dd = useDragDrop({
    onDrop: (cat, zone) => {
      sfx('ok')
      setTags((t) => ({ ...t, [zone]: cat as CounterCategory }))
    },
  })

  function openSheet(kind: 'book' | 'dome') {
    sfx('tap')
    if (kind === 'book') onStat?.('handbook')
    setSheet(kind)
  }

  function resetCase() {
    setPage('arrive')
    setAsked([])
    setTyped('')
    setMiss(null)
    setTags({})
    setStamp(null)
    setExtension(null)
    setReason(null)
    setStamping(false)
    setAttempt(1)
    setFeedback(null)
    setWrongHint([])
  }

  function askDome() {
    if (hintsLeft <= 0) return
    onStat?.('dome')
    sfx('tap')
    const list = data.hints[step]
    const used = hintsTotal - hintsLeft
    const text = list[used % list.length]
    if (text) setHintLog((l) => [...l, text])
    setHintsLeft((n) => n - 1)
  }

  function ask(id: string) {
    sfx('tap')
    setMiss(null)
    setAsked((a) => (a.length < data.maxQuestions && !a.includes(id) ? [...a, id] : a))
  }

  function sendTyped() {
    if (!current || !typed.trim()) return
    const id = matchQuestion(
      typed,
      current.questions.filter((q) => !asked.includes(q.id)),
    )
    if (id) {
      ask(id)
      setTyped('')
    } else {
      sfx('bad')
      setMiss(typed.trim())
      setTyped('')
    }
  }

  async function complete(all: CounterDecision[]) {
    setBusy(true)
    setError(null)
    try {
      await onComplete(all)
    } catch {
      setError('ส่งผลยังไม่สำเร็จ ลองกดส่งอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  function advance(all: CounterDecision[]) {
    if (isLast) {
      void complete(all)
    } else {
      setCaseIndex((i) => i + 1)
      resetCase()
    }
  }

  function commit(decision: CounterDecision): CounterDecision[] {
    const all = [...decisions.filter((d) => d.caseId !== decision.caseId), decision]
    setDecisions(all)
    return all
  }

  async function afterStamp() {
    if (!current || !stamp || !canStamp) return
    const decision: CounterDecision = {
      caseId: current.id,
      tags,
      asked,
      stamp,
      extension: needsExt ? extension : null,
      attempt,
    }
    if (!onCheck) {
      advance(commit(decision))
      return
    }
    setBusy(true)
    setError(null)
    let r: CounterStepResult
    try {
      r = await onCheck(decision)
    } catch {
      setError('ตรวจยังไม่สำเร็จ ลองประทับอีกครั้ง')
      setStamping(false)
      setBusy(false)
      return
    }
    setBusy(false)
    if (!r.correct && attempt === 1) {
      sfx('bad')
      setWrongHint(r.wrongTags)
      setFeedback({ kind: 'retry', wrongTags: r.wrongTags, stampWrong: !r.stampCorrect })
      return
    }
    const earned = r.stampCorrect ? (attempt === 1 ? 2 : 1) : 0
    sfx(r.correct ? 'win' : 'bad')
    setPoints((p) => p + earned)
    commit(decision)
    setFeedback(r.correct ? { kind: 'right', points: earned } : { kind: 'explain', text: r.explanation, points: earned })
  }

  function retry() {
    setAttempt(2)
    setFeedback(null)
    setStamping(false)
    setPage(wrongHint.length > 0 ? 'tag' : 'stamp')
  }

  function pressStamp() {
    if (!canStamp || stamping || busy) return
    setError(null)
    setStamping(true)
    sfx('stamp')
    stampTimer.current = window.setTimeout(() => void afterStamp(), reduce ? 120 : 900)
  }

  if (!current) return null

  const spriteIdx = Math.max(0, data.cases.findIndex((c) => c.id === current.id))
  const locked = stamping || busy
  const reaction: Mood = feedback ? (feedback.kind === 'right' ? 'happy' : 'confused') : 'neutral'
  const left = data.maxQuestions - asked.length
  const exchanges = asked
    .map((qid) => current.questions.find((x) => x.id === qid))
    .filter((q): q is NonNullable<typeof q> => !!q)
  const catLabel = (id: CounterCategory) => data.categories.find((c) => c.id === id)?.label ?? id

  const say = feedback
    ? reaction === 'happy'
      ? 'ขอบคุณมากเลย ได้ชื่อเว็บแล้ว'
      : 'เอ๊ะ ไม่ใช่มั้ง ช่วยดูอีกทีนะ'
    : page === 'interview' && exchanges.length > 0
      ? null
      : current.greeting

  const primary: { label: string; onClick: () => void; disabled?: boolean; tone?: 'green' | 'gold' } =
    page === 'arrive'
      ? { label: 'ติดป้ายประเภท →', onClick: () => setPage('tag') }
      : page === 'tag'
        ? { label: allTagged ? (attempt === 2 ? 'ไปตัดสินใหม่ →' : 'เริ่มสัมภาษณ์ →') : `ลากป้ายให้ครบ ${current.domains.length} ชื่อ`, onClick: () => setPage(attempt === 2 ? 'stamp' : 'interview'), disabled: !allTagged }
        : page === 'interview'
          ? { label: asked.length === 0 ? 'ถามอย่างน้อย 1 ข้อ' : 'ไปตัดสิน →', onClick: () => setPage('stamp'), disabled: asked.length === 0 }
          : {
              label: !stamp ? 'เลือกตรา 1 อัน' : needsExt && !extension ? 'เลือกนามสกุลที่เสนอ' : reason == null ? 'เลือกเหตุผล' : 'ประทับตรา',
              onClick: pressStamp,
              disabled: !canStamp || stamping,
              tone: 'gold',
            }

  return (
    <M3Stage
      bg="counter"
      onBack={onExit}
      pill={`${practice ? 'โหมดซ้อม · ' : ''}ลูกค้า ${caseIndex + 1}/${total} · ${feedback ? 'ผลการตัดสิน' : STEP_LABEL[step]}`}
      label={data.title}
      className={cn('m3s-shift', `is-${feedback ? 'result' : page}`)}
      dock={
        feedback ? (
          feedback.kind === 'retry' ? (
            <div className="m3s-row">
              <Cta tone="cream" className="m3s-cta--narrow" onClick={() => openSheet('book')}>
                คู่มือ
              </Cta>
              <Cta tone="orange" onClick={retry}>
                ตัดสินใหม่ →
              </Cta>
            </div>
          ) : (
            <Cta busy={busy} onClick={() => advance(decisions)}>
              {isLast ? (practice ? 'จบการซ้อม →' : error ? 'ส่งอีกครั้ง' : 'ส่งผลทั้งกะ →') : 'ลูกค้าคนต่อไป →'}
            </Cta>
          )
        ) : (
          <div className="m3s-tools">
            <button type="button" className="m3s-tool-btn" onClick={() => openSheet('book')} disabled={locked} aria-label="เปิดคู่มือเจ้าหน้าที่">
              {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน */}
              <img src={M3_ASSET.icon('books')} alt="" />
              <span>คู่มือ</span>
            </button>
            <Cta tone={primary.tone ?? 'green'} onClick={primary.onClick} disabled={primary.disabled || locked} busy={busy && page === 'stamp'}>
              {primary.label}
            </Cta>
            <button type="button" className="m3s-tool-btn" onClick={() => openSheet('dome')} disabled={locked} aria-label={`ถามโดม เหลือ ${hintsLeft} ครั้ง`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ภาพโดม */}
              <img src={M3_ASSET.dome} alt="" />
              <span>ถามโดม</span>
              <i className="m3s-badge">{hintsLeft}</i>
            </button>
          </div>
        )
      }
    >
      <div className="m3s-hud">
        <span className="m3s-queue" aria-label={`ลูกค้าคนที่ ${caseIndex + 1} จาก ${total}`}>
          {cases.map((c, i) => (
            <i key={c.id} className={cn(i < caseIndex && 'is-done', i === caseIndex && 'is-on')} />
          ))}
        </span>
        <span className="m3s-hud-chip">
          {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน */}
          <img src={M3_ASSET.icon('star')} alt="" /> <CountUp to={points} duration={0.6} /> แต้ม
        </span>
      </div>

      <div className="m3s-scene">
        <Customer index={spriteIdx} mood={reaction} name={current.name} reduce={reduce} />
        <AnimatePresence mode="wait">
          {say ? (
            <motion.p
              key={say}
              className="m3s-speech"
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={spring}
            >
              {say}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <span className="m3s-nameplate">
          {current.name}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={feedback ? `fb-${feedback.kind}` : page}
          initial={reduce ? false : { y: 28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? undefined : { y: -12, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.24 }}
        >
          {feedback ? (
            <Panel
              className={cn('m3s-result', feedback.kind === 'right' ? 'is-good' : 'is-warn')}
              kicker={feedback.kind === 'retry' ? `ลองได้อีก 1 ครั้ง` : 'ผลการตัดสิน'}
              title={
                feedback.kind === 'right'
                  ? feedback.points === 2
                    ? 'ถูกต้อง ได้ 2 แต้ม'
                    : 'ถูกแล้ว ได้ 1 แต้มจากการแก้'
                  : feedback.kind === 'retry'
                    ? 'ยังไม่ตรงนะ ลองตัดสินใหม่'
                    : `ยังไม่ตรง ได้ ${feedback.points} แต้ม`
              }
              aside={<span className={cn('m3s-result-badge', feedback.kind === 'right' ? 'is-good' : 'is-warn')}>{feedback.kind === 'right' ? '✓' : '!'}</span>}
            >
              <RequestPaper c={current} tags={tags} catLabel={catLabel} ink={stampInfo && feedback.kind !== 'retry' ? { label: stampInfo.label, id: stampInfo.id, ext: needsExt ? extension : null } : null} reduce={reduce} compact />
              {feedback.kind === 'retry' ? (
                <p className="m3s-note m3s-note--warn">
                  {feedback.wrongTags.length > 0
                    ? `ป้ายประเภทยังไม่ตรง ${feedback.wrongTags.length} ใบ กดตัดสินใหม่เพื่อแก้ป้ายก่อน`
                    : 'ป้ายถูกแล้ว ลองดูคำตอบลูกค้าแล้วเลือกตราหรือนามสกุลใหม่'}
                </p>
              ) : null}
              {feedback.kind === 'explain' && feedback.text ? <p className="m3s-note">{feedback.text}</p> : null}
              {error ? (
                <p role="alert" className="m3s-note m3s-note--warn">
                  {error}
                </p>
              ) : null}
              <DomeSay live>
                {feedback.kind === 'right'
                  ? 'ตัดสินได้ดีมาก ถามแล้วเทียบกับคู่มือ แบบนี้แหละเจ้าหน้าที่ตัวจริง'
                  : feedback.kind === 'retry'
                    ? 'ลองดูคำตอบของลูกค้าอีกที เขามีเอกสารอะไร แล้วเปิดคู่มือชั้นที่เกี่ยวข้อง'
                    : 'ไม่เป็นไร อ่านเหตุผลแล้วลองกับลูกค้าคนต่อไปนะ'}
              </DomeSay>
            </Panel>
          ) : page === 'arrive' ? (
            <Panel kicker={`ใบคำขอ · ลูกค้าคนที่ ${caseIndex + 1}`}>
              <RequestPaper c={current} tags={tags} catLabel={catLabel} reduce={reduce} full />
              <DomeSay>อ่านใบคำขอให้ครบ ดูว่าท้ายชื่อเป็นนามสกุลชั้นไหน แล้วไปติดป้ายประเภท</DomeSay>
            </Panel>
          ) : page === 'tag' ? (
            <Panel kicker="ลากป้ายประเภทไปวางบนชื่อโดเมน · หรือแตะป้ายแล้วแตะชื่อ">
              <ul className="m3s-tag-rows">
                {current.domains.map((d) => {
                  const z = dd.zoneProps(d.name)
                  const on = tags[d.name]
                  return (
                    <li key={d.name} {...z} role="button" aria-label={`ติดป้ายให้ ${d.label}`} className={cn(z.className, 'm3s-tag-row', on && 'is-filled', attempt === 2 && wrongHint.includes(d.name) && 'is-wrong')}>
                      <span className="m3s-domain" dir="auto">
                        {d.label}
                        <small>{d.role}</small>
                      </span>
                      <span className={cn('m3s-slot', on && `cat-${data.categories.findIndex((c) => c.id === on)}`)}>{on ? catLabel(on) : 'วางป้ายที่นี่'}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="m3s-tray m3s-tray--cats" aria-label="ป้ายประเภท">
                {data.categories.map((c, i) => {
                  const p = dd.itemProps(c.id)
                  return (
                    <button key={c.id} type="button" {...p} className={cn('m3s-cat', `cat-${i}`, p.className)} aria-label={`ป้าย ${c.label} ${c.short}`}>
                      <b>{c.label}</b>
                      <small>{c.short}</small>
                    </button>
                  )
                })}
              </div>
              {attempt === 2 && wrongHint.length > 0 ? <p className="m3s-note m3s-note--warn">ชื่อที่ขอบสีส้มยังติดป้ายไม่ตรง ลองวางใหม่</p> : null}
            </Panel>
          ) : page === 'interview' ? (
            <Panel
              className="m3s-interview"
              kicker="สัมภาษณ์ลูกค้า"
              aside={
                <span className="m3s-asks" aria-label={`ถามได้อีก ${left} ข้อ`}>
                  ถามได้อีก {left}
                  {Array.from({ length: data.maxQuestions }, (_, i) => (
                    <i key={i} className={cn(i < asked.length && 'is-used')} />
                  ))}
                </span>
              }
            >
              <ul className="m3s-chat-log m3s-chat-log--shift" ref={chatRef} aria-live="polite">
                {exchanges.length === 0 && !miss ? <li className="m3s-empty">เลือกคำถามที่ช่วยบอกว่าเขาเป็นใคร</li> : null}
                {exchanges.map((q) => (
                  <li key={q.id} className="m3s-pair">
                    <p className="m3s-say m3s-say--me">{q.text}</p>
                    <Reply text={q.reply} />
                  </li>
                ))}
                {miss ? (
                  <li className="m3s-pair">
                    <p className="m3s-say m3s-say--me">{miss}</p>
                    <p className="m3s-say m3s-say--them">ขอโทษนะ ไม่แน่ใจว่าถามเรื่องอะไร ลองถามใหม่ได้ไหม</p>
                  </li>
                ) : null}
              </ul>
              <div className="m3s-tabs" role="tablist" aria-label="วิธีถาม">
                <button type="button" role="tab" aria-selected={askMode === 'chips'} className={cn(askMode === 'chips' && 'is-on')} onClick={() => setAskMode('chips')}>
                  เลือกคำถาม
                </button>
                <button type="button" role="tab" aria-selected={askMode === 'type'} className={cn(askMode === 'type' && 'is-on')} onClick={() => setAskMode('type')}>
                  พิมพ์เอง
                </button>
              </div>
              {left <= 0 ? (
                <p className="m3s-note m3s-note--ok">ถามครบ {data.maxQuestions} ข้อแล้ว กดไปตัดสินได้เลย</p>
              ) : askMode === 'chips' ? (
                <div className="m3s-qlist">
                  {current.questions
                    .filter((q) => !asked.includes(q.id))
                    .map((q) => (
                      <button key={q.id} type="button" className="m3s-qchip" onClick={() => ask(q.id)}>
                        {q.text}
                        <span aria-hidden>›</span>
                      </button>
                    ))}
                </div>
              ) : (
                <form
                  className="m3s-typebox"
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendTyped()
                  }}
                >
                  <input aria-label="พิมพ์คำถามถึงลูกค้า" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="เช่น จดทะเบียนบริษัทหรือยัง" />
                  <button type="submit" disabled={!typed.trim()}>
                    ส่ง
                  </button>
                </form>
              )}
            </Panel>
          ) : (
            <Panel kicker={attempt === 2 ? 'ตัดสินใหม่ · ครั้งสุดท้าย' : 'เลือกตรา 1 อัน'} className="m3s-stamp-panel">
              <RequestPaper
                c={current}
                tags={tags}
                catLabel={catLabel}
                reduce={reduce}
                compact
                ink={stamping && stampInfo ? { label: stampInfo.label, id: stampInfo.id, ext: needsExt ? extension : null } : null}
              />
              <div className="m3s-stamps" role="radiogroup" aria-label="ตราประทับ">
                {data.stamps.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={stamp === s.id}
                    disabled={locked}
                    className={cn('m3s-stampbtn', `m3s-stamp--${s.id}`, stamp === s.id && 'is-on')}
                    onClick={() => {
                      sfx('tap')
                      setStamp(s.id)
                      if (!s.needsExtension) setExtension(null)
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน */}
                    <img src={M3_ASSET.icon(STAMP_ICON[s.id])} alt="" />
                    <b>{s.label}</b>
                    <small>{s.hint}</small>
                  </button>
                ))}
              </div>
              {needsExt ? (
                <div className="m3s-sub">
                  <p className="m3s-sub-title">{stamp === 'first-step' ? 'ให้จดนามสกุลไหนก่อน' : 'เสนอนามสกุลไหน'}</p>
                  <div className="m3s-ext-row">
                    {current.extensionOptions.map((ext) => (
                      <button
                        key={ext}
                        type="button"
                        aria-pressed={extension === ext}
                        disabled={locked}
                        className={cn('m3s-ext', extension === ext && 'is-on')}
                        onClick={() => {
                          sfx('tap')
                          setExtension(ext)
                        }}
                      >
                        {ext}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {stamp ? (
                <div className="m3s-sub">
                  <p className="m3s-sub-title">เหตุผลที่บอกลูกค้า</p>
                  <div className="m3s-reasons" role="radiogroup" aria-label="เหตุผล">
                    {REASONS.map((r, i) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={reason === i}
                        disabled={locked}
                        className={cn('m3s-reason', reason === i && 'is-on')}
                        onClick={() => {
                          sfx('tap')
                          setReason(i)
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="m3s-note m3s-note--warn">
                  {error}
                </p>
              ) : null}
            </Panel>
          )}
        </motion.div>
      </AnimatePresence>

      <Sheet open={sheet === 'book'} onClose={() => setSheet(null)} seconds={hbSeconds} title="คู่มือเจ้าหน้าที่">
        <div className="m3s-book">
          {data.handbook.map((f, i) => (
            <section key={f.category} className={cn('m3s-book-floor', `tone-${['orange', 'teal', 'purple'][i] ?? 'orange'}`)}>
              <h3>
                {f.floor} · {catLabel(f.category)}
              </h3>
              <ul>
                {f.rows.map((r) => (
                  <li key={r.suffix}>
                    <b dir="auto">{r.suffix}</b>
                    <span>{r.who}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'dome'} onClose={() => setSheet(null)} title="โต๊ะโดม · ขอคำใบ้">
        <DomeSay live>
          {hintLog.length === 0
            ? `ติดตรงไหนบอกได้นะครับ ขอใบ้ได้ ${hintsTotal} ครั้งต่อกะ โดมจะถามชวนคิด ไม่บอกคำตอบ`
            : hintLog[hintLog.length - 1]}
        </DomeSay>
        <Cta tone="purple" onClick={askDome} disabled={hintsLeft <= 0}>
          {hintsLeft > 0 ? `ขอใบ้เรื่อง${STEP_LABEL[step]} (เหลือ ${hintsLeft})` : 'ใช้คำใบ้ครบแล้ว'}
        </Cta>
      </Sheet>
    </M3Stage>
  )
}

/** แผ่นเลื่อนขึ้นจากด้านล่าง (S12 คู่มือ / G05 โต๊ะโดม) มีแถบนับถอยหลังเมื่อกำหนด seconds */
function Sheet({
  open,
  onClose,
  title,
  seconds,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  seconds?: number
  children: React.ReactNode
}) {
  const { reduce } = useGameMotion()
  const [left, setLeft] = useState(seconds ?? 0)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    if (!open || !seconds) return
    setLeft(seconds)
    let n = seconds
    const id = window.setInterval(() => {
      n -= 1
      setLeft(Math.max(0, n))
      if (n <= 0) {
        window.clearInterval(id)
        closeRef.current()
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [open, seconds])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="m3s-sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="m3s-sheet-backdrop" aria-label="ปิด" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="m3s-sheet"
            initial={reduce ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduce ? undefined : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <span className="m3s-grab" aria-hidden />
            <div className="m3s-sheet-head">
              <h2>{title}</h2>
              {seconds ? (
                <span className="m3s-timer" role="timer" aria-label={`ปิดเองใน ${left} วินาที`}>
                  <i style={{ width: `${(left / seconds) * 100}%` }} />
                  <b>{left} วินาที</b>
                </span>
              ) : null}
            </div>
            <div className="m3s-sheet-body">{children}</div>
            <Cta tone="cream" onClick={onClose}>
              หันกลับเคาน์เตอร์
            </Cta>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** ใบคำขอแบบกระดาษ พร้อมช่องประทับตรา */
function RequestPaper({
  c,
  tags,
  catLabel,
  reduce,
  ink,
  compact,
  full,
}: {
  c: ViewCase
  tags: Record<string, CounterCategory>
  catLabel: (id: CounterCategory) => string
  reduce: boolean
  ink?: { label: string; id: CounterStampId; ext: string | null } | null
  compact?: boolean
  full?: boolean
}) {
  return (
    <motion.div
      className={cn('m3s-paper', compact && 'is-compact')}
      initial={reduce || !full ? false : { y: 60, scale: 0.8, rotate: -4, opacity: 0 }}
      animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      <p className="m3s-paper-head">ใบคำขอจดโดเมน</p>
      {full ? <p className="m3s-paper-biz">{c.business}</p> : null}
      <ul>
        {c.domains.map((d) => (
          <li key={d.name}>
            <b dir="auto">{d.label}</b>
            {!compact ? <small>{d.role}</small> : null}
            {tags[d.name] ? <em>{catLabel(tags[d.name]!)}</em> : null}
          </li>
        ))}
      </ul>
      {compact ? (
        <div className="m3s-paper-stamp">
          <AnimatePresence>
            {ink ? (
              <motion.span
                className={cn('m3s-ink', `m3s-ink--${ink.id}`)}
                initial={reduce ? false : { scale: 2.6, opacity: 0, rotate: -26, y: -40 }}
                animate={{ scale: 1, opacity: 0.94, rotate: -6, y: 0 }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
                aria-hidden="true"
              >
                {ink.label}
                {ink.ext ? ` ${ink.ext}` : ''}
              </motion.span>
            ) : (
              <span key="ph">ช่องประทับตรา</span>
            )}
          </AnimatePresence>
        </div>
      ) : null}
    </motion.div>
  )
}

/** คำตอบลูกค้า: จุดสามจุดก่อน แล้วข้อความค่อยขึ้น */
function Reply({ text }: { text: string }) {
  const { reduce, spring } = useGameMotion()
  const [ready, setReady] = useState(reduce)
  useEffect(() => {
    if (reduce) return
    const id = window.setTimeout(() => setReady(true), 650)
    return () => window.clearTimeout(id)
  }, [reduce])
  return (
    <motion.p
      className="m3s-say m3s-say--them"
      initial={reduce ? false : { x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={spring}
    >
      {ready || reduce ? (
        text
      ) : (
        <span className="m3s-typing" role="status" aria-label="ลูกค้ากำลังพิมพ์">
          <i />
          <i />
          <i />
        </span>
      )}
    </motion.p>
  )
}

function ResultView({
  data,
  result,
  stats,
  selfCard,
  rounds,
  onRetry,
  onRemedial,
  onFinish,
  onExit,
}: {
  data: CounterData
  result: SubmitResult
  stats: { handbook: number; dome: number }
  selfCard: { extension: string; reason: string } | null
  rounds: number
  onRetry: () => void
  onRemedial: () => void
  onFinish: () => void
  onExit?: () => void
}) {
  const { reduce } = useGameMotion()
  const [open, setOpen] = useState<string | null>(null)
  const detail = isDetail(result.detail) ? result.detail : null
  const byId = new Map<string, CounterCaseResult>((detail?.cases ?? []).map((c) => [c.caseId, c]))
  const perfect = !!detail && detail.stampPoints === detail.stampMax && detail.tagAccuracy === 1
  const stars = result.passed ? (perfect ? 3 : rounds > 0 ? 1 : 2) : result.score > 0 ? 1 : 0
  const groupLabel = (id: string) => data.categories.find((c) => c.id === id)?.label ?? id
  const ok = (id: string) => {
    const r = byId.get(id)
    return !!r && r.stampCorrect && r.tagsCorrect === r.tagsTotal
  }
  const happyCount = data.cases.filter((c) => ok(c.id)).length
  const keyPct = detail && detail.cases.length > 0 ? Math.round((detail.cases.filter((c) => c.askedKeyQuestion).length / detail.cases.length) * 100) : 0
  const weak = pickWeak(detail?.groups)

  useEffect(() => {
    sfx(result.passed ? 'win' : 'bad')
  }, [result.passed])

  return (
    <M3Stage
      pill={result.passed ? 'รายงานปิดกะ · ผ่าน' : 'รายงานปิดกะ · เกือบแล้ว'}
      onBack={onExit}
      label="รายงานปิดกะ"
      dock={
        result.passed ? (
          <div className="m3s-stack">
            <Cta onClick={onFinish}>ไปภารกิจที่ 4 →</Cta>
            {weak.length > 0 ? (
              <Cta tone="cream" onClick={onRemedial}>
                ฝึกหมวดที่พลาด 30 วินาที
              </Cta>
            ) : null}
          </div>
        ) : (
          <div className="m3s-stack">
            <Cta tone="gold" onClick={onRemedial}>
              เริ่มฝึก 30 วินาที →
            </Cta>
            <Cta tone="cream" onClick={onRetry}>
              เข้ากะใหม่เลย
            </Cta>
          </div>
        )
      }
    >
      <Panel className={cn('m3s-report', result.passed ? 'is-pass' : 'is-retry')} kicker="รายงานปิดกะ" aside={<span className="m3s-score"><CountUp to={result.score} /> คะแนน</span>}>
        <div className="m3s-report-top">
          <Stars count={stars} size={40} />
          <h2 className="m3s-title">{result.passed ? 'เก่งมากเจ้าหน้าที่' : 'เกือบแล้ว ฝึกอีกนิด'}</h2>
        </div>
        <ul className="m3s-metrics" aria-label="สรุปผลกะ">
          {[
            { k: 'ลูกค้าพอใจ', v: `${happyCount}/${data.cases.length}`, icon: 'feel-smile' },
            { k: 'ถามตรงจุด', v: `${keyPct}%`, icon: 'bullseye' },
            { k: 'ใช้คู่มือ', v: `${stats.handbook} ครั้ง`, icon: 'books' },
            { k: 'ถามโดม', v: `${stats.dome} ครั้ง`, icon: 'speech-balloon' },
          ].map((m) => (
            <li key={m.k}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน */}
              <img src={M3_ASSET.icon(m.icon)} alt="" />
              <span>{m.k}</span>
              <b>{m.v}</b>
            </li>
          ))}
        </ul>
        {detail ? (
          <ul className="m3s-groups" aria-label="ผลแยกตามหมวด">
            {detail.groups.map((g) => {
              const frac = g.total > 0 ? g.correct / g.total : 0
              return (
                <li key={g.category}>
                  <span>{groupLabel(g.category)}</span>
                  <i aria-hidden>
                    <motion.b
                      className={frac >= 0.8 ? 'is-good' : 'is-warn'}
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${frac * 100}%` }}
                      transition={reduce ? { duration: 0 } : { duration: 0.8, delay: 0.3 }}
                    />
                  </i>
                  <em>
                    {g.correct}/{g.total}
                  </em>
                </li>
              )
            })}
          </ul>
        ) : null}
        {weak.length > 0 ? (
          <p className="m3s-weak">
            หมวดที่พลาด
            {weak.map((w) => (
              <span key={w}>{groupLabel(w)}</span>
            ))}
          </p>
        ) : null}
        {selfCard ? (
          <div className="m3s-mycard">
            <small>บัตรนามสกุลของฉัน</small>
            <b>{selfCard.extension}</b>
            <span>{selfCard.reason}</span>
          </div>
        ) : null}
      </Panel>
      <Panel kicker="ดูรายลูกค้า">
        <ul className="m3s-cases">
          {data.cases.map((c) => {
            const r = byId.get(c.id)
            const good = ok(c.id)
            return (
              <li key={c.id} className={cn(good ? 'is-good' : 'is-warn')}>
                <button type="button" aria-expanded={open === c.id} onClick={() => setOpen((o) => (o === c.id ? null : c.id))}>
                  <i>{good ? '✓' : '!'}</i>
                  <b>{c.name}</b>
                  <small>{r ? `${r.points} แต้ม · ป้าย ${r.tagsCorrect}/${r.tagsTotal}` : ''}</small>
                </button>
                {open === c.id && r ? <p>{r.explanation}</p> : null}
              </li>
            )
          })}
        </ul>
      </Panel>
      <DomeSay>
        {result.passed
          ? 'เก่งมากเจ้าหน้าที่ ด่านต่อไปเราจะไปจดชื่อเว็บจริงกัน'
          : `เกือบแล้ว มาฝึก${weak.length ? `หมวด${groupLabel(weak[0]!)}` : 'คัดแยก'}อีกนิด แล้วเข้ากะใหม่นะครับ`}
      </DomeSay>
    </M3Stage>
  )
}

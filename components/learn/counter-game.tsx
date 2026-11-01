'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertIcon, DomeAvatar, RefreshIcon, cn } from '@/components/ui'
import { ConveyorDrill, type DrillItem } from './game-ui/conveyor-drill'
import {
  CountUp,
  GameButton,
  HudPill,
  PixelPanel,
  SceneBg,
  Sprite,
  Stars,
  buzz,
  useGameMotion,
} from './game-ui'
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
  type CounterTone,
} from './counter-types'

export type { CounterData, CounterLevel } from './counter-types'

/**
 * เกมลงมือทำ ด่าน 3 — Pixel Counter (เคาน์เตอร์รับจดโดเมน)
 *
 * ลูกค้าทีละคน: ใบคำขอ → สัมภาษณ์ (ไม่เกิน 3 คำถาม) → ติดป้ายประเภท → ประทับตรา + นามสกุลที่เสนอ
 * หันซ้าย = คู่มือ (นับถอยหลัง) · หันขวา = โต๊ะโดม (ใบ้)
 * ⚠️ ไม่มีเฉลยในไฟล์นี้ ทุกการตัดสินส่งครั้งเดียวตอนจบกะผ่าน `onSubmit` (framework เป็นคน POST)
 * ⚠️ ข้อความทั้งหมดมาจาก content/learn-counter.json ผ่าน props
 */

type SubmitResult = { score: number; passed: boolean; detail: unknown }
type View = 'left' | 'center' | 'right'

const STEP_LABEL: Record<CounterStep, string> = {
  request: 'อ่านใบคำขอ',
  interview: 'สัมภาษณ์',
  tag: 'ติดป้ายประเภท',
  stamp: 'ประทับตรา',
}

const TONE_FILL: Record<CounterTone, { head: string; body: string }> = {
  brand: { head: 'fill-brand-100', body: 'fill-brand-300' },
  quest: { head: 'fill-quest-100', body: 'fill-quest-300' },
  spark: { head: 'fill-spark-100', body: 'fill-spark-300' },
  reward: { head: 'fill-reward-100', body: 'fill-reward-300' },
}

/** ความสูงลูกค้าในฉาก (สัดส่วนของฉากที่ยืดเต็ม) แยกตามหน้า */
const SCENE_SPRITE_H: Record<'queue' | 'card' | 'interview' | 'tag' | 'stamp', string> = {
  queue: '72%',
  card: '74%',
  interview: '86%',
  tag: '72%',
  stamp: '72%',
}

const BG_FALLBACK = 'bg-gradient-to-b from-[#fff8e6] via-[#f1e2c3] to-[#c98948]'
const STAMP_TONE: Record<CounterStampId, string> = {
  approve: 'border-quest-700 text-quest-700',
  suggest: 'border-brand-700 text-brand-700',
  'first-step': 'border-spark-700 text-spark-800',
  reject: 'border-[#8a3b3b] text-[#8a3b3b]',
}

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

/** ลูกค้าคนสุดท้ายเป็นร้านของผู้เล่นเอง (เปลี่ยนเฉพาะข้อความที่แสดง ชื่อโดเมนจริงที่ส่งตรวจยังเป็นชื่อเดิม) */
function toView(c: CounterCase, mine?: { shopName?: string; business?: string }): ViewCase {
  const shop = mine?.shopName?.trim()
  const slug = shop && /^[a-z0-9-]{1,40}$/i.test(shop) ? shop.toLowerCase() : null
  return {
    ...c,
    name: shop || c.name,
    business: mine?.business?.trim() || c.business,
    greeting: shop ? `สวัสดีค่ะ ร้าน${shop} อยากได้ชื่อเว็บของร้านตัวเองค่ะ` : c.greeting,
    domains: c.domains.map((d) => ({ ...d, label: slug ? d.name.replace('myshop', slug) : d.name })),
  }
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

type Page = 'queue' | 'card' | 'interview' | 'tag' | 'stamp'
type Stage = 'play' | 'report' | 'drill' | 'practice' | 'ready'

export function CounterGame({
  data,
  onSubmit,
  onCheck,
  level,
  shopName,
  business,
}: {
  data: CounterData
  onSubmit: (payload: unknown) => Promise<SubmitResult>
  /** ตรวจทีละลูกค้า (action: 'step') ถ้าไม่ส่งมา เกมจะไม่มีรอบลองแก้ */
  onCheck?: (decision: CounterDecision) => Promise<CounterStepResult>
  /** ระดับตามคะแนนวอร์มอัพ ไม่ส่ง = ใช้ค่าในเนื้อหา */
  level?: CounterLevel
  /** ร้านของผู้เล่น ใช้กับลูกค้าคนสุดท้าย ไม่ส่ง = ใช้ร้านตัวอย่าง */
  shopName?: string
  business?: string
}) {
  const [stage, setStage] = useState<Stage>('play')
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [drillItems, setDrillItems] = useState<DrillItem[]>([])
  const [practiceCases, setPracticeCases] = useState<ViewCase[]>([])
  const [stats, setStats] = useState({ handbook: 0, dome: 0 })
  const bump = (k: 'handbook' | 'dome') => setStats((x) => ({ ...x, [k]: x[k] + 1 }))

  const cases = useMemo(
    () => data.cases.map((c, i) => (i === data.cases.length - 1 ? toView(c, { shopName, business }) : toView(c))),
    [data.cases, shopName, business],
  )
  const lv = level ? COUNTER_LEVELS[level] : { handbookSeconds: data.handbookSeconds, hints: data.hintsPerShift }
  const detail = result && isDetail(result.detail) ? result.detail : null

  async function finishShift(all: CounterDecision[]) {
    const r = await onSubmit({ decisions: all })
    setResult(r)
    setStage('report')
  }

  function startRemedial() {
    const byId = new Map((detail?.cases ?? []).map((c) => [c.caseId, c]))
    const missed = cases.filter((c) => {
      const r = byId.get(c.id)
      return r && !(r.stampCorrect && r.tagsCorrect === r.tagsTotal)
    })
    setPracticeCases(missed.slice(0, 2))
    const weak = pickWeak(detail?.groups)
    if (weak.length > 0) {
      setDrillItems(buildDrill(data, weak))
      setStage('drill')
    } else if (missed.length > 0) {
      setStage('practice')
    } else {
      setStage('ready')
    }
  }

  function newShift() {
    setResult(null)
    setStats({ handbook: 0, dome: 0 })
    setRun((n) => n + 1)
    setStage('play')
  }

  const frame = 'counter-game-shell relative h-full min-h-[32rem] w-full flex-1 overflow-hidden bg-[#f3e4c4] text-[#3a2a18]'

  if (stage === 'report' && result) {
    return (
      <ResultView
        data={data}
        result={result}
        stats={stats}
        onRemedial={startRemedial}
        onRetry={newShift}
      />
    )
  }

  if (stage === 'drill') {
    return (
      <div className={cn(frame, 'flex flex-col')}>
        <SceneBg src="/learn/m3/bg-pixel-office.webp" fallback={BG_FALLBACK} blur={8} dim={0.12} />
        {/* flex-1 แทน h-full: พ่อมีแค่ min-h ทำให้ h-full ยุบ สายพานเลยแบนจนมองไม่เห็นชิ้นงาน */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <ConveyorDrill
            items={drillItems}
            bins={data.categories.map((c) => ({ id: c.id, label: c.label }))}
            title="ฝึกคัดแยก"
            onDone={() => setStage(practiceCases.length > 0 ? 'practice' : 'ready')}
          />
        </div>
      </div>
    )
  }

  if (stage === 'ready') {
    return (
      <div className={cn(frame, 'flex flex-col')}>
        <SceneBg src="/learn/m3/bg-pixel-office.webp" fallback={BG_FALLBACK} blur={8} dim={0.12} />
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-5 text-center">
          <DomeAvatar mood="cheer" size={110} decorative sparkle />
          <PixelPanel>
            <p className="text-title-sm font-extrabold">ซ้อมเสร็จแล้ว</p>
            <p className="mt-1 text-body">พร้อมเข้ากะใหม่ ลูกค้าชุดเดิมแต่คุณรู้มากขึ้นแล้ว</p>
          </PixelPanel>
          <GameButton variant="gold" className="w-full" onClick={newShift}>
            เข้ากะใหม่
          </GameButton>
        </div>
      </div>
    )
  }

  if (stage === 'practice') {
    return (
      <Shift
        key="practice"
        data={data}
        cases={practiceCases}
        practice
        level={level}
        hbSeconds={lv.handbookSeconds}
        hintsTotal={lv.hints}
        onCheck={onCheck}
        onComplete={async () => setStage('ready')}
      />
    )
  }

  return (
    <Shift
      key={`run-${run}`}
      data={data}
      cases={cases}
      level={level}
      hbSeconds={lv.handbookSeconds}
      hintsTotal={lv.hints}
      onCheck={onCheck}
      onStat={bump}
      onComplete={finishShift}
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
}: {
  data: CounterData
  cases: ViewCase[]
  practice?: boolean
  onStat?: (k: 'handbook' | 'dome') => void
  level?: CounterLevel
  hbSeconds: number
  hintsTotal: number
  onCheck?: CheckFn
  onComplete: (all: CounterDecision[]) => Promise<void>
}) {
  const { reduce, spring, slide } = useGameMotion()
  const [caseIndex, setCaseIndex] = useState(0)
  const [page, setPage] = useState<Page>('queue')
  const step: CounterStep = page === 'queue' || page === 'card' ? 'request' : page
  const [asked, setAsked] = useState<string[]>([])
  const [tags, setTags] = useState<Record<string, CounterCategory>>({})
  const [stamp, setStamp] = useState<CounterStampId | null>(null)
  const [extension, setExtension] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<CounterDecision[]>([])
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [points, setPoints] = useState(0)
  const [wrongHint, setWrongHint] = useState<string[]>([])
  const [hintsLeft, setHintsLeft] = useState(hintsTotal)
  const [hintLog, setHintLog] = useState<string[]>([])
  const [view, setView] = useState<View>('center')
  const [handbookLeft, setHandbookLeft] = useState(hbSeconds)
  const [hbPage, setHbPage] = useState(0)
  const hbSpreads = data.handbook.flatMap((floor, cat) =>
    floor.rows.map((r) => ({
      cat: cat % 3,
      category: floor.category,
      floor: floor.floor,
      suffixes: r.suffix.split(/\s+/).filter(Boolean),
      who: r.who,
    })),
  )
  const hbSpread = hbSpreads[hbPage]
  const [stamping, setStamping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stampTimer = useRef<number | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)

  // ถามเพิ่มแล้วเลื่อนบทสนทนาลงล่างสุด (รอคำตอบพิมพ์เสร็จด้วย)
  useEffect(() => {
    const el = chatRef.current
    if (!el || asked.length === 0) return
    el.scrollTop = el.scrollHeight
    const id = window.setTimeout(() => {
      el.scrollTop = el.scrollHeight
    }, 750)
    return () => window.clearTimeout(id)
  }, [asked.length])

  const current = cases[caseIndex]
  const total = cases.length
  const isLast = caseIndex === total - 1
  const stampInfo = data.stamps.find((s) => s.id === stamp)
  const needsExt = stampInfo?.needsExtension ?? false
  const allTagged = current ? current.domains.every((d) => tags[d.name]) : false
  const canStamp = stamp != null && (!needsExt || extension != null)

  useEffect(
    () => () => {
      if (stampTimer.current) window.clearTimeout(stampTimer.current)
    },
    [],
  )

  // นับถอยหลังคู่มือ แล้วหันกลับเคาน์เตอร์เอง
  useEffect(() => {
    if (view !== 'left') return
    let left = hbSeconds
    const id = window.setInterval(() => {
      left -= 1
      setHandbookLeft(Math.max(0, left))
      if (left <= 0) {
        window.clearInterval(id)
        setView('center')
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [view, hbSeconds])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setView('center')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function openHandbook() {
    onStat?.('handbook')
    setHandbookLeft(hbSeconds)
    setView('left')
  }

  function resetCase() {
    setPage('queue')
    setAsked([])
    setTags({})
    setStamp(null)
    setExtension(null)
    setStamping(false)
    setAttempt(1)
    setFeedback(null)
    setWrongHint([])
  }

  function askDome() {
    if (hintsLeft <= 0) return
    onStat?.('dome')
    const list = data.hints[step]
    const used = hintsTotal - hintsLeft
    const text = list[used % list.length]
    if (text) setHintLog((l) => [...l, text])
    setHintsLeft((n) => n - 1)
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

  /** ตราลงกระดาษแล้ว: ถามเซิร์ฟเวอร์ว่าถูกไหม (ถ้ามี) แล้วค่อยเก็บการตัดสิน */
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
      setWrongHint(r.wrongTags)
      setFeedback({ kind: 'retry', wrongTags: r.wrongTags, stampWrong: !r.stampCorrect })
      return
    }
    const earned = r.stampCorrect ? (attempt === 1 ? 2 : 1) : 0
    setPoints((p) => p + earned)
    commit(decision)
    setFeedback(r.correct ? { kind: 'right', points: earned } : { kind: 'explain', text: r.explanation, points: earned })
  }

  function dismissFeedback() {
    if (!feedback) return
    if (feedback.kind === 'retry') {
      // ให้แก้ป้ายและตราได้อีก 1 ครั้ง
      setAttempt(2)
      setFeedback(null)
      setStamping(false)
      setPage('stamp')
      return
    }
    advance(decisions)
  }

  /** กดตรา: เล่นแอนิเมชันตราลงกระดาษก่อน แล้วค่อยตรวจและบันทึก */
  function pressStamp() {
    if (!canStamp || stamping || busy) return
    setError(null)
    setStamping(true)
    stampTimer.current = window.setTimeout(() => void afterStamp(), reduce ? 120 : 900)
  }

  if (!current) return null

  const finished = decisions.length === total && !practice
  const retryTags = attempt === 2 && !feedback ? wrongHint : []
  const offset = view === 'left' ? 0 : view === 'center' ? -100 : -200
  const spriteIdx = Math.max(0, data.cases.findIndex((c) => c.id === current.id))
  const fill = TONE_FILL[current.tone]
  const inkLabel = stampInfo?.label
  const locked = stamping || busy
  const reaction: Mood = feedback ? (feedback.kind === 'right' ? 'happy' : 'confused') : 'neutral'
  const canBack = page === 'interview' || page === 'tag' || page === 'stamp'
  const backTo: Page = page === 'stamp' ? 'tag' : page === 'tag' ? 'interview' : 'card'

  const primary: { label: string; onClick: () => void; disabled?: boolean; variant: 'primary' | 'gold' } =
    page === 'queue'
      ? { label: 'เรียกคิว', onClick: () => setPage('card'), variant: 'primary' }
      : page === 'card'
        ? { label: 'เริ่มสัมภาษณ์', onClick: () => setPage('interview'), variant: 'primary' }
        : page === 'interview'
          ? { label: 'ไปติดป้าย', onClick: () => setPage('tag'), disabled: asked.length === 0, variant: 'primary' }
          : page === 'tag'
            ? { label: 'ไปประทับตรา', onClick: () => setPage('stamp'), disabled: !allTagged, variant: 'primary' }
            : { label: 'ประทับตรา', onClick: pressStamp, disabled: !canStamp || stamping, variant: 'gold' }

  const exchanges = asked
    .map((qid) => current.questions.find((x) => x.id === qid))
    .filter((q): q is NonNullable<typeof q> => !!q)

  const sprite = (h: string) => (
    <Sprite
      key={`${current.id}-${reaction}`}
      srcs={customerSrcs(spriteIdx, reaction)}
      head={fill.head}
      body={fill.body}
      height={h}
      label={`ลูกค้า ${current.name}`}
    />
  )

  return (
    <div className="counter-game-shell relative h-full min-h-[32rem] w-full flex-1 overflow-hidden bg-[#f3e4c4] text-[#3a2a18]" aria-label={data.title}>
      <SceneBg
        src="/learn/m3/bg-pixel-office.webp"
        fallback={BG_FALLBACK}
        blur={0}
        dim={view === 'center' ? 0.06 : 0.4}
      />

      <motion.div
        className="absolute inset-y-0 left-0 flex w-[300%]"
        animate={{ x: `${offset / 3}%` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 30 }}
      >
        {/* ซ้าย: คู่มือ = ภาพสมุดเปิดเต็มจอ วางข้อความบนหน้ากระดาษ แบ่งเป็นหน้า */}
        <section className="relative flex w-1/3 flex-col gap-2 overflow-hidden p-3" aria-hidden={view !== 'left'} inert={view !== 'left'}>
          <SceneBg src="/learn/m3/handbook.webp" fallback="bg-gradient-to-b from-[#5a3a1c] to-[#2c1a0b]" blur={0} dim={0} />
          <div className="absolute inset-0 flex justify-center" aria-hidden={false}>
            <div className="relative h-full aspect-[9/16] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- ภาพพื้นหลังสถิตใน public */}
              <img src="/learn/m3/handbook.webp" alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={hbPage}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 text-[#3a2a18]"
                >
                  <div className="absolute top-[49.5%] left-[19%] flex max-h-[15%] w-[29%] flex-col gap-1 overflow-hidden rounded-lg bg-[#fff8e6]/95 p-1">
                    <span
                      className="self-start rounded px-1.5 text-[15px] leading-tight font-extrabold text-white"
                      style={{ backgroundColor: ['#7c4dff', '#5b3bb0', '#e8742a'][hbSpread?.cat ?? 0] }}
                    >
                      {hbSpread ? (data.categories.find((c) => c.id === hbSpread.category)?.label ?? hbSpread.category) : ''}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {hbSpread?.suffixes.map((sfx) => (
                        <span key={sfx} dir="auto" className="rounded border border-[#c9b68c] bg-white px-1 text-[16px] leading-snug font-extrabold">
                          {sfx}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="absolute top-[49.5%] left-[54%] flex max-h-[15%] w-[28%] flex-col overflow-hidden rounded-lg bg-[#fff8e6]/95 p-1 text-[15px] leading-snug font-bold text-[#4a3a26]">
                    {splitFloor(hbSpread?.floor).map((part) => (
                      <span key={part} className="whitespace-nowrap">
                        {part}
                      </span>
                    ))}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div
            role="timer"
            aria-label={`เปิดคู่มือได้อีก ${handbookLeft} วินาที`}
            className="relative shrink-0 overflow-hidden rounded-xl border-[3px] border-[#7a3a00] bg-[#ff8a3d] px-3 py-2 text-center text-body font-extrabold text-[#2e1500] shadow-[0_4px_0_#7a3a00]"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 bg-[#ffcf4a]/60"
              style={{ width: `${(handbookLeft / Math.max(1, hbSeconds)) * 100}%`, transition: 'width 1s linear' }}
            />
            <span className="relative">เปิดคู่มือได้อีก {handbookLeft} วินาที</span>
          </div>
          <p
            key={hbPage}
            className="absolute inset-x-3 top-[69%] rounded-2xl border-[3px] border-[#7a5a3a] bg-[#fff8e6] px-3 py-2 text-[16px] leading-snug font-semibold text-[#3a2a18] shadow-[0_4px_0_#5c4228]"
          >
            {hbSpread?.who}
          </p>
          <div className="relative flex min-h-0 flex-1 items-end justify-center">
            <div className="flex items-center justify-center gap-3">
              <GameButton variant="paper" ariaLabel="หน้าก่อนหน้า" disabled={hbPage === 0} onClick={() => setHbPage((i) => Math.max(0, i - 1))}>
                <span aria-hidden="true">◀</span>
              </GameButton>
              <span className="rounded-lg border-2 border-[#6d4bd1] bg-[#241446] px-3 py-1 text-label font-extrabold whitespace-nowrap text-[#efe6ff] tabular-nums">
                หน้า {hbPage + 1} / {hbSpreads.length}
              </span>
              <GameButton variant="paper" ariaLabel="หน้าถัดไป" disabled={hbPage >= hbSpreads.length - 1} onClick={() => setHbPage((i) => Math.min(hbSpreads.length - 1, i + 1))}>
                <span aria-hidden="true">▶</span>
              </GameButton>
            </div>
          </div>
          <div className="relative shrink-0">
            <GameButton variant="primary" className="w-full" onClick={() => setView('center')}>
              หันกลับเคาน์เตอร์ <span aria-hidden="true">▶</span>
            </GameButton>
          </div>
        </section>

        {/* กลาง: เคาน์เตอร์ = HUD บน · ฉากยืดเต็ม (ลูกค้ายืนที่ระดับเคาน์เตอร์) · แผงควบคุมล่าง · ด็อก */}
        <section className="relative flex w-1/3 flex-col" aria-hidden={view !== 'center'} inert={view !== 'center'}>
          <ShiftHud queue={Math.min(caseIndex + 1, total)} total={total} coins={points} practice={practice} />

          {/* ฉาก */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {canBack && !feedback ? (
              <button
                type="button"
                aria-label="ย้อนกลับ"
                disabled={locked}
                onClick={() => setPage(backTo)}
                className="absolute top-2 left-3 z-10 grid size-11 place-items-center rounded-full border-2 border-[#6d4bd1] bg-[#241446] text-[#efe6ff] shadow-[0_3px_0_#0e0720] focus-visible:outline-3 focus-visible:outline-focus disabled:opacity-50"
              >
                <span aria-hidden="true" className="text-title-sm leading-none font-extrabold">‹</span>
              </button>
            ) : null}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={feedback ? `${page}-fb` : page}
                initial={reduce ? false : { x: 36, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reduce ? undefined : { x: -36, opacity: 0 }}
                transition={slide}
                className="absolute inset-0"
              >
                {/* ลูกค้ายืนติดขอบล่างของฉาก */}
                <div
                  className={cn(
                    'absolute bottom-0 flex justify-center',
                    page === 'interview' && !feedback ? '-left-[12%] w-[78%]' : 'inset-x-0',
                    page === 'stamp' && !feedback ? '-left-[8%] w-[68%]' : null,
                  )}
                  style={{
                    // The stamp request card is taller than the tag hint. Keep
                    // the customer below it so the paperwork never covers the
                    // customer's face on the 360px layout.
                    height: feedback ? '76%' : page === 'stamp' ? '62%' : SCENE_SPRITE_H[page],
                  }}
                >
                  {sprite('100%')}
                </div>

                {feedback ? (
                  <motion.p
                    initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...spring, delay: reduce ? 0 : 0.15 }}
                    className="absolute top-3 right-3 max-w-[62%] rounded-2xl rounded-br-sm border-2 border-[#7a5a3a] bg-[#fff6dc] px-3 py-2 text-label font-semibold text-[#3a2a18]"
                  >
                    {reaction === 'happy' ? 'อ๋อ เข้าใจแล้ว ขอบคุณมาก' : 'ยังงง ๆ อยู่เลย ช่วยดูอีกทีนะ'}
                  </motion.p>
                ) : null}

                {!feedback && page === 'queue' ? (
                  <>
                    <PixelPanel className="absolute top-3 left-1/2 w-[80%] -translate-x-1/2 p-2 text-center">
                      <p className="text-body font-extrabold">ลูกค้าคนต่อไป</p>
                      <p className="text-label font-bold text-[#6b5a43]">
                        คิวที่ {Math.min(caseIndex + 1, total)} · {current.name}
                      </p>
                    </PixelPanel>
                    <motion.p
                      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ ...spring, delay: reduce ? 0 : 0.2 }}
                      className="absolute top-[6.5rem] right-3 max-w-[62%] rounded-2xl rounded-br-sm border-2 border-[#7a5a3a] bg-[#fff6dc] px-3 py-2 text-label font-semibold text-[#3a2a18]"
                    >
                      {current.greeting}
                    </motion.p>
                  </>
                ) : null}

                {!feedback && page === 'card' ? (
                  <p className="absolute top-3 right-3 max-w-[62%] rounded-2xl rounded-br-sm border-2 border-[#7a5a3a] bg-[#fff6dc] px-3 py-2 text-label font-semibold text-[#3a2a18]">
                    {current.greeting}
                  </p>
                ) : null}

                {!feedback && page === 'interview' ? (
                  <div className="absolute inset-y-2 right-3 left-[40%] flex flex-col gap-1.5">
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      <span className="flex gap-1.5" aria-label={`ถามไปแล้ว ${asked.length} จาก ${data.maxQuestions}`}>
                        {Array.from({ length: data.maxQuestions }, (_, i) => (
                          <span
                            key={i}
                            aria-hidden="true"
                            className={cn(
                              'size-4 rounded-sm border-2',
                              i < asked.length ? 'border-[#b8860b] bg-[#ffcf4a]' : 'border-white/70',
                            )}
                          />
                        ))}
                      </span>
                      <span className="rounded-lg border-2 border-[#6d4bd1] bg-[#241446] px-2.5 py-0.5 text-label font-extrabold whitespace-nowrap text-[#efe6ff]">
                        ถามได้อีก {data.maxQuestions - asked.length}
                      </span>
                    </div>
                    {/* บทสนทนายาวเกินฉาก = เลื่อนดูได้ และเลื่อนลงข้อความล่าสุดเอง */}
                    <div ref={chatRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                    <ul className="mt-auto flex flex-col gap-1.5" aria-live="polite">
                      {exchanges.map((q) => (
                        <li key={q.id} className="flex flex-col gap-1">
                          <p className="self-end rounded-xl rounded-br-sm bg-brand-700 px-2.5 py-1 text-label leading-snug font-semibold text-pretty text-white">
                            {q.text}
                          </p>
                          <Reply text={q.reply} />
                        </li>
                      ))}
                    </ul>
                    </div>
                  </div>
                ) : null}

                {!feedback && page === 'stamp' ? (
                  <div className="absolute top-2 right-3 z-[1] w-[62%]">
                    <RequestPaper
                      c={current}
                      tags={tags}
                      spring={spring}
                      reduce={reduce}
                      ink={stamping && stamp ? { label: inkLabel ?? '', tone: STAMP_TONE[stamp] } : null}
                      compact
                    />
                  </div>
                ) : null}

                {!feedback && page === 'tag' ? (
                  <div className="absolute top-2 right-3 z-[1] max-w-[62%]">
                    <p className="rounded-xl border-2 border-[#6d4bd1] bg-[#1d1038] px-3 py-1.5 text-label font-bold text-[#efe6ff]">
                      แตะป้ายให้ครบ
                    </p>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* แผงควบคุม: ทีละหน้า เห็นครบไม่ต้องเลื่อน */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={feedback ? `${page}-fb` : page}
              initial={reduce ? false : { y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? undefined : { y: 24, opacity: 0 }}
              transition={slide}
              className="shrink-0 px-3 pt-2"
            >
              {feedback ? (
                <div
                  role="dialog"
                  aria-label="ผลการตัดสิน"
                  className="flex flex-col gap-2.5 rounded-2xl border-[3px] border-[#7a5a3a] bg-[#fff8e6] p-3.5 text-[#3a2a18] shadow-[0_5px_0_#5c4228]"
                >
                  <p className="text-label font-extrabold tracking-wide text-[#8a6a3c]">ผลลัพธ์</p>
                  <p className="text-body font-extrabold text-balance" aria-live="polite">
                    {feedback.kind === 'right'
                      ? feedback.points === 2
                        ? 'ถูกต้อง ได้ 2 แต้ม'
                        : 'ถูกต้องแล้ว ได้ 1 แต้มจากการลองแก้'
                      : feedback.kind === 'retry'
                        ? 'ยังไม่ถูกนะ แก้ตราได้อีก 1 ครั้ง ถ้าถูกจะได้ 1 แต้ม'
                        : `ยังไม่ตรงครั้งนี้ ได้ ${feedback.points} แต้ม ไปดูเหตุผลกัน`}
                  </p>
                  {feedback.kind === 'retry' ? (
                    <p className="rounded-xl bg-[#f1e6c8] p-2.5 text-label font-semibold">
                      {feedback.wrongTags.length > 0
                        ? `ป้ายประเภทมี ${feedback.wrongTags.length} ใบที่ยังไม่ตรง กดย้อนกลับไปแก้ป้ายได้ที่หน้าตรา`
                        : 'ป้ายถูกแล้ว ลองดูตราหรือนามสกุลที่เสนออีกที'}
                    </p>
                  ) : null}
                  {feedback.kind === 'explain' && feedback.text ? (
                    <p className="rounded-xl bg-[#f1e6c8] p-2.5 text-label font-semibold text-pretty">{feedback.text}</p>
                  ) : null}
                  {error ? (
                    <p role="alert" className="text-label font-bold text-[#8a3b00]">
                      {error}
                    </p>
                  ) : null}
                  <GameButton variant={feedback.kind === 'retry' ? 'primary' : 'gold'} loading={busy} onClick={dismissFeedback}>
                    {feedback.kind === 'retry'
                      ? 'แก้อีกครั้ง'
                      : isLast
                        ? practice
                          ? 'จบการซ้อม'
                          : error
                            ? 'ส่งอีกครั้ง'
                            : 'ส่งผลทั้งกะ'
                        : 'เรียกลูกค้าคนต่อไป'}
                  </GameButton>
                </div>
              ) : null}

              {!feedback && page === 'queue' && data.intro ? (
                <p className="rounded-xl border-2 border-[#6d4bd1] bg-[#1d1038] px-3 text-pretty text-[#efe6ff] py-2 text-label font-semibold">{data.intro}</p>
              ) : null}

              {!feedback && page === 'card' ? (
                <div className="flex flex-col gap-2">
                  <RequestPaper c={current} tags={tags} spring={spring} reduce={reduce} />
                  <p className="rounded-xl border-2 border-[#6d4bd1] bg-[#1d1038] px-3 text-pretty text-[#efe6ff] py-1.5 text-label font-semibold">
                    อ่านใบคำขอให้ครบ แล้วกดเริ่มสัมภาษณ์
                  </p>
                </div>
              ) : null}

              {!feedback && page === 'interview' ? (
                <div className="flex flex-col gap-1.5">
                  {asked.length < data.maxQuestions ? (
                    current.questions
                      .filter((q) => !asked.includes(q.id))
                      .map((q) => (
                        <motion.button
                          key={q.id}
                          type="button"
                          whileTap={reduce ? undefined : { scale: 0.97 }}
                          onClick={() => {
                            buzz()
                            setAsked((a) => (a.length < data.maxQuestions ? [...a, q.id] : a))
                          }}
                          className="min-h-11 rounded-xl border-2 border-[#6d4bd1] bg-[#fff6dc] px-3 py-1.5 text-left text-label leading-snug font-bold text-pretty text-[#3a2a18] shadow-[0_3px_0_#3b1d8f] focus-visible:outline-3 focus-visible:outline-focus"
                        >
                          {q.text}
                        </motion.button>
                      ))
                  ) : (
                    <p className="rounded-xl border-2 border-[#6d4bd1] bg-[#1d1038] px-3 text-pretty text-[#efe6ff] py-2 text-label font-bold">
                      ถามครบแล้ว กดไปติดป้ายได้เลย
                    </p>
                  )}
                </div>
              ) : null}

              {!feedback && page === 'tag' ? (
                <div className="flex flex-col gap-2">
                  {current.domains.map((d) => (
                    <div
                      key={d.name}
                      role="group"
                      aria-label={d.label}
                      className={cn(
                        'rounded-2xl border-2 bg-[#fff6dc] p-3 text-[#3a2a18]',
                        retryTags.includes(d.name) ? 'border-spark-600' : 'border-[#7a5a3a]',
                      )}
                    >
                      <p dir="auto" className="mb-2 px-1 text-[18px] leading-snug font-extrabold break-words text-[#2a1a0a]">
                        {d.label}
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {data.categories.map((c) => {
                          const on = tags[d.name] === c.id
                          return (
                            <motion.button
                              key={c.id}
                              type="button"
                              aria-pressed={on}
                              aria-label={`${d.label} เป็น ${c.label}`}
                              whileTap={reduce ? undefined : { scale: 0.94 }}
                              animate={on && !reduce ? { scale: [1, 1.08, 1] } : undefined}
                              onClick={() => {
                                buzz()
                                setTags((t) => ({ ...t, [d.name]: c.id }))
                              }}
                              className={cn(
                                'min-h-12 rounded-lg border-2 px-1 text-label leading-tight font-extrabold whitespace-nowrap focus-visible:outline-3 focus-visible:outline-focus',
                                on
                                  ? 'border-[#3b1d8f] bg-[#7c4dff] text-white shadow-[0_3px_0_#3b1d8f]'
                                  : 'border-[#c9b68c] bg-white text-[#3a2a18]',
                              )}
                            >
                              {c.label}
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {!feedback && page === 'stamp' ? (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="ตราประทับ">
                    {data.stamps.map((s) => {
                      const on = stamp === s.id
                      return (
                        <motion.button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={locked}
                          whileTap={reduce ? undefined : { scale: 0.95 }}
                          animate={{ rotate: on ? -2 : 0, y: on ? -3 : 0 }}
                          transition={spring}
                          onClick={() => {
                            buzz()
                            setStamp(s.id)
                            if (!s.needsExtension) setExtension(null)
                          }}
                          className={cn(
                            'flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border-[3px] px-1.5 py-1 text-center focus-visible:outline-3 focus-visible:outline-focus',
                            on ? 'bg-[#fff6dc] shadow-[0_4px_0_#5c4228]' : 'bg-[#e9dcc0] opacity-90',
                            STAMP_TONE[s.id],
                          )}
                        >
                          <span className="text-label font-extrabold">{s.label}</span>
                          <span className="text-[14px] leading-snug font-semibold text-pretty text-[#4a3a26]">{s.hint}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                  {needsExt ? (
                    <div className="rounded-xl border-2 border-[#7a5a3a] bg-[#fff6dc] p-2 text-[#3a2a18]">
                      <p className="text-label font-extrabold">
                        {stamp === 'first-step' ? 'ให้จดนามสกุลไหนก่อน' : 'เสนอนามสกุลไหน'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {current.extensionOptions.map((ext) => {
                          const on = extension === ext
                          return (
                            <motion.button
                              key={ext}
                              type="button"
                              aria-pressed={on}
                              disabled={locked}
                              whileTap={reduce ? undefined : { scale: 0.94 }}
                              onClick={() => {
                                buzz()
                                setExtension(ext)
                              }}
                              className={cn(
                                'min-h-11 rounded-lg border-2 px-3 text-label font-extrabold whitespace-nowrap focus-visible:outline-3 focus-visible:outline-focus',
                                on ? 'border-[#14522b] bg-[#1f7a43] text-white' : 'border-[#c9b68c] bg-white',
                              )}
                            >
                              {ext}
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                  {error ? (
                    <p role="alert" className="flex items-center gap-2 rounded-xl bg-[#fff0dc] px-3 py-1.5 text-label font-bold text-[#8a3b00]">
                      <AlertIcon width={18} height={18} aria-hidden />
                      {error}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {/* ด็อกล่าง: หันซ้าย | ปุ่มหลัก | หันขวา (ซ่อนตอนแสดงผลลัพธ์) */}
          {!feedback ? (
            <div className="flex shrink-0 items-stretch gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <GameButton
                variant="paper"
                className="min-w-[4.5rem] shrink-0 gap-1 px-2.5 text-label whitespace-nowrap max-[379px]:px-2"
                onClick={openHandbook}
                disabled={locked}
                ariaLabel="หันซ้าย เปิดคู่มือ"
              >
                <span aria-hidden="true" className="text-[14px] max-[379px]:hidden">◀</span>คู่มือ
              </GameButton>
              <GameButton
                variant={primary.variant}
                className="min-w-0 flex-1 px-1.5 whitespace-nowrap max-[419px]:text-label"
                onClick={primary.onClick}
                disabled={primary.disabled || locked}
                loading={busy && page === 'stamp'}
              >
                {primary.label}
              </GameButton>
              <GameButton
                variant="dark"
                className="shrink-0 gap-1 px-2.5 text-label whitespace-nowrap max-[379px]:px-2"
                onClick={() => setView('right')}
                disabled={finished || locked}
                ariaLabel={`หันขวา ถามโดม เหลือ ${hintsLeft} ครั้ง`}
              >
                ถามโดม
                <span
                  aria-hidden="true"
                  className="grid size-6 place-items-center rounded-full bg-[#ffcf4a] text-label leading-none font-extrabold text-[#4a3000] tabular-nums"
                >
                  {hintsLeft}
                </span>
                <span aria-hidden="true" className="text-[14px] max-[379px]:hidden">▶</span>
              </GameButton>
            </div>
          ) : (
            <div className="shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]" />
          )}
        </section>

        {/* ขวา: โต๊ะโดม */}
        <section className="relative flex w-1/3 flex-col gap-3 p-3" aria-hidden={view !== 'right'} inert={view !== 'right'}>
          <div className="flex items-center gap-2">
            <HudPill tone="gold" label="ใบ้เหลือ">
              {hintsLeft}
            </HudPill>
            <HudPill tone="dark" className="ml-auto">
              {STEP_LABEL[step]}
            </HudPill>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center gap-3">
            <motion.div
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={reduce ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <DomeAvatar mood={hintLog.length ? 'happy' : 'greet'} size={112} decorative sparkle />
            </motion.div>
            <PixelPanel className="w-full" aria-live="polite">
              {hintLog.length === 0 ? (
                <p className="text-body font-semibold">
                  โดมนั่งรออยู่ที่โต๊ะ แตะขอใบ้เมื่อไม่แน่ใจ มีให้ {hintsTotal} ครั้งต่อกะ
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {hintLog.map((h, i) => (
                    <motion.li
                      key={i}
                      initial={reduce ? false : { y: 14, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={spring}
                      className="rounded-xl bg-[#f1e6c8] px-3 py-2 text-label font-semibold"
                    >
                      <span className="mr-1 font-extrabold text-brand-700">ใบ้ที่ {i + 1}</span>
                      {h}
                    </motion.li>
                  ))}
                </ol>
              )}
            </PixelPanel>
          </div>
          <div className="flex gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <GameButton variant="gold" className="flex-1" onClick={askDome} disabled={hintsLeft <= 0}>
              ขอใบ้จากโดม
            </GameButton>
            <GameButton variant="paper" onClick={() => setView('center')}>
              <span aria-hidden="true">◀</span> กลับ
            </GameButton>
          </div>
        </section>
      </motion.div>
    </div>
  )
}

type Mood = 'neutral' | 'happy' | 'confused'

/** รายชื่อภาพลูกค้าที่จะลอง ตามอารมณ์ (ไม่มีไฟล์อารมณ์ก็ถอยไปภาพปกติ) */
function customerSrcs(index: number, mood: Mood): string[] {
  const base = `/learn/m3/customer-${index + 1}`
  return mood === 'neutral' ? [`${base}.png`] : [`${base}-${mood}.png`, `${base}.png`]
}

/** "ชั้น 1 ประตูเปิดกว้าง" → ["ชั้น 1", "ประตูเปิดกว้าง"] ตัดบรรทัดที่รอยต่อวลี ไม่ตัดกลางคำ */
function splitFloor(floor?: string): string[] {
  if (!floor) return []
  const m = floor.match(/^(\S+\s+\d+)\s+(.+)$/)
  return m ? [m[1]!, m[2]!] : [floor]
}

/** แถบ HUD บนเวที: ช่วงกิจกรรม / คิว / เหรียญแต้ม
 * เวลาหลักอยู่ที่แถบ session ด้านบนแล้ว จึงไม่ทำซ้ำด้วยนาฬิกาย่อยในเกม
 */
function ShiftHud({
  queue,
  total,
  coins,
  practice,
}: {
  queue: number
  total: number
  coins: number
  practice: boolean
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 px-2.5 pt-2.5">
      <HudPill className="min-w-0 flex-[1.3] justify-center px-2 whitespace-nowrap">
        <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full bg-[#ffb02e] ring-2 ring-[#ff8a3d] max-[379px]:hidden" />
        <span className="whitespace-nowrap">{practice ? 'โหมดซ้อม' : 'ช่วงเช้า'}</span>
      </HudPill>
      <HudPill className="flex-1 justify-center px-2" tone="paper">
        <span className="whitespace-nowrap tabular-nums">
          คิว {queue}/{total}
        </span>
      </HudPill>
      <HudPill tone="gold" className="justify-center px-2">
        <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border-2 border-[#b8860b] bg-[#ffe27a]" />
        <CountUp to={coins} duration={0.6} />
      </HudPill>
    </div>
  )
}

/** ใบคำขอแบบกระดาษ ช่องประทับตราแยกเป็นแถวล่าง ไม่ทับรายการโดเมน */
function RequestPaper({
  c,
  tags,
  spring,
  reduce,
  ink,
  compact,
}: {
  c: ViewCase
  tags: Record<string, CounterCategory>
  spring: ReturnType<typeof useGameMotion>['spring']
  reduce: boolean
  ink?: { label: string; tone: string } | null
  compact?: boolean
}) {
  return (
    <motion.div
      key={c.id}
      initial={reduce ? false : { y: 90, scale: 0.7, rotate: -4, opacity: 0 }}
      animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
      transition={spring}
    >
      <PixelPanel className={compact ? 'p-2' : 'p-2.5'}>
        <p className="text-label font-extrabold tracking-wide text-[#6b4f28]">ใบคำขอจดโดเมน</p>
        {!compact ? <p className="text-body font-extrabold">{c.business}</p> : null}
        <ul className="mt-1 flex flex-col gap-1">
          {c.domains.map((d) => (
            <li key={d.name} className="flex flex-wrap items-center gap-x-2 border-b border-dashed border-[#d9c7a0] pb-1 last:border-0">
                <span dir="auto" className={cn('font-extrabold', compact ? 'text-label' : 'text-body')}>
                {d.label}
              </span>
              {!compact ? <span className="text-label font-semibold text-[#5c4a33]">{d.role}</span> : null}
              {tags[d.name] ? (
                <span className="ml-auto rounded-md bg-brand-700 px-2 py-0.5 text-label font-bold whitespace-nowrap text-white">
                  {tags[d.name] === 'หมวดเฉพาะที่สงวน' ? 'หมวดสงวน' : tags[d.name]}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {compact ? (
          <div
            className={cn(
              'mt-1.5 flex items-center justify-center rounded-lg border-2 border-dashed border-[#c9b68c] bg-[#fffdf3]',
              compact ? 'h-9' : 'h-12',
            )}
          >
            <AnimatePresence>
              {ink ? (
                <motion.span
                  initial={reduce ? false : { scale: 2.6, opacity: 0, rotate: -26, y: -40 }}
                  animate={{ scale: 1, opacity: 0.92, rotate: -6, y: 0 }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
                  className={cn('rounded-lg border-4 px-3 py-0.5 text-body font-extrabold tracking-wide', ink.tone)}
                  aria-hidden="true"
                >
                  {ink.label}
                </motion.span>
              ) : (
                <span key="ph" className="text-label font-semibold text-[#6b5a43]">
                  ช่องประทับตรา
                </span>
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </PixelPanel>
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
  const show = ready || reduce
  return (
    <motion.p
      initial={reduce ? false : { x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={spring}
      className="mr-8 self-start rounded-2xl rounded-bl-sm border-2 border-[#7a5a3a] bg-[#fff6dc] px-3 py-2 text-label font-semibold text-[#3a2a18]"
    >
      {show ? (
        text
      ) : (
        <span className="flex gap-1 py-1" role="status" aria-label="กำลังพิมพ์">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-2 rounded-full bg-[#7a5a3a]"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
      )}
    </motion.p>
  )
}


function ResultView({
  data,
  result,
  onRetry,
  onRemedial,
  stats,
}: {
  data: CounterData
  result: SubmitResult
  stats: { handbook: number; dome: number }
  onRetry: () => void
  onRemedial: () => void
}) {
  const { reduce, spring, slide } = useGameMotion()
  const [pageIdx, setPageIdx] = useState(-1) // -1 = สรุป · 0.. = รายลูกค้า
  const detail = isDetail(result.detail) ? result.detail : null
  const byId = new Map<string, CounterCaseResult>((detail?.cases ?? []).map((c) => [c.caseId, c]))
  const perfect = !!detail && detail.stampPoints === detail.stampMax && detail.tagAccuracy === 1
  const stars = result.passed ? (perfect ? 3 : 2) : result.score > 0 ? 1 : 0
  const groupLabel = (id: string) => data.categories.find((c) => c.id === id)?.label ?? id
  const reactionOf = (id: string): Mood => {
    const r = byId.get(id)
    return r && r.stampCorrect && r.tagsCorrect === r.tagsTotal ? 'happy' : 'confused'
  }
  const bestIdx = Math.max(0, data.cases.findIndex((c) => reactionOf(c.id) === (result.passed ? 'happy' : 'confused')))
  const happyCount = data.cases.filter((c) => reactionOf(c.id) === 'happy').length
  const keyPct = detail && detail.cases.length > 0 ? Math.round((detail.cases.filter((c) => c.askedKeyQuestion).length / detail.cases.length) * 100) : 0
  const shown = pageIdx >= 0 ? data.cases[pageIdx] : null
  const shownResult = shown ? byId.get(shown.id) : undefined
  const idxShown = pageIdx >= 0 ? pageIdx : bestIdx
  const mood: Mood = shown ? reactionOf(shown.id) : result.passed ? 'happy' : 'confused'
  const tone = TONE_FILL[(shown ?? data.cases[idxShown])?.tone ?? 'brand']

  return (
    <div className="relative h-full min-h-[32rem] w-full flex-1 overflow-hidden bg-[#2b1d4d]">
      <SceneBg src="/learn/m3/bg-pixel-office.webp" fallback={BG_FALLBACK} blur={0} dim={0.06} />
      <div className="absolute inset-0 flex flex-col">
        <div className="flex shrink-0 items-center gap-1.5 px-2.5 pt-2.5">
          <HudPill tone="dark" className="flex-1 justify-center">
            รายงานปิดกะ
          </HudPill>
          <HudPill tone="gold" className="justify-center whitespace-nowrap">
            <CountUp to={result.score} /> คะแนน
          </HudPill>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pageIdx}
            initial={reduce ? false : { x: 36, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? undefined : { x: -36, opacity: 0 }}
            transition={slide}
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            {/* ฉากลูกค้า: ยืดตามที่เหลือ ลูกค้ายืนติดขอบล่าง ไม่ทับแถบบน (หน้าสรุปใช้โดมแทน) */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {pageIdx < 0 ? (
                <div className="absolute inset-x-0 bottom-0 flex h-full max-h-40 justify-center pt-3">
                  <DomeAvatar mood={result.passed ? 'celebrate' : 'encourage'} size={160} decorative />
                </div>
              ) : (
                <div className="absolute inset-x-0 bottom-0 flex justify-center" style={{ height: '82%' }}>
                  <Sprite
                    key={`${idxShown}-${mood}`}
                    srcs={customerSrcs(idxShown, mood)}
                    head={tone.head}
                    body={tone.body}
                    height="100%"
                    label={mood === 'happy' ? 'ลูกค้ายิ้ม' : 'ลูกค้ายังงง'}
                  />
                </div>
              )}
            </div>
            <div className="shrink-0 px-3">
            {pageIdx < 0 ? (
              <motion.div initial={reduce ? false : { y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
                <PixelPanel className="p-3 text-center">
                  <p className="text-title-sm font-extrabold">รายงานจบกะ</p>
                  <div className="mt-0.5">
                    <Stars count={stars} size={34} />
                  </div>
                  <p className="mt-1 text-label font-semibold text-balance text-[#6b5a43]">
                    {result.passed
                      ? 'เก่งมากเจ้าหน้าที่ ถามตรงจุดและตัดสินได้ดี'
                      : 'ยังไม่ครบ ดูเหตุผลของลูกค้าแต่ละคนแล้วฝึกเพิ่มได้'}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-left" aria-label="สรุปผลกะ">
                    {[
                      { k: 'ลูกค้าพอใจ', v: `${happyCount}/${data.cases.length}` },
                      { k: 'ถามตรงจุด', v: `${keyPct}%` },
                      { k: 'ใช้คู่มือ', v: `${stats.handbook} ครั้ง` },
                      { k: 'ถามโดม', v: `${stats.dome} ครั้ง` },
                    ].map((m) => (
                      <li key={m.k} className="flex items-center justify-between gap-2 rounded-xl bg-[#f1e6c8] px-3 py-1.5">
                        <span className="text-body font-extrabold">{m.k}</span>
                        <span className="min-w-[4.5rem] rounded-lg bg-white/80 px-2 py-0.5 text-center text-body font-extrabold tabular-nums">
                          {m.v}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {detail ? (
                    <>
                      <p className="mt-1.5 text-label font-bold text-[#5c4a33]">
                        ติดป้ายถูก {Math.round(detail.tagAccuracy * 100)}% · แต้มตรา <CountUp to={detail.stampPoints} />/{detail.stampMax}
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1 text-left" aria-label="ผลแยกตามกลุ่ม">
                        {detail.groups.map((g) => {
                          const frac = g.total > 0 ? g.correct / g.total : 0
                          return (
                            <li key={g.category} className="flex items-center gap-2 text-label font-bold">
                              <span className="w-[6.8rem] shrink-0 leading-tight">{groupLabel(g.category)}</span>
                              <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-[#e4d5b0]" aria-hidden="true">
                                <motion.span
                                  className={cn('block h-full', frac >= 0.8 ? 'bg-quest-600' : 'bg-spark-600')}
                                  initial={reduce ? false : { width: 0 }}
                                  animate={{ width: `${frac * 100}%` }}
                                  transition={reduce ? { duration: 0 } : { duration: 0.8, delay: 0.4 }}
                                />
                              </span>
                              <span className="w-10 shrink-0 text-right tabular-nums">
                                {g.correct}/{g.total}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  ) : null}
                </PixelPanel>
              </motion.div>
            ) : shown && shownResult ? (
              <PixelPanel className="p-3">
                <p className="text-body font-extrabold">
                  {shown.name}
                  <span
                    className={cn(
                      'ml-2 text-label font-bold',
                      mood === 'happy' ? 'text-quest-700' : 'text-spark-700',
                    )}
                  >
                    {mood === 'happy' ? 'ถูกครบ' : 'ยังไม่ครบ ลองอีกนิด'}
                  </span>
                </p>
                <p className="text-label text-[#6b5a43]">
                  ป้ายถูก {shownResult.tagsCorrect}/{shownResult.tagsTotal} · ตรา{shownResult.stampCorrect ? 'ถูก' : 'ยังไม่ตรง'} ·{' '}
                  {shownResult.points} แต้ม{shownResult.askedKeyQuestion ? ' · ถามตรงจุด' : ''}
                </p>
                <p className="mt-1.5 text-label font-semibold text-pretty">{shownResult.explanation}</p>
              </PixelPanel>
            ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex shrink-0 flex-col gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {pageIdx < 0 ? (
            <>
              {!result.passed ? (
                <GameButton variant="gold" className="w-full" onClick={onRemedial}>
                  ฝึกเพิ่มก่อนเข้ากะใหม่
                </GameButton>
              ) : null}
              <div className="flex gap-2">
                <GameButton variant="paper" className="flex-1" onClick={() => setPageIdx(0)}>
                  ดูรายลูกค้า
                </GameButton>
                {!result.passed ? (
                  <GameButton variant="paper" className="flex-1" onClick={onRetry}>
                    <RefreshIcon width={18} height={18} aria-hidden /> เข้ากะใหม่
                  </GameButton>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <GameButton
                variant="paper"
                ariaLabel="ลูกค้าคนก่อน"
                className="w-14 shrink-0"
                onClick={() => setPageIdx((i) => (i <= 0 ? -1 : i - 1))}
              >
                ‹
              </GameButton>
              <GameButton variant="gold" className="flex-1" onClick={() => setPageIdx(-1)}>
                กลับหน้าสรุป ({pageIdx + 1}/{data.cases.length})
              </GameButton>
              <GameButton
                variant="paper"
                ariaLabel="ลูกค้าคนถัดไป"
                className="w-14 shrink-0"
                disabled={pageIdx >= data.cases.length - 1}
                onClick={() => setPageIdx((i) => Math.min(data.cases.length - 1, i + 1))}
              >
                ›
              </GameButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

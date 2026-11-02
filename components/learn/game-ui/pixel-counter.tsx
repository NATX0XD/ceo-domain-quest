'use client'

/**
 * ภารกิจที่ 3 แบบ "Pixel Counter" (ภาพอ้างอิง docs/design-ref/pixel/m3-*.png)
 *
 * ลูกค้า 1 คน: 1 เรียกคิว → 2 การ์ดคำขอเด้งขึ้น (จัดชั้นนามสกุล) → 3 สัมภาษณ์ → 4 เลือกตรา + เสนอนามสกุล + เหตุผล → ผลลัพธ์
 * ระหว่างขั้น หันซ้าย = ชั้นคู่มือ (จำกัดเวลา) · หันขวา = โต๊ะโดม (จำกัดคำใบ้) ด้วยปุ่ม ‹ › ปัดจอ หรือปุ่มลูกศรคีย์บอร์ด
 * ภาพทั้งหมดอ่านจาก /learn/pixel/* ถ้ายังไม่มีไฟล์จะถอยไปใช้ภาพเดิม (วางไฟล์ทีหลังได้โดยไม่ต้องแก้โค้ด)
 * ⚠️ ไม่มีเฉลยในไฟล์นี้ ตรวจทีละลูกค้าผ่าน onCheck และส่งทั้งกะผ่าน onComplete
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/components/ui'
import { GameHeader } from '@/components/learn/game-header'
import { M3_ASSET, sfx, useM3Sound } from './counter-shell'
import { CountUp, Stars, useGameMotion } from './index'
import type {
  CounterCase,
  CounterCaseResult,
  CounterCategory,
  CounterData,
  CounterDecision,
  CounterDetail,
  CounterStampId,
  CounterStep,
  CounterStepResult,
} from '../counter-types'
import './pixel-counter.css'

/* ---------- ภาพ (ไฟล์ใหม่ก่อน ไม่มีก็ใช้ภาพเดิม) ---------- */

const PIX = '/learn/pixel'
const OLD_CUSTOMER: Record<string, string> = { c1: 'customer-1', c2: 'customer-3', c3: 'customer-2', c4: 'customer-4', c6: 'customer-4' }

export const PX_ASSET = {
  bg: {
    counter: [`${PIX}/bg-counter.webp`, '/learn/m3/bg-pixel-office.webp'],
    book: [`${PIX}/bg-left-manual.webp`, '/learn/m3/handbook.webp'],
    dome: [`${PIX}/bg-right-dome.webp`, '/learn/m3/bg-pixel-office.webp'],
  },
  customer(id: string, mood: 'neutral' | 'happy' | 'confused' | 'upset' | 'walk'): string[] {
    const old = OLD_CUSTOMER[id] ?? 'customer-1'
    const oldMood = mood === 'happy' ? `-happy` : mood === 'confused' || mood === 'upset' ? '-confused' : ''
    const list = [`${PIX}/${id}-${mood}.webp`]
    if (mood === 'walk' || mood === 'upset') list.push(`${PIX}/${id}-neutral.webp`)
    list.push(`/learn/m3/${old}${oldMood}.png`, `/learn/m3/${old}.png`)
    return list
  },
  dome(mood: 'neutral' | 'happy' | 'thinking' | 'cheer'): string[] {
    const old = { neutral: 'dome-greet', happy: 'dome-happy', thinking: 'dome-think', cheer: 'dome-cheer' }[mood]
    return [`${PIX}/dome-${mood}.webp`, `/dome/mascot/${old}.webp`, M3_ASSET.dome]
  },
  stamp(id: CounterStampId): string[] {
    const file = { approve: 'stamp-approve', suggest: 'stamp-new', 'first-step': 'stamp-more', reject: 'stamp-reject' }[id]
    return [`${PIX}/${file}.webp`]
  },
  queueBoard: [`${PIX}/queue-board.webp`],
}

const cssBg = (list: string[]) => list.map((u) => `url("${u}")`).join(', ')

/** รูปที่ลองไฟล์ทีละตัว ไฟล์แรกไม่มีก็ใช้ตัวถัดไป หมดแล้วซ่อน */
export function PxImg({ srcs, alt = '', className, style }: { srcs: string[]; alt?: string; className?: string; style?: React.CSSProperties }) {
  const [i, setI] = useState(0)
  const key = srcs.join('|')
  const [seen, setSeen] = useState(key)
  if (seen !== key) {
    setSeen(key)
    setI(0)
  }
  if (i >= srcs.length) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ภาพเกมสถิต มี fallback หลายไฟล์
    <img src={srcs[i]} alt={alt} className={className} style={style} draggable={false} onError={() => setI((n) => n + 1)} />
  )
}

/* ---------- โครงจอ: HUD ด้านบน ฉากเต็มจอ ด็อกล่าง ---------- */

type Look = 'book' | 'counter' | 'dome'
const LOOKS: Look[] = ['book', 'counter', 'dome']

const two = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0')
const mmss = (s: number) => `${two(s / 60)}:${two(s % 60)}`

export function PxHud({
  clock,
  queue,
  coins,
  timer,
}: {
  clock: string
  queue?: { at: number; total: number }
  coins: number
  timer?: number
}) {
  return (
    <div className="px-hud">
      <span className="px-chip" aria-label={`กะเช้า เวลา ${clock}`}>
        <i className="px-ico px-ico--sun" aria-hidden />
        <span>
          <small>กะเช้า</small>
          <b>{clock}</b>
        </span>
      </span>
      {queue ? (
        <span className="px-chip" aria-label={`คิวที่ ${queue.at} จาก ${queue.total}`}>
          <span className="px-people" aria-hidden>
            {Array.from({ length: queue.total }, (_, i) => (
              <i key={i} className={cn(i < queue.at && 'is-on')} />
            ))}
          </span>
          <span>
            <small>คิว</small>
            <b>
              {queue.at}/{queue.total}
            </b>
          </span>
        </span>
      ) : null}
      <span className="px-chip px-chip--coin" aria-label={`${coins} แต้ม`}>
        <i className="px-ico px-ico--coin" aria-hidden />
        <b>
          <CountUp to={coins} duration={0.6} />
        </b>
      </span>
      {timer != null ? (
        <span className={cn('px-chip px-chip--timer', timer <= 30 && 'is-low')} role="timer" aria-label={`เวลาของลูกค้าคนนี้ ${mmss(timer)}`}>
          <i className="px-ico px-ico--clock" aria-hidden />
          <b>{mmss(timer)}</b>
        </span>
      ) : null}
    </div>
  )
}

function useExitConfirm(onExit?: () => void) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement | null>(null)
  const open = () => {
    if (onExit) return onExit()
    if (ref.current && !ref.current.open) ref.current.showModal()
  }
  const dialog = (
    <dialog ref={ref} className="px-dialog" aria-label="ออกจากภารกิจ">
      <div className="px-card px-dialog-card">
        <p className="px-dialog-text">ออกตอนนี้ได้นะ กลับมาเปิดภารกิจที่ 3 แล้วเริ่มกะใหม่ได้เสมอ</p>
        <div className="px-row">
          <button type="button" className="px-btn px-btn--cream" onClick={() => ref.current?.close()}>
            อยู่ต่อ
          </button>
          <button type="button" className="px-btn px-btn--orange" onClick={() => router.push('/map')}>
            กลับแผนที่
          </button>
        </div>
      </div>
    </dialog>
  )
  return { open, dialog }
}

export function PxBtn({
  children,
  onClick,
  tone = 'purple',
  disabled,
  busy,
  className,
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'purple' | 'cream' | 'orange' | 'gold' | 'green'
  disabled?: boolean
  busy?: boolean
  className?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      className={cn('px-btn', `px-btn--${tone}`, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      onClick={() => {
        sfx('tap')
        onClick?.()
      }}
    >
      {busy ? <span className="px-spinner" aria-hidden /> : null}
      {children}
    </button>
  )
}

/* ---------- เกมหลัก ---------- */

type ViewCase = Omit<CounterCase, 'domains'> & { domains: { name: string; role: string; label: string }[] }
type Page = 'queue' | 'card' | 'interview' | 'stamp'
type Mood = 'neutral' | 'happy' | 'confused'
type Feedback =
  | { kind: 'right'; points: number }
  | { kind: 'retry'; wrongTags: string[]; stampWrong: boolean }
  | { kind: 'explain'; text: string; points: number }

const STEP_OF: Record<Page, CounterStep> = { queue: 'request', card: 'tag', interview: 'interview', stamp: 'stamp' }
const STEP_LABEL: Record<CounterStep, string> = { request: 'อ่านใบคำขอ', tag: 'จัดชั้นนามสกุล', interview: 'สัมภาษณ์', stamp: 'ประทับตรา' }
/** ชื่อชั้นแบบภาพ (ใครก็จดได้ / ต้องมีเอกสาร / สงวนไว้) เรียงตาม categories */
const SHELF = ['ใครก็จดได้', 'ต้องมีเอกสาร', 'สงวนไว้']
const FALLBACK_REASONS = [
  'ลูกค้ามีเอกสารตรงเงื่อนไขของนามสกุลที่ขอ',
  'ลูกค้ายังขาดเอกสาร จึงควรใช้นามสกุลที่เขามีสิทธิ์',
  'ลูกค้าไม่ใช่หน่วยงานที่หมวดสงวนรับ หรือข้อมูลไม่ตรงความจริง',
]
const CUSTOMER_SECONDS = 180

/** จับคำถามที่พิมพ์เองกับคำถามสำเร็จรูปที่ใกล้ที่สุด */
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

/** นาฬิกากะ: เริ่ม 09:00 เดิน 1 นาทีทุก 8 วินาที */
function useShiftClock() {
  const [min, setMin] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setMin((m) => m + 1), 8000)
    return () => window.clearInterval(id)
  }, [])
  return `${two(9 + Math.floor(min / 60))}:${two(min % 60)}`
}

export function PixelShift({
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
  onCheck?: (decision: CounterDecision) => Promise<CounterStepResult>
  onExit?: () => void
  onComplete: (all: CounterDecision[]) => Promise<void>
}) {
  const { reduce, spring } = useGameMotion()
  const exit = useExitConfirm(onExit)
  const [soundOn, toggleSound] = useM3Sound()
  const clock = useShiftClock()
  const [caseIndex, setCaseIndex] = useState(0)
  const [page, setPage] = useState<Page>('queue')
  const step = STEP_OF[page]
  const [asked, setAsked] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [miss, setMiss] = useState<string | null>(null)
  const [tags, setTags] = useState<Record<string, CounterCategory>>({})
  const [stamp, setStamp] = useState<CounterStampId | null>(null)
  const [extension, setExtension] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<CounterDecision[]>([])
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [reasonOk, setReasonOk] = useState<boolean | undefined>(undefined)
  const [points, setPoints] = useState(0)
  const [wrongHint, setWrongHint] = useState<string[]>([])
  const [hintsLeft, setHintsLeft] = useState(hintsTotal)
  const [hintLog, setHintLog] = useState<string[]>([])
  const [look, setLook] = useState<Look>('counter')
  const [turnDir, setTurnDir] = useState<'l' | 'r' | null>(null)
  const [hbLeft, setHbLeft] = useState(hbSeconds)
  const [dragX, setDragX] = useState(0)
  const [custLeft, setCustLeft] = useState(CUSTOMER_SECONDS)
  const [stamping, setStamping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stampTimer = useRef<number | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const swipe = useRef<{ x: number; y: number; id: number; active: boolean } | null>(null)
  const swallowClick = useRef(false)

  const current = cases[caseIndex]
  const total = cases.length
  const isLast = caseIndex === total - 1
  const stampInfo = data.stamps.find((s) => s.id === stamp)
  const needsExt = stampInfo?.needsExtension ?? false
  const allTagged = current ? current.domains.every((d) => tags[d.name]) : false
  const canStamp = stamp != null && (!needsExt || extension != null) && reason != null
  const locked = stamping || busy

  // เวลาของลูกค้าคนนี้ เดินตั้งแต่การ์ดเปิดจนตัดสินเสร็จ (เดินต่อแม้หันไปดูคู่มือ/ถามโดม) ไม่หักคะแนน
  const timerRunning = page !== 'queue' && !feedback
  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => setCustLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [timerRunning])

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

  // โหลดภาพลูกค้าคนนี้ทุกสีหน้าไว้ก่อน (กันภาพว่างตอนการ์ดเด้ง/ผลลัพธ์)
  const portrait = current?.portrait ?? 'c1'
  useEffect(() => {
    for (const m of ['neutral', 'happy', 'confused'] as const) {
      const img = new Image()
      img.src = PX_ASSET.customer(portrait, m)[0]!
    }
  }, [portrait])

  // เลือกตรา/นามสกุลแล้ว เลื่อนช่องถัดไป (เสนอเป็น / เหตุผล) เข้ามาในจอ
  useEffect(() => {
    if (!stamp) return
    const id = window.setTimeout(() => {
      const next = document.querySelector(needsExt && !extension ? '.px-offer' : '.px-reasons')
      next?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [stamp, extension, needsExt, reduce])

  // หันซ้ายเปิดคู่มือได้ hbSeconds วินาทีต่อครั้ง หมดเวลาหันกลับเคาน์เตอร์เอง
  useEffect(() => {
    if (look !== 'book') return
    setHbLeft(hbSeconds)
    let n = hbSeconds
    const id = window.setInterval(() => {
      n -= 1
      setHbLeft(Math.max(0, n))
      if (n <= 0) {
        window.clearInterval(id)
        setTurnDir('r')
        setLook('counter')
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [look, hbSeconds])

  useEffect(() => {
    if (!turnDir) return
    const id = window.setTimeout(() => setTurnDir(null), 650)
    return () => window.clearTimeout(id)
  }, [turnDir, look])

  function turn(to: Look) {
    if (to === look || (locked && to !== 'counter')) return
    sfx('tap')
    if (to === 'book') onStat?.('handbook')
    setTurnDir(LOOKS.indexOf(to) < LOOKS.indexOf(look) ? 'l' : 'r')
    setLook(to)
  }

  function turnBy(dir: -1 | 1) {
    const next = LOOKS[LOOKS.indexOf(look) + dir]
    if (next) turn(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [role="radiogroup"], dialog')) return
      if (e.key === 'ArrowLeft') turnBy(-1)
      else if (e.key === 'ArrowRight') turnBy(1)
      else if (e.key === 'Escape' && look !== 'counter') turn('counter')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const swipeProps = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = swipe.current
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (!s.active) {
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4 && !locked) s.active = true
        else if (Math.abs(dy) > 14) {
          swipe.current = null
          return
        } else return
      }
      const edge = (look === 'book' && dx > 0) || (look === 'dome' && dx < 0)
      setDragX(edge ? dx * 0.2 : dx)
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = swipe.current
      swipe.current = null
      if (!s || !s.active) return
      const dx = e.clientX - s.x
      setDragX(0)
      swallowClick.current = true
      window.setTimeout(() => (swallowClick.current = false), 60)
      if (dx <= -56) turnBy(1)
      else if (dx >= 56) turnBy(-1)
    },
    onPointerCancel: () => {
      swipe.current = null
      setDragX(0)
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (swallowClick.current) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
  }

  function resetCase() {
    setPage('queue')
    setAsked([])
    setTyped('')
    setMiss(null)
    setTags({})
    setStamp(null)
    setExtension(null)
    setReason(null)
    setReasonOk(undefined)
    setStamping(false)
    setAttempt(1)
    setFeedback(null)
    setWrongHint([])
    setLook('counter')
    setCustLeft(CUSTOMER_SECONDS)
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
      ...(current.reasons ? { reason } : {}),
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
    setReasonOk(r.reasonCorrect)
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
    setLook('counter')
    setPage(wrongHint.length > 0 ? 'card' : 'stamp')
  }

  function pressStamp() {
    if (!canStamp || stamping || busy) return
    setError(null)
    setStamping(true)
    sfx('stamp')
    stampTimer.current = window.setTimeout(() => void afterStamp(), reduce ? 120 : 900)
  }

  if (!current) return null

  const p = current.particle ?? ''
  const mood: Mood = feedback ? (feedback.kind === 'right' ? 'happy' : 'confused') : 'neutral'
  const left = data.maxQuestions - asked.length
  const exchanges = asked
    .map((qid) => current.questions.find((x) => x.id === qid))
    .filter((q): q is NonNullable<typeof q> => !!q)
  const docs = [...new Set(exchanges.flatMap((q) => q.docs ?? []))]
  const who = [...exchanges].reverse().find((q) => q.who)?.who ?? null
  const reasons = current.reasons ?? FALLBACK_REASONS.map((text, i) => ({ id: `g${i}`, text }))
  const wanted = current.domains[0]?.name ?? ''
  const hot = (suffix: string) => wanted.endsWith(suffix)
  const lookIdx = LOOKS.indexOf(look)
  const base = wanted.split('.')[0] ?? wanted
  const resultDomain =
    needsExt && extension ? (current.domains.find((d) => d.name.endsWith(extension))?.name ?? `${base}${extension}`) : wanted

  const say = feedback
    ? feedback.kind === 'right'
      ? stamp === 'approve'
        ? `ขอบคุณ${p || 'นะ'} ได้ ${resultDomain} แล้ว`
        : stamp === 'first-step'
          ? `อ๋อ ต้องจด ${resultDomain} ก่อนสินะ${p}`
          : `อ๋อ เข้าใจแล้ว${p} งั้นเอา ${resultDomain} ${p}`.trim()
      : `เอ๊ะ ทำไมล่ะ${p} ช่วยดูอีกทีได้ไหม`
    : page === 'interview'
      ? exchanges.length || miss
        ? null
        : current.greeting
      : page === 'queue' || page === 'stamp'
        ? null
        : current.greeting

  /* ---------- ด็อกล่าง ---------- */
  const turnTools = (primary: ReactNode) => (
    <div className="px-tools">
      <button type="button" className="px-turn" onClick={() => turn('book')} disabled={locked} aria-label="หันซ้าย เปิดคู่มือ">
        <span className="px-chev" aria-hidden>
          ‹
        </span>
        <i className="px-ico px-ico--book" aria-hidden />
        <span>คู่มือ</span>
      </button>
      {primary}
      <button type="button" className="px-turn" onClick={() => turn('dome')} disabled={locked} aria-label={`หันขวา ถามโดม คำใบ้เหลือ ${hintsLeft}`}>
        <PxImg srcs={PX_ASSET.dome('neutral')} className="px-turn-dome" />
        <span>ถามโดม</span>
        <span className="px-chev px-chev--r" aria-hidden>
          ›
        </span>
        <i className="px-badge">{hintsLeft}</i>
      </button>
    </div>
  )

  const counterDock = feedback ? (
    feedback.kind === 'retry' ? (
      <div className="px-row">
        <PxBtn tone="orange" onClick={retry}>
          ลองตัดสินใหม่
        </PxBtn>
        <PxBtn tone="cream" className="px-btn--narrow" onClick={() => turn('book')}>
          <i className="px-ico px-ico--book" aria-hidden /> ดูคู่มือ
        </PxBtn>
      </div>
    ) : (
      <PxBtn tone="gold" busy={busy} onClick={() => advance(decisions)}>
        {isLast ? (practice ? 'จบการซ้อม ›' : error ? 'ส่งอีกครั้ง' : 'ส่งผลทั้งกะ ›') : 'ลูกค้าคนต่อไป ›'}
      </PxBtn>
    )
  ) : page === 'queue' ? (
    turnTools(
      <PxBtn
        onClick={() => {
          sfx('ok')
          setPage('card')
        }}
      >
        เรียกคิว
      </PxBtn>,
    )
  ) : page === 'card' ? (
    turnTools(
      <PxBtn onClick={() => setPage(attempt === 2 ? 'stamp' : 'interview')} disabled={!allTagged}>
        {allTagged ? (attempt === 2 ? 'ไปตัดสินใหม่ ›' : 'สัมภาษณ์ลูกค้า') : 'จัดชั้นนามสกุลก่อน'}
      </PxBtn>,
    )
  ) : page === 'interview' ? (
    turnTools(
      <PxBtn onClick={() => setPage('stamp')} disabled={asked.length === 0}>
        {asked.length === 0 ? 'ถามอย่างน้อย 1 ข้อ' : 'ไปประทับตรา ›'}
      </PxBtn>,
    )
  ) : (
    turnTools(
      <PxBtn onClick={pressStamp} disabled={!canStamp || locked} busy={busy}>
        {!stamp ? 'เลือกตรา 1 อัน' : needsExt && !extension ? 'เลือกนามสกุลที่เสนอ' : reason == null ? 'เลือกเหตุผล' : 'ประทับตรา'}
      </PxBtn>,
    )
  )

  const dock =
    look === 'book' ? (
      <PxBtn onClick={() => turn('counter')}>หันกลับเคาน์เตอร์ ›</PxBtn>
    ) : look === 'dome' ? (
      <PxBtn onClick={() => turn('counter')}>‹ หันกลับเคาน์เตอร์</PxBtn>
    ) : (
      counterDock
    )

  const blur = look === 'counter' && page === 'card' && !feedback ? 'is-blur' : look === 'counter' && page !== 'queue' ? 'is-soft' : ''

  /* ---------- การ์ดคำขอ (ใช้ซ้ำทุกขั้น) ---------- */
  const fieldRows = (
    <dl className="px-fields">
      <div>
        <dt>
          <i className="px-ico px-ico--globe" aria-hidden />
          ชื่อโดเมนที่ต้องการ
        </dt>
        <dd className="px-mono" dir="auto">
          {wanted}
        </dd>
      </div>
      <div>
        <dt>
          <i className="px-ico px-ico--person" aria-hidden />
          ประเภทผู้ขอ
        </dt>
        <dd className={cn(who ? 'is-known' : 'is-unknown')}>{who ? `✓ ${who}` : '?'}</dd>
      </div>
      <div>
        <dt>
          <i className="px-ico px-ico--doc" aria-hidden />
          เอกสารที่มี
        </dt>
        <dd className={cn(docs.length ? 'is-known' : 'is-unknown')}>{docs.length ? docs.join(' · ') : '?'}</dd>
      </div>
    </dl>
  )

  return (
    <div className={cn('px', `is-look-${look}`, turnDir && `is-turn-${turnDir}`)} aria-label={data.title}>
      {/* ชั้น 1 ฉากหลัง 3 มุม (ซ้าย คู่มือ / กลาง เคาน์เตอร์ / ขวา โดม) เลื่อนช้ากว่าชั้นหน้า = พารัลแลกซ์ */}
      <div className="px-world" aria-hidden>
        <div
          className={cn('px-world-track', dragX !== 0 && 'is-dragging')}
          style={{ transform: `translateX(calc(${(-lookIdx * 100) / 3}% + ${dragX * 0.6}px))` }}
        >
          <div className="px-bg px-bg--book" style={{ backgroundImage: cssBg(PX_ASSET.bg.book) }} />
          <div className={cn('px-bg px-bg--counter', blur)} style={{ backgroundImage: cssBg(PX_ASSET.bg.counter) }} />
          <div className="px-bg px-bg--dome" style={{ backgroundImage: cssBg(PX_ASSET.bg.dome) }} />
        </div>
      </div>

      <div className="px-stage">
        <GameHeader
          title="ภารกิจที่ 3"
          subtitle={
            look === 'book'
              ? 'หันซ้าย · ชั้นคู่มือ'
              : look === 'dome'
                ? 'หันขวา · โต๊ะโดม'
                : `${practice ? 'โหมดซ้อม · ' : ''}ลูกค้า ${caseIndex + 1}/${total} · ${feedback ? 'ผลลัพธ์' : STEP_LABEL[step]}`
          }
          onBack={exit.open}
          soundOn={soundOn}
          onSound={toggleSound}
        />
        <PxHud clock={clock} queue={{ at: caseIndex + 1, total }} coins={points} timer={page === 'queue' ? undefined : custLeft} />

        <main className="px-pano" {...swipeProps}>
          <div
            className={cn('px-pano-track', dragX !== 0 && 'is-dragging')}
            style={{ transform: `translateX(calc(${(-lookIdx * 100) / 3}% + ${dragX}px))` }}
          >
            {/* ---------- หันซ้าย: ชั้นคู่มือ ---------- */}
            <section className="px-view px-view--book" aria-label="ชั้นคู่มือ" aria-hidden={look !== 'book'} inert={look !== 'book'}>
              <div className="px-hbtimer" role="timer" aria-label={`เปิดคู่มือได้อีก ${hbLeft} วินาที`}>
                <b>เปิดคู่มือได้อีก {hbLeft} วินาที</b>
                <i>
                  <span style={{ width: `${(hbLeft / Math.max(1, hbSeconds)) * 100}%` }} />
                </i>
              </div>
              <div className="px-shelf">
                {data.handbook.map((f, i) => (
                  <div key={f.category} className={cn('px-shelf-row', i === 2 && 'is-reserved')}>
                    <span className="px-shelf-label">{SHELF[i] ?? f.floor}</span>
                    <span className="px-spines">
                      {f.rows
                        .flatMap((r) => r.suffix.split(/\s+/).filter(Boolean))
                        .slice(0, 5)
                        .map((sx) => (
                          <span key={sx} className={cn('px-spine', hot(sx) && 'is-hot')} dir="auto">
                            {sx}
                          </span>
                        ))}
                    </span>
                  </div>
                ))}
              </div>
              <section className="px-manual">
                <h3>คู่มือชื่อโดเมน</h3>
                {data.handbook.map((f, i) => (
                  <div key={f.category} className={cn('px-manual-row', i === 2 && 'is-reserved')}>
                    <span className="px-manual-tag">
                      {SHELF[i] ?? f.floor}
                      <i className={cn('px-ico', ['px-ico--globe', 'px-ico--doc', 'px-ico--bank'][i])} aria-hidden />
                    </span>
                    <ul>
                      {f.rows.map((r) => (
                        <li key={r.suffix} className={cn(r.suffix.split(/\s+/).some(hot) && 'is-hot')}>
                          <b dir="auto">{r.suffix}</b>
                          <span>{r.who}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            </section>

            {/* ---------- กลาง: เคาน์เตอร์ ---------- */}
            <section className={cn('px-view px-view--counter', `is-${feedback ? 'result' : page}`)} aria-label="เคาน์เตอร์" aria-hidden={look !== 'counter'} inert={look !== 'counter'}>
              {page === 'queue' && !feedback ? (
                <div className="px-queue-scene">
                  <motion.div
                    className="px-hang-sign"
                    initial={reduce ? false : { y: -40, rotate: -6 }}
                    animate={{ y: 0, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 9 }}
                  >
                    ลูกค้าคนต่อไป
                  </motion.div>
                  <div className="px-qboard" aria-label={`คิวหมายเลข ${caseIndex + 1}`}>
                    <PxImg srcs={PX_ASSET.queueBoard} className="px-qboard-img" />
                    <small>คิว</small>
                    <b key={caseIndex}>{caseIndex + 1}</b>
                  </div>
                  <motion.div
                    key={`walk-${caseIndex}`}
                    className="px-walker"
                    initial={reduce ? false : { x: '-120%' }}
                    animate={{ x: 0 }}
                    transition={{ duration: reduce ? 0 : 1.4, ease: 'easeOut' }}
                  >
                    <PxImg srcs={PX_ASSET.customer(current.portrait ?? 'c1', 'walk')} alt={`ลูกค้า ${current.name}`} className="px-sprite" />
                    <span className="px-ticket" aria-hidden>
                      คิว
                      <b>{caseIndex + 1}</b>
                    </span>
                  </motion.div>
                  <p className="px-nameplate">{current.name}</p>
                </div>
              ) : (
                <>
                  {/* ลูกค้า + ฟองคำพูด */}
                  <div className={cn('px-cust', `is-${page}`, feedback && 'is-result')}>
                    <motion.div
                      key={`${caseIndex}-${mood}`}
                      className="px-cust-sprite"
                      initial={reduce ? false : { scale: 0.96 }}
                      animate={mood === 'happy' && !reduce ? { scale: 1, y: [0, -12, 0] } : { scale: 1 }}
                      transition={{ duration: 0.6 }}
                    >
                      <PxImg srcs={PX_ASSET.customer(current.portrait ?? 'c1', mood)} alt={`ลูกค้า ${current.name}`} className="px-sprite" />
                      {mood === 'confused' ? (
                        <span className="px-qmark" aria-hidden>
                          ?
                        </span>
                      ) : null}
                    </motion.div>
                    {page === 'stamp' && !feedback ? <PxImg srcs={PX_ASSET.dome('thinking')} className="px-dome-mini" /> : null}
                    <AnimatePresence mode="wait">
                      {say ? (
                        <motion.p
                          key={say}
                          className="px-speech"
                          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={reduce ? undefined : { opacity: 0 }}
                          transition={spring}
                        >
                          {say}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={feedback ? `fb-${feedback.kind}` : page}
                      className="px-fore"
                      initial={reduce ? false : { y: 60, scale: 0.9, opacity: 0 }}
                      animate={{ y: 0, scale: 1, opacity: 1 }}
                      exit={reduce ? undefined : { y: -16, opacity: 0 }}
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }}
                    >
                      {feedback ? (
                        feedback.kind === 'right' ? (
                          <div className="px-card px-card--clip px-result is-good">
                            <div className="px-result-head">
                              <span className="px-kicker">ผลลัพธ์</span>
                              {stampInfo ? <span className={cn('px-stamp-tag', `is-${stampInfo.id}`)}>{stampInfo.label}</span> : null}
                            </div>
                            <small className="px-muted">{stamp === 'approve' ? 'โดเมนที่อนุมัติ' : 'โดเมนที่แนะนำ'}</small>
                            <p className="px-bigdomain" dir="auto">
                              {resultDomain}
                            </p>
                            <ul className="px-checks">
                              <li>จัดชั้นนามสกุลถูกครบ</li>
                              <li>ตราตรงกับคุณสมบัติลูกค้า</li>
                              {reasonOk === true ? <li>บอกเหตุผลลูกค้าได้ถูกต้อง</li> : null}
                            </ul>
                            {reasonOk === false ? <p className="px-note px-note--warn">เหตุผลที่บอกลูกค้ายังไม่ตรงกับคู่มือ ลองเทียบอีกทีกับลูกค้าคนต่อไป</p> : null}
                            <div className="px-gift">
                              <i className="px-ico px-ico--gift" aria-hidden />
                              <b>+{feedback.points} คะแนน</b>
                              <small>{feedback.points === 2 ? 'ตัดสินถูกตั้งแต่ครั้งแรก' : 'แก้ได้ถูกในรอบที่ 2'}</small>
                            </div>
                          </div>
                        ) : (
                          <div className="px-card px-card--clip px-result is-bad">
                            <div className="px-result-head">
                              <span className="px-kicker">ผลลัพธ์</span>
                              <span className="px-muted">{feedback.kind === 'retry' ? 'ลองได้อีก 1 ครั้ง' : `ได้ ${feedback.points} คะแนน`}</span>
                            </div>
                            <p className="px-result-line" dir="auto">
                              <i className="px-ico px-ico--globe" aria-hidden /> {wanted}
                            </p>
                            {stampInfo ? (
                              <p className={cn('px-result-stamp', `is-${stampInfo.id}`)}>
                                {stampInfo.label}
                                {needsExt && extension ? ` ${extension}` : ''}
                              </p>
                            ) : null}
                            <p className="px-result-x">
                              {feedback.kind === 'retry'
                                ? feedback.wrongTags.length > 0
                                  ? `ระบบไม่รับ จัดชั้นนามสกุลยังไม่ตรง ${feedback.wrongTags.length} ชื่อ`
                                  : 'ระบบไม่รับ ตรานี้ยังไม่ตรงกับคุณสมบัติของลูกค้า'
                                : feedback.text || 'ยังไม่ตรงกับเงื่อนไขในคู่มือ'}
                            </p>
                            {reasonOk === false ? <p className="px-note px-note--warn">เหตุผลที่เลือกก็ยังไม่ตรงกับคู่มือ</p> : null}
                            {error ? (
                              <p role="alert" className="px-note px-note--warn">
                                {error}
                              </p>
                            ) : null}
                            <div className="px-dome-say">
                              <PxImg srcs={PX_ASSET.dome('thinking')} className="px-dome-face" />
                              <p>
                                {feedback.kind === 'retry'
                                  ? 'ลองหันซ้ายเปิดคู่มือ ดูชั้นของนามสกุลที่ลูกค้าขอ แล้วเทียบกับคำตอบของเขานะ'
                                  : 'ไม่เป็นไร อ่านเหตุผลแล้วลองกับลูกค้าคนต่อไปนะ'}
                              </p>
                            </div>
                          </div>
                        )
                      ) : page === 'card' ? (
                        <div className="px-card px-card--clip px-request">
                          <h2 className="px-card-title">ใบคำขอจดโดเมน</h2>
                          <div className="px-who">
                            <span className="px-photo">
                              <PxImg srcs={PX_ASSET.customer(current.portrait ?? 'c1', 'neutral')} alt="" className="px-sprite" />
                            </span>
                            <dl>
                              <dt>ชื่อ</dt>
                              <dd>{current.name}</dd>
                              <dt>ธุรกิจ</dt>
                              <dd>{current.business}</dd>
                            </dl>
                          </div>
                          <small className="px-muted">ชื่อโดเมนที่ต้องการ</small>
                          <p className="px-bigdomain" dir="auto">
                            {wanted}
                          </p>
                          <div className="px-tagbox" role="group" aria-label="จัดชั้นนามสกุลให้ชื่อบนใบคำขอ">
                            <p className="px-tagbox-title">ชื่อนี้อยู่ชั้นไหนของคู่มือ</p>
                            {current.domains.map((d) => (
                              <div key={d.name} className={cn('px-tagrow', attempt === 2 && wrongHint.includes(d.name) && 'is-wrong')}>
                                <span className="px-tagrow-name" dir="auto">
                                  {d.label}
                                  <small>{d.role}</small>
                                </span>
                                <span className="px-seg" role="radiogroup" aria-label={`ชั้นของ ${d.label}`}>
                                  {data.categories.map((c, i) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      role="radio"
                                      aria-checked={tags[d.name] === c.id}
                                      className={cn(tags[d.name] === c.id && 'is-on', `cat-${i}`)}
                                      onClick={() => {
                                        sfx('ok')
                                        setTags((t) => ({ ...t, [d.name]: c.id }))
                                      }}
                                    >
                                      {SHELF[i] ?? c.label}
                                    </button>
                                  ))}
                                </span>
                              </div>
                            ))}
                            {attempt === 2 && wrongHint.length > 0 ? <p className="px-note px-note--warn">ชื่อที่ขอบสีส้มยังอยู่ผิดชั้น ลองเลือกใหม่</p> : null}
                          </div>
                          <div className="px-unknowns">
                            <div>
                              <small>เอกสารที่มี ?</small>
                              <b className={cn(docs.length ? 'is-known' : '')}>{docs.length ? docs.join(' · ') : '?'}</b>
                            </div>
                            <div>
                              <small>ประเภทผู้ขอ ?</small>
                              <b className={cn(who ? 'is-known' : '')}>{who ?? '?'}</b>
                            </div>
                          </div>
                          {attempt === 1 ? (
                            <button type="button" className="px-link" disabled={!allTagged} onClick={() => setPage('stamp')}>
                              ข้ามไปประทับตราเลย ›
                            </button>
                          ) : null}
                        </div>
                      ) : page === 'interview' ? (
                        <div className="px-interview">
                          <div className="px-card px-card--clip px-card--compact">
                            <dl className="px-fields">
                              <div>
                                <dt>
                                  <i className="px-ico px-ico--person" aria-hidden />
                                  ชื่อ
                                </dt>
                                <dd>{current.name}</dd>
                              </div>
                            </dl>
                            {fieldRows}
                          </div>
                          {exchanges.length > 0 || miss ? (
                            <div className="px-chat" ref={chatRef} aria-live="polite">
                              {exchanges.map((q) => (
                                <div key={q.id} className="px-pair">
                                  <p className="px-ask-me">{q.text}</p>
                                  <p className="px-ask-them">{q.reply}</p>
                                </div>
                              ))}
                              {miss ? (
                                <div className="px-pair">
                                  <p className="px-ask-me">{miss}</p>
                                  <p className="px-ask-them">ขอโทษ{p || 'นะ'} ไม่แน่ใจว่าถามเรื่องอะไร ลองถามใหม่ได้ไหม</p>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="px-card px-askpanel">
                            <p className="px-ask-title">
                              สัมภาษณ์ลูกค้า <span>ถามได้อีก {left} ครั้ง</span>
                            </p>
                            {left <= 0 ? (
                              <p className="px-note px-note--ok">ถามครบ {data.maxQuestions} ข้อแล้ว กดไปประทับตราได้เลย</p>
                            ) : (
                              <>
                                <div className="px-qgrid">
                                  {current.questions
                                    .filter((q) => !asked.includes(q.id))
                                    .map((q) => (
                                      <button key={q.id} type="button" className="px-qchip" onClick={() => ask(q.id)}>
                                        {q.text}
                                      </button>
                                    ))}
                                </div>
                                <form
                                  className="px-typebox"
                                  onSubmit={(e) => {
                                    e.preventDefault()
                                    sendTyped()
                                  }}
                                >
                                  <input aria-label="พิมพ์คำถามเอง" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="พิมพ์คำถามเอง" />
                                  <button type="submit" disabled={!typed.trim()} aria-label="ส่งคำถาม">
                                    ›
                                  </button>
                                </form>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="px-stampdesk">
                          <div className="px-card px-card--clip px-card--compact">
                            {fieldRows}
                            <div className="px-paper-ink">
                              <AnimatePresence>
                                {stamping && stampInfo ? (
                                  <motion.span
                                    className={cn('px-ink', `is-${stampInfo.id}`)}
                                    initial={reduce ? false : { scale: 2.6, opacity: 0, rotate: -26, y: -40 }}
                                    animate={{ scale: 1, opacity: 0.94, rotate: -6, y: 0 }}
                                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
                                    aria-hidden
                                  >
                                    {stampInfo.label}
                                    {needsExt && extension ? ` ${extension}` : ''}
                                  </motion.span>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          </div>
                          <div className="px-stamps" role="radiogroup" aria-label="ตรายาง">
                            {data.stamps.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                role="radio"
                                aria-checked={stamp === s.id}
                                disabled={locked}
                                title={s.hint}
                                className={cn('px-stamp', `is-${s.id}`, stamp === s.id && 'is-on', stamping && stamp === s.id && 'is-press')}
                                onClick={() => {
                                  sfx('tap')
                                  setStamp(s.id)
                                  if (!s.needsExtension) setExtension(null)
                                }}
                              >
                                <span className="px-stamp-art" aria-hidden>
                                  <PxImg srcs={PX_ASSET.stamp(s.id)} className="px-stamp-img" />
                                  <i className="px-stamp-knob" />
                                </span>
                                <b>{s.label}</b>
                              </button>
                            ))}
                          </div>
                          {needsExt ? (
                            <div className="px-card px-offer">
                              <p className="px-pill-title">{stamp === 'first-step' ? 'ให้จดก่อน' : 'เสนอเป็น'}</p>
                              <div className="px-radios" role="radiogroup" aria-label="นามสกุลที่เสนอ">
                                {current.extensionOptions
                                  .filter((x) => !wanted.endsWith(x))
                                  .map((ext) => (
                                    <button
                                      key={ext}
                                      type="button"
                                      role="radio"
                                      aria-checked={extension === ext}
                                      disabled={locked}
                                      className={cn('px-radio', extension === ext && 'is-on')}
                                      onClick={() => {
                                        sfx('tap')
                                        setExtension(ext)
                                      }}
                                    >
                                      <i aria-hidden />
                                      {ext}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          ) : null}
                          {stamp ? (
                            <div className="px-card px-reasons" role="radiogroup" aria-label="เหตุผลที่บอกลูกค้า">
                              <p className="px-pill-title">เหตุผลที่บอกลูกค้า</p>
                              {reasons.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={reason === r.id}
                                  disabled={locked}
                                  className={cn('px-reason', reason === r.id && 'is-on')}
                                  onClick={() => {
                                    sfx('tap')
                                    setReason(r.id)
                                  }}
                                >
                                  <i className="px-ico px-ico--bulb" aria-hidden />
                                  {r.text}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {error ? (
                            <p role="alert" className="px-note px-note--warn">
                              {error}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              )}
            </section>

            {/* ---------- หันขวา: โต๊ะโดม ---------- */}
            <section className="px-view px-view--dome" aria-label="โต๊ะโดม ขอคำใบ้" aria-hidden={look !== 'dome'} inert={look !== 'dome'}>
              <div className="px-domedesk">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={hintLog.length}
                    className="px-dome-bubble"
                    aria-live="polite"
                    initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    transition={spring}
                  >
                    {hintLog.length === 0 ? `ติดตรงไหนถามได้นะ ใบ้ได้ ${hintsTotal} ครั้งต่อกะ โดมจะชวนคิด ไม่บอกคำตอบ` : hintLog[hintLog.length - 1]}
                  </motion.p>
                </AnimatePresence>
                <PxImg srcs={PX_ASSET.dome(hintLog.length ? 'thinking' : 'neutral')} alt="โดม" className="px-dome-big" />
                <span className="px-hint-sign">
                  คำใบ้เหลือ
                  <b>
                    {hintsLeft}/{hintsTotal}
                  </b>
                </span>
              </div>
              <PxBtn tone="cream" onClick={askDome} disabled={hintsLeft <= 0}>
                {hintsLeft > 0 ? `ขอคำใบ้เรื่อง${STEP_LABEL[step]}` : 'ใช้คำใบ้ครบแล้ว'}
              </PxBtn>
            </section>
          </div>
        </main>

        <div className="px-dock">{dock}</div>
      </div>
      {exit.dialog}
    </div>
  )
}

/* ---------- รายงานจบกะ ---------- */

function isDetail(value: unknown): value is CounterDetail {
  return !!value && typeof value === 'object' && Array.isArray((value as CounterDetail).cases) && typeof (value as CounterDetail).tagAccuracy === 'number'
}

export function PixelReport({
  data,
  result,
  stats,
  selfCard,
  rounds,
  weak,
  onRetry,
  onRemedial,
  onFinish,
  onExit,
}: {
  data: CounterData
  result: { score: number; passed: boolean; detail: unknown }
  stats: { handbook: number; dome: number }
  selfCard: { extension: string; reason: string } | null
  rounds: number
  weak: CounterCategory[]
  onRetry: () => void
  onRemedial: () => void
  onFinish: () => void
  onExit?: () => void
}) {
  const { reduce } = useGameMotion()
  const exit = useExitConfirm(onExit)
  const [soundOn, toggleSound] = useM3Sound()
  const clock = useShiftClock()
  const [open, setOpen] = useState<string | null>(null)
  const detail = isDetail(result.detail) ? result.detail : null
  const byId = new Map<string, CounterCaseResult>((detail?.cases ?? []).map((c) => [c.caseId, c]))
  const perfect = !!detail && detail.stampPoints === detail.stampMax && detail.tagAccuracy === 1
  const stars = result.passed ? (perfect ? 3 : rounds > 0 ? 1 : 2) : result.score > 0 ? 1 : 0
  const groupLabel = (id: string) => {
    const i = data.categories.findIndex((c) => c.id === id)
    return SHELF[i] ?? data.categories[i]?.label ?? id
  }
  const ok = (id: string) => {
    const r = byId.get(id)
    return !!r && r.stampCorrect && r.tagsCorrect === r.tagsTotal
  }
  const happy = data.cases.filter((c) => ok(c.id)).length
  const keyPct = detail && detail.cases.length > 0 ? Math.round((detail.cases.filter((c) => c.askedKeyQuestion).length / detail.cases.length) * 100) : 0
  const reasonRows = (detail?.cases ?? []).filter((c) => typeof c.reasonCorrect === 'boolean')
  const reasonHits = reasonRows.filter((c) => c.reasonCorrect).length

  useEffect(() => {
    sfx(result.passed ? 'win' : 'bad')
  }, [result.passed])

  const metrics = [
    { k: 'ลูกค้าพอใจ', v: `${happy}/${data.cases.length}`, ico: 'people' },
    { k: 'ถามตรงจุด', v: `${keyPct}%`, ico: 'target' },
    { k: 'ใช้คู่มือ', v: `${stats.handbook} ครั้ง`, ico: 'book' },
    { k: 'ถามโดม', v: `${stats.dome} ครั้ง`, ico: 'dome' },
    ...(reasonRows.length ? [{ k: 'เหตุผลตรง', v: `${reasonHits}/${reasonRows.length}`, ico: 'bulb' }] : []),
  ]

  return (
    <div className="px is-look-counter is-report" aria-label="รายงานจบกะ">
      <div className="px-world" aria-hidden>
        <div className="px-world-track" style={{ transform: 'translateX(-33.3333%)' }}>
          <div className="px-bg px-bg--book" />
          <div className="px-bg px-bg--counter is-soft" style={{ backgroundImage: cssBg(PX_ASSET.bg.counter) }} />
          <div className="px-bg px-bg--dome" />
        </div>
      </div>
      <div className="px-stage">
        <GameHeader title="ภารกิจที่ 3" subtitle={result.passed ? 'รายงานจบกะ · ผ่าน' : 'รายงานจบกะ · เกือบแล้ว'} onBack={exit.open} soundOn={soundOn} onSound={toggleSound} />
        <PxHud clock={clock} queue={{ at: data.cases.length, total: data.cases.length }} coins={detail?.stampPoints ?? 0} />
        <main className="px-scroll">
          <motion.div
            className="px-card px-card--clip px-report"
            initial={reduce ? false : { y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          >
            <h2 className="px-card-title">{result.passed ? 'รายงานจบกะ' : 'รายงานจบกะ · เกือบแล้ว'}</h2>
            <div className="px-report-stars">
              <Stars count={stars} size={44} />
              <span className="px-score">
                <CountUp to={result.score} /> คะแนน
              </span>
            </div>
            <ul className="px-metrics">
              {metrics.map((m) => (
                <li key={m.k}>
                  <i className={cn('px-ico', `px-ico--${m.ico}`)} aria-hidden />
                  <span>{m.k}</span>
                  <b>{m.v}</b>
                </li>
              ))}
            </ul>
            {detail ? (
              <ul className="px-groups" aria-label="ผลจัดชั้นนามสกุล">
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
              <p className="px-weak">
                ชั้นที่พลาด
                {weak.map((w) => (
                  <span key={w}>{groupLabel(w)}</span>
                ))}
              </p>
            ) : null}
            {selfCard ? (
              <div className="px-mycard">
                <small>บัตรนามสกุลของฉัน</small>
                <b>{selfCard.extension}</b>
                <span>{selfCard.reason}</span>
              </div>
            ) : null}
          </motion.div>

          <div className="px-card px-cases">
            <p className="px-pill-title">ดูรายลูกค้า</p>
            <ul>
              {data.cases.map((c) => {
                const r = byId.get(c.id)
                const good = ok(c.id)
                return (
                  <li key={c.id} className={cn(good ? 'is-good' : 'is-warn')}>
                    <button type="button" aria-expanded={open === c.id} onClick={() => setOpen((o) => (o === c.id ? null : c.id))}>
                      <span className="px-case-face">
                        <PxImg srcs={PX_ASSET.customer(c.portrait ?? 'c1', good ? 'happy' : 'confused')} className="px-sprite" />
                      </span>
                      <b>{c.name}</b>
                      <small>
                        {r
                          ? `${r.points} แต้ม · ชั้น ${r.tagsCorrect}/${r.tagsTotal}${typeof r.reasonCorrect === 'boolean' ? ` · เหตุผล${r.reasonCorrect ? 'ตรง' : 'ยังไม่ตรง'}` : ''}`
                          : ''}
                      </small>
                      <em>{good ? '✓' : '!'}</em>
                    </button>
                    {open === c.id && r ? <p>{r.explanation}</p> : null}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="px-report-dome">
            <PxImg srcs={PX_ASSET.dome(result.passed ? 'cheer' : 'thinking')} alt="โดม" className="px-dome-big" />
            <p className="px-dome-bubble">
              {result.passed
                ? 'เก่งมากเจ้าหน้าที่ ด่านต่อไปเราจะไปจดชื่อเว็บจริงกัน'
                : `เกือบแล้ว มาฝึก${weak.length ? `ชั้น${groupLabel(weak[0]!)}` : 'จัดชั้น'}อีกนิด แล้วเข้ากะใหม่นะ`}
            </p>
          </div>
        </main>
        <div className="px-dock">
          {result.passed ? (
            <div className="px-stack">
              <PxBtn onClick={onFinish}>ไปด่านต่อไป ›</PxBtn>
              {weak.length > 0 ? (
                <PxBtn tone="cream" onClick={onRemedial}>
                  ฝึกชั้นที่พลาด 30 วินาที
                </PxBtn>
              ) : null}
            </div>
          ) : (
            <div className="px-stack">
              <PxBtn tone="gold" onClick={onRemedial}>
                เริ่มฝึก 30 วินาที ›
              </PxBtn>
              <PxBtn tone="cream" onClick={onRetry}>
                เข้ากะใหม่เลย
              </PxBtn>
            </div>
          )}
        </div>
      </div>
      {exit.dialog}
    </div>
  )
}

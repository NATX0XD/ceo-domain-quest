'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  DomeAvatar,
  StarIcon,
  UsersIcon,
} from '../../../components/ui'
import { Dialog } from './dialog'

/**
 * UX-6 ห้องของครูแบบ "แผงคุมคาบ" — จอเดียว ไม่ต้องเลื่อน สวยพอขึ้นเวที และบอกได้ว่าต้องทำอะไรต่อ
 *
 * โจทย์: ครูยืนหน้าห้อง เด็ก 20 คนรออยู่ เหลือ 7 นาที · บางทีถือมือถือเดินดูเด็ก
 * ต้องรู้ในแวบเดียวว่า ห้องอยู่ช่วงไหน · เหลือกี่นาที · ใครต้องเดินไปหาก่อน · ใครรอตรวจ
 *
 * ── แบบอ้างอิงที่ไปดูมาก่อนออกแบบ (สรุปเต็ม + URL อยู่ที่ scratchpad/ref-teacher-ui.md) ──
 * 1. **IXL Live Classroom** — แถบตัวเลขสรุปหลายช่อง แต่ละช่องมีไอคอน + ตัวเลขสี + คำกำกับตัวเล็ก
 *    และมี**ขีดสีที่ขอบ** ไม่ถมสีทั้งช่อง · การ์ดนักเรียนมี**ตัวเลขใหญ่ชิดขวา**เป็นจุดนำสายตา ·
 *    **ขาว = ปกติ สี = ผิดปกติเท่านั้น** ครูจึงกวาดตาเจอคนที่ต้องช่วยก่อน
 * 2. **Microsoft Teams Education Insights** — บนสุดเป็น "Spotlight card" ที่ระบบสรุปให้เองว่าตอนนี้
 *    ควรดูเรื่องอะไร พร้อมสีระดับ (แดง/เหลือง/เขียว) ไม่ให้ครูต้องตีความเอง
 * 3. **GoGuardian Teacher / Pear Deck** — ตารางการ์ดนักเรียนเห็นทั้งห้องในจอเดียว + **กรองให้เหลือ
 *    เฉพาะกลุ่มที่สนใจ** และให้ครูลงมือกับรายคนได้จากจอเดียวกับที่กวาดตา
 * 4. **Classroomscreen** — นาฬิกาคือของที่ใหญ่ที่สุดบนจอ เพราะทั้งห้องมองบ่อยที่สุด
 * 5. กติกาแดชบอร์ดที่มีตัวเลขกำกับ (improvado / datacamp / artofstyleframe):
 *    ตัวเลขบนจอ 5-9 ตัว · ตัวเลขหลักใหญ่กว่าตัวรอง 2-3 เท่า · ที่ว่าง 30-40% ·
 *    ห่างระหว่างชิ้น 16px · **การ์ดห้ามมีแถบเลื่อนของตัวเอง** · สีความหมายสงวนให้สถานะเท่านั้น ·
 *    ต้องอ่านรู้เรื่องแม้เป็นขาวดำ · กฎ 10 วินาที
 *
 * ── เกณฑ์จาก skill ui-ux-pro-max (Accessibility + Touch & Interaction = ระดับวิกฤต) ──
 * พื้นที่แตะ ≥ 44 และห่างกัน ≥ 8 · `touch-action: manipulation` · โฟกัสคีย์บอร์ดเห็นชัด ·
 * ปุ่มไอคอนมี aria-label · **สีไม่ใช่ตัวบอกสถานะตัวเดียว** ทุกจุดมีตัวหนังสือกำกับ ·
 * ไอคอนเป็น SVG ไม่ใช่อิโมจิ · เปลี่ยนสถานะด้วยสี/เงา 200ms ไม่ใช่ขยับขนาดจนเลย์เอาต์ขยับ
 *
 * ── ความสวยกับการบอกทางต้องมาด้วยกัน (มติเจ้าของ UX-6) ──
 * ข้อความบอกทางไม่ใช่ตัวหนังสือเทาแปะเพิ่ม แต่เป็นการ์ดของ **โดม** (เลขาประจำระบบ) ที่มีสีตาม
 * ระดับความด่วนและมีปุ่มพาไปจุดนั้นจริง · แถบสถานะคาบเป็นการ์ดไล่สีมีแถบเวลาเดินจริง
 * · ช่องที่ยังไม่มีข้อมูลก็มีโดมกับประโยคพาไปต่อ ไม่ปล่อยเป็นจอว่าง
 *
 * ⚠️ ทุกค่าบนจอนี้มาจาก API จริง: `/api/teacher/board` · `/api/teacher/session` ·
 *    `/api/plan-request` · `/api/jobs/drain` — **ไม่มีตัวเลขไหนฝังไว้ในหน้าจอ**
 *    แม้แต่ความยาวของแต่ละช่วงก็อ่านจาก `session.phase_minutes` ที่ครูตั้งไว้จริง
 */

const POLL_MS = 3000
const QUEUE_POLL_MS = 10000

/**
 * ความยาวช่วงสำรอง — ใช้เฉพาะตอนคาบยังไม่มีแผนเวลาของตัวเอง
 * ค่าจริงมาจาก `session.phase_minutes` (คอลัมน์ที่ครูตั้งได้ T-02) เสมอถ้ามี
 */
const FALLBACK_PHASE_MINUTES: Record<string, number> = {
  wait: 0,
  onboard: 5,
  mission: 20,
  boss: 10,
  summary: 5,
  reflect: 5,
  end: 0,
  home: 0,
}

interface PhaseOption {
  phase: string
  label: string
}

interface SessionInfo {
  id: string
  phase: string
  timer_end_at: string | null
  timer_paused_seconds: number | null
  focus_screen: boolean
  survey_enabled: boolean
  ended_at: string | null
  /** แผนเวลาต่อช่วงที่ครูตั้งไว้จริง — null = ยังไม่ได้ตั้ง */
  phase_minutes: Record<string, number> | null
}

type Level = 'green' | 'yellow' | 'orange' | 'red'

interface CoachCard {
  question: string
  followUpQuestion: string
  watchFor: string
  avoidSaying: string
  encouragement?: string | null
}

interface BoardRow {
  studentId: string
  nickname: string
  businessName: string | null
  learningRoute: string | null
  scaffoldLevel: number | null
  goalStatus: string
  goalStars: number | null
  earnedStars: number | null
  currentMission: {
    missionId: string
    title: string
    attempts: number
    hintsUsed: number
    maxHints: number
    solved: boolean
  } | null
  idleSeconds: number
  /** ข้อความ "นิ่งมานานแค่ไหน" ที่เซิร์ฟเวอร์เขียนให้แล้ว (จอไม่คิดเอง) */
  idleLabel: string
  /** ไม่ได้ขยับนานกว่าหนึ่งคาบ = ไม่ใช่คนที่ต้องรีบไปตามกลางคาบ */
  awayFromClass: boolean
  /** ประโยคสั้น ๆ ว่ากำลังทำอะไรอยู่ — เขียนตามจริงจากฝั่งเซิร์ฟเวอร์ */
  progressLabel: string
  pendingReview: boolean
  askedForHelp: boolean
  helpMissionId: string | null
  /** ระดับความด่วนที่เซิร์ฟเวอร์ตัดสินแล้ว + ชื่อไทย — จอไม่ตัดสินเอง */
  attention: { level: Level; name: string }
  flag: {
    flagged: boolean
    level: Level | null
    label: string | null
    reasonName: string | null
    teacherNote: string | null
  }
  coachCard: CoachCard | null
}

interface NextStep {
  tone: 'danger' | 'spark' | 'brand' | 'quest'
  text: string
  action: 'help' | 'requests' | 'review' | null
  actionLabel: string | null
}

interface BoardResponse {
  students: number
  /** "ตอนนี้ครูควรทำอะไรต่อ" — เซิร์ฟเวอร์จัดลำดับความด่วนให้ ไม่ใช่จอคิดเอง */
  nextStep: NextStep
  /** คำขอเปลี่ยนแผนที่ยังไม่ได้ตอบ — นับจาก API เดียวกับที่หน้าคำขออ่าน */
  requests: number
  flagged: number
  needsHelp: number
  /** คนที่ต้องเดินไปหาก่อน — เซิร์ฟเวอร์นับให้ ไม่ใช่จอนับเอง */
  needAttention: number
  stuck: number
  watching: number
  shouldTalk: number
  shouldPraise: number
  pendingReview: number
  board: BoardRow[]
}

interface QueueCounts {
  pending: number
  running: number
  done: number
  failed: number
}

/**
 * สีของสถานะ — ชุดเดียวกับแผงห้องเรียนสด ครูจะได้จำสีชุดเดียวทั้งสองจอ
 *
 * ตามแบบ IXL: **ขาวคือปกติ** ถมสีเฉพาะคนที่ต้องเข้าไปช่วยจริง ๆ (แดง)
 * ระดับรอง ๆ ใช้ **ขีดสีด้านซ้าย** แทนการถมทั้งใบ ไม่งั้นทั้งจอเป็นสีจนไม่มีอะไรเด่น
 * ทุกระดับมี `name` เป็นตัวหนังสือกำกับเสมอ เพราะสีอย่างเดียวใช้เป็นตัวบอกสถานะไม่ได้
 */
const LEVEL: Record<Level, { name: string; dot: string; bar: string; card: string; order: number }> =
  {
    red: {
      name: 'ต้องช่วยด่วน',
      dot: 'bg-danger-600',
      bar: 'bg-danger-600',
      card: 'bg-danger-100 ring-danger-300',
      order: 0,
    },
    orange: {
      name: 'ติดแล้ว เตรียมเดินไปหา',
      dot: 'bg-spark-600',
      bar: 'bg-spark-600',
      card: 'bg-surface-raised ring-line',
      order: 1,
    },
    yellow: {
      name: 'ควรดู',
      dot: 'bg-spark-400',
      bar: 'bg-spark-400',
      card: 'bg-surface-raised ring-line',
      order: 2,
    },
    green: {
      name: 'ปกติ',
      dot: 'bg-quest-500',
      bar: 'bg-quest-500',
      card: 'bg-surface-raised ring-line',
      order: 3,
    },
  }

const ROUTE_LABEL: Record<string, string> = {
  clip: 'ดูคลิป',
  card: 'อ่านการ์ด',
  game: 'เล่นเกม',
  buddy: 'เรียนกับเพื่อน',
}

/**
 * ระดับความด่วนของแถวนี้ — **อ่านจากที่เซิร์ฟเวอร์ตัดสินมาแล้ว** (UAT-7 ข้อ ข-8)
 * ของเดิมจอตัดสินซ้ำเอง ("กดขอครู = แดง") ถ้าวันหน้าเกณฑ์ฝั่งเซิร์ฟเวอร์เปลี่ยน จอจะยังทับด้วยกฎเก่า
 * `flag.level` เก็บไว้เป็นทางถอยเฉพาะตอนคุยกับ API รุ่นเก่าที่ยังไม่มี `attention`
 */
function levelOf(row: BoardRow): Level {
  return row.attention?.level ?? row.flag.level ?? 'green'
}

/** ชื่อไทยของระดับ — ใช้ของที่ API ส่งมาก่อนเสมอ จอมีไว้เป็นทางถอยเท่านั้น */
function levelName(row: BoardRow): string {
  return row.attention?.name ?? LEVEL[levelOf(row)].name
}

function mmss(total: number | null): string {
  if (total === null) return '--:--'
  const safe = Math.max(0, total)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

/** ปุ่มเล็กบนการ์ดนาฬิกา — ตัวอักษรบนพื้นเข้ม สูง 44 และห่างกัน 8 ตามเกณฑ์การแตะ */
function TimerChip({
  label,
  onClick,
  disabled,
  ariaLabel,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex min-h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg bg-surface-raised/20 px-3 text-label font-bold text-ink-onbrand ring-1 ring-ink-onbrand/50 ring-inset transition-colors duration-200 hover:bg-surface-raised/25 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink-onbrand disabled:opacity-50"
    >
      {label}
    </button>
  )
}

/**
 * ช่องตัวเลขสรุปหนึ่งช่อง — ตามแบบ IXL: ขีดสีที่ขอบบน + ไอคอน + ตัวเลขใหญ่ + คำกำกับตัวเล็ก
 * ไม่ถมสีทั้งช่อง เพื่อให้สีที่ถมจริง ๆ (การ์ดคนที่ต้องช่วย) เด่นอยู่เจ้าเดียวบนจอ
 */
function MetricCell({
  label,
  count,
  tone,
  icon,
  onClick,
  href,
}: {
  label: string
  count: number
  tone: 'quest' | 'danger' | 'spark' | 'brand'
  icon: ReactNode
  /** กดแล้วเปิด popup ในหน้านี้ */
  onClick?: () => void
  /** กดแล้วไปหน้าอื่นของแดชบอร์ด (งานรอตรวจ · คำขอ) */
  href?: string
}) {
  const active = count > 0
  const accent = {
    quest: 'bg-quest-500',
    danger: 'bg-danger-600',
    spark: 'bg-spark-500',
    brand: 'bg-brand-600',
  }[tone]
  const number = {
    quest: 'text-quest-700',
    danger: 'text-danger-700',
    spark: 'text-spark-800',
    brand: 'text-brand-700',
  }[tone]

  const inner = (
    <>
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <span className={`flex items-center gap-1.5 ${active ? number : 'text-ink-muted'}`}>
        {icon}
        <span className="text-display leading-none font-extrabold tabular-nums">{count}</span>
      </span>
      <span className="mt-1 text-note leading-tight font-bold text-ink-muted">{label}</span>
    </>
  )

  const shared =
    'relative flex min-h-20 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl px-2 pt-2 pb-1.5 bg-surface-raised ring-1 ring-line ring-inset'

  const interactive = `${shared} cursor-pointer touch-manipulation transition-shadow duration-200 hover:shadow-soft-1 focus-ring`
  if (href) {
    return (
      <Link href={href} className={interactive}>
        {inner}
      </Link>
    )
  }
  if (!onClick) return <div className={shared}>{inner}</div>
  return (
    <button type="button" onClick={onClick} className={interactive}>
      {inner}
    </button>
  )
}

export function TeacherCockpit({
  classroomId,
  roomCode,
  pendingCount,
  hasOpenSession,
  alertsSlot,
}: {
  classroomId: string | null
  roomCode: string | null
  /** จำนวนงานรอตรวจ ณ ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ — ตัวเลขสดมาจากแผงสดอีกที */
  pendingCount: number
  /** มีคาบเดินอยู่ไหม (อ่านฝั่งเซิร์ฟเวอร์แบบไม่สร้างคาบใหม่) */
  hasOpenSession: boolean
  /** ของที่ต้องเห็นตลอด — ป้ายโหมดสาธิต + ข้อความที่ต้องดูแล (ไม่มีอะไรก็ไม่กินที่) */
  alertsSlot: ReactNode
}) {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [phases, setPhases] = useState<PhaseOption[]>([])
  const [seconds, setSeconds] = useState<number | null>(null)
  const [board, setBoard] = useState<BoardResponse | null>(null)
  const [queue, setQueue] = useState<QueueCounts | null>(null)
  const [queueBusy, setQueueBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'help' | 'review'>('all')

  const [openDialog, setOpenDialog] = useState<'phase' | 'help' | null>(null)
  const [openStudent, setOpenStudent] = useState<string | null>(null)
  const lastPhaseChangeRef = useRef(0)
  const [undoLeft, setUndoLeft] = useState(0)

  const loadSession = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/session?classroomId=${classroomId}`)
      if (!res.ok) return
      const data = (await res.json()) as { session?: SessionInfo; phases?: PhaseOption[] }
      if (data.session) {
        setSession(data.session)
        const paused = data.session.timer_paused_seconds !== null
        setSeconds(
          paused
            ? data.session.timer_paused_seconds
            : data.session.timer_end_at
              ? Math.max(
                  0,
                  Math.round((new Date(data.session.timer_end_at).getTime() - Date.now()) / 1000),
                )
              : null,
        )
      }
      if (data.phases) setPhases(data.phases)
    } catch {
      // เน็ตสะดุดรอบเดียว รอบถัดไปค่อยว่ากัน ไม่ล้างของเดิมทิ้ง
    }
  }, [classroomId])

  const loadBoard = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/board?classroomId=${classroomId}`, { cache: 'no-store' })
      if (!res.ok) return
      setBoard((await res.json()) as BoardResponse)
    } catch {
      // เหมือนกัน
    }
  }, [classroomId])

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs/drain', { cache: 'no-store' })
      if (!res.ok) return
      setQueue((await res.json()) as QueueCounts)
    } catch {
      // เหมือนกัน
    }
  }, [])

  useEffect(() => {
    void loadSession()
    void loadBoard()
    const id = setInterval(() => {
      void loadSession()
      void loadBoard()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [loadSession, loadBoard])

  useEffect(() => {
    void loadQueue()
    const id = setInterval(() => void loadQueue(), QUEUE_POLL_MS)
    return () => clearInterval(id)
  }, [loadQueue])

  // นับถอยหลังในเครื่องให้ตัวเลขเดินลื่น ค่าจริงยังมาจากเซิร์ฟเวอร์ทุกรอบ poll
  useEffect(() => {
    if (seconds === null || session?.timer_paused_seconds !== null) return
    const id = setInterval(() => setSeconds((s) => (s === null ? null : Math.max(0, s - 1))), 1000)
    return () => clearInterval(id)
  }, [seconds === null, session?.timer_paused_seconds])

  useEffect(() => {
    const id = setInterval(() => {
      const left = 30 - Math.round((Date.now() - lastPhaseChangeRef.current) / 1000)
      setUndoLeft(lastPhaseChangeRef.current === 0 ? 0 : Math.max(0, left))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      if (busy) return null
      setBusy(true)
      setError(null)
      try {
        const res = await fetch('/api/teacher/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          message?: string
          session?: SessionInfo
        } | null
        if (!res.ok || !data?.ok) {
          setError(data?.message ?? 'สั่งงานไม่สำเร็จ ลองใหม่อีกครั้ง')
          return null
        }
        if (data.session) setSession(data.session)
        await loadSession()
        return data
      } catch {
        setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
        return null
      } finally {
        setBusy(false)
      }
    },
    [busy, loadSession],
  )

  /** นาทีของช่วงนั้น — เอาจากแผนเวลาที่ครูตั้งไว้จริงก่อนเสมอ */
  const minutesOf = useCallback(
    (phase: string) => session?.phase_minutes?.[phase] ?? FALLBACK_PHASE_MINUTES[phase] ?? 0,
    [session],
  )

  const goPhase = useCallback(
    async (phase: string) => {
      if (!session) return
      const minutes = minutesOf(phase)
      const done = await send({
        action: 'phase',
        sessionId: session.id,
        phase,
        ...(minutes > 0 ? { timerSeconds: minutes * 60 } : {}),
      })
      if (done) lastPhaseChangeRef.current = Date.now()
    },
    [minutesOf, send, session],
  )

  /** ตั้งเวลาของช่วงนี้ใหม่ตามแผนที่ครูตั้งไว้ — ไม่มีแผนก็ไม่เดาเลขเอง */
  const resetTimer = useCallback(async () => {
    if (!session) return
    const minutes = minutesOf(session.phase)
    if (minutes <= 0) {
      setError('ช่วงนี้ไม่ได้ตั้งเวลาไว้ในแผนคาบ จึงตั้งนาฬิกาใหม่ให้ไม่ได้')
      return
    }
    await send({ action: 'timer', sessionId: session.id, seconds: minutes * 60 })
  }, [minutesOf, send, session])

  const runDrain = useCallback(async () => {
    if (queueBusy) return
    setQueueBusy(true)
    try {
      const res = await fetch('/api/jobs/drain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => null)) as { queue?: QueueCounts } | null
      if (data?.queue) setQueue(data.queue)
      else await loadQueue()
    } catch {
      setError('สั่งตรวจไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setQueueBusy(false)
    }
  }, [loadQueue, queueBusy])

  const rows = useMemo(() => {
    const list = [...(board?.board ?? [])]
    list.sort((a, b) => {
      const diff = LEVEL[levelOf(a)].order - LEVEL[levelOf(b)].order
      return diff !== 0 ? diff : b.idleSeconds - a.idleSeconds
    })
    return list
  }, [board])

  const currentIndex = phases.findIndex((p) => p.phase === session?.phase)
  const currentPhase = currentIndex >= 0 ? phases[currentIndex] : null
  const nextPhase = currentIndex >= 0 ? phases[currentIndex + 1] : null
  /** ตัวนับทุกตัวมาจาก API ไม่ได้นับบนจอ — หน้า /teacher กับ /teacher/board จึงพูดเลขเดียวกัน */
  const redCount = board?.needAttention ?? 0
  const stuckCount = board?.stuck ?? 0
  const planCount = board?.requests ?? 0
  /** "ต้องช่วย" = แดง + ส้ม เท่านั้น — สีเหลืองคือคนที่แค่ควรเหลือบดู ไม่ใช่คนที่ต้องเดินไปหา */
  const needHelpCount = redCount + stuckCount
  const reviewCount = board?.pendingReview ?? pendingCount
  const openRow = rows.find((r) => r.studentId === openStudent) ?? null
  /** ยังไม่เปิดคาบ = บอกครูตรง ๆ แทนที่จะโชว์นาฬิกาว่าง ๆ */
  const noSession = !hasOpenSession && session === null
  const paused = session != null && session.timer_paused_seconds !== null
  const urgent = seconds !== null && seconds <= 60 && !paused

  const shown = useMemo(() => {
    if (filter === 'help') return rows.filter((r) => ['red', 'orange'].includes(levelOf(r)))
    if (filter === 'review') return rows.filter((r) => r.pendingReview)
    return rows
  }, [filter, rows])

  /** แถบเวลาเดินจริงของช่วงนี้ — ความยาวช่วงมาจากแผนที่ครูตั้งไว้ ไม่ใช่เลขสมมติ */
  const phaseTotal = session ? minutesOf(session.phase) * 60 : 0
  const elapsedPercent =
    phaseTotal > 0 && seconds !== null
      ? Math.round(Math.min(1, Math.max(0, (phaseTotal - seconds) / phaseTotal)) * 100)
      : 0

  /**
   * "ตอนนี้ควรทำอะไรต่อ" — **ข้อความและลำดับความด่วนมาจาก API** (UAT-7 ข้อ ข-6)
   * จอมีหน้าที่แค่เลือกสีหน้าโดมกับปลายทางของปุ่มเท่านั้น
   */
  const step = board?.nextStep ?? null
  const stepTone: 'danger' | 'spark' | 'quest' =
    step?.tone === 'danger' ? 'danger' : step?.tone === 'spark' ? 'spark' : 'quest'
  const stepMood: 'greet' | 'cheer' | 'happy' =
    step?.tone === 'quest' ? 'cheer' : 'greet'
  const stepHref =
    step?.action === 'requests'
      ? `/teacher/requests?classroomId=${classroomId}`
      : step?.action === 'review'
        ? `/teacher/review?classroomId=${classroomId}`
        : null

  if (!classroomId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <DomeAvatar mood="greet" size={96} decorative />
        <p className="text-body-lg font-bold text-ink">ยังไม่มีห้องเรียน</p>
        <p className="max-w-sm text-body text-ink-muted">
          กดสร้างห้องจากปุ่มเครื่องมือ แล้วฉายรหัสห้องให้นักเรียนพิมพ์ที่หน้า /join
        </p>
      </div>
    )
  }

  const spotlightTone = {
    danger: 'bg-danger-100 ring-danger-300',
    spark: 'bg-spark-100 ring-spark-300',
    quest: 'bg-quest-100 ring-quest-300',
  }[stepTone]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-3 pt-3 pb-3 sm:gap-4 sm:px-5">
      {alertsSlot}

      {/* ───────── ของที่ครูมองบ่อยที่สุด: ช่วงของคาบ + นาฬิกา */}
      <section
        aria-label="ช่วงของคาบและเวลาที่เหลือ"
        /**
         * การ์ดนี้เป็นสีแบรนด์เสมอ **ไม่เปลี่ยนเป็นสีแดง/ส้มทั้งใบตอนเวลาใกล้หมด**
         * เพราะการถมสีทั้งใบทำให้จอดูเป็นสีโคลนและไปแย่งความเด่นกับ "คนที่ต้องเดินไปช่วย"
         * ความด่วนของเวลาบอกที่**ตัวเลขนาฬิกาเปลี่ยนเป็นสีเหลืองอำพัน + ป้ายกำกับ** ก็พอ
         */
        className="shrink-0 rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-4 shadow-soft-2 sm:p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-note font-bold tracking-wide text-ink-onbrand/90">
              <UsersIcon width={16} height={16} aria-hidden />
              ห้อง {roomCode ?? '—'} · {board?.students ?? 0} คน
            </p>
            <p className="mt-0.5 truncate pb-1 text-display leading-tight font-extrabold text-ink-onbrand">
              {currentPhase?.label ?? (noSession ? 'ยังไม่ได้เปิดคาบ' : 'กำลังอ่านสถานะ…')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ClockIcon
              width={30}
              height={30}
              aria-hidden
              className={`shrink-0 ${urgent ? 'text-spark-200' : 'text-ink-onbrand/90'}`}
            />
            <div>
              <p
                className={`text-note font-bold ${urgent ? 'text-spark-200' : 'text-ink-onbrand/90'}`}
              >
                {paused ? 'หยุดไว้ที่' : seconds === 0 ? 'หมดเวลาช่วงนี้แล้ว' : 'เหลือเวลา'}
              </p>
              <p
                className={`text-hero leading-none font-extrabold tabular-nums ${
                  urgent ? 'text-spark-200' : 'text-ink-onbrand'
                }`}
              >
                {mmss(seconds)}
              </p>
            </div>
          </div>
        </div>

        {/* หมดเวลาแล้วต้องบอกว่าระบบไม่ย้ายช่วงให้เอง ไม่งั้นครูปล่อยห้องค้างทั้งคาบ (flow-1 ข้อ 4) */}
        {seconds === 0 && !paused ? (
          <p className="mt-2 rounded-xl bg-surface-raised/20 px-3 py-2 text-label font-bold text-ink-onbrand">
            หมดเวลาช่วงนี้แล้ว · ระบบไม่ย้ายช่วงให้เอง
            {nextPhase ? ` — กดปุ่ม "ไปช่วงถัดไป · ${nextPhase.label}" ด้านล่างเมื่อพร้อม` : ''}{' '}
            หรือกด +5 ถ้าอยากให้เด็กทำต่อ
          </p>
        ) : null}

        {/* แถบเวลาของช่วง — ความยาวช่วงมาจากแผนเวลาที่ครูตั้งไว้จริง */}
        {phaseTotal > 0 ? (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised/25"
            role="img"
            aria-label={`ช่วงนี้เดินมาแล้ว ${elapsedPercent} เปอร์เซ็นต์ของ ${Math.round(phaseTotal / 60)} นาที`}
          >
            <div
              className="h-full rounded-full bg-surface-raised/80 transition-[width] duration-1000 ease-linear"
              style={{ width: `${elapsedPercent}%` }}
            />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-note font-bold text-ink-onbrand/90">เพิ่มนาที</span>
          {[1, 3, 5].map((m) => (
            <TimerChip
              key={m}
              label={`+${m}`}
              ariaLabel={`เพิ่มเวลา ${m} นาที`}
              disabled={busy || !session}
              onClick={() =>
                session && send({ action: 'extend', sessionId: session.id, addSeconds: m * 60 })
              }
            />
          ))}
          <TimerChip
            label={paused ? 'เดินต่อ' : 'หยุดเวลา'}
            disabled={busy || !session}
            onClick={() =>
              session && send({ action: 'pause', sessionId: session.id, paused: !paused })
            }
          />
          <span className="hidden sm:inline-flex">
            <TimerChip
              label="ตั้งใหม่"
              ariaLabel="ตั้งเวลาของช่วงนี้ใหม่"
              disabled={busy || !session}
              onClick={() => session && resetTimer()}
            />
          </span>
        </div>
      </section>

      {/* ───────── แถบตัวเลขสรุป — ขีดสีบอกความหมาย ไม่ถมสีทั้งช่อง (แบบ IXL) */}
      <div className="flex shrink-0 gap-2 sm:gap-3">
        <MetricCell
          label="นักเรียน"
          count={board?.students ?? 0}
          tone="quest"
          icon={<UsersIcon width={18} height={18} aria-hidden />}
        />
        <MetricCell
          label="ต้องช่วยด่วน"
          count={redCount}
          tone="danger"
          icon={<AlertIcon width={18} height={18} aria-hidden />}
          onClick={() => setOpenDialog('help')}
        />
        <MetricCell
          label="คำขอค้าง"
          count={planCount}
          tone="spark"
          icon={<AlertIcon width={18} height={18} aria-hidden />}
          href={`/teacher/requests?classroomId=${classroomId}`}
        />
        <MetricCell
          label="รอครูยืนยัน"
          count={reviewCount}
          tone="brand"
          icon={<CheckIcon width={18} height={18} aria-hidden />}
          href={`/teacher/review?classroomId=${classroomId}`}
        />
      </div>

      {/* ───────── โดมบอกว่าทำอะไรต่อ + ปุ่มพาไปจุดนั้น */}
      <div
        className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2 ring-1 ring-inset ${spotlightTone}`}
      >
        <span className="shrink-0">
          <DomeAvatar mood={stepMood} size={44} decorative />
        </span>
        <p className="min-w-0 flex-1 text-label font-bold text-balance text-ink">
          {step?.text ?? 'กำลังอ่านสถานะห้อง…'}
        </p>
        {stepHref ? (
          <Link
            href={stepHref}
            className="btn-base shrink-0 touch-manipulation bg-surface-raised px-3 text-label text-ink shadow-soft-1 ring-1 ring-line ring-inset hover:bg-brand-50"
          >
            {step?.actionLabel ?? 'ไปดู'}
          </Link>
        ) : step?.action === 'help' ? (
          <button
            type="button"
            onClick={() => setOpenDialog('help')}
            className="btn-base shrink-0 touch-manipulation bg-surface-raised px-3 text-label text-ink shadow-soft-1 ring-1 ring-line ring-inset hover:bg-brand-50"
          >
            {step.actionLabel ?? 'ดูว่าใครบ้าง'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="shrink-0 rounded-xl bg-danger-100 px-3 py-2 text-label font-bold text-danger-700"
        >
          {error}
        </p>
      ) : null}

      {/* ───────── รายชื่อเด็ก + แถบขวา */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-4">
        <section
          aria-label="สถานะนักเรียนรายคน"
          className="flex min-h-0 flex-col rounded-2xl bg-surface-raised p-3 shadow-soft-1 ring-1 ring-line ring-inset"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            {/* ตัวกรอง — แบบเดียวกับ Scenes ของ GoGuardian: ตัดให้เหลือเฉพาะกลุ่มที่สนใจ */}
            <div role="group" aria-label="กรองรายชื่อ" className="flex flex-wrap gap-2">
              {(
                [
                  ['all', `ทั้งห้อง ${rows.length}`],
                  ['help', `ต้องช่วย ${needHelpCount}`],
                  ['review', `รอตรวจ ${rows.filter((r) => r.pendingReview).length}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={`inline-flex min-h-11 cursor-pointer touch-manipulation items-center rounded-full px-3 text-label font-bold transition-colors duration-200 focus-ring ${
                    filter === key
                      ? 'bg-brand-600 text-ink-onbrand'
                      : 'bg-surface-sunken text-ink-muted hover:bg-brand-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-note text-ink-muted">
              {(['red', 'orange', 'yellow', 'green'] as Level[]).map((lv) => (
                <span key={lv} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`size-2.5 rounded-full ${LEVEL[lv].dot}`} />
                  {LEVEL[lv].name}
                </span>
              ))}
            </p>
          </div>

          {shown.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 text-center">
              <DomeAvatar mood={rows.length === 0 ? 'greet' : 'cheer'} size={56} decorative />
              <p className="text-body font-bold text-ink">
                {rows.length === 0
                  ? 'ยังไม่มีใครเข้าห้อง'
                  : filter === 'help'
                    ? 'ตอนนี้ไม่มีใครติด ทั้งห้องเดินได้'
                    : 'ยังไม่มีใครส่งงานเข้ามา'}
              </p>
              <p className="text-label text-ink-muted">
                {rows.length === 0
                  ? `ฉายรหัสห้อง ${roomCode ?? '—'} ให้นักเรียนพิมพ์ที่หน้า /join`
                  : 'กดปุ่ม "ทั้งห้อง" เพื่อดูทุกคน'}
              </p>
            </div>
          ) : (
            <ul className="mt-3 grid min-h-0 flex-1 auto-rows-max grid-cols-2 gap-2 overflow-y-auto overscroll-contain xl:grid-cols-3">
              {shown.map((row) => {
                const lv = levelOf(row)
                const goal = row.goalStars ?? 0
                const stars = row.earnedStars ?? 0
                return (
                  <li key={row.studentId}>
                    <button
                      type="button"
                      onClick={() => setOpenStudent(row.studentId)}
                      className={`relative flex min-h-14 w-full cursor-pointer touch-manipulation items-center gap-2 overflow-hidden rounded-xl py-2 pr-3 pl-4 text-left ring-1 ring-inset transition-shadow duration-200 hover:shadow-soft-1 focus-ring ${LEVEL[lv].card}`}
                    >
                      {/* ขีดสีซ้าย = สถานะ (มีคำอธิบายกำกับในแถบสีข้างบนเสมอ ไม่ได้ใช้สีอย่างเดียว) */}
                      <span
                        aria-hidden
                        className={`absolute inset-y-0 left-0 w-1.5 ${LEVEL[lv].bar}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label font-bold text-ink">
                          {row.nickname}
                        </span>
                        {/* บรรทัดสถานะบรรทัดเดียว — "ส่งงานแล้ว" มาอยู่ตรงนี้แทนป้ายลอย
                            เพราะป้ายลอยไปเบียดชื่อจนชื่อถูกตัดกลางคำบนจอแคบ */}
                        <span className="flex min-w-0 items-center gap-1 text-note text-ink-muted">
                          {row.pendingReview ? (
                            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand-600" />
                          ) : null}
                          <span className="truncate">
                            {row.pendingReview
                              ? 'ส่งงานแล้ว รอครูตรวจ'
                              : row.askedForHelp
                                ? 'กดขอให้ครูช่วย'
                                : (row.flag.label ?? row.progressLabel)}
                          </span>
                        </span>
                      </span>
                      {/* ตัวเลขใหญ่ชิดขวา = จุดนำสายตาแบบ SmartScore ของ IXL */}
                      <span className="flex shrink-0 items-center gap-0.5 text-reward-700">
                        <StarIcon width={16} height={16} aria-hidden />
                        <span className="text-body-lg leading-none font-extrabold tabular-nums">
                          {stars}
                        </span>
                        {goal > 0 ? (
                          <span className="text-note font-bold text-ink-muted">/{goal}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* แถบขวา — ทางลัดของงานคุมคาบ (เมนูหลักอยู่ที่ sidebar ของแดชบอร์ดแล้ว) */}
        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain lg:flex">
          <div className="grid shrink-0 grid-cols-1 gap-2">
            {[
              {
                href: `/board?classroomId=${classroomId}`,
                label: 'จอฉายหน้าห้อง (โปรเจกเตอร์)',
                blank: true,
              },
              {
                href: `/teacher/board?classroomId=${classroomId}`,
                label: 'แผงติดตามนักเรียนสด (บนเครื่องครู)',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                {...(item.blank ? { target: '_blank' } : {})}
                className="btn-base w-full touch-manipulation bg-surface-raised px-2 text-label text-ink ring-1 ring-line ring-inset hover:bg-brand-50"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* คิวตรวจ AI — แถบสรุปของเราเอง พอดีใบ ไม่มีแถบเลื่อนของตัวเอง */}
          <div className="shrink-0 rounded-2xl bg-surface-raised p-3 shadow-soft-1 ring-1 ring-line ring-inset">
            <p className="flex items-center gap-1.5 text-note font-bold tracking-wide text-ink-muted">
              <span
                aria-hidden
                className={`size-2 rounded-full ${
                  (queue?.pending ?? 0) + (queue?.running ?? 0) > 0 ? 'bg-spark-500' : 'bg-quest-500'
                }`}
              />
              AI อ่านงานล่วงหน้าให้ครู
            </p>
            <p className="mt-1 text-label font-bold text-ink">
              {queue === null
                ? 'กำลังอ่านสถานะคิว…'
                : queue.pending + queue.running === 0
                  ? 'AI อ่านครบแล้ว ไม่มีงานค้างในคิวของ AI'
                  : `AI ยังไม่ได้อ่าน ${queue.pending} ชิ้น · กำลังอ่าน ${queue.running} ชิ้น`}
            </p>
            <p className="mt-1 text-note text-ink-muted">คนละเรื่องกับ "รอครูยืนยัน" ข้างบน</p>
            <button
              type="button"
              onClick={runDrain}
              disabled={queueBusy}
              className="btn-base mt-2 w-full touch-manipulation bg-surface-sunken text-label text-ink ring-1 ring-line ring-inset hover:bg-brand-50 disabled:opacity-60"
            >
              {queueBusy ? 'กำลังให้ AI อ่าน…' : 'ให้ AI อ่านงานที่ค้างเดี๋ยวนี้'}
            </button>
          </div>

        </aside>
      </div>

      {/* ───────── แถวคำสั่งหลัก อยู่ล่างสุดในระยะนิ้วโป้ง ไม่ขยับไปไหน */}
      <div className="flex shrink-0 gap-2">
        {nextPhase ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => goPhase(nextPhase.phase)}
            className="btn-base min-w-0 flex-1 touch-manipulation bg-brand-600 px-3 text-ink-onbrand shadow-soft-1 transition-colors duration-200 hover:bg-brand-700 disabled:opacity-60 sm:px-5"
          >
            <span className="truncate">ไปช่วงถัดไป · {nextPhase.label}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpenDialog('phase')}
          className="btn-base shrink-0 touch-manipulation bg-surface-raised px-3 text-brand-700 ring-2 ring-brand-300 ring-inset hover:bg-brand-50 sm:px-4"
        >
          ย้ายช่วง
        </button>
        <Link
          href={`/teacher/settings?classroomId=${classroomId}`}
          className="btn-base shrink-0 touch-manipulation bg-surface-raised px-3 text-ink ring-1 ring-line-contrast ring-inset hover:bg-brand-50 sm:px-4"
        >
          ตั้งค่าห้อง
        </Link>
      </div>

      {/* ───────── popup ทั้งหมด */}
      <Dialog
        open={openDialog === 'phase'}
        onClose={() => setOpenDialog(null)}
        title="ย้ายช่วงของคาบ"
        description="กดแล้วเครื่องนักเรียนเปลี่ยนตามภายใน 3 วินาที · ข้ามช่วงได้ · เวลาต่อช่วงมาจากแผนที่ตั้งไว้"
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {phases.map((p) => {
            const minutes = minutesOf(p.phase)
            return (
              <li key={p.phase}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await goPhase(p.phase)
                    setOpenDialog(null)
                  }}
                  className={`btn-base w-full touch-manipulation justify-between ${
                    p.phase === session?.phase
                      ? 'bg-brand-600 text-ink-onbrand shadow-soft-1'
                      : 'bg-surface-raised text-ink ring-1 ring-line-contrast ring-inset hover:bg-brand-50'
                  }`}
                >
                  <span className="truncate">
                    {p.phase === session?.phase ? `${p.label} (อยู่ตรงนี้)` : p.label}
                  </span>
                  {minutes > 0 ? (
                    <span className="shrink-0 text-note font-bold opacity-80">{minutes} นาที</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          disabled={busy || !session}
          onClick={async () => {
            await resetTimer()
            setOpenDialog(null)
          }}
          className="btn-base mt-3 w-full touch-manipulation bg-surface-raised text-ink ring-1 ring-line-contrast ring-inset disabled:opacity-50 sm:hidden"
        >
          ตั้งเวลาของช่วงนี้ใหม่
        </button>

        <div className="mt-4 rounded-xl bg-surface-sunken p-3">
          <p className="text-label font-bold text-ink">ย้ายผิดช่วง</p>
          <p className="mt-1 text-note text-ink-muted">
            ย้อนได้ภายใน 30 วินาทีหลังย้าย หลังจากนั้นให้กดย้ายไปช่วงที่ต้องการแทน
          </p>
          <button
            type="button"
            disabled={busy || undoLeft <= 0 || !session}
            onClick={async () => {
              if (!session) return
              const done = await send({ action: 'revert', sessionId: session.id })
              if (done) lastPhaseChangeRef.current = 0
            }}
            className="btn-base mt-2 w-full touch-manipulation bg-surface-raised text-ink ring-1 ring-line-contrast ring-inset disabled:opacity-50"
          >
            ย้อนการย้ายช่วง{undoLeft > 0 ? ` (${undoLeft} วินาที)` : ''}
          </button>
        </div>
      </Dialog>

      <Dialog
        open={openDialog === 'help'}
        onClose={() => setOpenDialog(null)}
        title="คนที่ต้องเดินไปหาก่อน"
        description="เรียงจากด่วนที่สุด · การ์ดโค้ชมีแต่คำถาม ไม่มีเฉลย"
      >
        {needHelpCount === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <DomeAvatar mood="cheer" size={72} decorative />
            <p className="text-body font-bold text-ink">ตอนนี้ไม่มีใครติด ทั้งห้องเดินได้</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows
              .filter((r) => ['red', 'orange'].includes(levelOf(r)))
              .map((row) => {
                const lv = levelOf(row)
                return (
                  <li
                    key={row.studentId}
                    className={`relative overflow-hidden rounded-xl p-3 pl-4 ring-1 ring-inset ${LEVEL[lv].card}`}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-1.5 ${LEVEL[lv].bar}`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-body-lg font-extrabold text-ink">{row.nickname}</p>
                      <span className="rounded-full bg-surface-raised px-3 py-1 text-note font-bold text-ink">
                        {levelName(row)}
                      </span>
                    </div>
                    <p className="mt-1 text-label text-ink">
                      {row.flag.label ?? (row.askedForHelp ? 'กดขอให้ครูช่วย' : '')} ·{' '}
                      {row.idleLabel}
                    </p>
                    {row.coachCard ? (
                      <p className="mt-2 rounded-lg bg-surface-raised p-2 text-label text-ink">
                        ลองถามว่า: {row.coachCard.question}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDialog(null)
                        setOpenStudent(row.studentId)
                      }}
                      className="btn-base mt-2 w-full touch-manipulation bg-surface-raised text-ink ring-1 ring-line-contrast ring-inset"
                    >
                      ดูรายคน
                    </button>
                  </li>
                )
              })}
          </ul>
        )}
      </Dialog>


      <Dialog
        open={openRow !== null}
        onClose={() => setOpenStudent(null)}
        title={openRow?.nickname ?? ''}
        description={openRow?.businessName ?? undefined}
      >
        {openRow ? (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-2">
              {[
                ['สถานะ', levelName(openRow)],
                ['ตอนนี้ทำอะไร', openRow.progressLabel],
                ['ช่องทางที่ใช้', ROUTE_LABEL[openRow.learningRoute ?? ''] ?? 'ยังไม่ได้เลือก'],
                ['ตัวช่วยระดับ', String(openRow.scaffoldLevel ?? '-')],
                [
                  'ดาวสะสม',
                  openRow.goalStars
                    ? `${openRow.earnedStars ?? 0} จากเป้า ${openRow.goalStars}`
                    : String(openRow.earnedStars ?? 0),
                ],
                ['เป้าที่ตั้งไว้', openRow.goalStatus],
                ['ความเคลื่อนไหว', openRow.idleLabel],
                [
                  'ลองผิดลองถูก',
                  openRow.currentMission
                    ? `ตอบมาแล้ว ${openRow.currentMission.attempts} ครั้ง · เปิดคำใบ้ ${openRow.currentMission.hintsUsed}/${openRow.currentMission.maxHints}`
                    : '—',
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-sunken p-2">
                  <dt className="text-note font-bold text-ink-muted">{k}</dt>
                  <dd className="text-label font-bold text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {openRow.flag.teacherNote ? (
              <p className="rounded-xl bg-spark-100 p-3 text-label font-bold text-spark-800">
                {openRow.flag.teacherNote}
              </p>
            ) : null}

            {openRow.coachCard ? (
              <div className="rounded-xl bg-surface-sunken p-3">
                <p className="text-label font-bold text-ink">
                  ลองถามว่า: {openRow.coachCard.question}
                </p>
                <p className="mt-1 text-note text-ink-muted">
                  ถามต่อ: {openRow.coachCard.followUpQuestion}
                </p>
                <p className="mt-1 text-note text-ink-muted">สังเกต: {openRow.coachCard.watchFor}</p>
                <p className="mt-1 text-note font-bold text-danger-700">
                  เลี่ยงพูด: {openRow.coachCard.avoidSaying}
                </p>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href={`/teacher/student?classroomId=${classroomId}&studentId=${openRow.studentId}`}
                className="btn-base w-full touch-manipulation bg-brand-600 text-ink-onbrand shadow-soft-1"
              >
                เปิดรายงานรายคน
              </Link>
              {openRow.pendingReview ? (
                <Link
                  href={`/teacher/review?classroomId=${classroomId}`}
                  className="btn-base w-full touch-manipulation bg-surface-raised text-ink ring-1 ring-line-contrast ring-inset"
                >
                  ไปที่คิวตรวจงาน
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

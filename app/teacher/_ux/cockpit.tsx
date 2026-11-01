'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { DomeAvatar } from '../../../components/ui'
import { Dialog } from './dialog'
import { PosttestSwitch } from './posttest-switch'
import { Chip, Fact, Icon3d, InfoTip, Kpi, KpiGrid } from './v2'

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
  posttest_enabled?: boolean
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

/** ปุ่มเล็กบนการ์ดนาฬิกา — สูง 44 ห่างกัน 8 ป้ายบรรทัดเดียว */
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
      className="t2-chipbtn focus-ring"
    >
      {label}
    </button>
  )
}

/** ชื่อสั้นของระดับ — ใช้บนการ์ดเด็กที่ต้องอ่านในแวบเดียว (ชื่อเต็มจาก API อยู่ในหน้าต่างรายคน) */
const LEVEL_SHORT: Record<Level, { text: string; tone: 'red' | 'orange' | 'yellow' | 'green' }> = {
  red: { text: 'ต้องช่วย', tone: 'red' },
  orange: { text: 'ติดอยู่', tone: 'orange' },
  yellow: { text: 'ควรดู', tone: 'yellow' },
  green: { text: 'ปกติ', tone: 'green' },
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

  const noteTone = stepTone === 'danger' ? 'danger' : stepTone === 'spark' ? 'spark' : 'quest'
  const initial = (name: string) => Array.from(name.trim())[0] ?? '?'
  const rowChip = (row: BoardRow) => {
    if (row.pendingReview) return { text: 'รอตรวจ', tone: 'lilac' as const }
    if (row.askedForHelp) return { text: 'ขอช่วย', tone: 'red' as const }
    if (levelOf(row) === 'green' && row.awayFromClass) return { text: 'ไม่อยู่', tone: undefined }
    return LEVEL_SHORT[levelOf(row)]
  }

  return (
    <div className="teacher-cockpit flex h-full min-h-0 flex-col gap-4 px-3 pt-4 pb-3 sm:px-6">
      {alertsSlot}

      {/* ───────── ช่วงของคาบ + นาฬิกา */}
      <section aria-label="ช่วงของคาบและเวลาที่เหลือ" className="t2-timer shrink-0">
        <div className="t2-timer__phase">
          <Icon3d name="alarm-clock" size={56} />
          <div className="min-w-0">
            <p className="t2-timer__name truncate">
              {currentPhase?.label ?? (noSession ? 'ยังไม่ได้เปิดคาบ' : 'กำลังอ่านสถานะ…')}
            </p>
            <p className="t2-timer__room">
              ห้อง {roomCode ?? '—'} · {board?.students ?? 0} คน
            </p>
            {/* หมดเวลาแล้วต้องบอกว่าระบบไม่ย้ายช่วงให้เอง ไม่งั้นครูปล่อยห้องค้างทั้งคาบ (flow-1 ข้อ 4) */}
            {seconds === 0 && !paused ? (
              <p className="mt-1">
                <Chip tone="orange">
                  หมดเวลา · กด ถัดไป{nextPhase ? ` (${nextPhase.label})` : ''} หรือ +5
                </Chip>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-note font-bold text-ink-muted">
              {paused ? 'หยุดไว้ที่' : seconds === 0 ? 'หมดเวลา' : 'เหลือ'}
            </p>
            <p className="t2-timer__clock" data-urgent={urgent ? 'true' : 'false'}>
              {mmss(seconds)}
            </p>
          </div>
        </div>

        <div className="t2-timer__actions">
          <span className="text-note font-bold text-ink-muted">เพิ่มนาที</span>
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
          <TimerChip
            label="ตั้งใหม่"
            ariaLabel="ตั้งเวลาของช่วงนี้ใหม่"
            disabled={busy || !session}
            onClick={() => session && resetTimer()}
          />
          <InfoTip
            label="วิธีใช้เวลา"
            align="end"
            text="เวลาหมดแล้วระบบไม่ย้ายช่วงให้เอง กดปุ่ม ถัดไป ด้านล่างเมื่อพร้อม หรือกด +5 ให้เด็กทำต่อ"
          />
        </div>

        {phaseTotal > 0 ? (
          <div
            className="t2-progress"
            role="img"
            aria-label={`ช่วงนี้เดินมาแล้ว ${elapsedPercent} เปอร์เซ็นต์ของ ${Math.round(phaseTotal / 60)} นาที`}
          >
            <span style={{ width: `${elapsedPercent}%` }} />
          </div>
        ) : null}
      </section>

      <PosttestSwitch
        classroomId={classroomId}
        sessionId={session?.id ?? null}
        enabled={session?.posttest_enabled === true}
        busy={busy}
        onToggle={(next) =>
          session && send({ action: 'test-window', sessionId: session.id, which: 'post', enabled: next })
        }
      />

      {/* ───────── ตัวเลขสรุป — พาสเทล + ไอคอนเดียว + ตัวเลขใหญ่ */}
      <KpiGrid>
        <Kpi label="นักเรียน" value={board?.students ?? 0} tone="sky" icon="busts-in-silhouette" />
        <Kpi
          label="ต้องช่วยด่วน"
          value={redCount}
          tone="peach"
          icon="warning"
          onClick={() => setOpenDialog('help')}
        />
        <Kpi
          label="คำขอค้าง"
          value={planCount}
          tone="yellow"
          icon="speech-balloon"
          href={`/teacher/requests?classroomId=${classroomId}`}
        />
        <Kpi
          label="รอครูยืนยัน"
          value={reviewCount}
          tone="mint"
          icon="memo"
          href={`/teacher/review?classroomId=${classroomId}`}
        />
      </KpiGrid>

      {/* ───────── โดมบอกว่าทำอะไรต่อ + ปุ่มพาไปจุดนั้น */}
      <div className="t2-note shrink-0" data-tone={noteTone}>
        <span className="shrink-0">
          <DomeAvatar mood={stepMood} size={44} decorative />
        </span>
        <p className="min-w-0 flex-1 text-balance">{step?.text ?? 'กำลังอ่านสถานะห้อง…'}</p>
        {stepHref ? (
          <Link href={stepHref} className="t2-btn focus-ring" data-kind="soft">
            {step?.actionLabel ?? 'ไปดู'}
          </Link>
        ) : step?.action === 'help' ? (
          <button
            type="button"
            onClick={() => setOpenDialog('help')}
            className="t2-btn focus-ring"
            data-kind="soft"
          >
            {step.actionLabel ?? 'ดูว่าใครบ้าง'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="t2-note shrink-0" data-tone="danger">
          {error}
        </p>
      ) : null}

      {/* ───────── รายชื่อเด็ก + แถบขวา */}
      <div className="grid min-h-0 shrink-0 grid-cols-1 gap-4 lg:shrink lg:flex-1 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-label="สถานะนักเรียนรายคน" className="t2-card flex max-h-[30rem] min-h-0 flex-col lg:max-h-none">
          <div role="group" aria-label="กรองรายชื่อ" className="t2-tabs shrink-0">
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
                className="t2-tab focus-ring"
              >
                {label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="t2-empty min-h-0 flex-1">
              <DomeAvatar mood={rows.length === 0 ? 'greet' : 'cheer'} size={56} decorative />
              <p>
                {rows.length === 0
                  ? 'ยังไม่มีใครเข้าห้อง'
                  : filter === 'help'
                    ? 'ไม่มีใครติด ทั้งห้องเดินได้'
                    : 'ยังไม่มีใครส่งงาน'}
              </p>
              {rows.length === 0 ? (
                <p className="text-label font-semibold text-ink-muted">
                  ฉายรหัสห้อง {roomCode ?? '—'} ที่หน้า /join
                </p>
              ) : null}
            </div>
          ) : (
            <ul className="t2-students mt-3 min-h-0 flex-1 auto-rows-max overflow-y-auto overscroll-contain">
              {shown.map((row) => {
                const lv = levelOf(row)
                const goal = row.goalStars ?? 0
                const stars = row.earnedStars ?? 0
                const chip = rowChip(row)
                return (
                  <li key={row.studentId}>
                    <button
                      type="button"
                      onClick={() => setOpenStudent(row.studentId)}
                      className="t2-student focus-ring"
                      data-level={lv}
                      title={row.progressLabel}
                    >
                      <span className="t2-avatar" data-level={lv} aria-hidden>
                        {initial(row.nickname)}
                      </span>
                      <span className="t2-student__body">
                        <span className="t2-student__name" title={row.nickname}>{row.nickname}</span>
                        <Chip tone={chip.tone}>{chip.text}</Chip>
                      </span>
                      <span className="t2-stars">
                        <Icon3d name="star" size={20} />
                        {stars}
                        {goal > 0 ? <small>/{goal}</small> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* แถบขวา — ทางลัดของงานคุมคาบ (เมนูหลักอยู่ที่ sidebar ของแดชบอร์ดแล้ว) */}
        <aside className="grid min-h-0 grid-cols-1 content-start gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-1">
          <Link
            href={`/board?classroomId=${classroomId}`}
            target="_blank"
            className="t2-kpi focus-ring"
            data-tone="lilac"
            style={{ minHeight: '3.5rem', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}
          >
            <Icon3d name="television" size={32} />
            <span className="t2-kpi__label">จอฉายห้อง</span>
          </Link>
          <Link
            href={`/teacher/board?classroomId=${classroomId}`}
            className="t2-kpi focus-ring"
            data-tone="sky"
            style={{ minHeight: '3.5rem', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}
          >
            <Icon3d name="eyes" size={32} />
            <span className="t2-kpi__label">แผงติดตามสด</span>
          </Link>

          {/* คิวตรวจ AI — คนละเรื่องกับ "รอครูยืนยัน" */}
          <div className="t2-card" style={{ padding: '0.875rem 1rem' }}>
            <p className="t2-card-title" style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>
              <Icon3d name="robot" size={32} />
              AI อ่านงาน
              <InfoTip
                label="เรื่องคิว AI"
                align="end"
                text="AI อ่านงานล่วงหน้าให้ครู คนละเรื่องกับ รอครูยืนยัน ที่ครูต้องกดยืนยันคะแนนเอง"
              />
            </p>
            <p className="mb-2 flex items-center gap-2 text-label font-extrabold text-ink">
              <span
                aria-hidden
                className="t2-dot"
                style={{
                  background:
                    (queue?.pending ?? 0) + (queue?.running ?? 0) > 0 ? 'var(--t2-gold)' : 'var(--t2-green)',
                }}
              />
              {queue === null
                ? 'กำลังอ่านคิว…'
                : queue.pending + queue.running === 0
                  ? 'ไม่มีงานค้าง'
                  : `ค้าง ${queue.pending} · กำลังอ่าน ${queue.running}`}
            </p>
            <button
              type="button"
              onClick={runDrain}
              disabled={queueBusy}
              className="t2-btn focus-ring"
              data-kind="soft"
              data-block="true"
            >
              {queueBusy ? 'กำลังอ่าน…' : 'ให้ AI อ่านเลย'}
            </button>
          </div>
        </aside>
      </div>

      {/* ───────── แถวคำสั่งหลัก — ปุ่มหลักมีปุ่มเดียว */}
      <div className="teacher-action-bar flex shrink-0 gap-2">
        {nextPhase ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => goPhase(nextPhase.phase)}
            aria-label={`ไปช่วงถัดไป · ${nextPhase.label}`}
            className="t2-btn focus-ring"
            data-kind="primary"
            style={{ minWidth: 0 }}
          >
            <span className="truncate">ถัดไป · {nextPhase.label}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpenDialog('phase')}
          className="t2-btn focus-ring"
          data-kind="soft"
        >
          ย้ายช่วง
        </button>
        <Link href={`/teacher/settings?classroomId=${classroomId}`} className="t2-btn focus-ring">
          <Icon3d name="gear" size={22} />
          ตั้งค่าห้อง
        </Link>
      </div>

      {/* ───────── popup ทั้งหมด */}
      <Dialog
        open={openDialog === 'phase'}
        onClose={() => setOpenDialog(null)}
        title="ย้ายช่วง"
        description="เครื่องนักเรียนเปลี่ยนตามใน 3 วินาที"
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {phases.map((p) => {
            const minutes = minutesOf(p.phase)
            const here = p.phase === session?.phase
            return (
              <li key={p.phase}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    await goPhase(p.phase)
                    setOpenDialog(null)
                  }}
                  className="t2-btn focus-ring"
                  data-kind={here ? 'primary' : undefined}
                  data-block="true"
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="truncate">{here ? `${p.label} ●` : p.label}</span>
                  {minutes > 0 ? <span className="shrink-0 text-note opacity-80">{minutes} นาที</span> : null}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[20px] bg-[#f6f2e8] p-3">
          <Icon3d name="hourglass-not-done" size={32} />
          <p className="min-w-0 flex-1 text-label font-extrabold text-ink">ย้ายผิดช่วง</p>
          <InfoTip label="เรื่องการย้อนช่วง" align="end" text="ย้อนได้ภายใน 30 วินาทีหลังย้าย หลังจากนั้นให้กดย้ายไปช่วงที่ต้องการแทน" />
          <button
            type="button"
            disabled={busy || undoLeft <= 0 || !session}
            onClick={async () => {
              if (!session) return
              const done = await send({ action: 'revert', sessionId: session.id })
              if (done) lastPhaseChangeRef.current = 0
            }}
            className="t2-btn focus-ring"
          >
            ย้อนช่วง{undoLeft > 0 ? ` · ${undoLeft} วิ` : ''}
          </button>
        </div>
        <button
          type="button"
          disabled={busy || !session}
          onClick={async () => {
            await resetTimer()
            setOpenDialog(null)
          }}
          className="t2-btn mt-3 focus-ring sm:hidden"
          data-block="true"
        >
          ตั้งเวลาใหม่
        </button>
      </Dialog>

      <Dialog
        open={openDialog === 'help'}
        onClose={() => setOpenDialog(null)}
        title="ต้องเดินไปหา"
        description="เรียงจากด่วนที่สุด"
      >
        {needHelpCount === 0 ? (
          <div className="t2-empty">
            <DomeAvatar mood="cheer" size={72} decorative />
            <p>ไม่มีใครติด ทั้งห้องเดินได้</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows
              .filter((r) => ['red', 'orange'].includes(levelOf(r)))
              .map((row) => {
                const lv = levelOf(row)
                const chip = rowChip(row)
                return (
                  <li key={row.studentId} className="t2-student" data-level={lv} style={{ cursor: 'default', flexWrap: 'wrap' }}>
                    <span className="t2-avatar" data-level={lv} aria-hidden>
                      {initial(row.nickname)}
                    </span>
                    <span className="t2-student__body">
                      <span className="t2-student__name">{row.nickname}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Chip tone={chip.tone} title={levelName(row)}>
                          {chip.text}
                        </Chip>
                        <span className="text-note font-bold text-ink-muted">{row.idleLabel}</span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDialog(null)
                        setOpenStudent(row.studentId)
                      }}
                      className="t2-btn focus-ring"
                      data-kind="soft"
                    >
                      ดูรายคน
                    </button>
                    {row.coachCard ? (
                      <p className="flex w-full items-start gap-2 rounded-[16px] bg-white p-2 text-label font-bold text-ink">
                        <Icon3d name="light-bulb" size={24} />
                        <span>{row.coachCard.question}</span>
                      </p>
                    ) : null}
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
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={rowChip(openRow).tone} title={levelName(openRow)}>
                {rowChip(openRow).text}
              </Chip>
              <Chip tone="sky">{ROUTE_LABEL[openRow.learningRoute ?? ''] ?? 'ยังไม่เลือกช่องทาง'}</Chip>
              <Chip>{openRow.idleLabel}</Chip>
            </div>

            <p className="t2-note" data-tone="sky">
              <Icon3d name="eyes" size={28} />
              <span className="min-w-0 flex-1">{openRow.progressLabel}</span>
            </p>

            <dl className="t2-facts" data-cols="3">
              <Fact
                label="ดาว"
                icon="star"
                tone="yellow"
                value={
                  openRow.goalStars
                    ? `${openRow.earnedStars ?? 0}/${openRow.goalStars}`
                    : String(openRow.earnedStars ?? 0)
                }
              />
              <Fact label="ตัวช่วย" icon="light-bulb" tone="mint" value={`ระดับ ${openRow.scaffoldLevel ?? '-'}`} />
              <Fact
                label="ตอบแล้ว"
                icon="memo"
                tone="sky"
                value={openRow.currentMission ? `${openRow.currentMission.attempts} ครั้ง` : '—'}
              />
              <Fact
                label="คำใบ้"
                icon="magnifying-glass-tilted-left"
                tone="peach"
                value={openRow.currentMission ? `${openRow.currentMission.hintsUsed}/${openRow.currentMission.maxHints}` : '—'}
              />
              <Fact label="เป้าหมาย" icon="bullseye" tone="lilac" value={openRow.goalStatus} />
            </dl>

            {openRow.flag.teacherNote ? (
              <p className="t2-note" data-tone="spark">
                {openRow.flag.teacherNote}
              </p>
            ) : null}

            {openRow.coachCard ? (
              <div className="rounded-[20px] bg-[#f6f2e8] p-3">
                <p className="flex items-start gap-2 text-label font-extrabold text-ink">
                  <Icon3d name="light-bulb" size={28} />
                  <span>ลองถามว่า: {openRow.coachCard.question}</span>
                </p>
                <details className="mt-1">
                  <summary className="flex min-h-11 cursor-pointer items-center text-label font-extrabold text-brand-700">
                    คำถามต่อ · สิ่งที่ควรเลี่ยง
                  </summary>
                  <p className="mt-1 text-label text-ink">ถามต่อ: {openRow.coachCard.followUpQuestion}</p>
                  <p className="mt-1 text-label text-ink-muted">สังเกต: {openRow.coachCard.watchFor}</p>
                  <p className="mt-1 text-label font-bold text-danger-700">
                    เลี่ยงพูด: {openRow.coachCard.avoidSaying}
                  </p>
                </details>
              </div>
            ) : null}

            <div className={openRow.pendingReview ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2'}>
              <Link
                href={`/teacher/student?classroomId=${classroomId}&studentId=${openRow.studentId}`}
                className="t2-btn focus-ring"
                data-kind="primary"
                data-block="true"
              >
                รายงานรายคน
              </Link>
              {openRow.pendingReview ? (
                <Link
                  href={`/teacher/review?classroomId=${classroomId}`}
                  className="t2-btn focus-ring"
                  data-block="true"
                >
                  คิวตรวจงาน
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertIcon, Card, CheckIcon, CloseIcon, EmptyState, LightbulbIcon, UsersIcon, cn } from '../../../components/ui'
import { PlanRequests } from './plan-requests'

/**
 * T-05 แผงห้องเรียนสด — ครูคนเดียวดูทั้งห้องพร้อมกันในจอเดียว
 *
 * ⚠️ หน้านี้ไม่คิดเกณฑ์ธงเอง ทั้งหมดมาจาก `/api/teacher/board` ซึ่งเรียก `shouldCoach()`
 *    เกณฑ์ 60/90/150 วินาทีอยู่ที่ `content/coach-thresholds.json` ที่เดียว
 * ⚠️ การ์ดโค้ชมีแต่คำถามกับสิ่งที่ครูควรสังเกต **ไม่มีเฉลย** ตามกติกาของระบบ
 * ⚠️ ปุ่ม "ขอให้ครูช่วย" ของนักเรียน (S-35) มาโผล่ที่นี่ — ขึ้นแดงทันทีโดยไม่ต้องรอเกณฑ์เวลา
 */

const POLL_MS = 3000

type FlagLevel = 'yellow' | 'orange' | 'red' | null

interface CoachCard {
  question: string
  followUpQuestion: string
  watchFor: string
  avoidSaying: string
  encouragement?: string | null
}

interface CalibrationRow {
  objectiveId: string
  missionTitle: string
  flag: string
  reason: string
  confidence: number
  correct: boolean
  coachCard: CoachCard | null
}

interface BoardRow {
  studentId: string
  nickname: string
  businessName: string | null
  learningRoute: string | null
  scaffoldLevel: number | null
  goalStatus: string
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
  skippedMissions: string[]
  pendingReview: boolean
  askedForHelp: boolean
  helpMissionId: string | null
  calibration: CalibrationRow[]
  flag: {
    flagged: boolean
    level: FlagLevel
    label: string | null
    reasonName: string | null
    teacherNote: string | null
  }
  coachCard: CoachCard | null
}

interface BoardResponse {
  students: number
  flagged: number
  needsHelp: number
  shouldTalk: number
  /** ธง "มั่นใจต่ำแต่ทำถูก" — API ส่งมาคู่กับ shouldTalk เสมอ */
  shouldPraise: number
  pendingReview: number
  board: BoardRow[]
  /** กติกาการโค้ชจาก content/coach-prompts.json — ครูอ่านทวนได้ระหว่างเดินดูห้อง */
  coachRules?: { id: string; text: string }[]
}

/**
 * สีของสถานะตาม docs/auth-and-roles.md ข้อ 2 (เขียว เหลือง แดง)
 * โค้ดจริงมี 4 ระดับ เพราะ coach-thresholds.json แยก 90 วินาทีออกมาเป็นส้ม
 * จึงจับส้มไว้ระหว่าง "ควรดู" กับ "ต้องช่วยด่วน" ไม่ได้ยุบทิ้งเพื่อให้ครูเห็นลำดับที่ต้องเดินไปหา
 */
const LEVEL_STYLE: Record<'green' | 'yellow' | 'orange' | 'red', {
  name: string
  dot: string
  card: string
  chip: string
  order: number
}> = {
  red: {
    name: 'ต้องช่วยด่วน',
    dot: 'bg-danger-600',
    card: 'ring-danger-300 bg-danger-100/60',
    chip: 'bg-danger-100 text-danger-700',
    order: 0,
  },
  orange: {
    name: 'ติดแล้ว เตรียมเดินไปหา',
    dot: 'bg-spark-600',
    card: 'ring-spark-300 bg-spark-100/50',
    chip: 'bg-spark-100 text-spark-700',
    order: 1,
  },
  yellow: {
    name: 'ควรดู',
    dot: 'bg-spark-400',
    card: 'ring-spark-200 bg-surface-raised',
    chip: 'bg-spark-100 text-spark-700',
    order: 2,
  },
  green: {
    name: 'ปกติ',
    dot: 'bg-quest-500',
    card: 'ring-line bg-surface-raised',
    chip: 'bg-quest-100 text-quest-700',
    order: 3,
  },
}

function levelOf(row: BoardRow): 'green' | 'yellow' | 'orange' | 'red' {
  if (row.askedForHelp) return 'red'
  return row.flag.level ?? 'green'
}

const ROUTE_LABEL: Record<string, string> = {
  clip: 'ดูคลิป',
  card: 'อ่านการ์ด',
  game: 'เล่นเกม',
  buddy: 'เรียนกับเพื่อน',
}

function idleText(seconds: number): string {
  if (seconds < 60) return `นิ่งมา ${seconds} วินาที`
  const min = Math.floor(seconds / 60)
  return `นิ่งมา ${min} นาที ${seconds % 60} วินาที`
}

export function LiveBoardClient({
  classroomId,
  initialData = null,
}: {
  classroomId: string | null
  /** ใส่ค่าเริ่มต้นได้เพื่อให้เทสต์เรนเดอร์ตรวจได้โดยไม่ต้องยิงเครือข่าย */
  initialData?: BoardResponse | null
}) {
  const [data, setData] = useState<BoardResponse | null>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/board?classroomId=${classroomId}`, { cache: 'no-store' })
      if (res.status === 404) {
        setError('ไม่พบห้องนี้ในบัญชีของคุณ')
        setData(null)
        return
      }
      if (!res.ok) return
      setError(null)
      setData((await res.json()) as BoardResponse)
      setUpdatedAt(new Date().toLocaleTimeString('th-TH'))
    } catch {
      // เน็ตสะดุดหนึ่งรอบ ไม่ต้องล้างของเดิมทิ้ง รอบหน้าค่อยว่ากัน
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  if (!classroomId) {
    return (
      <EmptyState
        title="ยังไม่มีห้องเรียน"
        description="กดเปิดห้องที่แผงครูก่อน แล้วกลับมาที่หน้านี้"
        illustration={<UsersIcon width={48} height={48} className="text-brand-400" />}
      />
    )
  }

  if (error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-100 p-4 text-body font-semibold text-danger-700">
        <AlertIcon width={22} height={22} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </p>
    )
  }

  if (!data) {
    return <p className="text-body text-ink-muted">กำลังโหลดแผงห้องเรียน…</p>
  }

  // เรียงคนที่ต้องเข้าไปหาก่อนเสมอ แดง → ส้ม → เหลือง → เขียว แล้วค่อยเรียงตามคนที่นิ่งนานกว่า
  const rows = [...data.board].sort((a, b) => {
    const byLevel = LEVEL_STYLE[levelOf(a)].order - LEVEL_STYLE[levelOf(b)].order
    if (byLevel !== 0) return byLevel
    return b.idleSeconds - a.idleSeconds
  })

  const open = rows.find((r) => r.studentId === openId) ?? null

  return (
    <div>
      {/*
        ธงการรู้ตัวมาเป็นคู่เสมอ: "มั่นใจสูงแต่ยังไม่ถูก = ควรคุย" กับ "มั่นใจต่ำแต่ทำถูก = ควรชม"
        API ส่งมาทั้งคู่ตั้งแต่ต้น แต่จอเคยโชว์แค่ฝั่งควรคุย ครูเลยเห็นแต่ด้านลบ
      */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Summary label="อยู่ในห้อง" value={data.students} />
        <Summary label="กดขอครู" value={data.needsHelp} tone={data.needsHelp > 0 ? 'danger' : undefined} />
        <Summary label="ติดธงเตือน" value={data.flagged} tone={data.flagged > 0 ? 'spark' : undefined} />
        <Summary label="ควรคุย (ความมั่นใจ)" value={data.shouldTalk} />
        <Summary label="ควรชม (มั่นใจต่ำแต่ทำถูก)" value={data.shouldPraise} tone={data.shouldPraise > 0 ? 'quest' : undefined} />
        <Summary label="งานรอตรวจ" value={data.pendingReview} />
      </dl>

      <p className="mt-2 text-note text-ink-muted" aria-live="polite">
        อัปเดตเองทุก 3 วินาที{updatedAt ? ` · ล่าสุด ${updatedAt}` : ''}
      </p>

      {/*
        กติกาการโค้ช — API ส่งมาพร้อมทุกรอบ poll อยู่แล้วแต่ไม่เคยมีจอไหนแสดง
        พับไว้เพราะครูไม่ได้อ่านทุกครั้ง แต่เปิดดูได้ทันทีตอนกำลังจะเดินไปคุยกับเด็ก
      */}
      {data.coachRules && data.coachRules.length > 0 ? (
        <details className="mt-3 rounded-2xl bg-surface-raised p-3 ring-1 ring-line ring-inset">
          <summary className="cursor-pointer text-label font-bold text-brand-700">
            กติกาการโค้ช {data.coachRules.length} ข้อ (กดเพื่อเปิด)
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {data.coachRules.map((rule) => (
              <li key={rule.id} className="text-note text-pretty text-ink">
                • {rule.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* S-08 คำขอเปลี่ยนแผน — อยู่บนสุดเพราะเด็กกำลังรอคำตอบอยู่ระหว่างคาบ */}
      <PlanRequests classroomId={classroomId} />

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const level = levelOf(row)
          const style = LEVEL_STYLE[level]
          const isOpen = row.studentId === openId
          return (
            <li key={row.studentId}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : row.studentId)}
                aria-expanded={isOpen}
                className={cn(
                  'w-full rounded-2xl p-4 text-left ring-2 ring-inset transition-colors duration-200 focus-ring',
                  style.card,
                  isOpen ? 'ring-brand-500' : null,
                )}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-3 shrink-0 rounded-full', style.dot)} />
                  <span className="min-w-0 flex-1 truncate text-body-lg font-bold text-ink">
                    {row.nickname}
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-note font-bold', style.chip)}>
                    {style.name}
                  </span>
                </div>

                <p className="mt-1 truncate text-label text-ink-muted">
                  {row.currentMission ? row.currentMission.title : 'ยังไม่เริ่มภารกิจ'}
                </p>

                <p className="mt-1 text-note text-ink-muted">
                  {idleText(row.idleSeconds)}
                  {row.currentMission
                    ? ` · ลอง ${row.currentMission.attempts} ครั้ง · คำใบ้ ${row.currentMission.hintsUsed}/${row.currentMission.maxHints}`
                    : ''}
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {row.askedForHelp ? (
                    <Tag tone="danger">
                      <AlertIcon width={14} height={14} aria-hidden /> กดขอครู
                    </Tag>
                  ) : null}
                  {row.pendingReview ? <Tag tone="brand">งานรอตรวจ</Tag> : null}
                  {row.calibration.map((c) => (
                    <Tag key={c.objectiveId} tone={c.flag === 'ควรคุย' ? 'spark' : 'quest'}>
                      {c.flag}
                    </Tag>
                  ))}
                  {row.skippedMissions.length > 0 ? (
                    <Tag tone="line">ข้าม {row.skippedMissions.length} ภารกิจ</Tag>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="ยังไม่มีใครเข้าห้อง"
          description="ให้นักเรียนสแกน QR จากจอหน้าห้อง แล้วชื่อจะขึ้นตรงนี้เอง"
          illustration={<UsersIcon width={48} height={48} className="text-brand-400" />}
        />
      ) : null}

      {open ? <StudentDetail row={open} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  /** quest = ข่าวดี (ควรชม) · spark = ควรดู · danger = ต้องเดินไปหาก่อน */
  tone?: 'danger' | 'spark' | 'quest'
}) {
  return (
    <div
      className={cn(
        'rounded-xl p-3 ring-1 ring-inset',
        tone === 'danger'
          ? 'bg-danger-100 ring-danger-300'
          : tone === 'spark'
            ? 'bg-spark-100 ring-spark-300'
            : tone === 'quest'
              ? 'bg-quest-100 ring-quest-300'
              : 'bg-surface-raised ring-line',
      )}
    >
      <dt className="text-note font-bold text-ink-muted">{label}</dt>
      <dd className="text-title-sm font-extrabold text-ink">{value}</dd>
    </div>
  )
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'danger' | 'spark' | 'quest' | 'brand' | 'line'
}) {
  const map = {
    danger: 'bg-danger-100 text-danger-700',
    spark: 'bg-spark-100 text-spark-700',
    quest: 'bg-quest-100 text-quest-700',
    brand: 'bg-brand-100 text-brand-700',
    line: 'bg-surface-sunken text-ink-muted',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-note font-bold', map[tone])}>
      {children}
    </span>
  )
}

/** รายละเอียดของคนที่ครูกดเลือก — เปิดค้างไว้ได้ระหว่างที่แผงข้างบนยังอัปเดตของตัวเอง */
function StudentDetail({ row, onClose }: { row: BoardRow; onClose: () => void }) {
  return (
    <Card
      as="section"
      // คนที่กดขอครูเองต้องเด้งออกมาจากพื้นหลังทันที — ใช้ tone ของระบบดีไซน์ ไม่เขียนคลาสสีเอง
      tone={row.askedForHelp ? 'danger' : 'plain'}
      className="mt-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-title-sm font-bold text-ink">{row.nickname}</h2>
          <p className="mt-0.5 text-label text-ink-muted">
            {row.businessName ?? 'ยังไม่ได้ตั้งชื่อร้าน'} ·{' '}
            {row.learningRoute ? ROUTE_LABEL[row.learningRoute] ?? row.learningRoute : 'ยังไม่เลือกช่องทาง'} ·
            ตัวช่วยระดับ {row.scaffoldLevel ?? '-'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-base shrink-0 bg-surface-raised px-4 text-ink ring-2 ring-line-contrast ring-inset"
        >
          <CloseIcon width={18} height={18} aria-hidden /> ปิด
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="ดาวที่ได้" value={`${row.earnedStars ?? 0}`} />
        <Fact label="เป้าหมาย" value={row.goalStatus} />
        <Fact
          label="ภารกิจตอนนี้"
          value={row.currentMission ? row.currentMission.title : 'ยังไม่เริ่ม'}
        />
        <Fact label="เวลานิ่ง" value={idleText(row.idleSeconds)} />
      </dl>

      {row.askedForHelp ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-danger-100 p-3 text-body font-bold text-danger-700">
          <AlertIcon width={20} height={20} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            กดปุ่มขอให้ครูช่วยไว้
            {row.helpMissionId ? ` ที่ภารกิจ ${row.helpMissionId}` : ''} — ให้ความสำคัญคนนี้ก่อน
          </span>
        </p>
      ) : null}

      {row.flag.flagged && row.flag.label ? (
        <p className="mt-3 text-body font-semibold text-ink">
          ธงเตือน: {row.flag.label}
          {row.flag.reasonName ? ` · ${row.flag.reasonName}` : ''}
        </p>
      ) : null}
      {row.flag.teacherNote ? (
        <p className="mt-1 text-label text-ink-muted">{row.flag.teacherNote}</p>
      ) : null}

      {row.coachCard ? <CoachBlock card={row.coachCard} /> : null}

      {row.calibration.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-body font-bold text-ink">ธงจากความมั่นใจ (ไม่มีผลกับคะแนน)</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {row.calibration.map((c) => (
              <li key={c.objectiveId} className="rounded-xl bg-surface-sunken p-3">
                <p className="text-label font-bold text-ink">
                  {c.flag} · {c.missionTitle}
                </p>
                <p className="mt-0.5 text-note text-ink-muted">
                  {c.reason} · บอกว่ามั่นใจระดับ {c.confidence} จาก 3 · {c.correct ? 'ตอบถูก' : 'ตอบผิด'}
                </p>
                {c.coachCard ? <CoachBlock card={c.coachCard} compact /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Link
          href={`/teacher/student?studentId=${row.studentId}`}
          className="btn-base bg-brand-600 px-4 text-ink-onbrand shadow-soft-1"
        >
          ดูรายงานรายคน
        </Link>
        {row.pendingReview ? (
          <Link
            href="/teacher"
            className="btn-base bg-surface-raised px-4 text-brand-700 ring-2 ring-brand-100 ring-inset"
          >
            ไปตรวจงานของคนนี้
          </Link>
        ) : null}
      </div>
    </Card>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-sunken p-3">
      <dt className="text-note font-bold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-bold text-ink">{value}</dd>
    </div>
  )
}

/** การ์ดโค้ช — คำถามล้วน ไม่มีเฉลย ตามกติกา "ครูถามก่อนบอก" */
function CoachBlock({ card, compact = false }: { card: CoachCard; compact?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-brand-50 p-3 ring-1 ring-brand-100 ring-inset', compact ? 'mt-2' : 'mt-3')}>
      <p className="flex items-start gap-2 text-body font-bold text-ink">
        <LightbulbIcon width={20} height={20} aria-hidden className="mt-0.5 shrink-0 text-brand-600" />
        <span>ลองถามว่า: {card.question}</span>
      </p>
      <p className="mt-2 text-label text-ink-muted">ถามต่อ: {card.followUpQuestion}</p>
      <p className="mt-1 text-label text-ink-muted">สังเกต: {card.watchFor}</p>
      <p className="mt-1 flex items-start gap-1.5 text-label font-semibold text-danger-700">
        <CloseIcon width={16} height={16} aria-hidden className="mt-1 shrink-0" />
        <span>เลี่ยงพูด: {card.avoidSaying}</span>
      </p>
      {card.encouragement ? (
        <p className="mt-2 flex items-start gap-1.5 text-label font-semibold text-quest-700">
          <CheckIcon width={16} height={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>ชมได้ว่า: {card.encouragement}</span>
        </p>
      ) : null}
    </div>
  )
}

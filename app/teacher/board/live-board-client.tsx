'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertIcon, EmptyState, UsersIcon, cn } from '../../../components/ui'
import { Dialog } from '../_ux/dialog'
import { Chip, Fact, Icon3d, Kpi, KpiGrid } from '../_ux/v2'
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

  const initial = (name: string) => Array.from(name.trim())[0] ?? '?'

  return (
    <div className="t2-stack">
      {/*
        ธงการรู้ตัวมาเป็นคู่เสมอ: "มั่นใจสูงแต่ยังไม่ถูก = ควรคุย" กับ "มั่นใจต่ำแต่ทำถูก = ควรชม"
        API ส่งมาทั้งคู่ตั้งแต่ต้น แต่จอเคยโชว์แค่ฝั่งควรคุย ครูเลยเห็นแต่ด้านลบ
      */}
      <KpiGrid cols={6}>
        <Kpi label="อยู่ในห้อง" value={data.students} tone="sky" icon="busts-in-silhouette" />
        <Kpi label="กดขอครู" value={data.needsHelp} tone="peach" icon="warning" />
        <Kpi label="ติดธงเตือน" value={data.flagged} tone="yellow" icon="bell" />
        <Kpi
          label="ควรคุย"
          value={data.shouldTalk}
          tone="lilac"
          icon="speech-balloon"
          tip="มั่นใจสูงแต่ยังตอบไม่ถูก ควรเดินไปคุย (ความมั่นใจ)"
        />
        <Kpi
          label="ควรชม"
          value={data.shouldPraise}
          tone="mint"
          icon="party-popper"
          tip="มั่นใจต่ำแต่ทำถูก ควรชมให้กำลังใจ"
        />
        <Kpi label="งานรอตรวจ" value={data.pendingReview} tone="rose" icon="memo" />
      </KpiGrid>

      <p className="flex flex-wrap items-center gap-2 text-note font-bold text-ink-muted" aria-live="polite">
        <Chip>อัปเดตทุก 3 วิ{updatedAt ? ` · ${updatedAt}` : ''}</Chip>
      </p>

      {/*
        กติกาการโค้ช — API ส่งมาพร้อมทุกรอบ poll อยู่แล้วแต่ไม่เคยมีจอไหนแสดง
        พับไว้เพราะครูไม่ได้อ่านทุกครั้ง แต่เปิดดูได้ทันทีตอนกำลังจะเดินไปคุยกับเด็ก
      */}
      {data.coachRules && data.coachRules.length > 0 ? (
        <details className="t2-more">
          <summary className="focus-ring">
            <Icon3d name="light-bulb" size={32} />
            กติกาการโค้ช {data.coachRules.length} ข้อ
          </summary>
          <div className="t2-more__body">
            <ul className="flex flex-col gap-2">
              {data.coachRules.map((rule) => (
                <li key={rule.id} className="text-label text-pretty text-ink">
                  • {rule.text}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {/* S-08 คำขอเปลี่ยนแผน — อยู่บนสุดเพราะเด็กกำลังรอคำตอบอยู่ระหว่างคาบ */}
      <PlanRequests classroomId={classroomId} />

      {rows.length > 0 ? (
        <ul className="t2-students" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 17rem), 1fr))' }}>
          {rows.map((row) => {
            const level = levelOf(row)
            const style = LEVEL_STYLE[level]
            return (
              <li key={row.studentId}>
                <button
                  type="button"
                  onClick={() => setOpenId(row.studentId)}
                  aria-haspopup="dialog"
                  className="t2-student focus-ring"
                  data-level={level}
                  style={{ alignItems: 'flex-start', minHeight: '5rem', padding: '0.625rem 0.75rem 0.625rem 0.625rem' }}
                >
                  <span className="t2-avatar" data-level={level} aria-hidden>
                    {initial(row.nickname)}
                  </span>
                  <span className="t2-student__body" style={{ gap: '0.35rem' }}>
                    <span className="t2-student__name">{row.nickname}</span>
                    <span className="truncate text-note font-bold text-ink-muted">
                      {row.currentMission ? row.currentMission.title : 'ยังไม่เริ่มภารกิจ'}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Chip tone={LEVEL_CHIP[level]}>{style.name}</Chip>
                      {row.askedForHelp ? <Chip tone="red">กดขอครู</Chip> : null}
                      {row.pendingReview ? <Chip tone="lilac">งานรอตรวจ</Chip> : null}
                      {row.calibration.map((c) => (
                        <Chip key={c.objectiveId} tone={c.flag === 'ควรคุย' ? 'orange' : 'green'}>
                          {c.flag}
                        </Chip>
                      ))}
                      {row.skippedMissions.length > 0 ? <Chip>ข้าม {row.skippedMissions.length}</Chip> : null}
                    </span>
                  </span>
                  <span className="t2-stars">
                    <Icon3d name="star" size={20} />
                    {row.earnedStars ?? 0}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="t2-card t2-empty">
          <Icon3d name="school" size={56} />
          <p>ยังไม่มีใครเข้าห้อง</p>
          <p className="text-label font-semibold text-ink-muted">ให้นักเรียนสแกน QR จากจอหน้าห้อง</p>
        </div>
      )}

      <Dialog
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.nickname ?? ''}
        description={open?.businessName ?? undefined}
      >
        {open ? <StudentDetail row={open} /> : null}
      </Dialog>
    </div>
  )
}

const LEVEL_CHIP = { red: 'red', orange: 'orange', yellow: 'yellow', green: 'green' } as const

/** รายละเอียดของคนที่ครูกดเลือก — เปิดในหน้าต่างซ้อน ปิดแล้วกลับมาที่ตำแหน่งเดิม */
function StudentDetail({ row }: { row: BoardRow }) {
  const level = levelOf(row)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={LEVEL_CHIP[level]}>{LEVEL_STYLE[level].name}</Chip>
        <Chip tone="sky">{row.learningRoute ? (ROUTE_LABEL[row.learningRoute] ?? row.learningRoute) : 'ยังไม่เลือกช่องทาง'}</Chip>
        <Chip>{idleText(row.idleSeconds)}</Chip>
      </div>

      <dl className="t2-facts" data-cols="3">
        <Fact label="ดาว" icon="star" tone="yellow" value={`${row.earnedStars ?? 0}`} />
        <Fact label="ตัวช่วย" icon="light-bulb" tone="mint" value={`ระดับ ${row.scaffoldLevel ?? '-'}`} />
        <Fact label="เป้าหมาย" icon="bullseye" tone="lilac" value={row.goalStatus} />
        <Fact
          label="ภารกิจ"
          icon="rocket"
          tone="sky"
          value={row.currentMission ? row.currentMission.title : 'ยังไม่เริ่ม'}
        />
        {row.currentMission ? (
          <Fact
            label="ลอง · คำใบ้"
            icon="magnifying-glass-tilted-left"
            tone="peach"
            value={`${row.currentMission.attempts} · ${row.currentMission.hintsUsed}/${row.currentMission.maxHints}`}
          />
        ) : null}
      </dl>

      {row.askedForHelp ? (
        <p className="t2-note" data-tone="danger">
          <Icon3d name="warning" size={28} />
          <span>
            กดขอครูช่วย{row.helpMissionId ? ` · ภารกิจ ${row.helpMissionId}` : ''} · ดูคนนี้ก่อน
          </span>
        </p>
      ) : null}

      {row.flag.flagged && row.flag.label ? (
        <p className="t2-note" data-tone="spark">
          ธงเตือน: {row.flag.label}
          {row.flag.reasonName ? ` · ${row.flag.reasonName}` : ''}
        </p>
      ) : null}
      {row.flag.teacherNote ? <p className="text-label text-ink-muted">{row.flag.teacherNote}</p> : null}

      {row.coachCard ? <CoachBlock card={row.coachCard} /> : null}

      {row.calibration.length > 0 ? (
        <details className="rounded-[20px] bg-[#f6f2e8] p-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-label font-extrabold text-ink">
            ธงจากความมั่นใจ {row.calibration.length} ข้อ
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {row.calibration.map((c) => (
              <li key={c.objectiveId} className="rounded-[16px] bg-white p-3">
                <p className="text-label font-extrabold text-ink">
                  {c.flag} · {c.missionTitle}
                </p>
                <p className="mt-0.5 text-note text-ink-muted">
                  {c.reason} · มั่นใจ {c.confidence}/3 · {c.correct ? 'ตอบถูก' : 'ตอบผิด'}
                </p>
                {c.coachCard ? <CoachBlock card={c.coachCard} compact /> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 print:hidden">
        <Link
          href={`/teacher/student?studentId=${row.studentId}`}
          className="t2-btn focus-ring"
          data-kind="primary"
          data-block="true"
        >
          รายงานรายคน
        </Link>
        {row.pendingReview ? (
          <Link href="/teacher/review" className="t2-btn focus-ring" data-block="true">
            ไปตรวจงาน
          </Link>
        ) : null}
      </div>
    </div>
  )
}

/** การ์ดโค้ช — คำถามล้วน ไม่มีเฉลย ตามกติกา "ครูถามก่อนบอก" */
function CoachBlock({ card, compact = false }: { card: CoachCard; compact?: boolean }) {
  return (
    <div className={cn('rounded-[20px] bg-[#f6f2e8] p-3', compact ? 'mt-2' : '')}>
      <p className="flex items-start gap-2 text-label font-extrabold text-ink">
        <Icon3d name="light-bulb" size={28} />
        <span>ลองถามว่า: {card.question}</span>
      </p>
      <details className="mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center text-label font-extrabold text-brand-700">
          ถามต่อ · สังเกต · เลี่ยงพูด
        </summary>
        <p className="mt-1 text-label text-ink">ถามต่อ: {card.followUpQuestion}</p>
        <p className="mt-1 text-label text-ink-muted">สังเกต: {card.watchFor}</p>
        <p className="mt-1 text-label font-bold text-danger-700">เลี่ยงพูด: {card.avoidSaying}</p>
        {card.encouragement ? (
          <p className="mt-1 text-label font-bold text-quest-700">ชมได้ว่า: {card.encouragement}</p>
        ) : null}
      </details>
    </div>
  )
}

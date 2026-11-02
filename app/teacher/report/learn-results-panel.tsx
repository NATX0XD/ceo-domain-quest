'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  LatestLearnAnswer,
  LearnResultMode,
  MissionLearnSummary,
  StudentLearnResult,
  StudentMissionLearn,
} from '../../../components/server/learn-results'
import { AlertIcon } from '../../../components/ui'
import { FilterChips, SideDrawer } from '../_ux/cms'
import { Icon3d, InfoTip } from '../_ux/v2'
import { Legend, STATUS_LEGEND, StatTile, StatusBadge } from '../_ux/ui'
import { MissionTag, StackBar } from '../_ux/data-viz'

/**
 * ผลเส้นทางเรียน (ดู / อ่าน / ลงมือทำ) บนแผงครู
 * ไม่มี studentId = สรุปทั้งห้องรายภารกิจ + ตารางรายคน · มี studentId = คนเดียว
 * ตัวเลขทั้งหมดคิดที่ GET /api/teacher/learn จอนี้แค่วาด
 */

const MODE_LABEL: Record<LearnResultMode, string> = { watch: 'ดู', read: 'อ่าน', do: 'ลงมือทำ' }
const MODES: LearnResultMode[] = ['watch', 'read', 'do']

type Prompts = Record<string, Record<string, string>>
type ClassData = {
  students: StudentLearnResult[]
  missions: MissionLearnSummary[]
  missionTitles: Record<string, string>
  questionPrompts: Prompts
}
type OneData = { student: StudentLearnResult; missionTitles: Record<string, string>; questionPrompts: Prompts }

function n(value: number | null): string {
  return value === null ? '-' : String(Math.round(value * 100) / 100)
}

function modeText(mode: LearnResultMode | null): string {
  return mode ? MODE_LABEL[mode] : '-'
}

export function LearnResultsPanel({
  classroomId,
  studentId,
}: {
  classroomId: string | null
  studentId?: string | null
}) {
  const [data, setData] = useState<ClassData | OneData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missionFilter, setMissionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'open'>('all')
  const [sort, setSort] = useState<{ key: 'name' | 'done' | 'best' | 'attempts'; dir: 1 | -1 }>({ key: 'name', dir: 1 })
  const [openId, setOpenId] = useState<string | null>(null)

  // ครูสลับนักเรียนเร็ว ๆ = ยกเลิกคำขอเก่า ไม่ให้ผลของคนก่อนมาโผล่ใต้ชื่อคนใหม่
  const inflight = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (!classroomId) return
    inflight.current?.abort()
    const controller = new AbortController()
    inflight.current = controller
    setError(null)
    try {
      const qs = new URLSearchParams({ classroomId })
      if (studentId) qs.set('studentId', studentId)
      const res = await fetch(`/api/teacher/learn?${qs}`, { cache: 'no-store', signal: controller.signal })
      const body = (await res.json().catch(() => null)) as (ClassData & OneData & { message?: string }) | null
      if (controller.signal.aborted) return
      if (!res.ok || !body) {
        setData(null)
        setError(body?.message ?? 'อ่านผลเส้นทางเรียนไม่สำเร็จ')
        return
      }
      setData(body)
    } catch {
      if (controller.signal.aborted) return
      setError('เชื่อมต่อไม่ได้ ลองโหลดใหม่อีกครั้ง')
    }
  }, [classroomId, studentId])

  useEffect(() => {
    setData(null)
    void load()
    return () => inflight.current?.abort()
  }, [load])

  const classData = data && 'missions' in data ? data : null
  const rows = useMemo(() => {
    if (!classData) return []
    const list = classData.students
      .map((st) => {
        const ms = st.missions.filter((m) => missionFilter === 'all' || m.missionId === missionFilter)
        return {
          st,
          ms,
          started: ms.length,
          done: ms.filter((m) => m.done).length,
          best: ms.reduce<number | null>((b, m) => (m.bestScore === null ? b : Math.max(b ?? 0, m.bestScore)), null),
          attempts: ms.reduce((a, m) => a + m.attempts, 0),
        }
      })
      .filter((r) => r.started > 0)
      .filter((r) => (statusFilter === 'all' ? true : statusFilter === 'done' ? r.done > 0 : r.done < r.started))
    const k = sort.key
    return list.sort((a, b) => {
      const av = k === 'name' ? a.st.nickname : k === 'done' ? a.done : k === 'best' ? (a.best ?? -1) : a.attempts
      const bv = k === 'name' ? b.st.nickname : k === 'done' ? b.done : k === 'best' ? (b.best ?? -1) : b.attempts
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir
    })
  }, [classData, missionFilter, statusFilter, sort])

  if (!classroomId) return null

  const titles = data?.missionTitles ?? {}
  const prompts = data?.questionPrompts ?? {}
  const title = (id: string) => (titles[id] ? `${id.toUpperCase()} ${titles[id]}` : id.toUpperCase())

  return (
    <details className="t2-more mt-4">
      <summary className="focus-ring">
        <Icon3d name="books" size={32} />
        เส้นทางเรียน ดู · อ่าน · ลงมือ
      </summary>
      <div className="t2-more__body">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => void load()} className="t2-btn focus-ring print:hidden">
          โหลดใหม่
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-2xl bg-danger-100 p-3 text-label font-semibold text-danger-700"
        >
          <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {data && 'student' in data ? (
        <MissionTable missions={data.student.missions} title={title} prompts={prompts} />
      ) : data && 'missions' in data ? (
        <>
          {(() => {
            const started = data.students.filter((st) => st.missions.length > 0)
            const doneStudents = started.filter((st) => st.missions.some((m) => m.done)).length
            const followed = data.missions.reduce((a, m) => a + m.followedRecommendation, 0)
            const different = data.missions.reduce((a, m) => a + m.choseDifferent, 0)
            const att = data.missions.filter((m) => m.attemptsAvg !== null)
            return (
              <div className="mt-3">
                <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="เริ่มเรียนแล้ว" value={started.length} unit="คน" icon={<Icon3d name="rocket" size={30} />} hint={`จาก ${data.students.length} คน`} />
                  <StatTile label="ครบอย่างน้อย 1 ด่าน" value={doneStudents} unit="คน" icon={<Icon3d name="check-mark-button" size={30} />} badge={doneStudents > 0 ? <StatusBadge status="passed" /> : undefined} />
                  <StatTile
                    label="ทำตามที่แนะนำ"
                    value={followed + different > 0 ? `${Math.round((followed / (followed + different)) * 100)}%` : '-'}
                    icon={<Icon3d name="bullseye" size={30} />}
                    hint={`${followed} จาก ${followed + different} ครั้ง`}
                  />
                  <StatTile
                    label="ส่งตรวจ/ด่าน"
                    value={att.length ? n(att.reduce((a, m) => a + (m.attemptsAvg ?? 0), 0) / att.length) : '-'}
                    unit="ครั้ง"
                    icon={<Icon3d name="memo" size={30} />}
                  />
                </div>
              </div>
            )
          })()}

          {data.missions.length === 0 ? (
            <p className="mt-3 text-label text-ink-muted">ยังไม่มีใครเริ่มเส้นทางเรียน</p>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {data.missions.map((m) => (
                <li key={m.missionId} className="rounded-xl bg-surface-sunken p-3">
                  {(() => {
                    const adaptive = m.missionId === 'm1' || m.missionId === 'm2'
                    return (
                      <>
                  <p className="text-label font-bold text-ink"><MissionTag n={Number(m.missionId.slice(1)) || 1}>{title(m.missionId)}</MissionTag></p>
                  {adaptive ? (
                    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Fact label="เช็กพื้นฐานแล้ว" value={`${m.warmedUp} คน · เฉลี่ย ${n(m.warmupAvg)}/3`} />
                      <Fact label="เลือกตามที่แนะนำ" value={`${m.followedRecommendation} คน`} />
                      <Fact label="เลือกต่างจากที่แนะนำ" value={`${m.choseDifferent} คน`} />
                      <Fact label="เรียนครบเกณฑ์" value={`${m.done} คน · ส่งเฉลี่ย ${n(m.attemptsAvg)} ครั้ง`} />
                    </dl>
                  ) : (
                    <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Fact label="คะแนนเกมเฉลี่ย" value={n(m.doneAvgByMode.do)} />
                      <Fact label="ผ่านเกณฑ์" value={`${m.done} คน`} />
                      <Fact label="ส่งเกมเฉลี่ย" value={`${n(m.attemptsAvg)} ครั้ง`} />
                    </dl>
                  )}
                  {adaptive ? <div className="mt-2 overflow-x-auto">
<table className="w-full min-w-[480px] text-left text-label [&_td]:whitespace-nowrap [&_td]:pr-3 [&_th]:whitespace-nowrap [&_th]:pr-3">
                    <thead>
                      <tr className="text-note text-ink-muted">
                        <th className="py-1 font-bold">วิธีเรียน</th>
                        <th className="py-1 font-bold">ระบบแนะนำ</th>
                        <th className="py-1 font-bold">เลือกจริง</th>
                        <th className="py-1 font-bold">ครบเกณฑ์</th>
                        <th className="py-1 font-bold">คะแนนเฉลี่ย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODES.map((mode) => (
                        <tr key={mode} className="border-t border-line">
                          <td className="py-1 font-bold text-ink">{MODE_LABEL[mode]}</td>
                          <td className="py-1">{m.recommended[mode]}</td>
                          <td className="py-1">{m.chosen[mode]}</td>
                          <td className="py-1">{m.doneByMode[mode]}</td>
                          <td className="py-1">{n(m.doneAvgByMode[mode])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div> : null}
                      </>
                    )
                  })()}
                </li>
              ))}
            </ul>
          )}

          {data.students.some((s) => s.missions.length > 0) ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <FilterChips
                  label="ด่าน"
                  value={missionFilter}
                  onChange={setMissionFilter}
                  options={[
                    { value: 'all', label: 'ทั้งหมด' },
                    ...data.missions.map((m) => ({ value: m.missionId, label: m.missionId.toUpperCase() })),
                  ]}
                />
                <FilterChips
                  label="สถานะ"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'ทั้งหมด' },
                    { value: 'done', label: 'ครบเกณฑ์' },
                    { value: 'open', label: 'ยังไม่ครบ' },
                  ]}
                />
              </div>
              <div className="mt-2 max-h-[60vh] overflow-auto rounded-xl ring-1 ring-line">
                <table className="w-full min-w-[640px] text-left text-label">
                  <thead className="sticky top-0 z-10 bg-[var(--c-sunken)]">
                    <tr className="text-note text-ink-muted">
                      {(
                        [
                          ['name', 'นักเรียน'],
                          ['done', 'ครบเกณฑ์ / เริ่มแล้ว'],
                          ['best', 'คะแนนสูงสุด'],
                          ['attempts', 'ส่งตรวจ (ครั้ง)'],
                        ] as const
                      ).map(([key, text]) => (
                        <th
                          key={key}
                          scope="col"
                          className="px-3 py-2 font-bold"
                          aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                        >
                          <button
                            type="button"
                            onClick={() => setSort((p) => ({ key, dir: p.key === key ? (p.dir === 1 ? -1 : 1) : 1 }))}
                            className="min-h-9 font-bold focus-ring"
                          >
                            {text}
                            {sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2 font-bold">
                        <span className="sr-only">รายละเอียด</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-ink-muted">
                          ไม่มีนักเรียนตรงกับตัวกรอง
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.st.studentId} className="border-t border-line hover:bg-surface-sunken">
                          <td className="px-3 py-2 font-bold text-ink">{r.st.nickname}</td>
                          <td className="px-3 py-2 tabular-nums">
                            <StatusBadge status={r.started === 0 ? 'notstarted' : r.done === r.started ? 'passed' : r.done > 0 ? 'inprogress' : 'atrisk'}>
                              {r.done}/{r.started}
                            </StatusBadge>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{n(r.best)}</td>
                          <td className="px-3 py-2 tabular-nums">{r.attempts}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setOpenId(r.st.studentId)}
                              className="min-h-9 rounded-lg px-3 text-note font-medium text-[var(--c-brand)] ring-1 ring-[var(--c-line-strong)] hover:bg-[var(--c-brand-soft)] focus-ring"
                            >
                              ดูรายละเอียด
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <SideDrawer
                open={openId !== null}
                title={data.students.find((s) => s.studentId === openId)?.nickname ?? 'นักเรียน'}
                onClose={() => setOpenId(null)}
              >
                <MissionTable
                  missions={data.students.find((s) => s.studentId === openId)?.missions ?? []}
                  title={title}
                  prompts={prompts}
                />
              </SideDrawer>
            </div>
          ) : null}
        </>
      ) : !error ? (
        <p className="mt-2 text-label text-ink-muted">กำลังโหลด…</p>
      ) : null}
      </div>
    </details>
  )
}

/** เรดาร์ความเข้าใจรายภารกิจ M1-M4 — ร้อยละของคนในห้องที่เรียนครบเกณฑ์ของแต่ละด่าน */
export function MasteryRadarCard({ classroomId }: { classroomId: string | null }) {
  const [data, setData] = useState<ClassData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!classroomId) return
    const controller = new AbortController()
    setData(null)
    setFailed(false)
    fetch(`/api/teacher/learn?${new URLSearchParams({ classroomId })}`, { cache: 'no-store', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((body: ClassData) => setData(body))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [classroomId])

  const ids = ['m1', 'm2', 'm3', 'm4']
  const total = data?.students.length ?? 0
  const rows = ids.map((id, i) => {
    const done = data?.missions.find((m) => m.missionId === id)?.done ?? 0
    const started = data?.students.filter((st) => st.missions.some((m) => m.missionId === id)).length ?? 0
    const learning = Math.max(0, started - done)
    return {
      n: i + 1,
      title: `ด่าน ${i + 1} ${data?.missionTitles[id] ?? ''}`.trim(),
      segments: [
        { status: 'passed' as const, count: done },
        { status: 'inprogress' as const, count: learning },
        { status: 'notstarted' as const, count: Math.max(0, total - started) },
      ],
    }
  })

  return (
    <section className="t2-card" aria-label="ผ่านเกณฑ์รายด่าน">
      <h2 className="t2-card-title">
        <Icon3d name="brain" size={28} />
        ผ่านเกณฑ์รายด่าน (คน)
        <InfoTip label="เรื่องกราฟ" text="แท่งหนึ่งแท่งคือหนึ่งด่าน แบ่งตามสถานะของนักเรียนทั้งห้อง" />
      </h2>
      {failed ? (
        <p role="alert" className="t2-empty">
          อ่านผลไม่สำเร็จ
        </p>
      ) : !data ? (
        <p className="t2-empty">กำลังโหลด…</p>
      ) : (
        <>
          <div className="mb-4">
            <Legend items={STATUS_LEGEND.filter((l) => ['ผ่าน', 'กำลังเรียน', 'ยังไม่เริ่ม'].includes(l.label))} />
          </div>
          <ul className="flex flex-col gap-4">
            {rows.map((r) => (
              <StackBar key={r.n} total={total} segments={r.segments} label={<MissionTag n={r.n}>{r.title}</MissionTag>} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function statusText(m: StudentMissionLearn): string {
  return m.done ? `ครบเกณฑ์ (${modeText(m.doneMode)} ${n(m.doneScore)})` : 'ยังไม่ครบ'
}

function MissionTable({
  missions,
  title,
  prompts,
}: {
  missions: StudentMissionLearn[]
  title: (id: string) => string
  prompts: Prompts
}) {
  if (missions.length === 0) return <p className="mt-2 text-label text-ink-muted">ยังไม่ได้เริ่มเส้นทางเรียน</p>
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {missions.map((m) => (
        <li key={m.missionId} className="rounded-xl bg-surface-sunken p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-label font-bold text-ink">{title(m.missionId)}</p>
            <StatusBadge status={m.done ? 'passed' : m.attempts > 0 ? 'inprogress' : 'notstarted'}>{statusText(m)}</StatusBadge>
          </div>
          {m.missionId === 'm1' || m.missionId === 'm2' ? (
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Fact label="เช็กพื้นฐาน" value={m.warmupScore === null ? '-' : `${m.warmupScore}/${m.warmupTotal ?? 3}`} />
              <Fact label="ระบบแนะนำ" value={modeText(m.recommended)} />
              <Fact
                label="เลือก"
                value={`${modeText(m.chosen)}${m.followed === false ? ' (เลือกเอง)' : ''}${
                  m.modeSwitches > 0 ? ` · เปลี่ยน ${m.modeSwitches} ครั้ง` : ''
                }`}
              />
              <Fact
                label="ส่งตรวจ"
                value={`${m.attempts} ครั้ง${m.bestScore !== null ? ` · สูงสุด ${n(m.bestScore)}` : ''}`}
              />
            </dl>
          ) : (
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Fact label="คะแนนเกม" value={m.bestScore === null ? '-' : n(m.bestScore)} />
              <Fact label="สถานะเกม" value={m.done ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่าน'} />
              <Fact label="ส่งเกม" value={`${m.attempts} ครั้ง`} />
            </dl>
          )}
          {m.latestAnswer ? <LatestAnswer answer={m.latestAnswer} prompts={prompts[m.missionId] ?? {}} /> : null}
        </li>
      ))}
    </ul>
  )
}

function LatestAnswer({ answer, prompts }: { answer: LatestLearnAnswer; prompts: Record<string, string> }) {
  return (
    <details className="mt-2" open>
      <summary className="min-h-11 cursor-pointer py-2 text-label font-bold text-brand-700">
        คำตอบล่าสุด ({MODE_LABEL[answer.mode]} · {n(answer.score)} คะแนน · {answer.passed ? 'ผ่าน' : 'ยังไม่ผ่าน'})
      </summary>
      <ol className="mt-1 flex flex-col gap-2">
        {answer.answers.map((a) => (
          <li key={a.id} className="rounded-xl bg-surface-raised p-3">
            <p className="text-note font-bold text-ink-muted">{prompts[a.id] ?? a.id}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-label text-ink">{a.text.trim() || '(ไม่ได้ตอบ)'}</p>
            {a.score !== null ? (
              <p className="mt-1 text-note text-ink-muted">
                ได้ {n(a.score)} คะแนน
                {a.checkedBy ? ` · ${a.checkedBy === 'ai' ? 'AI ช่วยตรวจ' : 'ตรวจด้วยคำสำคัญ'}` : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-raised p-3">
      <dt className="text-note font-bold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-label font-bold text-ink">{value}</dd>
    </div>
  )
}

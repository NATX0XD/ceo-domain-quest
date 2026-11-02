'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  LatestLearnAnswer,
  LearnResultMode,
  StudentLearnResult,
  StudentMissionLearn,
} from '../../../components/server/learn-results'
import { AlertIcon } from '../../../components/ui'
import { Card, EmptyState, Skeleton, StatusBadge } from '../_ux/ui'
import { MissionTag } from '../_ux/data-viz'
import { Icon3d } from '../_ux/v2'

/**
 * ผลเส้นทางเรียน (ดู / อ่าน / ลงมือทำ) ของนักเรียนคนเดียว — หนึ่งด่านต่อหนึ่งการ์ดขาว
 * ข้อมูลเดียวกับแผงเดิม (GET /api/teacher/learn?studentId=) แค่จัดหน้าใหม่ ค่าที่ว่างไม่โชว์เป็น "-"
 */

const MODE_LABEL: Record<LearnResultMode, string> = { watch: 'ดู', read: 'อ่าน', do: 'ลงมือทำ' }

type Prompts = Record<string, Record<string, string>>
type OneData = { student: StudentLearnResult; missionTitles: Record<string, string>; questionPrompts: Prompts }

const n = (v: number) => String(Math.round(v * 100) / 100)

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] leading-4 text-[var(--c-ink-3)]">{label}</dt>
      <dd className="m-0 text-[15px] leading-6 font-semibold text-[var(--c-ink)]">{value}</dd>
    </div>
  )
}

function MissionCard({ m, title, prompts }: { m: StudentMissionLearn; title: string; prompts: Record<string, string> }) {
  const adaptive = m.missionId === 'm1' || m.missionId === 'm2'
  const num = Number(m.missionId.slice(1)) || 1
  const stats: { label: string; value: string }[] = []
  if (adaptive) {
    if (m.recommended) stats.push({ label: 'ระบบแนะนำ', value: MODE_LABEL[m.recommended] })
    if (m.chosen) {
      stats.push({
        label: 'เลือกเรียน',
        value: `${MODE_LABEL[m.chosen]}${m.followed === false ? ' (เลือกเอง)' : ''}${m.modeSwitches > 0 ? ` · เปลี่ยน ${m.modeSwitches} ครั้ง` : ''}`,
      })
    }
  }
  if (m.attempts > 0) stats.push({ label: 'ส่งตรวจ', value: `${m.attempts} ครั้ง` })
  if (m.bestScore !== null) stats.push({ label: adaptive ? 'คะแนนสูงสุด' : 'คะแนนเกม', value: n(m.bestScore) })

  const warm = adaptive && m.warmupScore !== null ? { score: m.warmupScore, total: m.warmupTotal ?? 3 } : null
  const status = m.done ? 'passed' : m.attempts > 0 ? 'inprogress' : 'notstarted'
  const statusText = m.done
    ? `ผ่านเกณฑ์${m.doneMode ? ` · ${MODE_LABEL[m.doneMode]}` : ''}${m.doneScore !== null ? ` ${n(m.doneScore)}` : ''}`
    : m.attempts > 0
      ? 'กำลังเรียน'
      : 'ยังไม่เริ่ม'

  return (
    <li className="t3-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 min-w-0 text-[16px] font-bold text-[var(--c-ink)]">
          <MissionTag n={num}>{title}</MissionTag>
        </h3>
        <StatusBadge status={status}>{statusText}</StatusBadge>
      </div>

      {stats.length > 0 || warm ? (
        <dl className="m-0 mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
          {warm ? (
            <div className="min-w-[8rem]">
              <dt className="text-[12px] leading-4 text-[var(--c-ink-3)]">เช็กพื้นฐาน</dt>
              <dd className="m-0 flex items-center gap-2 text-[15px] leading-6 font-semibold text-[var(--c-ink)] tabular-nums">
                {warm.score}/{warm.total}
                <span
                  role="img"
                  aria-label={`เช็กพื้นฐาน ${warm.score} จาก ${warm.total}`}
                  className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--c-sunken)]"
                >
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.min(100, (warm.score / (warm.total || 1)) * 100)}%`, background: `var(--m${Math.min(num, 6)})` }}
                  />
                </span>
              </dd>
            </div>
          ) : null}
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} />
          ))}
        </dl>
      ) : null}

      {m.latestAnswer ? <Answers answer={m.latestAnswer} prompts={prompts} /> : null}
    </li>
  )
}

function Answers({ answer, prompts }: { answer: LatestLearnAnswer; prompts: Record<string, string> }) {
  return (
    <details className="group mt-4 border-t border-[var(--c-line)] pt-3" open>
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-[14px] font-semibold text-[var(--c-brand)] [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
        คำตอบล่าสุด
        <span className="font-normal text-[var(--c-ink-3)]">
          {MODE_LABEL[answer.mode]}
          {answer.score !== null ? ` · ${n(answer.score)} คะแนน` : ''}
          {answer.passed === null ? '' : answer.passed ? ' · ผ่าน' : ' · ยังไม่ผ่าน'}
        </span>
      </summary>
      <ol className="m-0 mt-2 flex list-none flex-col divide-y divide-[var(--c-line)] p-0">
        {answer.answers.map((a) => (
          <li key={a.id} className="py-3 first:pt-1 last:pb-0">
            <p className="m-0 text-[13px] leading-5 text-[var(--c-ink-3)]">{prompts[a.id] ?? a.id}</p>
            <p className="m-0 mt-1 text-[15px] leading-6 font-medium break-words whitespace-pre-wrap text-[var(--c-ink)]">
              {a.text.trim() || <span className="font-normal text-[var(--c-ink-3)]">(ไม่ได้ตอบ)</span>}
            </p>
            {a.score !== null || a.checkedBy ? (
              <p className="m-0 mt-1.5 flex flex-wrap items-center gap-1.5">
                {a.score !== null ? (
                  <span className="rounded-full bg-[var(--c-sunken)] px-2 py-0.5 text-[12px] font-semibold text-[var(--c-ink-2)] tabular-nums">
                    {n(a.score)} คะแนน
                  </span>
                ) : null}
                {a.checkedBy ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[12px] font-semibold"
                    style={
                      a.checkedBy === 'ai'
                        ? { background: 'var(--d-inprogress-soft)', color: 'var(--d-inprogress-ink)' }
                        : { background: 'var(--c-sunken)', color: 'var(--c-ink-3)' }
                    }
                  >
                    {a.checkedBy === 'ai' ? 'AI ช่วยตรวจ' : 'ตรวจด้วยคำสำคัญ'}
                  </span>
                ) : null}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

export function MissionLearnCards({ classroomId, studentId }: { classroomId: string; studentId: string }) {
  const [data, setData] = useState<OneData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inflight = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    inflight.current?.abort()
    const controller = new AbortController()
    inflight.current = controller
    setError(null)
    try {
      const qs = new URLSearchParams({ classroomId, studentId })
      const res = await fetch(`/api/teacher/learn?${qs}`, { cache: 'no-store', signal: controller.signal })
      const body = (await res.json().catch(() => null)) as (OneData & { message?: string }) | null
      if (controller.signal.aborted) return
      if (!res.ok || !body) {
        setData(null)
        setError(body?.message ?? 'อ่านผลเส้นทางเรียนไม่สำเร็จ')
        return
      }
      setData(body)
    } catch {
      if (!controller.signal.aborted) setError('เชื่อมต่อไม่ได้ ลองโหลดใหม่อีกครั้ง')
    }
  }, [classroomId, studentId])

  useEffect(() => {
    setData(null)
    void load()
    return () => inflight.current?.abort()
  }, [load])

  const titles = data?.missionTitles ?? {}
  const label = (id: string) => (titles[id] ? `${id.toUpperCase()} ${titles[id]}` : id.toUpperCase())

  return (
    <section aria-label="เส้นทางเรียน ดู อ่าน ลงมือ" className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2 text-[18px] font-bold text-[var(--c-ink)]">
          <Icon3d name="books" size={26} />
          เส้นทางเรียน ดู · อ่าน · ลงมือ
        </h2>
        <button type="button" onClick={() => void load()} className="t2-btn focus-ring print:hidden">
          โหลดใหม่
        </button>
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-100 p-3 text-[14px] font-semibold text-danger-700">
          <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {data ? (
        data.student.missions.length === 0 ? (
          <Card>
            <EmptyState title="ยังไม่ได้เริ่มเส้นทางเรียน" body="เมื่อนักเรียนเริ่มเรียน ผลรายด่านจะขึ้นที่นี่" />
          </Card>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {data.student.missions.map((m) => (
              <MissionCard key={m.missionId} m={m} title={label(m.missionId)} prompts={data.questionPrompts[m.missionId] ?? {}} />
            ))}
          </ul>
        )
      ) : !error ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <Skeleton className="h-32 w-full" />
          <span className="sr-only">กำลังโหลด</span>
        </div>
      ) : null}
    </section>
  )
}

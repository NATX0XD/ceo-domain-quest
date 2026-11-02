'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Card, Donut, EmptyState, Legend, STATUS_LEGEND, StatTile,
  type PassStatus,
} from './ui'
import { StudentCards, cardStatus, type StudentCardData } from './student-cards'
import { Icon3d } from './v2'
import { UrlTabs } from './url-tabs'
import { MissionTag, StackBar } from './data-viz'

export interface HomeStudent extends StudentCardData {
  /** รหัสด่านที่ผ่านแล้ว เช่น m1 m2 */
  passedIds: string[]
  /** รหัสด่านที่เริ่มแล้ว */
  startedIds: string[]
}

const MISSIONS = [
  { id: 'm1', n: 1, name: 'ด่าน 1 · รู้จักชื่อโดเมน' },
  { id: 'm2', n: 2, name: 'ด่าน 2 · เลือกนามสกุล' },
  { id: 'm3', n: 3, name: 'ด่าน 3 · เจ้าหน้าที่จดทะเบียน' },
  { id: 'm4', n: 4, name: 'ด่าน 4 · ค้นหาชื่อที่ใช่' },
]

export function HomeOverview({
  students,
  pendingCount,
  classroomId,
  roomCode,
  greeting,
  teacherName,
}: {
  students: HomeStudent[]
  pendingCount: number
  classroomId: string | null
  roomCode: string | null
  greeting?: string
  teacherName?: string | null
}) {
  const [requestCount, setRequestCount] = useState<number | null>(null)
  useEffect(() => {
    if (!classroomId) return
    let alive = true
    void fetch(`/api/plan-request?classroomId=${classroomId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { requests?: { status?: string }[] } | null) => {
        if (alive && d) setRequestCount((d.requests ?? []).filter((r) => (r.status ?? 'pending') === 'pending').length)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [classroomId])

  const q = classroomId ? `?classroomId=${classroomId}` : ''
  const total = students.length
  const avg = total > 0 ? Math.round((students.reduce((a, s) => a + Math.min(s.cleared, 5) / 5, 0) / total) * 100) : 0
  const ceoDone = students.filter((s) => s.ceoDone).length
  const byStatus = (st: PassStatus) => students.filter((s) => cardStatus(s) === st).length
  const notStarted = byStatus('notstarted')
  const requests = requestCount ?? 0

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-[15px] text-[var(--c-ink-2)]">
        {greeting ?? 'สวัสดี'} <strong className="font-bold text-[var(--c-ink)]">{teacherName ?? 'คุณครู'}</strong>
        {pendingCount + requests === 0 ? ' · ตอนนี้ไม่มีงานค้าง' : ''}
      </p>

      <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4">
        <StatTile tone="blue" href={`/teacher/student${q}`} label="ผู้เรียนในห้อง" value={total} unit="คน" icon={<Icon3d name="busts-in-silhouette" size={30} />} hint={`ส่ง CEO แล้ว ${ceoDone} คน`} />
        <StatTile tone="rose" href={`/teacher/review${q}`} label="งานรอตรวจ" value={pendingCount} unit="รายการ" icon={<Icon3d name="memo" size={30} />} hint={pendingCount === 0 ? 'ไม่มีงานค้าง' : 'รอครูยืนยันคะแนน'} />
        <StatTile tone="teal" href={`/teacher/requests${q}`} label="คำขอรอตอบ" value={requests} unit="รายการ" icon={<Icon3d name="speech-balloon" size={30} />} hint={requests === 0 ? 'ไม่มีคำขอค้าง' : 'ตอบแล้วเด็กเห็นทันที'} />
        <StatTile tone="green" label="ความคืบหน้าเฉลี่ย" value={`${avg}%`} icon={<Icon3d name="chart-increasing" size={30} />} hint="จาก 5 ด่าน (รวม CEO)" />
      </div>

      <UrlTabs
        label="มุมมองภาพรวม"
        items={[
          { value: 'progress', label: 'ความคืบหน้า', content: (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card title="ความคืบหน้าแต่ละด่าน" tip="แท่งหนึ่งแท่งคือหนึ่งด่าน แบ่งตามสถานะของนักเรียนทั้งห้อง">
          <div className="mb-4">
            <Legend items={STATUS_LEGEND.filter((l) => ['ผ่าน', 'กำลังเรียน', 'ยังไม่เริ่ม'].includes(l.label))} />
          </div>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {MISSIONS.map((m) => {
              const done = students.filter((s) => s.passedIds.includes(m.id)).length
              const learning = students.filter((s) => !s.passedIds.includes(m.id) && s.startedIds.includes(m.id)).length
              return (
                <StackBar
                  key={m.id}
                  total={total}
                  label={<MissionTag n={m.n}>{m.name}</MissionTag>}
                  segments={[
                    { status: 'passed', count: done },
                    { status: 'inprogress', count: learning },
                    { status: 'notstarted', count: Math.max(0, total - done - learning) },
                  ]}
                />
              )
            })}
            <StackBar
              total={total}
              label={<MissionTag n={6}>CEO · เสนอแผนธุรกิจ</MissionTag>}
              segments={[
                { status: 'passed', count: ceoDone },
                { status: 'notstarted', count: Math.max(0, total - ceoDone) },
              ]}
            />
          </ul>
        </Card>

        <Card title="สถานะผู้เรียน">
          {total === 0 ? (
            <EmptyState art={null} icon={<Icon3d name="busts-in-silhouette" size={30} />} title="ยังไม่มีข้อมูล" />
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-6 py-2">
              <Donut
                size={150}
                stroke={20}
                parts={[
                  { value: byStatus('passed'), color: 'var(--d-passed)', label: 'ส่ง CEO แล้ว' },
                  { value: byStatus('inprogress'), color: 'var(--d-inprogress)', label: 'กำลังเรียน' },
                  { value: notStarted, color: 'var(--d-notstarted)', label: 'ยังไม่เริ่ม' },
                ]}
                center={<span><span className="block text-[26px] leading-7 font-extrabold tabular-nums">{avg}%</span><span className="block text-[12px] text-[var(--c-ink-3)]">เฉลี่ย</span></span>}
              />
              <ul className="m-0 min-w-0 flex-1 list-none space-y-2.5 p-0 text-[14px]">
                {([['passed', 'ส่ง CEO แล้ว'], ['inprogress', 'กำลังเรียน'], ['notstarted', 'ยังไม่เริ่ม']] as [PassStatus, string][]).map(([st, label]) => (
                  <li key={st} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span aria-hidden className="size-3 rounded-[4px]" style={{ background: `var(--d-${st})` }} />{label}</span>
                    <span className="font-bold tabular-nums">{byStatus(st)} <span className="font-medium text-[var(--c-ink-3)]">คน</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
          ) },
          { value: 'students', label: 'นักเรียน', count: total, content: (
      <section aria-label="นักเรียน">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[16px] leading-6 font-bold text-[var(--c-ink)]">นักเรียน</h2>
          {total > 4 ? <Link href={`/teacher/student${q}`} className="text-[14px] font-semibold text-[var(--c-brand)]">ดูทั้งหมด {total} คน ›</Link> : null}
        </div>
        <StudentCards students={students} classroomId={classroomId} roomCode={roomCode} limit={4} filterable={false} />
      </section>
          ) },
        ]}
      />
    </div>
  )
}

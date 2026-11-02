'use client'

import Link from 'next/link'
import { Card, DataTable, EmptyState, Legend, STATUS_LEGEND, StatTile, StatusBadge, type PassStatus } from './ui'
import { Icon3d } from './v2'
import { MissionTag, StackBar } from './data-viz'

export interface HomeStudent {
  studentId: string
  nickname: string
  /** รหัสด่านที่ผ่านแล้ว เช่น m1 m2 */
  passed: string[]
  /** รหัสด่านที่เริ่มแล้ว */
  started: string[]
  ceoDone: boolean
  pre: number | null
}

const MISSIONS = [
  { id: 'm1', n: 1, name: 'ด่าน 1' },
  { id: 'm2', n: 2, name: 'ด่าน 2' },
  { id: 'm3', n: 3, name: 'ด่าน 3' },
  { id: 'm4', n: 4, name: 'ด่าน 4' },
]

function statusOf(s: HomeStudent): PassStatus {
  const cleared = s.passed.length + (s.ceoDone ? 1 : 0)
  if (s.ceoDone) return 'passed'
  if (cleared > 0 || s.started.length > 0) return 'inprogress'
  return 'notstarted'
}

/** ภาพรวมห้องของหน้าแรกครู — อ่านอย่างเดียว สีสถานะมาจากโทเคนสีข้อมูลชุดเดียวกับหน้ารายงาน */
export function HomeOverview({
  students,
  pendingCount,
  classroomId,
  roomCode,
}: {
  students: HomeStudent[]
  pendingCount: number
  classroomId: string | null
  roomCode: string | null
}) {
  const total = students.length
  const cleared = (s: HomeStudent) => s.passed.length + (s.ceoDone ? 1 : 0)
  const avg = total > 0 ? Math.round((students.reduce((a, s) => a + cleared(s) / 5, 0) / total) * 100) : 0
  const ceoDone = students.filter((s) => s.ceoDone).length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-4">
        <StatTile label="ผู้เรียนในห้อง" value={total} unit="คน" icon={<Icon3d name="busts-in-silhouette" size={30} />} hint={`ห้อง ${roomCode ?? 'ยังไม่มีรหัส'}`} />
        <StatTile label="ส่งงาน CEO แล้ว" value={ceoDone} unit="คน" icon={<Icon3d name="trophy" size={30} />} badge={ceoDone > 0 ? <StatusBadge status="passed" /> : <StatusBadge status="notstarted" />} />
        <StatTile
          label="งานรอตรวจ"
          value={pendingCount}
          unit="รายการ"
          icon={<Icon3d name="memo" size={30} />}
          badge={pendingCount > 0 ? <StatusBadge status="atrisk">รอครูยืนยัน</StatusBadge> : undefined}
          hint={pendingCount === 0 ? 'ไม่มีงานค้าง' : undefined}
        />
        <StatTile label="ความคืบหน้าเฉลี่ย" value={`${avg}%`} icon={<Icon3d name="chart-increasing" size={30} />} hint="จาก 5 ด่าน (รวม CEO)" />
      </div>

      <Card title="ความคืบหน้าแต่ละด่าน (คน)" tip="แท่งหนึ่งแท่งคือหนึ่งด่าน แบ่งตามสถานะของนักเรียนทั้งห้อง">
        <div className="mb-4">
          <Legend items={STATUS_LEGEND.filter((l) => ['ผ่าน', 'กำลังเรียน', 'ยังไม่เริ่ม'].includes(l.label))} />
        </div>
        <ul className="flex flex-col gap-4">
          {MISSIONS.map((m) => {
            const done = students.filter((s) => s.passed.includes(m.id)).length
            const learning = students.filter((s) => !s.passed.includes(m.id) && s.started.includes(m.id)).length
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
            label={<MissionTag n={6}>CEO</MissionTag>}
            segments={[
              { status: 'passed', count: ceoDone },
              { status: 'notstarted', count: Math.max(0, total - ceoDone) },
            ]}
          />
        </ul>
      </Card>

      <Card title="ความคืบหน้ารายคน" tip="ข้อมูลนี้อ่านอย่างเดียว · กดปุ่มเพื่อเปิดรายงานรายคน" flush>
        <DataTable
          caption="ความคืบหน้ารายคน"
          rows={students}
          rowKey={(s) => s.studentId}
          empty={<EmptyState icon={<Icon3d name="busts-in-silhouette" size={24} />} title="ยังไม่มีผู้เรียนในห้องนี้" body={roomCode ? `ให้นักเรียนเข้าห้องด้วยรหัส ${roomCode}` : 'สร้างห้องแล้วแชร์รหัสห้องให้นักเรียน'} />}
          columns={[
            {
              key: 'name',
              header: 'ผู้เรียน',
              cell: (s) => (
                <span className="flex items-center gap-2 font-medium">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: `var(--d-${statusOf(s)})` }} />
                  {s.nickname}
                </span>
              ),
            },
            {
              key: 'progress',
              header: 'ความคืบหน้า',
              cell: (s) => {
                const pct = Math.round((cleared(s) / 5) * 100)
                return (
                  <span className="flex min-w-32 flex-col gap-1">
                    <span className="h-2 overflow-hidden rounded-full bg-[var(--c-sunken)]">
                      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--d-passed)' }} />
                    </span>
                    <span className="text-[13px] text-[var(--c-ink-3)] tabular-nums">{cleared(s)}/5 ด่าน · {pct}%</span>
                  </span>
                )
              },
            },
            { key: 'pre', header: 'ก่อนเรียน', numeric: true, cell: (s) => (s.pre === null ? <span className="text-[var(--c-ink-3)]">ยังไม่ทำ</span> : `${s.pre} คะแนน`) },
            {
              key: 'status',
              header: 'สถานะ',
              cell: (s) => (
                <StatusBadge status={statusOf(s)}>{s.ceoDone ? 'ส่ง CEO แล้ว' : statusOf(s) === 'inprogress' ? 'กำลังเรียน' : 'ยังไม่เริ่ม'}</StatusBadge>
              ),
            },
            {
              key: 'open',
              header: <span className="sr-only">รายงาน</span>,
              className: 'text-right',
              cell: (s) => (
                <Link
                  href={`/teacher/student?classroomId=${classroomId}&studentId=${s.studentId}`}
                  className="inline-flex h-9 items-center rounded-lg px-3 text-[14px] font-medium text-[var(--c-brand)] hover:bg-[var(--c-brand-soft)]"
                >
                  ดูรายงาน ›
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

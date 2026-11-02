'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Avatar, Card, DataTable, Donut, EmptyState, Legend, QuickTile, Ring, STATUS_LEGEND, StatTile, StatusBadge,
  type PassStatus, type Tone,
} from './ui'
import { Icon3d, type Icon3dName } from './v2'
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
  { id: 'm1', n: 1, name: 'ด่าน 1 · รู้จักชื่อโดเมน' },
  { id: 'm2', n: 2, name: 'ด่าน 2 · เลือกนามสกุล' },
  { id: 'm3', n: 3, name: 'ด่าน 3 · เจ้าหน้าที่จดทะเบียน' },
  { id: 'm4', n: 4, name: 'ด่าน 4 · ค้นหาชื่อที่ใช่' },
]

function statusOf(s: HomeStudent): PassStatus {
  const cleared = s.passed.length + (s.ceoDone ? 1 : 0)
  if (s.ceoDone) return 'passed'
  if (cleared > 0 || s.started.length > 0) return 'inprogress'
  return 'notstarted'
}

function NoticeRow({ href, icon, tone, title, sub, count, cta }: { href: string; icon: Icon3dName; tone: Tone; title: string; sub: string; count?: number; cta: string }) {
  return (
    <li>
      <Link href={href} data-tone={tone} className="t3-row-hover flex items-center gap-3 rounded-2xl p-2.5">
        <span aria-hidden className="t3-tile size-12 rounded-2xl"><Icon3d name={icon} size={28} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[15px] font-bold text-[var(--c-ink)]">
            {title}
            {count ? <span className="rounded-full px-2 text-[12px] leading-5 font-bold" style={{ background: 'var(--tn-soft)', color: 'var(--tn-ink)' }}>{count}</span> : null}
          </span>
          <span className="block truncate text-[13px] text-[var(--c-ink-3)]">{sub}</span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--tn)' }}>{cta} ›</span>
      </Link>
    </li>
  )
}

/** ภาพรวมห้องของหน้าแรกครู — อ่านอย่างเดียว สีสถานะมาจากโทเคนสีข้อมูลชุดเดียวกับหน้ารายงาน */
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
  const cleared = (s: HomeStudent) => s.passed.length + (s.ceoDone ? 1 : 0)
  const avg = total > 0 ? Math.round((students.reduce((a, s) => a + cleared(s) / 5, 0) / total) * 100) : 0
  const ceoDone = students.filter((s) => s.ceoDone).length
  const byStatus = (st: PassStatus) => students.filter((s) => statusOf(s) === st).length
  const notStarted = byStatus('notstarted')
  const requests = requestCount ?? 0

  return (
    <div className="flex flex-col gap-6">
      {/* hero ทักทาย + ภาพโดม */}
      <section aria-label="สรุปวันนี้" className="t3-hero px-6 py-7 sm:px-9 sm:py-9">
        <div className="relative z-[1] max-w-[34rem] md:max-w-[58%]">
          <p className="text-[15px] font-medium text-white/80">{greeting ?? 'สวัสดี'}</p>
          <h1 className="mt-1 text-[28px] leading-10 font-extrabold sm:text-[34px] sm:leading-[1.25]">{teacherName ?? 'คุณครู'}</h1>
          <p className="mt-2 text-[15px] leading-7 text-white/85">
            {roomCode ? `ห้อง ${roomCode} · ` : ''}มีผู้เรียน {total} คน
            {pendingCount + requests > 0
              ? ` · วันนี้มีงานรอตรวจ ${pendingCount} รายการ คำขอรอตอบ ${requests} รายการ`
              : ' · ตอนนี้ไม่มีงานค้าง ผู้เรียนเริ่มด่านตามความพร้อมของตัวเอง'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href={`/teacher/review${q}`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-bold text-[var(--c-brand)] shadow-lg hover:bg-[var(--c-brand-soft)]">
              <Icon3d name="memo" size={20} /> ตรวจงาน{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Link>
            <Link href={`/teacher/report${q}`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/15 px-5 text-[15px] font-semibold text-white ring-1 ring-white/30 hover:bg-white/25">
              ดูรายงานห้อง
            </Link>
            <Link href={`/teacher/missions${q}`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/15 px-5 text-[15px] font-semibold text-white ring-1 ring-white/30 hover:bg-white/25">
              ตั้งค่าด่าน
            </Link>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ภาพตกแต่งนิ่ง */}
        <img src="/landing/dome-wave.webp" alt="" aria-hidden draggable={false} className="t3-hero-art max-md:hidden" />
      </section>

      <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4">
        <StatTile tone="blue" href={`/teacher/student${q}`} label="ผู้เรียนในห้อง" value={total} unit="คน" icon={<Icon3d name="busts-in-silhouette" size={32} />} hint={`ห้อง ${roomCode ?? 'ยังไม่มีรหัส'}`} />
        <StatTile tone="amber" href={`/teacher/showcase${q}`} label="ส่งงาน CEO แล้ว" value={ceoDone} unit="คน" icon={<Icon3d name="trophy" size={32} />} badge={ceoDone > 0 ? <StatusBadge status="passed" /> : <StatusBadge status="notstarted" />} />
        <StatTile
          tone="rose"
          href={`/teacher/review${q}`}
          label="งานรอตรวจ"
          value={pendingCount}
          unit="รายการ"
          icon={<Icon3d name="memo" size={32} />}
          badge={pendingCount > 0 ? <StatusBadge status="atrisk">รอครูยืนยัน</StatusBadge> : undefined}
          hint={pendingCount === 0 ? 'ไม่มีงานค้าง' : undefined}
        />
        <StatTile tone="green" label="ความคืบหน้าเฉลี่ย" value={`${avg}%`} icon={<Icon3d name="chart-increasing" size={32} />} hint="จาก 5 ด่าน (รวม CEO)" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card title="ความคืบหน้าแต่ละด่าน (คน)" icon={<Icon3d name="bar-chart" size={22} />} tone="blue" tip="แท่งหนึ่งแท่งคือหนึ่งด่าน แบ่งตามสถานะของนักเรียนทั้งห้อง">
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
              label={<MissionTag n={6}>CEO · เสนอแผนธุรกิจ</MissionTag>}
              segments={[
                { status: 'passed', count: ceoDone },
                { status: 'notstarted', count: Math.max(0, total - ceoDone) },
              ]}
            />
          </ul>
        </Card>

        <Card title="ศูนย์แจ้งเตือนของห้อง" icon={<Icon3d name="bell" size={22} />} tone="amber" action={<Link href={`/teacher/requests${q}`} className="text-[13px] font-semibold text-[var(--c-brand)]">ดูทั้งหมด ›</Link>}>
          <ul className="flex flex-col gap-1">
            <NoticeRow href={`/teacher/review${q}`} icon="memo" tone="rose" title="งานรอตรวจ" count={pendingCount} sub={pendingCount > 0 ? 'ผู้เรียนส่งงานแล้ว รอครูยืนยันคะแนน' : 'ไม่มีงานค้าง'} cta="ตรวจงาน" />
            <NoticeRow href={`/teacher/requests${q}`} icon="speech-balloon" tone="blue" title="คำขอจากนักเรียน" count={requests} sub={requests > 0 ? 'ขอเปลี่ยนระดับ ช่องทาง หรือเวลาเพิ่ม' : 'ยังไม่มีคำขอที่รอตอบ'} cta="ตอบคำขอ" />
            <NoticeRow href={`/teacher/student${q}`} icon="hourglass-not-done" tone="amber" title="ยังไม่เริ่มเรียน" count={notStarted} sub={notStarted > 0 ? 'ผู้เรียนที่ยังไม่ผ่านด่านใดเลย' : 'ทุกคนเริ่มเรียนแล้ว'} cta="ดูรายชื่อ" />
            <NoticeRow href={`/teacher/showcase${q}`} icon="trophy" tone="green" title="ผลงาน CEO" count={ceoDone} sub={ceoDone > 0 ? 'ผลงานที่ส่งแล้ว ดูตัวอย่างเด่นได้' : 'ยังไม่มีผู้ส่งงาน CEO'} cta="ดูผลงาน" />
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Card title="ความคืบหน้ารายคน" icon={<Icon3d name="graduation-cap" size={22} />} tone="purple" tip="ข้อมูลนี้อ่านอย่างเดียว · กดปุ่มเพื่อเปิดรายงานรายคน" flush>
          <DataTable
            caption="ความคืบหน้ารายคน"
            rows={students}
            rowKey={(s) => s.studentId}
            empty={<EmptyState title="ยังไม่มีผู้เรียนในห้องนี้" body={roomCode ? `ให้นักเรียนเข้าห้องด้วยรหัส ${roomCode}` : 'สร้างห้องแล้วแชร์รหัสห้องให้นักเรียน'} />}
            columns={[
              {
                key: 'name',
                header: 'ผู้เรียน',
                cell: (s) => (
                  <span className="flex items-center gap-3 font-semibold">
                    <Avatar name={s.nickname} size={36} />
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
                    <span className="flex min-w-36 items-center gap-3">
                      <Ring value={pct} size={40} stroke={5} color={`var(--d-${statusOf(s)})`} label={`${pct}%`}>
                        <span className="text-[11px] font-bold tabular-nums">{pct}</span>
                      </Ring>
                      <span className="text-[13px] text-[var(--c-ink-3)] tabular-nums">{cleared(s)}/5 ด่าน</span>
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
                    className="inline-flex h-9 items-center rounded-xl px-3 text-[14px] font-semibold text-[var(--c-brand)] hover:bg-[var(--c-brand-soft)]"
                  >
                    ดูรายงาน ›
                  </Link>
                ),
              },
            ]}
          />
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="ภาพรวมสถานะผู้เรียน" icon={<Icon3d name="bullseye" size={22} />} tone="green">
            {total === 0 ? (
              <EmptyState art={null} icon={<Icon3d name="busts-in-silhouette" size={30} />} title="ยังไม่มีข้อมูล" />
            ) : (
              <div className="flex flex-wrap items-center gap-5">
                <Donut
                  size={140}
                  stroke={20}
                  parts={[
                    { value: byStatus('passed'), color: 'var(--d-passed)', label: 'ส่ง CEO แล้ว' },
                    { value: byStatus('inprogress'), color: 'var(--d-inprogress)', label: 'กำลังเรียน' },
                    { value: notStarted, color: 'var(--d-notstarted)', label: 'ยังไม่เริ่ม' },
                  ]}
                  center={<span><span className="block text-[26px] leading-7 font-extrabold tabular-nums">{avg}%</span><span className="block text-[12px] text-[var(--c-ink-3)]">เฉลี่ย</span></span>}
                />
                <ul className="min-w-0 flex-1 space-y-2 text-[14px]">
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

          <Card title="ทางลัด" icon={<Icon3d name="rocket" size={22} />} tone="orange">
            <div className="grid grid-cols-3 gap-2">
              <QuickTile href={`/teacher/student${q}`} icon={<Icon3d name="graduation-cap" size={30} />} label="นักเรียน" tone="blue" />
              <QuickTile href={`/teacher/review${q}`} icon={<Icon3d name="memo" size={30} />} label="ตรวจงาน" tone="rose" badge={pendingCount} />
              <QuickTile href={`/teacher/requests${q}`} icon={<Icon3d name="speech-balloon" size={30} />} label="คำขอ" tone="teal" badge={requests} />
              <QuickTile href={`/teacher/report${q}`} icon={<Icon3d name="bar-chart" size={30} />} label="รายงาน" tone="purple" />
              <QuickTile href={`/teacher/showcase${q}`} icon={<Icon3d name="glowing-star" size={30} />} label="ผลงานเด่น" tone="amber" />
              <QuickTile href={`/teacher/missions${q}`} icon={<Icon3d name="gear" size={30} />} label="ตั้งค่าด่าน" tone="gray" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Card, Donut, EmptyState, Legend, STATUS_LEGEND,
  type PassStatus,
} from './ui'
import { StudentCards, cardStatus, type StudentCardData } from './student-cards'
import { Icon3d, type Icon3dName } from './v2'
import { UrlTabs } from './url-tabs'
import { MissionTag, StackBar } from './data-viz'

export interface HomeStudent extends StudentCardData {
  /** รหัสด่านที่ผ่านแล้ว เช่น m1 m2 */
  passedIds: string[]
  /** รหัสด่านที่เริ่มแล้ว */
  startedIds: string[]
}

export interface HelpStudent {
  studentId: string
  nickname: string
  reason: string
}

const MISSIONS = [
  { id: 'm1', n: 1, name: 'ด่าน 1 · รู้จักชื่อโดเมน' },
  { id: 'm2', n: 2, name: 'ด่าน 2 · เลือกนามสกุล' },
  { id: 'm3', n: 3, name: 'ด่าน 3 · เจ้าหน้าที่จดทะเบียน' },
  { id: 'm4', n: 4, name: 'ด่าน 4 · ค้นหาชื่อที่ใช่' },
]

const BTN = 'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold whitespace-nowrap text-white transition-[filter,transform] hover:brightness-110 active:translate-y-px focus-ring'

export function HomeOverview({
  students,
  pendingCount,
  classroomId,
  roomCode,
  joinPath,
  qrSvg,
  help,
  showcaseCount,
  dome = [],
}: {
  students: HomeStudent[]
  pendingCount: number
  classroomId: string | null
  roomCode: string | null
  joinPath: string | null
  qrSvg: string | null
  help: HelpStudent[]
  showcaseCount: number
  /** บรรทัดสรุปห้อง สร้างฝั่งเซิร์ฟเวอร์ด้วยกฎ */
  dome?: string[]
}) {
  const [requestCount, setRequestCount] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [share, setShare] = useState(false)
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

  async function copyLink() {
    if (!joinPath) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${joinPath}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setShare(true)
    }
  }

  const q = classroomId ? `?classroomId=${classroomId}` : ''
  const total = students.length
  const avg = total > 0 ? Math.round((students.reduce((a, s) => a + Math.min(s.cleared, 5) / 5, 0) / total) * 100) : 0
  const ceoDone = students.filter((s) => s.ceoDone).length
  const byStatus = (st: PassStatus) => students.filter((s) => cardStatus(s) === st).length
  const notStarted = byStatus('notstarted')

  const chips: { key: string; count: number | null; icon: Icon3dName; title: string; href: string; tone: string }[] = [
    { key: 'review', count: pendingCount, icon: 'memo', title: 'งานให้ครูดู', href: `/teacher/review${q}`, tone: 'purple' },
    { key: 'requests', count: requestCount, icon: 'speech-balloon', title: 'คำขอ', href: `/teacher/requests${q}`, tone: 'blue' },
    { key: 'help', count: help.length, icon: 'warning', title: 'นักเรียนอาจต้องช่วย', href: `/teacher/student${q}`, tone: 'amber' },
    { key: 'showcase', count: showcaseCount, icon: 'glowing-star', title: 'ผลงานรอคัด', href: `/teacher/showcase${q}`, tone: 'rose' },
  ]

  const openBoard = () => {
    if (classroomId) window.open(`/board?classroomId=${classroomId}&mode=join`, '_blank', 'noopener')
  }

  const actions: { label: string; icon: Icon3dName; tone: string; href?: string; onClick?: () => void }[] = [
    { label: 'ชวนนักเรียนเข้าห้อง', tone: 'green', icon: 'door', onClick: openBoard },
    { label: 'ตั้งค่าด่าน', tone: 'gray', icon: 'gear', href: `/teacher/missions${q}` },
    { label: 'ดูรายงาน', tone: 'blue', icon: 'bar-chart', href: `/teacher/report${q}` },
    { label: 'พิมพ์เกียรติบัตร/รายงาน', tone: 'orange', icon: 'printer', href: `/teacher/student${q}` },
    { label: 'ฉายผลงานเด่น', tone: 'rose', icon: 'television', href: `/teacher/showcase${q ? q + "&" : "?"}tab=screen` },
    { label: 'จัดการห้อง', tone: 'teal', icon: 'clipboard', href: `/teacher/settings${q}` },
  ]

  const sharePanel = (
    <div className="flex flex-wrap items-center gap-5">
      {qrSvg ? (
        // eslint-disable-next-line react/no-danger
        <div role="img" aria-label="QR code เข้าห้อง" className="size-36 shrink-0 rounded-xl border border-[var(--c-line)] bg-white p-1.5" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      ) : null}
      <div className="min-w-0 flex-1 basis-56">
        <p className="m-0 text-[15px] font-bold text-[var(--c-ink)]">ให้นักเรียนสแกน QR หรือเปิดลิงก์เข้าห้อง</p>
        <p className="mt-1 mb-3 text-[14px] text-[var(--c-ink-3)]">ส่งลิงก์ในกลุ่มห้องเรียน หรือฉาย QR ขึ้นจอ</p>
        <button type="button" onClick={() => void copyLink()} disabled={!joinPath} className={`${BTN} max-w-xs bg-[var(--c-brand)] disabled:opacity-50`}>
          {copied ? 'คัดลอกลิงก์แล้ว ✓' : 'คัดลอกลิงก์เข้าห้อง'}
        </button>
        <button type="button" onClick={openBoard} className={`${BTN} mt-2 max-w-xs bg-[var(--c-brand)]`}>เปิดจอหน้าห้อง (QR ใหญ่)</button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {total === 0 ? (
        <section aria-labelledby="first-run" className="t3-card overflow-hidden">
          <div className="border-b border-[var(--c-line)] bg-[var(--c-brand-soft)] p-5 sm:px-6">
            <h2 id="first-run" className="m-0 text-[20px] leading-7 font-extrabold text-[var(--c-ink)]">เริ่มต้นใน 3 ขั้นตอน</h2>
            <p className="m-0 mt-1 text-[14px] text-[var(--c-ink-2)]">ห้องนี้ยังไม่มีนักเรียน ชวนนักเรียนเข้าห้องก่อน แล้วผลจะขึ้นที่หน้านี้เอง</p>
          </div>
          <ol className="m-0 grid list-none gap-3 p-5 sm:px-6 md:grid-cols-3">
            {[
              { n: 1, t: 'สร้าง/เลือกห้อง', d: roomCode ? 'มีห้องพร้อมใช้แล้ว' : 'เปิดห้องใหม่ที่หน้าจัดการห้อง', done: !!roomCode },
              { n: 2, t: 'แชร์ลิงก์ให้นักเรียน', d: 'คัดลอกลิงก์หรือให้สแกน QR', done: false },
              { n: 3, t: 'รอดูผล', d: 'ความคืบหน้าและงานรอตรวจจะขึ้นที่นี่', done: false },
            ].map((st) => (
              <li key={st.n} className="flex items-start gap-3 rounded-2xl bg-[var(--c-bg)] p-4">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-extrabold text-white" style={{ background: st.done ? 'var(--s-success)' : 'var(--c-brand)' }}>{st.done ? '✓' : st.n}</span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold text-[var(--c-ink)]">{st.t}</span>
                  <span className="block text-[14px] text-[var(--c-ink-3)]">{st.d}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="border-t border-[var(--c-line)] p-5 sm:px-6">
            {roomCode ? sharePanel : (
              <Link href={`/teacher/settings${q}`} className={`${BTN} max-w-xs bg-[var(--c-brand)]`}>เปิดห้องใหม่</Link>
            )}
          </div>
        </section>
      ) : (
        <section aria-label="สรุปห้องนี้" className="flex flex-col gap-4">
          <div className="home-hero">
            <div className="home-hero__copy">
              <p className="home-hero__eyebrow">โดมสรุปให้ครู</p>
              <h2 className="home-hero__title">ภาพรวมห้องเรียน</h2>
              <dl className="home-hero__kpis">
                <div className="home-kpi">
                  <Icon3d name="busts-in-silhouette" size={38} />
                  <div>
                    <dd className="home-kpi__value">{total}<span>คน</span></dd>
                    <dt>เข้าห้องแล้ว</dt>
                  </div>
                </div>
                <div className="home-kpi">
                  <Icon3d name="trophy" size={38} />
                  <div>
                    <dd className="home-kpi__value">{ceoDone}<span>คน</span></dd>
                    <dt>ได้เกียรติบัตร</dt>
                  </div>
                </div>
                <div className="home-kpi home-kpi--progress">
                  <Icon3d name="chart-increasing" size={38} />
                  <div className="min-w-0 flex-1">
                    <dd className="home-kpi__value">{avg}<span>%</span></dd>
                    <dt>ความคืบหน้าเฉลี่ย</dt>
                    <div className="home-kpi__track" role="progressbar" aria-valuenow={avg} aria-valuemin={0} aria-valuemax={100} aria-label={`ความคืบหน้าเฉลี่ย ${avg}%`}><span style={{ width: `${avg}%` }} /></div>
                  </div>
                </div>
              </dl>
              {dome.slice(1, 3).length > 0 ? (
                <ul className="home-hero__notes">
                  {dome.slice(1, 3).map((line, index) => (
                    <li key={line}>
                      <Icon3d name={index === 0 && /ติด|เงียบ|ยังไม่มี/.test(line) ? 'warning' : 'check-mark-button'} size={22} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/teacher/hero-dome.webp" alt="" width={900} height={420} className="home-hero__art" />
          </div>
          <ul className="home-overview__chips m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
            {chips.map((c) => {
              const zero = c.count === 0
              return (
                <li key={c.key} className="min-w-0">
                  <Link
                    href={c.href}
                    data-tone={c.tone}
                    className="t3-card flex h-[68px] items-center gap-2 px-2.5 transition-transform hover:-translate-y-0.5 focus-ring"
                    style={{ borderColor: zero ? undefined : 'var(--tn-soft)', background: zero ? undefined : 'linear-gradient(0deg,var(--tn-soft),#fff 220%)' }}
                  >
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--tn-soft)' }}><Icon3d name={c.icon} size={22} /></span>
                    <span className="min-w-0 flex-1 text-[14px] leading-[18px] font-bold text-[var(--c-ink)]">{c.title}</span>
                    {zero ? (
                      <span aria-label="เรียบร้อย" className="text-[16px] font-bold text-[var(--s-success)]">✓</span>
                    ) : (
                      <span className="min-w-7 rounded-full px-2 text-center text-[14px] leading-6 font-extrabold text-white tabular-nums" style={{ background: 'var(--tn)' }}>{c.count ?? '–'}</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="can-do">
        <h2 id="can-do" className="m-0 mb-2 text-[15px] leading-6 font-bold text-[var(--c-ink)]">ครูทำอะไรได้บ้าง</h2>
          <ul className="home-overview__actions m-0 grid list-none grid-cols-2 gap-2.5 p-0 min-[700px]:grid-cols-3">
          {actions.map((a) => {
            const inner = (
              <>
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--tn-soft)' }}><Icon3d name={a.icon} size={22} /></span>
                <span className="min-w-0 flex-1 text-left text-[14px] leading-5 font-bold text-[var(--c-ink)]">{a.label}</span>
              </>
            )
            const cls = 't3-card flex min-h-14 w-full items-center gap-3 px-3 py-1.5 transition-transform hover:-translate-y-0.5 focus-ring'
            return (
              <li key={a.label} data-tone={a.tone}>
                {a.href ? <Link href={a.href} className={cls}>{inner}</Link> : <button type="button" onClick={a.onClick} className={cls}>{inner}</button>}
              </li>
            )
          })}
        </ul>
        {share && total > 0 ? <div className="t3-card mt-3 p-5">{sharePanel}</div> : null}
      </section>

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

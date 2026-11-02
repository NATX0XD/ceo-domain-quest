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

interface Todo {
  key: string
  count: number
  icon: Icon3dName
  title: string
  why: string
  cta: string
  href: string
  /** สีใช้เพื่อบอกความเร่งด่วนเท่านั้น */
  tone: 'rose' | 'amber' | 'teal'
}

const TONE_BG = { rose: 'var(--s-danger)', amber: '#d98a0b', teal: 'var(--c-brand)' } as const

export function HomeOverview({
  students,
  pendingCount,
  classroomId,
  roomCode,
  joinPath,
  qrSvg,
  help,
  showcaseCount,
  greeting,
  teacherName,
}: {
  students: HomeStudent[]
  pendingCount: number
  classroomId: string | null
  roomCode: string | null
  joinPath: string | null
  qrSvg: string | null
  help: HelpStudent[]
  showcaseCount: number
  greeting?: string
  teacherName?: string | null
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
  const requests = requestCount ?? 0

  const todos: Todo[] = [
    { key: 'review', count: pendingCount, icon: 'memo', title: 'งานรอตรวจ', why: 'นักเรียนรอคะแนนจากครู', cta: 'ตรวจเลย', href: `/teacher/review${q}`, tone: 'rose' },
    { key: 'requests', count: requests, icon: 'speech-balloon', title: 'คำขอจากนักเรียน', why: 'ตอบแล้วนักเรียนเห็นทันที', cta: 'ตอบ', href: `/teacher/requests${q}`, tone: 'amber' },
    { key: 'help', count: help.length, icon: 'warning', title: 'นักเรียนต้องช่วย', why: help[0] ? `${help[0].nickname} · ${help[0].reason}${help.length > 1 ? ` และอีก ${help.length - 1} คน` : ''}` : 'ยังไม่เริ่ม ติดอยู่ หรือเงียบไปหลายวัน', cta: 'ดูรายชื่อ', href: `/teacher/student${q}`, tone: 'amber' },
    { key: 'showcase', count: showcaseCount, icon: 'glowing-star', title: 'ผลงานรอคัด', why: 'ตัวกรองติดธง รอครูตัดสินก่อนเพื่อนเห็น', cta: 'คัดผลงาน', href: `/teacher/showcase${q}`, tone: 'teal' },
  ]
  const active = todos.filter((t) => t.count > 0)
  const clear = todos.filter((t) => t.count === 0 && !(t.key === 'requests' && requestCount === null))

  const actions: { label: string; benefit: string; icon: Icon3dName; href?: string; onClick?: () => void }[] = [
    { label: 'ชวนนักเรียนเข้าห้อง', benefit: 'ลิงก์และ QR ให้สแกนเข้าห้อง', icon: 'door', onClick: () => setShare((v) => !v) },
    { label: 'ตั้งค่าด่าน', benefit: 'ปรับเกณฑ์ผ่านและตัวช่วยของแต่ละด่าน', icon: 'gear', href: `/teacher/missions${q}` },
    { label: 'ดูรายงาน', benefit: 'ผลเรียนรวมทั้งห้อง จุดที่ยังอ่อน', icon: 'bar-chart', href: `/teacher/report${q}` },
    { label: 'พิมพ์เกียรติบัตร/รายงาน', benefit: 'เลือกนักเรียนแล้วสั่งพิมพ์ได้เลย', icon: 'printer', href: `/teacher/student${q}` },
    { label: 'ฉายผลงานเด่น', benefit: 'ปักหมุดผลงานขึ้นจอหน้าห้อง', icon: 'television', href: `/teacher/showcase${q ? q + "&" : "?"}tab=screen` },
    { label: 'จัดการห้อง', benefit: 'รหัสห้อง บัญชี และดาวน์โหลดข้อมูล', icon: 'clipboard', href: `/teacher/settings${q}` },
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
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 text-[15px] text-[var(--c-ink-2)]">
        {greeting ?? 'สวัสดี'} <strong className="font-bold text-[var(--c-ink)]">{teacherName ?? 'คุณครู'}</strong>
      </p>

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
        <section aria-labelledby="today" className="t3-card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="today" className="m-0 text-[22px] leading-8 font-extrabold text-[var(--c-ink)]">วันนี้ครูต้องทำอะไร</h2>
            <p className="m-0 text-[14px] text-[var(--c-ink-3)]">
              {active.length > 0 ? `${active.length} เรื่องที่รอครู · เรียงตามความเร่งด่วน` : `นักเรียน ${total} คน · ความคืบหน้าเฉลี่ย ${avg}%`}
            </p>
          </div>

          {active.length > 0 ? (
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ ['--n' as string]: Math.min(active.length, 4) }}>
              {active.map((t) => (
                <li key={t.key} className="flex min-w-0 flex-col gap-3 rounded-2xl border-2 bg-white p-4" style={{ borderColor: TONE_BG[t.tone] }}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${TONE_BG[t.tone]} 14%, white)` }}>
                      <Icon3d name={t.icon} size={34} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[40px] leading-10 font-extrabold tabular-nums text-[var(--c-ink)]">{t.count}</span>
                      <span className="block truncate text-[15px] font-bold text-[var(--c-ink)]">{t.title}</span>
                    </span>
                  </div>
                  <p className="m-0 min-h-10 text-[14px] leading-5 text-[var(--c-ink-3)]">{t.why}</p>
                  <Link href={t.href} className={BTN} style={{ background: TONE_BG[t.tone] }}>{t.cta} ›</Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl bg-[var(--s-success-soft,#e1f5ea)] p-4">
              <Icon3d name="party-popper" size={44} />
              <div>
                <p className="m-0 text-[18px] font-extrabold text-[var(--c-ink)]">เรียบร้อย ✓ ไม่มีงานค้าง</p>
                <p className="m-0 text-[14px] text-[var(--c-ink-2)]">ไม่มีงานรอตรวจ คำขอ หรือนักเรียนที่ต้องช่วยในตอนนี้</p>
              </div>
            </div>
          )}

          {active.length > 0 && clear.length > 0 ? (
            <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0" aria-label="เรื่องที่เรียบร้อยแล้ว">
              {clear.map((t) => (
                <li key={t.key} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--c-bg)] px-3 py-1.5 text-[14px] font-semibold text-[var(--c-ink-2)]">
                  <span aria-hidden className="text-[var(--s-success)]">✓</span>{t.title} เรียบร้อย
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}

      <section aria-labelledby="can-do">
        <h2 id="can-do" className="m-0 mb-3 text-[18px] leading-7 font-bold text-[var(--c-ink)]">ครูทำอะไรได้บ้าง</h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[560px]:grid-cols-2 xl:grid-cols-3">
          {actions.map((a) => {
            const inner = (
              <>
                <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--c-brand-soft)]"><Icon3d name={a.icon} size={30} /></span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[16px] leading-6 font-bold text-[var(--c-ink)]">{a.label}</span>
                  <span className="block text-[14px] leading-5 text-[var(--c-ink-3)]">{a.benefit}</span>
                </span>
                <span aria-hidden className="text-[22px] text-[var(--c-ink-3)]">›</span>
              </>
            )
            const cls = 't3-card flex w-full items-center gap-3 p-3.5 transition-transform hover:-translate-y-0.5 focus-ring'
            return (
              <li key={a.label}>
                {a.href ? <Link href={a.href} className={cls}>{inner}</Link> : <button type="button" onClick={a.onClick} aria-expanded={share} className={cls}>{inner}</button>}
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

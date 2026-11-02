'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertIcon } from '../../../components/ui'
import { Dialog } from '../_ux/dialog'
import { Icon3d, type Icon3dName } from '../_ux/v2'
import {
  Button, Card, DataTable, EmptyState, Field, Skeleton, StatTile, StatusBadge, TextInput, missionColor,
} from '../_ux/ui'
import { LearnResultsPanel } from '../report/learn-results-panel'

/**
 * T-10 รายงานรายคน — ครูใช้ให้คะแนนจริงหลังคาบ
 *
 * ⚠️ ทุกอย่างมาจาก `/api/teacher/report?studentId=` ซึ่งตรวจว่านักเรียนคนนี้อยู่ห้องของครูคนนี้จริง
 *    ในคิวรีเดียวกับที่อ่าน — ไม่ใช่เจ้าของ = 404 หน้านี้จึงไม่ต้องตรวจสิทธิ์ซ้ำเอง
 * ⚠️ ส่วน "ร่องรอยการปรับเหมาะ" คือหัวใจของการนำเสนอ: ระบบเสนออะไร ผู้เรียนเลือกอะไร
 *    เปลี่ยนกี่ครั้ง ใครเป็นคนสั่ง — ต้องเห็นคู่กันเสมอ ไม่ใช่เห็นแต่ผลลัพธ์สุดท้าย
 */

interface StudentReport {
  student: { id: string; nickname: string; classroomId: string; joinedAt: string }
  profile: Record<string, unknown> | null
  tests: { pre: number | null; post: number | null; gain: number | null }
  stars: { earned: number | null; goalStars: number | null; goalLevel: number | null } | null
  missions: {
    missionId: string
    channelUsed: string | null
    attempts: number
    hintsUsed: number
    stars: number | null
    passedAt: string | null
    startedAt: string | null
    secondsSpent: number | null
  }[]
  skips: { missionId: string; reason: string | null; skippedAt: string }[]
  routeChanges: {
    count: number
    items: { missionId: string | null; from: string | null; to: string; changedBy: string | null; changedAt: string }[]
  }
  boss: Record<string, unknown>[]
  reflections: { questionId: string; answer: string; createdAt: string }[]
  peerFeedback: { given: number; received: number }
  buddy: { helpedOthers: number; askedForHelp: number; passedAfterHelp: number }
  confidence: Record<string, number> | null
}

/** RPC student_report คืน null ในส่วนที่ผู้เรียนยังไม่มีข้อมูล เติมค่าว่างกันหน้าพัง */
function normalizeReport(r: StudentReport): StudentReport {
  return {
    ...r,
    tests: r.tests ?? { pre: null, post: null, gain: null },
    missions: r.missions ?? [],
    skips: r.skips ?? [],
    routeChanges: r.routeChanges ?? { count: 0, items: [] },
    boss: r.boss ?? [],
    reflections: r.reflections ?? [],
    peerFeedback: r.peerFeedback ?? { given: 0, received: 0 },
    buddy: r.buddy ?? { helpedOthers: 0, askedForHelp: 0, passedAfterHelp: 0 },
  }
}

interface BoardStudent {
  studentId: string
  nickname: string
  earnedStars: number | null
  pendingReview: boolean
}

const ROUTE_LABEL: Record<string, string> = {
  clip: 'ดูคลิป',
  card: 'อ่านการ์ด',
  game: 'เล่นเกม',
  buddy: 'เรียนกับเพื่อน',
}

/**
 * ชื่อไทยของภารกิจ/จุดประสงค์
 *
 * ⚠️ ระบบจริงเก็บความมั่นใจด้วยคีย์ `obj-1..obj-4` (หุ่นจาก seed เก่าเท่านั้นที่มี `m1..m4` ด้วย)
 * ของเดิมแปลได้แค่ `m*` ทำให้ห้องเรียนจริงขึ้นรหัสดิบ `obj-1:` ทุกบรรทัด (UAT-7 ข้อ ค-4)
 * จึงต้องมีทั้งสองชุดอยู่ในตารางเดียวกัน
 */
const MISSION_OBJECTIVE: Record<string, string> = {
  m1: 'ข้อ 1 ความหมายและประโยชน์ของชื่อโดเมน',
  m2: 'ข้อ 2 ส่วนประกอบของชื่อเว็บ',
  m3: 'ข้อ 3 ประเภทของนามสกุลโดเมน',
  m4: 'ข้อ 4 เงื่อนไขและขั้นตอนการจดทะเบียน',
  'obj-1': 'ข้อ 1 ความหมายและประโยชน์ของชื่อโดเมน',
  'obj-2': 'ข้อ 2 ส่วนประกอบของชื่อเว็บ',
  'obj-3': 'ข้อ 3 ประเภทของนามสกุลโดเมน',
  'obj-4': 'ข้อ 4 เงื่อนไขและขั้นตอนการจดทะเบียน',
  'obj-5': 'ข้อ 5 เลือกโดเมนให้ธุรกิจของตนพร้อมเหตุผล',
  'obj-6': 'ข้อ 6 ตั้งเป้าและติดตามความก้าวหน้าของตนเอง',
  boss: 'ด่านบอส CEO (ใบเสนอชื่อเว็บ)',
}

function routeName(value: string | null | undefined): string {
  if (!value) return '-'
  return ROUTE_LABEL[value] ?? value
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function timeText(seconds: number | null): string {
  if (seconds === null) return '-'
  if (seconds < 60) return `${seconds} วินาที`
  return `${Math.floor(seconds / 60)} นาที ${seconds % 60} วินาที`
}

const REFLECT_LABEL: Record<string, string> = {
  'reflect-feel': 'ความรู้สึกวันนี้',
  'reflect-1': 'วันนี้ได้เรียนรู้อะไร',
  'reflect-conf': 'ความมั่นใจ (เต็ม 5)',
  'reflect-2': 'ยังสงสัยเรื่องไหน',
  'reflect-3': 'ข้อความถึงตัวเอง',
}

export function StudentReportClient({
  classroomId,
  studentId,
  initialRoster = [],
  initialReport = null,
}: {
  classroomId: string | null
  studentId: string | null
  /** ใส่ค่าเริ่มต้นได้เพื่อให้เทสต์เรนเดอร์ตรวจได้โดยไม่ต้องยิงเครือข่าย */
  initialRoster?: BoardStudent[]
  initialReport?: StudentReport | null
}) {
  const [roster, setRoster] = useState<BoardStudent[]>(initialRoster)
  const [selected, setSelected] = useState<string | null>(studentId)
  const [report, setReport] = useState<StudentReport | null>(initialReport)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [certificateNameOpen, setCertificateNameOpen] = useState(false)
  const [certificateNameDraft, setCertificateNameDraft] = useState('')
  const [certificateNameBusy, setCertificateNameBusy] = useState(false)
  const [certificateNameNotice, setCertificateNameNotice] = useState<string | null>(null)

  // รายชื่อในห้องมาจากแผงห้องเรียน (endpoint เดิม ไม่ได้เพิ่มของใหม่)
  useEffect(() => {
    if (!classroomId) return
    void (async () => {
      try {
        const res = await fetch(`/api/teacher/board?classroomId=${classroomId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { board: BoardStudent[] }
        const list = data.board.map((b) => ({
          studentId: b.studentId,
          nickname: b.nickname,
          earnedStars: b.earnedStars,
          pendingReview: b.pendingReview,
        }))
        setRoster(list)
        setSelected((current) => current ?? list[0]?.studentId ?? null)
      } catch {
        // ไม่เป็นไร ครูยังกดจากแผงห้องเรียนเข้ามาตรง ๆ ได้
      }
    })()
  }, [classroomId])

  const load = useCallback(async () => {
    if (!selected) return
    try {
      const res = await fetch(`/api/teacher/report?studentId=${selected}`, { cache: 'no-store' })
      if (res.status === 404) {
        setError('ไม่พบนักเรียนคนนี้ในห้องของคุณ')
        setReport(null)
        return
      }
      if (!res.ok) {
        setError('ดึงรายงานไม่สำเร็จ')
        return
      }
      setError(null)
      const data = (await res.json()) as { report: StudentReport }
      setReport(normalizeReport(data.report))
    } catch {
      setError('เชื่อมต่อไม่ได้ ลองอีกครั้ง')
    }
  }, [selected])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setCertificateNameDraft(str(report?.profile?.certificate_display_name) ?? '')
    setCertificateNameOpen(false)
    setCertificateNameNotice(null)
  }, [report?.student.id])

  const remove = async () => {
    if (!selected || !classroomId) return
    setRemoving(true)
    try {
      const res = await fetch('/api/teacher/student', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: selected, classroomId }),
      })
      if (!res.ok) {
        setError(res.status === 404 ? 'ไม่พบนักเรียนคนนี้ในห้องของคุณ' : 'ลบไม่สำเร็จ ลองอีกครั้ง')
        return
      }
      const rest = roster.filter((r) => r.studentId !== selected)
      setRoster(rest)
      setReport(null)
      setError(null)
      setSelected(rest[0]?.studentId ?? null)
    } catch {
      setError('เชื่อมต่อไม่ได้ ลองอีกครั้ง')
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const saveCertificateName = async (nextValue = certificateNameDraft) => {
    if (!selected || certificateNameBusy) return
    setCertificateNameBusy(true)
    setCertificateNameNotice(null)
    const displayName = nextValue.trim()
    try {
      const res = await fetch('/api/teacher/student', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'certificate-name', studentId: selected, displayName }),
      })
      const data = (await res.json().catch(() => null)) as { message?: string; certificateDisplayName?: string | null } | null
      if (!res.ok) {
        setCertificateNameNotice(data?.message ?? 'บันทึกชื่อไม่สำเร็จ ลองอีกครั้ง')
        return
      }
      setReport((current) => current
        ? { ...current, profile: { ...(current.profile ?? {}), certificate_display_name: data?.certificateDisplayName ?? null } }
        : current)
      setCertificateNameDraft(data?.certificateDisplayName ?? '')
      setCertificateNameOpen(false)
      setCertificateNameNotice(displayName ? 'บันทึกชื่อบนเกียรติบัตรแล้ว' : 'ล้างชื่อแล้ว นักเรียนจะตั้งชื่อใหม่เองได้')
    } catch {
      setCertificateNameNotice('เชื่อมต่อไม่ได้ ลองอีกครั้ง')
    } finally {
      setCertificateNameBusy(false)
    }
  }

  if (!classroomId) {
    return (
      <Card>
        <EmptyState
          icon={<Icon3d name="school" size={28} />}
          title="ยังไม่มีห้องเรียน"
          body="เปิดห้องที่หน้าตั้งค่าห้องก่อน แล้วกลับมาที่หน้านี้"
        />
      </Card>
    )
  }

  const profile = report?.profile ?? null
  const suggested = str(profile?.channel_suggested)
  const chosen = str(profile?.learning_route)
  const chosenBy = str(profile?.channel_chosen_by)

  const initial = (name: string) => Array.from(name.trim())[0] ?? '?'
  const current = roster.find((r) => r.studentId === selected) ?? null
  const pendingCount = roster.filter((r) => r.pendingReview).length
  const missionNo = (id: string): number | null => {
    if (id === 'boss') return 6
    const m = /^(?:m|obj-)([1-4])$/.exec(id)
    return m ? Number(m[1]) : null
  }
  const passedCount = report ? report.missions.filter((m) => m.passedAt).length : 0

  return (
    <div className="grid gap-6">
      {/* เลือกคน — อยู่บนสุดเพราะครูใช้ไล่ทีละคนตอนให้คะแนน (รายชื่อยาวจึงใช้ช่องเลือกแทนปุ่มเรียงเต็มจอ) */}
      <nav aria-label="เลือกนักเรียน" className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-[var(--c-ink)]">นักเรียน</span>
          <select
            value={selected ?? ''}
            onChange={(e) => setSelected(e.target.value || null)}
            className="h-10 min-w-48 rounded-lg border border-[var(--c-line-strong)] bg-white px-3 text-[15px] text-[var(--c-ink)] outline-none focus:border-[var(--c-brand)] focus:ring-2 focus:ring-[var(--c-brand-ring)]"
          >
            {roster.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.nickname}
                {s.pendingReview ? ' · รอตรวจ' : ''}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[14px] text-[var(--c-ink-3)]">{roster.length} คน</span>
        {pendingCount > 0 ? <StatusBadge status="inprogress">รอตรวจ {pendingCount} คน</StatusBadge> : null}
      </nav>

      {roster.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon3d name="graduation-cap" size={28} />}
            title="ยังไม่มีนักเรียนในห้องนี้"
            body="แชร์รหัสห้องหรือ QR ให้นักเรียนเข้าห้อง แล้วรายงานรายคนจะขึ้นที่นี่"
            action={<Link href="/teacher/settings" className="inline-flex h-10 items-center rounded-lg bg-[var(--c-brand)] px-4 text-[15px] font-semibold text-white hover:bg-[var(--c-brand-hover)]">ไปหน้าตั้งค่าห้อง</Link>}
          />
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2 text-[14px] font-medium" style={{ background: 'var(--s-danger-soft)', color: 'var(--s-danger-ink)' }}>
          <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {report ? (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--c-brand-soft)] text-[24px] font-semibold text-[var(--c-brand)]" aria-hidden>
                {initial(report.student.nickname)}
              </span>
              <div className="min-w-[14rem] flex-1">
                <h2 className="text-[20px] leading-7 font-bold text-[var(--c-ink)]">{report.student.nickname}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-[var(--c-ink-3)]">
                  <span>{str(profile?.business_name) ?? 'ยังไม่ตั้งชื่อร้าน'}</span>
                  {str(profile?.domain_name) ? <span className="rounded-md bg-[var(--c-sunken)] px-2 py-0.5 text-[13px] text-[var(--c-ink-2)]">{str(profile?.domain_name)}</span> : null}
                  <StatusBadge status={passedCount === 0 ? 'notstarted' : 'inprogress'}>
                    ผ่านแล้ว {passedCount}/{report.missions.length || 0} ด่าน
                  </StatusBadge>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <Button kind="primary" onClick={() => window.print()}>
                  <Icon3d name="printer" size={20} />
                  พิมพ์ / บันทึกเป็น PDF
                </Button>
                <Button onClick={() => void load()}>โหลดใหม่</Button>
                <Button kind="danger" onClick={() => setConfirmRemove(true)}>ลบออกจากห้อง</Button>
              </div>
            </div>
          </Card>

          <section aria-label="ชื่อบนเกียรติบัตร">
            <Card
              title="ชื่อบนเกียรติบัตร"
              action={
                <Button size="sm" onClick={() => { setCertificateNameOpen((open) => !open); setCertificateNameNotice(null) }}>
                  แก้ชื่อบนเกียรติบัตร
                </Button>
              }
            >
              <p className="text-[15px] font-medium text-[var(--c-ink)]">
                {str(profile?.certificate_display_name) ?? 'ยังไม่ได้ตั้งชื่อจริง'}
              </p>
              <p className="mt-1 text-[14px] text-[var(--c-ink-3)]">
                {str(profile?.certificate_display_name) ? 'นักเรียนตั้งไว้แล้ว ครูแก้หรือล้างเพื่อให้ตั้งใหม่ได้' : 'นักเรียนจะถูกขอชื่อจริงเมื่อได้เกียรติบัตร'}
              </p>
              {certificateNameOpen ? (
                <div className="mt-4 grid gap-3 rounded-lg bg-[var(--c-sunken)] p-3">
                  <Field label="ชื่อใหม่ หรือเว้นว่างเพื่อล้าง" htmlFor="teacher-certificate-name">
                    <TextInput
                      id="teacher-certificate-name"
                      value={certificateNameDraft}
                      onChange={(event) => setCertificateNameDraft(event.target.value)}
                      maxLength={60}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button kind="primary" onClick={() => void saveCertificateName()} disabled={certificateNameBusy}>
                      {certificateNameBusy ? 'กำลังบันทึก…' : 'บันทึกชื่อ'}
                    </Button>
                    <Button
                      kind="danger"
                      onClick={() => { setCertificateNameDraft(''); void saveCertificateName('') }}
                      disabled={certificateNameBusy || !str(profile?.certificate_display_name)}
                    >
                      ล้างชื่อให้นักเรียนตั้งใหม่
                    </Button>
                  </div>
                </div>
              ) : null}
              {certificateNameNotice ? <p role="status" className="mt-3 text-[14px] font-medium text-[var(--c-brand)]">{certificateNameNotice}</p> : null}
            </Card>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="ดาวที่ได้" value={`${report.stars?.earned ?? 0} ดวง`} icon={<Icon3d name="star" size={28} />} />
            <StatTile
              label="เป้าหมายที่ตั้งเอง"
              value={report.stars?.goalStars == null ? '—' : `${report.stars.goalStars} ดวง`}
              icon={<Icon3d name="bullseye" size={28} />}
              hint={report.stars?.goalStars == null ? 'ยังไม่ตั้งเป้า' : undefined}
            />
            <StatTile
              label="ก่อนเรียน"
              value={report.tests.pre === null ? '—' : report.tests.pre}
              icon={<Icon3d name="memo" size={28} />}
              hint={report.tests.pre === null ? 'ยังไม่ทำ' : undefined}
            />
            <StatTile
              label="หลังเรียน"
              value={report.tests.post === null ? '—' : report.tests.post}
              icon={<Icon3d name="chart-increasing" size={28} />}
              badge={
                report.tests.pre !== null && report.tests.post !== null ? (
                  <StatusBadge status={report.tests.post >= report.tests.pre ? 'passed' : 'failed'}>
                    {report.tests.post >= report.tests.pre ? '+' : ''}{(report.tests.post - report.tests.pre).toFixed(report.tests.post % 1 || report.tests.pre % 1 ? 1 : 0)} จากก่อนเรียน
                  </StatusBadge>
                ) : undefined
              }
              hint={report.tests.post === null ? 'ยังไม่ทำ' : undefined}
            />
          </div>

          {/* ── จุดประสงค์ที่ผ่าน */}
          <Card title="ภารกิจและจุดประสงค์" flush>
            <DataTable
              caption="ภารกิจและจุดประสงค์"
              rows={report.missions}
              rowKey={(m) => m.missionId}
              empty={<EmptyState title="ยังไม่ได้เริ่มภารกิจ" body="เมื่อนักเรียนเริ่มเล่น ผลของแต่ละด่านจะขึ้นที่นี่" />}
              columns={[
                {
                  key: 'obj',
                  header: 'จุดประสงค์',
                  cell: (m) => {
                    const n = missionNo(m.missionId)
                    return (
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: n ? missionColor(n) : 'var(--d-notstarted)' }} />
                        {MISSION_OBJECTIVE[m.missionId] ?? m.missionId}
                      </span>
                    )
                  },
                },
                { key: 'route', header: 'ช่องทาง', cell: (m) => routeName(m.channelUsed) },
                { key: 'att', header: 'ลอง', numeric: true, cell: (m) => m.attempts },
                { key: 'hint', header: 'คำใบ้', numeric: true, cell: (m) => m.hintsUsed },
                { key: 'star', header: 'ดาว', numeric: true, cell: (m) => <span className="font-semibold">{m.stars ?? 0}</span> },
                { key: 'time', header: 'เวลา', className: 'hidden lg:table-cell', cell: (m) => timeText(m.secondsSpent) },
                {
                  key: 'res',
                  header: 'ผล',
                  cell: (m) => {
                    const skipped = report.skips.find((sk) => sk.missionId === m.missionId)
                    if (m.passedAt) return <StatusBadge status="passed" />
                    if (skipped) return <StatusBadge status="atrisk">ข้าม</StatusBadge>
                    /**
                     * ด่านบอส**ไม่เคยมี passed_at โดยดีไซน์** (ดู board/route.ts)
                     * สรุปว่า "ยังไม่ผ่าน" จึงผิด — ดูที่คะแนนที่ครูยืนยันแทน (UAT-7 ข้อ ค-5)
                     */
                    if (m.missionId === 'boss') {
                      return <span title="ด่านบอสไม่มีสถานะผ่าน ดูที่คะแนนของครู"><StatusBadge status="inprogress">ดูคะแนนครู</StatusBadge></span>
                    }
                    return <StatusBadge status="notstarted">ยังไม่ผ่าน</StatusBadge>
                  },
                },
              ]}
            />
            {report.skips.length > 0 ? (
              <p className="border-t border-[var(--c-line)] px-4 py-3 text-[14px] text-[var(--c-ink-3)] sm:px-5">
                ข้ามภารกิจ {report.skips.length} ครั้ง:{' '}
                {report.skips.map((sk) => `${sk.missionId}${sk.reason ? ` (${sk.reason})` : ''}`).join(' · ')}
              </p>
            ) : null}
          </Card>

          {/* ── ร่องรอยการปรับเหมาะ: ระบบเสนออะไร เด็กเลือกอะไร */}
          <Card title="ร่องรอยการปรับเหมาะ" tip="ระบบเสนออะไร ผู้เรียนเลือกอะไร เปลี่ยนกี่ครั้ง ใครเป็นคนสั่ง">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'ระบบเสนอช่องทาง', icon: 'light-bulb', value: routeName(suggested) },
                {
                  label: 'ผู้เรียนใช้จริง',
                  icon: 'rocket',
                  value: `${routeName(chosen)}${chosenBy ? ` (${chosenBy === 'student' ? 'เลือกเอง' : 'ตามระบบ'})` : ''}`,
                },
                { label: 'เปลี่ยนช่องทาง', icon: 'counterclockwise-arrows-button', value: `${report.routeChanges.count} ครั้ง` },
                /*
                  "ระบบเสนอระดับไหน เทียบกับที่ใช้จริง" คือหลักฐานการปรับเหมาะที่สไลด์อ้างถึง
                  API ส่ง level_suggested มาตั้งแต่ต้น แต่จอเคยโชว์แค่ระดับที่ใช้จริง เทียบไม่ได้เลย
                */
                { label: 'ตัวช่วยระดับ (เสนอ → ใช้)', icon: 'gear', value: `${num(profile?.level_suggested) ?? '-'} → ${num(profile?.scaffold_level) ?? '-'}` },
                {
                  label: 'ใครปรับตัวช่วย',
                  icon: 'handshake',
                  value:
                    str(profile?.hints_toggled_by) === 'student'
                      ? 'ผู้เรียนกดเอง'
                      : str(profile?.hints_toggled_by) === 'teacher'
                        ? 'ครูปรับให้'
                        : str(profile?.hints_toggled_by) === 'system'
                          ? 'ระบบปรับให้'
                          : '-',
                },
                { label: 'ยกระดับเป้าเอง', icon: 'chart-increasing', value: `${num(profile?.goal_raised_count) ?? 0} ครั้ง` },
              ].map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--c-sunken)]">
                    <Icon3d name={f.icon as Icon3dName} size={24} />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[14px] text-[var(--c-ink-3)]">{f.label}</dt>
                    <dd className="text-[15px] font-semibold text-[var(--c-ink)]">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {suggested && chosen && suggested !== chosen ? (
              <p className="mt-4 rounded-lg px-3 py-2 text-[14px] font-medium" style={{ background: 'var(--s-info-soft)', color: 'var(--s-info-ink)' }}>
                เลือกต่างจากที่ระบบเสนอ — เสนอ {routeName(suggested)} แต่เลือก {routeName(chosen)} เอง
              </p>
            ) : null}

            {report.routeChanges.items.length > 0 ? (
              <details className="mt-4">
                <summary className="flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-[var(--c-brand)]">
                  ประวัติเปลี่ยนช่องทาง {report.routeChanges.items.length} ครั้ง
                </summary>
                <ul className="flex flex-col gap-1">
                  {report.routeChanges.items.map((c, i) => (
                    <li key={`${c.changedAt}-${i}`} className="text-[14px] text-[var(--c-ink-3)]">
                      {c.missionId ? `${c.missionId} · ` : ''}
                      {routeName(c.from)} → {routeName(c.to)}
                      {c.changedBy ? ` · ${c.changedBy === 'student' ? 'ผู้เรียนเปลี่ยนเอง' : 'ระบบปรับให้'}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {/*
              เป้าหมายที่ผู้เรียนพิมพ์เอง — หลักฐานตรง ๆ ว่า "ผู้เรียนตั้งเป้าเอง ไม่ใช่ระบบตั้งให้"
              เป็นข้อความของเด็ก ขึ้นเต็มไม่ตัดคำ และเป็นคนละอย่างกับระดับเป้า 1-3 ที่กดเลือก
            */}
            {str(profile?.own_goal_text) ? (
              <div className="mt-4 rounded-lg bg-[var(--c-sunken)] p-3">
                <p className="text-[14px] text-[var(--c-ink-3)]">เป้าหมายที่เขียนเอง</p>
                <blockquote className="mt-1 text-[15px] text-pretty text-[var(--c-ink)]">
                  “{str(profile?.own_goal_text)}”
                </blockquote>
              </div>
            ) : null}
          </Card>

          {/* ── ความมั่นใจ · เพื่อน */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card title="ความมั่นใจ" tip="ระดับความมั่นใจที่ผู้เรียนให้ตัวเองในแต่ละจุดประสงค์ จาก 1 ถึง 3">
              {report.confidence && Object.keys(report.confidence).length > 0 ? (
                <ul className="grid list-none gap-3 p-0">
                  {/**
                   * บางแถวมีทั้งคีย์เก่า (m1..m4) และคีย์จริง (obj-1..obj-4) ปนกัน
                   * รวมให้เหลือชื่อละบรรทัดเดียว ไม่งั้นครูเห็น 8 บรรทัดซ้ำเรื่องเดียวกัน (UAT-7 ค-4)
                   */}
                  {[
                    ...new Map(
                      Object.entries(report.confidence).map(([id, level]) => [
                        MISSION_OBJECTIVE[id] ?? id,
                        level,
                      ]),
                    ).entries(),
                  ].map(([name, level]) => (
                    <li key={name}>
                      <div className="flex items-baseline justify-between gap-3 text-[14px]">
                        <span className="min-w-0 truncate text-[var(--c-ink-2)]">{name}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-[var(--c-ink)]">{level}/3</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-[var(--c-sunken)]" role="img" aria-label={`${name} มั่นใจ ${level} จาก 3`}>
                        <div className="h-full rounded-full bg-[var(--c-brand)]" style={{ width: `${Math.min(100, (Number(level) / 3) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="ยังไม่มีข้อมูล" body="ผู้เรียนยังไม่ได้ให้ระดับความมั่นใจ" />
              )}
            </Card>

            <Card title="เพื่อนและการช่วย">
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'ช่วยเพื่อน', icon: 'handshake', value: report.buddy.helpedOthers },
                  { label: 'ขอเพื่อนช่วย', icon: 'speech-balloon', value: report.buddy.askedForHelp },
                  { label: 'ชมเพื่อน', icon: 'party-popper', value: report.peerFeedback.given },
                  { label: 'ได้รับคำชม', icon: 'sparkles', value: report.peerFeedback.received },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--c-sunken)]">
                      <Icon3d name={f.icon as Icon3dName} size={24} />
                    </span>
                    <div>
                      <dt className="text-[14px] text-[var(--c-ink-3)]">{f.label}</dt>
                      <dd className="text-[15px] font-semibold text-[var(--c-ink)] tabular-nums">{f.value} ครั้ง</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          {report.reflections.length > 0 ? (
            <details className="rounded-xl border border-[var(--c-line)] bg-white shadow-[var(--sh-1)]">
              <summary className="flex min-h-14 cursor-pointer items-center gap-2 px-4 text-[16px] font-semibold text-[var(--c-ink)] sm:px-5">
                ที่ผู้เรียนเขียนเอง
                <span className="rounded-md bg-[var(--c-sunken)] px-1.5 text-[13px] font-medium tabular-nums text-[var(--c-ink-2)]">{report.reflections.length} ข้อ</span>
              </summary>
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <ul className="flex flex-col gap-2">
                  {report.reflections.map((r, i) => (
                    <li key={`${r.questionId}-${i}`} className="rounded-lg bg-[var(--c-sunken)] p-3">
                      <p className="text-[14px] text-[var(--c-ink-3)]">{REFLECT_LABEL[r.questionId] ?? r.questionId}</p>
                      <p className="mt-0.5 text-[15px] whitespace-pre-line text-[var(--c-ink)]">{r.answer}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}

          <LearnResultsPanel classroomId={classroomId} studentId={report.student.id} />
        </>
      ) : !error && roster.length > 0 ? (
        <div role="status" aria-busy="true" className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
          <span className="sr-only">กำลังโหลดรายงาน</span>
        </div>
      ) : null}

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`ลบ ${current?.nickname ?? 'นักเรียนคนนี้'} ออกจากห้อง?`}
        description="งาน ดาว และคะแนนของคนนี้จะหายทั้งหมด กู้คืนไม่ได้ ใช้กับชื่อที่สมัครผิดหรือสมัครซ้ำ"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => setConfirmRemove(false)}>ยกเลิก</Button>
          <button
            type="button"
            disabled={removing}
            onClick={() => void remove()}
            className="inline-flex h-10 items-center rounded-lg bg-[var(--s-danger)] px-4 text-[15px] font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--c-brand-ring)] focus-visible:outline-none disabled:opacity-50"
          >
            {removing ? 'กำลังลบ' : 'ลบถาวร'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}


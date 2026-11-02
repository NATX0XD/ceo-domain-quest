'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, EmptyState, UsersIcon } from '../../../components/ui'
import { Dialog } from '../_ux/dialog'
import { Bar, Bars, Chip, Fact, Icon3d, InfoTip, Kpi, KpiGrid } from '../_ux/v2'
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
      <EmptyState
        title="ยังไม่มีห้องเรียน"
        description="เปิดห้องที่แผงครูก่อน แล้วกลับมาที่หน้านี้"
        illustration={<UsersIcon width={48} height={48} className="text-brand-400" />}
      />
    )
  }

  const profile = report?.profile ?? null
  const suggested = str(profile?.channel_suggested)
  const chosen = str(profile?.learning_route)
  const chosenBy = str(profile?.channel_chosen_by)

  const initial = (name: string) => Array.from(name.trim())[0] ?? '?'
  const current = roster.find((r) => r.studentId === selected) ?? null

  return (
    <div className="t2-stack">
      {/* เลือกคน — อยู่บนสุดเพราะครูใช้ไล่ทีละคนตอนให้คะแนน (รายชื่อยาวจึงใช้ช่องเลือกแทนปุ่มเรียงเต็มจอ) */}
      <nav aria-label="เลือกนักเรียน" className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="flex items-center gap-2">
          <Icon3d name="graduation-cap" size={32} />
          <span className="text-label font-extrabold text-ink">นักเรียน</span>
          <select
            value={selected ?? ''}
            onChange={(e) => setSelected(e.target.value || null)}
            className="h-11 min-w-48 rounded-full bg-white px-4 text-label font-extrabold text-ink ring-2 ring-line-contrast focus-ring"
          >
            {roster.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.nickname}
                {s.pendingReview ? ' · รอตรวจ' : ''}
              </option>
            ))}
          </select>
        </label>
        <Chip tone="sky">{roster.length} คน</Chip>
        {current?.pendingReview ? <Chip tone="lilac">รอตรวจ</Chip> : null}
      </nav>

      {roster.length === 0 ? (
        <p className="t2-empty">ยังไม่มีนักเรียนในห้องนี้</p>
      ) : null}

      {error ? (
        <p role="alert" className="t2-note" data-tone="danger">
          <AlertIcon width={22} height={22} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {report ? (
        <>
          <section className="t2-card flex flex-wrap items-center gap-4" style={{ background: 'var(--t2-lilac)', borderColor: 'transparent' }}>
            <span className="t2-avatar" data-level="green" style={{ width: '3.5rem', height: '3.5rem', fontSize: '1.5rem', background: '#fff' }} aria-hidden>
              {initial(report.student.nickname)}
            </span>
            <div className="min-w-[14rem] flex-1">
              <h2 className="text-title font-extrabold text-ink">{report.student.nickname}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2">
                <Chip>{str(profile?.business_name) ?? 'ยังไม่ตั้งชื่อร้าน'}</Chip>
                {str(profile?.domain_name) ? <Chip tone="sky">{str(profile?.domain_name)}</Chip> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button type="button" onClick={() => window.print()} className="t2-btn focus-ring" data-kind="primary">
                <Icon3d name="printer" size={24} />
                พิมพ์ / บันทึกเป็น PDF
              </button>
              <button type="button" onClick={() => void load()} className="t2-btn focus-ring">
                โหลดใหม่
              </button>
              <button type="button" onClick={() => setConfirmRemove(true)} className="t2-btn focus-ring" data-kind="danger">
                ลบออกจากห้อง
              </button>
            </div>
          </section>

          <section className="t2-card flex flex-wrap items-start justify-between gap-3" aria-label="ชื่อบนเกียรติบัตร">
            <div className="min-w-[15rem] flex-1">
              <p className="text-note font-extrabold uppercase tracking-[0.12em] text-brand-700">เกียรติบัตร</p>
              <h2 className="mt-1 text-body-lg font-black text-ink">ชื่อบนเกียรติบัตร</h2>
              <p className="mt-1 text-label font-bold text-ink">
                {str(profile?.certificate_display_name) ?? 'ยังไม่ได้ตั้งชื่อจริง'}
              </p>
              <p className="mt-1 text-note text-ink-muted">
                {str(profile?.certificate_display_name) ? 'นักเรียนตั้งไว้แล้ว ครูแก้หรือล้างเพื่อให้ตั้งใหม่ได้' : 'นักเรียนจะถูกขอชื่อจริงเมื่อได้เกียรติบัตร'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setCertificateNameOpen((open) => !open); setCertificateNameNotice(null) }}
              className="t2-btn focus-ring"
            >
              แก้ชื่อบนเกียรติบัตร
            </button>
            {certificateNameOpen ? (
              <div className="w-full rounded-2xl bg-[#fffdf8] p-3 ring-1 ring-line ring-inset">
                <label htmlFor="teacher-certificate-name" className="text-label font-extrabold text-ink">ชื่อใหม่ หรือเว้นว่างเพื่อล้าง</label>
                <input
                  id="teacher-certificate-name"
                  value={certificateNameDraft}
                  onChange={(event) => setCertificateNameDraft(event.target.value)}
                  maxLength={60}
                  className="mt-1 min-h-11 w-full rounded-xl bg-white px-3 text-label font-bold text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void saveCertificateName()} disabled={certificateNameBusy} className="t2-btn" data-kind="primary">
                    {certificateNameBusy ? 'กำลังบันทึก…' : 'บันทึกชื่อ'}
                  </button>
                  <button type="button" onClick={() => { setCertificateNameDraft(''); void saveCertificateName('') }} disabled={certificateNameBusy || !str(profile?.certificate_display_name)} className="t2-btn" data-kind="danger">
                    ล้างชื่อให้นักเรียนตั้งใหม่
                  </button>
                </div>
              </div>
            ) : null}
            {certificateNameNotice ? <p role="status" className="w-full text-note font-bold text-brand-700">{certificateNameNotice}</p> : null}
          </section>

          <KpiGrid>
            <Kpi label="ดาวที่ได้" value={`${report.stars?.earned ?? 0} ดวง`} tone="yellow" icon="star" />
            <Kpi
              label="เป้าหมายที่ตั้งเอง"
              value={report.stars?.goalStars == null ? '—' : `${report.stars.goalStars} ดวง`}
              tone="lilac"
              icon="bullseye"
              hint={report.stars?.goalStars == null ? 'ยังไม่ตั้งเป้า' : undefined}
            />
            <Kpi
              label="ก่อนเรียน"
              value={report.tests.pre === null ? '—' : `${report.tests.pre}`}
              tone="peach"
              icon="memo"
              hint={report.tests.pre === null ? 'ยังไม่ทำ' : undefined}
            />
            <Kpi
              label="หลังเรียน"
              value={report.tests.post === null ? '—' : `${report.tests.post}`}
              tone="mint"
              icon="chart-increasing"
              hint={report.tests.post === null ? 'ยังไม่ทำ' : undefined}
            />
          </KpiGrid>

          {/* ── จุดประสงค์ที่ผ่าน */}
          <section className="t2-card">
            <h2 className="t2-card-title">
              <Icon3d name="rocket" size={32} />
              ภารกิจและจุดประสงค์
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-label">
                <thead>
                  <tr className="text-ink-muted">
                    <th scope="col" className="py-1">จุดประสงค์</th>
                    <th scope="col" className="py-1">ช่องทาง</th>
                    <th scope="col" className="py-1">ลอง</th>
                    <th scope="col" className="py-1">คำใบ้</th>
                    <th scope="col" className="py-1">ดาว</th>
                    <th scope="col" className="hidden py-1 lg:table-cell">เวลา</th>
                    <th scope="col" className="py-1">ผล</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  {report.missions.map((m) => {
                    const skipped = report.skips.find((sk) => sk.missionId === m.missionId)
                    return (
                      <tr key={m.missionId} className="border-t border-line align-top">
                        <th scope="row" className="py-2 pr-2 font-extrabold">
                          {MISSION_OBJECTIVE[m.missionId] ?? m.missionId}
                        </th>
                        <td className="py-2">{routeName(m.channelUsed)}</td>
                        <td className="py-2">{m.attempts}</td>
                        <td className="py-2">{m.hintsUsed}</td>
                        <td className="py-2 font-extrabold">{m.stars ?? 0}</td>
                        <td className="hidden py-2 lg:table-cell">{timeText(m.secondsSpent)}</td>
                        <td className="py-2">
                          {m.passedAt ? (
                            <Chip tone="green">ผ่าน</Chip>
                          ) : skipped ? (
                            <Chip tone="orange">ข้าม</Chip>
                          ) : m.missionId === 'boss' ? (
                            /**
                             * ด่านบอส**ไม่เคยมี passed_at โดยดีไซน์** (ดู board/route.ts)
                             * สรุปว่า "ยังไม่ผ่าน" จึงผิด — ดูที่คะแนนที่ครูยืนยันแทน (UAT-7 ข้อ ค-5)
                             */
                            <Chip title="ด่านบอสไม่มีสถานะผ่าน ดูที่คะแนนของครู">ดูคะแนนครู</Chip>
                          ) : (
                            <Chip>ยังไม่ผ่าน</Chip>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {report.missions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-2 text-ink-muted">ยังไม่ได้เริ่มภารกิจ</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {report.skips.length > 0 ? (
              <p className="mt-2 text-note font-bold text-ink-muted">
                ข้ามภารกิจ {report.skips.length} ครั้ง:{' '}
                {report.skips.map((sk) => `${sk.missionId}${sk.reason ? ` (${sk.reason})` : ''}`).join(' · ')}
              </p>
            ) : null}
          </section>

          {/* ── ร่องรอยการปรับเหมาะ: ระบบเสนออะไร เด็กเลือกอะไร */}
          <section className="t2-card">
            <h2 className="t2-card-title">
              <Icon3d name="brain" size={32} />
              ร่องรอยการปรับเหมาะ
              <InfoTip label="เรื่องการปรับเหมาะ" text="ระบบเสนออะไร ผู้เรียนเลือกอะไร เปลี่ยนกี่ครั้ง ใครเป็นคนสั่ง" />
            </h2>
            <dl className="t2-facts" data-cols="3">
              <Fact label="ระบบเสนอช่องทาง" icon="light-bulb" tone="mint" value={routeName(suggested)} />
              <Fact
                label="ผู้เรียนใช้จริง"
                icon="rocket"
                tone="sky"
                value={`${routeName(chosen)}${chosenBy ? ` (${chosenBy === 'student' ? 'เลือกเอง' : 'ตามระบบ'})` : ''}`}
              />
              <Fact label="เปลี่ยนช่องทาง" icon="counterclockwise-arrows-button" tone="peach" value={`${report.routeChanges.count} ครั้ง`} />
              {/*
                "ระบบเสนอระดับไหน เทียบกับที่ใช้จริง" คือหลักฐานการปรับเหมาะที่สไลด์อ้างถึง
                API ส่ง level_suggested มาตั้งแต่ต้น แต่จอเคยโชว์แค่ระดับที่ใช้จริง เทียบไม่ได้เลย
              */}
              <Fact
                label="ตัวช่วยระดับ (เสนอ → ใช้)"
                icon="gear"
                tone="lilac"
                value={`${num(profile?.level_suggested) ?? '-'} → ${num(profile?.scaffold_level) ?? '-'}`}
              />
              <Fact
                label="ใครปรับตัวช่วย"
                icon="handshake"
                tone="yellow"
                value={
                  str(profile?.hints_toggled_by) === 'student'
                    ? 'ผู้เรียนกดเอง'
                    : str(profile?.hints_toggled_by) === 'teacher'
                      ? 'ครูปรับให้'
                      : str(profile?.hints_toggled_by) === 'system'
                        ? 'ระบบปรับให้'
                        : '-'
                }
              />
              <Fact label="ยกระดับเป้าเอง" icon="chart-increasing" tone="mint" value={`${num(profile?.goal_raised_count) ?? 0} ครั้ง`} />
            </dl>

            {suggested && chosen && suggested !== chosen ? (
              <p className="t2-note mt-3" data-tone="sky">
                <span>
                  เลือกต่างจากที่ระบบเสนอ — เสนอ {routeName(suggested)} แต่เลือก {routeName(chosen)} เอง
                </span>
              </p>
            ) : null}

            {report.routeChanges.items.length > 0 ? (
              <details className="mt-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-label font-extrabold text-brand-700">
                  ประวัติเปลี่ยนช่องทาง {report.routeChanges.items.length} ครั้ง
                </summary>
                <ul className="flex flex-col gap-1">
                  {report.routeChanges.items.map((c, i) => (
                    <li key={`${c.changedAt}-${i}`} className="text-note font-semibold text-ink-muted">
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
              <div className="mt-3 rounded-[18px] bg-[#f6f2e8] p-3">
                <p className="text-note font-bold text-ink-muted">เป้าหมายที่เขียนเอง</p>
                <blockquote className="mt-1 text-label text-pretty text-ink">
                  “{str(profile?.own_goal_text)}”
                </blockquote>
              </div>
            ) : null}
          </section>

          {/* ── ความมั่นใจ · เพื่อน */}
          <div className="t2-grid">
            <section className="t2-card">
              <h2 className="t2-card-title">
                <Icon3d name="bullseye" size={32} />
                ความมั่นใจ
                <InfoTip label="เรื่องความมั่นใจ" text="ระดับความมั่นใจที่ผู้เรียนให้ตัวเองในแต่ละจุดประสงค์ จาก 1 ถึง 3" />
              </h2>
              {report.confidence && Object.keys(report.confidence).length > 0 ? (
                <Bars>
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
                  ].map(([name, level], i) => (
                    <Bar
                      key={name}
                      color={(['blue', 'purple', 'coral', 'green', 'gold', 'red'] as const)[i % 6] ?? 'purple'}
                      value={(Number(level) / 3) * 100}
                      display={`${level}/3`}
                      label={<span className="truncate">{name}</span>}
                    />
                  ))}
                </Bars>
              ) : (
                <p className="t2-empty">ยังไม่มีข้อมูล</p>
              )}
            </section>

            <section className="t2-card">
              <h2 className="t2-card-title">
                <Icon3d name="handshake" size={32} />
                เพื่อนและการช่วย
              </h2>
              <dl className="t2-facts">
                <Fact label="ช่วยเพื่อน" icon="handshake" tone="mint" value={`${report.buddy.helpedOthers} ครั้ง`} />
                <Fact label="ขอเพื่อนช่วย" icon="speech-balloon" tone="sky" value={`${report.buddy.askedForHelp} ครั้ง`} />
                <Fact label="ชมเพื่อน" icon="party-popper" tone="yellow" value={`${report.peerFeedback.given} ครั้ง`} />
                <Fact label="ได้รับคำชม" icon="sparkles" tone="peach" value={`${report.peerFeedback.received} ครั้ง`} />
              </dl>
            </section>
          </div>

          {report.reflections.length > 0 ? (
            <details className="t2-more">
              <summary className="focus-ring">
                <Icon3d name="memo" size={32} />
                ที่ผู้เรียนเขียนเอง
                <Chip tone="lilac">{report.reflections.length} ข้อ</Chip>
              </summary>
              <div className="t2-more__body">
                <ul className="flex flex-col gap-2">
                  {report.reflections.map((r, i) => (
                    <li key={`${r.questionId}-${i}`} className="rounded-[18px] bg-[#f6f2e8] p-3">
                      <p className="text-note font-bold text-ink-muted">{REFLECT_LABEL[r.questionId] ?? r.questionId}</p>
                      <p className="mt-0.5 text-body whitespace-pre-line text-ink">{r.answer}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}

          <LearnResultsPanel classroomId={classroomId} studentId={report.student.id} />
        </>
      ) : !error ? (
        <p className="t2-empty">เลือกนักเรียนเพื่อดูรายงาน</p>
      ) : null}

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`ลบ ${current?.nickname ?? 'นักเรียนคนนี้'} ออกจากห้อง?`}
        description="งาน ดาว และคะแนนของคนนี้จะหายทั้งหมด กู้คืนไม่ได้ ใช้กับชื่อที่สมัครผิดหรือสมัครซ้ำ"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setConfirmRemove(false)} className="t2-btn focus-ring">
            ยกเลิก
          </button>
          <button type="button" disabled={removing} onClick={() => void remove()} className="t2-btn focus-ring" data-kind="dangerfill">
            {removing ? 'กำลังลบ' : 'ลบถาวร'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}


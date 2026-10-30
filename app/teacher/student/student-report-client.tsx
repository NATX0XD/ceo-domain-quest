'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, Card, EmptyState, UsersIcon, cn } from '../../../components/ui'
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

  return (
    <div>
      {/* เลือกคน — อยู่บนสุดเพราะครูใช้ไล่ทีละคนตอนให้คะแนน */}
      <nav aria-label="เลือกนักเรียน" className="print:hidden">
        <ul className="flex flex-wrap gap-2">
          {roster.map((s) => (
            <li key={s.studentId}>
              <button
                type="button"
                onClick={() => setSelected(s.studentId)}
                aria-current={s.studentId === selected ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label font-bold ring-2 ring-inset focus-ring',
                  s.studentId === selected
                    ? 'bg-brand-600 text-ink-onbrand ring-brand-600'
                    : 'bg-surface-raised text-ink ring-line-contrast hover:bg-brand-50',
                )}
              >
                {s.nickname}
                {s.pendingReview ? <span className="text-note">· รอตรวจ</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {roster.length === 0 ? (
        <p className="mt-3 text-label text-ink-muted">ยังไม่มีนักเรียนในห้องนี้</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-danger-100 p-4 text-body font-semibold text-danger-700">
          <AlertIcon width={22} height={22} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {report ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-base bg-brand-600 px-5 text-ink-onbrand shadow-soft-1"
            >
              พิมพ์ / บันทึกเป็น PDF
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-base bg-surface-raised px-5 text-ink ring-2 ring-line-contrast ring-inset"
            >
              โหลดใหม่
            </button>
          </div>

          <Card as="section" className="mt-4">
            <h2 className="text-title-sm font-bold text-ink">{report.student.nickname}</h2>
            <p className="mt-0.5 text-label text-ink-muted">
              {str(profile?.business_name) ?? 'ยังไม่ได้ตั้งชื่อร้าน'}
              {str(profile?.domain_name) ? ` · ชื่อโดเมนที่ยื่น ${str(profile?.domain_name)}` : ''}
            </p>

            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Fact label="ดาวที่ได้" value={`${report.stars?.earned ?? 0} ดวง`} />
              <Fact
                label="เป้าหมายที่ตั้งเอง"
                value={report.stars?.goalStars == null ? 'ยังไม่ตั้งเป้า' : `${report.stars.goalStars} ดวง`}
              />
              <Fact label="ก่อนเรียน" value={report.tests.pre === null ? 'ยังไม่ทำ' : `${report.tests.pre}`} />
              <Fact label="หลังเรียน" value={report.tests.post === null ? 'ยังไม่ทำ' : `${report.tests.post}`} />
            </dl>
          </Card>

          {/* ── จุดประสงค์ที่ผ่าน */}
          <Card as="section" className="mt-4">
            <h2 className="text-title-sm font-bold text-ink">ภารกิจและจุดประสงค์</h2>
            <table className="mt-2 w-full text-left text-label">
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="py-1">จุดประสงค์</th>
                  <th scope="col" className="py-1">ช่องทางที่ใช้</th>
                  <th scope="col" className="py-1">ลอง</th>
                  <th scope="col" className="py-1">คำใบ้</th>
                  <th scope="col" className="py-1">ดาว</th>
                  <th scope="col" className="py-1">เวลา</th>
                  <th scope="col" className="py-1">ผล</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                {report.missions.map((m) => {
                  const skipped = report.skips.find((s) => s.missionId === m.missionId)
                  return (
                    <tr key={m.missionId} className="border-t border-line align-top">
                      <th scope="row" className="py-1.5 font-bold">
                        {MISSION_OBJECTIVE[m.missionId] ?? m.missionId}
                      </th>
                      <td className="py-1.5">{routeName(m.channelUsed)}</td>
                      <td className="py-1.5">{m.attempts}</td>
                      <td className="py-1.5">{m.hintsUsed}</td>
                      <td className="py-1.5 font-bold">{m.stars ?? 0}</td>
                      <td className="py-1.5">{timeText(m.secondsSpent)}</td>
                      <td className="py-1.5">
                        {m.passedAt ? (
                          <span className="font-bold text-quest-700">ผ่าน</span>
                        ) : skipped ? (
                          <span className="font-bold text-spark-700">ข้าม</span>
                        ) : m.missionId === 'boss' ? (
                          /**
                           * ด่านบอส**ไม่เคยมี passed_at โดยดีไซน์** (ดู board/route.ts)
                           * สรุปว่า "ยังไม่ผ่าน" จึงผิด — ดูที่คะแนนที่ครูยืนยันแทน (UAT-7 ข้อ ค-5)
                           */
                          <span className="text-ink-muted">ดูผลที่ช่องคะแนนของครู</span>
                        ) : (
                          <span className="text-ink-muted">ยังไม่ผ่าน</span>
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

            {report.skips.length > 0 ? (
              <p className="mt-2 text-note text-ink-muted">
                ข้ามภารกิจ {report.skips.length} ครั้ง:{' '}
                {report.skips.map((s) => `${s.missionId}${s.reason ? ` (${s.reason})` : ''}`).join(' · ')}
              </p>
            ) : null}
          </Card>

          {/* ── ร่องรอยการปรับเหมาะ: ระบบเสนออะไร เด็กเลือกอะไร */}
          <Card as="section" className="mt-4" tone="brand">
            <h2 className="text-title-sm font-bold text-ink">ร่องรอยการปรับเหมาะ (ระบบเสนอ ผู้เรียนเลือก)</h2>
            <dl className="mt-2 grid gap-2 sm:grid-cols-3">
              <Fact label="ระบบเสนอช่องทาง" value={routeName(suggested)} />
              <Fact
                label="ผู้เรียนใช้จริง"
                value={`${routeName(chosen)}${chosenBy ? ` (${chosenBy === 'student' ? 'เลือกเอง' : 'ตามที่ระบบเสนอ'})` : ''}`}
              />
              <Fact label="เปลี่ยนช่องทางระหว่างเรียน" value={`${report.routeChanges.count} ครั้ง`} />
            </dl>

            {suggested && chosen && suggested !== chosen ? (
              <p className="mt-2 rounded-xl bg-surface-raised p-3 text-label font-semibold text-brand-700">
                เลือกต่างจากที่ระบบเสนอ — ระบบเสนอ {routeName(suggested)} แต่เลือก {routeName(chosen)} เอง
              </p>
            ) : null}

            {report.routeChanges.items.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {report.routeChanges.items.map((c, i) => (
                  <li key={`${c.changedAt}-${i}`} className="text-note text-ink-muted">
                    {c.missionId ? `${c.missionId} · ` : ''}
                    {routeName(c.from)} → {routeName(c.to)}
                    {c.changedBy ? ` · ${c.changedBy === 'student' ? 'ผู้เรียนเปลี่ยนเอง' : 'ระบบปรับให้'}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}

            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/*
                "ระบบเสนอระดับไหน เทียบกับที่ใช้จริง" คือหลักฐานการปรับเหมาะที่สไลด์อ้างถึง
                API ส่ง level_suggested มาตั้งแต่ต้น แต่จอเคยโชว์แค่ระดับที่ใช้จริง เทียบไม่ได้เลย
              */}
              <Fact
                label="ตัวช่วยระดับ (ระบบเสนอ → ใช้จริง)"
                value={`${num(profile?.level_suggested) ?? '-'} → ${num(profile?.scaffold_level) ?? '-'}`}
              />
              <Fact
                label="ใครปรับตัวช่วย"
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
              <Fact label="ยกระดับเป้าหมายเอง" value={`${num(profile?.goal_raised_count) ?? 0} ครั้ง`} />
              <Fact label="เขียนทบทวนตัวเอง" value={`${report.reflections.length} ข้อ`} />
            </dl>

            {/*
              เป้าหมายที่ผู้เรียนพิมพ์เอง — หลักฐานตรง ๆ ว่า "ผู้เรียนตั้งเป้าเอง ไม่ใช่ระบบตั้งให้"
              เป็นข้อความของเด็ก ขึ้นเต็มไม่ตัดคำ และเป็นคนละอย่างกับระดับเป้า 1-3 ที่กดเลือก
            */}
            {str(profile?.own_goal_text) ? (
              <div className="mt-3 rounded-xl bg-surface-raised p-3">
                <p className="text-note font-bold text-ink-muted">เป้าหมายที่ผู้เรียนเขียนเอง</p>
                <blockquote className="mt-1 text-label text-pretty text-ink">
                  “{str(profile?.own_goal_text)}”
                </blockquote>
              </div>
            ) : null}
          </Card>

          {/* ── ความมั่นใจ · เพื่อน · ด่านบอส */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card as="section">
              <h2 className="text-title-sm font-bold text-ink">ความมั่นใจรายจุดประสงค์</h2>
              {report.confidence && Object.keys(report.confidence).length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
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
                    <li key={name} className="text-label text-ink">
                      {name}: มั่นใจระดับ {level} จาก 3
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-label text-ink-muted">ยังไม่มีข้อมูลความมั่นใจ</p>
              )}
            </Card>

            <Card as="section">
              <h2 className="text-title-sm font-bold text-ink">เพื่อนและการช่วยเหลือ</h2>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <Fact label="ช่วยเพื่อน" value={`${report.buddy.helpedOthers} ครั้ง`} />
                <Fact label="ขอให้เพื่อนช่วย" value={`${report.buddy.askedForHelp} ครั้ง`} />
                <Fact label="ชมเพื่อน" value={`${report.peerFeedback.given} ครั้ง`} />
                <Fact label="ได้รับคำชม" value={`${report.peerFeedback.received} ครั้ง`} />
              </dl>
            </Card>
          </div>

          {report.reflections.length > 0 ? (
            <Card as="section" className="mt-4">
              <h2 className="text-title-sm font-bold text-ink">สิ่งที่ผู้เรียนเขียนไว้เอง</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {report.reflections.map((r, i) => (
                  <li key={`${r.questionId}-${i}`} className="rounded-xl bg-surface-sunken p-3">
                    <p className="text-note font-bold text-ink-muted">{r.questionId}</p>
                    <p className="mt-0.5 text-body whitespace-pre-line text-ink">{r.answer}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <LearnResultsPanel classroomId={classroomId} studentId={report.student.id} />
        </>
      ) : !error ? (
        <p className="mt-4 text-body text-ink-muted">เลือกชื่อนักเรียนด้านบนเพื่อดูรายงาน</p>
      ) : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-sunken p-3">
      <dt className="text-note font-bold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-bold text-ink">{value}</dd>
    </div>
  )
}

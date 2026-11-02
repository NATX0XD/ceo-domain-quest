import rubric from '@/content/rubric.json'
import { listPendingReview, listSubmissions, type Submission } from '@/lib/db/repo'
import { TeacherConfirmScore, type RubricDimensionView } from '@/components/teacher-confirm-client'
import Link from 'next/link'
import { InfoIcon, AlertIcon } from '@/components/ui'
import { Fact, Icon3d, InfoTip } from './v2'
import { Avatar, EmptyState, StatusBadge } from './ui'
import { sourceLabel, type AiSourceInfo } from '@/components/server/ai'
import { MAX_REVISION_ROUNDS } from '@/components/server/revision'
import { isTeacherConfirmed } from '@/lib/db/submission-scores'

/**
 * คิวตรวจงานของครู — ย้ายออกมาเป็นชิ้นเดียวที่ใช้ซ้ำได้ (UX-6 แตกหน้าเป็นแดชบอร์ด)
 *
 * ⚠️ `teacherId` มาจากคุกกี้ของหน้าที่เรียก · `listPendingReview` ตรวจเจ้าของห้องในคิวรีเดียวกับที่อ่าน
 * ⚠️ คะแนนทุกก้อนเป็น "ข้อเสนอ" ครูเป็นคนยืนยันเสมอ — การ์ดนี้แสดงคู่กันทั้งคะแนนกฎและคะแนน AI
 */

interface ScoreBlock {
  weightedTotal?: number
  weightedMax?: number
  stars?: number
  feedback?: string
  dimensions?: RubricDimensionView[]
}

interface AiScoreBag extends Partial<AiSourceInfo> {
  /** 'pending-ai' = คะแนนที่เห็นมาจากกฎ ส่วนของ AI ยังตรวจไม่เสร็จ */
  gradingStatus?: string
  ruleScores?: ScoreBlock
  aiProposed?: ScoreBlock | null
  score?: number
  maxScore?: number
  feedback?: string
  dimensions?: RubricDimensionView[]
}

/**
 * ชื่อไทยของด้านในรูบริก — ของเดิมโชว์รหัสดิบ `dim-customer-reason` บนการ์ด (UAT-7 ข้อ ค-3)
 * ทั้งที่ `content/rubric.json` มีชื่อไทยอยู่แล้ว และตารางรูบริกในการ์ดใบเดียวกันก็แสดงถูกอยู่
 */
const DIMENSION_THAI_NAME: Record<string, string> = Object.fromEntries(
  rubric.dimensions.map((d) => [d.id, d.name]),
)

/** รูปแบบส่งงาน — ของเดิมโชว์รหัส `write` / `voice` ดิบ ๆ ให้ครูอ่าน (flow-1 ข้อ 12) */
const FORMAT_THAI: Record<string, string> = {
  write: 'ส่งงานแบบพิมพ์',
  voice: 'ส่งงานแบบอัดเสียง',
  choose: 'ส่งงานแบบเลือกคำ',
}

function emphasisName(id: string): string {
  return DIMENSION_THAI_NAME[id] ?? id
}

/** อ่านคะแนนที่ครูยืนยันไว้จริงจาก teacher_confirmed_scores เพื่อแสดงกลับ ไม่ใช่โชว์ค่าที่พิมพ์ค้าง */
export function readTeacherScores(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const bag = value as Record<string, unknown>
  const dims =
    bag.dimensions && typeof bag.dimensions === 'object' && !Array.isArray(bag.dimensions)
      ? (bag.dimensions as Record<string, number>)
      : null
  return {
    // รูปแบบใหม่เก็บ weightedTotal/weightedMax ส่วนรูปแบบเก่าเก็บ score/maxScore
    score:
      typeof bag.weightedTotal === 'number'
        ? bag.weightedTotal
        : typeof bag.score === 'number'
          ? bag.score
          : undefined,
    maxScore:
      typeof bag.weightedMax === 'number'
        ? bag.weightedMax
        : typeof bag.maxScore === 'number'
          ? bag.maxScore
          : undefined,
    stars: typeof bag.stars === 'number' ? bag.stars : undefined,
    note: typeof bag.note === 'string' ? bag.note : null,
    dimensionScores: dims,
  }
}

function readAiScores(value: unknown): AiScoreBag | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const bag = value as Record<string, unknown>
  return {
    score: typeof bag.score === 'number' ? bag.score : undefined,
    maxScore: typeof bag.maxScore === 'number' ? bag.maxScore : undefined,
    feedback: typeof bag.feedback === 'string' ? bag.feedback : undefined,
    dimensions: Array.isArray(bag.dimensions)
      ? (bag.dimensions as RubricDimensionView[])
      : undefined,
    gradingStatus: typeof bag.gradingStatus === 'string' ? bag.gradingStatus : undefined,
    ruleScores:
      bag.ruleScores && typeof bag.ruleScores === 'object'
        ? (bag.ruleScores as ScoreBlock)
        : undefined,
    aiProposed:
      bag.aiProposed && typeof bag.aiProposed === 'object' ? (bag.aiProposed as ScoreBlock) : null,
    source: bag.source === 'ai' ? 'ai' : bag.source === 'fallback' ? 'fallback' : undefined,
    provider:
      bag.provider === 'gemini' || bag.provider === 'typhoon' || bag.provider === 'rules'
        ? bag.provider
        : undefined,
    fallbackReason: typeof bag.fallbackReason === 'string' ? (bag.fallbackReason as never) : null,
  }
}

export async function ReviewList({
  teacherId,
  classroomId,
  selectedId = null,
}: {
  teacherId: string
  classroomId: string | null
  /** งานที่เปิดอยู่ในแผงขวา (ไม่ระบุ = ชิ้นแรกในคิว) */
  selectedId?: string | null
}) {
  if (!classroomId) {
    return (
      <div className="t3-card">
        <EmptyState
          title="ยังไม่มีห้องเรียน"
          body="เปิดห้องเรียนก่อน แล้วงานที่นักเรียนส่งจะมาโผล่ตรงนี้"
        />
      </div>
    )
  }

  const pending = await listPendingReview(teacherId, classroomId)
  if (pending === null) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-2xl bg-danger-100 p-4 text-body font-semibold text-danger-700"
      >
        <AlertIcon width={22} height={22} className="mt-0.5 shrink-0" />
        <span>ไม่พบห้องนี้ หรือห้องนี้ไม่ใช่ของครู</span>
      </p>
    )
  }

  if (pending.length === 0) {
    return (
      <div className="t3-card">
        <EmptyState
          title="ตรวจครบแล้ว ไม่มีงานค้าง"
          body="งานที่นักเรียนส่งจะขึ้นที่นี่ ครูยืนยันคะแนนได้ทีละชิ้น"
          action={<Link href={`/teacher/student?classroomId=${classroomId}`} className="inline-flex h-10 items-center rounded-xl bg-[var(--c-brand)] px-4 text-[15px] font-semibold text-white">ดูความคืบหน้ารายคน</Link>}
        />
      </div>
    )
  }

  /**
   * ประวัติใบเสนอของแต่ละคน — ครูต้องเห็น "ฉบับก่อนหน้า" คู่กับฉบับล่าสุด
   * ไม่งั้นส่งกลับให้แก้ไปแล้วก็ไม่รู้ว่านักเรียนแก้อะไรมา (สเปกข้อ 3.3)
   * เจ้าของห้องถูกตรวจไปแล้วที่ listPendingReview ตรงนี้จึงดึงตามรหัสนักเรียนที่ได้มาเท่านั้น
   */
  const historyByStudent = new Map<string, Submission[]>()
  const studentIds = [...new Set(pending.map((row) => row.student_id))]
  const lists = await Promise.all(studentIds.map((id) => listSubmissions(id)))
  studentIds.forEach((id, index) => {
    historyByStudent.set(id, (lists[index] ?? []).filter((row) => row.emphasis_criterion !== null))
  })

  const active = pending.find((r) => r.id === selectedId) ?? pending[0]!

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <nav aria-label="คิวงานรอตรวจ" className="t3-card overflow-hidden lg:sticky lg:top-4">
        <div className="flex items-center justify-between border-b border-[var(--c-line)] px-4 py-3">
          <h2 className="m-0 text-[16px] font-bold">คิวงานรอตรวจ</h2>
          <span className="rounded-full bg-[var(--s-danger)] px-2.5 text-[13px] font-bold text-white tabular-nums">{pending.length}</span>
        </div>
        <ul className="t3-scroll max-h-[60vh] overflow-y-auto p-2">
          {pending.map((q) => {
            const on = q.id === active.id
            return (
              <li key={q.id}>
                <Link
                  href={`/teacher/review?classroomId=${classroomId}&submission=${q.id}`}
                  aria-current={on ? 'true' : undefined}
                  className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-[var(--c-brand-soft)]"
                  style={on ? { background: 'var(--c-brand-soft)', boxShadow: 'inset 3px 0 0 var(--c-brand)' } : undefined}
                >
                  <Avatar name={q.nickname ?? '?'} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{q.nickname}</span>
                    <span className="block truncate text-[13px] text-[var(--c-ink-3)]">{q.domain_name}{q.tld}</span>
                  </span>
                  <StatusBadge status={q.emphasis_criterion ? 'inprogress' : 'notstarted'}>{q.emphasis_criterion ? 'CEO' : 'สถานี B'}</StatusBadge>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <ul aria-live="polite" className="m-0 flex min-w-0 list-none flex-col gap-4 p-0">
      {[active].map((row) => {
        const ai = readAiScores(row.ai_scores)
        const aiDone = ai?.gradingStatus === 'done' && Boolean(ai?.aiProposed)
        // ฉบับทั้งหมดของคนนี้ ใหม่สุดอยู่หน้าสุด (listSubmissions เรียง created_at DESC)
        const versions = historyByStudent.get(row.student_id) ?? []
        const indexFromNewest = versions.findIndex((v) => v.id === row.id)
        const versionNo = indexFromNewest >= 0 ? versions.length - indexFromNewest : 1
        const older = indexFromNewest >= 0 ? versions.slice(indexFromNewest + 1) : []
        const initial = Array.from((row.nickname ?? '?').trim())[0] ?? '?'
        const aiTotal =
          ai?.aiProposed?.weightedTotal !== undefined
            ? `${ai.aiProposed.weightedTotal}/${ai.aiProposed.weightedMax ?? ai.maxScore ?? '-'}`
            : ai?.gradingStatus === 'pending-ai'
              ? 'กำลังตรวจ…'
              : 'ไม่ได้เรียก AI'
        return (
          <li key={row.id} className="t3-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="t2-avatar" aria-hidden>
                {initial}
              </span>
              <p className="min-w-0 flex-1 text-title-sm font-extrabold text-ink">{row.nickname}</p>
              <p className="min-w-0 text-body font-extrabold break-all text-brand-700">
                {row.domain_name}
                {row.tld}
              </p>
            </div>

            <p className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status="inprogress">{row.emphasis_criterion ? 'ภารกิจใหญ่ CEO' : 'สถานี B · จดทะเบียน'}</StatusBadge>
              {row.emphasis_criterion ? <StatusBadge status="notstarted">เน้น {emphasisName(row.emphasis_criterion)} ×2</StatusBadge> : null}
              <StatusBadge status="notstarted">{FORMAT_THAI[row.format] ?? `ส่งงานแบบ ${row.format}`}</StatusBadge>
              {versions.length > 1 ? (
                <StatusBadge status="atrisk">
                  ฉบับที่ {versionNo}/{versions.length}
                </StatusBadge>
              ) : null}
            </p>

            {row.reason_text ? (
              <p className="mt-3 rounded-lg bg-[var(--c-sunken)] p-3 text-body whitespace-pre-line text-ink">
                {row.reason_text}
              </p>
            ) : null}

            {/* ฉบับก่อนหน้า — เปิดดูเทียบได้ว่านักเรียนแก้อะไรมา */}
            {older.length > 0 ? (
              <details className="mt-3 rounded-lg bg-[var(--c-sunken)] p-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-label font-extrabold text-ink">
                  ฉบับก่อนหน้า {older.length} ฉบับ
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {older.map((old, i) => {
                    const teacherBag = readTeacherScores(old.teacher_confirmed_scores)
                    return (
                      <li key={old.id} className="rounded-md bg-white p-3">
                        <p className="text-label font-bold text-ink">
                          ฉบับที่ {older.length - i} · {old.domain_name}
                          {old.tld}
                        </p>
                        {old.reason_text ? (
                          <p className="mt-1 text-label whitespace-pre-line text-ink-muted">
                            {old.reason_text}
                          </p>
                        ) : null}
                        {teacherBag?.note ? (
                          <p className="mt-1 text-note text-brand-700">
                            ครูเคยบอกไว้: {teacherBag.note}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </details>
            ) : null}

            {ai ? (
              <div className="mt-3">
                {/* สองค่าคู่กันเสมอ: กฎให้เท่าไร AI เสนอเท่าไร ครูเป็นคนตัดสินคะแนนจริง */}
                <dl className="t2-facts">
                  <Fact
                    label="ระบบตรวจให้"
                    icon="clipboard"
                                        value={`${ai.ruleScores?.weightedTotal ?? ai.score ?? '-'}/${ai.ruleScores?.weightedMax ?? ai.maxScore ?? '-'}`}
                  />
                  <Fact label="AI เสนอ" icon="robot" value={aiTotal} />
                </dl>
                {ai.feedback ? <p className="mt-2 text-label text-ink-muted">{ai.feedback}</p> : null}
                {/* flow-1 ข้อ 17: ครูไม่ต้องรอ AI ก่อนยืนยัน */}
                {ai.gradingStatus === 'pending-ai' && !ai.aiProposed ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status="inprogress">AI กำลังอ่าน · ยืนยันได้เลยไม่ต้องรอ</StatusBadge>
                  </p>
                ) : null}
                <p className="mt-2 flex items-center gap-1 text-note font-bold text-ink-muted">
                  ที่มา: {sourceLabel({
                    source: ai.source ?? 'fallback',
                    provider: ai.provider ?? 'rules',
                    fallbackReason: ai.fallbackReason ?? null,
                  })}
                  <InfoTip
                    label="เรื่องที่มาของคะแนน"
                    text="คะแนนที่เสนอเป็นแค่ข้อมูลประกอบ ครูเป็นคนยืนยันคะแนนจริงเสมอ ความเห็นของ AI ไม่ผูกมัด"
                  />
                </p>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-label text-ink-muted">
                <InfoIcon width={18} height={18} aria-hidden className="shrink-0" />
                <span>ยังไม่มีคะแนนที่เสนอไว้</span>
              </p>
            )}

            {/* flow-1 ข้อ 24: บอกให้ชัดว่ากดยืนยันแล้วเกิดอะไรกับเด็ก ครูจะได้ไม่ลังเล */}
            <p className="mt-3 flex items-center gap-2 text-label font-bold text-ink-muted">
              <Icon3d name="light-bulb" size={24} />
              นักเรียนได้คะแนนอัตโนมัติและเกียรติบัตรแล้ว · ครูปรับคะแนน/เขียนความเห็นได้
              <InfoTip
                label="เรื่องการยืนยันคะแนน"
                text="นักเรียนเห็นคะแนนที่ AI ตรวจ (หรือคะแนนจากกฎถ้า AI ยังไม่เสร็จ) และได้เกียรติบัตรทันทีที่ส่งงาน ไม่ต้องรอครู ถ้าครูยืนยัน/ปรับคะแนน คะแนนของครูจะแทนคะแนนอัตโนมัติ และข้อความของครูจะขึ้นที่หน้าผลของนักเรียน แก้ซ้ำได้เสมอ ส่วน ส่งกลับให้แก้ ใช้เมื่ออยากให้นักเรียนปรับงาน (ไม่ดึงเกียรติบัตรคืน)"
              />
            </p>

            <TeacherConfirmScore
              submissionId={row.id}
              /* นักเรียนเห็นคะแนน AI เมื่อ AI ตรวจเสร็จ — ฟอร์มครูจึงตั้งต้นจากค่าเดียวกัน */
              proposedScore={(aiDone ? ai?.aiProposed?.weightedTotal : undefined) ?? ai?.score ?? 0}
              maxScore={(aiDone ? ai?.aiProposed?.weightedMax : undefined) ?? ai?.maxScore ?? 15}
              dimensions={(aiDone && ai?.aiProposed?.dimensions?.length ? ai.aiProposed.dimensions : ai?.dimensions) ?? []}
              savedScores={readTeacherScores(row.teacher_confirmed_scores)}
              /**
               * ต้องถาม `isTeacherConfirmed()` ไม่ใช่เช็กว่าคอลัมน์ไม่ null
               * เพราะก้อนที่ครูสั่งให้แก้ (`status: 'revise'`) ก็ไม่ null เหมือนกัน
               * เช็กแบบเดิมทำให้งานที่เพิ่งตีกลับขึ้นว่า "ยืนยันแล้ว" (กติกาเดียวกับ T65 · /api/ceo)
               */
              confirmed={isTeacherConfirmed(row)}
              roundsUsed={Math.max(0, versions.length - 1)}
              maxRounds={MAX_REVISION_ROUNDS}
            />
          </li>
        )
      })}
      </ul>
    </div>
  )
}

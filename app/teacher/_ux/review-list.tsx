import rubric from '@/content/rubric.json'
import bigMission from '@/content/big-mission.json'
import businessTypes from '@/content/business-types.json'
import { rubricDimensions, resolveEmphasisDimension } from '@/lib/ai/rubric'
import { getProfile, listGradeJobsBySubmissions, listPendingReview, listSubmissions, type Submission } from '@/lib/db/repo'
import { BulkConfirm, TeacherConfirmScore, type BulkItem, type RubricDimensionView, type RubricGuide } from '@/components/teacher-confirm-client'
import Link from 'next/link'
import { AlertIcon } from '@/components/ui'
import { Avatar, EmptyState, StatusBadge } from './ui'
import type { AiSourceInfo } from '@/components/server/ai'
import { MAX_REVISION_ROUNDS } from '@/components/server/revision'
import { classifyAiWait } from '@/lib/ai/stale-grading'
import { RegradeButton } from './regrade-button'
import { isTeacherConfirmed } from '@/lib/db/submission-scores'
import { Icon3d, type Icon3dName } from './v2'
import { shopArtFallbackSrc, shopArtSrc } from '@/components/shop-art'
import { ShopArtImg } from '@/components/shop-art-img'
import { stripFeedbackScorePrefix } from './review-feedback'

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

/** เกณฑ์ต่อด้านสำหรับหน้าตรวจ — มาจาก content/rubric.json ไฟล์เดียวกับที่ตัวตรวจคะแนนใช้ */
const GUIDES: Record<string, RubricGuide> = Object.fromEntries(
  rubricDimensions.map((d) => [
    d.id,
    {
      question: d.question,
      levels: d.levels.map((l) => ({
        score: l.score,
        label: l.label,
        descriptor: l.descriptor,
        teacherCheck: (l as { teacherCheck?: string }).teacherCheck,
      })),
    },
  ]),
)

function Fact({ icon, label, children, tone = 'soft' }: { icon: string; label: string; children: React.ReactNode; tone?: 'soft' | 'good' | 'warn' | 'gold' }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-xl border border-[var(--c-line)] bg-white px-2.5 py-2" data-tone={tone}>
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--c-sunken)] text-[16px]">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] leading-4 font-bold text-[var(--c-ink-3)]">{label}</dt>
        <dd className="m-0 text-[13px] leading-5 font-bold text-[var(--c-ink)]">{children}</dd>
      </div>
    </div>
  )
}

function ReviewStepHeading({ number, title, icon, detail }: { number: string; title: string; icon: Icon3dName; detail?: string }) {
  return (
    <header className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--c-brand-soft)] text-[14px] font-extrabold text-[var(--c-brand)]">{number}</span>
      <Icon3d name={icon} size={30} />
      <div className="min-w-0">
        <h3 className="m-0 text-[15px] leading-5 font-extrabold text-[var(--c-ink)]">{title}</h3>
        {detail ? <p className="m-0 text-[11px] leading-4 font-semibold text-[var(--c-ink-3)]">{detail}</p> : null}
      </div>
    </header>
  )
}

/** สรุปของโดม: ไม่ทวนคะแนนที่แสดงแยกอยู่แล้ว · ภาษาไทยไม่มีจุดจบประโยค ห้ามตัดกลางคำ
 *  จึงแสดงเต็ม และถ้ายาวมากค่อยตัดที่ช่องว่างสุดท้ายก่อนถึงขีดจำกัด */
export function trimFeedback(text: string | undefined | null, max = 240): string {
  const t = stripFeedbackScorePrefix(text).replace(/\s+/g, ' ').trim()
  if (!t) return ''
  // ไม่ตัดที่จุด — ข้อความมีนามสกุลเว็บอย่าง .com .in.th จะโดนตัดกลางคำ
  const sentence = t
  let out = sentence
    .replace(/\s*(?:คะแนน|score)\s*(?:ระบบ|รวม|ที่ได้|AI เสนอ)?\s*\d+\s*\/\s*\d+/gi, '')
    .replace(/\s*\d+\s*\/\s*\d+\s*(?:คะแนน)?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (out.length > max) {
    const cut = out.slice(0, max)
    const space = cut.lastIndexOf(' ')
    out = (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…'
  }
  return out
}

function starsOf(weighted: number | undefined): number | undefined {
  if (weighted === undefined) return undefined
  return rubric.scoring.starBands.find((b) => weighted >= b.minWeighted && weighted <= b.maxWeighted)?.stars
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
          title="ไม่มีงานให้ครูดู"
          body="งานที่นักเรียนส่งจะขึ้นที่นี่ นักเรียนได้เกียรติบัตรแล้ว ครูดูย้อนหลังได้"
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
  const activeIdx = pending.findIndex((r) => r.id === active.id)
  const nextRow = pending[activeIdx + 1] ?? pending[activeIdx - 1] ?? null
  const nextHref = nextRow ? `/teacher/review?classroomId=${classroomId}&submission=${nextRow.id}` : null
  const activeJobs = await listGradeJobsBySubmissions([active.id]).catch(() => [])
  const profile = await getProfile(active.student_id).catch(() => null)

  const bulkItems: BulkItem[] = pending.flatMap((r) => {
    if (isTeacherConfirmed(r)) return []
    const b = readAiScores(r.ai_scores)
    const done = b?.gradingStatus === 'done' && Boolean(b?.aiProposed)
    const dims = (done && b?.aiProposed?.dimensions?.length ? b.aiProposed.dimensions : b?.dimensions) ?? []
    if (dims.length === 0) return []
    return [{
      submissionId: r.id,
      dimensions: Object.fromEntries(dims.map((d) => [d.id, d.score])),
      emphasisDimensionId: dims.find((d) => d.emphasized)?.id ?? null,
    }]
  })

  return (
    <div className="grid items-start gap-4 min-[1100px]:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="คิวงานให้ครูดู" className="t3-card relative min-w-0 overflow-hidden min-[1100px]:sticky min-[1100px]:top-4">
        <div className="flex items-center justify-between border-b border-[var(--c-line)] px-3 py-2">
          <h2 className="m-0 text-[15px] font-bold">คิวงาน</h2>
          <span className="rounded-full bg-[var(--c-brand)] px-2 text-[13px] leading-5 font-bold text-white tabular-nums">{pending.length}</span>
        </div>
        <ul className="t3-scroll m-0 flex list-none gap-1.5 overflow-x-auto p-1.5 min-[1100px]:max-h-[52vh] min-[1100px]:flex-col min-[1100px]:overflow-x-hidden min-[1100px]:overflow-y-auto">
          {pending.map((q) => {
            const on = q.id === active.id
            return (
              <li key={q.id} className="shrink-0 min-[1100px]:shrink">
                <Link
                  href={`/teacher/review?classroomId=${classroomId}&submission=${q.id}`}
                  aria-current={on ? 'true' : undefined}
                  className="flex w-48 items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--c-brand-soft)] min-[1100px]:w-auto"
                  style={on ? { background: 'var(--c-brand-soft)', boxShadow: 'inset 3px 0 0 var(--c-brand)' } : undefined}
                >
                  <Avatar name={q.nickname ?? '?'} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] leading-5 font-semibold">{q.nickname}</span>
                    <span className="block truncate text-[12px] leading-4 text-[var(--c-ink-3)]">{q.domain_name}{q.tld}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <BulkConfirm items={bulkItems} />
      </nav>
      <ul aria-live="polite" className="m-0 flex min-w-0 list-none flex-col gap-4 p-0">
      {[active].map((row) => {
        const ai = readAiScores(row.ai_scores)
        const aiDone = ai?.gradingStatus === 'done' && Boolean(ai?.aiProposed)
        const versions = historyByStudent.get(row.student_id) ?? []
        const indexFromNewest = versions.findIndex((v) => v.id === row.id)
        const older = indexFromNewest >= 0 ? versions.slice(indexFromNewest + 1) : []
        const aiWait = classifyAiWait(ai?.gradingStatus, Boolean(ai?.aiProposed), activeJobs)
        const sysTotal = ai?.ruleScores?.weightedTotal ?? ai?.score
        const sysMax = ai?.ruleScores?.weightedMax ?? ai?.maxScore ?? rubric.scoring.weightedMax
        const sysStars = ai?.ruleScores?.stars ?? starsOf(sysTotal)
        const aiTotal = ai?.aiProposed?.weightedTotal
        const domeText = trimFeedback(aiDone ? ai?.aiProposed?.feedback ?? ai?.feedback : ai?.ruleScores?.feedback ?? ai?.feedback)
        const confirmedNow = isTeacherConfirmed(row)
        const businessType = businessTypes.items.find((t) => t.id === profile?.business_type)
        const shopArt = shopArtSrc(profile?.business_type, 5)
        const shopFallback = shopArtFallbackSrc(5)
        const currentStep = confirmedNow ? 4 : 3
        const domeBlock = domeText ? (
          <div className="flex items-start gap-2 rounded-2xl border border-[#ddd3fb] bg-white p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="โดม" width={44} height={44} className="size-11 shrink-0 rounded-2xl" />
            <div className="relative min-w-0 rounded-2xl rounded-tl-sm bg-[#f3efff] px-3 py-2 text-[13px] leading-5 text-[var(--c-ink-2)]">
              <p className="m-0 text-[11px] font-bold text-[var(--c-brand)]">โดมสรุป</p>
              <p className="m-0">{domeText}</p>
            </div>
          </div>
        ) : null
        return (
          <li key={row.id} className="t3-card p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Avatar name={row.nickname ?? '?'} size={36} />
              <p className="m-0 min-w-0 text-[18px] leading-6 font-extrabold text-ink">{row.nickname}</p>
              <p className="m-0 min-w-0 basis-full text-[15px] font-bold break-all text-brand-700 min-[640px]:flex-1 min-[640px]:basis-0">
                {row.domain_name}{row.tld}
              </p>
              <StatusBadge status="passed">{confirmedNow ? 'ครูยืนยันแล้ว' : 'ได้เกียรติบัตรแล้ว · ครูดูย้อนหลัง'}</StatusBadge>
            </div>

            <div className="mt-2.5 rounded-xl border border-[var(--c-line)] bg-[var(--c-sunken)] px-3 py-1.5" aria-label={`ขั้นตอนตรวจงาน ขั้นที่ ${currentStep} จาก 4`}>
              <div className="flex items-center gap-1.5">
                {[
                  ['①', 'โจทย์'],
                  ['②', 'ส่งงาน'],
                  ['③', 'ให้คะแนน'],
                  ['④', 'ยืนยัน'],
                ].map(([number, label], index) => {
                  const step = index + 1
                  const on = step === currentStep
                  const done = step < currentStep
                  return (
                    <div key={number} className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${on ? 'bg-[var(--c-brand)] text-white shadow-sm' : done ? 'bg-[var(--s-success-soft)] text-[var(--s-success-ink)]' : 'bg-white text-[var(--c-ink-3)]'}`}>{number}</span>
                      <span className={`truncate text-[11px] font-bold ${on ? 'text-[var(--c-brand)]' : 'text-[var(--c-ink-3)]'}`}>{label}</span>
                      {index < 3 ? <span aria-hidden className="h-px min-w-1 flex-1 bg-[var(--c-line-strong)]" /> : null}
                    </div>
                  )
                })}
              </div>
                          </div>

            <details className="mt-3 rounded-2xl border border-[var(--c-line)] bg-white px-3 py-2.5">
              <summary className="cursor-pointer list-none"><ReviewStepHeading number="①" title="โจทย์" icon="clipboard" detail="ภารกิจใหญ่ CEO · เปิดอ่านเพื่อทบทวนเกณฑ์" /></summary>
              <p className="m-0 mt-2.5 rounded-xl bg-[var(--c-sunken)] px-3 py-2.5 text-[13px] leading-5 text-[var(--c-ink-2)]">
                <strong className="text-ink">{bigMission.title}</strong> — {bigMission.objective} นักเรียนต้องเลือกชื่อโดเมน + นามสกุล แล้วเขียนเหตุผล 3 ข้อ (ชื่อ · นามสกุล · ลูกค้า)
              </p>
            </details>

            <section aria-label="สิ่งที่นักเรียนส่ง" className="mt-3 rounded-2xl border border-[var(--c-line)] bg-[linear-gradient(135deg,#fff_0%,#faf9ff_100%)] p-3">
              <ReviewStepHeading number="②" title="สิ่งที่นักเรียนส่ง" icon="package" detail="ภาพร้าน ข้อมูลสำคัญ และเหตุผลของนักเรียน" />
              <div className="mt-2.5 grid gap-3 sm:grid-cols-[170px_minmax(0,1fr)]">
                <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--c-line)] bg-[#eef0ff] p-1.5">
                  <ShopArtImg src={shopArt} fallback={shopFallback} alt={`ภาพร้าน${profile?.business_name ? ` ${profile.business_name}` : ''}`} className="h-[104px] w-full object-contain" style={{ height: 160, width: "100%", maxHeight: 160, objectFit: "contain" }} />
                  <div className="flex items-center gap-2 rounded-xl bg-white/80 px-2 py-1.5">
                    <Avatar name={row.nickname ?? '?'} size={25} />
                    <span className="min-w-0 truncate text-[12px] font-bold text-[var(--c-ink)]">{row.nickname}</span>
                    {businessType?.icon ? <span className="ml-auto text-[16px]" aria-label={businessType.label}>{businessType.icon}</span> : null}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="rounded-xl border border-[var(--c-line-strong)] bg-white px-2.5 py-2 shadow-[0_2px_8px_rgb(30_35_70_/_.05)]">
                    <div className="flex items-center gap-1.5 rounded-lg bg-[var(--c-sunken)] px-2 py-1.5 text-[13px] font-bold text-[var(--c-ink-2)]">
                      <span aria-hidden className="text-[12px]">🔒</span>
                      <span className="min-w-0 break-all">{row.domain_name}<strong className="ml-0.5 rounded-md bg-[#e6defd] px-1 text-[var(--c-brand)]">{row.tld}</strong></span>
                    </div>
                  </div>
                  <dl className="m-0 mt-2 grid grid-cols-2 gap-1.5">
                    {profile?.business_name ? <Fact icon="🏪" label="ชื่อร้าน">{profile.business_name}</Fact> : null}
                    {profile?.business_type ? <Fact icon={businessType?.icon ?? '🏬'} label="ประเภทธุรกิจ">{businessType?.label ?? profile.business_type}</Fact> : null}
                    {profile?.audience ? <Fact icon="👥" label="กลุ่มลูกค้า">{profile.audience === 'international' ? 'มีลูกค้าต่างชาติด้วย' : 'ลูกค้าในไทย'}</Fact> : null}
                {profile?.is_registered_company !== null && profile?.is_registered_company !== undefined ? (
                  <Fact icon="📜" label="สถานะร้าน" tone={profile.is_registered_company ? 'good' : 'warn'}>{profile.is_registered_company ? 'จดทะเบียนแล้ว' : 'ยังไม่ได้จดทะเบียน'}</Fact>
                ) : null}
                {row.emphasis_criterion ? (
                  <Fact icon="×2" label="ดูเป็นพิเศษ" tone="gold">
                    {rubricDimensions.find((d) => d.id === resolveEmphasisDimension(row.emphasis_criterion))?.name ?? row.emphasis_criterion}
                  </Fact>
                ) : null}
                  </dl>
                </div>
              </div>
              <div className="mt-2.5 grid gap-2.5 min-[900px]:grid-cols-2">
              {row.reason_text ? (
                <div className="flex items-start gap-2 rounded-2xl bg-[#f3efff] p-2.5">
                  <Avatar name={row.nickname ?? '?'} size={30} />
                  <div className="min-w-0">
                    <p className="m-0 text-[11px] font-bold text-[var(--c-brand)]">เหตุผลที่นักเรียนเขียน</p>
                    <blockquote className="m-0 mt-0.5 text-[13px] leading-5 whitespace-pre-line text-[var(--c-ink-2)]">“{row.reason_text}”</blockquote>
                  </div>
                </div>
              ) : null}
                {domeBlock}
              </div>
            </section>

            <section aria-label="ให้คะแนน" className="mt-3 rounded-2xl border border-[var(--c-line)] bg-white p-3">
              <ReviewStepHeading number="③" title="ให้คะแนน" icon="bar-chart" detail="ตรวจทีละด้าน แล้วปรับระดับได้ตามดุลยพินิจครู" />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[var(--c-sunken)] px-3 py-2 text-[12px] font-bold text-[var(--c-ink-2)]">
                <span>ระบบตรวจให้ <strong className="text-[var(--c-brand)]">{sysTotal ?? '-'}/{sysMax}</strong>{sysStars !== undefined ? ` · ${sysStars} ดาว` : ''}</span>
                {aiDone && aiTotal !== undefined ? <span className="font-semibold text-[var(--c-ink-3)]">AI เสนอ {aiTotal}/{ai?.aiProposed?.weightedMax ?? sysMax}</span> : aiWait === 'stale' ? <RegradeButton submissionId={row.id} /> : null}
              </div>

            <TeacherConfirmScore
              submissionId={row.id}
              proposedScore={(aiDone ? ai?.aiProposed?.weightedTotal : undefined) ?? ai?.score ?? 0}
              maxScore={(aiDone ? ai?.aiProposed?.weightedMax : undefined) ?? ai?.maxScore ?? 15}
              dimensions={(aiDone && ai?.aiProposed?.dimensions?.length ? ai.aiProposed.dimensions : ai?.dimensions) ?? []}
              savedScores={readTeacherScores(row.teacher_confirmed_scores)}
              /** ต้องถาม isTeacherConfirmed() ไม่ใช่เช็ก null เพราะก้อน status:'revise' ก็ไม่ null (T65 · /api/ceo) */
              confirmed={confirmedNow}
              roundsUsed={Math.max(0, versions.length - 1)}
              maxRounds={MAX_REVISION_ROUNDS}
              nextHref={nextHref}
              guides={GUIDES}
              starBands={rubric.scoring.starBands}
            />
            </section>

            {older.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-note font-bold text-brand-700">ดูฉบับก่อนหน้า ({older.length})</summary>
                <ul className="mt-2 flex list-none flex-col gap-2 p-0">
                  {older.map((old, i) => {
                    const teacherBag = readTeacherScores(old.teacher_confirmed_scores)
                    return (
                      <li key={old.id} className="rounded-md bg-[var(--c-sunken)] p-3">
                        <p className="m-0 text-label font-bold text-ink">ฉบับที่ {older.length - i} · {old.domain_name}{old.tld}</p>
                        {old.reason_text ? <p className="mt-1 mb-0 text-label whitespace-pre-line text-ink-muted">{old.reason_text}</p> : null}
                        {teacherBag?.note ? <p className="mt-1 mb-0 text-note text-brand-700">ครูเคยบอกไว้: {teacherBag.note}</p> : null}
                      </li>
                    )
                  })}
                </ul>
              </details>
            ) : null}
          </li>
        )
      })}
      </ul>
    </div>
  )
}

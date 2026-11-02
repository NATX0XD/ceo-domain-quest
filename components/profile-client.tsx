'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StudentShell } from '@/components/student-shell'
import { StudentAccountPanel } from '@/components/student-account-panel'
import { AppFooter } from '@/components/app-shell'
import { QuizStepper } from '@/components/quiz-stepper-client'
import { DomeTip, FlowNote, StageLine, useFlowFeedback } from '@/components/flow-feedback-client'
import './profile-v3.css'
import {
  ArrowLeftIcon,
  Button,
  ChevronRightIcon,
  ChoiceCard,
  DomeAvatar,
  StatBadge,
} from '@/components/ui'

/**
 * ขั้นที่ 2 รู้จักตัวเอง — **หน้าจอไม่คิดคะแนนเอง**
 *
 * ⚠️ ห้าม import core/personalize ที่นี่ (มันดึงไฟล์เฉลยตามมาด้วย)
 *    ข้อเสนอทั้งหมดมาจาก POST /api/profile/preferences
 * ⚠️ น้ำหนักคะแนนของแต่ละตัวเลือกถูกตัดออกตั้งแต่ฝั่งเซิร์ฟเวอร์ หน้านี้เห็นแค่ข้อความ
 * กติกาสำคัญ: ปุ่ม "ขอเลือกเอง" ต้องเลือกได้ครบทั้ง 4 เส้นทางและ 3 ระดับเสมอ ห้ามล็อกอันไหน
 */
export type RouteId = 'clip' | 'card' | 'game' | 'buddy'
export type LevelId = 1 | 2 | 3

export interface ProfileQuestion {
  id: string
  question: string
  helper: string
  choices: { id: string; text: string }[]
}

export interface ProfileChannel {
  id: RouteId
  name: string
  shortName: string
  description: string
  goodFor: string
}

export interface ProfileGoal {
  id: string
  name: string
  starTarget: number
  starLabel: string
  description: string
  forWho: string
  chooseButtonLabel: string
}

interface Suggestion {
  suggestedRoute: RouteId
  routeReason: string
  routeScores: Record<string, number>
  suggestedLevel: LevelId
  levelReason: string
  weakObjectives: string[]
  talentId: string | null
}

const LEVEL_LABELS: Record<LevelId, { title: string; detail: string }> = {
  1: { title: 'ระดับ 1 เปิดป้ายช่วยครบ', detail: 'เห็นเงื่อนไขทุกข้อของทุกช่อง เหมาะกับคนที่เพิ่งเริ่ม' },
  2: { title: 'ระดับ 2 เห็นบางส่วน', detail: 'เห็นว่าใครจดได้บ้าง ที่เหลือคิดเอง' },
  3: { title: 'ระดับ 3 ไม่เปิดป้ายช่วย', detail: 'ลองเองล้วน ๆ ขอตัวช่วยเพิ่มได้ตลอดถ้าอยากได้' },
}

/** ไอคอน 3D ของแต่ละเส้นทาง (public/icons/3d) */
const ROUTE_ICON: Record<RouteId, string> = {
  clip: 'television',
  card: 'books',
  game: 'performing-arts',
  buddy: 'busts-in-silhouette',
}

function ChoiceArt({ icon, className = 'size-14' }: { icon: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D ไฟล์สถิตของโลกเกม
    <img src={`/icons/3d/${icon}.webp`} alt="" className={className} draggable={false} />
  )
}

/** หน่วยสถิติ 3 ช่องบนการ์ดตัวตน — ใช้ภาพนำสายตาแทนกล่องข้อมูลซ้อนกัน */
function IdentityMedallion({
  icon,
  label,
  value,
  detail,
}: {
  icon: string
  label: string
  value: ReactNode
  detail?: ReactNode
}) {
  return (
    <div className="profile-v3-medallion">
      <span className="profile-v3-medallion-art" aria-hidden="true">
        <ChoiceArt icon={icon} className="size-9" />
      </span>
      <span className="profile-v3-medallion-label">{label}</span>
      <span className="profile-v3-medallion-value">{value}</span>
      {detail ? <span className="profile-v3-medallion-detail">{detail}</span> : null}
    </div>
  )
}

export function ProfileClient({
  meta,
  questions,
  channels,
  talents,
  goals,
  objectives,
  identity,
  goalPolicyNote,
  initial,
  goalForm,
  certificateNameForm,
}: {
  /**
   * ฟอร์ม "เป้าหมายของฉันเอง" ที่หน้า /profile เรนเดอร์มา (เป็น Server Action ล้วน)
   * ต้องส่งเข้ามาวางในโครงหน้าจอตรงนี้ ไม่ใช่วางเป็นพี่น้องของ ProfileClient
   * เพราะโครงแบบแอปมี AppShell ได้หน้าละหนึ่งตัว อะไรที่อยู่นอกนั้นจะถูกตัดหาย
   */
  goalForm?: ReactNode
  certificateNameForm?: ReactNode
  meta: { headline: string; subHeadline: string; ownershipNote: string; finishButtonLabel: string; minuteFrom: number; minuteTo: number }
  questions: ProfileQuestion[]
  channels: ProfileChannel[]
  talents: { id: string; name: string; cardLine: string }[]
  goals: ProfileGoal[]
  objectives: { id: string; shortName: string }[]
  identity: {
    title: string
    subtitle: string
    talentLabel: string
    channelLabel: string
    channelSuggestionNote: string
    confirmChannelLabel: string
    pickAnotherChannelLabel: string
    pickAnotherChannelHelper: string
    goalLabel: string
    focusLabel: string
    focusEmptyText: string
    switchChannelHelper: string
    encouragement: string
    startButtonLabel: string
  }
  goalPolicyNote: string
  initial: {
    nickname: string
    /** รหัสห้อง — โชว์ในกล่องยืนยันออกจากระบบ */
    roomCode?: string | null
    prefAnswers: Record<string, string>
    suggestion: Suggestion | null
    route: RouteId | null
    routeChosenBy: 'system' | 'student' | null
    level: LevelId | null
    goalId: string | null
    finished: boolean
    nicknameLocked: boolean
  }
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>(initial.prefAnswers)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(initial.suggestion)
  const [route, setRoute] = useState<RouteId | null>(initial.route)
  const [routeChosenBy, setRouteChosenBy] = useState<'system' | 'student' | null>(
    initial.routeChosenBy,
  )
  const [level, setLevel] = useState<LevelId | null>(initial.level)
  /** เป้าที่แตะเลือกไว้ (ยังไม่บันทึก) — บันทึกจริงตอนกดปุ่มท้ายจอของขั้นเป้าหมาย */
  const [goalId, setGoalId] = useState<string | null>(initial.goalId)
  /** เป้าที่บันทึกในเซิร์ฟเวอร์แล้ว — กฎ "ลดเป้าไม่ได้" ใช้เทียบกับอันนี้เท่านั้น */
  const [savedGoalId, setSavedGoalId] = useState<string | null>(initial.goalId)
  const [goalNote, setGoalNote] = useState<string | null>(null)
  /** ขั้นของวิซาร์ด · ข้อที่กำลังตอบ · สถานะการกดปุ่ม (กดแล้วห้ามเงียบ) */
  const [step, setStep] = useState(initial.finished ? 4 : 0)
  const [qIndex, setQIndex] = useState(0)
  const flow = useFlowFeedback()

  const answeredCount = questions.filter((q) => answers[q.id]).length
  const allAnswered = answeredCount === questions.length

  /** QuizStepper คุยด้วย "ลำดับตัวเลือก" แต่หน้านี้เก็บ "รหัสตัวเลือก" — แปลงตรงนี้ที่เดียว */
  const answerIndexes: Record<string, number> = {}
  for (const q of questions) {
    const i = q.choices.findIndex((c) => c.id === answers[q.id])
    if (i >= 0) answerIndexes[q.id] = i
  }

  async function sendChoice(patch: Record<string, unknown>) {
    flow.sending('กำลังบันทึกตัวเลือก รอสักครู่')
    try {
      const res = await fetch('/api/profile/choice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => null)) as
        | { route?: RouteId; routeChosenBy?: 'system' | 'student'; goalId?: string; goalRejectedNote?: string | null; message?: string }
        | null
      if (!res.ok) {
        flow.failed(`${data?.message ?? 'บันทึกไม่สำเร็จ'} — ตัวเลือกเดิมยังอยู่ ลองแตะใหม่อีกครั้ง`)
        return null
      }
      if (data?.route) setRoute(data.route)
      if (data?.routeChosenBy) setRouteChosenBy(data.routeChosenBy)
      if (data?.goalId) {
        setGoalId(data.goalId)
        setSavedGoalId(data.goalId)
      }
      setGoalNote(data?.goalRejectedNote ?? null)
      flow.done('บันทึกแล้ว กดปุ่มข้างล่างเพื่อไปขั้นต่อไป')
      router.refresh()
      return data
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ ตัวเลือกเดิมยังอยู่ ลองแตะใหม่อีกครั้ง')
      return null
    }
  }

  async function askSuggestion() {
    if (!allAnswered || flow.busy) return
    flow.sending('กำลังคิดเส้นทางที่เหมาะกับเรา รอสักครู่')
    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefAnswers: answers }),
      })
      const data = (await res.json().catch(() => null)) as (Suggestion & { message?: string }) | null
      if (!res.ok || !data) {
        flow.failed(`${data?.message ?? 'ขอข้อเสนอไม่สำเร็จ'} — คำตอบยังอยู่ครบ กดใหม่อีกครั้งได้เลย`)
        return
      }
      setSuggestion(data)
      flow.done('ระบบเสนอเส้นทางให้แล้ว เลือกตามหรือเปลี่ยนเองก็ได้')
      router.refresh()
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ คำตอบยังอยู่ครบ กดใหม่อีกครั้งได้เลย')
    }
  }

  const suggestedChannel = suggestion
    ? channels.find((c) => c.id === suggestion.suggestedRoute)
    : null
  const chosenChannel = route ? channels.find((c) => c.id === route) : null
  const chosenGoal = goalId ? goals.find((g) => g.id === goalId) : null
  const savedGoal = savedGoalId ? goals.find((g) => g.id === savedGoalId) : null
  /** ลดเป้าที่บันทึกแล้วไม่ได้ (goalPolicy.canLowerDuringLesson = false) — ก่อนบันทึกเลือกสลับได้อิสระ */
  const isBelowSavedGoal = (g: ProfileGoal) => savedGoal != null && g.starTarget < savedGoal.starTarget

  /** ขั้นเป้าหมาย: บันทึกเป้าที่เลือกไว้ก่อน แล้วค่อยไปหน้าการ์ด (ถูกปฏิเสธ = อยู่หน้าเดิมพร้อมเหตุผล) */
  async function confirmGoal() {
    if (!goalId) return
    if (goalId === savedGoalId) {
      setStep(4)
      return
    }
    const data = await sendChoice({ goalId })
    if (data && !data.goalRejectedNote && data.goalId === goalId) setStep(4)
  }
  const talent = suggestion?.talentId ? talents.find((t) => t.id === suggestion.talentId) : null
  const weakNames = (suggestion?.weakObjectives ?? [])
    .map((id) => objectives.find((o) => o.id === id)?.shortName)
    .filter((n): n is string => typeof n === 'string')

  /**
   * UX-5 — ขั้นรู้จักตัวเองเป็นวิซาร์ดทีละเรื่อง จบในจอเดียวทุกขั้น
   *
   * เดิมยัดทั้งคำถาม ข้อเสนอเส้นทาง ระดับตัวช่วย เป้าหมายดาว และบัตรประจำตัว ลงหน้าเดียว
   * (วัดได้ 3472px ในกรอบ 735px) เจ้าของสั่งว่าห้ามเลื่อน จึงแบ่งเป็นขั้น
   * และ **ทุกขั้นบอกว่าตอนนี้ต้องทำอะไร + กดแล้วเกิดอะไรขึ้น**
   */
  const stepList: { key: string; label: string; ready: boolean }[] = [
    { key: 'ask', label: 'ตอบคำถามรู้จักตัวเอง', ready: allAnswered },
    { key: 'route', label: 'เลือกเส้นทางการเรียน', ready: route !== null },
    { key: 'level', label: 'เลือกระดับตัวช่วย', ready: level !== null },
    { key: 'goal', label: 'ตั้งเป้าหมายดาว', ready: goalId !== null },
    { key: 'card', label: 'บัตรประจำตัว CEO', ready: true },
  ]
  const stepKey = stepList[Math.min(step, stepList.length - 1)]?.key ?? 'ask'
  const stepNo = Math.min(step, stepList.length - 1) + 1

  /** ปุ่มท้ายจอของแต่ละขั้น — บอกล่วงหน้าเสมอว่าทำไมยังกดไม่ได้ */
  function footerFor(): { label: string; onClick: () => void; why: string | null; tone: 'primary' | 'success' } {
    if (stepKey === 'ask') {
      return {
        label: 'ดูเส้นทางต่อ',
        onClick: () => void askSuggestion().then(() => setStep(1)),
        why: allAnswered ? null : `ยังเหลืออีก ${questions.length - answeredCount} ข้อถึงจะดูข้อเสนอได้`,
        tone: 'primary',
      }
    }
    if (stepKey === 'route') {
      return {
        label: 'ไปเลือกระดับตัวช่วย',
        onClick: () => setStep(2),
        why: route === null ? 'เลือกเส้นทางสักอันก่อน แล้วปุ่มนี้จะกดได้' : null,
        tone: 'primary',
      }
    }
    if (stepKey === 'level') {
      return {
        label: 'ไปตั้งเป้าหมายดาว',
        onClick: () => setStep(3),
        why: level === null ? 'เลือกระดับตัวช่วยสักอันก่อน' : null,
        tone: 'primary',
      }
    }
    if (stepKey === 'goal') {
      return {
        label: goalId !== null && goalId !== savedGoalId ? 'ยืนยันเป้าหมาย ดูการ์ด' : 'ดูการ์ดตัวตนของฉัน',
        onClick: () => void confirmGoal(),
        why: goalId === null ? 'เลือกเป้าหมายดาวสักอันก่อน' : null,
        tone: 'primary',
      }
    }
    return { label: identity.startButtonLabel, onClick: () => undefined, why: null, tone: 'success' }
  }

  const foot = footerFor()

  return (
    <StudentShell
      withBottomNav
      className="profile-world-shell profile-v3-world-shell flex h-full min-h-0 flex-col gap-3 pb-6"
      footer={
        stepKey === 'card' ? undefined : (
          <AppFooter>
            {flow.state.kind !== 'done' ? <FlowNote state={flow.state} className="mb-2" /> : null}
            <div className="flex gap-2">
              {stepKey !== 'ask' ? (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setStep((n) => Math.max(0, n - 1))}
                  disabled={flow.busy}
                  leadingIcon={<ArrowLeftIcon width={20} height={20} />}
                  className="shrink-0 px-3"
                  aria-label="ย้อน"
                >
                  {/* จอแคบเหลือแค่ลูกศร ให้ปุ่มไปต่อมีที่พอสำหรับข้อความเต็ม (มุมขวาเป็นของปุ่มโดมลอย) */}
                  <span className="max-[400px]:hidden">ย้อน</span>
                </Button>
              ) : null}
              <Button
                variant={foot.tone}
                size="lg"
                fullWidth
                onClick={foot.onClick}
                disabled={foot.why !== null || flow.busy}
                loading={flow.busy}
                loadingLabel="กำลังบันทึก"
                trailingIcon={flow.busy ? undefined : <ChevronRightIcon width={22} height={22} />}
              >
                {foot.label}
              </Button>
            </div>
          </AppFooter>
        )
      }
    >
      <div className="profile-v3-topline flex shrink-0 items-center gap-2">
        <StageLine
          stage={`รู้จักตัวเอง · ขั้น ${stepNo} จาก ${stepList.length}`}
          className="min-w-0 flex-1"
        />
        <StudentAccountPanel
          initialNickname={initial.nickname}
          nicknameLocked={initial.nicknameLocked}
          roomCode={initial.roomCode}
          certificateNameForm={certificateNameForm}
        />
      </div>
      <ol className="profile-v3-step-rail" aria-label="ขั้นตอนรู้จักตัวเอง">
        {stepList.map((item, index) => (
          <li key={item.key} className={index === step ? 'is-current' : item.ready ? 'is-ready' : ''}>
            <span aria-hidden="true">{index + 1}</span>
            <span className="sr-only">{item.label}{index === step ? ' · กำลังทำอยู่' : ''}</span>
          </li>
        ))}
      </ol>
      <span className="sr-only">
        ใช้เวลาประมาณ {meta.minuteFrom}-{meta.minuteTo} นาที
      </span>

      {stepKey === 'ask' ? (
        questions.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
            <DomeAvatar mood="cheer" size={96} decorative />
            <h1 className="text-title font-extrabold text-balance text-ink">ยังไม่มีคำถามให้ตอบ</h1>
            <p className="max-w-[22rem] text-body text-pretty text-ink-muted">
              รอครูเปิดขั้นรู้จักตัวเองให้ก่อนนะ พอครูเปิดแล้วหน้านี้จะมีคำถามขึ้นมาเอง
            </p>
          </div>
        ) : (
          <>
            <QuizStepper
              className="profile-v3-quiz"
              questions={questions.map((q) => ({
                id: q.id,
                question: q.question,
                choices: q.choices.map((c) => c.text),
                topic: q.helper,
              }))}
              answers={answerIndexes}
              onAnswer={(qid, ci) => {
                const q = questions.find((x) => x.id === qid)
                const choice = q?.choices[ci]
                if (choice) setAnswers((a) => ({ ...a, [qid]: choice.id }))
              }}
              index={qIndex}
              onIndexChange={setQIndex}
              compactProgress
            />
          </>
        )
      ) : null}

      {stepKey === 'route' ? (
        <>
          <h1 className="shrink-0 text-title-sm font-extrabold text-balance text-ink">
            {identity.channelLabel}
          </h1>
          {suggestion && suggestedChannel ? (
            <DomeTip mood="happy">
              ระบบเสนอ {suggestedChannel.name} เพราะ {suggestion.routeReason} · เปลี่ยนเองได้ ไม่หักดาว
            </DomeTip>
          ) : null}
          <ul
            role="radiogroup"
            aria-label="เส้นทางการเรียนทั้งหมด"
            className="profile-v3-choice-grid profile-v3-route-grid min-h-0 flex-1"
          >
            {channels.map((c) => (
              <li key={c.id}>
                <ChoiceCard
                  icon={<ChoiceArt icon={ROUTE_ICON[c.id]} />}
                  layout="tile"
                  label={c.name}
                  description={c.id === suggestion?.suggestedRoute ? 'ระบบเสนออันนี้' : c.goodFor}
                  ariaLabel={`${c.name} — ${c.description}`}
                  selected={route === c.id}
                  disabled={flow.busy}
                  onSelect={() => void sendChoice({ route: c.id })}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {stepKey === 'level' ? (
        <>
          <h1 className="shrink-0 text-title-sm font-extrabold text-balance text-ink">
            ระดับตัวช่วยที่อยากได้
          </h1>
          {suggestion ? (
            <DomeTip mood="greet">
              ระบบเสนอระดับ {suggestion.suggestedLevel} จากคำตอบของเรา · เปลี่ยนเองได้ทุกเมื่อ
            </DomeTip>
          ) : null}
          <ul
            role="radiogroup"
            aria-label="ระดับตัวช่วย"
            className="profile-v3-choice-grid profile-v3-level-grid min-h-0 flex-1"
          >
            {([1, 2, 3] as const).map((n) => (
              <li key={n}>
                <ChoiceCard
                  icon={<span className="profile-v3-level-number">{n}</span>}
                  layout="tile"
                  label={LEVEL_LABELS[n].title}
                  description={`${LEVEL_LABELS[n].detail}${
                    n === suggestion?.suggestedLevel ? ' · ระบบเสนออันนี้' : ''
                  }`}
                  selected={level === n}
                  disabled={flow.busy}
                  onSelect={() => {
                    setLevel(n)
                    void sendChoice({ level: n })
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {stepKey === 'goal' ? (
        <>
          <h1 className="shrink-0 text-title-sm font-extrabold text-balance text-ink">
            เป้าหมายดาวที่ตั้งเอง
          </h1>
          <DomeTip mood="cheer">{goalPolicyNote}</DomeTip>
          {savedGoal ? (
            <p className="shrink-0 rounded-xl border-2 border-[rgb(107_45_18/.25)] bg-[#fff8e7] px-3 py-2 text-label font-semibold text-pretty text-[#5a2812]">
              ตอนนี้ตั้งไว้ {savedGoal.name} {savedGoal.starTarget} ดาว เลือกเป้าที่สูงขึ้นได้
              แต่เป้าที่ต่ำกว่าล็อกไว้ ถ้าอยากลดเป้าให้ยกมือบอกครู
            </p>
          ) : null}
          <div className="profile-v3-goal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
          <ul
            role="radiogroup"
            aria-label="เป้าหมายดาวของฉัน"
            className="profile-v3-choice-grid profile-v3-goal-grid"
          >
            {goals.map((g) => (
              <li key={g.id}>
                <ChoiceCard
                  icon={<span className="profile-v3-star-cluster" aria-hidden="true">{'★'.repeat(Math.min(g.starTarget, 3))}</span>}
                  layout="tile"
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      {g.name}
                      <StatBadge kind="star" value={g.starTarget} label="เป้าหมายดาว" hideLabel size="sm" />
                    </span>
                  }
                  description={g.description}
                  ariaLabel={`${g.name} เป้าหมาย ${g.starTarget} ดาว — ${g.description}`}
                  selected={goalId === g.id}
                  state={isBelowSavedGoal(g) ? 'locked' : 'idle'}
                  disabled={flow.busy}
                  onSelect={() => {
                    setGoalNote(null)
                    setGoalId(g.id)
                  }}
                />
              </li>
            ))}
          </ul>
          {goalNote ? <FlowNote state={{ kind: 'failed', text: goalNote }} /> : null}
          {goalForm ? <div className="profile-v3-own-goal">{goalForm}</div> : null}
          </div>
        </>
      ) : null}

      {stepKey === 'card' ? (
        <div className="profile-v3-card-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
          <article aria-labelledby="identity-card-title" className="profile-v3-identity-card">
            <div className="profile-v3-card-header">
              <div className="profile-v3-card-copy">
                <p className="profile-v3-card-kicker">
                  <ChoiceArt icon="crown" className="size-5" />
                  {identity.subtitle}
                </p>
                <h1 id="identity-card-title">{identity.title}</h1>
                {level ? <span className="profile-v3-level-stamp" aria-label={`ระดับตัวช่วย ${level}`}>LV {level}</span> : null}
              </div>
              <div className="profile-v3-card-portrait" aria-hidden="true">
                <DomeAvatar mood="happy" size={148} decorative sparkle />
              </div>
            </div>

            {talent ? (
              <div className="profile-v3-trait-hero">
                <span className="profile-v3-trait-icon" aria-hidden="true">
                  <ChoiceArt icon="sparkles" className="size-9" />
                </span>
                <div className="min-w-0">
                  <p className="profile-v3-eyebrow">{identity.talentLabel}</p>
                  <p className="profile-v3-trait-name">{talent.name}</p>
                  <p className="profile-v3-trait-line">{talent.cardLine}</p>
                </div>
              </div>
            ) : null}

            <div className="profile-v3-stat-grid" aria-label="ค่าสถานะสำคัญ">
              <IdentityMedallion
                icon={ROUTE_ICON[route ?? 'card']}
                label="เส้นทาง"
                value={chosenChannel?.shortName ?? chosenChannel?.name ?? '—'}
                detail={routeChosenBy === 'student' ? 'เลือกเอง' : 'ระบบเสนอ'}
              />
              <IdentityMedallion
                icon="glowing-star"
                label="เป้าหมาย"
                value={chosenGoal ? `${chosenGoal.starTarget} ดาว` : '—'}
                detail={chosenGoal?.name}
              />
              <IdentityMedallion
                icon="light-bulb"
                label="ตัวช่วย"
                value={level ? `ระดับ ${level}` : '—'}
                detail={level ? LEVEL_LABELS[level].title.replace(/^ระดับ \d+ /, '') : undefined}
              />
            </div>

            {weakNames.length > 0 ? (
              <div className="profile-v3-focus-row">
                <div className="profile-v3-focus-heading">
                  <ChoiceArt icon="bullseye" className="size-6" />
                  <span>{identity.focusLabel}</span>
                </div>
                <div className="profile-v3-focus-chips">
                  {weakNames.map((name) => <span key={name}>{name}</span>)}
                </div>
              </div>
            ) : null}

            <p className="profile-v3-encouragement">{identity.encouragement}</p>
          </article>
          {/* ปุ่มของการ์ดตัวตนอยู่ในเนื้อหาใต้การ์ด ไม่ใช่แถบลอยเหนือเมนูล่าง */}
          {flow.state.kind !== 'done' ? <FlowNote state={flow.state} className="mt-3" /> : null}
          <div className="profile-v3-card-actions mx-auto mt-4 flex w-full max-w-[20rem] flex-col gap-2">
            {/* จบขั้นรู้จักตัวเองแล้วไปแผนที่เกาะ — ลิ้นชักล่างของแผนที่เป็นที่เลือกวิธีเรียนของแต่ละภารกิจ */}
            <Link
              href="/map"
              onClick={() => void sendChoice({ finish: true })}
              className="btn-base min-h-12 rounded-lg px-5 text-body game-button game-button--orange game-button--md w-full"
            >
              {identity.startButtonLabel}
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => {
                setQIndex(0)
                setStep(0)
              }}
            >
              ทำแบบสอบถามใหม่
            </Button>
          </div>
        </div>
      ) : null}

    </StudentShell>
  )
}

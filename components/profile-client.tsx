'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import { QuizStepper } from '@/components/quiz-stepper-client'
import { DomeTip, FlowNote, StageLine, useFlowFeedback } from '@/components/flow-feedback-client'
import {
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

/** ป้ายข้อความในการ์ดตัวตน — ไม่ใช่ปุ่ม จึงเป็น span ไม่ใช่ Chip ที่กดได้ */
const TAG_CLASS =
  'inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-label font-bold text-brand-700 ring-1 ring-brand-200 ring-inset'

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
}: {
  /**
   * ฟอร์ม "เป้าหมายของฉันเอง" ที่หน้า /profile เรนเดอร์มา (เป็น Server Action ล้วน)
   * ต้องส่งเข้ามาวางในโครงหน้าจอตรงนี้ ไม่ใช่วางเป็นพี่น้องของ ProfileClient
   * เพราะโครงแบบแอปมี AppShell ได้หน้าละหนึ่งตัว อะไรที่อยู่นอกนั้นจะถูกตัดหาย
   */
  goalForm?: ReactNode
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
    prefAnswers: Record<string, string>
    suggestion: Suggestion | null
    route: RouteId | null
    routeChosenBy: 'system' | 'student' | null
    level: LevelId | null
    goalId: string | null
    finished: boolean
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
  const [goalId, setGoalId] = useState<string | null>(initial.goalId)
  const [goalNote, setGoalNote] = useState<string | null>(null)
  /** ขั้นของวิซาร์ด · ข้อที่กำลังตอบ · สถานะการกดปุ่ม (กดแล้วห้ามเงียบ) */
  const [step, setStep] = useState(0)
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
      if (data?.goalId) setGoalId(data.goalId)
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
        label: 'ดูบัตรประจำตัวของฉัน',
        onClick: () => setStep(4),
        why: goalId === null ? 'เลือกเป้าหมายดาวสักอันก่อน' : null,
        tone: 'primary',
      }
    }
    return { label: identity.startButtonLabel, onClick: () => undefined, why: null, tone: 'success' }
  }

  const foot = footerFor()

  return (
    <StudentShell
      withBottomNav={false}
      className="profile-world-shell flex h-full min-h-0 flex-col gap-3 pb-6"
      footer={
        <AppFooter>
          <FlowNote state={flow.state} className="mb-2" />
          {stepKey === 'card' ? (
            <Link
              href="/mission/m1"
              onClick={() => void sendChoice({ finish: true })}
              className="btn-quest bg-quest-600 text-ink-onbrand hover:bg-quest-700"
            >
              {identity.startButtonLabel}
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          ) : (
            <div className="flex gap-2">
              {stepKey !== 'ask' ? (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setStep((n) => Math.max(0, n - 1))}
                  disabled={flow.busy}
                  className="shrink-0 px-4"
                >
                  ย้อน
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
          )}
        </AppFooter>
      }
    >
      {stepKey !== 'ask' ? (
        <StageLine stage={`รู้จักตัวเอง · ขั้น ${stepNo} จาก ${stepList.length}`} />
      ) : null}
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
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            {channels.map((c) => (
              <li key={c.id} className="min-h-0 flex-1">
                <ChoiceCard
                  label={c.name}
                  description={
                    c.id === suggestion?.suggestedRoute ? `${c.description} · ระบบเสนออันนี้` : c.description
                  }
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
              ระบบเสนอระดับ {suggestion.suggestedLevel} เพราะ {suggestion.levelReason} · เปลี่ยนเองได้ทุกเมื่อ
            </DomeTip>
          ) : null}
          <ul
            role="radiogroup"
            aria-label="ระดับตัวช่วย"
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="min-h-0 flex-1">
                <ChoiceCard
                  marker={String(n)}
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
          <ul
            role="radiogroup"
            aria-label="เป้าหมายดาวของฉัน"
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            {goals.map((g) => (
              <li key={g.id} className="min-h-0 flex-1">
                <ChoiceCard
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      {g.name}
                      <StatBadge kind="star" value={g.starTarget} label="เป้าหมายดาว" hideLabel size="sm" />
                    </span>
                  }
                  description={g.description}
                  ariaLabel={`${g.name} เป้าหมาย ${g.starTarget} ดาว — ${g.description}`}
                  selected={goalId === g.id}
                  disabled={flow.busy}
                  onSelect={() => void sendChoice({ goalId: g.id })}
                />
              </li>
            ))}
          </ul>
          {goalNote ? <FlowNote state={{ kind: 'failed', text: goalNote }} /> : null}
        </>
      ) : null}

      {stepKey === 'card' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <h1 className="shrink-0 text-title-sm font-extrabold text-balance text-ink">
            {identity.title}
          </h1>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 rounded-2xl bg-reward-100 p-4 ring-1 ring-reward-300 ring-inset">
            {talent ? (
              <p className="text-body text-pretty text-ink">
                <span className="font-bold">{talent.name}</span> — {talent.cardLine}
              </p>
            ) : null}
            <p className="flex flex-wrap items-center gap-2 text-body text-ink">
              <span className="text-label font-bold text-ink-muted">เส้นทางที่ฉันใช้</span>
              <span className="font-bold">{chosenChannel?.name}</span>
              <span className={TAG_CLASS}>
                {routeChosenBy === 'student' ? 'ฉันเลือกเอง' : 'เอาตามที่ระบบเสนอ'}
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-2 text-body text-ink">
              <span className="text-label font-bold text-ink-muted">ระดับตัวช่วย</span>
              <span className="font-bold">{level ? LEVEL_LABELS[level].title : '—'}</span>
            </p>
            <p className="flex flex-wrap items-center gap-2 text-body text-ink">
              <span className="text-label font-bold text-ink-muted">{identity.goalLabel}</span>
              <span className="font-bold">{chosenGoal?.name ?? '—'}</span>
              {chosenGoal ? (
                <StatBadge kind="star" value={chosenGoal.starTarget} label={identity.goalLabel} hideLabel size="sm" />
              ) : null}
            </p>
            {weakNames.length > 0 ? (
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-label font-bold text-ink-muted">{identity.focusLabel}</span>
                {weakNames.map((n) => (
                  <span key={n} className={TAG_CLASS}>
                    {n}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <DomeTip mood="happy">{identity.encouragement}</DomeTip>
        </div>
      ) : null}

      {/* ช่องเป้าหมายที่พิมพ์เอง — หน้าเซิร์ฟเวอร์ส่งเข้ามา อยู่ในขั้นเป้าหมายเท่านั้น */}
      {stepKey === 'goal' ? goalForm : null}
    </StudentShell>
  )
}

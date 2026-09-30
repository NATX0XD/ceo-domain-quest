'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SignInGate, StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import { DomeTip, FlowNote, StageLine, useFlowFeedback } from '@/components/flow-feedback-client'
import {
  AlertIcon,
  Button,
  CheckIcon,
  Chip,
  ChevronRightIcon,
  ClockIcon,
  ProgressBar,
  StatBadge,
  cn,
} from '@/components/ui'

/**
 * หน้าจอขั้นที่ 6 ทบทวนตัวเอง — **แสดงผลอย่างเดียว**
 *
 * ⚠️ ห้าม import `@/core/*`, `@/components/server/*` หรือ `content/*.json` เข้ามาในไฟล์นี้
 *    ข้อความทุกบรรทัดและดาวทุกดวงถูกส่งมาเป็น props จาก app/reflect/page.tsx
 * ⚠️ ความยาวขั้นต่ำถูกตรวจซ้ำที่ POST /api/reflect ตรงนี้ตรวจไว้บอกผู้เรียนเร็ว ๆ เท่านั้น
 *
 * **กติกาว่าต้องตอบกี่ข้อถึงจะส่งได้ ไม่ได้อยู่ในไฟล์นี้และไม่ได้อยู่ใน props**
 * แผนการสอนให้ตอบ 2 ข้อในคาบ ข้อที่เหลือเป็นของแถม แต่ `app/reflect/page.tsx` คิด
 * `initiallyComplete` จาก "ครบทุกข้อ" ซึ่งเข้มกว่ากติกาจริง จึงถาม `GET /api/reflect` ตอนเปิดหน้า
 * แล้วใช้ค่าจากเซิร์ฟเวอร์เป็นตัวตัดสินว่าจะโชว์การ์ดปิดคาบเลยไหม (QA-3 ข้อ 1.2)
 * ค่าจาก props ยังใช้เป็นค่าตั้งต้นตอนจอแรกขึ้น เพื่อไม่ให้หน้ากระพริบระหว่างรอคำตอบ
 */
export type ReflectOutcome = 'below' | 'met' | 'exceeded'

/** กติกาการส่งจากไฟล์เนื้อหา ส่งมาทาง API เพราะ client แตะไฟล์เนื้อหาไม่ได้ */
export interface ReflectPolicy {
  requiredIds: string[]
  optionalIds: string[]
  requiredCount: number
  totalCount: number
  optionalChipLabel: string
  optionalHint: string
}

/** สถานะใบประกาศของผู้เรียนคนนี้ คิดจากคะแนนที่ครูยืนยันแล้วเท่านั้น */
export interface ReflectCertificate {
  eligible: boolean
  message: string
  passedCount: number
  totalCount: number
  nextHref: string
  nextLabel: string
  statusLabel: string
}

export interface ReflectCompareCard {
  badgeLabel: string
  headline: string
  message: string
  /** ไฟล์เนื้อหาใส่ 4 คีย์นี้หรือไม่ใส่ก็ได้ ถ้าไม่มีก็ไม่ต้องแสดงบล็อกนั้น */
  focusLabel: string | null
  focusText: string | null
  nextStepLabel: string | null
  nextStepText: string | null
}

export interface ReflectQuestion {
  id: string
  question: string
  helper: string
  placeholder: string
  starterPhrases: string[]
  minLength: number
  maxLength: number
}

const NO_DATA = 'ยังไม่มีข้อมูล'

export function ReflectClient({
  meta,
  questions,
  closing,
  initialAnswers,
  initiallyComplete,
  stars,
  compareCards,
  initialOutcome,
}: {
  meta: {
    headline: string
    subHeadline: string
    submitButtonLabel: string
    skipNote: string
    savedMessage: string
    minuteFrom: number
    minuteTo: number
  }
  questions: ReflectQuestion[]
  closing: {
    title: string
    messageAll: string
    messageThanks: string
    certificateButtonLabel: string
    certificateNote: string
  }
  initialAnswers: Record<string, string>
  initiallyComplete: boolean
  stars: { earned: number; goal: number | null; goalName: string | null; max: number }
  compareCards: Record<ReflectOutcome, ReflectCompareCard | null>
  initialOutcome: ReflectOutcome | null
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  const [submitted, setSubmitted] = useState(initiallyComplete)
  const [outcome, setOutcome] = useState<ReflectOutcome | null>(initialOutcome)
  const [earned, setEarned] = useState(stars.earned)
  const [goal, setGoal] = useState<number | null>(stars.goal)
  const [tooShort, setTooShort] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const flow = useFlowFeedback()
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [needsJoin, setNeedsJoin] = useState(false)
  const [policy, setPolicy] = useState<ReflectPolicy | null>(null)
  const [certificate, setCertificate] = useState<ReflectCertificate | null>(null)
  const boxes = useRef<Record<string, HTMLTextAreaElement | null>>({})

  /**
   * ถามเซิร์ฟเวอร์ครั้งเดียวตอนเปิดหน้าว่า ต้องตอบกี่ข้อ ตอบครบตามกติกาแล้วหรือยัง
   * และใบประกาศของคนนี้อยู่สถานะไหน — สามอย่างนี้ props ไม่มีให้ และ client อ่านไฟล์เนื้อหาไม่ได้
   * ยิงไม่ติดก็ไม่เป็นไร หน้าจอยังใช้ค่าตั้งต้นจาก props ได้เหมือนเดิม
   */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetch('/api/reflect', { headers: { accept: 'application/json' } })
        if (!res.ok || !alive) return
        const data = (await res.json()) as {
          policy?: ReflectPolicy
          submitted?: boolean
          certificate?: ReflectCertificate
        }
        if (!alive) return
        if (data.policy) setPolicy(data.policy)
        if (data.certificate) setCertificate(data.certificate)
        if (data.submitted === true) setSubmitted(true)
      } catch {
        // เน็ตสะดุดตอนเปิดหน้า ไม่ต้องขึ้นข้อความรบกวน ผู้เรียนยังพิมพ์และกดส่งได้ปกติ
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  /** ข้อที่ไม่ได้อยู่ในรายการบังคับ = ของแถม ยังไม่รู้กติกาก็ถือว่าบังคับไว้ก่อน */
  function isOptional(questionId: string): boolean {
    return policy !== null && !policy.requiredIds.includes(questionId)
  }

  function setAnswer(question: ReflectQuestion, value: string) {
    const trimmed = value.slice(0, question.maxLength)
    setAnswers((current) => ({ ...current, [question.id]: trimmed }))
    setTooShort((current) => current.filter((id) => id !== question.id))
  }

  function appendPhrase(question: ReflectQuestion, phrase: string) {
    const current = answers[question.id] ?? ''
    const separator = current.trim().length === 0 ? '' : ' '
    setAnswer(question, `${current}${separator}${phrase}`)
    boxes.current[question.id]?.focus()
  }

  /** บันทึกร่างเงียบ ๆ ตอนออกจากช่อง ไม่ต้องกดอะไร ผู้เรียนปิดหน้าไปก็ไม่หาย */
  async function saveDraft(question: ReflectQuestion) {
    const value = answers[question.id] ?? ''
    if (value.trim().length === 0) return
    try {
      const res = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: { [question.id]: value } }),
      })
      if (res.status === 401) {
        setNeedsJoin(true)
        return
      }
      if (res.ok) flow.done(meta.savedMessage)
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ ข้อความยังอยู่ในหน้าจอ ลองพิมพ์ต่อแล้วกดส่งอีกครั้ง')
    }
  }

  async function submit() {
    if (flow.busy) return
    flow.sending('กำลังส่งคำตอบทบทวน รอสักครู่')
    setSystemMessage(null)
    setTooShort([])
    try {
      const res = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers, submit: true }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            message?: string
            tooShort?: { id: string; minLength: number }[]
            missing?: { id: string; order: number; need: number; text: string }[]
            policy?: ReflectPolicy
            certificate?: ReflectCertificate
            earnedStars?: number
            goalStars?: number | null
            outcome?: ReflectOutcome | null
          }
        | null

      if (res.status === 401) {
        setNeedsJoin(true)
        return
      }
      if (res.status === 422) {
        // เซิร์ฟเวอร์บอกมาแล้วว่าขาดข้อไหนและขาดกี่ตัวอักษร เอาข้อความนั้นขึ้นจอตรง ๆ
        if (data?.policy) setPolicy(data.policy)
        const ids = (data?.missing ?? data?.tooShort ?? []).map((t) => t.id)
        setTooShort(ids)
        setSystemMessage(data?.message ?? 'ยังมีข้อที่ต้องตอบในคาบอยู่')
        // ข้อแรกที่ยังขาด เลื่อนไปให้เลย ไม่ต้องให้ผู้เรียนไล่หาเอง
        if (ids[0]) boxes.current[ids[0]]?.focus()
        return
      }
      if (!res.ok || data?.ok !== true) {
        setSystemMessage(data?.message ?? 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }

      if (typeof data.earnedStars === 'number') setEarned(data.earnedStars)
      if (data.goalStars !== undefined) setGoal(data.goalStars)
      if (data.policy) setPolicy(data.policy)
      if (data.certificate) setCertificate(data.certificate)
      setOutcome(data.outcome ?? outcome)
      setSubmitted(true)
      flow.done('ส่งแล้ว')
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ ข้อความที่เขียนไว้ยังอยู่ครบ ลองกดส่งใหม่อีกครั้ง')
    }
  }

  const card = useMemo(
    () => (outcome ? (compareCards[outcome] ?? null) : null),
    [outcome, compareCards],
  )

  if (needsJoin) {
    return <SignInGate message="เข้าห้องด้วยรหัสห้องกับ PIN ก่อน แล้วกลับมาทบทวนต่อได้" />
  }

  /**
   * UX-5 — ทบทวนตัวเองทีละคำถาม จบในจอเดียว
   * ผลหลังส่ง (การ์ดเทียบเป้า + ปิดคาบ) เป็นอีกจอหนึ่ง ไม่ต่อท้ายให้ยาว
   */
  const totalSteps = questions.length
  const safeStep = Math.min(step, Math.max(0, totalSteps - 1))
  const current = questions[safeStep] ?? null
  const currentValue = current ? (answers[current.id] ?? '') : ''
  const currentLen = currentValue.trim().length
  const currentNeed = current ? Math.max(0, current.minLength - currentLen) : 0
  const currentShort = current ? tooShort.includes(current.id) : false
  const onLastStep = safeStep >= totalSteps - 1
  const shortCount = questions.filter(
    (q) => !isOptional(q.id) && (answers[q.id] ?? '').trim().length < q.minLength,
  ).length
  const currentOptional = current ? isOptional(current.id) : false

  if (submitted) {
    return (
      <StudentShell
        className="flex h-full min-h-0 flex-col gap-3"
        footer={
          <AppFooter>
            <div className="flex gap-2">
              <Link
                href="/survey"
                className="btn-base min-h-12 shrink-0 rounded-xl bg-surface-raised px-4 text-label font-bold text-brand-700 ring-2 ring-brand-100 ring-inset"
              >
                ตอบแบบสอบถาม
              </Link>
              <Link href="/result" className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700">
                {closing.certificateButtonLabel}
                <ChevronRightIcon width={22} height={22} aria-hidden />
              </Link>
            </div>
          </AppFooter>
        }
      >
        <StageLine stage="ขั้นที่ 6 · ทบทวนตัวเอง" remain="ส่งแล้ว" />
        <FlowNote
          state={{
            kind: 'done',
            text: 'ส่งคำตอบทบทวนแล้ว ดาวถูกบันทึกเรียบร้อย ขั้นต่อไปดูเกียรติบัตรหรือตอบแบบสอบถามได้เลย',
          }}
        />

        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
          <div className="rounded-2xl bg-quest-50 p-4 ring-1 ring-quest-100 ring-inset">
            <span className="inline-flex w-fit rounded-full bg-quest-600 px-3 py-1 text-label font-bold text-ink-onbrand">
              {card?.badgeLabel ?? NO_DATA}
            </span>
            <h1 className="mt-2 text-title-sm font-extrabold text-balance text-ink">
              {card?.headline ?? NO_DATA}
            </h1>
            <p className="mt-1 line-clamp-3 text-body text-pretty text-ink">
              {card?.message ?? NO_DATA}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-raised p-3 ring-1 ring-line ring-inset">
            <StatBadge kind="star" value={earned} label="ดาวสะสม" size="md" />
            {goal !== null ? (
              <span className="text-body font-bold text-ink">เป้า {goal} ดาว</span>
            ) : null}
            <span className="w-full text-label text-ink-muted">
              {stars.goalName ? `เป้าหมายที่ตั้งเอง ${stars.goalName}` : 'ยังไม่ได้ตั้งเป้าหมาย'}
              {` · เต็ม ${stars.max} ดาว`}
            </span>
          </div>

          {certificate ? (
            <div className="rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-100 ring-inset">
              <p className="flex flex-wrap items-center gap-2 text-label font-bold text-brand-700">
                <span className="inline-flex items-center rounded-full bg-brand-600 px-2.5 py-0.5 text-note text-ink-onbrand">
                  {certificate.statusLabel}
                </span>
                ผ่านแล้ว {certificate.passedCount} จาก {certificate.totalCount} ด้าน
              </p>
              <p className="mt-1 line-clamp-2 text-label text-pretty text-ink">{certificate.message}</p>
            </div>
          ) : null}

          <DomeTip mood="happy">{closing.messageAll}</DomeTip>
        </div>
      </StudentShell>
    )
  }

  return (
    <StudentShell
      className="flex h-full min-h-0 flex-col gap-2.5"
      footer={
        <AppFooter>
          <FlowNote
            state={flow.state}
            idleText={
              systemMessage ??
              (shortCount > 0
                ? `ยังมีอีก ${shortCount} ข้อที่เขียนสั้นไป เขียนเพิ่มอีกนิดแล้วกดส่งได้`
                : 'เขียนครบแล้ว กดส่งได้เลย')
            }
            className="mb-2"
          />
          {onLastStep ? (
            <Button
              variant="success"
              size="lg"
              fullWidth
              onClick={submit}
              loading={flow.busy}
              loadingLabel="กำลังส่งคำตอบ"
              disabled={questions.length === 0 || flow.busy}
            >
              {meta.submitButtonLabel}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setStep((n) => Math.max(0, n - 1))}
                disabled={safeStep === 0}
                className="shrink-0 px-4"
              >
                ย้อน
              </Button>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => {
                  if (current) void saveDraft(current)
                  setStep((n) => Math.min(totalSteps - 1, n + 1))
                }}
                trailingIcon={<ChevronRightIcon width={22} height={22} />}
              >
                ถัดไป
              </Button>
            </div>
          )}
        </AppFooter>
      }
    >
      <StageLine
        stage={`ขั้นที่ 6 · ทบทวนตัวเอง · นาทีที่ ${meta.minuteFrom}–${meta.minuteTo}`}
        remain={totalSteps > 0 ? `${safeStep + 1}/${totalSteps}` : null}
      />

      {questions.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <ClockIcon width={56} height={56} aria-hidden className="text-brand-400" />
          <h1 className="text-title font-extrabold text-balance text-ink">ยังไม่มีคำถามทบทวน</h1>
          <p className="max-w-[22rem] text-body text-pretty text-ink-muted">
            รอครูเปิดขั้นทบทวนตัวเองให้ก่อนนะ พอครูเปิดแล้วคำถามจะขึ้นตรงนี้เอง
          </p>
        </div>
      ) : (
        <>
          <ProgressBar
            className="shrink-0"
            value={safeStep + 1}
            max={totalSteps}
            tone="brand"
            label={`ข้อที่ ${safeStep + 1} จาก ${totalSteps}`}
            hideLabel
            showValue={false}
          />
          <DomeTip mood="greet">{meta.skipNote}</DomeTip>

          {current ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <label htmlFor={current.id} className="shrink-0 text-body-lg font-bold text-pretty text-ink">
                {current.question}
                {currentOptional && policy ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-spark-100 px-2 py-0.5 text-note font-bold text-spark-700">
                    {policy.optionalChipLabel}
                  </span>
                ) : null}
              </label>
              <p className="shrink-0 text-label text-pretty text-ink-muted">
                {currentOptional && policy ? policy.optionalHint : current.helper}
              </p>

              {current.starterPhrases.length > 0 ? (
                <div className="mt-2 flex shrink-0 flex-wrap gap-1.5">
                  {current.starterPhrases.slice(0, 3).map((phrase) => (
                    <Chip
                      key={phrase}
                      tone="brand"
                      size="sm"
                      onSelect={() => appendPhrase(current, phrase)}
                      ariaLabel={`เติมคำเริ่มต้น ${phrase}`}
                    >
                      + {phrase}
                    </Chip>
                  ))}
                </div>
              ) : null}

              <textarea
                id={current.id}
                ref={(el) => {
                  boxes.current[current.id] = el
                }}
                value={currentValue}
                placeholder={current.placeholder}
                maxLength={current.maxLength}
                onChange={(e) => setAnswer(current, e.target.value)}
                onBlur={() => void saveDraft(current)}
                aria-invalid={currentShort || undefined}
                aria-describedby={`${current.id}-count`}
                className={cn(
                  'mt-2 min-h-0 w-full flex-1 resize-none rounded-sm bg-surface-raised px-4 py-3 text-body text-ink',
                  'ring-2 ring-inset outline-none',
                  'placeholder:text-ink-subtle',
                  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
                  currentShort ? 'bg-spark-50 ring-spark-600' : 'ring-line-contrast focus:ring-brand-500',
                )}
              />

              <p
                id={`${current.id}-count`}
                className="mt-1 flex shrink-0 items-center justify-end gap-1 text-label"
              >
                <span className="tabular-nums text-ink-muted">
                  {currentLen}/{current.maxLength}
                </span>
                {currentNeed > 0 && !currentOptional ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-spark-700">
                    <AlertIcon width={16} height={16} aria-hidden />
                    ขออีก {currentNeed} ตัวอักษร
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-quest-700">
                    <CheckIcon width={16} height={16} aria-hidden />
                    ยาวพอแล้ว
                  </span>
                )}
              </p>
            </div>
          ) : null}
        </>
      )}
    </StudentShell>
  )
}

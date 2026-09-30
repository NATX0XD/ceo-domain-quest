'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import { DomeTip, FlowNote, StageLine, useFlowFeedback } from '@/components/flow-feedback-client'
import {
  Button,
  CheckIcon,
  ChevronRightIcon,
  InfoIcon,
  ProgressBar,
  SendIcon,
  cn,
} from '@/components/ui'

/**
 * S-40 แบบสอบถามความพึงพอใจ — **หน้าจอไม่ตัดสินอะไร ส่งไปให้เซิร์ฟเวอร์ตรวจครบ**
 *
 * ⚠️ คำตอบไม่ผูกกับชื่อผู้ตอบ (ฝั่ง DB ไม่มีคอลัมน์ student_id ในตารางคำตอบ)
 *    ข้อความบนหน้าจอต้องบอกเรื่องนี้ให้ชัด เด็กจะได้กล้าตอบตามจริง
 */
export interface SurveyItem {
  id: string
  column: string
  type: string
  text: string
}

export interface SurveyScale {
  min: number
  max: number
  points: { value: number; label: string; emoji: string }[]
}

export function SurveyClient({
  open,
  done,
  reason,
  title,
  note,
  submitLabel,
  deferLabel,
  items,
  scale,
}: {
  open: boolean
  done: boolean
  reason: string | null
  title: string
  note: string
  submitLabel: string
  deferLabel: string
  items: SurveyItem[]
  scale: SurveyScale
}) {
  const scaleItems = items.filter((i) => i.type === 'rating')
  const openItems = items.filter((i) => i.type !== 'rating')

  const [scores, setScores] = useState<Record<string, number>>({})
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(done)
  /** ทีละข้อ: ข้อให้คะแนนก่อน แล้วค่อยข้อเขียนเอง */
  const [step, setStep] = useState(0)
  const flow = useFlowFeedback()

  const answered = scaleItems.filter((i) => scores[i.column] !== undefined).length
  const ready = answered === scaleItems.length
  const totalSteps = scaleItems.length + openItems.length
  const safeStep = Math.min(step, Math.max(0, totalSteps - 1))
  const currentScale = safeStep < scaleItems.length ? scaleItems[safeStep] : null
  const currentOpen = currentScale ? null : (openItems[safeStep - scaleItems.length] ?? null)
  const onLastStep = safeStep >= totalSteps - 1

  async function submit() {
    if (!ready || flow.busy) return
    flow.sending('กำลังส่งแบบสอบถาม รอสักครู่')
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scores,
          likeText: texts.like_text ?? '',
          improveText: texts.improve_text ?? '',
        }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      if (!res.ok || data?.ok !== true) {
        flow.failed(`${data?.message ?? 'ส่งแบบสอบถามไม่สำเร็จ'} — คำตอบยังอยู่ครบ กดส่งใหม่ได้เลย`)
        return
      }
      flow.done('ส่งแล้ว')
      setSent(true)
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ คำตอบยังอยู่ครบ กดส่งใหม่อีกครั้ง')
    }
  }

  /** UX-5 — ทีละข้อ จบในจอเดียว และกดแล้วห้ามเงียบ */
  if (sent) {
    return (
      <StudentShell
        className="flex h-full min-h-0 flex-col gap-3"
        footer={
          <AppFooter>
            <Link href="/result" className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700">
              กลับไปหน้าสรุปของฉัน
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
        }
      >
        <StageLine stage="ความเห็นของเรา" remain="ส่งแล้ว" />
        <FlowNote
          state={{ kind: 'done', text: 'ส่งแบบสอบถามแล้ว ครูเห็นเป็นภาพรวมของทั้งห้อง ไม่รู้ว่าใครตอบอะไร' }}
        />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <span aria-hidden="true" className="grid size-20 place-items-center rounded-full bg-quest-100 text-quest-700">
            <CheckIcon width={44} height={44} />
          </span>
          <h1 className="text-title font-extrabold text-balance text-ink">ขอบคุณที่ตอบนะ</h1>
          <p className="max-w-[22rem] text-body text-pretty text-ink-muted">{note}</p>
        </div>
      </StudentShell>
    )
  }

  /* ครูยังไม่เปิด — บอกว่าทำไมว่าง รออะไร และระหว่างรอทำอะไรได้ */
  if (!open) {
    return (
      <StudentShell
        className="flex h-full min-h-0 flex-col gap-3"
        footer={
          <AppFooter>
            <Link href="/result" className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700">
              กลับไปหน้าสรุปของฉัน
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
        }
      >
        <StageLine stage="ความเห็นของเรา" remain="ยังไม่เปิด" />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <InfoIcon width={56} height={56} aria-hidden className="text-brand-400" />
          <h1 className="text-title font-extrabold text-balance text-ink">ครูยังไม่ได้เปิดแบบสอบถาม</h1>
          <p className="max-w-[22rem] text-body text-pretty text-ink-muted">
            {reason ?? 'ถ้าอยากตอบให้บอกครูเปิดให้ หรือกลับมาตอบทีหลังก็ได้'}
          </p>
          <DomeTip mood="greet">
            ระหว่างรอ กลับไปดูสรุปของเราหรือดูผลงานเพื่อนก่อนก็ได้ครับ พอครูเปิดแล้วหน้านี้จะตอบได้ทันที
          </DomeTip>
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
              onLastStep
                ? ready
                  ? 'ให้คะแนนครบแล้ว กดส่งได้เลย'
                  : `ยังเหลืออีก ${scaleItems.length - answered} ข้อที่ยังไม่ได้ให้คะแนน`
                : null
            }
            className="mb-2"
          />
          {onLastStep ? (
            <div className="flex gap-2">
              <Link
                href="/result"
                className="btn-base min-h-12 shrink-0 rounded-xl bg-surface-raised px-4 text-label font-bold text-brand-700 ring-2 ring-brand-100 ring-inset"
              >
                {deferLabel}
              </Link>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={submit}
                disabled={!ready || flow.busy}
                loading={flow.busy}
                loadingLabel="กำลังส่ง"
                leadingIcon={<SendIcon width={22} height={22} />}
              >
                {submitLabel}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setStep((n) => Math.max(0, n - 1))}
                disabled={step === 0}
                className="shrink-0 px-4"
              >
                ย้อน
              </Button>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setStep((n) => Math.min(totalSteps - 1, n + 1))}
                trailingIcon={<ChevronRightIcon width={22} height={22} />}
              >
                ถัดไป
              </Button>
            </div>
          )}
        </AppFooter>
      }
    >
      <StageLine stage={title} remain={`${step + 1}/${totalSteps}`} />
      <ProgressBar
        className="shrink-0"
        value={step + 1}
        max={totalSteps}
        tone="brand"
        label={`ข้อที่ ${step + 1} จาก ${totalSteps}`}
        hideLabel
        showValue={false}
      />
      <DomeTip mood="greet">
        ตอบตามที่รู้สึกจริงได้เลยครับ ครูไม่รู้ว่าใครตอบอะไร เห็นแค่ภาพรวมของทั้งห้อง
      </DomeTip>

      {currentScale ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <h2 className="shrink-0 text-body-lg font-bold text-pretty text-ink">
            {currentScale.text}
          </h2>
          <div
            role="radiogroup"
            aria-label={currentScale.text}
            className="flex min-h-0 flex-1 flex-col justify-center gap-2"
          >
            {scale.points.map((point) => {
              const selected = scores[currentScale.column] === point.value
              return (
                <button
                  key={point.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${point.value} ${point.label}`}
                  onClick={() => setScores((s) => ({ ...s, [currentScale.column]: point.value }))}
                  className={cn(
                    'btn-base min-h-12 w-full justify-start gap-3 rounded-xl px-4 text-body font-bold ring-2 ring-inset focus-ring',
                    selected
                      ? 'bg-brand-600 text-ink-onbrand ring-brand-700'
                      : 'bg-surface-raised text-ink ring-line-contrast hover:bg-brand-50',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full text-label font-extrabold',
                      selected ? 'bg-surface-raised text-brand-700' : 'bg-surface-sunken text-ink-muted',
                    )}
                  >
                    {point.value}
                  </span>
                  <span className="min-w-0 flex-1 text-left">{point.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : currentOpen ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <label htmlFor={currentOpen.id} className="shrink-0 text-body font-bold text-pretty text-ink">
            {currentOpen.text} (ไม่บังคับ)
          </label>
          <textarea
            id={currentOpen.id}
            maxLength={500}
            value={texts[currentOpen.column] ?? ''}
            onChange={(e) => setTexts((t) => ({ ...t, [currentOpen.column]: e.target.value }))}
            className="mt-2 min-h-0 w-full flex-1 resize-none rounded-sm bg-surface-raised p-3 text-body text-ink ring-2 ring-line-contrast ring-inset outline-none placeholder:text-ink-subtle focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus focus:ring-brand-500"
          />
        </div>
      ) : null}
    </StudentShell>
  )
}

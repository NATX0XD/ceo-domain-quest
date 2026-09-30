'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import { QuizStepper } from '@/components/quiz-stepper-client'
import { DomeTip, FlowNote, StageLine, useFlowFeedback } from '@/components/flow-feedback-client'
import {
  Button,
  ChevronRightIcon,
  LightbulbIcon,
  ProgressBar,
  SendIcon,
  cn,
} from '@/components/ui'

/**
 * S-05 เช็กความเข้าใจ 4 ข้อ — **หน้าจอไม่รู้เฉลย**
 *
 * ⚠️ ไม่ใช่ข้อสอบ ไม่มีคะแนนเก็บ ใช้เสนอระดับตัวช่วยเท่านั้น ต้องเขียนบอกเด็กให้ชัด
 * ⚠️ ห้าม import core/quiz หรือไฟล์เฉลยที่นี่ · ส่งไปตรวจที่ POST /api/check
 * ช่องความมั่นใจเป็นวัตถุดิบของธง "ควรคุย" บนแผงครู (มั่นใจมากแต่ตอบยังไม่ถูก)
 */
export interface CheckQuestionView {
  id: string
  question: string
  choices: string[]
  topic: string
}

interface CheckResultView {
  score: number
  total: number
  suggestedLevel: 1 | 2 | 3
  levelReason: string
}

export function CheckClient({
  questions,
  intro,
  title,
  confidenceLevels,
  initialResult,
}: {
  questions: CheckQuestionView[]
  intro: string
  title: string
  /** ระดับความมั่นใจจาก content/self-profile.json */
  confidenceLevels: { value: number; label: string }[]
  initialResult: CheckResultView | null
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [result, setResult] = useState<CheckResultView | null>(initialResult)
  const [index, setIndex] = useState(0)
  /** "กดปุ่มแล้วห้ามเงียบ" — กำลังส่ง / สำเร็จแล้วเกิดอะไรต่อ / พลาดเพราะอะไรและแก้ยังไง */
  const flow = useFlowFeedback()

  const answered = questions.filter((q) => answers[q.id] !== undefined).length
  const ready = answered === questions.length
  const currentQuestion = questions[Math.min(index, questions.length - 1)] ?? null

  async function submit() {
    if (!ready || flow.busy) return
    flow.sending('กำลังส่งคำตอบให้ระบบตรวจ รอสักครู่')
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers, confidence }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            score?: number
            total?: number
            suggestedLevel?: 1 | 2 | 3
            levelReason?: string
            message?: string
          }
        | null
      if (!res.ok || data?.ok !== true) {
        // กฎข้อ 3: พลาดต้องบอกเหตุผล + ทางแก้ ไม่ใช่ "ผิดพลาด" ลอย ๆ
        flow.failed(
          `${data?.message ?? 'ส่งคำตอบไม่สำเร็จ'} — คำตอบที่เลือกไว้ยังอยู่ครบ กดส่งอีกครั้งได้เลย`,
        )
        return
      }
      flow.done('ส่งคำตอบแล้ว')
      setResult({
        score: data.score ?? 0,
        total: data.total ?? questions.length,
        suggestedLevel: data.suggestedLevel ?? 1,
        levelReason: data.levelReason ?? '',
      })
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ คำตอบที่เลือกไว้ยังอยู่ครบ ลองกดส่งใหม่อีกครั้ง')
    }
  }

  /**
   * UX-5 — จบในจอเดียว ถามทีละข้อ และ "กดปุ่มแล้วห้ามเงียบ"
   * ผลลัพธ์ก็เป็นจอเดียว บอกชัดว่าเกิดอะไรขึ้นต่อจากนี้
   */
  if (result) {
    return (
      <StudentShell
        className="flex h-full min-h-0 flex-col gap-3"
        footer={
          <AppFooter>
            <Link
              href="/profile"
              className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
            >
              ไปยืนยันหรือเปลี่ยนระดับเอง
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
        }
      >
        <StageLine stage={title} remain="เสร็จแล้ว" />

        {/* กฎข้อ 3: สำเร็จแล้วต้องบอกด้วยว่าเกิดอะไรต่อ ไม่ใช่แค่ว่าสำเร็จ */}
        <FlowNote
          state={{ kind: 'done', text: 'บันทึกคำตอบแล้ว ขั้นต่อไปคือไปยืนยันระดับตัวช่วยที่หน้ารู้จักตัวเอง' }}
        />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <p className="text-label font-semibold text-ink-muted">ตอบตรงแนว</p>
          <p className="text-hero font-extrabold tabular-nums text-brand-700">
            {result.score}
            <span className="text-title text-ink-subtle"> / {result.total}</span>
          </p>
          <ProgressBar
            className="w-full"
            value={result.score}
            max={result.total}
            tone="brand"
            label={`ตอบตรงแนว ${result.score} จาก ${result.total} ข้อ`}
            hideLabel
            showValue={false}
          />
          <p className="text-center text-body text-pretty text-ink">
            ระบบเสนอระดับตัวช่วยที่ {result.suggestedLevel}
            {result.levelReason ? ` ${result.levelReason}` : ''}
          </p>
        </div>

        <p className="flex shrink-0 items-start justify-center gap-1.5 text-center text-label text-pretty text-ink-muted">
          <LightbulbIcon width={18} height={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>ผลนี้ไม่ใช่คะแนนเก็บ และเปลี่ยนระดับเองได้ทุกเมื่อ</span>
        </p>
      </StudentShell>
    )
  }

  return (
    <StudentShell
      className="flex h-full min-h-0 flex-col gap-2.5"
      footer={
        <AppFooter>
          {/* กฎข้อ 3 + 6: บอกสถานะทุกครั้ง และบอกล่วงหน้าว่าทำไมปุ่มยังกดไม่ได้ */}
          <FlowNote
            state={flow.state}
            idleText={ready ? 'ตอบครบแล้ว กดส่งได้เลย' : `ยังเหลืออีก ${questions.length - answered} ข้อถึงจะส่งได้`}
            className="mb-2"
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={submit}
            disabled={!ready || flow.busy}
            loading={flow.busy}
            loadingLabel="กำลังส่งคำตอบ"
            leadingIcon={<SendIcon width={22} height={22} />}
          >
            {ready ? 'ส่งคำตอบ' : `ตอบแล้ว ${answered} จาก ${questions.length} ข้อ`}
          </Button>
        </AppFooter>
      }
    >
      <StageLine stage={title} remain={`${questions.length} ข้อ`} />

      {/* บรรทัดเดียวบอกว่าตอนนี้ต้องทำอะไร — ข้อความมาจากไฟล์เนื้อหา ไม่ได้พิมพ์เอง */}
      <DomeTip mood="greet">{intro}</DomeTip>

      <QuizStepper
        questions={questions}
        answers={answers}
        onAnswer={(id, i) => setAnswers((a) => ({ ...a, [id]: i }))}
        index={index}
        onIndexChange={setIndex}
        confidenceSlot={
          currentQuestion ? (
            <fieldset className="shrink-0">
              <legend className="sr-only">มั่นใจแค่ไหนกับข้อนี้</legend>
              <div className="flex gap-1.5">
                {confidenceLevels.map((level) => {
                  const on = confidence[currentQuestion.id] === level.value
                  return (
                    <button
                      key={level.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`ความมั่นใจข้อนี้ ${level.label}`}
                      onClick={() =>
                        setConfidence((c) => ({ ...c, [currentQuestion.id]: level.value }))
                      }
                      className={cn(
                        'btn-base min-h-11 flex-1 rounded-xl px-1 text-note font-bold ring-1 ring-inset focus-ring',
                        on
                          ? 'bg-brand-600 text-ink-onbrand ring-brand-700'
                          : 'bg-surface-raised text-ink-muted ring-line',
                      )}
                    >
                      <span className="min-w-0 truncate">{level.label}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ) : null
        }
      />
    </StudentShell>
  )
}

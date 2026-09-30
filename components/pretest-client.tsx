'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StudentShell } from '@/components/student-shell'
import { AppFooter } from '@/components/app-shell'
import { QuizStepper } from '@/components/quiz-stepper-client'
import { DomeTip, FlowNote, StageLine, useFlowFeedback } from '@/components/flow-feedback-client'
import {
  Button,
  ChevronRightIcon,
  ClockIcon,
  LightbulbIcon,
  ProgressBar,
  SendIcon,
} from '@/components/ui'

/**
 * แบบทดสอบก่อนเรียน 4 ข้อ — **หน้าจอไม่รู้เฉลย**
 *
 * ⚠️ ห้าม import core/quiz หรือ content/quiz-answers.json ที่นี่
 *    ส่งคำตอบไปตรวจที่ POST /api/pretest แล้วรับกลับแค่คะแนนรวมกับหัวข้อที่ควรเน้น
 */
export interface PretestQuestion {
  id: string
  question: string
  choices: string[]
}

interface PretestResult {
  score: number
  total: number
  suggestedLevel: 1 | 2 | 3
  levelReason: string
  weakTopics: string[]
}

export function PretestClient({
  questions,
  objectives,
  initialResult,
  open = true,
  closedReason = null,
}: {
  questions: PretestQuestion[]
  /** รหัสวัตถุประสงค์ -> ชื่อสั้น ใช้แปลงผลที่เซิร์ฟเวอร์ส่งกลับให้เป็นภาษาคน */
  objectives: Record<string, string>
  initialResult: PretestResult | null
  /** ครูกดเปิดแล้วหรือยัง (T-12) — เซิร์ฟเวอร์ตัดสิน หน้านี้แค่แสดงผล */
  open?: boolean
  closedReason?: string | null
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<PretestResult | null>(initialResult)
  const [index, setIndex] = useState(0)
  /** กดปุ่มแล้วห้ามเงียบ — กำลังส่ง / สำเร็จแล้วเกิดอะไรต่อ / พลาดเพราะอะไรและแก้ยังไง */
  const flow = useFlowFeedback()

  const answered = questions.filter((q) => answers[q.id] !== undefined).length
  const ready = answered === questions.length

  async function submit() {
    if (!ready || flow.busy) return
    flow.sending('กำลังส่งคำตอบให้ระบบตรวจ รอสักครู่')
    try {
      const res = await fetch('/api/pretest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            score?: number
            total?: number
            suggestedLevel?: 1 | 2 | 3
            levelReason?: string
            weakObjectives?: string[]
            message?: string
          }
        | null
      if (!res.ok || !data || typeof data.score !== 'number') {
        flow.failed(
          `${data?.message ?? 'ส่งคำตอบไม่สำเร็จ'} — คำตอบที่เลือกไว้ยังอยู่ครบ กดส่งอีกครั้งได้เลย`,
        )
        return
      }
      flow.done('ส่งคำตอบแล้ว')
      setResult({
        score: data.score,
        total: data.total ?? questions.length,
        suggestedLevel: data.suggestedLevel ?? 1,
        levelReason: data.levelReason ?? '',
        weakTopics: (data.weakObjectives ?? []).map((id) => objectives[id] ?? id),
      })
      router.refresh()
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ คำตอบที่เลือกไว้ยังอยู่ครบ ลองกดส่งใหม่อีกครั้ง')
    }
  }

  /** UX-5 — จบในจอเดียว ถามทีละข้อ และกดปุ่มแล้วห้ามเงียบ */
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
        <StageLine stage="ก่อนคาบเรียน · แบบทดสอบก่อนเรียน" remain="ส่งแล้ว" />
        <FlowNote
          state={{
            kind: 'done',
            text: 'ส่งคำตอบแล้ว ครูเห็นผลของทั้งห้องแล้ว ขั้นต่อไปคือไปยืนยันระดับตัวช่วยของเรา',
          }}
        />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
          <p className="text-label font-semibold text-ink-muted">คะแนนก่อนเรียน</p>
          <p className="text-hero font-extrabold tabular-nums text-brand-700">
            {result.score}
            <span className="text-title text-ink-subtle"> / {result.total}</span>
          </p>
          <ProgressBar
            className="w-full"
            value={result.score}
            max={result.total}
            tone="brand"
            label={`คะแนนก่อนเรียน ${result.score} จาก ${result.total} ข้อ`}
            hideLabel
            showValue={false}
          />
          <p className="text-center text-body text-pretty text-ink">
            ระบบเสนอระดับตัวช่วยที่ {result.suggestedLevel}
            {result.levelReason ? ` ${result.levelReason}` : ''}
          </p>
          {result.weakTopics.length > 0 ? (
            <ul className="flex flex-wrap justify-center gap-1.5">
              {result.weakTopics.slice(0, 4).map((t) => (
                <li
                  key={t}
                  className="inline-flex min-h-8 items-center rounded-full bg-spark-100 px-3 text-label font-bold text-spark-700"
                >
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="flex shrink-0 items-start justify-center gap-1.5 text-center text-label text-pretty text-ink-muted">
          <LightbulbIcon width={18} height={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>คะแนนนี้ไม่ใช่คะแนนเก็บ ใช้เทียบกับหลังเรียนว่าเราเข้าใจขึ้นแค่ไหน</span>
        </p>
      </StudentShell>
    )
  }

  /* ครูยังไม่กดเปิด — จอว่างต้องบอกว่าทำไมว่างและต้องทำอะไรถึงจะมีของ */
  if (!open) {
    return (
      <StudentShell
        className="flex h-full min-h-0 flex-col gap-3"
        footer={
          <AppFooter>
            <Link
              href="/home"
              className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
            >
              กลับไปหน้าหลัก
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
        }
      >
        <StageLine stage="ก่อนคาบเรียน · แบบทดสอบก่อนเรียน" remain="ยังไม่เปิด" />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <ClockIcon width={56} height={56} aria-hidden className="text-brand-400" />
          <h1 className="text-title font-extrabold text-balance text-ink">รอครูกดเปิดก่อน</h1>
          <p className="max-w-[22rem] text-body text-pretty text-ink-muted">
            {closedReason ?? 'ครูจะกดเปิดให้ทั้งห้องพร้อมกันก่อนเริ่มคาบ'}
          </p>
          {/* ตอนรอ ต้องบอกว่ารออะไร และระหว่างรอทำอะไรได้ */}
          <DomeTip mood="greet">
            ระหว่างรอ กลับไปหน้าหลักแล้วดูแผนภารกิจของวันนี้ก่อนก็ได้ครับ พอครูกดเปิด หน้านี้จะใช้ได้ทันที
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
              ready
                ? 'ตอบครบทุกข้อแล้ว กดส่งได้เลย ส่งแล้วแก้ไม่ได้'
                : `ยังเหลืออีก ${questions.length - answered} ข้อถึงจะส่งได้`
            }
            className="mb-2"
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={submit}
            disabled={!ready || flow.busy}
            loading={flow.busy}
            loadingLabel="กำลังตรวจคำตอบ"
            leadingIcon={ready && !flow.busy ? <SendIcon width={22} height={22} /> : undefined}
          >
            {ready ? 'ส่งคำตอบ' : `ตอบแล้ว ${answered}/${questions.length} ข้อ`}
          </Button>
        </AppFooter>
      }
    >
      <StageLine stage="ก่อนคาบเรียน · แบบทดสอบก่อนเรียน" remain={`${questions.length} ข้อ`} />
      <DomeTip mood="greet">
        ตอบเท่าที่รู้ได้เลยครับ ไม่รู้ก็เดาได้ ไม่มีผลกับคะแนนเก็บ ใช้เทียบกับหลังเรียนเฉย ๆ
      </DomeTip>

      <QuizStepper
        questions={questions}
        answers={answers}
        onAnswer={(id, i) => setAnswers((a) => ({ ...a, [id]: i }))}
        index={index}
        onIndexChange={setIndex}
      />
    </StudentShell>
  )
}

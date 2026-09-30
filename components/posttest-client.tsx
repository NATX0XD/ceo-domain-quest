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
  ClockIcon,
  ProgressBar,
  SendIcon,
} from '@/components/ui'

/**
 * แบบทดสอบหลังเรียน 10 ข้อ — **หน้าจอไม่รู้เฉลย**
 *
 * ⚠️ ห้าม import core/quiz หรือ content/quiz-answers.json ที่นี่
 *    ส่งคำตอบไปตรวจที่ POST /api/posttest แล้วรับกลับแค่คะแนนรวม (ไม่มีรายข้อที่ผิด)
 * ⚠️ ครูเป็นคนกดเปิด เซิร์ฟเวอร์เป็นคนตัดสินว่าเปิดหรือยัง หน้านี้แค่แสดงผล
 */
export interface PosttestQuestion {
  id: string
  question: string
  choices: string[]
}

interface PosttestResult {
  score: number
  total: number
  preScore: number | null
  gain: number | null
}

export function PosttestClient({
  open,
  reason,
  questions,
  total,
  initialResult,
}: {
  open: boolean
  reason: string | null
  questions: PosttestQuestion[]
  total: number
  initialResult: PosttestResult | null
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<PosttestResult | null>(initialResult)
  const [index, setIndex] = useState(0)
  /** กดปุ่มแล้วห้ามเงียบ */
  const flow = useFlowFeedback()

  const answered = questions.filter((q) => answers[q.id] !== undefined).length
  const ready = questions.length > 0 && answered === questions.length

  async function submit() {
    if (!ready || flow.busy) return
    flow.sending('กำลังส่งคำตอบให้ระบบตรวจ รอสักครู่')
    try {
      const res = await fetch('/api/posttest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            score?: number
            total?: number
            preScore?: number | null
            gain?: number | null
            message?: string
          }
        | null

      if (!res.ok || data?.ok !== true) {
        flow.failed(
          `${data?.message ?? 'ส่งคำตอบไม่สำเร็จ'} — คำตอบที่เลือกไว้ยังอยู่ครบ กดส่งอีกครั้งได้เลย`,
        )
        return
      }
      flow.done('ส่งคำตอบแล้ว')
      setResult({
        score: data.score ?? 0,
        total: data.total ?? total,
        preScore: data.preScore ?? null,
        gain: data.gain ?? null,
      })
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ คำตอบที่เลือกไว้ยังอยู่ครบ ลองกดส่งใหม่อีกครั้ง')
    }
  }

  /* ทำแล้ว — เห็นคะแนนของตัวเอง เทียบกับก่อนเรียน (ไม่เทียบกับเพื่อน) */
  if (result) {
    return (
      <StudentShell
        className="flex h-full min-h-0 flex-col gap-3"
        footer={
          <AppFooter>
            <Link
              href="/result"
              className="btn-quest bg-brand-600 text-ink-onbrand hover:bg-brand-700"
            >
              กลับไปหน้าสรุปของฉัน
              <ChevronRightIcon width={22} height={22} aria-hidden />
            </Link>
          </AppFooter>
        }
      >
        <StageLine stage="หลังคาบเรียน · แบบทดสอบหลังเรียน" remain="ส่งแล้ว" />
        <FlowNote
          state={{
            kind: 'done',
            text: 'ส่งคำตอบแล้ว บันทึกเรียบร้อย ขั้นต่อไปดูสรุปของเราได้ที่หน้าสรุป',
          }}
        />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
          <p className="text-label font-semibold text-ink-muted">คะแนนหลังเรียน</p>
          <p className="text-hero font-extrabold tabular-nums text-brand-700">
            {result.score}
            <span className="text-title text-ink-subtle"> / {result.total}</span>
          </p>
          <ProgressBar
            className="w-full"
            value={result.score}
            max={result.total}
            tone="brand"
            label={`คะแนนหลังเรียน ${result.score} จาก ${result.total} ข้อ`}
            hideLabel
            showValue={false}
          />
          {result.preScore !== null ? (
            <p className="text-center text-body text-pretty text-ink">
              ก่อนเรียนได้ {result.preScore} · หลังเรียนได้ {result.score}
              {result.gain !== null && result.gain > 0 ? ` · ขึ้นมา ${result.gain} ข้อ` : ''}
            </p>
          ) : null}
        </div>

        <p className="shrink-0 text-center text-label text-pretty text-ink-muted">
          คะแนนนี้เป็นของเราคนเดียว ไม่ได้เอาไปเรียงลำดับกับเพื่อน
        </p>
      </StudentShell>
    )
  }

  /* ครูยังไม่กดเปิด — บอกว่าทำไมว่าง ต้องรออะไร และระหว่างรอทำอะไรได้ */
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
        <StageLine stage="หลังคาบเรียน · แบบทดสอบหลังเรียน" remain="ยังไม่เปิด" />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <ClockIcon width={56} height={56} aria-hidden className="text-brand-400" />
          <h1 className="text-title font-extrabold text-balance text-ink">รอครูกดเปิดก่อน</h1>
          <p className="max-w-[22rem] text-body text-pretty text-ink-muted">
            {reason ?? 'ครูจะกดเปิดให้ทั้งห้องพร้อมกันหลังจบคาบ'}
          </p>
          <DomeTip mood="greet">
            ระหว่างรอ ไปทบทวนตัวเองหรืออ่านคลังความรู้ก่อนก็ได้ครับ พอครูกดเปิด หน้านี้จะใช้ได้ทันที
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
            loadingLabel="กำลังส่งคำตอบ"
            leadingIcon={<SendIcon width={22} height={22} />}
          >
            {ready ? 'ส่งคำตอบ' : `ตอบแล้ว ${answered} จาก ${questions.length} ข้อ`}
          </Button>
        </AppFooter>
      }
    >
      <StageLine stage="หลังคาบเรียน · แบบทดสอบหลังเรียน" remain={`${questions.length} ข้อ`} />
      <DomeTip mood={ready ? 'happy' : 'greet'}>
        {ready
          ? 'ครบทุกข้อแล้วครับ กดส่งได้เลย ส่งแล้วแก้ไม่ได้นะ'
          : 'ค่อย ๆ อ่านนะครับ ข้อไหนไม่แน่ใจให้เลือกข้อที่ใกล้เคียงที่สุด'}
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

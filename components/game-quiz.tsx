'use client'

import { useState } from 'react'
import { GameFrame } from '@/components/game-frame'
import { FlowNote, useFlowFeedback } from '@/components/flow-feedback-client'
import { ChevronRightIcon, SendIcon } from '@/components/ui'

/**
 * ทำแบบทดสอบทีละข้อในธีมเกม — ใช้ร่วมกันของ /pretest และ /posttest
 * ⚠️ ไม่รู้เฉลย ไม่ตัดสินถูกผิด · ส่งคำตอบทั้งชุดผ่าน onSubmit แล้วให้หน้าที่เรียกจัดการผลลัพธ์
 * ตัวนับข้อมีที่เดียว (ป้ายไม้) · ปุ่มนำทางมีคู่เดียวที่ท้ายจอ
 */
export interface GameQuizQuestion {
  id: string
  question: string
  choices: string[]
}

const MARKERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

export function GameQuiz({
  title,
  backHref,
  questions,
  say,
  submitLabel = 'ส่งคำตอบ',
  onSubmit,
  onBack,
}: {
  title: string
  backHref?: string | null
  questions: GameQuizQuestion[]
  say: string
  submitLabel?: string
  /** คืนข้อความผิดพลาดเมื่อส่งไม่สำเร็จ · คืน null เมื่อสำเร็จ (หน้าที่เรียกเปลี่ยนจอเอง) */
  onSubmit: (answers: Record<string, number>) => Promise<string | null>
  onBack?: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [index, setIndex] = useState(0)
  const flow = useFlowFeedback()

  const total = questions.length
  const safe = Math.min(index, Math.max(0, total - 1))
  const current = questions[safe]
  const answered = questions.filter((q) => answers[q.id] !== undefined).length
  const last = safe === total - 1
  const canNext = current !== undefined && answers[current.id] !== undefined
  const canSubmit = last && answered === total

  async function submit() {
    if (!canSubmit || flow.busy) return
    flow.sending('กำลังส่งคำตอบ')
    const error = await onSubmit(answers)
    if (error) flow.failed(error)
    else flow.done('ส่งแล้ว')
  }

  if (!current) return null

  return (
    <GameFrame
      title={title}
      backHref={backHref}
      onBack={onBack}
      count={`${safe + 1}/${total}`}
      mood="think"
      say={say}
      footer={
        <>
          {safe > 0 ? (
            <button
              type="button"
              onClick={() => setIndex(safe - 1)}
              className="gf-btn-side focus-ring"
              aria-label="ข้อก่อนหน้า"
            >
              ย้อน
            </button>
          ) : null}
          {last ? (
            <button
              type="button"
              className="btn-go focus-ring"
              onClick={submit}
              disabled={!canSubmit || flow.busy}
            >
              <SendIcon aria-hidden width={22} height={22} />
              {flow.busy ? 'กำลังส่ง' : submitLabel}
            </button>
          ) : (
            <button
              type="button"
              className="btn-go focus-ring"
              onClick={() => setIndex(safe + 1)}
              disabled={!canNext}
            >
              ถัดไป
              <ChevronRightIcon aria-hidden width={22} height={22} />
            </button>
          )}
        </>
      }
    >
      <section className="gf-panel flex min-h-0 flex-1 flex-col gap-3 p-4" aria-label={`ข้อ ${safe + 1}`}>
        <h2 className="gf-question shrink-0 text-pretty">{current.question}</h2>
        <div
          role="radiogroup"
          aria-label={`ตัวเลือกของข้อ ${safe + 1}`}
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pb-1"
        >
          {current.choices.map((choice, i) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={answers[current.id] === i}
              onClick={() => setAnswers((a) => ({ ...a, [current.id]: i }))}
              className="gf-pick focus-ring"
            >
              <span className="gf-pick-mark" aria-hidden="true">
                {MARKERS[i] ?? i + 1}
              </span>
              <span className="min-w-0 flex-1 text-pretty">{choice}</span>
            </button>
          ))}
        </div>
        <FlowNote state={flow.state} />
      </section>
    </GameFrame>
  )
}

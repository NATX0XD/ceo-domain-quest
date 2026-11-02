'use client'

import { useEffect, useId, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/components/ui'
import { Bubble, ChatFrame, QuickChip } from './app/chat-reader'
import { Shake, TypingDots } from './app/fx'
import { DOME_REPLY_FIXED } from './learn-reply-api'

export interface LearnQuestion {
  id: string
  prompt: string
  placeholder?: string
}

/**
 * โดมถามคำถามปลายเปิดเป็นแชต ทีละข้อ (โหมดดูและอ่านใช้ร่วมกัน)
 *  - ข้อที่ตอบแล้วขึ้นเป็นบับเบิลของผู้เรียน ตามด้วยโดมรับคำตอบ แล้วขึ้นข้อต่อไป
 *  - onlyId = โหมดตอบเสริม แสดงเฉพาะข้อที่ยังขาด
 * ผลคะแนนรายข้อไม่แสดงตรงนี้ (อยู่ที่หน้าผลของ learn-path-result)
 */
export function LearnQuestions({
  mode,
  questions,
  answers,
  onChange,
  qIdx,
  onlyId,
  onReview,
  disabled,
  grading = false,
  shakeKey = 0,
  domeNote = null,
  replies = {},
  pendingId = null,
}: {
  mode: 'watch' | 'read'
  questions: LearnQuestion[]
  answers: Record<string, string>
  onChange: (id: string, value: string) => void
  qIdx: number
  onlyId?: string | null
  onReview?: () => void
  disabled: boolean
  grading?: boolean
  shakeKey?: number
  /** คำตอบกลับจริงของโดม (AI) สำหรับข้อที่ตอบเสริม null = ใช้ข้อความเดิม */
  domeNote?: string | null
  /** คำตอบกลับรายข้อของโดม (AI หรือข้อความเดิม) ตามรหัสข้อ ไม่มี = ข้อความเดิม */
  replies?: Record<string, string>
  /** ข้อที่เพิ่งตอบและโดมกำลังพิมพ์ตอบกลับ — ซ่อนช่องตอบจนกว่าโดมตอบเสร็จ (ไม่เกินงบเวลา) */
  pendingId?: string | null
}) {
  const baseId = useId()
  const reduce = useReducedMotion()
  const endRef = useRef<HTMLDivElement>(null)
  // ข้อใหม่ขึ้นมา = เลื่อนให้เห็นคำถามกับช่องตอบเสมอ
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' })
  }, [qIdx, onlyId, reduce, pendingId, replies])
  const intro =
    mode === 'watch'
      ? 'ดูเรื่องของมีนจบแล้วนะครับ ลองตอบตามความเข้าใจของตัวเอง 2 ข้อ ไม่ต้องตอบเหมือนในคลิปก็ได้ครับ'
      : 'มาเริ่มข้อแรกกันเลยครับ ตอบสั้น ๆ ตามที่เข้าใจได้เลย'
  const shown = onlyId ? questions.filter((q) => q.id === onlyId) : questions.slice(0, qIdx + 1)
  // ตอบเสริม = นับข้อที่กำลังแสดงจริง (qIdx ตอนนั้นชี้ท้ายชุดแล้ว)
  const onlyIdx = onlyId ? questions.findIndex((q) => q.id === onlyId) : -1
  const shownNo = onlyIdx >= 0 ? onlyIdx + 1 : Math.min(qIdx + 1, questions.length)

  return (
    <ChatFrame title="คุยกับโดม" subtitle={onlyIdx >= 0 ? `ตอบเสริมข้อ ${shownNo} จาก ${questions.length} · ตอบด้วยคำของตัวเอง` : `คำถาม ${shownNo} จาก ${questions.length} · ตอบด้วยคำของตัวเอง`}>
      <ol className="flex flex-1 flex-col gap-2.5 px-3 py-4">
        {!onlyId ? (
          <Bubble name="โดม" side="left" tone="dome">
            {intro}
          </Bubble>
        ) : domeNote ? (
          <Bubble name="โดม" side="left" tone="dome">
            {domeNote} เติมต่อจากคำตอบเดิมได้เลยครับ
          </Bubble>
        ) : (
          <Bubble name="โดม" side="left" tone="dome">
            เติมเฉพาะข้อนี้อีกนิดก็พอครับ ไม่ต้องตอบทั้งสองข้อใหม่ เติมต่อจากคำตอบเดิมได้เลย
          </Bubble>
        )}
        {shown.map((q) => {
          const idx = questions.findIndex((x) => x.id === q.id)
          const current = onlyId ? true : idx === qIdx && q.id !== pendingId
          return (
            <div key={q.id} className="contents">
              <Bubble name="โดม" side="left" tone="dome">
                ข้อ {idx + 1}. {q.prompt}
              </Bubble>
              {!current && answers[q.id]?.trim() ? (
                <>
                  <Bubble side="right" tone="me" animate={false}>
                    {answers[q.id]}
                  </Bubble>
                  {q.id === pendingId ? (
                    <li className="flex flex-col items-start self-start">
                      <span className="px-1 pb-0.5 text-label font-extrabold text-[#6b4a2c]">โดม</span>
                      <div className="rounded-[20px] bg-white px-4 py-3 shadow-soft-1 ring-1 ring-brand-100">
                        <TypingDots />
                      </div>
                    </li>
                  ) : (
                    <Bubble name="โดม" side="left" tone="dome">
                      {replies[q.id] ?? DOME_REPLY_FIXED[mode]}
                    </Bubble>
                  )}
                </>
              ) : null}
            </div>
          )
        })}
      </ol>
      {grading ? (
        <div className="flex items-center gap-2 border-t border-brand-100 bg-brand-50 px-4 py-3 text-label font-bold text-brand-700" role="status" aria-live="polite">
          <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-brand-500" />
          โดมกำลังอ่านคำตอบ…
        </div>
      ) : null}
      {(() => {
        const q = onlyId ? questions.find((x) => x.id === onlyId) : questions[qIdx]
        if (!q || q.id === pendingId) return null
        return (
          <Shake trigger={shakeKey} className="flex flex-col gap-2 border-t-2 border-[#e6cfa6] bg-[#fff6e4] px-3 py-3">
            <label htmlFor={`${baseId}-${q.id}`} className="sr-only">
              ข้อ {questions.findIndex((x) => x.id === q.id) + 1}. {q.prompt}
            </label>
            <textarea
              id={`${baseId}-${q.id}`}
              rows={3}
              placeholder={q.placeholder ?? 'พิมพ์คำตอบของเรา'}
              value={answers[q.id] ?? ''}
              maxLength={1000}
              disabled={disabled}
              onChange={(e) => onChange(q.id, e.target.value)}
              className={cn(
                'min-h-24 w-full resize-none rounded-2xl bg-white px-4 py-3 text-body text-ink',
                'ring-2 ring-inset ring-[#d9b98a] outline-none transition-[box-shadow] duration-200',
                'placeholder:text-ink-subtle focus:ring-[#f18b20]',
                'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
                'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
              )}
            />
            {onReview ? (
              <div className="flex">
                <QuickChip onClick={onReview}>{mode === 'watch' ? 'ย้อนดูคลิป' : 'ย้อนอ่านแชต'}</QuickChip>
              </div>
            ) : null}
          </Shake>
        )
      })()}
      <div ref={endRef} aria-hidden />
    </ChatFrame>
  )
}

'use client'

import { useId } from 'react'
import { cn } from '@/components/ui'
import { Bubble, ChatFrame, QuickChip } from './app/chat-reader'
import { Shake } from './app/fx'

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
  shakeKey = 0,
}: {
  mode: 'watch' | 'read'
  questions: LearnQuestion[]
  answers: Record<string, string>
  onChange: (id: string, value: string) => void
  qIdx: number
  onlyId?: string | null
  onReview?: () => void
  disabled: boolean
  shakeKey?: number
}) {
  const baseId = useId()
  const intro =
    mode === 'watch'
      ? 'ดูเรื่องของมีนจบแล้วนะครับ ลองตอบตามความเข้าใจของตัวเอง 2 ข้อ ไม่ต้องตอบเหมือนในคลิปก็ได้ครับ'
      : 'อ่านเรื่องของมีนกับฟ้าจบแล้วนะครับ ลองตอบตามความเข้าใจของตัวเอง 2 ข้อ ไม่ต้องตอบเหมือนข้อความในแชตก็ได้ครับ'
  const shown = onlyId ? questions.filter((q) => q.id === onlyId) : questions.slice(0, qIdx + 1)

  return (
    <ChatFrame title="โดม" subtitle="กำลังรอคำตอบของเรา">
      <ol className="flex flex-1 flex-col gap-2.5 px-3 py-4">
        {!onlyId ? (
          <Bubble name="โดม" side="left" tone="dome">
            {intro}
          </Bubble>
        ) : (
          <Bubble name="โดม" side="left" tone="dome">
            เติมเฉพาะข้อนี้อีกนิดก็พอครับ ไม่ต้องตอบทั้งสองข้อใหม่ เติมต่อจากคำตอบเดิมได้เลย
          </Bubble>
        )}
        {shown.map((q) => {
          const idx = questions.findIndex((x) => x.id === q.id)
          const current = onlyId ? true : idx === qIdx
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
                  <Bubble name="โดม" side="left" tone="dome">
                    โดมได้รับคำตอบแล้วครับ ไปคำถามต่อไปกันเลย
                  </Bubble>
                </>
              ) : null}
            </div>
          )
        })}
      </ol>
      {(() => {
        const q = onlyId ? questions.find((x) => x.id === onlyId) : questions[qIdx]
        if (!q) return null
        return (
          <Shake trigger={shakeKey} className="flex flex-col gap-2 border-t border-brand-100 bg-white/80 px-3 py-3">
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
                'ring-2 ring-inset ring-brand-200 outline-none transition-[box-shadow] duration-200',
                'placeholder:text-ink-subtle focus:ring-brand-500',
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
    </ChatFrame>
  )
}

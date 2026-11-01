'use client'

import type { ReactNode } from 'react'
import { ChoiceCard, ChevronRightIcon, ProgressBar, cn } from '@/components/ui'

/**
 * UX-5 ถามทีละข้อ — ใช้ร่วมกันทั้งเช็กความพร้อม แบบทดสอบก่อนเรียน และแบบทดสอบหลังเรียน
 *
 * **ทำไมต้องมี**: เดิมยัดคำถาม 4-10 ข้อลงจอเดียวแล้วให้ไถ ซึ่งขัดคำสั่งเจ้าของ ("ห้ามเลื่อนเลย")
 * และทำให้เด็กไม่รู้ว่าเหลืออีกกี่ข้อ ตอนนี้ทีละข้อพร้อมตัวบอก "ข้อ N จาก M"
 *
 * เกณฑ์ที่ยึด (สกิล ui-ux-pro-max หมวด Accessibility + Touch & Interaction):
 *  - ตัวเลือกเป็น `role="radio"` ใน `role="radiogroup"` ที่มีชื่อ — ไม่ใช่ div เปล่า
 *  - พื้นที่แตะทุกปุ่ม >= 44 จุดภาพ และเว้นห่างกัน >= 8 (gap-2)
 *  - ปุ่มย้อน/ถัดไปมีชื่อสำหรับโปรแกรมอ่านหน้าจอ และปิดการใช้งานอย่างชัดเจนเมื่อสุดทาง
 *  - ความคืบหน้าประกาศผ่าน `aria-live` ตอนเปลี่ยนข้อ ไม่ใช่เปลี่ยนเงียบ ๆ
 *  - สีไม่ใช่ตัวบอกสถานะตัวเดียว — ข้อที่ตอบแล้วมีเครื่องหมายถูกกำกับด้วย
 *
 * ⚠️ ไฟล์นี้ไม่รู้จักเฉลย ไม่ตัดสินถูกผิด และไม่ยิง API เลย เป็นตัวเดินหน้าจออย่างเดียว
 */

export interface StepQuestion {
  id: string
  question: string
  choices: string[]
  /** หัวข้อสั้น ๆ ของข้อนั้น (ถ้าไฟล์เนื้อหามี) */
  topic?: string
}

/** ตัวอักษรนำหน้าตัวเลือก — ครูอ้างถึงข้อได้ตอนพูดหน้าห้อง */
const CHOICE_MARKERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

export interface QuizStepperProps {
  questions: StepQuestion[]
  /** คำตอบที่เลือกไว้ รหัสข้อ -> ลำดับตัวเลือก */
  answers: Record<string, number>
  onAnswer: (questionId: string, choiceIndex: number) => void
  index: number
  onIndexChange: (next: number) => void
  /** แถวความมั่นใจใต้ตัวเลือก (หน้าเช็กความพร้อมใช้) — ไม่ส่งมาก็ไม่แสดง */
  confidenceSlot?: ReactNode
  /** ใช้เมื่อ parent เป็นเจ้าของ progress เดียวของ flow เพื่อไม่ให้ตัวชี้วัดซ้ำ */
  compactProgress?: boolean
  className?: string
}

export function QuizStepper({
  questions,
  answers,
  onAnswer,
  index,
  onIndexChange,
  confidenceSlot,
  compactProgress = false,
  className,
}: QuizStepperProps) {
  const total = questions.length
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, total - 1))
  const current = questions[safeIndex]
  /**
   * ข้อเยอะเกินกว่าจะเรียงปุ่มกระโดดให้ได้ 44 จุดภาพในจอ 390
   * คิดจากที่จริง: ปุ่มย้อน+ถัดไปกินราว 160px เหลือให้จุดราว 195px
   * จุดละ 44 + ช่องไฟ 4 = 4 จุดก็เต็มพอดี · เกินกว่านั้นจุดจะทับปุ่ม (เจอจริงตอนวัดหน้า /profile ที่มี 5 ข้อ)
   */
  const compact = total > 3

  if (!current) return null

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-2.5', className)}>
      {/* ตัวบอกว่าอยู่ข้อไหนจากทั้งหมด — ตัวเลขคู่กับแถบ ไม่ได้ใช้สีอย่างเดียว */}
      <div className="shrink-0">
        <p aria-live="polite" className="mb-1.5 text-label font-bold text-brand-700">
          ข้อ {safeIndex + 1} จาก {total}
          {!compactProgress && current.topic ? ` · ${current.topic}` : ''}
        </p>
        <ProgressBar
          value={safeIndex + 1}
          max={total}
          tone="brand"
          label={`ข้อที่ ${safeIndex + 1} จาก ${total}`}
          hideLabel
          showValue={false}
        />
      </div>

      <h2 className="shrink-0 text-body-lg font-bold text-pretty text-ink">{current.question}</h2>

      <ul
        role="radiogroup"
        aria-label={`ตัวเลือกของข้อ ${safeIndex + 1}`}
        className={cn(
          'min-h-0 flex-1 gap-2 overflow-y-auto overscroll-contain pr-0.5',
          'flex flex-col',
        )}
      >
        {current.choices.map((choice, i) => (
            <li key={choice} className="min-w-0">
            <ChoiceCard
              marker={CHOICE_MARKERS[i] ?? String(i + 1)}
              label={choice}
              selected={answers[current.id] === i}
              ariaLabel={`ตัวเลือก ${CHOICE_MARKERS[i] ?? i + 1} ${choice}`}
              onSelect={() => onAnswer(current.id, i)}
              className="quiz-choice min-h-14 p-2.5"
            />
          </li>
        ))}
      </ul>

      {confidenceSlot}

      {/* เดินหน้า-ถอยหลังทีละข้อ · จุดบอกข้อที่ตอบแล้วเป็นทางลัดกระโดดข้าม */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onIndexChange(safeIndex - 1)}
          disabled={safeIndex === 0}
          aria-label="ข้อก่อนหน้า"
          className="btn-base min-h-11 shrink-0 rounded-xl bg-surface-raised px-4 text-label font-bold text-ink ring-1 ring-line ring-inset disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
        >
          ย้อน
        </button>

        {/**
          * ข้อเยอะ (แบบทดสอบ 10 ข้อ) เอาปุ่มกระโดดมาเรียงไม่ได้ — 10 ปุ่ม x 44 = 440px เกินจอ 390
          * และถ้าย่อให้เล็กลงก็ผิดเกณฑ์พื้นที่แตะ 44 จุดภาพ
          * จึงเปลี่ยนเป็นจุดบอกตำแหน่งที่แตะไม่ได้ (อ่านอย่างเดียว) แล้วเดินด้วยปุ่มย้อน/ถัดไปแทน
          */}
        {compactProgress ? (
          <span className="min-w-0 flex-1" aria-hidden="true" />
        ) : compact ? (
          <ol aria-hidden="true" className="flex min-w-0 flex-1 justify-center gap-1">
            {questions.map((q, i) => {
              const done = answers[q.id] !== undefined
              const here = i === safeIndex
              return (
                <li
                  key={q.id}
                  className={cn(
                    'size-2.5 rounded-full',
                    here ? 'bg-brand-600' : done ? 'bg-quest-500' : 'bg-line-contrast',
                  )}
                />
              )
            })}
          </ol>
        ) : (
          <ol className="flex min-w-0 flex-1 justify-center gap-1">
            {questions.map((q, i) => {
              const done = answers[q.id] !== undefined
              const here = i === safeIndex
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onIndexChange(i)}
                    aria-label={`ไปข้อที่ ${i + 1}${done ? ' (ตอบแล้ว)' : ' (ยังไม่ได้ตอบ)'}`}
                    aria-current={here ? 'step' : undefined}
                    className={cn(
                      'grid size-11 place-items-center rounded-full text-note font-bold focus-ring',
                      here
                        ? 'bg-brand-600 text-ink-onbrand'
                        : done
                          ? 'bg-quest-100 text-quest-700 ring-1 ring-quest-600 ring-inset'
                          : 'bg-surface-sunken text-ink-muted ring-1 ring-line ring-inset',
                    )}
                  >
                    {i + 1}
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        <button
          type="button"
          onClick={() => onIndexChange(safeIndex + 1)}
          disabled={safeIndex >= total - 1}
          aria-label="ข้อถัดไป"
          className="btn-base min-h-11 shrink-0 gap-1 rounded-xl bg-surface-raised px-4 text-label font-bold text-ink ring-1 ring-line ring-inset disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
        >
          ถัดไป
          <ChevronRightIcon width={18} height={18} aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** ข้อแรกที่ยังไม่ได้ตอบ — ใช้พาเด็กไปที่ข้อที่ค้างแทนที่จะบอกลอย ๆ ว่ายังไม่ครบ */
export function firstUnanswered(
  questions: StepQuestion[],
  answers: Record<string, number>,
): number {
  const i = questions.findIndex((q) => answers[q.id] === undefined)
  return i < 0 ? 0 : i
}

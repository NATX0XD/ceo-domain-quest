import type { ReactNode } from 'react'
import { cn } from './cn'
import { CheckIcon, AlertIcon, LockIcon } from './icons'

/**
 * การ์ดตัวเลือกที่กดเลือกได้ — ใช้กับคำถามปรนัย การเลือกนามสกุลโดเมน
 * และรายการ "ฉันอยากทำอะไร" ในหน้าคุยกับโดม
 *
 * ทำไมเป็น `<button aria-pressed>` ไม่ใช่ `<input type=radio>`:
 * การ์ดพวกนี้กดสลับเลือก/ไม่เลือกได้อิสระและบางจอเลือกได้หลายอัน
 * ถ้าต้องการพฤติกรรมแบบวิทยุจริง ๆ (เลือกได้อันเดียวใน group) ให้ผู้เรียก
 * ครอบด้วย `role="radiogroup"` แล้วส่ง `selected` มาให้ถูกตัวเดียว
 *
 * สถานะ correct/wrong ไม่ได้บอกด้วยสีอย่างเดียว — มีไอคอนและข้อความอ่านออกเสียงคู่เสมอ
 */

export type ChoiceState = 'idle' | 'correct' | 'wrong' | 'locked'

export type ChoiceCardProps = {
  /** ข้อความตัวเลือก */
  label: ReactNode
  /** คำอธิบายเพิ่มใต้ตัวเลือก เช่น เหตุผลตอนเฉลย */
  description?: ReactNode
  /** ตัวอักษร/ตัวเลขนำหน้า เช่น "ก" "1" — ช่วยให้ครูอ้างถึงข้อได้ตอนพูดหน้าห้อง */
  marker?: string
  /** ไอคอนนำหน้าแทน marker */
  icon?: ReactNode
  selected?: boolean
  state?: ChoiceState
  disabled?: boolean
  onSelect?: () => void
  /** ข้อความอ่านออกเสียงแทน label เมื่อ label ไม่ใช่ข้อความล้วน */
  ariaLabel?: string
  className?: string
}

const STATE_CLASS: Record<ChoiceState, string> = {
  idle: 'bg-surface-raised ring-line',
  correct: 'bg-quest-50 ring-quest-500',
  wrong: 'bg-danger-100 ring-danger-600',
  locked: 'bg-surface-sunken ring-line',
}

const STATE_SPOKEN: Record<ChoiceState, string> = {
  idle: '',
  correct: ' — ตอบถูก',
  wrong: ' — ตอบผิด',
  locked: ' — ยังเลือกไม่ได้',
}

export function ChoiceCard({
  label,
  description,
  marker,
  icon,
  selected = false,
  state = 'idle',
  disabled = false,
  onSelect,
  ariaLabel,
  className,
}: ChoiceCardProps) {
  const isLocked = state === 'locked' || disabled
  const spokenBase = ariaLabel ?? (typeof label === 'string' ? label : undefined)

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isLocked}
      aria-pressed={selected}
      aria-label={spokenBase ? `${spokenBase}${STATE_SPOKEN[state]}` : undefined}
      className={cn(
        'flex w-full min-h-14 cursor-pointer items-center gap-3 rounded-xl p-4 text-left',
        'ring-2 ring-inset shadow-soft-1',
        'transition-[background-color,box-shadow,transform] duration-200 ease-[var(--ease-soft)]',
        'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
        'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70',
        STATE_CLASS[state],
        selected && state === 'idle' && 'bg-brand-50 ring-brand-500 shadow-soft-2',
        className,
      )}
    >
      {marker || icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-full text-body-lg font-bold',
            selected && state === 'idle'
              ? 'bg-brand-600 text-ink-onbrand'
              : state === 'correct'
                ? 'bg-quest-600 text-ink-onbrand'
                : state === 'wrong'
                  ? 'bg-danger-600 text-ink-onbrand'
                  : 'bg-surface-sunken text-ink-muted',
          )}
        >
          {icon ?? marker}
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold text-pretty text-ink">{label}</span>
        {description ? (
          <span className="mt-1 block text-label text-ink-muted">{description}</span>
        ) : null}
      </span>

      <span aria-hidden="true" className="shrink-0">
        {state === 'correct' ? (
          <CheckIcon className="text-quest-700" width={24} height={24} />
        ) : state === 'wrong' ? (
          <AlertIcon className="text-danger-700" width={24} height={24} />
        ) : state === 'locked' ? (
          <LockIcon className="text-ink-subtle" width={24} height={24} />
        ) : (
          <span
            className={cn(
              'grid size-6 place-items-center rounded-full ring-2 ring-inset',
              selected ? 'bg-brand-600 ring-brand-600' : 'ring-line-contrast',
            )}
          >
            {selected ? <CheckIcon className="text-ink-onbrand" width={16} height={16} /> : null}
          </span>
        )}
      </span>
    </button>
  )
}

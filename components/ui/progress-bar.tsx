import { cn } from './cn'

/**
 * แถบความคืบหน้า — "ร้านของฉันสร้างไปกี่เปอร์เซ็นต์แล้ว"
 *
 * ตัวเลขเปอร์เซ็นต์แสดงเป็นข้อความคู่กับแถบเสมอ เพราะสีอย่างเดียวไม่พอ
 * สำหรับนักเรียนที่ตาบอดสี (WCAG 1.4.1 ห้ามใช้สีเป็นตัวสื่อความหมายอย่างเดียว)
 */

type ProgressTone = 'quest' | 'brand' | 'spark'
type ProgressSize = 'sm' | 'md' | 'lg'

const TONE_CLASS: Record<ProgressTone, string> = {
  quest: 'bg-quest-500',
  brand: 'bg-brand-500',
  spark: 'bg-spark-500',
}

const SIZE_CLASS: Record<ProgressSize, string> = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
}

export type ProgressBarProps = {
  /** ค่าปัจจุบัน */
  value: number
  /** ค่าสูงสุด (ค่าเริ่มต้น 100) */
  max?: number
  /** ป้ายกำกับว่านี่คือความคืบหน้าของอะไร — จำเป็นเสมอเพื่อให้อ่านออกเสียงได้ */
  label: string
  /** ซ่อนป้ายทางสายตา (ยังอ่านออกเสียงได้) เมื่อบริบทรอบข้างบอกอยู่แล้ว */
  hideLabel?: boolean
  /** แสดงตัวเลขเปอร์เซ็นต์ท้ายแถบ */
  showValue?: boolean
  tone?: ProgressTone
  size?: ProgressSize
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  label,
  hideLabel = false,
  showValue = true,
  tone = 'quest',
  size = 'md',
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const percent = Math.round((clamped / safeMax) * 100)

  return (
    <div className={cn('w-full', className)}>
      {hideLabel && !showValue ? null : (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className={cn('text-label font-semibold text-ink', hideLabel && 'sr-only')}>
            {label}
          </span>
          {showValue ? (
            <span aria-hidden="true" className="text-label font-bold tabular-nums text-ink-muted">
              {percent}%
            </span>
          ) : null}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={`${percent} เปอร์เซ็นต์`}
        className={cn(
          'w-full overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line ring-inset',
          SIZE_CLASS[size],
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-[var(--ease-soft)] motion-reduce:transition-none',
            TONE_CLASS[tone],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

import { cn } from './cn'
import { StarIcon } from './icons'

/**
 * ป้ายตัวเลขสถานะ — ดาวที่เก็บได้ / เปอร์เซ็นต์ความคืบหน้า / จำนวนอะไรก็ได้
 *
 * ทุกแบบมี `aria-label` เป็นประโยคเต็มภาษาไทย เพราะถ้าปล่อยให้อ่านแค่ตัวเลข
 * โปรแกรมอ่านหน้าจอจะพูดว่า "3 5" ซึ่งไม่มีความหมาย
 */

type StatBadgeSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<StatBadgeSize, string> = {
  sm: 'min-h-8 gap-1 px-2.5 text-label',
  md: 'min-h-10 gap-1.5 px-3 text-body',
  lg: 'min-h-12 gap-2 px-4 text-body-lg',
}

const STAR_SIZE: Record<StatBadgeSize, number> = { sm: 16, md: 20, lg: 24 }

type StarBadge = {
  kind: 'star'
  /** จำนวนดาวที่ได้แล้ว */
  value: number
  /** จำนวนดาวทั้งหมดที่เป็นไปได้ — ถ้าไม่ใส่ จะแสดงเป็นยอดสะสมแทนการวาดดาวเรียง */
  max?: number
}

type PercentBadge = {
  kind: 'percent'
  /** 0–100 */
  value: number
  max?: never
}

type CountBadge = {
  kind: 'count'
  value: number | string
  max?: never
}

export type StatBadgeProps = (StarBadge | PercentBadge | CountBadge) & {
  /** คำอธิบายว่าตัวเลขนี้คืออะไร เช่น "ดาวสะสม" — ใช้ทั้งแสดงผลและอ่านออกเสียง */
  label: string
  /** ซ่อนข้อความ label ทางสายตา แต่ยังอ่านออกเสียงได้ */
  hideLabel?: boolean
  size?: StatBadgeSize
  className?: string
}

export function StatBadge({
  kind,
  value,
  max,
  label,
  hideLabel = false,
  size = 'md',
  className,
}: StatBadgeProps) {
  const tone =
    kind === 'star'
      ? 'bg-reward-100 text-reward-700 ring-reward-300'
      : kind === 'percent'
        ? 'bg-quest-100 text-quest-700 ring-quest-200'
        : 'bg-brand-100 text-brand-700 ring-brand-200'

  const spoken =
    kind === 'star'
      ? max != null
        ? `${label} ${value} จาก ${max} ดาว`
        : `${label} ${value} ดาว`
      : kind === 'percent'
        ? `${label} ${value} เปอร์เซ็นต์`
        : `${label} ${value}`

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold ring-1 ring-inset',
        SIZE_CLASS[size],
        tone,
        className,
      )}
      role="img"
      aria-label={spoken}
    >
      {kind === 'star' && max != null && max <= 5 ? (
        <span aria-hidden="true" className="flex items-center gap-0.5">
          {Array.from({ length: max }, (_, i) => (
            <StarIcon
              key={i}
              filled={i < value}
              width={STAR_SIZE[size]}
              height={STAR_SIZE[size]}
            />
          ))}
        </span>
      ) : (
        <>
          {kind === 'star' ? (
            <StarIcon aria-hidden width={STAR_SIZE[size]} height={STAR_SIZE[size]} />
          ) : null}
          <span aria-hidden="true" className="tabular-nums">
            {kind === 'percent' ? `${value}%` : value}
            {kind === 'star' && max != null ? `/${max}` : null}
          </span>
        </>
      )}
      {hideLabel ? null : (
        <span aria-hidden="true" className="font-semibold opacity-90">
          {label}
        </span>
      )}
    </span>
  )
}

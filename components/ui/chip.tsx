'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from './cn'
import { GripIcon } from './icons'

/**
 * ชิป — ชิ้นส่วนที่ลากไปวางได้ ใช้กับภารกิจ "ลากชิ้นส่วนไปวางในตำแหน่งที่เหมาะสม"
 * (www. / kanom / .com) และใช้เป็นแท็กแบบกดเลือกได้ด้วย
 *
 * a11y ของการลากวาง: HTML drag-and-drop ใช้เมาส์อย่างเดียว นิ้วกับคีย์บอร์ดใช้ไม่ได้
 * ชิปนี้จึงรองรับ 3 ทาง — ลากด้วยเมาส์, แตะเพื่อเลือกแล้วแตะช่องปลายทาง,
 * และกด Enter/Space เพื่อ "หยิบ" ด้วยคีย์บอร์ด ทุกทางยิง `onSelect` ตัวเดียวกัน
 * หน้าที่เรียกใช้ต้องรองรับโหมด "เลือกแล้ววาง" เสมอ ห้ามพึ่ง onDragStart อย่างเดียว
 */

type ChipTone = 'brand' | 'quest' | 'spark' | 'neutral'
type ChipSize = 'sm' | 'md'

const TONE_CLASS: Record<ChipTone, { idle: string; selected: string }> = {
  brand: {
    idle: 'bg-brand-100 text-brand-700 ring-brand-200',
    selected: 'bg-brand-600 text-ink-onbrand ring-brand-700',
  },
  quest: {
    idle: 'bg-quest-100 text-quest-700 ring-quest-200',
    selected: 'bg-quest-600 text-ink-onbrand ring-quest-700',
  },
  spark: {
    idle: 'bg-spark-100 text-spark-700 ring-spark-200',
    selected: 'bg-spark-600 text-ink-onbrand ring-spark-700',
  },
  neutral: {
    idle: 'bg-surface-sunken text-ink-muted ring-line-contrast',
    selected: 'bg-ink text-ink-onbrand ring-ink',
  },
}

const SIZE_CLASS: Record<ChipSize, string> = {
  sm: 'min-h-11 gap-1.5 px-3 text-label',
  md: 'min-h-12 gap-2 px-4 text-body',
}

export type ChipProps = {
  children: ReactNode
  tone?: ChipTone
  size?: ChipSize
  selected?: boolean
  disabled?: boolean
  /** เปิดการลากด้วยเมาส์ และแสดงจุดจับ */
  draggable?: boolean
  /** ค่าที่จะถูกส่งไปกับ dataTransfer ตอนเริ่มลาก */
  dragValue?: string
  /** ยิงเมื่อกด/แตะ/กด Enter — คือทางเลือกแทนการลากสำหรับคีย์บอร์ดและนิ้ว */
  onSelect?: () => void
  /** ข้อความอ่านออกเสียงแทนเนื้อหาชิป เมื่อ children ไม่ใช่ข้อความล้วน */
  ariaLabel?: string
  className?: string
}

export function Chip({
  children,
  tone = 'brand',
  size = 'md',
  selected = false,
  disabled = false,
  draggable = false,
  dragValue,
  onSelect,
  ariaLabel,
  className,
}: ChipProps) {
  const palette = TONE_CLASS[tone]

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // ปุ่ม <button> ยิง click จาก Enter/Space อยู่แล้ว ดักไว้เพื่อกันหน้าเลื่อนตอนกด Space
    if (event.key === ' ') {
      event.preventDefault()
      onSelect?.()
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
      aria-roledescription={draggable ? 'ชิปที่ลากวางได้' : undefined}
      draggable={draggable && !disabled}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      onDragStart={
        draggable
          ? (event) => {
              if (dragValue) event.dataTransfer.setData('text/plain', dragValue)
              event.dataTransfer.effectAllowed = 'move'
            }
          : undefined
      }
      className={cn(
        'game-chip inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-bold',
        'ring-2 ring-inset shadow-soft-1 select-none',
        'transition-[background-color,color,box-shadow,transform] duration-200 ease-[var(--ease-soft)]',
        'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
        'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
        draggable && 'cursor-grab active:cursor-grabbing',
        SIZE_CLASS[size],
        selected ? palette.selected : palette.idle,
        className,
      )}
    >
      {draggable ? <GripIcon width={16} height={16} className="opacity-60" /> : null}
      {children}
    </button>
  )
}

export type ChipSlotProps = {
  /** ชิปที่ถูกวางแล้ว — ถ้าไม่มีจะแสดงเป็นช่องว่างประ */
  children?: ReactNode
  /** ป้ายบอกว่าช่องนี้คืออะไร เช่น "ช่องชื่อโดเมน" */
  label: string
  /** ยิงเมื่อมีชิปถูกลากมาวาง หรือเมื่อผู้ใช้แตะช่องนี้หลังเลือกชิปไว้แล้ว */
  onDropValue?: (value: string) => void
  /** ช่องนี้กำลังรอรับของอยู่ — ใช้ตอนผู้ใช้เลือกชิปไว้แล้ว */
  active?: boolean
  state?: 'idle' | 'correct' | 'wrong'
  className?: string
}

/** ช่องปลายทางสำหรับวางชิป */
export function ChipSlot({
  children,
  label,
  onDropValue,
  active = false,
  state = 'idle',
  className,
}: ChipSlotProps) {
  const filled = children != null

  return (
    <button
      type="button"
      aria-label={filled ? label : `${label} (ว่าง)`}
      onClick={() => onDropValue?.('')}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDropValue?.(event.dataTransfer.getData('text/plain'))
      }}
      className={cn(
        'inline-flex min-h-12 min-w-24 cursor-pointer items-center justify-center rounded-full px-4',
        'text-body font-bold ring-2 ring-inset transition-colors duration-200',
        'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus',
        state === 'correct'
          ? 'bg-quest-50 text-quest-700 ring-quest-500'
          : state === 'wrong'
            ? 'bg-danger-100 text-danger-700 ring-danger-600'
            : filled
              ? 'bg-surface-raised text-ink ring-brand-300'
              : 'bg-surface-sunken text-ink-subtle ring-line-contrast ring-dashed',
        active && state === 'idle' && 'bg-brand-50 ring-brand-500',
        className,
      )}
    >
      {children ?? <span aria-hidden="true">วางที่นี่</span>}
    </button>
  )
}

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export type GameButtonVariant =
  | 'primary'
  | 'secondary'
  | 'orange'
  | 'green'
  | 'blue'
  | 'purple'
  | 'cream'
  | 'red'
  | 'grey'
  | 'home'

export type GameButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GameButtonVariant
}

/** ปุ่มหลักของโลกเกม: มีขอบแสง เงาลึก และสถานะ disabled ที่ยังอ่านว่าเป็นปุ่มเกม */
export function GameButton({ variant = 'primary', className, ...props }: GameButtonProps) {
  const skin = variant === 'primary' ? 'orange' : variant === 'secondary' ? 'cream' : variant
  return <button className={cn('game-button', `game-button--${skin}`, className)} {...props} />
}

export function DomeBoardFrame({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('dome-board-frame', className)} {...props}>
      <div className="dome-board-frame__content">{children}</div>
    </div>
  )
}

export function WoodSign({ title, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { title: ReactNode }) {
  return (
    <div className={cn('wood-sign', className)} {...props}>
      <span className="wood-sign__rope" aria-hidden="true" />
      <h1 className="wood-sign__title">{title}</h1>
      {children ? <div className="wood-sign__detail">{children}</div> : null}
    </div>
  )
}

export function CreamCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('cream-card', className)} {...props} />
}

export function ThemedPage({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('themed-page', className)} {...props} />
}

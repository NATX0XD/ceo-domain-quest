import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export type GameButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

/** ปุ่มหลักของโลกเกม: มีขอบแสง เงาลึก และสถานะ disabled ที่ยังอ่านว่าเป็นปุ่มเกม */
export function GameButton({ variant = 'primary', className, ...props }: GameButtonProps) {
  return <button className={cn('game-button', `game-button--${variant}`, className)} {...props} />
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

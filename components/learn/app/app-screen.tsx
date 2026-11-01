'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeftIcon, StarIcon, cn } from '@/components/ui'
import { SessionClock } from '@/components/session-clock'
import { BottomSheet } from './bottom-sheet'
import { CountUp } from './fx'
import type { LearnTheme } from './theme'

export interface MenuItem {
  key: string
  label: string
  hint?: string
  icon?: ReactNode
  onSelect: () => void
}

/**
 * โครงจอแบบแอป: h-dvh ไม่เลื่อนทั้งหน้า · แถบบน 56px · เนื้อหากลางเลื่อนเฉพาะกล่อง · dock ล่างติดจอ
 * พื้นหลังเป็นภาพของด่าน (ไฟล์ยังไม่มี = ไล่สีสำรอง)
 */
export function AppScreen({
  theme,
  title,
  onBack,
  score,
  stage,
  stageCount,
  menu,
  dock,
  flush = false,
  children,
}: {
  theme: LearnTheme
  title: string
  onBack?: () => void
  score?: number
  stage: number
  stageCount: number
  menu: MenuItem[]
  dock?: ReactNode
  /** true = เนื้อหาเต็มขอบ (เกมที่ดูแลระยะขอบเอง) */
  flush?: boolean
  children: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const style: CSSProperties = { backgroundImage: theme.fallback }
  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex h-dvh w-full flex-col overflow-hidden',
        theme.id === 'm2' && 'm2-shell',
      )}
      style={style}
      data-theme-id={theme.id}
    >
      {imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element -- พื้นหลังสถิตจาก public และต้องมี fallback เมื่อไฟล์ยังไม่มี
        <img
          src={theme.bg}
          alt=""
          aria-hidden
          draggable={false}
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full scale-110 object-cover"
          style={{ filter: theme.blur }}
        />
      ) : null}
      <div className="absolute inset-0" style={{ background: theme.veil }} aria-hidden />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header
          className={cn('relative flex h-14 shrink-0 items-center gap-1.5 px-2 backdrop-blur-md', theme.barText)}
          style={{ background: theme.bar }}
        >
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="ย้อนกลับ"
              className="flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 focus-ring"
            >
              <ArrowLeftIcon width={24} height={24} aria-hidden />
            </button>
          ) : (
            <span className="w-3" />
          )}
          <h1 className="min-w-0 flex-1 overflow-hidden text-base leading-[1.2] font-bold text-balance [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {title}
          </h1>
          <SessionClock variant="pill" />
          <div
            className="flex shrink-0 items-center"
            aria-label={`ขั้นที่ ${stage + 1} จาก ${stageCount}${score ? ` ได้ ${score} คะแนน` : ''}`}
          >
            {/* แถบขั้นย้ายไปเป็นเส้นบางที่ขอบล่างของแถบบน ให้ชื่อด่านมีที่พอไม่ตัดกลางคำ */}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex h-1 gap-0.5" aria-hidden>
              {Array.from({ length: stageCount }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-full flex-1 transition-colors duration-300',
                    i === stage ? 'bg-brand-500' : i < stage ? 'bg-quest-500' : 'bg-current opacity-20',
                  )}
                />
              ))}
            </span>
            {score ? (
              <span className="flex items-center gap-1 rounded-full bg-reward-100 px-2 py-0.5 text-label font-extrabold whitespace-nowrap text-reward-700 tabular-nums">
                <StarIcon width={16} height={16} aria-hidden />
                <CountUp value={score} />
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="เมนู"
            aria-haspopup="dialog"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 focus-ring"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </header>

        <main
          className={cn(
            'relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain',
            !flush && 'px-4 py-4',
          )}
        >
          {children}
        </main>

        {dock ? (
          <footer
            className="shrink-0 border-t border-white/40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
            style={{
              background: theme.dark ? 'rgba(18, 12, 36, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            }}
          >
            <div className="mx-auto w-full max-w-md">{dock}</div>
          </footer>
        ) : null}
      </div>

      <BottomSheet open={menuOpen} title="เมนู" onClose={() => setMenuOpen(false)}>
        {menu.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMenuOpen(false)
              m.onSelect()
            }}
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-sunken px-4 text-left transition-transform active:scale-[.97] focus-ring"
          >
            {m.icon ? <span className="text-brand-700">{m.icon}</span> : null}
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-ink">{m.label}</span>
              {m.hint ? <span className="block text-label text-ink-muted">{m.hint}</span> : null}
            </span>
          </button>
        ))}
      </BottomSheet>
    </div>
  )
}

/** การ์ดแก้วโปร่งแสงลอยบนพื้นหลังภาพ */
export function GlassCard({ className, dark, children }: { className?: string; dark?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[24px] p-5 shadow-soft-2 ring-1 backdrop-blur-xl',
        dark ? 'bg-[#1b1236]/95 text-white ring-white/15' : 'bg-white/95 text-ink ring-white/70',
        className,
      )}
    >
      {children}
    </div>
  )
}

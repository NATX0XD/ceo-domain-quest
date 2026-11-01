import Link from 'next/link'
import type { ReactNode } from 'react'
import { GameFrame } from '@/components/game-frame'
import { ChevronRightIcon, type DomeMood } from '@/components/ui'

/** จอสรุปคะแนนสั้น ๆ ในธีมเกม: คะแนนใหญ่ + ป้ายเล็กไม่เกิน 3 อัน + ปุ่มเดียว */
export function GameScore({
  title,
  backHref,
  mood = 'celebrate',
  say,
  label,
  score,
  total,
  chips,
  ctaHref,
  ctaLabel,
}: {
  title: string
  backHref?: string | null
  mood?: DomeMood
  say: string
  label: string
  score: number
  total: number
  chips?: ReactNode[]
  ctaHref: string
  ctaLabel: string
}) {
  return (
    <GameFrame
      title={title}
      backHref={backHref}
      mood={mood}
      say={say}
      footer={
        <Link href={ctaHref} className="btn-go focus-ring">
          {ctaLabel}
          <ChevronRightIcon aria-hidden width={22} height={22} />
        </Link>
      }
    >
      <section className="gf-panel flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
        <p className="text-label font-extrabold text-[#8a4a21]">{label}</p>
        <p className="text-hero font-black tabular-nums text-[#3b1707]">
          {score}
          <span className="text-title text-[#8a4a21]"> / {total}</span>
        </p>
        {chips && chips.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-2">
            {chips.slice(0, 3).map((c, i) => (
              <li
                key={i}
                className="inline-flex min-h-9 items-center rounded-full border-2 border-[#6b2d12] bg-[#ffe58a] px-3 text-label font-extrabold text-[#4a1f0a]"
              >
                {c}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </GameFrame>
  )
}

/** จอรอครูเปิด — โดมบอกสั้น ๆ + จุดกะพริบ ไม่มีย่อหน้า */
export function GameWaiting({
  title,
  backHref,
  say,
  hint,
}: {
  title: string
  backHref?: string | null
  say: string
  hint: string
}) {
  return (
    <GameFrame title={title} backHref={backHref} mood="think" say={say}>
      <section
        className="gf-panel flex flex-1 flex-col items-center justify-center gap-4 p-5 text-center"
        role="status"
        aria-live="polite"
      >
        <img src="/icons/3d/hourglass-not-done.webp" alt="" width={96} height={96} />
        <p className="text-title-sm font-black text-[#3b1707]">{hint}</p>
        <span className="flex gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="gf-wait-dot size-3 rounded-full bg-[#c98238]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>
      </section>
    </GameFrame>
  )
}

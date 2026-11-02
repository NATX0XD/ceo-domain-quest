import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { GameFrame } from '@/components/game-frame'
import { ChevronRightIcon, type DomeMood } from '@/components/ui'
import './game-result.css'

/** ดาว 0-3 ตามสัดส่วนคะแนน — ให้กำลังใจเสมออย่างน้อย 1 ดวงเมื่อได้คะแนน */
function starsFor(score: number, total: number): number {
  const ratio = total > 0 ? score / total : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return score > 0 ? 1 : 0
}

/**
 * จอเผยคะแนนในธีมเกม: เหรียญรางวัล + ดาว 3 ดวง + คะแนนใหญ่ + แถบคะแนน
 * (+ ก่อน→หลังเรียน เมื่อส่ง compare มา) + ป้ายเล็กไม่เกิน 3 อัน + ปุ่มเดียว
 */
export function GameScore({
  title,
  backHref,
  mood = 'celebrate',
  say,
  label,
  score,
  total,
  chips,
  compare,
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
  /** ก่อนเรียน → หลังเรียน (หน้าหลังเรียนเท่านั้น) */
  compare?: { before: number; after: number; gain: number | null } | null
  ctaHref: string
  ctaLabel: string
}) {
  const stars = starsFor(score, total)
  const pct = total > 0 ? Math.round((Math.min(score, total) / total) * 100) : 0
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
      <section className="gf-panel gr-reveal" aria-label={`${label} ${score} จาก ${total}`}>
        <div className="gr-medal" aria-hidden="true">
          <span className="gr-glow" />
          <img src="/ui/rewards/mission-medal.webp" alt="" className="gr-medal-img" />
        </div>

        <ul className="gr-stars" aria-label={`ได้ ${stars} ดาวจาก 3`}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={i < stars ? 'gr-star is-on' : 'gr-star'} style={{ '--i': i } as CSSProperties}>
              <img src="/ui/kit2/badge-star.webp" alt="" />
            </li>
          ))}
        </ul>

        <p className="gr-label">{label}</p>
        <p className="gr-score">
          <span className="gr-score-num">{score}</span>
          <span className="gr-score-total">/ {total}</span>
        </p>

        <div className="gr-bar" role="presentation">
          <span className="gr-bar-fill" style={{ '--pct': `${pct}%` } as CSSProperties} />
        </div>

        {compare ? (
          <div className="gr-compare">
            <div className="gr-compare-box">
              <span>ก่อนเรียน</span>
              <b>{compare.before}</b>
            </div>
            <span className="gr-compare-mid">
              {compare.gain !== null && compare.gain > 0 ? (
                <span className="gr-gain">+{compare.gain} ข้อ</span>
              ) : null}
              <span className="gr-compare-arrow" aria-label="เป็น">
                <ChevronRightIcon aria-hidden width={26} height={26} />
              </span>
            </span>
            <div className="gr-compare-box is-after">
              <span>หลังเรียน</span>
              <b>{compare.after}</b>
            </div>
          </div>
        ) : null}

        {chips && chips.length > 0 ? (
          <ul className="gr-chips">
            {chips.slice(0, 3).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </GameFrame>
  )
}

/** จอรอครูเปิด — นาฬิกาทรายในวงแสง + จุดกะพริบ + บอกว่าไม่ต้องกดอะไร */
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
      <section className="gf-panel gr-wait" role="status" aria-live="polite">
        <div className="gr-wait-art" aria-hidden="true">
          <span className="gr-glow" />
          <img src="/icons/3d/hourglass-not-done.webp" alt="" className="gr-wait-img" />
        </div>
        <p className="gr-wait-hint">{hint}</p>
        <span className="flex gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="gf-wait-dot size-3 rounded-full bg-[#c98238]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>
        <ul className="gr-wait-tips">
          <li>
            <img src="/icons/3d/bell.webp" alt="" />
            ครูกดเปิดเมื่อไร ข้อสอบขึ้นเอง
          </li>
          <li>
            <img src="/icons/3d/check-mark-button.webp" alt="" />
            ไม่ต้องรีเฟรช ไม่ต้องกดอะไร
          </li>
        </ul>
      </section>
    </GameFrame>
  )
}

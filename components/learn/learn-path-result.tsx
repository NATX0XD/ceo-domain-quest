'use client'

import { motion, useReducedMotion } from 'motion/react'
import { AlertIcon, CheckIcon, DomeAvatar, LightbulbIcon, cn } from '@/components/ui'
import './learn-path-result.css'
import type { AnswerResponse } from './learn-path-api'
import { Bubble, ChatFrame, QuickChip } from './app/chat-reader'
import { CountUp } from './app/fx'

/** ข้อความโดมตามระดับคะแนนรวม (docs/teammates: ระดับ Feedback) */
export function bandMessage(score: number, passed: boolean): string {
  if (!passed) {
    return score <= 30
      ? `เริ่มต้นได้แล้วครับ ตอนนี้ได้ ${score}% ลองดูช่วงที่เกี่ยวข้องอีกครั้ง แล้วตอบเสริมสั้น ๆ นะครับ`
      : `ตอนนี้ได้ ${score}% ครับ ใกล้แล้ว เหลืออีกนิดเดียว ลองทบทวนส่วนที่ยังไม่ชัด แล้วตอบเสริมสั้น ๆ อีกครั้งนะครับ`
  }
  if (score >= 90) return `ยอดเยี่ยมครับ! ได้ ${score}% อธิบายได้ถูกต้องชัดเจน พร้อมไปด่านต่อไปแล้วครับ`
  if (score >= 80)
    return `ทำได้ดีมากครับ! ได้ ${score}% เข้าใจประเด็นหลักแล้ว มีจุดเล็ก ๆ ให้เสริมอีกนิดเท่านั้น พร้อมไปต่อได้เลย`
  return `ผ่านภารกิจแล้วครับ! ได้ ${score}% เข้าใจส่วนสำคัญแล้ว ส่วนที่ยังไม่ครบลองเสริมอีกนิดนะครับ พร้อมไปด่านต่อไปได้เลย`
}

/** ข้อที่คะแนนต่ำสุด = ประเด็นที่โดมจะช่วยเฉพาะจุด */
export function weakest(result: AnswerResponse) {
  return [...result.perQuestion].sort((a, b) => a.score - b.score)[0]
}

/** หน้าสรุปคะแนนและ Feedback (screen 6) */
export function ResultPanel({
  result,
  passScore,
  questions,
  extra,
}: {
  result: AnswerResponse
  passScore: number
  questions: { id: string; prompt: string }[]
  extra?: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const sorted = [...result.perQuestion].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const weak = sorted[sorted.length - 1]
  const bestQ = best ? questions.findIndex((q) => q.id === best.id) + 1 : 0
  const weakQ = weak ? questions.findIndex((q) => q.id === weak.id) + 1 : 0
  const good = best && best.score > 0 ? best.feedback : null
  const improve = weak && (weak.missing.length > 0 || weak.score < 100) ? (weak.missing[0] ?? weak.feedback) : null
  return (
    <div className="flex flex-col gap-3">
      <motion.div
        initial={reduce ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className={cn('lr-score', result.passed ? 'is-pass' : 'is-retry')}
        role="status"
      >
        <div className="lr-ring" style={{ ['--p' as string]: `${result.score}` }}>
          <span>
            <CountUp value={result.score} />%
          </span>
        </div>
        <div className="min-w-0">
          <p className="lr-label">ผลความเข้าใจ</p>
          <p className="lr-status">
            {result.passed ? (
              <CheckIcon width={22} height={22} aria-hidden />
            ) : (
              <AlertIcon width={22} height={22} aria-hidden />
            )}
            {result.passed ? 'ผ่านภารกิจแล้ว' : 'ยังไม่ผ่าน ลองเสริมอีกนิด'}
          </p>
          <p className="lr-note">
            {result.passed
              ? 'ได้คะแนนมากกว่า 60% จึงไปต่อได้ทันที'
              : `ต้องได้มากกว่า ${passScore}% ถึงจะผ่าน ตอบเสริมเฉพาะจุดได้ 1 ครั้ง`}
          </p>
        </div>
      </motion.div>

      <div className="lr-dome">
        <DomeAvatar mood={result.passed ? 'celebrate' : 'encourage'} size={64} decorative />
        <p className="lr-bubble">{bandMessage(result.score, result.passed)}</p>
      </div>

      <div className="lr-points">
        {good ? (
          <div className="lr-point is-good">
            <span className="lr-point-icon" aria-hidden>
              ✓
            </span>
            <div>
              <p className="lr-point-title">สิ่งที่ทำได้ดี{bestQ ? ` (ข้อ ${bestQ})` : ''}</p>
              <p className="lr-point-text">{good}</p>
            </div>
          </div>
        ) : null}
        {improve ? (
          <div className="lr-point is-more">
            <LightbulbIcon width={26} height={26} aria-hidden className="lr-point-icon-svg" />
            <div>
              <p className="lr-point-title">สิ่งที่ควรเสริม{weakQ ? ` (ข้อ ${weakQ})` : ''}</p>
              <p className="lr-point-text">{weak?.missing[0] ? `ลองเติมเรื่อง ${weak.missing[0]}` : improve}</p>
            </div>
          </div>
        ) : null}
      </div>
      {extra}
    </div>
  )
}

/** หน้าช่วยเหลือเฉพาะจุดแบบ adaptive (screen 5 / R07) — แนะนำทีละจุด ไม่เฉลยทั้งข้อ */
export function HelpPanel({
  result,
  questions,
  hintShown,
  onHint,
  onReview,
  reviewLabel,
}: {
  result: AnswerResponse
  questions: { id: string; prompt: string; hint?: string; review?: { from: number; to: number } }[]
  hintShown: boolean
  onHint: () => void
  onReview: () => void
  reviewLabel: string
}) {
  const weak = weakest(result)
  const wq = questions.find((q) => q.id === weak?.id)
  const strong = result.perQuestion.filter((r) => r.id !== weak?.id && r.score > 0)
  const wi = questions.findIndex((q) => q.id === weak?.id)
  return (
    <ChatFrame title="โดม" subtitle="ช่วยเฉพาะจุด">
      <ol className="flex flex-col gap-2.5 px-3 py-4">
        {strong.length > 0 ? (
          <Bubble name="โดม" side="left" tone="dome">
            นักเรียนเข้าใจข้อ {strong.map((r) => questions.findIndex((q) => q.id === r.id) + 1).join(' และ ')}{' '}
            ได้ดีแล้วครับ
          </Bubble>
        ) : (
          <Bubble name="โดม" side="left" tone="dome">
            ไม่เป็นไรครับ เรามาค่อย ๆ ไปทีละจุดกัน
          </Bubble>
        )}
        <Bubble name="โดม" side="left" tone="dome">
          จุดที่ยังขาดคือข้อ {wi + 1}
          {weak?.missing[0] ? ` ลองเติมเรื่อง ${weak.missing[0]}` : ' ลองดูช่วงที่เกี่ยวข้องอีกครั้ง'}
        </Bubble>
        {hintShown && wq?.hint ? (
          <Bubble name="โดม" side="left" tone="dome">
            <span className="flex items-start gap-2">
              <LightbulbIcon width={20} height={20} aria-hidden className="mt-0.5 shrink-0 text-reward-600" />
              {wq.hint}
            </span>
          </Bubble>
        ) : null}
      </ol>
      <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 bg-white/80 px-3 py-3">
        <DomeAvatar mood="encourage" size={32} decorative />
        <QuickChip onClick={onReview}>{reviewLabel}</QuickChip>
        {!hintShown && wq?.hint ? <QuickChip onClick={onHint}>ขอคำใบ้</QuickChip> : null}
      </div>
    </ChatFrame>
  )
}

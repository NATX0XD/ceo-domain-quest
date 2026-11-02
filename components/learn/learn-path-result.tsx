'use client'

import { motion, useReducedMotion } from 'motion/react'
import { AlertIcon, Card, CheckIcon, DomeAvatar, LightbulbIcon, cn } from '@/components/ui'
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
  return (
    <div className="flex flex-col gap-3">
      <motion.div
        initial={reduce ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className={cn(
          'flex items-center gap-4 rounded-[24px] p-5 shadow-soft-2 ring-1',
          result.passed ? 'bg-quest-50 ring-quest-200' : 'bg-spark-50 ring-spark-200',
        )}
        role="status"
      >
        <div
          className={cn(
            'grid size-20 shrink-0 place-items-center rounded-full text-title font-extrabold text-ink-onbrand',
            result.passed ? 'bg-quest-600' : 'bg-spark-600',
          )}
        >
          <span>
            <CountUp value={result.score} />%
          </span>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-body-lg font-extrabold text-ink">
            {result.passed ? (
              <CheckIcon width={22} height={22} aria-hidden className="text-quest-700" />
            ) : (
              <AlertIcon width={22} height={22} aria-hidden className="text-spark-700" />
            )}
            {result.passed ? 'ตอบผ่านแล้ว' : 'ยังไม่ครบ ลองอีกนิด'}
          </p>
          <p className="text-label text-ink-muted">
            {result.passed
              ? `ครบแล้ว รวม ${result.score} คะแนน`
              : `ยังไม่ครบ ลองอีกนิด รวม ${result.score} คะแนน ต้องเกิน ${passScore}`}
          </p>
        </div>
      </motion.div>

      <ChatFrame title="โดม" subtitle="สรุปผลให้นักเรียน">
        <ol className="flex flex-col gap-2.5 px-3 py-4">
          <Bubble name="โดม" side="left" tone="dome">
            {bandMessage(result.score, result.passed)}
          </Bubble>
        </ol>
      </ChatFrame>

      {result.perQuestion.map((r, i) => {
        const ok = r.score > passScore
        const q = questions.find((x) => x.id === r.id)
        return (
          <Card key={r.id} tone={ok ? 'quest' : 'spark'} padding="sm" role="status">
            <p className="flex items-center gap-2 text-label font-bold text-ink">
              {ok ? (
                <CheckIcon width={20} height={20} aria-hidden className="text-quest-700" />
              ) : (
                <AlertIcon width={20} height={20} aria-hidden className="text-spark-700" />
              )}
              ข้อ {i + 1} {ok ? `ครบแล้ว ได้ ${r.score} คะแนน` : `ยังไม่ครบ ลองอีกนิด ได้ ${r.score} คะแนน`}
            </p>
            {q ? <p className="mt-1 text-label text-ink-muted">{q.prompt}</p> : null}
            <p className="mt-1 text-body text-ink">{r.feedback}</p>
            {r.missing.length > 0 ? (
              <div className="mt-2">
                <p className="text-label font-bold text-ink-muted">ลองเติมเรื่องนี้</p>
                <ul className="mt-1 list-disc pl-5 text-label text-ink">
                  {r.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        )
      })}
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

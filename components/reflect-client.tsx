'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SignInGate } from '@/components/student-shell'
import { GameFrame } from '@/components/game-frame'
import { FlowNote, useFlowFeedback } from '@/components/flow-feedback-client'
import { ChevronRightIcon, SendIcon, StarIcon, cn } from '@/components/ui'

/**
 * หน้าทบทวนตัวเอง (หลังแบบทดสอบหลังเรียน) — **แสดงผลอย่างเดียว**
 *
 * ⚠️ ห้าม import `@/core/*`, `@/components/server/*` หรือ `content/*.json` เข้ามาในไฟล์นี้
 *    ข้อความจากไฟล์เนื้อหาถูกส่งมาเป็น props จาก app/reflect/page.tsx
 * ⚠️ ไม่มีการให้คะแนน ไม่มีถูกผิด · ความยาวขั้นต่ำตรวจซ้ำที่ POST /api/reflect
 * 5 ข้อสั้น ๆ ทีละจอ: ความรู้สึก (ไอคอน) · วันนี้ได้เรียนอะไร (ชิป) · มั่นใจแค่ไหน (ดาว)
 *  · ยังสงสัยอะไร · ฝากข้อความถึงตัวเอง · ตัวนับข้อมีที่เดียว (ป้ายไม้)
 */
export type ReflectOutcome = 'below' | 'met' | 'exceeded'

export interface ReflectPolicy {
  requiredIds: string[]
  optionalIds: string[]
  requiredCount: number
  totalCount: number
  optionalChipLabel: string
  optionalHint: string
}

export interface ReflectCertificate {
  eligible: boolean
  message: string
  passedCount: number
  totalCount: number
  nextHref: string
  nextLabel: string
  statusLabel: string
}

export interface ReflectCompareCard {
  badgeLabel: string
  headline: string
  message: string
  focusLabel: string | null
  focusText: string | null
  nextStepLabel: string | null
  nextStepText: string | null
}

export interface ReflectQuestion {
  id: string
  question: string
  helper: string
  placeholder: string
  starterPhrases: string[]
  minLength: number
  maxLength: number
}

export interface ReflectExtra {
  id: string
  kind: 'feeling' | 'stars'
  question: string
  options: string[]
  max: number
}

type Step =
  | { id: string; kind: 'feeling'; title: string; extra: ReflectExtra }
  | { id: string; kind: 'stars'; title: string; extra: ReflectExtra }
  | { id: string; kind: 'chips'; title: string; question: ReflectQuestion }
  | { id: string; kind: 'text'; title: string; question: ReflectQuestion }

const FEEL_ICON: Record<string, string> = {
  สนุกมาก: '/icons/3d/feel-star-struck.webp',
  ภูมิใจ: '/icons/3d/feel-smile.webp',
  'เฉย ๆ': '/icons/3d/feel-neutral.webp',
  งงนิดหน่อย: '/icons/3d/feel-confused.webp',
  เหนื่อย: '/icons/3d/feel-tired.webp',
}

const CHIP_SEP = ' · '
const NO_WONDER = 'ตอนนี้ยังไม่มีเรื่องสงสัย'

const SAY: Record<string, string> = {
  'reflect-feel': 'ไม่มีถูกผิดนะ เลือกตามที่รู้สึก',
  'reflect-1': 'เลือกได้หลายอย่างเลย',
  'reflect-conf': 'ตอบตามจริง ไม่มีใครให้คะแนน',
  'reflect-2': 'สงสัยตรง ๆ ได้เลย ครูจะช่วย',
  'reflect-3': 'ข้อสุดท้ายแล้ว เก่งมาก',
}

export function ReflectClient({
  meta,
  questions,
  extras,
  promptShort,
  learnedOptions,
  initialAnswers,
  initiallyComplete,
  stars,
  compareCards,
  initialOutcome,
}: {
  meta: { submitButtonLabel: string; savedMessage: string }
  questions: ReflectQuestion[]
  extras: ReflectExtra[]
  promptShort: Record<string, string>
  learnedOptions: string[]
  initialAnswers: Record<string, string>
  initiallyComplete: boolean
  stars: { earned: number; goal: number | null; goalName: string | null; max: number }
  compareCards: Record<ReflectOutcome, ReflectCompareCard | null>
  initialOutcome: ReflectOutcome | null
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  const [submitted, setSubmitted] = useState(initiallyComplete)
  const [outcome, setOutcome] = useState<ReflectOutcome | null>(initialOutcome)
  const [earned, setEarned] = useState(stars.earned)
  const [goal, setGoal] = useState<number | null>(stars.goal)
  const [step, setStep] = useState(0)
  const [needsJoin, setNeedsJoin] = useState(false)
  const [certificate, setCertificate] = useState<ReflectCertificate | null>(null)
  const flow = useFlowFeedback()
  const box = useRef<HTMLTextAreaElement | null>(null)

  const steps = useMemo<Step[]>(() => {
    const q = (id: string) => questions.find((x) => x.id === id)
    const e = (id: string) => extras.find((x) => x.id === id)
    const list: Step[] = []
    const feel = e('reflect-feel')
    const conf = e('reflect-conf')
    const learned = q('reflect-1')
    const wonder = q('reflect-2')
    const note = q('reflect-3')
    if (feel) list.push({ id: feel.id, kind: 'feeling', title: feel.question, extra: feel })
    if (learned)
      list.push({ id: learned.id, kind: 'chips', title: promptShort[learned.id] ?? learned.question, question: learned })
    if (conf) list.push({ id: conf.id, kind: 'stars', title: conf.question, extra: conf })
    if (wonder)
      list.push({ id: wonder.id, kind: 'text', title: promptShort[wonder.id] ?? wonder.question, question: wonder })
    if (note)
      list.push({ id: note.id, kind: 'text', title: promptShort[note.id] ?? note.question, question: note })
    return list
  }, [questions, extras, promptShort])

  /** ถามเซิร์ฟเวอร์ครั้งเดียว: ตอบครบตามกติกาแล้วไหม + สถานะใบประกาศ (props ไม่มีให้) */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetch('/api/reflect', { headers: { accept: 'application/json' } })
        if (res.status === 403) {
          router.replace('/posttest')
          return
        }
        if (!res.ok || !alive) return
        const data = (await res.json()) as { submitted?: boolean; certificate?: ReflectCertificate }
        if (!alive) return
        if (data.certificate) setCertificate(data.certificate)
        if (data.submitted === true) setSubmitted(true)
      } catch {
        // เน็ตสะดุดตอนเปิดหน้า ไม่ต้องรบกวน
      }
    })()
    return () => {
      alive = false
    }
  }, [router])

  const card = useMemo(
    () => (outcome ? (compareCards[outcome] ?? null) : null),
    [outcome, compareCards],
  )

  if (needsJoin) {
    return <SignInGate message="เข้าห้องด้วยรหัสห้องกับ PIN ก่อน แล้วกลับมาทบทวนต่อได้" />
  }

  const total = steps.length
  const safe = Math.min(step, Math.max(0, total - 1))
  const current = steps[safe]
  const last = safe === total - 1

  const valueOf = (id: string) => answers[id] ?? ''
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }))

  /** ข้อบังคับ (ตามกติกาเซิร์ฟเวอร์) ต้องยาวพอก่อนไปต่อ · ข้ออื่นข้ามได้ */
  function ok(s: Step): boolean {
    if (s.kind !== 'chips' && s.kind !== 'text') return true
    const req = s.id === 'reflect-1' || s.id === 'reflect-2'
    return !req || valueOf(s.id).trim().length >= s.question.minLength
  }

  async function post(body: Record<string, unknown>): Promise<Response | null> {
    try {
      const res = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) {
        setNeedsJoin(true)
        return null
      }
      if (res.status === 403) {
        router.replace('/posttest')
        return null
      }
      return res
    } catch {
      flow.failed('ต่อเน็ตไม่ได้ ข้อความยังอยู่ ลองอีกครั้ง')
      return null
    }
  }

  async function next() {
    if (!current || flow.busy) return
    const v = valueOf(current.id)
    if (v.trim().length > 0) void post({ answers: { [current.id]: v } })
    setStep(safe + 1)
  }

  async function submit() {
    if (flow.busy) return
    flow.sending('กำลังส่ง')
    const res = await post({ answers, submit: true })
    if (!res) return
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean
      message?: string
      missing?: { id: string }[]
      certificate?: ReflectCertificate
      earnedStars?: number
      goalStars?: number | null
      outcome?: ReflectOutcome | null
    } | null
    if (res.status === 422) {
      flow.failed(data?.message ?? 'ยังมีข้อที่ต้องตอบ')
      const idx = steps.findIndex((s) => s.id === data?.missing?.[0]?.id)
      if (idx >= 0) setStep(idx)
      return
    }
    if (!res.ok || data?.ok !== true) {
      flow.failed(data?.message ?? 'ส่งไม่สำเร็จ ลองอีกครั้ง')
      return
    }
    if (typeof data.earnedStars === 'number') setEarned(data.earnedStars)
    if (data.goalStars !== undefined) setGoal(data.goalStars)
    if (data.certificate) setCertificate(data.certificate)
    setOutcome(data.outcome ?? outcome)
    setSubmitted(true)
    flow.done(meta.savedMessage)
  }

  if (submitted) {
    return (
      <GameFrame
        title="ทบทวนแล้ว"
        backHref="/result"
        mood="celebrate"
        say="เก่งมาก ขอบคุณที่ตั้งใจจนจบ"
        footer={
          <Link href="/result" className="btn-go focus-ring">
            ไปรับเกียรติบัตร
            <ChevronRightIcon aria-hidden width={22} height={22} />
          </Link>
        }
      >
        <section className="gf-panel flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
          {card ? (
            <span className="rounded-full border-2 border-[#6b2d12] bg-[#ffe58a] px-3 py-1 text-label font-extrabold text-[#4a1f0a]">
              {card.badgeLabel}
            </span>
          ) : null}
          <p className="flex items-center gap-2 text-hero font-black tabular-nums text-[#3b1707]">
            <StarIcon aria-hidden width={44} height={44} className="text-[#ffb400]" />
            {earned}
            <span className="text-title text-[#8a4a21]">/ {stars.max}</span>
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {goal !== null ? (
              <li className="rounded-full bg-white/70 px-3 py-1 text-label font-extrabold text-[#4a1f0a] ring-2 ring-[#6b2d12]/30">
                เป้า {goal} ดาว
              </li>
            ) : null}
            {certificate ? (
              <li className="rounded-full bg-white/70 px-3 py-1 text-label font-extrabold text-[#4a1f0a] ring-2 ring-[#6b2d12]/30">
                ผ่าน {certificate.passedCount}/{certificate.totalCount} ด้าน
              </li>
            ) : null}
          </ul>
          <Link
            href="/survey"
            className="tap-target mt-1 inline-flex items-center rounded-full px-4 text-label font-extrabold text-[#8a4a21] underline focus-ring"
          >
            ตอบแบบสอบถามสั้น ๆ
          </Link>
        </section>
      </GameFrame>
    )
  }

  if (!current) {
    return (
      <GameFrame title="ทบทวน" backHref="/map" mood="think" say="รอครูเปิดขั้นทบทวนนะ">
        <section className="gf-panel flex flex-1 items-center justify-center p-5" />
      </GameFrame>
    )
  }

  const selected = valueOf('reflect-1')
    .split(CHIP_SEP)
    .filter((x) => x.length > 0)

  return (
    <GameFrame
      title="ทบทวนตัวเอง"
      backHref="/posttest"
      count={`${safe + 1}/${total}`}
      mood={current.kind === 'feeling' ? 'greet' : current.kind === 'stars' ? 'think' : 'happy'}
      say={SAY[current.id]}
      footer={
        <>
          {safe > 0 ? (
            <button
              type="button"
              className="gf-btn-side focus-ring"
              aria-label="ข้อก่อนหน้า"
              onClick={() => setStep(safe - 1)}
            >
              ย้อน
            </button>
          ) : null}
          {last ? (
            <button
              type="button"
              className="btn-go focus-ring"
              onClick={submit}
              disabled={flow.busy || !steps.every(ok)}
            >
              <SendIcon aria-hidden width={22} height={22} />
              {flow.busy ? 'กำลังส่ง' : meta.submitButtonLabel}
            </button>
          ) : (
            <button type="button" className="btn-go focus-ring" onClick={next} disabled={!ok(current)}>
              ถัดไป
              <ChevronRightIcon aria-hidden width={22} height={22} />
            </button>
          )}
        </>
      }
    >
      <section className="gf-panel flex min-h-0 flex-1 flex-col gap-3 p-4" aria-label={current.title}>
        <h2 className="gf-question shrink-0 text-pretty">{current.title}</h2>

        {current.kind === 'feeling' ? (
          <div className="grid grid-cols-3 gap-2.5">
            {current.extra.options.map((opt) => (
              <button
                key={opt}
                type="button"
                aria-pressed={valueOf(current.id) === opt}
                onClick={() => set(current.id, opt)}
                className="gf-feel focus-ring"
              >
                <img src={FEEL_ICON[opt] ?? '/icons/3d/glowing-star.webp'} alt="" width={48} height={48} />
                <span>{opt}</span>
              </button>
            ))}
          </div>
        ) : null}

        {current.kind === 'chips' ? (
          <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto">
            {learnedOptions.map((opt) => {
              const on = selected.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set(
                      'reflect-1',
                      (on ? selected.filter((x) => x !== opt) : [...selected, opt]).join(CHIP_SEP),
                    )
                  }
                  className="gf-pick focus-ring"
                >
                  <span className="gf-pick-mark" aria-hidden="true">
                    {on ? '✓' : '+'}
                  </span>
                  <span className="min-w-0 flex-1 text-pretty">{opt}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {current.kind === 'stars' ? (
          <div role="radiogroup" aria-label={current.title} className="flex justify-center gap-1 py-4">
            {Array.from({ length: current.extra.max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={Number(valueOf(current.id)) >= n}
                aria-label={`${n} ดาว`}
                onClick={() => set(current.id, String(n))}
                className="gf-star focus-ring"
              >
                <StarIcon aria-hidden width={44} height={44} filled={Number(valueOf(current.id)) >= n} />
              </button>
            ))}
          </div>
        ) : null}

        {current.kind === 'text' ? (
          <>
            <textarea
              ref={box}
              value={valueOf(current.id)}
              placeholder={current.question.placeholder}
              maxLength={current.question.maxLength}
              aria-label={current.title}
              onChange={(e) => set(current.id, e.target.value.slice(0, current.question.maxLength))}
              className={cn(
                'min-h-28 w-full flex-1 resize-none rounded-2xl border-[3px] border-[#6b2d12]/30 bg-[#fffaf0] px-4 py-3',
                'text-body text-ink outline-none placeholder:text-ink-subtle',
                'focus-visible:border-[#4a1f0a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus',
              )}
            />
            <div className="flex shrink-0 flex-wrap gap-2">
              {[...(current.id === 'reflect-2' ? [NO_WONDER] : []), ...current.question.starterPhrases.slice(0, 2)].map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const cur = valueOf(current.id)
                      set(
                        current.id,
                        p === NO_WONDER ? p : `${cur}${cur.trim() ? ' ' : ''}${p}`,
                      )
                      box.current?.focus()
                    }}
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-[#6b2d12]/40 bg-[#ffe58a]/70 px-3.5 text-label font-extrabold text-[#4a1f0a] focus-ring"
                  >
                    + {p}
                  </button>
                ),
              )}
            </div>
          </>
        ) : null}

        <FlowNote state={flow.state} />
      </section>
    </GameFrame>
  )
}

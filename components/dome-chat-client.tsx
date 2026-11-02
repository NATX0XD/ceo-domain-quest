'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronRightIcon,
  DomeAvatar,
  IconButton,
  SendIcon,
  SpeechBubble,
  type DomeMood,
} from '@/components/ui'
import { AppFooter, AppHeader, AppShell } from '@/components/app-shell'

/**
 * หน้าคุยกับเลขาโดม — หน้าแรกของนักเรียน
 *
 * ⚠️ บทพูดทั้งหมดมาจาก POST /api/dome ฝั่งเซิร์ฟเวอร์ ไม่มีสคริปต์ฝังในไฟล์นี้
 *    ยกเว้นข้อความสถานะของหน้าจอเอง (เช่น กำลังพิมพ์)
 * พอเปลี่ยนไปใช้ AI จริง หน้าจอนี้ไม่ต้องแก้ เพราะ payload เหมือนเดิม (มีฟิลด์ source บอกที่มา)
 */
interface Turn {
  id: number
  who: 'dome' | 'student'
  text: string
  action?: { href: string; label: string } | null
  source?: 'ai' | 'fallback'
}

/**
 * อารมณ์ของโดมในแต่ละบับเบิล — เป็นเรื่องการนำเสนอล้วน ไม่แตะข้อมูลที่เซิร์ฟเวอร์ส่งมา
 * บับเบิลที่มีปุ่มพาไปทำภารกิจ = โดมกำลังเชียร์ให้ไปต่อ · บับเบิลแรก = ทักทาย
 */
/** ไอคอน 3D ของปุ่มคำตอบด่วนแต่ละแบบ — id มาจากเซิร์ฟเวอร์ ไม่รู้จัก = ประกาย */
const REPLY_ICON: Record<string, string> = {
  'want-website': '/icons/3d/rocket.webp',
  'explain-domain': '/icons/3d/magnifying-glass-tilted-left.webp',
  ready: '/icons/3d/chequered-flag.webp',
  other: '/icons/3d/speech-balloon.webp',
}

/** การ์ดคำตอบด่วนแบบเกม: ครีม ขอบน้ำตาล ยุบลงเมื่อกด (ไม่ใช้ rounded-xl เพราะ CSS กลางบังคับห้ามตัดบรรทัด) */
const REPLY_CARD =
  'flex min-h-16 w-full items-center gap-3 rounded-2xl border-[3px] px-4 py-3 text-left text-[1rem] font-extrabold leading-snug transition-[transform,box-shadow] duration-100 active:translate-y-[3px] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60'
const REPLY_CREAM =
  'border-[#6b2d12] bg-[linear-gradient(180deg,#fffdf0_0%,#ffe2b3_100%)] text-[#5a2812] shadow-[0_5px_0_#6b2d12,inset_0_2px_0_#fff] active:shadow-[0_2px_0_#6b2d12,inset_0_2px_0_#fff]'
const REPLY_PRIMARY =
  'border-[#6b2d12] bg-[linear-gradient(180deg,#ffc51b_0%,#ff7411_100%)] text-[#4a1f0a] shadow-[0_6px_0_#6b2d12,inset_0_3px_0_rgb(255_255_255/.7)] active:shadow-[0_2px_0_#6b2d12,inset_0_3px_0_rgb(255_255_255/.7)]'

function ReplyIcon({ id }: { id: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-full bg-[rgb(255_255_255/.75)] shadow-[inset_0_-2px_0_rgb(107_45_18/.15)]"
    >
      <img src={REPLY_ICON[id] ?? '/icons/3d/sparkles.webp'} alt="" className="size-8 object-contain" />
    </span>
  )
}

function moodOf(turn: Turn, index: number): DomeMood {
  if (turn.action) return 'happy'
  return index === 0 ? 'greet' : 'cheer'
}

export function DomeChatClient({
  greeting,
  quickReplies,
  greetingAction,
  currentMissionId,
  nextStep,
}: {
  greeting: string
  quickReplies: { id: string; label: string }[]
  greetingAction: { href: string; label: string } | null
  currentMissionId: string
  /** ขั้นถัดไปจริงของผู้เรียน (ตั้งร้าน → /profile → /map) — ปุ่ม "พร้อม" พาไปตรงนี้ทันที */
  nextStep: { href: string; label: string }
}) {
  const [turns, setTurns] = useState<Turn[]>([
    { id: 0, who: 'dome', text: greeting, action: greetingAction, source: 'fallback' },
  ])
  const [replies, setReplies] = useState(quickReplies)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // เลื่อนลงล่างสุดทุกครั้งที่มีข้อความใหม่ — ไม่งั้นบนมือถือข้อความใหม่จะอยู่ใต้ขอบจอ
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns.length, busy])

  async function send(message: string, quickReplyId: string | null) {
    if (busy) return
    const studentTurn: Turn = { id: nextId.current++, who: 'student', text: message }
    setTurns((t) => [...t, studentTurn])
    setText('')
    setBusy(true)
    try {
      const res = await fetch('/api/dome', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, quickReplyId, missionId: currentMissionId }),
      })
      const data = (await res.json().catch(() => null)) as
        | {
            reply?: string
            source?: 'ai' | 'fallback'
            action?: { href: string; label: string } | null
            quickReplies?: { id: string; label: string }[]
            message?: string
          }
        | null
      if (!res.ok || !data?.reply) {
        setTurns((t) => [
          ...t,
          {
            id: nextId.current++,
            who: 'dome',
            text: data?.message ?? 'ตอนนี้ผมตอบไม่ได้ครับ ลองใหม่อีกครั้งนะ',
          },
        ])
        return
      }
      setTurns((t) => [
        ...t,
        {
          id: nextId.current++,
          who: 'dome',
          text: data.reply as string,
          action: data.action ?? null,
          source: data.source,
        },
      ])
      if (data.quickReplies) setReplies(data.quickReplies)
    } catch {
      setTurns((t) => [
        ...t,
        { id: nextId.current++, who: 'dome', text: 'ต่อเน็ตไม่ได้ครับ ลองพิมพ์ใหม่อีกที' },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell
      className="media-shell media-dome-shell student-display"
      header={
        <AppHeader className="flex items-center gap-2 py-1.5!">
          <DomeAvatar mood="greet" size={36} decorative />
          <h1 className="text-title-sm font-extrabold text-ink">เลขาโดม</h1>
        </AppHeader>
      }
      /**
       * แถบท้ายมีแค่ช่องพิมพ์กับปุ่มส่ง — ปุ่มคำตอบด่วนอยู่ท้ายบทสนทนาในส่วนที่เลื่อนได้
       *
       * ⚠️ เคยวางปุ่มคำตอบด่วนไว้ในแถบท้ายด้วยกัน พอคีย์บอร์ดมือถือเด้งขึ้น (จอเหลือ 430px)
       *    แถบท้ายกิน 236px บทสนทนาเหลือที่ดู 117px และช่องพิมพ์เกือบหลุดขอบจอ
       *    ย้ายมาอยู่ในบทสนทนาแล้วแถบท้ายสูงคงที่ ไม่ว่าเซิร์ฟเวอร์จะส่งคำตอบด่วนมากี่ปุ่ม
       */
      footer={
        <AppFooter>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const message = text.trim()
              if (message.length > 0) void send(message, null)
            }}
            className="flex items-center gap-2"
          >
            <label htmlFor="dome-message" className="sr-only">
              พิมพ์ข้อความคุยกับโดม
            </label>
            <input
              id="dome-message"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="พิมพ์ข้อความคุยกับโดม…"
              autoComplete="off"
              className="min-h-14 min-w-0 flex-1 rounded-full bg-surface-raised px-5 text-body text-ink ring-2 ring-line-contrast ring-inset outline-none placeholder:text-ink-subtle focus:ring-brand-500 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
            />
            {/* p-0! ทับ padding ของ .game-button ไม่งั้นไอคอนถูกบีบจนหายเหลือแต่วงกลมเปล่า */}
            <IconButton
              type="submit"
              variant="primary"
              size="lg"
              aria-label="ส่งข้อความให้โดม"
              title="ส่ง"
              disabled={busy || text.trim().length === 0}
              className="p-0!"
              icon={<SendIcon width={26} height={26} strokeWidth={2.6} className="shrink-0 -translate-x-px translate-y-px" />}
            />
          </form>
        </AppFooter>
      }
    >
      {/* relative z-1: ยกบทสนทนาขึ้นเหนือฉากไล่สี ::before ของพื้นหลังโดม ไม่งั้นการ์ดครึ่งล่างดูซีด */}
      <div className="relative z-1 px-4 pt-4 pb-4">
        <section aria-label="บทสนทนากับโดม" className="flex flex-1 flex-col gap-4">
          {turns.map((turn, index) =>
            turn.who === 'dome' ? (
              <div key={turn.id} className="flex items-start gap-2 animate-rise-in motion-reduce:animate-none">
                <DomeAvatar mood={moodOf(turn, index)} size={64} decorative />
                <SpeechBubble
                  speaker="dome"
                  tail="left"
                  speakerName={index === 0 ? 'โดม' : undefined}
                  className="min-w-0 flex-1 [&>p]:text-[0.875rem]"
                >
                  {turn.text}
                  {turn.action ? (
                    <Link
                      href={turn.action.href}
                      className="btn-base mt-3 w-full bg-brand-600 text-ink-onbrand shadow-soft-2 hover:bg-brand-700 active:translate-y-px"
                    >
                      {turn.action.label}
                      <ChevronRightIcon width={20} height={20} aria-hidden />
                    </Link>
                  ) : null}
                </SpeechBubble>
              </div>
            ) : (
              <SpeechBubble
                key={turn.id}
                speaker="student"
                tail="right"
                className="ml-auto max-w-[80%] animate-rise-in motion-reduce:animate-none"
              >
                {turn.text}
              </SpeechBubble>
            ),
          )}

          {busy ? (
            <div className="flex items-center gap-2" role="status" aria-live="polite">
              <DomeAvatar mood="think" size={48} decorative />
              <span className="flex items-center gap-1.5 rounded-3xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100 ring-inset">
                <span className="sr-only">โดมกำลังพิมพ์</span>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="size-2.5 rounded-full bg-brand-400 animate-pulse-soft motion-reduce:animate-none"
                    style={{ animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </span>
            </div>
          ) : null}

          {/* คำตอบด่วนของเทิร์นล่าสุด — แสดงทันทีไม่ต้องกดเปิด เด็กจะได้รู้ว่าทำอะไรต่อได้
              การเลื่อนอัตโนมัติ (bottomRef) พาปุ่มพวกนี้เข้ามาในจอให้เองทุกครั้งที่โดมตอบ
              "พร้อมเริ่มภารกิจ" เป็นปุ่มหลัก พาไปขั้นถัดไปจริงทันที (ไม่ต้องคุยอีกรอบ) */}
          {replies.length > 0 && !busy ? (
            <section aria-label="เลือกคำตอบ" className="mt-1 flex flex-col gap-3 pl-2">
              <p className="self-start rounded-full bg-[rgb(255_241_214/.92)] px-3 py-1 text-[0.875rem] font-bold text-[#6b2d12] shadow-[0_2px_0_rgb(107_45_18/.25)]">
                แตะเลือกได้เลย หรือพิมพ์คุยกับโดม
              </p>
              {replies.map((r) =>
                r.id === 'ready' ? (
                  <Link key={r.id} href={nextStep.href} className={`${REPLY_CARD} ${REPLY_PRIMARY} min-h-[4.5rem]`}>
                    <ReplyIcon id={r.id} />
                    <span className="min-w-0 flex-1 text-pretty text-[1.08rem]">{r.label}</span>
                    <ChevronRightIcon width={24} height={24} strokeWidth={3} aria-hidden className="shrink-0" />
                  </Link>
                ) : (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void send(r.label, r.id)}
                    disabled={busy}
                    className={`${REPLY_CARD} ${REPLY_CREAM}`}
                  >
                    <ReplyIcon id={r.id} />
                    <span className="min-w-0 flex-1 text-pretty">{r.label}</span>
                    <ChevronRightIcon width={20} height={20} aria-hidden className="shrink-0 opacity-70" />
                  </button>
                ),
              )}
            </section>
          ) : null}

          <div ref={bottomRef} />
        </section>
      </div>
    </AppShell>
  )
}

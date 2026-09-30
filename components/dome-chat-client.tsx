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
function moodOf(turn: Turn, index: number): DomeMood {
  if (turn.action) return 'happy'
  return index === 0 ? 'greet' : 'cheer'
}

export function DomeChatClient({
  greeting,
  quickReplies,
  greetingAction,
}: {
  greeting: string
  quickReplies: { id: string; label: string }[]
  greetingAction: { href: string; label: string } | null
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
        body: JSON.stringify({ message, quickReplyId }),
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
      header={
        <AppHeader className="flex items-center gap-3">
          <DomeAvatar mood="greet" size={48} decorative />
          <div className="min-w-0">
            <h1 className="text-title-sm font-extrabold text-ink">เลขาโดม</h1>
            <p className="text-note text-ink-muted">ผู้ช่วยส่วนตัวของ CEO ตัวน้อย</p>
          </div>
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
            <IconButton
              type="submit"
              variant="primary"
              size="lg"
              aria-label="ส่งข้อความให้โดม"
              disabled={busy || text.trim().length === 0}
              icon={<SendIcon width={24} height={24} />}
            />
          </form>
        </AppFooter>
      }
    >
      <div className="px-4 pt-4 pb-4">
        <section aria-label="บทสนทนากับโดม" className="flex flex-1 flex-col gap-4">
          {turns.map((turn, index) =>
            turn.who === 'dome' ? (
              <div key={turn.id} className="flex items-start gap-2 animate-rise-in motion-reduce:animate-none">
                <DomeAvatar mood={moodOf(turn, index)} size={64} decorative />
                <SpeechBubble
                  speaker="dome"
                  tail="left"
                  speakerName={index === 0 ? 'โดม' : undefined}
                  className="min-w-0 flex-1"
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
              <DomeAvatar mood="greet" size={48} decorative />
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

          {/* คำตอบด่วนของเทิร์นล่าสุด — อยู่ต่อท้ายบทสนทนา เลื่อนตามข้อความ
              การเลื่อนอัตโนมัติ (bottomRef) พาปุ่มพวกนี้เข้ามาในจอให้เองทุกครั้งที่โดมตอบ */}
          {replies.length > 0 && !busy ? (
            <section aria-label="คำตอบด่วน" className="flex flex-col gap-2">
              {replies.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void send(r.label, r.id)}
                  disabled={busy}
                  className="card-tap flex min-h-14 items-center gap-2 rounded-xl bg-surface-raised p-4 text-body font-semibold text-brand-700 shadow-soft-1 ring-2 ring-brand-100 ring-inset disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1 text-pretty">{r.label}</span>
                  <ChevronRightIcon
                    width={20}
                    height={20}
                    aria-hidden
                    className="shrink-0 opacity-70"
                  />
                </button>
              ))}
            </section>
          ) : null}

          <div ref={bottomRef} />
        </section>
      </div>
    </AppShell>
  )
}

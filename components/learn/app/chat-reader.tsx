'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DomeAvatar, cn } from '@/components/ui'
import { TypingDots, buzz } from './fx'
import './chat-reader.css'

export interface ChatMsg {
  who: 'a' | 'b' | 'dome' | string
  name: string
  text: string
}

/** กรอบแอปแชต: แถบม่วงมีโดม + พื้นหลังอ่อน ใช้ร่วมกันทั้งโหมดอ่านและโดมถามคำถาม */
export function ChatFrame({
  title = 'CEO Domain Quest',
  subtitle = 'ออนไลน์',
  children,
  footer,
  avatars,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  /** รูปโปรไฟล์ของคนในแชต (ไม่ใส่ = โดม) */
  avatars?: string[]
}) {
  return (
    <div className="chat-frame mx-auto flex min-h-full w-full max-w-md flex-col overflow-hidden">
      <div className="chat-frame-head flex items-center gap-3 px-3 py-2">
        {avatars && avatars.length > 0 ? (
          <span className="flex shrink-0 -space-x-3" aria-hidden>
            {avatars.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element -- รูปโปรไฟล์ในแชต
              <img key={a} src={a} alt="" className="chat-avatar" style={{ width: 40, height: 40 }} />
            ))}
          </span>
        ) : (
          <span className="chat-avatar chat-avatar-dome grid shrink-0 place-items-center" aria-hidden style={{ width: 42, height: 42 }}>
            <DomeAvatar mood="greet" size={36} decorative />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-body font-extrabold">{title}</p>
          <p className="flex items-center gap-1.5 text-label font-bold opacity-80">
            <span className="size-2 rounded-full bg-quest-500" aria-hidden />
            {subtitle}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      {footer}
    </div>
  )
}

/** บับเบิลของแชต — dome / เพื่อน (ซ้าย) / ผู้เรียน (ขวา) */
export function Bubble({
  name,
  side,
  tone,
  children,
  highlight = false,
  animate = true,
  liRef,
  avatar,
}: {
  avatar?: string | null
  name?: string
  side: 'left' | 'right'
  tone: 'dome' | 'friend' | 'me'
  children: ReactNode
  highlight?: boolean
  animate?: boolean
  liRef?: React.Ref<HTMLLIElement>
}) {
  const reduce = useReducedMotion()
  return (
    <motion.li
      ref={liRef}
      initial={reduce || !animate ? false : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={cn('flex max-w-[90%] items-end gap-1.5', side === 'right' ? 'flex-row-reverse self-end' : 'self-start')}
    >
      {avatar !== null ? (
        tone === 'dome' && !avatar ? (
          <span className="chat-avatar chat-avatar-dome grid shrink-0 place-items-center" aria-hidden style={{ width: 36, height: 36 }}>
            <DomeAvatar mood="happy" size={30} decorative />
          </span>
        ) : avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- รูปโปรไฟล์ในแชต
          <img src={avatar} alt="" aria-hidden className="chat-avatar shrink-0" style={{ width: 36, height: 36 }} />
        ) : null
      ) : null}
      <div className={cn('flex min-w-0 flex-col', side === 'right' ? 'items-end' : 'items-start')}>
        {name ? <span className="px-1 pb-0.5 text-label font-extrabold text-[#6b4a2c]">{name}</span> : null}
        <div
          className={cn(
            'chat-bubble px-4 py-2.5 text-body leading-relaxed whitespace-pre-line',
            `chat-bubble--${tone}`,
            side === 'right' ? 'rounded-[20px] rounded-br-md' : 'rounded-[20px] rounded-bl-md',
            highlight && 'chat-bubble--hi',
          )}
        >
          {children}
        </div>
      </div>
    </motion.li>
  )
}

export interface ChatPart {
  start: number
  title: string
}

/**
 * โหมดอ่าน: แอปแชต · typing 3 จุด · ตัวแบ่งช่วง · ชิปตอบด่วน · ตารางสรุป 3 สี (ด่าน 2)
 * ทุกข้อความมาจาก props (content/learn-paths.json) ไม่ฝังเนื้อหาไว้ที่นี่
 */
export function ChatReader({
  chat,
  shown,
  onNext,
  onAll,
  summary = false,
  parts,
  highlight,
  title,
  quick,
  primaryRight = false,
  avatars,
  instant = false,
  hideControls = false,
}: {
  chat: ChatMsg[]
  shown: number
  onNext: () => void
  onAll: () => void
  summary?: boolean
  parts?: ChatPart[]
  /** ช่วงข้อความ (นับจาก 1) ที่โดมชี้ให้ย้อนอ่าน */
  highlight?: { from: number; to: number } | null
  title?: string
  quick?: { prompt: string; choices: { text: string; reply: string; ok?: boolean }[] }
  /** m1 storyboard puts Meen (who=a) on the right and Fah (who=b) on the left. */
  primaryRight?: boolean
  /** รูปโปรไฟล์ตามชื่อผู้พูด */
  avatars?: Record<string, string>
  /** แสดงข้อความทันที ไม่มีจุดกำลังพิมพ์ (สเปกเส้นทางอ่าน R02) */
  instant?: boolean
  /** ปุ่มต่อเลย/แสดงทั้งหมดอยู่ที่แถบล่างของหน้าแล้ว */
  hideControls?: boolean
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const reduce = useReducedMotion()
  const [visible, setVisible] = useState(shown > 1 || instant ? shown : Math.min(1, shown))
  const endRef = useRef<HTMLDivElement>(null)
  const firstHi = useRef<HTMLLIElement>(null)
  const quickEnd = useRef<HTMLDivElement>(null)
  const typing = visible < shown
  const next = chat[visible]

  useEffect(() => {
    if (visible >= shown) return
    if (instant) {
      setVisible(shown)
      return
    }
    const t = setTimeout(() => setVisible((v) => Math.min(shown, v + 1)), reduce ? 0 : 650)
    return () => clearTimeout(t)
  }, [visible, shown, reduce])

  useEffect(() => {
    const behavior = reduce ? 'auto' : 'smooth'
    if (highlight && firstHi.current) firstHi.current.scrollIntoView({ behavior, block: 'center' })
    else endRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [visible, typing, reduce, highlight])

  const finished = visible >= chat.length

  return (
    <ChatFrame
      title={title}
      subtitle={avatars ? 'แชตที่เตรียมไว้ · อ่านอย่างเดียว' : undefined}
      avatars={avatars ? Object.values(avatars) : undefined}
      footer={
        !finished && !hideControls ? (
          <div className="flex flex-wrap gap-2 border-t border-brand-100 bg-white/70 px-3 py-3">
            <QuickChip
              onClick={() => {
                buzz()
                onNext()
              }}
              disabled={typing}
            >
              ต่อเลย
            </QuickChip>
            <QuickChip
              onClick={() => {
                buzz()
                onAll()
              }}
            >
              แสดงทั้งหมด
            </QuickChip>
          </div>
        ) : null
      }
    >
      <ol className="flex flex-1 flex-col gap-2.5 px-3 py-4" aria-live="polite">
        {chat.slice(0, visible).map((msg, i) => {
          const part = parts?.find((p) => p.start === i + 1)
          const hi = highlight ? i + 1 >= highlight.from && i + 1 <= highlight.to : false
          const right = primaryRight ? msg.who === 'a' : msg.who === 'b'
          return (
            <div key={i} className="contents">
              {part ? (
                <li className="chat-part my-1 self-center rounded-full px-4 py-1.5 text-center text-label font-bold">
                  {part.title}
                </li>
              ) : null}
              <Bubble
                liRef={hi && i + 1 === highlight?.from ? firstHi : undefined}
                name={msg.name}
                side={right ? 'right' : 'left'}
                avatar={avatars?.[msg.name]}
                tone={right ? 'me' : msg.who === 'dome' ? 'dome' : 'friend'}
                highlight={hi}
              >
                {msg.text}
              </Bubble>
            </div>
          )
        })}
        {typing && next ? (
          <li className={cn('flex flex-col', (primaryRight ? next.who === 'a' : next.who === 'b') ? 'items-end self-end' : 'items-start self-start')}>
            <span className="px-1 pb-0.5 text-label font-bold text-ink-muted">{next.name}</span>
            <div className="rounded-[20px] bg-white px-4 py-3 shadow-soft-1 ring-1 ring-brand-100">
              <TypingDots />
            </div>
          </li>
        ) : null}
        <div ref={endRef} />
      </ol>

      <AnimatePresence initial={false}>
        {finished && summary ? (
          <motion.div
            key="summary"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="mx-3 mb-3 overflow-hidden rounded-2xl bg-white shadow-soft-1 ring-1 ring-brand-100"
          >
            <table className="w-full border-collapse text-left">
              <caption className="bg-brand-50 px-4 py-2 text-left text-label font-bold text-brand-700">
                สรุปโครงสร้างชื่อโดเมน
              </caption>
              <thead className="sr-only">
                <tr>
                  <th>ลำดับ</th>
                  <th>ส่วน ความหมาย และตัวอย่าง</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['1', 'TLD', 'ขวาสุด บอกกลุ่มใหญ่ของเว็บ', '.com .org .net', 'bg-spark-100 text-spark-700'],
                  ['2', 'SLD', 'ตรงกลาง ชื่อหลักของร้าน', 'kanombanyai', 'bg-brand-100 text-brand-700'],
                  ['3', 'Subdomain', 'ซ้ายสุด บริการย่อย', 'www', 'bg-quest-100 text-quest-700'],
                ].map(([n, k, v, ex, c]) => (
                  <tr key={k} className={cn(c)}>
                    <td className="w-12 py-3 pl-4">
                      <span className="grid size-7 place-items-center rounded-full bg-white/80 text-label font-extrabold">
                        {n}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-body font-extrabold">{k}</span>
                        <span className="text-body font-bold whitespace-nowrap text-ink">{ex}</span>
                      </span>
                      <span className="block text-label text-pretty text-ink">{v}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {finished && quick ? (
        <div className="flex flex-col gap-2.5 border-t border-brand-100 px-3 py-4">
          <ul className="flex flex-col gap-2.5" aria-live="polite">
            <Bubble name="โดม" side="left" tone="dome">
              {quick.prompt}
            </Bubble>
            {picked !== null ? (
              <>
                <Bubble side="right" tone="me">
                  {'ABCDEF'[picked]}. {quick.choices[picked]!.text}
                </Bubble>
                <Bubble name="โดม" side="left" tone="dome">
                  <span
                    className={cn(
                      'mb-1 block w-fit rounded-full px-2.5 py-0.5 text-label font-extrabold',
                      quick.choices[picked]!.ok ? 'bg-quest-100 text-quest-700' : 'bg-spark-100 text-spark-700',
                    )}
                  >
                    {quick.choices[picked]!.ok ? 'ถูกต้อง' : 'ยังไม่ใช่'}
                  </span>
                  {quick.choices[picked]!.reply}
                </Bubble>
              </>
            ) : null}
          </ul>
          <div className="flex flex-wrap gap-2" role="group" aria-label="ตัวเลือกตอบด่วน">
            {quick.choices.map((c, i) => (
              <QuickChip
                key={c.text}
                tone={picked === i ? (c.ok ? 'ok' : 'no') : undefined}
                onClick={() => {
                  buzz()
                  setPicked(i)
                  setTimeout(
                    () => quickEnd.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' }),
                    80,
                  )
                }}
              >
                {'ABCDEF'[i]}. {c.text}
              </QuickChip>
            ))}
          </div>
          <div ref={quickEnd} />
        </div>
      ) : null}
    </ChatFrame>
  )
}

export function QuickChip({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'ok' | 'no'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-12 rounded-full px-5 py-1.5 text-body font-bold ring-2 transition-transform active:scale-95 disabled:opacity-50 focus-ring',
        tone === 'ok'
          ? 'bg-quest-100 text-quest-700 ring-quest-500'
          : tone === 'no'
            ? 'bg-spark-100 text-spark-700 ring-spark-500'
            : 'bg-[#fffaf0] text-[#5a3214] ring-[#c99a5e] shadow-[0_3px_0_rgba(116,67,29,0.35)]',
      )}
    >
      {children}
    </button>
  )
}

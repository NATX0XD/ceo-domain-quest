'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DomeAvatar, cn } from '@/components/ui'
import { TypingDots, buzz } from './fx'

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
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col overflow-hidden rounded-[24px] bg-[#f4f0fb] shadow-soft-2 ring-1 ring-brand-100">
      <div className="flex items-center gap-3 bg-gradient-to-r from-brand-700 to-brand-600 px-4 py-3 text-ink-onbrand">
        <DomeAvatar mood="greet" size={40} decorative />
        <div className="min-w-0">
          <p className="truncate text-body font-bold">{title}</p>
          <p className="flex items-center gap-1.5 text-label">
            <span className="size-2 rounded-full bg-quest-300" aria-hidden />
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
}: {
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
      className={cn('flex max-w-[88%] flex-col', side === 'right' ? 'items-end self-end' : 'items-start self-start')}
    >
      {name ? <span className="px-1 pb-0.5 text-label font-bold text-ink-muted">{name}</span> : null}
      <div
        className={cn(
          'px-4 py-2.5 text-body leading-relaxed whitespace-pre-line shadow-soft-1',
          tone === 'me' && 'rounded-[20px] rounded-br-md bg-brand-600 text-ink-onbrand',
          tone === 'dome' && 'rounded-[20px] rounded-bl-md bg-white text-ink ring-1 ring-brand-100',
          tone === 'friend' && 'rounded-[20px] rounded-bl-md bg-spark-100 text-ink',
          highlight && 'ring-2 ring-spark-500',
        )}
      >
        {children}
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
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const reduce = useReducedMotion()
  const [visible, setVisible] = useState(shown > 1 ? shown : Math.min(1, shown))
  const endRef = useRef<HTMLDivElement>(null)
  const firstHi = useRef<HTMLLIElement>(null)
  const quickEnd = useRef<HTMLDivElement>(null)
  const typing = visible < shown
  const next = chat[visible]

  useEffect(() => {
    if (visible >= shown) return
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
      footer={
        !finished ? (
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
          return (
            <div key={i} className="contents">
              {part ? (
                <li className="my-1 self-center rounded-full bg-brand-100 px-4 py-1.5 text-center text-label font-bold text-brand-700">
                  {part.title}
                </li>
              ) : null}
              <Bubble
                liRef={hi && i + 1 === highlight?.from ? firstHi : undefined}
                name={msg.name}
                side={msg.who === 'b' ? 'right' : 'left'}
                tone={msg.who === 'b' ? 'me' : msg.who === 'dome' ? 'dome' : 'friend'}
                highlight={hi}
              >
                {msg.text}
              </Bubble>
            </div>
          )
        })}
        {typing && next ? (
          <li className={cn('flex flex-col', next.who === 'b' ? 'items-end self-end' : 'items-start self-start')}>
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
            : 'bg-white text-brand-700 ring-brand-300',
      )}
    >
      {children}
    </button>
  )
}

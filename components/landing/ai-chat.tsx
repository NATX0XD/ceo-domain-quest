'use client'

import { AnimatePresence, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Pic } from './pic'

type Msg = { id: number; who: 'me' | 'dome'; text: string; time: string; lock?: boolean }
type Pose = 'greet' | 'think' | 'explain' | 'happy' | 'cheer'

const SCRIPT: Omit<Msg, 'id'>[] = [
  { who: 'me', text: 'โดเมนคืออะไร', time: '10:41' },
  { who: 'dome', text: 'เหมือนที่อยู่ของเว็บ ให้คนหาร้านเธอเจอครับ', time: '10:41' },
  { who: 'me', text: 'ช่วยทำการบ้านวิชาอื่นหน่อย', time: '10:42' },
  { who: 'dome', text: 'โดมช่วยเรื่องบทเรียนนี้นะครับ ลองถามเรื่องโดเมนดูไหม', time: '10:42', lock: true },
]

const ANSWERS: Record<string, string> = {
  'โดเมนคืออะไร': 'เหมือนที่อยู่ของเว็บ ให้คนหาร้านเธอเจอครับ',
  '.com กับ .th ต่างกันยังไง': '.com ใช้ได้ทั่วโลก ส่วน .th เป็นของไทย ต้องมีเอกสารยืนยันครับ',
  'DNS ทำงานยังไง': 'DNS เหมือนสมุดโทรศัพท์ แปลงชื่อเว็บเป็นเลข IP ให้เครื่องหาเจอครับ',
}
const SUGGESTIONS = Object.keys(ANSWERS)
const FALLBACK = 'ในเกมจริงโดมตอบได้ทุกเรื่องในบทเรียนเลย เข้าห้องแล้วถามได้นะครับ'

const now = () => new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())

/** แชตกับโดมแบบเล่นได้จริง: เล่นบทตัวอย่างเมื่อเลื่อนถึง แล้วกดคำถามแนะนำ/พิมพ์เองได้ */
export function AiChat() {
  const box = useRef<HTMLDivElement>(null)
  const thread = useRef<HTMLDivElement>(null)
  const seen = useInView(box, { once: true, amount: 0.4 })
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [pose, setPose] = useState<Pose>('greet')
  const [text, setText] = useState('')
  const timers = useRef<number[]>([])
  const nextId = useRef(0)

  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
  const push = (m: Omit<Msg, 'id'>) => setMsgs((list) => [...list, { ...m, id: nextId.current++ }])

  useEffect(() => {
    if (!seen) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMsgs(SCRIPT.map((m, i) => ({ ...m, id: i })))
      nextId.current = SCRIPT.length
      setPose('explain')
      return
    }
    let t = 300
    SCRIPT.forEach((m) => {
      if (m.who === 'dome') {
        later(t, () => { setTyping(true); setPose('think') })
        t += 1300
        later(t, () => { setTyping(false); push(m); setPose(m.lock ? 'happy' : 'explain') })
      } else {
        later(t, () => push(m))
      }
      t += 1100
    })
    const list = timers.current
    return () => list.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen])

  useEffect(() => {
    const el = thread.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, typing])

  const ask = (q: string) => {
    const question = q.trim()
    if (!question || typing) return
    push({ who: 'me', text: question, time: now() })
    setPose('think')
    later(250, () => setTyping(true))
    later(1400, () => {
      setTyping(false)
      push({ who: 'dome', text: ANSWERS[question] ?? FALLBACK, time: now() })
      setPose('cheer')
    })
  }
  const submit = (e: FormEvent) => { e.preventDefault(); ask(text); setText('') }

  return (
    <div className="ld-ai2" ref={box}>
      <div className="ld-ai2-dome" aria-hidden>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={pose}
            className="ld-ai2-pose"
            initial={{ opacity: 0, scale: 0.86, y: 14, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          >
            <Pic className="ld-dome" src={`/dome/mascot/dome-${pose}.webp`} alt="" width={480} height={532} sizes="320px" />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {typing && (
            <motion.span className="ld-ai2-thought" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
              <i /><i /><i />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="ld-cw" aria-label="ตัวอย่างบทสนทนากับโดม">
        <header className="ld-cw-head">
          <span className="ld-cw-avatar ld-cw-avatar--dome ld-cw-avatar--lg"><Pic src="/dome/mascot/dome-greet.webp" alt="" width={56} height={56} /></span>
          <span className="ld-cw-who">
            <b>น้องโดม</b>
            <small className={typing ? 'is-typing' : ''}><i aria-hidden />{typing ? 'กำลังพิมพ์…' : 'ออนไลน์'}</small>
          </span>
          <span className="ld-cw-lock"><Pic src="/icons/3d/locked.webp" alt="" width={16} height={16} />เฉพาะบทเรียน</span>
        </header>
        <div className="ld-cw-thread" ref={thread} aria-live="polite">
          <div className="ld-cw-day">วันนี้</div>
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <motion.div
                key={m.id}
                layout="position"
                className={`ld-cw-row ld-cw-row--${m.who}`}
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              >
                {m.who === 'dome'
                  ? <span className="ld-cw-avatar ld-cw-avatar--dome"><Pic src="/dome/mascot/dome-greet.webp" alt="" width={36} height={36} /></span>
                  : <span className="ld-cw-avatar ld-cw-avatar--me" aria-hidden>ฉัน</span>}
                <div className={`ld-cw-msg ld-cw-msg--${m.who}`}>
                  <p>{m.text}</p>
                  {m.lock && <span className="ld-cw-lockline"><Pic src="/icons/3d/locked.webp" alt="" width={14} height={14} />ล็อกไว้เฉพาะบทเรียน</span>}
                  <time>{m.time}</time>
                </div>
              </motion.div>
            ))}
            {typing && (
              <motion.div key="typing" className="ld-cw-row ld-cw-row--dome" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="ld-cw-avatar ld-cw-avatar--dome"><Pic src="/dome/mascot/dome-greet.webp" alt="" width={36} height={36} /></span>
                <div className="ld-cw-msg ld-cw-msg--dome ld-cw-dots" aria-label="น้องโดมกำลังพิมพ์"><i /><i /><i /></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="ld-cw-chips" aria-label="คำถามแนะนำ">
          {SUGGESTIONS.map((q) => <button type="button" key={q} onClick={() => ask(q)}>{q}</button>)}
        </div>
        <form className="ld-cw-input" onSubmit={submit}>
          <input aria-label="ถามโดมเรื่องบทเรียน" placeholder="ถามโดมเรื่องบทเรียน…" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} />
          <button type="submit" aria-label="ส่งข้อความ"><span aria-hidden>➤</span></button>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Image from 'next/image'

/**
 * ถามโดม (ฝั่งครู) — ปุ่มลอยมุมขวาล่าง + แผงแชท ถามเรื่องนักเรียนในห้องที่เลือกอยู่
 * ตอบจาก POST /api/teacher/assistant (ข้อมูลห้องจริง · AI ไม่ว่าง = สรุปจากกฎ ป้ายบอกชัด)
 * ⚠️ ไม่เก็บบทสนทนาไว้ที่ไหน (อยู่ใน state เท่านั้น) · เปลี่ยนห้อง = เริ่มบทสนทนาใหม่
 */

const SEEN_KEY = 'dbq-dome-assist-seen'
const CHIPS = ['สรุปห้องนี้', 'ใครยังไม่เริ่ม', 'ใครติดภารกิจไหนบ้าง', 'ควรช่วยใครก่อน'] as const
const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

interface Msg {
  role: 'teacher' | 'dome'
  text: string
  source?: 'ai' | 'fallback'
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === 'teacher') {
    return <div className="dome-ask-msg dome-ask-msg-me">{msg.text}</div>
  }
  const lines = msg.text.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div className="dome-ask-msg dome-ask-msg-dome">
      {lines.map((l, i) =>
        l.startsWith('- ') ? (
          <p key={i} className="dome-ask-li">{l.slice(2).replace(/\*\*/g, '')}</p>
        ) : (
          <p key={i}>{l.replace(/\*\*/g, '')}</p>
        ),
      )}
      {msg.source === 'fallback' ? <span className="dome-ask-tag">สรุปจากข้อมูล (AI ไม่ว่าง)</span> : null}
    </div>
  )
}

export function DomeAssistant({ classroomId, raised = false }: { classroomId: string; raised?: boolean }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [pulse, setPulse] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!window.localStorage.getItem(SEEN_KEY)) setPulse(true)
  }, [])

  // เปลี่ยนห้อง = เริ่มใหม่ ไม่ให้คำตอบของห้องเก่าค้าง
  useEffect(() => {
    abortRef.current?.abort()
    setMsgs([])
    setBusy(false)
  }, [classroomId])

  const close = useCallback(() => {
    setOpen(false)
    fabRef.current?.focus()
  }, [])

  const openPanel = () => {
    setOpen(true)
    if (pulse) {
      setPulse(false)
      window.localStorage.setItem(SEEN_KEY, '1')
    }
  }

  // โฟกัสช่องพิมพ์ + ขนาดตามคีย์บอร์ดมือถือ (visualViewport)
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus({ preventScroll: true })
    const vv = window.visualViewport
    const sync = () => {
      const el = panelRef.current
      if (!el || !vv) return
      el.style.setProperty('--dome-vh', `${Math.round(vv.height)}px`)
      el.style.setProperty('--dome-top', `${Math.round(vv.offsetTop)}px`)
    }
    sync()
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
    }
  }, [open])

  // Esc ปิดได้แม้โฟกัสหลุดออกนอกแผง (เช่นปุ่มคำถามแนะนำหายไปหลังกด)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [msgs, busy, open])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const send = async (raw: string) => {
    const q = raw.trim().slice(0, 500)
    if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'teacher', text: q }]
    setMsgs(next)
    setText('')
    setBusy(true)
    inputRef.current?.focus({ preventScroll: true })
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch('/api/teacher/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classroomId, messages: next.slice(-6).map(({ role, text: t }) => ({ role, text: t })) }),
        signal: ctrl.signal,
      })
      const body = (await res.json().catch(() => null)) as { reply?: string; source?: 'ai' | 'fallback'; message?: string } | null
      if (ctrl.signal.aborted) return
      setMsgs((cur) => [
        ...cur,
        res.ok && body?.reply
          ? { role: 'dome', text: body.reply, source: body.source }
          : { role: 'dome', text: body?.message ?? 'ตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้งครับ' },
      ])
    } catch {
      if (!ctrl.signal.aborted) setMsgs((cur) => [...cur, { role: 'dome', text: 'เชื่อมต่อไม่ได้ในตอนนี้ ลองใหม่อีกครั้งครับ' }])
    } finally {
      if (!ctrl.signal.aborted) setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void send(text)
  }

  return (
    <>
      {!open ? (
        <button
          ref={fabRef}
          type="button"
          onClick={openPanel}
          aria-label="ถามโดม ผู้ช่วยดูข้อมูลนักเรียนในห้อง"
          aria-haspopup="dialog"
          data-raised={raised || undefined}
          data-pulse={pulse || undefined}
          className="dome-ask-fab focus-ring"
        >
          <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-full" />
        </button>
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dome-ask-title"
          className="dome-ask-panel"
          onKeyDown={onKeyDown}
        >
          <header className="dome-ask-head">
            <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="rounded-full" />
            <div className="min-w-0 flex-1">
              <h2 id="dome-ask-title">ถามโดม</h2>
              <p>ดูจากข้อมูลห้องที่เลือกอยู่</p>
            </div>
            <button type="button" onClick={close} aria-label="ปิดแผงถามโดม" className="dome-ask-x focus-ring">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div ref={listRef} className="dome-ask-list" aria-live="polite" aria-relevant="additions">
            {msgs.length === 0 ? (
              <div className="dome-ask-empty">
                <p>สวัสดีครับ อยากรู้อะไรเกี่ยวกับนักเรียนในห้องนี้ ถามได้เลยครับ</p>
                <div className="dome-ask-chips">
                  {CHIPS.map((c) => (
                    <button key={c} type="button" onClick={() => void send(c)} className="dome-ask-chip focus-ring">{c}</button>
                  ))}
                </div>
              </div>
            ) : (
              msgs.map((m, i) => <Bubble key={i} msg={m} />)
            )}
            {busy ? (
              <div className="dome-ask-msg dome-ask-msg-dome" role="status">
                <span className="dome-ask-dots" aria-hidden><i /><i /><i /></span>
                <span className="sr-only">โดมกำลังดูข้อมูล</span>
              </div>
            ) : null}
          </div>

          <form onSubmit={submit} className="dome-ask-form">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void send(text)
                }
              }}
              rows={1}
              maxLength={500}
              placeholder="เช่น ใครติด M3"
              aria-label="พิมพ์คำถามถึงโดม"
              className="dome-ask-input focus-ring"
            />
            <button type="submit" disabled={busy || !text.trim()} className="dome-ask-send focus-ring">ส่ง</button>
          </form>
        </div>
      ) : null}
    </>
  )
}

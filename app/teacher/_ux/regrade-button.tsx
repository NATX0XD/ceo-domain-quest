'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/** ปุ่ม "ให้ AI ตรวจตอนนี้" — เรียก /api/teacher/regrade แล้ว refresh หน้าเป็นระยะ (สูงสุด ~60 วิ) */
export function RegradeButton({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'busy' | 'waiting' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  async function run() {
    setState('busy')
    setMsg('')
    try {
      const res = await fetch('/api/teacher/regrade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ submissionId }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        setState('error')
        setMsg(body?.message ?? 'สั่งตรวจไม่สำเร็จ')
        return
      }
      setState('waiting')
      let n = 0
      timer.current = setInterval(() => {
        n += 1
        router.refresh()
        if (n >= 12 && timer.current) {
          clearInterval(timer.current)
          setState('idle')
        }
      }, 5000)
    } catch {
      setState('error')
      setMsg('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={state === 'busy' || state === 'waiting'}
        className="inline-flex min-h-10 items-center rounded-xl bg-[var(--c-brand)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
      >
        {state === 'busy' ? 'กำลังสั่ง…' : state === 'waiting' ? 'AI กำลังตรวจ…' : 'ให้ AI ตรวจตอนนี้'}
      </button>
      {msg ? <span role="alert" className="text-[13px] text-danger-700">{msg}</span> : null}
    </span>
  )
}

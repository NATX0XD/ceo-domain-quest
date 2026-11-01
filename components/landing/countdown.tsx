'use client'

import { useEffect, useState } from 'react'

export type OpenState = { ready: boolean; open: boolean; left: number | null }

/** นับถอยหลังถึง NEXT_PUBLIC_OPEN_AT — ฝั่งเซิร์ฟเวอร์ยังไม่รู้เวลา จึง ready=false จนกว่าจะ mount (กัน hydration ไม่ตรง) */
export function useOpenState(openAt: string | null): OpenState {
  const target = openAt ? new Date(openAt).getTime() : NaN
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (Number.isNaN(target)) return
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])
  if (Number.isNaN(target)) return { ready: true, open: false, left: null }
  if (now === null) return { ready: false, open: false, left: null }
  const left = Math.max(0, target - now)
  return { ready: true, open: left === 0, left }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function Countdown({ openAt }: { openAt: string | null }) {
  const { ready, open, left } = useOpenState(openAt)
  if (!openAt || open) return null
  const s = left === null ? null : Math.floor(left / 1000)
  const cells = [
    ['วัน', s === null ? '--' : pad(Math.floor(s / 86400))],
    ['ชม.', s === null ? '--' : pad(Math.floor((s % 86400) / 3600))],
    ['นาที', s === null ? '--' : pad(Math.floor((s % 3600) / 60))],
    ['วิ', s === null ? '--' : pad(s % 60)],
  ]
  return (
    <div className="ld-count" role="timer" aria-label="เวลาที่เหลือก่อนเปิดให้เล่น" data-ready={ready}>
      {cells.map(([lab, num]) => (
        <div className="ld-count-cell" key={lab}>
          <span className="ld-count-num">{num}</span>
          <span className="ld-count-lab">{lab}</span>
        </div>
      ))}
    </div>
  )
}

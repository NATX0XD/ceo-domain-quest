'use client'

import { useState } from 'react'

/** ข้อความครูถึงผู้เรียน — ยาวเกินก็ตัดไว้ 2–3 บรรทัด มีปุ่ม "อ่านเพิ่มเติม" ขยายได้ */
export function TeacherNote({ note, lines = 3, className = '' }: { note: string; lines?: 2 | 3; className?: string }) {
  const [open, setOpen] = useState(false)
  const long = note.length > (lines === 2 ? 60 : 90)
  return (
    <div className={`text-left ${className}`}>
      <p className={`text-label text-pretty text-ink ${!open && long ? (lines === 2 ? 'line-clamp-2' : 'line-clamp-3') : ''}`}>
        <span className="font-extrabold text-brand-700">ครูเขียนถึงเรา: </span>“{note}”
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1 min-h-8 text-note font-extrabold text-brand-700 underline underline-offset-2"
        >
          {open ? 'ย่อลง' : 'อ่านเพิ่มเติม'}
        </button>
      ) : null}
    </div>
  )
}

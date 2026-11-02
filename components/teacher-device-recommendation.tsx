'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'dbq-teacher-device-tip-dismissed'

/** แถบแนะนำแบบเงียบ ๆ (ข้อความล้วน) บนจอแคบ — ปิดได้ จำค่าไว้ในเครื่อง */
export function TeacherDeviceRecommendation() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const sync = () => setOpen(media.matches && window.localStorage.getItem(STORAGE_KEY) !== '1')
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="region"
      aria-label="คำแนะนำการใช้งาน"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--s-info-soft)] bg-[var(--s-info-soft)] px-4 py-2 text-[14px] text-[var(--s-info-ink)]"
    >
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">ใช้งานได้ดีที่สุดบนคอมพิวเตอร์</strong> แผงครูและรายงานอ่านง่ายกว่าบนจอใหญ่
      </p>
      <button type="button" onClick={copyLink} className="font-semibold underline underline-offset-2">
        {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์'}
      </button>
      <button type="button" onClick={dismiss} className="font-semibold underline underline-offset-2">
        ปิด
      </button>
    </div>
  )
}

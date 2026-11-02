'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'dbq-teacher-device-tip-dismissed'

export function TeacherDevicePopup() {
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
    <div className="teacher-device-overlay" role="presentation">
      <section className="teacher-device-dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-device-title">
        <img
          src="/ui/teacher/use-computer.webp"
          alt="โดมชี้ไปที่แล็ปท็อปสำหรับแผงครู และโทรศัพท์มีสัญลักษณ์จำกัดการใช้งาน"
          className="teacher-device-art"
        />
        <div className="teacher-device-copy">
          <p className="teacher-device-kicker">แผงครูพร้อมลุย</p>
          <h2 id="teacher-device-title">แนะนำให้ใช้คอมพิวเตอร์</h2>
          <p>แดชบอร์ดครู กระดานฉาย และรายงานทำงานได้ครบและอ่านง่ายที่สุดบนโน้ตบุ๊กหรือคอมพิวเตอร์</p>
        </div>
        <div className="teacher-device-actions">
          <button type="button" className="game-button game-button--primary" onClick={dismiss}>
            เข้าใจแล้ว ใช้ต่อบนมือถือ
          </button>
          <button type="button" className="game-button game-button--secondary" onClick={copyLink}>
            {copied ? 'คัดลอกลิงก์แล้ว' : 'ส่งลิงก์ไปเปิดบนคอม'}
          </button>
        </div>
        {copied ? <p className="teacher-device-toast" role="status">คัดลอกลิงก์หน้านี้แล้ว ส่งให้ตัวเองเปิดบนคอมได้เลย</p> : null}
      </section>
    </div>
  )
}

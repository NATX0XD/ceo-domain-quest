'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * หน้า /result ตอน AI ยังตรวจใบเสนอ CEO ไม่เสร็จ — ถาม /api/grade/status ทุก 3 วิ
 * พอ AI ตรวจเสร็จ (หรือล้ม) ก็ refresh หน้าให้คะแนนใหม่ขึ้นเอง
 * ถามไม่เกิน ~45 วิ แล้วหยุด คะแนนจากกฎที่โชว์อยู่ใช้ได้อยู่แล้ว ไม่มีอะไรรอ
 */
export function ResultGradePoll() {
  const router = useRouter()
  useEffect(() => {
    let tries = 0
    let stopped = false
    const timer = window.setInterval(async () => {
      if (stopped) return
      tries += 1
      if (tries > 15) {
        window.clearInterval(timer)
        return
      }
      try {
        const res = await fetch('/api/grade/status', { cache: 'no-store' })
        if (!res.ok) return
        const body = (await res.json()) as { aiCheck?: string }
        if (body.aiCheck && body.aiCheck !== 'in-progress') {
          stopped = true
          window.clearInterval(timer)
          router.refresh()
        }
      } catch {
        // เน็ตสะดุด ลองรอบหน้า
      }
    }, 3000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [router])
  return null
}

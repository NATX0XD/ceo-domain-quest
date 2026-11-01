'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/** ลิงก์ไปคู่มือ: หมอกวาร์ปแบบเข้าเกาะภารกิจ แล้วค่อยเปลี่ยนหน้า (หน้า manual จะคลายหมอกต่อ) */
export function ManualWarp() {
  const router = useRouter()
  const [warping, setWarping] = useState(false)
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element | null)?.closest?.('a[href^="/landing/manual"]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      event.preventDefault()
      const href = link.getAttribute('href') ?? '/landing/manual'
      sessionStorage.setItem('manual-warp', '1')
      setWarping(true)
      router.prefetch(href)
      window.setTimeout(() => router.push(href), 720)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [router])
  useEffect(() => {
    document.querySelector('.ld-viewport')?.classList.toggle('is-warping', warping)
  }, [warping])
  return warping ? <div className="map-fog-transition ld-warp-fog" role="status" aria-live="polite">กำลังพาไปคู่มือ</div> : null
}

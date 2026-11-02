'use client'

import { useEffect } from 'react'

/** ลงทะเบียน service worker เฉพาะ production เพื่อให้ Chrome/Android ขึ้นปุ่มติดตั้ง */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  }, [])
  return null
}

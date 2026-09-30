'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * จุดเต้นของหัวใจกลาง — บอกเซิร์ฟเวอร์ว่า "คนนี้ยังนั่งอยู่หน้าจอ"
 *
 * วางไว้ที่เดียวใน `components/session-clock.tsx` ซึ่งเรนเดอร์อยู่ทุกหน้าของนักเรียนแล้ว
 * จึงครอบคลุมทุกหน้าโดยไม่ต้องไปไล่แปะรายหน้า (และไม่มีหน้าไหนลืมได้)
 *
 * **ทำไมต้องมี**: เกณฑ์คู่หู E-04 = "ใช้งานใน 60 วินาทีที่ผ่านมา" อ่านจาก `students.last_seen_at`
 * ก่อนหน้านี้ `touchStudentPresence()` ไม่มีผู้เรียกกลางเลย คอลัมน์จึงว่างตลอดและจับคู่ไม่ได้สักคน
 *
 * กติกาที่ตั้งใจให้เป็น:
 *  - เต้นทุก 30 วินาที = ครึ่งหนึ่งของเกณฑ์ 60 วินาที เผื่อพลาดไป 1 จังหวะยังไม่หลุดเกณฑ์
 *  - **แท็บถูกซ่อน/พับ/สลับไปแอปอื่น = หยุดเต้นทันที** (ไม่กินแบต และไม่โกหกว่ายังนั่งอยู่)
 *    กลับมาเห็นจอเมื่อไหร่ค่อยเต้นทันที 1 ครั้งแล้วเริ่มนับใหม่
 *  - ยังไม่ได้เข้าห้อง (401) = หยุดถาวร ไม่ยิงซ้ำเปล่า ๆ บนหน้า /join หรือหน้าครู
 *  - เน็ตสะดุดไม่ขึ้นข้อความอะไรให้เด็กเห็น รอบหน้าค่อยว่ากัน
 *
 * ⚠️ คอมโพเนนต์นี้ไม่เรนเดอร์อะไรเลย (คืน null) และไม่เก็บข้อมูลผู้เรียนไว้ในเครื่อง
 */

/** เต้นทุกกี่มิลลิวินาที — ครึ่งหนึ่งของเกณฑ์ 60 วินาทีของ E-04 */
const BEAT_MS = 30_000

/**
 * แปลงเส้นทางของหน้าเป็นรหัสหน้าจอที่ฐานข้อมูลใช้จริง
 *
 * `buddy_candidates_raw` ตัดคนที่ `current_screen` อยู่ใน ('boss', 'help-waiting') ออกจากรายชื่อคู่หู
 * (กำลังทำด่านบอสอยู่ ไม่ควรถูกดึงไปช่วยคนอื่น) ถ้าส่งเส้นทางดิบ "/ceo" ไปตรง ๆ เงื่อนไขนั้น
 * จะไม่ตรงสักครั้งเดียว — กลายเป็นกติกาที่เขียนไว้แต่ไม่เคยทำงาน แบบเดียวกับบั๊กเดิม
 */
function screenCodeOf(pathname: string | null): string {
  if (!pathname) return ''
  if (pathname === '/ceo') return 'boss'
  return pathname.slice(0, 64)
}

export function PresenceHeartbeat() {
  const pathname = usePathname()
  /** หน้าปัจจุบันอ่านจาก ref เพื่อให้ตัวจับเวลาไม่ต้องถูกสร้างใหม่ทุกครั้งที่เปลี่ยนหน้า */
  const screenRef = useRef(screenCodeOf(pathname))
  screenRef.current = screenCodeOf(pathname)

  useEffect(() => {
    /** true เมื่อเซิร์ฟเวอร์ตอบ 401 = หน้านี้ไม่มี session ของนักเรียน เลิกเต้นถาวร */
    let stopped = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function beat() {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ screen: screenRef.current }),
          // ให้จังหวะสุดท้ายส่งออกได้แม้หน้ากำลังจะถูกปิด
          keepalive: true,
        })
        if (res.status === 401) {
          stopped = true
          if (timer !== null) clearInterval(timer)
          timer = null
        }
      } catch {
        // เน็ตสะดุด — จังหวะถัดไปค่อยลองใหม่ ไม่ต้องบอกเด็ก
      }
    }

    function start() {
      if (stopped || timer !== null) return
      timer = setInterval(() => void beat(), BEAT_MS)
    }

    function stop() {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        // กลับมาดูจอ = เต้นทันทีหนึ่งครั้ง ไม่ต้องรออีก 30 วินาทีกว่าจะเข้าเกณฑ์คู่หู
        void beat()
        start()
      } else {
        stop()
      }
    }

    void beat()
    start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopped = true
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}

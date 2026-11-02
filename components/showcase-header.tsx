'use client'

import { useRouter } from 'next/navigation'
import { GameHeader } from '@/components/learn/game-header'

/** หัวจอ /showcase — ป้ายไม้ "ผลงานของฉัน" + ปุ่มไม้กลับหน้าหลัก (GameHeader ต้องการ onBack ฝั่ง client) */
export function ShowcaseHeader() {
  const router = useRouter()
  return (
    <GameHeader
      className="sc-game-header"
      title="ผลงานของฉัน"
      onBack={() => router.push('/home')}
      backLabel="กลับหน้าหลัก"
    />
  )
}

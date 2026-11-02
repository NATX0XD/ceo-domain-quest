'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon, CheckIcon, ShareIcon } from '@/components/ui'
import { Icon3d } from '@/app/teacher/_ux/v2'
import { Button, Card, EmptyState } from '@/app/teacher/_ux/ui'

/**
 * ปุ่มเปิดห้องใหม่ + ป้ายรหัสห้องตัวใหญ่สำหรับฉายขึ้นจอ
 *
 * ⚠️ รหัสห้องมาจากเซิร์ฟเวอร์ (POST /api/teacher/classroom) เท่านั้น ไม่สุ่มเองในเบราว์เซอร์
 * ยังไม่มีไลบรารี QR ในโปรเจกต์ จึงแสดงลิงก์เต็มให้พิมพ์หรือแปะแทนไปก่อน (ถามไว้ใน bus แล้ว)
 */
export function TeacherRoomClient({
  roomCode,
  joinPath,
}: {
  roomCode: string | null
  joinPath: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function createRoom() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher/classroom', { method: 'POST' })
      const data = (await res.json().catch(() => null)) as { message?: string } | null
      if (!res.ok) {
        setError(data?.message ?? 'เปิดห้องไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      router.refresh()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}${joinPath}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(`คัดลอกไม่ได้ พิมพ์ลิงก์นี้แทน: ${url}`)
    }
  }

  /* ยังไม่มีห้อง → นี่คือปุ่มหลักหนึ่งเดียวของหน้า · มีห้องแล้ว → ลดเป็นปุ่มรอง
     เพื่อไม่ให้ครูเผลอกดเปิดห้องใหม่ทับห้องที่กำลังฉายอยู่ */
  const createRoomButton = (
    <Button kind={roomCode ? 'secondary' : 'primary'} onClick={createRoom} disabled={busy} className="w-full">
      {busy ? 'กำลังเปิดห้อง…' : 'เปิดห้องใหม่'}
    </Button>
  )

  return (
    <section className="flex flex-col gap-3">
      {roomCode ? (
        <Card title="รหัสห้อง" className="text-center">
          {/* ตัวใหญ่พิเศษเพราะรหัสนี้ถูกฉายขึ้นจอหน้าห้อง ต้องอ่านออกจากหลังห้อง */}
          <p className="text-[2.5rem] leading-tight font-bold tracking-[0.18em] break-all text-[var(--c-brand)] sm:text-[3.5rem]">
            {roomCode}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button kind="primary" onClick={copyLink} className="w-full">
              {copied ? <CheckIcon width={18} height={18} aria-hidden /> : <ShareIcon width={18} height={18} aria-hidden />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
            </Button>
            {createRoomButton}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<Icon3d name="school" size={28} />}
            title="ยังไม่มีห้องเรียน"
            body="กดเปิดห้อง แล้วรหัส 6 ตัวจะขึ้นให้ฉาย"
            action={<div className="w-56">{createRoomButton}</div>}
          />
        </Card>
      )}

      {/* ข้อความผิดมีไอคอนคู่เสมอ ไม่ได้สื่อด้วยสีแดงอย่างเดียว (WCAG 1.4.1) */}
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-[14px] font-medium break-all"
          style={{ background: 'var(--s-danger-soft)', color: 'var(--s-danger-ink)' }}
        >
          <AlertIcon width={20} height={20} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </section>
  )
}

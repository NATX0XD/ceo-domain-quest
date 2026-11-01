'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon, CheckIcon, ShareIcon } from '@/components/ui'
import { Icon3d } from '@/app/teacher/_ux/v2'

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
    <button
      type="button"
      onClick={createRoom}
      disabled={busy}
      className="t2-btn focus-ring"
      data-kind={roomCode ? undefined : 'primary'}
      data-block="true"
    >
      {busy ? 'กำลังเปิดห้อง…' : 'เปิดห้องใหม่'}
    </button>
  )

  return (
    <section className="flex flex-col gap-3">
      {roomCode ? (
        <div className="t2-card text-center" style={{ background: 'var(--t2-lilac)', borderColor: 'transparent' }}>
          <p className="flex items-center justify-center gap-2 text-label font-extrabold text-ink">
            <Icon3d name="school" size={32} />
            รหัสห้อง
          </p>
          {/* ตัวใหญ่พิเศษเพราะรหัสนี้ถูกฉายขึ้นจอหน้าห้อง ต้องอ่านออกจากหลังห้อง */}
          <p
            className="mt-1 text-[2.75rem] leading-tight font-black tracking-[0.18em] break-all sm:text-[4rem]"
            style={{ color: 'var(--t2-brand)' }}
          >
            {roomCode}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="t2-btn mt-3 focus-ring"
            data-kind="primary"
            data-block="true"
          >
            {copied ? (
              <CheckIcon width={20} height={20} aria-hidden />
            ) : (
              <ShareIcon width={20} height={20} aria-hidden />
            )}
            {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
          </button>
        </div>
      ) : (
        <div className="t2-card t2-empty">
          <Icon3d name="school" size={64} />
          <h2 className="text-title-sm font-extrabold text-ink">ยังไม่มีห้องเรียน</h2>
          <p className="text-label font-semibold text-ink-muted">กดเปิดห้อง แล้วรหัส 6 ตัวจะขึ้นให้ฉาย</p>
          <div className="w-full max-w-xs">{createRoomButton}</div>
        </div>
      )}

      {/* ข้อความผิดมีไอคอนคู่เสมอ ไม่ได้สื่อด้วยสีแดงอย่างเดียว (WCAG 1.4.1) */}
      {error ? (
        <p role="alert" className="t2-note break-all" data-tone="danger">
          <AlertIcon width={20} height={20} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {roomCode ? createRoomButton : null}
    </section>
  )
}

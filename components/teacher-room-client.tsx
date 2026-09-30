'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon, Button, CheckIcon, EmptyState, ShareIcon, UsersIcon } from '@/components/ui'

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
    <Button
      variant={roomCode ? 'secondary' : 'primary'}
      size="lg"
      fullWidth
      onClick={createRoom}
      disabled={busy}
      loading={busy}
      loadingLabel="กำลังเปิดห้อง"
    >
      เปิดห้องใหม่
    </Button>
  )

  return (
    <section>
      {roomCode ? (
        <div className="rounded-3xl bg-brand-600 p-5 text-center text-ink-onbrand shadow-soft-3">
          <p className="text-label font-bold">รหัสห้องสำหรับนักเรียน</p>
          {/* ตัวใหญ่พิเศษเพราะรหัสนี้ถูกฉายขึ้นจอหน้าห้อง ต้องอ่านออกจากหลังห้อง */}
          <p className="mt-1 text-[2.75rem] leading-tight font-black tracking-[0.18em] break-all sm:text-[4rem]">
            {roomCode}
          </p>
          <p className="mt-3 text-body">ให้นักเรียนเปิดเว็บแล้วกด “เข้าห้องเรียน”</p>
          <p className="mt-1 text-label break-all opacity-90">ลิงก์ตรง: {joinPath}</p>
          <Button
            variant="secondary"
            fullWidth
            className="mt-4"
            onClick={copyLink}
            leadingIcon={
              copied ? (
                <CheckIcon width={20} height={20} />
              ) : (
                <ShareIcon width={20} height={20} />
              )
            }
          >
            {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์เข้าห้อง'}
          </Button>
        </div>
      ) : (
        <EmptyState
          as="h2"
          title="ยังไม่มีห้องเรียน"
          description="กดเปิดห้องใหม่ แล้วรหัส 6 ตัวจะขึ้นตัวใหญ่ให้ฉายบนจอหน้าห้อง"
          illustration={<UsersIcon width={48} height={48} className="text-brand-400" />}
          action={createRoomButton}
        />
      )}

      {/* ข้อความผิดมีไอคอนคู่เสมอ ไม่ได้สื่อด้วยสีแดงอย่างเดียว (WCAG 1.4.1) */}
      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-2xl bg-danger-100 p-4 text-label font-semibold break-all text-danger-700"
        >
          <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {roomCode ? <div className="mt-3">{createRoomButton}</div> : null}
    </section>
  )
}

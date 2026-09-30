'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../../components/ui'
import { DangerButton } from '../_ux/dialog'

/**
 * ตั้งค่าคาบของห้องนี้ — สวิตช์ที่ครูกดนาน ๆ ครั้ง (UX-6 แยกออกจากหน้าคุมคาบสด)
 *
 * ทุกคำสั่งยิงไป `POST /api/teacher/session` ซึ่งตรวจเจ้าของห้องใน SQL เดียวกับที่เขียน
 * **ปิดคาบย้อนไม่ได้ จึงต้องกดยืนยันสองจังหวะ** (กติกาเดิมของ T-03)
 */

const POLL_MS = 5000

interface SessionInfo {
  id: string
  phase: string
  focus_screen: boolean
  survey_enabled: boolean
  pretest_enabled: boolean
  posttest_enabled: boolean
  ended_at: string | null
}

export function SessionSettings({ classroomId }: { classroomId: string | null }) {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/session?classroomId=${classroomId}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = (await res.json()) as { session?: SessionInfo }
      if (data.session) setSession(data.session)
    } catch {
      // เน็ตสะดุดรอบเดียว รอบหน้าค่อยว่ากัน
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const send = useCallback(
    async (body: Record<string, unknown>, okMessage: string) => {
      if (busy) return
      setBusy(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch('/api/teacher/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          message?: string
          session?: SessionInfo
        } | null
        if (!res.ok || !data?.ok) {
          setError(data?.message ?? 'สั่งงานไม่สำเร็จ ลองใหม่อีกครั้ง')
          return
        }
        if (data.session) setSession(data.session)
        setNotice(okMessage)
        await load()
      } catch {
        setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
      } finally {
        setBusy(false)
      }
    },
    [busy, load],
  )

  if (!classroomId) return null

  if (!session) {
    return (
      <Card as="section">
        <p className="text-label text-ink-muted">กำลังอ่านสถานะคาบ…</p>
      </Card>
    )
  }

  const toggle = (on: boolean) =>
    on
      ? 'bg-quest-600 text-ink-onbrand shadow-soft-1'
      : 'bg-surface-raised text-ink ring-1 ring-line-contrast ring-inset'

  return (
    <Card as="section">
      <h2 className="text-title-sm font-bold text-ink">สวิตช์ของคาบนี้</h2>
      <p className="mt-1 text-label text-ink-muted">
        กดแล้วเครื่องนักเรียนทุกเครื่องเปลี่ยนตามภายใน 3 วินาที
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            send(
              { action: 'focus', sessionId: session.id, on: !session.focus_screen },
              session.focus_screen ? 'เลิกให้ดูจอหน้าห้องแล้ว' : 'ให้ทุกคนดูจอหน้าห้องแล้ว',
            )
          }
          className={`btn-base w-full touch-manipulation ${toggle(session.focus_screen)}`}
        >
          {session.focus_screen ? 'เลิกให้ดูจอหน้าห้อง' : 'ให้ทุกคนดูจอหน้าห้อง'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            send(
              { action: 'settings', sessionId: session.id, surveyEnabled: !session.survey_enabled },
              session.survey_enabled ? 'ปิดแบบสอบถามแล้ว' : 'เปิดแบบสอบถามแล้ว',
            )
          }
          className={`btn-base w-full touch-manipulation ${toggle(session.survey_enabled)}`}
        >
          {session.survey_enabled ? 'ปิดแบบสอบถาม' : 'เปิดแบบสอบถามความพึงพอใจ'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            send(
              {
                action: 'test-window',
                sessionId: session.id,
                which: 'pre',
                enabled: !session.pretest_enabled,
              },
              session.pretest_enabled ? 'ปิดแบบทดสอบก่อนเรียนแล้ว' : 'เปิดแบบทดสอบก่อนเรียนแล้ว',
            )
          }
          className={`btn-base w-full touch-manipulation ${toggle(session.pretest_enabled)}`}
        >
          {session.pretest_enabled ? 'ปิดแบบทดสอบก่อนเรียน' : 'เปิดแบบทดสอบก่อนเรียน'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            send(
              {
                action: 'test-window',
                sessionId: session.id,
                which: 'post',
                enabled: !session.posttest_enabled,
              },
              session.posttest_enabled ? 'ปิดแบบทดสอบหลังเรียนแล้ว' : 'เปิดแบบทดสอบหลังเรียนแล้ว',
            )
          }
          className={`btn-base w-full touch-manipulation ${toggle(session.posttest_enabled)}`}
        >
          {session.posttest_enabled ? 'ปิดแบบทดสอบหลังเรียน' : 'เปิดแบบทดสอบหลังเรียน'}
        </button>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="text-label font-bold text-ink">ปิดคาบ</p>
        <p className="mt-1 text-note text-ink-muted">
          ปิดแล้วย้อนไม่ได้ · เปิดคาบใหม่ของห้องเดิมได้ แต่เวลาและช่วงจะเริ่มนับใหม่
        </p>
        <div className="mt-2 max-w-sm">
          <DangerButton
            label="ปิดคาบ"
            confirmLabel="กดอีกครั้งเพื่อปิดคาบจริง — ย้อนไม่ได้"
            confirming={confirmClose}
            disabled={busy || session.ended_at !== null}
            onArm={() => setConfirmClose(true)}
            onConfirm={async () => {
              await send({ action: 'close', sessionId: session.id }, 'ปิดคาบแล้ว')
              setConfirmClose(false)
            }}
          />
        </div>
      </div>

      {notice ? (
        <p role="status" className="mt-3 text-label font-bold text-quest-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-label font-bold text-danger-700">
          {error}
        </p>
      ) : null}
    </Card>
  )
}

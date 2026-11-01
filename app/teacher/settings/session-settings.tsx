'use client'

import { useCallback, useEffect, useState } from 'react'
import { DangerButton } from '../_ux/dialog'
import { Icon3d, InfoTip, type Icon3dName } from '../_ux/v2'

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
      <section className="t2-card">
        <p className="text-label font-bold text-ink-muted">กำลังอ่านสถานะคาบ…</p>
      </section>
    )
  }

  const tiles: {
    key: string
    label: string
    icon: Icon3dName
    on: boolean
    run: () => void
  }[] = [
    {
      key: 'focus',
      label: 'จอหน้าห้อง',
      icon: 'television',
      on: session.focus_screen,
      run: () =>
        send(
          { action: 'focus', sessionId: session.id, on: !session.focus_screen },
          session.focus_screen ? 'เลิกให้ดูจอหน้าห้องแล้ว' : 'ให้ทุกคนดูจอหน้าห้องแล้ว',
        ),
    },
    {
      key: 'survey',
      label: 'แบบสอบถาม',
      icon: 'sparkles',
      on: session.survey_enabled,
      run: () =>
        send(
          { action: 'settings', sessionId: session.id, surveyEnabled: !session.survey_enabled },
          session.survey_enabled ? 'ปิดแบบสอบถามแล้ว' : 'เปิดแบบสอบถามแล้ว',
        ),
    },
    {
      key: 'pre',
      label: 'ทดสอบก่อนเรียน',
      icon: 'memo',
      on: session.pretest_enabled,
      run: () =>
        send(
          {
            action: 'test-window',
            sessionId: session.id,
            which: 'pre',
            enabled: !session.pretest_enabled,
          },
          session.pretest_enabled ? 'ปิดแบบทดสอบก่อนเรียนแล้ว' : 'เปิดแบบทดสอบก่อนเรียนแล้ว',
        ),
    },
    {
      key: 'post',
      label: 'ทดสอบหลังเรียน',
      icon: 'trophy',
      on: session.posttest_enabled,
      run: () =>
        send(
          {
            action: 'test-window',
            sessionId: session.id,
            which: 'post',
            enabled: !session.posttest_enabled,
          },
          session.posttest_enabled ? 'ปิดแบบทดสอบหลังเรียนแล้ว' : 'เปิดแบบทดสอบหลังเรียนแล้ว',
        ),
    },
  ]

  return (
    <section className="t2-card">
      <h2 className="t2-card-title">
        <Icon3d name="gear" size={32} />
        สวิตช์ของคาบ
        <InfoTip label="เรื่องสวิตช์" text="กดแล้วเครื่องนักเรียนทุกเครื่องเปลี่ยนตามภายใน 3 วินาที" />
      </h2>

      <div className="grid gap-2 lg:grid-cols-2">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={busy}
            aria-pressed={t.on}
            onClick={t.run}
            className="t2-toggle focus-ring"
          >
            <Icon3d name={t.icon} size={32} />
            <span className="min-w-0 flex-1 text-left">{t.label}</span>
            <span className="t2-chip" data-tone={t.on ? 'green' : undefined}>
              {t.on ? 'เปิด' : 'ปิด'}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[20px] bg-[#f6f2e8] p-3">
        <Icon3d name="door" size={32} />
        <p className="flex min-w-0 flex-1 items-center gap-1 text-label font-extrabold text-ink">
          ปิดคาบ
          <InfoTip
            label="เรื่องการปิดคาบ"
            text="ปิดแล้วย้อนไม่ได้ เปิดคาบใหม่ของห้องเดิมได้ แต่เวลาและช่วงจะเริ่มนับใหม่"
          />
        </p>
        <div className="w-full max-w-xs">
          <DangerButton
            label="ปิดคาบ"
            confirmLabel="กดอีกครั้งเพื่อปิดจริง"
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
        <p role="status" className="t2-note mt-3" data-tone="quest">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="t2-note mt-3" data-tone="danger">
          {error}
        </p>
      ) : null}
    </section>
  )
}

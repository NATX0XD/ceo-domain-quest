'use client'

import { useCallback, useEffect, useState } from 'react'
import { DangerButton } from '../_ux/dialog'
import { Icon3d, InfoTip, type Icon3dName } from '../_ux/v2'
import { Card, Skeleton, Toggle } from '../_ux/ui'

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
      <Card title="สวิตช์ของคาบ">
        <div role="status" aria-busy="true" className="grid gap-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
          <span className="sr-only">กำลังอ่านสถานะคาบ</span>
        </div>
      </Card>
    )
  }

  const tiles: {
    key: string
    label: string
    help: string
    icon: Icon3dName
    on: boolean
    run: () => void
  }[] = [
    {
      key: 'focus',
      label: 'จอหน้าห้อง',
      help: 'ให้ทุกคนดูจอหน้าห้องแทนการทำงานของตัวเอง',
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
      help: 'เปิดให้ตอบแบบสอบถามความพึงพอใจ',
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
      help: 'เปิดช่วงทำแบบทดสอบก่อนเรียน',
      icon: 'memo',
      on: session.pretest_enabled,
      run: () =>
        send(
          { action: 'test-window', sessionId: session.id, which: 'pre', enabled: !session.pretest_enabled },
          session.pretest_enabled ? 'ปิดแบบทดสอบก่อนเรียนแล้ว' : 'เปิดแบบทดสอบก่อนเรียนแล้ว',
        ),
    },
    {
      key: 'post',
      label: 'ทดสอบหลังเรียน',
      help: 'เปิดช่วงทำแบบทดสอบหลังเรียน',
      icon: 'trophy',
      on: session.posttest_enabled,
      run: () =>
        send(
          { action: 'test-window', sessionId: session.id, which: 'post', enabled: !session.posttest_enabled },
          session.posttest_enabled ? 'ปิดแบบทดสอบหลังเรียนแล้ว' : 'เปิดแบบทดสอบหลังเรียนแล้ว',
        ),
    },
  ]

  return (
    <Card title="สวิตช์ของคาบ" tip="กดแล้วเครื่องนักเรียนทุกเครื่องเปลี่ยนตามภายใน 3 วินาที">
      <div className="divide-y divide-[var(--c-line)]">
        {tiles.map((t) => (
          <div key={t.key} className="flex items-center gap-3 py-3 first:pt-0">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--c-sunken)]">
              <Icon3d name={t.icon} size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <Toggle label={t.label} description={t.help} checked={t.on} disabled={busy} onChange={() => t.run()} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 rounded-lg border border-[var(--s-danger)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--s-danger-ink)]">
              ปิดคาบ
              <InfoTip label="เรื่องการปิดคาบ" text="ปิดแล้วย้อนไม่ได้ เปิดคาบใหม่ของห้องเดิมได้ แต่เวลาและช่วงจะเริ่มนับใหม่" />
            </p>
            <p className="text-[14px] text-[var(--c-ink-3)]">ย้อนไม่ได้ ต้องกดยืนยันสองครั้ง</p>
          </div>
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
      </div>

      {notice ? (
        <p role="status" className="mt-3 rounded-lg px-3 py-2 text-[14px] font-medium" style={{ background: 'var(--s-success-soft)', color: 'var(--s-success-ink)' }}>
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-[14px] font-medium" style={{ background: 'var(--s-danger-soft)', color: 'var(--s-danger-ink)' }}>
          {error}
        </p>
      ) : null}
    </Card>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, Button, CheckIcon, cn } from '@/components/ui'

/**
 * ครูดูแลผนังผลงาน — ปักหมุดขึ้นจอหน้าห้อง (T-04) + ซ่อนความเห็นที่ไม่เหมาะสม (T-09)
 *
 * ⚠️ ซ่อน = ซ่อน ไม่ลบข้อความต้นฉบับ · เลิกซ่อนได้ตลอด
 * ⚠️ จอหน้าห้องแสดงเฉพาะผลงานที่ครูปักหมุด และไม่มีดาว/คะแนนติดไปด้วย
 */
interface PinnedRow {
  submission_id: string
  nickname: string | null
  domain_name: string | null
  tld: string | null
  reason_text: string | null
}

interface FeedbackRow {
  id: string
  praise_text: string | null
  suggest_text: string | null
  hidden_at: string | null
}

interface PendingRow {
  id: string
  nickname: string
  domain: string
}

export function TeacherShowcaseClient({
  classroomId,
  candidates,
}: {
  classroomId: string | null
  /** ผลงานที่ครูเลือกปักหมุดได้ (มาจากคิวตรวจของห้องนี้) */
  candidates: PendingRow[]
}) {
  const [pinned, setPinned] = useState<PinnedRow[]>([])
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/showcase?classroomId=${classroomId}`)
      if (!res.ok) return
      const data = (await res.json()) as { pinned?: PinnedRow[]; feedback?: FeedbackRow[] }
      setPinned(data.pinned ?? [])
      setFeedback(data.feedback ?? [])
    } catch {
      // เงียบไว้ ครูกดใหม่ได้
    }
  }, [classroomId])

  useEffect(() => {
    void load()
  }, [load])

  async function send(body: Record<string, unknown>, id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/teacher/showcase', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null
        setError(data?.message ?? 'สั่งงานไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      await load()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  if (!classroomId) return null

  const pinnedIds = new Set(pinned.map((p) => p.submission_id))

  return (
    <section className="mt-4 rounded-2xl bg-surface-raised p-4 ring-1 ring-line ring-inset">
      <h3 className="text-body-lg font-bold text-ink">ผลงานที่ขึ้นจอหน้าห้อง</h3>
      <p className="mt-1 text-label text-ink-muted">
        ปักหมุดได้ 2-3 ชิ้นตอนสรุป · จอหน้าห้องไม่แสดงดาวและคะแนน เลือกซ่อนชื่อเจ้าของได้
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {candidates.length === 0 ? (
          <li className="text-label text-ink-muted">ยังไม่มีผลงานให้ปักหมุดในห้องนี้</li>
        ) : null}
        {candidates.map((row) => {
          const isPinned = pinnedIds.has(row.id)
          return (
            <li
              key={row.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 ring-1 ring-inset',
                isPinned ? 'bg-brand-50 ring-brand-100' : 'bg-surface-sunken ring-line',
              )}
            >
              <p className="min-w-0 text-body text-ink">
                <span className="font-bold">{row.nickname}</span>
                <span className="ml-2 break-all text-brand-700">{row.domain}</span>
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant={isPinned ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={busyId === row.id}
                  leadingIcon={isPinned ? <CheckIcon width={16} height={16} /> : undefined}
                  onClick={() =>
                    send({ action: 'pin', submissionId: row.id, pinned: !isPinned }, row.id)
                  }
                >
                  {isPinned ? 'ปักหมุดอยู่' : 'ปักหมุด'}
                </Button>
                {isPinned ? null : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() =>
                      send(
                        { action: 'pin', submissionId: row.id, pinned: true, hideName: true },
                        row.id,
                      )
                    }
                  >
                    ปักหมุดแบบไม่โชว์ชื่อ
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* T-09 ซ่อนความเห็นที่ไม่เหมาะสม */}
      <h3 className="mt-5 text-body-lg font-bold text-ink">ความเห็นของเพื่อนในห้อง</h3>
      <p className="mt-1 text-label text-ink-muted">
        ซ่อนได้ถ้าไม่เหมาะสม · ซ่อนแล้วข้อความต้นฉบับยังอยู่ กดเลิกซ่อนได้ตลอด
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {feedback.length === 0 ? (
          <li className="text-label text-ink-muted">ยังไม่มีใครเขียนความเห็นถึงเพื่อน</li>
        ) : null}
        {feedback.map((row) => (
          <li
            key={row.id}
            className={cn(
              'rounded-xl p-3 ring-1 ring-inset',
              row.hidden_at ? 'bg-surface-sunken ring-line' : 'bg-surface-raised ring-line',
            )}
          >
            {row.praise_text ? (
              <p className="text-body text-ink">ชม: {row.praise_text}</p>
            ) : null}
            {row.suggest_text ? (
              <p className="mt-1 text-body text-ink">เสนอแนะ: {row.suggest_text}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {row.hidden_at ? (
                <span className="text-label font-bold text-ink-muted">ซ่อนอยู่</span>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                disabled={busyId === row.id}
                onClick={() =>
                  send(
                    { action: 'hide-feedback', feedbackId: row.id, hidden: !row.hidden_at },
                    row.id,
                  )
                }
              >
                {row.hidden_at ? 'เลิกซ่อน' : 'ซ่อนความเห็นนี้'}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-danger-100 p-3 text-label font-semibold text-danger-700"
        >
          <AlertIcon width={18} height={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </section>
  )
}

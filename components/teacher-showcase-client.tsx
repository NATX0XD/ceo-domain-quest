'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, CheckIcon } from '@/components/ui'
import { Icon3d, InfoTip } from '@/app/teacher/_ux/v2'

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
    <section className="t2-grid-2" style={{ alignItems: 'start' }}>
      <div className="t2-card">
        <h3 className="t2-card-title">
          <Icon3d name="glowing-star" size={32} />
          ขึ้นจอหน้าห้อง
          <InfoTip
            label="เรื่องการปักหมุด"
            text="ปักหมุดได้ 2-3 ชิ้นตอนสรุป จอหน้าห้องไม่แสดงดาวและคะแนน เลือกซ่อนชื่อเจ้าของได้"
          />
        </h3>

        <ul className="flex flex-col gap-2">
          {candidates.length === 0 ? (
            <li className="t2-empty">ยังไม่มีผลงานให้ปักหมุด</li>
          ) : null}
          {candidates.map((row) => {
            const isPinned = pinnedIds.has(row.id)
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] p-3"
                style={{ background: isPinned ? 'var(--t2-yellow)' : '#f6f2e8' }}
              >
                <p className="min-w-0 text-label text-ink">
                  <span className="font-extrabold">{row.nickname}</span>
                  <span className="ml-2 font-bold break-all text-brand-700">{row.domain}</span>
                </p>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="t2-btn focus-ring"
                    data-size="sm"
                    data-kind={isPinned ? 'primary' : undefined}
                    disabled={busyId === row.id}
                    onClick={() =>
                      send({ action: 'pin', submissionId: row.id, pinned: !isPinned }, row.id)
                    }
                  >
                    {isPinned ? <CheckIcon width={16} height={16} aria-hidden /> : null}
                    {isPinned ? 'ปักหมุดอยู่' : 'ปักหมุด'}
                  </button>
                  {isPinned ? null : (
                    <button
                      type="button"
                      className="t2-btn focus-ring"
                      data-size="sm"
                      data-kind="soft"
                      disabled={busyId === row.id}
                      onClick={() =>
                        send(
                          { action: 'pin', submissionId: row.id, pinned: true, hideName: true },
                          row.id,
                        )
                      }
                    >
                      ซ่อนชื่อ
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* T-09 ซ่อนความเห็นที่ไม่เหมาะสม */}
      <div className="t2-card">
        <h3 className="t2-card-title">
          <Icon3d name="speech-balloon" size={32} />
          ความเห็นเพื่อน
          <InfoTip
            label="เรื่องการซ่อนความเห็น"
            text="ซ่อนได้ถ้าไม่เหมาะสม ซ่อนแล้วข้อความต้นฉบับยังอยู่ กดเลิกซ่อนได้ตลอด"
          />
        </h3>
        <ul className="flex flex-col gap-2">
          {feedback.length === 0 ? <li className="t2-empty">ยังไม่มีความเห็น</li> : null}
          {feedback.map((row) => (
            <li
              key={row.id}
              className="rounded-[18px] p-3"
              style={{ background: row.hidden_at ? '#ece8dd' : '#f6f2e8' }}
            >
              {row.praise_text ? <p className="text-label text-ink">ชม: {row.praise_text}</p> : null}
              {row.suggest_text ? (
                <p className="mt-1 text-label text-ink">เสนอแนะ: {row.suggest_text}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {row.hidden_at ? <span className="t2-chip">ซ่อนอยู่</span> : null}
                <button
                  type="button"
                  className="t2-btn focus-ring"
                  data-size="sm"
                  disabled={busyId === row.id}
                  onClick={() =>
                    send(
                      { action: 'hide-feedback', feedbackId: row.id, hidden: !row.hidden_at },
                      row.id,
                    )
                  }
                >
                  {row.hidden_at ? 'เลิกซ่อน' : 'ซ่อนความเห็น'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="t2-note" data-tone="danger" style={{ gridColumn: '1 / -1' }}>
          <AlertIcon width={18} height={18} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </section>
  )
}

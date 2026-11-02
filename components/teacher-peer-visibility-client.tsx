'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon, CheckIcon } from '@/components/ui'
import { Icon3d, InfoTip } from '@/app/teacher/_ux/v2'

export interface PeerVisibilityRow {
  submissionId: string
  nickname: string
  domain: string
  reasonText: string | null
  flagged: boolean
  /** ค่าที่ครูตั้งไว้ — null = ให้ตัวกรองตัดสิน */
  override: boolean | null
  shopArt: string
  pinned: boolean
}

type Filter = 'all' | 'visible' | 'hidden' | 'flagged'

/** การ์ดผลงานสำหรับครู — เห็นภาพร้าน เห็นสถานะ และกดอนุมัติ/ซ่อนหรือปักจอได้จากที่เดียว */
export function TeacherPeerVisibilityClient({
  rows,
  initialPinnedIds,
}: {
  rows: PeerVisibilityRow[]
  initialPinnedIds: string[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [local, setLocal] = useState<Record<string, boolean | null>>({})
  const [pinned, setPinned] = useState(() => new Set(initialPinnedIds))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const visibleOf = (row: PeerVisibilityRow) => {
    const override = row.submissionId in local ? local[row.submissionId] : row.override
    return override ?? !row.flagged
  }

  const counts = useMemo(() => ({
    all: rows.length,
    visible: rows.filter(visibleOf).length,
    hidden: rows.filter((row) => !visibleOf(row)).length,
    flagged: rows.filter((row) => row.flagged).length,
  }), [local, rows])
  const shown = rows.filter((row) => {
    if (filter === 'visible') return visibleOf(row)
    if (filter === 'hidden') return !visibleOf(row)
    if (filter === 'flagged') return row.flagged
    return true
  })

  async function post(body: Record<string, unknown>, id: string) {
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
        setError(data?.message ?? 'ตั้งค่าไม่สำเร็จ ลองใหม่อีกครั้ง')
        return false
      }
      return true
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function toggleVisibility(row: PeerVisibilityRow) {
    const nextVisible = !visibleOf(row)
    const autoVisible = !row.flagged
    const visible = nextVisible === autoVisible ? null : nextVisible
    if (await post({ action: 'peer-visible', submissionId: row.submissionId, visible }, row.submissionId)) {
      setLocal((prev) => ({ ...prev, [row.submissionId]: visible }))
      router.refresh()
    }
  }

  async function togglePin(row: PeerVisibilityRow) {
    const nextPinned = !pinned.has(row.submissionId)
    if (await post({ action: 'pin', submissionId: row.submissionId, pinned: nextPinned }, `pin-${row.submissionId}`)) {
      setPinned((prev) => {
        const next = new Set(prev)
        if (nextPinned) next.add(row.submissionId)
        else next.delete(row.submissionId)
        return next
      })
      router.refresh()
    }
  }

  const filters: { id: Filter; label: string; tone?: string }[] = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'visible', label: 'แสดงอยู่' },
    { id: 'hidden', label: 'ซ่อนอยู่' },
    { id: 'flagged', label: 'ต้องดู', tone: 'amber' },
  ]

  return (
    <section className="showcase-moderation" aria-labelledby="showcase-moderation-title">
      <div className="showcase-section-heading">
        <div>
          <p className="showcase-section-kicker">ผนังผลงานเพื่อน</p>
          <h2 id="showcase-moderation-title" className="showcase-section-title">เลือกชิ้นที่อยากให้ทั้งห้องเห็น</h2>
          <p className="showcase-section-subtitle">เปิดการมองเห็นหรือปักขึ้นจอได้ทันทีจากการ์ดแต่ละใบ</p>
        </div>
        <InfoTip label="เรื่องการมองเห็น" text="ชิ้นที่ติดตัวกรองจะซ่อนอัตโนมัติ ครูอนุมัติให้เห็นได้ทุกเมื่อ" />
      </div>

      <div className="showcase-filterbar" role="group" aria-label="กรองผลงาน">
        {filters.map((item) => (
          <button key={item.id} type="button" className="showcase-filter" data-active={filter === item.id} data-tone={item.tone} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
            {item.label}<span>{counts[item.id]}</span>
          </button>
        ))}
        <span className="showcase-filterbar__summary">{shown.length} จาก {rows.length} ผลงาน</span>
      </div>

      {shown.length === 0 ? (
        <div className="showcase-empty"><Icon3d name="magnifying-glass-tilted-left" size={48} /><strong>ไม่พบผลงานในตัวกรองนี้</strong><span>ลองเลือกตัวกรองอื่นเพื่อดูผลงานทั้งหมด</span></div>
      ) : (
        <div className="showcase-grid">
          {shown.map((row) => {
            const visible = visibleOf(row)
            const isBusy = busyId === row.submissionId || busyId === `pin-${row.submissionId}`
            return (
              <article key={row.submissionId} className="showcase-work-card" data-flagged={row.flagged} data-visible={visible}>
                <div className="showcase-work-card__art">
                  <img src={row.shopArt} alt={`ภาพร้านของ ${row.nickname}`} onError={(event) => { event.currentTarget.src = '/ui/home/shop-stage-5.webp' }} />
                  <div className="showcase-work-card__topline">
                    {row.flagged ? <span className="showcase-flag"><AlertIcon width={14} height={14} aria-hidden />{row.override === true ? 'ครูอนุมัติแล้ว' : 'ต้องดู'}</span> : <span className="showcase-clean"><CheckIcon width={14} height={14} aria-hidden />ผ่านตัวกรอง</span>}
                    {pinned.has(row.submissionId) ? <span className="showcase-pin-state"><Icon3d name="chequered-flag" size={15} />ปักแล้ว</span> : null}
                  </div>
                </div>
                <div className="showcase-work-card__body">
                  <p className="showcase-domain">{row.domain}</p>
                  <p className="showcase-owner">โดย <strong>{row.nickname}</strong></p>
                  <p className="showcase-reason">{row.reasonText?.trim() || 'ยังไม่ได้เขียนเหตุผลประกอบผลงาน'}</p>
                  <div className="showcase-work-card__actions">
                    <button type="button" className="showcase-visibility" data-visible={visible} aria-pressed={visible} disabled={isBusy} onClick={() => void toggleVisibility(row)}>
                      <span className="showcase-switch" aria-hidden><span /></span>
                      <span>{visible ? 'ให้เพื่อนเห็น' : 'ซ่อนจากเพื่อน'}</span>
                      <small>{visible ? 'เปิด' : 'ปิด'}</small>
                    </button>
                    <button type="button" className="showcase-pin-button" data-pinned={pinned.has(row.submissionId)} aria-pressed={pinned.has(row.submissionId)} disabled={isBusy} onClick={() => void togglePin(row)}>
                      <Icon3d name="chequered-flag" size={18} />{pinned.has(row.submissionId) ? 'เอาออกจากจอ' : 'ปักขึ้นจอ'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {error ? <p className="showcase-error" role="alert">{error}</p> : null}
    </section>
  )
}

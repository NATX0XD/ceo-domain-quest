'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertIcon } from '@/components/ui'
import { Icon3d, InfoTip } from '@/app/teacher/_ux/v2'

export interface ShowcaseCandidate {
  id: string
  nickname: string
  domain: string
  reason: string
  shopArt: string
}

export interface PinnedShowcaseRow {
  submission_id: string
  nickname: string | null
  domain_name: string | null
  tld: string | null
  reason_text: string | null
  pinned_at: string | null
}

/** จัดการสไลด์ตัวอย่างก่อนเปิดจอ — ใช้ endpoint ปักหมุดเดิมทั้งหมด */
export function TeacherShowcaseClient({
  classroomId,
  candidates,
  initialPinned,
}: {
  classroomId: string | null
  candidates: ShowcaseCandidate[]
  initialPinned: PinnedShowcaseRow[]
}) {
  const [pinned, setPinned] = useState<PinnedShowcaseRow[]>(initialPinned)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const candidateById = useMemo(() => new Map(candidates.map((row) => [row.id, row])), [candidates])

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/showcase?classroomId=${classroomId}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { pinned?: PinnedShowcaseRow[] }
      setPinned(data.pinned ?? [])
    } catch {
      // โหลดรอบถัดไปได้ ไม่รบกวนการดูตัวอย่าง
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

  function move(index: number, direction: -1 | 1) {
    setPinned((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const currentRow = next[index]
      const targetRow = next[nextIndex]
      if (!currentRow || !targetRow) return current
      next[index] = targetRow
      next[nextIndex] = currentRow
      return next
    })
  }

  if (!classroomId) {
    return <section className="showcase-empty showcase-empty--wide"><Icon3d name="television" size={48} /><strong>ยังไม่มีห้องที่เลือก</strong><span>เลือกห้องเรียนจากแถบด้านบนเพื่อเตรียมจอหน้าห้อง</span></section>
  }

  return (
    <section className="showcase-screen" aria-labelledby="showcase-screen-title">
      <div className="showcase-screen__heading">
        <div>
          <p className="showcase-section-kicker">โปรเจกเตอร์ในห้องเรียน</p>
          <h2 id="showcase-screen-title" className="showcase-section-title">ขึ้นจอหน้าห้อง</h2>
          <p className="showcase-section-subtitle">ดูตัวอย่างสไลด์ก่อนเปิดให้ทั้งห้องชมผลงาน</p>
        </div>
        <InfoTip label="เรื่องจอหน้าห้อง" text="จอจะแสดงเฉพาะผลงานที่ปักหมุด ไม่มีคะแนนหรือการจัดอันดับ และซ่อนชื่อเจ้าของได้" />
      </div>

      <div className="showcase-screen__actions">
        <a href={`/board?classroomId=${classroomId}&mode=showcase`} target="_blank" rel="noopener" className="showcase-open-button" data-primary><Icon3d name="television" size={25} />เปิดจอผลงาน<span aria-hidden>↗</span></a>
        <a href={`/board?classroomId=${classroomId}&mode=join`} target="_blank" rel="noopener" className="showcase-open-button"><Icon3d name="door" size={23} />เปิดจอชวนเข้าห้อง<span aria-hidden>↗</span></a>
      </div>

      <div className="showcase-projector" aria-label="ตัวอย่างผลงานบนจอโปรเจกเตอร์">
        <div className="showcase-projector__chrome"><span /><span /><span /><em>LIVE PREVIEW</em></div>
        {pinned.length === 0 ? (
          <div className="showcase-projector__empty"><Icon3d name="sparkles" size={54} /><strong>จอยังว่างอยู่</strong><span>กลับไปที่กลั่นกรอง แล้วกด “ปักขึ้นจอ” บนผลงานที่อยากเล่าให้เพื่อนฟัง</span></div>
        ) : (
          <ol className="showcase-slide-strip">
            {pinned.map((row, index) => {
              const candidate = candidateById.get(row.submission_id)
              const domain = candidate?.domain ?? `${row.domain_name ?? ''}${row.tld ?? ''}`
              const reason = candidate?.reason ?? row.reason_text ?? ''
              return (
                <li key={row.submission_id} className="showcase-slide">
                  <article>
                    <div className="showcase-slide__art"><span className="showcase-slide__number">{String(index + 1).padStart(2, '0')}</span><img src={candidate?.shopArt ?? '/ui/home/shop-stage-5.webp'} alt="" /></div>
                    <div className="showcase-slide__copy"><p className="showcase-domain">{domain}</p><p className="showcase-slide__reason">{reason || 'ผลงานที่เพื่อนอยากชวนคุย'}</p><p className="showcase-slide__owner">{row.nickname ? `โดย ${row.nickname}` : 'ซ่อนชื่อเจ้าของบนจอ'}</p></div>
                  </article>
                  <div className="showcase-slide__controls">
                    <button type="button" className="showcase-icon-button" aria-label={`เลื่อน ${domain} ไปทางซ้าย`} disabled={index === 0 || busyId === row.submission_id} onClick={() => move(index, -1)}>←</button>
                    <button type="button" className="showcase-icon-button" aria-label={`เลื่อน ${domain} ไปทางขวา`} disabled={index === pinned.length - 1 || busyId === row.submission_id} onClick={() => move(index, 1)}>→</button>
                    <button type="button" className="showcase-slide-action" disabled={busyId === row.submission_id} onClick={() => void send({ action: 'pin', submissionId: row.submission_id, pinned: true, hideName: row.nickname !== null }, row.submission_id)}>{row.nickname ? 'ซ่อนชื่อ' : 'แสดงชื่อ'}</button>
                    <button type="button" className="showcase-slide-action showcase-slide-action--danger" disabled={busyId === row.submission_id} onClick={() => void send({ action: 'pin', submissionId: row.submission_id, pinned: false }, row.submission_id)}>เอาออก</button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="showcase-screen__footer"><span><strong>{pinned.length}</strong> สไลด์ที่ปักไว้</span><span>ลูกศรซ้าย/ขวาเรียงลำดับในตัวอย่างนี้</span></div>
      {error ? <p className="showcase-error" role="alert"><AlertIcon width={18} height={18} aria-hidden />{error}</p> : null}
    </section>
  )
}

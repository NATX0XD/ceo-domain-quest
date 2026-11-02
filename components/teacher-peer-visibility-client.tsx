'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon } from '@/components/ui'
import { Icon3d, InfoTip } from '@/app/teacher/_ux/v2'

export interface PeerVisibilityRow {
  submissionId: string
  nickname: string
  domain: string
  /** ชื่อเว็บหรือเหตุผลติดตัวกรองคำ */
  flagged: boolean
  /** ค่าที่ครูตั้งไว้ — null = ให้ตัวกรองตัดสิน */
  override: boolean | null
}

/**
 * ครูเปิด/ปิด "แสดงให้เพื่อนเห็น" ทีละชิ้นบนผนังผลงานเพื่อน (/showcase)
 * ชิ้นที่ติดตัวกรองคำเริ่มที่ซ่อน ครูกดอนุมัติให้เห็นได้ · บังคับจริงที่ /api/me/showcase
 * ถ้ากดแล้วตรงกับค่าอัตโนมัติ เก็บเป็น null (กลับไปให้ตัวกรองตัดสิน) ไม่ค้างค่าครูไว้เปล่า ๆ
 */
export function TeacherPeerVisibilityClient({ rows }: { rows: PeerVisibilityRow[] }) {
  const router = useRouter()
  const [local, setLocal] = useState<Record<string, boolean | null>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(row: PeerVisibilityRow, nextVisible: boolean) {
    const auto = !row.flagged
    const visible = nextVisible === auto ? null : nextVisible
    setBusyId(row.submissionId)
    setError(null)
    try {
      const res = await fetch('/api/teacher/showcase', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'peer-visible', submissionId: row.submissionId, visible }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null
        setError(data?.message ?? 'ตั้งค่าไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setLocal((prev) => ({ ...prev, [row.submissionId]: visible }))
      router.refresh()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="t2-card">
      <h3 className="t2-card-title">
        <Icon3d name="eyes" size={32} />
        ผนังผลงานเพื่อน
        <InfoTip
          label="เรื่องการแสดงให้เพื่อนเห็น"
          text="ชิ้นที่ติดตัวกรองคำจะซ่อนจากเพื่อนเอง ครูกดอนุมัติให้เห็นได้ หรือซ่อนชิ้นไหนก็ได้ ไม่แตะคะแนน"
        />
      </h3>
      {rows.length === 0 ? <p className="t2-empty">ยังไม่มีใครส่งใบเสนอ</p> : null}
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const override = row.submissionId in local ? local[row.submissionId] : row.override
          const visible = override ?? !row.flagged
          return (
            <button
              key={row.submissionId}
              type="button"
              className="t2-toggle focus-ring"
              aria-pressed={visible}
              disabled={busyId === row.submissionId}
              onClick={() => void toggle(row, !visible)}
            >
              <span className="min-w-0 flex-1 text-left">
                <span className="font-extrabold">{row.nickname}</span>
                <span className="ml-2 font-bold break-all text-brand-700">{row.domain}</span>
                {row.flagged ? (
                  <span className="t2-chip ml-2" title="ชื่อเว็บหรือเหตุผลติดตัวกรองคำ">
                    <AlertIcon width={14} height={14} aria-hidden />
                    {override === true ? 'ติดตัวกรองคำ · ครูอนุมัติแล้ว' : 'ติดตัวกรองคำ'}
                  </span>
                ) : null}
              </span>
              <span className="t2-chip" data-tone={visible ? 'green' : undefined}>
                {visible ? 'แสดงให้เพื่อนเห็น' : 'ซ่อนจากเพื่อน'}
              </span>
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="mt-2 text-label font-bold text-danger-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

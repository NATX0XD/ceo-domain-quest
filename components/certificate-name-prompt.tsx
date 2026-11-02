'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CertificateNamePrompt() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim() || !confirmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/profile/certificate-name', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ certificateDisplayName: name.trim(), confirmed: true }),
      })
      const data = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(data?.message ?? 'บันทึกชื่อไม่สำเร็จ ลองอีกครั้งนะ')
        return
      }
      router.refresh()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองอีกครั้งนะ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#2b170b]/60 px-4 py-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-name-prompt-title"
        className="w-full max-w-[23rem] rounded-3xl border-[3px] border-[#6b2d12] bg-[#fff1d6] p-5 shadow-[0_7px_0_#4a1f0a]"
      >
        <p className="text-note font-extrabold uppercase tracking-[0.14em] text-brand-700">เกียรติบัตรพร้อมแล้ว</p>
        <h2 id="certificate-name-prompt-title" className="mt-1 text-title-sm font-black text-ink">
          ขอชื่อจริงสำหรับใบประกาศ
        </h2>
        <p className="mt-2 text-label font-semibold leading-relaxed text-ink-muted">
          ชื่อนี้จะปรากฏบนเกียรติบัตรและตั้งได้ครั้งเดียว พิมพ์ชื่อ-นามสกุลจริงให้ตรงกับที่ต้องการนะ
        </p>
        <label htmlFor="result-certificate-display-name" className="mt-4 block text-label font-extrabold text-ink">
          ชื่อ-นามสกุลจริง
        </label>
        <input
          id="result-certificate-display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          autoComplete="name"
          autoFocus
          placeholder="เช่น อาร์ม ใจดี"
          className="mt-1 min-h-12 w-full rounded-xl bg-white px-3 text-body font-bold text-ink ring-2 ring-line outline-none focus:ring-brand-500"
        />
        <label className="mt-3 flex items-start gap-2 text-note font-semibold text-ink">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-brand-600)]"
          />
          <span>ตรวจตัวสะกดแล้ว</span>
        </label>
        {error ? <p role="alert" className="mt-3 rounded-xl bg-spark-100 p-3 text-note font-bold text-spark-700">{error}</p> : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !name.trim() || !confirmed}
          className="btn-base mt-4 min-h-12 w-full rounded-xl bg-brand-600 text-body font-black text-ink-onbrand hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'กำลังบันทึก…' : 'ยืนยันชื่อบนเกียรติบัตร'}
        </button>
      </section>
    </div>
  )
}

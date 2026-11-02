'use client'

import { useState } from 'react'

type Notice = { kind: 'success' | 'error'; text: string } | null

export function StudentAccountPanel({ initialNickname }: { initialNickname: string }) {
  const [nickname, setNickname] = useState(initialNickname)
  const [newNickname, setNewNickname] = useState(initialNickname)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [busy, setBusy] = useState<'nickname' | 'pin' | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  async function update(body: Record<string, string>, kind: 'nickname' | 'pin') {
    setBusy(kind)
    setNotice(null)
    try {
      const response = await fetch('/api/profile/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await response.json().catch(() => null)) as { message?: string; nickname?: string } | null
      if (!response.ok) {
        setNotice({ kind: 'error', text: data?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ' })
        return
      }
      if (kind === 'nickname' && data?.nickname) {
        setNickname(data.nickname)
        setNewNickname(data.nickname)
      }
      if (kind === 'pin') {
        setCurrentPin('')
        setNewPin('')
      }
      setNotice({ kind: 'success', text: data?.message ?? 'บันทึกแล้ว' })
    } catch {
      setNotice({ kind: 'error', text: 'ต่อเน็ตไม่ได้ ลองใหม่อีกครั้งนะ' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <details className="mb-3 rounded-2xl bg-surface-raised ring-1 ring-line ring-inset">
      <summary className="cursor-pointer list-none px-4 py-3 text-label font-extrabold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        บัญชีของฉัน · {nickname}
      </summary>
      <div className="border-t border-line px-4 pb-4 pt-3">
        <p className="text-note text-ink-muted">เปลี่ยนชื่อเล่นหรือ PIN ได้เอง ข้อมูลความคืบหน้ายังอยู่ครบ</p>

        <form
          className="mt-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200 ring-inset"
          onSubmit={(event) => {
            event.preventDefault()
            void update({ nickname: newNickname }, 'nickname')
          }}
        >
          <label htmlFor="student-account-nickname" className="text-label font-bold text-ink">ชื่อเล่นใหม่</label>
          <input
            id="student-account-nickname"
            value={newNickname}
            onChange={(event) => setNewNickname(event.target.value)}
            maxLength={40}
            required
            className="mt-1 min-h-11 w-full rounded-xl bg-surface-raised px-3 text-label text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-2 text-note font-semibold text-brand-700">ใช้ชื่อใหม่นี้ตอนเข้าห้องครั้งถัดไป</p>
          <button
            type="submit"
            disabled={busy !== null || newNickname.trim() === nickname}
            className="btn-base mt-3 w-full rounded-xl bg-brand-600 text-label font-bold text-ink-onbrand hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === 'nickname' ? 'กำลังบันทึก…' : 'บันทึกชื่อเล่น'}
          </button>
        </form>

        <form
          className="mt-3 rounded-xl bg-surface-sunken p-3 ring-1 ring-line ring-inset"
          onSubmit={(event) => {
            event.preventDefault()
            void update({ currentPin, newPin }, 'pin')
          }}
        >
          <h3 className="text-label font-bold text-ink">เปลี่ยน PIN</h3>
          <label htmlFor="student-account-current-pin" className="mt-2 block text-note font-semibold text-ink-muted">PIN ปัจจุบัน</label>
          <input
            id="student-account-current-pin"
            value={currentPin}
            onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            required
            className="mt-1 min-h-11 w-full rounded-xl bg-surface-raised px-3 text-label tracking-[0.25em] text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-500"
          />
          <label htmlFor="student-account-new-pin" className="mt-2 block text-note font-semibold text-ink-muted">PIN ใหม่ 4 หลัก</label>
          <input
            id="student-account-new-pin"
            value={newPin}
            onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            required
            className="mt-1 min-h-11 w-full rounded-xl bg-surface-raised px-3 text-label tracking-[0.25em] text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={busy !== null || currentPin.length !== 4 || newPin.length !== 4}
            className="btn-base mt-3 w-full rounded-xl bg-quest-600 text-label font-bold text-ink-onbrand hover:bg-quest-700 disabled:opacity-50"
          >
            {busy === 'pin' ? 'กำลังบันทึก…' : 'บันทึก PIN ใหม่'}
          </button>
        </form>

        {notice ? (
          <p role="status" className={`mt-3 rounded-xl p-3 text-label font-semibold ${notice.kind === 'success' ? 'bg-quest-100 text-quest-700' : 'bg-spark-100 text-spark-700'}`}>
            {notice.text}
          </p>
        ) : null}
      </div>
    </details>
  )
}

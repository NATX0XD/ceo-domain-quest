'use client'

import { useState } from 'react'

type Props = { email: string; initialDisplayName: string }
type Notice = { kind: 'success' | 'error'; text: string } | null

export function TeacherAccountPanel({ email, initialDisplayName }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState<'name' | 'password' | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  async function submit(body: Record<string, string>, kind: 'name' | 'password') {
    setBusy(kind)
    setNotice(null)
    try {
      const response = await fetch('/api/teacher/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await response.json().catch(() => null)) as { message?: string; teacher?: { displayName?: string } } | null
      if (!response.ok) {
        setNotice({ kind: 'error', text: data?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ' })
        return
      }
      if (kind === 'name' && data?.teacher?.displayName) setDisplayName(data.teacher.displayName)
      if (kind === 'password') {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
      setNotice({ kind: 'success', text: data?.message ?? 'บันทึกแล้ว' })
    } catch {
      setNotice({ kind: 'error', text: 'ต่อเน็ตไม่ได้ ลองใหม่อีกครั้งนะ' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="t2-card" aria-labelledby="teacher-account-title">
      <h2 id="teacher-account-title" className="t2-card-title">บัญชีของฉัน</h2>
      <p className="t2-sub">ข้อมูลสำหรับเข้าสู่ระบบและชื่อที่จะแสดงบนแผงครู</p>
      <dl className="mt-3 grid gap-2 rounded-xl bg-[var(--t2-canvas)] p-3 text-sm sm:grid-cols-2">
        <div><dt className="font-bold text-ink-muted">อีเมล</dt><dd className="break-all font-semibold text-ink">{email}</dd></div>
        <div><dt className="font-bold text-ink-muted">ชื่อที่แสดง</dt><dd className="font-semibold text-ink">{displayName || 'ยังไม่ได้ตั้งชื่อ'}</dd></div>
      </dl>

      <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); void submit({ displayName }, 'name') }}>
        <label className="grid gap-1 text-sm font-bold text-ink">
          เปลี่ยนชื่อที่แสดง
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required className="min-h-11 rounded-xl border border-[var(--t2-line)] bg-[#fffdf8] px-3 font-normal outline-none focus:border-[var(--t2-purple)] focus:ring-2 focus:ring-[rgb(143_123_232_/_0.16)]" />
        </label>
        <button type="submit" disabled={busy !== null || displayName.trim() === initialDisplayName.trim()} className="t2-btn" data-kind="primary" data-block="true">
          {busy === 'name' ? 'กำลังบันทึก…' : 'บันทึกชื่อที่แสดง'}
        </button>
      </form>

      <form className="mt-5 grid gap-3 border-t border-[var(--t2-line)] pt-4" onSubmit={(event) => { event.preventDefault(); void submit({ currentPassword, newPassword, confirmPassword }, 'password') }}>
        <h3 className="text-base font-extrabold text-ink">เปลี่ยนรหัสผ่าน</h3>
        <label className="grid gap-1 text-sm font-bold text-ink">รหัสผ่านปัจจุบัน<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className="min-h-11 rounded-xl border border-[var(--t2-line)] bg-[#fffdf8] px-3 font-normal outline-none focus:border-[var(--t2-purple)]" /></label>
        <label className="grid gap-1 text-sm font-bold text-ink">รหัสผ่านใหม่ (อย่างน้อย 10 ตัวอักษร)<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} maxLength={128} required className="min-h-11 rounded-xl border border-[var(--t2-line)] bg-[#fffdf8] px-3 font-normal outline-none focus:border-[var(--t2-purple)]" /></label>
        <label className="grid gap-1 text-sm font-bold text-ink">ยืนยันรหัสผ่านใหม่<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} maxLength={128} required className="min-h-11 rounded-xl border border-[var(--t2-line)] bg-[#fffdf8] px-3 font-normal outline-none focus:border-[var(--t2-purple)]" /></label>
        <button type="submit" disabled={busy !== null} className="t2-btn" data-kind="primary" data-block="true">
          {busy === 'password' ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
        </button>
      </form>
      {notice ? <p role="status" className={`mt-3 rounded-xl p-3 text-sm font-bold ${notice.kind === 'success' ? 'bg-[var(--t2-mint)] text-[var(--t2-ink)]' : 'bg-[var(--t2-peach)] text-[var(--t2-red)]'}`}>{notice.text}</p> : null}
    </section>
  )
}

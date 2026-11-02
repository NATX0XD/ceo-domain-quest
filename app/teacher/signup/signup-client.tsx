'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { CreamCard, GameButton, WoodSign } from '@/components/ui'

function strength(password: string): { label: string; score: number } {
  let score = 0
  if (password.length >= 10) score += 1
  if (/[A-Zก-ฮ]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^\da-zA-Zก-ฮ]/.test(password)) score += 1
  return { label: password.length === 0 ? 'ตั้งรหัสผ่านอย่างน้อย 10 ตัวอักษร' : ['ควรเพิ่มความยาวหรือผสมตัวอักษร', 'พอใช้', 'ดี', 'แข็งแรง'][score - 1] ?? 'แข็งแรง', score }
}
export default function SignupClient({ openLabel }: { openLabel: string }) {
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirmPassword: '', inviteCode: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)
  const meter = strength(form.password)
  const update = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/teacher/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        setError(data?.message ?? 'สมัครบัญชีไม่สำเร็จ')
        return
      }
      setSucceeded(true)
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="teacher-cms teacher-signup-page">
      <section className="teacher-auth-orbit">
      <div className="teacher-auth-brand" aria-hidden="true">
        <img src="/landing/logo.webp" alt="" className="teacher-auth-logo" />
        <img src="/dome/mascot/dome-greet.webp" alt="" className="teacher-auth-dome" />
      </div>
      <CreamCard className="teacher-signup-card" aria-labelledby="teacher-signup-title">
        <WoodSign id="teacher-signup-title" title={succeeded ? 'สมัครสำเร็จ' : 'สมัครบัญชีครู'}>
          ใช้รหัสเชิญเพื่อเริ่มห้องเรียนของคุณ
        </WoodSign>
        {succeeded ? (
          <div className="teacher-signup-success" role="status">
            <p className="teacher-signup-kicker">สำหรับครู · พร้อมเริ่มต้น</p>
            <p className="teacher-signup-success-message">ลงทะเบียนเรียบร้อย — สร้างห้องเตรียมไว้ได้เลย นักเรียนจะเข้าห้องได้ {openLabel === 'เมื่อระบบเปิด' ? 'เมื่อระบบเปิด' : `ตั้งแต่ ${openLabel}`}</p>
            <Link className="teacher-signup-success-link" href="/teacher">เข้าสู่ระบบครูเพื่อสร้างห้อง</Link>
          </div>
        ) : (
          <>
            <p className="teacher-signup-kicker">สำหรับครู · สร้างบัญชีใหม่</p>
            <p className="t2-sub">ใช้รหัสเชิญเพื่อเริ่มห้องเรียนของคุณ</p>
            <form className="teacher-signup-form" onSubmit={submit}>
              <label>ชื่อที่แสดง<input required maxLength={80} value={form.displayName} onChange={update('displayName')} autoComplete="name" /></label>
              <label>อีเมล<input required type="email" value={form.email} onChange={update('email')} autoComplete="username" /></label>
              <label>รหัสผ่าน<input required minLength={10} maxLength={128} type="password" value={form.password} onChange={update('password')} autoComplete="new-password" aria-describedby="password-strength" /></label>
              <div id="password-strength" className="teacher-password-strength" data-score={meter.score}><span><i style={{ width: `${meter.score * 25}%` }} /></span>{meter.label}</div>
              <label>ยืนยันรหัสผ่าน<input required type="password" value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" /></label>
              <label>รหัสเชิญครู<input required value={form.inviteCode} onChange={update('inviteCode')} autoComplete="one-time-code" /></label>
              {error ? <p className="teacher-signup-error" role="alert">⚠ {error}</p> : null}
              <GameButton type="submit" disabled={busy} aria-busy={busy || undefined}>
                {busy ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชีครู'}
              </GameButton>
            </form>
            <p className="teacher-signup-back">มีบัญชีแล้ว? <Link href="/teacher">เข้าสู่ระบบครู</Link></p>
          </>
        )}
      </CreamCard>
      </section>
    </main>
  )
}

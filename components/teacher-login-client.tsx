'use client'

import { useState } from 'react'
import { AlertIcon } from '@/components/ui'
import { Icon3d } from '@/app/teacher/_ux/v2'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * ฟอร์มเข้าสู่ระบบของครู — ส่งไป POST /api/teacher/login เท่านั้น
 * ⚠️ ไม่มีการตรวจรหัสผ่านฝั่งเบราว์เซอร์ และไม่เก็บรหัสผ่านไว้ที่ไหนทั้งนั้น
 */
export function TeacherLoginClient() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy || email.trim().length === 0 || password.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = (await res.json().catch(() => null)) as { message?: string } | null
      if (!res.ok) {
        setError(data?.message ?? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        return
      }
      router.refresh()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="teacher-cms teacher-auth-page">
      <section className="teacher-auth-card" aria-labelledby="teacher-login-title">
        <div className="teacher-auth-brand">
          <span aria-hidden className="teacher-auth-mark">
            <Icon3d name="rocket" size={30} />
          </span>
          <div>
            <h1 id="teacher-login-title" className="teacher-auth-title">เข้าสู่ระบบครู</h1>
            <p className="teacher-auth-desc">CEO Domain Quest · เปิดห้องและดูผลนักเรียน</p>
          </div>
        </div>

        <form
          className="teacher-auth-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <label>
            อีเมล
            <input
              id="teacher-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            รหัสผ่าน
            <input
              id="teacher-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          {/* ข้อความผิดมีไอคอนคู่เสมอ ไม่ได้สื่อด้วยสีแดงอย่างเดียว (WCAG 1.4.1) */}
          {error ? (
            <p role="alert" className="teacher-auth-error">
              <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
          <button type="submit" className="teacher-auth-submit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* ระบบนี้ไม่มีเมลรีเซ็ตรหัสเอง ทางออกเดียวคือผู้ดูแลระบบตั้งให้ใหม่ จึงเขียนตรง ๆ แบบนั้น (flow-1.md ข้อ 26) */}
        <p className="teacher-auth-help">
          ลืมรหัสผ่าน หรือยังไม่มีบัญชี ให้ติดต่อผู้ดูแลระบบของวิทยาลัยเพื่อตั้งรหัสใหม่ให้
          หน้านี้ไม่มีการส่งลิงก์รีเซ็ตทางอีเมล
        </p>
        <p className="teacher-auth-foot">
          <Link href="/teacher/signup">มีรหัสเชิญ? สมัครครู</Link>
        </p>
      </section>
    </main>
  )
}

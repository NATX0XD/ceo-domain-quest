'use client'

import { useState } from 'react'
import { AlertIcon, Button, CreamCard, InfoIcon, TextField, WoodSign } from '@/components/ui'
import { AppFooter, AppShell } from '@/components/app-shell'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/** ผูกปุ่มเข้าสู่ระบบที่อยู่ในแถบท้าย เข้ากับฟอร์มที่อยู่ในส่วนเลื่อนได้ */
const FORM_ID = 'teacher-login-form'

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
    <AppShell
      student={false}
      className="teacher-auth-shell"
      footer={
        <AppFooter>
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy}
            loading={busy}
            loadingLabel="กำลังเข้าสู่ระบบ"
          >
            เข้าสู่ระบบ
          </Button>
        </AppFooter>
      }
    >
      <div className="teacher-auth-content px-4 pt-5 pb-8">
      <div className="teacher-auth-brand" aria-hidden="true">
        <img src="/landing/logo.webp" alt="" className="teacher-auth-logo" />
        <img src="/dome/mascot/dome-greet.webp" alt="" className="teacher-auth-dome" />
      </div>
      <WoodSign title="ห้องของครู">เข้าสู่ระบบเพื่อเปิดห้องและดูผลนักเรียน</WoodSign>

      {/* ครอบด้วย <form> เพื่อให้กด Enter ในช่องไหนก็ส่งฟอร์มได้ ไม่ต้องเอาเมาส์ไปกดปุ่ม */}
      <CreamCard className="teacher-auth-card mt-5 p-5">
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
      <div className="flex flex-col gap-5">
        <TextField
          id="teacher-email"
          label="อีเมล"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <TextField
          id="teacher-password"
          label="รหัสผ่าน"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </div>

      {/* ข้อความผิดมีไอคอนคู่เสมอ ไม่ได้สื่อด้วยสีแดงอย่างเดียว (WCAG 1.4.1) */}
      {error ? (
        <p
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-2xl bg-danger-100 p-4 text-label font-semibold text-danger-700"
        >
          <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      </form>

      {/* วันแข่งจริง ครูที่จำรหัสไม่ได้ต้องรู้ว่าไปต่อทางไหน ไม่ใช่ตันอยู่หน้านี้ (flow-1.md ข้อ 26)
          ระบบนี้ไม่มีเมลรีเซ็ตรหัสเอง ทางออกเดียวคือผู้ดูแลระบบตั้งให้ใหม่ จึงเขียนตรง ๆ แบบนั้น */}
      <p className="teacher-auth-help mt-6 flex items-start gap-2 rounded-2xl bg-brand-50 p-4 text-label text-pretty text-ink-muted ring-1 ring-brand-100 ring-inset">
        <InfoIcon width={20} height={20} aria-hidden className="mt-0.5 shrink-0 text-brand-700" />
        <span>
          ลืมรหัสผ่าน หรือยังไม่มีบัญชี ให้ติดต่อผู้ดูแลระบบของวิทยาลัยเพื่อตั้งรหัสใหม่ให้
          หน้านี้ไม่มีการส่งลิงก์รีเซ็ตทางอีเมล
        </span>
      </p>
      <p className="mt-4 text-center text-label font-semibold text-brand-700">
        <Link href="/teacher/signup" className="underline underline-offset-4">มีรหัสเชิญ? สมัครครู</Link>
      </p>
      </CreamCard>
      </div>
    </AppShell>
  )
}

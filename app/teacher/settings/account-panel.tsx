'use client'

import { Icon3d } from '../_ux/v2'

import { useState } from 'react'
import { Button, Card, Field, TextInput } from '../_ux/ui'
import styles from './settings.module.css'

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

  const nameChanged = displayName.trim() !== initialDisplayName.trim()
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-labelledby="teacher-account-title">
      <Card icon={<Icon3d name="bust-in-silhouette" size={22} />} tone="blue" title={<span id="teacher-account-title">ข้อมูลบัญชี</span>}>
        <p className={styles.accountIntro}>ข้อมูลสำหรับระบุตัวตนครูและชื่อที่จะแสดงบนแผงควบคุม</p>
        <div className={styles.accountEmail}>
          <Icon3d name="speech-balloon" size={22} />
          <span>{email}</span>
        </div>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit({ displayName }, 'name') }}>
          <Field label="เปลี่ยนชื่อที่แสดง" htmlFor="acc-name" help="ชื่อนี้แสดงบนแผงครู">
            <TextInput id="acc-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
          </Field>
          <div>
            <Button type="submit" kind="primary" disabled={busy !== null || !nameChanged} title={nameChanged ? undefined : 'แก้ชื่อก่อนจึงจะบันทึกได้'}>
              {busy === 'name' ? 'กำลังบันทึก…' : 'บันทึกชื่อที่แสดง'}
            </Button>
          </div>
        </form>
      </Card>

      <Card icon={<Icon3d name="locked" size={22} />} tone="rose" title="รักษาความปลอดภัย">
        <p className={styles.accountIntro}>เปลี่ยนรหัสผ่านเป็นระยะเพื่อให้บัญชีครูของคุณปลอดภัย</p>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit({ currentPassword, newPassword, confirmPassword }, 'password') }}>
          <Field label="รหัสผ่านปัจจุบัน" htmlFor="acc-cur">
            <TextInput id="acc-cur" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </Field>
          <Field label="รหัสผ่านใหม่" htmlFor="acc-new" help="อย่างน้อย 10 ตัวอักษร">
            <TextInput id="acc-new" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} maxLength={128} required />
          </Field>
          <Field label="ยืนยันรหัสผ่านใหม่" htmlFor="acc-confirm">
            <TextInput id="acc-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} maxLength={128} required />
          </Field>
          <div>
            <Button type="submit" kind="primary" disabled={busy !== null}>
              {busy === 'password' ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
            </Button>
          </div>
        </form>
      </Card>

      {notice ? (
        <p
          role="status"
          className="rounded-lg px-3 py-2 text-[14px] font-medium lg:col-span-2"
          style={{
            background: notice.kind === 'success' ? 'var(--s-success-soft)' : 'var(--s-danger-soft)',
            color: notice.kind === 'success' ? 'var(--s-success-ink)' : 'var(--s-danger-ink)',
          }}
        >
          {notice.text}
        </p>
      ) : null}
    </div>
  )
}

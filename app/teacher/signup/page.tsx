import type { Metadata } from 'next'
import SignupClient from './signup-client'

export const metadata: Metadata = { title: 'สมัครบัญชีครู — CEO Domain Quest' }
export const dynamic = 'force-dynamic'

function formatOpenLabel(iso: string | undefined) {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return 'เมื่อระบบเปิด'
  const label = new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(date)
  return `${label} น.`
}

export default function TeacherSignupPage() {
  return <SignupClient openLabel={formatOpenLabel(process.env.NEXT_PUBLIC_OPEN_AT)} />
}

import type { Metadata } from 'next'
import SignupClient from './signup-client'

export const metadata: Metadata = { title: 'สมัครบัญชีครู — CEO Domain Quest' }
export const dynamic = 'force-dynamic'

export default function TeacherSignupPage() {
  return <SignupClient />
}

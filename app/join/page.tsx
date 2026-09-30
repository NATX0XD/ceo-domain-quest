import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { JoinClient } from '@/components/join-client'
import { readStudentSession } from '@/app/api/_lib/session-cookie'

export const metadata: Metadata = { title: 'เข้าห้องเรียน — CEO Domain Quest' }

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * หน้าเข้าห้องเรียน — รับรหัสห้องจาก query string ได้ (เช่นสแกน QR จากจอครู: /join?code=QUEST9)
 * เข้าห้องอยู่แล้วให้ข้ามไปเล่นเลย ไม่ต้องกรอกซ้ำ
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await readStudentSession()
  if (session) redirect('/dome')

  const sp = await searchParams
  const fromQuery = (one(sp.code) ?? one(sp.room) ?? '').toUpperCase().slice(0, 6)

  return <JoinClient initialRoomCode={fromQuery} />
}

'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TeacherGradeQueueClient } from '../../../components/teacher-grade-queue-client'
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  CrownIcon,
  GlobeIcon,
  ProfileIcon,
  QuestIcon,
  RewardIcon,
  StarIcon,
  UsersIcon,
} from '../../../components/ui'

/**
 * UX-6 โครงแดชบอร์ดของครู — แถบบน + เมนูข้าง + พื้นที่เนื้อหา
 *
 * มติเจ้าของ (รอบแก้โจทย์): หน้าครูเป็น **แดชบอร์ดเต็มรูปแบบ** ไม่ต้องยัดทุกอย่างลงจอเดียว
 * ออกแบบสำหรับจอโน้ตบุ๊ก/จอคอมเป็นหลัก · จอแคบใช้ได้แบบพอไหว
 * **กฎห้ามเลื่อนใช้กับแถบบนกับเมนูข้างเท่านั้น** ทั้งคู่อยู่กับที่เสมอ ส่วนเนื้อหาเลื่อนได้
 *
 * ── ตัวเลขที่ใช้ มาจากแบบอ้างอิงจริง (scratchpad/ref-teacher-ui.md ภาคผนวก) ──
 * - เมนูข้างกว้าง **236px** (ของดีใช้ 220-260px · Linear/Stripe/Grafana ใช้ 256px)
 * - รายการเมนูสูง **44px** (ของดี 40-48px และตรงกับเกณฑ์พื้นที่แตะ 44 พอดี)
 * - ป้ายเมนู 15px · หัวหมวด 13px ตัวหนาสีจาง · ไอคอน 20px — **ไอคอนเสริมคำ ไม่ใช่แทนคำ**
 * - สถานะหน้าปัจจุบัน = **พื้นแบรนด์จาง + ขีดซ้าย 3px + ตัวหนา + `aria-current="page"`**
 *   (ไม่ใช้สีอย่างเดียวเป็นตัวบอก)
 * - **บัญชีครูกับปุ่มออกจากระบบอยู่ล่างสุด** แยกด้วยเส้นคั่น และเงียบกว่าเมนูหลัก
 * - ตัวเลขแจ้งเตือนข้างเมนู: สีกลางสำหรับจำนวนทั่วไป · **สีแดงเฉพาะของที่ต้องเข้าไปดูเดี๋ยวนี้**
 *
 * ⚠️ ตัวเลขทุกตัวบนแถบนี้มาจาก API จริง (`/api/teacher/board` · `/api/teacher/session` ·
 *    `/api/plan-request`) ไม่มีค่าฝังไว้ในหน้าจอ
 */

const POLL_MS = 5000

interface ClassroomChoice {
  id: string
  roomCode: string
  isDemo: boolean
  status: string
}

interface Badges {
  needAttention: number
  review: number
  requests: number
}

function mmss(total: number | null): string {
  if (total === null) return '--:--'
  const safe = Math.max(0, total)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

interface NavItem {
  href: string
  label: string
  icon: ReactNode
  badge?: number
  /** true = ตัวเลขนี้คือ "ต้องเข้าไปดูเดี๋ยวนี้" ให้ขึ้นสีแดง */
  urgent?: boolean
  /** ลิงก์ออกไปนอกแดชบอร์ด (เปิดแท็บใหม่) */
  external?: boolean
}

export function TeacherShell({
  teacherEmail,
  classrooms,
  children,
}: {
  teacherEmail: string
  classrooms: ClassroomChoice[]
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const askedId = params.get('classroomId')
  const selected = classrooms.find((c) => c.id === askedId) ?? classrooms[0] ?? null
  const classroomId = selected?.id ?? null

  const [badges, setBadges] = useState<Badges>({ needAttention: 0, review: 0, requests: 0 })
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null)
  const [seconds, setSeconds] = useState<number | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const [boardRes, planRes, sessionRes] = await Promise.all([
        fetch(`/api/teacher/board?classroomId=${classroomId}`, { cache: 'no-store' }),
        fetch(`/api/plan-request?classroomId=${classroomId}`, { cache: 'no-store' }),
        fetch(`/api/teacher/session?classroomId=${classroomId}`, { cache: 'no-store' }),
      ])
      if (boardRes.ok && planRes.ok) {
        const board = (await boardRes.json()) as { needAttention?: number; pendingReview?: number }
        const plans = (await planRes.json()) as { requests?: { status?: string }[] }
        setBadges({
          needAttention: board.needAttention ?? 0,
          review: board.pendingReview ?? 0,
          requests: (plans.requests ?? []).filter((r) => (r.status ?? 'pending') === 'pending')
            .length,
        })
      }
      if (sessionRes.ok) {
        const data = (await sessionRes.json()) as {
          session?: {
            phase: string
            timer_end_at: string | null
            timer_paused_seconds: number | null
          }
          phases?: { phase: string; label: string }[]
        }
        const s = data.session
        if (s) {
          setPhaseLabel(data.phases?.find((p) => p.phase === s.phase)?.label ?? s.phase)
          setSeconds(
            s.timer_paused_seconds !== null
              ? s.timer_paused_seconds
              : s.timer_end_at
                ? Math.max(0, Math.round((new Date(s.timer_end_at).getTime() - Date.now()) / 1000))
                : null,
          )
        }
      }
    } catch {
      // เน็ตสะดุดรอบเดียว รอบหน้าค่อยว่ากัน ไม่ล้างเลขเดิมทิ้ง
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (seconds === null) return
    const id = setInterval(() => setSeconds((s) => (s === null ? null : Math.max(0, s - 1))), 1000)
    return () => clearInterval(id)
  }, [seconds === null])

  async function signOut() {
    setSigningOut(true)
    try {
      await fetch('/api/teacher/logout', { method: 'POST' })
    } catch {
      // ต่อไม่ได้ก็ยังพากลับหน้าเข้าสู่ระบบ คุกกี้จะหมดอายุเองอยู่แล้ว
    }
    router.push('/teacher')
    router.refresh()
  }

  const q = classroomId ? `?classroomId=${classroomId}` : ''
  const items: NavItem[] = [
    {
      href: `/teacher${q}`,
      label: 'คุมคาบสด',
      icon: <QuestIcon width={20} height={20} aria-hidden />,
      badge: badges.needAttention,
      urgent: true,
    },
    {
      href: `/teacher/review${q}`,
      label: 'งานรอตรวจ',
      icon: <CheckIcon width={20} height={20} aria-hidden />,
      badge: badges.review,
    },
    {
      href: `/teacher/requests${q}`,
      label: 'คำขอจากนักเรียน',
      icon: <AlertIcon width={20} height={20} aria-hidden />,
      badge: badges.requests,
    },
    {
      href: `/teacher/student${q}`,
      label: 'นักเรียนรายคน',
      icon: <UsersIcon width={20} height={20} aria-hidden />,
    },
    {
      href: `/teacher/report${q}`,
      label: 'รายงานและสถิติ',
      icon: <RewardIcon width={20} height={20} aria-hidden />,
    },
    {
      href: `/teacher/showcase${q}`,
      label: 'ผลงานและจอหน้าห้อง',
      icon: <GlobeIcon width={20} height={20} aria-hidden />,
    },
    {
      href: `/teacher/settings${q}`,
      label: 'ตั้งค่าและปิดคาบ',
      icon: <CrownIcon width={20} height={20} aria-hidden />,
    },
    {
      href: `/teacher/demo${q}`,
      label: 'โหมดสาธิต',
      icon: <StarIcon width={20} height={20} aria-hidden />,
    },
  ]

  const isActive = (href: string) => {
    const path = href.split('?')[0] ?? href
    if (path === '/teacher') return pathname === '/teacher'
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-surface">
      {/* ───────── แถบบน — อยู่กับที่เสมอ ไม่เลื่อน */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface-raised px-3 shadow-soft-1 sm:px-4">
        <Link
          href={`/teacher${q}`}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-1 py-1 focus-ring sm:justify-start"
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-700 to-brand-500 text-ink-onbrand"
          >
            <QuestIcon width={18} height={18} />
          </span>
          <span className="hidden text-label font-extrabold text-ink sm:inline">
            แผงครู · CEO Domain Quest
          </span>
        </Link>

        {/* ห้องที่กำลังเปิด — สลับห้องได้จากทุกหน้า */}
        {classrooms.length > 0 ? (
          <nav aria-label="เลือกห้องเรียน" className="min-w-0 flex-1">
            <ul className="flex min-w-0 gap-2 overflow-x-auto">
              {classrooms.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`${pathname}?classroomId=${c.id}`}
                    aria-current={c.id === classroomId ? 'page' : undefined}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-label font-bold transition-colors duration-200 focus-ring ${
                      c.id === classroomId
                        ? 'bg-brand-600 text-ink-onbrand'
                        : 'bg-surface-sunken text-ink-muted hover:bg-brand-50'
                    }`}
                  >
                    {c.id === classroomId ? (
                      <CheckIcon width={16} height={16} aria-hidden className="shrink-0" />
                    ) : null}
                    ห้อง {c.roomCode}
                    {c.isDemo ? (
                      <span className="rounded-full bg-danger-600 px-1.5 text-note font-bold text-ink-onbrand">
                        สาธิต
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <span className="min-w-0 flex-1 text-label text-ink-muted">ยังไม่มีห้องเรียน</span>
        )}

        {/* สถานะคาบ — เห็นได้ทุกหน้าตามที่สั่ง */}
        {phaseLabel ? (
          <p className="hidden shrink-0 items-center gap-2 rounded-full bg-surface-sunken px-3 py-1.5 text-label font-bold text-ink lg:flex">
            <ClockIcon width={18} height={18} aria-hidden className="text-brand-700" />
            <span className="truncate">{phaseLabel}</span>
            <span className="tabular-nums text-brand-700">{mmss(seconds)}</span>
          </p>
        ) : null}

        {/* บัญชีครู + ออกจากระบบ (จอกว้าง) */}
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <span className="flex items-center gap-1.5 text-note text-ink-muted">
            <ProfileIcon width={18} height={18} aria-hidden />
            <span className="max-w-[12rem] truncate">{teacherEmail}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="btn-base min-h-11 touch-manipulation bg-surface-raised px-3 text-label text-ink ring-1 ring-line-contrast ring-inset hover:bg-danger-100 hover:text-danger-700 disabled:opacity-60"
          >
            {signingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* ───────── เมนูข้าง — อยู่กับที่ ไม่เลื่อน (จอแคบยุบเป็นแถบแนวนอน) */}
        <nav
          aria-label="เมนูของครู"
          className="z-10 hidden w-[236px] shrink-0 flex-col border-r border-line bg-surface-raised lg:flex"
        >
          <p className="px-4 pt-4 pb-1 text-note font-bold tracking-wide text-ink-muted">
            งานในคาบ
          </p>
          <ul className="flex flex-col gap-0.5 px-2">
            {items.map((item) => (
              <li key={item.href}>
                <SideLink item={item} active={isActive(item.href)} />
              </li>
            ))}
          </ul>

          {/* ล่างสุด = ของประจำตัวครู แยกจากเมนูหลักด้วยเส้นและที่ว่าง */}
          <div className="mt-auto border-t border-line p-3">
            <p className="flex items-center gap-1.5 text-note text-ink-muted">
              <ProfileIcon width={16} height={16} aria-hidden className="shrink-0" />
              <span className="truncate">{teacherEmail}</span>
            </p>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="btn-base mt-2 w-full touch-manipulation bg-surface-raised text-label text-ink-muted ring-1 ring-line ring-inset hover:bg-danger-100 hover:text-danger-700 disabled:opacity-60"
            >
              {signingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
            </button>
          </div>
        </nav>

        {/* จอแคบ: เมนูเป็นแถบแนวนอนใต้แถบบน เลื่อนแนวนอนได้ แต่ไม่เลื่อนแนวตั้ง */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <nav
            aria-label="เมนูของครู (จอแคบ)"
            className="shrink-0 overflow-x-auto border-b border-line bg-surface-raised px-2 py-1.5 lg:hidden"
          >
            <ul className="flex gap-1">
              {items.map((item) => (
                <li key={item.href} className="shrink-0">
                  <SideLink item={item} active={isActive(item.href)} compact />
                </li>
              ))}
              <li className="shrink-0">
                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-label font-bold text-ink-muted hover:bg-danger-100 hover:text-danger-700 focus-ring"
                >
                  ออกจากระบบ
                </button>
              </li>
            </ul>
          </nav>

          {/* ───────── เนื้อหา — ชั้นเดียวที่เลื่อนได้ */}
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>

          {/**
           * ตัวปลุกคิวตรวจงาน AI — ระบบไม่มี cron ถ้าไม่มีหน้าครูเปิดค้างไว้ คิวจะไม่เดินเลย (bus T77)
           * ย้ายมาอยู่ที่โครงแดชบอร์ด **คิวจึงเดินทุกหน้าที่ครูเปิด** ไม่ใช่เฉพาะหน้าคุมคาบสด
           * เก็บไว้นอกสายตาเพราะการ์ดของมันสูงเกินและแก้ไม่ได้ (อยู่ใน components/)
           * — ตัวเลขคิวที่ครูเห็นจริงวาดเองจาก /api/jobs/drain เส้นเดียวกัน
           */}
          <div aria-hidden className="pointer-events-none absolute size-0 overflow-hidden opacity-0">
            <TeacherGradeQueueClient />
          </div>
        </div>
      </div>
    </div>
  )
}

function SideLink({
  item,
  active,
  compact = false,
}: {
  item: NavItem
  active: boolean
  compact?: boolean
}) {
  const badge = item.badge ?? 0
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-11 items-center gap-2 rounded-lg px-3 text-label transition-colors duration-200 focus-ring ${
        active
          ? 'bg-brand-50 font-extrabold text-brand-700'
          : 'font-semibold text-ink hover:bg-surface-sunken'
      } ${compact ? 'whitespace-nowrap' : ''}`}
    >
      {/* ขีดซ้ายของหน้าปัจจุบัน — คู่กับตัวหนาและ aria-current ไม่ได้ใช้สีอย่างเดียว */}
      {active && !compact ? (
        <span aria-hidden className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-brand-600" />
      ) : null}
      <span className={active ? 'text-brand-700' : 'text-ink-muted'}>{item.icon}</span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge > 0 ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-note font-bold tabular-nums ${
            item.urgent ? 'bg-danger-600 text-ink-onbrand' : 'bg-surface-sunken text-ink'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

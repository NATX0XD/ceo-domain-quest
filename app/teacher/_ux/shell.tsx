'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TeacherGradeQueueClient } from '../../../components/teacher-grade-queue-client'
import { CloseIcon, ProfileIcon } from '../../../components/ui'
import { Icon3d, type Icon3dName } from './v2'

/**
 * UX-6 โครงแดชบอร์ดของครู — แถบบน + เมนูข้าง + พื้นที่เนื้อหา
 *
 * มติเจ้าของ (รอบแก้โจทย์): หน้าครูเป็น **แดชบอร์ดเต็มรูปแบบ** ไม่ต้องยัดทุกอย่างลงจอเดียว
 * ออกแบบสำหรับจอโน้ตบุ๊ก/จอคอมเป็นหลัก · จอแคบใช้ได้แบบพอไหว
 * **กฎห้ามเลื่อนใช้กับแถบบนกับเมนูข้างเท่านั้น** ทั้งคู่อยู่กับที่เสมอ ส่วนเนื้อหาเลื่อนได้
 * เมนู desktop แสดงทั้งไอคอนและข้อความตั้งแต่ขนาดแท็บเล็ต เพื่อไม่ให้ครูต้องเดาความหมายของไอคอน
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
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const ico = (name: Icon3dName) => <Icon3d name={name} size={28} />

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
  const [drawer, setDrawer] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

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

  // เปลี่ยนหน้า = ปิดลิ้นชักเมนูบนมือถือ
  useEffect(() => {
    setDrawer(false)
    setMenuOpen(false)
    setQuery('')
  }, [pathname])

  useEffect(() => {
    if (!menuOpen && !drawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setDrawer(false)
      }
    }
    const onDown = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [menuOpen, drawer])

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
  const groups: NavGroup[] = [
    {
      title: 'ภาพรวม',
      items: [
        { href: `/teacher${q}`, label: 'คุมคาบสด', icon: ico('chequered-flag'), badge: badges.needAttention, urgent: true },
        { href: `/teacher/board${q}`, label: 'ห้องเรียน', icon: ico('school') },
      ],
    },
    {
      title: 'นักเรียน',
      items: [
        { href: `/teacher/student${q}`, label: 'นักเรียนรายคน', icon: ico('graduation-cap') },
        { href: `/teacher/review${q}`, label: 'งานรอตรวจ', icon: ico('memo'), badge: badges.review },
        { href: `/teacher/requests${q}`, label: 'คำขอจากนักเรียน', icon: ico('speech-balloon'), badge: badges.requests },
      ],
    },
    {
      title: 'รายงาน',
      items: [
        { href: `/teacher/report${q}`, label: 'รายงานผลการเรียน', icon: ico('bar-chart') },
        { href: `/teacher/showcase${q}`, label: 'ผลงานเด่น', icon: ico('glowing-star') },
      ],
    },
    {
      title: 'ระบบ',
      items: [
        { href: `/teacher/settings${q}`, label: 'ตั้งค่า', icon: ico('gear') },
        { href: `/teacher/demo${q}`, label: 'โหมดสาธิต', icon: ico('performing-arts') },
      ],
    },
  ]
  const flat = groups.flatMap((g) => g.items)

  const isActive = (href: string) => {
    const path = href.split('?')[0] ?? href
    if (path === '/teacher') return pathname === '/teacher'
    return pathname === path || pathname.startsWith(`${path}/`)
  }
  const current = flat.find((i) => isActive(i.href))
  const found = useMemo(() => {
    const t = query.trim().toLowerCase()
    return t ? flat.filter((i) => i.label.toLowerCase().includes(t)) : []
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flat สร้างใหม่ทุกครั้งแต่ขึ้นกับ q กับ badges เท่านั้น
  }, [query, q])

  const nav = (collapsedOnTablet: boolean) => (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3">
      {groups.map((g) => (
        <div key={g.title} className="mb-2">
          <p
            className={`px-4 pb-1 text-note font-bold tracking-wide text-ink-muted ${
              collapsedOnTablet ? 'hidden xl:block' : ''
            }`}
          >
            {g.title}
          </p>
          <ul className="flex flex-col gap-0.5 px-2">
            {g.items.map((item) => (
              <li key={item.href}>
                <SideLink item={item} active={isActive(item.href)} collapsible={collapsedOnTablet} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )

  const logo = (collapsedOnTablet: boolean) => (
    <Link
      href={`/teacher${q}`}
      className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4 focus-ring"
      aria-label="CEO Domain Quest แผงครู"
    >
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#fff0bd]">
        <Icon3d name="rocket" size={30} />
      </span>
      <span className={`min-w-0 leading-tight ${collapsedOnTablet ? 'hidden xl:block' : ''}`}>
        <span className="block truncate text-label font-extrabold text-ink">CEO Domain Quest</span>
        <span className="block text-note text-ink-muted">แผงครู</span>
      </span>
    </Link>
  )

  return (
    <div className="teacher-cms flex h-dvh max-h-dvh overflow-hidden bg-surface-sunken">
      {/* ───────── เมนูข้าง (แสดง label ตั้งแต่แท็บเล็ต เพื่อให้ปลายทางอ่านได้ทันที) */}
      <aside
        aria-label="เมนูของครู"
        className="z-10 hidden w-[220px] shrink-0 flex-col border-r border-line bg-surface-raised md:flex xl:w-[248px]"
      >
        {logo(false)}
        {nav(false)}
        <div className="border-t border-line p-3">
          <p className="flex items-center gap-1.5 text-note text-ink-muted">
            <ProfileIcon width={16} height={16} aria-hidden className="shrink-0" />
            <span className="truncate">{teacherEmail}</span>
          </p>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            title="ออกจากระบบ"
            className="t2-btn mt-2" data-block="true" data-size="sm"
          >
            {signingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
          </button>
        </div>
      </aside>

      {/* ───────── มือถือ: ลิ้นชักเมนู */}
      {drawer ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="เมนูของครู">
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface-raised shadow-soft-3">
            <div className="flex items-center justify-between border-b border-line pr-2">
              <div className="flex-1">{logo(false)}</div>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="ปิด"
                className="grid size-11 place-items-center rounded-lg text-ink-muted focus-ring"
              >
                <CloseIcon width={22} height={22} aria-hidden />
              </button>
            </div>
            {nav(false)}
            <div className="border-t border-line p-3">
              <p className="truncate text-note text-ink-muted">{teacherEmail}</p>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="t2-btn mt-2" data-block="true" data-size="sm"
              >
                {signingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* ───────── แถบบน */}
        <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface-raised px-3 sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="เปิดเมนู"
            aria-haspopup="dialog"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-ink hover:bg-surface-sunken focus-ring md:hidden"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-extrabold text-ink">{current?.label ?? 'แผงครู'}</p>
          </div>

          {/* ค้นหาเมนู/หน้า */}
          <div className="relative hidden w-56 shrink-0 lg:block xl:w-72">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !found[0]) return
                e.preventDefault()
                setQuery('')
                router.push(found[0].href)
              }}
              placeholder="ค้นหาหน้า เช่น รายงาน"
              aria-label="ค้นหาหน้า"
              className="h-11 w-full rounded-lg bg-surface-sunken px-3 text-label text-ink ring-1 ring-line outline-none placeholder:text-ink-subtle focus:ring-2 focus:ring-brand-500"
            />
            {found.length > 0 ? (
              <ul className="absolute top-11 right-0 left-0 z-30 overflow-hidden rounded-lg bg-surface-raised shadow-soft-3 ring-1 ring-line">
                {found.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} className="flex min-h-11 items-center gap-2 px-3 text-label text-ink hover:bg-surface-sunken">
                      {i.icon}
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {phaseLabel ? (
            <p className="hidden shrink-0 items-center gap-2 rounded-full bg-[#e8e3fa] px-3 py-1.5 text-label font-bold text-ink xl:flex">
              <Icon3d name="alarm-clock" size={22} />
              <span className="max-w-[10rem] truncate">{phaseLabel}</span>
              <span className="tabular-nums text-brand-700">{mmss(seconds)}</span>
            </p>
          ) : null}

          {/* สลับห้อง */}
          {classrooms.length > 0 ? (
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="sr-only">เลือกห้องเรียน</span>
              <select
                value={classroomId ?? ''}
                onChange={(e) => router.push(`${pathname}?classroomId=${e.target.value}`)}
                className="h-11 w-[8.5rem] max-w-[9rem] rounded-lg bg-surface-raised px-1.5 text-ellipsis sm:w-auto sm:max-w-[12rem] sm:px-2 text-label font-bold text-ink ring-1 ring-line-contrast focus-ring"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    ห้อง {c.roomCode}
                    {c.isDemo ? ' (สาธิต)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="shrink-0 text-label text-ink-muted">ยังไม่มีห้องเรียน</span>
          )}

          {/* เมนูครู */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="เมนูบัญชีครู"
              className="grid size-11 place-items-center rounded-full bg-[#e8e3fa] text-brand-700 focus-ring"
            >
              <ProfileIcon width={20} height={20} aria-hidden />
            </button>
            {menuOpen ? (
              <div role="menu" className="absolute top-12 right-0 z-30 w-60 rounded-xl bg-surface-raised p-2 shadow-soft-3 ring-1 ring-line">
                <p className="truncate px-3 py-2 text-note text-ink-muted">{teacherEmail}</p>
                <Link
                  role="menuitem"
                  href={`/teacher/settings${q}`}
                  className="flex min-h-11 items-center rounded-lg px-3 text-label text-ink hover:bg-surface-sunken"
                >
                  ตั้งค่า
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={signOut}
                  disabled={signingOut}
                  className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-label text-danger-700 hover:bg-danger-100 disabled:opacity-60"
                >
                  {signingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {/* ───────── เนื้อหา — ชั้นเดียวที่เลื่อนได้ */}
        <main className="teacher-cms-main min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>

        {/**
         * ตัวปลุกคิวตรวจงาน AI — ระบบไม่มี cron ถ้าไม่มีหน้าครูเปิดค้างไว้ คิวจะไม่เดินเลย (bus T77)
         * อยู่ที่โครงนี้ คิวจึงเดินทุกหน้าที่ครูเปิด เก็บไว้นอกสายตาเพราะการ์ดของมันสูงเกินและแก้ไม่ได้
         */}
        <div aria-hidden className="pointer-events-none absolute size-0 overflow-hidden opacity-0">
          <TeacherGradeQueueClient />
        </div>
      </div>
    </div>
  )
}

function SideLink({
  item,
  active,
  collapsible,
}: {
  item: NavItem
  active: boolean
  /** true = ที่แท็บเล็ตซ่อนป้าย เหลือไอคอน (ยังมี title กับ sr-only ให้อ่าน) */
  collapsible: boolean
}) {
  const badge = item.badge ?? 0
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={`group relative flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-label transition-colors duration-200 focus-ring ${
        collapsible ? 'justify-center xl:justify-start' : ''
      } ${active ? 'bg-[#e8e3fa] font-extrabold text-ink' : 'font-semibold text-ink hover:bg-[#f6f2e8]'}`}
    >
            <span className="relative grid size-8 place-items-center">
        {item.icon}
        {collapsible && badge > 0 ? (
          <span
            aria-hidden
            className={`absolute -top-2 -right-2.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold tabular-nums ring-2 ring-surface-raised xl:hidden ${
              item.urgent ? 'bg-danger-600 text-ink-onbrand' : 'bg-brand-600 text-ink-onbrand'
            }`}
          >
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      <span className={`min-w-0 flex-1 truncate ${collapsible ? 'sr-only xl:not-sr-only' : ''}`}>{item.label}</span>
      {badge > 0 ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-note font-bold tabular-nums ${
            collapsible ? 'hidden xl:inline' : ''
          } ${item.urgent ? 'bg-danger-600 text-ink-onbrand' : 'bg-surface-sunken text-ink'}`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

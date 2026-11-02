'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CloseIcon } from '../../../components/ui'
import { TeacherDeviceRecommendation } from '@/components/teacher-device-recommendation'
import { Icon3d, type Icon3dName } from './v2'
import { Avatar, ToastProvider } from './ui'
import { createRoomRequest, createdRoomHref } from './create-room'

/**
 * โครงแดชบอร์ดของครู (redesign C1) — เมนูข้าง (ยุบได้ / มือถือเป็นลิ้นชัก) + แถบบน (breadcrumb · สลับห้อง · บัญชี) + เนื้อหา
 * แถบบนกับเมนูข้างอยู่กับที่ เนื้อหาเลื่อนได้ · เมนูใช้ไอคอน 3 มิติเดิมขนาด 22px คู่ข้อความ
 * สถานะหน้าปัจจุบัน = พื้นแบรนด์จาง + ขีดซ้าย 2px + ตัวหนา + aria-current (ไม่ใช้สีอย่างเดียว)
 * ⚠️ ตัวเลขบนแถบนี้มาจาก API จริง ไม่มีค่าฝัง · หน้า /teacher/signup ไม่ใส่โครง (เป็นหน้าเต็มของตัวเอง)
 */

const POLL_MS = 5000

interface ClassroomChoice {
  id: string
  roomCode: string
  isDemo: boolean
  status: string
}

interface Badges {
  review: number
  requests: number
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

const ico = (name: Icon3dName) => <Icon3d name={name} size={22} />
const COLLAPSE_KEY = 'dbq-teacher-nav-collapsed'

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  open: { color: 'var(--s-success)', label: 'เปิด' },
  locked: { color: 'var(--s-warn)', label: 'ล็อก' },
}
const dotOf = (status: string) => STATUS_DOT[status] ?? { color: 'var(--d-notstarted)', label: 'ปิด' }

export function TeacherShell({
  teacherEmail,
  teacherName,
  classrooms,
  children,
}: {
  teacherEmail: string
  /** ชื่อที่โชว์บนการ์ดบัญชี (ไม่มีชื่อ = ใช้อีเมล) */
  teacherName?: string
  classrooms: ClassroomChoice[]
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const askedId = params.get('classroomId')
  const selected = classrooms.find((c) => c.id === askedId) ?? classrooms[0] ?? null
  const classroomId = selected?.id ?? null

  const [badges, setBadges] = useState<Badges>({ review: 0, requests: 0 })
  const [signingOut, setSigningOut] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [switcher, setSwitcher] = useState(false)
  const [bell, setBell] = useState(false)
  const [term, setTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mSearch, setMSearch] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const [navigating, setNavigating] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const [planRes, reviewRes] = await Promise.all([
        fetch(`/api/plan-request?classroomId=${classroomId}`, { cache: 'no-store' }),
        fetch(`/api/teacher/pending-count?classroomId=${classroomId}`, { cache: 'no-store' }),
      ])
      const next: Partial<Badges> = {}
      if (planRes.ok) {
        const plans = (await planRes.json()) as { requests?: { status?: string }[] }
        next.requests = (plans.requests ?? []).filter((r) => (r.status ?? 'pending') === 'pending').length
      }
      if (reviewRes.ok) {
        const r = (await reviewRes.json()) as { pendingCount?: number }
        next.review = r.pendingCount ?? 0
      }
      setBadges((cur) => ({ ...cur, ...next }))
    } catch {
      // เน็ตสะดุดรอบเดียว รอบหน้าค่อยว่ากัน ไม่ล้างเลขเดิมทิ้ง
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  // เปลี่ยนหน้า = ปิดลิ้นชักเมนูบนมือถือ
  useEffect(() => {
    setDrawer(false)
    setMenuOpen(false)
    setSwitcher(false)
    setBell(false)
    setSearchOpen(false)
    setMSearch(false)
    setTerm('')
  }, [pathname])

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
  }, [])
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      window.localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1')
      return !v
    })

  useEffect(() => {
    if (!menuOpen && !drawer && !switcher && !bell && !searchOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setDrawer(false)
        setSwitcher(false)
        setBell(false)
        setSearchOpen(false)
      }
    }
    const onDown = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (switcher && switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcher(false)
      if (bell && bellRef.current && !bellRef.current.contains(e.target as Node)) setBell(false)
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [menuOpen, drawer, switcher, bell, searchOpen])

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
        { href: `/teacher${q}`, label: 'ภาพรวมชั้นเรียน', icon: ico('school') },
      ],
    },
    {
      title: 'นักเรียน',
      items: [
        { href: `/teacher/student${q}`, label: 'นักเรียนรายคน', icon: ico('graduation-cap') },
        { href: `/teacher/review${q}`, label: 'งานรอตรวจ', icon: ico('memo'), badge: badges.review, urgent: true },
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
        { href: `/teacher/missions${q}`, label: 'ตั้งค่าด่าน', icon: ico('gear') },
        { href: `/teacher/settings${q}`, label: 'ห้องและบัญชี', icon: ico('clipboard') },
      ],
    },
  ]
  const flat = groups.flatMap((g) => g.items)

  const tab = params.get('tab')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const createRoom = async () => {
    if (creating) return
    setCreating(true)
    setCreateError(null)
    setSwitcher(false)
    const r = await createRoomRequest()
    setCreating(false)
    if (r.ok) { router.push(createdRoomHref(r.id)); router.refresh() }
    else setCreateError(r.message)
  }
  const createdBanner = params.get('created') === '1' && classroomId ? (
    <section role="status" className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--c-brand)] bg-[var(--c-brand-soft)] p-4 sm:mx-6">
      <p className="m-0 min-w-0 flex-1 basis-60 text-[15px] font-bold text-[var(--c-ink)]">สร้างห้องใหม่แล้ว และสลับมาที่ห้องนี้ให้แล้ว ชวนนักเรียนเข้าห้องได้เลย</p>
      <button type="button" onClick={() => window.open(`/board?classroomId=${classroomId}&mode=join`, '_blank', 'noopener')} className="inline-flex h-10 items-center rounded-xl bg-[var(--c-brand)] px-4 text-[15px] font-bold text-white focus-ring">เปิดจอชวนเข้าห้อง</button>
      <button type="button" onClick={() => window.open(`/board?classroomId=${classroomId}&mode=showcase`, '_blank', 'noopener')} className="inline-flex h-10 items-center rounded-xl border border-[var(--c-brand)] bg-white px-4 text-[15px] font-bold text-[var(--c-brand)] focus-ring">เปิดจอผลงาน</button>
      <button type="button" onClick={() => router.replace(`${pathname}?classroomId=${classroomId}`)} className="inline-flex h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-[var(--c-ink-2)] focus-ring">ปิด</button>
    </section>
  ) : null
  const nextReview = () => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href*="/teacher/review?"][href*="submission="]'))
    if (links.length === 0) return
    const at = links.findIndex((a) => a.getAttribute('aria-current') === 'true')
    const next = links[(at + 1) % links.length]
    if (next) router.push(next.getAttribute('href') ?? '/teacher/review')
  }
  type TopAction = { label: string; icon: Icon3dName; run: () => void; disabled?: boolean }
  const topAction: TopAction | null = !classroomId
    ? null
    : pathname === '/teacher'
      ? { label: 'ชวนนักเรียนเข้าห้อง', icon: 'door', run: () => { window.open(`/board?classroomId=${classroomId}&mode=join`, '_blank', 'noopener') } }
      : pathname.startsWith('/teacher/review')
        ? { label: 'ตรวจถัดไป', icon: 'memo', run: nextReview, disabled: badges.review === 0 }
        : pathname.startsWith('/teacher/student') && params.get('studentId')
          ? { label: 'พิมพ์รายงาน', icon: 'printer', run: () => window.print() }
          : pathname.startsWith('/teacher/missions')
            ? { label: 'บันทึก', icon: 'check-mark-button', run: () => document.querySelector<HTMLButtonElement>('[data-topbar-save]')?.click() }
            : pathname.startsWith('/teacher/showcase') && tab !== 'screen'
              ? { label: 'ขึ้นจอ', icon: 'television', run: () => router.push(`/teacher/showcase?${new URLSearchParams({ classroomId, tab: 'screen' }).toString()}`) }
              : null

  const isActive = (href: string) => {
    const path = href.split('?')[0] ?? href
    if (path === '/teacher') return pathname === '/teacher'
    return pathname === path || pathname.startsWith(`${path}/`)
  }
  const current = flat.find((i) => isActive(i.href))
  const mini = collapsed // เฉพาะเมนูข้าง desktop
  const displayName = teacherName?.trim() || teacherEmail
  const totalAlerts = badges.review + badges.requests
  const hits = term.trim() ? flat.filter((i) => i.label.includes(term.trim())) : flat

  const nav = (isMini: boolean) => (
    <nav aria-label="เมนูหลัก" className="t3-side-panel t3-sidenav flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-1">
      {groups.map((g) => (
        <div key={g.title} className="mb-3 last:mb-0">
          <p className={`t3-group-title ${isMini ? 'sr-only' : ''}`}>{g.title}</p>
          <ul className="flex flex-col gap-1">
            {g.items.map((item) => (
              <li key={item.href}>
                <SideLink item={item} active={isActive(item.href)} mini={isMini} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  const logo = (isMini: boolean) => (
    <Link
      href={`/teacher${q}`}
      className={`flex min-w-0 flex-1 items-center gap-3 focus-ring ${isMini ? 'justify-center' : ''}`}
      aria-label="CEO Domain Quest แผงครู"
    >
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_6px_16px_rgb(10_5_40/0.3)]">
        <Icon3d name="rocket" size={30} />
      </span>
      {isMini ? null : (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-extrabold text-white">CEO Domain Quest</span>
          <span className="block text-[13px] text-white/70">แผงควบคุมสำหรับครู</span>
        </span>
      )}
    </Link>
  )

  const account = (isMini: boolean) => (
    <div className={`m-3 rounded-2xl bg-white/10 ring-1 ring-white/15 ${isMini ? 'p-2' : 'p-3'}`}>
      <div className={`flex items-center gap-2.5 ${isMini ? 'justify-center' : ''}`}>
        <Avatar name={displayName} size={isMini ? 36 : 42} tone="purple" />
        {isMini ? null : (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14px] font-bold text-white">{displayName}</p>
            <p className="text-[12px] text-white/70">ครูผู้สอน</p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        aria-label="ออกจากระบบ"
        title="ออกจากระบบ"
        className={`mt-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white/15 text-[14px] font-semibold text-white transition-colors hover:bg-white/25 focus-ring disabled:opacity-60`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        {isMini ? <span className="sr-only">ออกจากระบบ</span> : signingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
      </button>
    </div>
  )

  // หน้าสมัครครูเป็นหน้าเต็มของตัวเอง ไม่ต้องอยู่ในโครงแดชบอร์ด แม้ครูจะล็อกอินอยู่
  if (pathname === '/teacher/signup' || pathname.startsWith('/teacher/signup/')) return <>{children}</>

  const pageLabel = current?.label ?? 'แผงครู'
  const dot = selected ? dotOf(selected.status) : null

  return (
    <div className="teacher-cms flex h-dvh max-h-dvh overflow-hidden bg-[var(--c-bg)]">
      <ToastProvider>
      <TopProgress onPending={setNavigating} pending={navigating} />
        {/* เมนูข้าง desktop · ยุบเหลือไอคอนได้ */}
        <aside
          aria-label="เมนูของครู"
          className={`t3-side z-10 hidden shrink-0 flex-col transition-[width] duration-200 md:flex ${
            mini ? 'w-[88px]' : 'w-[272px]'
          }`}
        >
          <div className={`flex items-center gap-2 px-4 pt-5 pb-4 ${mini ? 'flex-col px-2' : ''}`}>
            {logo(mini)}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={mini ? 'ขยายเมนู' : 'ยุบเมนู'}
              aria-pressed={mini}
              title={mini ? 'ขยายเมนู' : 'ยุบเมนู'}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-ring"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: mini ? 'rotate(180deg)' : 'none' }}>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
          {nav(mini)}
          {account(mini)}
        </aside>

        {/* มือถือ: ลิ้นชักเมนู */}
        {drawer ? (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="เมนูของครู">
            <button type="button" aria-label="ปิดเมนู" className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
            <div className="t3-side absolute inset-y-0 left-0 flex w-[296px] max-w-[88vw] flex-col shadow-[var(--sh-pop)]">
              <div className="flex items-center gap-2 px-4 pt-5 pb-4">
                {logo(false)}
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  aria-label="ปิด"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-white focus-ring"
                >
                  <CloseIcon width={20} height={20} aria-hidden />
                </button>
              </div>
              {nav(false)}
              {account(false)}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* แถบบน */}
          <header className="t3-top z-20 flex h-16 shrink-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="เปิดเมนู"
              aria-haspopup="dialog"
              className="grid size-11 shrink-0 place-items-center rounded-xl text-ink hover:bg-surface-sunken focus-ring md:hidden"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            <h1 aria-current="page" className="m-0 min-w-0 shrink truncate max-sm:max-w-[6.5rem] max-sm:text-[16px] md:max-w-[220px] md:shrink-0 text-[18px] leading-7 font-bold text-[var(--c-ink)]">{pageLabel}</h1>

            {/* ค้นหาหน้า — พิมพ์ชื่อเมนูแล้วกดเข้า */}
            <div ref={searchRef} className={mSearch ? 'fixed inset-x-3 top-[4.25rem] z-30 md:static md:mx-auto md:block md:min-w-0 md:max-w-[480px] md:flex-1' : 'relative mx-auto hidden min-w-0 max-w-[480px] flex-1 md:block'}>
              <label className="t3-search">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                </svg>
                <span className="sr-only">ค้นหาหน้าในแผงครู</span>
                <input
                  value={term}
                  onChange={(e) => { setTerm(e.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && hits[0]) { router.push(hits[0].href); setSearchOpen(false); setTerm('') }
                  }}
                  placeholder="ค้นหาหน้า…"
                  autoComplete="off"
                />
              </label>
              {searchOpen ? (
                <ul role="listbox" aria-label="ผลการค้นหาหน้า" className="absolute top-12 left-0 z-30 w-full rounded-2xl bg-white p-1.5 shadow-[var(--sh-pop)] ring-1 ring-[var(--c-line)]">
                  {hits.length === 0 ? (
                    <li className="px-3 py-2.5 text-[14px] text-ink-muted">ไม่พบหน้าที่ตรงกัน</li>
                  ) : hits.map((i) => (
                    <li key={i.href} role="option" aria-selected={false}>
                      <Link href={i.href} className="flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-[14px] text-ink hover:bg-[var(--c-brand-soft)]">
                        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-[var(--c-sunken)]">{i.icon}</span>
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setMSearch((v) => !v)}
              aria-label="ค้นหาหน้า"
              aria-expanded={mSearch}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--c-bg)] text-[var(--c-ink-2)] focus-ring md:hidden"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            </button>
            {/* สลับห้อง */}
            {classrooms.length > 0 ? (
              <div ref={switcherRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setSwitcher((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={switcher}
                  aria-label="เลือกห้องเรียน"
                  className="t3-chip-select focus-ring"
                >
                  <span className="max-sm:hidden"><Icon3d name="school" size={20} /></span>
                  {dot ? <span aria-hidden className="size-2 rounded-full" style={{ background: dot.color }} /> : null}
                  <span className="max-w-[4.25rem] truncate sm:max-w-[11rem]"><span className="max-sm:hidden">ห้อง </span>{selected?.roomCode}</span>
                  {selected?.isDemo ? (
                    <span className="rounded bg-white/80 px-1.5 text-[11px] font-bold">DEMO</span>
                  ) : null}
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {switcher ? (
                  <ul
                    role="listbox"
                    aria-label="ห้องเรียน"
                    className="absolute top-12 right-0 z-30 max-h-72 w-64 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[var(--sh-pop)] ring-1 ring-[var(--c-line)]"
                  >
                    {classrooms.map((c) => {
                      const d = dotOf(c.status)
                      return (
                        <li key={c.id} role="option" aria-selected={c.id === classroomId}>
                          <button
                            type="button"
                            onClick={() => {
                              setSwitcher(false)
                              router.push(`${pathname}?classroomId=${c.id}`)
                            }}
                            className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[14px] hover:bg-surface-sunken ${
                              c.id === classroomId ? 'bg-[var(--c-brand-soft)] font-semibold text-[var(--c-brand)]' : ''
                            }`}
                          >
                            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
                            <span className="min-w-0 flex-1 truncate">ห้อง {c.roomCode}</span>
                            {c.isDemo ? <span className="rounded bg-[var(--c-sunken)] px-1.5 text-[11px] font-semibold text-ink-muted">DEMO</span> : null}
                            <span className="text-[12px] text-ink-muted">{d.label}</span>
                          </button>
                        </li>
                      )
                    })}
                    <li role="presentation" className="mt-1 border-t border-[var(--c-line)] pt-1">
                      <button
                        type="button"
                        onClick={() => void createRoom()}
                        disabled={creating}
                        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[14px] font-bold text-[var(--c-brand)] hover:bg-surface-sunken focus-ring disabled:opacity-50"
                      >
                        {creating ? 'กำลังสร้างห้อง…' : '+ สร้างห้องใหม่'}
                      </button>
                    </li>
                  </ul>
                ) : null}
              </div>
            ) : (
              <button type="button" onClick={() => void createRoom()} disabled={creating} className="shrink-0 rounded-xl border border-[var(--c-brand)] px-3 py-2 text-[14px] font-bold text-[var(--c-brand)] focus-ring disabled:opacity-50">
                {creating ? 'กำลังสร้างห้อง…' : '+ สร้างห้องใหม่'}
              </button>
            )}
            {createError ? <span role="alert" className="shrink-0 text-[13px] font-semibold text-[var(--s-danger-ink)]">{createError}</span> : null}

            {topAction ? (
              <button
                type="button"
                onClick={topAction.run}
                disabled={topAction.disabled}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--c-brand)] bg-[var(--c-brand)] px-3 text-[15px] font-bold whitespace-nowrap text-white shadow-[0_4px_12px_rgb(75_58_122/0.3)] transition-colors hover:bg-[var(--c-brand-hover)] focus-ring disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              >
                <Icon3d name={topAction.icon} size={20} />
                <span className="max-sm:hidden">{topAction.label}</span>
                <span className="sr-only sm:hidden">{topAction.label}</span>
              </button>
            ) : null}

            {/* ระฆัง — ตัวเลขจริงจากงานรอตรวจ + คำขอที่รอตอบ */}
            <div ref={bellRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setBell((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={bell}
                aria-label={totalAlerts > 0 ? `การแจ้งเตือน ${totalAlerts} รายการ` : 'การแจ้งเตือน'}
                className="relative grid size-10 place-items-center rounded-xl bg-[var(--c-bg)] text-[var(--c-ink-2)] hover:bg-[var(--c-brand-soft)] focus-ring"
              >
                <Icon3d name="bell" size={22} />
                {totalAlerts > 0 ? (
                  <span aria-hidden className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[var(--s-danger)] px-1 text-[11px] leading-5 font-bold text-white ring-2 ring-white">
                    {totalAlerts > 99 ? '99+' : totalAlerts}
                  </span>
                ) : null}
              </button>
              {bell ? (
                <div role="menu" className="absolute top-12 right-0 z-30 w-72 rounded-2xl bg-white p-2 shadow-[var(--sh-pop)] ring-1 ring-[var(--c-line)]">
                  <p className="px-2.5 py-1.5 text-[13px] font-bold text-ink-muted">ต้องดูแลตอนนี้</p>
                  {totalAlerts === 0 ? (
                    <p className="px-2.5 py-3 text-[14px] text-ink-muted">ไม่มีงานค้าง ทุกอย่างเรียบร้อย</p>
                  ) : (
                    <>
                      {badges.review > 0 ? (
                        <Link role="menuitem" href={`/teacher/review${q}`} className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 hover:bg-surface-sunken">
                          <span aria-hidden data-tone="amber" className="t3-tile size-9 rounded-xl"><Icon3d name="memo" size={20} /></span>
                          <span className="flex-1 text-[14px] font-semibold text-ink">งานรอตรวจ</span>
                          <span className="rounded-full bg-[var(--s-danger)] px-2 text-[13px] font-bold text-white">{badges.review}</span>
                        </Link>
                      ) : null}
                      {badges.requests > 0 ? (
                        <Link role="menuitem" href={`/teacher/requests${q}`} className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 hover:bg-surface-sunken">
                          <span aria-hidden data-tone="blue" className="t3-tile size-9 rounded-xl"><Icon3d name="speech-balloon" size={20} /></span>
                          <span className="flex-1 text-[14px] font-semibold text-ink">คำขอจากนักเรียน</span>
                          <span className="rounded-full bg-[var(--c-brand)] px-2 text-[13px] font-bold text-white">{badges.requests}</span>
                        </Link>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>

            </div>
          </header>

          <TeacherDeviceRecommendation />

          {/* เนื้อหา — ชั้นเดียวที่เลื่อนได้ */}
          <main className="teacher-cms-main t3-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={navigating || undefined}>
            {createdBanner}
            {children}
          </main>
        </div>
      </ToastProvider>
    </div>
  )
}

/** แถบความคืบหน้าบางสุดหน้าจอ — เริ่มเมื่อกดลิงก์ภายใน /teacher จบเมื่อ path/ query เปลี่ยน */
function TopProgress({ pending, onPending }: { pending: boolean; onPending: (v: boolean) => void }) {
  const pathname = usePathname()
  const params = useSearchParams().toString()
  const [w, setW] = useState(0)

  useEffect(() => {
    onPending(false)
    setW(100)
    const t = window.setTimeout(() => setW(0), 250)
    return () => window.clearTimeout(t)
  }, [pathname, params, onPending])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || a.target === '_blank') return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/teacher')) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      onPending(true)
      setW(12)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [onPending])

  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => setW((v) => (v < 85 ? v + (90 - v) * 0.15 : v)), 200)
    const fail = window.setTimeout(() => onPending(false), 8000)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(fail)
    }
  }, [pending, onPending])

  return <div aria-hidden className="t2-progress" style={{ width: `${w}%`, opacity: w === 0 || w === 100 ? 0 : 1 }} />
}

function SideLink({ item, active, mini }: { item: NavItem; active: boolean; mini: boolean }) {
  const badge = item.badge ?? 0
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={mini ? item.label : undefined}
      className={`t3-nav-link focus-ring ${mini ? 'justify-center px-0' : ''}`}
    >
      <span className="t3-nav-ico relative">
        {item.icon}
        {mini && badge > 0 ? (
          <span
            aria-hidden
            className={`absolute -top-1.5 -right-2 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold tabular-nums ring-2 ring-white ${
              item.urgent ? 'bg-danger-600 text-ink-onbrand' : 'bg-brand-600 text-ink-onbrand'
            }`}
          >
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      <span className={`min-w-0 flex-1 truncate ${mini ? 'sr-only' : ''}`}>{item.label}</span>
      {!mini && badge > 0 ? (
        <span
          className={`shrink-0 rounded-full px-2 text-[12px] leading-5 font-bold tabular-nums ${
            item.urgent ? 'bg-[var(--s-danger)] text-white' : active ? 'bg-white text-[var(--c-brand)]' : 'bg-[var(--c-brand)] text-white'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CloseIcon, ProfileIcon } from '../../../components/ui'
import { TeacherDeviceRecommendation } from '@/components/teacher-device-recommendation'
import { Icon3d, type Icon3dName } from './v2'
import { ToastProvider } from './ui'

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

  const [badges, setBadges] = useState<Badges>({ review: 0, requests: 0 })
  const [signingOut, setSigningOut] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [switcher, setSwitcher] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const planRes = await fetch(`/api/plan-request?classroomId=${classroomId}`, { cache: 'no-store' })
      if (planRes.ok) {
        const plans = (await planRes.json()) as { requests?: { status?: string }[] }
        setBadges({
          review: 0,
          requests: (plans.requests ?? []).filter((r) => (r.status ?? 'pending') === 'pending')
            .length,
        })
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

  // เปลี่ยนหน้า = ปิดลิ้นชักเมนูบนมือถือ
  useEffect(() => {
    setDrawer(false)
    setMenuOpen(false)
    setSwitcher(false)
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
    if (!menuOpen && !drawer && !switcher) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setDrawer(false)
        setSwitcher(false)
      }
    }
    const onDown = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (switcher && switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcher(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [menuOpen, drawer, switcher])

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
        { href: `/teacher/missions${q}`, label: 'ตั้งค่าด่าน', icon: ico('gear') },
        { href: `/teacher/settings${q}`, label: 'ห้องและบัญชี', icon: ico('clipboard') },
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
  const mini = collapsed // เฉพาะเมนูข้าง desktop

  const nav = (isMini: boolean) => (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3">
      {groups.map((g) => (
        <div key={g.title} className="mb-3">
          <p className={`px-4 pb-1 text-[13px] font-semibold text-ink-muted ${isMini ? 'sr-only' : ''}`}>{g.title}</p>
          <ul className="flex flex-col gap-0.5 px-2">
            {g.items.map((item) => (
              <li key={item.href}>
                <SideLink item={item} active={isActive(item.href)} mini={isMini} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )

  const logo = (isMini: boolean) => (
    <Link
      href={`/teacher${q}`}
      className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4 focus-ring ${isMini ? 'justify-center px-0' : ''}`}
      aria-label="CEO Domain Quest แผงครู"
    >
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--c-sunken)]">
        <Icon3d name="rocket" size={24} />
      </span>
      {isMini ? null : (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-semibold text-ink">CEO Domain Quest</span>
          <span className="block text-[13px] text-ink-muted">แผงครู</span>
        </span>
      )}
    </Link>
  )

  const account = (
    <div className="border-t border-line p-3">
      <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
        <ProfileIcon width={16} height={16} aria-hidden className="shrink-0" />
        <span className="truncate">{teacherEmail}</span>
      </p>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="mt-1 text-[13px] text-ink-muted underline underline-offset-2 hover:text-ink disabled:opacity-60"
      >
        {signingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
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
          className={`z-10 hidden shrink-0 flex-col border-r border-line bg-surface-raised transition-[width] duration-200 md:flex ${
            mini ? 'w-16' : 'w-60'
          }`}
        >
          {logo(mini)}
          {nav(mini)}
          {mini ? null : account}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={mini ? 'ขยายเมนู' : 'ยุบเมนู'}
            aria-pressed={mini}
            title={mini ? 'ขยายเมนู' : 'ยุบเมนู'}
            className="flex h-11 shrink-0 items-center justify-center border-t border-line text-ink-muted hover:bg-surface-sunken focus-ring"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: mini ? 'rotate(180deg)' : 'none' }}>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </aside>

        {/* มือถือ: ลิ้นชักเมนู */}
        {drawer ? (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="เมนูของครู">
            <button type="button" aria-label="ปิดเมนู" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface-raised shadow-[var(--sh-pop)]">
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
              {account}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* แถบบน */}
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

            <nav aria-label="ตำแหน่งหน้า" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-[14px] text-ink-muted">
                <li className="hidden shrink-0 sm:block">
                  <Link href={`/teacher${q}`} className="hover:text-ink">แผงครู</Link>
                </li>
                <li aria-hidden className="hidden sm:block">/</li>
                <li aria-current="page" className="truncate font-semibold text-ink">{pageLabel}</li>
              </ol>
            </nav>

            {/* สลับห้อง */}
            {classrooms.length > 0 ? (
              <div ref={switcherRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setSwitcher((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={switcher}
                  aria-label="เลือกห้องเรียน"
                  className="flex h-10 items-center gap-2 rounded-lg border border-line-contrast bg-surface-raised px-3 text-[14px] font-medium text-ink hover:bg-surface-sunken focus-ring"
                >
                  {dot ? <span aria-hidden className="size-2 rounded-full" style={{ background: dot.color }} /> : null}
                  <span className="max-w-[7rem] truncate sm:max-w-[12rem]">ห้อง {selected?.roomCode}</span>
                  {selected?.isDemo ? (
                    <span className="rounded bg-[var(--c-sunken)] px-1.5 text-[11px] font-semibold text-ink-muted">DEMO</span>
                  ) : null}
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {switcher ? (
                  <ul
                    role="listbox"
                    aria-label="ห้องเรียน"
                    className="absolute top-11 right-0 z-30 max-h-72 w-64 overflow-y-auto rounded-xl bg-surface-raised p-1.5 shadow-[var(--sh-pop)] ring-1 ring-line"
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
                            className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[14px] hover:bg-surface-sunken ${
                              c.id === classroomId ? 'bg-[var(--c-brand-soft)] font-semibold' : ''
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
                  </ul>
                ) : null}
              </div>
            ) : (
              <span className="shrink-0 text-[14px] text-ink-muted">ยังไม่มีห้องเรียน</span>
            )}

            {/* เมนูบัญชี */}
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="เมนูบัญชีครู"
                className="grid size-10 place-items-center rounded-full bg-[var(--c-brand-soft)] text-[var(--c-brand)] focus-ring"
              >
                <ProfileIcon width={20} height={20} aria-hidden />
              </button>
              {menuOpen ? (
                <div role="menu" className="absolute top-12 right-0 z-30 w-60 rounded-xl bg-surface-raised p-1.5 shadow-[var(--sh-pop)] ring-1 ring-line">
                  <p className="truncate px-3 py-2 text-[13px] text-ink-muted">{teacherEmail}</p>
                  <Link role="menuitem" href={`/teacher/settings${q}`} className="flex min-h-10 items-center rounded-lg px-3 text-[14px] text-ink hover:bg-surface-sunken">
                    ตั้งค่า
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                    disabled={signingOut}
                    className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[14px] text-danger-700 hover:bg-danger-100 disabled:opacity-60"
                  >
                    {signingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <TeacherDeviceRecommendation />

          {/* เนื้อหา — ชั้นเดียวที่เลื่อนได้ */}
          <main className="teacher-cms-main min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={navigating || undefined}>
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
      title={item.label}
      className={`group relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[15px] transition-colors focus-ring ${
        mini ? 'justify-center' : ''
      } ${
        active
          ? 'bg-[var(--c-brand-soft)] font-semibold text-[var(--c-brand)]'
          : 'font-medium text-ink hover:bg-surface-sunken'
      }`}
    >
      {active ? <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-[var(--c-brand)]" /> : null}
      <span className="relative grid size-6 shrink-0 place-items-center">
        {item.icon}
        {mini && badge > 0 ? (
          <span
            aria-hidden
            className={`absolute -top-1.5 -right-2 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold tabular-nums ring-2 ring-surface-raised ${
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
          className={`shrink-0 rounded-md px-1.5 text-[13px] font-semibold tabular-nums ${
            item.urgent ? 'bg-danger-600 text-ink-onbrand' : 'bg-surface-sunken text-ink'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

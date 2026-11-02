'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { shopArtFallbackSrc, shopArtSrc, shopArtStageFromLevel, shopStageFromCleared, SHOP_STAGE_MAX } from '@/components/shop-art'
import { ShopArtImg } from '@/components/shop-art-img'
import { Avatar, EmptyState, StatusBadge, type PassStatus } from './ui'
import { Icon3d } from './v2'

export interface StudentCardData {
  studentId: string
  nickname: string
  /** ด่านที่ผ่านแล้วรวม CEO (0–5) — ใช้คำนวณขั้นของภาพร้านด้วยตรรกะเดียวกับหน้า /home ของนักเรียน */
  cleared: number
  /** ผ่าน/ส่ง CEO แล้ว */
  ceoDone: boolean
  started: boolean
  typeId: string | null
  stars: number | null
  pending: boolean
}

const TYPE_LABEL: Record<string, string> = {
  bakery: 'ร้านเบเกอรี่',
  clothes: 'ร้านเสื้อผ้า',
  coffee: 'ร้านกาแฟ',
  secondhand: 'ร้านมือสอง',
  'phone-repair': 'ร้านซ่อมมือถือ',
  flower: 'ร้านดอกไม้',
  food: 'ร้านอาหาร',
  game: 'ร้านเกม',
}

type Filter = 'all' | 'inprogress' | 'notstarted' | 'passed' | 'pending'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'inprogress', label: 'กำลังเรียน' },
  { id: 'notstarted', label: 'ยังไม่เริ่ม' },
  { id: 'passed', label: 'ส่ง CEO แล้ว' },
  { id: 'pending', label: 'รอตรวจ' },
]

export function cardStatus(s: Pick<StudentCardData, 'ceoDone' | 'started' | 'cleared'>): PassStatus {
  if (s.ceoDone) return 'passed'
  return s.cleared > 0 || s.started ? 'inprogress' : 'notstarted'
}
const STATUS_TEXT: Record<PassStatus, string> = {
  passed: 'ส่ง CEO แล้ว',
  inprogress: 'กำลังเรียน',
  atrisk: 'รอตรวจ',
  failed: 'ไม่ผ่าน',
  notstarted: 'ยังไม่เริ่ม',
}

function CardMenu({ name, reportHref }: { name: string; reportHref: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', key) }
  }, [open])
  const item = 'flex min-h-10 items-center rounded-lg px-3 text-[14px] text-[var(--c-ink)] hover:bg-[var(--c-sunken)]'
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`เมนูของ ${name}`}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-sunken)] focus-ring"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
      </button>
      {open ? (
        <div role="menu" className="absolute top-10 right-0 z-20 w-52 rounded-xl bg-white p-1.5 shadow-[var(--sh-pop)] ring-1 ring-[var(--c-line)]">
          <Link role="menuitem" href={reportHref} className={item}>ดูรายงาน</Link>
          <Link role="menuitem" href={`${reportHref}&print=1`} className={item}>พิมพ์เกียรติบัตร / รายงาน</Link>
        </div>
      ) : null}
    </div>
  )
}

function StudentCard({ s, classroomId }: { s: StudentCardData; classroomId: string | null }) {
  const stage = shopArtStageFromLevel(shopStageFromCleared(s.cleared, SHOP_STAGE_MAX))
  const status = s.pending ? 'atrisk' : cardStatus(s)
  const pct = Math.round((Math.min(s.cleared, 5) / 5) * 100)
  const reportHref = `/teacher/student?classroomId=${classroomId ?? ''}&studentId=${s.studentId}`
  return (
    <li className="t3-scard">
      <div className="flex items-center gap-3">
        <Avatar name={s.nickname} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={reportHref} className="block truncate text-[15px] font-bold text-[var(--c-ink)] hover:text-[var(--c-brand)]">{s.nickname}</Link>
          <p className="truncate text-[13px] text-[var(--c-ink-3)]">{TYPE_LABEL[s.typeId ?? ''] ?? 'ยังไม่เลือกร้าน'}</p>
        </div>
        <CardMenu name={s.nickname} reportHref={reportHref} />
      </div>
      <Link href={reportHref} aria-label={`รายงานของ ${s.nickname}`} className="t3-shop">
        <ShopArtImg src={shopArtSrc(s.typeId, stage)} fallback={shopArtFallbackSrc(stage)} alt={`ร้านของ ${s.nickname} ขั้น ${stage}`} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
      </Link>
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold text-[var(--c-ink-2)]">ขั้น {stage}/{SHOP_STAGE_MAX}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-[var(--c-ink-2)] tabular-nums"><Icon3d name="glowing-star" size={16} />{s.stars ?? 0} ดาว</span>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[12px] text-[var(--c-ink-3)] tabular-nums">
          <span>ด่านที่ผ่าน</span><span>{Math.min(s.cleared, 5)}/5</span>
        </div>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`ความคืบหน้า ${pct}%`} className="h-2 overflow-hidden rounded-full bg-[var(--c-sunken)]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(--d-${status === 'atrisk' ? 'inprogress' : status})` }} />
        </div>
      </div>
      <div><StatusBadge status={status}>{STATUS_TEXT[status]}</StatusBadge></div>
    </li>
  )
}

/** ตารางการ์ดนักเรียน (อ้างอิงกริด CRM) — ใช้ทั้งหน้ารายคนและหน้าแรก */
export function StudentCards({
  students,
  classroomId,
  roomCode,
  limit,
  filterable = true,
}: {
  students: StudentCardData[]
  classroomId: string | null
  roomCode?: string | null
  limit?: number
  filterable?: boolean
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [term, setTerm] = useState('')
  const match = (s: StudentCardData, f: Filter) => (f === 'all' ? true : f === 'pending' ? s.pending : cardStatus(s) === f)
  const shown = students.filter((s) => match(s, filter) && s.nickname.includes(term.trim()))
  const list = limit ? shown.slice(0, limit) : shown
  const count = (f: Filter) => students.filter((s) => match(s, f)).length

  return (
    <div>
      {filterable ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="กรองตามสถานะ" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="t3-chipbtn focus-ring" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <span className="tabular-nums opacity-75">{count(f.id)}</span>
              </button>
            ))}
          </div>
          <label className="t3-search ml-auto w-full sm:w-64">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span className="sr-only">ค้นหาชื่อนักเรียน</span>
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="ค้นหาชื่อ…" />
          </label>
        </div>
      ) : null}
      {students.length === 0 ? (
        <div className="t3-card"><EmptyState title="ยังไม่มีผู้เรียนในห้องนี้" body={roomCode ? `ให้นักเรียนเข้าห้องด้วยรหัส ${roomCode}` : 'สร้างห้องแล้วแชร์รหัสห้องให้นักเรียน'} /></div>
      ) : list.length === 0 ? (
        <div className="t3-card"><EmptyState art={null} icon={<Icon3d name="busts-in-silhouette" size={28} />} title="ไม่พบนักเรียนที่ตรงกับตัวกรอง" /></div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((s) => <StudentCard key={s.studentId} s={s} classroomId={classroomId} />)}
        </ul>
      )}
    </div>
  )
}

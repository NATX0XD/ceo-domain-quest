'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { useMemo, useState } from 'react'
import { AlertIcon, CheckIcon, ShareIcon } from '@/components/ui'
import { Icon3d, type Icon3dName } from '@/app/teacher/_ux/v2'
import { Button } from '@/app/teacher/_ux/ui'
import { createRoomRequest } from '@/app/teacher/_ux/create-room'
import styles from '@/app/teacher/settings/settings.module.css'

export interface TeacherRoomSummary {
  id: string
  roomCode: string
  status: string
  createdAt: string
  studentCount: number
  isDemo: boolean
}

type Props = {
  rooms: TeacherRoomSummary[]
  selectedId: string | null
  joinUrl: string | null
  qrSvg: string | null
}

const STATUS_LABEL: Record<string, string> = { open: 'เปิดรับนักเรียน', locked: 'พักห้องไว้', closed: 'ปิดถาวร' }
const STATUS_TONE: Record<string, 'open' | 'locked' | 'closed'> = { open: 'open', locked: 'locked', closed: 'closed' }

function dateText(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
}

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status
}

function roomHref(id: string) {
  return `/teacher/settings?classroomId=${encodeURIComponent(id)}&tab=room`
}

function ActionIcon({ name }: { name: Icon3dName }) {
  return <Icon3d name={name} size={21} />
}

export function TeacherRoomClient({ rooms: initialRooms, selectedId, joinUrl, qrSvg }: Props) {
  const router = useRouter()
  const [rooms, setRooms] = useState(initialRooms)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selected = rooms.find((room) => room.id === selectedId) ?? rooms[0] ?? null
  const selectedJoinUrl = selected ? joinUrl ?? `/join?code=${selected.roomCode}` : null
  const selectedQr = selected?.id === selectedId ? qrSvg : null
  const totalStudents = useMemo(() => rooms.reduce((sum, room) => sum + room.studentCount, 0), [rooms])

  function clearMessages() {
    setNotice(null)
    setError(null)
  }

  async function copyLink() {
    if (!selectedJoinUrl) return
    clearMessages()
    try {
      await navigator.clipboard.writeText(selectedJoinUrl)
      setCopied(true)
      setNotice('คัดลอกลิงก์เข้าห้องแล้ว')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setError(`คัดลอกไม่ได้ ลองเปิดลิงก์นี้แทน: ${selectedJoinUrl}`)
    }
  }

  async function downloadQr() {
    if (!selected || !selectedJoinUrl) return
    clearMessages()
    setBusy('qr')
    try {
      const dataUrl = await QRCode.toDataURL(selectedJoinUrl, { width: 1200, margin: 2, errorCorrectionLevel: 'M' })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `join-${selected.roomCode}.png`
      link.click()
      setNotice('ดาวน์โหลด QR เป็น PNG แล้ว')
    } catch {
      setError('ดาวน์โหลด QR ไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(null)
    }
  }

  async function createRoom() {
    if (busy) return
    clearMessages()
    setBusy('create')
    const result = await createRoomRequest()
    if (result.ok) {
      router.push(roomHref(result.id))
      router.refresh()
      return
    }
    setBusy(null)
    setError(result.message)
  }

  async function toggleRoom(room: TeacherRoomSummary) {
    if (busy) return
    clearMessages()
    setBusy(`toggle-${room.id}`)
    const nextStatus = room.status === 'open' ? 'locked' : 'open'
    try {
      const response = await fetch('/api/teacher/classroom', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classroomId: room.id, status: nextStatus }),
      })
      const data = (await response.json().catch(() => null)) as { message?: string; classroom?: { status?: string } } | null
      if (!response.ok || !data?.classroom) {
        setError(data?.message ?? 'เปลี่ยนสถานะห้องไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setRooms((current) => current.map((item) => item.id === room.id ? { ...item, status: data.classroom?.status ?? nextStatus } : item))
      setNotice(nextStatus === 'open' ? `เปิดห้อง ${room.roomCode} แล้ว` : `พักห้อง ${room.roomCode} แล้ว`)
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(null)
    }
  }

  async function deleteRoom(room: TeacherRoomSummary) {
    if (busy) return
    const warning = room.studentCount > 0
      ? `ห้อง ${room.roomCode} มีนักเรียน ${room.studentCount} คน\n\nการลบจะลบข้อมูลนักเรียน ผลงาน และร่องรอยการเรียนทั้งหมด กู้คืนไม่ได้\n\nต้องการลบห้องนี้ต่อหรือไม่`
      : `ต้องการลบห้อง ${room.roomCode} หรือไม่ การลบกู้คืนไม่ได้`
    if (!window.confirm(warning)) return

    clearMessages()
    setBusy(`delete-${room.id}`)
    try {
      const response = await fetch('/api/teacher/classroom', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classroomId: room.id }),
      })
      const data = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setError(data?.message ?? 'ลบห้องไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      const remaining = rooms.filter((item) => item.id !== room.id)
      setRooms(remaining)
      setNotice(`ลบห้อง ${room.roomCode} แล้ว`)
      if (room.id === selectedId) {
        router.replace(remaining[0] ? roomHref(remaining[0].id) : '/teacher/settings?tab=room')
        router.refresh()
      }
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={styles.roomManager}>
      {selected ? (
        <div className={styles.roomTopGrid}>
          <section className={styles.roomHero} aria-labelledby="room-hero-title">
            <div className={styles.heroCopy}>
              <p className={styles.heroKicker}>ห้องเรียนที่เลือกอยู่</p>
              <h2 id="room-hero-title" className={styles.heroTitle}>พร้อมพาเด็ก ๆ เข้าเรียน</h2>
              <div className={styles.roomCodeSign} aria-label={`รหัสห้อง ${selected.roomCode}`}>
                <span>รหัสเข้าห้อง</span>
                <strong>{selected.roomCode}</strong>
              </div>
              <div className={styles.heroFacts}>
                <span className={`${styles.statusBadge} ${styles[`status-${STATUS_TONE[selected.status] ?? 'closed'}`]}`}>
                  <i aria-hidden /> {statusLabel(selected.status)}
                </span>
                <span><ActionIcon name="busts-in-silhouette" /> {selected.studentCount} คน</span>
                <span><ActionIcon name="alarm-clock" /> เปิดเมื่อ {dateText(selected.createdAt)}</span>
              </div>
              <div className={styles.heroActions}>
                <Button kind="primary" onClick={copyLink} className={styles.heroPrimaryButton}>
                  {copied ? <CheckIcon width={18} height={18} aria-hidden /> : <ShareIcon width={18} height={18} aria-hidden />}
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                </Button>
                <Button kind="secondary" onClick={() => window.open(`/board?classroomId=${selected.id}&mode=join`, '_blank', 'noopener')}>
                  <ActionIcon name="television" /> เปิดจอชวนเข้าห้อง
                </Button>
                <Button kind="secondary" onClick={() => window.open(`/board?classroomId=${selected.id}&mode=showcase`, '_blank', 'noopener')}>
                  <ActionIcon name="sparkles" /> เปิดจอผลงาน
                </Button>
              </div>
            </div>
            <div className={styles.heroArt} aria-hidden>
              <Image src="/ui/teacher/room-dome.webp" alt="" width={700} height={420} priority />
            </div>
          </section>

          <aside className={styles.qrCard} aria-labelledby="qr-card-title">
            <div className={styles.qrHeader}>
              <div>
                <p className={styles.cardEyebrow}>ทางลัดสำหรับนักเรียน</p>
                <h2 id="qr-card-title">สแกนเข้าห้อง</h2>
              </div>
              <span className={styles.qrIcon}><ActionIcon name="magnifying-glass-tilted-left" /></span>
            </div>
            {selectedQr ? (
              // eslint-disable-next-line react/no-danger
              <div className={styles.qrImage} role="img" aria-label={`QR code ของลิงก์ ${selectedJoinUrl}`} dangerouslySetInnerHTML={{ __html: selectedQr }} />
            ) : <div className={styles.qrFallback}>กำลังเตรียม QR…</div>}
            <p className={styles.joinUrl}>{selectedJoinUrl}</p>
            <div className={styles.qrActions}>
              <Button kind="secondary" onClick={downloadQr} disabled={busy === 'qr'}>
                <ActionIcon name="package" /> {busy === 'qr' ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลด QR (PNG)'}
              </Button>
              <Button kind="ghost" onClick={() => window.print()}>
                <ActionIcon name="printer" /> พิมพ์โปสเตอร์
              </Button>
            </div>
          </aside>
        </div>
      ) : (
        <section className={styles.noRoomHero}>
          <div>
            <p className={styles.heroKicker}>เริ่มต้นห้องแรกของคุณ</p>
            <h2>สร้างห้อง แล้วชวนนักเรียนเข้ามาได้ทันที</h2>
            <p>ระบบจะสร้างรหัส 6 ตัวและ QR ให้พร้อมใช้สำหรับคาบเรียน</p>
            <Button kind="primary" onClick={createRoom} disabled={busy === 'create'}>{busy === 'create' ? 'กำลังสร้างห้อง…' : '+ สร้างห้องใหม่'}</Button>
          </div>
          <Image src="/ui/teacher/room-dome.webp" alt="" width={500} height={300} />
        </section>
      )}

      <section className={styles.roomsSection} aria-labelledby="all-rooms-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.cardEyebrow}>ภาพรวมของคุณ</p>
            <h2 id="all-rooms-title">ห้องทั้งหมดของฉัน</h2>
          </div>
          <p>{rooms.length} ห้อง · {totalStudents} นักเรียน</p>
        </div>
        <div className={styles.roomGrid}>
          {rooms.map((room) => {
            const isSelected = room.id === selected?.id
            return (
              <article key={room.id} className={`${styles.roomCard} ${isSelected ? styles.roomCardSelected : ''}`}>
                <div className={styles.roomCardTop}>
                  <span className={styles.miniDoor}><ActionIcon name="door" /></span>
                  <span className={`${styles.statusBadge} ${styles[`status-${STATUS_TONE[room.status] ?? 'closed'}`]}`}><i aria-hidden /> {statusLabel(room.status)}</span>
                </div>
                <p className={styles.roomCardCode}>{room.roomCode}</p>
                <dl className={styles.roomCardFacts}>
                  <div><dt>นักเรียน</dt><dd>{room.studentCount} คน</dd></div>
                  <div><dt>สร้างเมื่อ</dt><dd>{dateText(room.createdAt)}</dd></div>
                </dl>
                <div className={styles.roomCardActions}>
                  {isSelected ? <span className={styles.selectedMark}><CheckIcon width={16} height={16} aria-hidden /> ห้องปัจจุบัน</span> : <Button size="sm" kind="primary" onClick={() => router.push(roomHref(room.id))}>เลือกห้องนี้</Button>}
                  <Button size="sm" kind="ghost" onClick={() => void toggleRoom(room)} disabled={busy !== null || room.status === 'closed'}>
                    {room.status === 'open' ? 'พักห้อง' : 'เปิดห้อง'}
                  </Button>
                  <Button size="sm" kind="danger" onClick={() => void deleteRoom(room)} disabled={busy !== null}>
                    {busy === `delete-${room.id}` ? 'กำลังลบ…' : 'ลบห้อง'}
                  </Button>
                </div>
              </article>
            )
          })}
          <button type="button" className={styles.createRoomCard} onClick={() => void createRoom} disabled={busy !== null}>
            <span className={styles.createRoomPlus}>+</span>
            <strong>{busy === 'create' ? 'กำลังสร้างห้อง…' : 'สร้างห้องใหม่'}</strong>
            <span>เปิดพื้นที่ใหม่สำหรับคาบถัดไป</span>
          </button>
        </div>
      </section>

      {notice ? <p role="status" className={styles.noticeSuccess}>{notice}</p> : null}
      {error ? <p role="alert" className={styles.noticeError}><AlertIcon width={20} height={20} aria-hidden /><span>{error}</span></p> : null}

      {selected && selectedJoinUrl ? (
        <div className={styles.printPoster} aria-hidden>
          <div className={styles.printPosterInner}>
            <p>เข้าห้องเรียนออนไลน์</p>
            <h1>{selected.roomCode}</h1>
            {selectedQr ? <div className={styles.printQr} dangerouslySetInnerHTML={{ __html: selectedQr }} /> : null}
            <strong>สแกน QR หรือเข้า</strong>
            <span>{selectedJoinUrl}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CloseIcon } from '@/components/ui'
import { ExitConfirmDialog } from '@/components/student-navigation'

type Notice = { kind: 'success' | 'error'; text: string } | null

export function StudentAccountPanel({
  initialNickname,
  roomCode,
}: {
  initialNickname: string
  /** รหัสห้องของนักเรียน — โชว์ในกล่องยืนยันออกจากระบบให้จดไว้ใช้กลับเข้ามา */
  roomCode?: string | null
}) {
  const [nickname, setNickname] = useState(initialNickname)
  const [newNickname, setNewNickname] = useState(initialNickname)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [busy, setBusy] = useState<'nickname' | 'pin' | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  async function update(body: Record<string, string>, kind: 'nickname' | 'pin') {
    setBusy(kind)
    setNotice(null)
    try {
      const response = await fetch('/api/profile/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await response.json().catch(() => null)) as { message?: string; nickname?: string } | null
      if (!response.ok) {
        setNotice({ kind: 'error', text: data?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ' })
        return
      }
      if (kind === 'nickname' && data?.nickname) {
        setNickname(data.nickname)
        setNewNickname(data.nickname)
      }
      if (kind === 'pin') {
        setCurrentPin('')
        setNewPin('')
      }
      setNotice({ kind: 'success', text: data?.message ?? 'บันทึกแล้ว' })
    } catch {
      setNotice({ kind: 'error', text: 'ต่อเน็ตไม่ได้ ลองใหม่อีกครั้งนะ' })
    } finally {
      setBusy(null)
    }
  }

  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  function openSheet() {
    setOpen(true)
    dialogRef.current?.showModal()
  }
  function closeSheet() {
    dialogRef.current?.close()
  }

  /*
   * ออกจากระบบ — ปิดแผ่นบัญชีก่อน แล้วค่อยเปิดกล่องยืนยัน
   * (แผ่นบัญชีเป็น <dialog> ชั้นบนสุดของเบราว์เซอร์ ถ้าไม่ปิดก่อน กล่องยืนยันจะถูกบังอยู่ข้างหลัง)
   * ออกสำเร็จหรือคุกกี้หมดอายุไปแล้ว (401) ก็พาไปหน้าเข้าห้องเหมือนกัน · ใช้ location.assign
   * เพื่อโหลดหน้าใหม่ทั้งหน้า ไม่ให้ cache ของ router ยังโชว์หน้าที่ล็อกอินอยู่
   */
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const stayLoggedIn = useCallback(() => {
    if (!loggingOut) setLogoutOpen(false)
  }, [loggingOut])
  /*
   * กล่องยืนยันต้องขึ้น top layer ผ่าน <dialog>.showModal() เหมือนแผ่นบัญชี
   * เพราะปุ่มบัญชีอยู่ในแถบบนที่มี z-index ของตัวเอง — ถ้าวางเป็น div fixed ธรรมดา
   * เมนูล่างกับปุ่มโดมลอยจะทับฉากหลังมืดแล้วยังกดได้
   */
  const logoutDialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = logoutDialogRef.current
    if (!el) return
    if (logoutOpen && !el.open) el.showModal()
    if (!logoutOpen && el.open) el.close()
  }, [logoutOpen])
  function askLogout() {
    closeSheet()
    setLogoutError(null)
    setLogoutOpen(true)
  }
  async function logout() {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      const response = await fetch('/api/student/logout', { method: 'POST' })
      if (!response.ok && response.status !== 401) throw new Error(String(response.status))
      window.location.assign('/join')
    } catch {
      setLoggingOut(false)
      setLogoutError('ออกจากระบบไม่สำเร็จ เช็กเน็ตแล้วกดอีกครั้งนะ')
    }
  }

  /*
   * ปุ่มวงกลมเล็กมุมขวาบน (อยู่แถวเดียวกับป้าย "ขั้น X จาก 5")
   * เดิมเป็นการ์ดเต็มความกว้าง "บัญชีของฉัน · ชื่อ" กินที่จอโดยไม่จำเป็น
   * กดแล้วเปิดแผ่นตั้งค่าบัญชีชุดเดิม (เปลี่ยนชื่อเล่น / PIN)
   * ใช้ <dialog>.showModal() — ขึ้นชั้นบนสุดของเบราว์เซอร์ ไม่โดนกล่องแม่ที่ overflow/transform ตัด
   * และ Esc ปิดได้เอง
   */
  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`บัญชีของฉัน · ${nickname}`}
        className="account-icon-btn grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-[#6b2d12] bg-[#fff1d6] shadow-[0_3px_0_#6b2d12] transition-transform active:translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D ไฟล์สถิต */}
        <img src="/icons/3d/bust-in-silhouette.webp" alt="" className="size-7" draggable={false} />
      </button>
          <dialog
            ref={dialogRef}
            aria-labelledby="student-account-title"
            onClose={() => setOpen(false)}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeSheet()
            }}
            className="m-auto max-h-[88dvh] w-[calc(100%-1.5rem)] max-w-[26rem] overflow-y-auto rounded-3xl border-[3px] border-[#6b2d12] bg-[#fff1d6] p-0 shadow-[0_6px_0_#4a1f0a] backdrop:bg-[rgb(40_20_8/.5)]"
          >
            <div className="flex items-center gap-2 border-b-2 border-[rgb(107_45_18/.2)] px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D ไฟล์สถิต */}
              <img src="/icons/3d/bust-in-silhouette.webp" alt="" className="size-8" draggable={false} />
              <h2 id="student-account-title" className="min-w-0 flex-1 truncate text-body font-extrabold text-ink">
                บัญชีของฉัน · {nickname}
              </h2>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="ปิดหน้าบัญชี"
                className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-[#6b2d12] bg-[#fff8e7] text-[#5a2812]"
              >
                <CloseIcon width={20} height={20} />
              </button>
            </div>
      <div className="px-4 pb-4 pt-3">
        <p className="text-note text-ink-muted">เปลี่ยนชื่อเล่นหรือ PIN ได้เอง ข้อมูลความคืบหน้ายังอยู่ครบ</p>

        <form
          className="mt-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200 ring-inset"
          onSubmit={(event) => {
            event.preventDefault()
            void update({ nickname: newNickname }, 'nickname')
          }}
        >
          <label htmlFor="student-account-nickname" className="text-label font-bold text-ink">ชื่อเล่นใหม่</label>
          <input
            id="student-account-nickname"
            value={newNickname}
            onChange={(event) => setNewNickname(event.target.value)}
            maxLength={40}
            required
            className="mt-1 min-h-11 w-full rounded-xl bg-surface-raised px-3 text-label text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-2 text-note font-semibold text-brand-700">ใช้ชื่อใหม่นี้ตอนเข้าห้องครั้งถัดไป</p>
          <button
            type="submit"
            disabled={busy !== null || newNickname.trim() === nickname}
            className="btn-base mt-3 w-full rounded-xl bg-brand-600 text-label font-bold text-ink-onbrand hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === 'nickname' ? 'กำลังบันทึก…' : 'บันทึกชื่อเล่น'}
          </button>
        </form>

        <form
          className="mt-3 rounded-xl bg-surface-sunken p-3 ring-1 ring-line ring-inset"
          onSubmit={(event) => {
            event.preventDefault()
            void update({ currentPin, newPin }, 'pin')
          }}
        >
          <h3 className="text-label font-bold text-ink">เปลี่ยน PIN</h3>
          <label htmlFor="student-account-current-pin" className="mt-2 block text-note font-semibold text-ink-muted">PIN ปัจจุบัน</label>
          <input
            id="student-account-current-pin"
            value={currentPin}
            onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            required
            className="mt-1 min-h-11 w-full rounded-xl bg-surface-raised px-3 text-label tracking-[0.25em] text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-500"
          />
          <label htmlFor="student-account-new-pin" className="mt-2 block text-note font-semibold text-ink-muted">PIN ใหม่ 4 หลัก</label>
          <input
            id="student-account-new-pin"
            value={newPin}
            onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            required
            className="mt-1 min-h-11 w-full rounded-xl bg-surface-raised px-3 text-label tracking-[0.25em] text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={busy !== null || currentPin.length !== 4 || newPin.length !== 4}
            className="btn-base mt-3 w-full rounded-xl bg-quest-600 text-label font-bold text-ink-onbrand hover:bg-quest-700 disabled:opacity-50"
          >
            {busy === 'pin' ? 'กำลังบันทึก…' : 'บันทึก PIN ใหม่'}
          </button>
        </form>

        {notice ? (
          <p role="status" className={`mt-3 rounded-xl p-3 text-label font-semibold ${notice.kind === 'success' ? 'bg-quest-100 text-quest-700' : 'bg-spark-100 text-spark-700'}`}>
            {notice.text}
          </p>
        ) : null}

        {/* ปุ่มรอง: ขอบไม้ พื้นครีม ไม่แย่งสายตาจากปุ่มบันทึกสองปุ่มด้านบน */}
        <button
          type="button"
          onClick={askLogout}
          className="btn-base mt-4 w-full cursor-pointer rounded-xl border-2 border-[#6b2d12] bg-[#fffaf0] text-label font-bold text-[#6b2d12] shadow-[0_3px_0_#6b2d12] active:translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          ออกจากระบบ
        </button>
      </div>
          </dialog>
      <dialog
        ref={logoutDialogRef}
        aria-label="ยืนยันออกจากระบบ"
        onCancel={(event) => {
          event.preventDefault()
          stayLoggedIn()
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
      >
      <ExitConfirmDialog
              open={logoutOpen}
              onStay={stayLoggedIn}
              onExit={() => void logout()}
              busy={loggingOut}
              kicker="บัญชีของฉัน"
              title="ออกจากระบบไหม?"
              imageAlt="โดมยกมือโบกถามก่อนออกจากระบบ"
              stayLabel="ยกเลิก"
              exitLabel={loggingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
              description={
                <>
                  <p>กลับมาเล่นต่อได้ด้วยรหัสห้อง ชื่อเล่น และ PIN เดิม</p>
                  <p className="font-bold">
                    รหัสห้อง <span className="tracking-[0.15em]">{roomCode ?? '—'}</span> · ชื่อเล่น {nickname}
                  </p>
                  {logoutError ? (
                    <p role="alert" className="font-bold text-spark-700">{logoutError}</p>
                  ) : null}
                </>
              }
      />
      </dialog>
    </>
  )
}

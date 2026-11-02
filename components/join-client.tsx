'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CheckIcon,
  DomeSays,
  GameButton,
  PinInput,
  TextField,
  Toast,
  ToastViewport,
} from '@/components/ui'
import { AppFooter, AppShell } from '@/components/app-shell'
import './join.css'

/**
 * หน้าเข้าห้องเรียนของนักเรียน
 *
 * ⚠️ ไม่มีการตัดสินอะไรที่นี่ ทุกอย่างส่งไป POST /api/join หรือ /api/join/resume
 *    เซิร์ฟเวอร์เป็นคนออกคุกกี้ dbq_student ให้ ห้ามสร้างตัวตนเองในเบราว์เซอร์
 * โหมด 'join' = เข้าครั้งแรก (ตั้ง PIN เอง) · โหมด 'resume' = เคยเข้าแล้วย้ายเครื่อง (ใช้ PIN เดิม)
 */
type Mode = 'join' | 'resume'

const PIN_LENGTH = 4
const ROOM_CODE_LENGTH = 6

/** ผูกปุ่มส่งที่อยู่ในแถบท้าย เข้ากับฟอร์มที่อยู่ในส่วนเลื่อนได้ */
const FORM_ID = 'join-form'

export function JoinClient({ initialRoomCode }: { initialRoomCode: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('join')
  const [roomCode, setRoomCode] = useState(initialRoomCode)
  const [nickname, setNickname] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renamedTo, setRenamedTo] = useState<string | null>(null)

  const cleanCode = roomCode.trim().toUpperCase()
  const cleanNickname = nickname.trim()
  const pinOk = /^\d{4}$/.test(pin)
  const codeOk = cleanCode.length === ROOM_CODE_LENGTH
  const nameOk = cleanNickname.length > 0
  const ready = codeOk && nameOk && pinOk

  async function submit() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    setRenamedTo(null)
    try {
      const res = await fetch(mode === 'join' ? '/api/join' : '/api/join/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomCode: cleanCode, nickname: cleanNickname, pin }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; nickname?: string; renamed?: boolean; error?: string; message?: string }
        | null

      if (!res.ok) {
        // ข้อความบอกสาเหตุให้ชัด นักเรียนจะได้รู้ว่าต้องแก้อะไร
        const fallbackMessage =
          res.status === 429
            ? 'ลองเข้าห้องถี่เกินไป รอสักครู่แล้วลองใหม่'
            : res.status === 404
              ? 'ไม่พบห้องนี้ ตรวจรหัสห้อง 6 ตัวอีกครั้ง หรือครูอาจปิดห้องไปแล้ว'
              : res.status === 401
                ? 'ชื่อเล่นหรือรหัส 4 หลักไม่ถูกต้อง'
                : 'เข้าห้องไม่สำเร็จ ลองใหม่อีกครั้ง'
        setError(data?.message ?? fallbackMessage)
        return
      }

      if (mode === 'join' && data?.renamed && data.nickname) {
        // ชื่อซ้ำกับเพื่อน ระบบเติมเลขให้ — ต้องบอกนักเรียนว่าตอนนี้ชื่ออะไร
        setRenamedTo(data.nickname)
        setBusy(false)
        return
      }

      // เข้าห้องครั้งแรก = ดูวิธีใช้ก่อน (S-02) · กลับมาทำต่อ = ไปหน้าหลักเลย ไม่ต้องดูซ้ำ
      router.push(mode === 'join' ? '/intro' : '/home')
      router.refresh()
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  if (renamedTo) {
    return (
      <AppShell
        mainClassName="flex flex-col"
        footer={
          <AppFooter>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leadingIcon={<CheckIcon width={22} height={22} />}
              onClick={() => {
                router.push('/intro')
                router.refresh()
              }}
            >
              เข้าเล่นเลย
            </Button>
          </AppFooter>
        }
      >
        <div className="flex min-h-full flex-col justify-center gap-6 px-4 py-8">
          <DomeSays mood="cheer" speakerName="โดม" avatarSize={96} className="[&_.text-note]:text-[0.875rem]">
          มีเพื่อนใช้ชื่อนี้ไปแล้วครับ ผมเลยเติมเลขท้ายให้ ชื่อของคุณในห้องนี้คือ{' '}
          <strong className="font-extrabold text-brand-700">{renamedTo}</strong> จำชื่อนี้ไว้นะครับ
          ถ้าต้องย้ายเครื่องต้องใช้ชื่อนี้กับรหัส 4 หลักเดิม
          </DomeSays>

          <Card tone="brand" padding="sm">
            <p className="text-label font-semibold text-ink-muted">ชื่อของคุณในห้องนี้</p>
            <p className="mt-1 text-title font-extrabold text-balance text-brand-700">
              {renamedTo}
            </p>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      className="media-shell student-display"
      footer={
        <AppFooter className="flex flex-col gap-2">
          {/* ปุ่มหลักอยู่นอก <form> แต่ยังเป็นปุ่ม submit ของฟอร์มนั้นผ่าน attribute form=
              ทำแบบนี้ปุ่มจึงอยู่ในแถบท้ายที่ไม่เลื่อน นักเรียนเห็นตลอดโดยไม่ต้องไถหา */}
          <GameButton
            type="submit"
            form={FORM_ID}
            className="w-full min-h-16"
            disabled={!ready}
            aria-busy={busy || undefined}
          >
            {busy ? 'กำลังเข้าห้องเรียน…' : mode === 'join' ? 'เข้าห้องเรียน' : 'เข้าห้องเดิม'}
          </GameButton>

        </AppFooter>
      }
    >
      {error ? (
        <ToastViewport>
          <Toast tone="error" message={error} duration={null} onDismiss={() => setError(null)} />
        </ToastViewport>
      ) : null}

      <div className="media-join-main relative min-h-full px-3 pt-12 pb-4">
      <Link
        href="/"
        className="absolute left-3 top-2 z-10 inline-flex min-h-11 items-center gap-1 rounded-full bg-[#fff1d6] px-3 text-label font-bold text-[#6b2d12] shadow-[0_3px_0_#6b2d12] focus-ring"
      >
        <span aria-hidden="true">←</span> หน้าแรก
      </Link>

      <div className="jn-tabs" role="tablist" aria-label="วิธีเข้าห้อง">
        {(
          [
            ['join', 'ยังไม่เคยเข้า', 'เข้าครั้งแรก', '/icons/3d/glowing-star.webp'],
            ['resume', 'เคยเข้าแล้ว', 'ย้ายเครื่อง', '/icons/3d/counterclockwise-arrows-button.webp'],
          ] as const
        ).map(([m, small, label, icon]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className="jn-tab focus-ring"
            onClick={() => {
              setMode(m)
              setError(null)
            }}
          >
            <img src={icon} alt="" />
            <span className="jn-tab-text">
              <small>{small}</small>
              {label}
            </span>
          </button>
        ))}
      </div>
      <p className="jn-sub">
        {mode === 'join' ? 'ครั้งแรกในห้องนี้ ตั้ง PIN เอง' : 'เคยเข้าแล้ว ใช้ชื่อเล่นกับ PIN เดิม'}
      </p>

      <section className="join-frame-stage" aria-label="แบบฟอร์มเข้าห้องเรียน">
        <img src="/ui/join/official-frame.webp" alt="กรอบไม้ประดับตัวละครสำหรับแบบฟอร์มเข้าห้องเรียน" aria-hidden="true" className="join-frame-art" />
        <div className="join-title-plaque">
          <h1 id="join-form-title" className="text-title font-extrabold text-balance">
            {mode === 'join' ? 'เข้าห้องเรียน' : 'ย้ายเครื่อง เข้าห้องเดิม'}
          </h1>
        </div>
        <div className="join-frame-panel">

      <form
        id={FORM_ID}
        aria-labelledby="join-form-title"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="mt-3 flex flex-col gap-3"
      >
        <TextField
          label={`รหัสห้อง ${ROOM_CODE_LENGTH} ตัว`}
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={ROOM_CODE_LENGTH}
          placeholder="QUEST9"
          center
          valid={codeOk}
          inputClassName="text-title font-extrabold tracking-[0.3em] uppercase"
        />

        <TextField
          label="ชื่อเล่น"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          type="text"
          maxLength={40}
          autoComplete="off"
          placeholder="ชื่อที่เพื่อนเรียก"
          valid={nameOk}
        />

        <PinInput
          value={pin}
          onChange={setPin}
          length={PIN_LENGTH}
          label={mode === 'join' ? 'ตั้งรหัส 4 หลักของตัวเอง' : 'รหัส 4 หลักเดิม'}
          disabled={busy}
        />

        <p className="jn-hint">
          <img src={mode === 'join' ? '/icons/3d/light-bulb.webp' : '/icons/3d/locked.webp'} alt="" />
          {mode === 'join'
            ? 'จำชื่อเล่นกับ PIN ไว้ ใช้ตอนย้ายเครื่อง'
            : 'สะกดชื่อเล่นให้เหมือนตอนเข้าครั้งแรก'}
        </p>
      </form>

        </div>
      </section>
      </div>
    </AppShell>
  )
}

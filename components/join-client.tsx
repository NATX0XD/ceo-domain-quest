'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CheckIcon,
  DomeSays,
  PinInput,
  TextField,
  Toast,
  ToastViewport,
} from '@/components/ui'
import { AppFooter, AppShell } from '@/components/app-shell'

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

  // จำนวนช่องที่กรอกครบแล้ว — ใช้บอกนักเรียนว่าเหลืออีกกี่ช่อง แทนคำว่า "กรอกให้ครบ" ลอย ๆ
  const filled = [codeOk, nameOk, pinOk].filter(Boolean).length

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
      footer={
        <AppFooter className="flex flex-col gap-2">
          {/* ปุ่มหลักอยู่นอก <form> แต่ยังเป็นปุ่ม submit ของฟอร์มนั้นผ่าน attribute form=
              ทำแบบนี้ปุ่มจึงอยู่ในแถบท้ายที่ไม่เลื่อน นักเรียนเห็นตลอดโดยไม่ต้องไถหา */}
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!ready}
            loading={busy}
            loadingLabel="กำลังเข้าห้องเรียน"
          >
            {ready
              ? mode === 'join'
                ? 'เข้าห้องเรียน'
                : 'เข้าห้องเดิม'
              : `ยังเหลืออีก ${3 - filled} ช่อง`}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setMode(mode === 'join' ? 'resume' : 'join')
              setError(null)
            }}
          >
            {mode === 'join' ? 'เคยเข้าแล้ว ย้ายเครื่อง' : 'ยังไม่เคยเข้า ขอเข้าครั้งแรก'}
          </Button>
        </AppFooter>
      }
    >
      {error ? (
        <ToastViewport>
          <Toast tone="error" message={error} duration={null} onDismiss={() => setError(null)} />
        </ToastViewport>
      ) : null}

      <div className="px-4 pt-3 pb-2">
      <DomeSays mood="greet" speakerName="โดม" avatarSize={56} className="mb-3 [&_.text-note]:text-[0.875rem]">
        {mode === 'join'
          ? 'สวัสดีครับ ใส่รหัสห้องที่ครูฉายบนจอ แล้วตั้งชื่อเล่นกับรหัส 4 หลักของตัวเองได้เลย'
          : 'เคยเข้ามาแล้วใช่ไหมครับ ใส่รหัสห้อง ชื่อเล่นเดิม และรหัส 4 หลักที่เคยตั้งไว้'}
      </DomeSays>

      <h1 className="text-title font-extrabold text-balance text-ink">
        {mode === 'join' ? 'เข้าห้องเรียน' : 'ย้ายเครื่อง เข้าห้องเดิม'}
      </h1>

      <form
        id={FORM_ID}
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
          hint="ตัวอักษรกับตัวเลขรวมกัน 6 ตัว ครูฉายไว้บนจอหน้าห้อง"
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
          hint={
            mode === 'join'
              ? 'ต้องไม่ซ้ำกับเพื่อนในห้อง ถ้าซ้ำระบบจะบอกให้เปลี่ยน'
              : 'ต้องเป็นชื่อเดิมที่เคยใช้ในห้องนี้'
          }
        />

        <PinInput
          value={pin}
          onChange={setPin}
          length={PIN_LENGTH}
          label={mode === 'join' ? 'ตั้งรหัส 4 หลักของตัวเอง' : 'รหัส 4 หลักเดิม'}
          hint={
            pin.length === 0
              ? 'ใช้ตอนย้ายเครื่องหรือเข้าใหม่ จำให้ได้นะ'
              : pinOk
                ? 'ครบ 4 หลักแล้ว'
                : `ใส่อีก ${PIN_LENGTH - pin.length} หลัก`
          }
          disabled={busy}
        />
      </form>

      <Link
        href="/"
        className="mx-auto mt-6 block w-fit min-h-11 rounded-md px-3 py-2 text-label font-bold text-brand-700 underline focus-ring"
      >
        กลับหน้าแรก
      </Link>
      </div>
    </AppShell>
  )
}

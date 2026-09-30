'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, TextField } from '@/components/ui'

/**
 * S-32 เป้าหมายครั้งหน้า — เลือกจากรายการ หรือพิมพ์เป้าของตัวเอง
 *
 * ⚠️ ตัวเลือกทั้งหมดมาจากไฟล์เนื้อหาผ่าน API หน้าจอไม่ได้เขียนตัวเลือกเอง
 * ⚠️ เป้าที่พิมพ์เองผ่านด่านกรองคำที่เซิร์ฟเวอร์ ไม่ผ่านจะได้ข้อความเดิมคืนมาพร้อมคำแนะนำ
 *    **ห้ามกลืนข้อความที่ผู้เรียนพิมพ์** ต้องคงไว้ในช่องให้เขาแก้เอง
 * ⚠️ เป้านี้ไม่มีผลต่อดาวของคาบนี้ เปลี่ยนใจแก้ได้ตลอด
 */

interface Option {
  id: string
  text: string
  allowFreeText: boolean
}

interface Current {
  goalId: string
  text: string
  isOwnText: boolean
  savedAt: string
  changeCount: number
}

interface View {
  prompt: string
  options: Option[]
  ownTextMaxLength: number
  current: Current | null
  summary: string
}

export interface NextGoalPanelProps {
  className?: string
}

export function NextGoalPanel({ className }: NextGoalPanelProps) {
  const [view, setView] = useState<View | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [ownText, setOwnText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/self-assess/next-goal')
      if (!res.ok) return
      const data = (await res.json()) as View
      setView(data)
      setPicked(data.current?.goalId ?? null)
      if (data.current?.isOwnText) setOwnText(data.current.text)
    } catch {
      // เน็ตสะดุด กดใหม่ได้เสมอ ไม่ต้องขึ้น error ให้ผู้เรียนตกใจ
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!view) return null

  const chosen = view.options.find((o) => o.id === picked) ?? null
  const needsOwnText = chosen?.allowFreeText === true
  const canSave = chosen !== null && (!needsOwnText || ownText.trim().length > 0)

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/self-assess/next-goal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goalId: picked, ownText }),
      })
      const data = (await res.json().catch(() => null)) as
        | { message?: string; current?: Current; original?: string }
        | null
      // ไม่ผ่านด่านกรองคำ = คืนข้อความเดิมเข้าไปในช่องเหมือนเดิม ให้ผู้เรียนแก้เอง
      if (typeof data?.original === 'string') setOwnText(data.original)
      if (res.ok && data?.current) {
        setView({ ...view!, current: data.current })
      }
      setMessage(data?.message ?? null)
    } catch {
      setMessage('ยังบันทึกไม่สำเร็จ ลองกดอีกครั้งนะ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card tone="brand" padding="md" className={className}>
      <h3 className="font-semibold">เป้าหมายของคาบหน้า</h3>
      <p className="mt-1 text-sm opacity-80">{view.prompt}</p>

      <div className="mt-3 flex flex-col gap-2">
        {view.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface-sunken p-3 text-sm"
          >
            <input
              type="radio"
              name="next-goal"
              value={option.id}
              checked={picked === option.id}
              onChange={() => setPicked(option.id)}
              className="mt-1"
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>

      {needsOwnText && (
        <div className="mt-3">
          <TextField
            label="เป้าของฉันเอง"
            value={ownText}
            maxLength={view.ownTextMaxLength}
            onChange={(event) => setOwnText(event.target.value)}
            placeholder="อยากทำอะไรให้ได้ในคาบหน้า"
          />
        </div>
      )}

      <Button variant="success" fullWidth className="mt-3" disabled={busy || !canSave} onClick={() => void save()}>
        {view.current ? 'แก้เป้าคาบหน้า' : 'บันทึกเป้าคาบหน้า'}
      </Button>

      {message && <p className="mt-2 text-sm opacity-80">{message}</p>}

      {view.current && !message && (
        <p className="mt-2 text-sm opacity-70">ตอนนี้ตั้งไว้ว่า: {view.current.text}</p>
      )}
    </Card>
  )
}

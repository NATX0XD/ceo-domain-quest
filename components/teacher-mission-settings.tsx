'use client'

import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Tabs, Toggle, missionColor } from '@/app/teacher/_ux/ui'

type MissionId = 'm1' | 'm2' | 'm3' | 'm4' | 'ceo'
type Bag = Record<string, unknown>
type Snapshot = Record<MissionId, { label: string; help: string; defaults: Bag; settings: Bag }>

const IDS: MissionId[] = ['m1', 'm2', 'm3', 'm4', 'ceo']
const FIELDS: Record<MissionId, Array<{ key: string; label: string; help: string; min?: number; max?: number; suffix?: string }>> = {
  m1: [
    { key: 'passScore', label: 'คะแนนผ่าน', help: 'คะแนนเต็ม 100 ที่ต้องได้', min: 50, max: 100, suffix: 'คะแนน' },
    { key: 'modesEnabled.watch', label: 'โหมดดูคลิป', help: 'ให้เลือกเรียนด้วยการดูคลิป' },
    { key: 'modesEnabled.read', label: 'โหมดอ่าน', help: 'ให้เลือกเรียนด้วยการอ่านการ์ด' },
    { key: 'modesEnabled.do', label: 'โหมดลงมือทำ', help: 'ให้เลือกเรียนด้วยการตอบคำถาม' },
    { key: 'aiFeedback', label: 'คำแนะนำจากโดม', help: 'เปิด feedback หลังส่งคำตอบ' },
  ],
  m2: [
    { key: 'textAttempts', label: 'จำนวนครั้งฝึกเขียน', help: 'จำนวนครั้งสูงสุดก่อนขยับต่อ', min: 1, max: 6, suffix: 'ครั้ง' },
    { key: 'exitQuestions', label: 'คำถามเช็กความเข้าใจ', help: 'ไม่เกินจำนวนข้อที่มีในเนื้อหา', min: 1, max: 3, suffix: 'ข้อ' },
    { key: 'passScore', label: 'คะแนนผ่าน', help: 'คะแนนเต็ม 100 ที่ต้องได้', min: 50, max: 100, suffix: 'คะแนน' },
    { key: 'simStages', label: 'ด่านจำลอง', help: 'จำนวนช่วงของสถานการณ์จำลอง', min: 1, max: 4, suffix: 'ด่าน' },
    { key: 'aiFeedback', label: 'คำแนะนำจากโดม', help: 'เปิด feedback หลังส่งคำตอบ' },
  ],
  m3: [
    { key: 'practiceEnabled', label: 'เปิดช่วงฝึกซ้อม', help: 'ให้ลองระบบก่อนเริ่มรอบจริง' },
    { key: 'realCustomers', label: 'จำนวนลูกค้ารอบจริง', help: 'จำนวนลูกค้าที่ต้องดูแลในรอบจริง', min: 1, max: 6, suffix: 'คน' },
    { key: 'customerSeconds', label: 'เวลาต่อลูกค้า', help: 'เวลาที่มีให้ดูแลลูกค้าแต่ละคน', min: 60, max: 600, suffix: 'วินาที' },
    { key: 'extendSeconds', label: 'เวลาเพิ่ม', help: 'เวลาที่เติมได้เมื่อจำเป็น', min: 0, max: 180, suffix: 'วินาที' },
    { key: 'handbookSeconds', label: 'เวลาอ่านคู่มือ', help: 'เวลาสำหรับอ่านคู่มือก่อนเริ่ม', min: 5, max: 120, suffix: 'วินาที' },
    { key: 'customerQuestions', label: 'คำถามต่อลูกค้า', help: 'จำนวนคำถามที่ใช้ประเมินลูกค้า', min: 0, max: 6, suffix: 'ข้อ' },
    { key: 'domeQuota', label: 'โควตาคำแนะนำโดม', help: 'เว้นว่าง = ไม่จำกัด', min: 0, max: 20, suffix: 'ครั้ง' },
    { key: 'hints', label: 'จำนวนคำใบ้', help: 'จำนวนคำใบ้ที่ผู้เรียนขอได้', min: 0, max: 5, suffix: 'ใบ' },
    { key: 'tagPass', label: 'เกณฑ์ผ่านการจัดหมวด', help: 'คะแนนเต็ม 100', min: 50, max: 100, suffix: 'คะแนน' },
    { key: 'stampPass', label: 'เกณฑ์ผ่านการประทับตรา', help: 'คะแนนเต็ม 100', min: 50, max: 100, suffix: 'คะแนน' },
  ],
  m4: [
    { key: 'timerSeconds', label: 'เวลารวม', help: 'เวลาสำหรับด่านค้นหาชื่อ', min: 120, max: 900, suffix: 'วินาที' },
    { key: 'startCoins', label: 'เหรียญเริ่มต้น', help: 'งบเริ่มต้นของผู้เรียน', min: 1000, max: 20000, suffix: 'เหรียญ' },
    { key: 'explainPass', label: 'เกณฑ์อธิบายเหตุผล', help: 'จำนวนเหตุผลที่ต้องอธิบายถูก', min: 5, max: 10, suffix: 'ข้อ' },
    { key: 'eventsPass', label: 'เหตุการณ์ที่ต้องผ่าน', help: 'จำนวนเหตุการณ์สำคัญ', min: 2, max: 4, suffix: 'เหตุการณ์' },
    { key: 'tutorialEnabled', label: 'เปิดบทสอนก่อนเล่น', help: 'แสดงคำแนะนำการเล่นครั้งแรก' },
  ],
  ceo: [
    { key: 'aiGrading', label: 'ให้โดมช่วยตรวจเบื้องต้น', help: 'ใช้ AI เสนอคะแนนก่อนครูยืนยัน' },
    { key: 'revisions', label: 'จำนวนรอบแก้ไข', help: 'จำนวนครั้งที่ผู้เรียนแก้งานได้', min: 0, max: 5, suffix: 'รอบ' },
    { key: 'submitModes.write', label: 'ส่งแบบเขียน', help: 'ให้พิมพ์คำตอบในระบบ' },
    { key: 'submitModes.voice', label: 'ส่งแบบเสียง', help: 'ให้แนบเสียงนำเสนอ' },
    { key: 'submitModes.design', label: 'ส่งแบบออกแบบ', help: 'ให้ส่งผลงานออกแบบ' },
  ],
}

function getValue(settings: Bag, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => (current && typeof current === 'object' ? (current as Bag)[part] : undefined), settings)
}

function setValue(settings: Bag, key: string, value: unknown): Bag {
  const parts = key.split('.')
  const next: Bag = structuredClone(settings)
  let cursor = next
  for (const part of parts.slice(0, -1)) {
    cursor[part] = { ...(cursor[part] as Bag) }
    cursor = cursor[part] as Bag
  }
  cursor[parts.at(-1)!] = value
  return next
}

export function TeacherMissionSettings({ classroomId, initial }: { classroomId: string | null; initial: Snapshot | null }) {
  const [active, setActive] = useState<MissionId>('m1')
  const [values, setValues] = useState<Snapshot | null>(initial)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const current = values?.[active]
  const fields = useMemo(() => FIELDS[active], [active])

  function update(key: string, value: unknown) {
    if (!values) return
    setValues({ ...values, [active]: { ...values[active], settings: setValue(values[active].settings, key, value) } })
    setNotice(null)
  }

  async function save() {
    if (!classroomId || !current) return
    setSaving(true)
    setNotice(null)
    try {
      const res = await fetch(`/api/teacher/mission-settings?classroomId=${classroomId}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId: active, settings: current.settings }),
      })
      const body = await res.json().catch(() => null) as { message?: string; setting?: { settings?: Bag } } | null
      if (!res.ok) throw new Error(body?.message ?? 'บันทึกไม่สำเร็จ')
      if (body?.setting?.settings) setValues({ ...values, [active]: { ...current, settings: body.setting.settings } })
      setNotice('บันทึกค่าด่านแล้ว')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  function reset() {
    if (!values) return
    setValues({ ...values, [active]: { ...values[active], settings: structuredClone(values[active].defaults) } })
    setNotice('คืนค่าเริ่มต้นแล้ว กดบันทึกเพื่อใช้ค่านี้')
  }

  if (!classroomId || !values || !current) {
    return (
      <Card>
        <EmptyState title="ยังไม่ได้เลือกห้องเรียน" body="เลือกห้องเรียนก่อนจึงจะตั้งค่าด่านได้" />
      </Card>
    )
  }

  const activeNo = IDS.indexOf(active) + 1
  const bad = Boolean(notice && notice.includes('ไม่สำเร็จ'))

  return (
    <section className="grid gap-4" aria-label="ตั้งค่าด่าน">
      <Tabs
        label="เลือกด่าน"
        value={active}
        onChange={(id) => { setActive(id); setNotice(null) }}
        options={IDS.map((id, index) => ({
          value: id,
          label: (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: missionColor(index + 1) }} />
              ด่าน {index < 4 ? index + 1 : 'CEO'}
            </span>
          ),
        }))}
      />
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-[3px]" style={{ background: missionColor(activeNo) }} />
            {current.label}
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={reset}>คืนค่าเริ่มต้น</Button>
            <Button size="sm" kind="primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึกด่านนี้'}
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-[14px] text-[var(--c-ink-3)]">{current.help} ค่าเริ่มต้นถูกเลือกให้เหมาะกับเนื้อหาปัจจุบัน</p>
        <div className="divide-y divide-[var(--c-line)]">
          {fields.map((field) => {
            const value = getValue(current.settings, field.key)
            const isToggle = field.min === undefined
            if (isToggle) {
              return (
                <div key={field.key} className="py-3 first:pt-0 last:pb-0">
                  <Toggle label={field.label} description={field.help} checked={value === true} onChange={(v) => update(field.key, v)} />
                </div>
              )
            }
            return (
              <div key={field.key} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-[var(--c-ink)]">{field.label}</p>
                  <p className="text-[14px] text-[var(--c-ink-3)]">{field.help}</p>
                </div>
                <span className="inline-flex items-center gap-2">
                  <Button size="sm" aria-label={`ลด ${field.label}`} onClick={() => update(field.key, Math.max(field.min!, Number(value ?? field.min) - 1))}>−</Button>
                  <input
                    aria-label={field.label}
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={value === null ? '' : Number(value)}
                    onChange={(event) => update(field.key, event.target.value === '' ? null : Number(event.target.value))}
                    className="h-9 w-20 rounded-lg border border-[var(--c-line-strong)] bg-white px-2 text-center text-[15px] tabular-nums outline-none focus:border-[var(--c-brand)] focus:ring-2 focus:ring-[var(--c-brand-ring)]"
                  />
                  <Button size="sm" aria-label={`เพิ่ม ${field.label}`} onClick={() => update(field.key, Math.min(field.max!, Number(value ?? field.min) + 1))}>+</Button>
                  {field.suffix ? <span className="w-14 text-[14px] text-[var(--c-ink-3)]">{field.suffix}</span> : null}
                </span>
              </div>
            )
          })}
        </div>
        {notice ? (
          <p
            role="status"
            className="mt-4 rounded-lg px-3 py-2 text-[14px] font-medium"
            style={{ background: bad ? 'var(--s-danger-soft)' : 'var(--s-success-soft)', color: bad ? 'var(--s-danger-ink)' : 'var(--s-success-ink)' }}
          >
            {notice}
          </p>
        ) : null}
      </Card>
    </section>
  )
}

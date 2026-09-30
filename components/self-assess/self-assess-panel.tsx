'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card } from '@/components/ui'

/**
 * S-26 + S-33 วงจรประเมินตนเอง 3 แหล่ง — ให้คะแนนตัวเองรายด้าน แล้วดูตารางเทียบ
 *
 * ทำสองอย่างในตัวเดียว เพราะเป็นเรื่องเดียวกันคนละจังหวะ
 * 1. **ก่อนครูยืนยัน** — ให้คะแนนตัวเองตามคำบรรยายระดับจริงในรูบริก แก้กี่รอบก็ได้
 * 2. **หลังครูยืนยัน** — ตารางเทียบ ฉันให้ตัวเอง / ระบบเสนอ / ครูยืนยัน พร้อมข้อความจากครู
 *
 * ⚠️ **ข้อความทุกบรรทัดมาจากเซิร์ฟเวอร์** (core/self-assess.ts ซึ่งมีเทสต์คุมว่าไม่มีคำตัดสิน)
 *    หน้าจอห้ามแต่งประโยคเปรียบเทียบเอง เช่น "ให้ตัวเองสูงไป" ห้ามมีเด็ดขาด
 * ⚠️ คะแนนที่ให้ตัวเองไม่มีผลต่อดาว ไม่เอาไปรวมกับคะแนนครู
 */

interface Level {
  score: number
  label: string
  descriptor: string
}

interface Dimension {
  id: string
  name: string
  shortName: string
  question: string
  levels: Level[]
}

interface Form {
  id: string
  prompt: string
  helper: string
  min: number
  max: number
  dimensions: Dimension[]
}

interface Row {
  dimensionId: string
  name: string
  shortName: string
  self: number | null
  selfLabel: string
  system: number | null
  systemLabel: string
  teacher: number | null
  teacherLabel: string
  gap: number | null
  verdict: 'same' | 'self-higher' | 'self-lower' | 'not-comparable'
  note: string
}

interface Table {
  status: 'no-self' | 'waiting-teacher' | 'ready'
  rows: Row[]
  teacherNote: string | null
  headline: string
  summary: string
  talkingPoints: string[]
  sameCount: number
  comparableCount: number
}

interface View {
  submissionId: string | null
  form: Form
  self: { scores: Record<string, number> | null; savedAt: string | null }
  table: Table
}

export interface SelfAssessPanelProps {
  className?: string
}

export function SelfAssessPanel({ className }: SelfAssessPanelProps) {
  const [view, setView] = useState<View | null>(null)
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/self-assess')
      if (!res.ok) return
      const data = (await res.json()) as View
      setView(data)
      setDraft(data.self.scores ?? {})
    } catch {
      // เน็ตสะดุด ไม่ต้องขึ้น error ให้ผู้เรียนตกใจ กดปุ่มใหม่ได้เสมอ
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!view) return null

  const { form, table } = view
  const hasSelf = table.status !== 'no-self'
  const showForm = !hasSelf || editing
  const complete = form.dimensions.every((d) => typeof draft[d.id] === 'number')

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/self-assess', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scores: draft }),
      })
      const data = (await res.json().catch(() => null)) as
        | (View & { message?: string })
        | { message?: string }
        | null
      if (res.ok && data && 'form' in data) {
        setView(data)
        setDraft(data.self.scores ?? {})
        setEditing(false)
      }
      setMessage(data?.message ?? null)
    } catch {
      setMessage('ยังบันทึกไม่สำเร็จ ลองกดอีกครั้งนะ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={className} aria-label="ประเมินตนเองและเทียบคะแนน 3 แหล่ง">
      {showForm ? (
        <Card tone="quest" padding="md">
          <h3 className="font-semibold">{form.prompt}</h3>
          <p className="mt-1 text-sm opacity-80">{form.helper}</p>

          <div className="mt-4 flex flex-col gap-4">
            {form.dimensions.map((dimension) => (
              <fieldset key={dimension.id} className="rounded-xl bg-surface-sunken p-3">
                <legend className="px-1 text-sm font-semibold">{dimension.name}</legend>
                <p className="text-sm opacity-80">{dimension.question}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {dimension.levels.map((level) => (
                    <label
                      key={level.score}
                      className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-surface-raised"
                    >
                      <input
                        type="radio"
                        name={dimension.id}
                        value={level.score}
                        checked={draft[dimension.id] === level.score}
                        onChange={() => setDraft((d) => ({ ...d, [dimension.id]: level.score }))}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-semibold">
                          {level.score} · {level.label}
                        </span>
                        <span className="block opacity-80">{level.descriptor}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <Button
            variant="success"
            fullWidth
            className="mt-4"
            disabled={busy || !complete}
            onClick={() => void save()}
          >
            {complete ? 'บันทึกคะแนนที่ให้ตัวเอง' : 'ให้คะแนนให้ครบทุกด้านก่อนนะ'}
          </Button>
        </Card>
      ) : (
        <Card tone="plain" padding="md">
          <h3 className="font-semibold">{table.headline}</h3>
          <p className="mt-1 text-sm opacity-80">{table.summary}</p>

          {table.teacherNote && (
            <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm">
              <span className="font-semibold">ครูเขียนถึงเรา: </span>
              {table.teacherNote}
            </p>
          )}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="opacity-70">
                  <th scope="col" className="py-1 pr-2 font-semibold">
                    ด้าน
                  </th>
                  <th scope="col" className="py-1 pr-2 font-semibold">
                    ฉันให้ตัวเอง
                  </th>
                  <th scope="col" className="py-1 pr-2 font-semibold">
                    ระบบเสนอ
                  </th>
                  <th scope="col" className="py-1 font-semibold">
                    ครูยืนยัน
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.dimensionId} className="border-t border-surface-sunken">
                    <th scope="row" className="py-2 pr-2 font-normal">
                      {row.name}
                    </th>
                    <td className="py-2 pr-2">{row.self ?? '—'}</td>
                    <td className="py-2 pr-2">{row.system ?? '—'}</td>
                    <td className="py-2">
                      {row.teacher ?? '—'}
                      {row.teacherLabel && (
                        <span className="block text-xs opacity-70">{row.teacherLabel}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ข้อความชวนคิดรายด้าน มาจากเซิร์ฟเวอร์ทั้งหมด */}
          <ul className="mt-3 flex flex-col gap-2">
            {table.rows.map((row) => (
              <li key={row.dimensionId} className="rounded-xl bg-surface-sunken p-3 text-sm">
                {row.note}
              </li>
            ))}
          </ul>

          <Button
            variant="ghost"
            className="mt-3"
            disabled={busy}
            onClick={() => {
              setDraft(view.self.scores ?? {})
              setEditing(true)
            }}
          >
            แก้คะแนนที่ให้ตัวเอง
          </Button>
        </Card>
      )}

      {message && <p className="mt-2 text-sm opacity-80">{message}</p>}
    </section>
  )
}

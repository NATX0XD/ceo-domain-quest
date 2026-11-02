'use client'

import type { ReactNode } from 'react'
import { cn } from '../../../components/ui'
import { Tabs } from './ui'
import { useUrlTab } from './url-tab'

export interface UrlTabItem {
  value: string
  label: ReactNode
  count?: number
  content: ReactNode
}

/** แท็บ + แผงเนื้อหา ซิงก์กับ ?tab= — แผงที่ไม่ได้เลือกซ่อนด้วย CSS (พิมพ์แล้วออกครบ) */
export function UrlTabs({ label, items }: { label: string; items: UrlTabItem[] }) {
  const values = items.map((i) => i.value)
  const [tab, setTab] = useUrlTab<string>(values, values[0] ?? '')
  return (
    <div className="grid gap-4">
      <Tabs<string>
        label={label}
        value={tab}
        onChange={setTab}
        options={items.map((i) => ({ value: i.value, label: i.label, count: i.count }))}
      />
      {items.map((i) => (
        <div key={i.value} role="tabpanel" className={cn('grid gap-4', i.value !== tab && '!hidden print:!grid')}>
          {i.content}
        </div>
      ))}
    </div>
  )
}

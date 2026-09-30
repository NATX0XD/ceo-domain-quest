'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
// ยังไม่มีไอคอนแว่นขยายในชุด UI และ `components/ui/**` อยู่นอกขอบเขตรอบนี้
// จึงใช้ไอคอนคลังความรู้ไปก่อน (ดูรายการขอเพิ่มท้ายไฟล์ผล)
import { Card, ChevronRightIcon, EmptyState, KnowledgeIcon } from '@/components/ui'
// ⚠️ ต้อง import จาก `knowledge-index` เท่านั้น ห้าม import `knowledge-search`
//    ตัวหลังดึง content/missions.json ทั้งก้อน (มีคำใบ้) เข้าบันเดิลฝั่งเบราว์เซอร์
import {
  KNOWLEDGE_KIND_LABEL,
  searchKnowledge,
  type KnowledgeEntry,
} from '@/components/server/knowledge-index'

/**
 * S-34 ช่องค้นหาของคลังความรู้
 *
 * **ไม่ต่อ API ใหม่โดยตั้งใจ** — ดัชนีมาจากเซิร์ฟเวอร์พร้อมหน้า (`knowledgeEntries()`)
 * ค้นในเครื่องทันที ไม่ต้องรอเน็ต ซึ่งสำคัญมากตอน 30 เครื่องใช้ไวไฟห้องเดียวกัน
 * และไม่มีคำค้นของเด็กคนไหนถูกส่งออกไปจากเครื่องเลย
 *
 * ⚠️ ตรรกะการค้นอยู่ที่ `components/server/knowledge-index.ts` ซึ่งมีเทสต์คุม
 *    ที่นี่เป็นหน้าตาล้วน ห้ามเขียนกติกาการจัดอันดับซ้ำในนี้
 * ⚠️ ดัชนีมีแค่ 3 แหล่งที่หน้านี้แสดงอยู่แล้ว (เป้าหมาย · การ์ด · สรุปสั้น)
 *    **ไม่มีตัวเลือกของข้อเช็กและไม่มีคำใบ้** เพราะไฟล์นี้ถูกส่งเข้าบันเดิลฝั่งเบราว์เซอร์
 * ⚠️ ไม่เจอ = ต้องบอกทางไปต่อ ห้ามทิ้งจอว่างเปล่า
 *
 * โครง 100dvh: ทั้งก้อนอยู่ในชั้นที่เลื่อนได้ของ AppShell ไม่มี `overflow-y` ของตัวเอง
 * ไม่มี `sticky` และไม่มีความสูงคงที่ จึงไม่แตะโครงของ session design เลย
 */

/** ค้นเจอเยอะเกินก็อ่านไม่ไหว ตัดที่จำนวนที่ยังกวาดตาได้จบบนจอ 390 */
const MAX_RESULTS = 20

export interface KnowledgeSearchProps {
  /** ดัชนีทั้งหมด ประกอบมาจากเซิร์ฟเวอร์ */
  entries: KnowledgeEntry[]
  className?: string
}

export function KnowledgeSearch({ entries, className }: KnowledgeSearchProps) {
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const results = useMemo(
    () => searchKnowledge(entries, trimmed, MAX_RESULTS),
    [entries, trimmed],
  )
  const searching = trimmed.length > 0

  return (
    <section aria-label="ค้นหาในคลังความรู้" className={className}>
      <label htmlFor="knowledge-search" className="block text-body font-bold text-ink">
        หาเรื่องที่อยากทบทวน
      </label>

      <div className="relative mt-2">
        <KnowledgeIcon
          width={22}
          height={22}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-subtle"
        />
        <input
          id="knowledge-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // ปิดตัวช่วยของคีย์บอร์ดมือถือ คำศัพท์ในบทเรียนไม่ใช่คำทั่วไป แก้ให้แล้วยิ่งพิมพ์ไม่ตรง
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="เช่น โดเมน · .co.th · ตั้งชื่อ"
          className="min-h-14 w-full rounded-full bg-surface-raised pr-4 pl-12 text-body text-ink ring-2 ring-line-contrast ring-inset outline-none placeholder:text-ink-subtle focus:ring-brand-500 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
        />
      </div>

      {searching ? (
        <p aria-live="polite" className="mt-2 text-label text-ink-muted">
          {results.length === 0
            ? `ไม่เจอ "${trimmed}" ในคลังความรู้`
            : `เจอ ${results.length} เรื่อง${results.length === MAX_RESULTS ? ' (แสดงเท่าที่อ่านไหว ลองพิมพ์ให้เจาะจงขึ้น)' : ''}`}
        </p>
      ) : null}

      {searching ? (
        results.length === 0 ? (
          <div className="mt-3">
            {/* ไม่เจอแล้วต้องมีทางไปต่อ ไม่ใช่จอว่าง */}
            <EmptyState
              as="h3"
              title="ยังไม่เจอคำนี้"
              description="ลองพิมพ์คำสั้นลง เช่น โดเมน หรือ นามสกุล · หรือเลื่อนลงไปอ่านทั้งหมดทีละภารกิจก็ได้"
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {results.map((entry) => (
              <li key={entry.id}>
                <Card padding="sm">
                  <p className="flex flex-wrap items-center gap-2 text-label font-bold text-brand-700">
                    <span className="inline-flex min-h-7 items-center rounded-full bg-brand-100 px-2.5">
                      ภารกิจที่ {entry.missionIndex}
                    </span>
                    <span className="text-ink-muted">{KNOWLEDGE_KIND_LABEL[entry.kind]}</span>
                  </p>
                  <p className="mt-1.5 text-body font-bold text-pretty text-ink">{entry.title}</p>
                  {entry.body ? (
                    <p className="mt-1 text-body text-pretty text-ink-muted">{entry.body}</p>
                  ) : null}
                  <Link
                    href={`#knowledge-${entry.missionId}`}
                    className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md text-label font-bold text-brand-700 underline focus-ring"
                  >
                    ไปอ่านเต็ม ๆ ที่ {entry.missionTitle}
                    <ChevronRightIcon width={18} height={18} aria-hidden />
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  )
}

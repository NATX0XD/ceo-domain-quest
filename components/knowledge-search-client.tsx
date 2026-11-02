'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, ChevronRightIcon, EmptyState } from '@/components/ui'
import {
  KNOWLEDGE_KIND_LABEL,
  searchKnowledge,
  type KnowledgeEntry,
} from '@/components/server/knowledge-index'

const MAX_RESULTS = 20

export interface KnowledgeSearchProps {
  entries: KnowledgeEntry[]
  className?: string
}

/** ค้นในดัชนีที่ส่งมาจากเซิร์ฟเวอร์ทันที โดยไม่เพิ่ม API หรือส่งคำค้นออกจากเครื่อง */
export function KnowledgeSearch({ entries, className }: KnowledgeSearchProps) {
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const results = useMemo(() => searchKnowledge(entries, trimmed, MAX_RESULTS), [entries, trimmed])
  const searching = trimmed.length > 0

  return (
    <section aria-label="ค้นหาในคลังความรู้" className={`kr-search-panel ${className ?? ''}`}>
      <div className="kr-search-heading">
        <span className="kr-search-kicker">หากุญแจคำตอบ</span>
        <label htmlFor="knowledge-search">ค้นหาในหนังสือทุกเล่ม</label>
      </div>

      <div className="kr-search-field">
        <span aria-hidden="true" className="kr-magnifier" />
        <input
          id="knowledge-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="เช่น โดเมน · .co.th · ตั้งชื่อ"
          className="kr-search-input"
        />
      </div>

      {searching ? (
        <p aria-live="polite" className="kr-search-status">
          {results.length === 0
            ? `ไม่เจอ "${trimmed}" ในคลังความรู้`
            : `เจอ ${results.length} เรื่อง${results.length === MAX_RESULTS ? ' (แสดงเท่าที่อ่านไหว ลองพิมพ์ให้เจาะจงขึ้น)' : ''}`}
        </p>
      ) : null}

      {searching ? (
        results.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              as="h3"
              title="ยังไม่เจอคำนี้"
              description="ลองพิมพ์คำสั้นลง เช่น โดเมน หรือ นามสกุล · หรือปิดแผ่นนี้แล้วเลือกหนังสือทีละเล่ม"
            />
          </div>
        ) : (
          <ul className="kr-search-results">
            {results.map((entry) => (
              <li key={entry.id}>
                <Card padding="sm" className="kr-search-result">
                  <p className="kr-result-kicker">
                    <span>ภารกิจที่ {entry.missionIndex}</span>
                    <span>{KNOWLEDGE_KIND_LABEL[entry.kind]}</span>
                  </p>
                  <p className="kr-result-title">{entry.title}</p>
                  {entry.body ? <p className="kr-result-body">{entry.body}</p> : null}
                  <Link href={`#knowledge-${entry.missionId}`} className="kr-result-link">
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

'use client'

import { useEffect, useState } from 'react'
import {
  AlertIcon,
  Button,
  Card,
  CheckIcon,
  EmptyState,
  SendIcon,
  Skeleton,
  SkeletonGroup,
  TextField,
  UsersIcon,
} from '@/components/ui'

/**
 * ขั้นที่ 5 ดูผลงานเพื่อน — ให้ความเห็นเพื่อน
 *
 * ⚠️ หน้านี้แสดงเฉพาะผลงาน ห้ามมีตัวเลขวัดผลของใครเด็ดขาด ไม่เปรียบเทียบผู้เรียนกันเอง
 * ⚠️ ส่งความเห็นผ่าน POST /api/showcase/feedback เท่านั้น ตัวตนผู้ส่งมาจากคุกกี้ฝั่งเซิร์ฟเวอร์
 */
export interface ShowcaseItem {
  nickname: string
  domainName: string
  tld: string
  reasonText: string | null
}

/**
 * กระดานผลงานเพื่อน — ดึงจาก GET /api/me/showcase
 * ⚠️ API คืนมาแค่ 4 ฟิลด์ (ชื่อเล่น โดเมน นามสกุล เหตุผล) ไม่มีตัวเลขวัดผลใด ๆ ไม่มีสถานะผ่าน
 *    ห้ามเพิ่มอะไรที่ทำให้เอาผู้เรียนมาเทียบกันได้
 */
export function ShowcaseBoard() {
  const [items, setItems] = useState<ShowcaseItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/me/showcase')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | { showcase?: ShowcaseItem[]; message?: string }
          | null
        if (!alive) return
        if (!res.ok) {
          setError(data?.message ?? 'เปิดกระดานผลงานไม่สำเร็จ')
          return
        }
        setItems(data?.showcase ?? [])
      })
      .catch(() => {
        if (alive) setError('ต่อเน็ตไม่ได้ ลองรีเฟรชหน้าอีกครั้ง')
      })
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-xl bg-spark-50 p-4 text-body text-pretty text-spark-700 ring-1 ring-spark-200 ring-inset"
      >
        <AlertIcon width={20} height={20} aria-hidden className="mt-1 shrink-0" />
        <span className="min-w-0 flex-1">{error}</span>
      </p>
    )
  }

  if (items === null) {
    return (
      <SkeletonGroup label="กำลังเปิดกระดานผลงาน" className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-soft">
            <Skeleton shape="text" width="35%" />
            <Skeleton shape="title" className="mt-2" width="70%" />
            <Skeleton shape="text" lines={2} className="mt-3" />
          </div>
        ))}
      </SkeletonGroup>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        as="h3"
        title="ยังไม่มีเพื่อนส่งผลงาน"
        description="รอสักครู่แล้วรีเฟรชอีกที ระหว่างนี้กลับไปเกลาชื่อเว็บของเราให้ดีขึ้นก็ได้"
        illustration={<UsersIcon width={48} height={48} className="text-brand-400" />}
      />
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-3">
      {items.map((item) => (
        <Card as="li" key={`${item.nickname}-${item.domainName}${item.tld}`}>
          <p className="flex items-center gap-1.5 text-label font-bold text-ink-muted">
            <UsersIcon width={18} height={18} aria-hidden className="shrink-0 text-brand-600" />
            <span className="min-w-0 truncate">{item.nickname}</span>
          </p>
          <p className="mt-1 text-body-lg font-bold break-all text-brand-700">
            {item.domainName}
            {item.tld}
          </p>
          {item.reasonText ? (
            <p className="mt-2 text-body whitespace-pre-line text-pretty text-ink">
              {item.reasonText}
            </p>
          ) : null}
        </Card>
      ))}
    </ul>
  )
}

export function ShowcaseFeedbackForm({ myNickname }: { myNickname: string }) {
  const [toNickname, setToNickname] = useState('')
  const [praiseText, setPraiseText] = useState('')
  const [suggestText, setSuggestText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ready =
    toNickname.trim().length > 0 &&
    (praiseText.trim().length > 0 || suggestText.trim().length > 0)

  async function send() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/showcase/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toNickname: toNickname.trim(),
          praiseText: praiseText.trim(),
          suggestText: suggestText.trim(),
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; toNickname?: string; message?: string }
        | null
      if (!res.ok) {
        setError(data?.message ?? 'ส่งความเห็นไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setMessage(`ส่งให้ ${data?.toNickname ?? toNickname.trim()} แล้ว ขอบคุณที่ช่วยเพื่อนนะ`)
      setPraiseText('')
      setSuggestText('')
    } catch {
      setError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  const textareaClass =
    'mt-2 min-h-14 w-full resize-y rounded-sm bg-surface-raised px-4 py-3 text-body text-ink ' +
    'ring-2 ring-line-contrast ring-inset outline-none transition-[box-shadow] duration-200 motion-reduce:transition-none ' +
    'placeholder:text-ink-subtle focus:ring-brand-500 ' +
    'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus'

  return (
    <Card as="section" tone="brand" className="mt-6">
      <h2 className="text-title-sm font-bold text-balance text-ink">
        ให้ความเห็นเพื่อน (ทำหรือไม่ทำก็ได้)
      </h2>
      <p className="mt-1 text-body text-pretty text-ink-muted">
        ชม 1 ข้อ เสนอแนะ 1 ข้อ เขียนเป็นข้อเสนอ ไม่ใช่คำตำหนิ · ชื่อของเราในห้องนี้คือ {myNickname}
      </p>

      <TextField
        id="to-nickname"
        className="mt-5"
        label="ชื่อเล่นของเพื่อน"
        type="text"
        value={toNickname}
        onChange={(e) => setToNickname(e.target.value)}
        maxLength={40}
        placeholder="พิมพ์ชื่อเล่นที่เพื่อนใช้ในห้องนี้"
      />

      <label htmlFor="praise" className="mt-5 block text-body font-bold text-ink">
        ชมเพื่อน 1 ข้อ
      </label>
      <textarea
        id="praise"
        rows={2}
        maxLength={400}
        value={praiseText}
        onChange={(e) => setPraiseText(e.target.value)}
        placeholder="ชื่อเว็บของเพื่อนดีตรงไหน บอกให้ชัด เช่น สั้นจำง่าย หรือบอกได้เลยว่าขายอะไร"
        className={textareaClass}
      />

      <label htmlFor="suggest" className="mt-5 block text-body font-bold text-ink">
        เสนอแนะเพื่อน 1 ข้อ
      </label>
      <textarea
        id="suggest"
        rows={2}
        maxLength={400}
        value={suggestText}
        onChange={(e) => setSuggestText(e.target.value)}
        placeholder="ถ้าจะให้ดีขึ้นอีก เพื่อนควรลองอะไร เช่น ตัดให้สั้นลง หรือเปลี่ยนนามสกุลเป็นแบบที่จดได้จริง"
        className={textareaClass}
      />

      {error ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl bg-danger-100 p-4 text-body text-pretty text-danger-700 ring-1 ring-danger-600 ring-inset"
        >
          <AlertIcon width={20} height={20} aria-hidden className="mt-1 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-xl bg-quest-50 p-4 text-body text-pretty text-quest-700 ring-1 ring-quest-100 ring-inset"
        >
          <CheckIcon width={20} height={20} aria-hidden className="mt-1 shrink-0" />
          <span className="min-w-0 flex-1">{message}</span>
        </p>
      ) : null}

      {/* ปุ่มเดียวที่เด่นที่สุดของหน้านี้ */}
      <Button
        className="mt-5"
        variant="primary"
        size="lg"
        fullWidth
        onClick={send}
        loading={busy}
        loadingLabel="กำลังส่งความเห็น"
        disabled={!ready}
        leadingIcon={ready ? <SendIcon width={22} height={22} aria-hidden /> : undefined}
      >
        {ready ? 'ส่งความเห็นให้เพื่อน' : 'พิมพ์ชื่อเพื่อนและอย่างน้อย 1 ช่อง'}
      </Button>
    </Card>
  )
}

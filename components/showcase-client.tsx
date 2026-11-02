'use client'

import { useEffect, useRef, useState } from 'react'
import { ShopArtImg } from '@/components/shop-art-img'
import {
  AlertIcon,
  Button,
  Card,
  CheckIcon,
  ChevronRightIcon,
  EmptyState,
  SendIcon,
  Skeleton,
  SkeletonGroup,
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
  shopName?: string | null
  artSrc?: string
  likes?: number
  likedByMe?: boolean
  praises?: number
}

type PraiseTarget = { nickname: string; shopName: string | null }

/** แกลเลอรีกด "เขียนชม" แล้วฟอร์มในแผ่น #sheet-praise เลือกเพื่อนคนนั้นให้เอง */
const PRAISE_EVENT = 'showcase:praise'
const FALLBACK_ART = '/ui/home/shop-stage-5.webp'

function splitReasons(text: string | null): string[] {
  return (text ?? '')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 3)
}

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z"
        fill={filled ? '#e23d3d' : 'none'}
        stroke={filled ? '#a51d1d' : 'currentColor'}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * แกลเลอรีผลงานเพื่อน — ปัดซ้าย/ขวา (scroll-snap) + ปุ่มลูกศร + จุดบอกตำแหน่ง x/N
 * การ์ดหน้าตาเดียวกับการ์ดผลงานของเรา: ภาพร้าน · ป้ายไม้ชื่อเว็บ · ชื่อร้าน · เหตุผล 3 ข้อ
 * ⚠️ ไม่มีดาว/คะแนน · ใจกับจำนวนคำชมเป็นแค่ตัวนับ ไม่ใช้เรียงหรือจัดอันดับ (เรียงตามชื่อเล่น)
 * ⚠️ ผลงานที่ติดตัวกรองคำถูกตัดออกตั้งแต่ GET /api/me/showcase
 */
export function ShowcaseBoard() {
  const [items, setItems] = useState<ShowcaseItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [likeError, setLikeError] = useState<string | null>(null)
  /** การ์ดที่กางเหตุผลอ่านเต็มอยู่ (ชื่อเล่น) — ปัดไปการ์ดอื่นแล้วหุบเอง */
  const [reading, setReading] = useState<string | null>(null)
  const track = useRef<HTMLUListElement>(null)

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

  function onScroll() {
    const el = track.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  function go(to: number) {
    const el = track.current
    if (!el || !items) return
    const next = Math.max(0, Math.min(items.length - 1, to))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    setIndex(next)
  }

  async function toggleLike(item: ShowcaseItem) {
    if (busy) return
    const liked = !item.likedByMe
    setBusy(item.nickname)
    setLikeError(null)
    try {
      const res = await fetch('/api/showcase/like', {
        method: liked ? 'POST' : 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toNickname: item.nickname }),
      })
      const data = (await res.json().catch(() => null)) as
        | { likes?: number; liked?: boolean; message?: string }
        | null
      if (!res.ok) {
        setLikeError(data?.message ?? 'กดใจไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setItems((prev) =>
        (prev ?? []).map((row) =>
          row.nickname === item.nickname
            ? { ...row, likes: data?.likes ?? row.likes, likedByMe: data?.liked ?? liked }
            : row,
        ),
      )
    } catch {
      setLikeError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(null)
    }
  }

  function praise(item: ShowcaseItem) {
    window.dispatchEvent(
      new CustomEvent<PraiseTarget>(PRAISE_EVENT, {
        detail: { nickname: item.nickname, shopName: item.shopName ?? null },
      }),
    )
    window.location.hash = 'sheet-praise'
  }

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
        <div className="card-soft">
          <Skeleton shape="title" width="60%" />
          <Skeleton shape="text" lines={3} className="mt-3" />
        </div>
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

  const total = items.length
  const current = Math.min(index, total - 1)

  return (
    <div className="scg" role="region" aria-roledescription="แกลเลอรี" aria-label="ผลงานของเพื่อนในห้อง">
      <ul ref={track} className="scg-track" onScroll={onScroll}>
        {items.map((item, i) => {
          const reasons = splitReasons(item.reasonText)
          const likes = item.likes ?? 0
          const isReading = reading === item.nickname && i === current
          const toggleReading = () => setReading(isReading ? null : item.nickname)
          const reasonsId = `scg-reasons-${i}`
          return (
            <li
              key={item.nickname}
              className="scg-slide"
              aria-roledescription="การ์ด"
              aria-label={`${i + 1} จาก ${total}: ${item.nickname}`}
            >
              <article className={`sc-card scg-card${isReading ? ' is-reading' : ''}`}>
                <div className="sc-card-head">
                  <p className="sc-kicker">
                    {item.shopName ? `${item.shopName} · ` : ''}
                    {item.nickname}
                  </p>
                  <span className="scg-praises" title="คำชมที่เพื่อนได้รับ">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D สถิต */}
                    <img src="/icons/3d/speech-balloon.webp" alt="" aria-hidden="true" width={18} height={18} />
                    <span className="sr-only">คำชม</span>
                    {item.praises ?? 0}
                  </span>
                </div>
                <div className="sc-scene scg-scene">
                  <span className="sc-cloud sc-cloud-one" aria-hidden="true" />
                  <span className="sc-cloud sc-cloud-two" aria-hidden="true" />
                  <ShopArtImg
                    src={item.artSrc ?? FALLBACK_ART}
                    fallback={FALLBACK_ART}
                    alt={`ภาพร้านของ ${item.nickname}`}
                    className="sc-art"
                    loading={i < 2 ? 'eager' : 'lazy'}
                  />
                </div>
                <div className="sc-sign">
                  <span className="sc-sign-type">ชื่อเว็บของ {item.nickname}</span>
                  <strong>
                    {item.domainName}
                    {item.tld}
                  </strong>
                </div>
                {reasons.length > 0 ? (
                  <div className="scg-reasons">
                    <div className="scg-reasons-head">
                      <span className="scg-reasons-label">เหตุผล {reasons.length} ข้อ</span>
                      <button
                        type="button"
                        className="scg-read focus-ring"
                        aria-expanded={isReading}
                        aria-controls={reasonsId}
                        onClick={toggleReading}
                      >
                        {isReading ? 'ย่อกลับ' : 'อ่านเหตุผลทั้งหมด'}
                      </button>
                    </div>
                    {/* แตะรายการก็กาง/หุบได้ — ปุ่มด้านบนคือทางหลักสำหรับคีย์บอร์ดและโปรแกรมอ่านจอ */}
                    <ol id={reasonsId} className="sc-reasons" aria-label="เหตุผลที่ตั้งชื่อนี้" onClick={toggleReading}>
                      {reasons.map((reason, n) => (
                        <li key={`${n}-${reason}`}>
                          <span className="sc-reason-no" aria-hidden="true">{n + 1}</span>
                          <span className="sc-reason-text">{reason}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                <div className="scg-actions">
                  <button
                    type="button"
                    className={`scg-like focus-ring${item.likedByMe ? ' is-on' : ''}`}
                    aria-pressed={item.likedByMe === true}
                    disabled={busy === item.nickname}
                    onClick={() => toggleLike(item)}
                  >
                    <HeartGlyph filled={item.likedByMe === true} />
                    <span>ใจ</span>
                    <span className="scg-like-count" aria-label={`${likes} ใจ`}>{likes}</span>
                  </button>
                  <button
                    type="button"
                    className="game-button game-button--green game-button--sm scg-praise"
                    aria-label={`เขียนถึง ${item.nickname}`}
                    onClick={() => praise(item)}
                  >
                    <SendIcon width={18} height={18} aria-hidden />
                    <span>เขียนชม</span>
                  </button>
                </div>
              </article>
            </li>
          )
        })}
      </ul>

      {likeError ? (
        <p role="alert" className="scg-error">
          {likeError}
        </p>
      ) : null}

      <div className="scg-nav">
        <button
          type="button"
          className="scg-arrow focus-ring"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          aria-label="ผลงานก่อนหน้า"
        >
          <ChevronRightIcon width={22} height={22} aria-hidden style={{ transform: 'scaleX(-1)' }} />
        </button>
        <div className="scg-dots" aria-live="polite">
          {total <= 12 ? (
            <span className="scg-dot-row" aria-hidden="true">
              {items.map((item, i) => (
                <span key={item.nickname} className={`scg-dot${i === current ? ' is-on' : ''}`} />
              ))}
            </span>
          ) : null}
          <span className="scg-count">
            {current + 1}/{total}
          </span>
        </div>
        <button
          type="button"
          className="scg-arrow focus-ring"
          onClick={() => go(current + 1)}
          disabled={current >= total - 1}
          aria-label="ผลงานถัดไป"
        >
          <ChevronRightIcon width={22} height={22} aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function ShowcaseFeedbackForm() {
  const [toNickname, setToNickname] = useState('')
  const [directFriend, setDirectFriend] = useState<PraiseTarget | null>(null)
  const [praiseText, setPraiseText] = useState('')
  const [suggestText, setSuggestText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** ชื่อเล่นเพื่อนที่มีผลงานบนผนัง — แตะเลือกได้ ไม่ต้องพิมพ์ให้ตรงตัวสะกด */
  const [friends, setFriends] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    fetch('/api/me/showcase')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { showcase?: ShowcaseItem[] } | null) => {
        if (!alive || !data?.showcase) return
        setFriends([...new Set(data.showcase.map((item) => item.nickname))])
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    function pick(event: Event) {
      const detail = (event as CustomEvent<PraiseTarget | string>).detail
      const target =
        typeof detail === 'string'
          ? { nickname: detail, shopName: null }
          : detail && typeof detail.nickname === 'string'
            ? detail
            : null
      if (target?.nickname) {
        setDirectFriend(target)
        setToNickname(target.nickname)
        setMessage(null)
        setError(null)
      }
    }
    window.addEventListener(PRAISE_EVENT, pick)
    function clearWhenClosed() {
      if (window.location.hash !== '#sheet-praise') {
        setDirectFriend(null)
        setToNickname('')
      }
    }
    window.addEventListener('hashchange', clearWhenClosed)
    return () => {
      window.removeEventListener(PRAISE_EVENT, pick)
      window.removeEventListener('hashchange', clearWhenClosed)
    }
  }, [])

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
    <Card as="section" tone="brand">
      <h2 className="text-title-sm font-bold text-balance text-ink">
        ให้ความเห็นเพื่อน (ทำหรือไม่ทำก็ได้)
      </h2>
      <p className="mt-1 whitespace-nowrap text-note tracking-tight text-ink-muted">
        ชม 1 ข้อ เสนอแนะ 1 ข้อ สุภาพ ไม่ตำหนิ
      </p>

      {directFriend ? (
        <p className="mt-4 text-label font-bold text-ink-muted" aria-live="polite">
          เขียนถึง {directFriend.nickname}
          {directFriend.shopName ? ` · ${directFriend.shopName}` : ''}
        </p>
      ) : friends.length > 0 ? (
        <div className="mt-4">
          <p className="text-body font-bold text-ink">เลือกเพื่อน</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="เลือกเพื่อนที่จะเขียนถึง">
            {friends.map((name) => {
              const picked = toNickname.trim() === name
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => {
                    setDirectFriend(null)
                    setToNickname(name)
                    setMessage(null)
                    setError(null)
                  }}
                  className={`min-h-11 rounded-full px-4 text-label font-bold ring-2 ring-inset focus-ring ${
                    picked
                      ? 'bg-quest-600 text-white ring-quest-700'
                      : 'bg-surface-raised text-brand-700 ring-brand-200 hover:bg-brand-50'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

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
        {ready
          ? 'ส่งความเห็นให้เพื่อน'
          : directFriend
            ? 'เขียนอย่างน้อย 1 ช่อง'
            : 'เลือกเพื่อนและอย่างน้อย 1 ช่อง'}
      </Button>
    </Card>
  )
}

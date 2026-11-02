'use client'

import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { ShopArtImg } from '@/components/shop-art-img'
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  LightbulbIcon,
  SendIcon,
  Skeleton,
  SkeletonGroup,
  UsersIcon,
} from '@/components/ui'

/** งานของเราเป็นสไลด์แรกเสมอ ส่วนงานเพื่อนอ่านจาก GET /api/me/showcase */
export interface ShowcaseMine {
  shopName: string
  artSrc: string
  domainName: string | null
  tld: string | null
  reasonText: string | null
  hiddenNote: string | null
}

export interface ShowcaseFeedback {
  id: string
  praiseText: string | null
  suggestText: string | null
}

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

const FALLBACK_ART = '/ui/home/shop-stage-5.webp'

function splitReasons(text: string | null): string[] {
  return (text ?? '')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 3)
}

function DomainLabel({ domainName, tld }: { domainName: string | null; tld: string | null }) {
  const fullDomain = `${domainName ?? ''}${tld ?? ''}`
  if (!fullDomain) return <span>ยังไม่มีชื่อเว็บ</span>

  const parts = fullDomain.split('.')
  return parts.map((part, index) => (
    <Fragment key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 ? (
        <>
          .<wbr />
        </>
      ) : null}
    </Fragment>
  ))
}

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <span className={`scg-heart${filled ? ' is-filled' : ''}`} aria-hidden="true">
      {filled ? '♥' : '♡'}
    </span>
  )
}

function StoreScene({ src, alt, loading }: { src: string; alt: string; loading?: 'eager' | 'lazy' }) {
  return (
    <div className="sc-scene">
      <span className="sc-cloud sc-cloud-one" aria-hidden="true" />
      <span className="sc-cloud sc-cloud-two" aria-hidden="true" />
      <ShopArtImg src={src} fallback={FALLBACK_ART} alt={alt} className="sc-art" loading={loading} />
    </div>
  )
}

function DomainSign({ owner, domainName, tld }: { owner: string; domainName: string | null; tld: string | null }) {
  return (
    <div className="sc-sign">
      <span className="sc-sign-type">ชื่อเว็บของ {owner}</span>
      <strong>
        <DomainLabel domainName={domainName} tld={tld} />
      </strong>
    </div>
  )
}

function Reasons({ reasons, expandable = false, expanded = false, onToggle }: {
  reasons: string[]
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
}) {
  if (reasons.length === 0) return null

  return (
    <div className={`scg-reasons${expanded ? ' is-expanded' : ''}`}>
      <div className="scg-reasons-head">
        <span className="scg-reasons-label">เหตุผล {reasons.length} ข้อ</span>
        {expandable && reasons.length > 1 ? (
          <button type="button" className="scg-read focus-ring" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? 'ย่อเหตุผล' : 'อ่านเหตุผลทั้งหมด'}
          </button>
        ) : null}
      </div>
      <ol className="sc-reasons" aria-label="เหตุผลที่ตั้งชื่อนี้">
        {reasons.map((reason, index) => (
          <li key={`${index}-${reason}`}>
            <span className="sc-reason-no" aria-hidden="true">{index + 1}</span>
            <span className="sc-reason-text">{reason}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

type ShowcaseCarouselProps = {
  my: ShowcaseMine
  feedback: ShowcaseFeedback[]
}

/**
 * Carousel หลักของหน้า: สไลด์แรกคืองานของเรา และทุกสไลด์ถัดไปคือเพื่อนหนึ่งคน
 *
 * การมองเห็นงานเพื่อนยังถูกบังคับที่ GET /api/me/showcase เหมือนเดิม ส่วนการกดใจ
 * และส่งความเห็นเรียก endpoint เดิมโดยใช้ session cookie ฝั่งเซิร์ฟเวอร์
 */
export function ShowcaseCarousel({ my, feedback }: ShowcaseCarouselProps) {
  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [likeError, setLikeError] = useState<string | null>(null)
  const [reading, setReading] = useState<number | null>(null)
  const [praiseTarget, setPraiseTarget] = useState<ShowcaseItem | null>(null)
  const [praiseText, setPraiseText] = useState('')
  const [suggestText, setSuggestText] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendMessage, setSendMessage] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const track = useRef<HTMLUListElement>(null)
  const praiseDialog = useRef<HTMLDialogElement>(null)
  const inboxDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/me/showcase')
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | { showcase?: ShowcaseItem[]; message?: string }
          | null
        if (!alive) return
        if (!res.ok) {
          setError(data?.message ?? 'เปิดผลงานเพื่อนไม่สำเร็จ')
          return
        }
        setItems(data?.showcase ?? [])
      })
      .catch(() => {
        if (alive) setError('ต่อเน็ตไม่ได้ ลองรีเฟรชหน้าอีกครั้ง')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!praiseTarget || !praiseDialog.current || praiseDialog.current.open) return
    praiseDialog.current.showModal()
  }, [praiseTarget])

  const total = 1 + items.length

  function onScroll() {
    const element = track.current
    if (!element || element.clientWidth === 0) return
    const next = Math.max(0, Math.min(total - 1, Math.round(element.scrollLeft / element.clientWidth)))
    setCurrent((previous) => {
      if (previous !== next) setReading(null)
      return next
    })
  }

  function go(to: number) {
    const element = track.current
    const next = Math.max(0, Math.min(total - 1, to))
    if (element) element.scrollTo({ left: next * element.clientWidth, behavior: 'smooth' })
    setCurrent(next)
    setReading(null)
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
      setItems((previous) =>
        previous.map((row) =>
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

  function openPraise(item: ShowcaseItem) {
    setPraiseTarget(item)
    setPraiseText('')
    setSuggestText('')
    setSendMessage(null)
    setSendError(null)
  }

  function closePraise() {
    if (praiseDialog.current?.open) praiseDialog.current.close()
    setPraiseTarget(null)
  }

  async function sendPraise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!praiseTarget || sendBusy || (!praiseText.trim() && !suggestText.trim())) return
    setSendBusy(true)
    setSendError(null)
    setSendMessage(null)
    try {
      const res = await fetch('/api/showcase/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toNickname: praiseTarget.nickname,
          praiseText: praiseText.trim(),
          suggestText: suggestText.trim(),
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; toNickname?: string; message?: string }
        | null
      if (!res.ok) {
        setSendError(data?.message ?? 'ส่งความเห็นไม่สำเร็จ ลองใหม่อีกครั้ง')
        return
      }
      setItems((previous) =>
        previous.map((row) =>
          row.nickname === praiseTarget.nickname ? { ...row, praises: (row.praises ?? 0) + 1 } : row,
        ),
      )
      setSendMessage(`ส่งให้ ${data?.toNickname ?? praiseTarget.nickname} แล้ว ขอบคุณที่ช่วยเพื่อนนะ`)
      setPraiseText('')
      setSuggestText('')
    } catch {
      setSendError('ต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setSendBusy(false)
    }
  }

  const readyToSend = Boolean(praiseTarget && (praiseText.trim() || suggestText.trim()))

  return (
    <section className="sc-carousel" aria-label="ผลงานของฉันและผลงานเพื่อน">
      <ul ref={track} className="scg-track" onScroll={onScroll}>
        <li className="scg-slide" aria-roledescription="สไลด์" aria-label={`1 จาก ${total}: ผลงานของฉัน`}>
          <article className="sc-card scg-card scg-card--mine" aria-labelledby="sc-my-domain">
            <div className="sc-card-head">
              <p className="sc-kicker">{my.shopName}</p>
              <button type="button" className="sc-inbox focus-ring" onClick={() => inboxDialog.current?.showModal()}>
                {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D สถิต */}
                <img src="/icons/3d/speech-balloon.webp" alt="" aria-hidden="true" width={20} height={20} />
                <span>เพื่อนชมเรา</span>
                <span className={`sc-badge${feedback.length > 0 ? ' is-new' : ''}`}>{feedback.length}</span>
              </button>
            </div>
            <StoreScene src={my.artSrc} alt="ภาพร้านของฉัน" loading="eager" />
            <DomainSign owner="ฉัน" domainName={my.domainName} tld={my.tld} />
            {my.domainName ? <Reasons reasons={splitReasons(my.reasonText)} /> : null}
            {my.hiddenNote ? <p className="sc-hidden-note" role="note">{my.hiddenNote}</p> : null}
            {!my.domainName ? (
              <div className="sc-empty">
                <h2 id="sc-my-domain">ยังไม่มีผลงานที่ส่ง</h2>
                <p>ส่งใบเสนอที่ด่านบอส CEO ก่อน แล้วผลงานจะมาโผล่ตรงนี้</p>
                <a href="/ceo" className="game-button game-button--purple game-button--sm">ไปด่านบอส CEO</a>
              </div>
            ) : null}
          </article>
        </li>

        {items.map((item, index) => {
          const reasons = splitReasons(item.reasonText)
          const slideIndex = index + 1
          const expanded = reading === slideIndex
          const likes = item.likes ?? 0
          return (
            <li key={item.nickname} className="scg-slide" aria-roledescription="สไลด์" aria-label={`${slideIndex + 1} จาก ${total}: ${item.nickname}`}>
              <article className={`sc-card scg-card${expanded ? ' is-reading' : ''}`}>
                <div className="sc-card-head">
                  <p className="sc-kicker">
                    {item.shopName ? `${item.shopName} · ` : ''}
                    {item.nickname}
                  </p>
                  <span className="scg-praises" title="จำนวนคำชมที่ได้รับ">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D สถิต */}
                    <img src="/icons/3d/speech-balloon.webp" alt="" aria-hidden="true" width={17} height={17} />
                    {item.praises ?? 0}
                  </span>
                </div>
                <StoreScene
                  src={item.artSrc ?? FALLBACK_ART}
                  alt={`ภาพร้านของ ${item.nickname}`}
                  loading={index < 2 ? 'eager' : 'lazy'}
                />
                <DomainSign owner={item.nickname} domainName={item.domainName} tld={item.tld} />
                <Reasons
                  reasons={reasons}
                  expandable
                  expanded={expanded}
                  onToggle={() => setReading(expanded ? null : slideIndex)}
                />
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
                  <button type="button" className="game-button game-button--green game-button--sm scg-praise" onClick={() => openPraise(item)}>
                    <SendIcon width={18} height={18} aria-hidden />
                    <span>เขียนชม</span>
                  </button>
                </div>
              </article>
            </li>
          )
        })}
      </ul>

      {loading ? (
        <SkeletonGroup label="กำลังเปิดผลงานเพื่อน" className="scg-loading">
          <Skeleton shape="text" width="42%" />
        </SkeletonGroup>
      ) : null}
      {error ? <p role="alert" className="scg-error"><AlertIcon width={18} height={18} aria-hidden />{error}</p> : null}
      {likeError ? <p role="alert" className="scg-error"><AlertIcon width={18} height={18} aria-hidden />{likeError}</p> : null}

      <nav className="scg-nav" aria-label="เปลี่ยนผลงาน">
        <button type="button" className="scg-arrow focus-ring" onClick={() => go(current - 1)} disabled={current === 0} aria-label="ผลงานก่อนหน้า">
          <ChevronRightIcon width={21} height={21} aria-hidden className="is-prev" />
        </button>
        <div className="scg-dots" aria-live="polite">
          <div className="scg-dot-row">
            {Array.from({ length: total }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`scg-dot focus-ring${index === current ? ' is-on' : ''}`}
                aria-label={`ไปยังผลงานที่ ${index + 1}`}
                aria-current={index === current ? 'true' : undefined}
                onClick={() => go(index)}
              />
            ))}
          </div>
          <span className="scg-count">{current + 1}/{total}</span>
        </div>
        <button type="button" className="scg-arrow focus-ring" onClick={() => go(current + 1)} disabled={current >= total - 1} aria-label="ผลงานถัดไป">
          <ChevronRightIcon width={21} height={21} aria-hidden />
        </button>
      </nav>

      <dialog ref={inboxDialog} className="sc-dialog sc-inbox-dialog" aria-labelledby="sc-inbox-title">
        <div className="sc-dialog-panel">
          <div className="sc-dialog-head">
            <h2 id="sc-inbox-title">ความเห็นที่เพื่อนเขียนถึงเรา</h2>
            <button type="button" className="sc-dialog-close focus-ring" aria-label="ปิดความเห็นที่เพื่อนเขียนถึงเรา" onClick={() => inboxDialog.current?.close()}>
              <CloseIcon width={22} height={22} aria-hidden />
            </button>
          </div>
          {feedback.length === 0 ? (
            <div className="sc-inbox-empty">
              <UsersIcon width={34} height={34} aria-hidden />
              <p>ยังไม่มีใครเขียนถึงเรา</p>
            </div>
          ) : (
            <ul className="sc-inbox-list">
              {feedback.map((entry) => (
                <li key={entry.id} className="sc-feedback-item">
                  {entry.praiseText ? <p><CheckIcon width={18} height={18} aria-hidden /><span><strong>ชม:</strong> {entry.praiseText}</span></p> : null}
                  {entry.suggestText ? <p><LightbulbIcon width={18} height={18} aria-hidden /><span><strong>เสนอแนะ:</strong> {entry.suggestText}</span></p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>

      <dialog ref={praiseDialog} className="sc-dialog sc-praise-dialog" aria-labelledby="sc-praise-title" onClose={() => setPraiseTarget(null)}>
        {praiseTarget ? (
          <div className="sc-dialog-panel">
            <div className="sc-dialog-head">
              <h2 id="sc-praise-title">เขียนถึง {praiseTarget.nickname} · {praiseTarget.shopName ?? `ร้านของ ${praiseTarget.nickname}`}</h2>
              <button type="button" className="sc-dialog-close focus-ring" aria-label="ปิดหน้าต่างเขียนชม" onClick={closePraise}>
                <CloseIcon width={22} height={22} aria-hidden />
              </button>
            </div>
            <p className="sc-dialog-intro">ชม 1 ข้อ เสนอแนะ 1 ข้อ สุภาพ</p>
            <form onSubmit={sendPraise}>
              <label htmlFor="sc-praise-text">ชม 1 ข้อ</label>
              <textarea
                id="sc-praise-text"
                rows={2}
                maxLength={400}
                value={praiseText}
                onChange={(event) => setPraiseText(event.target.value)}
                placeholder="เช่น ชื่อสั้น จำง่าย"
              />
              <label htmlFor="sc-suggest-text">เสนอแนะ 1 ข้อ</label>
              <textarea
                id="sc-suggest-text"
                rows={2}
                maxLength={400}
                value={suggestText}
                onChange={(event) => setSuggestText(event.target.value)}
                placeholder="เช่น ลองใช้ .in.th"
              />
              {sendError ? <p role="alert" className="sc-dialog-status is-error">{sendError}</p> : null}
              {sendMessage ? <p role="status" className="sc-dialog-status is-success">{sendMessage}</p> : null}
              <button type="submit" className="game-button game-button--green game-button--md sc-dialog-submit" disabled={!readyToSend || sendBusy}>
                <SendIcon width={18} height={18} aria-hidden />
                <span>{sendBusy ? 'กำลังส่ง' : 'ส่งความเห็น'}</span>
              </button>
            </form>
          </div>
        ) : null}
      </dialog>
    </section>
  )
}

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * จอหน้าห้องสำหรับโปรเจกเตอร์ 16:9 ข้อมูลทั้งหมดเป็น HTML ทับภาพพื้นหลัง
 * ขนาดตัวอักษรอิง viewport height เพื่อให้ 1080p และ 720p อ่านได้ใกล้เคียงกัน
 */
const POLL_MS = 10_000
const SLIDE_MS = 8_000

interface Work {
  domain: string
  reason: string
  nickname: string | null
  shopArt: string | null
}

const STEPS = [
  { n: 1, icon: 'door', title: 'สแกน QR', detail: 'หรือเปิดลิงก์ด้านล่าง' },
  { n: 2, icon: 'clipboard', title: 'ใส่รหัสห้อง', detail: 'ดูรหัสบนป้ายไม้' },
  { n: 3, icon: 'bust-in-silhouette', title: 'ตั้งชื่อเล่น', detail: 'แล้วเริ่มภารกิจได้เลย' },
] as const

const display = { fontFamily: 'var(--font-display-thai), var(--font-noto-sans-thai), sans-serif' }

export function BoardScreenClient({
  classroomId,
  roomCode,
  joinUrl,
  qrSvg,
  bgUrl,
  mode,
  backHref,
}: {
  classroomId: string
  roomCode: string
  joinUrl: string
  qrSvg: string
  bgUrl: string | null
  mode: 'join' | 'showcase'
  backHref: string
}) {
  const [joined, setJoined] = useState<number | null>(null)
  const [works, setWorks] = useState<Work[]>([])
  const [slide, setSlide] = useState(0)
  const [full, setFull] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [countPulse, setCountPulse] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const lastJoinedRef = useRef<number | null>(null)
  const controlsTimerRef = useRef<number | null>(null)
  const pulseTimerRef = useRef<number | null>(null)

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/projector?classroomId=${classroomId}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { joined: number; showcase: Work[] }
      if (lastJoinedRef.current !== null && data.joined > lastJoinedRef.current) {
        setCountPulse(true)
        if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current)
        pulseTimerRef.current = window.setTimeout(() => setCountPulse(false), 1100)
      }
      lastJoinedRef.current = data.joined
      setJoined(data.joined)
      setWorks(data.showcase)
    } catch {
      // จอหน้าห้องห้ามขึ้น error กลางคาบ รอบถัดไปค่อยลองใหม่
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    setSlide((current) => (works.length > 0 ? current % works.length : 0))
  }, [works.length])

  useEffect(() => {
    if (mode !== 'showcase' || works.length < 2) return
    const id = window.setInterval(() => setSlide((current) => (current + 1) % works.length), SLIDE_MS)
    return () => window.clearInterval(id)
  }, [mode, works.length])

  useEffect(() => {
    revealControls()
    return () => {
      if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current)
      if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current)
    }
  }, [revealControls])

  useEffect(() => {
    const onFullscreen = () => setFull(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [])

  useEffect(() => {
    if (mode !== 'showcase') return
    const onKey = (event: KeyboardEvent) => {
      if (works.length < 2) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setSlide((current) => (current - 1 + works.length) % works.length)
        revealControls()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setSlide((current) => (current + 1) % works.length)
        revealControls()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, revealControls, works.length])

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const goPrev = () => setSlide((current) => (current - 1 + works.length) % works.length)
  const goNext = () => setSlide((current) => (current + 1) % works.length)
  const activeWork = works.length > 0 ? works[slide % works.length] : null
  const q = `classroomId=${classroomId}`
  const background = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {
        background:
          mode === 'join'
            ? 'linear-gradient(180deg, #73c5f0 0%, #e9f6ff 62%, #4ca2c5 62.2%, #226d9a 100%)'
            : 'linear-gradient(180deg, #b999e7 0%, #f6e8d9 68%, #d69757 68%, #a15b43 100%)',
      }

  return (
    <div
      ref={rootRef}
      className={`board-screen board-screen--${mode}`}
      style={{ ...background, ...display, fontSize: 'clamp(12px, 1.8518vh, 20px)' }}
      onPointerMove={revealControls}
      onTouchStart={revealControls}
    >
      <style>{`
        .board-screen { position: fixed; inset: 0; overflow: hidden; color: #34251b; }
        .board-screen *, .board-screen *::before, .board-screen *::after { box-sizing: border-box; }
        .board-screen a, .board-screen button { font: inherit; }
        .board-controls { position: absolute; top: 1.15em; right: 1.25em; z-index: 10; display: flex; align-items: center; gap: .45em; opacity: 0; pointer-events: none; transform: translateY(-.35em); transition: opacity 180ms ease, transform 180ms ease; }
        .board-controls.is-visible { opacity: .9; pointer-events: auto; transform: none; }
        .board-control { display: inline-flex; min-height: 2.05em; align-items: center; justify-content: center; border: 1px solid rgb(83 44 22 / .3); border-radius: 999px; background: rgb(255 249 231 / .92); padding: .28em .85em; color: #5c371c; font-size: .72em; font-weight: 800; text-decoration: none; box-shadow: 0 .25em .8em rgb(58 40 22 / .12); transition: background 160ms ease, transform 160ms ease; }
        .board-control:hover, .board-control:focus-visible { background: #fff; transform: translateY(-1px); }
        .board-control[aria-current='true'] { background: #5b3d86; color: #fff; border-color: #5b3d86; }
        .board-control--arrow { width: 2.05em; padding: 0; font-size: .9em; }
        .board-join-layout { position: absolute; top: 12%; right: 4%; bottom: 10%; left: 36%; display: grid; grid-template-columns: minmax(12em, 17em) minmax(0, 1fr); gap: clamp(.8em, 1.8vw, 2em); align-items: center; padding: 2.6em 2.75em 2em 2.25em; }
        .board-qr-column { display: flex; flex-direction: column; align-items: center; gap: .7em; min-width: 0; }
        .board-qr-tile { display: grid; aspect-ratio: 1; width: min(100%, 16em); place-items: center; border: .22em solid #e4c78d; border-radius: 1.2em; background: #fff; padding: .7em; box-shadow: 0 .65em 1.3em rgb(96 63 27 / .18); }
        .board-qr-tile > svg { width: 100%; height: 100%; }
        .board-qr-caption { margin: 0; color: #6f522d; font-size: 1.05em; font-weight: 800; text-align: center; }
        .board-join-copy { display: flex; min-width: 0; flex-direction: column; gap: .78em; }
        .board-join-title { margin: 0; color: #563a79; font-size: clamp(2.1em, 3.8vw, 4.2em); font-weight: 800; line-height: 1.08; letter-spacing: -.025em; }
        .board-room-sign { border: .18em solid #70421d; border-radius: .8em; background: linear-gradient(180deg, #d89a52 0%, #b97336 100%); padding: .45em .7em .55em; text-align: center; box-shadow: inset 0 .18em 0 rgb(255 255 255 / .35), 0 .35em 0 #70421d; }
        .board-room-label { margin: 0; color: #ffeecf; font-size: 1.05em; font-weight: 800; }
        .board-room-code { margin: 0; color: #fff9e9; font-family: var(--font-noto-sans-thai), sans-serif; font-size: clamp(4.2em, 6vw, 7em); font-weight: 900; line-height: .98; letter-spacing: .16em; text-indent: .16em; text-shadow: 0 .045em 0 #70421d; }
        .board-short-url { margin: 0; overflow-wrap: anywhere; color: #256a91; font-family: var(--font-noto-sans-thai), sans-serif; font-size: 1.22em; font-weight: 800; }
        .board-step-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .55em; margin: 0; padding: 0; list-style: none; }
        .board-step { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .45em; align-items: center; min-width: 0; border-radius: .8em; background: rgb(255 255 255 / .74); padding: .55em .6em; }
        .board-step-icon { width: 2.1em; height: 2.1em; object-fit: contain; }
        .board-step-title, .board-step-detail { display: block; overflow-wrap: anywhere; }
        .board-step-title { color: #4f3725; font-size: 1.02em; font-weight: 900; line-height: 1.15; }
        .board-step-detail { margin-top: .12em; color: #785b3c; font-size: .73em; font-weight: 700; line-height: 1.2; }
        .board-live-pill { align-self: flex-start; margin: .1em 0 0; border: 1px solid rgb(38 117 75 / .3); border-radius: 999px; background: rgb(228 249 235 / .94); padding: .35em .9em; color: #1c7045; font-size: 1em; font-weight: 900; }
        .board-live-pill.is-pulsing { animation: board-live-pulse 900ms ease-out; }
        @keyframes board-live-pulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgb(55 163 101 / .45); } 45% { transform: scale(1.06); box-shadow: 0 0 0 .5em rgb(55 163 101 / 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgb(55 163 101 / 0); } }
        .board-showcase-layout { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.45em; padding: 9em 5vw 4em; }
        .board-showcase-plaque { margin: 0; border: .16em solid #6b3f1d; border-radius: .7em; background: linear-gradient(180deg, #d99a55 0%, #b97639 100%); padding: .32em 1.1em .42em; color: #fff8e7; font-size: clamp(1.7em, 3vw, 3.3em); font-weight: 900; line-height: 1.1; box-shadow: 0 .28em 0 #6b3f1d, inset 0 .12em 0 rgb(255 255 255 / .35); text-align: center; text-shadow: 0 .04em 0 #6b3f1d; }
        .board-showcase-card { display: grid; grid-template-columns: minmax(0, 1fr) 11em; width: min(100%, 67em); min-height: min(48vh, 31em); align-items: center; gap: 1.5em; border: .18em solid #e2c58d; border-radius: 1.45em; background: rgb(255 250 239 / .94); padding: 2.2em 2.7em; box-shadow: 0 1em 2.5em rgb(75 47 22 / .2), inset 0 .12em 0 #fff; animation: board-card-in 420ms cubic-bezier(.16,1,.3,1); }
        @keyframes board-card-in { from { opacity: 0; transform: translateY(.6em) scale(.985); } to { opacity: 1; transform: none; } }
        .board-showcase-card__copy { min-width: 0; text-align: left; }
        .board-domain { margin: 0; overflow-wrap: anywhere; color: #5d4ab5; font-family: var(--font-noto-sans-thai), sans-serif; font-size: clamp(3em, 7vw, 7em); font-weight: 900; line-height: .98; letter-spacing: -.045em; background: linear-gradient(100deg, #5b3d91 8%, #236fc2 52%, #1b9b9d 92%); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .board-reason { margin: .8em 0 0; color: #5a483b; font-size: clamp(1.15em, 2.1vw, 2em); font-weight: 600; line-height: 1.35; }
        .board-nickname { margin: 1em 0 0; color: #8a6333; font-size: 1.05em; font-weight: 900; }
        .board-shop-art { width: 100%; max-height: 12em; object-fit: contain; }
        .board-empty { display: grid; width: min(100%, 58em); min-height: 19em; place-items: center; border: .18em solid #e2c58d; border-radius: 1.45em; background: rgb(255 250 239 / .94); padding: 2.5em; text-align: center; box-shadow: 0 1em 2.5em rgb(75 47 22 / .17); }
        .board-empty-title { margin: 0; color: #563a79; font-size: clamp(1.8em, 3.2vw, 3.1em); font-weight: 900; }
        .board-empty-detail { margin: .45em 0 0; color: #735d4c; font-size: 1.2em; font-weight: 700; }
        .board-dots { display: flex; gap: .5em; }
        .board-dot { width: .85em; height: .85em; border: .12em solid #664623; border-radius: 999px; background: rgb(255 255 255 / .72); padding: 0; }
        .board-dot.is-active { background: #664623; }
        @media (max-width: 900px) {
          .board-join-layout { left: 34%; right: 2%; grid-template-columns: minmax(10em, 14em) minmax(0, 1fr); gap: .8em; padding-inline: 1.25em; }
          .board-join-title { font-size: 2.25em; }
          .board-showcase-card { grid-template-columns: minmax(0, 1fr) 8em; padding: 1.5em; }
        }
        @media (max-width: 620px) {
          .board-controls { top: .65em; right: .65em; flex-wrap: wrap; justify-content: flex-end; max-width: 80vw; }
          .board-join-layout { top: 15%; right: 2%; bottom: 5%; left: 4%; grid-template-columns: 10em minmax(0, 1fr); overflow: auto; padding: 1.2em; }
          .board-join-title { font-size: 1.65em; }
          .board-room-code { font-size: 3.7em; }
          .board-step-list { grid-template-columns: 1fr; }
          .board-showcase-layout { padding: 5.5em 1em 2em; }
          .board-showcase-card { grid-template-columns: 1fr; min-height: 0; padding: 1.3em; text-align: center; }
          .board-showcase-card__copy { text-align: center; }
          .board-shop-art { max-height: 7em; order: -1; }
          .board-domain { font-size: 3.2em; }
        }
        @media (prefers-reduced-motion: reduce) {
          .board-controls, .board-control, .board-live-pill, .board-showcase-card { transition: none; animation: none; }
        }
      `}</style>

      <div className={`board-controls ${controlsVisible ? 'is-visible' : ''}`} aria-label="การควบคุมจอ">
        <Link href={`/board?${q}&mode=join`} aria-current={mode === 'join'} className="board-control">เข้าห้อง</Link>
        <Link href={`/board?${q}&mode=showcase`} aria-current={mode === 'showcase'} className="board-control">ผลงาน</Link>
        {mode === 'showcase' && works.length > 1 ? (
          <>
            <button type="button" onClick={goPrev} className="board-control board-control--arrow" aria-label="ผลงานก่อนหน้า">←</button>
            <button type="button" onClick={goNext} className="board-control board-control--arrow" aria-label="ผลงานถัดไป">→</button>
          </>
        ) : null}
        <button type="button" onClick={toggleFull} className="board-control">{full ? 'ออกจากเต็มจอ' : 'เต็มจอ'}</button>
        <Link href={backHref} className="board-control">กลับหน้าครู</Link>
      </div>

      {mode === 'join' ? (
        <main className="board-join-layout" aria-label="ชวนเข้าห้องเรียน">
          <div className="board-qr-column">
            <div role="img" aria-label="QR code เข้าห้อง" className="board-qr-tile" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="board-qr-caption">สแกนด้วยกล้องมือถือ</p>
          </div>
          <div className="board-join-copy">
            <h1 className="board-join-title">เข้าห้องเรียนกันเลย!</h1>
            <div className="board-room-sign">
              <p className="board-room-label">รหัสห้อง</p>
              <p className="board-room-code" aria-label={`รหัสห้อง ${roomCode.split('').join(' ')}`}>{roomCode}</p>
            </div>
            <p className="board-short-url">{joinUrl.replace(/^https?:\/\//, '')}</p>
            <ol className="board-step-list">
              {STEPS.map((step) => (
                <li key={step.n} className="board-step">
                  <img className="board-step-icon" src={`/icons/3d/${step.icon}.webp`} alt="" aria-hidden />
                  <span>
                    <span className="board-step-title">{step.title}</span>
                    <span className="board-step-detail">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className={`board-live-pill ${countPulse ? 'is-pulsing' : ''}`} aria-live="polite">
              {joined === null ? 'กำลังนับผู้เรียน...' : `เข้าห้องแล้ว ${joined} คน`}
            </p>
          </div>
        </main>
      ) : (
        <main className="board-showcase-layout" aria-label="ผลงานเด่นของห้องเรา">
          <h1 className="board-showcase-plaque">ผลงานเด่นของห้องเรา</h1>
          {activeWork ? (
            <article key={`${activeWork.domain}-${slide}`} className="board-showcase-card">
              <div className="board-showcase-card__copy">
                <p className="board-domain">{activeWork.domain}</p>
                {activeWork.reason ? <p className="board-reason">“{activeWork.reason}”</p> : null}
                {activeWork.nickname ? <p className="board-nickname">โดย {activeWork.nickname}</p> : null}
              </div>
              {activeWork.shopArt ? <img className="board-shop-art" src={activeWork.shopArt} alt="ภาพร้านของผลงานนี้" /> : <span aria-hidden />}
            </article>
          ) : (
            <div className="board-empty">
              <div>
                <p className="board-empty-title">ผลงานดี ๆ กำลังเดินทางมา</p>
                <p className="board-empty-detail">ครูปักหมุดผลงานแล้ว ภาพจะขึ้นที่จอนี้ทันที</p>
              </div>
            </div>
          )}
          {works.length > 1 ? (
            <div className="board-dots" aria-label={`ผลงานที่ ${(slide % works.length) + 1} จาก ${works.length}`}>
              {works.map((work, index) => (
                <button key={`${work.domain}-${index}`} type="button" aria-label={`ไปผลงานที่ ${index + 1}`} onClick={() => setSlide(index)} className={`board-dot ${index === slide % works.length ? 'is-active' : ''}`} />
              ))}
            </div>
          ) : null}
        </main>
      )}
    </div>
  )
}

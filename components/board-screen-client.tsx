'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * จอหน้าห้อง (โปรเจกเตอร์) แบบเรียนด้วยตนเอง — ไม่พึ่ง API ควบคุมคาบสด
 * โหมด join = ชวนเข้าห้อง (QR + รหัส + 3 ขั้นตอน + จำนวนคนที่เข้าแล้ว)
 * โหมด showcase = สไลด์ผลงานที่ครูปักหมุด (ไม่มีดาว ไม่มีคะแนน · ซ่อนชื่อตามที่ครูเลือก)
 *
 * ขนาดทุกอย่างอิงหน่วย `--u` = 1/54 ของความสูงจอ → 1080p = 20px, 720p = 13.3px หน้าตาเหมือนกันทุกจอ
 * ภาพพื้นหลังต้องไม่มีรหัส/QR (วาดทับด้วย HTML เสมอ)
 */
const POLL_MS = 10_000
const SLIDE_MS = 9_000

interface Work { domain: string; reason: string; nickname: string | null }

const STEPS = [
  { n: 1, t: 'สแกน QR', d: 'หรือเข้าเว็บตามลิงก์ด้านล่าง' },
  { n: 2, t: 'ใส่รหัสห้อง', d: 'รหัส 6 ตัวบนป้ายไม้' },
  { n: 3, t: 'ตั้งชื่อเล่นและ PIN', d: 'PIN 4 หลักไว้กลับเข้าห้อง' },
]

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
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/projector?classroomId=${classroomId}`, { cache: 'no-store' })
      if (!res.ok) return
      const d = (await res.json()) as { joined: number; showcase: Work[] }
      setJoined(d.joined)
      setWorks(d.showcase)
    } catch {
      // จอหน้าห้องห้ามขึ้น error กลางคาบ รอบถัดไปค่อยลองใหม่
    }
  }, [classroomId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (mode !== 'showcase' || works.length < 2) return
    const id = setInterval(() => setSlide((s) => (s + 1) % works.length), SLIDE_MS)
    return () => clearInterval(id)
  }, [mode, works.length])

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const q = `classroomId=${classroomId}`
  const bg = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {
        background:
          'radial-gradient(circle at 18% 22%, #fff8 0 6%, transparent 6.5%), radial-gradient(circle at 80% 14%, #fff7 0 5%, transparent 5.5%), linear-gradient(180deg, #7cc8f2 0%, #bfe8fb 52%, #e9f8ff 62%, #3a9fcf 62.2%, #1f7fb3 100%)',
      }

  const ctl =
    'rounded-full border-2 border-[#7a4a1e] bg-[#fff6e0]/90 px-[1em] py-[0.35em] text-[0.75em] font-bold text-[#5b3611] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2'

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 overflow-hidden text-[#3b2a14]"
      style={{ ...bg, ['--u' as string]: '1.8518vh', fontSize: 'var(--u)', ...display }}
    >
      {/* ปุ่มควบคุมของครู — เล็ก มุมบนขวา */}
      <div className="absolute top-[1em] right-[1.2em] z-10 flex gap-[0.6em] opacity-80 hover:opacity-100 focus-within:opacity-100">
        <Link href={`/board?${q}&mode=join`} aria-current={mode === 'join'} className={`${ctl} ${mode === 'join' ? 'ring-2 ring-[#7a4a1e]' : ''}`}>ชวนเข้าห้อง</Link>
        <Link href={`/board?${q}&mode=showcase`} aria-current={mode === 'showcase'} className={`${ctl} ${mode === 'showcase' ? 'ring-2 ring-[#7a4a1e]' : ''}`}>ผลงานเด่น</Link>
        <button type="button" onClick={toggleFull} className={ctl}>{full ? 'ออกจากเต็มจอ' : 'เต็มจอ'}</button>
        <Link href={backHref} className={ctl}>กลับหน้าครู</Link>
      </div>

      {mode === 'join' ? (
        <main className="absolute inset-0 grid place-items-center p-[3em]">
          <div
            className="grid w-full max-w-[86em] grid-cols-[26em_1fr] items-center gap-[3em] rounded-[2em] border-[0.25em] border-[#e3c98f] bg-[#fff6e0] p-[2.6em] shadow-[0_1.2em_3em_rgb(20_60_90/0.35)]"
          >
            {/* QR */}
            <div className="flex flex-col items-center gap-[1em]">
              <div
                role="img"
                aria-label="QR code เข้าห้อง"
                className="aspect-square w-full rounded-[1.2em] border-[0.2em] border-[#e3c98f] bg-white p-[0.9em] [&>svg]:h-full [&>svg]:w-full"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="m-0 text-[1.1em] font-bold text-[#7a5a2b]">สแกนด้วยกล้องมือถือ</p>
            </div>

            <div className="flex min-w-0 flex-col gap-[1.4em]">
              <h1 className="m-0 text-[2.6em] leading-tight font-bold text-[#5b3611]">ชวนเข้าห้อง CEO Domain Quest</h1>

              {/* ป้ายไม้รหัสห้อง */}
              <div
                className="rounded-[1.1em] border-[0.22em] border-[#6b3f16] px-[1em] py-[0.5em] text-center shadow-[inset_0_0.2em_0_rgb(255_255_255/0.25),0_0.5em_0_#6b3f16]"
                style={{ background: 'linear-gradient(180deg,#d39a55,#b9803f)' }}
              >
                <p className="m-0 text-[1em] font-semibold text-[#fff1d6]">รหัสห้อง</p>
                <p
                  className="m-0 text-[7.4em] leading-[1.05] font-bold tracking-[0.14em] text-[#fffaf0] [text-shadow:0_0.04em_0_#5b3611]"
                  aria-label={`รหัสห้อง ${roomCode.split('').join(' ')}`}
                >
                  {roomCode}
                </p>
              </div>

              <p className="m-0 text-[1.5em] font-bold break-all text-[#2d6f98]">{joinUrl.replace(/^https?:\/\//, '')}</p>

              <ol className="m-0 grid list-none grid-cols-3 gap-[1em] p-0">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex flex-col gap-[0.3em] rounded-[1em] bg-white/80 p-[0.9em]">
                    <span className="grid size-[2em] place-items-center rounded-full bg-[#2d6f98] text-[1.3em] font-bold text-white">{s.n}</span>
                    <span className="text-[1.3em] leading-tight font-bold">{s.t}</span>
                    <span className="text-[0.95em] text-[#6b5530]">{s.d}</span>
                  </li>
                ))}
              </ol>

              <p className="m-0 text-[1.4em] font-bold text-[#3f7a45]" aria-live="polite">
                {joined === null ? 'กำลังนับ…' : `เข้าห้องแล้ว ${joined} คน`}
              </p>
            </div>
          </div>
        </main>
      ) : (
        <main className="absolute inset-0 flex flex-col items-center justify-center gap-[1.6em] p-[3.5em]">
          <h1 className="m-0 rounded-[0.6em] border-[0.2em] border-[#6b3f16] px-[1.2em] py-[0.2em] text-[2.6em] font-bold text-[#fffaf0] shadow-[0_0.3em_0_#6b3f16]" style={{ background: 'linear-gradient(180deg,#d39a55,#b9803f)' }}>
            ผลงานเด่นของห้องเรา
          </h1>
          {works.length === 0 ? (
            <div className="rounded-[2em] border-[0.25em] border-[#e3c98f] bg-[#fff6e0] px-[3em] py-[2.5em] text-center">
              <p className="m-0 text-[2.2em] font-bold">ครูยังไม่ได้ปักหมุดผลงาน</p>
              <p className="m-0 mt-[0.4em] text-[1.2em] text-[#6b5530]">ปักหมุดที่หน้า ผลงานเด่น ของครู แล้วผลงานจะขึ้นที่นี่</p>
            </div>
          ) : (
            <>
              <article
                key={slide}
                className="w-full max-w-[64em] rounded-[2em] border-[0.25em] border-[#e3c98f] bg-[#fff6e0] px-[3em] py-[2.4em] text-center shadow-[0_1.2em_3em_rgb(20_60_90/0.35)]"
              >
                <p className="m-0 text-[5.2em] leading-tight font-bold break-all text-[#2d6f98]">{works[slide % works.length]!.domain}</p>
                {works[slide % works.length]!.reason ? (
                  <p className="m-0 mt-[0.6em] text-[1.9em] leading-snug">“{works[slide % works.length]!.reason}”</p>
                ) : null}
                {works[slide % works.length]!.nickname ? (
                  <p className="m-0 mt-[0.8em] text-[1.3em] font-bold text-[#7a5a2b]">โดย {works[slide % works.length]!.nickname}</p>
                ) : null}
              </article>
              {works.length > 1 ? (
                <div className="flex gap-[0.6em]" aria-label={`ผลงานที่ ${(slide % works.length) + 1} จาก ${works.length}`}>
                  {works.map((_, i) => (
                    <button key={i} type="button" aria-label={`ไปผลงานที่ ${i + 1}`} onClick={() => setSlide(i)} className={`size-[1em] rounded-full border-2 border-[#5b3611] ${i === slide % works.length ? 'bg-[#5b3611]' : 'bg-white/70'}`} />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </main>
      )}
    </div>
  )
}

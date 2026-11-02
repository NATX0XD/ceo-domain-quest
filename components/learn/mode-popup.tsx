'use client'

import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { LearnModeId } from './learn-path-api'

/**
 * ป๊อปอัปเลือกวิธีเรียน (ดู / อ่าน / ลงมือทำ) — ดีไซน์ UI/ภารกิจที่ 1/popup.png
 * ⚠️ วิธีที่แนะนำเป็นแค่ข้อเสนอ ทุกการ์ดกดเลือกได้เสมอ
 */

const MODES: {
  id: LearnModeId
  title: string
  lines: [string, string]
  icon: string
  tint: string
  ring: string
  text: string
}[] = [
  {
    id: 'watch',
    title: 'ดู',
    lines: ['วิดีโอสถานการณ์', 'เข้าใจง่าย'],
    icon: '/ui/mode/icon-watch.webp',
    tint: '#dffce4',
    ring: '#22a45d',
    text: '#12633a',
  },
  {
    id: 'read',
    title: 'อ่าน',
    lines: ['เรื่องราวและเนื้อหา', 'สรุปชัดเจน'],
    icon: '/ui/mode/icon-read.webp',
    tint: '#f0e2fc',
    ring: '#7c4dd6',
    text: '#3a1a6e',
  },
  {
    id: 'do',
    title: 'ลงมือทำ',
    lines: ['กิจกรรมแบบโต้ตอบ', 'ลองจัดการเอง'],
    icon: '/ui/mode/icon-do.webp',
    tint: '#fdf3bb',
    ring: '#e0a400',
    text: '#5a3d00',
  },
]

const DOME_H = 'clamp(130px,38vw,210px)'
const FADE_EDGES = 'radial-gradient(ellipse 75% 80% at 50% 45%, #000 70%, transparent 100%)'

export interface ModePopupProps {
  missionNo: string
  title: string
  recommended: LearnModeId | null
  reason?: string
  picked: LearnModeId | null
  busy?: boolean
  error?: string | null
  onPick: (m: LearnModeId) => void
  onStart: () => void
  onClose: () => void
  /** The same component is used on the map and while changing mode in a mission. */
  presentation?: 'drawer' | 'modal'
}

export function ModePopup({
  missionNo,
  title,
  recommended,
  reason,
  picked,
  busy,
  error,
  onPick,
  onStart,
  onClose,
  presentation = 'drawer',
}: ModePopupProps) {
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const spring = { type: 'spring' as const, stiffness: 320, damping: 26 }

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pickedInfo = MODES.find((m) => m.id === picked)

  const drawer = presentation === 'drawer'
  // ทุกภารกิจใช้กรอบภาพทางการเดียวกัน ข้อความเฉพาะภารกิจวางเป็นข้อความสดทับ
  const officialM1 = drawer

  return (
    <motion.div
      className={
        drawer
          ? 'fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-[#21150f]/20 p-0'
          : 'fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-[#1d0f3a]/85 px-3 pb-4 pt-6 backdrop-blur-xl sm:items-center'
      }
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onTouchStart={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0.01 : 0.2 }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-popup-title"
        className={
          officialM1
            ? 'relative mt-auto w-full max-w-[720px]'
            : drawer
            ? 'relative mt-auto w-full max-w-[720px] max-h-[min(92dvh,780px)] overflow-y-auto rounded-t-[30px] pt-[clamp(116px,31vw,190px)]'
            : 'relative my-auto w-full max-w-[560px] pt-[clamp(130px,38vw,210px)]'
        }
        drag={drawer ? 'y' : false}
        dragConstraints={drawer ? { top: 0, bottom: 520 } : undefined}
        dragElastic={drawer ? 0.18 : undefined}
        onDragEnd={
          drawer
            ? (_event, info) => {
                if (info.offset.y > 100 || info.velocity.y > 700) onClose()
              }
            : undefined
        }
        initial={reduce ? false : { opacity: 0, scale: 0.88, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reduce ? { duration: 0.01 } : spring}
      >
        {drawer ? (
          <span
            className="absolute left-1/2 top-2 z-20 h-1.5 w-14 -translate-x-1/2 rounded-full bg-[#8f775e]/55"
            aria-hidden="true"
          />
        ) : null}
        {!officialM1 ? (
          <motion.div
            className="pointer-events-none absolute left-0 top-0 z-0 flex w-full items-end"
            style={{ height: DOME_H }}
            initial={reduce ? false : { y: 46, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reduce ? { duration: 0.01 } : { ...spring, delay: 0.12 }}
          >
            <div
              className="relative shrink-0 overflow-hidden"
              style={{ height: DOME_H, width: `calc(${DOME_H} * 0.8)`, marginLeft: '2%' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- มาสคอตทางการ โผล่แค่ครึ่งบนเหนือขอบการ์ด */}
              <img
                src="/dome/mascot/dome-greet.webp"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute left-0 top-0 max-w-none select-none"
                style={{ height: `calc(${DOME_H} * 1.62)`, width: 'auto' }}
              />
            </div>
            <div className="relative mb-[22%] ml-[-9%] min-w-0 flex-1 self-center sm:mb-[14%]">
              <motion.p
                className="relative rounded-[28px] border-2 border-[#c9b6f0] bg-[#f4edff] px-3 py-2 text-center text-[clamp(12px,3.6vw,18px)] font-extrabold leading-snug text-[#3a1a6e] shadow-[0_6px_14px_rgba(60,30,110,0.22)]"
                initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0.01 } : { ...spring, delay: 0.3 }}
                style={{ transformOrigin: 'left center' }}
              >
                เลือกวิธีเรียนที่ถนัด
                <br />
                แล้วไปลุยภารกิจที่ {missionNo} กันเลย!
                <span
                  aria-hidden="true"
                  className="absolute -left-[7px] top-1/2 size-3.5 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-[#c9b6f0] bg-[#f4edff]"
                />
              </motion.p>
            </div>
          </motion.div>
        ) : null}
        {/* ภารกิจแรกมีภาพตัดจาก UI/ เป็น visual source of truth; ปุ่มด้านบนยังเป็น HTML เพื่อเลือก/อ่านด้วยแป้นพิมพ์ได้ */}
        {officialM1 ? (
          <OfficialModeArtwork
            missionNo={missionNo}
            title={title}
            picked={picked}
            recommended={recommended}
            busy={busy}
            error={error}
            onPick={onPick}
            onStart={onStart}
            onClose={onClose}
          />
        ) : (
        <div className="relative z-10 rounded-[28px] bg-[#fcf6eb] px-3 pb-4 pt-5 shadow-[0_18px_40px_rgba(30,10,60,0.4),inset_0_2px_0_rgba(255,255,255,0.9)] ring-1 ring-[#f1e3cb] sm:px-6 sm:pb-6">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="ปิดและกลับไปแผนที่"
            className="absolute right-2.5 top-2.5 grid size-11 place-items-center rounded-full bg-[#f1ebe0] text-[#5b5470] shadow-[0_3px_8px_rgba(60,40,20,0.2)] ring-1 ring-white/80 transition-transform active:scale-90"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div className="flex flex-col items-center px-10 text-center">
            <span className="rounded-full bg-gradient-to-b from-[#45d98a] to-[#22b265] px-5 py-1 text-[clamp(14px,4vw,20px)] font-extrabold text-white shadow-[0_3px_0_#168a4c]">
              ภารกิจที่ {missionNo}
            </span>
            <h2
              id="mode-popup-title"
              className="relative mt-2 text-balance font-display text-[clamp(22px,7vw,36px)] font-extrabold leading-tight text-[#2f1659]"
            >
              <Spark className="-left-5 top-1 -rotate-12" />
              {title}
              <Spark className="-right-5 top-1 rotate-12 -scale-x-100" />
            </h2>
            <p className="mt-1 text-[clamp(12px,3.4vw,16px)] font-semibold text-[#5b4a82]">
              เลือกวิธีเรียนที่ชอบได้เลย เปลี่ยนได้ภายหลัง
            </p>
          </div>

          <div role="radiogroup" aria-label="เลือกวิธีเรียน" className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            {MODES.map((m, i) => {
              const on = picked === m.id
              const rec = recommended === m.id
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${m.title}${rec ? ' (แนะนำ)' : ''} ${m.lines.join(' ')}`}
                  onClick={() => onPick(m.id)}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0.01 } : { ...spring, delay: 0.2 + i * 0.06 }}
                  whileTap={reduce ? undefined : { scale: 0.96 }}
                  className="relative flex h-full min-w-0 flex-col items-center rounded-[20px] px-1 pb-2.5 pt-3.5 text-center outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-[#7c4dd6]/50"
                  style={{
                    backgroundColor: m.tint,
                    boxShadow: on
                      ? `0 0 0 3px ${m.ring}, 0 6px 14px rgba(40,20,80,0.2)`
                      : '0 0 0 1.5px rgba(0,0,0,0.06), 0 3px 8px rgba(40,20,80,0.1)',
                    color: m.text,
                  }}
                >
                  {rec ? (
                    <span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold leading-none text-white shadow-sm"
                      style={{ backgroundColor: '#f26b1d' }}
                    >
                      แนะนำ
                    </span>
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D ตัดจากดีไซน์ */}
                  <span className="flex h-[clamp(52px,16vw,84px)] w-full items-center justify-center">
                    <img
                      src={m.icon}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="h-full w-auto max-w-full select-none object-contain"
                      style={{ WebkitMaskImage: FADE_EDGES, maskImage: FADE_EDGES }}
                    />
                  </span>
                  <span className="mt-0.5 font-display text-[clamp(18px,5.6vw,28px)] font-extrabold leading-tight">
                    {m.title}
                  </span>
                  <span className="mt-0.5 min-h-[2.7em] text-[clamp(10px,2.9vw,14px)] font-medium leading-snug opacity-85">
                    {m.lines[0]}
                    <br />
                    {m.lines[1]}
                  </span>
                  <span className="h-2 shrink-0" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className="mt-auto grid size-[clamp(22px,6.5vw,30px)] place-items-center rounded-full border-[3px] bg-white"
                    style={{ borderColor: on ? m.ring : '#b9b4c4' }}
                  >
                    {on ? <span className="size-[55%] rounded-full" style={{ backgroundColor: m.ring }} /> : null}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {reason ? <p className="sr-only">{reason}</p> : null}
          {error ? (
            <p role="alert" className="mt-2 text-center text-[13px] font-bold text-[#b42318]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onStart}
            disabled={!picked || busy}
            aria-label={pickedInfo ? `เริ่มภารกิจที่ ${missionNo} แบบ${pickedInfo.title}` : 'เลือกวิธีเรียนก่อน'}
            className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ff9a3d] to-[#f26b1d] px-4 text-[clamp(18px,5.4vw,26px)] font-extrabold text-white shadow-[0_5px_0_#c24f0d,0_10px_18px_rgba(194,79,13,0.35)] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#c24f0d] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? (
              'กำลังบันทึก'
            ) : picked ? (
              <>
                เริ่มภารกิจที่ {missionNo}
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
              </>
            ) : (
              'เลือกวิธีเรียนก่อน'
            )}
          </button>
        </div>
        )}
      </motion.section>
    </motion.div>
  )
}

function OfficialModeArtwork({
  missionNo,
  title,
  picked,
  recommended,
  busy,
  error,
  onPick,
  onStart,
  onClose,
}: Omit<ModePopupProps, 'presentation' | 'reason'>) {
  return (
    <div className="relative aspect-[1122/1402] w-full max-w-[720px] select-none [container-type:inline-size]" aria-label={`เลือกวิธีเรียนสำหรับภารกิจที่ ${missionNo}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ภาพทางการจาก UI/ ที่ลบข้อความเฉพาะภารกิจ 1 ออกแล้ว */}
      <img src="/ui/mode/official-popup-blank.webp" alt="" aria-hidden="true" draggable={false} className="absolute inset-0 size-full object-contain" />
      <p aria-hidden="true" className="absolute left-[53.7%] top-[17%] grid h-[9.3%] w-[39.6%] place-items-center text-center text-[3.3cqw] font-extrabold leading-[1.3] text-[#2d1a5e]">
        <span>เลือกวิธีเรียนที่ถนัด<br />แล้วไปลุยภารกิจที่ {missionNo} กันเลย!</span>
      </p>
      <p aria-hidden="true" className="absolute left-[37.3%] top-[35.9%] grid h-[4.8%] w-[25.6%] place-items-center text-[3.6cqw] font-extrabold text-white [text-shadow:0_1px_0_#15803d]">
        ภารกิจที่ {missionNo}
      </p>
      <h2 id="mode-popup-title" className="absolute left-[18.9%] top-[41.7%] grid h-[7.6%] w-[62.2%] place-items-center text-center text-[5.2cqw] font-extrabold leading-tight text-balance text-[#2a1458]">
        {title}
      </h2>
      <button type="button" onClick={onClose} aria-label="ปิดและกลับไปแผนที่" className="absolute right-[3.2%] top-[34%] size-[10%] rounded-full bg-transparent" style={{ background: 'transparent', border: 0 }} />
      <div role="radiogroup" aria-label="เลือกวิธีเรียน" className="absolute inset-x-[6.5%] top-[55%] grid h-[28%] grid-cols-3 gap-[1.5%]">
        {MODES.map((mode) => {
          const selected = picked === mode.id
          const rec = recommended === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${mode.title}${rec ? ' (แนะนำ)' : ''} ${mode.lines.join(' ')}`}
              onClick={() => onPick(mode.id)}
              className="relative rounded-[20%] bg-transparent outline-none focus-visible:ring-4 focus-visible:ring-[#7c4dd6]/70"
              style={{ background: 'transparent', border: 0 }}
            >
              {rec ? <span className="absolute -top-[8%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f26b1d] px-2 py-0.5 text-[clamp(9px,2.5vw,15px)] font-extrabold text-white shadow-sm">แนะนำ</span> : null}
              <span aria-hidden="true" className={`absolute bottom-[4%] left-1/2 size-[11%] -translate-x-1/2 rounded-full border-[3px] border-[#8f8f8f] bg-white ${selected ? 'ring-4 ring-white/80' : ''}`}>
                {selected ? <span className="absolute inset-[22%] rounded-full bg-[#7c4dd6]" /> : null}
              </span>
            </button>
          )
        })}
      </div>
      {error ? <p role="alert" className="absolute inset-x-[12%] top-[84%] text-center text-[clamp(10px,2.8vw,16px)] font-bold text-[#b42318]">{error}</p> : null}
      <button
        type="button"
        onClick={onStart}
        disabled={!picked || busy}
        aria-label={picked ? `เริ่มภารกิจที่ ${missionNo} แบบ${MODES.find((m) => m.id === picked)?.title}` : 'เลือกวิธีเรียนก่อน'}
        className="absolute inset-x-[6.5%] bottom-[4%] h-[10%] rounded-full bg-transparent text-[4.6cqw] font-extrabold text-white outline-none [text-shadow:0_2px_0_#c2410c] focus-visible:ring-4 focus-visible:ring-[#7c4dd6]/70 disabled:cursor-not-allowed"
        style={{ background: 'transparent', border: 0 }}
      >
        {busy ? 'กำลังบันทึก' : `เริ่มภารกิจที่ ${missionNo} →`}
      </button>
    </div>
  )
}

function Spark({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`absolute size-5 text-[#f6c026] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <path d="M4 16l5-2M6 7l5 3M13 3l1 5" />
    </svg>
  )
}

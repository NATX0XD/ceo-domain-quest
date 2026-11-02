'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  enabledModes?: readonly LearnModeId[]
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
  enabledModes = ['watch', 'read', 'do'],
  presentation = 'drawer',
}: ModePopupProps) {
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const spring = { type: 'spring' as const, stiffness: 320, damping: 26 }

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pickedInfo = MODES.find((m) => m.id === picked)
  const visibleModes = MODES.filter((mode) => enabledModes.includes(mode.id))

  const drawer = presentation === 'drawer'
  // ทุกภารกิจใช้กรอบภาพทางการเดียวกัน ข้อความเฉพาะภารกิจวางเป็นข้อความสดทับ
  const officialM1 = drawer

  const popup = (
    <motion.div
      className={
        drawer
          ? 'fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto overscroll-contain bg-[#1b1030]/55 p-0'
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
        initial={reduce ? false : drawer ? { y: '100%' } : { opacity: 0, scale: 0.88, y: 28 }}
        animate={drawer ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        transition={reduce ? { duration: 0.01 } : drawer ? { type: 'spring', stiffness: 300, damping: 32 } : spring}
      >
        {drawer && !officialM1 ? (
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
            enabledModes={enabledModes}
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
            {visibleModes.map((m) => (
              <ModeCard
                key={m.id}
                mode={m}
                selected={picked === m.id}
                dimmed={picked !== null && picked !== m.id}
                recommended={recommended === m.id}
                onPick={onPick}
              />
            ))}
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

  return drawer && portalTarget ? createPortal(popup, portalTarget) : popup
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
  enabledModes = ['watch', 'read', 'do'],
}: Omit<ModePopupProps, 'presentation' | 'reason'>) {
  const visibleModes = MODES.filter((mode) => enabledModes.includes(mode.id))
  return (
    // กรอบทางการตัดขอบล่าง (ปุ่มส้มในภาพ) ออก แล้วต่อพื้นครีมลงถึงขอบจอ = ลิ้นชักล่างจริง ปุ่มเริ่มเป็น HTML มีระยะหายใจ
    <div className="relative w-full max-w-[720px] select-none [container-type:inline-size]" aria-label={`เลือกวิธีเรียนสำหรับภารกิจที่ ${missionNo}`}>
      <div className="relative z-10 aspect-[1122/1190] w-full">
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[1122/1402]">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[84.88%] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- ภาพทางการจาก UI/ ที่ลบข้อความเฉพาะภารกิจ 1 ออกแล้ว */}
            <img src="/ui/mode/official-popup-blank.webp" alt="" draggable={false} className="absolute left-0 top-0 h-auto w-full max-w-none" />
          </div>
          <span aria-hidden="true" className="absolute left-1/2 top-[33.6%] h-[1.1%] w-[13%] -translate-x-1/2 rounded-full bg-[#8f775e]/45" />
          <p aria-hidden="true" className="absolute left-[53.7%] top-[17%] grid h-[9.3%] w-[39.6%] place-items-center text-center text-[3.3cqw] font-extrabold leading-[1.3] text-[#2d1a5e]">
            <span>เลือกวิธีเรียนที่ถนัด<br />แล้วไปลุยภารกิจที่ {missionNo} กันเลย!</span>
          </p>
          <p aria-hidden="true" className="absolute left-[37.3%] top-[35.9%] grid h-[4.8%] w-[25.6%] place-items-center text-[3.6cqw] font-extrabold text-white [text-shadow:0_1px_0_#15803d]">
            ภารกิจที่ {missionNo}
          </p>
          <h2 id="mode-popup-title" className="absolute left-[18.9%] top-[41.7%] grid h-[7.6%] w-[62.2%] place-items-center text-center text-[5.2cqw] font-extrabold leading-tight text-balance text-[#2a1458]">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="ปิดและกลับไปแผนที่" className="pointer-events-auto absolute right-[3.2%] top-[34%] size-[10%] rounded-full bg-transparent" style={{ background: 'transparent', border: 0 }} />
          {/* ปิดการ์ดในภาพ (มีวงกลม radio ที่ดูเหมือนเลข 0) แล้ววางการ์ด HTML ที่เห็นชัดว่าเลือกอันไหนอยู่ */}
          <div aria-hidden="true" className="absolute inset-x-[5.4%] top-[52.6%] h-[32.28%] rounded-t-[4cqw] bg-[#fdf6ea]" />
          <div role="radiogroup" aria-label="เลือกวิธีเรียน" className="pointer-events-auto absolute inset-x-[6.2%] top-[55.6%] grid h-[28.2%] grid-cols-3 gap-[2.2cqw]">
            {visibleModes.map((mode) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                selected={picked === mode.id}
                dimmed={picked !== null && picked !== mode.id}
                recommended={recommended === mode.id}
                onPick={onPick}
                scaled
              />
            ))}
          </div>
        </div>
      </div>
      <div className="relative z-0 mx-[2.85%] -mt-px flex flex-col gap-2 bg-[#fdf3e6] px-[3.6%] pb-[calc(20px+env(safe-area-inset-bottom))] pt-[20px] shadow-[inset_2px_0_0_#efe2cc,inset_-2px_0_0_#efe2cc]">
        {error ? <p role="alert" className="text-center text-[clamp(12px,3.2vw,16px)] font-bold text-[#b42318]">{error}</p> : null}
        <button
          type="button"
          onClick={onStart}
          disabled={!picked || busy}
          aria-label={picked ? `เริ่มภารกิจที่ ${missionNo} แบบ${MODES.find((m) => m.id === picked)?.title}` : 'เลือกวิธีเรียนก่อน'}
          className="flex min-h-14 w-full items-center justify-center rounded-full border-0 bg-gradient-to-b from-[#ffa047] to-[#f2661a] px-4 text-[clamp(18px,5.2cqw,28px)] font-extrabold leading-none text-white shadow-[0_5px_0_#c24f0d,0_10px_18px_rgba(194,79,13,0.3)] outline-none [text-shadow:0_2px_0_#c2410c] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#c24f0d] focus-visible:ring-4 focus-visible:ring-[#7c4dd6]/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'กำลังบันทึก' : `เริ่มภารกิจที่ ${missionNo} →`}
        </button>
      </div>
    </div>
  )
}

type ModeInfo = (typeof MODES)[number]

/** การ์ดวิธีเรียน — เลือกแล้วลอยขึ้น มีวงแสงสีของการ์ด + ป้ายติ๊ก ส่วนใบที่ไม่ได้เลือกจางลง */
function ModeCard({
  mode,
  selected,
  dimmed,
  recommended,
  onPick,
  scaled = false,
}: {
  mode: ModeInfo
  selected: boolean
  dimmed: boolean
  recommended: boolean
  onPick: (m: LearnModeId) => void
  /** อยู่บนภาพทางการ = ขนาดตัวอักษรตามความกว้างกรอบ (cqw) */
  scaled?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${mode.title}${recommended ? ' (แนะนำ)' : ''} ${mode.lines.join(' ')}${selected ? ' เลือกอยู่' : ''}`}
      onClick={() => onPick(mode.id)}
      animate={reduce ? undefined : { y: selected ? -5 : 0, scale: selected ? 1.03 : dimmed ? 0.96 : 1 }}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      className="relative flex h-full min-w-0 flex-col items-center rounded-[18px] border-0 px-1 pb-2 pt-3 text-center outline-none focus-visible:ring-4 focus-visible:ring-[#7c4dd6]/60"
      style={{
        backgroundColor: mode.tint,
        color: mode.text,
        opacity: dimmed ? 0.62 : 1,
        filter: dimmed ? 'saturate(0.55)' : undefined,
        boxShadow: selected
          ? `0 0 0 4px ${mode.ring}, 0 0 0 8px ${mode.ring}33, 0 14px 24px ${mode.ring}66`
          : '0 0 0 1.5px rgba(60,40,20,0.10), 0 3px 8px rgba(40,20,80,0.10)',
      }}
    >
      {recommended ? (
        <span
          className={`absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f26b1d] px-2 py-0.5 font-extrabold leading-none text-white shadow-sm ${scaled ? 'text-[2.4cqw]' : 'text-[11px]'}`}
        >
          แนะนำ
        </span>
      ) : null}
      {selected ? (
        <motion.span
          aria-hidden="true"
          initial={reduce ? false : { scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className={`absolute -right-2 -top-2 z-10 grid place-items-center rounded-full border-[3px] border-white text-white shadow-[0_3px_8px_rgba(0,0,0,0.25)] ${scaled ? 'size-[8cqw]' : 'size-8'}`}
          style={{ backgroundColor: mode.ring }}
        >
          <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </motion.span>
      ) : null}
      <span className={`flex w-full items-center justify-center ${scaled ? 'h-[40%]' : 'h-[clamp(52px,16vw,84px)]'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D ตัดจากดีไซน์ */}
        <img
          src={mode.icon}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-full w-auto max-w-full select-none object-contain"
          style={{ WebkitMaskImage: FADE_EDGES, maskImage: FADE_EDGES }}
        />
      </span>
      <span className={`mt-0.5 font-display font-extrabold leading-tight ${scaled ? 'text-[5.6cqw]' : 'text-[clamp(18px,5.6vw,28px)]'}`}>
        {mode.title}
      </span>
      <span className={`mt-0.5 font-medium leading-snug opacity-85 ${scaled ? 'text-[2.7cqw]' : 'text-[clamp(10px,2.9vw,14px)]'}`}>
        {mode.lines[0]}
        <br />
        {mode.lines[1]}
      </span>
    </motion.button>
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

'use client'
/* eslint-disable @next/next/no-img-element -- ภาพโดมเป็น asset นิ่งของ kit2 */

import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from '@/components/ui'
import './mission-revisit.css'

/**
 * เปิดภารกิจที่ผ่านแล้วซ้ำ — ถามก่อนว่าจะ "ดูผลลัพธ์" หรือ "เล่นใหม่"
 *
 * เล่นใหม่ = เปิดเส้นทางเรียนของภารกิจนั้นอีกรอบที่ `/mission/<id>?replay=1`
 * ผลรอบใหม่บันทึกเป็นแถวใหม่ เซิร์ฟเวอร์เก็บค่าที่ดีที่สุดไว้ ดาวที่ได้แล้วไม่ลด
 *
 * เล่นซ้ำจบแล้วกลับมาที่จอผล = ไม่ต้องถามซ้ำ (ธงใน sessionStorage ที่ `ReplayMarker` ตั้งไว้)
 */

const REPLAY_FLAG_TTL_MS = 2 * 60 * 60 * 1000

function flagKey(studentId: string, missionId: string) {
  return `mission-replay:${studentId}:${missionId}`
}

/** ตั้งธง "กำลังเล่นซ้ำ" — เรนเดอร์คู่กับจอเล่นซ้ำ ไม่มีอะไรบนจอ */
export function ReplayMarker({ studentId, missionId }: { studentId: string; missionId: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(flagKey(studentId, missionId), String(Date.now()))
      // เริ่มรอบใหม่จริง ๆ — ไม่ดึงตำแหน่งที่ค้างจากรอบก่อนกลับมา
      sessionStorage.removeItem(`learn-flow:${studentId}:${missionId}`)
    } catch {
      /* ไม่มี sessionStorage = กลับมาแล้วถามซ้ำอีกครั้ง ไม่เสียหาย */
    }
  }, [studentId, missionId])
  return null
}

/** อ่านแล้วล้างธง — true = เพิ่งเล่นซ้ำจบ ไม่ต้องเด้งถาม */
function consumeReplayFlag(studentId: string, missionId: string): boolean {
  try {
    const raw = sessionStorage.getItem(flagKey(studentId, missionId))
    if (!raw) return false
    sessionStorage.removeItem(flagKey(studentId, missionId))
    return Date.now() - Number(raw) < REPLAY_FLAG_TTL_MS
  } catch {
    return false
  }
}

/** เปิดกล่องถามเมื่อเข้าภารกิจที่ผ่านแล้ว (ครั้งเดียวตอนเปิดหน้า) */
export function useRevisitPrompt({
  studentId,
  missionId,
  passedOnLoad,
}: {
  studentId: string
  missionId: string
  passedOnLoad: boolean
}) {
  const [open, setOpen] = useState(false)
  // ตัดสินครั้งเดียวต่อการเปิดหน้า — StrictMode เรียก effect ซ้ำ ถ้าอ่านธงซ้ำจะเห็นว่าธงหายไปแล้วและเด้งถามผิด
  const decided = useRef<boolean | null>(null)
  useEffect(() => {
    if (decided.current === null) {
      decided.current =
        passedOnLoad &&
        new URLSearchParams(window.location.search).get('view') !== 'result' &&
        !consumeReplayFlag(studentId, missionId)
    }
    if (decided.current) setOpen(true)
    // ครั้งเดียวตอนเปิดหน้า — ผ่านระหว่างเล่นในจอนี้ไม่ต้องถาม
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { open, close: () => setOpen(false) }
}

export const REPLAY_ART = '/ui/kit2/replay-dome.webp'
export const REPLAY_ART_FALLBACK = '/dome/mascot/dome-celebrate.webp'

export function MissionRevisitDialog({
  open,
  missionNo,
  stars,
  maxStars = 3,
  replayHref,
  onViewResult,
  onReplay,
}: {
  open: boolean
  missionNo: number
  stars: number
  maxStars?: number
  /** null = ภารกิจนี้ไม่มีรอบเล่นซ้ำ (ซ่อนปุ่มเล่นใหม่) */
  replayHref: string | null
  onViewResult: () => void
  onReplay: () => void
}) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const [art, setArt] = useState(REPLAY_ART)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // โฟกัสที่ตัวกล่อง ไม่ใช่ปุ่มปิด (กันวงโฟกัสขึ้นที่ปุ่ม X ทันทีที่เปิด)
      d.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  const shown = Math.max(0, Math.min(maxStars, stars))

  return (
    <dialog
      ref={ref}
      className="mr-dialog"
      aria-labelledby="mr-title"
      aria-describedby="mr-desc"
      tabIndex={-1}
      onCancel={(e) => {
        e.preventDefault()
        onViewResult()
      }}
    >
      {/* เนื้อหาเรนเดอร์ตอนเปิดเท่านั้น — ภาพโดมโหลดฝั่งเบราว์เซอร์ onError จึงจับได้ทันและสลับไปภาพสำรอง */}
      {open ? (
        <div className="mr-card">
          <button type="button" className="mr-close focus-ring" aria-label="ปิด" onClick={onViewResult}>
            <CloseIcon width={20} height={20} aria-hidden />
          </button>
          <img
            src={art}
            alt=""
            aria-hidden="true"
            width={128}
            height={136}
            className="mr-dome"
            draggable={false}
            onError={() => setArt((cur) => (cur === REPLAY_ART_FALLBACK ? cur : REPLAY_ART_FALLBACK))}
          />
          <div className="mr-copy">
            <p className="mr-kicker">ภารกิจที่ {missionNo}</p>
            <h2 id="mr-title">เล่นภารกิจนี้แล้ว</h2>
            <p className="mr-stars" aria-label={`ได้ ${shown} จาก ${maxStars} ดาว`}>
              {Array.from({ length: maxStars }, (_, i) => (
                <img
                  key={i}
                  src={i < shown ? '/icons/3d/glowing-star.webp' : '/icons/3d/star.webp'}
                  alt=""
                  aria-hidden="true"
                  className={i < shown ? undefined : 'is-off'}
                  draggable={false}
                />
              ))}
            </p>
            <p id="mr-desc">{replayHref ? 'เล่นใหม่ได้ ดาวที่ได้แล้วไม่หาย' : 'ดูผลที่ได้ไว้ได้เลย'}</p>
          </div>
          <div className={replayHref ? 'mr-actions' : 'mr-actions is-single'}>
            <button type="button" onClick={onViewResult} className="mr-view focus-ring">
              ดูผลลัพธ์
            </button>
            {replayHref ? (
              <button type="button" onClick={onReplay} className="mr-replay focus-ring">
                เล่นใหม่
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}

'use client'
/* eslint-disable @next/next/no-img-element -- ไอคอน 3D/มาสคอตเป็นภาพนิ่งเล็ก ๆ */

import { motion, useReducedMotion } from 'motion/react'

/**
 * สถานะ "ผ่านด่านหลักแล้ว" ของจอภารกิจ — ดาวที่ได้ + สรุปสั้น แทนกล่องว่างใหญ่ที่มีแค่บับเบิลโดม
 * ดาวมาจากฐานข้อมูล (props) ห้ามคำนวณเอง
 */
export function MissionPassCard({
  missionNo,
  stars,
  answerLabel,
  explanation,
  hasNext,
  passedCount,
  totalMissions,
  maxStars = 3,
  kicker,
}: {
  missionNo: number
  stars: number
  answerLabel: string | null
  explanation: string | null
  hasNext: boolean
  passedCount: number
  totalMissions: number
  maxStars?: number
  /** บรรทัดเล็กเหนือจำนวนดาว — ค่าเริ่มต้น "ภารกิจที่ N สำเร็จ" (จอที่หัวจอบอกแล้วส่งชื่อภารกิจมาแทน) */
  kicker?: string
}) {
  const reduce = useReducedMotion()
  const shown = Math.max(0, Math.min(maxStars, stars))
  return (
    <section
      role="status"
      aria-label={`ภารกิจที่ ${missionNo} ผ่านแล้ว ได้ ${shown} จาก ${maxStars} ดาว`}
      className="relative flex h-full min-h-0 flex-col items-center justify-center gap-2.5 overflow-hidden rounded-[24px] px-4 py-3 text-center"
      style={{
        background: 'linear-gradient(180deg,#fff6d2 0%,#ffe4b0 60%,#ffd6c0 100%)',
        boxShadow: '0 0 0 3px #fff, 0 10px 22px rgba(120,60,10,0.22)',
      }}
    >
      <div className="flex items-end justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: maxStars }, (_, i) => {
          const on = i < shown
          return (
            <motion.img
              key={i}
              src={on ? '/icons/3d/glowing-star.webp' : '/icons/3d/star.webp'}
              alt=""
              draggable={false}
              className={i === 1 ? '-translate-y-2' : undefined}
              style={{ width: i === 1 ? 60 : 46, height: i === 1 ? 60 : 46, maxWidth: 'none', ...(on ? {} : { filter: 'grayscale(1) opacity(0.35)' }) }}
              initial={reduce ? false : { scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14, delay: 0.1 + i * 0.15 }}
            />
          )
        })}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- มาสคอตทางการ */}
      <img
        src="/dome/mascot/dome-celebrate.webp"
        alt=""
        aria-hidden="true"
        className="min-h-0 shrink select-none"
        style={{ height: 'clamp(90px, 22dvh, 190px)', width: 'auto', maxWidth: '70%', objectFit: 'contain' }}
        draggable={false}
      />
      <div className="shrink-0">
        <p className="text-label font-extrabold text-[#7a4b00]">{kicker ?? `ภารกิจที่ ${missionNo} สำเร็จ`}</p>
        <p className="font-display text-[1.6rem] font-extrabold leading-tight text-[#3a1a6e]">ได้ {shown} จาก {maxStars} ดาว!</p>
      </div>
      <ul className="flex w-full shrink-0 flex-col gap-1.5 text-left">
        {answerLabel ? (
          <li className="flex items-center gap-2 rounded-2xl bg-white/85 px-3 py-2 text-label font-bold text-[#12633a] shadow-soft-1">
            <img src="/icons/3d/check-mark-button.webp" alt="" aria-hidden="true" style={{ width: 24, height: 24 }} />
            คำตอบของเรา: {answerLabel}
          </li>
        ) : null}
        <li className="flex items-center gap-2 rounded-2xl bg-white/85 px-3 py-2 text-label font-bold text-[#5a3d00] shadow-soft-1">
          <img src="/icons/3d/trophy.webp" alt="" aria-hidden="true" style={{ width: 24, height: 24 }} />
          ผ่านแล้ว {passedCount} จาก {totalMissions} เกาะ
        </li>
        {explanation ? (
          <li className="rounded-2xl bg-white/85 px-3 py-2 text-label text-[#3a2a18] shadow-soft-1">
            <span className="line-clamp-2">{explanation}</span>
          </li>
        ) : null}
      </ul>
      <p className="shrink-0 text-label font-semibold text-[#5b4a82]">
        {hasNext ? 'กลับแผนที่ แล้วแตะเกาะที่กระพริบเพื่อเล่นต่อ' : 'ผ่านครบทุกเกาะแล้ว ด่านบอสรออยู่บนแผนที่'}
      </p>
    </section>
  )
}

'use client'
/* eslint-disable @next/next/no-img-element -- ไอคอน 3D/มาสคอตเป็นภาพนิ่งเล็ก ๆ */

import { motion, useReducedMotion } from 'motion/react'
import type { MissionResultRecap } from '@/components/mission-result-recap'

/**
 * สถานะ "ผ่านด่านหลักแล้ว" ของจอภารกิจ — ดาวที่ได้ + สรุปสั้น แทนกล่องว่างใหญ่ที่มีแค่บับเบิลโดม
 * ดาวมาจากฐานข้อมูล (props) ห้ามคำนวณเอง
 */
export function MissionPassCard({
  missionNo,
  stars,
  recap,
  takeaway,
  maxStars = 3,
  kicker,
}: {
  missionNo: number
  stars: number
  /** ผลจริงของภารกิจ — ตอบถูกไหม · ดาวมาจากไหน · ทำยังไงให้ได้เพิ่ม (components/mission-result-recap.ts) */
  recap: MissionResultRecap
  /** ใจความหนึ่งบรรทัดว่าทำไมถึงถูก (จากไฟล์เฉลย ส่งมาเฉพาะข้อที่ผ่านแล้ว) — null = ไม่ขึ้นบรรทัดนี้ */
  takeaway: string | null
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
        <li className="flex items-start gap-2 rounded-2xl bg-white/85 px-3 py-2 shadow-soft-1">
          <img src="/icons/3d/check-mark-button.webp" alt="" aria-hidden="true" className="mt-0.5 shrink-0" style={{ width: 24, height: 24 }} />
          <div className="min-w-0">
            <p className="text-label font-extrabold text-[#12633a]">{recap.verdict}</p>
            {takeaway ? <p className="mt-0.5 text-note leading-snug text-pretty text-[#3a2a18]">{takeaway}</p> : null}
          </div>
        </li>
        <li className="flex items-start gap-2 rounded-2xl bg-white/85 px-3 py-2 shadow-soft-1">
          <img src="/icons/3d/glowing-star.webp" alt="" aria-hidden="true" className="mt-0.5 shrink-0" style={{ width: 24, height: 24 }} />
          <div className="min-w-0">
            <p className="text-label font-bold leading-snug text-pretty text-[#5a3d00]">{recap.starHow}</p>
            {recap.improve ? <p className="mt-0.5 text-note leading-snug text-pretty text-[#5b4a82]">{recap.improve}</p> : null}
          </div>
        </li>
      </ul>
    </section>
  )
}

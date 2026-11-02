'use client'

import { motion, useReducedMotion } from 'motion/react'
import { CountUp } from './app/fx'
import './learn-done.css'

/**
 * จอสรุปเดียวหลังเรียนผ่าน (แทนจอ "ผ่านภารกิจแล้ว" + "ผ่านการเตรียมตัวแล้ว" สองจอเดิม)
 * บอกให้ชัดว่า: ส่วนเตรียมตัว/เรียนจบแล้ว → ต่อไปคือด่านหลักของภารกิจ (ตอบคำถามเก็บดาว)
 */
export function LearnDoneScreen({
  missionNo,
  modeLabel,
  score,
  recap,
}: {
  missionNo: string
  modeLabel: string
  score: number
  recap?: string[]
}) {
  const reduce = useReducedMotion()
  const pop = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { scale: 0, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { type: 'spring' as const, stiffness: 420, damping: 16, delay },
        }
  return (
    <section className="ld-done relative flex flex-col items-center gap-3 overflow-hidden rounded-[28px] px-4 pb-5 pt-4 text-center" aria-labelledby="learn-done-title">
      <div className="ld-rays" aria-hidden="true" />
      <div className="relative z-10 flex items-end justify-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.img
            key={i}
            src="/icons/3d/glowing-star.webp"
            alt=""
            draggable={false}
            className={i === 1 ? '-translate-y-2' : undefined}
            style={{ width: i === 1 ? 48 : 36, height: i === 1 ? 48 : 36, maxWidth: 'none' }}
            {...pop(0.15 + i * 0.12)}
          />
        ))}
      </div>
      <motion.img
        src="/dome/mascot/dome-celebrate.webp"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="relative z-10 -mt-2 select-none"
        style={{ height: 112, width: 'auto', maxWidth: 'none' }}
        {...(reduce
          ? {}
          : { initial: { y: 30, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { type: 'spring' as const, stiffness: 260, damping: 18 } })}
      />
      <div className="relative z-10">
        <p className="text-label font-extrabold text-[#7a4b00]">ภารกิจที่ {missionNo} · ช่วงอุ่นเครื่อง</p>
        <h2 id="learn-done-title" className="mt-0.5 font-display text-[1.7rem] font-extrabold leading-tight text-[#3a1a6e]">
          เรียนจบแล้ว เก่งมาก!
        </h2>
        <p className="mt-1 text-body text-[#4a3a5a]">
          เรียนแบบ<strong>{modeLabel}</strong> ได้ <strong className="tabular-nums"><CountUp value={score} /></strong> คะแนน
        </p>
      </div>

      <ol className="relative z-10 grid w-full grid-cols-[1fr_auto_1fr] items-stretch gap-1.5" aria-label="ขั้นตอนของภารกิจ">
        <li className="flex flex-col items-center gap-1 rounded-2xl bg-[#e3f8e8] px-2 py-2.5 ring-2 ring-[#1f9d55]/40">
          <span className="grid size-8 place-items-center rounded-full bg-[#1f9d55] text-white" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <span className="text-label font-extrabold leading-tight text-[#0f5132]">1. อุ่นเครื่อง</span>
          <span className="text-note font-bold text-[#0f5132]/80">เสร็จแล้ว</span>
        </li>
        <li aria-hidden="true" className="self-center text-[#c2410c]">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
        </li>
        <li className="ld-next flex flex-col items-center gap-1 rounded-2xl bg-[#fff1d6] px-2 py-2.5" aria-current="step">
          {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน 3D */}
          <img src="/icons/3d/bullseye.webp" alt="" aria-hidden="true" className="size-8" />
          <span className="text-label font-extrabold leading-tight text-[#7a3a00]">2. ด่านหลัก</span>
          <span className="text-note font-bold text-[#7a3a00]/80">ตอบ 1 ข้อ เก็บดาว</span>
        </li>
      </ol>
      {recap && recap.length > 0 ? (
        <ul className="relative z-10 flex w-full flex-col gap-1.5 rounded-2xl bg-white/85 px-4 py-3 text-left text-label text-[#3a2a18] shadow-soft-1">
          <li className="font-extrabold text-[#5a2fb0]">สิ่งที่ได้เรียนรู้</li>
          {recap.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-[#f2b705]" />
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="relative z-10 text-label font-semibold text-[#5b4a82]">
        ต่อไปคือคำถามหลักของภารกิจ ตอบถูกได้สูงสุด 3 ดาว
      </p>
    </section>
  )
}

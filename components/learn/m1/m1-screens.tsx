'use client'

/* eslint-disable @next/next/no-img-element -- ภาพสถิตจาก public/ ของภารกิจ 1 */
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/components/ui'
import type { LearnModeId } from '../learn-path-api'
import { DomeSays, M1Board, M1Flowline } from './m1-shell'
import './m1-screens.css'

/** จอเลือกวิธีเรียน (สตอรี่บอร์ด “เลือกวิธีเรียนที่ชอบ”) */
const MODES: { id: LearnModeId; label: string; sub: string; icon: string; tone: string }[] = [
  { id: 'watch', label: 'ดูวิดีโอ', sub: 'คลิปสถานการณ์สั้น ๆ', icon: '/ui/mode/icon-watch.webp', tone: 'blue' },
  { id: 'read', label: 'อ่านแชต', sub: 'แชตมีนกับฟ้า', icon: '/ui/mode/icon-read.webp', tone: 'purple' },
  { id: 'do', label: 'ลงมือทำ', sub: 'ลากการ์ดจับคู่', icon: '/ui/mode/icon-do.webp', tone: 'orange' },
]

export function M1ModeChooser({
  recommended,
  picked,
  onPick,
  error,
  enabledModes = ['watch', 'read', 'do'],
  passScore = 60,
}: {
  recommended: LearnModeId
  picked: LearnModeId | null
  onPick: (m: LearnModeId) => void
  error?: string | null
  enabledModes?: readonly LearnModeId[]
  passScore?: number
}) {
  const reduce = useReducedMotion()
  const visibleModes = MODES.filter((mode) => enabledModes.includes(mode.id))
  return (
    <div className="m1-stack">
      <DomeSays mood="greet" size={112}>
        สวัสดีครับ! ร้านขนมบ้านยายอยากให้ลูกค้าเข้าเว็บได้ง่าย ๆ มาเรียนเรื่อง<b>โดเมนเนม</b>กับ<b>DNS</b>กันครับ
      </DomeSays>
      <M1Board className="m1-chooser">
        <h2 className="m1-chooser-title">อยากเรียนแบบไหนดี?</h2>
        <div className="m1-mode-grid" role="radiogroup" aria-label="เลือกวิธีเรียน">
          {visibleModes.map((m, i) => {
            const on = picked === m.id
            return (
              <motion.button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onPick(m.id)}
                className={cn('m1-mode', `is-${m.tone}`, on && 'is-on')}
                initial={reduce ? false : { y: 18, opacity: 0 }}
                animate={{ y: on && !reduce ? -4 : 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 22, delay: reduce ? 0 : i * 0.06 }}
              >
                <span className="m1-mode-art">
                  <img src={m.icon} alt="" aria-hidden draggable={false} />
                </span>
                <span className="m1-mode-label">{m.label}</span>
                <span className="m1-mode-sub">{m.sub}</span>
                {recommended === m.id ? <span className="m1-mode-rec">แนะนำสำหรับคุณ</span> : null}
                {on ? <span className="m1-mode-check" aria-hidden>✓</span> : null}
              </motion.button>
            )
          })}
        </div>
        <p className="m1-chooser-note">ทุกวิธีพาไปถึงเป้าหมายเดียวกัน · เปลี่ยนวิธีได้ตลอด</p>
        <M1Flowline
          items={[
            { icon: '/icons/3d/books.webp', label: 'เรียนรู้', note: 'ตามวิธีที่เลือก' },
            { icon: '/icons/3d/speech-balloon.webp', label: 'ตอบโดม', note: 'หรือจับคู่การ์ด' },
            { icon: '/icons/3d/trophy.webp', label: `เกิน ${passScore}%`, note: 'ผ่านไปต่อ' },
          ]}
        />
        {error ? (
          <p className="m1-error" role="alert">
            {error}
          </p>
        ) : null}
      </M1Board>
    </div>
  )
}

/** W0 — รับภารกิจก่อนดูคลิป */
export function M1WatchBrief({ title, situation, tip, passScore = 60 }: { title: string; situation: string; tip: string; passScore?: number }) {
  return (
    <div className="m1-stack">
      <M1Board className="m1-brief">
        <p className="m1-kicker">ด่านที่ 1 · ดูวิดีโอ</p>
        <h2 className="m1-board-title">{title}</h2>
        <div className="m1-art m1-cover">
          <img src="/learn/m1/watch-s1.webp" alt="มีนกับลูกค้าในร้านขนมบ้านยาย" draggable={false} />
          <span className="m1-art-tag">มีน · ลูกค้า · ร้านขนมบ้านยาย</span>
          <span className="m1-play-badge" aria-hidden>
            ▶
          </span>
        </div>
        <div className="m1-situation">
          <img src="/icons/3d/feel-confused.webp" alt="" aria-hidden />
          <p>
            <b>สถานการณ์</b> {situation}
          </p>
        </div>
        <M1Flowline
          items={[
            { icon: '/icons/3d/television.webp', label: 'ดูคลิปจนจบ', note: 'กดเล่นซ้ำได้' },
            { icon: '/icons/3d/speech-balloon.webp', label: 'ตอบโดม 2 ข้อ', note: 'ด้วยคำของตัวเอง' },
            { icon: '/icons/3d/trophy.webp', label: `เกิน ${passScore}% ผ่าน`, note: 'ไปต่อได้ทันที' },
          ]}
        />
      </M1Board>
      <DomeSays mood="explain" size={92}>
        {tip}
      </DomeSays>
    </div>
  )
}

/** R01 — เข้าสู่เส้นทางอ่าน */
export function M1ReadBrief({ title, tip }: { title: string; tip: string }) {
  return (
    <div className="m1-stack">
      <M1Board className="m1-brief">
        <p className="m1-kicker">วัตถุประสงค์ที่ 1 · อ่านแชต</p>
        <h2 className="m1-board-title">{title}</h2>
        <p className="m1-lead">อ่านแชตของมีนกับฟ้าให้จบ แล้วตอบคำถามโดม 2 ข้อ</p>
        <div className="m1-cast" aria-label="ตัวละครในแชต">
          <figure className="m1-cast-card is-fah">
            <img src="/learn/m1/avatar-fah.webp" alt="" aria-hidden />
            <figcaption>
              <b>ฟ้า</b>
              <span>เพื่อนที่รู้เรื่องเว็บ</span>
            </figcaption>
          </figure>
          <span className="m1-cast-vs" aria-hidden>
            💬
          </span>
          <figure className="m1-cast-card is-meen">
            <img src="/learn/m1/avatar-meen.webp" alt="" aria-hidden />
            <figcaption>
              <b>มีน</b>
              <span>ช่วยยายทำเว็บร้านขนม</span>
            </figcaption>
          </figure>
        </div>
        <div className="m1-chat-preview" aria-hidden>
          <span className="is-left">ติดปัญหาตรงไหนเหรอ?</span>
          <span className="is-right">อยากให้ลูกค้าเข้าเว็บร้านง่าย ๆ</span>
        </div>
        <div className="m1-chip-row">
          <span className="m1-chip is-purple">
            <img src="/icons/3d/books.webp" alt="" aria-hidden />
            ภารกิจอ่าน • ยังไม่เริ่ม
          </span>
          <span className="m1-chip">
            <img src="/icons/3d/speech-balloon.webp" alt="" aria-hidden />
            16 ข้อความ
          </span>
          <span className="m1-chip is-green">
            <img src="/icons/3d/stopwatch.webp" alt="" aria-hidden />
            ไม่จับเวลา
          </span>
        </div>
      </M1Board>
      <DomeSays mood="explain" size={92}>
        {tip}
      </DomeSays>
    </div>
  )
}

/** R03 — ส่งต่อไปยังโดม (โดมอยู่นอกแชตเรื่องเล่า) */
export function M1Handoff({ mode }: { mode: 'watch' | 'read' }) {
  return (
    <div className="m1-stack m1-handoff">
      <div className="m1-handoff-spacer" aria-hidden />
      <M1Board>
        <p className="m1-kicker">{mode === 'read' ? 'อ่านครบแล้ว' : 'ดูครบแล้ว'}</p>
        <p className="m1-speech-big">
          {mode === 'read'
            ? 'อ่านเรื่องของมีนกับฟ้าจบแล้วนะครับ ลองตอบตามความเข้าใจของตัวเอง 2 ข้อ ไม่ต้องตอบเหมือนข้อความในแชตก็ได้ครับ'
            : 'ดูเรื่องของมีนจบแล้วนะครับ ลองตอบตามความเข้าใจของตัวเอง 2 ข้อ ไม่ต้องตอบเหมือนในคลิปก็ได้ครับ'}
        </p>
        <div className="m1-q-preview">
          <span>
            <b>ข้อ 1</b> โดเมนเนมคืออะไร
          </span>
          <span>
            <b>ข้อ 2</b> DNS คืออะไร ช่วยอะไร
          </span>
        </div>
      </M1Board>
    </div>
  )
}

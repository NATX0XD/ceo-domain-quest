import type { ReactNode } from 'react'
import { cn } from './cn'

/**
 * กล่องคำพูดของโดม (และของนักเรียนเวลาตอบกลับ)
 *
 * เหตุผลที่แยก `DomeAvatar` ออกมา: หน้าอื่นบางหน้าอยากได้รูปโดมเดี่ยว ๆ
 * โดยไม่มีกล่องคำพูด และบางหน้าอยากได้กล่องคำพูดโดยไม่มีรูป
 */

export type DomeMood = 'greet' | 'cheer' | 'happy' | 'think' | 'encourage' | 'explain' | 'surprised' | 'celebrate' | 'wait'

const MOOD_ALT: Record<DomeMood, string> = {
  greet: 'โดมยกมือทักทาย',
  cheer: 'โดมชูกำปั้นให้กำลังใจ',
  happy: 'โดมชูสองมือดีใจ',
  think: 'โดมกำลังคิดอย่างสงสัย',
  encourage: 'โดมยกนิ้วให้กำลังใจ',
  explain: 'โดมกำลังชี้อธิบาย',
  surprised: 'โดมทำหน้าประหลาดใจพร้อมประกายเล็ก ๆ',
  celebrate: 'โดมกระโดดฉลองพร้อมกระดาษโปรย',
  wait: 'โดมยืนรอฟังอย่างตั้งใจ',
}

const DOME_ASSET: Record<DomeMood, string> = {
  greet: '/dome/mascot/dome-greet.webp',
  cheer: '/dome/mascot/dome-cheer.webp',
  happy: '/dome/mascot/dome-happy.webp',
  think: '/dome/mascot/dome-think.webp',
  encourage: '/dome/mascot/dome-encourage.webp',
  explain: '/dome/mascot/dome-explain.webp',
  surprised: '/dome/mascot/dome-surprised.webp',
  celebrate: '/dome/mascot/dome-celebrate.webp',
  wait: '/dome/mascot/dome-wait.webp',
}

export type DomeAvatarProps = {
  mood?: DomeMood
  size?: number
  /** ตั้งเป็น true เมื่อมีข้อความอธิบายอยู่ข้าง ๆ อยู่แล้ว รูปจะถูกซ่อนจากโปรแกรมอ่านหน้าจอ */
  decorative?: boolean
  /**
   * ใส่ประกายรอบตัวโดมตามภาพต้นแบบ
   *
   * เป็น opt-in ไม่ใช่ค่าตั้งต้น เพราะโดมถูกใช้ในที่แคบ ๆ หลายแห่ง (เช่นในรายการแชท)
   * ที่ประกายจะกลายเป็นขยะสายตา · ประกายเป็นรูปนิ่ง **ไม่มี animation**
   * จึงไม่มีอะไรต้องปิดในโหมดลดการเคลื่อนไหว
   */
  sparkle?: boolean
  className?: string
}

/** ประกาย 4 แฉก 3 ดวง วางรอบตัวโดม ขนาดสัมพันธ์กับตัวโดมเสมอ */
const SPARKS: readonly { x: number; y: number; r: number; tone: string }[] = [
  { x: 4, y: 12, r: 7, tone: 'text-reward-500' },
  { x: 88, y: 4, r: 9, tone: 'text-spark-500' },
  { x: 92, y: 62, r: 6, tone: 'text-quest-500' },
]

export function DomeAvatar({
  mood = 'greet',
  size = 96,
  decorative = false,
  sparkle = false,
  className,
}: DomeAvatarProps) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- mascot เป็นไฟล์สถิตในโฟลเดอร์ public ไม่ต้องผ่านตัวปรับขนาดภาพ
    <img
      src={DOME_ASSET[mood]}
      alt={decorative ? '' : MOOD_ALT[mood]}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      className={cn('shrink-0 select-none object-contain', sparkle ? 'relative block' : className)}
      draggable={false}
    />
  )
  if (!sparkle) return img

  return (
    <span
      className={cn('relative inline-block shrink-0 select-none', className)}
      style={{ width: size, height: size }}
    >
      {img}
      {SPARKS.map((s) => (
        <svg
          key={`${s.x}-${s.y}`}
          viewBox="0 0 10 10"
          aria-hidden="true"
          focusable="false"
          className={cn('pointer-events-none absolute', s.tone)}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: (size * s.r) / 100,
            height: (size * s.r) / 100,
          }}
        >
          <path
            d="M5 0 Q5.8 4.2 10 5 Q5.8 5.8 5 10 Q4.2 5.8 0 5 Q4.2 4.2 5 0 Z"
            fill="currentColor"
          />
        </svg>
      ))}
    </span>
  )
}

type BubbleSpeaker = 'dome' | 'student'
type BubbleTail = 'left' | 'right' | 'top' | 'none'

export type SpeechBubbleProps = {
  children: ReactNode
  /** ใครพูด — คุมสีและด้านที่หางชี้ */
  speaker?: BubbleSpeaker
  /** ชื่อผู้พูดที่แสดงเหนือข้อความ */
  speakerName?: string
  tail?: BubbleTail
  /** ข้อความกำลังพิมพ์อยู่ — ประกาศให้โปรแกรมอ่านหน้าจอรู้ว่าจะมีของใหม่มา */
  live?: boolean
  className?: string
}

const SPEAKER_CLASS: Record<BubbleSpeaker, string> = {
  dome: 'bg-brand-50 text-ink ring-brand-100',
  student: 'bg-quest-50 text-ink ring-quest-100',
}

const TAIL_CLASS: Record<BubbleTail, string> = {
  left: 'before:left-[-9px] before:top-6',
  right: 'before:right-[-9px] before:top-6',
  top: 'before:left-8 before:top-[-9px]',
  none: 'before:hidden',
}

const TAIL_FILL: Record<BubbleSpeaker, string> = {
  dome: 'before:bg-brand-50',
  student: 'before:bg-quest-50',
}

export function SpeechBubble({
  children,
  speaker = 'dome',
  speakerName,
  tail = 'left',
  live = false,
  className,
}: SpeechBubbleProps) {
  return (
    <div
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      className={cn(
        'relative rounded-3xl px-5 py-4 shadow-soft-2 ring-1 ring-inset',
        // หางกล่องคำพูด: สี่เหลี่ยมหมุน 45 องศา ไม่ใช้ border-trick
        // จะได้มุมโค้งเนียนไปกับกล่องและสีตรงกันเป๊ะ
        "before:absolute before:size-[18px] before:rotate-45 before:rounded-[4px] before:content-['']",
        SPEAKER_CLASS[speaker],
        TAIL_FILL[speaker],
        TAIL_CLASS[tail],
        className,
      )}
    >
      {speakerName ? (
        <p className="mb-1 text-note font-bold text-brand-700">{speakerName}</p>
      ) : null}
      <div className="relative text-body text-pretty">{children}</div>
    </div>
  )
}

export type DomeSaysProps = {
  children: ReactNode
  mood?: DomeMood
  speakerName?: string
  /** วางรูปโดมไว้ด้านขวาแทนด้านซ้าย */
  reverse?: boolean
  live?: boolean
  avatarSize?: number
  className?: string
}

/** โดม + กล่องคำพูด จัดวางคู่กันตามภาพต้นแบบ */
export function DomeSays({
  children,
  mood = 'greet',
  speakerName,
  reverse = false,
  live = false,
  avatarSize = 88,
  className,
}: DomeSaysProps) {
  return (
    <div className={cn('flex items-start gap-2', reverse && 'flex-row-reverse', className)}>
      <DomeAvatar mood={mood} size={avatarSize} decorative />
      <SpeechBubble
        speaker="dome"
        speakerName={speakerName}
        tail={reverse ? 'right' : 'left'}
        live={live}
        className="min-w-0 flex-1"
      >
        {children}
      </SpeechBubble>
    </div>
  )
}

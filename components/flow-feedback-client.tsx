'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { AlertIcon, CheckIcon, ClockIcon, DomeAvatar, cn, type DomeMood } from '@/components/ui'

/**
 * "กดปุ่มแล้วห้ามเงียบ" + "บอกว่าอยู่ตรงไหนของคาบ" — ของกลางที่ทุกจอใช้ตัวเดียวกัน
 *
 * เจ้าของเล่นจริงแล้วบอกสองเรื่องพร้อมกัน: **งง ไม่รู้ว่ากดแล้วเกิดอะไร** และ **ความสวยก็สำคัญ**
 * ชิ้นส่วนในไฟล์นี้จึงถูกออกแบบให้เป็นงานหน้าตาจริง ๆ ไม่ใช่ตัวหนังสือสีเทาแปะเพิ่มทีหลัง:
 *   - แถบขั้นตอนเป็นชิปมีสีกับไอคอน อ่านปราดเดียวรู้ว่าอยู่ขั้นไหน
 *   - การ์ดสถานะมีวงไอคอน พื้นสีตามความหมาย และขยับเข้ามาเบา ๆ
 *   - คำแนะนำ "ทำอะไรต่อ" ออกจากปากเลขาโดม ซึ่งเป็นตัวละครที่เด็กคุ้นอยู่แล้ว
 *
 * สามสถานะที่บังคับให้ครบ:
 *   sending — บอกว่ากำลังส่ง (และห้ามให้กดซ้ำ)
 *   done    — บอกว่าสำเร็จ **และเกิดอะไรต่อ** ไม่ใช่แค่ "สำเร็จ"
 *   failed  — บอก **เหตุผล** กับ **ทางแก้** ไม่ใช่ "ผิดพลาด"
 *
 * เกณฑ์จากสกิล ui-ux-pro-max ที่ยึด:
 *  Submit Feedback (High) · Error Messages (High, ใช้ role=alert ไม่ใช่สีอย่างเดียว) ·
 *  Error Recovery (Medium) · Disabled States (Medium) · Animation 150-300ms · no-emoji-icons
 *
 * ⚠️ ทุกชิ้นสูงคงที่บรรทัดเดียว-สองบรรทัด เพราะทุกจอห้ามเลื่อน ห้ามทำให้สูงไม่จำกัด
 */

export type FlowState =
  | { kind: 'idle' }
  | { kind: 'sending'; text: string }
  | { kind: 'done'; text: string }
  | { kind: 'failed'; text: string }

export interface FlowFeedback {
  state: FlowState
  /** กำลังส่งอยู่ไหม — เอาไปปิดปุ่มกันกดซ้ำ */
  busy: boolean
  sending: (text: string) => void
  done: (text: string) => void
  failed: (text: string) => void
  reset: () => void
}

export function useFlowFeedback(): FlowFeedback {
  const [state, setState] = useState<FlowState>({ kind: 'idle' })
  return {
    state,
    busy: state.kind === 'sending',
    sending: useCallback((text: string) => setState({ kind: 'sending', text }), []),
    done: useCallback((text: string) => setState({ kind: 'done', text }), []),
    failed: useCallback((text: string) => setState({ kind: 'failed', text }), []),
    reset: useCallback(() => setState({ kind: 'idle' }), []),
  }
}

const NOTE_SKIN = {
  sending: {
    box: 'bg-brand-50 ring-brand-200',
    dot: 'bg-brand-600 text-ink-onbrand',
    text: 'text-brand-700',
  },
  done: {
    box: 'bg-quest-50 ring-quest-600/30',
    dot: 'bg-quest-600 text-ink-onbrand',
    text: 'text-quest-700',
  },
  failed: {
    box: 'bg-danger-100 ring-danger-600/40',
    dot: 'bg-danger-600 text-ink-onbrand',
    text: 'text-danger-700',
  },
  idle: {
    box: 'bg-surface-raised ring-line',
    dot: 'bg-brand-100 text-brand-700',
    text: 'text-ink',
  },
} as const

export interface FlowNoteProps {
  state: FlowState
  /**
   * ข้อความตอนยังไม่ได้กดอะไร — **บรรทัดเดียวบอกว่าตอนนี้ต้องทำอะไร**
   * ถ้าปุ่มยังกดไม่ได้ ให้ส่งเหตุผลมาทางนี้ (บอกล่วงหน้า ไม่ใช่กดแล้วค่อยเด้ง)
   */
  idleText?: string | null
  className?: string
}

/** การ์ดสถานะ — วงไอคอน + พื้นสีตามความหมาย + ขยับเข้ามาเบา ๆ ตอนเปลี่ยนสถานะ */
export function FlowNote({ state, idleText = null, className }: FlowNoteProps) {
  const text = state.kind === 'idle' ? idleText : state.text
  if (!text) return null

  const skin = NOTE_SKIN[state.kind]
  const Icon = state.kind === 'failed' ? AlertIcon : state.kind === 'done' ? CheckIcon : ClockIcon

  return (
    <div
      // ข้อผิดพลาดต้องประกาศทันที สถานะอื่นรอจังหวะที่ไม่ขัดจังหวะการอ่าน
      role={state.kind === 'failed' ? 'alert' : 'status'}
      aria-live={state.kind === 'failed' ? 'assertive' : 'polite'}
      className={cn(
        'flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2 ring-1 ring-inset',
        'animate-rise-in motion-reduce:animate-none',
        skin.box,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full shadow-soft-1',
          skin.dot,
          state.kind === 'sending' ? 'animate-pulse-soft motion-reduce:animate-none' : null,
        )}
      >
        <Icon width={18} height={18} />
      </span>
      <span className={cn('min-w-0 flex-1 text-label font-semibold text-pretty', skin.text)}>
        {text}
      </span>
    </div>
  )
}

export interface StageLineProps {
  /** ตอนนี้อยู่ขั้นไหนของคาบ เช่น "ขั้นที่ 2 · รู้จักตัวเอง" */
  stage: string
  /** เหลืออีกกี่ขั้น หรือข้อความบอกตำแหน่งอื่น — null = ไม่ต้องบอก */
  remain?: string | null
  /** ไอคอนประจำขั้น — ใช้ไอคอนจากระบบดีไซน์ ไม่ใช้อีโมจิ */
  icon?: ReactNode
  className?: string
}

/**
 * ชิปบอกว่าอยู่ตรงไหนของคาบ — มีสีและไอคอนของตัวเอง อ่านปราดเดียวรู้
 * สูงคงที่แถวเดียว ไม่แย่งพื้นที่เนื้อหา
 */
export function StageLine({ stage, remain = null, icon, className }: StageLineProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <p className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-brand-100 py-1 pr-3 pl-1.5 text-label font-bold text-brand-700">
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-ink-onbrand"
        >
          {icon ?? <ClockIcon width={14} height={14} />}
        </span>
        <span className="min-w-0 truncate">{stage}</span>
      </p>
      {remain ? (
        <p className="ml-auto shrink-0 text-label font-bold tabular-nums text-ink-muted">{remain}</p>
      ) : null}
    </div>
  )
}

export interface DomeTipProps {
  children: ReactNode
  /** โดมหน้าไหน — ตามอารมณ์ของสถานการณ์ */
  mood?: DomeMood
  /** แตะแล้วทำอะไร เช่น เปิดแผ่นอ่านเรื่องเต็ม — ไม่ส่งมาก็เป็นข้อความเฉย ๆ */
  onClick?: () => void
  className?: string
}

/**
 * คำแนะนำ "ตอนนี้ต้องทำอะไร" ที่ออกจากปากเลขาโดม
 * เป็นทั้งตัวบอกทางและตัวละครที่ทำให้จอไม่แห้ง — สูงคงที่ ตัดบรรทัดเกินด้วย line-clamp
 */
export function DomeTip({ children, mood = 'greet', onClick, className }: DomeTipProps) {
  const inner = (
    <>
      <DomeAvatar mood={mood} size={40} decorative />
        <span className="min-w-0 flex-1 text-label text-pretty break-words text-ink">
        <span>{children}</span>
      </span>
    </>
  )

  const skin =
    'flex shrink-0 items-center gap-2 rounded-2xl bg-brand-50 px-3 py-2 ring-1 ring-brand-100 ring-inset'

  if (!onClick) {
    return <div className={cn(skin, className)}>{inner}</div>
  }
  return (
    <button type="button" onClick={onClick} className={cn(skin, 'text-left focus-ring', className)}>
      {inner}
    </button>
  )
}

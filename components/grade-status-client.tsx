'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertIcon, Card, CheckIcon, ChevronRightIcon, ClockIcon, InfoIcon, cn } from '@/components/ui'
import type { StudentNextStep } from '@/components/server/next-step'

/**
 * "งานของเราอยู่ขั้นไหนแล้ว" — ต่อกับ `GET /api/grade/status`
 *
 * ทำไมต้องมี: เด็กกดส่งใบเสนอแล้วหน้าจอเงียบ ไม่รู้ว่าครูอ่านหรือยัง ต้องรีเฟรชเองไปเรื่อย ๆ
 * ซึ่งในคาบจริงแปลว่านั่งจ้องจอแทนที่จะไปทำอย่างอื่นต่อ
 *
 * ⚠️ **ห้ามแสดงคะแนนของ AI ให้ผู้เรียนเห็นเป็นคะแนนจริง**
 *    endpoint ไม่ส่งคะแนน AI ออกมาอยู่แล้ว ที่นี่จึงบอกได้แค่ว่า "ตรวจถึงไหน" (`aiCheck`)
 *    และทุกประโยคของ AI ต้องย้ำว่าเป็นความเห็นที่ส่งให้ครู ไม่ใช่ผลของผู้เรียน
 * ⚠️ ข้อความหลัก (`stateLabel` / `message` / `nextLabel`) มาจากเซิร์ฟเวอร์ **ห้ามแต่งเอง**
 *    หน้าใบประกาศใช้ตัวเดียวกัน สองหน้าจะได้ไม่พูดคนละเรื่อง
 * ⚠️ จังหวะถามซ้ำมาจาก `pollAfterSeconds` ของเซิร์ฟเวอร์ · **0 = จบแล้ว หยุดถามถาวร**
 *    หน้าจอไม่เดาจังหวะเอง และไม่ยิงทิ้งไว้ตอนแท็บถูกซ่อน
 */

export type GradeState = 'not-submitted' | 'waiting-teacher' | 'revise' | 'confirmed'
export type AiCheckState =
  | 'not-submitted'
  | 'not-requested'
  | 'in-progress'
  | 'done'
  | 'unavailable'

export interface GradeStatus {
  submissionId: string | null
  versionCount: number
  state: GradeState
  stateLabel: string
  aiCheck: AiCheckState
  message: string
  nextHref: string | null
  nextLabel: string | null
  /**
   * "ตอนนี้ต้องทำอะไรต่อ" จากแหล่งความจริงเดียว (`components/server/next-step.ts`)
   * `undefined` ได้เฉพาะตอนเซิร์ฟเวอร์รุ่นเก่ายังไม่ส่งมา — การ์ดจะถอยไปใช้ `message` แทน
   */
  nextStep?: StudentNextStep | null
  certificate: {
    eligible: boolean
    passedCount: number
    totalCount: number
  } | null
  pollAfterSeconds: number
}

/**
 * ประโยคของ "การตรวจเบื้องหลัง" — พูดถึงความคืบหน้าเท่านั้น ไม่มีตัวเลขสักตัว
 * `not-requested` / `not-submitted` ไม่ต้องพูดถึงเลย ผู้เรียนไม่ต้องรู้ว่าระบบมีคิว
 */
const AI_NOTE: Partial<Record<AiCheckState, string>> = {
  'in-progress': 'ระหว่างนี้ AI กำลังช่วยอ่านงานอีกรอบเพื่อส่งความเห็นให้ครู — ไม่ใช่คะแนนของเรา',
  done: 'AI ส่งความเห็นให้ครูแล้ว ครูเป็นคนตัดสินคะแนนเสมอ',
  unavailable: 'รอบนี้ AI อ่านไม่สำเร็จ ไม่กระทบงานของเราเลย ครูตรวจเองอยู่แล้ว',
}

const STATE_STYLE: Record<
  GradeState,
  { tone: 'plain' | 'brand' | 'quest' | 'spark'; Icon: typeof ClockIcon; iconClass: string }
> = {
  'not-submitted': { tone: 'plain', Icon: InfoIcon, iconClass: 'text-ink-muted' },
  'waiting-teacher': { tone: 'brand', Icon: ClockIcon, iconClass: 'text-brand-700' },
  revise: { tone: 'spark', Icon: AlertIcon, iconClass: 'text-spark-700' },
  confirmed: { tone: 'quest', Icon: CheckIcon, iconClass: 'text-quest-700' },
}

/** ลำดับขั้นที่ผู้เรียนเห็นเป็นภาพ — "อยู่ตรงไหนของทาง" อ่านง่ายกว่าข้อความอย่างเดียว */
const STEPS: { key: GradeState; label: string }[] = [
  { key: 'not-submitted', label: 'ส่งงาน' },
  { key: 'waiting-teacher', label: 'ครูกำลังอ่าน' },
  { key: 'confirmed', label: 'ครูตรวจเสร็จ' },
]

function stepIndexOf(state: GradeState): number {
  // "ครูส่งกลับมาให้แก้" ไม่ใช่ขั้นที่ 4 แต่คือถอยกลับมาที่ขั้นส่งงานอีกรอบ
  if (state === 'revise') return 0
  return STEPS.findIndex((s) => s.key === state)
}

export interface GradeStatusCardProps {
  /** ยิงเมื่อสถานะเปลี่ยนไปเป็นค่าที่ "จบรอบ" แล้ว — หน้าที่ใช้จะได้โหลดคะแนน/คำสั่งแก้ใหม่ */
  onSettled?: (state: GradeState) => void
  className?: string
}

export function GradeStatusCard({ onSettled, className }: GradeStatusCardProps) {
  const [status, setStatus] = useState<GradeStatus | null>(null)
  /** สถานะรอบก่อน ใช้ดูว่า "เพิ่งเปลี่ยน" ไหม จะได้ไม่เรียก onSettled ซ้ำทุกจังหวะ */
  const lastStateRef = useRef<GradeState | null>(null)
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled

  const load = useCallback(async (): Promise<number> => {
    try {
      const res = await fetch('/api/grade/status')
      if (!res.ok) return 0
      const data = (await res.json()) as GradeStatus & { ok?: boolean }
      setStatus(data)
      if (lastStateRef.current !== null && lastStateRef.current !== data.state) {
        settledRef.current?.(data.state)
      }
      lastStateRef.current = data.state
      return Number.isFinite(data.pollAfterSeconds) ? data.pollAfterSeconds : 0
    } catch {
      // เน็ตสะดุด — ลองใหม่จังหวะหน้า ไม่ขึ้นข้อความให้เด็กตกใจระหว่างรอครู
      return 0
    }
  }, [])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null

    /** ตั้งเวลารอบถัดไปจากค่าที่เซิร์ฟเวอร์บอก · 0 = จบแล้ว ไม่ตั้งอีก */
    async function tick() {
      if (!alive) return
      const nextSeconds = await load()
      if (!alive || nextSeconds <= 0) return
      if (document.visibilityState !== 'visible') return
      timer = setTimeout(() => void tick(), nextSeconds * 1000)
    }

    function onVisibility() {
      if (document.visibilityState !== 'visible') {
        if (timer !== null) clearTimeout(timer)
        timer = null
        return
      }
      // กลับมาดูจอ = ถามทันทีหนึ่งครั้ง ไม่ต้องรอครบจังหวะ
      if (timer === null) void tick()
    }

    void tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive = false
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  // ยังไม่ได้ส่งงาน = ไม่มีอะไรให้รอ อย่าไปเพิ่มกล่องรกหน้าฟอร์ม
  if (!status || status.state === 'not-submitted') return null

  const style = STATE_STYLE[status.state]
  const current = stepIndexOf(status.state)
  /**
   * ครูยืนยันคะแนนแล้วก็ไม่ต้องรายงานว่า "AI กำลังอ่านอยู่" อีก
   * คิวเบื้องหลังอาจยังไม่จบ (aiCheck ค้างที่ in-progress ได้) แต่ครูตัดสินจบไปแล้ว
   * พูดต่อจะกลายเป็นชวนให้เด็กคิดว่าคะแนนยังเปลี่ยนได้
   */
  const aiNote = status.state === 'confirmed' ? undefined : AI_NOTE[status.aiCheck]

  return (
    <Card as="section" tone={style.tone} className={className} aria-live="polite">
      <h2 className="flex items-center gap-2 text-title-sm font-bold text-balance text-ink">
        <style.Icon width={24} height={24} aria-hidden className={cn('shrink-0', style.iconClass)} />
        {status.stateLabel}
      </h2>

      {/* ลำดับขั้น — ไม่ใช่สีอย่างเดียว มีตัวเลข/เครื่องหมายถูกกำกับทุกจุด */}
      <ol className="mt-3 flex items-center gap-1.5">
        {STEPS.map((step, i) => {
          const done = i < current || status.state === 'confirmed'
          const here = i === current && status.state !== 'confirmed'
          return (
            <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full text-label font-bold',
                  done
                    ? 'bg-quest-600 text-ink-onbrand'
                    : here
                      ? 'bg-brand-600 text-ink-onbrand'
                      : 'bg-surface-sunken text-ink-muted',
                )}
              >
                {done ? <CheckIcon width={18} height={18} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-center text-note text-pretty',
                  here ? 'font-bold text-ink' : 'text-ink-muted',
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>

      {/* ประโยคสั่งงานจากเซิร์ฟเวอร์ — ตัวเดียวกับที่ /home /map /result ใช้ จึงขัดกันไม่ได้ */}
      <p className="mt-3 text-body font-bold text-pretty text-ink">
        {status.nextStep?.line ?? status.message}
      </p>
      {status.nextStep ? (
        <p className="mt-1 text-label text-pretty text-ink-muted">{status.message}</p>
      ) : null}

      {status.versionCount > 1 ? (
        <p className="mt-1 text-label text-pretty text-ink-muted">
          ส่งมาแล้ว {status.versionCount} ฉบับ ฉบับเดิมยังอยู่ ครูดูพัฒนาการของเราได้
        </p>
      ) : null}

      {aiNote ? <p className="mt-1 text-label text-pretty text-ink-muted">{aiNote}</p> : null}

      {status.certificate && status.certificate.totalCount > 0 ? (
        <p className="mt-1 text-label text-pretty text-ink-muted">
          เกณฑ์ใบประกาศ ผ่านแล้ว {status.certificate.passedCount} จาก{' '}
          {status.certificate.totalCount} ด้าน
        </p>
      ) : null}

      {status.nextStep ? (
        <Link
          href={status.nextStep.primary.href}
          className="btn-base mt-4 min-h-12 w-full bg-surface-raised text-brand-700 shadow-soft-1 ring-2 ring-brand-100 ring-inset hover:bg-brand-50"
        >
          {status.nextStep.primary.longLabel}
          <ChevronRightIcon width={20} height={20} aria-hidden />
        </Link>
      ) : null}
    </Card>
  )
}

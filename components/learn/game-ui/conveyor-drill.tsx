'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/components/ui'
import { GameButton, HudPill, PixelPanel, buzz, useGameMotion } from './index'

export type DrillItem = { label: string; bin: string }
export type DrillBin = { id: string; label: string }

/**
 * ดริลสายพานคัดแยก: ของวิ่งเข้ามาทีละชิ้น แตะกล่องปลายทางที่ใช่
 * ผิด = สั่นเบา ๆ แล้วลองใหม่ (ไม่มีหมดเวลา) · เฉลยมาจากข้อมูลสาธารณะที่ส่งเข้ามาเท่านั้น
 */
export function ConveyorDrill({
  items,
  bins,
  title,
  onDone,
}: {
  items: DrillItem[]
  bins: DrillBin[]
  title: string
  onDone: (stats: { total: number; firstTry: number }) => void
}) {
  const { reduce, spring } = useGameMotion()
  const [idx, setIdx] = useState(0)
  const [firstTry, setFirstTry] = useState(0)
  const [missed, setMissed] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [flash, setFlash] = useState<{ bin: string; ok: boolean } | null>(null)
  const [sent, setSent] = useState<number[]>([])

  const item = items[idx]
  const done = idx >= items.length

  function sort(binId: string) {
    if (!item) return
    buzz()
    if (binId === item.bin) {
      setFlash({ bin: binId, ok: true })
      if (!missed) setFirstTry((n) => n + 1)
      setSent((s) => [...s, idx])
      setMissed(false)
      setIdx((i) => i + 1)
    } else {
      setFlash({ bin: binId, ok: false })
      setMissed(true)
      setShakeKey((k) => k + 1)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <HudPill tone="dark">{title}</HudPill>
        <div className="flex min-w-0 flex-1 gap-1" aria-hidden="true">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn('h-2 flex-1 rounded-sm', sent.includes(i) ? 'bg-[#ffcf4a]' : 'bg-white/25')}
            />
          ))}
        </div>
        <HudPill tone="gold">
          {Math.min(idx + 1, items.length)}/{items.length}
        </HudPill>
      </div>

      <p className="rounded-xl bg-black/35 px-3 py-2 text-label font-bold text-white" aria-live="polite">
        {done
          ? 'คัดครบแล้ว'
          : missed
            ? 'ยังไม่ใช่กล่องนี้ ลองกล่องอื่นดูนะ'
            : 'แตะกล่องที่ชิ้นนี้ควรไปอยู่'}
      </p>

      {/* สายพาน */}
      <div className="relative flex min-h-0 flex-1 items-center overflow-hidden rounded-2xl border-[3px] border-[#3a2a63] bg-[#150b2b]">
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0 bottom-6 h-10 border-y-4 border-[#4a3a7a] bg-[#2a1748]',
            '[background-image:repeating-linear-gradient(90deg,#3a2a63_0_14px,transparent_14px_28px)]',
            !reduce && 'motion-safe:animate-[belt_1.2s_linear_infinite]',
          )}
        />
        <style>{'@keyframes belt{from{background-position:0 0}to{background-position:-28px 0}}'}</style>
        <AnimatePresence mode="wait">
          {item ? (
            <motion.div
              key={`${idx}`}
              initial={reduce ? false : { x: '120%' }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { y: -60, opacity: 0, scale: 0.7 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 18 }}
              className="mx-auto"
            >
              <motion.div
                key={shakeKey}
                animate={!reduce && shakeKey > 0 ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
                transition={{ duration: 0.35 }}
                dir="auto"
                className="rounded-xl border-[3px] border-[#b8860b] bg-[#fff6dc] px-5 py-3 text-title font-extrabold text-[#2a1748] shadow-[0_5px_0_#b8860b]"
              >
                {item.label}
              </motion.div>
            </motion.div>
          ) : (
            <motion.p
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring}
              className="mx-auto text-title-sm font-extrabold text-[#ffcf4a]"
            >
              ถูกตั้งแต่ครั้งแรก {firstTry} จาก {items.length}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {!done ? (
        <div className="grid grid-cols-3 gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {bins.map((b) => (
            <motion.button
              key={b.id}
              type="button"
              whileTap={reduce ? undefined : { scale: 0.94, y: 2 }}
              animate={
                flash?.bin === b.id
                  ? { backgroundColor: flash.ok ? '#2f9e5a' : '#ffb870' }
                  : { backgroundColor: '#fff6dc' }
              }
              onAnimationComplete={() => flash?.bin === b.id && setFlash(null)}
              onClick={() => sort(b.id)}
              className="min-h-16 rounded-xl border-[3px] border-[#7a5a3a] px-1.5 py-2 text-label font-extrabold text-[#3a2a18] shadow-[0_4px_0_#5c4228] focus-visible:outline-3 focus-visible:outline-focus"
            >
              {b.label}
            </motion.button>
          ))}
        </div>
      ) : (
        <PixelPanel variant="dark" className="p-2.5">
          <GameButton variant="gold" className="w-full" onClick={() => onDone({ total: items.length, firstTry })}>
            ไปฝึกกับลูกค้า
          </GameButton>
        </PixelPanel>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/components/ui'
import { useGameMotion } from './index'
import { Cta, DomeSay, M3Stage, Panel, sfx, useDragDrop } from './counter-shell'

export type DrillItem = { label: string; bin: string }
export type DrillBin = { id: string; label: string }

const SECONDS = 30

/** ตัวอย่างชื่อโดเมนจริงตามนามสกุล ให้สายพานเหมือนงานจริง (S20) */
const EXAMPLE: Record<string, string> = {
  '.com': 'lazada.com',
  '.net': 'speedtest.net',
  '.org': 'wikipedia.org',
  '.shop': 'kanom.shop',
  '.co.th': 'shopee.co.th',
  '.in.th': 'baanrao.in.th',
  '.ไทย': 'ร้านเรา.ไทย',
  '.ac.th': 'kmutnb.ac.th',
  '.go.th': 'moe.go.th',
  '.or.th': 'redcross.or.th',
  '.net.th': 'tot.net.th',
  '.mi.th': 'navy.mi.th',
}

/**
 * S20 สายพานคัดแยก 30 วินาที: ป้ายโดเมนไหลมาทีละชิ้น ลากลงถังที่ใช่ (หรือแตะถัง)
 * ผิด = สั่นแล้วลองใหม่ · เฉลยมาจากข้อมูลสาธารณะ (คู่มือ) ที่ส่งเข้ามาเท่านั้น
 */
export function ConveyorDrill({
  items,
  bins,
  onDone,
  onExit,
}: {
  items: DrillItem[]
  bins: DrillBin[]
  onDone: (stats: { total: number; firstTry: number }) => void
  onExit?: () => void
}) {
  const { reduce } = useGameMotion()
  const [started, setStarted] = useState(false)
  const [idx, setIdx] = useState(0)
  const [firstTry, setFirstTry] = useState(0)
  const [missed, setMissed] = useState(false)
  const [shake, setShake] = useState(0)
  const [flash, setFlash] = useState<{ bin: string; ok: boolean } | null>(null)
  const [seconds, setSeconds] = useState(SECONDS)
  const [expired, setExpired] = useState(false)

  const item = items[idx]
  const done = idx >= items.length || expired

  useEffect(() => {
    if (!started || done) return
    const id = window.setInterval(() => {
      setSeconds((v) => {
        if (v <= 1) {
          window.clearInterval(id)
          setExpired(true)
          sfx('bad')
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [started, done])

  useEffect(() => {
    if (!flash) return
    const id = window.setTimeout(() => setFlash(null), 450)
    return () => window.clearTimeout(id)
  }, [flash])

  function sort(binId: string) {
    if (!item || expired || !started) return
    if (binId === item.bin) {
      sfx('ok')
      setFlash({ bin: binId, ok: true })
      if (!missed) setFirstTry((n) => n + 1)
      setMissed(false)
      setIdx((i) => i + 1)
      if (idx + 1 >= items.length) sfx('win')
    } else {
      sfx('bad')
      setFlash({ bin: binId, ok: false })
      setMissed(true)
      setShake((k) => k + 1)
    }
  }

  const dd = useDragDrop({ onDrop: (_item, zone) => sort(zone) })
  const p = item ? dd.itemProps(`drill-${idx}`) : null

  return (
    <M3Stage
      pill={`สายพานคัดแยก · ${Math.min(idx + (done ? 0 : 1), items.length)}/${items.length}`}
      onBack={onExit}
      label="สายพานคัดแยก 30 วินาที"
      dock={
        !started ? (
          <Cta tone="gold" onClick={() => setStarted(true)}>
            เริ่มจับเวลา 30 วินาที →
          </Cta>
        ) : done ? (
          <Cta onClick={() => onDone({ total: items.length, firstTry })}>{expired ? 'ไปต่อ ลองกับลูกค้าจริง →' : 'คัดครบแล้ว ไปต่อ →'}</Cta>
        ) : (
          <Cta disabled>ลากป้ายลงถัง หรือแตะถัง</Cta>
        )
      }
    >
      <Panel
        className="m3s-drill"
        kicker="ฝึกหมวดที่พลาด"
        aside={
          <span className={cn('m3s-clock', seconds <= 10 && started && !done && 'is-hurry')} role="timer" aria-label={`เหลือ ${seconds} วินาที`}>
            <i style={{ width: `${(seconds / SECONDS) * 100}%` }} />
            <b>{seconds} วินาที</b>
          </span>
        }
      >
        <div className="m3s-belt">
          <div className={cn('m3s-belt-track', started && !done && !reduce && 'is-moving')} aria-hidden />
          <AnimatePresence mode="wait">
            {item && !expired ? (
              <motion.div
                key={idx}
                className="m3s-belt-slot"
                initial={reduce ? false : { x: '120%' }}
                animate={{ x: 0 }}
                exit={reduce ? undefined : { y: 60, opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              >
                <button
                  key={`${idx}-${shake}`}
                  type="button"
                  {...p}
                  className={cn('m3s-parcel', p?.className, shake > 0 && missed && 'is-shake')}
                  aria-label={`ป้าย ${EXAMPLE[item.label] ?? item.label}`}
                >
                  <span dir="auto">{EXAMPLE[item.label] ?? item.label}</span>
                </button>
              </motion.div>
            ) : (
              <motion.p key="end" className="m3s-belt-end" initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                {expired ? `หมดเวลา คัดได้ ${idx} จาก ${items.length}` : `ถูกตั้งแต่ครั้งแรก ${firstTry} จาก ${items.length}`}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="m3s-bins">
          {bins.map((b, i) => {
            const z = dd.zoneProps(b.id)
            return (
              <button
                key={b.id}
                type="button"
                data-drop={b.id}
                className={cn(z.className, 'm3s-bin', `cat-${i}`, flash?.bin === b.id && (flash.ok ? 'is-ok' : 'is-bad'))}
                onClick={() => sort(b.id)}
                disabled={!started || done}
              >
                <span className="m3s-bin-lid" aria-hidden />
                <b>{b.label}</b>
                <small>ชั้น {i + 1}</small>
              </button>
            )
          })}
        </div>
      </Panel>
      <DomeSay live>
        {!started
          ? 'ป้ายโดเมนจริงจะไหลมาบนสายพาน ลากลงถังหมวดที่ใช่ภายใน 30 วินาที'
          : done
            ? expired
              ? 'หมดเวลาแล้ว ไม่เป็นไร ไปลองกับลูกค้าจริงกัน'
              : 'คัดได้ไวมาก ไปต่อกันเลย'
            : flash && !flash.ok
              ? 'ยังไม่ใช่ถังนี้ ดูท้ายชื่อแล้วนึกว่าใครจดได้'
              : 'ดูท้ายชื่อ แล้วนึกถึงตึก 3 ชั้น'}
      </DomeSay>
    </M3Stage>
  )
}

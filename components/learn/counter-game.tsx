'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConveyorDrill, type DrillItem } from './game-ui/conveyor-drill'
import { CounterFinalSelf, CounterOnboarding } from './game-ui/counter-prep'
import { Cta, DomeSay, M3Stage, Panel, sfx } from './game-ui/counter-shell'
import { PixelReport, PixelShift } from './game-ui/pixel-counter'
import type { ProgressStore, ShiftProgress } from './game-ui/shift-progress'
import { isFreshM3Shift, M3_CUSTOMER_POOL_SIZE, M3_SHIFT_SIZE, readM3Seen, rememberM3Customers } from './m3-customer-rotation'
import {
  COUNTER_LEVELS,
  type CounterCase,
  type CounterCategory,
  type CounterData,
  type CounterDecision,
  type CounterDetail,
  type CounterLevel,
  type CounterRuntimeSettings,
  type CounterStepResult,
} from './counter-types'

export type { CounterData, CounterLevel } from './counter-types'

/**
 * เกมลงมือทำ ด่าน 3 — เคาน์เตอร์รับจดโดเมน
 *
 * S01–S08 เริ่มภารกิจ บทฝึก เตรียมตัว → กะเคาน์เตอร์แบบ Pixel Counter (game-ui/pixel-counter.tsx)
 * → S17 ลูกค้าคนสุดท้ายคือตัวเอง → รายงานจบกะ → S20 สายพานฝึกซ้ำ
 * ⚠️ ไม่มีเฉลยในไฟล์นี้ ตรวจทีละลูกค้าผ่าน `onCheck` และส่งทั้งกะครั้งเดียวผ่าน `onSubmit`
 */

type SubmitResult = { score: number; passed: boolean; detail: unknown }

function isDetail(value: unknown): value is CounterDetail {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as CounterDetail).cases) &&
    typeof (value as CounterDetail).tagAccuracy === 'number'
  )
}

type ViewDomain = { name: string; role: string; label: string }
type ViewCase = Omit<CounterCase, 'domains'> & { domains: ViewDomain[] }

function toView(c: CounterCase): ViewCase {
  return { ...c, domains: c.domains.map((d) => ({ ...d, label: d.name })) }
}

function pickWeak(groups: CounterDetail['groups'] | undefined): CounterCategory[] {
  const weak = (groups ?? []).filter((g) => g.total > 0 && g.correct / g.total < 0.8)
  return weak.map((g) => g.category)
}

function buildDrill(data: CounterData, focus: CounterCategory[]): DrillItem[] {
  const pool = data.handbook.flatMap((f) =>
    f.rows.flatMap((r) => r.suffix.split(/\s+/).filter(Boolean).map((label) => ({ label, bin: f.category as string }))),
  )
  const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5)
  const mine = shuffle(pool.filter((i) => focus.includes(i.bin as CounterCategory)))
  const other = shuffle(pool.filter((i) => !focus.includes(i.bin as CounterCategory)))
  return shuffle([...mine.slice(0, 6), ...other.slice(0, 2)])
}

type Stage = 'onboarding' | 'play' | 'final' | 'report' | 'drill' | 'practice' | 'transition' | 'ready'

export function CounterGame({
  data,
  practiceData,
  onSubmit,
  onCheck,
  onNewShift,
  studentId,
  level,
  shopName,
  business,
  onExit,
  onFinish,
  replay,
  settings,
}: {
  data: CounterData
  /** ลูกค้าตัวอย่าง c6 ใช้เฉพาะ tutorial ไม่ส่งเข้า scorer/rotation */
  practiceData?: CounterData | null
  onSubmit: (payload: unknown) => Promise<SubmitResult>
  /** ตรวจทีละลูกค้า (action: 'step') ถ้าไม่ส่งมา เกมจะไม่มีรอบลองแก้ */
  onCheck?: (decision: CounterDecision) => Promise<CounterStepResult>
  /** เริ่มกะใหม่: เซิร์ฟเวอร์จับลูกค้าชุดใหม่ (ไม่ส่ง = ใช้ชุดเดิม) */
  onNewShift?: () => Promise<CounterData['cases']>
  /** ใช้จำว่าเคยดูบทแนะนำแล้ว (ต่อนักเรียน) */
  studentId?: string
  /** เปิดจากปุ่มเล่นซ้ำหลังจบด่าน — จับลูกค้าชุดใหม่ก่อนเริ่มกะ */
  replay?: boolean
  /** ค่าตั้งของครูที่เซิร์ฟเวอร์ snapshot ไว้ให้กะนี้ */
  settings?: CounterRuntimeSettings | null
  /** ระดับตามคะแนนวอร์มอัพ ไม่ส่ง = ใช้ค่าในเนื้อหา */
  level?: CounterLevel
  /** ธุรกิจของผู้เล่น ใช้กับลูกค้าคนสุดท้าย (S17) */
  shopName?: string
  business?: string
  /** ปุ่มกลมย้อนกลับ ไม่ส่ง = ถามยืนยันแล้วกลับแผนที่ */
  onExit?: () => void
  /** ผ่านด่านแล้วกดไปต่อ ไม่ส่ง = กลับแผนที่พร้อมฉลองเกาะ */
  onFinish?: () => void
}) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('onboarding')
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [drillItems, setDrillItems] = useState<DrillItem[]>([])
  const [remedialCases, setRemedialCases] = useState<ViewCase[]>([])
  const [practiceKind, setPracticeKind] = useState<'tutorial' | 'remedial'>('tutorial')
  const [stats, setStats] = useState({ handbook: 0, dome: 0 })
  const [selfCard, setSelfCard] = useState<{ extension: string; reason: string } | null>(null)
  const [rounds, setRounds] = useState(0)
  // ความคืบหน้าต่อกะ (key ของ PixelShift) อยู่ที่นี่ — PixelShift ถูก remount กลางกะ (เช่น Fast Refresh)
  // ต้องกลับมาที่ลูกค้าคนเดิม ไม่ใช่คนที่ 1 · กะใหม่ใช้ key ใหม่จึงเริ่มจากศูนย์เอง
  const progressMap = useRef(new Map<string, ShiftProgress>())
  const progressFor = (key: string): ProgressStore => ({
    get: () => progressMap.current.get(key),
    set: (p) => void progressMap.current.set(key, p),
  })
  const bump = (k: 'handbook' | 'dome') => setStats((x) => ({ ...x, [k]: x[k] + 1 }))

  const [shiftCases, setShiftCases] = useState(data.cases)
  const [replayReady, setReplayReady] = useState(!replay)
  const cases = useMemo(() => shiftCases.map((c) => toView(c)), [shiftCases])
  const shiftData = useMemo(() => ({ ...data, cases: shiftCases }), [data, shiftCases])
  const tutorialCases = useMemo(() => (practiceData?.cases.slice(0, 1) ?? []).map((c) => toView(c)), [practiceData])

  function rememberShift(ids: readonly string[]) {
    try {
      const seen = readM3Seen(window.localStorage, studentId)
      rememberM3Customers(window.localStorage, studentId, seen, ids)
    } catch {
      /* localStorage is optional; server shift history is authoritative */
    }
  }

  async function freshShift(): Promise<CounterData['cases']> {
    if (!onNewShift) return shiftCases
    const seen = (() => {
      try {
        return readM3Seen(window.localStorage, studentId)
      } catch {
        return []
      }
    })()
    let last: CounterData['cases'] = []
    // The server excludes every previous shift. The small retry loop also protects
    // students whose local history is ahead of an older server event stream.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      last = await onNewShift()
      const ids = last.map((c) => c.id)
      if (isFreshM3Shift(ids, seen) || seen.length >= M3_CUSTOMER_POOL_SIZE) {
        rememberShift(ids)
        return last
      }
    }
    rememberShift(last.map((c) => c.id))
    return last
  }

  useEffect(() => {
    if (!replay || !onNewShift) return
    let cancelled = false
    setReplayReady(false)
    void freshShift()
      .then((next) => {
        if (!cancelled && next.length >= M3_SHIFT_SIZE) setShiftCases(next)
      })
      .catch(() => {
        /* Keep the server's current shift if a replay refresh cannot reach the API. */
      })
      .finally(() => {
        if (!cancelled) setReplayReady(true)
      })
    return () => {
      cancelled = true
    }
    // Replay is intentionally a one-time preparation step for this mounted run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay])

  const lv = settings
    ? { handbookSeconds: settings.handbookSeconds, hints: settings.hints }
    : level ? COUNTER_LEVELS[level] : { handbookSeconds: data.handbookSeconds, hints: data.hintsPerShift }
  const detail = result && isDetail(result.detail) ? result.detail : null

  async function finishShift(all: CounterDecision[]) {
    const r = await onSubmit({ decisions: all })
    rememberShift(shiftCases.map((c) => c.id))
    setResult(r)
    setStage(selfCard ? 'report' : 'final')
  }

  function startRemedial() {
    const byId = new Map((detail?.cases ?? []).map((c) => [c.caseId, c]))
    const missed = cases.filter((c) => {
      const r = byId.get(c.id)
      return r && !(r.stampCorrect && r.tagsCorrect === r.tagsTotal)
    })
    setRemedialCases(missed.slice(0, 2))
    setPracticeKind('remedial')
    progressMap.current.delete('practice')
    const weak = pickWeak(detail?.groups)
    setDrillItems(buildDrill(data, weak.length > 0 ? weak : data.categories.map((c) => c.id)))
    setStage('drill')
  }

  /** เข้ากะใหม่ด้วยลูกค้าชุดใหม่ (สุ่มที่เซิร์ฟเวอร์) ล้มเหลว = ใช้ชุดเดิม */
  async function reshuffle() {
    if (onNewShift) {
      try {
        const next = await freshShift()
        if (next.length > 0) setShiftCases(next)
      } catch {
        /* เน็ตล้ม: เล่นชุดเดิมต่อ เซิร์ฟเวอร์ยังตรวจกับกะเดิม */
      }
    }
    setSelfCard(null)
    newShift()
  }

  function newShift() {
    setResult(null)
    setStats({ handbook: 0, dome: 0 })
    setRounds((n) => n + 1)
    setRun((n) => n + 1)
    setStage('play')
  }

  const finish = onFinish ?? (() => router.push('/map?done=m3'))

  if (stage === 'onboarding') {
    if (!replayReady) {
      return (
        <M3Stage pill="กำลังจัดคิว" onBack={onExit} bg="counter">
          <Panel kicker="รอสักครู่นะ" title="กำลังจับลูกค้าชุดใหม่">
            <p className="m3s-lead">รอบเล่นซ้ำจะไม่เรียกลูกค้าคนเดิม จนกว่าคลังลูกค้าจะครบทุกคน</p>
          </Panel>
        </M3Stage>
      )
    }
    return (
      <CounterOnboarding
        data={shiftData}
        replay={replay}
        onReady={() => {
          rememberShift(shiftCases.map((c) => c.id))
          setStage(replay || settings?.practiceEnabled === false ? 'play' : 'practice')
        }}
        onPracticeAgain={() => {
          setPracticeKind('tutorial')
          setStage('practice')
        }}
        onExit={onExit}
      />
    )
  }

  if (stage === 'transition') {
    return (
      <M3Stage
        pill="ต่อไป: รอบจริง"
        onBack={onExit}
        bg="counter"
        dock={<Cta onClick={newShift}>เริ่มรอบจริง →</Cta>}
      >
        <Panel kicker="บทฝึกจบแล้ว" title="ฝึกเสร็จแล้ว! ต่อไปของจริง 2 คน นับคะแนน">
          <p className="m3s-lead">ลูกค้าฝึกไม่นับคะแนน รอบถัดไปคือการรับลูกค้าของจริง 2 คน</p>
        </Panel>
        <DomeSay>พร้อมแล้วครับ รอบจริงถามให้ครบ แล้วตัดสินตามคู่มือได้เลย</DomeSay>
        <button type="button" className="m3s-link" onClick={() => { setPracticeKind('tutorial'); setStage('practice') }}>
          ฝึกอีกครั้ง
        </button>
      </M3Stage>
    )
  }

  if (stage === 'final') {
    return (
      <CounterFinalSelf
        shopName={shopName}
        business={business}
        onExit={onExit}
        onDone={(card) => {
          sfx('win')
          setSelfCard(card)
          setStage('report')
        }}
      />
    )
  }

  if (stage === 'report' && result) {
    return (
      <PixelReport
        data={shiftData}
        result={result}
        stats={stats}
        selfCard={selfCard}
        rounds={rounds}
        weak={pickWeak(detail?.groups)}
        onExit={onExit}
        onRemedial={startRemedial}
        onRetry={() => void reshuffle()}
        onFinish={finish}
      />
    )
  }

  if (stage === 'drill') {
    return (
      <ConveyorDrill
        items={drillItems}
        bins={data.categories.map((c) => ({ id: c.id, label: c.label }))}
        onExit={onExit}
        onDone={() => setStage(remedialCases.length > 0 ? 'practice' : 'ready')}
      />
    )
  }

  if (stage === 'ready') {
    return (
      <M3Stage pill="ฝึกเสร็จแล้ว" onBack={onExit} bg="counter" dock={<Cta onClick={newShift}>เข้ากะใหม่ →</Cta>}>
        <Panel kicker="พร้อมแล้ว" title="ลูกค้าชุดเดิมกลับมาอีกรอบ">
          <p className="m3s-lead">คุณฝึกหมวดที่พลาดแล้ว เข้ากะใหม่เพื่อส่งรายงานปิดกะอีกครั้ง</p>
        </Panel>
        <DomeSay>รอบนี้ถามว่าเขาเป็นใครก่อนทุกครั้งนะครับ แล้วเปิดคู่มือเมื่อไม่แน่ใจ</DomeSay>
      </M3Stage>
    )
  }

  if (stage === 'practice') {
    const isTutorial = practiceKind === 'tutorial'
    return (
      <PixelShift
        key={isTutorial ? 'tutorial' : 'practice'}
        data={isTutorial ? practiceData ?? shiftData : shiftData}
        cases={isTutorial ? tutorialCases : remedialCases}
        practice
        practiceLabel={isTutorial ? 'ลูกค้าฝึก · ยังไม่นับคะแนน' : undefined}
        hbSeconds={lv.handbookSeconds}
        hintsTotal={lv.hints}
        runtime={settings ?? undefined}
        onCheck={onCheck}
        onExit={onExit}
        onComplete={async () => setStage(isTutorial ? 'transition' : 'ready')}
        progress={progressFor(isTutorial ? 'tutorial' : 'practice')}
        tutorial={isTutorial}
      />
    )
  }

  return (
    <PixelShift
      key={`run-${run}`}
      data={shiftData}
      cases={cases}
      hbSeconds={lv.handbookSeconds}
      hintsTotal={lv.hints}
      runtime={settings ?? undefined}
      onCheck={onCheck}
      onStat={bump}
      onExit={onExit}
      onComplete={finishShift}
      onRestart={reshuffle}
      progress={progressFor(`run-${run}`)}
    />
  )
}

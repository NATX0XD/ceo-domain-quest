'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConveyorDrill, type DrillItem } from './game-ui/conveyor-drill'
import { CounterFinalSelf, CounterOnboarding } from './game-ui/counter-prep'
import { Cta, DomeSay, M3Stage, Panel, sfx } from './game-ui/counter-shell'
import { PixelReport, PixelShift, coachKey } from './game-ui/pixel-counter'
import {
  COUNTER_LEVELS,
  type CounterCase,
  type CounterCategory,
  type CounterData,
  type CounterDecision,
  type CounterDetail,
  type CounterLevel,
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

type Stage = 'onboarding' | 'play' | 'final' | 'report' | 'drill' | 'practice' | 'ready'

export function CounterGame({
  data,
  onSubmit,
  onCheck,
  onNewShift,
  studentId,
  level,
  shopName,
  business,
  onExit,
  onFinish,
}: {
  data: CounterData
  onSubmit: (payload: unknown) => Promise<SubmitResult>
  /** ตรวจทีละลูกค้า (action: 'step') ถ้าไม่ส่งมา เกมจะไม่มีรอบลองแก้ */
  onCheck?: (decision: CounterDecision) => Promise<CounterStepResult>
  /** เริ่มกะใหม่: เซิร์ฟเวอร์จับลูกค้าชุดใหม่ (ไม่ส่ง = ใช้ชุดเดิม) */
  onNewShift?: () => Promise<CounterData['cases']>
  /** ใช้จำว่าเคยดูบทแนะนำแล้ว (ต่อนักเรียน) */
  studentId?: string
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
  const [practiceCases, setPracticeCases] = useState<ViewCase[]>([])
  const [stats, setStats] = useState({ handbook: 0, dome: 0 })
  const [selfCard, setSelfCard] = useState<{ extension: string; reason: string } | null>(null)
  const [rounds, setRounds] = useState(0)
  const bump = (k: 'handbook' | 'dome') => setStats((x) => ({ ...x, [k]: x[k] + 1 }))

  const [shiftCases, setShiftCases] = useState(data.cases)
  const cases = useMemo(() => shiftCases.map((c) => toView(c)), [shiftCases])
  const shiftData = useMemo(() => ({ ...data, cases: shiftCases }), [data, shiftCases])
  // บทแนะนำครั้งแรก: อ่านครั้งเดียวตอนเปิด (กัน StrictMode เรียก effect ซ้ำ)
  const [coach, setCoach] = useState(false)
  const coachRead = useRef(false)
  useEffect(() => {
    if (coachRead.current) return
    coachRead.current = true
    try {
      setCoach(window.localStorage.getItem(coachKey(studentId)) !== '1')
    } catch {
      setCoach(false)
    }
  }, [studentId])
  const coachDone = () => {
    setCoach(false)
    try {
      window.localStorage.setItem(coachKey(studentId), '1')
    } catch {
      /* ไม่มีที่เก็บก็แค่แสดงซ้ำ */
    }
  }
  const lv = level ? COUNTER_LEVELS[level] : { handbookSeconds: data.handbookSeconds, hints: data.hintsPerShift }
  const detail = result && isDetail(result.detail) ? result.detail : null

  async function finishShift(all: CounterDecision[]) {
    const r = await onSubmit({ decisions: all })
    setResult(r)
    setStage(selfCard ? 'report' : 'final')
  }

  function startRemedial() {
    const byId = new Map((detail?.cases ?? []).map((c) => [c.caseId, c]))
    const missed = cases.filter((c) => {
      const r = byId.get(c.id)
      return r && !(r.stampCorrect && r.tagsCorrect === r.tagsTotal)
    })
    setPracticeCases(missed.slice(0, 2))
    const weak = pickWeak(detail?.groups)
    setDrillItems(buildDrill(data, weak.length > 0 ? weak : data.categories.map((c) => c.id)))
    setStage('drill')
  }

  /** เข้ากะใหม่ด้วยลูกค้าชุดใหม่ (สุ่มที่เซิร์ฟเวอร์) ล้มเหลว = ใช้ชุดเดิม */
  async function reshuffle() {
    if (onNewShift) {
      try {
        const next = await onNewShift()
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
    return <CounterOnboarding data={shiftData} onReady={() => setStage('play')} onExit={onExit} />
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
        onDone={() => setStage(practiceCases.length > 0 ? 'practice' : 'ready')}
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
    return (
      <PixelShift
        key="practice"
        data={shiftData}
        cases={practiceCases}
        practice
        hbSeconds={lv.handbookSeconds}
        hintsTotal={lv.hints}
        onCheck={onCheck}
        onExit={onExit}
        onComplete={async () => setStage('ready')}
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
      onCheck={onCheck}
      onStat={bump}
      onExit={onExit}
      onComplete={finishShift}
      tutorial={coach && run === 0}
      onTutorialDone={coachDone}
      onRestart={reshuffle}
    />
  )
}

'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertIcon, Card, EmptyState, UsersIcon, cn } from '../../../components/ui'
import { Icon3d, InfoTip, type Icon3dName } from '../_ux/v2'
import { LevelBadge, Legend, StatTile, StatusBadge, statusFromRate } from '../_ux/ui'
import { BarList, ColorBar, LikertDist } from '../_ux/data-viz'

/**
 * T-11 รายงานรายห้อง — ตัวเลขที่เอาขึ้นสไลด์ได้จริง
 *
 * ⚠️ **หน้านี้ไม่คำนวณสถิติเองแม้แต่ค่าเดียว** ทุกตัวเลขมาจาก `/api/teacher/report/class`
 *    ซึ่งคิดที่ core/efficiency · core/statistics · core/report ที่เดียว
 *    ถ้าหน้าจอคิดเองจะมีสองแหล่งความจริง แล้วเลขบนสไลด์กับบนจอจะไม่ตรงกัน
 * ⚠️ ปุ่มคัดลอกส่งออกเป็นข้อความล้วน ไม่มีชื่อนักเรียน — เอาไปวางในเอกสารผลการทดลองได้เลย
 */

interface EfficiencyValue {
  sum: number
  n: number
  mean: number
  max: number
  percent: number
  meetsStandard: boolean
  reason: string | null
}

interface Descriptive {
  n: number
  mean: number
  sd: number | null
  min: number | null
  max: number | null
}

/** ร้อยละความตรงกันของคะแนน 2 แหล่ง (core/statistics.agreementRate) */
interface AgreementValue {
  pairCount: number
  exactCount: number
  withinOneCount: number
  exactPercent: number
  withinOnePercent: number
}

interface ClassReport {
  classroomId: string
  /** E-16 ตัวเลขชุดนี้มาจากห้องสาธิต (นักเรียนหุ่น) */
  isDemo?: boolean
  headcount: number
  efficiency: {
    e1: EfficiencyValue
    e2: EfficiencyValue
    label: string
    standardLabel: string
    meetsStandard: boolean
    summary: string
  }
  tests: {
    quizMax: number
    pre: Descriptive
    post: Descriptive
    pairedTTest: {
      n: number
      df: number
      meanDiff: number
      sdDiff: number | null
      t: number | null
      p: number | null
      alpha: number
      significant: boolean | null
      direction: string
      reason: string | null
    }
    /**
     * ⚠️ **มีสถิติ 2 ตัวที่คนเรียกว่า "g" และไม่เท่ากัน** หยิบสลับกันคือรายงานผิดต่อกรรมการ
     *   `effectSize.hedgesG`    = Hedges' g  ขนาดอิทธิพลที่แก้อคติกลุ่มเล็กแล้ว
     *   `normalizedGain.hakeG`  = คะแนนพัฒนาการแบบปรับมาตรฐานของ Hake
     * ทุกที่บนจอและในข้อความที่คัดลอก ต้องเขียนชื่อเจ้าของสูตรกำกับเสมอ ห้ามเขียน "g" เปล่า ๆ
     */
    effectSize: {
      d: number | null
      level: string | null
      reason: string | null
      hedgesG: number | null
      hedgesLevel: string | null
      hedgesReason: string | null
    }
    normalizedGain: {
      /** ค่าเดียวกับ `hakeG` — เก็บไว้เพื่อความเข้ากันได้ ห้ามใช้ชื่อนี้ในข้อความที่คนอ่าน */
      g: number | null
      hakeG: number | null
      prePercent: number
      postPercent: number
      level: string | null
      meetsTarget: boolean | null
      reason: string | null
    }
    /** สถิติตัวที่ 6 ของสเปกข้อ 9.4 — ร้อยละความตรงกันของคะแนนรายด้าน */
    agreement?: {
      aiVsTeacher: AgreementValue
      selfVsTeacher: AgreementValue
    } | null
  }
  objectives: Record<string, number>
  /** ร้อยละต่อจุดประสงค์ที่ API คิดมาให้แล้ว */
  objectivePercents?: Record<string, number>
  avgStars: number
  avgGain: number
  objectiveGaps: {
    objectiveId: string
    passedCount: number
    headcount: number
    passRate: number
    advice: string
    /** บทสอนซ่อม 3 นาทีของเรื่องนี้ (สเปกข้อ 11.12) — null = ไฟล์เนื้อหายังไม่มีให้ */
    miniLesson?: { id: string; minutes: string[] } | null
    /** คำถามชวนคิดตามความเข้าใจผิดที่เจอบ่อย — **เป็นคำถามล้วน ไม่มีเฉลย** */
    coachQuestions?: { misconception: string; question: string }[]
  }[]
  hardestMissions: { missionId: string; title: string; played: number; passed: number; passRate: number; attemptsMean: number }[]
  helperEffectiveness: { route: string; used: number; passed: number; passRate: number; hintsPerMission: number }[]
  personalized: {
    chosenDifferentFromSuggestion: number
    switchedRoute: number
    raisedOwnGoal: number
    teacherOverrides: number
  }
  buddy: { requests: number; helped: number; passedAfterHelp: number } | null
  survey: {
    responses: number
    completed: number
    overallMean: number | null
    /** รายข้อ q1..q8 — สเปกข้อ 9.4 ขอค่าเฉลี่ยกับส่วนเบี่ยงเบนมาตรฐานของความพึงพอใจด้วย */
    items?: Record<string, { n: number; mean: number | null; sd: number | null; distribution?: Record<string, number> }>
    /** ข้อคำถามของแต่ละคีย์ ส่งมาจาก route (อ่านจาก content/survey.json) */
    itemLabels?: Record<string, string>
    /** ข้อความที่ผู้เรียนพิมพ์เอง — ตาราง survey_responses ไม่มีคอลัมน์ระบุตัวผู้ตอบ */
    openEnded?: { like: string[]; improve: string[] }
  } | null
}

/** หนึ่งข้อของแบบทดสอบพร้อมคำแปลที่ครูอ่านแล้วตัดสินใจได้ — มาจาก /api/teacher/report/items */
interface ItemRow {
  itemId: string
  question: string
  objectiveIds: string[]
  correctCount: number
  responseCount: number
  difficulty: number | null
  discrimination: number | null
  difficultyOk: boolean | null
  discriminationOk: boolean | null
  usable: boolean | null
  difficultyNote: string
  discriminationNote: string
  verdict: string
}

interface ItemSet {
  set: 'pre' | 'post'
  label: string
  responders: number
  groupSize: number
  itemCount: number
  usableCount: number
  needsReviewCount: number
  items: ItemRow[]
}

interface ItemAnalysisReport {
  classroomId: string
  criteria: { difficultyMin: number; difficultyMax: number; discriminationMin: number }
  sets: ItemSet[]
}

const OBJECTIVE_NAME: Record<string, string> = {
  'obj-1': 'ข้อ 1 ความหมายและประโยชน์ของชื่อโดเมน',
  'obj-2': 'ข้อ 2 ส่วนประกอบของชื่อเว็บ',
  'obj-3': 'ข้อ 3 ประเภทของนามสกุลโดเมน',
  'obj-4': 'ข้อ 4 เงื่อนไขและขั้นตอนการจดทะเบียน',
  'obj-5': 'ข้อ 5 ตั้งชื่อโดเมนให้ธุรกิจของตัวเองได้ (ครูยืนยันคะแนนแล้ว)',
  'obj-6': 'ข้อ 6 กำกับการเรียนของตัวเองครบวง',
}

/** ชื่อสั้นของจุดประสงค์สำหรับแถบกราฟ — ชื่อเต็มอยู่ในตารางสถิติละเอียด */
const OBJECTIVE_SHORT: Record<string, string> = {
  'obj-1': 'ความหมายโดเมน',
  'obj-2': 'ส่วนประกอบชื่อเว็บ',
  'obj-3': 'ประเภทนามสกุล',
  'obj-4': 'การจดทะเบียน',
  'obj-5': 'ตั้งชื่อให้ธุรกิจ',
  'obj-6': 'กำกับการเรียนเอง',
}

const ROUTE_LABEL: Record<string, string> = {
  clip: 'ดูคลิป',
  card: 'อ่านการ์ด',
  game: 'เล่นเกม',
  buddy: 'เรียนกับเพื่อน',
}

const RATE_LEGEND = [
  { color: 'var(--d-passed)', label: 'ผ่าน ≥80%' },
  { color: 'var(--d-atrisk)', label: 'เสี่ยง 50–79%' },
  { color: 'var(--d-failed)', label: 'ไม่ผ่าน <50%' },
]

/** การ์ดกราฟ: ชื่อ + หน่วย/คำอธิบาย + legend เหนือกราฟ */
function VCard({ title, icon, tip, legend, children }: { title: string; icon: Icon3dName; tip?: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <section className="t2-card" aria-label={title}>
      <h2 className="t2-card-title">
        <Icon3d name={icon} size={28} />
        {title}
        {tip ? <InfoTip label={`เรื่อง${title}`} text={tip} /> : null}
      </h2>
      {legend ? <div className="mb-4">{legend}</div> : null}
      {children}
    </section>
  )
}

function n2(value: number | null | undefined, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '-'
}

/** ข้อความล้วนสำหรับวางลงเอกสารผลการทดลอง — ไม่มีชื่อนักเรียนสักคน */
/** คะแนนพัฒนาการของ Hake — ใช้ `hakeG` เป็นหลัก ตกมาที่ `g` เฉพาะตอนต่อกับ API รุ่นเก่า */
function hakeGainOf(r: ClassReport): number | null {
  return r.tests.normalizedGain.hakeG ?? r.tests.normalizedGain.g
}

/** บรรทัดร้อยละความตรงกันสำหรับข้อความที่คัดลอก — ไม่มีคู่ให้เทียบก็บอกตรง ๆ ไม่ใช่โชว์ 0% */
function agreementLines(r: ClassReport): string[] {
  const a = r.tests.agreement
  if (!a) return []
  const line = (label: string, v: AgreementValue): string =>
    v.pairCount === 0
      ? `  ${label}: ยังไม่มีคู่ให้เทียบ (ครูยังไม่ได้ยืนยันคะแนนใคร)`
      : `  ${label}: ตรงกันพอดี ${n2(v.exactPercent)}% (${v.exactCount}/${v.pairCount} คู่) · ` +
        `ต่างไม่เกิน 1 ระดับ ${n2(v.withinOnePercent)}% (${v.withinOneCount}/${v.pairCount} คู่)`
  return [
    '',
    'ร้อยละความตรงกันของคะแนนรายด้าน (นับเป็นคู่รายเกณฑ์ เฉพาะงานที่ครูยืนยันแล้ว)',
    line('ระบบเสนอเทียบกับครู', a.aiVsTeacher),
    line('ผู้เรียนประเมินตนเองเทียบกับครู', a.selfVsTeacher),
  ]
}

/**
 * ข้อความที่ปุ่ม "คัดลอกตัวเลข" วางให้ — ทางเดียว ทั้งปุ่มบนจอและเทสต์เรียกตัวนี้
 * ข้อความนี้ไปจบบนสไลด์ที่ใช้พูดกับกรรมการ จึงต้องมีเทสต์ล็อกคำเรียกสถิติไว้
 */
export function toPlainText(r: ClassReport, ia: ItemAnalysisReport | null = null): string {
  const lines = [
    // ข้อความนี้ถูกก๊อปไปแปะสไลด์โดยตรง ป้ายเตือนจึงต้องติดมากับตัวข้อความ ไม่ใช่อยู่แค่บนจอ
    ...(r.isDemo
      ? ['*** ตัวเลขชุดนี้มาจากห้องสาธิต (นักเรียนหุ่น) ห้ามใช้อ้างอิงเป็นผลการทดลอง ***', '']
      : []),
    `จำนวนผู้เรียน ${r.headcount} คน`,
    '',
    `ประสิทธิภาพของสื่อ E1/E2 = ${r.efficiency.label} (เกณฑ์ ${r.efficiency.standardLabel}) ${r.efficiency.meetsStandard ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'}`,
    `  E1 ระหว่างเรียน ผลรวม ${r.efficiency.e1.sum} เต็ม ${r.efficiency.e1.max} เฉลี่ย ${n2(r.efficiency.e1.mean)} คิดเป็น ${n2(r.efficiency.e1.percent)}%`,
    `  E2 หลังเรียน   ผลรวม ${r.efficiency.e2.sum} เต็ม ${r.efficiency.e2.max} เฉลี่ย ${n2(r.efficiency.e2.mean)} คิดเป็น ${n2(r.efficiency.e2.percent)}%`,
    '',
    `คะแนนก่อนเรียน  n=${r.tests.pre.n} x̄=${n2(r.tests.pre.mean)} S.D.=${n2(r.tests.pre.sd)} (เต็ม ${r.tests.quizMax})`,
    `คะแนนหลังเรียน n=${r.tests.post.n} x̄=${n2(r.tests.post.mean)} S.D.=${n2(r.tests.post.sd)}`,
    `t-test แบบจับคู่ t=${n2(r.tests.pairedTTest.t, 4)} df=${r.tests.pairedTTest.df} p=${n2(r.tests.pairedTTest.p, 6)} ${
      r.tests.pairedTTest.significant === null
        ? '(คำนวณไม่ได้)'
        : r.tests.pairedTTest.significant
          ? `แตกต่างอย่างมีนัยสำคัญที่ระดับ .${String(r.tests.pairedTTest.alpha).split('.')[1] ?? '05'}`
          : 'ไม่แตกต่างอย่างมีนัยสำคัญ'
    }`,
    /**
     * ข้อความ 3 บรรทัดนี้ถูกก๊อปไปแปะสไลด์ตรง ๆ จึงต้องเขียนชื่อเจ้าของสูตรกำกับทุกตัว
     * เดิมบรรทัดคะแนนพัฒนาการเขียนแค่ `<g>` ซึ่งอ่านแล้วนึกว่า Hedges' g ได้ทันที — คนละค่ากันคนละเรื่องกัน
     */
    `ขนาดอิทธิพล Cohen's d = ${n2(r.tests.effectSize.d, 4)} ระดับ${r.tests.effectSize.level ?? '-'}`,
    `ขนาดอิทธิพลแก้อคติกลุ่มเล็ก Hedges' g = ${n2(r.tests.effectSize.hedgesG, 4)} ระดับ${
      r.tests.effectSize.hedgesLevel ?? (r.tests.effectSize.hedgesReason ?? '-')
    }`,
    `คะแนนพัฒนาการแบบปรับมาตรฐาน Hake's <g> = ${n2(hakeGainOf(r), 4)} ระดับ${r.tests.normalizedGain.level ?? '-'} (ก่อน ${n2(r.tests.normalizedGain.prePercent)}% หลัง ${n2(r.tests.normalizedGain.postPercent)}%)`,
    "  หมายเหตุ: Hedges' g กับ Hake's <g> เป็นคนละสถิติ ค่าไม่เท่ากันและตอบคนละคำถาม",
    ...agreementLines(r),
    '',
    'ผลตามจุดประสงค์ (จำนวนคนที่ผ่าน)',
    ...Object.entries(r.objectives).map(
      ([id, count]) => `  ${OBJECTIVE_NAME[id] ?? id}: ${count}/${r.headcount} คน`,
    ),
    '',
    'หลักฐานการปรับเหมาะ',
    `  เลือกช่องทางต่างจากที่ระบบเสนอ ${r.personalized.chosenDifferentFromSuggestion} คน`,
    `  เปลี่ยนช่องทางระหว่างเรียน ${r.personalized.switchedRoute} คน`,
    `  ยกระดับเป้าหมายของตัวเอง ${r.personalized.raisedOwnGoal} คน`,
    `  ครูแก้การตัดสินใจของระบบ ${r.personalized.teacherOverrides} ครั้ง`,
  ]

  // ค่าความยาก/อำนาจจำแนก คิดแยกชุด A กับ B เสมอ — รวมกันแล้วเลขมั่ว
  for (const set of ia?.sets ?? []) {
    lines.push(
      '',
      `ค่าความยากและอำนาจจำแนกรายข้อ ${set.label} (ทำ ${set.responders} คน)`,
      '  ข้อ\tถูก/ตอบ\tp\tr\tสรุป',
      ...set.items.map(
        (i) =>
          `  ${i.itemId}\t${i.correctCount}/${i.responseCount}\t${n2(i.difficulty)}\t${n2(i.discrimination)}\t${i.verdict}`,
      ),
      `  เกณฑ์ ความยาก ${ia?.criteria.difficultyMin}-${ia?.criteria.difficultyMax} · อำนาจจำแนกตั้งแต่ ${ia?.criteria.discriminationMin} ขึ้นไป`,
      `  ผ่านเกณฑ์ทั้งสองค่า ${set.usableCount} ข้อ · ต้องทบทวน ${set.needsReviewCount} ข้อ จาก ${set.itemCount} ข้อ`,
    )
  }

  return lines.join('\n')
}

export function ClassReportClient({
  classroomId,
  roomCode,
  csvHref,
  initialReport = null,
  initialItemAnalysis = null,
  masterySlot = null,
}: {
  classroomId: string | null
  roomCode: string | null
  csvHref?: string
  /** ใส่ค่าเริ่มต้นได้เพื่อให้เทสต์เรนเดอร์ตรวจตัวเลขได้โดยไม่ต้องยิงเครือข่าย */
  initialReport?: ClassReport | null
  initialItemAnalysis?: ItemAnalysisReport | null
  /** การ์ดเรดาร์ความเข้าใจรายภารกิจ (มาจาก /api/teacher/learn คนละ endpoint) */
  masterySlot?: ReactNode
}) {
  const [report, setReport] = useState<ClassReport | null>(initialReport)
  const [itemReport, setItemReport] = useState<ItemAnalysisReport | null>(initialItemAnalysis)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!classroomId) return
    try {
      const res = await fetch(`/api/teacher/report/class?classroomId=${classroomId}`, { cache: 'no-store' })
      if (res.status === 404) {
        setError('ไม่พบห้องนี้ในบัญชีของคุณ')
        setReport(null)
        return
      }
      if (!res.ok) {
        setError('ดึงรายงานไม่สำเร็จ ลองกดรีเฟรชอีกครั้ง')
        return
      }
      setError(null)
      const data = (await res.json()) as { report: ClassReport }
      setReport(data.report)

      // ค่าความยาก/อำนาจจำแนกอยู่คนละ endpoint เพราะอ่านคนละตาราง — ล้มก็ไม่ควรทำทั้งหน้าพัง
      const itemsRes = await fetch(`/api/teacher/report/items?classroomId=${classroomId}`, {
        cache: 'no-store',
      })
      setItemReport(
        itemsRes.ok
          ? ((await itemsRes.json()) as { itemAnalysis: ItemAnalysisReport }).itemAnalysis
          : null,
      )
    } catch {
      setError('เชื่อมต่อไม่ได้ ลองอีกครั้ง')
    }
  }, [classroomId])

  useEffect(() => {
    void load()
  }, [load])

  // พิมพ์/บันทึก PDF แล้วตารางที่พับไว้ต้องกางครบ ไม่งั้นเอกสารผลการทดลองขาด
  useEffect(() => {
    const closed: HTMLDetailsElement[] = []
    const open = () => {
      document.querySelectorAll<HTMLDetailsElement>('details.t2-more:not([open])').forEach((d) => {
        d.open = true
        closed.push(d)
      })
    }
    const restore = () => {
      closed.splice(0).forEach((d) => (d.open = false))
    }
    window.addEventListener('beforeprint', open)
    window.addEventListener('afterprint', restore)
    return () => {
      window.removeEventListener('beforeprint', open)
      window.removeEventListener('afterprint', restore)
    }
  }, [])

  async function copyNumbers() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(toPlainText(report, itemReport))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  if (!classroomId) {
    return (
      <EmptyState
        title="ยังไม่มีห้องเรียน"
        description="เปิดห้องที่แผงครูก่อน แล้วกลับมาที่หน้านี้"
        illustration={<UsersIcon width={48} height={48} className="text-brand-400" />}
      />
    )
  }

  if (error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-100 p-4 text-body font-semibold text-danger-700">
        <AlertIcon width={22} height={22} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </p>
    )
  }

  if (!report) return <p className="text-body text-ink-muted">กำลังคำนวณรายงานของห้อง…</p>

  const t = report.tests
  const hasPost = (t.post.n ?? 0) > 0
  const gain = hakeGainOf(report)
  const objEntries = Object.entries(report.objectives)
  const survey = report.survey && report.survey.responses > 0 ? report.survey : null
  const dist = (['1', '2', '3', '4', '5'] as const).map((k) => ({
    label: k,
    value: Object.values(survey?.items ?? {}).reduce((a, it) => a + (it.distribution?.[k] ?? 0), 0),
  }))
  const weak = report.objectiveGaps

  return (
    <div className="t2-stack">
      {/* E-16 ต้องติดมากับตัวรายงาน ไม่ใช่แค่หัวจอ — หน้านี้ถูกสั่งพิมพ์และถ่ายรูปขึ้นสไลด์ */}
      {report.isDemo ? (
        <p role="note" className="t2-note" data-tone="danger">
          ตัวเลขชุดนี้มาจากห้องสาธิต (นักเรียนหุ่น) ห้ามใช้อ้างอิงเป็นผลการทดลอง
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-note text-[var(--c-ink-3)]">
          ห้อง {roomCode ?? '-'} · {report.headcount} คน
          <InfoTip
            label="เรื่องที่มาของตัวเลข"
            text="ตัวเลขทุกค่าคำนวณที่ core/ ที่เดียว หน้านี้แสดงอย่างเดียว ส่งออกเป็นข้อความล้วนไม่มีชื่อนักเรียน"
          />
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void load()} className="t2-btn focus-ring">
            คำนวณใหม่
          </button>
          <details className="relative">
            <summary className="t2-btn focus-ring" data-kind="primary" style={{ listStyle: 'none' }}>
              ส่งออก
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid min-w-60 gap-1 rounded-xl border border-[var(--c-line)] bg-white p-2 shadow-[var(--sh-pop)] print:hidden">
              <button type="button" onClick={() => window.print()} className="min-h-10 rounded-lg px-3 text-left text-label font-medium text-[var(--c-ink)] hover:bg-[var(--c-sunken)]">
                พิมพ์ / บันทึกเป็น PDF
              </button>
              <button type="button" onClick={() => void copyNumbers()} className="min-h-10 rounded-lg px-3 text-left text-label font-medium text-[var(--c-ink)] hover:bg-[var(--c-sunken)]">
                {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกตัวเลขทั้งชุด'}
              </button>
              {csvHref ? (
                <Link href={csvHref} className="flex min-h-10 items-center rounded-lg px-3 text-label font-medium text-[var(--c-ink)] hover:bg-[var(--c-sunken)]">
                  ดาวน์โหลด CSV
                </Link>
              ) : null}
            </div>
          </details>
        </div>
      </div>

      {/* ── ตัวเลขหลัก 4 ช่อง */}
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-4">
        <StatTile tone="amber"
          label="ประสิทธิภาพสื่อ E1/E2"
          value={<span className="text-[24px] sm:text-[28px]">{report.efficiency.label}</span>}
          icon={<Icon3d name="trophy" size={30} />}
          badge={
            hasPost ? (
              <StatusBadge status={report.efficiency.meetsStandard ? 'passed' : 'failed'}>
                {report.efficiency.meetsStandard ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่าน'}
              </StatusBadge>
            ) : (
              <StatusBadge status="notstarted">ยังไม่มีข้อมูล</StatusBadge>
            )
          }
          hint={`เกณฑ์ ${report.efficiency.standardLabel}`}
        />
        <StatTile tone="blue"
          label="คะแนนก่อน → หลัง"
          value={
            <span className="text-[24px] sm:text-[28px]">
              {n2(t.pre.mean, 1)} → {n2(t.post.mean, 1)}
            </span>
          }
          icon={<Icon3d name="chart-increasing" size={30} />}
          badge={
            hasPost ? (
              <StatusBadge status={t.post.mean - t.pre.mean >= 0 ? 'passed' : 'failed'}>
                {t.post.mean - t.pre.mean >= 0 ? '▲' : '▼'} {n2(Math.abs(t.post.mean - t.pre.mean), 1)}
              </StatusBadge>
            ) : null
          }
          hint={`เต็ม ${t.quizMax} · หลังเรียน ${t.post.n}/${report.headcount} คน`}
        />
        <StatTile tone="rose"
          label="ขนาดอิทธิพล d"
          value={n2(t.effectSize.d, 2)}
          icon={<Icon3d name="rocket" size={30} />}
          badge={
            t.effectSize.level ? (
              <LevelBadge level={t.effectSize.level === 'ใหญ่' ? 'high' : t.effectSize.level === 'ปานกลาง' ? 'mid' : 'low'}>
                ระดับ{t.effectSize.level}
              </LevelBadge>
            ) : (
              <span>{t.effectSize.reason ?? '-'}</span>
            )
          }
        />
        <StatTile tone="green"
          label="พัฒนาการ Hake ⟨g⟩"
          value={n2(gain, 2)}
          icon={<Icon3d name="seedling" size={30} />}
          badge={
            t.normalizedGain.level ? (
              <LevelBadge level={t.normalizedGain.level === 'สูง' ? 'high' : t.normalizedGain.level === 'ปานกลาง' ? 'mid' : 'low'}>
                ระดับ{t.normalizedGain.level}
              </LevelBadge>
            ) : (
              <span>{t.normalizedGain.reason ?? '-'}</span>
            )
          }
        />
      </div>
      <Legend
        items={[
          { color: 'var(--d-lv-low)', label: 'ระดับน้อย' },
          { color: 'var(--d-lv-mid)', label: 'ปานกลาง' },
          { color: 'var(--d-lv-high)', label: 'ใหญ่ / สูง' },
        ]}
      />

      {/* ── ผ่านเกณฑ์รายด่าน + จุดประสงค์ */}
      <div className="t2-grid-2">
        {masterySlot}
        <VCard title="จุดประสงค์ 6 ข้อ" icon="bullseye" tip="ร้อยละของคนที่ผ่านแต่ละจุดประสงค์ ชื่อเต็มอยู่ในตารางสถิติละเอียดด้านล่าง" legend={<Legend items={RATE_LEGEND} />}>
          <BarList>
            {objEntries.map(([id, count]) => {
              const percent = report.objectivePercents?.[id] ?? 0
              const st = statusFromRate(percent / 100)
              return (
                <ColorBar
                  key={id}
                  color={`var(--d-${st})`}
                  value={percent}
                  display={`${count}/${report.headcount} คน`}
                  label={<span className="truncate">{OBJECTIVE_SHORT[id] ?? id}</span>}
                  mark={<StatusBadge status={st} />}
                />
              )
            })}
          </BarList>
        </VCard>
      </div>

      {/* ── คะแนนเทียบเกณฑ์ · ภารกิจที่ยาก · ช่องทาง · ความพึงพอใจ */}
      <div className="t2-grid">
        <VCard
          title="คะแนนเทียบเกณฑ์"
          icon="chart-increasing"
          tip={`คะแนนเฉลี่ยก่อน-หลังเรียนเทียบคะแนนเต็ม ${t.quizMax} · E1/E2 คือร้อยละของสื่อ เส้นดำคือเกณฑ์ ${report.efficiency.standardLabel}`}
          legend={
            <Legend
              items={[
                { color: 'var(--ch-pre)', label: 'ก่อนเรียน' },
                { color: 'var(--ch-post)', label: 'หลังเรียน' },
                { color: 'var(--d-passed)', label: 'E1/E2 ผ่านเกณฑ์' },
                { color: 'var(--d-failed)', label: 'ไม่ผ่าน' },
              ]}
            />
          }
        >
          <BarList>
            <ColorBar color="var(--ch-pre)" value={t.quizMax > 0 ? (t.pre.mean / t.quizMax) * 100 : 0} display={`${n2(t.pre.mean, 1)}/${t.quizMax}`} label="ก่อนเรียน" />
            <ColorBar color="var(--ch-post)" value={t.quizMax > 0 ? (t.post.mean / t.quizMax) * 100 : 0} display={hasPost ? `${n2(t.post.mean, 1)}/${t.quizMax}` : '-'} label="หลังเรียน" />
            <ColorBar
              color={report.efficiency.e1.percent >= 80 ? 'var(--d-passed)' : 'var(--d-failed)'}
              value={report.efficiency.e1.percent}
              threshold={80}
              display={`${n2(report.efficiency.e1.percent, 1)}%`}
              label="E1 ระหว่างเรียน"
            />
            <ColorBar
              color={!hasPost ? 'var(--d-notstarted)' : report.efficiency.e2.percent >= 80 ? 'var(--d-passed)' : 'var(--d-failed)'}
              value={report.efficiency.e2.percent}
              threshold={80}
              display={hasPost ? `${n2(report.efficiency.e2.percent, 1)}%` : '-'}
              label="E2 หลังเรียน"
            />
          </BarList>
        </VCard>

        <VCard title="ภารกิจที่ยาก" icon="fire" legend={<Legend items={RATE_LEGEND} />}>
          {report.hardestMissions.length === 0 ? (
            <p className="t2-empty">ยังไม่มีใครเล่น</p>
          ) : (
            <BarList>
              {report.hardestMissions.map((m) => {
                const st = statusFromRate(m.passRate)
                return (
                  <ColorBar
                    key={m.missionId}
                    color={`var(--d-${st})`}
                    value={Math.round(m.passRate * 100)}
                    display={`${m.passed}/${m.played}`}
                    label={<span className="truncate">{m.title}</span>}
                    mark={<StatusBadge status={st} />}
                    sub={`ลองเฉลี่ย ${n2(m.attemptsMean, 1)} ครั้ง`}
                  />
                )
              })}
            </BarList>
          )}
        </VCard>

        <VCard title="ช่องทางที่ได้ผล" icon="books" legend={<Legend items={RATE_LEGEND} />}>
          {report.helperEffectiveness.length === 0 ? (
            <p className="t2-empty">ยังไม่มีข้อมูล</p>
          ) : (
            <BarList>
              {report.helperEffectiveness.map((h) => {
                const st = statusFromRate(h.passRate)
                return (
                  <ColorBar
                    key={h.route}
                    color={`var(--d-${st})`}
                    value={Math.round(h.passRate * 100)}
                    label={<span className="truncate">{ROUTE_LABEL[h.route] ?? h.route}</span>}
                    mark={<StatusBadge status={st} />}
                    sub={`ใช้ ${h.used} ครั้ง · คำใบ้ ${n2(h.hintsPerMission, 1)}/ภารกิจ`}
                  />
                )
              })}
            </BarList>
          )}
        </VCard>

        <VCard title="ความพึงพอใจ" icon="sparkles" tip="จำนวนคำตอบรวมทุกข้อ แยกตามคะแนน 1–5">
          {survey ? (
            <>
              <p className="mb-3 flex flex-wrap items-baseline gap-2">
                <span className="text-[28px] leading-9 font-bold tabular-nums text-[var(--c-ink)]">{n2(survey.overallMean, 1)}</span>
                <span className="text-note text-[var(--c-ink-3)]">จาก 5 · ตอบ {survey.responses} คน</span>
              </p>
              <LikertDist items={dist} />
            </>
          ) : (
            <p className="t2-empty">ยังไม่มีคนตอบ</p>
          )}
        </VCard>
      </div>

      {/* ── จุดประสงค์ที่ยังอ่อน + บทสอนซ่อม (กางอ่านเมื่อต้องการ) */}
      <details className="t2-more">
        <summary className="focus-ring">
          <Icon3d name="light-bulb" size={32} />
          ห้องนี้ยังอ่อนเรื่องไหน
          <StatusBadge status={weak.length > 0 ? 'atrisk' : 'passed'}>{weak.length > 0 ? `${weak.length} เรื่อง` : 'ผ่านครบ'}</StatusBadge>
        </summary>
        <div className="t2-more__body">
        {report.objectiveGaps.length > 0 ? (
          <div className="mt-4 rounded-xl bg-spark-100/60 p-3 ring-1 ring-spark-300 ring-inset">
            <h3 className="text-body font-bold text-ink">ห้องนี้ยังอ่อนเรื่องไหน</h3>
            {/*
              API ส่งบทสอนซ่อม 3 นาที + คำถามชวนคิดมาพร้อมกับ advice ตั้งแต่ต้น (สเปกข้อ 11.12)
              แต่จอเคยโชว์แค่ advice — ครูรู้ว่า "ต้องทบทวนเรื่องนี้" แต่ไม่มีของให้หยิบไปสอนจริง
              ⚠️ คำถามชวนคิดเป็นคำถามล้วน ไม่มีเฉลย ตามกติกาในไฟล์เนื้อหา
            */}
            <ul className="mt-1 flex flex-col gap-3">
              {report.objectiveGaps.map((g) => (
                <li key={g.objectiveId} className="text-label text-ink">
                  <p>
                    <span className="font-bold">{OBJECTIVE_NAME[g.objectiveId] ?? g.objectiveId}</span> —{' '}
                    ผ่าน {g.passedCount}/{g.headcount} คน · {g.advice}
                  </p>

                  {g.miniLesson && g.miniLesson.minutes.length > 0 ? (
                    <div className="mt-1.5 rounded-xl bg-surface-raised p-3">
                      <p className="text-note font-bold text-brand-700">
                        สอนซ่อมท้ายคาบ {g.miniLesson.minutes.length} นาที
                      </p>
                      <ol className="mt-1 flex flex-col gap-0.5">
                        {g.miniLesson.minutes.map((step, i) => (
                          <li key={`${g.miniLesson?.id}-${i}`} className="text-note text-ink">
                            นาทีที่ {i + 1} · {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {g.coachQuestions && g.coachQuestions.length > 0 ? (
                    <div className="mt-1.5 rounded-xl bg-surface-raised p-3">
                      <p className="text-note font-bold text-brand-700">
                        ถ้าเด็กเข้าใจผิดแบบนี้ ลองถามแบบนี้ (คำถามล้วน ไม่มีเฉลย)
                      </p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {g.coachQuestions.map((c, i) => (
                          <li key={`${g.objectiveId}-q${i}`} className="text-note text-ink">
                            <span className="text-ink-muted">{c.misconception}</span> → &ldquo;{c.question}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-label font-semibold text-quest-700">ทุกจุดประสงค์ผ่านเกณฑ์ ไม่มีข้อไหนต้องทบทวนซ้ำ</p>
        )}

        </div>
      </details>

      {/* ── ตัวเลขสถิติละเอียด (พิมพ์แล้วกางให้เองทั้งหมด) */}
      <details className="t2-more">
        <summary className="focus-ring">
          <Icon3d name="clipboard" size={32} />
          ตารางสถิติละเอียด
        </summary>
        <div className="t2-more__body">
      {/* ── E1/E2 */}
      <Card as="section" className="mt-4">
        <h2 className="text-title-sm font-bold text-ink">ประสิทธิภาพของสื่อ (E1/E2)</h2>
        <p className="mt-1 text-display font-extrabold text-brand-700">{report.efficiency.label}</p>
        <p className="mt-1 text-body font-semibold text-ink">
          เกณฑ์ {report.efficiency.standardLabel} ·{' '}
          {(report.tests.post.n ?? 0) === 0 ? (
            <span className="text-ink-muted">ยังไม่มีข้อมูล</span>
          ) : (
            <span className={report.efficiency.meetsStandard ? 'text-quest-700' : 'text-danger-700'}>
              {report.efficiency.meetsStandard ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'}
            </span>
          )}
        </p>
        <p className="mt-2 text-body text-ink-muted">{report.efficiency.summary}</p>
        {/* flow-1 ข้อ 18: ครูเห็นคำว่า "ยังไม่ผ่านเกณฑ์" แล้วไม่รู้ว่าแปลว่าอะไรและต้องทำอะไรต่อ */}
        <p className="mt-2 rounded-xl bg-surface-sunken p-3 text-label text-ink">
          ตัวเลขนี้เป็น<strong>คะแนนของสื่อ ไม่ใช่คะแนนของนักเรียน</strong> ·
          E1 = คะแนนระหว่างเรียน · E2 = คะแนนหลังเรียน ·
          จะเชื่อถือได้เมื่อนักเรียนทำครบทั้งแบบทดสอบก่อนเรียนและหลังเรียน
          {report.tests.post?.n !== undefined
            ? ` ตอนนี้มีข้อมูลหลังเรียนครบ ${report.tests.post.n} จาก ${report.headcount} คน`
            : ''}
        </p>

        <table className="mt-3 w-full text-left text-label">
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="py-1">ค่า</th>
              <th scope="col" className="py-1">ผลรวม</th>
              <th scope="col" className="py-1">N</th>
              <th scope="col" className="py-1">เฉลี่ย</th>
              <th scope="col" className="py-1">เต็ม</th>
              <th scope="col" className="py-1">ร้อยละ</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {([['E1 ระหว่างเรียน', report.efficiency.e1], ['E2 หลังเรียน', report.efficiency.e2]] as const).map(
              ([name, v]) => (
                <tr key={name} className="border-t border-line">
                  <th scope="row" className="py-1.5 font-bold">{name}</th>
                  <td className="py-1.5">{v.sum}</td>
                  <td className="py-1.5">{v.n}</td>
                  <td className="py-1.5">{n2(v.mean)}</td>
                  <td className="py-1.5">{v.max}</td>
                  <td className={cn('py-1.5 font-bold', v.meetsStandard ? 'text-quest-700' : 'text-danger-700')}>
                    {n2(v.percent)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </Card>

      {/* ── สถิติก่อน-หลัง */}
      <Card as="section" className="mt-4">
        <h2 className="text-title-sm font-bold text-ink">คะแนนก่อน-หลังเรียน (เต็ม {t.quizMax})</h2>
        <table className="mt-2 w-full text-left text-label">
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="py-1">ชุด</th>
              <th scope="col" className="py-1">n</th>
              <th scope="col" className="py-1">x̄</th>
              <th scope="col" className="py-1">S.D.</th>
              <th scope="col" className="py-1">ต่ำสุด</th>
              <th scope="col" className="py-1">สูงสุด</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {([['ก่อนเรียน', t.pre], ['หลังเรียน', t.post]] as const).map(([name, d]) => (
              <tr key={name} className="border-t border-line">
                <th scope="row" className="py-1.5 font-bold">{name}</th>
                <td className="py-1.5">{d.n}</td>
                <td className="py-1.5 font-bold">{n2(d.mean)}</td>
                <td className="py-1.5">{n2(d.sd)}</td>
                <td className="py-1.5">{d.min ?? '-'}</td>
                <td className="py-1.5">{d.max ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          <Stat
            label="t-test แบบจับคู่"
            value={`t = ${n2(t.pairedTTest.t, 4)}`}
            note={`df = ${t.pairedTTest.df} · p = ${n2(t.pairedTTest.p, 6)}${
              t.pairedTTest.significant === null
                ? ` · ${t.pairedTTest.reason ?? 'คำนวณไม่ได้'}`
                : t.pairedTTest.significant
                  ? ' · แตกต่างอย่างมีนัยสำคัญ'
                  : ' · ไม่แตกต่างอย่างมีนัยสำคัญ'
            }`}
            good={t.pairedTTest.significant === true}
          />
          <Stat
            label="ขนาดอิทธิพล Cohen's d"
            value={n2(t.effectSize.d, 4)}
            note={t.effectSize.level ? `ระดับ${t.effectSize.level}` : (t.effectSize.reason ?? '-')}
            good={t.effectSize.level === 'ใหญ่'}
          />
          {/* Hedges' g = d ที่แก้อคติของกลุ่มเล็กแล้ว ห้องเรียน 6-30 คนคือกรณีที่ตัวแก้นี้มีผลจริง */}
          <Stat
            label="ขนาดอิทธิพลแก้อคติกลุ่มเล็ก Hedges' g"
            value={n2(t.effectSize.hedgesG, 4)}
            note={
              t.effectSize.hedgesLevel
                ? `ระดับ${t.effectSize.hedgesLevel} · คนละตัวกับคะแนนพัฒนาการของ Hake`
                : (t.effectSize.hedgesReason ?? t.effectSize.reason ?? '-')
            }
            good={t.effectSize.hedgesLevel === 'ใหญ่'}
          />
          {/* ป้ายต้องมีคำว่า Hake เสมอ ไม่งั้นอ่านว่า "g" แล้วนึกว่าเป็น Hedges' g ข้างบน */}
          <Stat
            label="คะแนนพัฒนาการแบบปรับมาตรฐาน Hake's ⟨g⟩"
            value={n2(hakeGainOf(report), 4)}
            note={
              t.normalizedGain.level
                ? `ระดับ${t.normalizedGain.level} · ก่อน ${n2(t.normalizedGain.prePercent)}% หลัง ${n2(t.normalizedGain.postPercent)}%`
                : (t.normalizedGain.reason ?? '-')
            }
            good={t.normalizedGain.meetsTarget === true}
          />
        </dl>

        <p className="mt-2 text-note text-ink-muted">
          Hedges&rsquo; g กับ Hake&rsquo;s ⟨g⟩ เป็นคนละสถิติ ค่าไม่เท่ากันและตอบคนละคำถาม —
          ตัวแรกบอกว่าผลต่างก่อน-หลัง <strong>ใหญ่แค่ไหน</strong> ตัวหลังบอกว่าห้องนี้
          <strong>เก็บช่องว่างที่เหลือไปได้กี่ส่วน</strong> เวลาใส่สไลด์ต้องเขียนชื่อเจ้าของสูตรกำกับทุกครั้ง
        </p>
      </Card>

      {/* ── สถิติตัวที่ 6 ของสเปกข้อ 9.4: ร้อยละความตรงกัน */}
      {t.agreement ? (
        <Card as="section" className="mt-4">
          <h2 className="text-title-sm font-bold text-ink">ร้อยละความตรงกันของคะแนนรายด้าน</h2>
          <p className="mt-1 text-note text-ink-muted">
            นับเป็นคู่รายเกณฑ์ เฉพาะงานที่ครูยืนยันคะแนนแล้ว · งานที่ครูยังไม่ตรวจไม่ถูกนับว่า &ldquo;ต่างกัน&rdquo;
          </p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['ระบบเสนอ เทียบกับ ครู', t.agreement.aiVsTeacher],
                ['ผู้เรียนประเมินตนเอง เทียบกับ ครู', t.agreement.selfVsTeacher],
              ] as const
            ).map(([label, value]) => (
              <Stat
                key={label}
                label={label}
                value={value.pairCount === 0 ? '-' : `ตรงกันพอดี ${n2(value.exactPercent)}%`}
                note={
                  value.pairCount === 0
                    ? 'ยังไม่มีคู่ให้เทียบ (ครูยังไม่ได้ยืนยันคะแนนใคร)'
                    : `ต่างไม่เกิน 1 ระดับ ${n2(value.withinOnePercent)}% · จาก ${value.pairCount} คู่รายเกณฑ์`
                }
                good={value.pairCount > 0 && value.exactPercent >= 70}
              />
            ))}
          </dl>
        </Card>
      ) : null}

      {/* ── หลักฐาน personalized + คู่หู + แบบสอบถาม */}
      <Card as="section" className="mt-4">
        <h2 className="text-title-sm font-bold text-ink">หลักฐานการปรับเหมาะและการกำกับตนเอง</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact label="เลือกต่างจากที่ระบบเสนอ" value={`${report.personalized.chosenDifferentFromSuggestion} คน`} />
          <Fact label="เปลี่ยนช่องทางระหว่างเรียน" value={`${report.personalized.switchedRoute} คน`} />
          <Fact label="ยกระดับเป้าหมายเอง" value={`${report.personalized.raisedOwnGoal} คน`} />
          <Fact label="ครูแก้การตัดสินใจของระบบ" value={`${report.personalized.teacherOverrides} ครั้ง`} />
        </dl>

        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact label="ดาวเฉลี่ย" value={n2(report.avgStars)} />
          <Fact label="พัฒนาการเฉลี่ย" value={n2(report.avgGain)} />
          <Fact
            label="คู่หู (ขอ/ช่วยสำเร็จ)"
            value={report.buddy ? `${report.buddy.requests}/${report.buddy.helped}` : '-'}
          />
          <Fact
            label="แบบสอบถาม"
            value={
              report.survey && report.survey.overallMean !== null
                ? `${n2(report.survey.overallMean)} (ตอบ ${report.survey.responses} คน)`
                : 'ยังไม่มีคนตอบ'
            }
          />
        </dl>
      </Card>

      {/* ── ความพึงพอใจรายข้อ (สเปกข้อ 9.4 แถวแรก: ค่าเฉลี่ย/S.D. ของ "ความพึงพอใจ") */}
      {report.survey && report.survey.responses > 0 ? (
        <Card as="section" className="mt-4">
          <h2 className="text-title-sm font-bold text-ink">ความพึงพอใจรายข้อ</h2>
          <p className="mt-1 text-label text-ink-muted">
            ตอบแล้ว {report.survey.responses} คน · ทำครบ {report.survey.completed} คน · เฉลี่ยรวม{' '}
            {n2(report.survey.overallMean)} จาก 5
            {' · '}แบบสอบถามไม่มีคอลัมน์ระบุตัวผู้ตอบตั้งแต่ในฐานข้อมูล
          </p>

          <table className="mt-2 w-full text-left text-label">
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="py-1">ข้อ</th>
                <th scope="col" className="py-1">n</th>
                <th scope="col" className="py-1">x̄</th>
                <th scope="col" className="py-1">S.D.</th>
                <th scope="col" className="py-1">กระจาย 1→5</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {Object.entries(report.survey.items ?? {}).map(([key, item]) => (
                <tr key={key} className="border-t border-line">
                  <th scope="row" className="py-1.5 pr-2 font-semibold">
                    {report.survey?.itemLabels?.[key] ?? key}
                  </th>
                  <td className="py-1.5">{item.n}</td>
                  <td className="py-1.5 font-bold">{n2(item.mean)}</td>
                  <td className="py-1.5">{n2(item.sd)}</td>
                  <td className="py-1.5 tabular-nums text-ink-muted">
                    {(['1', '2', '3', '4', '5'] as const).map((k) => item.distribution?.[k] ?? 0).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ข้อความที่ผู้เรียนพิมพ์เอง — ขึ้นเต็ม ไม่ตัดคำ และไม่มีชื่อใครติดมาด้วย */}
          {(report.survey.openEnded?.like.length ?? 0) + (report.survey.openEnded?.improve.length ?? 0) > 0 ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {(
                [
                  ['สิ่งที่ชอบ', report.survey.openEnded?.like ?? []],
                  ['อยากให้ปรับ', report.survey.openEnded?.improve ?? []],
                ] as const
              ).map(([label, list]) => (
                <div key={label} className="rounded-xl bg-surface-sunken p-3">
                  <p className="text-note font-bold text-ink-muted">
                    {label} ({list.length} ข้อความ)
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {list.map((text, i) => (
                      <li key={`${label}-${i}`} className="text-note text-pretty text-ink">
                        “{text}”
                      </li>
                    ))}
                    {list.length === 0 ? <li className="text-note text-ink-muted">ยังไม่มีใครเขียน</li> : null}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* ── ค่าความยาก p และอำนาจจำแนก r รายข้อ (สเปกข้อ 9.4 สถิติตัวที่ 5) */}
      <Card as="section" className="mt-4">
        <h2 className="text-title-sm font-bold text-ink">ค่าความยาก (p) และอำนาจจำแนก (r) รายข้อ</h2>
        <p className="mt-1 text-label text-ink-muted">
          คิดแยกชุด เพราะแบบทดสอบก่อนเรียนกับหลังเรียนเป็นข้อสอบคู่ขนานคนละฉบับ
          {itemReport
            ? ` · เกณฑ์ ความยาก ${itemReport.criteria.difficultyMin}–${itemReport.criteria.difficultyMax} · อำนาจจำแนกตั้งแต่ ${itemReport.criteria.discriminationMin} ขึ้นไป`
            : null}
        </p>

        {!itemReport ? (
          <p className="mt-3 text-body text-ink-muted">กำลังอ่านคำตอบรายข้อ…</p>
        ) : (
          itemReport.sets.map((set) => (
            <div key={set.set} className="mt-4">
              <h3 className="text-body font-bold text-ink">{set.label}</h3>
              {set.responders === 0 ? (
                <p className="mt-1 text-label text-ink-muted">
                  ยังไม่มีใครทำชุดนี้ · ตัวเลขจะขึ้นเองเมื่อผู้เรียนส่งคำตอบ
                </p>
              ) : (
                <>
                  <p className="mt-1 text-label text-ink-muted">
                    ทำแล้ว {set.responders} คน · ผ่านเกณฑ์ทั้งสองค่า{' '}
                    <span className="font-bold text-quest-700">{set.usableCount}</span> ข้อ · ต้องทบทวน{' '}
                    <span className="font-bold text-danger-700">{set.needsReviewCount}</span> ข้อ จาก{' '}
                    {set.itemCount} ข้อ
                  </p>
                  <p className="mt-1 text-note text-ink-muted">
                    {set.groupSize < 1
                      ? 'อำนาจจำแนกใช้วิธีตัดกลุ่มสูง-กลุ่มต่ำ 27% ต้องมีอย่างน้อย 4 คนจึงแบ่งกลุ่มได้'
                      : `อำนาจจำแนกตัดกลุ่มสูงกับกลุ่มต่ำกลุ่มละ ${set.groupSize} คน (27% ของ ${set.responders} คน)${
                          set.groupSize < 3 ? ' — คนน้อยแบบนี้ค่า r จะกระโดดเป็น 0 หรือ 1 ให้ดูคู่กับค่าความยากด้วย' : ''
                        }`}
                  </p>

                  <table className="mt-2 w-full text-left text-label">
                    <thead>
                      <tr className="text-ink-muted">
                        <th scope="col" className="py-1">ข้อ</th>
                        <th scope="col" className="py-1">ตอบถูก</th>
                        <th scope="col" className="py-1">ความยาก p</th>
                        <th scope="col" className="py-1">อำนาจจำแนก r</th>
                        <th scope="col" className="py-1">อ่านว่าอย่างไร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {set.items.map((item) => (
                        <tr key={item.itemId} className="border-t border-line align-top">
                          <th scope="row" className="py-2 pr-2 font-bold text-ink">
                            {item.itemId}
                            <span className="block max-w-56 text-note font-normal text-ink-muted">
                              {item.question}
                            </span>
                          </th>
                          <td className="py-2 pr-2 text-ink">
                            {item.correctCount}/{item.responseCount}
                          </td>
                          <td
                            className={cn(
                              'py-2 pr-2 font-bold',
                              item.difficultyOk === false ? 'text-danger-700' : 'text-ink',
                            )}
                          >
                            {n2(item.difficulty)}
                          </td>
                          <td
                            className={cn(
                              'py-2 pr-2 font-bold',
                              item.discriminationOk === false ? 'text-danger-700' : 'text-ink',
                            )}
                          >
                            {n2(item.discrimination)}
                          </td>
                          <td className="py-2 text-ink-muted">
                            <span className="block">{item.difficultyNote}</span>
                            <span className="block">{item.discriminationNote}</span>
                            <span
                              className={cn(
                                'mt-0.5 block font-bold',
                                item.usable === false ? 'text-danger-700' : 'text-quest-700',
                              )}
                            >
                              {item.verdict}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          ))
        )}

        <p className="mt-3 text-note text-ink-muted">
          ตารางนี้ไม่บอกว่าข้อไหนเฉลยตัวเลือกใด — แผงครูได้แค่ &ldquo;กี่คนตอบข้อนี้ถูก&rdquo; เท่านั้น
        </p>
      </Card>

        </div>
      </details>
    </div>
  )
}

function Stat({ label, value, note, good }: { label: string; value: string; note: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--c-line)] p-3" style={good ? { background: 'var(--d-passed-soft)' } : { background: 'var(--c-sunken)' }}>
      <dt className="text-note font-medium text-[var(--c-ink-3)]">{label}</dt>
      <dd className="mt-0.5 text-title-sm font-bold text-ink tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-note text-[var(--c-ink-3)]">{note}</dd>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-sunken p-3">
      <dt className="text-note font-bold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-bold text-ink">{value}</dd>
    </div>
  )
}

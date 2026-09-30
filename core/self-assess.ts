/**
 * S-26 + S-33 วงจรประเมินตนเอง 3 แหล่ง — ตรรกะล้วน ไม่แตะฐานข้อมูล ไม่เรียก Date.now()
 *
 * **ตารางคะแนน 3 แหล่ง (ฉันให้ตัวเอง / ระบบเสนอ / ครูยืนยัน) คือหลักฐานตรงตัวของจุดประสงค์ข้อ 6**
 * เดิมมีแต่คอลัมน์กลาง ผู้เรียนติ๊กแค่ว่า "ทำแล้ว" ซึ่งไม่ใช่การประเมินตนเอง
 *
 * กติกาที่ห้ามผิดในไฟล์นี้
 * 1. เกณฑ์ทุกบรรทัดอ่านจาก `content/rubric.json` เท่านั้น **ห้ามฝังเกณฑ์ในโค้ด**
 * 2. **ห้ามมีคำตัดสิน** — ไม่มีคำว่า "ผิด" "ประเมินตัวเองผิด" "สูงไป" "ต่ำไป" "ไม่ตรงความจริง"
 *    ต่างกันคือจุดตั้งต้นของการคุย ไม่ใช่ความผิดของใคร (ดู `JUDGEMENT_WORDS` และเทสต์ที่คุมไว้)
 * 3. คะแนนที่ผู้เรียนให้ตัวเอง **ไม่ถูกเอาไปรวมกับคะแนนครูและไม่มีผลต่อดาว** ตามที่เขียนไว้ในไฟล์เนื้อหา
 */
import rubricJson from '../content/rubric.json' with { type: 'json' }

interface RubricLevelJson {
  score: number
  label: string
  descriptor: string
}

interface RubricDimensionJson {
  id: string
  name: string
  shortName: string
  question: string
  levels: RubricLevelJson[]
}

const dimensionsJson = rubricJson.dimensions as unknown as RubricDimensionJson[]

const selfJson = rubricJson.selfAssessment as unknown as {
  id: string
  prompt: string
  helper: string
  mustCompleteBeforeSeeingAi: boolean
  afterCompareLabel: string
  afterCompareHelper: string
}

export const SELF_ASSESS_DIMENSION_IDS: string[] = dimensionsJson.map((d) => d.id)

/** ช่วงคะแนนต่อด้านตามไฟล์เนื้อหา (ปกติ 1-3) — ไม่ฝังตัวเลขไว้ในโค้ด */
export const SELF_SCORE_MIN = Math.min(...dimensionsJson.flatMap((d) => d.levels.map((l) => l.score)))
export const SELF_SCORE_MAX = Math.max(...dimensionsJson.flatMap((d) => d.levels.map((l) => l.score)))

export interface SelfAssessLevel {
  score: number
  label: string
  descriptor: string
}

export interface SelfAssessDimension {
  id: string
  name: string
  shortName: string
  question: string
  /** เรียงจากคะแนนน้อยไปมาก ผู้เรียนอ่านไล่ขึ้นแล้วเลือกข้อที่ตรงกับงานตัวเอง */
  levels: SelfAssessLevel[]
}

export interface SelfAssessForm {
  id: string
  prompt: string
  helper: string
  min: number
  max: number
  /** ต้องให้คะแนนตัวเองก่อนถึงจะเห็นคะแนนที่ระบบเสนอหรือไม่ (กติกาในไฟล์เนื้อหา) */
  mustCompleteBeforeSeeingAi: boolean
  dimensions: SelfAssessDimension[]
}

/**
 * แบบให้คะแนนตัวเองรายด้าน — ทุกบรรทัดมาจาก content/rubric.json
 * ผู้เรียนเห็น **คำบรรยายระดับจริง** ไม่ใช่แค่ตัวเลข จึงเทียบกับงานตัวเองได้
 */
export function selfAssessForm(): SelfAssessForm {
  return {
    id: selfJson.id,
    prompt: selfJson.prompt,
    helper: selfJson.helper,
    min: SELF_SCORE_MIN,
    max: SELF_SCORE_MAX,
    mustCompleteBeforeSeeingAi: selfJson.mustCompleteBeforeSeeingAi === true,
    dimensions: dimensionsJson.map((d) => ({
      id: d.id,
      name: d.name,
      shortName: d.shortName,
      question: d.question,
      levels: [...d.levels]
        .sort((a, b) => a.score - b.score)
        .map((l) => ({ score: l.score, label: l.label, descriptor: l.descriptor })),
    })),
  }
}

export function levelLabelOf(dimensionId: string, score: number | null): string {
  if (score === null) return ''
  return (
    dimensionsJson
      .find((d) => d.id === dimensionId)
      ?.levels.find((l) => l.score === score)?.label ?? ''
  )
}

export type NormalizedSelfScores =
  | { ok: true; scores: Record<string, number> }
  | { ok: false; message: string }

/**
 * ตรวจคะแนนที่ผู้เรียนให้ตัวเอง — ต้องครบทุกด้านและอยู่ในช่วงของไฟล์เนื้อหา
 * ไม่ครบ = บอกว่าขาดด้านไหน ไม่ใช่ปฏิเสธเฉย ๆ
 */
export function normalizeSelfScores(raw: unknown): NormalizedSelfScores {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, message: 'ยังไม่ได้ให้คะแนนตัวเองสักด้าน' }
  }

  const bag = raw as Record<string, unknown>
  const unknownKeys = Object.keys(bag).filter((id) => !SELF_ASSESS_DIMENSION_IDS.includes(id))
  if (unknownKeys.length > 0) {
    return { ok: false, message: `ไม่รู้จักด้านนี้: ${unknownKeys.join(', ')}` }
  }

  const scores: Record<string, number> = {}
  const missing: string[] = []
  const outOfRange: string[] = []

  for (const dimension of dimensionsJson) {
    const value = Number(bag[dimension.id])
    if (!Number.isFinite(value)) {
      missing.push(dimension.shortName)
      continue
    }
    if (!Number.isInteger(value) || value < SELF_SCORE_MIN || value > SELF_SCORE_MAX) {
      outOfRange.push(dimension.shortName)
      continue
    }
    scores[dimension.id] = value
  }

  if (missing.length > 0) {
    return { ok: false, message: `ยังไม่ได้ให้คะแนนด้าน: ${missing.join(' · ')}` }
  }
  if (outOfRange.length > 0) {
    return {
      ok: false,
      message: `คะแนนต้องอยู่ระหว่าง ${SELF_SCORE_MIN} ถึง ${SELF_SCORE_MAX} — ตรวจด้าน: ${outOfRange.join(' · ')}`,
    }
  }

  return { ok: true, scores }
}

/**
 * คำที่ห้ามโผล่ในข้อความที่ผู้เรียนเห็นจากไฟล์นี้
 * ตารางนี้ไม่ใช่การตัดสินว่าใครมองตัวเองถูกหรือผิด — มันคือจุดตั้งต้นของการคุยกับครู
 */
/**
 * @wired-optional สัญญาเป็นตัวหนังสือว่าห้ามมีคำตัดสินในข้อความชวนคิด — เทสต์เป็นผู้บังคับใช้
 *   ไม่มีเส้นทางไหนต้องเรียกตอนรัน ถ้าลบ เทสต์ที่กันคำตัดสินจะไม่มีรายการอ้างอิง
 */
export const JUDGEMENT_WORDS: string[] = [
  'ผิด',
  'ถูกต้อง',
  'ไม่ตรงความจริง',
  'สูงไป',
  'ต่ำไป',
  'เกินจริง',
  'ประเมินตัวเองผิด',
  'มองตัวเองผิด',
  'ไม่รู้ตัว',
  'เข้าใจผิด',
  'ควรปรับปรุง',
  'แย่',
  'อ่อน',
]

/** ผลของการเทียบหนึ่งด้าน — ไม่มีคำว่าใครถูกใครผิด มีแต่ว่าเท่ากันหรือต่างกันเท่าไร */
export type CompareVerdict =
  /** ให้ตัวเองเท่ากับที่ครูยืนยัน */
  | 'same'
  /** ให้ตัวเองมากกว่าที่ครูยืนยัน */
  | 'self-higher'
  /** ให้ตัวเองน้อยกว่าที่ครูยืนยัน */
  | 'self-lower'
  /** ยังเทียบไม่ได้ เพราะยังขาดคะแนนฝั่งใดฝั่งหนึ่ง */
  | 'not-comparable'

export interface ThreeSourceRow {
  dimensionId: string
  name: string
  shortName: string
  question: string
  /** ฉันให้ตัวเอง */
  self: number | null
  selfLabel: string
  /** ระบบเสนอ */
  system: number | null
  systemLabel: string
  /** ครูยืนยัน */
  teacher: number | null
  teacherLabel: string
  /** ต่างกันกี่ระดับ (ตัวเอง ลบ ครู) null = ยังเทียบไม่ได้ */
  gap: number | null
  verdict: CompareVerdict
  /** ข้อความชวนคิด ไม่ใช่คำตัดสิน */
  note: string
}

export interface ThreeSourceInput {
  self?: Record<string, number> | null
  system?: Record<string, number> | null
  teacher?: Record<string, number> | null
  /** ข้อความที่ครูเขียนถึงผู้เรียนตอนกดยืนยัน */
  teacherNote?: string | null
  /** ครูกดยืนยันแล้วหรือยัง */
  teacherConfirmed?: boolean
}

export type CompareStatus =
  /** ยังไม่ได้ให้คะแนนตัวเอง */
  | 'no-self'
  /** ให้คะแนนตัวเองแล้ว แต่ครูยังไม่ได้ยืนยัน */
  | 'waiting-teacher'
  /** ครบ 3 แหล่ง เทียบได้เต็มตาราง */
  | 'ready'

export interface ThreeSourceTable {
  status: CompareStatus
  rows: ThreeSourceRow[]
  /** ข้อความจากครู แสดงเหนือตาราง */
  teacherNote: string | null
  /** พาดหัวสั้น ๆ ของตาราง */
  headline: string
  /** สรุปภาพรวมแบบไม่ตัดสิน */
  summary: string
  /** ด้านที่ต่างกันตั้งแต่ 1 ระดับขึ้นไป ใช้ตั้งวงคุยกับครู */
  talkingPoints: string[]
  /** จำนวนด้านที่ให้ตัวเองตรงกับครู */
  sameCount: number
  comparableCount: number
}

function pick(bag: Record<string, number> | null | undefined, id: string): number | null {
  const value = Number(bag?.[id])
  return Number.isFinite(value) ? value : null
}

function noteFor(row: {
  shortName: string
  self: number | null
  teacher: number | null
  verdict: CompareVerdict
  teacherConfirmed: boolean
}): string {
  if (row.verdict === 'not-comparable') {
    return row.teacherConfirmed
      ? 'ด้านนี้ยังเทียบไม่ได้ เพราะยังขาดคะแนนอยู่ฝั่งหนึ่ง'
      : 'ครูยังไม่ได้ยืนยันด้านนี้ ไว้ครูยืนยันแล้วค่อยกลับมาดูเทียบกัน'
  }
  if (row.verdict === 'same') {
    return `ด้าน${row.shortName} เธอให้ตัวเอง ${row.self} ครูยืนยัน ${row.teacher} ตรงกันพอดี เธอมองงานตัวเองได้ตรงกับเกณฑ์`
  }
  if (row.verdict === 'self-higher') {
    return `ด้าน${row.shortName} เธอให้ตัวเอง ${row.self} ครูยืนยัน ${row.teacher} ลองอ่านคำบรรยายระดับ ${row.self} อีกรอบแล้วชวนครูคุยได้เลยว่าครูมองจากตรงไหน`
  }
  return `ด้าน${row.shortName} เธอให้ตัวเอง ${row.self} ครูยืนยัน ${row.teacher} ครูเห็นข้อดีที่เธออาจมองข้ามไป ลองอ่านสิ่งที่ครูเขียนแล้วถามครูเพิ่มได้`
}

/**
 * ตารางเทียบ 3 แหล่ง — **ฉันให้ตัวเอง / ระบบเสนอ / ครูยืนยัน**
 *
 * ก่อนครูยืนยันก็เปิดดูได้ แต่จะยังไม่ชวนเทียบ เพราะยังไม่มีคอลัมน์ที่สาม
 * ทุกข้อความที่คืนออกไปเป็นคำชวนคิด **ไม่มีคำตัดสินแม้แต่คำเดียว** (มีเทสต์คุมไว้)
 */
export function compareThreeSources(input: ThreeSourceInput): ThreeSourceTable {
  const teacherConfirmed = input?.teacherConfirmed === true
  const hasSelf = SELF_ASSESS_DIMENSION_IDS.some((id) => pick(input?.self, id) !== null)

  const rows: ThreeSourceRow[] = dimensionsJson.map((dimension) => {
    const self = pick(input?.self, dimension.id)
    const system = pick(input?.system, dimension.id)
    const teacher = teacherConfirmed ? pick(input?.teacher, dimension.id) : null

    const comparable = self !== null && teacher !== null
    const gap = comparable ? self - teacher : null
    const verdict: CompareVerdict = !comparable
      ? 'not-comparable'
      : gap === 0
        ? 'same'
        : gap! > 0
          ? 'self-higher'
          : 'self-lower'

    return {
      dimensionId: dimension.id,
      name: dimension.name,
      shortName: dimension.shortName,
      question: dimension.question,
      self,
      selfLabel: levelLabelOf(dimension.id, self),
      system,
      systemLabel: levelLabelOf(dimension.id, system),
      teacher,
      teacherLabel: levelLabelOf(dimension.id, teacher),
      gap,
      verdict,
      note: noteFor({ shortName: dimension.shortName, self, teacher, verdict, teacherConfirmed }),
    }
  })

  const comparable = rows.filter((r) => r.verdict !== 'not-comparable')
  const sameCount = rows.filter((r) => r.verdict === 'same').length
  const status: CompareStatus = !hasSelf ? 'no-self' : teacherConfirmed ? 'ready' : 'waiting-teacher'

  const headline =
    status === 'no-self'
      ? 'ยังไม่ได้ให้คะแนนตัวเอง'
      : status === 'waiting-teacher'
        ? 'ให้คะแนนตัวเองแล้ว รอครูยืนยัน'
        : 'คะแนน 3 แหล่ง: ฉันให้ตัวเอง · ระบบเสนอ · ครูยืนยัน'

  const summary =
    status === 'no-self'
      ? selfJson.prompt
      : status === 'waiting-teacher'
        ? 'เก็บคะแนนที่เธอให้ตัวเองไว้แล้ว พอครูยืนยันคะแนนเมื่อไร ตารางเทียบ 3 แหล่งจะขึ้นให้ดูทันที'
        : sameCount === comparable.length && comparable.length > 0
          ? `ทั้ง ${comparable.length} ด้าน เธอให้ตัวเองตรงกับที่ครูยืนยันพอดี แปลว่าเธออ่านเกณฑ์แล้วมองงานตัวเองได้ตรง`
          : `ตรงกับครู ${sameCount} จาก ${comparable.length} ด้าน ด้านที่ต่างกันคือจุดที่น่าเอาไปคุยกับครูต่อ ไม่ใช่คะแนนที่ต้องแก้`

  return {
    status,
    rows,
    teacherNote: (input?.teacherNote ?? '').trim() || null,
    headline,
    summary,
    talkingPoints: rows
      .filter((r) => r.verdict === 'self-higher' || r.verdict === 'self-lower')
      .map((r) => r.note),
    sameCount,
    comparableCount: comparable.length,
  }
}

/* ------------------------------------------------------------------ *
 * ธงการรู้ตัว (calibration) รวมเป็นชุดให้ครู — ตัวตัดสินอยู่ที่ core/personalize.ts
 * ------------------------------------------------------------------ */

export interface CalibrationRecordInput {
  /** รหัสจุดประสงค์หรือภารกิจที่บันทึกความมั่นใจไว้ */
  objectiveId: string
  /** ชื่อที่ครูอ่านรู้เรื่อง ไม่ส่งมาก็ใช้รหัสแทน */
  label?: string
  confidence: number
  correct: boolean
}

export interface CalibrationEntry {
  objectiveId: string
  label: string
  confidence: number
  correct: boolean
  flag: 'ควรคุย' | 'ควรชม'
  reason: string
  /** รหัสคำถามโค้ชใน content/coach-prompts.json */
  coachPromptId: string
}

export interface CalibrationSummary {
  /** จำนวนครั้งที่มีข้อมูลครบทั้งความมั่นใจและผล */
  recordCount: number
  shouldTalkCount: number
  shouldPraiseCount: number
  entries: CalibrationEntry[]
  /** ประโยคสรุปสำหรับแผงครู ว่างเมื่อไม่มีธงเลย */
  teacherSummary: string
}

type CalibrationFlagFn = (
  confidence: number,
  correct: boolean,
) => { flag: 'ควรคุย' | 'ควรชม' | null; reason: string | null; coachPromptId: string | null }

/**
 * รวมธงการรู้ตัวของผู้เรียนหนึ่งคนให้ครูอ่านในที่เดียว
 *
 * รับตัวตัดสินเข้ามาเป็นพารามิเตอร์ (`core/personalize.calibrationFlag`) แทนการ import ตรง
 * เพื่อไม่ให้ไฟล์นี้ผูกกับสเกลความมั่นใจ — ถ้าทีมเนื้อหาเปลี่ยนสเกล ตัวตัดสินที่เดียวเปลี่ยนพอ
 *
 * ⚠️ ธงนี้ **ของครู ไม่ใช่ของผู้เรียน** ห้ามส่งไปแสดงบนหน้าจอผู้เรียนเป็นคำตัดสิน
 */
export function calibrationSummary(
  records: readonly CalibrationRecordInput[],
  flagOf: CalibrationFlagFn,
): CalibrationSummary {
  const entries: CalibrationEntry[] = []
  let recordCount = 0

  for (const record of records ?? []) {
    if (!record || typeof record.objectiveId !== 'string') continue
    if (!Number.isFinite(record.confidence) || typeof record.correct !== 'boolean') continue
    recordCount += 1

    const signal = flagOf(record.confidence, record.correct)
    if (!signal?.flag) continue

    entries.push({
      objectiveId: record.objectiveId,
      label: record.label?.trim() || record.objectiveId,
      confidence: record.confidence,
      correct: record.correct,
      flag: signal.flag,
      reason: signal.reason ?? '',
      coachPromptId: signal.coachPromptId ?? '',
    })
  }

  const shouldTalkCount = entries.filter((e) => e.flag === 'ควรคุย').length
  const shouldPraiseCount = entries.filter((e) => e.flag === 'ควรชม').length

  const parts: string[] = []
  if (shouldTalkCount > 0) parts.push(`ควรคุย ${shouldTalkCount} เรื่อง`)
  if (shouldPraiseCount > 0) parts.push(`ควรชม ${shouldPraiseCount} เรื่อง`)

  return {
    recordCount,
    shouldTalkCount,
    shouldPraiseCount,
    entries,
    teacherSummary: parts.join(' · '),
  }
}

/**
 * แปลงสองก้อนที่เก็บใน `profiles` (ความมั่นใจ / ผลถูกผิด รายจุดประสงค์) เป็นรายการที่ส่งเข้า calibrationSummary ได้
 * เอาเฉพาะจุดประสงค์ที่มีครบทั้งสองฝั่ง ที่ขาดข้างใดข้างหนึ่งถือว่ายังไม่มีข้อมูล ไม่ใช่ศูนย์
 */
export function calibrationRecordsFrom(
  confidence: Record<string, unknown> | null | undefined,
  readiness: Record<string, unknown> | null | undefined,
  labels: Record<string, string> = {},
): CalibrationRecordInput[] {
  const rows: CalibrationRecordInput[] = []
  for (const [objectiveId, rawConfidence] of Object.entries(confidence ?? {})) {
    const value = Number(rawConfidence)
    const correct = readiness?.[objectiveId]
    if (!Number.isFinite(value) || typeof correct !== 'boolean') continue
    rows.push({
      objectiveId,
      label: labels[objectiveId] ?? objectiveId,
      confidence: value,
      correct,
    })
  }
  return rows.sort((a, b) => a.objectiveId.localeCompare(b.objectiveId))
}

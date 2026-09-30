/**
 * รูบริก 4 ด้านของภารกิจใหญ่ — โหลดจาก content/rubric.json ซึ่งเป็นแหล่งอ้างอิงเดียว
 *
 * **ห้ามฝังเกณฑ์หรือช่วงคะแนนไว้ในโค้ด** ครูปรับถ้อยคำและตัวเลขในไฟล์เนื้อหาได้เอง
 * ไฟล์นี้ทำแค่ 3 อย่าง: อ่านนิยามด้าน · ถ่วงน้ำหนักด้านที่ผู้เรียนเลือกเน้น · แปลงเป็นดาว
 */
import rubricJson from '../../content/rubric.json' with { type: 'json' }

export interface RubricLevel {
  score: number
  label: string
  descriptor: string
}

export interface RubricDimension {
  id: string
  name: string
  shortName: string
  question: string
  levels: RubricLevel[]
}

export const rubricDimensions = rubricJson.dimensions as unknown as RubricDimension[]

/** รหัสด้านทั้งหมดตามลำดับในไฟล์เนื้อหา ใช้ตรวจว่าให้คะแนนครบทุกด้านแล้ว */
export const RUBRIC_DIMENSION_IDS = rubricDimensions.map((d) => d.id)

const scoring = rubricJson.scoring as {
  weightedMin: number
  weightedMax: number
  notSubmittedStars: number
  starBands: ReadonlyArray<{ stars: number; minWeighted: number; maxWeighted: number }>
}

export const WEIGHTED_MIN = scoring.weightedMin
export const WEIGHTED_MAX = scoring.weightedMax
export const starBands = scoring.starBands

const emphasisOptions = (rubricJson.emphasis as { options: ReadonlyArray<{ id: string; dimensionId: string }> })
  .options

/** คะแนนต่ำสุด/สูงสุดของแต่ละด้านตามไฟล์เนื้อหา (ปกติ 1-3) */
export const DIMENSION_SCORE_MIN = Math.min(
  ...rubricDimensions.flatMap((d) => d.levels.map((l) => l.score)),
)
export const DIMENSION_SCORE_MAX = Math.max(
  ...rubricDimensions.flatMap((d) => d.levels.map((l) => l.score)),
)

export function findDimension(dimensionId: string): RubricDimension | undefined {
  return rubricDimensions.find((d) => d.id === dimensionId)
}

export function levelLabel(dimensionId: string, score: number): string {
  return findDimension(dimensionId)?.levels.find((l) => l.score === score)?.label ?? ''
}

/**
 * แปลงสิ่งที่ผู้เรียนเลือกเน้นให้เป็นรหัสด้าน
 * รับได้ทั้งรหัสตัวเลือก (emphasis-naming) และรหัสด้านตรง ๆ (dim-naming)
 * ไม่รู้จักหรือไม่ได้เลือก คืน null = ไม่ถ่วงด้านไหนเป็นพิเศษ
 */
export function resolveEmphasisDimension(emphasis: string | null | undefined): string | null {
  if (!emphasis) return null
  if (RUBRIC_DIMENSION_IDS.includes(emphasis)) return emphasis
  return emphasisOptions.find((o) => o.id === emphasis)?.dimensionId ?? null
}

export function clampDimensionScore(score: number): number {
  if (!Number.isFinite(score)) return DIMENSION_SCORE_MIN
  return Math.min(DIMENSION_SCORE_MAX, Math.max(DIMENSION_SCORE_MIN, Math.round(score)))
}

/**
 * คะแนนถ่วงน้ำหนัก = (คะแนนด้านที่เลือกเน้น x 2) + คะแนนอีก 3 ด้านรวมกัน
 * สูตรตรงกับ scoring.formula ในไฟล์เนื้อหา ผลอยู่ในช่วง weightedMin..weightedMax เสมอ
 * ไม่ได้เลือกด้านที่เน้น = ไม่ถ่วงใคร แต่ยังบวกคะแนนขั้นต่ำของด้านที่เน้นเข้าไป
 * เพื่อให้ช่วงคะแนนเท่ากันทุกคน คนที่ไม่เลือกจึงไม่เสียเปรียบ
 */
export function weightedTotal(
  scores: Record<string, number>,
  emphasisDimensionId: string | null,
): number {
  const emphasized = resolveEmphasisDimension(emphasisDimensionId)
  let total = 0
  for (const id of RUBRIC_DIMENSION_IDS) {
    const score = clampDimensionScore(scores?.[id] ?? DIMENSION_SCORE_MIN)
    total += id === emphasized ? score * 2 : score
  }
  // ไม่ได้เลือกด้านไหนเลย ให้ถ่วงด้านที่ทำได้ดีที่สุด จะได้ไม่เสียเปรียบคนที่เลือก
  if (!emphasized) {
    const best = Math.max(
      ...RUBRIC_DIMENSION_IDS.map((id) => clampDimensionScore(scores?.[id] ?? DIMENSION_SCORE_MIN)),
    )
    total += best
  }
  return Math.min(WEIGHTED_MAX, Math.max(WEIGHTED_MIN, total))
}

/**
 * แปลงคะแนนถ่วงน้ำหนักเป็นดาว ตาม starBands ในไฟล์เนื้อหาเท่านั้น
 * ส่งงานแล้วต้องได้อย่างน้อย 1 ดาวเสมอ · ยังไม่ส่งงานได้ 0 ดาว
 */
export function starsFromWeighted(total: number, submitted = true): number {
  if (!submitted) return scoring.notSubmittedStars
  const value = Number.isFinite(total) ? total : 0
  const band = starBands.find((b) => value >= b.minWeighted && value <= b.maxWeighted)
  if (band) return band.stars
  const highest = starBands.reduce((a, b) => (a.maxWeighted >= b.maxWeighted ? a : b))
  return value > highest.maxWeighted ? highest.stars : 1
}

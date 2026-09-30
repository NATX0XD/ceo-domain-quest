/**
 * สถิติที่ใช้รายงานผลการทดลองใช้สื่อ — ตรงตามสเปกข้อ 9.4
 *
 * ตารางในสเปกกำหนดไว้ 6 รายการ ไฟล์นี้ทำครบทั้ง 6:
 * 1. ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐาน       -> descriptive()
 * 2. การทดสอบค่าทีแบบกลุ่มตัวอย่างไม่อิสระ  -> pairedTTest()  (รายงาน t, df, p)
 * 3. ขนาดอิทธิพล                            -> effectSize()   (Cohen's d และ Hedges' g)
 * 4. คะแนนพัฒนาการแบบปรับมาตรฐาน            -> normalizedGain()  (ของ Hake)
 * 5. ความยากและอำนาจจำแนกรายข้อ             -> itemAnalysis()
 * 6. ร้อยละความตรงกัน                        -> agreementRate()
 *
 * หลักที่ยึด:
 * - **ตัวเลขต้องจริง** คะแนนหลังเรียนต่ำกว่าก่อนเรียนต้องออกมาติดลบ ห้ามปัดเป็นศูนย์
 * - คำนวณไม่ได้ให้คืน null พร้อม reason ที่อ่านรู้เรื่อง ไม่ใช่คืน 0 ให้เข้าใจผิดว่าวัดแล้วได้ศูนย์
 * - ตรรกะล้วน ไม่ import ไฟล์เนื้อหา ไม่แตะฐานข้อมูล ทดสอบด้วยตัวเลขมือได้ทุกฟังก์ชัน
 * - **มีสถิติ 2 ตัวที่นิยมเรียกว่า "g" และไม่เท่ากัน** จึงตั้งชื่อฟิลด์ให้หยิบผิดไม่ได้
 *     `effectSize().hedgesG`      = Hedges' g  (ขนาดอิทธิพลที่แก้อคติกลุ่มเล็ก)
 *     `normalizedGain().hakeG`    = คะแนนพัฒนาการปรับมาตรฐานของ Hake
 *   ชุดข้อมูลตัวอย่าง 8 คนให้ 0.9538 กับ 0.4878 ตามลำดับ สลับกันคือรายงานผิด
 *
 * ทุกสูตรในไฟล์นี้เป็นสูตรมาตรฐานที่ตรวจย้อนได้ ไม่มีค่าคงที่ลับ ๆ ฝังไว้
 */

/** นัยสำคัญที่สเปกข้อ K5 กำหนด — ส่งค่าอื่นเข้ามาทับได้ถ้าจะรายงานที่ระดับอื่น */
export const DEFAULT_ALPHA = 0.05

/** เกณฑ์ความยากรายข้อที่ใช้ได้ตามสเปกข้อ 9.4 */
export const DIFFICULTY_MIN = 0.2
export const DIFFICULTY_MAX = 0.8

/** เกณฑ์อำนาจจำแนกรายข้อที่ใช้ได้ตามสเปกข้อ 9.4 */
export const DISCRIMINATION_MIN = 0.2

/** สัดส่วนกลุ่มสูง/กลุ่มต่ำที่ใช้หาอำนาจจำแนก (เทคนิค 27% ของ Kelley) */
export const GROUP_FRACTION = 0.27

function finite(values: readonly number[]): number[] {
  return (Array.isArray(values) ? values : []).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  )
}

/** ปัดทศนิยมให้พออ่านบนสไลด์ แต่ยังตรวจย้อนได้ */
export function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export interface Descriptive {
  n: number
  sum: number
  /** ค่าเฉลี่ย — n = 0 คืน 0 */
  mean: number
  /**
   * ส่วนเบี่ยงเบนมาตรฐานของกลุ่มตัวอย่าง (หารด้วย n − 1)
   * ใช้ตัวนี้เพราะห้องที่ทดลองเป็นกลุ่มตัวอย่าง ไม่ใช่ประชากรทั้งหมด
   * n < 2 คำนวณไม่ได้จึงคืน null ไม่ใช่ 0
   */
  sd: number | null
  min: number | null
  max: number | null
}

/** ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐาน ใช้ได้กับคะแนนทุกชนิดและความพึงพอใจ */
export function descriptive(values: readonly number[]): Descriptive {
  const list = finite(values)
  const n = list.length
  if (n === 0) return { n: 0, sum: 0, mean: 0, sd: null, min: null, max: null }

  const sum = list.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const sd =
    n < 2
      ? null
      : Math.sqrt(list.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1))

  return {
    n,
    sum: round(sum, 4),
    mean: round(mean, 4),
    sd: sd === null ? null : round(sd, 4),
    min: Math.min(...list),
    max: Math.max(...list),
  }
}

/** ค่าเฉลี่ยอย่างเดียว ใช้ตอนไม่ต้องการค่าอื่น */
export function meanOf(values: readonly number[]): number {
  return descriptive(values).mean
}

/* ------------------------------------------------------------------ *
 * ฟังก์ชันคณิตศาสตร์สำหรับหาค่า p ของการแจกแจงที
 * ใช้เบตาไม่สมบูรณ์แบบปรับค่า (regularized incomplete beta)
 * P(|T| > t) = I_{df/(df+t²)}(df/2, 1/2)
 * ------------------------------------------------------------------ */

function logGamma(x: number): number {
  // สูตร Lanczos g = 7, n = 9 ความคลาดเคลื่อนต่ำกว่า 1e-13 ในช่วงที่เราใช้
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (x < 0.5) {
    // สูตรสะท้อน สำหรับ x น้อยกว่า 0.5
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  }
  const z = x - 1
  let a = coefficients[0]!
  const t = z + 7.5
  for (let i = 1; i < coefficients.length; i += 1) a += coefficients[i]! / (z + i)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

/** เศษส่วนต่อเนื่องของเบตาไม่สมบูรณ์ (วิธี Lentz แบบปรับปรุง) */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const tiny = 1e-30
  const epsilon = 3e-14
  const maxIterations = 300

  const qab = a + b
  const qap = a + 1
  const qam = a - 1

  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < tiny) d = tiny
  d = 1 / d
  let result = d

  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m

    let numerator = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + numerator * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + numerator / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    result *= d * c

    numerator = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + numerator * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + numerator / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    result *= delta

    if (Math.abs(delta - 1) < epsilon) break
  }

  return result
}

/** เบตาไม่สมบูรณ์แบบปรับค่า I_x(a, b) */
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  )

  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b
}

/**
 * ค่า p สองทางของการแจกแจงที
 * @param t ค่าทีที่คำนวณได้ (ติดลบได้ ใช้ค่าสัมบูรณ์)
 * @param df องศาอิสระ ต้องมากกว่า 0
 */
export function tDistributionTwoTailedP(t: number, df: number): number | null {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return null
  const x = df / (df + t * t)
  return regularizedIncompleteBeta(df / 2, 0.5, x)
}

export interface PairedTTest {
  /** จำนวนคู่ที่มีทั้งคะแนนก่อนและหลัง */
  n: number
  /** องศาอิสระ = n − 1 */
  df: number
  /** ค่าเฉลี่ยผลต่าง (หลัง − ก่อน) ติดลบได้ */
  meanDiff: number
  /** ส่วนเบี่ยงเบนมาตรฐานของผลต่าง */
  sdDiff: number | null
  /** ความคลาดเคลื่อนมาตรฐานของผลต่าง */
  seDiff: number | null
  t: number | null
  p: number | null
  alpha: number
  /** แตกต่างอย่างมีนัยสำคัญที่ระดับ alpha หรือไม่ (null = คำนวณไม่ได้) */
  significant: boolean | null
  /** ทิศทางของผลต่าง ใช้เขียนคำบรรยายใต้ตาราง */
  direction: 'higher' | 'lower' | 'same'
  /** เหตุผลเมื่อคำนวณไม่ได้ ใส่ในรายงานตรง ๆ ได้ */
  reason: string | null
}

/**
 * การทดสอบค่าทีแบบกลุ่มตัวอย่างไม่อิสระ — คะแนนก่อนและหลังเรียนของคนเดียวกัน
 * t = ค่าเฉลี่ยผลต่าง ÷ (ส่วนเบี่ยงเบนมาตรฐานของผลต่าง ÷ √n) · df = n − 1
 *
 * รับเป็นคู่ ๆ เพื่อกันกรณีลำดับสองอาร์เรย์ไม่ตรงกัน
 * คู่ที่ขาดคะแนนข้างใดข้างหนึ่งถูกตัดออก และนับไว้ใน reason
 */
export function pairedTTest(
  pairs: ReadonlyArray<{ pre: number; post: number }>,
  alpha: number = DEFAULT_ALPHA,
): PairedTTest {
  const usable = (Array.isArray(pairs) ? pairs : []).filter(
    (p) =>
      typeof p?.pre === 'number' &&
      Number.isFinite(p.pre) &&
      typeof p?.post === 'number' &&
      Number.isFinite(p.post),
  )
  const diffs = usable.map((p) => p.post - p.pre)
  const stats = descriptive(diffs)
  const n = stats.n
  const meanDiff = stats.mean
  // คำนวณค่า t จากค่าที่ยังไม่ปัดเศษ ไม่งั้นค่า t ที่รายงานจะเพี้ยนตั้งแต่ทศนิยมตำแหน่งที่ 3
  const rawMean = n > 0 ? diffs.reduce((a, b) => a + b, 0) / n : 0
  const rawSd =
    n < 2 ? 0 : Math.sqrt(diffs.reduce((acc, v) => acc + (v - rawMean) ** 2, 0) / (n - 1))
  const direction: PairedTTest['direction'] =
    meanDiff > 0 ? 'higher' : meanDiff < 0 ? 'lower' : 'same'

  const base = {
    n,
    df: Math.max(0, n - 1),
    meanDiff,
    sdDiff: stats.sd,
    alpha,
    direction,
  }

  if (n < 2) {
    return {
      ...base,
      seDiff: null,
      t: null,
      p: null,
      significant: null,
      reason: `ทดสอบค่าทีต้องมีอย่างน้อย 2 คน ตอนนี้มี ${n} คน`,
    }
  }

  const sdDiff = rawSd
  if (sdDiff === 0) {
    // ทุกคนเปลี่ยนแปลงเท่ากันเป๊ะ ตัวหารเป็นศูนย์ คำนวณค่าทีไม่ได้
    return {
      ...base,
      seDiff: 0,
      t: null,
      p: null,
      significant: null,
      reason:
        meanDiff === 0
          ? 'คะแนนก่อนและหลังเท่ากันทุกคน ไม่มีผลต่างให้ทดสอบ'
          : `ผลต่างของทุกคนเท่ากันหมด (${meanDiff}) ส่วนเบี่ยงเบนมาตรฐานเป็น 0 จึงคำนวณค่าทีไม่ได้`,
    }
  }

  const seDiff = sdDiff / Math.sqrt(n)
  const t = rawMean / seDiff
  const p = tDistributionTwoTailedP(t, n - 1)

  return {
    ...base,
    seDiff: round(seDiff, 4),
    t: round(t, 4),
    p: p === null ? null : round(p, 6),
    significant: p === null ? null : p < alpha,
    reason: null,
  }
}

export type EffectLevel = 'เล็ก' | 'ปานกลาง' | 'ใหญ่'

/** เกณฑ์แปลผลขนาดอิทธิพลที่ใช้กันทั่วไปของ Cohen ใช้กับทั้ง d และ Hedges' g */
function effectLevel(value: number): EffectLevel {
  const magnitude = Math.abs(value)
  return magnitude >= 0.8 ? 'ใหญ่' : magnitude >= 0.5 ? 'ปานกลาง' : 'เล็ก'
}

/**
 * ตัวคูณแก้อคติของกลุ่มตัวอย่างเล็กตาม Hedges (1981) — J = 1 − 3/(4·df − 1)
 *
 * df = 1 จะได้ J = 0 ซึ่งไม่มีความหมาย (ตอบ 0 เสมอ) จึงตัดที่ df < 2 แล้วคืน null
 * ห้องเรียนขนาด 8-30 คนคือกรณีที่ตัวคูณนี้มีผลจริง ยิ่งคนน้อย J ยิ่งดึงค่าลง
 */
export function hedgesCorrection(df: number): number | null {
  if (!Number.isFinite(df) || df < 2) return null
  return 1 - 3 / (4 * df - 1)
}

export interface EffectSize {
  /** d = ค่าเฉลี่ยผลต่าง ÷ ส่วนเบี่ยงเบนมาตรฐานของผลต่าง (ตามสเปกข้อ 9.4) */
  d: number | null
  /** แปลผลของ d ตามเกณฑ์ของ Cohen */
  level: EffectLevel | null
  /**
   * **Hedges' g** = d × J เมื่อ J = 1 − 3/(4·df − 1) — คือ Cohen's d ที่แก้อคติของกลุ่มเล็กแล้ว
   *
   * ⚠️ **คนละตัวกับ `normalizedGain.hakeG` (คีย์ `g`)** ซึ่งเป็นคะแนนพัฒนาการของ Hake
   *    สองค่านี้ไม่เท่ากันและตอบคนละคำถาม หยิบสลับกันคือรายงานผิด
   *    ในไฟล์นี้จึงไม่มีฟิลด์ชื่อ `g` เปล่า ๆ ให้หยิบผิดได้เลย
   */
  hedgesG: number | null
  /** แปลผลของ Hedges' g ด้วยเกณฑ์เดียวกับ d (ค่าน้อยกว่า d เสมอ จึงอาจตกระดับได้) */
  hedgesLevel: EffectLevel | null
  /** เหตุผลเมื่อคิด Hedges' g ไม่ได้ ทั้งที่ d คิดได้ (เช่น คนน้อยเกินไป) */
  hedgesReason: string | null
  reason: string | null
}

/** ขนาดอิทธิพลของคะแนนก่อน-หลัง ใช้ผลลัพธ์จาก pairedTTest ต่อได้ตรง ๆ */
export function effectSize(test: PairedTTest): EffectSize {
  if (test?.sdDiff === null || test?.sdDiff === 0 || !Number.isFinite(test?.meanDiff)) {
    const reason = test?.reason ?? 'คำนวณขนาดอิทธิพลไม่ได้'
    return {
      d: null,
      level: null,
      hedgesG: null,
      hedgesLevel: null,
      hedgesReason: reason,
      reason,
    }
  }
  // d = ค่าเฉลี่ยผลต่าง ÷ SD ของผลต่าง ซึ่งเท่ากับ t ÷ √n พอดี
  // ใช้รูปนี้เพราะ t คำนวณจากค่าที่ยังไม่ปัดเศษ จึงแม่นกว่าการเอาค่าที่ปัดแล้วมาหารกัน
  const d =
    test.t !== null && test.n > 0 ? test.t / Math.sqrt(test.n) : test.meanDiff / test.sdDiff!
  // คูณตัวแก้อคติจาก d ที่ยังไม่ปัดเศษ ด้วยเหตุผลเดียวกับข้างบน
  const correction = hedgesCorrection(test.df)
  const g = correction === null ? null : d * correction

  return {
    d: round(d, 4),
    level: effectLevel(d),
    hedgesG: g === null ? null : round(g, 4),
    hedgesLevel: g === null ? null : effectLevel(g),
    hedgesReason:
      correction === null
        ? `แก้อคติกลุ่มเล็กแบบ Hedges ต้องมีองศาอิสระอย่างน้อย 2 (คนอย่างน้อย 3 คน) ตอนนี้ df = ${test.df}`
        : null,
    reason: null,
  }
}

export type GainLevel = 'สูง' | 'ปานกลาง' | 'ต่ำ'

export interface NormalizedGain {
  /**
   * g = (ร้อยละหลังเรียน − ร้อยละก่อนเรียน) ÷ (100 − ร้อยละก่อนเรียน)
   *
   * ⚠️ **ตัวนี้คือคะแนนพัฒนาการของ Hake ไม่ใช่ Hedges' g**
   *    ถ้าจะหยิบไปใส่สไลด์หรือรายงาน ให้ใช้ `hakeG` ที่ชื่อบอกตัวเองว่าเป็นของใคร
   *    Hedges' g อยู่ที่ `effectSize().hedgesG` และมีค่าไม่เท่ากับตัวนี้
   */
  g: number | null
  /** ค่าเดียวกับ `g` แต่ชื่อบอกที่มา ใช้ตัวนี้เวลาคัดลอกออกไปข้างนอกเพื่อกันหยิบสลับกับ Hedges' g */
  hakeG: number | null
  prePercent: number
  postPercent: number
  level: GainLevel | null
  /** เป้าตามสเปกข้อ K6 คือ 0.30 ขึ้นไป */
  meetsTarget: boolean | null
  reason: string | null
}

/** เกณฑ์แปลผลคะแนนพัฒนาการตามสเปกข้อ 9.4 */
export const GAIN_TARGET = 0.3
const GAIN_HIGH = 0.7

function gainLevel(g: number): GainLevel {
  if (g >= GAIN_HIGH) return 'สูง'
  if (g >= GAIN_TARGET) return 'ปานกลาง'
  return 'ต่ำ'
}

/**
 * คะแนนพัฒนาการแบบปรับมาตรฐานของคนหนึ่งคน
 * คะแนนก่อนเรียนเต็มอยู่แล้วจะหารด้วยศูนย์ จึงคืน null พร้อมเหตุผล ไม่ใช่คืน 0
 * คะแนนตกลงคืนค่าติดลบตามจริง
 */
export function normalizedGain(
  preScore: number,
  postScore: number,
  maxScore: number,
): NormalizedGain {
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    return {
      g: null,
      hakeG: null,
      prePercent: 0,
      postPercent: 0,
      level: null,
      meetsTarget: null,
      reason: 'คะแนนเต็มต้องมากกว่า 0',
    }
  }

  const pre = Number.isFinite(preScore) ? preScore : 0
  const post = Number.isFinite(postScore) ? postScore : 0
  const prePercent = round((pre / maxScore) * 100, 4)
  const postPercent = round((post / maxScore) * 100, 4)

  if (prePercent >= 100) {
    return {
      g: null,
      hakeG: null,
      prePercent,
      postPercent,
      level: null,
      meetsTarget: null,
      reason: 'ก่อนเรียนได้คะแนนเต็มแล้ว ไม่มีช่องว่างให้พัฒนา จึงคำนวณคะแนนพัฒนาการไม่ได้',
    }
  }

  const g = (postPercent - prePercent) / (100 - prePercent)
  return {
    g: round(g, 4),
    hakeG: round(g, 4),
    prePercent,
    postPercent,
    level: gainLevel(g),
    meetsTarget: g >= GAIN_TARGET,
    reason: null,
  }
}

/**
 * คะแนนพัฒนาการของทั้งห้อง คิดจากค่าเฉลี่ยของห้อง (average normalized gain แบบ Hake)
 * ใช้ค่าเฉลี่ยก่อนและหลังของห้องมาเข้าสูตรเดียวกัน ตรงกับที่รายงานในเอกสารแข่งขัน
 */
export function classNormalizedGain(
  pairs: ReadonlyArray<{ pre: number; post: number }>,
  maxScore: number,
): NormalizedGain {
  const list = Array.isArray(pairs) ? pairs : []
  const preMean = meanOf(list.map((p) => p?.pre))
  const postMean = meanOf(list.map((p) => p?.post))
  if (list.length === 0) {
    return {
      g: null,
      hakeG: null,
      prePercent: 0,
      postPercent: 0,
      level: null,
      meetsTarget: null,
      reason: 'ยังไม่มีข้อมูลผู้เรียน',
    }
  }
  return normalizedGain(preMean, postMean, maxScore)
}

export interface ItemStat {
  itemId: string
  /** จำนวนคนที่ตอบข้อนี้ถูก */
  correctCount: number
  responseCount: number
  /** ความยาก p = สัดส่วนคนตอบถูก (ค่ามาก = ข้อง่าย) */
  difficulty: number | null
  /** อำนาจจำแนก r = สัดส่วนถูกกลุ่มสูง − สัดส่วนถูกกลุ่มต่ำ */
  discrimination: number | null
  /** ความยากอยู่ในช่วง 0.20-0.80 ตามสเปก */
  difficultyOk: boolean | null
  /** อำนาจจำแนกตั้งแต่ 0.20 ขึ้นไปตามสเปก */
  discriminationOk: boolean | null
  /** ใช้ข้อนี้ได้เลยหรือควรส่งให้ผู้เชี่ยวชาญดูอีกรอบ */
  usable: boolean | null
  reason: string | null
}

/** คำตอบรายคนของข้อสอบหนึ่งชุด ใช้หาความยากและอำนาจจำแนก */
export interface ItemResponseSheet {
  /** รหัสข้อ -> ตอบถูกหรือไม่ */
  correctByItem: Record<string, boolean>
}

/**
 * วิเคราะห์รายข้อตามสเปกข้อ 9.4
 * อำนาจจำแนกใช้เทคนิคกลุ่มสูง/กลุ่มต่ำ 27% ตัดจากคะแนนรวมของชุดนั้น
 * ห้องเล็กเกินจนแบ่งกลุ่มไม่ได้ (น้อยกว่า 4 คน) คืน discrimination = null พร้อมเหตุผล
 */
export function itemAnalysis(sheets: readonly ItemResponseSheet[]): ItemStat[] {
  const list = (Array.isArray(sheets) ? sheets : []).filter((s) => s?.correctByItem)
  const itemIds: string[] = []
  for (const sheet of list) {
    for (const id of Object.keys(sheet.correctByItem)) {
      if (!itemIds.includes(id)) itemIds.push(id)
    }
  }
  if (itemIds.length === 0) return []

  const totals = list.map((sheet) => ({
    sheet,
    total: itemIds.filter((id) => sheet.correctByItem[id] === true).length,
  }))
  // เรียงคะแนนรวมมากไปน้อย เพื่อตัดกลุ่มสูงกับกลุ่มต่ำ
  const ranked = [...totals].sort((a, b) => b.total - a.total)
  const groupSize = Math.floor(ranked.length * GROUP_FRACTION)
  const canGroup = groupSize >= 1
  const high = canGroup ? ranked.slice(0, groupSize) : []
  const low = canGroup ? ranked.slice(ranked.length - groupSize) : []

  return itemIds.map((itemId) => {
    const answered = list.filter((s) => typeof s.correctByItem[itemId] === 'boolean')
    const correctCount = answered.filter((s) => s.correctByItem[itemId] === true).length
    const responseCount = answered.length
    const difficulty = responseCount > 0 ? round(correctCount / responseCount, 4) : null

    let discrimination: number | null = null
    let reason: string | null = null
    if (!canGroup) {
      reason = `ต้องมีอย่างน้อย 4 คนจึงแบ่งกลุ่มสูง-ต่ำได้ ตอนนี้มี ${list.length} คน`
    } else {
      const highRate = high.filter((r) => r.sheet.correctByItem[itemId] === true).length / groupSize
      const lowRate = low.filter((r) => r.sheet.correctByItem[itemId] === true).length / groupSize
      discrimination = round(highRate - lowRate, 4)
    }

    const difficultyOk =
      difficulty === null ? null : difficulty >= DIFFICULTY_MIN && difficulty <= DIFFICULTY_MAX
    const discriminationOk = discrimination === null ? null : discrimination >= DISCRIMINATION_MIN

    return {
      itemId,
      correctCount,
      responseCount,
      difficulty,
      discrimination,
      difficultyOk,
      discriminationOk,
      usable: difficultyOk === null || discriminationOk === null ? null : difficultyOk && discriminationOk,
      reason,
    }
  })
}

export interface Agreement {
  pairCount: number
  /** จำนวนคู่ที่ให้ระดับตรงกันพอดี */
  exactCount: number
  /** จำนวนคู่ที่ต่างกันไม่เกิน 1 ระดับ (รวมคู่ที่ตรงกันพอดี) */
  withinOneCount: number
  exactPercent: number
  withinOnePercent: number
}

/**
 * ร้อยละความตรงกันของคะแนน 2 แหล่ง — ใช้กับ AI เทียบครู และคะแนนตนเองเทียบครู
 * สเปกข้อ 9.4 และ 9.5 ขอทั้ง "ตรงกันพอดี" และ "ต่างไม่เกิน 1 ระดับ"
 */
export function agreementRate(
  pairs: ReadonlyArray<{ a: number; b: number }>,
): Agreement {
  const usable = (Array.isArray(pairs) ? pairs : []).filter(
    (p) => Number.isFinite(p?.a) && Number.isFinite(p?.b),
  )
  const pairCount = usable.length
  if (pairCount === 0) {
    return { pairCount: 0, exactCount: 0, withinOneCount: 0, exactPercent: 0, withinOnePercent: 0 }
  }
  const exactCount = usable.filter((p) => p.a === p.b).length
  const withinOneCount = usable.filter((p) => Math.abs(p.a - p.b) <= 1).length
  return {
    pairCount,
    exactCount,
    withinOneCount,
    exactPercent: round((exactCount / pairCount) * 100, 2),
    withinOnePercent: round((withinOneCount / pairCount) * 100, 2),
  }
}

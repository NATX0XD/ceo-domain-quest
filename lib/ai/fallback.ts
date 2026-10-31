/**
 * ทางสำรองแบบกฎล้วน — ไม่เรียกเน็ต ไม่ต้องมี API key ไม่มีค่าใช้จ่าย
 *
 * นี่คือเส้นทางหลักของคาบเรียนจริง ไม่ใช่ของสำรองที่พอใช้ได้:
 * ถ้าเน็ตโรงเรียนล่มหรือ key หมดโควตากลางคาบ ทุกอย่างต้องเดินต่อได้เหมือนเดิม
 * ใช้ตรรกะที่มีอยู่แล้วใน core/domain-rules.ts, core/tld-rules.ts และคำใบ้ใน content/missions.json
 */
import missionsJson from '../../content/missions.json' with { type: 'json' }
import { findBusinessType, findTld } from '../../core/content'
import { checkDomainName, nextHint, normalize } from '../../core/domain-rules'
import { evaluateTld } from '../../core/tld-rules'
import {
  WEIGHTED_MAX,
  clampDimensionScore,
  findDimension,
  levelLabel,
  resolveEmphasisDimension,
  starsFromWeighted,
  weightedTotal,
} from './rubric'
import type {
  FallbackReason,
  GradeReasonInput,
  GradeReasonResult,
  HintInput,
  HintResult,
  RubricDimensionScore,
  SimulateCustomerInput,
  SimulateCustomerResult,
} from './types'

const missions = missionsJson.missions as ReadonlyArray<{
  id: string
  hints?: string[]
  stuckMessage?: string
}>

function missionHints(missionId: string): string[] {
  return missions.find((m) => m.id === missionId)?.hints ?? []
}

/**
 * คำใบ้จากกฎ — เรียงจากคำใบ้ของภารกิจใน content/missions.json
 * ถ้านักเรียนพิมพ์ชื่อค้างไว้แล้ว ให้คำใบ้ที่ตรงกับข้อที่ชื่อนั้นยังไม่ผ่านก่อน
 * เพราะคำใบ้ที่พูดถึงสิ่งที่เขากำลังทำอยู่ ใช้ได้จริงกว่าคำใบ้ทั่วไป
 */
export function fallbackHint(
  input: HintInput,
  fallbackReason: FallbackReason = 'no-api-key',
): HintResult {
  const level = Math.max(1, Math.floor(input?.hintLevel ?? 1))
  const draft = normalize(input?.draftName ?? '')

  if (draft.length > 0) {
    const ruleHint = nextHint(checkDomainName(draft, input?.keywords ?? []))
    if (ruleHint) {
      return { text: ruleHint, level, source: 'fallback', provider: 'rules', fallbackReason }
    }
  }

  const hints = missionHints(input?.missionId ?? '')
  const text =
    hints[level - 1] ??
    hints[hints.length - 1] ??
    'ลองอ่านโจทย์อีกรอบแล้วขีดเส้นใต้คำที่บอกเงื่อนไขของร้านเราดูนะ'

  return { text, level, source: 'fallback', provider: 'rules', fallbackReason }
}

/** คำที่บอกว่าเหตุผลของนักเรียนพูดถึงลูกค้าเป้าหมายจริง ไม่ใช่แค่ "ชอบ" */
const CUSTOMER_KEYWORDS = [
  'ลูกค้า',
  'คนซื้อ',
  'ผู้ซื้อ',
  'คนไทย',
  'ต่างประเทศ',
  'ต่างชาติ',
  'วัยรุ่น',
  'นักเรียน',
  'นักศึกษา',
  'แม่บ้าน',
  'คนในย่าน',
  'ในพื้นที่',
  'กลุ่มเป้าหมาย',
  'ขายใคร',
]

/** ความยาวขั้นต่ำที่ถือว่าเขียนเป็นเหตุผล ไม่ใช่คำเดียวจบ */
const REASON_MIN_LENGTH = 25

function scoreOf(dimensionId: string, score: number, evidence: string, suggestion: string, emphasized: boolean): RubricDimensionScore {
  const clamped = clampDimensionScore(score)
  return {
    id: dimensionId,
    name: findDimension(dimensionId)?.name ?? dimensionId,
    score: clamped,
    levelLabel: levelLabel(dimensionId, clamped),
    evidence,
    suggestion,
    emphasized,
  }
}

/** ตัดข้อความยาวให้พอดีช่องหลักฐานบนแผงครู แต่ยังเห็นว่านักเรียนเขียนอะไร */
function quote(text: string, max = 80): string {
  const value = (text ?? '').trim()
  if (value.length === 0) return ''
  return value.length <= max ? `"${value}"` : `"${value.slice(0, max - 1)}…"`
}

/** ด้านที่ 1 ชื่อจำง่ายและสะกดถูกกฎ — ตรวจด้วย core/domain-rules.ts ล้วน */
function gradeNaming(input: GradeReasonInput, emphasized: boolean): RubricDimensionScore {
  const name = normalize(input?.domainName ?? '')
  const id = 'dim-naming'

  if (name.length === 0) {
    return scoreOf(
      id,
      1,
      'ยังไม่ได้กรอกชื่อโดเมนลงในใบเสนอ',
      'ลองเขียนชื่อที่คิดไว้ลงช่องชื่อโดเมนก่อน แล้วระบบจะช่วยตรวจให้ทีละข้อ',
      emphasized,
    )
  }

  const check = checkDomainName(name, businessKeywords(input.businessTypeId))
  const failed = check.results.filter((r) => !r.passed)
  const evidence = `ชื่อที่เสนอคือ ${quote(name)} ผ่านกฎการตั้งชื่อ ${check.score} จาก ${check.results.length} ข้อ`

  if (failed.length === 0) {
    return scoreOf(id, 3, evidence, 'ชื่อนี้ใช้ได้เลย ลองอ่านออกเสียงให้เพื่อนพิมพ์ตามอีกรอบเพื่อยืนยัน', emphasized)
  }
  if (failed.length === 1) {
    return scoreOf(id, 2, `${evidence} (${failed[0]!.message})`, `เหลืออีกจุดเดียว: ${failed[0]!.message}`, emphasized)
  }
  return scoreOf(
    id,
    1,
    `${evidence} (${failed.map((f) => f.message).join(' · ')})`,
    `ลองแก้ทีละข้อ เริ่มจาก ${failed[0]!.message}`,
    emphasized,
  )
}

/** ด้านที่ 2 นามสกุลเหมาะกับประเภทธุรกิจ — ตรวจด้วย core/tld-rules.ts ล้วน */
function gradeTldFit(input: GradeReasonInput, emphasized: boolean): RubricDimensionScore {
  const id = 'dim-tld-fit'
  const tld = findTld(input?.tldId ?? '')
  const text = (input?.reasonText ?? '').trim()

  if (!tld) {
    return scoreOf(
      id,
      1,
      'ยังไม่ได้เลือกนามสกุลโดเมน',
      'เลือกนามสกุลที่ร้านของเรายื่นจดได้จริงก่อน แล้วค่อยเขียนเหตุผลประกอบ',
      emphasized,
    )
  }

  const verdict = evaluateTld(tld, {
    isRegisteredCompany: Boolean(input?.isRegisteredCompany),
    audience: input?.audience ?? 'thai',
    domainName: normalize(input?.domainName ?? ''),
  })

  if (!verdict.accepted) {
    return scoreOf(
      id,
      1,
      `เลือก ${tld.suffix} แต่เงื่อนไขยังไม่ตรงกับร้าน: ${verdict.reason}`,
      `ลองเทียบเงื่อนไขของแต่ละช่องอีกครั้ง แล้วเลือกช่องที่ร้านของเรายื่นได้จริง`,
      emphasized,
    )
  }

  const mentionsTld = text.includes(tld.suffix) || text.includes(tld.label)
  if (mentionsTld) {
    return scoreOf(
      id,
      3,
      `เลือก ${tld.suffix} ซึ่งยื่นจดได้จริง และเหตุผลอ้างถึงนามสกุลนี้ตรง ๆ: ${quote(text)}`,
      'เขียนได้ตรงเงื่อนไขแล้ว ลองเพิ่มอีกประโยคว่านามสกุลนี้ช่วยให้ลูกค้าจำร้านได้อย่างไร',
      emphasized,
    )
  }
  return scoreOf(
    id,
    2,
    `เลือก ${tld.suffix} ซึ่งยื่นจดได้จริง แต่ในเหตุผลยังไม่ได้พูดถึงนามสกุลนี้`,
    `ลองใส่คำว่า ${tld.suffix} ลงในเหตุผล พร้อมบอกว่าใครจดนามสกุลนี้ได้บ้าง`,
    emphasized,
  )
}

/** ด้านที่ 3 เหตุผลอ้างอิงลูกค้าเป้าหมาย — ตรวจคำสำคัญและความยาว */
function gradeCustomerReason(input: GradeReasonInput, emphasized: boolean): RubricDimensionScore {
  const id = 'dim-customer-reason'
  const text = (input?.reasonText ?? '').trim()
  const hitWords = CUSTOMER_KEYWORDS.filter((k) => text.includes(k))
  const longEnough = text.length >= REASON_MIN_LENGTH

  if (text.length === 0) {
    return scoreOf(
      id,
      1,
      'ยังไม่ได้เขียนเหตุผลลงในใบเสนอ',
      'ลองเขียน 1 ประโยคว่าลูกค้าของร้านเราคือใคร แล้วชื่อนี้ช่วยเขาอย่างไร',
      emphasized,
    )
  }

  if (hitWords.length > 0 && longEnough) {
    return scoreOf(
      id,
      3,
      `เหตุผลพูดถึงลูกค้าชัดเจน (${hitWords.join(' · ')}): ${quote(text)}`,
      'เขียนถึงลูกค้าได้ชัดแล้ว ลองเติมอีกนิดว่าลูกค้ากลุ่มนี้มักค้นหาร้านจากอะไร',
      emphasized,
    )
  }
  if (hitWords.length > 0 || longEnough) {
    return scoreOf(
      id,
      2,
      `เหตุผลที่เขียนไว้: ${quote(text)}`,
      hitWords.length > 0
        ? 'พูดถึงลูกค้าแล้ว ลองขยายอีกประโยคว่าลูกค้ากลุ่มนี้จะเจอร้านเราได้อย่างไร'
        : 'ลองระบุให้ชัดว่าลูกค้าของร้านเราคือใคร เช่น คนในย่านเดียวกัน หรือวัยรุ่นที่สั่งออนไลน์',
      emphasized,
    )
  }
  return scoreOf(
    id,
    1,
    `เหตุผลที่เขียนไว้: ${quote(text)}`,
    'ลองเพิ่มว่าลูกค้าของร้านเราคือใคร แล้วชื่อนี้ทำให้เขาจำร้านได้อย่างไร',
    emphasized,
  )
}

/** ด้านที่ 4 เชื่อมโยงกับธุรกิจตัวเอง — เทียบกับประเภทธุรกิจและชื่อที่ตั้งไว้ */
function gradeBusinessLink(input: GradeReasonInput, emphasized: boolean): RubricDimensionScore {
  const id = 'dim-business-link'
  const name = normalize(input?.domainName ?? '')
  const text = (input?.reasonText ?? '').trim()
  const business = findBusinessType(input?.businessTypeId ?? '')
  const shopName = (input?.shopName ?? '').trim()

  const nameHasKeyword = business
    ? business.keywords.some((k) => name.includes(k.toLowerCase()))
    : false
  const reasonMentionsBusiness = business
    ? business.label.split(/[\s/]+/).some((word) => word.length > 2 && text.includes(word))
    : false
  const reasonMentionsShop = shopName.length > 0 && text.includes(shopName)

  if (!business) {
    return scoreOf(
      id,
      text.length > 0 ? 2 : 1,
      shopName ? `ร้านชื่อ ${shopName} แต่ยังไม่ได้เลือกประเภทธุรกิจในระบบ` : 'ยังไม่ได้เลือกประเภทธุรกิจในระบบ',
      'เลือกประเภทธุรกิจของร้านก่อน ระบบจะได้ช่วยดูว่าชื่อสื่อถึงร้านหรือยัง',
      emphasized,
    )
  }

  if (nameHasKeyword && (reasonMentionsBusiness || reasonMentionsShop)) {
    return scoreOf(
      id,
      3,
      `ชื่อ ${quote(name)} มีคำที่สื่อถึง${business.label} และเหตุผลก็พูดถึงร้านของตัวเอง`,
      'โยงกับร้านตัวเองได้ครบแล้ว ลองบอกเพิ่มว่าชื่อนี้จะไปอยู่บนป้ายหรือกล่องสินค้าอย่างไร',
      emphasized,
    )
  }
  if (nameHasKeyword || reasonMentionsBusiness || reasonMentionsShop) {
    return scoreOf(
      id,
      2,
      nameHasKeyword
        ? `ชื่อ ${quote(name)} มีคำที่สื่อถึง${business.label} แล้ว แต่เหตุผลยังไม่ได้พูดถึงร้านของตัวเอง`
        : `เหตุผลพูดถึงร้านแล้ว แต่ชื่อ ${quote(name)} ยังไม่มีคำที่สื่อถึง${business.label}`,
      `ลองให้ทั้งชื่อและเหตุผลพูดถึง${business.label}ให้ตรงกัน คนอ่านจะเห็นภาพร้านทันที`,
      emphasized,
    )
  }
  return scoreOf(
    id,
    1,
    `ชื่อ ${quote(name || 'ยังไม่ได้ตั้ง')} และเหตุผลยังไม่มีคำที่สื่อถึง${business.label}`,
    `ลองใส่คำที่เกี่ยวกับ${business.label} เช่น ${business.keywords.slice(0, 2).join(' หรือ ')} ลงในชื่อหรือในเหตุผล`,
    emphasized,
  )
}

/** คำสำคัญของประเภทธุรกิจที่นักเรียนเลือก ใช้ตรวจว่าชื่อสื่อถึงร้านหรือยัง */
function businessKeywords(businessTypeId: string | undefined): string[] {
  return findBusinessType(businessTypeId ?? '')?.keywords ?? []
}

/**
 * ตรวจใบเสนอชื่อเว็บด้วยกฎล้วน ให้คะแนนครบทั้ง 4 ด้านตาม content/rubric.json
 *
 * นี่คือเส้นทางที่ใช้จริงในคาบเรียนตอนนี้ (ยังไม่มี API key) จึงต้องใช้งานได้จริง ไม่ใช่ทำพอผ่าน
 * ทุกด้านมี evidence ที่ยกสิ่งที่นักเรียนเขียนมาอ้าง และ suggestion ที่บอกว่าทำอะไรต่อได้
 * คะแนนนี้เป็น "ข้อเสนอ" ครูกดยืนยันหรือแก้ได้เสมอ (needsTeacherConfirm เป็น true เสมอ)
 */
export function fallbackGradeReason(
  input: GradeReasonInput,
  fallbackReason: FallbackReason = 'no-api-key',
): GradeReasonResult {
  const emphasisDimensionId = resolveEmphasisDimension(input?.emphasisCriterion)
  const isEmphasized = (id: string) => id === emphasisDimensionId

  const dimensions: RubricDimensionScore[] = [
    gradeNaming(input, isEmphasized('dim-naming')),
    gradeTldFit(input, isEmphasized('dim-tld-fit')),
    gradeCustomerReason(input, isEmphasized('dim-customer-reason')),
    gradeBusinessLink(input, isEmphasized('dim-business-link')),
  ]

  return buildGradeResult(dimensions, emphasisDimensionId, {
    source: 'fallback',
    provider: 'rules',
    fallbackReason,
  })
}

/**
 * ประกอบผลสุดท้ายจากคะแนนรายด้าน
 * คะแนนถ่วงน้ำหนักและดาวคำนวณที่นี่เสมอ ไม่เชื่อตัวเลขที่โมเดลส่งมา
 */
export function buildGradeResult(
  dimensions: RubricDimensionScore[],
  emphasisDimensionId: string | null,
  meta: { source: 'ai' | 'fallback'; provider: 'typhoon' | 'gemini' | 'cloudflare' | 'rules'; fallbackReason: FallbackReason | null },
): GradeReasonResult {
  const scores: Record<string, number> = {}
  for (const d of dimensions) scores[d.id] = d.score

  const total = weightedTotal(scores, emphasisDimensionId)
  const stars = starsFromWeighted(total, true)
  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0]

  return {
    dimensions,
    emphasisDimensionId,
    weightedTotal: total,
    weightedMax: WEIGHTED_MAX,
    stars,
    feedback: weakest
      ? `ได้ ${stars} ดาว จากคะแนนถ่วงน้ำหนัก ${total} เต็ม ${WEIGHTED_MAX} · จุดที่ต่อยอดได้ก่อนคือ${weakest.name}: ${weakest.suggestion}`
      : `ได้ ${stars} ดาว จากคะแนนถ่วงน้ำหนัก ${total} เต็ม ${WEIGHTED_MAX}`,
    needsTeacherConfirm: true,
    ...meta,
  }
}

/** จุดที่คนฟังแล้วพิมพ์ผิดบ่อย ตรงกับ docs/station-minigames.md ข้อ 4 */
const AMBIGUITY_RULES: ReadonlyArray<{ test: RegExp; apply: (name: string) => string; note: string }> =
  [
    { test: /4/, apply: (n) => n.replace('4', 'four'), note: 'ลูกค้าได้ยินเลข 4 แล้วพิมพ์เป็นคำว่า four' },
    { test: /2/, apply: (n) => n.replace('2', 'to'), note: 'ลูกค้าได้ยินเลข 2 แล้วพิมพ์เป็น to' },
    { test: /-/, apply: (n) => n.replace(/-/g, ''), note: 'ลูกค้าไม่รู้ว่ามีขีดกลาง เลยพิมพ์ติดกัน' },
    {
      test: /(.)\1/,
      apply: (n) => n.replace(/(.)\1/, '$1'),
      note: 'ลูกค้าได้ยินตัวซ้ำไม่ชัด เลยพิมพ์ตัวเดียว',
    },
    { test: /s$/, apply: (n) => n.slice(0, -1), note: 'ลูกค้าลืมตัว s ท้ายคำ' },
  ]

/**
 * ลูกค้าจำลองแบบกฎ — คงที่เสมอสำหรับชื่อเดิม ไม่มีการสุ่ม
 * ลูกค้าคนที่ 1 ตั้งใจฟังและพิมพ์ตามที่ได้ยินตรง ๆ
 * ลูกค้าคนถัด ๆ ไปจะโดนกับดักความกำกวมข้อแรกที่ชื่อนั้นมี
 */
export function fallbackSimulateCustomer(
  input: SimulateCustomerInput,
  fallbackReason: FallbackReason = 'no-api-key',
): SimulateCustomerResult {
  const name = normalize(input?.domainName ?? '')
  const index = Math.max(0, Math.floor(input?.customerIndex ?? 0))

  const trap = AMBIGUITY_RULES.find((r) => r.test.test(name))

  if (index === 0 || !trap) {
    return {
      typed: name,
      correct: true,
      comment: name ? `พิมพ์ตามแล้วนะ ${name} เข้าเว็บได้เลย` : 'ยังไม่ได้ยินชื่อร้านเลย',
      source: 'fallback',
      provider: 'rules',
      fallbackReason,
    }
  }

  const typed = trap.apply(name)
  return {
    typed,
    correct: typed === name,
    comment: `${trap.note} เลยพิมพ์ออกมาเป็น ${typed}`,
    source: 'fallback',
    provider: 'rules',
    fallbackReason,
  }
}

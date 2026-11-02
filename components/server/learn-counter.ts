import { z } from 'zod'
import publicJson from '../../content/learn-counter.json'
import answersJson from '../../content/learn-counter-answers.json'
import {
  COUNTER_CATEGORIES,
  COUNTER_STAMPS,
  type CounterCaseResult,
  type CounterData,
  type CounterDetail,
  type CounterGroupResult,
  type CounterStepResult,
} from '../learn/counter-types'

/**
 * Scorer ของเกมลงมือทำ ด่าน 3 (เคาน์เตอร์รับจดโดเมน)
 *
 * ⚠️ ฝั่งเซิร์ฟเวอร์เท่านั้น — ไฟล์นี้อ่าน learn-counter-answers.json
 * คะแนน 0-100 = 50% สัดส่วนป้ายประเภทที่ติดถูก + 50% สัดส่วนแต้มตรา
 * แต้มตราต่อลูกค้า: ตราถูกครั้งแรก 2 · ถูกตอนลองแก้ (attempt 2) 1 · ไม่ถูก 0
 * ผ่านเมื่อแต้มตรา >= 60% ของเต็ม และติดป้ายถูกอย่างน้อย 80%
 */

const category = z.enum(COUNTER_CATEGORIES)
const stamp = z.enum(COUNTER_STAMPS)
const tone = z.enum(['brand', 'quest', 'spark', 'reward'])
const hintList = z.array(z.string().min(1)).min(1)

const counterDataSchema = z.object({
  title: z.string(),
  intro: z.string(),
  maxQuestions: z.number().int().positive(),
  shiftSize: z.number().int().positive().default(2),
  hintsPerShift: z.number().int().nonnegative(),
  handbookSeconds: z.number().int().positive(),
  categories: z.array(z.object({ id: category, label: z.string(), short: z.string() })),
  stamps: z.array(
    z.object({ id: stamp, label: z.string(), hint: z.string(), needsExtension: z.boolean() }),
  ),
  handbook: z.array(
    z.object({
      category,
      floor: z.string(),
      rows: z.array(z.object({ suffix: z.string(), who: z.string() })),
    }),
  ),
  hints: z.object({ request: hintList, interview: hintList, tag: hintList, stamp: hintList }),
  cases: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        portrait: z.string().optional(),
        particle: z.string().optional(),
        business: z.string(),
        tone,
        greeting: z.string(),
        domains: z.array(z.object({ name: z.string(), role: z.string() })).min(1),
        questions: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            reply: z.string(),
            docs: z.array(z.string()).optional(),
            who: z.string().optional(),
            mood: z.enum(['neutral', 'happy', 'confused', 'upset']).optional(),
          }),
        ),
        extensionOptions: z.array(z.string()),
        reasons: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
      }),
    )
    .min(1),
})

const answersSchema = z.object({
  cases: z.array(
    z.object({
      caseId: z.string(),
      tags: z.record(z.string(), category),
      stamp,
      acceptedExtensions: z.array(z.string()),
      reason: z.string().optional(),
      keyQuestions: z.array(z.string()),
      /** บทลูกค้าตอนตัดสินถูก (ไม่มี = เกมใช้บทกลาง) */
      line: z.string().optional(),
      explanation: z.string(),
    }),
  ),
})

const decisionSchema = z.object({
  caseId: z.string().min(1).max(40),
  tags: z.record(z.string().max(80), category),
  asked: z.array(z.string().max(20)).max(3),
  stamp,
  extension: z.string().max(40).nullable(),
  attempt: z.union([z.literal(1), z.literal(2)]).optional(),
  reason: z.string().max(20).nullable().optional(),
})

const payloadSchema = z.object({ decisions: z.array(decisionSchema).max(20) })

type Decision = z.infer<typeof decisionSchema>
type Answer = (typeof ANSWERS.cases)[number]

function judge(ans: Answer, d: Decision | undefined) {
  const domains = Object.keys(ans.tags)
  const wrongTags = d ? domains.filter((name) => d.tags[name] !== ans.tags[name]) : domains
  const needsExt = ans.acceptedExtensions.length > 0
  const stampCorrect =
    !!d &&
    d.stamp === ans.stamp &&
    (!needsExt || (d.extension != null && ans.acceptedExtensions.includes(d.extension.trim())))
  // การ์ดเหตุผล (S14) ตรวจแยก ไม่นับในคะแนน/เกณฑ์ผ่าน
  const reasonCorrect = ans.reason ? !!d && d.reason === ans.reason : undefined
  return { domains, wrongTags, stampCorrect, reasonCorrect }
}

const DATA: CounterData = counterDataSchema.parse(publicJson)
const ANSWERS = answersSchema.parse(answersJson)

/** ชุดสำรอง 2 คน ใช้เมื่ออ่านกะของนักเรียนไม่ได้ */
export const LEGACY_SHIFT = ['c1', 'c2'] as const

/* ---------- สุ่มลูกค้าต่อกะ (กำหนดด้วย seed ซ้ำได้เสมอ) ---------- */

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/**
 * จับลูกค้า `size` คนจากคลังเคส ให้ได้ส่วนผสมที่ดี:
 * อนุมัติ 1 · เสนอนามสกุลใหม่ 1 · ทำขั้นแรกก่อน/ปฏิเสธ 1 · ที่เหลือสุ่ม และป้ายครบทั้ง 3 ชั้นของคู่มือ
 * seed เดิมได้ชุดเดิมและลำดับเดิมทุกครั้ง (รีเฟรชไม่สลับลูกค้า)
 */
export function drawShift(seed: number, size = DATA.shiftSize, excluded: readonly string[] = []): string[] {
  const pool = ANSWERS.cases.filter((a) => DATA.cases.some((c) => c.id === a.caseId))
  const excludedSet = new Set(excluded)
  const available = pool.filter((a) => !excludedSet.has(a.caseId))
  const source = available.length >= size ? available : pool
  const n = Math.min(size, source.length)
  const groups = [
    source.filter((a) => a.stamp === 'approve'),
    source.filter((a) => a.stamp === 'suggest'),
    source.filter((a) => a.stamp === 'first-step' || a.stamp === 'reject'),
  ]
  const covers = (ids: string[]) => {
    const cats = new Set(source.filter((a) => ids.includes(a.caseId)).flatMap((a) => Object.values(a.tags)))
    return COUNTER_CATEGORIES.every((c) => cats.has(c))
  }
  const rand = rng(seed)
  let pick: string[] = []
  for (let attempt = 0; attempt < 30; attempt++) {
    pick = []
    for (const g of groups) {
      const c = shuffled(g, rand)[0]
      if (c && pick.length < n) pick.push(c.caseId)
    }
    for (const c of shuffled(source, rand)) {
      if (pick.length >= n) break
      if (!pick.includes(c.caseId)) pick.push(c.caseId)
    }
    if (covers(pick)) break
  }
  return shuffled(pick, rand)
}

/** สุ่ม seed ใหม่ที่ได้ชุดลูกค้าไม่ซ้ำกับกะก่อน (ถ้าทำได้) */
export function newShiftSeed(
  previous?: readonly string[] | null,
  random: () => number = Math.random,
  excluded: readonly string[] = [],
): { seed: number; caseIds: string[] } {
  const same = (ids: string[]) => !!previous && ids.length === previous.length && ids.every((id) => previous.includes(id))
  let seed = Math.floor(random() * 2 ** 31)
  let caseIds = drawShift(seed, DATA.shiftSize, excluded)
  for (let i = 0; i < 8 && same(caseIds); i++) {
    seed = Math.floor(random() * 2 ** 31)
    caseIds = drawShift(seed, DATA.shiftSize, excluded)
  }
  return { seed, caseIds }
}

/** id ในกะที่ใช้ได้จริง (กรองของแปลก/ซ้ำออก) ไม่เหลือเลย = ชุดเดิม */
export function validShift(caseIds: readonly unknown[] | null | undefined): string[] {
  const ids = [...new Set((caseIds ?? []).filter((x): x is string => typeof x === 'string'))].filter((id) =>
    ANSWERS.cases.some((a) => a.caseId === id),
  )
  return ids.length > 0 ? ids : [...LEGACY_SHIFT]
}

/** ข้อเท็จจริงจากคู่มือเคาน์เตอร์ (ชั้นนามสกุล) ส่งให้โดมตอบคำถามที่โต๊ะ m3 */
export function counterHandbookFacts(): string {
  return DATA.handbook
    .map((f) => `${f.floor} (${f.category}): ` + f.rows.map((r) => `${r.suffix} = ${r.who}`).join(' | '))
    .join('\n')
}

/** ข้อมูลสาธารณะของเกม ส่งเฉพาะลูกค้าในกะนี้ (เรียงตามลำดับในกะ) */
export function publicCounterData(caseIds?: readonly string[]): CounterData {
  if (!caseIds) return DATA
  const cases = caseIds.map((id) => DATA.cases.find((c) => c.id === id)).filter((c): c is CounterData['cases'][number] => !!c)
  return { ...DATA, cases }
}

/** คลังลูกค้าทั้งหมด (ใช้ในเทสต์/ตรวจเนื้อหา) */
export function counterPoolIds(): string[] {
  return DATA.cases.map((c) => c.id)
}

/**
 * ให้คะแนนทั้งกะ — นับเฉพาะลูกค้าใน `caseIds` (กะที่เซิร์ฟเวอร์จับให้นักเรียนคนนี้)
 * ไม่ส่ง = ใช้ชุดสำรอง 2 คน
 */
export function scoreCounter(payload: unknown, caseIds: readonly string[] = LEGACY_SHIFT): { score: number; passed: boolean; detail: unknown } {
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) {
    const detail: CounterDetail = {
      tagAccuracy: 0,
      stampAccuracy: 0,
      cases: [],
      stampPoints: 0,
      stampMax: 0,
      groups: [],
      error: 'invalid-payload',
    }
    return { score: 0, passed: false, detail }
  }
  const shift = validShift(caseIds)
  const shiftAnswers = shift.map((id) => ANSWERS.cases.find((a) => a.caseId === id)).filter((a): a is Answer => !!a)

  // เคสซ้ำ: ใช้คำตอบแรกเท่านั้น
  const byCase = new Map<string, (typeof parsed.data.decisions)[number]>()
  for (const d of parsed.data.decisions) if (!byCase.has(d.caseId)) byCase.set(d.caseId, d)

  let tagsCorrectAll = 0
  let tagsTotalAll = 0
  let stampPoints = 0
  const groupMap = new Map<string, CounterGroupResult>()

  const cases: CounterCaseResult[] = shiftAnswers.map((ans) => {
    const d = byCase.get(ans.caseId)
    const { domains, wrongTags, stampCorrect, reasonCorrect } = judge(ans, d)
    const tagsCorrect = domains.length - wrongTags.length
    const askedKeyQuestion = !!d && d.asked.some((q) => ans.keyQuestions.includes(q))
    const points: 0 | 1 | 2 = stampCorrect ? ((d?.attempt ?? 1) === 2 ? 1 : 2) : 0

    tagsCorrectAll += tagsCorrect
    tagsTotalAll += domains.length
    stampPoints += points
    for (const name of domains) {
      const cat = ans.tags[name]
      if (!cat) continue
      const g = groupMap.get(cat) ?? { category: cat, correct: 0, total: 0 }
      g.total += 1
      if (!wrongTags.includes(name)) g.correct += 1
      groupMap.set(cat, g)
    }

    return {
      caseId: ans.caseId,
      tagsCorrect,
      tagsTotal: domains.length,
      stampCorrect,
      askedKeyQuestion,
      ...(reasonCorrect === undefined ? {} : { reasonCorrect }),
      points,
      // เคสที่ไม่ได้ตอบไม่ส่งคำอธิบาย กันส่งชุดว่างมาขอเฉลยทั้งกะ
      explanation: d ? ans.explanation : '',
    }
  })

  const stampMax = shiftAnswers.length * 2
  const tagAccuracy = tagsTotalAll > 0 ? tagsCorrectAll / tagsTotalAll : 0
  const stampAccuracy = stampMax > 0 ? stampPoints / stampMax : 0
  const score = Math.round(50 * tagAccuracy + 50 * stampAccuracy)
  const passed = stampAccuracy >= 0.6 && tagAccuracy >= 0.8

  const groups = COUNTER_CATEGORIES.map((c) => groupMap.get(c)).filter((g): g is CounterGroupResult => !!g)
  const detail: CounterDetail = { tagAccuracy, stampAccuracy, cases, stampPoints, stampMax, groups }
  return { score, passed, detail }
}

/**
 * ตรวจลูกค้าทีละคนระหว่างเล่น (`action: 'step'`) — ไม่เก็บคะแนน ใช้ให้เกมบอกว่าถูกไหมเพื่อลองแก้ 1 ครั้ง
 * คำอธิบายเปิดเฉพาะตอนลองแก้ครั้งที่ 2 แล้วยังไม่ถูก
 * @throws ZodError เมื่อรูปแบบข้อมูลผิด (route ตอบ 400)
 */
export function checkCounterStep(payload: unknown): {
  result: CounterStepResult
  log: { caseId: string; attempt: 1 | 2; correct: boolean }
} {
  const d = decisionSchema.parse(payload)
  const ans = ANSWERS.cases.find((c) => c.caseId === d.caseId)
  const attempt = d.attempt ?? 1
  if (!ans) {
    return {
      result: { correct: false, stampCorrect: false, tagsCorrect: 0, tagsTotal: 0, wrongTags: [], explanation: '' },
      log: { caseId: d.caseId, attempt, correct: false },
    }
  }
  const { domains, wrongTags, stampCorrect, reasonCorrect } = judge(ans, d)
  const correct = stampCorrect && wrongTags.length === 0
  return {
    result: {
      correct,
      stampCorrect,
      tagsCorrect: domains.length - wrongTags.length,
      tagsTotal: domains.length,
      wrongTags,
      ...(reasonCorrect === undefined ? {} : { reasonCorrect }),
      explanation: !correct && attempt === 2 ? ans.explanation : '',
      ...(correct && ans.line ? { line: ans.line } : {}),
    },
    log: { caseId: d.caseId, attempt, correct },
  }
}

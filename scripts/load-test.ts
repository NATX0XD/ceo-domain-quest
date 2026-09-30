/**
 * ห้องจริง 30 คนพร้อมกันไหวไหม — วัดตามสถานการณ์จริงของคาบ ไม่ใช่ยิง endpoint เดียวรัว ๆ (T77)
 *
 * รัน: npx tsx scripts/load-test.ts              (ต้องมี dev server พอร์ต 3000 เปิดอยู่)
 *      npx tsx scripts/load-test.ts --students 10   ซ้อมด้วยคนน้อยก่อน
 *
 * สถานการณ์ที่วัด (ตามลำดับเวลาจริงของคาบ)
 *   1. ครูบอกให้เปิดเครื่อง — 30 คนกดเข้าห้องพร้อมกัน
 *   2. แบบทดสอบก่อนเรียน — 30 คนกดส่งพร้อมกัน
 *   3. ช่วงภารกิจ — 30 คนกดขอคำใบ้พร้อมกัน (วัดว่าได้ AI จริงกี่คน · ห้ามเกินงบ 5 วินาที)
 *   4. ด่านบอส — 30 คนกดส่งใบเสนอพร้อมกัน (วัดเวลาที่ "นักเรียนต้องรอ" กับเวลาที่คิวตรวจครบ)
 *   5. แผงครูเปิดค้างไว้ poll ทุก 3 วินาทีตลอดข้อ 3-4
 *   6. สรุปคำขอที่พลาด แยกตาม path
 *
 * ⚠️ สคริปต์นี้ **สร้างห้องของตัวเองแล้วลบทิ้งเสมอ** ไม่แตะห้อง UAT777 และไม่แตะห้องของใคร
 *    ปิดกลางคันด้วย Ctrl+C ก็ยังลบห้องให้ (ดัก SIGINT) ถ้าลบไม่สำเร็จจะพิมพ์รหัสห้องไว้ให้ลบเอง
 * ⚠️ ไม่ reset DB · ไม่ปิด dev server · ไม่เขียนทับ seed ของใคร
 * ⚠️ ตัวเลขที่ได้คือของเครื่องที่รัน ไม่ใช่ของเซิร์ฟเวอร์จริงตอนสอน — ใช้หาคอขวด ไม่ใช่รับประกัน
 */

import { quiz } from '../core/quiz'
import bigMissionJson from '../content/big-mission.json' with { type: 'json' }
import { getServiceClient } from '../lib/db/client'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

const BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const TEACHER_EMAIL = 'kru@uat.local'
const TEACHER_PASSWORD = 'uat1234'
const STUDENT_PIN = '2468'
const NICK_PREFIX = 'lt'
const BOARD_POLL_MS = 3000

/** เกณฑ์ที่ประกาศไว้ ใช้ตัดสินผ่าน/ไม่ผ่านในตารางท้ายรายงาน */
const HINT_BUDGET_MS = 5000
const SUBMIT_WAIT_TARGET_MS = 1500

/** ข้ามด่านบอส+คิวตรวจ ใช้ตอนอยากวัดเฉพาะช่วงที่ผู้เรียนนั่งรอ (เร็วและไม่กินโควตาตรวจงาน) */
const SKIP_BOSS = process.argv.includes('--skip-boss')

/**
 * เว้นระยะการกดขอคำใบ้กี่มิลลิวินาทีต่อคน (0 = กดพร้อมกันเป๊ะ)
 * ห้องจริงไม่มีใครกดพร้อมกันเป๊ะทั้ง 30 คน ค่านี้ใช้วัดว่าเว้นระยะแล้วได้ AI เพิ่มแค่ไหน
 */
const staggerArg = Number(process.argv[process.argv.indexOf('--stagger') + 1])
const HINT_STAGGER_MS = Number.isFinite(staggerArg) && staggerArg > 0 ? Math.floor(staggerArg) : 0

const argCount = Number(process.argv[process.argv.indexOf('--students') + 1])
const STUDENTS = Number.isFinite(argCount) && argCount > 0 ? Math.floor(argCount) : 30

/* ───────────────────────────── เครื่องมือวัด ───────────────────────────── */

interface Sample {
  scenario: string
  path: string
  status: number
  ms: number
  ok: boolean
  /** ข้อมูลเสริมที่เอาไปนับทีหลัง เช่น source ของคำใบ้ */
  note?: string
}

const samples: Sample[] = []

interface Jar {
  cookie: string
}

function jar(): Jar {
  return { cookie: '' }
}

async function call(
  scenario: string,
  j: Jar,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any; ms: number }> {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) ?? {}) }
  if (j.cookie) headers.cookie = j.cookie
  if (init.body) headers['content-type'] = 'application/json'

  const started = performance.now()
  let status = 0
  let body: any = null
  try {
    const res = await fetch(BASE + path, { ...init, headers })
    status = res.status
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(';')[0]!
      const name = pair.split('=')[0]
      const kept = (j.cookie || '').split('; ').filter((x) => x && x.split('=')[0] !== name)
      kept.push(pair)
      j.cookie = kept.join('; ')
    }
    body = await res.json().catch(() => null)
  } catch (error) {
    status = 0
    body = { error: error instanceof Error ? error.message : 'fetch-failed' }
  }
  const ms = performance.now() - started

  // นับเฉพาะ path หลัก ไม่เอา query string มาทำให้ตารางแตก
  samples.push({ scenario, path: path.split('?')[0]!, status, ms, ok: status >= 200 && status < 300 })
  return { status, body, ms }
}

function note(scenario: string, path: string, text: string): void {
  const last = [...samples].reverse().find((s) => s.scenario === scenario && s.path === path)
  if (last) last.note = text
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]!
}

function stat(scenario: string) {
  const rows = samples.filter((s) => s.scenario === scenario)
  const times = rows.map((r) => r.ms)
  const failed = rows.filter((r) => !r.ok)
  return {
    n: rows.length,
    max: percentile(times, 100),
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    failedCount: failed.length,
    failedPercent: rows.length === 0 ? 0 : (failed.length / rows.length) * 100,
    rows,
  }
}

const ms = (value: number) => `${value.toFixed(0)} ms`
const sec = (value: number) => `${(value / 1000).toFixed(2)} วิ`

function line(label: string, value: string): void {
  console.log(`  ${label.padEnd(38)} ${value}`)
}

/* ───────────────────────────── ข้อมูลของนักเรียนหุ่น ───────────────────────────── */

const BUSINESS_TYPES = ['bakery', 'clothes', 'coffee', 'secondhand', 'phone-repair', 'flower']
const PRE_QUESTIONS = quiz.pre.map((q) => q.id)
const BM = bigMissionJson as unknown as {
  fields: Array<{ id: string; type: string; required?: boolean; options?: Array<{ value: string }> }>
  selfAssessment: Array<{ id: string }>
  submitModes: Array<{ id: string }>
}

interface Student {
  index: number
  nickname: string
  jar: Jar
  studentId: string | null
}

function bossPayload(index: number) {
  const fields: Record<string, string> = {}
  for (const field of BM.fields) {
    if (field.type === 'choice') {
      fields[field.id] = field.options?.[0]?.value ?? '.com'
      continue
    }
    if (field.type === 'textarea') {
      fields[field.id] =
        `ชื่อนี้สั้นและตรงกับของที่ร้านขาย ลูกค้าพิมพ์ตามป้ายหน้าร้านได้เลยไม่ต้องเดา ` +
        `กลุ่มลูกค้าหลักของร้านอยู่ในไทยจึงเลือกนามสกุลนี้ และชื่อยังบอกได้ว่าร้านทำอะไร (คนที่ ${index})`
      continue
    }
    fields[field.id] = `loadtest${index}`
  }
  const selfAssessment: Record<string, string> = {}
  for (const item of BM.selfAssessment) {
    selfAssessment[item.id] = `คิดว่าทำได้ตามเกณฑ์ เพราะอธิบายเหตุผลได้ครบทุกข้อ (คนที่ ${index})`
  }
  return {
    modeId: BM.submitModes[0]!.id,
    focusRubricId: 'bm-r1',
    fields,
    selfAssessment,
  }
}

/* ───────────────────────────── ห้องทดสอบ ───────────────────────────── */

const teacher = jar()
let classroomId: string | null = null
let roomCode: string | null = null
let cleaned = false

async function cleanup(): Promise<void> {
  if (cleaned || !classroomId) return
  cleaned = true
  const res = await call('cleanup', teacher, '/api/teacher/classroom', {
    method: 'DELETE',
    body: JSON.stringify({ classroomId }),
  })
  if (res.status === 200) {
    console.log(`\nลบห้องทดสอบ ${roomCode} แล้ว (ไฟล์เสียงที่ลบ ${res.body?.deletedVoiceFiles ?? 0})`)
  } else {
    console.error(`\n⚠️ ลบห้อง ${roomCode} (${classroomId}) ไม่สำเร็จ — ${res.status} ต้องลบเอง`)
  }
}

process.on('SIGINT', () => {
  void cleanup().finally(() => process.exit(130))
})

/* ───────────────────────────── เดินสถานการณ์ ───────────────────────────── */

async function main(): Promise<void> {
  console.log(`ทดสอบโหลดห้อง ${STUDENTS} คน ที่ ${BASE}`)

  // ── เตรียมห้องของตัวเอง
  const login = await call('setup', teacher, '/api/teacher/login', {
    method: 'POST',
    body: JSON.stringify({ email: TEACHER_EMAIL, password: TEACHER_PASSWORD }),
  })
  if (login.status !== 200) throw new Error(`ครูเข้าระบบไม่ได้ (${login.status}) — ต้องมีครู UAT อยู่ก่อน`)

  const created = await call('setup', teacher, '/api/teacher/classroom', { method: 'POST' })
  if (created.status !== 201) throw new Error(`สร้างห้องไม่ได้ (${created.status})`)
  classroomId = created.body.classroom.id as string
  roomCode = created.body.classroom.room_code as string
  console.log(`ห้องทดสอบของสคริปต์นี้: ${roomCode} (${classroomId})`)

  const opened = await call('setup', teacher, `/api/teacher/session?classroomId=${classroomId}`)
  const sessionId = opened.body?.session?.id as string
  await call('setup', teacher, '/api/teacher/session', {
    method: 'POST',
    body: JSON.stringify({ action: 'phase', sessionId, phase: 'mission', timerSeconds: 1200 }),
  })
  await call('setup', teacher, '/api/teacher/session', {
    method: 'POST',
    body: JSON.stringify({ action: 'test-window', sessionId, which: 'pre', enabled: true }),
  })

  const students: Student[] = Array.from({ length: STUDENTS }, (_, i) => ({
    index: i + 1,
    nickname: `${NICK_PREFIX}${Date.now().toString(36).slice(-4)}${i + 1}`,
    jar: jar(),
    studentId: null,
  }))

  /* ── 1. เข้าห้องพร้อมกัน */
  console.log('\n[1] ครูบอกให้เปิดเครื่อง — ทุกคนกดเข้าห้องพร้อมกัน')
  await Promise.all(
    students.map((s) =>
      call('1-join', s.jar, '/api/join', {
        method: 'POST',
        body: JSON.stringify({ roomCode, nickname: s.nickname, pin: STUDENT_PIN }),
      }),
    ),
  )
  await Promise.all(
    students.map(async (s) => {
      const me = await call('1-join-me', s.jar, '/api/me')
      s.studentId = me.body?.student?.id ?? null
    }),
  )
  const joined = students.filter((s) => s.studentId).length
  line('เข้าห้องสำเร็จ', `${joined}/${STUDENTS} คน`)

  // ตั้งร้าน (ไม่ใช่สถานการณ์ที่วัด แต่ของจริงทุกคนทำก่อนถึงภารกิจ)
  await Promise.all(
    students.map((s) =>
      call('prep-profile', s.jar, '/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          shopName: `ร้านทดสอบ ${s.index}`,
          businessTypeId: BUSINESS_TYPES[s.index % BUSINESS_TYPES.length],
          domainName: `loadtest${s.index}`,
          isRegisteredCompany: s.index % 3 === 0,
          audience: s.index % 4 === 0 ? 'international' : 'thai',
        }),
      }),
    ),
  )

  /* ── 2. แบบทดสอบก่อนเรียนพร้อมกัน */
  console.log('\n[2] แบบทดสอบก่อนเรียน — เปิดหน้าพร้อมกันแล้วกดส่งพร้อมกัน')
  await Promise.all(students.map((s) => call('2-pretest-open', s.jar, '/api/pretest')))
  await Promise.all(
    students.map((s) => {
      const answers: Record<string, number> = {}
      // คำตอบต่างกันรายคน คะแนนจะได้กระจายเหมือนห้องจริง ไม่ใช่ทุกคนได้เท่ากัน
      PRE_QUESTIONS.forEach((id, i) => {
        answers[id] = (s.index + i) % 4
      })
      return call('2-pretest-submit', s.jar, '/api/pretest', {
        method: 'POST',
        body: JSON.stringify({ answers }),
      })
    }),
  )

  /* ── 5. แผงครูเปิดค้าง (เริ่มก่อนข้อ 3 ปิดหลังข้อ 4) */
  let boardRunning = true
  const boardLoop = (async () => {
    while (boardRunning) {
      const startedAt = Date.now()
      await call('5-teacher-board', teacher, `/api/teacher/board?classroomId=${classroomId}`)
      const rest = BOARD_POLL_MS - (Date.now() - startedAt)
      if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest))
    }
  })()

  /* ── 3. ขอคำใบ้พร้อมกัน */
  console.log('\n[3] ช่วงภารกิจ — ทุกคนกดขอคำใบ้พร้อมกัน (ขณะแผงครู poll อยู่)')
  if (HINT_STAGGER_MS > 0) {
    console.log(`    (เว้นระยะการกดคนละ ${HINT_STAGGER_MS} ms — เหมือนห้องจริงที่ไม่ได้กดพร้อมกันเป๊ะ)`)
  }
  const hints = await Promise.all(
    students.map(async (s) => {
      if (HINT_STAGGER_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, (s.index - 1) * HINT_STAGGER_MS))
      }
      const res = await call('3-hint', s.jar, '/api/hint', {
        method: 'POST',
        body: JSON.stringify({ missionId: 'm1' }),
      })
      const source = res.body?.source ?? 'error'
      note('3-hint', '/api/hint', `${source}:${res.body?.provider ?? '-'}`)
      return {
        source,
        provider: res.body?.provider ?? null,
        reason: res.body?.fallbackReason ?? null,
        ms: res.ms,
        status: res.status,
      }
    }),
  )
  const aiHints = hints.filter((h) => h.source === 'ai').length
  line('ได้คำตอบจาก AI', `${aiHints}/${hints.length} คน`)
  line('ตกไปใช้กฎ', `${hints.filter((h) => h.source === 'fallback').length} คน`)

  /* ── 4. ส่งด่านบอสพร้อมกัน */
  if (SKIP_BOSS) {
    boardRunning = false
    await boardLoop
    report({ joined, hints, submitted: 0, graded: 0, queueMs: 0, rounds: 0 })
    await cleanup()
    await verifyUat777()
    return
  }

  console.log('\n[4] ด่านบอส — ทุกคนกดส่งใบเสนอพร้อมกัน')
  const queueBefore = await call('setup', teacher, '/api/jobs/drain')
  await Promise.all(
    students.map((s) =>
      call('4-boss-submit', s.jar, '/api/ceo', {
        method: 'POST',
        body: JSON.stringify(bossPayload(s.index)),
      }),
    ),
  )

  const submitted = samples.filter((s) => s.scenario === '4-boss-submit' && s.ok).length
  line('ส่งสำเร็จ', `${submitted}/${STUDENTS} ใบ`)
  line('คิวก่อนเริ่ม (ทั้งระบบ)', JSON.stringify(queueBefore.body ?? {}))

  // คิวตรวจเบื้องหลัง — ทำเหมือนแผงครูที่เปิดค้างไว้ คือยิง drain ซ้ำจนคิวว่าง
  console.log('\n[4b] คิวตรวจเบื้องหลัง — แผงครูปลุกคิวจนครบ (นักเรียนไม่ต้องรอตรงนี้)')
  const queueStarted = performance.now()
  const myIds = students.map((s) => s.studentId).filter((id): id is string => Boolean(id))
  let graded = 0
  let rounds = 0
  const QUEUE_DEADLINE_MS = 15 * 60 * 1000
  while (performance.now() - queueStarted < QUEUE_DEADLINE_MS) {
    rounds += 1
    const drained = await call('4b-drain', teacher, '/api/jobs/drain', {
      method: 'POST',
      body: JSON.stringify({ max: 20 }),
    })
    graded = await countGradedByAi(myIds)
    const left = drained.body?.queue?.queued ?? '?'
    console.log(
      `  รอบที่ ${rounds}: ตรวจไป ${drained.body?.processed ?? '?'} งาน · ` +
        `ใบของห้องทดสอบที่ AI ตรวจแล้ว ${graded}/${submitted} · คิวคงเหลือทั้งระบบ ${left} · ` +
        `ผ่านไป ${sec(performance.now() - queueStarted)}`,
    )
    if (graded >= submitted) break
    if ((drained.body?.processed ?? 0) === 0 && left === 0) break
  }
  const queueMs = performance.now() - queueStarted

  boardRunning = false
  await boardLoop

  /* ── รายงาน */
  report({ joined, hints, submitted, graded, queueMs, rounds })

  await cleanup()
  await verifyUat777()
}

/** ใบของห้องทดสอบที่ AI ตรวจเสร็จแล้วกี่ใบ — อ่านจากฐานข้อมูลตรง ๆ ไม่ผ่านหน้าจอครู */
async function countGradedByAi(studentIds: string[]): Promise<number> {
  if (studentIds.length === 0) return 0
  const db = getServiceClient()
  const { data } = await db
    .from('submissions')
    .select('id, ai_scores')
    .in('student_id', studentIds)
  return (data ?? []).filter((row) => {
    const scores = row.ai_scores as { aiProposed?: unknown; gradingStatus?: unknown } | null
    return Boolean(scores?.aiProposed)
  }).length
}

/** ห้องเดโมต้องยังอยู่ครบหลังทดสอบเสร็จ */
async function verifyUat777(): Promise<void> {
  const db = getServiceClient()
  const { data: room } = await db
    .from('classrooms')
    .select('id, room_code, status')
    .eq('room_code', 'UAT777')
    .maybeSingle()
  if (!room) {
    console.error('\n⚠️ ไม่พบห้อง UAT777 — ต้องตรวจสอบ')
    return
  }
  const { count } = await db
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('classroom_id', room.id)
  console.log(`ตรวจซ้ำ: ห้อง UAT777 ยังอยู่ (${room.status}) · นักเรียน ${count ?? 0} คน`)

  const { count: leftovers } = await db
    .from('students')
    .select('id', { count: 'exact', head: true })
    .like('nickname', `${NICK_PREFIX}%`)
  console.log(`ตรวจซ้ำ: นักเรียนทดสอบที่ยังค้างในระบบ ${leftovers ?? 0} คน`)
}

function report(summary: {
  joined: number
  hints: Array<{ source: string; provider: string | null; reason?: string | null; ms: number }>
  submitted: number
  graded: number
  queueMs: number
  rounds: number
}): void {
  console.log('\n═══════════════ ตารางผล ═══════════════')
  console.log('สถานการณ์                     คำขอ   ช้าสุด      กลาง(p50)  p95        พลาด')
  const scenarios: Array<[string, string]> = [
    ['1-join', '1 เข้าห้องพร้อมกัน'],
    ['2-pretest-submit', '2 ส่งแบบทดสอบพร้อมกัน'],
    ['3-hint', '3 ขอคำใบ้พร้อมกัน'],
    ['4-boss-submit', '4 ส่งด่านบอสพร้อมกัน'],
    ['5-teacher-board', '5 แผงครู poll 3 วินาที'],
  ]
  for (const [key, label] of scenarios) {
    const s = stat(key)
    console.log(
      `${label.padEnd(30)}${String(s.n).padEnd(7)}${ms(s.max).padEnd(12)}${ms(s.p50).padEnd(11)}${ms(s.p95).padEnd(11)}${s.failedCount} (${s.failedPercent.toFixed(1)}%)`,
    )
  }

  const hintStat = stat('3-hint')
  const aiCount = summary.hints.filter((h) => h.source === 'ai').length
  console.log('\n── เทียบกับเกณฑ์ที่ประกาศไว้')
  line(
    `คำใบ้ทุกคำขอต้องไม่เกิน ${HINT_BUDGET_MS / 1000} วินาที`,
    `ช้าสุด ${ms(hintStat.max)} → ${hintStat.max <= HINT_BUDGET_MS ? 'ผ่าน' : 'ไม่ผ่าน'}`,
  )
  line('คำใบ้ได้จาก AI', `${aiCount}/${summary.hints.length} คน (${((aiCount / Math.max(1, summary.hints.length)) * 100).toFixed(0)}%)`)
  const byProvider = new Map<string, number>()
  for (const hint of summary.hints) {
    const key = `${hint.source}:${hint.provider ?? '-'}`
    byProvider.set(key, (byProvider.get(key) ?? 0) + 1)
  }
  line('แยกตามผู้ให้บริการ', [...byProvider].map(([k, v]) => `${k}=${v}`).join(' · '))
  const byReason = new Map<string, number>()
  for (const hint of summary.hints.filter((h) => h.source !== 'ai')) {
    const key = hint.reason ?? 'ไม่ได้บอกเหตุผล'
    byReason.set(key, (byReason.get(key) ?? 0) + 1)
  }
  if (byReason.size > 0) {
    line('เหตุผลที่ตกไปใช้กฎ', [...byReason].map(([k, v]) => `${k}=${v}`).join(' · '))
  }
  const aiTimes = summary.hints.filter((h) => h.source === 'ai').map((h) => h.ms)
  const ruleTimes = summary.hints.filter((h) => h.source !== 'ai').map((h) => h.ms)
  line('เวลาคนที่ได้ AI', aiTimes.length ? `กลาง ${ms(percentile(aiTimes, 50))} · ช้าสุด ${ms(percentile(aiTimes, 100))}` : '-')
  line('เวลาคนที่ตกไปใช้กฎ', ruleTimes.length ? `กลาง ${ms(percentile(ruleTimes, 50))} · ช้าสุด ${ms(percentile(ruleTimes, 100))}` : '-')
  const bossStat = stat('4-boss-submit')
  line(
    'ส่งด่านบอสแล้วนักเรียนรอ',
    `กลาง ${ms(bossStat.p50)} · ช้าสุด ${ms(bossStat.max)} → ${bossStat.p50 <= SUBMIT_WAIT_TARGET_MS ? 'ผ่าน' : 'ไม่ผ่าน'}`,
  )
  line(
    'คิวตรวจครบทุกใบ',
    `${summary.graded}/${summary.submitted} ใบ ใช้ ${sec(summary.queueMs)} (${summary.rounds} รอบ)`,
  )

  console.log('\n── คำขอที่พลาด แยกตาม path')
  const failed = samples.filter((s) => !s.ok)
  if (failed.length === 0) {
    console.log('  ไม่มีคำขอไหนพลาดเลย')
  } else {
    const grouped = new Map<string, number>()
    for (const f of failed) {
      const key = `${f.path} → ${f.status}`
      grouped.set(key, (grouped.get(key) ?? 0) + 1)
    }
    for (const [key, count] of [...grouped].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(4)} ครั้ง  ${key}`)
    }
  }
  const total = samples.length
  const errorPercent = (failed.length / Math.max(1, total)) * 100
  console.log(`\n  รวมคำขอทั้งหมด ${total} ครั้ง · พลาด ${failed.length} ครั้ง (${errorPercent.toFixed(2)}%)`)
  const serverErrors = failed.filter((f) => f.status >= 500 || f.status === 0)
  console.log(`  ในนั้นเป็น 500 หรือเชื่อมต่อไม่ได้ ${serverErrors.length} ครั้ง`)
}

void main()
  .catch(async (error) => {
    console.error('\nล้มกลางทาง:', error instanceof Error ? error.message : error)
    process.exitCode = 1
    await cleanup()
  })
  .finally(() => {
    // เผื่อ main จบแบบไม่ผ่าน cleanup (เช่น throw ก่อนสร้างห้อง) — ปลอดภัยเพราะ cleanup กันเรียกซ้ำ
    void cleanup()
  })

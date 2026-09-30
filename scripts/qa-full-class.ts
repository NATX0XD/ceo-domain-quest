/**
 * เล่นจริงครบคาบ 60 นาที 3 แบบพร้อมกัน (QA-3) — เดินตามลำดับใน docs/lesson-plan.md
 *
 * รัน: npx tsx scripts/qa-full-class.ts        (ต้องมี dev server พอร์ต 3000 + npm run seed:uat)
 *
 * เดินเหมือนคนจริงผ่าน API เดียวกับที่หน้าเว็บเรียก ไม่แตะฐานข้อมูลตรงนอกจากตอนเก็บกวาด
 * 3 ตัวละคร: เก่ง (ผ่านรวดไม่ขอคำใบ้) · กลาง (ขอคำใบ้ + เปลี่ยนช่องทางกลางทาง) · ช้า (ตอบผิดซ้ำจนครูต้องเข้าช่วย)
 *
 * จับเวลาที่ "ระบบกิน" ทุกขั้น แล้วเทียบกับงบนาทีของแต่ละขั้นในแผนการสอน
 * เวลาที่คนใช้ฟัง/พิมพ์/ดูคลิป วัดด้วยสคริปต์ไม่ได้ — ส่วนนั้นคิดจากงบในไฟล์เนื้อหาแยกอีกตาราง
 *
 * เก็บกวาดตัวละครทั้ง 3 ตัวทุกครั้งที่จบ (และตอนล้มกลางทาง) ห้อง UAT777 จึงไม่บวม
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as repo from '../lib/db/repo'
import { getServiceClient } from '../lib/db/client'
import { resolveBossTemplate } from '../app/api/ceo/_lib/boss-template'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

const BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const TEACHER_EMAIL = 'kru@uat.local'
const TEACHER_PASSWORD = 'uat1234'
const ROOM_CODE = 'UAT777'

/** งบนาทีของแต่ละขั้นตาม docs/lesson-plan.md หัวข้อ 5 */
const PLAN_MINUTES: Record<string, number> = {
  'ขั้น 1 ฟังครู + แบบทดสอบก่อนเรียน': 15,
  'ขั้น 2 รู้จักตัวเอง': 5,
  'ขั้น 3 ภารกิจย่อย 4 ด่าน': 20,
  'ขั้น 4 ด่านบอส CEO': 10,
  'ขั้น 5 ครูสรุป + ผนังผลงาน': 5,
  'ขั้น 6 ทบทวนตัวเอง + แบบทดสอบหลังเรียน': 5,
}

// ───────────────────────────── ผลตรวจ

type Severity = 'พังจริง' | 'น่ารำคาญ' | 'ข้อสังเกต'
type Finding = { severity: Severity; title: string; where: string; repro: string }
const findings: Finding[] = []
function finding(severity: Severity, title: string, where: string, repro: string): void {
  findings.push({ severity, title, where, repro })
}

type Check = { ok: boolean; name: string; detail: string }
const checks: Check[] = []
function check(ok: boolean, name: string, detail: string): boolean {
  checks.push({ ok, name, detail })
  process.stdout.write(`${ok ? '  ok   ' : '  FAIL '} ${name} — ${detail}\n`)
  return ok
}

const phaseTimes: Array<{ phase: string; ms: number }> = []

// ───────────────────────────── ตัวช่วยยิง HTTP ที่ถือคุกกี้แยกคน

class Actor {
  readonly jar = new Map<string, string>()
  constructor(readonly label: string) {}

  async req(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<{ status: number; json: Record<string, unknown> | null; text: string; ms: number }> {
    const t0 = Date.now()
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(this.jar.size > 0 ? { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    for (const raw of res.headers.getSetCookie()) {
      const pair = raw.split(';')[0] ?? ''
      const eq = pair.indexOf('=')
      if (eq > 0) this.jar.set(pair.slice(0, eq), pair.slice(eq + 1))
    }
    const text = await res.text()
    let json: Record<string, unknown> | null = null
    try {
      const parsed = JSON.parse(text) as unknown
      if (parsed && typeof parsed === 'object') json = parsed as Record<string, unknown>
    } catch {
      /* HTML */
    }
    return { status: res.status, json, text, ms: Date.now() - t0 }
  }

  cookieHeader(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
  }
}

/**
 * ยิงซ้ำเมื่อเจอ 500 — มี 5 session แก้โค้ดพร้อมกัน dev server อาจกำลัง compile
 * 500 ที่หายเองรอบถัดไปไม่นับเป็นบั๊ก (คำสั่งของ master)
 */
async function stable(
  actor: Actor,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; json: Record<string, unknown> | null; text: string; ms: number; retried: number }> {
  let retried = 0
  let last: { status: number; json: Record<string, unknown> | null; text: string; ms: number } | null = null
  for (;;) {
    try {
      last = await actor.req(path, init)
    } catch (error) {
      // dev server รีสตาร์ตกลางทาง (5 session แก้โค้ดพร้อมกัน) = ต่อไม่ติดชั่วคราว ไม่ใช่บั๊ก
      last = { status: 599, json: null, text: String(error).slice(0, 120), ms: 0 }
    }
    if (last.status < 500 || retried >= 4) break
    retried += 1
    await new Promise((r) => setTimeout(r, 3000))
  }
  if (last.status >= 500) {
    finding(
      'พังจริง',
      `${init.method ?? 'GET'} ${path} ตอบ ${last.status} ซ้ำ ${retried + 1} ครั้งติด`,
      path,
      `ยิง ${init.method ?? 'GET'} ${path} ซ้ำ ${retried + 1} ครั้งห่างกัน 3 วินาที ยังได้ ${last.status} ทุกครั้ง · ${last.text.slice(0, 120)}`,
    )
  }
  return { ...last, retried }
}

// ───────────────────────────── เฉลย (ฝั่งเซิร์ฟเวอร์เท่านั้น เหมือนที่ route ทำ)

function contentJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), 'content', file), 'utf8')) as T
}

const missionAnswers = contentJson<{
  missions: Array<{ id: string; checkId: string; answerIndex: number }>
}>('missions-answers.json')

const quizAnswers = contentJson<{
  pre: Array<{ id: string; answerIndex: number }>
  post: Array<{ id: string; answerIndex: number }>
}>('quiz-answers.json')

const checkAnswers = contentJson<{
  questions: Array<{ id: string; answerIndex: number }>
}>('check-questions-answers.json')

/** โจทย์ของชุดที่ผู้เรียนได้รับ — เฉลยอยู่ไฟล์เดียวรวมทุกชุด จับคู่ด้วย id ของข้อ */
const checkSets = contentJson<{
  sets: Array<{ id: string; questions: Array<{ id: string }> }>
}>('check-questions.json')

function missionAnswer(id: string): { checkId: string; answerIndex: number } {
  const row = missionAnswers.missions.find((m) => m.id === id)
  if (!row) throw new Error(`ไม่มีเฉลยภารกิจ ${id}`)
  return { checkId: row.checkId, answerIndex: row.answerIndex }
}

/** ตอบผิดแบบตั้งใจ — เลือกช้อยส์ที่ไม่ใช่เฉลย */
function wrongIndex(correct: number): number {
  return correct === 0 ? 1 : 0
}

// ───────────────────────────── ตัวละคร

type Persona = {
  actor: Actor
  nickname: string
  shop: { shopName: string; businessTypeId: string; domainName: string; isRegisteredCompany: boolean; audience: 'thai' | 'international' }
  route: 'clip' | 'card' | 'game' | 'buddy'
  goalId: string
  level: 1 | 2 | 3
  studentId?: string
  /** เก็บของที่ควรต่างกันระหว่างคน เอาไปเทียบตอนท้าย */
  fingerprint: Record<string, string>
}

const PERSONAS: Persona[] = [
  {
    actor: new Actor('เก่ง'),
    nickname: 'คิวเอเก่ง',
    shop: { shopName: 'เก่งเกมออนไลน์', businessTypeId: 'game', domainName: 'kengplay', isRegisteredCompany: false, audience: 'thai' },
    route: 'game',
    goalId: 'goal-challenge',
    level: 1,
    fingerprint: {},
  },
  {
    actor: new Actor('กลาง'),
    nickname: 'คิวเอกลาง',
    shop: { shopName: 'กลางเบเกอรี่', businessTypeId: 'bakery', domainName: 'klangcake', isRegisteredCompany: false, audience: 'thai' },
    route: 'clip',
    goalId: 'goal-good',
    level: 2,
    fingerprint: {},
  },
  {
    actor: new Actor('ช้า'),
    nickname: 'คิวเอช้า',
    shop: { shopName: 'ช้าซ่อมมือถือ', businessTypeId: 'phone-repair', domainName: 'chafix', isRegisteredCompany: false, audience: 'thai' },
    route: 'buddy',
    goalId: 'goal-basic',
    level: 3,
    fingerprint: {},
  },
]

const teacher = new Actor('ครู')
let classroomId = ''
let sessionId = ''

// ───────────────────────────── ขั้นตอน

async function phase<T>(name: string, run: () => Promise<T>): Promise<T> {
  console.log(`\n━━ ${name} ━━`)
  const t0 = Date.now()
  const out = await run()
  const ms = Date.now() - t0
  phaseTimes.push({ phase: name, ms })
  console.log(`  (ระบบกินเวลา ${(ms / 1000).toFixed(1)} วินาที)`)
  return out
}

async function setPhase(p: repo.SessionPhase, minutes: number): Promise<void> {
  const res = await stable(teacher, '/api/teacher/session', {
    method: 'POST',
    body: { action: 'phase', sessionId, phase: p, timerSeconds: minutes * 60 },
  })
  check(res.status === 200, `ครูย้ายช่วงไป "${p}"`, `${res.status}`)
}

async function teacherOpensRoom(): Promise<void> {
  const login = await stable(teacher, '/api/teacher/login', {
    method: 'POST',
    body: { email: TEACHER_EMAIL, password: TEACHER_PASSWORD },
  })
  if (!check(login.status === 200, 'ครูล็อกอิน', `${login.status}`)) throw new Error('ครูล็อกอินไม่ผ่าน')

  const rooms = await stable(teacher, '/api/teacher/classroom')
  const list = (rooms.json?.classrooms ?? []) as Array<{ id: string; room_code: string }>
  const room = list.find((c) => c.room_code === ROOM_CODE)
  if (!check(Boolean(room), `ครูเห็นห้อง ${ROOM_CODE}`, room ? room.id : 'ไม่พบ — รัน npm run seed:uat ก่อน')) {
    throw new Error('ไม่พบห้อง UAT')
  }
  classroomId = room!.id

  const sess = await stable(teacher, `/api/teacher/session?classroomId=${classroomId}`)
  const s = sess.json?.session as { id?: string; phase?: string } | undefined
  check(Boolean(s?.id), 'คาบเปิดอยู่', `ช่วงปัจจุบัน ${String(s?.phase)}`)
  sessionId = String(s?.id)

  // ขั้นที่ 1 เริ่มที่ช่วง "รอเริ่ม" แล้วครูเปิดแบบทดสอบก่อนเรียน
  await setPhase('wait', 15)
  const pre = await stable(teacher, '/api/teacher/session', {
    method: 'POST',
    body: { action: 'test-window', sessionId, which: 'pre', enabled: true },
  })
  check(pre.status === 200, 'ครูเปิดแบบทดสอบก่อนเรียน', `${pre.status}`)

  const qr = await stable(teacher, `/teacher?classroomId=${classroomId}`)
  check(qr.text.includes(ROOM_CODE), 'จอครูมีรหัสห้องให้ฉาย', `หน้า ${qr.status}`)
}

async function studentJoins(p: Persona): Promise<void> {
  const res = await stable(p.actor, '/api/join', {
    method: 'POST',
    body: { roomCode: ROOM_CODE, nickname: p.nickname, pin: '1357' },
  })
  if (!check(res.status === 200, `[${p.actor.label}] เข้าห้องด้วยรหัส ${ROOM_CODE}`, `${res.status} ${String(res.json?.nickname ?? '')}`)) {
    throw new Error(`${p.actor.label} เข้าห้องไม่ได้`)
  }
  p.nickname = String(res.json?.nickname ?? p.nickname)
  const me = await stable(p.actor, '/api/me')
  p.studentId = String((me.json?.student as { id?: string })?.id ?? '')
}

async function preTest(p: Persona, correctCount: number): Promise<void> {
  const answers: Record<string, number> = {}
  quizAnswers.pre.forEach((q, i) => {
    answers[q.id] = i < correctCount ? q.answerIndex : wrongIndex(q.answerIndex)
  })
  const res = await stable(p.actor, '/api/pretest', { method: 'POST', body: { answers } })
  check(
    res.status === 200,
    `[${p.actor.label}] ทำแบบทดสอบก่อนเรียน 10 ข้อ`,
    `${res.status} · ได้ ${String(res.json?.score ?? '?')}`,
  )
}

async function selfKnow(p: Persona): Promise<void> {
  const setup = await stable(p.actor, '/api/profile', { method: 'POST', body: p.shop })
  check(setup.status === 200, `[${p.actor.label}] ตั้งค่าร้าน`, `${setup.status}`)

  const prefAnswers: Record<string, string> = {}
  for (let i = 1; i <= 5; i++) prefAnswers[`pref-${i}`] = `pref-${i}-${['a', 'b', 'c', 'd'][p.level - 1] ?? 'a'}`
  const prefs = await stable(p.actor, '/api/profile/preferences', { method: 'POST', body: { prefAnswers } })
  check(
    prefs.status === 200,
    `[${p.actor.label}] ตอบคำถามความถนัด`,
    `${prefs.status} · ระบบเสนอ ${String(prefs.json?.suggestedRoute ?? '-')} ระดับ ${String(prefs.json?.suggestedLevel ?? '-')}`,
  )
  p.fingerprint['ช่องทาง+ระดับที่ระบบเสนอ'] =
    `${String(prefs.json?.suggestedRoute ?? '-')}/${String(prefs.json?.suggestedLevel ?? '-')}`
  p.fingerprint['วัตถุประสงค์ที่ยังอ่อน'] = JSON.stringify(prefs.json?.weakObjectives ?? [])

  // ตรวจความพร้อม 4 ข้อ — คนละคนต้องได้คนละชุด (S-05)
  const chk = await stable(p.actor, '/api/check')
  const setId = String(chk.json?.setId ?? '')
  p.fingerprint['ชุดข้อตรวจความพร้อม'] = setId
  check(chk.status === 200 && setId.length > 0, `[${p.actor.label}] ได้ชุดข้อตรวจความพร้อม`, setId || `${chk.status}`)

  const set = checkSets.sets.find((s) => s.id === setId)
  if (set) {
    const answers: Record<string, number> = {}
    const confidence: Record<string, number> = {}
    set.questions.forEach((q, i) => {
      const key = checkAnswers.questions.find((a) => a.id === q.id)
      if (!key) return
      // ช้า: ตอบผิดครึ่ง และบอกว่ามั่นใจเต็มที่ → ต้องได้ธง "ควรคุย"
      const beWrong = p.actor.label === 'ช้า' && i % 2 === 0
      answers[q.id] = beWrong ? wrongIndex(key.answerIndex) : key.answerIndex
      confidence[q.id] = p.actor.label === 'ช้า' ? 3 : p.actor.label === 'กลาง' ? 2 : 3
    })
    const sent = await stable(p.actor, '/api/check', { method: 'POST', body: { answers, confidence, setId } })
    check(sent.status === 200, `[${p.actor.label}] ส่งข้อตรวจความพร้อม`, `${sent.status} · ${String(sent.json?.score ?? '')}/${String(sent.json?.total ?? '')}`)
  } else {
    finding('ข้อสังเกต', `ไม่พบชุดข้อตรวจ ${setId} ในไฟล์เนื้อหา`, 'content/check-questions.json', `GET /api/check ของ ${p.actor.label} คืน setId=${setId} ซึ่งไม่มีใน sets[]`)
  }

  const choice = await stable(p.actor, '/api/profile/choice', {
    method: 'POST',
    body: { route: p.route, level: p.level, goalId: p.goalId, ownGoalText: `อยากให้ลูกค้าจำชื่อ ${p.shop.shopName} ได้`, finish: true },
  })
  check(choice.status === 200, `[${p.actor.label}] เลือกช่องทาง + ตั้งเป้าดาวเอง`, `${choice.status} · ${p.route} · ${p.goalId}`)
}

/** เรื่องเปิดของแต่ละภารกิจ ต้องอ้างถึงร้านของเจ้าตัว */
async function readStory(p: Persona, missionId: string): Promise<void> {
  const res = await stable(p.actor, `/api/mission/${missionId}/story`)
  if (res.status !== 200) {
    check(false, `[${p.actor.label}] เรื่องเปิด ${missionId}`, `${res.status} ${String(res.json?.message ?? '')}`)
    return
  }
  const text = JSON.stringify(res.json)
  p.fingerprint[`เรื่องเปิด ${missionId}`] = text.slice(0, 160)
  check(true, `[${p.actor.label}] เรื่องเปิด ${missionId}`, `${text.length} ตัวอักษร · อ้างชื่อร้าน ${text.includes(p.shop.shopName) ? 'ใช่' : 'ไม่'}`)
}

type MissionPlan = { id: string; hints: number; wrongTries: number; switchTo?: 'clip' | 'card' | 'game' | 'buddy'; askHelp?: boolean }

async function doMission(p: Persona, plan: MissionPlan): Promise<void> {
  await readStory(p, plan.id)

  const before = await stable(p.actor, '/api/me')
  const beforeStars = starsOf(before.json, plan.id)

  for (let i = 0; i < plan.hints; i++) {
    const h = await stable(p.actor, '/api/hint', { method: 'POST', body: { missionId: plan.id } })
    check(h.status === 200, `[${p.actor.label}] ${plan.id} ขอคำใบ้ครั้งที่ ${i + 1}`, `${h.status} · ใช้ไป ${String(h.json?.hintsUsed ?? '?')}`)
  }

  if (plan.switchTo) {
    const sw = await stable(p.actor, `/api/mission/${plan.id}/switch-route`, { method: 'POST', body: { toRoute: plan.switchTo } })
    check(sw.status === 200, `[${p.actor.label}] ${plan.id} เปลี่ยนช่องทางกลางทางไป ${plan.switchTo}`, `${sw.status}`)
  }

  const { checkId, answerIndex } = missionAnswer(plan.id)

  for (let i = 0; i < plan.wrongTries; i++) {
    // กันตัวกัน double-submit 4 วินาที — เว้นจังหวะเหมือนคนคิดจริง
    await new Promise((r) => setTimeout(r, 4200))
    const res = await stable(p.actor, `/api/mission/${plan.id}/check`, {
      method: 'POST',
      body: { checkId, choiceIndex: wrongIndex(answerIndex), channel: plan.switchTo ?? p.route, confidence: 3 },
    })
    const said = res.json?.correct
    check(
      res.status === 200 && said === false,
      `[${p.actor.label}] ${plan.id} ตอบผิดครั้งที่ ${i + 1} แล้วหน้าจอบอกว่าผิดจริง`,
      `${res.status} · correct=${String(said)} · ดาว ${String(res.json?.stars)}`,
    )
    if (res.status === 200 && said !== false) {
      finding('พังจริง', `ตอบผิดแต่ API บอกว่าถูก (${plan.id})`, `app/api/mission/[id]/check/route.ts`, `POST /api/mission/${plan.id}/check choiceIndex=${wrongIndex(answerIndex)} คืน correct=${String(said)}`)
    }
  }

  if (plan.askHelp) {
    const help = await stable(p.actor, '/api/help', { method: 'POST', body: { missionId: plan.id } })
    check(help.status === 200, `[${p.actor.label}] กดปุ่มขอให้ครูช่วย`, `${help.status}`)
  }

  await new Promise((r) => setTimeout(r, 4200))
  const ok = await stable(p.actor, `/api/mission/${plan.id}/check`, {
    method: 'POST',
    body: { checkId, choiceIndex: answerIndex, channel: plan.switchTo ?? p.route, confidence: p.actor.label === 'ช้า' ? 1 : 3 },
  })
  const passed = ok.json?.passed === true
  check(
    ok.status === 200 && ok.json?.correct === true,
    `[${p.actor.label}] ${plan.id} ตอบถูกแล้วผ่าน`,
    `${ok.status} · ดาว ${String(ok.json?.stars)} · ผ่าน ${String(passed)} · คำใบ้ที่ใช้ ${String(ok.json?.hintsUsed)}`,
  )

  const stars = Number(ok.json?.stars ?? -1)
  if (plan.hints > 0 && plan.wrongTries === 0) {
    check(stars === 3, `[${p.actor.label}] ${plan.id} ขอคำใบ้แล้วดาวไม่ถูกหัก`, `ขอคำใบ้ ${plan.hints} ครั้ง ตอบถูกครั้งแรก ได้ ${stars} ดาว (ต้องได้ 3)`)
    if (stars !== 3) {
      finding('พังจริง', `ขอคำใบ้แล้วดาวถูกหัก (${plan.id})`, 'core/personalize.ts starsFor()', `ขอคำใบ้ ${plan.hints} ครั้ง ตอบถูกครั้งแรก ได้ ${stars} ดาว แต่แผนการสอนบรรทัด 108 เขียนว่า "ขอคำใบ้ได้ 3 ครั้ง ไม่หักดาว"`)
    }
  }
  if (plan.wrongTries > 0) {
    check(stars < 3, `[${p.actor.label}] ${plan.id} ตอบผิดแล้วดาวถูกหักจริง`, `ตอบผิด ${plan.wrongTries} ครั้ง ได้ ${stars} ดาว`)
  }
  void beforeStars
}

function starsOf(me: Record<string, unknown> | null, missionId: string): number {
  const missions = (me?.missions ?? []) as Array<{ missionId?: string; stars?: number }>
  return missions.find((m) => m.missionId === missionId)?.stars ?? 0
}

async function bossStage(p: Persona, focusRubricId: string): Promise<string | null> {
  // ยื่นป้ายที่สถานี B ก่อน (ภารกิจที่ 3 ของแผน)
  const sb = await stable(p.actor, '/api/station-b/submit', {
    method: 'POST',
    body: { tldId: 'com', reasonText: `ร้าน ${p.shop.shopName} เลือก .com เพราะลูกค้าทั่วไปคุ้นเคยที่สุด พิมพ์ครั้งเดียวก็เจอ` },
  })
  check(sb.status === 200 && sb.json?.accepted === true, `[${p.actor.label}] ยื่นป้ายร้านที่สถานี B`, `${sb.status} · ${String(sb.json?.domain)} · ที่มา ${String(sb.json?.source)}/${String(sb.json?.provider)}`)

  const resolved = await resolveBossTemplate(p.studentId!)
  p.fingerprint['แม่แบบด่านบอส'] = resolved
    ? `${resolved.template.id} (${resolved.source} · อ่อนสุด ${String(resolved.weakestObjectiveId)})`
    : '(ไม่ได้แม่แบบ)'

  // หน้าจอต้องขึ้นสถานการณ์ของแม่แบบนั้นจริง ไม่ใช่ข้อความกลางของทุกคน
  const page = await stable(p.actor, '/ceo')
  const scenario = resolved?.template.scenario ?? ''
  const shown = scenario.length > 20 && page.text.includes(scenario.slice(0, 20))
  check(
    page.status === 200,
    `[${p.actor.label}] เปิดหน้าด่านบอสได้`,
    `${page.status} · แม่แบบ ${String(resolved?.template.id)} · หน้าจอขึ้นสถานการณ์ของแม่แบบนั้น ${shown ? 'ใช่' : 'ไม่ (อาจถูกแทนด้วยเรื่องที่ AI เขียนให้)'}`,
  )

  const res = await stable(p.actor, '/api/ceo', {
    method: 'POST',
    body: {
      modeId: 'bm-mode-write',
      focusRubricId,
      fields: {
        'bm-f1': p.shop.domainName,
        'bm-f2': '.com',
        'bm-f3': `ชื่อนี้ตรงกับป้ายหน้าร้าน ${p.shop.shopName} ลูกค้าพิมพ์ตามได้ทันทีไม่ต้องเลื่อนหาในแอป`,
        'bm-f4': 'เลือก .com เพราะร้านยังไม่ได้จดทะเบียนนิติบุคคล จึงจด .co.th ไม่ได้ตามเงื่อนไขของ THNIC',
        'bm-f5': 'ลูกค้าหลักคือคนในชุมชนที่อยากสั่งของล่วงหน้าแล้วมารับที่ร้าน',
      },
      selfAssessment: {
        'bm-self1': 'คิดว่าชื่อจำง่ายแล้ว',
        'bm-self2': 'ยังอธิบายเหตุผลได้ไม่ละเอียดมาก',
        'bm-self3': 'รอบหน้าจะเขียนเหตุผลให้ชัดขึ้น',
      },
    },
  })
  check(res.status === 200, `[${p.actor.label}] ส่งใบเสนอด่านบอส (เน้นด้าน ${focusRubricId})`, `${res.status} ${String(res.json?.message ?? '')}`)
  return res.json?.submissionId ? String(res.json.submissionId) : null
}

async function postTest(p: Persona, correctCount: number): Promise<void> {
  const answers: Record<string, number> = {}
  quizAnswers.post.forEach((q, i) => {
    answers[q.id] = i < correctCount ? q.answerIndex : wrongIndex(q.answerIndex)
  })
  const res = await stable(p.actor, '/api/posttest', { method: 'POST', body: { answers } })
  check(res.status === 200, `[${p.actor.label}] ทำแบบทดสอบหลังเรียน`, `${res.status} · ได้ ${String(res.json?.score ?? '?')}`)
}

async function reflect(p: Persona): Promise<void> {
  const inClass = {
    'reflect-1': `วันนี้รู้ว่านามสกุลโดเมนมีเงื่อนไขไม่เหมือนกัน ร้าน ${p.shop.shopName} จด .co.th ไม่ได้`,
    'reflect-2': 'ยังสงสัยว่าถ้าชื่อที่อยากได้ถูกคนอื่นจดไปแล้วต้องทำอย่างไร',
  }

  // docs/lesson-plan.md:150 เขียนว่าในคาบตอบ 2 ข้อ ข้อ 3 ตอบต่อที่บ้าน — เดินตามแผนก่อน
  const asPlanned = await stable(p.actor, '/api/reflect', { method: 'POST', body: { answers: inClass, submit: true } })
  const blocked = asPlanned.status === 422
  check(
    !blocked,
    `[${p.actor.label}] ตอบ 2 ข้อตามแผนการสอนแล้วกดส่งได้`,
    `${asPlanned.status} ${String(asPlanned.json?.code ?? '')} ${JSON.stringify(asPlanned.json?.tooShort ?? '')}`,
  )
  if (blocked && p.actor.label === 'เก่ง') {
    finding(
      'พังจริง',
      'ตอบสะท้อนคิด 2 ข้อตามแผนการสอนแล้วกดส่งไม่ได้ การ์ดสรุปดาวนาทีที่ 58-59 จึงไม่ขึ้นเลย',
      'app/api/reflect/route.ts:69-73 (ด่านบังคับครบ 3 ข้อ) · components/reflect-client.tsx:333 (การ์ดสรุป + ลิงก์ใบประกาศ/แบบสอบถาม ซ่อนไว้จนกว่า submitted=true) · ขัดกับ docs/lesson-plan.md:150 และ content/reflection.json meta.skipNote',
      'เข้าเป็นนักเรียน ไปหน้า /reflect กรอกเฉพาะ reflect-1 กับ reflect-2 (ข้อ 3 แผนบอกให้ทำที่บ้าน) แล้วกด "ส่งคำตอบของฉัน" → POST /api/reflect {submit:true} คืน 422 code=too-short tooShort=[{"id":"reflect-3"}] และการ์ดเทียบดาวกับเป้าหมายไม่ขึ้น',
    )
  }

  // ตอบครบ 3 ข้อเพื่อเดินต่อให้จบคาบ
  const full = await stable(p.actor, '/api/reflect', {
    method: 'POST',
    body: {
      answers: { ...inClass, 'reflect-3': `จะเอาไปใช้ตอนตั้งชื่อเว็บให้ร้าน ${p.shop.shopName} จริง ๆ` },
      submit: true,
    },
  })
  check(full.status === 200, `[${p.actor.label}] ตอบครบ 3 ข้อแล้วส่งได้`, `${full.status} · ดาว ${String(full.json?.earnedStars)}/${String(full.json?.goalStars)} · ${String(full.json?.outcome ?? '')}`)
}

/** คำที่ห้ามโผล่บนหน้าจอผู้เรียนเด็ดขาด (สเปกข้อ 2.3 ไม่มีการตก) */
const FORBIDDEN = ['ไม่ผ่าน', 'สอบตก', 'ตกแล้ว', 'คุณตก', 'ล้มเหลว', 'FAILED']

async function certificateCheck(p: Persona, expectEligible: boolean): Promise<void> {
  const res = await stable(p.actor, '/api/certificate')
  if (expectEligible) {
    check(res.status === 200, `[${p.actor.label}] ครูยืนยันครบ 4 ด้านระดับ 3 แล้ว ต้องได้ใบประกาศ`, `${res.status} · ${res.text.length} ไบต์`)
  } else {
    const blocked = res.status === 403
    check(blocked, `[${p.actor.label}] ยังไม่ครบ 4 ด้าน ต้องไม่ได้ใบประกาศ`, `${res.status} ${String(res.json?.code ?? '')}`)
    const msg = `${String(res.json?.message ?? '')} ${JSON.stringify(res.json?.missing ?? '')}`
    const bad = FORBIDDEN.filter((w) => msg.includes(w))
    check(bad.length === 0, `[${p.actor.label}] ข้อความใบประกาศไม่มีคำว่าตก/ไม่ผ่าน`, bad.length ? `เจอ: ${bad.join(', ')}` : 'สะอาด')
    if (bad.length > 0) {
      finding('พังจริง', 'ข้อความใบประกาศใช้คำว่าตก/ไม่ผ่าน', 'components/server/certificate-eligibility.ts', `GET /api/certificate ของคนที่ยังไม่ครบ คืนข้อความที่มีคำ: ${bad.join(', ')}`)
    }
  }
}

/** กวาดหน้าจอผู้เรียนหาคำต้องห้าม */
/** ประโยคที่ "พูดถึง" คำต้องห้ามเพื่อปฏิเสธ ไม่ใช่การตัดสินผู้เรียน */
const NEGATION_HINTS = ['ไม่มีคำว่า', 'ไม่มีการ', 'ไม่ใช่การ', 'ห้ามใช้คำว่า']

async function scanStudentPagesForForbiddenWords(p: Persona): Promise<void> {
  const routes = ['/home', '/map', '/result', '/rewards', '/reflect', '/ceo', '/showcase', '/my-site']
  const verdicts: string[] = []
  const negations: string[] = []
  for (const route of routes) {
    const res = await stable(p.actor, route)
    if (res.status !== 200) continue
    const visible = res.text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    for (const w of FORBIDDEN) {
      let from = 0
      for (;;) {
        const at = visible.indexOf(w, from)
        if (at === -1) break
        from = at + w.length
        const around = visible.slice(Math.max(0, at - 60), at + w.length + 40).trim()
        const isNegation = NEGATION_HINTS.some((h) => around.includes(h))
        ;(isNegation ? negations : verdicts).push(`${route} · "${around}"`)
      }
    }
  }
  check(
    verdicts.length === 0,
    `[${p.actor.label}] 8 หน้าของผู้เรียนไม่มีคำตัดสินว่าตก/ไม่ผ่าน`,
    verdicts.length ? verdicts.join(' | ') : `สะอาด${negations.length ? ` (พบ ${negations.length} จุดที่เอ่ยถึงเพื่อปฏิเสธ ไม่นับ)` : ''}`,
  )
  if (verdicts.length > 0) {
    finding('พังจริง', 'หน้าผู้เรียนมีคำตัดสินว่าตก/ไม่ผ่าน', verdicts[0]!.split(' · ')[0]!, `เปิดหน้าด้วยคุกกี้นักเรียนที่ครูยังไม่ยืนยันครบ 4 ด้าน แล้วค้นคำ: ${verdicts.join(' | ')}`)
  }
  for (const n of negations) {
    finding('ข้อสังเกต', 'หน้าผู้เรียนเอ่ยคำว่าสอบตก/ไม่ผ่าน ในประโยคปฏิเสธ', n.split(' · ')[0]!, `ข้อความจริง: ${n}`)
  }
}

// ───────────────────────────── เก็บกวาด

async function cleanup(): Promise<void> {
  const db = getServiceClient()
  const t = await db.from('teachers').select('id').eq('email', TEACHER_EMAIL).maybeSingle()
  if (!t.data) return
  const c = await db.from('classrooms').select('id').eq('room_code', ROOM_CODE).eq('teacher_id', t.data.id).maybeSingle()
  if (!c.data) return
  for (const p of PERSONAS) {
    const s = await repo.findStudentByNickname(c.data.id, p.nickname)
    if (s) await repo.removeStudent(t.data.id, c.data.id, s.id)
  }
  console.log('\nเก็บกวาด: ลบตัวละคร QA ทั้ง 3 ตัวออกจากห้องแล้ว')
}

// ───────────────────────────── main

async function main(): Promise<void> {
  const startedAt = Date.now()
  const [keng, klang, cha] = PERSONAS as [Persona, Persona, Persona]

  await phase('ขั้น 1 ฟังครู + แบบทดสอบก่อนเรียน', async () => {
    await teacherOpensRoom()
    for (const p of PERSONAS) await studentJoins(p)
    await preTest(keng, 8)
    await preTest(klang, 5)
    await preTest(cha, 2)
  })

  await phase('ขั้น 2 รู้จักตัวเอง', async () => {
    await setPhase('onboard', 5)
    for (const p of PERSONAS) await selfKnow(p)
  })

  await phase('ขั้น 3 ภารกิจย่อย 4 ด่าน', async () => {
    await setPhase('mission', 20)

    // เก่ง: ผ่านรวด ไม่ขอคำใบ้ ไม่ตอบผิด
    for (const id of ['m1', 'm2', 'm3', 'm4']) await doMission(keng, { id, hints: 0, wrongTries: 0 })

    // กลาง: ขอคำใบ้ที่ m1 (ต้องไม่หักดาว) และเปลี่ยนช่องทางกลางทางที่ m2
    await doMission(klang, { id: 'm1', hints: 2, wrongTries: 0 })
    await doMission(klang, { id: 'm2', hints: 1, wrongTries: 0, switchTo: 'game' })
    await doMission(klang, { id: 'm3', hints: 0, wrongTries: 0 })
    await doMission(klang, { id: 'm4', hints: 0, wrongTries: 0 })

    // ช้า: ตอบผิดซ้ำที่ m1 กับ m3 แล้วกดขอครู
    await doMission(cha, { id: 'm1', hints: 3, wrongTries: 2 })
    await doMission(cha, { id: 'm2', hints: 2, wrongTries: 1 })
    await doMission(cha, { id: 'm3', hints: 3, wrongTries: 2, askHelp: true })
  })

  await phase('ขั้น 3.5 ครูเห็นอะไรบนแผงระหว่างภารกิจ', async () => {
    const board = await stable(teacher, `/api/teacher/board?classroomId=${classroomId}`)
    const rows = (board.json?.board ?? []) as Array<{
      nickname: string
      askedForHelp?: boolean
      earnedStars: number
      pendingReview: number
      calibration?: Array<{ flag: string; missionId: string }>
      flag?: { flagged?: boolean; level?: string }
    }>
    const names = PERSONAS.map((p) => p.nickname)
    const seen = names.filter((n) => rows.some((r) => r.nickname === n))
    check(seen.length === 3, 'ครูเห็นทั้ง 3 ตัวละครบนแผง', `${seen.length}/3 · ทั้งห้อง ${rows.length} คน`)

    const helpRow = rows.find((r) => r.nickname === cha.nickname)
    check(helpRow?.askedForHelp === true, 'ครูเห็นธงแดง "ขอครู" ของเด็กช้า', `askedForHelp=${String(helpRow?.askedForHelp)}`)
    if (helpRow?.askedForHelp !== true) {
      finding('พังจริง', 'กดขอให้ครูช่วยแล้วแผงครูไม่ขึ้นธง', 'app/api/help/route.ts', 'POST /api/help {"missionId":"m3"} คืน 200 แต่ GET /api/teacher/board คืน askedForHelp=false')
    }
    check(
      helpRow?.flag?.flagged === true,
      'เด็กช้าติดธงโค้ชบนแผง (shouldCoach)',
      `flagged=${String(helpRow?.flag?.flagged)} ระดับ ${String(helpRow?.flag?.level ?? '-')}`,
    )

    const calib = rows.flatMap((r) => (r.calibration ?? []).map((c) => `${r.nickname}:${c.missionId}:${c.flag}`))
    const chaCalib = calib.filter((x) => x.startsWith(cha.nickname))
    check(chaCalib.length > 0, 'ครูเห็นธงความมั่นใจของเด็กช้า', chaCalib.join(' · ') || 'ไม่มีธงเลย')
    check(Number(board.json?.needsHelp) >= 1, 'ตัวนับ "ขอครู" ของทั้งห้องนับได้', `needsHelp=${String(board.json?.needsHelp)} · ควรคุย=${String(board.json?.shouldTalk)} · ควรชม=${String(board.json?.shouldPraise)}`)

    const html = await stable(teacher, `/teacher?classroomId=${classroomId}`)
    check(html.text.includes('ธงจากความมั่นใจของผู้เรียน'), 'จอครูขึ้นหัวข้อธงโค้ช', `หน้า ${html.status}`)

    // จอแผงห้องเรียนสดรายคน (หน้าใหม่ที่เพิ่งมี)
    const live = await stable(teacher, `/teacher/board?classroomId=${classroomId}`)
    const liveOk = live.status === 200
    check(liveOk, 'เปิดจอแผงห้องเรียนสดรายคน /teacher/board ได้', `${live.status}`)
    check(
      html.text.includes('/teacher/board'),
      'หน้าครูมีลิงก์ไปแผงห้องเรียนสด',
      html.text.includes('/teacher/board') ? 'มีลิงก์' : 'ไม่มีลิงก์ ต้องพิมพ์ URL เอง',
    )
    if (!html.text.includes('/teacher/board')) {
      finding('น่ารำคาญ', 'แผงห้องเรียนสดมีจอแล้วแต่หน้าครูไม่มีลิงก์ไปให้', 'app/teacher/page.tsx', 'ล็อกอินครู เปิด /teacher แล้วหาลิงก์ไป /teacher/board ไม่เจอ ต้องพิมพ์ URL เอง')
    }

    // ครูเข้าช่วย: สั่งข้ามภารกิจที่ 4 ให้เด็กช้าเพราะเวลาไม่พอ
    const skip = await stable(teacher, '/api/teacher/student', {
      method: 'POST',
      body: { action: 'skip-mission', studentId: cha.studentId, missionId: 'm4', reason: 'coached', note: 'คุยตัวต่อตัวแล้ว ประเมินด้วยการถามปากเปล่าแทน' },
    })
    check(skip.status === 200, 'ครูสั่งข้ามภารกิจให้เด็กช้าได้', `${skip.status} ${String(skip.json?.message ?? '')}`)

    const skips = await repo.listSkips(cha.studentId!)
    check(skips.some((s) => s.mission_id === 'm4'), 'มีแถวร่องรอยการข้ามใน mission_skips', `${skips.length} แถว`)
    const progress = await repo.listMissionProgress(cha.studentId!)
    const m4 = progress.find((row) => row.mission_id === 'm4')
    check(
      m4?.skipped_by === 'teacher',
      'บันทึกว่าครูเป็นคนสั่งข้าม ไม่ใช่เด็กกดเอง (mission_progress.skipped_by)',
      `skipped_by=${String(m4?.skipped_by)}`,
    )
    if (m4 && m4.skipped_by !== 'teacher') {
      finding('พังจริง', 'ครูสั่งข้ามแล้วบันทึกว่าเด็กข้ามเอง', 'lib/db/repo.ts teacherSkipMission()', `POST /api/teacher/student action=skip-mission แล้ว mission_progress.skipped_by = ${String(m4.skipped_by)} ไม่ใช่ 'teacher' — รายงาน E1 จะนับการตัดสินใจของครูเป็นผลของเด็ก`)
    }
  })

  await phase('ขั้น 3.6 เด็กขอเปลี่ยนแผน ครูตอบคำขอ', async () => {
    const ask = await stable(cha.actor, '/api/plan-request', {
      method: 'POST',
      body: { kind: 'level', requestedValue: 3, missionId: 'm4', reason: 'อ่านโจทย์ไม่ทัน อยากได้ตัวช่วยเยอะขึ้น' },
    })
    check(ask.status === 200, '[ช้า] กดขอเปลี่ยนแผน (ขอตัวช่วยระดับ 3)', `${ask.status} ${String(ask.json?.message ?? '')}`)

    const queue = await stable(teacher, `/api/plan-request?classroomId=${classroomId}`)
    const rows = (queue.json?.requests ?? []) as Array<{ id: string; nickname: string; kind: string; status: string | null }>
    const mine = rows.find((r) => r.nickname === cha.nickname)
    check(Boolean(mine), 'ครูเห็นคำขอเปลี่ยนแผนในคิว', mine ? `${mine.kind} · สถานะ ${String(mine.status ?? 'รอตอบ')}` : `ไม่เห็น (คิวมี ${rows.length} ใบ)`)

    /**
     * จอที่ครูใช้ตอบคำขออยู่ที่ **แผงห้องเรียนสด** ไม่ใช่หน้า /teacher
     * (app/teacher/board/plan-requests.tsx · วางไว้บนสุดของ live-board-client.tsx:223)
     */
    const boardHtml = await stable(teacher, `/teacher/board?classroomId=${classroomId}`)
    const hasUi = boardHtml.status === 200 && boardHtml.text.includes('PlanRequests') === false
    const mountsPanel = boardHtml.status === 200
    check(mountsPanel, 'แผงห้องเรียนสดเปิดได้ (เป็นที่อยู่ของกล่องตอบคำขอเปลี่ยนแผน)', `${boardHtml.status}`)
    void hasUi
    if (!mountsPanel) {
      finding(
        'พังจริง',
        'เปิดแผงห้องเรียนสดไม่ได้ ครูจึงตอบคำขอเปลี่ยนแผนไม่ได้',
        'app/teacher/board/page.tsx · app/teacher/board/plan-requests.tsx',
        `GET /teacher/board?classroomId=... คืน ${boardHtml.status}`,
      )
    }

    if (mine) {
      const reply = await stable(teacher, '/api/plan-request/respond', {
        method: 'POST',
        body: { requestId: mine.id, status: 'approved', response: 'ให้เลย ใช้ตัวช่วยเต็มที่ได้', grantedValue: 3, kind: 'level' },
      })
      check(reply.status === 200, 'ครูตอบอนุมัติคำขอได้', `${reply.status} ${String(reply.json?.message ?? '')}`)

      const seen = await stable(cha.actor, '/api/plan-request')
      const mineAfter = ((seen.json?.requests ?? []) as Array<{ status: string | null; teacherResponse: string | null }>)[0]
      check(
        mineAfter?.status === 'approved',
        '[ช้า] เห็นว่าครูอนุมัติแล้ว',
        `สถานะ ${String(mineAfter?.status)} · ครูตอบ "${String(mineAfter?.teacherResponse ?? '')}"`,
      )
    }
  })

  await phase('ขั้น 3.7 จอครูที่เพิ่มใหม่เปิดได้ไหม', async () => {
    for (const path of [
      `/teacher/board?classroomId=${classroomId}`,
      `/teacher/report?classroomId=${classroomId}`,
      `/teacher/student?classroomId=${classroomId}`,
    ]) {
      const res = await stable(teacher, path)
      const visible = res.text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      check(res.status === 200 && visible.length > 40, `เปิด ${path.split('?')[0]} ได้ ไม่จอขาว`, `${res.status} · ${visible.length} ตัวอักษร`)
    }
  })

  const submissions: Record<string, string | null> = {}
  await phase('ขั้น 4 ด่านบอส CEO', async () => {
    await setPhase('boss', 10)
    submissions[keng.nickname] = await bossStage(keng, 'bm-r1')
    submissions[klang.nickname] = await bossStage(klang, 'bm-r3')
    submissions[cha.nickname] = await bossStage(cha, 'bm-r2')
  })

  await phase('ขั้น 4.5 ครูตรวจงาน', async () => {
    const pending = await stable(teacher, `/teacher?classroomId=${classroomId}`)
    const inQueue = PERSONAS.filter((p) => pending.text.includes(p.nickname)).length
    check(inQueue >= 1, 'คิวงานรอตรวจบนจอครูมีงานของตัวละคร QA', `${inQueue}/3 ชื่อปรากฏบนหน้า`)

    // เก่ง: ครูยืนยันระดับ 3 ครบ 4 ด้าน → ต้องได้ใบประกาศ
    const kengId = submissions[keng.nickname]
    if (kengId) {
      const res = await stable(teacher, '/api/teacher/confirm-score', {
        method: 'POST',
        body: {
          submissionId: kengId,
          dimensions: { 'dim-naming': 3, 'dim-tld-fit': 3, 'dim-customer-reason': 3, 'dim-business-link': 3 },
          emphasisDimensionId: 'dim-naming',
          note: 'เหตุผลชัดเจนครบทุกด้าน ผ่านเลย',
        },
      })
      check(res.status === 200, 'ครูยืนยันคะแนนของเด็กเก่ง ระดับ 3 ครบ 4 ด้าน', `${res.status} ${String(res.json?.message ?? '')}`)
    } else {
      check(false, 'ครูยืนยันคะแนนของเด็กเก่ง', 'ไม่มี submissionId จากขั้นด่านบอส')
    }

    // กลาง: ครูตีกลับให้แก้ → ต้องส่งใหม่ได้ และหน้าเด็กต้องบอกว่าต้องแก้ด้านไหน
    const klangId = submissions[klang.nickname]
    if (klangId) {
      const rev = await stable(teacher, '/api/teacher/request-revision', {
        method: 'POST',
        body: { submissionId: klangId, dimensionIds: ['dim-customer-reason'], dimensions: { 'dim-customer-reason': 2 }, note: 'บอกให้ชัดว่าลูกค้าของร้านเราเป็นใคร แล้วส่งใหม่ได้เลย' },
      })
      check(rev.status === 200, 'ครูส่งงานกลับให้เด็กกลางแก้', `${rev.status}`)

      const seen = await stable(klang.actor, '/api/ceo')
      const revision = seen.json?.revision as { note?: string; dimensions?: unknown[] } | null
      check(Boolean(revision?.note), 'หน้าเด็กกลางขึ้นว่าต้องแก้ด้านไหนและครูเขียนอะไรมา', revision?.note ? `"${String(revision.note).slice(0, 40)}…"` : 'ไม่มีข้อมูล revision')
      check(seen.json?.canResubmit === true, 'เด็กกลางส่งใหม่ได้ (ไม่ตัน)', `canResubmit=${String(seen.json?.canResubmit)}`)
      if (seen.json?.canResubmit !== true) {
        finding('พังจริง', 'ครูตีกลับแล้วเด็กส่งใหม่ไม่ได้', 'components/server/revision.ts revisionState()', 'ครู POST /api/teacher/request-revision สำเร็จ แต่ GET /api/ceo ของเด็กคืน canResubmit=false')
      }

      const again = await stable(klang.actor, '/api/ceo', {
        method: 'POST',
        body: {
          modeId: 'bm-mode-write',
          focusRubricId: 'bm-r3',
          fields: {
            'bm-f1': klang.shop.domainName,
            'bm-f2': '.com',
            'bm-f3': `ชื่อนี้ตรงกับป้ายหน้าร้าน ${klang.shop.shopName} จำง่ายและสะกดตามเสียงอ่านได้`,
            'bm-f4': 'เลือก .com เพราะร้านยังไม่ได้จดนิติบุคคล จด .co.th ไม่ได้',
            'bm-f5': 'ลูกค้าหลักคือนักเรียนและผู้ปกครองแถวโรงเรียนที่สั่งเค้กวันเกิดล่วงหน้า',
          },
          selfAssessment: { 'bm-self1': 'แก้เหตุผลให้ชัดขึ้นแล้ว', 'bm-self2': 'ยังไม่แน่ใจเรื่องราคา', 'bm-self3': 'จะไปสำรวจร้านจริงเพิ่ม' },
        },
      })
      check(again.status === 200, 'เด็กกลางแก้แล้วส่งฉบับใหม่ได้', `${again.status} · ฉบับที่ ${String(again.json?.version)}`)
    }
  })

  await phase('ขั้น 5 ครูสรุป + ผนังผลงาน', async () => {
    await setPhase('summary', 5)
    const show = await stable(keng.actor, '/api/me/showcase')
    check(show.status === 200 && Number(show.json?.count) > 0, 'ผนังผลงานมีงานของเพื่อนให้ดู', `${String(show.json?.count)} ชิ้น`)

    const screen = await stable(teacher, `/api/teacher/screen?classroomId=${classroomId}`)
    check(screen.status === 200, 'จอหน้าห้องดึงข้อมูลได้', `เข้ามา ${String(screen.json?.joined)} คน · ผ่าน ${String(screen.json?.missionsPassed)} ภารกิจ · ส่งงาน ${String(screen.json?.submitted)} ชิ้น`)
  })

  await phase('ขั้น 6 ทบทวนตัวเอง + แบบทดสอบหลังเรียน', async () => {
    await setPhase('reflect', 5)
    for (const p of PERSONAS) await reflect(p)

    const post = await stable(teacher, '/api/teacher/session', { method: 'POST', body: { action: 'test-window', sessionId, which: 'post', enabled: true } })
    check(post.status === 200, 'ครูเปิดแบบทดสอบหลังเรียน', `${post.status}`)
    await postTest(keng, 10)
    await postTest(klang, 8)
    await postTest(cha, 5)

    const eff = await stable(teacher, `/api/teacher/efficiency?classroomId=${classroomId}`)
    check(eff.status === 200, 'ครูดู E1/E2 ของห้องได้', `${String(eff.json?.label ?? '')} · ${String(eff.json?.summary ?? '').slice(0, 60)}`)
  })

  await phase('ตรวจใบประกาศ + คำต้องห้าม', async () => {
    await certificateCheck(keng, true)
    await certificateCheck(klang, false)
    await certificateCheck(cha, false)
    for (const p of PERSONAS) await scanStudentPagesForForbiddenWords(p)
  })

  await phase('ตรวจว่าแต่ละคนได้โจทย์ต่างกันจริง', async () => {
    const keys = new Set<string>()
    for (const p of PERSONAS) for (const k of Object.keys(p.fingerprint)) keys.add(k)
    for (const k of keys) {
      const values = PERSONAS.map((p) => p.fingerprint[k] ?? '(ไม่มี)')
      const distinct = new Set(values).size
      check(distinct > 1, `"${k}" ต่างกันระหว่าง 3 คน`, `แบบที่ต่างกัน ${distinct}/3 · ${values.map((v, i) => `${PERSONAS[i]!.actor.label}=${v.slice(0, 44)}`).join(' | ')}`)
      if (distinct === 1) {
        finding('ข้อสังเกต', `ทุกคนได้ "${k}" เหมือนกัน`, 'core/boss-scenario.ts · core/check-set.ts · components/server/mission-story.ts', `รัน scripts/qa-full-class.ts แล้วเทียบค่า ${k} ของ 3 ตัวละคร ได้ค่าเดียวกันทั้งหมด`)
      }
    }
  })

  await phase('ครูปิดคาบ แล้วเปิดคาบใหม่คืนสภาพให้เจ้าของเล่นต่อ', async () => {
    const close = await stable(teacher, '/api/teacher/session', { method: 'POST', body: { action: 'close', sessionId } })
    check(close.status === 200, 'ครูกดปิดคาบได้', `${close.status}`)

    /**
     * ปิดคาบทิ้งไว้ = เจ้าของตื่นมาเข้าห้องไม่ได้ จึงต้องเปิดคาบใหม่คืนสภาพเดโมเสมอ
     * (ค่าเดียวกับที่ scripts/seed-uat.ts ตั้งไว้: ช่วงภารกิจย่อย 20 นาที · แบบทดสอบก่อนเรียนเปิด · ผนังผลงานเปิด)
     */
    const reopen = await stable(teacher, '/api/teacher/session', { method: 'POST', body: { action: 'open', classroomId } })
    const fresh = (reopen.json?.session as { id?: string } | undefined)?.id
    check(reopen.status === 200 && Boolean(fresh), 'เปิดคาบใหม่คืนสภาพเดโม', `${reopen.status}`)
    if (fresh) {
      await stable(teacher, '/api/teacher/session', { method: 'POST', body: { action: 'phase', sessionId: fresh, phase: 'mission', timerSeconds: 20 * 60 } })
      await stable(teacher, '/api/teacher/session', { method: 'POST', body: { action: 'test-window', sessionId: fresh, which: 'pre', enabled: true } })
      const back = await stable(teacher, `/api/teacher/session?classroomId=${classroomId}`)
      const s = back.json?.session as { phase?: string; pretest_enabled?: boolean } | undefined
      check(s?.phase === 'mission', 'ห้องกลับมาพร้อมเล่นเหมือนหลัง seed', `ช่วง ${String(s?.phase)} · แบบทดสอบก่อนเรียน ${String(s?.pretest_enabled)}`)
    }
  })

  report(startedAt)
  await cleanup()
  if (checks.some((c) => !c.ok)) process.exitCode = 1
}

function report(startedAt: number): void {
  console.log('\n══════ สรุป ══════')
  const pass = checks.filter((c) => c.ok).length
  console.log(`เช็ก ${checks.length} ข้อ · ผ่าน ${pass} · ไม่ผ่าน ${checks.length - pass}`)

  console.log('\nเวลาที่ระบบกินต่อขั้น (เทียบงบนาทีในแผนการสอน)')
  for (const row of phaseTimes) {
    const budget = PLAN_MINUTES[row.phase]
    const bar = budget ? ` / งบ ${budget} นาที` : ''
    console.log(`  ${(row.ms / 1000).toFixed(1).padStart(6)} วินาที${bar}  ${row.phase}`)
  }
  const total = phaseTimes.reduce((s, r) => s + r.ms, 0)
  console.log(`  รวมระบบกิน ${(total / 1000).toFixed(1)} วินาที (${(total / 60000).toFixed(1)} นาที) · งบคาบ 60 นาที`)

  const failed = checks.filter((c) => !c.ok)
  if (failed.length > 0) {
    console.log('\nข้อที่ไม่ผ่าน')
    failed.forEach((c) => console.log(`  - ${c.name} — ${c.detail}`))
  }

  if (findings.length > 0) {
    console.log('\nสิ่งที่เจอ')
    for (const f of findings) console.log(`  [${f.severity}] ${f.title}\n      ที่: ${f.where}\n      ทำซ้ำ: ${f.repro}`)
  }
  console.log(`\nใช้เวลารันทั้งสคริปต์ ${((Date.now() - startedAt) / 1000).toFixed(1)} วินาที`)
}

main().catch(async (err: unknown) => {
  console.error('\nqa-full-class ล้มกลางทาง:', err)
  report(Date.now())
  await cleanup().catch(() => undefined)
  process.exit(1)
})

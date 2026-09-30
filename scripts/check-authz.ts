/**
 * ตรวจการสวมรอยและสิทธิ์เข้าถึง (UAT-3 ข้อ 3 และ 5) — อ่านอย่างเดียว ไม่แก้ข้อมูลของใคร
 *
 * รัน: npx tsx scripts/check-authz.ts        (ต้องมี dev server พอร์ต 3000 + npm run seed:uat)
 *
 * ไล่ 8 ด่าน
 *  1. ไม่มีคุกกี้เลย → ทุกเส้นต้อง 401
 *  2. นักเรียน A ปลอม studentId ของ B ลง body ทุก route ที่เขียนข้อมูล → ข้อมูลของ B ต้องไม่ขยับ
 *  3. คุกกี้นักเรียน ยิงเส้นของครู → 401
 *  4. คุกกี้ครู ยิงเส้นของนักเรียน → 401
 *  5. ครูคนอื่น ยิง classroomId / submissionId / studentId ของห้องเรา → ต้องไม่ได้ข้อมูล
 *  6. คุกกี้ที่ถูกแก้ลายเซ็น 1 ตัวอักษร → 401
 *  7. คุกกี้ที่หมดอายุแล้ว (เซ็นด้วย secret จริง แต่ exp ย้อนหลัง) → 401
 *  8. คุกกี้ผิดบทบาท (payload นักเรียนใส่ในคุกกี้ครู และกลับกัน) → 401
 *  9. ตัวจำกัดจำนวนครั้ง — ยิงรัวรหัสผิด ต้องโดน 429
 *
 * ⚠️ ไม่พิมพ์ค่า SESSION_SECRET หรือ token เต็มออกจอ แสดงแค่ความยาว
 */

import { SignJWT } from 'jose'
import * as repo from '../lib/db/repo'
import { getServiceClient } from '../lib/db/client'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

const BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const ROOM_CODE = 'UAT777'
const TEACHER_A = { email: 'kru@uat.local', password: 'uat1234' }
/** ครูอีกคนที่มีอยู่จริงในเครื่องนี้ (scripts/seed-demo.ts สร้างไว้) ใช้ทดสอบข้ามห้อง */
const TEACHER_B = { email: 'teacher.demo@digital-biz.local', password: 'demo-teacher-1234' }

type Check = { ok: boolean; name: string; detail: string }
const checks: Check[] = []
function check(ok: boolean, name: string, detail: string): boolean {
  checks.push({ ok, name, detail })
  console.log(`${ok ? '  ผ่าน  ' : '  ช่องโหว่!' } ${name} — ${detail}`)
  return ok
}

class Client {
  readonly jar = new Map<string, string>()
  constructor(readonly label: string) {}
  setCookie(name: string, value: string): void {
    this.jar.set(name, value)
  }
  async req(path: string, init: { method?: string; body?: unknown; noCookie?: boolean } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(!init.noCookie && this.jar.size > 0
          ? { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
          : {}),
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
    return { status: res.status, text, json, setCookie: res.headers.getSetCookie() }
  }
}

/** เส้นของนักเรียน ที่ถ้าไม่มีคุกกี้ต้อง 401 ทุกเส้น */
const STUDENT_ROUTES: Array<{ path: string; method?: string; body?: unknown }> = [
  { path: '/api/me' },
  { path: '/api/me/showcase' },
  { path: '/api/pretest' },
  { path: '/api/posttest' },
  { path: '/api/check' },
  { path: '/api/profile' },
  { path: '/api/ceo' },
  { path: '/api/reflect' },
  { path: '/api/survey' },
  { path: '/api/story' },
  // /api/plan-request ไม่อยู่ในลิสต์นี้ — เป็นเส้นสองบทบาท ครูยิงได้ด้วย (ไม่มี classroomId ได้ 400 ไม่ใช่ 401)
  { path: '/api/buddy' },
  { path: '/api/certificate' },
  { path: '/api/mission/m1/story' },
  { path: '/api/hint', method: 'POST', body: { missionId: 'm1' } },
  { path: '/api/help', method: 'POST', body: { missionId: 'm1' } },
  { path: '/api/dome', method: 'POST', body: { message: 'สวัสดี' } },
  { path: '/api/mission/m1/check', method: 'POST', body: { checkId: 'm1-check', choiceIndex: 0 } },
  { path: '/api/mission/m1/skip', method: 'POST', body: {} },
  { path: '/api/mission/m1/switch-route', method: 'POST', body: { toRoute: 'clip' } },
  { path: '/api/station-b/submit', method: 'POST', body: { tldId: 'com', reasonText: 'เหตุผลยาวพอสิบตัวอักษร' } },
  { path: '/api/reflect', method: 'POST', body: { answers: { 'reflect-1': 'ทดสอบสิทธิ์' } } },
  { path: '/api/profile/choice', method: 'POST', body: { route: 'clip' } },
  { path: '/api/profile/preferences', method: 'POST', body: { prefAnswers: { 'pref-1': 'pref-1-a' } } },
]

/** เส้นของครู · {CID} {SID} {STU} ถูกแทนตอนรัน */
const TEACHER_ROUTES: Array<{ path: string; method?: string; body?: unknown }> = [
  { path: '/api/teacher/classroom' },
  { path: '/api/teacher/board?classroomId={CID}' },
  { path: '/api/teacher/screen?classroomId={CID}' },
  { path: '/api/teacher/flags?classroomId={CID}' },
  { path: '/api/teacher/session?classroomId={CID}' },
  { path: '/api/teacher/efficiency?classroomId={CID}' },
  { path: '/api/teacher/export?classroomId={CID}' },
  { path: '/api/teacher/report/class?classroomId={CID}' },
  { path: '/api/teacher/report?studentId={STU}' },
  // หมายเหตุ: /api/plan-request เป็นเส้น **สองบทบาท** ครูกับนักเรียนใช้เส้นเดียวกัน
  // จึงไม่เอาไปรวมในด่าน "สลับบทบาทต้อง 401" — แยกไปตรวจเนื้อข้อมูลในด่าน 5b แทน
  {
    path: '/api/teacher/session',
    method: 'POST',
    body: { action: 'phase', sessionId: '{SID}', phase: 'mission' },
  },
  {
    path: '/api/teacher/student',
    method: 'POST',
    body: { action: 'force-pass', studentId: '{STU}', missionId: 'm1', reason: 'other', note: 'ทดสอบสิทธิ์' },
  },
  {
    path: '/api/teacher/broadcast',
    method: 'POST',
    body: { classroomId: '{CID}', message: 'ทดสอบสิทธิ์' },
  },
]

function fill(text: string, ids: Record<string, string>): string {
  return text.replace(/\{(CID|SID|STU|SUB)\}/g, (_m, k: string) => ids[k] ?? '')
}

function fillBody(body: unknown, ids: Record<string, string>): unknown {
  return JSON.parse(fill(JSON.stringify(body ?? {}), ids)) as unknown
}

async function mintToken(payload: Record<string, unknown>, expSeconds: number): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? '')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now - 7200)
    .setExpirationTime(now + expSeconds)
    .sign(secret)
}

async function main(): Promise<void> {
  console.log(`ตรวจสิทธิ์ที่ ${BASE} · ห้อง ${ROOM_CODE}\n`)

  // ───── เตรียมตัวละคร
  const db = getServiceClient()
  const room = await db.from('classrooms').select('id, teacher_id').eq('room_code', ROOM_CODE).maybeSingle()
  if (!room.data) throw new Error(`ไม่พบห้อง ${ROOM_CODE} — รัน npm run seed:uat ก่อน`)
  const classroomId = room.data.id

  const teacherA = new Client('ครู A (เจ้าของห้อง)')
  const loginA = await teacherA.req('/api/teacher/login', { method: 'POST', body: TEACHER_A })
  check(loginA.status === 200, 'ครูเจ้าของห้องล็อกอินได้', `${loginA.status}`)

  const sess = await teacherA.req(`/api/teacher/session?classroomId=${classroomId}`)
  const sessionId = String((sess.json?.session as { id?: string })?.id ?? '')

  // นักเรียน A = คนใหม่ที่สคริปต์สร้าง · นักเรียน B = หุ่นเดโม "บีม"
  const studentA = new Client('นักเรียน A')
  const joinA = await studentA.req('/api/join', {
    method: 'POST',
    body: { roomCode: ROOM_CODE, nickname: 'ตรวจสวมรอย', pin: '2468' },
  })
  check(joinA.status === 200, 'นักเรียน A เข้าห้องได้', `${joinA.status}`)
  const nicknameA = String(joinA.json?.nickname ?? 'ตรวจสวมรอย')

  const studentB = await repo.findStudentByNickname(classroomId, 'บีม')
  if (!studentB) throw new Error('ไม่พบหุ่น "บีม" — รัน npm run seed:uat ก่อน')
  const subsB = await repo.listSubmissions(studentB.id)
  const submissionB = subsB[0]?.id ?? ''
  const ids = { CID: classroomId, SID: sessionId, STU: studentB.id, SUB: submissionB }

  console.log('')

  // ───── ด่าน 1 ไม่มีคุกกี้
  console.log('1) ไม่มีคุกกี้เลย')
  const anon = new Client('ไม่มีคุกกี้')
  let anonBad: string[] = []
  for (const r of [...STUDENT_ROUTES, ...TEACHER_ROUTES]) {
    const res = await anon.req(fill(r.path, ids), {
      method: r.method,
      body: r.body ? fillBody(r.body, ids) : undefined,
      noCookie: true,
    })
    if (res.status !== 401) anonBad.push(`${r.method ?? 'GET'} ${r.path} → ${res.status}`)
  }
  check(
    anonBad.length === 0,
    `ไม่มีคุกกี้ ยิง ${STUDENT_ROUTES.length + TEACHER_ROUTES.length} เส้น ต้อง 401 ทุกเส้น`,
    anonBad.length === 0 ? 'โดนปฏิเสธหมด' : `หลุด: ${anonBad.join(' · ')}`,
  )

  // ───── ด่าน 2 ปลอม studentId ของ B
  console.log('\n2) นักเรียน A ปลอม studentId ของ B ลงใน body')
  const beforeB = {
    profile: JSON.stringify(await repo.getProfile(studentB.id)),
    missions: JSON.stringify(await repo.listMissionProgress(studentB.id)),
    submissions: (await repo.listSubmissions(studentB.id)).length,
    reflections: (await repo.listReflections(studentB.id)).length,
  }
  const forgeTargets: Array<{ path: string; body: Record<string, unknown> }> = [
    { path: '/api/hint', body: { missionId: 'm1', studentId: studentB.id } },
    { path: '/api/help', body: { missionId: 'm1', studentId: studentB.id } },
    { path: '/api/mission/m1/check', body: { checkId: 'm1-check', choiceIndex: 0, studentId: studentB.id } },
    { path: '/api/mission/m1/switch-route', body: { toRoute: 'game', studentId: studentB.id } },
    { path: '/api/mission/m1/skip', body: { studentId: studentB.id, allowed: true, by: 'teacher' } },
    { path: '/api/reflect', body: { answers: { 'reflect-1': 'ปลอมเป็นคนอื่น' }, studentId: studentB.id } },
    { path: '/api/profile/choice', body: { route: 'buddy', level: 3, studentId: studentB.id } },
    { path: '/api/pretest', body: { answers: { 'pre-1': 0 }, studentId: studentB.id } },
    { path: '/api/survey', body: { scores: { q1: 5 }, studentId: studentB.id } },
    { path: '/api/plan-request', body: { kind: 'level', requestedValue: 3, reason: 'ปลอม', studentId: studentB.id } },
    { path: '/api/dome', body: { message: 'ปลอมเป็นคนอื่น', studentId: studentB.id } },
    { path: '/api/showcase/feedback', body: { toStudentId: studentB.id, praiseText: 'ปลอม', studentId: studentB.id } },
    { path: '/api/presence', body: { studentId: studentB.id, screen: 'map' } },
  ]
  for (const t of forgeTargets) {
    await studentA.req(t.path, { method: 'POST', body: t.body })
  }
  const afterB = {
    profile: JSON.stringify(await repo.getProfile(studentB.id)),
    missions: JSON.stringify(await repo.listMissionProgress(studentB.id)),
    submissions: (await repo.listSubmissions(studentB.id)).length,
    reflections: (await repo.listReflections(studentB.id)).length,
  }
  const changed = (Object.keys(beforeB) as Array<keyof typeof beforeB>).filter((k) => beforeB[k] !== afterB[k])
  check(
    changed.length === 0,
    `ยิง ${forgeTargets.length} เส้นพร้อม studentId ของ B แล้วข้อมูล B ไม่ขยับ`,
    changed.length === 0 ? 'profile / mission_progress / submissions / reflections เท่าเดิมทุกตัว' : `ขยับ: ${changed.join(', ')}`,
  )

  // อ่านข้อมูล B ผ่านเส้นของนักเรียนได้ไหม
  const meA = await studentA.req('/api/me')
  const leaksB = meA.text.includes(studentB.id) || meA.text.includes('บีม')
  check(!leaksB, 'GET /api/me ของ A ไม่มีข้อมูลของ B', leaksB ? 'พบ id หรือชื่อของ B' : `เห็นแต่ตัวเอง (${nicknameA})`)

  const certA = await studentA.req(`/api/certificate?studentId=${studentB.id}`)
  check(
    certA.status !== 200 || !certA.text.includes('บีม'),
    'ใบประกาศเมินพารามิเตอร์ studentId ที่แนบมา',
    `${certA.status} · ${certA.status === 403 ? 'ปฏิเสธเพราะ A ยังไม่ครบ 4 ด้าน (ถูกต้อง)' : 'ไม่ใช่ใบของ B'}`,
  )

  // ───── ด่าน 3-4 สลับบทบาท
  console.log('\n3) คุกกี้นักเรียน ยิงเส้นของครู · 4) คุกกี้ครู ยิงเส้นของนักเรียน')
  const crossBad: string[] = []
  for (const r of TEACHER_ROUTES) {
    const res = await studentA.req(fill(r.path, ids), {
      method: r.method,
      body: r.body ? fillBody(r.body, ids) : undefined,
    })
    if (res.status !== 401) crossBad.push(`นักเรียน→${r.method ?? 'GET'} ${r.path} → ${res.status}`)
  }
  for (const r of STUDENT_ROUTES) {
    const res = await teacherA.req(fill(r.path, ids), {
      method: r.method,
      body: r.body ? fillBody(r.body, ids) : undefined,
    })
    if (res.status !== 401) crossBad.push(`ครู→${r.method ?? 'GET'} ${r.path} → ${res.status}`)
  }
  check(
    crossBad.length === 0,
    'สลับบทบาทแล้วต้อง 401 ทุกเส้น',
    crossBad.length === 0 ? `ปฏิเสธครบ ${TEACHER_ROUTES.length + STUDENT_ROUTES.length} เส้น` : `หลุด: ${crossBad.join(' · ')}`,
  )

  // ───── ด่าน 5 ครูคนอื่น
  console.log('\n5) ครูคนอื่นยิง id ของห้องเรา')
  const teacherB = new Client('ครู B')
  const loginB = await teacherB.req('/api/teacher/login', { method: 'POST', body: TEACHER_B })
  if (loginB.status !== 200) {
    check(false, 'ครู B ล็อกอิน', `${loginB.status} — ข้ามด่านนี้ ต้องรัน npx tsx scripts/seed-demo.ts ก่อน`)
  } else {
    const crossRoom: string[] = []
    for (const r of TEACHER_ROUTES) {
      if (r.path === '/api/teacher/classroom') continue // เส้นนี้คืนห้องของตัวเองอยู่แล้ว
      const res = await teacherB.req(fill(r.path, ids), {
        method: r.method,
        body: r.body ? fillBody(r.body, ids) : undefined,
      })
      // ต้องไม่ 200 และต้องไม่มีชื่อเด็กในห้องเราหลุดออกมา
      const leaked = res.text.includes('บีม') || res.text.includes('อาร์ม') || res.text.includes(nicknameA)
      if (res.status === 200 || leaked) {
        crossRoom.push(`${r.method ?? 'GET'} ${r.path} → ${res.status}${leaked ? ' (มีชื่อเด็กหลุด)' : ''}`)
      }
    }
    check(
      crossRoom.length === 0,
      `ครู B ยิง ${TEACHER_ROUTES.length - 1} เส้นด้วย id ของห้องครู A`,
      crossRoom.length === 0 ? 'ไม่ได้ข้อมูลเลยแม้แต่เส้นเดียว' : `หลุด: ${crossRoom.join(' · ')}`,
    )

    // ── 5b เส้นสองบทบาท /api/plan-request ตรวจที่ "เนื้อข้อมูล" ไม่ใช่ที่รหัสสถานะ
    const askOwn = await studentA.req('/api/plan-request', {
      method: 'POST',
      body: { kind: 'level', requestedValue: 3, reason: 'ขอทดสอบสิทธิ์ข้ามห้อง' },
    })
    // 409 = มีคำขอที่ยังไม่ได้ตอบค้างอยู่แล้ว (ด่าน 2 ยิงไปก่อน) ถือว่าถูกต้องทั้งคู่
    check(
      askOwn.status === 200 || askOwn.status === 409,
      'นักเรียน A มีคำขอเปลี่ยนแผนของตัวเองในระบบ',
      `${askOwn.status}${askOwn.status === 409 ? ' (มีคำขอค้างอยู่แล้ว ระบบกันไม่ให้ขอซ้อน)' : ''}`,
    )

    const ownerView = await teacherA.req(`/api/plan-request?classroomId=${classroomId}`)
    const ownerRows = (ownerView.json?.requests ?? []) as Array<{ nickname?: string }>
    check(
      ownerView.status === 200 && ownerRows.some((r) => r.nickname === nicknameA),
      'ครูเจ้าของห้องเห็นคำขอของเด็กในห้องตัวเอง',
      `${ownerView.status} · ${ownerRows.length} ใบ`,
    )

    const otherView = await teacherB.req(`/api/plan-request?classroomId=${classroomId}`)
    const otherRows = (otherView.json?.requests ?? []) as unknown[]
    check(
      otherRows.length === 0,
      'ครู B ยิง /api/plan-request ด้วย classroomId ของห้องครู A แล้วไม่ได้ข้อมูลเลย',
      `${otherView.status} · ได้ ${otherRows.length} ใบ (SQL classroom_plan_requests มี and c.teacher_id = p_teacher_id)`,
    )

    const studentView = await studentA.req(`/api/plan-request?classroomId=${classroomId}`)
    const studentRole = String(studentView.json?.role ?? '')
    const studentRows = (studentView.json?.requests ?? []) as Array<Record<string, unknown>>
    check(
      studentRole === 'student' && studentRows.every((r) => !('nickname' in r)),
      'นักเรียนยิงเส้นเดียวกันได้เฉพาะคำขอของตัวเอง (เมิน classroomId ที่แนบมา)',
      `role=${studentRole} · ${studentRows.length} ใบ · ไม่มีฟิลด์ nickname ของคนอื่น`,
    )

    const confirmOther = await teacherB.req('/api/teacher/confirm-score', {
      method: 'POST',
      body: { submissionId: submissionB, dimensions: { 'dim-naming': 3, 'dim-tld-fit': 3, 'dim-customer-reason': 3, 'dim-business-link': 3 }, note: 'ครูคนอื่นพยายามให้คะแนน' },
    })
    check(confirmOther.status === 404, 'ครู B ยืนยันคะแนนงานในห้องครู A ไม่ได้', `${confirmOther.status} ${String(confirmOther.json?.error ?? '')}`)

    const revisionOther = await teacherB.req('/api/teacher/request-revision', {
      method: 'POST',
      body: { submissionId: submissionB, dimensionIds: ['dim-naming'], note: 'ครูคนอื่นพยายามตีกลับ' },
    })
    check(revisionOther.status === 404, 'ครู B ตีกลับงานในห้องครู A ไม่ได้', `${revisionOther.status}`)
  }

  // ───── ด่าน 6-8 คุกกี้ปลอม / หมดอายุ / ผิดบทบาท
  console.log('\n6-8) คุกกี้ที่ถูกแก้ · หมดอายุ · ผิดบทบาท')
  const goodStudent = studentA.jar.get('dbq_student') ?? ''
  const tampered = goodStudent.slice(0, -2) + (goodStudent.endsWith('A') ? 'B' : 'A')
  const c6 = new Client('คุกกี้ถูกแก้')
  c6.setCookie('dbq_student', tampered)
  const r6 = await c6.req('/api/me')
  check(r6.status === 401, 'คุกกี้ที่ถูกแก้ลายเซ็น 1 ตัวอักษร ใช้ไม่ได้', `${r6.status} (token ยาว ${tampered.length})`)

  const expiredStudent = await mintToken({ role: 'student', studentId: studentB.id, classroomId }, -60)
  const c7 = new Client('คุกกี้หมดอายุ')
  c7.setCookie('dbq_student', expiredStudent)
  const r7 = await c7.req('/api/me')
  check(r7.status === 401, 'คุกกี้ที่หมดอายุแล้ว (เซ็นด้วย secret จริง exp ย้อนหลัง 60 วินาที) ใช้ไม่ได้', `${r7.status}`)

  const expiredTeacher = await mintToken({ role: 'teacher', teacherId: room.data.teacher_id }, -60)
  const c7b = new Client('คุกกี้ครูหมดอายุ')
  c7b.setCookie('dbq_teacher', expiredTeacher)
  const r7b = await c7b.req(`/api/teacher/board?classroomId=${classroomId}`)
  check(r7b.status === 401, 'คุกกี้ครูที่หมดอายุแล้วใช้ไม่ได้', `${r7b.status}`)

  const studentTokenInTeacherSlot = await mintToken({ role: 'student', studentId: studentB.id, classroomId }, 3600)
  const c8 = new Client('ผิดบทบาท')
  c8.setCookie('dbq_teacher', studentTokenInTeacherSlot)
  const r8 = await c8.req(`/api/teacher/board?classroomId=${classroomId}`)
  check(r8.status === 401, 'เอา token นักเรียน (ลายเซ็นถูก) ใส่ช่องคุกกี้ครู ใช้ไม่ได้', `${r8.status}`)

  const teacherTokenInStudentSlot = await mintToken({ role: 'teacher', teacherId: room.data.teacher_id }, 3600)
  const c8b = new Client('ผิดบทบาท 2')
  c8b.setCookie('dbq_student', teacherTokenInStudentSlot)
  const r8b = await c8b.req('/api/me')
  check(r8b.status === 401, 'เอา token ครู (ลายเซ็นถูก) ใส่ช่องคุกกี้นักเรียน ใช้ไม่ได้', `${r8b.status}`)

  /** token ที่ role ถูกแต่ studentId เป็นของคนอื่น = ถ้าขโมยคุกกี้ได้ก็เข้าได้ ซึ่งเป็นธรรมชาติของ session */
  const forgedOther = await mintToken({ role: 'student', studentId: studentB.id, classroomId }, 3600)
  const c8c = new Client('token ปลอมด้วย secret จริง')
  c8c.setCookie('dbq_student', forgedOther)
  const r8c = await c8c.req('/api/me')
  check(
    r8c.status === 200 && r8c.text.includes('บีม'),
    'ยืนยันว่า SESSION_SECRET คือสิ่งเดียวที่กันการปลอม (ปลอมได้ต่อเมื่อรู้ secret)',
    `${r8c.status} — ถ้า secret หลุดเท่ากับปลอมเป็นใครก็ได้ จึงต้องสร้าง secret ใหม่ตอน deploy`,
  )

  // ───── ด่าน 9 ตัวจำกัดจำนวนครั้ง
  console.log('\n9) ตัวจำกัดจำนวนครั้ง — ยิงรัวรหัส 4 หลักผิด')
  const statuses: number[] = []
  const guesser = new Client('คนเดารหัส')
  for (let i = 0; i < 9; i++) {
    const res = await guesser.req('/api/join/resume', {
      method: 'POST',
      body: { roomCode: ROOM_CODE, nickname: 'บีม', pin: String(1000 + i) },
    })
    statuses.push(res.status)
  }
  const first429 = statuses.indexOf(429)
  check(
    first429 >= 0 && first429 <= 5,
    'เดารหัส 4 หลักผิดรัว ๆ แล้วโดนบล็อก',
    `สถานะที่ได้: ${statuses.join(' ')} · โดน 429 ครั้งแรกที่ครั้งที่ ${first429 + 1}`,
  )

  /**
   * ยิง /api/join รัว ๆ ด้วยชื่อเดิม — นับ **แถวนักเรียนที่ถูกสร้างจริง** ไม่ใช่แค่รหัสสถานะ
   * ตัวจำกัดถูกรีเซ็ตทุกครั้งที่เข้าสำเร็จ (app/api/join/route.ts:85 resetAttempts)
   * และชื่อซ้ำถูกเติมเลขท้ายให้เอง จึงสร้างแถวใหม่ได้เรื่อย ๆ โดยไม่โดนบล็อก
   */
  const spamName = 'คนยิงรัว'
  const joinStatuses: number[] = []
  for (let i = 0; i < 9; i++) {
    const res = await guesser.req('/api/join', {
      method: 'POST',
      body: { roomCode: ROOM_CODE, nickname: spamName, pin: '1111' },
    })
    joinStatuses.push(res.status)
  }
  const board = await repo.listClassroomBoard(room.data.teacher_id, classroomId)
  const spawned = (board ?? []).filter((r) => r.nickname.startsWith(spamName))
  check(
    joinStatuses.includes(429) || spawned.length <= 1,
    'ยิง /api/join รัว ๆ ด้วยชื่อเดิม ต้องโดนจำกัดหรือสร้างแถวได้ไม่เกิน 1 แถว',
    `สถานะ: ${joinStatuses.join(' ')} · สร้างนักเรียนจริง ${spawned.length} แถว (${spawned.map((r) => r.nickname).join(', ')})`,
  )

  // เก็บกวาดทุกแถวที่ถูกสร้างจากการยิงรัว รวมชื่อที่ถูกเติมเลขท้าย
  for (const row of spawned) {
    await repo.removeStudent(room.data.teacher_id, classroomId, row.studentId)
  }

  // ───── คุกกี้ตั้งค่าครบไหม
  console.log('\n10) ค่าความปลอดภัยของคุกกี้')
  const freshLogin = await new Client('ตรวจคุกกี้').req('/api/teacher/login', { method: 'POST', body: TEACHER_A })
  const header = freshLogin.setCookie.find((c) => c.startsWith('dbq_teacher=')) ?? ''
  const masked = header.replace(/dbq_teacher=[^;]+/, 'dbq_teacher=[ปิดบัง]')
  check(/HttpOnly/i.test(header), 'คุกกี้เป็น HttpOnly', masked)
  check(/SameSite=lax/i.test(header), 'คุกกี้ตั้ง SameSite=Lax', 'กดลิงก์จาก QR แล้วยังล็อกอินอยู่')
  check(/Path=\//i.test(header), 'คุกกี้ตั้ง Path=/', 'ครบ')
  const hasSecure = /;\s*Secure/i.test(header)
  check(
    !hasSecure,
    'ยังไม่มี Secure บนเครื่องพัฒนา (ถูกต้อง เพราะ dev รันบน http)',
    `NODE_ENV=${process.env.NODE_ENV ?? '(ไม่ได้ตั้ง)'} · lib/session.ts:29 เปิด Secure เฉพาะ production`,
  )
  check(/Max-Age=\d+/i.test(header), 'คุกกี้มีวันหมดอายุ', (header.match(/Max-Age=\d+/i) ?? ['-'])[0])

  // ───── เก็บกวาด
  const created = await repo.findStudentByNickname(classroomId, nicknameA)
  if (created) await repo.removeStudent(room.data.teacher_id, classroomId, created.id)
  console.log('\nเก็บกวาด: ลบนักเรียนที่สคริปต์สร้างแล้ว')

  const pass = checks.filter((c) => c.ok).length
  console.log(`\n══════ สรุป ══════\nเช็ก ${checks.length} ข้อ · ผ่าน ${pass} · ช่องโหว่ ${checks.length - pass}`)
  for (const c of checks.filter((c) => !c.ok)) console.log(`  ช่องโหว่: ${c.name} — ${c.detail}`)
  if (pass !== checks.length) process.exitCode = 1
}

main().catch((err: unknown) => {
  console.error('check-authz ล้มเหลว:', err)
  process.exit(1)
})

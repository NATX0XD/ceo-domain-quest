/**
 * ตรวจเส้นทางหลักฐานงานวิจัยให้ครบก่อนวันแข่ง (UAT-5)
 *
 * รัน: npx tsx scripts/check-evidence.ts     (ต้องมี dev server พอร์ต 3000)
 *
 * สร้าง **ห้องของตัวเองแล้วลบทิ้ง** ไม่แตะห้องเดโม UAT777 เลย
 * เดินผ่าน API เดียวกับที่หน้าเว็บใช้ทุกขั้น เพื่อให้แถวคำตอบรายข้อถูกบันทึกจริง
 *
 *  1. นักเรียน 8 คนทำแบบทดสอบก่อนเรียน 10 ข้อ และหลังเรียน 10 ข้อ คะแนนต่างกันจริง
 *  2. อ่านสถิติจาก /api/teacher/report/class และ /api/teacher/report/items
 *  3. คำนวณมือเทียบทุกค่า (t · df · p · d · g · ค่าความยาก p · อำนาจจำแนก r)
 *  4. ใบประกาศ PDF อ่านภาษาไทยออกไหม
 *  5. CSV ทั้ง 5 ชนิด ภาษาไทยไม่เพี้ยน และไม่มีข้อมูลระบุตัวเด็กเกินชื่อเล่น
 *
 * รูปแบบคำตอบที่ใช้: คนที่ได้ k คะแนน ตอบข้อที่ 1..k ถูก ที่เหลือผิด
 * เลือกแบบนี้เพื่อให้ **คำนวณมือตรวจย้อนได้ทุกตัวเลข** ค่าความยากของข้อที่ j
 * = จำนวนคนที่คะแนน > j หารจำนวนคนทั้งหมด
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as repo from '../lib/db/repo'
import { getServiceClient } from '../lib/db/client'
import {
  descriptive,
  effectSize,
  pairedTTest,
  round,
  tDistributionTwoTailedP,
} from '../core/statistics'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

const BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const TEACHER = { email: 'kru@uat.local', password: 'uat1234' }
/** ห้องของสคริปต์นี้เอง ลบทิ้งตอนจบเสมอ — ต้องผ่าน isValidRoomCode (ตัด 0 O 1 I L) */
const ROOM_CODE = 'ZRES88'
const OUT_DIR = process.env.EVIDENCE_OUT ?? '/tmp'

/** คนที่ i ได้คะแนนก่อนเรียน pre[i] และหลังเรียน post[i] */
const PRE = [2, 3, 4, 4, 5, 6, 7, 8]
const POST = [9, 8, 7, 5, 6, 7, 8, 9]

type Check = { ok: boolean; name: string; detail: string }
const checks: Check[] = []
function check(ok: boolean, name: string, detail: string): boolean {
  checks.push({ ok, name, detail })
  console.log(`${ok ? '  ผ่าน  ' : '  พัง!  '} ${name} — ${detail}`)
  return ok
}

class Client {
  readonly jar = new Map<string, string>()
  async req(path: string, init: { method?: string; body?: unknown } = {}) {
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
    const buf = Buffer.from(await res.arrayBuffer())
    const text = buf.toString('utf8')
    let json: Record<string, unknown> | null = null
    try {
      const parsed = JSON.parse(text) as unknown
      if (parsed && typeof parsed === 'object') json = parsed as Record<string, unknown>
    } catch {
      /* ไม่ใช่ JSON */
    }
    return { status: res.status, text, json, buf, headers: res.headers }
  }
}

function contentJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), 'content', file), 'utf8')) as T
}

const quiz = contentJson<{
  pre: Array<{ id: string }>
  post: Array<{ id: string }>
}>('quiz.json')
const answers = contentJson<{
  pre: Array<{ id: string; answerIndex: number }>
  post: Array<{ id: string; answerIndex: number }>
}>('quiz-answers.json')

/** คำตอบที่ทำให้ได้คะแนนเท่ากับ score พอดี: ข้อ 1..score ถูก ที่เหลือผิด */
function answerSheet(set: 'pre' | 'post', score: number): Record<string, number> {
  const out: Record<string, number> = {}
  answers[set].forEach((q, i) => {
    out[q.id] = i < score ? q.answerIndex : (q.answerIndex + 1) % 4
  })
  return out
}

async function main(): Promise<void> {
  const db = getServiceClient()
  const teacherRow = await db.from('teachers').select('id').eq('email', TEACHER.email).maybeSingle()
  if (!teacherRow.data) throw new Error(`ไม่พบครู ${TEACHER.email} — รัน npm run seed:uat ก่อน`)
  const teacherId = teacherRow.data.id

  // ── ล้างห้องเดิมของสคริปต์นี้ถ้าค้างอยู่ แล้วสร้างใหม่
  const stale = await db.from('classrooms').select('id, teacher_id').eq('room_code', ROOM_CODE).maybeSingle()
  if (stale.data) {
    if (stale.data.teacher_id !== teacherId) throw new Error(`ห้อง ${ROOM_CODE} เป็นของครูคนอื่น ไม่ลบให้`)
    await repo.deleteClassroom(teacherId, stale.data.id)
  }
  const room = await repo.createClassroom(teacherId, ROOM_CODE)
  console.log(`สร้างห้องทดลอง ${ROOM_CODE} (${room.id}) — ลบทิ้งตอนจบ\n`)

  const teacher = new Client()
  const login = await teacher.req('/api/teacher/login', { method: 'POST', body: TEACHER })
  if (!check(login.status === 200, 'ครูล็อกอิน', `${login.status}`)) throw new Error('ล็อกอินไม่ผ่าน')

  const opened = await teacher.req('/api/teacher/session', { method: 'POST', body: { action: 'open', classroomId: room.id } })
  const sessionId = String((opened.json?.session as { id?: string })?.id ?? '')
  check(Boolean(sessionId), 'เปิดคาบของห้องทดลอง', `${opened.status}`)

  for (const which of ['pre', 'post'] as const) {
    const res = await teacher.req('/api/teacher/session', {
      method: 'POST',
      body: { action: 'test-window', sessionId, which, enabled: true },
    })
    check(res.status === 200, `ครูเปิดแบบทดสอบ ${which === 'pre' ? 'ก่อนเรียน' : 'หลังเรียน'}`, `${res.status}`)
  }

  // ── 1) นักเรียน 8 คนทำทั้งสองชุด
  console.log('\n1) นักเรียน 8 คนทำแบบทดสอบก่อนเรียนและหลังเรียน')
  const students: Array<{ client: Client; nickname: string; id: string; pre: number; post: number }> = []
  for (let i = 0; i < PRE.length; i++) {
    const client = new Client()
    const nickname = `ผู้เรียน${i + 1}`
    const joined = await client.req('/api/join', { method: 'POST', body: { roomCode: ROOM_CODE, nickname, pin: '2024' } })
    if (joined.status !== 200) {
      check(false, `${nickname} เข้าห้อง`, `${joined.status} ${String(joined.json?.message ?? '')}`)
      continue
    }
    await client.req('/api/profile', {
      method: 'POST',
      body: {
        shopName: `ร้านของ${nickname}`,
        businessTypeId: 'coffee',
        domainName: `shop${i + 1}test`,
        isRegisteredCompany: false,
        audience: 'thai',
      },
    })
    const me = await client.req('/api/me')
    const id = String((me.json?.student as { id?: string })?.id ?? '')

    const pre = await client.req('/api/pretest', { method: 'POST', body: { answers: answerSheet('pre', PRE[i]!) } })
    const post = await client.req('/api/posttest', { method: 'POST', body: { answers: answerSheet('post', POST[i]!) } })
    const gotPre = Number(pre.json?.score ?? -1)
    const gotPost = Number(post.json?.score ?? -1)
    check(
      gotPre === PRE[i] && gotPost === POST[i],
      `${nickname} ได้คะแนนตามที่ออกแบบ`,
      `ก่อนเรียน ${gotPre}/${PRE[i]} · หลังเรียน ${gotPost}/${POST[i]} · พัฒนาการ ${gotPost - gotPre}`,
    )
    students.push({ client, nickname, id, pre: gotPre, post: gotPost })
  }

  const n = students.length
  check(n >= 6, `มีนักเรียนที่ทำครบทั้งสองชุดอย่างน้อย 6 คน`, `${n} คน`)
  const gains = students.map((s) => s.post - s.pre)
  check(
    new Set(gains).size >= 3,
    'พัฒนาการต่างกันจริง ไม่ใช่ทุกคนเท่ากัน',
    `พัฒนาการ: ${gains.join(', ')} · แบบที่ต่างกัน ${new Set(gains).size} แบบ`,
  )

  // ── 2) สถิติจากหน้ารายงาน
  console.log('\n2) สถิติที่หน้ารายงานคืนมา')
  const cls = await teacher.req(`/api/teacher/report/class?classroomId=${room.id}`)
  check(cls.status === 200, 'GET /api/teacher/report/class', `${cls.status}`)
  writeFileSync(join(OUT_DIR, 'uat5-report-class.json'), cls.text)

  const report = (cls.json?.report ?? {}) as Record<string, unknown>
  const efficiency = (report.efficiency ?? {}) as Record<string, { percent?: number | null; reason?: string | null }>
  const tests = (report.tests ?? {}) as Record<string, unknown>
  const tTest = (tests.pairedTTest ?? null) as
    | { t: number | null; df: number | null; p: number | null; meanDiff?: number | null; sdDiff?: number | null; reason?: string | null }
    | null
  const eff = (tests.effectSize ?? null) as { d: number | null; level?: string; reason?: string | null } | null
  const hake = (tests.normalizedGain ?? null) as { g: number | null; level?: string } | null

  check(
    typeof efficiency.e1?.percent === 'number' && typeof efficiency.e2?.percent === 'number',
    'มี E1 และ E2',
    `E1=${efficiency.e1?.percent}% · E2=${efficiency.e2?.percent}%`,
  )
  check(typeof tTest?.t === 'number', 'มีค่า t', String(tTest?.t ?? tTest?.reason))
  check(typeof tTest?.df === 'number', 'มีค่า df', String(tTest?.df))
  check(typeof tTest?.p === 'number', 'มีค่า p', String(tTest?.p))
  check(typeof eff?.d === 'number', "มี Cohen's d", `d=${eff?.d} (${String(eff?.level)})`)

  /**
   * Hedges' g ของแบบจับคู่ = d × (1 − 3/(4·df − 1)) — เอกสารนำเสนอสัญญาว่ามีค่านี้
   * ระวังสับสนกับ `normalizedGain.g` ซึ่งเป็น **คะแนนพัฒนาการปรับมาตรฐานของ Hake** คนละตัวกัน
   */
  const hedgesKeys = Object.keys((eff ?? {}) as object).filter((k) => /hedg/i.test(k))
  check(
    hedgesKeys.length > 0,
    "มี Hedges' g ในผลลัพธ์",
    hedgesKeys.length > 0
      ? `พบคีย์ ${hedgesKeys.join(', ')}`
      : `ไม่มีคีย์ไหนเป็น Hedges' g เลย · effectSize มีแค่ ${Object.keys((eff ?? {}) as object).join(', ')} · ที่ใกล้เคียงคือ normalizedGain.g = ${hake?.g} ซึ่งเป็นคะแนนพัฒนาการของ Hake ไม่ใช่ Hedges' g`,
  )

  const items = await teacher.req(`/api/teacher/report/items?classroomId=${room.id}`)
  check(items.status === 200, 'GET /api/teacher/report/items', `${items.status}`)
  writeFileSync(join(OUT_DIR, 'uat5-report-items.json'), items.text)
  const analysis = (items.json?.itemAnalysis ?? {}) as Record<string, unknown>
  const sets = (analysis.sets ?? []) as Array<{
    set: string
    label: string
    responders: number
    groupSize: number
    itemCount: number
    items: Array<{ itemId: string; difficulty: number | null; discrimination: number | null }>
  }>
  check(sets.length === 2, 'แยกชุดข้อสอบ A/B ไม่ปนกัน', sets.map((s) => `${s.label} (${s.responders} คน · ${s.items.length} ข้อ)`).join(' | '))

  for (const s of sets) {
    const withP = s.items.filter((i) => typeof i.difficulty === 'number')
    const withR = s.items.filter((i) => typeof i.discrimination === 'number')
    const pValues = withP.map((i) => i.difficulty as number)
    const rValues = withR.map((i) => i.discrimination as number)
    check(
      withP.length === s.itemCount && new Set(pValues).size > 1,
      `${s.label} — ค่าความยาก p ออกเป็นตัวเลขจริงครบทุกข้อและไม่ซ้ำกันหมด`,
      `${withP.length}/${s.itemCount} ข้อ · ค่าที่ได้ ${pValues.join(', ')}`,
    )
    check(
      withR.length === s.itemCount && rValues.some((r) => r !== 0),
      `${s.label} — อำนาจจำแนก r ออกเป็นตัวเลขจริงครบทุกข้อและไม่ใช่ศูนย์ทั้งชุด`,
      `${withR.length}/${s.itemCount} ข้อ · ค่าที่ได้ ${rValues.join(', ')} · กลุ่มสูง/ต่ำกลุ่มละ ${s.groupSize} คน`,
    )
  }

  // ── 3) คำนวณมือเทียบ
  console.log('\n3) คำนวณมือเทียบกับที่ระบบตอบ')
  const pre = students.map((s) => s.pre)
  const post = students.map((s) => s.post)
  const diffs = students.map((s) => s.post - s.pre)
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / n
  const sdDiff = Math.sqrt(diffs.reduce((a, b) => a + (b - meanDiff) ** 2, 0) / (n - 1))
  const handT = meanDiff / (sdDiff / Math.sqrt(n))
  const handDf = n - 1
  const handP = tDistributionTwoTailedP(handT, handDf)
  const handD = meanDiff / sdDiff
  const handG = handD * (1 - 3 / (4 * handDf - 1))

  console.log(`   ก่อนเรียน: ${pre.join(', ')} (เฉลี่ย ${round(descriptive(pre).mean, 4)})`)
  console.log(`   หลังเรียน: ${post.join(', ')} (เฉลี่ย ${round(descriptive(post).mean, 4)})`)
  console.log(`   ผลต่าง: ${diffs.join(', ')} · เฉลี่ยผลต่าง ${round(meanDiff, 4)} · SD ผลต่าง ${round(sdDiff, 4)}`)
  console.log(`   มือ: t = ${round(meanDiff, 4)} / (${round(sdDiff, 4)} / √${n}) = ${round(handT, 4)} · df = ${handDf} · p = ${handP === null ? 'null' : handP.toExponential(3)}`)
  console.log(`   มือ: d = ${round(meanDiff, 4)} / ${round(sdDiff, 4)} = ${round(handD, 4)} · g = d × (1 − 3/(4×${handDf}−1)) = ${round(handG, 4)}`)

  const near = (a: number | null | undefined, b: number | null, tol = 0.02) =>
    typeof a === 'number' && b !== null && Math.abs(a - b) <= tol

  check(near(tTest?.t, round(handT, 4), 0.01), 'ค่า t ตรงกับที่คำนวณมือ', `ระบบ ${tTest?.t} · มือ ${round(handT, 4)}`)
  check(tTest?.df === handDf, 'ค่า df ตรงกับที่คำนวณมือ', `ระบบ ${tTest?.df} · มือ ${handDf}`)
  check(near(tTest?.p, handP === null ? null : round(handP, 6), 0.001), 'ค่า p ตรงกับที่คำนวณมือ', `ระบบ ${tTest?.p} · มือ ${handP?.toExponential(3)}`)
  check(near(eff?.d, round(handD, 4), 0.01), "Cohen's d ตรงกับที่คำนวณมือ", `ระบบ ${eff?.d} · มือ ${round(handD, 4)}`)
  check(
    false,
    "Hedges' g — ค่าที่ควรได้ถ้ามีการคำนวณ",
    `มือคิดได้ ${round(handG, 4)} (= d ${round(handD, 4)} × (1 − 3/(4×${handDf}−1))) · ระบบไม่ได้คิดค่านี้เลย · ห้ามหยิบ normalizedGain.g = ${hake?.g} ไปใส่สไลด์แทน เพราะเป็นสถิติคนละตัว`,
  )

  // เทียบกับ core/statistics โดยตรงด้วย เพื่อแยกว่าสูตรผิดหรือทางส่งข้อมูลผิด
  const coreTest = pairedTTest(students.map((s) => ({ pre: s.pre, post: s.post })))
  const coreEff = effectSize(coreTest)
  check(
    near(coreTest.t, round(handT, 4), 0.01) && near(coreEff.d, round(handD, 4), 0.01),
    'core/statistics คิดตรงกับมือด้วย (แยกว่าเป็นปัญหาสูตรหรือปัญหาทางส่งข้อมูล)',
    `core t=${coreTest.t} · d=${coreEff.d} · p=${coreTest.p}`,
  )

  // ค่าความยากรายข้อ: คนที่คะแนน > j ตอบข้อ j ถูก
  const preSet = sets.find((s) => s.set === 'pre')
  if (preSet) {
    const mismatches: string[] = []
    quiz.pre.forEach((q, j) => {
      const expected = round(pre.filter((score) => score > j).length / n, 4)
      const got = preSet.items.find((i) => i.itemId === q.id)?.difficulty ?? null
      if (got === null || Math.abs(got - expected) > 0.0001) mismatches.push(`${q.id}: ระบบ ${got} · มือ ${expected}`)
    })
    check(
      mismatches.length === 0,
      'ค่าความยาก p ทั้ง 10 ข้อของชุด A ตรงกับที่คำนวณมือ',
      mismatches.length === 0
        ? `ทุกข้อตรง · เช่น ${quiz.pre[2]!.id} = ${preSet.items.find((i) => i.itemId === quiz.pre[2]!.id)?.difficulty} (คนที่ได้เกิน 2 คะแนน ${pre.filter((s) => s > 2).length} จาก ${n} คน)`
        : mismatches.join(' · '),
    )

    // อำนาจจำแนก: กลุ่มสูง = groupSize คนคะแนนสูงสุด · กลุ่มต่ำ = groupSize คนคะแนนต่ำสุด
    const g = preSet.groupSize
    const ranked = [...pre].sort((a, b) => b - a)
    const high = ranked.slice(0, g)
    const low = ranked.slice(ranked.length - g)
    const rMismatch: string[] = []
    quiz.pre.forEach((q, j) => {
      const hi = high.filter((s) => s > j).length / g
      const lo = low.filter((s) => s > j).length / g
      const expected = round(hi - lo, 4)
      const got = preSet.items.find((i) => i.itemId === q.id)?.discrimination ?? null
      if (got === null || Math.abs(got - expected) > 0.0001) rMismatch.push(`${q.id}: ระบบ ${got} · มือ ${expected}`)
    })
    check(
      rMismatch.length === 0,
      'อำนาจจำแนก r ทั้ง 10 ข้อของชุด A ตรงกับที่คำนวณมือ',
      rMismatch.length === 0
        ? `ทุกข้อตรง · กลุ่มสูง ${high.join(',')} · กลุ่มต่ำ ${low.join(',')} (กลุ่มละ ${g} คน)`
        : rMismatch.join(' · '),
    )
  }

  // ── 4) ใบประกาศ
  console.log('\n4) ใบประกาศ PDF')
  const top = students[students.length - 1]!
  const bossOk = await top.client.req('/api/ceo', {
    method: 'POST',
    body: {
      modeId: 'bm-mode-write',
      focusRubricId: 'bm-r1',
      fields: {
        'bm-f1': 'evidenceshop',
        'bm-f2': '.com',
        'bm-f3': 'ชื่อนี้ตรงกับป้ายหน้าร้าน ลูกค้าพิมพ์ตามได้ทันทีไม่ต้องเลื่อนหา',
        'bm-f4': 'เลือก .com เพราะร้านยังไม่จดทะเบียนนิติบุคคล จด .co.th ไม่ได้',
        'bm-f5': 'ลูกค้าหลักคือคนในชุมชนที่สั่งล่วงหน้าแล้วมารับที่ร้าน',
      },
      selfAssessment: { 'bm-self1': 'ชื่อจำง่ายแล้ว', 'bm-self2': 'ยังไม่แน่ใจเหตุผล', 'bm-self3': 'จะสำรวจเพิ่ม' },
    },
  })
  const submissionId = String(bossOk.json?.submissionId ?? '')
  check(bossOk.status === 200 && submissionId.length > 0, `${top.nickname} ส่งใบเสนอด่านบอส`, `${bossOk.status}`)

  const confirmed = await teacher.req('/api/teacher/confirm-score', {
    method: 'POST',
    body: {
      submissionId,
      dimensions: { 'dim-naming': 3, 'dim-tld-fit': 3, 'dim-customer-reason': 3, 'dim-business-link': 3 },
      emphasisDimensionId: 'dim-naming',
      note: 'ผ่านครบ 4 ด้าน',
    },
  })
  check(confirmed.status === 200, 'ครูยืนยันคะแนนระดับ 3 ครบ 4 ด้าน', `${confirmed.status}`)

  const cert = await top.client.req('/api/certificate')
  check(cert.status === 200 && cert.buf.subarray(0, 4).toString() === '%PDF', 'ดาวน์โหลดใบประกาศเป็น PDF ได้', `${cert.status} · ${cert.buf.length} ไบต์`)
  const certPath = join(OUT_DIR, 'uat5-certificate.pdf')
  writeFileSync(certPath, cert.buf)
  console.log(`   เก็บไฟล์ไว้ที่ ${certPath}`)

  const disposition = cert.headers.get('content-disposition') ?? ''
  check(disposition.includes("filename*=UTF-8''"), 'ชื่อไฟล์ใบประกาศส่งแบบ UTF-8 (ชื่อไทยไม่เพี้ยน)', disposition.slice(0, 120))

  // E1 ต้องขยับหลังครูยืนยันคะแนนแล้ว (ก่อนยืนยันเป็น 0 ตามกฎ E1 นับแต่คะแนนที่ครูยืนยัน)
  const clsAfter = await teacher.req(`/api/teacher/report/class?classroomId=${room.id}`)
  const effAfter = ((clsAfter.json?.report as Record<string, unknown>)?.efficiency ?? {}) as Record<string, { percent?: number | null }>
  check(
    typeof effAfter.e1?.percent === 'number' && (effAfter.e1?.percent ?? 0) > 0,
    'E1 ขยับขึ้นหลังครูยืนยันคะแนนใบเสนอ',
    `ก่อนยืนยัน E1=${efficiency.e1?.percent}% → หลังยืนยัน E1=${effAfter.e1?.percent}% (E1 นับแต่คะแนนรูบริกที่ครูยืนยันแล้วเท่านั้น)`,
  )

  // ── 5) CSV ทุกชนิด
  console.log('\n5) ไฟล์ CSV ทุกชนิด')
  // ชนิดที่ route รองรับจริง (app/api/teacher/export/route.ts:24)
  const csvTypes = ['students', 'scores', 'events', 'reflections', 'survey'] as const
  const pii = /(?:เลขบัตร|รหัสประจำตัว|@[a-z0-9.-]+\.[a-z]{2,}|0\d{8,9})/i
  for (const type of csvTypes) {
    const res = await teacher.req(`/api/teacher/export?classroomId=${room.id}&type=${type}`)
    if (res.status !== 200) {
      check(false, `CSV ชนิด ${type}`, `${res.status}`)
      continue
    }
    const hasBom = res.buf[0] === 0xef && res.buf[1] === 0xbb && res.buf[2] === 0xbf
    const body = res.text.replace(/^﻿/, '')
    const header = body.split('\n')[0] ?? ''
    const thaiOk = /[ก-๙]/.test(header) && !header.includes('�')
    const foundPii = pii.test(body)
    check(
      hasBom && thaiOk && !foundPii,
      `CSV ชนิด ${type}`,
      `BOM ${hasBom ? 'มี (Excel อ่านไทยได้)' : 'ไม่มี ← ไทยจะเพี้ยนใน Excel'} · หัวคอลัมน์ ${thaiOk ? 'ไทยปกติ' : 'เพี้ยน'} · ข้อมูลระบุตัว ${foundPii ? 'พบ!' : 'ไม่พบ'} · ${body.split('\n').length - 1} แถว`,
    )
    writeFileSync(join(OUT_DIR, `uat5-export-${type}.csv`), res.buf)
  }

  // ── เก็บกวาด
  const removed = await repo.deleteClassroom(teacherId, room.id)
  console.log(`\nเก็บกวาด: ลบห้อง ${ROOM_CODE} แล้ว (ไฟล์เสียง ${removed?.deletedFiles ?? 0} ไฟล์)`)
  const gone = await db.from('classrooms').select('id').eq('room_code', ROOM_CODE).maybeSingle()
  check(gone.data === null, `ห้องทดลอง ${ROOM_CODE} ถูกลบเกลี้ยง`, gone.data === null ? 'ไม่เหลือแถว' : 'ยังอยู่!')

  const pass = checks.filter((c) => c.ok).length
  console.log(`\n══════ สรุป ══════\nเช็ก ${checks.length} ข้อ · ผ่าน ${pass} · พัง ${checks.length - pass}`)
  for (const c of checks.filter((x) => !x.ok)) console.log(`  พัง: ${c.name} — ${c.detail}`)
  if (pass !== checks.length) process.exitCode = 1
}

main().catch(async (err: unknown) => {
  console.error('check-evidence ล้มเหลว:', err)
  try {
    const db = getServiceClient()
    const t = await db.from('teachers').select('id').eq('email', TEACHER.email).maybeSingle()
    const r = await db.from('classrooms').select('id').eq('room_code', ROOM_CODE).maybeSingle()
    if (t.data && r.data) await repo.deleteClassroom(t.data.id, r.data.id)
    console.error(`(เก็บกวาด: ลบห้อง ${ROOM_CODE} แล้ว)`)
  } catch {
    console.error(`(เก็บกวาดไม่สำเร็จ — ตรวจห้อง ${ROOM_CODE} ด้วยมือ)`)
  }
  process.exit(1)
})

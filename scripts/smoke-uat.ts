/**
 * เช็กเร็ว ๆ ว่าระบบยังเล่นได้ครบวงไหม — ใช้รันหลังแก้โค้ดเสร็จ ก่อนส่งให้เจ้าของเล่น
 *
 * รัน: npm run smoke:uat        (ต้องมี dev server พอร์ต 3000 เปิดอยู่ และรัน seed:uat มาก่อน)
 *
 * ใช้ค่าชุดเดียวกับ docs/try-it.md เป๊ะ ๆ — ถ้าคู่มือกับของจริงหลุดกัน สคริปต์นี้จะแดงทันที
 * เดินเหมือนคนจริง: ครูล็อกอิน → นักเรียนเข้าห้อง → ทำภารกิจ → ส่งด่านบอส → ครูเห็นในแผง
 * แล้วกวาดทุกหน้าเว็บที่มีอยู่ เช็กว่าไม่มีหน้าไหน 500 และไม่มีหน้าไหนจอขาว
 *
 * ไม่แตะโค้ดโปรดักชัน · ไม่ลบข้อมูลของใคร · เก็บกวาดนักเรียนที่ตัวเองสร้างทิ้งทุกครั้งที่จบ
 * ออกด้วย exit code 1 เมื่อมีข้อไม่ผ่าน เอาไปต่อกับ CI ได้เลย
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as repo from '../lib/db/repo'
import { getServiceClient } from '../lib/db/client'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

// ───────────────────────────── ค่าเดียวกับ docs/try-it.md

const BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const TEACHER_EMAIL = 'kru@uat.local'
const TEACHER_PASSWORD = 'uat1234'
const ROOM_CODE = 'UAT777'

/** ชื่อเล่นของนักเรียนที่สคริปต์สร้างเอง — ลบทิ้งทุกครั้งตอนจบ ห้องจึงไม่บวม */
const SMOKE_NICKNAME = 'สโมคเทสต์'
const SMOKE_PIN = '4321'

/** หน้าที่ต้องส่งค่า param — ใส่ค่าตัวอย่างให้ตรงกับของจริงในเนื้อหา */
const PARAM_SAMPLES: Record<string, string> = { id: 'm1' }

/** อย่างน้อยกี่ตัวอักษรที่คนอ่านได้ ถือว่าไม่ใช่จอขาว */
const MIN_VISIBLE_CHARS = 40

/** ร่องรอยหน้าพังของ Next ที่คืน 200 มาได้ */
const ERROR_MARKERS = [
  'Unhandled Runtime Error',
  'Application error: a client-side exception',
  'Internal Server Error',
  'Parsing ecmascript source code failed',
]

// ───────────────────────────── เก็บคุกกี้แบบง่าย (ครูกับนักเรียนอยู่ในใบเดียวกันได้ ชื่อคุกกี้ต่างกัน)

const jar = new Map<string, string>()

function cookieHeader(): string {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
}

function absorbCookies(res: Response): void {
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(';')
    const eq = pair?.indexOf('=') ?? -1
    if (!pair || eq <= 0) continue
    jar.set(pair.slice(0, eq), pair.slice(eq + 1))
  }
}

async function req(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; text: string; json: Record<string, unknown> | null; url: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(jar.size > 0 ? { cookie: cookieHeader() } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  absorbCookies(res)
  const text = await res.text()
  let json: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(text) as unknown
    if (parsed && typeof parsed === 'object') json = parsed as Record<string, unknown>
  } catch {
    // หน้า HTML ไม่ใช่ JSON เป็นเรื่องปกติ
  }
  return { status: res.status, text, json, url: res.url }
}

// ───────────────────────────── ตัวนับผล

type Result = { name: string; ok: boolean; ms: number; detail: string }
const results: Result[] = []

async function step(name: string, run: () => Promise<string>): Promise<boolean> {
  const t0 = Date.now()
  try {
    const detail = await run()
    results.push({ name, ok: true, ms: Date.now() - t0, detail })
    return true
  } catch (error) {
    results.push({
      name,
      ok: false,
      ms: Date.now() - t0,
      detail: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

function must(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

// ───────────────────────────── ไล่หาหน้าเว็บทั้งหมดที่มีอยู่จริง

/** แปลง app/**‍/page.tsx เป็นเส้นทาง URL · ข้าม route group (วงเล็บ) และโฟลเดอร์ api */
function discoverRoutes(): string[] {
  const appDir = join(process.cwd(), 'app')
  const routes: string[] = []

  function walk(dir: string, segments: string[]): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'api' || entry.name.startsWith('_')) continue
        // (group) ไม่กลายเป็นส่วนของ URL
        const isGroup = entry.name.startsWith('(') && entry.name.endsWith(')')
        walk(join(dir, entry.name), isGroup ? segments : [...segments, entry.name])
        continue
      }
      if (entry.name !== 'page.tsx' && entry.name !== 'page.ts') continue
      const parts = segments.map((s) => {
        const dynamic = s.match(/^\[\.{0,3}(.+)\]$/)
        if (!dynamic) return s
        const sample = PARAM_SAMPLES[dynamic[1]!]
        if (!sample) throw new Error(`ไม่รู้จะใส่ค่าอะไรให้ param [${dynamic[1]}] — เพิ่มใน PARAM_SAMPLES`)
        return sample
      })
      routes.push(`/${parts.join('/')}`.replace(/\/+$/, '') || '/')
    }
  }

  walk(appDir, [])
  return [...new Set(routes)].sort()
}

/** ตัดแท็กออกให้เหลือตัวอักษรที่คนอ่านได้ ใช้จับ "จอขาว" ที่ตอบ 200 */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ───────────────────────────── เฉลยของภารกิจ (อ่านฝั่งเซิร์ฟเวอร์เท่านั้น เหมือนที่ route ทำ)

function answerFor(missionId: string): { checkId: string; answerIndex: number } {
  const raw = readFileSync(join(process.cwd(), 'content', 'missions-answers.json'), 'utf8')
  const parsed = JSON.parse(raw) as {
    missions: Array<{ id: string; checkId: string; answerIndex: number }>
  }
  const row = parsed.missions.find((m) => m.id === missionId)
  if (!row) throw new Error(`ไม่มีเฉลยของภารกิจ ${missionId} ใน content/missions-answers.json`)
  return { checkId: row.checkId, answerIndex: row.answerIndex }
}

// ───────────────────────────── เก็บกวาด

let smokeNicknameUsed: string | null = null

async function cleanup(): Promise<string> {
  if (!smokeNicknameUsed) return 'ไม่มีนักเรียนที่ต้องลบ'
  const db = getServiceClient()
  const teacher = await db.from('teachers').select('id').eq('email', TEACHER_EMAIL).maybeSingle()
  if (teacher.error) throw teacher.error
  if (!teacher.data) return 'ไม่พบครู UAT จึงไม่ลบอะไร'

  const classroom = await db
    .from('classrooms')
    .select('id')
    .eq('room_code', ROOM_CODE)
    .eq('teacher_id', teacher.data.id)
    .maybeSingle()
  if (classroom.error) throw classroom.error
  if (!classroom.data) return 'ไม่พบห้อง UAT จึงไม่ลบอะไร'

  const student = await repo.findStudentByNickname(classroom.data.id, smokeNicknameUsed)
  if (!student) return `ไม่พบนักเรียน ${smokeNicknameUsed} (อาจถูกลบไปแล้ว)`

  const removed = await repo.removeStudent(teacher.data.id, classroom.data.id, student.id)
  return removed ? `ลบนักเรียน ${smokeNicknameUsed} ออกจากห้องแล้ว` : 'ลบไม่สำเร็จ'
}

// ───────────────────────────── main

async function main(): Promise<void> {
  const startedAt = Date.now()
  let classroomId = ''

  console.log(`เช็กระบบที่ ${BASE_URL} · ห้อง ${ROOM_CODE} · ครู ${TEACHER_EMAIL}\n`)

  const serverUp = await step('เซิร์ฟเวอร์ตอบรับ', async () => {
    const res = await req('/')
    must(res.status === 200, `หน้าแรกตอบ ${res.status} (dev server เปิดอยู่ไหม)`)
    return `หน้าแรก ${res.status}`
  })
  if (!serverUp) {
    report(startedAt)
    process.exit(1)
  }

  await step('ครูล็อกอินด้วยรหัสในคู่มือ', async () => {
    const res = await req('/api/teacher/login', {
      method: 'POST',
      body: { email: TEACHER_EMAIL, password: TEACHER_PASSWORD },
    })
    must(res.status === 200, `ล็อกอินตอบ ${res.status} — รหัสในคู่มือกับ seed ไม่ตรงกันแล้ว`)
    must(jar.has('dbq_teacher'), 'ล็อกอินผ่านแต่ไม่ได้คุกกี้ dbq_teacher')
    return `ได้คุกกี้ครู · ${String((res.json?.teacher as { email?: string })?.email)}`
  })

  await step(`ครูเห็นห้อง ${ROOM_CODE}`, async () => {
    const res = await req('/api/teacher/classroom')
    must(res.status === 200, `ดึงรายการห้องตอบ ${res.status}`)
    const rooms = (res.json?.classrooms ?? []) as Array<{ id: string; room_code: string }>
    const room = rooms.find((c) => c.room_code === ROOM_CODE)
    must(room, `ไม่พบห้อง ${ROOM_CODE} ในบัญชีครู — รัน npm run seed:uat ก่อน`)
    classroomId = room!.id
    return `${ROOM_CODE} = ${classroomId}`
  })

  await step('คาบเปิดอยู่และช่วงของคาบพร้อมเล่น', async () => {
    must(classroomId, 'ยังไม่รู้รหัสห้อง')
    const res = await req(`/api/teacher/session?classroomId=${classroomId}`)
    must(res.status === 200, `ดึงคาบตอบ ${res.status}`)
    const s = res.json?.session as { phase?: string; ended_at?: string | null } | undefined
    must(s, 'ไม่ได้ข้อมูลคาบกลับมา')
    must(s!.ended_at === null || s!.ended_at === undefined, 'คาบนี้ถูกปิดไปแล้ว นักเรียนเข้าเล่นไม่ได้')
    return `ช่วง = ${s!.phase}`
  })

  await step('นักเรียนใหม่เข้าห้องด้วยรหัสห้องในคู่มือ', async () => {
    const res = await req('/api/join', {
      method: 'POST',
      body: { roomCode: ROOM_CODE, nickname: SMOKE_NICKNAME, pin: SMOKE_PIN },
    })
    must(res.status === 200, `เข้าห้องตอบ ${res.status} ${String(res.json?.message ?? '')}`)
    must(jar.has('dbq_student'), 'เข้าห้องผ่านแต่ไม่ได้คุกกี้ dbq_student')
    smokeNicknameUsed = String(res.json?.nickname ?? SMOKE_NICKNAME)
    return `เข้าเป็น "${smokeNicknameUsed}"`
  })

  await step('ตั้งค่าร้านของตัวเอง', async () => {
    const res = await req('/api/profile', {
      method: 'POST',
      body: {
        shopName: 'ร้านสโมคเทสต์',
        businessTypeId: 'coffee',
        domainName: 'smoketest',
        isRegisteredCompany: false,
        audience: 'thai',
      },
    })
    must(res.status === 200, `บันทึกร้านตอบ ${res.status} ${String(res.json?.message ?? '')}`)
    return 'บันทึกโปรไฟล์ร้านแล้ว'
  })

  await step('ทำภารกิจ m1 แล้วได้ดาว', async () => {
    const { checkId, answerIndex } = answerFor('m1')
    const res = await req('/api/mission/m1/check', {
      method: 'POST',
      body: { checkId, choiceIndex: answerIndex, channel: 'clip', confidence: 2 },
    })
    must(res.status === 200, `ตรวจคำตอบตอบ ${res.status} ${String(res.json?.message ?? '')}`)
    must(res.json?.correct === true, 'ส่งคำตอบที่ถูกไปแล้วแต่ระบบบอกว่าผิด')
    must(Number(res.json?.stars) > 0, 'ตอบถูกแต่ไม่ได้ดาว')
    return `ถูก · ดาว ${String(res.json?.stars)} · ผ่าน ${String(res.json?.passed)}`
  })

  await step('ยื่นป้ายร้านที่สถานี B (เรียก AI จริง)', async () => {
    const res = await req('/api/station-b/submit', {
      method: 'POST',
      body: {
        tldId: 'com',
        reasonText: 'เลือก .com เพราะลูกค้าคุ้นเคยที่สุด พิมพ์ครั้งเดียวก็เจอร้านของเราได้เลย',
      },
    })
    must(res.status === 200, `ยื่นป้ายตอบ ${res.status} ${String(res.json?.message ?? '')}`)
    must(res.json?.accepted === true, `ระบบไม่รับ: ${String(res.json?.reason ?? '')}`)
    // ตกไปทางกฎไม่ใช่ข้อผิดพลาด แต่บอกไว้ให้เห็นว่ารอบนี้ได้ AI จริงหรือไม่
    return `รับแล้ว ${String(res.json?.domain)} · คะแนนเหตุผล ${String(res.json?.reasonScore)}/${String(res.json?.reasonMaxScore)} · ที่มา ${String(res.json?.source)}/${String(res.json?.provider)}${res.json?.fallbackReason ? ` (${String(res.json.fallbackReason)})` : ''}`
  })

  await step('ส่งใบเสนอด่านบอส', async () => {
    const res = await req('/api/ceo', {
      method: 'POST',
      body: {
        modeId: 'bm-mode-write',
        focusRubricId: 'bm-r3',
        fields: {
          'bm-f1': 'smoketest',
          'bm-f2': '.com',
          'bm-f3': 'ชื่อนี้ตรงกับป้ายหน้าร้าน ลูกค้าพิมพ์ตามได้ทันทีไม่ต้องเลื่อนหาในแอป',
          'bm-f4': 'เลือก .com เพราะร้านยังไม่ได้จดทะเบียนนิติบุคคล จด .co.th ไม่ได้',
          'bm-f5': 'ลูกค้าหลักคือคนแถวโรงเรียนที่อยากสั่งกาแฟล่วงหน้า',
        },
        selfAssessment: {
          'bm-self1': 'คิดว่าชื่อจำง่ายแล้ว',
          'bm-self2': 'ยังอธิบายเหตุผลได้ไม่ยาวมาก',
          'bm-self3': 'รอบหน้าจะเขียนเหตุผลให้ละเอียดขึ้น',
        },
      },
    })
    must(res.status === 200, `ส่งด่านบอสตอบ ${res.status} ${String(res.json?.message ?? '')}`)
    must(res.json?.submissionId, 'ส่งผ่านแต่ไม่ได้ submissionId กลับมา')
    return `ส่งแล้ว ฉบับที่ ${String(res.json?.version)} · submissionId ${String(res.json?.submissionId).slice(0, 8)}…`
  })

  await step('ครูเห็นนักเรียนคนนี้ในแผงพร้อมงานรอตรวจ', async () => {
    must(classroomId, 'ยังไม่รู้รหัสห้อง')
    const res = await req(`/api/teacher/board?classroomId=${classroomId}`)
    must(res.status === 200, `ดึงแผงตอบ ${res.status}`)
    const board = (res.json?.board ?? []) as Array<{
      nickname: string
      earnedStars: number
      pendingReview: number
    }>
    const row = board.find((r) => r.nickname === smokeNicknameUsed)
    must(row, `แผงครูไม่เห็น "${smokeNicknameUsed}" ทั้งที่เพิ่งเล่นจบ`)
    must(row!.pendingReview > 0, 'ส่งงานแล้วแต่แผงครูยังไม่ขึ้นว่ามีงานรอตรวจ')
    return `เห็นแล้ว · ดาว ${row!.earnedStars} · รอตรวจ ${row!.pendingReview} ใบ · ทั้งห้อง ${board.length} คน`
  })

  await step('ผนังผลงานของเพื่อนมีของให้ดู', async () => {
    const res = await req('/api/me/showcase')
    must(res.status === 200, `ดึงผนังผลงานตอบ ${res.status}`)
    must(Number(res.json?.count) > 0, 'ผนังผลงานว่างเปล่า')
    return `${String(res.json?.count)} ชิ้น`
  })

  // ───── กวาดทุกหน้าเว็บ (ถือคุกกี้ทั้งครูและนักเรียนอยู่แล้ว จึงเห็นหน้าจริงไม่ใช่หน้าให้ล็อกอิน)

  const routes = discoverRoutes()
  console.log(`\nกวาดหน้าเว็บ ${routes.length} หน้า...`)
  const broken: string[] = []

  for (const route of routes) {
    const t0 = Date.now()
    let detail = ''
    let ok = false
    try {
      const res = await req(route)
      const text = visibleText(res.text)
      const marker = ERROR_MARKERS.find((m) => res.text.includes(m))
      if (res.status >= 400) {
        detail = `ตอบ ${res.status}`
      } else if (marker) {
        detail = `ตอบ 200 แต่เป็นหน้าพัง: ${marker}`
      } else if (text.length < MIN_VISIBLE_CHARS) {
        detail = `ตอบ ${res.status} แต่จอขาว (อ่านได้ ${text.length} ตัวอักษร)`
      } else {
        ok = true
        const redirected = new URL(res.url).pathname !== route
        detail = `${res.status} · ${text.length} ตัวอักษร${redirected ? ` · เด้งไป ${new URL(res.url).pathname}` : ''}`
      }
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error)
    }
    results.push({ name: `หน้า ${route}`, ok, ms: Date.now() - t0, detail })
    if (!ok) broken.push(`${route} — ${detail}`)
    process.stdout.write(ok ? '.' : 'X')
  }
  process.stdout.write('\n')

  await step('เก็บกวาดนักเรียนที่สคริปต์สร้าง', cleanup)

  report(startedAt)
  if (broken.length > 0) {
    console.log('\nหน้าที่พัง:')
    broken.forEach((b) => console.log(`  ${b}`))
  }
  if (results.some((r) => !r.ok)) process.exit(1)
}

function report(startedAt: number): void {
  const pass = results.filter((r) => r.ok).length
  const fail = results.length - pass
  console.log('')
  for (const r of results) {
    console.log(`${r.ok ? 'ผ่าน  ' : 'ไม่ผ่าน'} ${String(r.ms).padStart(5)} ms  ${r.name} — ${r.detail}`)
  }
  console.log(
    `\nสรุป: ผ่าน ${pass} · ไม่ผ่าน ${fail} · ใช้เวลารวม ${((Date.now() - startedAt) / 1000).toFixed(1)} วินาที`,
  )
}

main().catch(async (err: unknown) => {
  console.error('smoke-uat ล้มเหลวกลางทาง:', err)
  await cleanup().catch(() => undefined)
  process.exit(1)
})

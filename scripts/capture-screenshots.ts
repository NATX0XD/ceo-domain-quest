/**
 * เก็บภาพหน้าจอจริงสำหรับสไลด์นำเสนอ — **อ่านอย่างเดียว พิสูจน์ได้**
 *
 * รัน: `npx tsx scripts/capture-screenshots.ts`   (ต้องมี dev server พอร์ต 3000 เปิดอยู่)
 *      `npx tsx scripts/capture-screenshots.ts --room UAT777 --out docs/screenshots`
 *
 * ## ทำไมต้องมีสคริปต์ ไม่ถ่ายจอเอง
 *
 * ภาพบนสไลด์ต้องเป็นขนาดเดียวกันทุกใบ ถ่ายซ้ำได้เมื่อหน้าจอเปลี่ยน และ **ไม่มีแถบเบราว์เซอร์ปน**
 * ถ่ายมือจะได้ขนาดไม่เท่ากันและถ่ายใหม่ทีหลังไม่ตรงของเดิม
 *
 * ## กติกาเหล็ก: ห้ามแก้ข้อมูลในห้องที่ถ่าย
 *
 * ห้องที่ถ่ายคือห้องข้อมูลจริงที่ใช้สาธิต ถ้าสคริปต์นี้ไปเขียนอะไรลงไป ตัวเลขบนสไลด์กับของในห้องจะหลุดกัน
 * จึงกันไว้ 3 ชั้น:
 *  1. **ไม่ล็อกอินผ่าน API** — เซ็นคุกกี้จากแถวที่มีอยู่แล้วด้วยฟังก์ชันของโปรเจกต์เอง (`signStudentSession`)
 *     การล็อกอินจริงเป็น POST และอาจอัปเดตเวลาเข้าใช้ล่าสุด
 *  2. **บล็อกทุกคำขอที่ไม่ใช่ GET ในเบราว์เซอร์** ผ่าน CDP Fetch domain — หน้าไหนยิง POST เบื้องหลัง
 *     (เช่นแจ้งว่ายังออนไลน์อยู่) คำขอนั้นถูกปัดตกก่อนออกจากเบราว์เซอร์
 *  3. **ถ่ายลายนิ้วมือฐานข้อมูลก่อนและหลัง** แล้วเทียบ ถ้าต่างแม้แถวเดียวสคริปต์จะบอกว่าต่างตรงไหน
 *
 * ⚠️ **ไม่ถ่ายหน้า `/mission/[id]` จากห้องข้อมูลจริง** — หน้านั้นเขียนฐานข้อมูลตั้งแต่ตอนเรนเดอร์
 *    (`getOrCreateMissionProgress` สร้างแถวถ้ายังไม่มี และ `missionStoryFor` ฝากงานให้ AI แต่งเรื่อง)
 *    ชั้นที่ 2 กันไม่ได้เพราะเป็นการเขียนฝั่งเซิร์ฟเวอร์ ไม่ใช่คำขอจากเบราว์เซอร์
 *    ภาพหน้าภารกิจจึงถ่ายจากห้องสาธิตที่สร้างใหม่แล้วลบทิ้ง — ดู docs/screenshots/README.md
 */

import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getServiceClient } from '../lib/db/client'
import { STUDENT_COOKIE, TEACHER_COOKIE, signStudentSession, signTeacherSession } from '../lib/session'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

const BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9351
const PROFILE_DIR = '/tmp/dbq-capture-profile'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback
}

const ROOM = arg('room', 'UAT777')
const OUT_DIR = resolve(process.cwd(), arg('out', 'docs/screenshots'))

/** มือถือที่นักเรียนใช้จริง (ขนาดเดียวกับที่ใช้วัดโครงหน้าจอทั้งโปรเจกต์) */
const PHONE = { width: 390, height: 844, mobile: true, scale: 2 }
/** จอครูบนโน้ตบุ๊ก */
const LAPTOP = { width: 1280, height: 800, mobile: false, scale: 2 }
/** โปรเจกเตอร์ห้องเรียน */
const PROJECTOR = { width: 1280, height: 720, mobile: false, scale: 2 }

type Viewport = typeof PHONE

interface Shot {
  file: string
  route: string
  /** ชื่อเล่นของเจ้าของคุกกี้ · 'teacher' = ครู · null = ยังไม่ล็อกอิน */
  as: string | 'teacher' | null
  viewport: Viewport
  /** เลื่อนชั้นเนื้อหาลงกี่พิกเซลก่อนถ่าย (หน้าเดียวกันถ่ายได้หลายช่วง) */
  scroll?: number
  /** คำอธิบายสำหรับ README */
  caption: string
  /** ใช้กับสไลด์ใบไหน */
  slide: string
}

// ───────────────────────────── ลายนิ้วมือฐานข้อมูล (พิสูจน์ว่าไม่ได้เขียนอะไร)

/**
 * นับแถวและเวลาแก้ล่าสุดของทุกตารางที่ผูกกับห้องนี้
 * ถ้าการเปิดหน้าเว็บไปเขียนอะไรเข้า ตัวเลขชุดนี้จะขยับ
 */
async function fingerprint(studentIds: string[], classroomId: string) {
  const db = getServiceClient()
  const out: Record<string, string> = {}

  const byStudent = [
    'profiles',
    'progress',
    'mission_progress',
    'submissions',
    'events',
    'story_jobs',
    'route_changes',
  ] as const
  for (const table of byStudent) {
    const { data, error } = await db.from(table).select('*').in('student_id', studentIds)
    out[table] = error ? `อ่านไม่ได้: ${error.message}` : stamp(data ?? [])
  }

  const { data: students } = await db.from('students').select('*').eq('classroom_id', classroomId)
  out.students = stamp(students ?? [])
  const { data: sessions } = await db.from('class_sessions').select('*').eq('classroom_id', classroomId)
  out.class_sessions = stamp(sessions ?? [])

  return out
}

/** ย่อชุดแถวให้เป็นสตริงเดียว: จำนวนแถว + เวลาแก้ล่าสุด + ผลรวมของค่าที่ขยับบ่อย */
function stamp(rows: Record<string, unknown>[]): string {
  const times = rows
    .flatMap((r) => [r.updated_at, r.created_at, r.last_seen_at, r.passed_at])
    .filter((v): v is string => typeof v === 'string')
    .sort()
  const screens = rows
    .map((r) => (typeof r.current_screen === 'string' ? r.current_screen : ''))
    .join(',')
  return `${rows.length} แถว · ล่าสุด ${times.at(-1) ?? '—'} · จอ ${screens}`
}

// ───────────────────────────── CDP แบบไม่พึ่ง dependency

interface Cdp {
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>
  on(fn: (msg: Record<string, unknown>) => void): void
}

async function connect(): Promise<{ cdp: Cdp; kill: () => void }> {
  rmSync(PROFILE_DIR, { recursive: true, force: true })
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank',
  ])
  chrome.stderr.on('data', () => {})

  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break
    } catch {
      // ยังไม่เปิดพอร์ต รอรอบถัดไป
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  const ver = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()) as {
    webSocketDebuggerUrl: string
  }
  const ws = new WebSocket(ver.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))

  let id = 0
  const pending = new Map<number, (v: Record<string, unknown>) => void>()
  const listeners: ((msg: Record<string, unknown>) => void)[] = []
  let sessionId: string | undefined

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data)) as Record<string, unknown>
    const msgId = msg.id as number | undefined
    if (msgId && pending.has(msgId)) {
      pending.get(msgId)?.((msg.result ?? {}) as Record<string, unknown>)
      pending.delete(msgId)
    } else if (msg.method) {
      for (const fn of listeners) fn(msg)
    }
  })

  const raw: Cdp = {
    send(method, params = {}) {
      const i = ++id
      ws.send(JSON.stringify({ id: i, sessionId, method, params }))
      return new Promise((r) => pending.set(i, r))
    },
    on(fn) {
      listeners.push(fn)
    },
  }

  const { targetId } = (await raw.send('Target.createTarget', { url: 'about:blank' })) as {
    targetId: string
  }
  const attached = (await raw.send('Target.attachToTarget', { targetId, flatten: true })) as {
    sessionId: string
  }
  sessionId = attached.sessionId

  await raw.send('Page.enable')
  await raw.send('Network.enable')

  /**
   * ชั้นที่ 2 ของการกันเขียน — ปัดตกทุกคำขอที่ไม่ใช่ GET
   * หน้าไหนยิง POST เบื้องหลัง (แจ้งว่ายังออนไลน์ · บันทึกเหตุการณ์) คำขอนั้นไม่ได้ออกจากเบราว์เซอร์
   */
  await raw.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  raw.on((msg) => {
    if (msg.method !== 'Fetch.requestPaused') return
    const p = msg.params as { requestId: string; request: { method: string; url: string } }
    if (p.request.method === 'GET') {
      void raw.send('Fetch.continueRequest', { requestId: p.requestId })
    } else {
      blocked.push(`${p.request.method} ${p.request.url.replace(BASE_URL, '')}`)
      void raw.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' })
    }
  })

  return { cdp: raw, kill: () => chrome.kill() }
}

const blocked: string[] = []

// ───────────────────────────── ตัวเก็บภาพ

async function main() {
  const db = getServiceClient()

  const { data: classrooms } = await db.from('classrooms').select('*').eq('room_code', ROOM).limit(1)
  const classroom = classrooms?.[0]
  if (!classroom) throw new Error(`ไม่พบห้อง ${ROOM} — รัน npm run seed:uat ก่อน`)

  const { data: students } = await db
    .from('students')
    .select('id, nickname')
    .eq('classroom_id', classroom.id)
  if (!students || students.length === 0) throw new Error(`ห้อง ${ROOM} ยังไม่มีนักเรียน`)

  const idOf = new Map(students.map((s) => [s.nickname, s.id]))
  const cookies = new Map<string, string>()
  for (const s of students) {
    const token = await signStudentSession({ studentId: s.id, classroomId: classroom.id })
    cookies.set(s.nickname, `${STUDENT_COOKIE}=${token}`)
  }
  const teacherToken = await signTeacherSession({ teacherId: classroom.teacher_id })
  cookies.set('teacher', `${TEACHER_COOKIE}=${teacherToken}`)

  /** คนที่เดินครบวงที่สุดในห้อง — ใช้เป็นตัวเอกของภาพฝั่งนักเรียน */
  const HERO = pickHero(students.map((s) => s.nickname))
  /** คนที่ยังไม่ส่งด่านบอส — ใช้ถ่ายฟอร์มด่านบอสตอนยังไม่ส่ง */
  const NOT_SUBMITTED = students.find((s) => s.nickname === 'ปูเป้')?.nickname ?? HERO

  const shots: Shot[] = [
    { file: 'student-01-join.png', route: '/join', as: null, viewport: PHONE,
      caption: 'หน้าเข้าห้องเรียน ใส่รหัสห้อง 6 ตัวกับรหัส 4 หลัก', slide: 'สไลด์ 4 ขั้น 1 · สไลด์ 5 (แผนสำรองชั้น C)' },
    { file: 'student-02-intro.png', route: '/intro', as: HERO, viewport: PHONE,
      caption: 'การ์ดแนะนำวิธีใช้ ข้ามได้', slide: 'สไลด์ 4 ขั้น 1' },
    { file: 'student-03-setup.png', route: '/setup', as: HERO, viewport: PHONE,
      caption: 'ร้านของฉัน 3 คำถาม (ขั้นวิเคราะห์ผู้เรียน)', slide: 'สไลด์ 4 ขั้น 1 · สไลด์ 5 วินาทีที่ 0-15' },
    { file: 'student-04-check.png', route: '/check', as: HERO, viewport: PHONE,
      caption: 'เช็กความเข้าใจ 4 ข้อ — ไม่เก็บคะแนน ใช้เสนอระดับตัวช่วย', slide: 'สไลด์ 4 ขั้น 1' },
    { file: 'student-05-pretest.png', route: '/pretest', as: HERO, viewport: PHONE,
      caption: 'แบบทดสอบก่อนเรียน 10 ข้อ', slide: 'สไลด์ 4 ขั้น 1 · สไลด์ 6 ชั้น ก' },
    { file: 'student-06-profile.png', route: '/profile', as: HERO, viewport: PHONE,
      caption: 'เลือกเส้นทางการเรียน — ระบบเสนอ ผู้เรียนกดเลือกเอง', slide: 'สไลด์ 4 ขั้น 2 · สไลด์ 5 วินาทีที่ 15-55' },
    { file: 'student-07-map.png', route: '/map', as: HERO, viewport: PHONE,
      caption: 'แผนภารกิจทั้งคาบ', slide: 'สไลด์ 4 ขั้น 3' },
    { file: 'student-08-ceo-form.png', route: '/ceo', as: NOT_SUBMITTED, viewport: PHONE,
      caption: 'ด่านบอส — เลือกวิธีส่งงานและเลือกด้านที่ให้ครูประเมินหนัก (ยังไม่ส่ง)', slide: 'สไลด์ 4 ขั้น 5' },
    { file: 'student-09-ceo-status.png', route: '/ceo', as: HERO, viewport: PHONE,
      caption: 'ด่านบอสหลังส่งงาน — แถบสถานะการตรวจ', slide: 'สไลด์ 4 ขั้น 5' },
    { file: 'student-10-result-top.png', route: '/result', as: HERO, viewport: PHONE,
      caption: 'หน้าสรุปผล — ดาวที่เก็บได้กับด้านที่ครูยืนยัน เห็นโดยไม่ต้องเลื่อน', slide: 'สไลด์ 4 ขั้น 5 · สไลด์ 6' },
    { file: 'student-11-result-certificate.png', route: '/result', as: HERO, viewport: PHONE, scroll: 520,
      caption: 'เกียรติบัตรบนหน้าจอ ออกให้เมื่อครูยืนยันครบ 4 ด้าน', slide: 'สไลด์ 4 ขั้น 5' },
    { file: 'student-12-result-selfassess.png', route: '/result', as: HERO, viewport: PHONE, scroll: 2200,
      caption: 'ส่วนคะแนน 3 แหล่งบนหน้าสรุปผล (สภาพจริงในห้อง UAT777 ดูหมายเหตุ)', slide: 'สไลด์ 4 ขั้น 5' },
    { file: 'student-13-home-shop.png', route: '/home', as: HERO, viewport: PHONE,
      caption: 'หน้าหลัก — ร้านโตตามด่านที่ผ่านจริง (ภาพ 6 ขั้น)', slide: 'สไลด์ 5 วินาทีที่ 75-90' },
    { file: 'student-14-showcase.png', route: '/showcase', as: HERO, viewport: PHONE,
      caption: 'ผนังผลงานของห้อง — ไม่มีดาวและไม่มีคะแนนของใคร', slide: 'สไลด์ 4 ขั้น 5' },
    { file: 'student-15-reflect.png', route: '/reflect', as: HERO, viewport: PHONE,
      caption: 'ทบทวนตัวเองหลังจบภารกิจ', slide: 'สไลด์ 4 ขั้น 5' },

    { file: 'teacher-01-live-panel.png', route: '/teacher', as: 'teacher', viewport: LAPTOP,
      caption: 'แผงห้องเรียนสด — นับสดทุก 3 วินาที มีธงควรคุย/ควรชม', slide: 'สไลด์ 8' },
    { file: 'teacher-02-class-report.png', route: '/teacher/report', as: 'teacher', viewport: LAPTOP,
      caption: 'รายงานรายห้อง — E1/E2 · ค่าที · ขนาดอิทธิพล · จุดประสงค์ที่ห้องอ่อนสุด', slide: 'สไลด์ 6 ชั้น ข · สไลด์ 8' },
    { file: 'teacher-03-class-report-stats.png', route: '/teacher/report', as: 'teacher', viewport: LAPTOP, scroll: 700,
      caption: 'รายงานรายห้อง ช่วงสถิติก่อน-หลังเรียนและร้อยละความตรงกัน', slide: 'สไลด์ 6 ชั้น ข' },
    { file: 'teacher-05-board.png', route: '/board', as: 'teacher', viewport: PROJECTOR,
      caption: 'จอหน้าห้องบนโปรเจกเตอร์ — เปลี่ยนตามช่วงของคาบเอง', slide: 'สไลด์ 8' },
  ]

  const heroId = idOf.get(HERO)
  if (heroId) {
    shots.push({
      file: 'teacher-04-student-report.png',
      route: `/teacher/student?studentId=${heroId}`,
      as: 'teacher',
      viewport: LAPTOP,
      caption: 'รายงานรายคน — ร่องรอยปรับเหมาะ "ระบบเสนอ X แต่เลือก Y เอง"',
      slide: 'สไลด์ 6 ชั้น ข · สไลด์ 8',
    })
  }

  mkdirSync(OUT_DIR, { recursive: true })

  const studentIds = students.map((s) => s.id)
  console.log(`ห้อง ${ROOM} · นักเรียน ${students.length} คน · ตัวเอกของภาพคือ ${HERO}`)
  const before = await fingerprint(studentIds, classroom.id)

  const { cdp, kill } = await connect()
  const results: (Shot & { ok: boolean; note: string })[] = []

  try {
    for (const shot of shots) {
      await cdp.send('Network.clearBrowserCookies')
      if (shot.as) {
        const cookie = cookies.get(shot.as)
        if (!cookie) throw new Error(`ไม่มีคุกกี้ของ ${shot.as}`)
        const eq = cookie.indexOf('=')
        await cdp.send('Network.setCookie', {
          name: cookie.slice(0, eq),
          value: cookie.slice(eq + 1),
          domain: 'localhost',
          path: '/',
        })
      }
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shot.viewport.width,
        height: shot.viewport.height,
        deviceScaleFactor: shot.viewport.scale,
        mobile: shot.viewport.mobile,
      })

      const loaded = new Promise<void>((r) => {
        cdp.on((m) => {
          if (m.method === 'Page.loadEventFired') r()
        })
        setTimeout(r, 25000)
      })
      await cdp.send('Page.navigate', { url: `${BASE_URL}${shot.route}` })
      await loaded
      await new Promise((r) => setTimeout(r, 3200))

      if (shot.scroll) {
        await cdp.send('Runtime.evaluate', {
          expression: `document.querySelector('[data-app-shell-main]')?.scrollTo(0, ${shot.scroll})`,
          returnByValue: true,
        })
        await new Promise((r) => setTimeout(r, 600))
      }

      const health = (await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const body = document.body
          const text = (body.innerText || '').trim()
          const de = document.scrollingElement
          return {
            chars: text.length,
            title: document.title,
            pageScrolls: de.scrollHeight > de.clientHeight + 1,
            sideScrolls: de.scrollWidth > de.clientWidth + 1,
            hasShell: !!document.querySelector('[data-app-shell]'),
          }
        })()`,
        returnByValue: true,
      })) as { result?: { value?: { chars: number; title: string; pageScrolls: boolean; sideScrolls: boolean; hasShell: boolean } } }
      const h = health.result?.value

      const png = (await cdp.send('Page.captureScreenshot', { format: 'png' })) as { data: string }
      writeFileSync(resolve(OUT_DIR, shot.file), Buffer.from(png.data, 'base64'))

      const problems: string[] = []
      if (!h || h.chars < 40) problems.push('จอเกือบว่าง')
      if (h?.pageScrolls) problems.push('ทั้งหน้าเลื่อนได้')
      if (h?.sideScrolls) problems.push('เลื่อนแนวนอนได้')
      results.push({ ...shot, ok: problems.length === 0, note: problems.join(' · ') || `${h?.chars ?? 0} ตัวอักษร` })
      console.log(`${problems.length === 0 ? 'เก็บภาพ' : '**ผิดปกติ**'} ${shot.file}  ${problems.join(' · ')}`)
    }
  } finally {
    kill()
  }

  const after = await fingerprint(studentIds, classroom.id)
  const changed = Object.keys(before).filter((k) => before[k] !== after[k])

  console.log(`\nคำขอที่ไม่ใช่ GET ถูกปัดตก ${blocked.length} ครั้ง`)
  for (const b of [...new Set(blocked)]) console.log(`  ${b}`)
  if (changed.length === 0) {
    console.log(`\nฐานข้อมูลห้อง ${ROOM} ไม่เปลี่ยนแม้แถวเดียว (เทียบ ${Object.keys(before).length} ตาราง)`)
  } else {
    console.log(`\n**ฐานข้อมูลเปลี่ยน** ${changed.join(', ')}`)
    for (const k of changed) console.log(`  ${k}\n    ก่อน ${before[k]}\n    หลัง ${after[k]}`)
  }

  writeFileSync(
    resolve(OUT_DIR, 'manifest.json'),
    JSON.stringify({ room: ROOM, hero: HERO, shots: results, blocked: [...new Set(blocked)], dbChanged: changed }, null, 1),
  )
  console.log(`\nเขียน ${results.length} ภาพ + manifest.json ลง ${OUT_DIR}`)
  process.exit(results.every((r) => r.ok) && changed.length === 0 ? 0 : 1)
}

/** เลือกคนที่เดินครบวงที่สุด — ชื่อที่รู้จักก่อน ถ้าไม่มีก็คนแรกของห้อง */
function pickHero(nicknames: string[]): string {
  return nicknames.find((n) => n === 'อาร์ม') ?? (nicknames[0] as string)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

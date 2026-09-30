/**
 * ตรวจว่า "เฉลย" กับ "ของลับ" ไม่หลุดถึงเบราว์เซอร์ (UAT-3)
 *
 * รัน: npx tsx scripts/check-leaks.ts        (ต้องมี dev server พอร์ต 3000 + npm run seed:uat)
 *
 * ต่างจาก scripts/check-deploy.ts ที่สแกนไฟล์ในโปรเจกต์ — ตัวนี้ตรวจ **ของที่ส่งออกไปจริง**
 *  1. ไฟล์ทุกไฟล์ใน .next (bundle ที่เบราว์เซอร์โหลดได้)
 *  2. HTML ของทุกหน้า + ไฟล์ .js ทุกก้อนที่หน้านั้นอ้างถึง (ดึงมาทั้งก้อนแล้วค้นจริง)
 *  3. payload ของทุก API ที่นักเรียนเรียกได้ ทั้ง GET และ POST ที่ตรวจคำตอบ
 *  4. ไฟล์ที่จะถูกส่งให้กรรมการ (docs/ · postman/ · README)
 *
 * ⚠️ **ห้ามพิมพ์ค่าของลับออกจอ** สคริปต์นี้รายงานแค่ "เจอ/ไม่เจอ" กับ "ที่ไหน" และความยาว
 *    ค่าที่ใช้ค้นถูกอ่านจาก .env.local ใส่ไว้ในหน่วยความจำ ไม่เคยถูกพิมพ์
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

const BASE = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const ROOM_CODE = 'UAT777'
const ROOT = process.cwd()

type Finding = { kind: 'เฉลย' | 'ของลับ'; label: string; where: string }
const findings: Finding[] = []
const lines: string[] = []

function say(text: string): void {
  lines.push(text)
  console.log(text)
}

function report(ok: boolean, name: string, detail: string): void {
  say(`${ok ? '  ผ่าน  ' : '  พบ!   '} ${name} — ${detail}`)
}

// ───────────────────────────── ลายนิ้วมือของเฉลย

type Fingerprint = { label: string; needle: string }

/** ดึงข้อความยาวจากไฟล์เฉลยมาเป็นลายนิ้วมือ — ข้ามคีย์ที่ขึ้นต้นด้วย _ (คอมเมนต์ในไฟล์เนื้อหา) */
function answerFingerprints(): Fingerprint[] {
  const out: Fingerprint[] = []
  const files = readdirSync(join(ROOT, 'content')).filter((f) => f.includes('answers') && f.endsWith('.json'))

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(ROOT, 'content', file), 'utf8')) as unknown
    const texts: string[] = []
    const walk = (value: unknown): void => {
      if (typeof value === 'string') {
        if (value.length >= 45) texts.push(value)
        return
      }
      if (Array.isArray(value)) {
        value.forEach(walk)
        return
      }
      if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          if (k.startsWith('_')) continue
          if (PUBLIC_TEXT_KEYS.has(k)) continue
          walk(v)
        }
      }
    }
    walk(raw)

    // เอาช่วงกลางประโยคมาใช้ค้น กันชนกับข้อความในไฟล์โจทย์ที่อาจขึ้นต้นเหมือนกัน
    const picks = texts.slice(0, 6).map((t) => t.slice(15, 60).trim()).filter((t) => t.length >= 25)
    if (picks.length === 0) {
      say(`  (ข้าม ${file} — ไม่มีข้อความยาวพอจะใช้เป็นลายนิ้วมือ)`)
      continue
    }
    picks.forEach((needle, i) => out.push({ label: `${file} #${i + 1}`, needle }))
  }
  return out
}

/**
 * คีย์ที่ **เป็นความลับจริง** ในไฟล์เฉลย ถ้าโผล่ในของที่ส่งออกไปคือช่องโหว่
 * (ห้ามใส่ explanation / choiceFeedback / hintWhenMissing — พวกนั้นถูกส่งให้ผู้เรียนอ่านหลังตอบโดยตั้งใจ)
 */
const ANSWER_KEYS = [
  'answerIndex',
  'answerIndexes',
  'starCriteria',
  'gameKey',
  'correctIndex',
  'correctOrder',
  'acceptedAnswers',
  'acceptedSelections',
  'groupAnswers',
  'groupKey',
  'pairKey',
  'sampleAnswer',
]

/**
 * ฟิลด์ข้อความที่ **ตั้งใจให้ผู้เรียนเห็น** หลังตอบแล้ว (route คืนกลับไปเอง)
 * ห้ามเอามาทำลายนิ้วมือ ไม่งั้นจะฟ้องผิดว่า "เฉลยหลุด" ทั้งที่เป็นคำอธิบายที่ควรโชว์
 */
const PUBLIC_TEXT_KEYS = new Set([
  'explanation',
  'choiceFeedback',
  'correctFeedback',
  'wrongFeedback',
  'wrongPairFeedback',
  'wrongPlacementFeedback',
  'hintWhenMissing',
  'acceptNote',
  'normalizeNote',
  'orderNote',
  'why',
  'text',
])

// ───────────────────────────── ของลับ (ไม่พิมพ์ค่า)

type Secret = { name: string; value: string }

function secretsFromEnv(): Secret[] {
  const names = [
    'TYPHOON_API_KEY',
    'GEMINI_API_KEY',
    'SESSION_SECRET',
    'GRADE_WORKER_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
  ]
  const out: Secret[] = []
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value && value.length >= 12) out.push({ name, value })
  }
  return out
}

// ───────────────────────────── ไล่ไฟล์

function walkFiles(dir: string, skip: (name: string) => boolean = () => false): string[] {
  const out: string[] = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (skip(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(full, skip))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

function isTextFile(path: string): boolean {
  try {
    return statSync(path).size < 12 * 1024 * 1024
  } catch {
    return false
  }
}

/**
 * เอกสาร **ต้นทาง** ของเฉลย — เฉลยในไฟล์เนื้อหาถูกคัดมาจากที่นี่ตั้งแต่แรก
 *
 * เป้าของสคริปต์นี้คือ "เฉลยต้องไม่หลุดถึงเบราว์เซอร์" ไม่ใช่ "เฉลยต้องห้ามมีอยู่ในเอกสารของทีม"
 * ไฟล์ `.md` พวกนี้ไม่ถูกเสิร์ฟผ่านเว็บ (UAT-3 ยืนยัน bundle เบราว์เซอร์มีเฉลย 0 จุด)
 * ถ้าไม่ยกเว้น สคริปต์จะแดงถาวรจนใช้เป็นด่านก่อนส่งมอบไม่ได้
 *
 * ⚠️ ยกเว้น **เฉพาะการตรวจเนื้อเฉลย** เท่านั้น — ของลับยังตรวจทุกไฟล์ ไม่มีข้อยกเว้น
 * ⚠️ การยกเว้นต้องไม่เงียบ ทุกครั้งที่ข้ามต้องพิมพ์เตือนว่าข้ามไฟล์ไหนไปกี่ไฟล์
 */
const ANSWER_SOURCE_DOCS = new Set(['CEO_Domain_Quest_Feature_Spec.md'])

function scanFiles(label: string, files: string[], fps: Fingerprint[], secrets: Secret[]): void {
  let answerHits = 0
  let keyHits = 0
  const answerWhere: string[] = []
  const secretWhere: string[] = []
  const skippedSources: string[] = []

  for (const file of files) {
    if (!isTextFile(file)) continue
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const rel = relative(ROOT, file)
    // เอกสารต้นทาง: ข้ามเฉพาะเนื้อเฉลย แต่ยังไล่ของลับต่อข้างล่างเหมือนไฟล์อื่น
    const isAnswerSource = ANSWER_SOURCE_DOCS.has(rel)
    if (isAnswerSource) skippedSources.push(rel)

    for (const fp of isAnswerSource ? [] : fps) {
      if (text.includes(fp.needle)) {
        answerHits += 1
        answerWhere.push(`${rel} ← ${fp.label}`)
        findings.push({ kind: 'เฉลย', label: fp.label, where: rel })
      }
    }
    for (const key of isAnswerSource ? [] : ANSWER_KEYS) {
      if (text.includes(`"${key}"`) || text.includes(`${key}:`)) {
        keyHits += 1
        answerWhere.push(`${rel} ← มีคีย์ ${key}`)
      }
    }
    for (const s of secrets) {
      if (text.includes(s.value)) {
        secretWhere.push(`${rel} ← ${s.name} (ยาว ${s.value.length})`)
        findings.push({ kind: 'ของลับ', label: s.name, where: rel })
      }
    }
  }

  report(
    answerHits === 0,
    `${label} · เนื้อเฉลย`,
    answerHits === 0
      ? `สแกน ${files.length} ไฟล์ ไม่พบเนื้อเฉลย`
      : `พบ ${answerHits} จุด: ${[...new Set(answerWhere)].slice(0, 6).join(' · ')}`,
  )
  if (skippedSources.length > 0) {
    const list = [...new Set(skippedSources)]
    say(`  ⚠️ ข้ามการตรวจเนื้อเฉลยในเอกสารต้นทาง ${list.length} ไฟล์: ${list.join(' · ')}`)
    say('     เอกสารพวกนี้เป็นที่มาของเฉลย จึงมีเฉลยอยู่ในตัวเป็นเรื่องปกติ และไม่ถูกเสิร์ฟผ่านเว็บ')
    say('     ⚠️ ห้ามส่งไฟล์สเปกให้นักเรียนหรือเผยแพร่คู่กับลิงก์ห้องเรียนเด็ดขาด')
    say('     (ของลับยังถูกตรวจในไฟล์เหล่านี้ตามปกติ ไม่ได้ข้ามไปด้วย)')
  }
  if (keyHits > 0) {
    say(`  (หมายเหตุ ${label}: เจอชื่อคีย์แบบเฉลย ${keyHits} จุด — ${[...new Set(answerWhere.filter((w) => w.includes('มีคีย์')))].slice(0, 4).join(' · ')})`)
  }
  report(
    secretWhere.length === 0,
    `${label} · ของลับ`,
    secretWhere.length === 0 ? 'ไม่พบค่าคีย์/ความลับ' : `พบ: ${[...new Set(secretWhere)].join(' · ')}`,
  )
}

// ───────────────────────────── ยิงของจริง

const jar = new Map<string, string>()

async function req(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(jar.size > 0 ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  for (const raw of res.headers.getSetCookie()) {
    const pair = raw.split(';')[0] ?? ''
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1))
  }
  return { status: res.status, text: await res.text() }
}

function scanPayload(label: string, text: string, fps: Fingerprint[], secrets: Secret[]): boolean {
  let clean = true
  for (const fp of fps) {
    if (text.includes(fp.needle)) {
      findings.push({ kind: 'เฉลย', label: fp.label, where: label })
      say(`  พบ!    ${label} มีเนื้อเฉลย ← ${fp.label}`)
      clean = false
    }
  }
  for (const s of secrets) {
    if (text.includes(s.value)) {
      findings.push({ kind: 'ของลับ', label: s.name, where: label })
      say(`  พบ!    ${label} มีค่า ${s.name} (ยาว ${s.value.length})`)
      clean = false
    }
  }
  return clean
}

function discoverRoutes(): string[] {
  const out: string[] = []
  const walk = (dir: string, seg: string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'api' || entry.name.startsWith('_')) continue
        const group = entry.name.startsWith('(') && entry.name.endsWith(')')
        walk(join(dir, entry.name), group ? seg : [...seg, entry.name])
        continue
      }
      if (entry.name !== 'page.tsx') continue
      out.push(`/${seg.map((s) => s.replace(/^\[\.*(.+)\]$/, 'm1')).join('/')}`.replace(/\/+$/, '') || '/')
    }
  }
  walk(join(ROOT, 'app'), [])
  return [...new Set(out)].sort()
}

async function main(): Promise<void> {
  const fps = answerFingerprints()
  const secrets = secretsFromEnv()
  say(`ลายนิ้วมือเฉลย ${fps.length} ก้อน · ของลับที่เฝ้า ${secrets.length} ตัว (${secrets.map((s) => s.name).join(', ')})`)
  say(`ปลายทาง ${BASE}\n`)

  /**
   * ── 1) ไฟล์ใน .next แยกสองกอง อย่ารวมกัน ไม่งั้นอ่านผลไม่ออก
   *
   * `.next/static` + `.next/dev/static` = **เบราว์เซอร์โหลดได้** (เสิร์ฟใต้ /_next/static)
   *   → เจอเนื้อเฉลยที่นี่คือช่องโหว่จริง
   * `.next/server` + `.next/dev/server`  = โค้ดฝั่งเซิร์ฟเวอร์ ไม่มี route ไหนเสิร์ฟออกไป (ยืนยันแล้วได้ 404)
   *   → **ต้องมีเฉลย** ไม่งั้นตรวจคำตอบไม่ได้ · แต่ค่าของลับห้ามถูกฝังไว้
   */
  say('1) ไฟล์ที่เบราว์เซอร์โหลดได้ (.next/static + .next/dev/static)')
  scanFiles(
    'bundle ฝั่งเบราว์เซอร์',
    [...walkFiles(join(ROOT, '.next', 'static')), ...walkFiles(join(ROOT, '.next', 'dev', 'static'))],
    fps,
    secrets,
  )

  say('\n1b) ไฟล์ฝั่งเซิร์ฟเวอร์ (.next/server + .next/dev/server) — เฉลยอยู่ที่นี่ได้ ของลับห้ามค้าง')
  const serverFiles = [
    ...walkFiles(join(ROOT, '.next', 'server')),
    ...walkFiles(join(ROOT, '.next', 'dev', 'server')),
  ]
  const serverSecretWhere: string[] = []
  for (const file of serverFiles) {
    if (!isTextFile(file)) continue
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const sec of secrets) {
      if (text.includes(sec.value)) {
        serverSecretWhere.push(`${relative(ROOT, file)} ← ${sec.name} (ยาว ${sec.value.length})`)
        findings.push({ kind: 'ของลับ', label: sec.name, where: relative(ROOT, file) })
      }
    }
  }
  report(
    serverSecretWhere.length === 0,
    'ฝั่งเซิร์ฟเวอร์ · ของลับ',
    serverSecretWhere.length === 0
      ? `สแกน ${serverFiles.length} ไฟล์ ไม่พบค่าคีย์ฝังไว้ (อ่านจาก process.env ตอนรันเท่านั้น)`
      : `พบ: ${[...new Set(serverSecretWhere)].join(' · ')}`,
  )

  // ── 2) ไฟล์ที่จะส่งให้กรรมการ
  say('\n2) ไฟล์ที่ส่งให้กรรมการ')
  const judgeFiles = [
    ...walkFiles(join(ROOT, 'docs')),
    ...walkFiles(join(ROOT, 'postman')),
    join(ROOT, 'README.md'),
    join(ROOT, 'CEO_Domain_Quest_Feature_Spec.md'),
  ]
  scanFiles('docs/ + postman/ + README', judgeFiles, fps, secrets)

  // ── 3) HTML ของทุกหน้า + ไฟล์ .js ที่หน้านั้นอ้าง
  say('\n3) HTML ที่เสิร์ฟจริง + ไฟล์ .js ทุกก้อนที่หน้านั้นอ้างถึง')
  const join1 = await req('/api/join', {
    method: 'POST',
    body: { roomCode: ROOM_CODE, nickname: 'ตรวจรอยรั่ว', pin: '2580' },
  })
  say(`  เข้าห้องเป็นนักเรียน: ${join1.status}`)
  await req('/api/profile', {
    method: 'POST',
    body: { shopName: 'ร้านตรวจรอยรั่ว', businessTypeId: 'coffee', domainName: 'leakcheck', isRegisteredCompany: false, audience: 'thai' },
  })

  const routes = discoverRoutes()
  const chunkUrls = new Set<string>()
  let htmlClean = true
  for (const route of routes) {
    const res = await req(route)
    if (!scanPayload(`HTML ${route}`, res.text, fps, secrets)) htmlClean = false
    for (const m of res.text.matchAll(/(?:src|href)="(\/_next\/[^"]+?\.js)"/g)) chunkUrls.add(m[1]!)
    for (const m of res.text.matchAll(/"(\/_next\/static\/[^"]+?\.js)"/g)) chunkUrls.add(m[1]!)
  }
  report(htmlClean, `HTML ${routes.length} หน้า`, htmlClean ? 'ไม่พบเฉลยหรือของลับ' : 'ดูบรรทัด "พบ!" ข้างบน')

  let chunkClean = true
  for (const url of chunkUrls) {
    const res = await req(url)
    if (res.status !== 200) continue
    if (!scanPayload(`chunk ${url}`, res.text, fps, secrets)) chunkClean = false
  }
  report(chunkClean, `ไฟล์ .js ${chunkUrls.size} ก้อนที่หน้าเว็บอ้างถึง`, chunkClean ? 'ไม่พบเฉลยหรือของลับ' : 'ดูบรรทัด "พบ!" ข้างบน')

  // ── 4) payload ของ API ที่นักเรียนเรียกได้
  say('\n4) payload ของ API ที่นักเรียนเรียกได้')
  const studentGets = [
    '/api/me',
    '/api/me/showcase',
    '/api/session',
    '/api/pretest',
    '/api/posttest',
    '/api/check',
    '/api/profile',
    '/api/ceo',
    '/api/reflect',
    '/api/survey',
    '/api/story',
    '/api/plan-request',
    '/api/buddy',
    '/api/mission/m1/story',
    '/api/mission/m2/story',
    '/api/mission/m3/story',
    '/api/mission/m4/story',
  ]
  let apiClean = true
  for (const path of studentGets) {
    const res = await req(path)
    if (!scanPayload(`GET ${path} (${res.status})`, res.text, fps, secrets)) apiClean = false
  }

  /** ตอบผิดแล้ว payload ต้องไม่บอกเฉลย และต้องไม่แนบชุดคำตอบทั้งชุดมา */
  const wrongAnswerPosts: Array<{ path: string; body: unknown }> = [
    { path: '/api/mission/m1/check', body: { checkId: 'm1-check', choiceIndex: 3, channel: 'clip', confidence: 2 } },
    { path: '/api/mission/m2/check', body: { checkId: 'm2-check', choiceIndex: 3, channel: 'clip', confidence: 2 } },
    { path: '/api/mission/m3/check', body: { checkId: 'm3-check', choiceIndex: 3, channel: 'clip', confidence: 2 } },
    { path: '/api/mission/m4/check', body: { checkId: 'm4-check', choiceIndex: 3, channel: 'clip', confidence: 2 } },
    { path: '/api/hint', body: { missionId: 'm1' } },
  ]
  for (const item of wrongAnswerPosts) {
    const res = await req(item.path, { method: 'POST', body: item.body })
    if (!scanPayload(`POST ${item.path} (${res.status})`, res.text, fps, secrets)) apiClean = false
  }
  report(apiClean, `API ${studentGets.length + wrongAnswerPosts.length} เส้น`, apiClean ? 'ไม่พบเฉลยหรือของลับใน payload' : 'ดูบรรทัด "พบ!" ข้างบน')

  // ── สรุป
  say('\n══════ สรุป ══════')
  const answerLeaks = findings.filter((f) => f.kind === 'เฉลย')
  const secretLeaks = findings.filter((f) => f.kind === 'ของลับ')
  say(`เฉลยหลุด ${answerLeaks.length} จุด · ของลับหลุด ${secretLeaks.length} จุด`)
  for (const f of findings) say(`  [${f.kind}] ${f.label} → ${f.where}`)
  if (findings.length === 0) say('  สะอาดทั้งหมด')

  if (findings.length > 0) process.exitCode = 1
}

main().catch((err: unknown) => {
  console.error('check-leaks ล้มเหลว:', err)
  process.exit(1)
})

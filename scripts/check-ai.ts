/**
 * ยิงเส้นทาง AI จริงด้วยคีย์ใน .env.local — **รันมือเท่านั้น ไม่ได้อยู่ในชุดเทสต์**
 *
 *   npx tsx scripts/check-ai.ts            ยิงทั้ง Typhoon และ Gemini
 *   npx tsx scripts/check-ai.ts models     แค่ถามว่าคีย์นี้เรียกโมเดลไหนได้บ้าง
 *
 * ชุดเทสต์อัตโนมัติ (lib/ai/ai.test.ts) ยังใช้ fetch ปลอมเสมอ ห้ามยิงเน็ตจริงในเทสต์
 * เพราะจะช้า พัง และเปลืองโควตาเวลารันใน CI
 *
 * ⚠️ สคริปต์นี้ห้ามพิมพ์ค่าคีย์ออกมาไม่ว่ากรณีใด พิมพ์ได้แค่ความยาวและ 4 ตัวแรก
 */
import { readFileSync } from 'node:fs'
import { createAiClient, resetAiQuota } from '../lib/ai'
import { GEMINI_BASE_URL, GEMINI_DEFAULT_MODEL } from '../lib/ai/gemini'
import { TYPHOON_DEFAULT_MODEL } from '../lib/ai/typhoon'

/** อ่าน .env.local เอง เพราะสคริปต์นี้รันนอก Next ที่โหลด env ให้ */
function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) env[match[1]!] = match[2]!.trim().replace(/^["']|["']$/g, '')
  }
  return env
}

/** บอกแค่ว่ามีคีย์และยาวเท่าไหร่ — ห้ามพิมพ์ค่าคีย์ แม้แต่บางส่วน (กฎของโปรเจกต์) */
function keyFingerprint(value: string | undefined): string {
  if (!value) return 'ไม่พบคีย์'
  return `มีคีย์ ยาว ${value.length} ตัว`
}

const env = loadEnvLocal()

const SAMPLE_WORK = {
  tldId: 'in-th',
  domainName: 'kanomwan',
  shopName: 'ขนมหวานบ้านยาย',
  businessTypeId: 'bakery',
  reasonText:
    'เลือก .in.th เพราะลูกค้าของร้านขนมเป็นคนไทยในย่านเดียวกัน และร้านยังไม่ได้จดทะเบียนบริษัท ใช้บัตรประชาชนยื่นได้',
  emphasisCriterion: 'emphasis-naming',
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = process.hrtime.bigint()
  const result = await run()
  const ms = Number(process.hrtime.bigint() - start) / 1_000_000
  console.log(`  ${label}: ${Math.round(ms)} ms`)
  return { result, ms }
}

/** ถามว่าคีย์นี้เรียกโมเดลไหนได้บ้าง ใช้ตอนสงสัยว่ารุ่นที่ตั้งไว้ถูกปลดระวางหรือยัง */
async function listGeminiModels(): Promise<void> {
  const key = env.GEMINI_API_KEY
  if (!key) return console.log('ไม่มี GEMINI_API_KEY')
  const res = await fetch(`${GEMINI_BASE_URL}/models`, { headers: { 'x-goog-api-key': key } })
  if (!res.ok) return console.log(`ListModels ไม่ผ่าน สถานะ ${res.status}`)
  const data = (await res.json()) as { models?: Array<{ name?: string }> }
  const names = (data.models ?? []).map((m) => m.name?.replace('models/', '') ?? '')
  console.log('โมเดล Gemini ที่คีย์นี้เรียกได้ (เฉพาะสาย flash/pro):')
  for (const name of names.filter((n) => /flash|pro/.test(n))) console.log(`  - ${name}`)
}

async function probe(provider: 'typhoon' | 'gemini'): Promise<void> {
  const keyName = provider === 'gemini' ? 'GEMINI_API_KEY' : 'TYPHOON_API_KEY'
  const model = provider === 'gemini' ? GEMINI_DEFAULT_MODEL : TYPHOON_DEFAULT_MODEL
  console.log(`\n=== ${provider} (${model}) ===`)
  console.log(`  ${keyName}: ${keyFingerprint(env[keyName])}`)
  if (!env[keyName]) return

  // ใส่เฉพาะคีย์ของเจ้าที่กำลังทดสอบ จะได้ไม่ถูก resolveProvider เลือกอีกเจ้าไปแทน
  resetAiQuota()
  const client = createAiClient({
    onAttempt: (a) =>
      console.log(`    ชั้น ${a.provider}: ${a.ok ? 'ตอบได้' : 'พัง'} ${a.ms} ms ${a.reason ?? ''} ${a.detail ?? ''}`),
    env: { [keyName]: env[keyName], [provider === 'gemini' ? 'GEMINI_MODEL' : 'TYPHOON_MODEL']: env[provider === 'gemini' ? 'GEMINI_MODEL' : 'TYPHOON_MODEL'] ?? '' },
  })

  const hint = await timed('hintFor', () =>
    client.hintFor({ missionId: 'm3', hintLevel: 1, draftName: 'kanomwan' }),
  )
  console.log(`  source=${hint.result.source} provider=${hint.result.provider} fallbackReason=${hint.result.fallbackReason}`)
  console.log(`  คำใบ้: ${hint.result.text}`)

  const grade = await timed('gradeReason', () => client.gradeReason(SAMPLE_WORK))
  console.log(`  source=${grade.result.source} provider=${grade.result.provider} fallbackReason=${grade.result.fallbackReason}`)
  console.log(
    `  คะแนนถ่วงน้ำหนัก ${grade.result.weightedTotal}/${grade.result.weightedMax} = ${grade.result.stars} ดาว · ครูยืนยัน: ${grade.result.needsTeacherConfirm}`,
  )
  for (const d of grade.result.dimensions) {
    console.log(`    ${d.id} = ${d.score} (${d.levelLabel})${d.emphasized ? ' [เน้น]' : ''}`)
    console.log(`      หลักฐาน: ${d.evidence.slice(0, 90)}`)
    console.log(`      ข้อเสนอแนะ: ${d.suggestion.slice(0, 90)}`)
  }
}

/** ยืนยันว่าเมื่อ AI ล่มหรือช้า ระบบยังตกไปใช้กฎล้วนโดยไม่ throw */
async function probeFallback(): Promise<void> {
  console.log('\n=== ทางสำรองเมื่อ AI ใช้ไม่ได้ ===')

  const badKey = createAiClient({ env: { GEMINI_API_KEY: 'คีย์ปลอมที่ใช้ไม่ได้' } })
  const wrong = await timed('คีย์ผิด', () => badKey.gradeReason(SAMPLE_WORK))
  console.log(`  source=${wrong.result.source} fallbackReason=${wrong.result.fallbackReason} ด้านครบ ${wrong.result.dimensions.length}`)

  // ชี้ไปโฮสต์ที่ไม่มีอยู่จริง เพื่อดูว่า timeout แล้วตกลงกฎล้วนจริงไหม
  const slowFetch: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })
  const slow = createAiClient({
    env: { GEMINI_API_KEY: env.GEMINI_API_KEY ?? 'x' },
    fetchImpl: slowFetch,
    timeoutMs: 5000,
  })
  const timeout = await timed('เซิร์ฟเวอร์ไม่ตอบ (timeout 5 วิ)', () => slow.hintFor({ missionId: 'm1', hintLevel: 1 }))
  console.log(`  source=${timeout.result.source} fallbackReason=${timeout.result.fallbackReason}`)
  console.log(`  คำใบ้จากกฎ: ${timeout.result.text}`)
}

/** ลูกโซ่เต็ม Gemini -> Typhoon -> กฎ ด้วยคีย์จริงทั้งสองเจ้า */
async function probeChain(): Promise<void> {
  console.log('\n=== ลูกโซ่เต็ม (Gemini -> Typhoon -> กฎ) งบเวลารวม 5 วินาที ===')
  resetAiQuota()
  const client = createAiClient({
    onAttempt: (a) =>
      console.log(`    ชั้น ${a.provider}: ${a.ok ? 'ตอบได้' : 'พัง'} ${a.ms} ms ${a.reason ?? ''} ${a.detail ?? ''}`),
    env: {
      GEMINI_API_KEY: env.GEMINI_API_KEY ?? '',
      TYPHOON_API_KEY: env.TYPHOON_API_KEY ?? '',
      GEMINI_MODEL: env.GEMINI_MODEL ?? '',
      TYPHOON_MODEL: env.TYPHOON_MODEL ?? '',
    },
  })

  const hint = await timed('hintFor', () => client.hintFor({ missionId: 'm3', hintLevel: 1, draftName: 'kanomwan' }))
  console.log(`  ตอบโดย: ${hint.result.provider} (source=${hint.result.source}) fallbackReason=${hint.result.fallbackReason}`)
  console.log(`  คำใบ้: ${hint.result.text}`)

  const grade = await timed('gradeReason', () => client.gradeReason(SAMPLE_WORK))
  console.log(`  ตอบโดย: ${grade.result.provider} (source=${grade.result.source}) fallbackReason=${grade.result.fallbackReason}`)
  console.log(`  ${grade.result.weightedTotal}/${grade.result.weightedMax} = ${grade.result.stars} ดาว · ครูยืนยัน ${grade.result.needsTeacherConfirm}`)
  for (const d of grade.result.dimensions) {
    console.log(`    ${d.id} = ${d.score}${d.emphasized ? ' [เน้น]' : ''} · ${d.evidence.slice(0, 70)}`)
  }
}

/** ถอดคีย์ออกทั้งหมดแล้วระบบต้องยังเดินได้ — จุดขายที่ใช้ตอบกรรมการ */
async function probeNoKey(): Promise<void> {
  console.log('\n=== ถอดคีย์ออกทั้งหมด (เดโมในคาบจริง) ===')
  resetAiQuota()
  const client = createAiClient({ env: {} })
  const hint = await timed('hintFor', () => client.hintFor({ missionId: 'm3', hintLevel: 1 }))
  console.log(`  ${hint.result.provider} source=${hint.result.source} reason=${hint.result.fallbackReason}`)
  const grade = await timed('gradeReason', () => client.gradeReason(SAMPLE_WORK))
  console.log(`  ${grade.result.provider} source=${grade.result.source} reason=${grade.result.fallbackReason} ด้านครบ ${grade.result.dimensions.length}`)
}

/** ชี้ endpoint ผิดทั้งลูกโซ่ ต้องตกลงกฎภายในงบเวลา ไม่ throw */
async function probeBrokenEndpoint(): Promise<void> {
  console.log('\n=== ชี้ endpoint ผิดทั้งสองเจ้า ต้องตกลงกฎภายใน 5 วินาที ===')
  resetAiQuota()
  const deadFetch: typeof fetch = async () => new Response('not found', { status: 404 })
  const client = createAiClient({
    env: { GEMINI_API_KEY: 'x', TYPHOON_API_KEY: 'y' },
    fetchImpl: deadFetch,
  })
  const r = await timed('gradeReason (ทั้งสองเจ้าพัง)', () => client.gradeReason(SAMPLE_WORK))
  console.log(`  ${r.result.provider} source=${r.result.source} reason=${r.result.fallbackReason} ด้านครบ ${r.result.dimensions.length}`)
}

const mode = process.argv[2]
if (mode === 'models') {
  await listGeminiModels()
} else {
  await probe('typhoon')
  await probe('gemini')
  await probeChain()
  await probeBrokenEndpoint()
  await probeFallback()
  await probeNoKey()
}

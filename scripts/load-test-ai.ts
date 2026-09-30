/**
 * จำลองห้องเรียน 30 คนกดขอคำใบ้พร้อมกัน — **รันมือเท่านั้น ไม่อยู่ในชุด npm test**
 *
 *   npx tsx scripts/load-test-ai.ts            30 คน ขอคำใบ้พร้อมกัน
 *   npx tsx scripts/load-test-ai.ts 30 grade   30 คน ส่งงานให้ตรวจพร้อมกัน
 *   npx tsx scripts/load-test-ai.ts 30 hint nokey   จำลองคาบที่ไม่มีคีย์เลย
 *
 * ตัวเลขที่ออกมาคือคำตอบของคำถาม "ห้องเรียน 30 คนรับไหวจริงไหม"
 * เกณฑ์ที่ต้องผ่าน: **ไม่มีคำขอไหนใช้เวลาเกิน 5 วินาที** ไม่ว่าจะได้ AI หรือตกกฎ
 *
 * ⚠️ ห้ามพิมพ์ค่าคีย์ พิมพ์ได้แค่ความยาวและ 4 ตัวแรก
 */
import { readFileSync } from 'node:fs'
import { createAiClient, resetAiQuota, resetAiRateLimiter } from '../lib/ai'
import { BACKGROUND_TIMEOUT_MS, BackgroundGrader, InMemoryGradeJobStore } from '../lib/ai/grade-queue'
import { GEMINI_DEFAULT_MODEL } from '../lib/ai/gemini'
import { TYPHOON_DEFAULT_MODEL } from '../lib/ai/typhoon'
import { limitsFromEnv } from '../lib/ai/rate-limiter'

function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) env[match[1]!] = match[2]!.trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const fileEnv = loadEnvLocal()
const headcount = Number(process.argv[2] ?? 30)
const task = (process.argv[3] ?? 'hint') as 'hint' | 'grade' | 'submit'
const noKey = process.argv[4] === 'nokey'

const env = noKey
  ? {}
  : {
      GEMINI_API_KEY: fileEnv.GEMINI_API_KEY ?? '',
      TYPHOON_API_KEY: fileEnv.TYPHOON_API_KEY ?? '',
      GEMINI_MODEL: fileEnv.GEMINI_MODEL ?? '',
      TYPHOON_MODEL: fileEnv.TYPHOON_MODEL ?? '',
    }

const BUDGET_MS = 5000

interface Outcome {
  student: string
  ms: number
  source: string
  provider: string
  reason: string | null
}

/**
 * สถานการณ์จริงของนาทีที่ 40-50: นักเรียนทั้งห้องกดส่งงานพร้อมกัน
 * วัด 2 ตัวเลขที่ต่างกันคนละเรื่อง
 *   1. เวลาที่ "นักเรียนรอ" ต้องใกล้ 0 เพราะได้ผลจากกฎทันที
 *   2. เวลาที่ "คิวเบื้องหลัง" ตรวจครบทั้งห้อง ต้องทันก่อนครูสรุปท้ายคาบ (นาทีที่ 50-55)
 */
async function submitScenario(): Promise<void> {
  console.log(`จำลองนักเรียน ${headcount} คน กดส่งงานพร้อมกัน (ตรวจด้วยกฎทันที + AI ตรวจเบื้องหลัง)`)
  console.log(`  คีย์: ${noKey ? 'ถอดออกทั้งหมด' : 'ใช้คีย์จริงจาก .env.local'}`)
  resetAiQuota()
  resetAiRateLimiter()

  const store = new InMemoryGradeJobStore()
  const grader = new BackgroundGrader({
    // ฝั่งเบื้องหลังไม่มีใครนั่งรอ จึงให้งบเวลายาว ไม่ใช้เส้นตาย 5 วินาทีของฝั่งนักเรียน
    client: createAiClient({ env, timeoutMs: BACKGROUND_TIMEOUT_MS }),
    store,
    concurrency: 3,
    maxAttempts: 3,
  })

  const startedSubmit = Date.now()
  const waits = await Promise.all(
    Array.from({ length: headcount }, async (_, i) => {
      const started = Date.now()
      const r = await grader.submit({
        submissionId: `sub-${i + 1}`,
        studentId: `stu-${i + 1}`,
        tldId: 'in-th',
        domainName: `shop${i + 1}`,
        shopName: `ร้านที่ ${i + 1}`,
        businessTypeId: 'bakery',
        reasonText: 'เลือก .in.th เพราะลูกค้าเป็นคนไทยในย่านเดียวกัน และร้านยังไม่ได้จดทะเบียนบริษัท',
        emphasisCriterion: 'emphasis-naming',
      })
      return { ms: Date.now() - started, stars: r.rules.stars, source: r.rules.source }
    }),
  )
  const submitWall = Date.now() - startedSubmit
  const waitTimes = waits.map((w) => w.ms).sort((a, b) => a - b)

  console.log(`\n[1] เวลาที่นักเรียนรอ (ต้องใกล้ 0)`) 
  console.log(`  ทุกคนได้ผลจากกฎครบ ${waits.filter((w) => w.source === 'fallback').length}/${headcount} คน พร้อมดาวทันที`)
  console.log(`  เร็วสุด ${waitTimes[0]} ms · กลาง ${waitTimes[Math.floor(waitTimes.length / 2)]} ms · ช้าสุด ${waitTimes[waitTimes.length - 1]} ms · ทั้งห้องเสร็จใน ${submitWall} ms`)

  console.log(`\n[2] คิวเบื้องหลังเริ่มตรวจ (ไม่มีเส้นตาย 5 วินาที)`)
  const startedDrain = Date.now()
  const drained = await grader.drain(headcount * 4)
  const drainMs = Date.now() - startedDrain
  const counts = await grader.status()

  console.log(`  ตรวจไป ${drained.processed} รอบ ใช้เวลา ${drainMs} ms (${(drainMs / 60000).toFixed(2)} นาที)`)
  console.log(`  ผลคิว: done ${counts.done} · failed ${counts.failed} · pending ${counts.pending} · running ${counts.running}`)
  console.log(`  ทันก่อนครูสรุปท้ายคาบ (5 นาที)? ${drainMs < 5 * 60_000 ? 'ทัน' : 'ไม่ทัน'}`)

  const sample = await grader.aiSuggestionFor('stu-1')
  if (sample) {
    console.log(`  ตัวอย่างข้อเสนอของ AI สำหรับ stu-1: ${sample.weightedTotal}/${sample.weightedMax} = ${sample.stars} ดาว (source=${sample.source} provider=${sample.provider})`)
    console.log(`  ดาวที่นักเรียนเห็นจากกฎ: ${waits[0]!.stars} ดาว · ครูเป็นคนตัดสินว่าจะใช้ชุดไหน`)
  }
}

async function main(): Promise<void> {
  if (task === 'submit') return submitScenario()

  console.log(`จำลองนักเรียน ${headcount} คน กด "${task}" พร้อมกัน`)
  console.log(`  คีย์: ${noKey ? 'ถอดออกทั้งหมด (จำลองคาบที่เน็ตล่ม)' : 'ใช้คีย์จริงจาก .env.local'}`)
  if (!noKey) {
    console.log(`  TYPHOON_API_KEY: ยาว ${fileEnv.TYPHOON_API_KEY?.length ?? 0} ตัว ขึ้นต้น ${fileEnv.TYPHOON_API_KEY?.slice(0, 4) ?? '-'}…`)
    console.log(`  GEMINI_API_KEY: ยาว ${fileEnv.GEMINI_API_KEY?.length ?? 0} ตัว ขึ้นต้น ${fileEnv.GEMINI_API_KEY?.slice(0, 4) ?? '-'}…`)
  }
  const limits = limitsFromEnv(env)
  console.log(`  ลำดับลูกโซ่: Typhoon (${TYPHOON_DEFAULT_MODEL}) -> Gemini (${GEMINI_DEFAULT_MODEL}) -> กฎ`)
  console.log(`  คิว: typhoon ${limits.typhoon!.rps} RPS/${limits.typhoon!.rpm} RPM · gemini ${limits.gemini!.rps} RPS/${limits.gemini!.rpm} RPM`)

  resetAiQuota()
  resetAiRateLimiter()
  const client = createAiClient({ env })

  const startedAll = Date.now()
  const results = await Promise.all(
    Array.from({ length: headcount }, async (_, i): Promise<Outcome> => {
      const student = `stu-${i + 1}`
      const started = Date.now()
      const result =
        task === 'grade'
          ? await client.gradeReason({
              studentId: student,
              tldId: 'in-th',
              domainName: `shop${i + 1}`,
              shopName: `ร้านที่ ${i + 1}`,
              businessTypeId: 'bakery',
              reasonText: 'เลือก .in.th เพราะลูกค้าเป็นคนไทยในย่านเดียวกัน และร้านยังไม่ได้จดทะเบียนบริษัท',
              emphasisCriterion: 'emphasis-naming',
            })
          : await client.hintFor({
              studentId: student,
              missionId: 'm3',
              hintLevel: 1,
              draftName: `shop${i + 1}`,
            })
      return {
        student,
        ms: Date.now() - started,
        source: result.source,
        provider: result.provider,
        reason: result.fallbackReason,
      }
    }),
  )
  const wallMs = Date.now() - startedAll

  const ai = results.filter((r) => r.source === 'ai')
  const rules = results.filter((r) => r.source === 'fallback')
  const times = results.map((r) => r.ms).sort((a, b) => a - b)
  const overBudget = results.filter((r) => r.ms > BUDGET_MS)

  const byReason = new Map<string, number>()
  for (const r of rules) byReason.set(r.reason ?? 'unknown', (byReason.get(r.reason ?? 'unknown') ?? 0) + 1)
  const byProvider = new Map<string, number>()
  for (const r of ai) byProvider.set(r.provider, (byProvider.get(r.provider) ?? 0) + 1)

  console.log(`\nผลลัพธ์ (เวลารวมทั้งห้อง ${wallMs} ms)`)
  console.log(`  ได้คำตอบจาก AI จริง : ${ai.length}/${headcount} คน` + (ai.length ? ` (${[...byProvider].map(([p, n]) => `${p} ${n}`).join(' · ')})` : ''))
  console.log(`  ตกไปใช้กฎล้วน       : ${rules.length}/${headcount} คน` + (rules.length ? ` (${[...byReason].map(([r, n]) => `${r} ${n}`).join(' · ')})` : ''))
  console.log(`  เร็วสุด ${times[0]} ms · กลาง ${times[Math.floor(times.length / 2)]} ms · ช้าสุด ${times[times.length - 1]} ms`)
  console.log(`  เกินงบ ${BUDGET_MS} ms: ${overBudget.length} คน ${overBudget.length === 0 ? '(ผ่านเกณฑ์)' : '(ไม่ผ่านเกณฑ์)'}`)
  if (overBudget.length > 0) {
    for (const r of overBudget.slice(0, 5)) console.log(`    ${r.student} ${r.ms} ms ${r.source}/${r.provider}`)
  }
}

await main()

/**
 * วัดเวลา AI ช่วยตรวจคำตอบเส้นทางเรียน (learnCheck) + ลองตรวจคำตอบจริงของ m1 — **รันมือเท่านั้น**
 *
 *   npx tsx scripts/check-learn-ai.ts          วัดเวลาเจ้าละ 3 ครั้ง แล้วลองตรวจจริง 1 ครั้ง
 *   npx tsx scripts/check-learn-ai.ts smoke    ลองตรวจจริงอย่างเดียว
 *
 * ⚠️ ห้ามพิมพ์ค่าคีย์หรือค่า env ใด ๆ พิมพ์ได้แค่เวลา คะแนน และชื่อผู้ให้บริการ
 */
import { loadEnvLocal } from './load-env'
import { createAiClient, resetAiQuota, resetAiRateLimiter } from '../lib/ai/index'
import type { LearnCheckInput } from '../lib/ai/types'

loadEnvLocal()

const PARAPHRASE_Q1 = 'มันเหมือนป้ายบอกทางไปหน้าร้านบนอินเทอร์เน็ต คนพิมพ์คำนี้แล้วไปเจอร้านเลย'
const PARAPHRASE_Q2 = 'เป็นตัวกลางที่แปลชื่อร้านเป็นพิกัดเครื่องปลายทาง ให้โปรแกรมท่องเว็บรู้ว่าต้องวิ่งไปหาใคร'

const SAMPLE: LearnCheckInput = {
  missionId: 'm1',
  items: [
    {
      id: 'm1-wq1',
      question: 'โดเมนเนมคืออะไร',
      concepts: ['บอกว่าเป็นชื่อที่ใช้ระบุหรือเข้าถึงเว็บไซต์', 'บอกว่าช่วยให้จำง่ายหรือสะดวกกว่าหมายเลข IP'],
      answer: PARAPHRASE_Q1,
    },
    {
      id: 'm1-wq2',
      question: 'DNS คืออะไร และช่วยอะไรในการเข้าเว็บไซต์',
      concepts: [
        'บอกว่า DNS เป็นระบบที่ช่วยค้นหาหรือแปลงชื่อ',
        'เชื่อมชื่อโดเมนกับหมายเลข IP หรือที่อยู่ของเว็บ',
        'บอกว่าช่วยให้เบราว์เซอร์ติดต่อเซิร์ฟเวอร์หรือเปิดเว็บได้',
      ],
      answer: PARAPHRASE_Q2,
    },
  ],
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function measure(provider: 'typhoon' | 'gemini'): Promise<void> {
  const keyName = provider === 'typhoon' ? 'TYPHOON_API_KEY' : 'GEMINI_API_KEY'
  if (!process.env[keyName]) return console.log(`${provider}: ไม่พบคีย์ ข้าม`)
  const env = { [keyName]: process.env[keyName] }
  const runs: number[] = []
  for (let i = 0; i < 3; i++) {
    resetAiRateLimiter()
    let ms = -1
    let ok = false
    const client = createAiClient({ env, timeoutMs: 20_000, onAttempt: (a) => ((ms = a.ms), (ok = a.ok)) })
    const r = await client.learnCheck(SAMPLE)
    console.log(`  ${provider} #${i + 1}: ${ms} ms ok=${ok} source=${r.source} covered=${JSON.stringify(r.items.map((it) => it.covered))}`)
    if (ok) runs.push(ms)
    if (i < 2) await sleep(4500)
  }
  console.log(`${provider} median: ${median(runs)} ms  [${runs.join(', ')}]`)
}

async function smoke(): Promise<void> {
  const { findLearnPath, scoreOpenAnswers } = await import('../components/server/learn-path')
  resetAiQuota()
  resetAiRateLimiter()
  const path = findLearnPath('m1')!
  const answers = { 'm1-wq1': PARAPHRASE_Q1, 'm1-wq2': PARAPHRASE_Q2 }
  const started = Date.now()
  const r = await scoreOpenAnswers(path, 'watch', answers, { checker: createAiClient(), studentId: 'smoke' })
  console.log(`smoke m1/watch: ${Date.now() - started} ms · score ${r.score} · passed ${r.passed}`)
  for (const q of r.perQuestion) {
    console.log(`  ${q.id}: source=${q.source} keyword=${q.keywordScore} ai=${q.aiScore} final=${q.score} · ${q.feedback}`)
  }
}

async function main() {
  if (process.argv[2] !== 'smoke') {
    await measure('typhoon')
    await measure('gemini')
  }
  await smoke()
}

main().catch((err) => {
  console.error('ล้มเหลว:', err instanceof Error ? err.message : err)
  process.exit(1)
})

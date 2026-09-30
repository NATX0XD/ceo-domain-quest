/**
 * worker ตรวจงานด้วย AI แบบรันมือ — **ทางสำรอง** ของการให้แผงครูปลุกคิวเอง
 *
 * ใช้ทางไหนเมื่อไร:
 * - ปกติในคาบ: ครูเปิดหน้า `/teacher` ค้างไว้ หน้านั้นจะยิง `POST /api/jobs/drain` ให้เอง
 *   ไม่ต้องรันสคริปต์นี้ ไม่ต้องตั้ง cron
 * - ใช้สคริปต์นี้เมื่อ: ครูไม่ได้เปิดแผง · อยากไล่คิวค้างให้หมดก่อนเริ่มคาบ ·
 *   ต้องการรันจากเครื่องอื่น (ตั้ง `GRADE_WORKER_SECRET` แล้วยิง API แทนก็ได้) ·
 *   ดีบักโดยไม่อยากเปิดเว็บเซิร์ฟเวอร์
 *
 * รัน 1 รอบ:        npx tsx scripts/grade-worker.ts
 * รันวนทุก 10 วิ:   npx tsx scripts/grade-worker.ts --watch
 *
 * ทุกยกจะดึงงานที่ worker ตัวก่อนตายคาไว้กลับเข้าคิวก่อนเสมอ แล้วค่อยตรวจ
 * ผลที่ AI เสนอถูกเขียนคู่ขนานใน submissions.ai_scores.aiProposed
 * ไม่แตะดาวที่นักเรียนเห็นไปแล้ว และไม่แตะคะแนนที่ครูยืนยัน
 */
import { drainQueue } from '../components/server/grade-queue'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

const WATCH_INTERVAL_MS = 10_000

async function runOnce(): Promise<void> {
  const started = Date.now()
  const summary = await drainQueue()
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(
    `[grade-worker] ดึงงานค้างกลับเข้าคิว ${summary.reclaimed} งาน · ตรวจไป ${summary.processed} งาน · ใช้เวลา ${seconds} วินาที`,
  )
}

async function main(): Promise<void> {
  const watch = process.argv.includes('--watch')
  await runOnce()
  if (!watch) return

  console.log(`[grade-worker] โหมดวนรอบ ทุก ${WATCH_INTERVAL_MS / 1000} วินาที · กด Ctrl+C เพื่อหยุด`)
  setInterval(() => {
    void runOnce().catch((error) => {
      console.error('[grade-worker] รอบนี้ล้ม แต่ยังวนต่อ:', error)
    })
  }, WATCH_INTERVAL_MS)
}

void main().catch((error) => {
  console.error('[grade-worker] ล้มเหลว:', error)
  process.exitCode = 1
})

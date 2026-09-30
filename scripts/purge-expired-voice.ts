// ลบไฟล์เสียงที่ครบกำหนดเก็บ 90 วันแล้ว — ทั้งแถวใน voice_submissions และไฟล์ใน storage
//
// รัน: npx tsx scripts/purge-expired-voice.ts
// ตั้งเป็น cron วันละครั้ง (ดู docs/deploy.md หัวข้อ "นโยบายเก็บไฟล์เสียง")
//
// เสียงของนักเรียนเป็นข้อมูลส่วนบุคคลตาม PDPA — เก็บเท่าที่จำเป็นต่อการให้คะแนนและทบทวนเท่านั้น
// สคริปต์นี้ลบจริง กู้คืนไม่ได้

import { getServiceClient } from '../lib/db/client'
import { purgeExpiredVoiceSubmissions } from '../lib/db/repo'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const db = getServiceClient()

  const due = await db
    .from('voice_submissions')
    .select('id, student_id, expires_at, storage_path')
    .lte('expires_at', new Date().toISOString())
  if (due.error) throw due.error

  console.log(`ปลายทาง: ${process.env.SUPABASE_URL ?? '(ไม่ได้ตั้ง)'}`)
  console.log(`ถึงกำหนดลบ: ${due.data.length} รายการ`)
  for (const row of due.data) {
    console.log(`  - ${row.id} · ครบกำหนด ${row.expires_at} · ${row.storage_path ?? '(ไม่มีไฟล์)'}`)
  }

  if (dryRun) {
    console.log('โหมด --dry-run ไม่ได้ลบอะไร')
    return
  }
  if (due.data.length === 0) {
    console.log('ไม่มีอะไรต้องลบ')
    return
  }

  const result = await purgeExpiredVoiceSubmissions()
  console.log(`ลบแล้ว: ${result.rows} แถว · ${result.files} ไฟล์ใน bucket`)
}

main().catch((err: unknown) => {
  console.error('purge-expired-voice ล้มเหลว:', err)
  process.exit(1)
})

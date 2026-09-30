// โหลด .env.local ให้สคริปต์ที่รันด้วย tsx (Next.js โหลดให้เองเฉพาะตอนรันแอป)
// parser แบบง่าย ไม่พึ่ง dependency เพิ่ม

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnvLocal(file = '.env.local'): void {
  let raw: string
  try {
    raw = readFileSync(resolve(process.cwd(), file), 'utf8')
  } catch {
    console.warn(`[env] ไม่พบ ${file} — ใช้ env ที่มีอยู่แล้วแทน`)
    return
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

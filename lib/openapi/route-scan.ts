/**
 * ไล่ดูว่า `app/api/**` มี route อะไรอยู่จริงบ้าง — **อ่านจากซอร์ส ไม่ได้อ่านจากเอกสาร**
 *
 * ใช้ 2 ที่: เทสต์ (`spec.test.ts`) และสคริปต์ (`scripts/check-openapi.ts`)
 * เพื่อให้คำถาม "เอกสารครบไหม" ตอบด้วยตัวเลขเดียวกันทั้งสองทาง
 *
 * ⚠️ ไม่ import อะไรจาก Next เลย ตั้งใจให้รันได้ทั้งใน vitest และใน `tsx` ธรรมดา
 * ⚠️ หาตำแหน่งรากโปรเจกต์จาก `import.meta.url` ไม่ใช่ `process.cwd()`
 *    เพราะ cwd ต่างกันได้ตามที่รันคำสั่ง แต่ไฟล์นี้อยู่ที่ `lib/openapi/` เสมอ
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..')

/** method ที่ Next ถือว่าเป็น route handler (เท่าที่โปรเจกต์นี้ใช้จริง) */
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export interface RouteEntry {
  /** ตัวพิมพ์ใหญ่ เช่น `POST` */
  method: string
  /** path แบบ OpenAPI เช่น `/api/mission/{id}/check` */
  path: string
  /** ไฟล์ที่มา (path เทียบจากรากโปรเจกต์) */
  file: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name === 'route.ts' || name === 'route.tsx') out.push(full)
  }
  return out
}

/**
 * `app/api/mission/[id]/check/route.ts` → `/api/mission/{id}/check`
 *
 * รองรับ catch-all ของ Next (`[...rest]` · `[[...rest]]`) ไว้ล่วงหน้า
 * เผื่อวันหนึ่งมีคนเพิ่ม — ไม่ใช่ว่ามีอยู่แล้วตอนนี้
 */
export function toOpenApiPath(routeFile: string): string {
  const rel = relative(PROJECT_ROOT, routeFile).replace(/\\/g, '/')
  return `/${rel}`
    .replace(/^\/app/, '')
    .replace(/\/route\.tsx?$/, '')
    .replace(/\[\[?\.{3}([^\]]+)\]?\]/g, '{$1}')
    .replace(/\[([^\]]+)\]/g, '{$1}')
}

/** method ที่ไฟล์นั้น export จริง — รับทั้ง `export function GET` และ `export const GET =` */
export function methodsOf(source: string): string[] {
  const found = new Set<string>()
  const patterns = [
    /^export\s+(?:async\s+)?function\s+([A-Z]+)\b/gm,
    /^export\s+(?:const|let|var)\s+([A-Z]+)\s*[:=]/gm,
  ]
  for (const re of patterns) {
    for (const match of source.matchAll(re)) {
      const name = match[1] ?? ''
      if ((METHODS as readonly string[]).includes(name)) found.add(name)
    }
  }
  return [...found]
}

/** ทุกคู่ method+path ที่มีอยู่จริงใน `app/api/**` เรียงคงที่ (เทียบผลซ้ำได้) */
export function scanApiRoutes(apiDir = join(PROJECT_ROOT, 'app', 'api')): RouteEntry[] {
  const entries: RouteEntry[] = []
  for (const file of walk(apiDir)) {
    const path = toOpenApiPath(file)
    for (const method of methodsOf(readFileSync(file, 'utf8'))) {
      entries.push({ method, path, file: relative(PROJECT_ROOT, file).replace(/\\/g, '/') })
    }
  }
  return entries.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`))
}

export const keyOf = (entry: { method: string; path: string }): string => `${entry.method} ${entry.path}`

export interface CoverageDiff {
  /** มีในซอร์ส แต่ไม่มีในเอกสาร — **ต้องว่างเสมอ** */
  missingFromSpec: string[]
  /** มีในเอกสาร แต่ไม่มีในซอร์ส (route ถูกลบ หรือพิมพ์ path ผิด) */
  notInSource: string[]
  sourceCount: number
  specCount: number
}

/** เทียบสองทาง — ขาดก็ผิด เกินก็ผิด */
export function compareCoverage(sourceKeys: readonly string[], specKeys: readonly string[]): CoverageDiff {
  const source = new Set(sourceKeys)
  const spec = new Set(specKeys)
  return {
    missingFromSpec: [...source].filter((k) => !spec.has(k)).sort(),
    notInSource: [...spec].filter((k) => !source.has(k)).sort(),
    sourceCount: source.size,
    specCount: spec.size,
  }
}

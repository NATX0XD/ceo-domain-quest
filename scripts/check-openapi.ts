/**
 * ตรวจว่าเอกสาร OpenAPI ครอบ route จริงครบทุกเส้น — **อ่านอย่างเดียว ไม่แตะฐานข้อมูล ไม่ต้องมี dev server**
 *
 * รัน: `npm run check:openapi`
 *
 * ตรรกะเดียวกับเทสต์ `lib/openapi/spec.test.ts` (แชร์ `lib/openapi/route-scan.ts` ตัวเดียวกัน)
 * มีสองทางเพราะใช้ต่างจังหวะ: เทสต์ติดใน `npm test` · สคริปต์เอาไปต่อกับ `check:deploy` หรือ pre-push ได้
 * โดยไม่ต้องรอ vitest ทั้งชุด
 */
import { openApiSpec } from '../lib/openapi/spec'
import { compareCoverage, keyOf, scanApiRoutes } from '../lib/openapi/route-scan'
import { HTTP_METHODS } from '../lib/openapi/types'

function specKeys(): string[] {
  const out: string[] = []
  for (const [path, item] of Object.entries(openApiSpec.paths)) {
    for (const method of HTTP_METHODS) {
      if (item[method]) out.push(`${method.toUpperCase()} ${path}`)
    }
  }
  return out
}

function main(): void {
  const source = scanApiRoutes()
  const files = new Set(source.map((r) => r.file)).size
  const diff = compareCoverage(source.map(keyOf), specKeys())

  console.log('ตรวจเอกสาร OpenAPI เทียบกับ app/api/** (อ่านจากซอร์ส ไม่ได้อ่านจากเอกสารเก่า)\n')
  console.log(`  ซอร์ส    ${files} ไฟล์ route · ${diff.sourceCount} คู่ method+path`)
  console.log(`  เอกสาร   ${Object.keys(openApiSpec.paths).length} path · ${diff.specCount} คู่ method+path\n`)

  if (diff.missingFromSpec.length > 0) {
    console.log(`  ✗ มีในซอร์ส แต่ยังไม่มีในเอกสาร ${diff.missingFromSpec.length} เส้น`)
    console.log('    เติมที่ lib/openapi/paths-student.ts · paths-endgame.ts · paths-teacher.ts')
    for (const key of diff.missingFromSpec) console.log(`      ${key}`)
  }
  if (diff.notInSource.length > 0) {
    console.log(`  ✗ มีในเอกสาร แต่ไม่มีในซอร์ส ${diff.notInSource.length} เส้น (route ถูกลบ หรือพิมพ์ path ผิด)`)
    for (const key of diff.notInSource) console.log(`      ${key}`)
  }

  if (diff.missingFromSpec.length === 0 && diff.notInSource.length === 0) {
    console.log(`  ✓ ตรงกันทั้งสองทาง ${diff.sourceCount}/${diff.sourceCount} คู่ — ไม่มีเส้นที่ขาด และไม่มีเส้นเกิน`)
    return
  }

  process.exitCode = 1
}

main()

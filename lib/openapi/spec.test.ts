/**
 * ล็อกเอกสาร OpenAPI ให้ตรงกับซอร์สจริง
 *
 * **ข้อที่สำคัญที่สุดคือข้อแรก**: จำนวนคู่ method+path ใน `openApiSpec` ต้องเท่ากับที่มีอยู่จริงใน `app/api/**`
 * ทั้งสองทาง — ขาดก็ตก เกินก็ตก ใครเพิ่ม route ใหม่แล้วลืมเขียนเอกสาร `npm test` จะแดงพร้อมชื่อเส้นที่ขาด
 *
 * (แนวเดียวกับที่ session db ทำกับ `npm run check:deploy` — ต่างกันแค่ที่นี่เป็นเทสต์ จึงติดใน CI ได้ด้วย)
 */
import { describe, expect, it } from 'vitest'
import { openApiSpec } from './spec'
import { compareCoverage, keyOf, scanApiRoutes } from './route-scan'
import { HTTP_METHODS } from './types'
import type { OperationObject } from './types'

/** ทุก operation ในเอกสาร คู่กับ path/method ของมัน */
function operations(): { key: string; path: string; method: string; op: OperationObject }[] {
  const out: { key: string; path: string; method: string; op: OperationObject }[] = []
  for (const [path, item] of Object.entries(openApiSpec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method]
      if (op) out.push({ key: `${method.toUpperCase()} ${path}`, path, method, op })
    }
  }
  return out
}

const OPS = operations()
const SOURCE = scanApiRoutes()

describe('เอกสาร OpenAPI ครอบ route จริงครบทุกเส้น', () => {
  it('จำนวนคู่ method+path ตรงกับซอร์สทั้งสองทาง', () => {
    const diff = compareCoverage(SOURCE.map(keyOf), OPS.map((o) => o.key))

    // แยกข้อความสองทางให้ชัด เพราะสาเหตุกับทางแก้ต่างกันคนละเรื่อง
    expect(
      diff.missingFromSpec,
      `มี route ในซอร์สที่ยังไม่มีในเอกสาร — เติมใน lib/openapi/paths-*.ts:\n${diff.missingFromSpec.join('\n')}`,
    ).toEqual([])
    expect(
      diff.notInSource,
      `มีเส้นในเอกสารที่ไม่มีในซอร์ส (route ถูกลบ หรือพิมพ์ path ผิด):\n${diff.notInSource.join('\n')}`,
    ).toEqual([])
    expect(diff.specCount).toBe(diff.sourceCount)
  })

  it('อ่านซอร์สได้จริง ไม่ใช่สแกนเจอศูนย์เส้นแล้วผ่านเพราะทั้งสองข้างว่าง', () => {
    // กันเคสที่ตัวสแกนพัง (path ผิด / regex ไม่จับ) แล้วเทสต์ข้อบนกลายเป็นผ่านฟรี
    expect(SOURCE.length).toBeGreaterThan(70)
    expect(new Set(SOURCE.map((r) => r.file)).size).toBeGreaterThan(50)
  })

  it('เป็น OpenAPI 3.1', () => {
    expect(openApiSpec.openapi.startsWith('3.1')).toBe(true)
  })
})

describe('ทุก operation บอกได้ว่าใครเรียกได้ และคืนอะไร', () => {
  it('`security` อ้างถึง scheme ที่ประกาศไว้จริง', () => {
    const declared = Object.keys(openApiSpec.components.securitySchemes)
    for (const { key, op } of OPS) {
      for (const requirement of op.security) {
        for (const scheme of Object.keys(requirement)) {
          expect(declared, `${key} อ้าง scheme ที่ไม่มี: ${scheme}`).toContain(scheme)
        }
      }
    }
  })

  it('เส้นที่ต้องมีคุกกี้ ต้องมี `401` เขียนไว้เสมอ', () => {
    for (const { key, op } of OPS) {
      if (op.security.length === 0) continue
      expect(Object.keys(op.responses), `${key} ต้องบอกกรณี 401`).toContain('401')
    }
  })

  it('เส้นที่ยิงได้โดยไม่ต้องล็อกอิน มีแค่ 3 เส้นที่ตั้งใจไว้', () => {
    const open = OPS.filter((o) => o.op.security.length === 0).map((o) => o.key).sort()
    expect(open).toEqual(['POST /api/join', 'POST /api/join/resume', 'POST /api/teacher/login'])
  })

  it('ทุก operation มีคำตอบกรณีสำเร็จ (2xx) และทุก response มีคำอธิบาย', () => {
    for (const { key, op } of OPS) {
      const success = Object.keys(op.responses).filter((code) => code.startsWith('2'))
      expect(success.length, `${key} ไม่มี response 2xx`).toBeGreaterThan(0)
      for (const [code, response] of Object.entries(op.responses)) {
        expect(response.description.trim(), `${key} → ${code} ไม่มีคำอธิบาย`).not.toBe('')
      }
    }
  })

  it('`operationId` ไม่ซ้ำกัน', () => {
    const ids = OPS.map((o) => o.op.operationId)
    expect(new Set(ids).size, `id ซ้ำ: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`).toBe(ids.length)
  })

  it('tag ที่ใช้ทุกอันถูกประกาศไว้ใน `tags`', () => {
    const declared = openApiSpec.tags.map((t) => t.name)
    for (const { key, op } of OPS) {
      expect(op.tags.length, `${key} ไม่มี tag`).toBeGreaterThan(0)
      for (const tag of op.tags) expect(declared, `${key} ใช้ tag ที่ไม่ได้ประกาศ: ${tag}`).toContain(tag)
    }
  })

  it('path ที่มีตัวแปร ต้องประกาศ path parameter ให้ครบ', () => {
    for (const { key, path, op } of OPS) {
      const needed = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
      const declared = (op.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name)
      for (const name of needed) {
        expect(declared, `${key} ไม่ได้ประกาศ path parameter "${name}"`).toContain(name)
      }
    }
  })
})

describe('เอกสารไม่มีค่าลับหลุด', () => {
  const serialized = JSON.stringify(openApiSpec)

  /**
   * รูปของความลับที่เคยหลุดเข้าเอกสารในโปรเจกต์อื่นมาแล้ว
   * จับที่ **รูปของค่า** ไม่ใช่จับที่ชื่อ env เพราะการเอ่ยชื่อ env ในคำอธิบายเป็นเรื่องที่ควรทำ
   */
  const SECRET_SHAPES: readonly { name: string; pattern: RegExp }[] = [
    { name: 'JWT (ขึ้นต้น eyJ)', pattern: /eyJ[A-Za-z0-9_-]{8,}/ },
    { name: 'คีย์ Google/Gemini (ขึ้นต้น AIza)', pattern: /AIza[0-9A-Za-z_-]{10,}/ },
    { name: 'คีย์รูป sk-...', pattern: /\bsk-[A-Za-z0-9]{12,}/ },
    { name: 'ค่า hex ยาวแบบ secret', pattern: /\b[0-9a-f]{40,}\b/ },
    { name: 'คุกกี้ที่มีค่าติดมา', pattern: /dbq_(student|teacher)=[A-Za-z0-9]/ },
    { name: 'บรรทัดกำหนดค่า env', pattern: /(SESSION_SECRET|SERVICE_ROLE_KEY|API_KEY|WORKER_SECRET)\s*=\s*\S/ },
  ]

  for (const shape of SECRET_SHAPES) {
    it(`ไม่มี ${shape.name}`, () => {
      expect(shape.pattern.test(serialized)).toBe(false)
    })
  }

  it('uuid ตัวอย่างทุกตัวเป็นค่าปลอมชุดเดียวกัน (ไม่ใช่ id ของแถวจริง)', () => {
    const uuids = serialized.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? []
    expect(uuids.length, 'ควรมี uuid ตัวอย่างอยู่บ้าง ไม่งั้นเทสต์นี้ไม่ได้ตรวจอะไรเลย').toBeGreaterThan(5)
    for (const value of uuids) {
      expect(value.startsWith('00000000-0000-4000-8000-'), `uuid ที่ไม่ใช่ค่าปลอมของ FAKE: ${value}`).toBe(true)
    }
  })

  /**
   * ⚠️ **กติกาข้อนี้เปลี่ยนในรอบ API-10 โดยเจตนา**
   *
   * เดิมบังคับว่าช่อง `password` ต้องเป็นข้อความสั่งให้ผู้ใช้พิมพ์เอง ผลคือกดลองยิงไม่ผ่านตั้งแต่ขั้นแรก
   * ตอนนี้ใส่บัญชี **ครูสาธิตของเครื่องพัฒนา** ลงไป (ค่าเดียวกับ `lib/db/demo-seed.ts` ·
   * `scripts/check-authz.ts` · `docs/pre-flight.md` — ไม่ใช่ความลับใหม่ และหน้า `/api-docs`
   * เปิดได้เฉพาะ `next dev` เท่านั้น)
   *
   * สิ่งที่ยังห้ามเด็ดขาดคือ **ความลับจริง** ซึ่งถูกล็อกด้วยเทสต์ชุด "รูปของความลับ" ข้างบน
   * บวกกับข้อนี้ที่ไล่ชื่อ env ของความลับทั้งหมดว่าต้องไม่มีค่าอยู่ในเอกสาร
   */
  it('ตัวอย่างของ `POST /api/teacher/login` เป็นบัญชีสาธิตที่ยิงผ่านจริง ไม่ใช่ข้อความสั่งให้กรอกเอง', () => {
    const login = openApiSpec.paths['/api/teacher/login']?.post
    const example = login?.requestBody?.content['application/json']?.example as
      | { email?: string; password?: string }
      | undefined
    expect(example?.email).toBe('teacher.demo@digital-biz.local')
    expect(example?.password).toBe('demo-teacher-1234')
    // กันการถอยกลับไปเป็นข้อความสั่ง ซึ่งทำให้กด Execute แล้วได้ 401 ทันที
    expect(example?.password).not.toMatch(/พิมพ์|กรอก|ใส่รหัส|<|>/)
  })

  it('ไม่มีค่าของ env ที่เป็นความลับจริงอยู่ในเอกสาร', () => {
    // เอ่ย "ชื่อ" env ได้ (ควรทำด้วยซ้ำ) แต่ห้ามมี "ค่า" ของมัน
    for (const name of [
      'SESSION_SECRET',
      'GRADE_WORKER_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GEMINI_API_KEY',
      'TYPHOON_API_KEY',
    ]) {
      const value = process.env[name]?.trim()
      if (!value || value.length < 8) continue
      expect(serialized.includes(value), `พบค่าของ ${name} ในเอกสาร`).toBe(false)
    }
  })
})

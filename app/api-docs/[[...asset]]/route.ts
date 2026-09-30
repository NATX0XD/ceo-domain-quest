import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { openApiSpec } from '@/lib/openapi/spec'

/**
 * หน้าเปิดดู API ทั้งหมดของโปรเจกต์ด้วย Swagger UI — **เครื่องพัฒนาเท่านั้น**
 *
 * เปิดที่ `http://localhost:3000/api-docs`
 *
 * ## ทำไมปิดสนิทบน production ไม่ใช่ล็อกด้วยคุกกี้ครู
 *
 * ทางเลือกคือ (ก) เปิดบน production แต่ต้องมีคุกกี้ครู หรือ (ข) ไม่มีทางเปิดได้เลยบน production
 * เลือก (ข) เพราะ:
 *
 * 1. **ครูไม่ใช่ผู้ใช้ของหน้านี้** คนที่ต้องอ่านสัญญา API คือคนเขียนโค้ดกับคนเขียนเทสต์
 *    ซึ่งทำงานบนเครื่องพัฒนาอยู่แล้ว การเปิดให้ครูเข้าได้จึงเพิ่มความเสี่ยงโดยไม่ได้ประโยชน์กับใคร
 * 2. **ถ้าเปิดบน production จะมีทางล็อกอินให้เจาะเพิ่มอีกทาง** และหน้านี้มีปุ่มยิงคำขอจริง
 *    (รวม `DELETE /api/teacher/classroom` กับ `POST /api/teacher/demo-reset`) ถ้าคุกกี้ครูหลุด
 *    หน้านี้จะกลายเป็นแผงควบคุมพร้อมใช้ให้คนที่ขโมยคุกกี้ไป
 * 3. **ตัวอ่าน (`swagger-ui-dist`) เป็น devDependency** จึงไม่ถูกติดตั้งบนเซิร์ฟเวอร์จริงตั้งแต่ต้น
 *    (`npm ci --omit=dev`) — ต่อให้มีใครลบด่านในโค้ดนี้ออก ไฟล์ที่ต้องเสิร์ฟก็ไม่มีอยู่
 *    **ด่านชั้นสุดท้ายจึงไม่ได้อยู่ในโค้ดนี้ แต่อยู่ที่ว่าของไม่ได้ถูกติดตั้งไป**
 *
 * ทั้งสามข้อรวมกันคือเหตุผลที่ production ตอบ `404` (ไม่ใช่ `403`) — ไม่ยืนยันแม้แต่ว่าหน้านี้มีอยู่
 *
 * ## ทำไมเป็น route handler ไม่ใช่ `page.tsx`
 *
 * เพราะ **ต้องไม่เพิ่มขนาดไฟล์ที่นักเรียนโหลด** route handler คืน HTML เป็นข้อความ
 * ไม่มี React component ฝั่งเบราว์เซอร์ จึงไม่มี chunk ใหม่เข้า client bundle แม้แต่ไบต์เดียว
 * `swagger-ui-bundle.js` (1.5 MB) ถูกขอเฉพาะตอนเปิดหน้านี้ และไม่อยู่ใน `public/`
 * จึงไม่มีทางถูกโหลดจากหน้าอื่นของเด็ก
 *
 * ## เสิร์ฟจากในโปรเจกต์ ไม่ดึงจาก CDN
 *
 * `swagger-ui-dist` อ่านจาก `node_modules` ตอนมีคำขอ (ผ่าน `createRequire` ไม่ใช่ import บนหัวไฟล์
 * เพื่อให้ build ผ่านและ runtime ฝั่ง production ไม่แตะแพ็กเกจนี้เลย)
 * เสิร์ฟเฉพาะไฟล์ใน `ASSETS` ซึ่งเป็น allowlist ตายตัว — ไม่มีการต่อ path จากสิ่งที่ผู้ใช้ส่งมา
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** ปิดหน้านี้ระหว่าง dev ได้ด้วย `API_DOCS=off` (เช่นตอนวัดเวลา compile) */
function docsEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.API_DOCS?.trim().toLowerCase() !== 'off'
}

/** ไม่ยืนยันแม้แต่ว่าหน้านี้มีอยู่ */
function notFound(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** allowlist ตายตัว — ชื่อไฟล์ที่ผู้ใช้ส่งมาถูกใช้เป็น **คีย์** ไม่ใช่ส่วนหนึ่งของ path */
const ASSETS: Record<string, { file: string; mime: string }> = {
  'swagger-ui.css': { file: 'swagger-ui.css', mime: 'text/css; charset=utf-8' },
  'swagger-ui-bundle.js': { file: 'swagger-ui-bundle.js', mime: 'text/javascript; charset=utf-8' },
}

/**
 * หา `node_modules/swagger-ui-dist` ด้วยการไล่ขึ้นจาก cwd
 *
 * ⚠️ **ห้ามใช้ `require.resolve('swagger-ui-dist/swagger-ui.css')`** — bundler ของ Next แปลง
 *    `require.resolve` เป็นการหา module id ของตัวเอง ไม่ใช่การหาไฟล์บนดิสก์ แล้วพังกับไฟล์ที่ไม่ใช่ JS
 *    (เจอมาแล้ว: ได้ `503` ทั้งที่แพ็กเกจติดตั้งอยู่จริง)
 * ⚠️ ไล่ขึ้นไม่เกิน 5 ชั้น เผื่อวันหนึ่งย้ายไปอยู่ใน monorepo ที่ node_modules อยู่ชั้นบน
 */
function assetPath(file: string): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'node_modules', 'swagger-ui-dist', file)
    if (existsSync(candidate)) return candidate
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}

const NO_INDEX = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
} as const

function page(): NextResponse {
  const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>API ของ Digital Biz Quest</title>
<link rel="stylesheet" href="/api-docs/swagger-ui.css">
<style>
  /* ฟอนต์ไทยจากเครื่อง ไม่โหลดจากเน็ต — หน้านี้ต้องเปิดได้ตอนเน็ตโรงเรียนล่ม */
  body, .swagger-ui, .swagger-ui .info, .swagger-ui .opblock-description-wrapper p,
  .swagger-ui .markdown p, .swagger-ui .markdown li, .swagger-ui table, .swagger-ui .btn {
    font-family: -apple-system, "Noto Sans Thai", "IBM Plex Sans Thai", Sarabun, "Segoe UI", sans-serif;
  }
  body { margin: 0; background: #fafafa; }
  .dev-banner {
    background: #0f5132; color: #fff; padding: 10px 16px; font-size: 14px; line-height: 1.6;
  }
  .dev-banner code { background: rgba(255,255,255,.18); padding: 1px 5px; border-radius: 3px; }
</style>
</head>
<body>
<div class="dev-banner">
  หน้านี้เปิดได้<strong>เฉพาะบนเครื่องพัฒนา</strong> (<code>next dev</code>) บนเซิร์ฟเวอร์จริงจะได้ <code>404</code>
  · กดลองยิงได้จริง ยิงไปที่เซิร์ฟเวอร์เดียวกับหน้านี้
  · เป็นนักเรียนให้ยิง <code>POST /api/join</code> ก่อน · เป็นครูให้ยิง <code>POST /api/teacher/login</code> ก่อน
  แล้วเบราว์เซอร์จะถือคุกกี้ให้เอง (<code>httpOnly</code> จึงไม่ต้องกรอกที่ปุ่ม Authorize และกรอกไม่ได้)
</div>
<div id="swagger-ui"></div>
<script src="/api-docs/swagger-ui-bundle.js"></script>
<script>
  window.ui = SwaggerUIBundle({
    url: '/api-docs/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    // ส่งคุกกี้ไปกับคำขอที่กดลองยิง (ตัวตนของ API ชุดนี้เป็นคุกกี้ ไม่ใช่ Bearer token)
    withCredentials: true,
    tryItOutEnabled: true,
    // 'list' = เห็นทุก endpoint ตั้งแต่เปิดหน้า โดยยังไม่กางรายละเอียด
    docExpansion: 'list',
    filter: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: -1,
    syntaxHighlight: { activated: true, theme: 'agate' }
  })
</script>
</body>
</html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...NO_INDEX },
  })
}

async function asset(name: string): Promise<NextResponse> {
  const entry = ASSETS[name]
  if (!entry) return notFound()

  const path = assetPath(entry.file)
  if (!path) {
    // devDependency ยังไม่ได้ติดตั้ง — บอกให้ตรงจุด ไม่ปล่อยให้เป็นหน้าขาว
    return new NextResponse(
      'ไม่พบ swagger-ui-dist — รัน `npm install` ก่อน (เป็น devDependency ของโปรเจกต์)',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
    )
  }

  const body = await readFile(path)
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    // ตัวอ่านเป็นไฟล์คงที่ของแพ็กเกจ แคชในเบราว์เซอร์ได้ (ต่างจาก spec ที่ต้องสดทุกครั้ง)
    headers: { 'content-type': entry.mime, 'cache-control': 'private, max-age=3600', 'x-robots-tag': 'noindex, nofollow' },
  })
}

export async function GET(_request: Request, ctx: { params: Promise<{ asset?: string[] }> }) {
  if (!docsEnabled()) return notFound()

  const segments = (await ctx.params).asset ?? []
  if (segments.length === 0) return page()
  if (segments.length > 1) return notFound()

  const name = segments[0] ?? ''
  if (name === 'openapi.json') {
    return NextResponse.json(openApiSpec, { headers: NO_INDEX })
  }
  return asset(name)
}

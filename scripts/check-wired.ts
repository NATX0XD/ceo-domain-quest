/**
 * ตรวจของที่ "เขียนเสร็จ มีเทสต์ครบ แต่ไม่มีใครเรียก" — ของกำพร้า
 *
 * รัน: npm run check:wired          (ไม่ต้องมี dev server ไม่ต้องมีฐานข้อมูล อ่านไฟล์อย่างเดียว)
 *      npm run check:wired -- --strict   คืนรหัสออก 1 เมื่อเจอของกำพร้า (เอาไว้ใส่ CI ทีหลัง)
 *
 * ทำไมต้องมี: ในโปรเจกต์นี้บั๊กแบบเดียวกันเกิดซ้ำอย่างน้อย 3 รอบ —
 * โมดูลถูกเขียนจนจบ มีเทสต์ผ่านหมด แต่ไม่มีใครนำเข้าไปใช้ จึงไม่ทำงานจริงและไม่มีใครรู้
 * (คอมโพเนนต์ประเมินตนเอง 259 บรรทัด · ภาพร้าน 6 ขั้น · touchStudentPresence ที่ทำให้คู่หูจับคู่ไม่ได้เลย)
 * เทสต์จับไม่ได้เพราะเทสต์เองก็เป็นคนเรียก สคริปต์นี้จึง **ไม่นับการเรียกจากไฟล์เทสต์**
 *
 * วิธีตรวจ: อ่านคำสั่ง export ของทุกไฟล์ แล้วอ่านคำสั่ง import ของทุกไฟล์ที่ไม่ใช่เทสต์
 * ชื่อไหนไม่มีใครนำเข้าเลย = กำพร้า · ไฟล์ไหนไม่มีใครนำเข้าเลยทั้งไฟล์ = กำพร้าทั้งไฟล์ (หนักสุด)
 *
 * แยก "กำพร้าจริง" ออกจาก "ตั้งใจให้เป็นของสำรอง" ด้วย 3 ทาง ไม่ให้เตือนมั่ว
 *   1. ทางเข้าของเฟรมเวิร์ก (app/**\/page.tsx · route.ts · layout.tsx · scripts/* ฯลฯ) Next.js เรียกเองตามชื่อไฟล์
 *   2. เขียน `@wired-optional <เหตุผล>` ไว้ในคอมเมนต์เหนือ export นั้น
 *   3. รายการยกเว้นที่มีเหตุผลกำกับใน ALLOWLIST ข้างล่าง
 *
 * ข้อจำกัดที่ต้องรู้ (สคริปต์นี้อ่านตัวหนังสือ ไม่ได้คอมไพล์):
 * - เรียกผ่านสตริงล้วน ๆ (ชื่อฟังก์ชันที่ประกอบขึ้นตอนรัน) จับไม่ได้ ถือว่าไม่มีใครใช้
 * - `import * as x` นับว่าใช้ทุกชื่อในไฟล์นั้น เพื่อไม่ให้เตือนผิด
 * - รายการที่ออกมาคือ "จุดที่ควรไปดูด้วยตา" ไม่ใช่คำสั่งให้ลบ
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'

const ROOT = process.cwd()
const STRICT = process.argv.includes('--strict')
const SCAN_DIRS = ['app', 'components', 'core', 'lib', 'scripts']
const CODE_EXT = ['.ts', '.tsx']

/* ───────────────────────── รายการยกเว้นที่ตั้งใจ ───────────────────────── */

/** ไฟล์ที่เฟรมเวิร์กเรียกเองตามชื่อ ไม่มีใครต้อง import */
const FRAMEWORK_FILES = [
  /(^|\/)page\.tsx$/,
  /(^|\/)layout\.tsx$/,
  /(^|\/)route\.ts$/,
  /(^|\/)error\.tsx$/,
  /(^|\/)global-error\.tsx$/,
  /(^|\/)not-found\.tsx$/,
  /(^|\/)loading\.tsx$/,
  /(^|\/)template\.tsx$/,
  /(^|\/)default\.tsx$/,
  /(^|\/)middleware\.ts$/,
  /(^|\/)opengraph-image\.tsx$/,
  /(^|\/)icon\.tsx$/,
  /(^|\/)sitemap\.ts$/,
  /(^|\/)robots\.ts$/,
  /(^|\/)instrumentation\.ts$/,
  /\.config\.ts$/,
  /\.d\.ts$/,
]

/** สคริปต์สั่งรันตรงจาก npm/tsx — เป็นทางเข้าอยู่แล้ว */
function isEntryScript(file: string): boolean {
  return file.startsWith('scripts/')
}

/**
 * ชื่อที่เฟรมเวิร์กเรียกเองแม้อยู่ในไฟล์ธรรมดา
 * (route handler กับตัวตั้งค่าของ Next ที่ประกาศชื่อตายตัว)
 */
const FRAMEWORK_NAMES = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'metadata',
  'generateMetadata',
  'generateStaticParams',
  'dynamic',
  'revalidate',
  'runtime',
  'fetchCache',
  'preferredRegion',
  'maxDuration',
  'viewport',
  'default',
])

/**
 * ของกำพร้าที่ **จ่ายงานไปแล้ว** ว่าใครต้องต่อสายและต่อที่ไหน (T75)
 *
 * ยังขึ้นในรายงานเหมือนเดิม แต่แยกกองออกจาก "ยังไม่มีเจ้าภาพ" เพื่อให้ตัวเลขพาดหัว
 * ตอบคำถามว่า "เหลืออะไรที่ยังไม่มีใครรับผิดชอบ" ไม่ใช่ตัวเลขที่ค้างเท่าเดิมทุกสัปดาห์
 *
 * `name` ว่าง = ทั้งไฟล์ · ต่อสายเสร็จเมื่อไรให้ลบบรรทัดออกจากที่นี่ ไม่ใช่ปล่อยไว้
 */
const PENDING_WIRING: Array<{ file: string; name?: string; to: string }> = [
  { file: 'core/report.ts', name: 'classStatistics', to: 'app/api/teacher/report/class/route.ts — เรียกแทนการคิดสถิติเองในเส้นทาง (ได้ความตรงกันของ AI กับครูมาด้วย)' },
  { file: 'core/report.ts', name: 'objectiveOutcomes', to: 'app/api/teacher/report/class/route.ts — ตารางผลรายจุดประสงค์ครบ 6 ข้อ (ตัวชี้วัด K1 K2 K4)' },
  { file: 'core/report.ts', name: 'adaptiveEvidence', to: 'app/api/teacher/report/student/route.ts — ร่องรอยปรับเหมาะ "ระบบเสนอ X เลือก Y เอง" ที่สไลด์อ้างถึง' },
  { file: 'core/report.ts', name: 'evidenceSentences', to: 'app/api/teacher/report/student/route.ts — ประโยคพร้อมขึ้นจอของร่องรอยปรับเหมาะ' },
  { file: 'core/efficiency.ts', name: 'efficiencyE1BySetting', to: 'app/api/teacher/report/class/route.ts — แยก E1 งานในคาบกับงานที่บ้าน ตามข้อควรระวังท้ายสเปกข้อ 9.3' },
  { file: 'core/content-filter.ts', name: 'safeToShowPeers', to: 'components/server/moderation.ts — เรียกแทนการตั้ง sharedWithPeers เองซ้ำ (คอมเมนต์ที่นั่นอ้างฟังก์ชันนี้อยู่แล้ว)' },
  { file: 'core/content-library.ts', name: 'checkReservedName', to: 'components/server/domain-registry.ts:53 — reservedNameHit() ทำงานซ้ำกันและทิ้ง needsTeacherReview ที่สเปก 11.13 ต้องใช้' },
  { file: 'core/content-library.ts', name: 'reservedListGaps', to: 'app/api/teacher/** — บอกครูว่ากลุ่มคำสงวนกลุ่มไหนยังไม่มีรายการให้ตรวจ' },
  { file: 'core/content-library.ts', name: 'clipScenes', to: 'เจ้าของหน้าภารกิจ — สตอรีบอร์ดคลิปตามสเปก 11.x ยังไม่มีหน้าจอ' },
  { file: 'core/content-library.ts', name: 'findBonusMission', to: 'เจ้าของ app/api + หน้าจอ — ภารกิจเสริม X1 X2 X3 (สเปก 11.7) นำเข้าเนื้อหาแล้วแต่ยังไม่มีเส้นทางให้เล่น' },
  { file: 'core/content-library.ts', name: 'BONUS_COUNTS_STARS', to: 'เจ้าของเส้นทางภารกิจเสริม — กติกาว่าภารกิจเสริมไม่นับดาว' },
  { file: 'core/content-library.ts', name: 'objectivesMentioned', to: 'app/api/ceo (ตรวจใบเสนอ) — คำสำคัญสำรองรายจุดประสงค์ตามสเปก 11.5 ใช้ตอน AI ใช้ไม่ได้' },
  { file: 'core/personalize.ts', name: 'nextHintLevel', to: 'app/api/hint/route.ts — ระบบยื่นคำใบ้ให้เองเมื่อผิดครบจำนวน (ตอนนี้ปล่อยเมื่อกดขอเท่านั้น)' },
  { file: 'core/personalize.ts', name: 'missionDifficulty', to: 'เจ้าของหน้าภารกิจ + app/api/mission — เสนอระดับพื้นฐาน/ท้าทายจากผลก่อนเรียน (เอกสารออกแบบข้อ 673)' },
  { file: 'core/content-library-answers.ts', to: 'app/api/mission/[id]/check/route.ts — เปลี่ยนมาเรียก gradeMissionCheck() แทนการอ่านไฟล์เฉลยเองด้วย schema คนละชุด' },
  { file: 'core/alt-item.ts', to: 'app/api/mission/[id]/check/route.ts — ข้อสำรอง S-20 (จ่ายไว้ตั้งแต่ T69)' },
  { file: 'components/self-assess/alt-item-offer.tsx', to: 'เจ้าของหน้าภารกิจ — วางการ์ดข้อเสนอ (จ่ายไว้ตั้งแต่ T69)' },
  { file: 'components/self-assess/next-goal-panel.tsx', to: 'app/result/page.tsx — วางต่อจาก <SelfAssessPanel/> (จ่ายไว้ตั้งแต่ T69)' },
]

/** ไฟล์ที่สร้างจากเครื่องมือ ไม่ได้เขียนเอง — เตือนไปก็แก้ไม่ได้ */
const GENERATED_FILES = ['lib/db/types.ts']

/** ยกเว้นเฉพาะจุด — ต้องมีเหตุผลกำกับเสมอ ห้ามใส่ชื่อเปล่า */
const ALLOWLIST: Array<{ file: string; name: string; reason: string }> = [
  {
    file: 'core/statistics.ts',
    name: 'hedgesCorrection',
    reason: 'สูตรย่อยที่แยกออกมาให้เทสต์ยืนยันตัวคูณได้ตรง ๆ ตัวจริงเรียกผ่าน effectSize()',
  },
]

/* ───────────────────────── อ่านไฟล์ ───────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, out)
      continue
    }
    if (CODE_EXT.some((ext) => entry.endsWith(ext))) out.push(relative(ROOT, full))
  }
  return out
}

function isTestFile(file: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(file) || file.includes('/__tests__/')
}

/* ───────────────────────── หา export ───────────────────────── */

type ExportKind = 'value' | 'type' | 'default'

interface ExportedName {
  name: string
  kind: ExportKind
  line: number
  /** เหตุผลที่ตั้งใจให้ไม่มีคนเรียก (จาก @wired-optional หรือ ALLOWLIST) */
  intentional: string | null
}

const DECLARATION =
  /^\s*export\s+(?:declare\s+)?(?:async\s+)?(abstract\s+class|class|function\*?|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/

/** เหนือ export บรรทัดนี้เป็นคอมเมนต์ที่ติดป้าย @wired-optional ไว้ไหม */
function optionalMarker(lines: string[], index: number): string | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const line = lines[i]!.trim()
    const isComment = line.startsWith('*') || line.startsWith('//') || line.startsWith('/*') || line.endsWith('*/')
    if (line === '') continue
    if (!isComment) return null
    const hit = /@wired-optional\s*(.*)$/.exec(line.replace(/\*\/\s*$/, ''))
    if (hit) return hit[1]!.trim() || 'ทำเครื่องหมายไว้ว่าเป็นของสำรอง'
  }
  return null
}

function exportsOf(file: string, source: string): ExportedName[] {
  const lines = source.split('\n')
  const found: ExportedName[] = []
  const push = (name: string, kind: ExportKind, line: number) => {
    if (found.some((e) => e.name === name)) return
    const allow = ALLOWLIST.find((a) => a.file === file && a.name === name)
    found.push({ name, kind, line, intentional: allow?.reason ?? optionalMarker(lines, line - 1) })
  }

  lines.forEach((raw, index) => {
    const declaration = DECLARATION.exec(raw)
    if (declaration) {
      const keyword = declaration[1]!
      push(declaration[2]!, keyword === 'interface' || keyword === 'type' ? 'type' : 'value', index + 1)
    }
    if (/^\s*export\s+default\b/.test(raw)) push('default', 'default', index + 1)
  })

  // export { a, b as c } — ครอบหลายบรรทัดได้ · `export { type X }` รายตัวก็นับเป็นชนิดข้อมูล
  for (const match of source.matchAll(/export\s+(type\s+)?\{([^}]*)\}/g)) {
    const line = source.slice(0, match.index).split('\n').length
    const allTypes = Boolean(match[1])
    for (const part of match[2]!.split(',')) {
      const piece = part.trim()
      if (!piece) continue
      const isType = allTypes || /^type\s+/.test(piece)
      const alias = /\sas\s+([A-Za-z_$][\w$]*)\s*$/.exec(piece)
      const name = (alias?.[1] ?? piece.replace(/^type\s+/, '')).trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) push(name, isType ? 'type' : 'value', line)
    }
  }

  return found
}

/**
 * เหลือแต่เนื้อโค้ดจริงก่อนนับการใช้งานในไฟล์ตัวเอง
 *
 * ตัดทิ้ง 3 อย่างที่ทำให้นับเกิน:
 * - คอมเมนต์ (ชื่อที่ถูกพูดถึงใน JSDoc ไม่ใช่การเรียกใช้)
 * - คำสั่ง import (ชื่อซ้ำจากการตั้งนามแฝง เช่น `import { ShopScene as ShopSceneUI }`)
 * - รายชื่อในวงเล็บปีกกาของ export (แค่ประกาศส่งออก ไม่ใช่การใช้งาน)
 */
function bodyOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/import\s+[\s\S]*?\s*from\s*['"][^'"]*['"]/g, ' ')
    .replace(/import\s+['"][^'"]*['"]/g, ' ')
    .replace(/export\s+(?:type\s+)?\{[^}]*\}(\s*from\s*['"][^'"]*['"])?/g, ' ')
}

/**
 * ชื่อนี้ถูกใช้ในไฟล์ของตัวเองไหม (นอกจากบรรทัดที่ประกาศ)
 *
 * แยกเคสนี้ออกมาเพราะมันไม่ใช่ของกำพร้า — ฟีเจอร์ทำงานจริง แค่ export กว้างไว้ให้เทสต์ยิงตรง ๆ
 * เช่น ค่าคงที่เกณฑ์ต่าง ๆ ที่ฟังก์ชันในไฟล์เดียวกันเรียกใช้อยู่แล้ว
 */
function usedInOwnFile(cleanSource: string, name: string): boolean {
  const matches = cleanSource.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g'))
  return (matches?.length ?? 0) > 1
}

/* ───────────────────────── หา import ───────────────────────── */

interface ImportUse {
  /** เส้นทางที่เขียนไว้ในคำสั่ง import */
  specifier: string
  names: string[]
  /** import * as x — นับว่าใช้ทุกชื่อของไฟล์นั้น */
  wildcard: boolean
}

function importsOf(source: string): ImportUse[] {
  const uses: ImportUse[] = []

  // import ... from 'x'  ·  export ... from 'x'  (การส่งต่อก็นับว่าใช้)
  const statement = /(?:import|export)\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g
  for (const match of source.matchAll(statement)) {
    const clause = match[1]!
    const specifier = match[2]!
    if (/\*\s+as\s+/.test(clause) || clause.trim() === '*') {
      uses.push({ specifier, names: [], wildcard: true })
      continue
    }
    const names: string[] = []
    const braces = /\{([\s\S]*?)\}/.exec(clause)
    if (braces) {
      for (const part of braces[1]!.split(',')) {
        const piece = part.trim().replace(/^type\s+/, '')
        if (!piece) continue
        const original = piece.split(/\s+as\s+/)[0]!.trim()
        if (/^[A-Za-z_$][\w$]*$/.test(original)) names.push(original)
      }
    }
    const defaultImport = /^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause.replace(/\{[\s\S]*?\}/, ''))
    if (defaultImport) names.push('default')
    uses.push({ specifier, names, wildcard: false })
  }

  // import('x') แบบไดนามิก — ไม่รู้ว่าหยิบชื่อไหน จึงนับว่าใช้ทั้งไฟล์
  for (const match of source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    uses.push({ specifier: match[1]!, names: [], wildcard: true })
  }

  // import 'x' เฉย ๆ (ผลข้างเคียง) — ถือว่าไฟล์นั้นถูกใช้ แต่ไม่ได้ใช้ชื่อไหน
  for (const match of source.matchAll(/import\s+['"]([^'"]+)['"]/g)) {
    uses.push({ specifier: match[1]!, names: [], wildcard: false })
  }

  return uses
}

/** แปลงเส้นทางใน import ให้เป็นไฟล์จริงในโปรเจกต์ (null = ของนอกโปรเจกต์) */
function resolveSpecifier(fromFile: string, specifier: string, known: Set<string>): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = resolve(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(ROOT, dirname(fromFile), specifier)
  else return null

  const candidates = [
    base,
    ...CODE_EXT.map((ext) => base + ext),
    ...CODE_EXT.map((ext) => join(base, `index${ext}`)),
  ]
  for (const candidate of candidates) {
    const rel = relative(ROOT, candidate)
    if (known.has(rel)) return rel
  }
  return null
}

/* ───────────────────────── ประกอบรายงาน ───────────────────────── */

interface Orphan {
  file: string
  name: string
  /** จ่ายงานไปแล้วว่าใครต้องต่อ — ว่าง = ยังไม่มีเจ้าภาพ */
  pending: string | null
  kind: ExportKind
  line: number
  /** มีแต่ไฟล์เทสต์ที่เรียก — อาการของบั๊กที่เกิดซ้ำ */
  testsOnly: boolean
}

function main(): void {
  const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)))
  const known = new Set(files)
  const source = new Map(files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')] as const))

  /** ไฟล์ -> ชื่อที่ถูกโค้ดจริง (ไม่ใช่เทสต์) นำเข้าไปใช้ */
  const usedByCode = new Map<string, Set<string>>()
  const usedByTest = new Map<string, Set<string>>()
  const wildcardFiles = new Set<string>()
  const touchedByCode = new Set<string>()

  for (const [file, text] of source) {
    const fromTest = isTestFile(file)
    for (const use of importsOf(text)) {
      const target = resolveSpecifier(file, use.specifier, known)
      if (!target || target === file) continue
      const bucket = fromTest ? usedByTest : usedByCode
      if (!bucket.has(target)) bucket.set(target, new Set())
      for (const name of use.names) bucket.get(target)!.add(name)
      if (use.wildcard) wildcardFiles.add(target)
      if (!fromTest) touchedByCode.add(target)
    }
  }

  const orphans: Orphan[] = []
  const orphanFiles: string[] = []
  const skipped = { framework: 0, marked: 0, allowlisted: 0, types: 0, internal: 0 }

  for (const file of files) {
    if (isTestFile(file)) continue

    if (GENERATED_FILES.includes(file)) continue
    const frameworkFile = FRAMEWORK_FILES.some((re) => re.test(file)) || isEntryScript(file)
    const declared = exportsOf(file, source.get(file)!)
    if (declared.length === 0) continue

    if (frameworkFile) {
      skipped.framework += declared.length
      continue
    }

    const codeNames = usedByCode.get(file) ?? new Set<string>()
    const testNames = usedByTest.get(file) ?? new Set<string>()
    const everything = wildcardFiles.has(file)
    const clean = bodyOnly(source.get(file)!)

    const fileOrphans: Orphan[] = []
    for (const item of declared) {
      if (item.intentional) {
        if (ALLOWLIST.some((a) => a.file === file && a.name === item.name)) skipped.allowlisted += 1
        else skipped.marked += 1
        continue
      }
      if (FRAMEWORK_NAMES.has(item.name)) {
        skipped.framework += 1
        continue
      }
      if (everything || codeNames.has(item.name)) continue
      if (item.kind === 'type') {
        // ชนิดข้อมูลที่ไม่มีใครใช้ไม่ทำให้ฟีเจอร์ตาย แค่รก จึงนับแยกไม่เอามาปน
        if (!testNames.has(item.name)) skipped.types += 1
        continue
      }
      if (usedInOwnFile(clean, item.name)) {
        // ฟีเจอร์เดินอยู่ในไฟล์ตัวเอง แค่ export ออกมาให้เทสต์ยิงตรง ๆ ไม่ใช่ของกำพร้า
        skipped.internal += 1
        continue
      }
      const dispatched = PENDING_WIRING.find(
        (w) => w.file === file && (w.name === undefined || w.name === item.name),
      )
      fileOrphans.push({
        file,
        name: item.name,
        kind: item.kind,
        line: item.line,
        testsOnly: testNames.has(item.name),
        pending: dispatched?.to ?? null,
      })
    }

    // ไม่มีโค้ดจริงไฟล์ไหน import ไฟล์นี้เลย = ทั้งไฟล์ไม่ได้ถูกต่อเข้าระบบ หนักกว่าขาดไปทีละชื่อ
    if (!touchedByCode.has(file) && fileOrphans.length > 0) orphanFiles.push(file)
    orphans.push(...fileOrphans)
  }

  /* ───────── พิมพ์รายงาน ───────── */

  const say = (text = '') => console.log(text)
  const orphanFileSet = new Set(orphanFiles)

  say('ตรวจของที่ export แล้วไม่มีใครเรียก (ไม่นับการเรียกจากไฟล์เทสต์)')
  say(`สแกน ${files.length} ไฟล์ใน ${SCAN_DIRS.join(' · ')}`)
  say()

  const dispatchedFiles = orphanFiles.filter((f) => orphans.some((o) => o.file === f && o.pending))
  const openFiles = orphanFiles.filter((f) => !dispatchedFiles.includes(f))

  if (openFiles.length > 0) {
    say(`■ กำพร้าทั้งไฟล์ ยังไม่มีเจ้าภาพ — ไม่มีโค้ดจริงไฟล์ไหน import เลย (${openFiles.length})`)
    for (const file of openFiles) {
      const items = orphans.filter((o) => o.file === file)
      const testsOnly = items.some((o) => o.testsOnly)
      say(`   ${file}  (${items.map((o) => o.name).join(', ')})${testsOnly ? '  · มีเทสต์เรียกอยู่ตัวเดียว' : ''}`)
    }
    say()
  }

  const loose = orphans.filter((o) => !orphanFileSet.has(o.file))
  const open = loose.filter((o) => !o.pending)
  const openTestsOnly = open.filter((o) => o.testsOnly)
  const openNever = open.filter((o) => !o.testsOnly)

  if (openTestsOnly.length > 0) {
    say(`■ เรียกจากไฟล์เทสต์เท่านั้น ยังไม่มีเจ้าภาพ — เขียนเสร็จ เทสต์ผ่าน แต่ของจริงไม่ได้ใช้ (${openTestsOnly.length})`)
    for (const o of openTestsOnly) say(`   ${o.file}:${o.line}  ${o.name}`)
    say()
  }

  if (openNever.length > 0) {
    say(`■ ไม่มีใครเรียกเลยแม้แต่เทสต์ ยังไม่มีเจ้าภาพ (${openNever.length})`)
    for (const o of openNever) say(`   ${o.file}:${o.line}  ${o.name}`)
    say()
  }

  // จ่ายงานแล้ว = ยังกำพร้าอยู่จริง แต่รู้แล้วว่าใครต้องต่อ แยกออกไม่ให้กลบของที่ยังไม่มีคนรับ
  const dispatched = loose.filter((o) => o.pending)
  const dispatchedCount = dispatched.length + dispatchedFiles.length
  if (dispatchedCount > 0) {
    say(`▫ จ่ายงานแล้ว รอเจ้าของไฟล์อื่นต่อสาย (${dispatchedCount})`)
    for (const file of dispatchedFiles) {
      const item = orphans.find((o) => o.file === file && o.pending)!
      say(`   ${file}  (ทั้งไฟล์)`)
      say(`      -> ${item.pending}`)
    }
    for (const o of dispatched) {
      say(`   ${o.file}:${o.line}  ${o.name}`)
      say(`      -> ${o.pending}`)
    }
    say()
  }

  const openTotal = openFiles.length + open.length
  if (openTotal + dispatchedCount === 0) say('■ ไม่พบของกำพร้า')

  say('ข้ามให้เพราะไม่ใช่ของกำพร้า:')
  say(`   ทางเข้าเฟรมเวิร์ก (page/route/layout/scripts) ${skipped.framework}`)
  say(`   ใช้อยู่ในไฟล์ตัวเอง แค่ export ไว้ให้เทสต์ยิง ${skipped.internal}`)
  say(`   ติดป้าย @wired-optional ไว้ ${skipped.marked} · อยู่ในรายการยกเว้น ${skipped.allowlisted}`)
  say(`   ชนิดข้อมูล (interface/type) ที่ยังไม่มีใครใช้ ${skipped.types} — รกแต่ไม่ทำให้ฟีเจอร์ตาย`)
  say()
  say(`สรุป: ยังไม่มีเจ้าภาพ ${openFiles.length} ไฟล์ · ${open.length} ชื่อ · จ่ายงานแล้วรอต่อสาย ${dispatchedCount}`)
  say('ถ้าตัวไหนตั้งใจให้เป็นของสำรอง เขียน @wired-optional พร้อมเหตุผลไว้เหนือ export นั้น แล้วจะไม่ถูกเตือนอีก')

  const total = openTotal
  if (STRICT && total > 0) process.exit(1)
}

main()

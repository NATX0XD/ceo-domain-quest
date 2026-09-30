// ตรวจความพร้อมก่อน deploy — รันได้ทั้งกับ local และกับโปรเจกต์คลาวด์ที่ link ไว้
//
//   npx tsx scripts/check-deploy.ts            ตรวจกับ DB ที่ SUPABASE_URL ชี้อยู่
//   npx tsx scripts/check-deploy.ts --linked   ตรวจรายการ migration กับโปรเจกต์ที่ supabase link ไว้
//
// อ่านอย่างเดียว ไม่แก้ข้อมูลใด ๆ · exit 1 ถ้ามีข้อไม่ผ่าน

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { getServiceClient } from '../lib/db/client'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

type Status = 'pass' | 'fail' | 'warn'
type Result = { status: Status; title: string; detail: string }

const results: Result[] = []
const add = (status: Status, title: string, detail: string): void => {
  results.push({ status, title, detail })
}

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')

/** ไฟล์/โฟลเดอร์ที่ไม่ได้ commit หรือใหญ่เกินจะสแกน */
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.turbo', 'dist', 'supabase/.temp'])
/**
 * สแกน **ทุกไฟล์** ในโปรเจกต์ ยกเว้นไฟล์ลับที่ไม่ถูก commit (.env.local / *.local)
 * ข้ามเฉพาะไฟล์ไบนารีกับไฟล์ใหญ่เกิน เพราะอ่านเป็นข้อความไม่ได้อยู่แล้ว
 */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
  '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.mp4', '.wav', '.webm', '.glb', '.gltf', '.bin',
])
const MAX_SCAN_BYTES = 2 * 1024 * 1024

/** ตารางและ rpc ที่ต้องมีครบบนปลายทาง ถ้าขาดแปลว่า migration ขึ้นไม่ครบ */
const REQUIRED_TABLES = [
  'teachers', 'classrooms', 'students', 'profiles', 'progress', 'submissions', 'events',
  'route_changes', 'reflections', 'mission_progress', 'peer_feedback',
  'mission_skips', 'chat_messages', 'voice_submissions', 'grade_jobs',
  // รอบ T39: ครูคุมช่วงของคาบ · แบบสอบถาม · คู่หู
  'class_sessions', 'session_phase_changes', 'student_phase_unlocks',
  'survey_responses', 'survey_completions', 'buddy_requests', 'buddy_offers',
  // รอบ T43: ครูแก้แผนรายคน · บันทึกการโค้ช · ข้อความถึงทั้งห้อง
  'teacher_overrides', 'teacher_notes', 'broadcasts',
  // รอบ T45: คิวเรื่องราวเฉพาะคน · ธงคำไม่เหมาะสม
  'story_jobs', 'content_flags', 'plan_requests', 'teacher_password_resets',
  // รอบ T59: คำตอบรายข้อของแบบทดสอบ (ค่าความยาก p / อำนาจจำแนก r บนหน้ารายงาน)
  'quiz_item_responses',
]

/**
 * คอลัมน์ที่ "โค้ดวันนี้อ่าน/เขียนจริง" และเพิ่งถูกเพิ่มทีหลัง
 *
 * ทำไมต้องตรวจถึงระดับคอลัมน์: ตารางมีครบไม่ได้แปลว่า migration ขึ้นครบ
 * ถ้า push ไปแค่บางไฟล์ ตารางจะมีครบแต่คอลัมน์ใหม่หาย แล้วไปพังตอนมีคนใช้งานจริง
 * เช่น `classrooms.is_demo` หาย = ปุ่มล้างห้องสาธิตพัง · `submissions.teacher_scores_before` หาย
 * = ครูกดยืนยันคะแนนแล้ว 500 ทั้งห้อง
 */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  classrooms: ['status', 'is_demo'],
  submissions: [
    'format', 'emphasis_criterion', 'needs_review', 'confirmed_at', 'pinned_at',
    'self_scores', 'ai_scores_snapshot', 'teacher_confirmed_scores', 'teacher_scores_before',
  ],
  profiles: [
    'readiness', 'learning_route', 'channel_suggested', 'channel_chosen_by',
    'goal_stars', 'earned_stars', 'scaffold_level', 'pre_test_score', 'post_test_score',
    'domain_name', 'audience',
  ],
  class_sessions: [
    'phase', 'phase_minutes', 'class_minutes',
    'pretest_enabled', 'posttest_enabled', 'showcase_enabled',
  ],
  mission_progress: ['stars', 'passed_at', 'channel_used', 'skipped_by'],
  students: ['last_seen_at', 'current_screen', 'buddy_helped_count', 'must_change_pin'],
  content_flags: ['student_id'],
  quiz_item_responses: ['quiz_set', 'item_id', 'is_correct', 'choice_index'],
  plan_requests: ['status', 'granted_value', 'teacher_response'],
  peer_feedback: ['hidden_at'],
  voice_submissions: ['expires_at'],
}
const REQUIRED_RPCS = [
  'rls_status', 'recalc_student_stars', 'classroom_showcase', 'increment_mission_hint',
  'confirm_submission_scores', 'expire_voice_submissions', 'delete_voice_submission',
  'claim_next_grade_job', 'reclaim_stale_grade_jobs', 'complete_grade_job', 'fail_grade_job',
  'ensure_class_session', 'set_session_phase', 'revert_session_phase', 'extend_session_timer',
  'pause_session_timer', 'set_focus_screen', 'unlock_student_phase',
  'submit_survey_response', 'survey_summary',
  'find_buddy_candidates', 'create_buddy_request', 'respond_buddy_offer', 'expire_buddy_offers',
  'student_report', 'classroom_report',
  'teacher_set_mission_level', 'teacher_allow_skip', 'teacher_force_pass', 'teacher_reset_pin',
  'teacher_set_scaffold', 'teacher_open_boss', 'teacher_add_note',
  'teacher_hide_feedback', 'teacher_pin_submission', 'pinned_showcase',
  'send_broadcast', 'set_test_window', 'classroom_report_raw', 'student_override_history',
  'claim_next_story_job', 'reclaim_stale_story_jobs', 'complete_story_job', 'fail_story_job',
  'find_student_story_job', 'record_content_flag', 'classroom_content_flags', 'resolve_content_flag',
  'record_pre_join_content_flag', 'record_mission_skip', 'teacher_skip_mission',
  'set_class_plan', 'create_plan_request', 'classroom_plan_requests', 'respond_plan_request',
  'set_home_deadline', 'home_write_blocked',
  'buddy_candidates_raw', 'cancel_buddy_request', 'classroom_open_buddy_requests',
  'classroom_buddy_helped_counts', 'issue_teacher_password_reset',
  'verify_teacher_password_reset', 'consume_teacher_password_reset',
  // เก็บตกของที่โค้ดเรียกมาตลอดแต่รายการนี้ไม่เคยตรวจ (ไล่จาก .rpc(' ทั้งโปรเจกต์)
  'add_peer_feedback', 'students_without_feedback', 'classroom_voice_paths',
  'record_mission_attempt', 'record_route_change', 'record_level_override', 'set_self_goal',
  'switch_learning_route', 'touch_student_presence', 'teacher_unlock_business',
  'teacher_set_boss_template', 'revoke_student_phase_unlock', 'update_session_settings',
  'set_session_timer', 'close_class_session', 'purge_teacher_password_resets',
  'offer_buddy_request', 'complete_buddy_request',
  // รอบ T59: คำตอบรายข้อ + แผ่นคำตอบให้หน้ารายงาน (ห้ามคืน choice_index พร้อม is_correct)
  'record_quiz_item_responses', 'classroom_quiz_item_sheets',
  // รอบ T62: เลิก .in() รายชื่อ uuid ทั้งห้อง (ห้องเกิน 200 คนแล้ว URI ยาวเกิน = 500)
  'classroom_screen_stats', 'classroom_peer_feedback', 'classroom_efficiency_raw',
  // รอบ T71: ปุ่มล้างห้องสาธิต
  'reset_demo_classroom',
  // รอบ T79: ครูยืนยันคะแนนหลังหมดเขต + สวิตช์ปิด AI (ตัวไล่จากซอร์สข้างล่างก็เจอเองแล้ว)
  'teacher_set_mission_stars', 'session_ai_enabled',
]

/**
 * ชื่อ rpc ที่ **โค้ดเรียกจริงวันนี้** — ไล่จากซอร์ส ไม่ต้องรอให้คนมาเติมรายการด้วยมือ
 *
 * ทำไมต้องมี: `REQUIRED_RPCS` ข้างบนเป็นรายการที่คนต้องเติมเอง คืนเดียวมันตกยุค 2 รอบ
 * (T59/T62 เพิ่ม rpc แล้วไม่ได้เติม · T79 เพิ่มอีก 2 ตัวแล้วไม่ได้เติม) ซึ่งอันตรายกว่าที่คิด
 * เพราะสคริปต์จะขึ้น "ผ่าน" ทั้งที่ migration ตกหล่น แล้วไปพังกลางคาบ
 *
 * กติกา: โค้ดเขียน `.rpc('ชื่อ')` ที่ไหนก็ตาม ปลายทางต้องมีฟังก์ชันนั้น ไม่มี = ไม่ผ่าน
 * รายการมือยังอยู่เป็นตาข่ายรองสำหรับตัวที่ไม่ได้ถูกเรียกผ่าน `.rpc(` เช่น
 * ฟังก์ชันที่ SQL เรียกกันเอง (`home_write_blocked`, `buddy_candidates_raw`, `teacher_owns_student`)
 *
 * **ข้อจำกัดที่ต้องรู้** (ตั้งใจให้ตื้นและคาดเดาได้ ดีกว่าฉลาดแล้วพลาดเงียบ):
 * - จับเฉพาะชื่อที่เป็นสตริงตรง ๆ ถ้ามีใครเขียน `.rpc(name)` ด้วยตัวแปร สคริปต์จะ**เตือน** ให้ไปดูเอง
 * - ไม่ได้ตรวจชนิด/จำนวนพารามิเตอร์ แค่ตรวจว่ามีฟังก์ชันชื่อนั้นอยู่จริง
 * - ไล่จากไฟล์ .ts/.tsx ทั้งโปรเจกต์ (รวมเทสต์และสคริปต์ เพราะถ้ามันเรียก ปลายทางก็ต้องมี)
 */
const RPC_LITERAL_RE = /\.rpc\(\s*(['"`])([a-z0-9_]+)\1/g
/** `.rpc(` ที่ตามด้วยอย่างอื่นที่ไม่ใช่สตริงตรง ๆ = ไล่ชื่อให้ไม่ได้ ต้องบอกคนอ่าน */
const RPC_DYNAMIC_RE = /\.rpc\(\s*[^'"`)\s]/
const RPC_SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

function rpcNamesUsedInSource(files: string[]): {
  names: Set<string>
  scannedFiles: number
  dynamicCallFiles: string[]
} {
  const names = new Set<string>()
  const dynamicCallFiles: string[] = []
  let scannedFiles = 0

  for (const file of files) {
    const dot = file.lastIndexOf('.')
    const ext = dot > 0 ? file.slice(dot).toLowerCase() : ''
    if (!RPC_SOURCE_EXTENSIONS.has(ext)) continue
    // ไฟล์นี้เองมีสตริงตัวอย่างอยู่ในคอมเมนต์ ไม่ใช่การเรียกจริง
    if (relative(ROOT, file) === join('scripts', 'check-deploy.ts')) continue

    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    scannedFiles += 1
    if (!text.includes('.rpc(')) continue

    for (const match of text.matchAll(RPC_LITERAL_RE)) {
      const name = match[2]
      if (name) names.add(name)
    }
    if (RPC_DYNAMIC_RE.test(text)) dynamicCallFiles.push(relative(ROOT, file))
  }

  return { names, scannedFiles, dynamicCallFiles }
}
const VOICE_BUCKET = 'voice-submissions'

/** รูปแบบของ "ของลับที่ไม่ควรอยู่ในไฟล์ที่ commit ได้" */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'JWT ของ Supabase (eyJ...)', re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./ },
  { name: 'Supabase publishable/secret key', re: /\bsb_(secret|publishable)_[A-Za-z0-9_-]{10,}/ },
  { name: 'OpenAI/Typhoon style key (sk-...)', re: /\bsk-[A-Za-z0-9]{16,}/ },
  { name: 'Google API key (AIza...)', re: /\bAIza[A-Za-z0-9_-]{30,}/ },
  { name: 'postgres URL พร้อมรหัสผ่าน', re: /postgres(?:ql)?:\/\/[^\s:@]+:[^\s:@]+@(?!127\.0\.0\.1|localhost)/ },
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    if (SKIP_DIRS.has(entry) || SKIP_DIRS.has(rel)) continue
    // ยกเว้นเฉพาะไฟล์ลับของเครื่องนี้ (.env.local, .env.production.local) ที่ .gitignore กันไว้แล้ว
    if (entry === '.env.local' || entry.endsWith('.local')) continue
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, out)
      continue
    }
    const dot = entry.lastIndexOf('.')
    const ext = dot > 0 ? entry.slice(dot).toLowerCase() : ''
    if (BINARY_EXTENSIONS.has(ext)) continue
    if (stat.size > MAX_SCAN_BYTES) continue
    out.push(full)
  }
  return out
}

// ───────────────────────────────────────────── 1) env ที่ต้องมี

/**
 * ลายนิ้วมือของค่าลับ — sha256 ตัดเหลือ 8 ตัวอักษร
 *
 * ใช้เทียบว่า "ค่าบนเครื่องพัฒนา" กับ "ค่าบนเซิร์ฟเวอร์จริง" เป็นคนละตัวกัน
 * โดยไม่ต้องเอาค่าจริงมาวางเทียบกัน: รันสคริปต์สองที่แล้วดูว่าลายนิ้วมือต่างกันไหม
 * ย้อนกลับเป็นค่าเดิมไม่ได้ (ค่าสุ่ม 32+ ตัวอักษร) จึงพิมพ์ลงจอ/ลงรายงานได้
 */
function fingerprint(value: string): string {
  // ใส่เกลือคงที่ ค่าที่พิมพ์ออกมาจึงไม่ใช่แม้แต่แฮชของค่าลับตรง ๆ
  return createHash('sha256').update(`digital-biz-quest/check-deploy ${value}`).digest('hex').slice(0, 8)
}

/**
 * ค่าลับที่ "ไม่ใช่ของจริง" — เดาง่าย หรือเป็นค่าตัวอย่างที่ลอกมาจากเอกสาร
 * ห้ามพิมพ์ค่าที่ตรวจเจอออกมา รายงานแค่ว่าเข้าข่ายข้อไหน
 */
function weakSecretReason(value: string, minLength: number): string | null {
  if (value.length < minLength) return `สั้นเกินไป (${value.length} ตัว ต้องอย่างน้อย ${minLength})`

  const distinct = new Set(value).size
  if (distinct < 12) return `ตัวอักษรซ้ำกันเกินไป (ต่างกันแค่ ${distinct} ตัว ต้องอย่างน้อย 12)`

  // คำที่บอกว่าเป็นค่าชั่วคราวของเครื่องพัฒนา ไม่ใช่ค่าที่สุ่มมาจริง
  if (/(dev|test|local|demo|sample|example|change|replace|placeholder|password|secret123|12345|abcdef|qwerty)/i.test(value)) {
    return 'มีคำที่บอกว่าเป็นค่าตัวอย่าง/ค่าเครื่องพัฒนาอยู่ในนั้น'
  }
  return null
}

/** ค่าลับตัวนี้ถูกพิมพ์อยู่ในไฟล์ที่ commit ได้หรือเปล่า (= รั่วแล้ว ต้องสร้างใหม่) */
function secretAppearsInRepo(value: string): string | null {
  if (value.length < 12) return null
  for (const file of walk(ROOT)) {
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (text.includes(value)) return relative(ROOT, file)
  }
  return null
}

/**
 * ตรวจค่าลับหนึ่งตัวโดยไม่แตะค่าจริงเลย — ความยาว · ความหลากหลาย · คำต้องห้าม · รั่วในรีโป
 * `strict` (โหมด --linked) = ขาดหรืออ่อนถือว่าไม่ผ่าน · โหมดปกติแค่เตือน
 */
function checkSecret(name: string, minLength: number, strict: boolean, required: boolean): void {
  const value = process.env[name]?.trim() ?? ''
  if (value.length === 0) {
    add(required || strict ? 'fail' : 'warn', name, 'ยังไม่ได้ตั้งค่า')
    return
  }

  const weak = weakSecretReason(value, minLength)
  if (weak) {
    add('fail', name, `${weak} — สร้างใหม่ด้วย: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
    return
  }

  const leaked = secretAppearsInRepo(value)
  if (leaked) {
    add('fail', name, `ค่านี้ถูกพิมพ์อยู่ในไฟล์ ${leaked} ที่ commit ได้ — ถือว่ารั่วแล้ว ต้องสร้างค่าใหม่ทันที`)
    return
  }

  add('pass', name, `ยาว ${value.length} ตัว · ลายนิ้วมือ ${fingerprint(value)} (บนเซิร์ฟเวอร์จริงต้องได้ลายนิ้วมือ**ไม่ซ้ำ**กับของเครื่องพัฒนา)`)
}

function checkEnv(strict: boolean): void {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET']
  const missing = required.filter((k) => !process.env[k]?.trim())
  if (missing.length > 0) {
    add('fail', 'env ที่จำเป็น', `ขาด: ${missing.join(', ')} (ดู .env.example)`)
  } else {
    add('pass', 'env ที่จำเป็น', `ครบ 4 ตัว: ${required.join(', ')}`)
  }

  // คุกกี้ครู/นักเรียนเซ็นด้วยค่านี้ · ใช้ค่าเดียวกับเครื่องพัฒนา = ใครก็ปลอมคุกกี้ครูได้
  checkSecret('SESSION_SECRET', 32, strict, true)
  // worker ตรวจงานเบื้องหลังยิง POST /api/jobs/drain ด้วย header x-worker-secret
  // ไม่มีค่านี้ = ยิงได้เฉพาะด้วยคุกกี้ครู สคริปต์ grade-worker ใช้ไม่ได้
  checkSecret('GRADE_WORKER_SECRET', 24, strict, false)

  const ai = ['TYPHOON_API_KEY', 'GEMINI_API_KEY'].filter((k) => process.env[k]?.trim())
  add(
    ai.length > 0 ? 'pass' : 'warn',
    'key ของ AI',
    ai.length > 0 ? `มี: ${ai.join(', ')}` : 'ไม่มีเลย — ระบบจะใช้ตัวสำรองแบบกฎ (ยังเดโมได้)',
  )

  /**
   * ลิงก์เข้าห้อง (QR บนโปรเจกเตอร์) กับลิงก์ในใบประกาศสร้างจากค่านี้
   * ไม่ตั้ง = โค้ดตกไปใช้ http://localhost:3000 → QR บนจอชี้กลับเครื่องครู นักเรียนสแกนแล้วเข้าไม่ได้
   */
  const base = process.env.APP_BASE_URL?.trim() ?? ''
  if (base.length === 0) {
    add(strict ? 'fail' : 'warn', 'APP_BASE_URL', 'ยังไม่ได้ตั้ง — QR รหัสห้องจะชี้ไป http://localhost:3000 นักเรียนสแกนแล้วเข้าไม่ได้')
  } else if (strict && !base.startsWith('https://')) {
    add('fail', 'APP_BASE_URL', `ต้องเป็น https:// บนเซิร์ฟเวอร์จริง (ตอนนี้ขึ้นต้นด้วย ${base.split(':')[0]}:)`)
  } else {
    add('pass', 'APP_BASE_URL', base)
  }

  if (process.env.DEMO_MODE !== '0') {
    add(
      strict ? 'fail' : 'warn',
      'DEMO_MODE',
      `ยังไม่ได้ปิด (ตอนนี้ ${process.env.DEMO_MODE ?? '(ไม่ได้ตั้ง)'}) — ตั้ง DEMO_MODE=0 กันนักเรียนเลื่อนระดับตัวช่วยเอง`,
    )
  } else {
    add('pass', 'DEMO_MODE', 'ปิดแล้ว (DEMO_MODE=0)')
  }
}

// ──────────────────────────────── 2) ห้ามมี NEXT_PUBLIC_ กับของลับ

function checkPublicEnvNames(): void {
  const secretish = /(SERVICE_ROLE|SECRET|API_KEY|PASSWORD|TOKEN|PRIVATE)/i
  const offenders = Object.keys(process.env).filter(
    (k) => k.startsWith('NEXT_PUBLIC_') && secretish.test(k),
  )

  let fileOffenders: string[] = []
  for (const file of ['.env.example', '.env.local']) {
    try {
      fileOffenders = fileOffenders.concat(
        readFileSync(join(ROOT, file), 'utf8')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('NEXT_PUBLIC_') && secretish.test(l))
          .map((l) => `${file}: ${l.split('=')[0]}`),
      )
    } catch {
      // ไม่มีไฟล์ = ไม่ต้องตรวจ
    }
  }

  const all = [...offenders, ...fileOffenders]
  if (all.length > 0) {
    add('fail', 'ชื่อ env ที่ขึ้นต้น NEXT_PUBLIC_', `พบของลับถูกเปิดเผย: ${all.join(' · ')}`)
  } else {
    add('pass', 'ชื่อ env ที่ขึ้นต้น NEXT_PUBLIC_', 'ไม่มี service role / secret / api key ตัวไหนถูกตั้งเป็น NEXT_PUBLIC_')
  }
}

// ────────────────────────────── 3) ของลับหลุดในไฟล์ที่ commit ได้

function checkSecretsInRepo(): void {
  const hits: string[] = []
  let scanned = 0
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file)
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (text.includes('\u0000')) continue // ไบนารีที่นามสกุลไม่บอก
    scanned += 1
    const lines = text.split('\n')
    for (const { name, re } of SECRET_PATTERNS) {
      if (!re.test(text)) continue
      // รายงานแค่ "ไฟล์ บรรทัด ชนิด" ไม่พิมพ์ค่าคีย์ออกมาเด็ดขาด
      const lineNo = lines.findIndex((l) => re.test(l)) + 1
      hits.push(`${rel}:${lineNo || '?'} (${name})`)
    }
  }

  if (hits.length > 0) {
    add('fail', 'ของลับในไฟล์ที่ commit ได้', `${hits.length} จุด: ${hits.join(' · ')} — ย้ายค่าไป .env.local แล้วเพิกถอนคีย์ตัวนั้นทันที`)
  } else {
    add('pass', 'ของลับในไฟล์ที่ commit ได้', `สแกน ${scanned} ไฟล์ (ทุกไฟล์ ยกเว้น .env.local) ไม่พบ JWT / api key / postgres URL ที่มีรหัสผ่าน`)
  }

  try {
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8')
    const ok = ignore.includes('.env.local') || ignore.includes('.env*.local')
    add(
      ok ? 'pass' : 'fail',
      '.gitignore กัน .env.local',
      ok ? 'มีบรรทัดกัน .env*.local แล้ว' : 'ยังไม่มี .env.local ใน .gitignore',
    )
  } catch {
    add('fail', '.gitignore กัน .env.local', 'ไม่พบไฟล์ .gitignore')
  }
}

// ─────────────────────────── 4) migration ตรงกับฐานข้อมูลปลายทาง

function localMigrationVersions(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.split('_')[0] ?? '')
    .filter((v) => v.length > 0)
    .sort()
}

function checkMigrations(linked: boolean): void {
  const local = localMigrationVersions()
  add('pass', 'ไฟล์ migration ในเครื่อง', `${local.length} ไฟล์: ${local.join(', ')}`)

  let output: string
  try {
    output = execFileSync('npx', ['supabase', 'migration', 'list', linked ? '--linked' : '--local'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    add('fail', 'migration ตรงกับฐานข้อมูล', `เรียก supabase migration list ไม่สำเร็จ: ${(err as Error).message.split('\n')[0]}`)
    return
  }

  // CLI คืน JSON หนึ่งบรรทัด: {"migrations":[{"local":"...","remote":"...","time":"..."}]}
  // เผื่อเวอร์ชันที่พิมพ์เป็นตาราง จึงมีตัวอ่านแบบ │ สำรองไว้
  const applied = new Set<string>()
  const jsonLine = output.split('\n').find((line) => line.trim().startsWith('{'))
  if (jsonLine) {
    try {
      const parsed = JSON.parse(jsonLine) as { migrations?: { local?: string; remote?: string }[] }
      for (const row of parsed.migrations ?? []) {
        if (row.remote && /^\d{14}$/.test(row.remote)) applied.add(row.remote)
      }
    } catch {
      add('warn', 'อ่านผล supabase migration list', 'แปลง JSON ไม่ได้ ใช้ตัวอ่านแบบตารางแทน')
    }
  }
  if (applied.size === 0) {
    for (const line of output.split('\n')) {
      if (!line.includes('│')) continue
      const remote = line.split('│')[1]?.trim() ?? ''
      if (/^\d{14}$/.test(remote)) applied.add(remote)
    }
  }
  const notApplied = local.filter((v) => !applied.has(v))
  const extraOnRemote = [...applied].filter((v) => !local.includes(v))

  if (notApplied.length > 0) {
    add('fail', 'migration ตรงกับฐานข้อมูล', `ยังไม่ได้ push: ${notApplied.join(', ')} — สั่ง supabase db push`)
  } else if (extraOnRemote.length > 0) {
    add('warn', 'migration ตรงกับฐานข้อมูล', `ฐานข้อมูลมีเวอร์ชันที่ไม่มีไฟล์ในเครื่อง: ${extraOnRemote.join(', ')}`)
  } else {
    add('pass', 'migration ตรงกับฐานข้อมูล', `apply ครบ ${local.length} ไฟล์`)
  }
}

// ───────────── 5) ตาราง + rpc ที่ระบบต้องใช้มีครบไหม (อ่านจาก schema ของ PostgREST)

async function checkSchemaObjects(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    add('warn', 'ตาราง/rpc ที่ต้องมี', 'ข้ามการตรวจ เพราะไม่มี SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY')
    return
  }

  let paths: string[]
  let definitions: Record<string, { properties?: Record<string, unknown> }> = {}
  try {
    const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    const body = (await res.json()) as {
      paths?: Record<string, unknown>
      definitions?: Record<string, { properties?: Record<string, unknown> }>
    }
    paths = Object.keys(body.paths ?? {})
    definitions = body.definitions ?? {}
  } catch (err) {
    add('fail', 'ตาราง/rpc ที่ต้องมี', `อ่าน schema จาก PostgREST ไม่ได้: ${(err as Error).message}`)
    return
  }

  const tables = new Set(paths.filter((p) => !p.startsWith('/rpc/') && p !== '/').map((p) => p.slice(1)))
  const rpcs = new Set(paths.filter((p) => p.startsWith('/rpc/')).map((p) => p.slice(5)))

  const missingTables = REQUIRED_TABLES.filter((t) => !tables.has(t))
  add(
    missingTables.length === 0 ? 'pass' : 'fail',
    'ตารางที่ต้องมี',
    missingTables.length === 0
      ? `ครบ ${REQUIRED_TABLES.length} ตาราง (รวม grade_jobs ของคิวตรวจงาน)`
      : `ขาด: ${missingTables.join(', ')} — migration ขึ้นไม่ครบ สั่ง supabase db push`,
  )

  /**
   * ชื่อที่ต้องมี = "ที่โค้ดเรียกจริงวันนี้" ∪ "รายการมือ"
   * ตัวแรกคือของจริงที่ไล่สด ตัวหลังคือตาข่ายรองสำหรับฟังก์ชันที่ SQL เรียกกันเอง
   */
  const used = rpcNamesUsedInSource(walk(ROOT))
  const fromSourceOnly = [...used.names].filter((f) => !REQUIRED_RPCS.includes(f))
  const manualOnly = REQUIRED_RPCS.filter((f) => !used.names.has(f))
  const requiredRpcs = [...new Set([...REQUIRED_RPCS, ...used.names])]

  const missingRpcs = requiredRpcs.filter((f) => !rpcs.has(f))
  add(
    missingRpcs.length === 0 ? 'pass' : 'fail',
    'rpc ที่ต้องมี',
    missingRpcs.length === 0
      ? `ครบ ${requiredRpcs.length} ตัว — ไล่จาก .rpc(' ในซอร์สสด ${used.names.size} ตัว ` +
        `(ใหม่กว่ารายการมือ ${fromSourceOnly.length} ตัว) + รายการมืออีก ${manualOnly.length} ตัว ` +
        `ที่ไม่ได้ถูกเรียกผ่าน .rpc( (SQL เรียกกันเอง) · สแกน ${used.scannedFiles} ไฟล์`
      : `ขาด: ${missingRpcs.join(', ')} — โค้ดเรียกแต่ปลายทางไม่มี migration ขึ้นไม่ครบ สั่ง supabase db push`,
  )

  if (used.dynamicCallFiles.length > 0) {
    add(
      'warn',
      'rpc ที่ไล่ชื่อจากซอร์สไม่ได้',
      `มี .rpc(...) ที่ส่งชื่อเป็นตัวแปรใน ${used.dynamicCallFiles.length} ไฟล์: ` +
        `${used.dynamicCallFiles.join(', ')} — ตรวจชื่อพวกนี้อัตโนมัติไม่ได้ ` +
        `ถ้าเป็นฟังก์ชันใหม่ต้องเติมเข้า REQUIRED_RPCS เอง`,
    )
  }

  /**
   * ตารางครบไม่ได้แปลว่าคอลัมน์ครบ — push migration ไปครึ่งเดียวก็ได้ตารางครบแล้ว
   * PostgREST บอกคอลัมน์ของทุกตารางมาใน `definitions` อยู่แล้ว ไม่ต้องยิงเพิ่ม
   */
  const missingColumns: string[] = []
  let checkedColumns = 0
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const known = definitions[table]?.properties
    if (!known) {
      missingColumns.push(`${table} (ไม่มีตารางนี้)`)
      continue
    }
    for (const column of columns) {
      checkedColumns += 1
      if (!(column in known)) missingColumns.push(`${table}.${column}`)
    }
  }
  add(
    missingColumns.length === 0 ? 'pass' : 'fail',
    'คอลัมน์ที่ต้องมี',
    missingColumns.length === 0
      ? `ครบ ${checkedColumns} คอลัมน์ใน ${Object.keys(REQUIRED_COLUMNS).length} ตาราง`
      : `ขาด: ${missingColumns.join(', ')} — migration ขึ้นไม่ครบ สั่ง supabase db push`,
  )
}

// ────────────────────── 5.1) ห้องสาธิตต้องไม่ติดไปกับเซิร์ฟเวอร์จริง

async function checkDemoClassrooms(strict: boolean): Promise<void> {
  const { data, error } = await getServiceClient()
    .from('classrooms')
    .select('room_code')
    .eq('is_demo', true)

  if (error) {
    add('fail', 'ห้องสาธิตค้างอยู่', `อ่านตาราง classrooms ไม่ได้: ${error.message}`)
    return
  }

  if (data.length === 0) {
    add('pass', 'ห้องสาธิตค้างอยู่', 'ไม่มีห้องที่ติดป้าย is_demo บนปลายทางนี้')
    return
  }

  /**
   * ห้องสาธิตมีปุ่มล้างทั้งห้องอยู่บนหน้าครู และตัวเลขของมันเป็นข้อมูลหุ่น
   * อยู่บนเครื่องซ้อมได้ แต่ไม่ควรติดไปกับลิงก์ที่ส่งให้นักเรียนจริง
   */
  add(
    strict ? 'fail' : 'warn',
    'ห้องสาธิตค้างอยู่',
    `มี ${data.length} ห้อง: ${data.map((r) => r.room_code.trim()).join(', ')} — ลบทิ้งก่อนส่งลิงก์จริง หรือยืนยันว่าตั้งใจให้อยู่`,
  )
}

// ────────────────────── 6) bucket ไฟล์เสียงต้องมีจริงและต้องไม่เป็น public

async function checkVoiceBucket(): Promise<void> {
  const db = getServiceClient()
  const { data, error } = await db.storage.listBuckets()
  if (error || !data) {
    add('fail', `bucket ${VOICE_BUCKET}`, `อ่านรายการ bucket ไม่ได้: ${error?.message ?? 'ไม่มีข้อมูล'}`)
    return
  }

  const bucket = data.find((b) => b.name === VOICE_BUCKET)
  if (!bucket) {
    add('fail', `bucket ${VOICE_BUCKET}`, 'ยังไม่มี — ด่านบอสอัดเสียงแล้วอัปโหลดไม่ได้ (ดู docs/deploy.md ข้อ 4.1)')
  } else if (bucket.public) {
    add('fail', `bucket ${VOICE_BUCKET}`, 'ถูกตั้งเป็น public — เสียงนักเรียนเป็นข้อมูลส่วนบุคคล ต้องเป็น private เท่านั้น')
  } else {
    add('pass', `bucket ${VOICE_BUCKET}`, 'มีแล้วและเป็น private (เข้าถึงผ่าน signed URL ของครูเท่านั้น)')
  }
}

// ──────────────────────────────────────── 7) RLS + anon เข้าไม่ได้

async function checkDatabase(): Promise<void> {
  const db = getServiceClient()

  const { data, error } = await db.rpc('rls_status')
  if (error || !data) {
    add('fail', 'RLS ทุกตาราง', `เรียก public.rls_status() ไม่ได้: ${error?.message ?? 'ไม่มีข้อมูล'}`)
    return
  }

  const off = data.filter((t) => !t.rls_enabled).map((t) => t.table_name)
  const seen = new Set(data.map((t) => t.table_name))
  const uncovered = REQUIRED_TABLES.filter((t) => !seen.has(t))
  if (off.length > 0) {
    add('fail', 'RLS ทุกตาราง', `ยังไม่เปิด: ${off.join(', ')}`)
  } else if (uncovered.length > 0) {
    add('fail', 'RLS ทุกตาราง', `ตารางที่ต้องมีแต่ไม่อยู่ในรายงาน: ${uncovered.join(', ')}`)
  } else {
    add('pass', 'RLS ทุกตาราง', `เปิดครบ ${data.length} ตาราง (ต้องมีอย่างน้อย ${REQUIRED_TABLES.length})`)
  }

  // anon ต้องอ่านตารางไหนไม่ได้เลย (นักเรียนเขียนผ่าน service_role ใน API route เท่านั้น)
  const url = process.env.SUPABASE_URL?.trim()
  const anon = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !anon) {
    add('warn', 'anon เข้าตารางไม่ได้', 'ข้ามการตรวจ เพราะไม่มี SUPABASE_URL หรือ SUPABASE_ANON_KEY')
    return
  }

  const leaked: string[] = []
  for (const table of data.map((t) => t.table_name)) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    })
    if (res.ok) leaked.push(table)
  }

  if (leaked.length > 0) {
    add('fail', 'anon เข้าตารางไม่ได้', `anon อ่านได้: ${leaked.join(', ')}`)
  } else {
    add('pass', 'anon เข้าตารางไม่ได้', `ยิงด้วย anon key ครบ ${data.length} ตาราง โดนปฏิเสธทั้งหมด`)
  }
}

// ───────────────────────────────────────────────────────── รายงาน

async function main(): Promise<void> {
  const linked = process.argv.includes('--linked')
  /**
   * โหมดเข้ม = กำลังตรวจ "ปลายทางจริง" ไม่ใช่เครื่องพัฒนา
   * ข้อที่ปกติแค่เตือน (DEMO_MODE ยังเปิด · ไม่มี APP_BASE_URL · ห้องสาธิตค้าง · ไม่มี worker secret)
   * กลายเป็นไม่ผ่าน เพราะของพวกนี้บนเซิร์ฟเวอร์จริงคือของพัง ไม่ใช่ของที่ยอมได้
   */
  const strict = linked || process.argv.includes('--strict')

  checkEnv(strict)
  checkPublicEnvNames()
  checkSecretsInRepo()
  checkMigrations(linked)
  await checkSchemaObjects()
  await checkDemoClassrooms(strict)
  await checkVoiceBucket()
  await checkDatabase()

  const icon: Record<Status, string> = { pass: 'ผ่าน  ', fail: 'ไม่ผ่าน', warn: 'เตือน ' }
  console.log(
    `\nตรวจความพร้อมก่อน deploy — ปลายทาง ${process.env.SUPABASE_URL ?? '(ไม่ได้ตั้ง)'}` +
      `${strict ? ' · โหมดเข้ม (ข้อเตือนกลายเป็นไม่ผ่าน)' : ' · โหมดปกติ (ใส่ --strict เพื่อตรวจแบบเซิร์ฟเวอร์จริง)'}\n`,
  )
  for (const r of results) {
    console.log(`[${icon[r.status]}] ${r.title}`)
    console.log(`          ${r.detail}`)
  }

  const failed = results.filter((r) => r.status === 'fail').length
  const warned = results.filter((r) => r.status === 'warn').length
  console.log(`\nสรุป: ผ่าน ${results.length - failed - warned} · เตือน ${warned} · ไม่ผ่าน ${failed}`)

  if (failed > 0) {
    console.log('ยังไม่พร้อม deploy — แก้ข้อที่ "ไม่ผ่าน" ให้ครบก่อน')
    process.exit(1)
  }
  console.log('พร้อม deploy (ข้อ "เตือน" ไม่บล็อก แต่ควรอ่าน)')
}

main().catch((err: unknown) => {
  console.error('check-deploy ล้มเหลว:', err)
  process.exit(1)
})

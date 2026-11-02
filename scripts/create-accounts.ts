/**
 * Owner-only bulk account pre-creation.
 *
 * Usage:
 *   npx tsx scripts/create-accounts.ts input.csv
 *   npx tsx scripts/create-accounts.ts input.csv --output /path/accounts.csv
 *   npx tsx scripts/create-accounts.ts input.csv --dry-run
 *
 * Never logs passwords, PINs, Supabase URLs, or keys. The output file is mode 600.
 */
import { randomBytes, randomInt } from 'node:crypto'
import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadEnvLocal } from './load-env'
import { getServiceClient } from '../lib/db/client'
import { createClassroom, createPrecreatedStudent, upsertTeacher } from '../lib/db/repo'
import { hashPin } from '../lib/pin'
import { isValidRoomCode, normalizeRoomCode } from '../lib/room-code'
import { studentNicknameSchema } from '../lib/account-validation'

type Role = 'teacher' | 'student'
type InputRow = { role: Role; name: string; emailOrNickname: string; roomCode: string }
type OutputRow = InputRow & { temporaryPassword: string; pin: string }

const HEADER = ['role', 'name', 'email_or_nickname', 'room_code'] as const
const OUTPUT_HEADER = [...HEADER, 'temporary_password', 'pin'] as const

function usage(): never {
  throw new Error('ใช้: npx tsx scripts/create-accounts.ts input.csv [--output path] [--dry-run]')
}

function csvLine(fields: readonly string[]): string {
  return fields.map((field) => {
    const value = String(field)
    return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  }).join(',')
}

/** Small CSV parser with quoted-field and escaped-quote support. */
function parseCsv(raw: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    const next = raw[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; i += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"' && field === '') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += char
  }
  if (field !== '' || row.length > 0) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  return rows.filter((values) => values.some((value) => value.trim() !== ''))
}

function parseInput(path: string): InputRow[] {
  const rows = parseCsv(readFileSync(path, 'utf8'))
  if (rows.length < 2) throw new Error('CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว')
  const header = rows[0]?.map((value) => value.trim().toLowerCase())
  if (HEADER.some((name, index) => header?.[index] !== name) || header?.length !== HEADER.length) {
    throw new Error(`หัวตารางต้องเป็น: ${HEADER.join(',')}`)
  }
  return rows.slice(1).map((values, index) => {
    const [role, name, emailOrNickname, roomCode] = values.map((value) => value.trim())
    if (role !== 'teacher' && role !== 'student') throw new Error(`แถว ${index + 2}: role ต้องเป็น teacher หรือ student`)
    if (!name || !emailOrNickname || !roomCode) throw new Error(`แถว ${index + 2}: ทุกช่องต้องไม่ว่าง`)
    if (!isValidRoomCode(normalizeRoomCode(roomCode))) throw new Error(`แถว ${index + 2}: room_code ไม่ใช่รหัสห้อง 6 ตัวที่ถูกต้อง`)
    if (role === 'teacher' && !/^\S+@\S+\.\S+$/.test(emailOrNickname)) throw new Error(`แถว ${index + 2}: email_or_nickname ของ teacher ต้องเป็นอีเมล`)
    if (role === 'student' && !studentNicknameSchema.safeParse(emailOrNickname).success) throw new Error(`แถว ${index + 2}: ชื่อเล่นต้องยาว 1-40 ตัวอักษร`)
    return {
      role,
      name,
      emailOrNickname: role === 'teacher' ? emailOrNickname.toLowerCase() : emailOrNickname,
      roomCode: normalizeRoomCode(roomCode),
    }
  })
}

function temporaryPassword(): string {
  return `Temp-${randomBytes(18).toString('base64url')}`
}

function pin(): string { return String(randomInt(0, 10000)).padStart(4, '0') }

function outputPath(args: string[]): string {
  const at = args.indexOf('--output')
  return resolve(at >= 0 ? args[at + 1] ?? usage() : join(homedir(), 'Desktop/ceo-domain-quest-accounts.csv'))
}

async function findRoom(roomCode: string) {
  const result = await getServiceClient().from('classrooms').select('id, teacher_id, room_code, status').eq('room_code', roomCode).maybeSingle()
  if (result.error) throw result.error
  return result.data
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const input = args.find((arg) => !arg.startsWith('--'))
  if (!input) usage()
  const rows = parseInput(resolve(input))
  const dryRun = args.includes('--dry-run')
  const target = outputPath(args)

  if (dryRun) {
    const teachers = rows.filter((row) => row.role === 'teacher').length
    const students = rows.length - teachers
    console.log(`dry-run: ตรวจ CSV ผ่าน ${rows.length} แถว (ครู ${teachers}, นักเรียน ${students}) — ยังไม่เขียนฐานข้อมูลหรือไฟล์ผลลัพธ์`)
    return
  }

  loadEnvLocal()
  const rooms = new Map<string, { id: string; teacher_id: string }>()
  const results: OutputRow[] = []
  for (const row of rows) {
    if (row.role === 'teacher') {
      const password = temporaryPassword()
      const created = await getServiceClient().auth.admin.createUser({
        email: row.emailOrNickname,
        password,
        email_confirm: true,
        user_metadata: { name: row.name },
      })
      if (created.error || !created.data.user) throw new Error(`สร้างบัญชีครูแถว ${row.name} ไม่สำเร็จ`)
      const teacher = await upsertTeacher(created.data.user.id, row.emailOrNickname, row.name)
      const existing = await findRoom(row.roomCode)
      if (existing && existing.teacher_id !== teacher.id) throw new Error(`ห้อง ${row.roomCode} เป็นของครูคนอื่น`)
      const room = existing ?? await createClassroom(teacher.id, row.roomCode)
      rooms.set(row.roomCode, { id: room.id, teacher_id: teacher.id })
      results.push({ ...row, temporaryPassword: password, pin: '' })
      continue
    }

    const room = rooms.get(row.roomCode) ?? await findRoom(row.roomCode)
    if (!room) throw new Error(`ไม่พบห้อง ${row.roomCode} สำหรับนักเรียน ${row.emailOrNickname}`)
    let createdStudent: boolean = false
    let rawPin = ''
    for (let attempt = 0; attempt < 20 && !createdStudent; attempt += 1) {
      rawPin = pin()
      try {
        await createPrecreatedStudent({ classroomId: room.id, nickname: row.emailOrNickname, pinHash: await hashPin(rawPin) })
        createdStudent = true
      } catch (error) {
        if (!(error instanceof Error && /duplicate|unique|23505/i.test(error.message))) throw error
      }
    }
    if (!createdStudent) throw new Error(`สร้างนักเรียน ${row.emailOrNickname} ไม่สำเร็จเพราะชื่อซ้ำ`)
    results.push({ ...row, temporaryPassword: '', pin: rawPin })
  }

  const csv = [csvLine(OUTPUT_HEADER), ...results.map((row) => csvLine([
    row.role, row.name, row.emailOrNickname, row.roomCode, row.temporaryPassword, row.pin,
  ]))].join('\n') + '\n'
  writeFileSync(target, csv, { mode: 0o600 })
  chmodSync(target, 0o600)
  console.log(`สร้างบัญชี ${results.length} แถวแล้ว และเขียนไฟล์ผลลัพธ์แบบ owner-only: ${target}`)
}

main().catch((error: unknown) => {
  console.error(`create-accounts ล้มเหลว: ${error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ'}`)
  process.exitCode = 1
})

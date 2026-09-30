// ข้อมูลตั้งต้นของคลาวด์: ครูจริง 1 บัญชี + ห้องเรียน 1 ห้อง — ไม่มีนักเรียนจำลอง
//
// รัน: SEED_TEACHER_EMAIL=... SEED_TEACHER_PASSWORD=... npx tsx scripts/seed-production.ts
// ต้องมี SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ของโปรเจกต์ปลายทางใน env
//
// ⚠️ ตรวจให้ชัดว่า SUPABASE_URL ชี้โปรเจกต์ที่ตั้งใจ สคริปต์นี้เขียนข้อมูลจริง
// รันซ้ำได้ (idempotent): มีบัญชี/ห้องอยู่แล้วจะใช้ของเดิม ไม่สร้างซ้ำ

import { getServiceClient } from '../lib/db/client'
import * as repo from '../lib/db/repo'
import { genRoomCode, isValidRoomCode, normalizeRoomCode } from '../lib/room-code'
import { loadEnvLocal } from './load-env'

loadEnvLocal()

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`ขาด env ${name} — ดู .env.example`)
    process.exit(1)
  }
  return value
}

async function findAuthUserId(email: string): Promise<string | null> {
  const admin = getServiceClient().auth.admin
  const listed = await admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) throw listed.error
  return listed.data.users.find((u) => u.email === email)?.id ?? null
}

async function main(): Promise<void> {
  const url = required('SUPABASE_URL')
  required('SUPABASE_SERVICE_ROLE_KEY')
  const email = required('SEED_TEACHER_EMAIL')
  const password = required('SEED_TEACHER_PASSWORD')
  const name = process.env.SEED_TEACHER_NAME?.trim() || 'ครูผู้สอน'

  const wanted = process.env.SEED_ROOM_CODE?.trim()
  const roomCode = wanted ? normalizeRoomCode(wanted) : genRoomCode()
  if (!isValidRoomCode(roomCode)) {
    console.error(`SEED_ROOM_CODE "${roomCode}" ใช้ไม่ได้ — ต้องยาว 6 ตัวจากชุด 23456789ABCDEFGHJKMNPQRSTUVWXYZ`)
    process.exit(1)
  }

  console.log(`ปลายทาง: ${url}`)

  const db = getServiceClient()
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true })
  const teacherId = created.data.user?.id ?? (await findAuthUserId(email))
  if (!teacherId) throw created.error ?? new Error('สร้างบัญชีครูไม่สำเร็จ')
  console.log(created.data.user ? `สร้างบัญชีครูใหม่: ${email}` : `ใช้บัญชีครูเดิม: ${email}`)

  const teacher = await repo.upsertTeacher(teacherId, email, name)

  const existingRooms = await repo.listClassroomsByTeacher(teacherId)
  const open = existingRooms.find((c) => c.status === 'open')
  const classroom = open ?? (await repo.createClassroom(teacherId, roomCode))
  console.log(open ? `ใช้ห้องเดิมที่เปิดอยู่: ${classroom.room_code}` : `สร้างห้องใหม่: ${classroom.room_code}`)

  const students = await repo.listClassroomBoard(teacherId, classroom.id)
  console.log('')
  console.log(`ครู       : ${teacher.email} (${teacher.name ?? '-'})`)
  console.log(`รหัสห้อง  : ${classroom.room_code}`)
  console.log(`สถานะห้อง : ${classroom.status}`)
  console.log(`นักเรียน  : ${students?.length ?? 0} คน (ข้อมูลตั้งต้นไม่มีนักเรียนจำลอง)`)
  console.log('')
  console.log('ลบ SEED_TEACHER_PASSWORD ออกจาก .env.local ได้แล้ว')
}

main().catch((err: unknown) => {
  console.error('seed-production ล้มเหลว:', err)
  process.exit(1)
})

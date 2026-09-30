/**
 * E-16 ห้องสาธิตสำหรับขึ้นเวที — ครู 1 คน · ห้อง 1 ห้อง · นักเรียนหุ่น 20 คน สถานะกระจายครบ
 *
 * รัน: npx tsx scripts/seed-demo.ts   (รันซ้ำได้ ไม่พัง)
 *
 * รันซ้ำ = **ล้างเฉพาะห้อง QUEST9 ของครู teacher.demo@digital-biz.local แล้วเรียงใหม่**
 * ถ้ารหัสห้องนี้ดันเป็นของครูคนอื่น สคริปต์หยุดทันทีและไม่ลบอะไรเลย
 * ห้องอื่น (เช่น UAT777 ของ scripts/seed-uat.ts ที่เจ้าของใช้เล่น) ไม่ถูกแตะ
 *
 * หน้าตาของห้องอยู่ที่ `lib/db/demo-seed.ts` ที่เดียว — ปุ่ม "ล้างกลับค่าเริ่มต้น" บนหน้าครู
 * เรียกโมดูลเดียวกัน ห้องที่ครูกดล้างกลางเวทีจึงหน้าตาเหมือนที่ซ้อมมาเป๊ะ
 */

import { getServiceClient } from '../lib/db/client'
import {
  DEMO_PIN,
  DEMO_ROOM_CODE,
  DEMO_TEACHER_EMAIL,
  DEMO_TEACHER_NAME,
  DEMO_TEACHER_PASSWORD,
  fillDemoClassroom,
} from '../lib/db/demo-seed'
import * as repo from '../lib/db/repo'
import { isValidRoomCode } from '../lib/room-code'
import { loadEnvLocal } from './load-env'

// client.ts อ่าน env ตอนเรียกฟังก์ชัน ไม่ใช่ตอน import — โหลดตรงนี้ทันเสมอ
loadEnvLocal()

async function ensureTeacherAuthUser(): Promise<string> {
  const admin = getServiceClient().auth.admin

  const created = await admin.createUser({
    email: DEMO_TEACHER_EMAIL,
    password: DEMO_TEACHER_PASSWORD,
    email_confirm: true,
  })
  if (created.data.user) return created.data.user.id

  // มีอยู่แล้ว (รันซ้ำ) — หา user เดิมแล้วตั้งรหัสผ่านทับให้ตรงกับที่เขียนไว้เสมอ
  const listed = await admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) throw listed.error
  const existing = listed.data.users.find((u) => u.email === DEMO_TEACHER_EMAIL)
  if (!existing) throw created.error ?? new Error('สร้างบัญชีครูเดโมไม่สำเร็จ')

  const reset = await admin.updateUserById(existing.id, {
    password: DEMO_TEACHER_PASSWORD,
    email_confirm: true,
  })
  if (reset.error) throw reset.error
  return existing.id
}

/**
 * คืนห้องสาธิตที่ "ว่างพร้อมเติมหุ่น"
 *
 * ห้องเดิมที่ยังไม่ได้ติดป้ายห้องสาธิต (สร้างจากสคริปต์รุ่นก่อน) ต้องลบทิ้งแล้วสร้างใหม่
 * เพราะ trigger `classrooms_guard_demo_flag` ห้ามติดป้ายย้อนหลังให้ห้องที่มีนักเรียนแล้ว
 * — กติกานั้นมีไว้กันคนเปลี่ยนห้องเรียนจริงให้เป็นห้องสาธิตแล้วกดล้าง
 */
async function emptyDemoClassroom(teacherId: string): Promise<repo.Classroom> {
  if (!isValidRoomCode(DEMO_ROOM_CODE)) {
    throw new Error(`รหัสห้อง ${DEMO_ROOM_CODE} ใช้ตัวอักษรที่ระบบไม่รับ (ตัด 0 O 1 I L ทิ้ง)`)
  }

  const found = await getServiceClient()
    .from('classrooms')
    .select('id, teacher_id, is_demo')
    .eq('room_code', DEMO_ROOM_CODE)
    .maybeSingle()
  if (found.error) throw found.error

  if (found.data) {
    if (found.data.teacher_id !== teacherId) {
      throw new Error(
        `ห้อง ${DEMO_ROOM_CODE} เป็นของครูคนอื่น (teacher_id=${found.data.teacher_id}) ` +
          'ไม่ลบให้ — เปลี่ยน DEMO_ROOM_CODE ใน lib/db/demo-seed.ts ก่อน',
      )
    }

    if (found.data.is_demo) {
      // ทางเดียวกับปุ่มบนหน้าครู: ฐานข้อมูลเป็นคนตัดสินว่าล้างได้ไหม
      const wiped = await repo.resetDemoClassroom(teacherId, found.data.id)
      if (!wiped.ok) throw new Error(`ล้างห้อง ${DEMO_ROOM_CODE} ไม่ได้ (${wiped.reason})`)
      console.log(`ล้างห้อง ${DEMO_ROOM_CODE} เดิมแล้ว — นักเรียน ${wiped.counts.students} คน`)
      const row = await repo.getOwnedClassroom(teacherId, found.data.id)
      if (!row) throw new Error('อ่านห้องสาธิตหลังล้างไม่ได้')
      return row
    }

    const removed = await repo.deleteClassroom(teacherId, found.data.id)
    if (!removed) throw new Error(`ลบห้อง ${DEMO_ROOM_CODE} รุ่นเก่าไม่สำเร็จ`)
    console.log(`ลบห้อง ${DEMO_ROOM_CODE} รุ่นเก่า (ยังไม่ติดป้ายห้องสาธิต) แล้วสร้างใหม่`)
  }

  return repo.createDemoClassroom(teacherId, DEMO_ROOM_CODE)
}

async function main(): Promise<void> {
  const teacherId = await ensureTeacherAuthUser()
  const teacher = await repo.upsertTeacher(teacherId, DEMO_TEACHER_EMAIL, DEMO_TEACHER_NAME)

  const classroom = await emptyDemoClassroom(teacher.id)
  const started = Date.now()
  const result = await fillDemoClassroom(teacher.id, classroom.id, classroom.room_code)
  const board = await repo.listClassroomBoard(teacher.id, classroom.id)

  console.log('')
  console.log('═══ ห้องสาธิตพร้อมแล้ว (ข้อมูลหุ่นทั้งหมด ไม่ใช่นักเรียนจริง) ═══')
  console.log(`ครู       ${DEMO_TEACHER_EMAIL} / ${DEMO_TEACHER_PASSWORD}  → http://localhost:3000/teacher`)
  console.log(`รหัสห้อง   ${classroom.room_code}                        → http://localhost:3000/join?code=${classroom.room_code}`)
  console.log(`PIN หุ่น   ${DEMO_PIN} (ทุกคน)`)
  console.table(
    (board ?? []).map((r) => ({
      ชื่อเล่น: r.nickname,
      ร้าน: r.businessName,
      ตัวช่วย: r.scaffoldLevel,
      ช่องทาง: r.learningRoute ?? '-',
      ดาว: `${r.earnedStars}/${r.goalStars ?? '-'}`,
      A: r.stations.A?.status ?? '-',
      B: r.stations.B?.status ?? '-',
      ขอครู: r.needsHelp,
      รอตรวจ: r.pendingReview,
    })),
  )
  console.log(
    `นักเรียนหุ่น ${result.students} คน · รอครูตรวจ ${result.pendingReview} ใบ · ` +
      `คำขอเปลี่ยนแผนค้าง ${result.planRequests} ใบ · ผลงานปักหมุด ${result.showcase} ชิ้น · ` +
      `ใช้เวลา ${Date.now() - started} ms`,
  )
  console.log('กลางเวทีห้องเละ: กดปุ่ม "ล้างห้องสาธิต" ที่หน้า /teacher ได้เลย ไม่ต้องกลับมาที่เทอร์มินัล')
}

main().catch((err: unknown) => {
  console.error('seed-demo ล้มเหลว:', err)
  process.exit(1)
})

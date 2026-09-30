/**
 * ข้อมูลให้เจ้าของโปรเจกต์เปิดเล่นเองได้ทันที (UAT) — ครู 1 คน · ห้อง 1 ห้อง · นักเรียนหุ่น 6 คน
 *
 * รัน: npm run seed:uat        (หรือ npx tsx scripts/seed-uat.ts)
 *
 * รันซ้ำได้ไม่พัง: **ลบเฉพาะห้อง UAT_ROOM_CODE ของครู UAT_TEACHER_EMAIL แล้วสร้างใหม่**
 * ถ้ารหัสห้องนี้ดันเป็นของครูคนอื่น สคริปต์จะหยุดทันทีและไม่ลบอะไรเลย
 * ห้องเดโมอื่น (เช่น QUEST9 ของ scripts/seed-demo.ts) ไม่ถูกแตะ
 *
 * ข้อมูลทุกตัวเขียนผ่าน lib/db/repo + components/server เหมือนที่ API route ใช้
 * ไม่มีการ INSERT ตรงลงตาราง และไม่มีการเขียนค่า hash ดิบ (PIN ผ่าน hashPin เสมอ)
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getServiceClient } from '../lib/db/client'
import * as repo from '../lib/db/repo'
import { hashPin } from '../lib/pin'
import { isValidRoomCode } from '../lib/room-code'
import { fallbackGradeReason } from '../lib/ai'
import { sourceInfo } from '../components/server/ai'
import { saveShopProfile } from '../components/server/game-state'
import { buildRevisionBag } from '../components/server/revision'
import { loadEnvLocal } from './load-env'

// client.ts อ่าน env ตอนเรียกฟังก์ชัน ไม่ใช่ตอน import — โหลดตรงนี้ทันเสมอ
loadEnvLocal()

// ───────────────────────────── ค่าคงที่ที่เขียนไว้ใน docs/try-it.md ห้ามเปลี่ยนโดยไม่แก้เอกสาร

const TEACHER_EMAIL = 'kru@uat.local'
const TEACHER_PASSWORD = 'uat1234'
const TEACHER_NAME = 'ครูทดลองระบบ'

/** ต้องผ่าน isValidRoomCode() — ชุดตัวอักษรตัด 0 O 1 I L ทิ้ง (อ่านสับสนบนโปรเจกเตอร์) */
const ROOM_CODE = 'UAT777'

/** PIN ของนักเรียนหุ่นทุกคน — เจ้าของใช้สวมรอยเข้าไปดูหน้าจอเด็กแต่ละแบบได้ */
const BOT_PIN = '1234'

/** ช่วงของคาบที่เปิดไว้ให้ตั้งแต่ต้น เจ้าของจะได้ไม่ต้องกดอะไรก่อนเล่น */
const START_PHASE: repo.SessionPhase = 'mission'
const START_TIMER_SECONDS = 20 * 60

type BotSpec = {
  nickname: string
  /** สิ่งที่หุ่นตัวนี้มีไว้ให้ดู เขียนลงตารางในคู่มือด้วยข้อความเดียวกัน */
  role: string
  shop: {
    shopName: string
    businessTypeId: string
    domainName: string
    isRegisteredCompany: boolean
    audience: repo.ShopAudience
  }
  scaffold: 1 | 2 | 3
  goalLevel: repo.GoalLevel
  preTestScore: number
  /** คะแนนหลังเรียน 0-10 — ต้องมี ไม่งั้นหน้ารายงานห้องขึ้นขีดกลางทั้งแถว ดูเหมือนระบบพัง */
  postTestScore: number
  /** ความมั่นใจรายวัตถุประสงค์ obj-1..obj-4 — คู่กับ readiness ให้ธงบนแผงครู */
  confidence: Record<string, number>
  /** ตอบถูกไหมรายวัตถุประสงค์ — ไม่ใช่คำตอบและไม่ใช่เฉลย */
  readiness: Record<string, boolean>
  /**
   * ความมั่นใจรายภารกิจ (คีย์ m1..m4 ในก้อน confidence เดียวกัน)
   * เป็น input ของ listCalibrationFlags: มั่นใจ 3 แต่ไม่ผ่าน = "ควรคุย" · มั่นใจ 1 แต่ผ่าน = "ควรชม"
   */
  missionConfidence: Partial<Record<repo.MissionId, 1 | 2 | 3>>
  route: repo.LearningRoute
  /** สลับช่องทางเองกลางทาง = หลักฐาน personalized ใน route_changes */
  switchedTo?: { to: repo.LearningRoute; missionId: repo.MissionId }
  missions: Array<{
    id: repo.MissionId
    attempts: number
    hints: number
    stars: number
    passed: boolean
  }>
  stationA: repo.ProgressStatus
  stationAHints: number
  stationB: repo.ProgressStatus
  /** ส่งใบเสนอด่านบอสหรือยัง และสถานะของใบนั้น */
  submission: 'none' | 'pending-review' | 'confirmed' | 'revision-requested'
  skip?: { missionId: repo.MissionId; reason: string }
  reflection: string
}

const BOTS: readonly BotSpec[] = [
  {
    nickname: 'อาร์ม',
    role: 'คนเก่ง — ผ่านครบ 4 ภารกิจ ส่งด่านบอสแล้วครูตรวจจบ',
    shop: {
      shopName: 'อาร์มเกมเซ็นเตอร์',
      businessTypeId: 'game',
      domainName: 'armgame',
      isRegisteredCompany: false,
      audience: 'thai',
    },
    scaffold: 1,
    goalLevel: 3,
    preTestScore: 8,
    postTestScore: 10,
    confidence: { 'obj-1': 3, 'obj-2': 3, 'obj-3': 3, 'obj-4': 2 },
    readiness: { 'obj-1': true, 'obj-2': true, 'obj-3': true, 'obj-4': true },
    missionConfidence: { m1: 3, m2: 3, m3: 3, m4: 2 },
    route: 'game',
    missions: [
      { id: 'm1', attempts: 1, hints: 0, stars: 3, passed: true },
      { id: 'm2', attempts: 1, hints: 0, stars: 3, passed: true },
      { id: 'm3', attempts: 1, hints: 0, stars: 3, passed: true },
      { id: 'm4', attempts: 2, hints: 0, stars: 2, passed: true },
    ],
    stationA: 'completed',
    stationAHints: 0,
    stationB: 'completed',
    submission: 'confirmed',
    reflection: 'ได้รู้ว่านามสกุลโดเมนบอกว่าเว็บนั้นเป็นเว็บประเภทไหน',
  },
  {
    nickname: 'มะลิ',
    role: 'คนกลาง — ผ่าน 2 ภารกิจ กำลังทำภารกิจที่ 3',
    shop: {
      shopName: 'มะลิเบเกอรี่',
      businessTypeId: 'bakery',
      domainName: 'malibakery',
      isRegisteredCompany: false,
      audience: 'thai',
    },
    scaffold: 2,
    goalLevel: 2,
    preTestScore: 5,
    postTestScore: 9,
    confidence: { 'obj-1': 2, 'obj-2': 2, 'obj-3': 2, 'obj-4': 1 },
    readiness: { 'obj-1': true, 'obj-2': true, 'obj-3': false, 'obj-4': false },
    missionConfidence: { m1: 2, m2: 2, m3: 3 },
    route: 'clip',
    switchedTo: { to: 'game', missionId: 'm2' },
    missions: [
      { id: 'm1', attempts: 1, hints: 1, stars: 3, passed: true },
      { id: 'm2', attempts: 2, hints: 1, stars: 2, passed: true },
      { id: 'm3', attempts: 2, hints: 1, stars: 0, passed: false },
    ],
    stationA: 'completed',
    stationAHints: 1,
    stationB: 'in_progress',
    submission: 'none',
    reflection: 'ชื่อร้านที่จำง่ายช่วยให้ลูกค้าพิมพ์หาเจอเอง',
  },
  {
    nickname: 'ต้นกล้า',
    role: 'คนช้า + กดขอครู — ติดอยู่ภารกิจที่ 2 จุดขึ้นสีแดงบนแผงครู',
    shop: {
      shopName: 'ต้นกล้าซ่อมมือถือ',
      businessTypeId: 'phone-repair',
      domainName: 'tonklafix',
      isRegisteredCompany: false,
      audience: 'thai',
    },
    scaffold: 3,
    goalLevel: 1,
    preTestScore: 2,
    postTestScore: 4,
    confidence: { 'obj-1': 1, 'obj-2': 1, 'obj-3': 1, 'obj-4': 1 },
    readiness: { 'obj-1': true, 'obj-2': false, 'obj-3': false, 'obj-4': false },
    missionConfidence: { m1: 1, m2: 2 },
    route: 'buddy',
    missions: [
      { id: 'm1', attempts: 3, hints: 2, stars: 1, passed: true },
      { id: 'm2', attempts: 4, hints: 2, stars: 0, passed: false },
    ],
    stationA: 'needs_help',
    stationAHints: 2,
    stationB: 'not_started',
    submission: 'none',
    skip: { missionId: 'm2', reason: 'ยังไม่เข้าใจ อยากลองด่านถัดไปก่อน' },
    reflection: 'ยังสับสนเรื่องนามสกุล .co.th กับ .com อยู่',
  },
  {
    nickname: 'ปูเป้',
    role: 'คนขอคำใบ้เยอะ — ผ่านด่านได้แต่ใช้คำใบ้เต็มทุกภารกิจ',
    shop: {
      shopName: 'ปูเป้ดอกไม้สด',
      businessTypeId: 'flower',
      domainName: 'poupeflower',
      isRegisteredCompany: false,
      audience: 'thai',
    },
    scaffold: 3,
    goalLevel: 1,
    preTestScore: 3,
    postTestScore: 8,
    confidence: { 'obj-1': 1, 'obj-2': 2, 'obj-3': 1, 'obj-4': 1 },
    readiness: { 'obj-1': true, 'obj-2': true, 'obj-3': false, 'obj-4': false },
    missionConfidence: { m1: 1, m2: 2, m3: 3 },
    route: 'card',
    missions: [
      { id: 'm1', attempts: 2, hints: 3, stars: 1, passed: true },
      { id: 'm2', attempts: 2, hints: 3, stars: 1, passed: true },
      { id: 'm3', attempts: 3, hints: 3, stars: 0, passed: false },
    ],
    stationA: 'completed',
    stationAHints: 4,
    stationB: 'in_progress',
    submission: 'none',
    reflection: 'กดดูคำใบ้แล้วเข้าใจขึ้น แต่อยากลองคิดเองก่อนบ้าง',
  },
  {
    nickname: 'ฟ้าใส',
    role: 'ส่งงานแล้วรอครูตรวจ — ใบนี้อยู่ในคิว "รอยืนยันคะแนน" ของครู',
    shop: {
      shopName: 'ฟ้าใสเสื้อผ้ามือสอง',
      businessTypeId: 'secondhand',
      domainName: 'fasaisecond',
      isRegisteredCompany: false,
      audience: 'thai',
    },
    scaffold: 2,
    goalLevel: 2,
    preTestScore: 6,
    postTestScore: 9,
    confidence: { 'obj-1': 3, 'obj-2': 2, 'obj-3': 2, 'obj-4': 2 },
    readiness: { 'obj-1': true, 'obj-2': true, 'obj-3': true, 'obj-4': true },
    missionConfidence: { m1: 3, m2: 2, m3: 2, m4: 3 },
    route: 'game',
    missions: [
      { id: 'm1', attempts: 1, hints: 0, stars: 3, passed: true },
      { id: 'm2', attempts: 1, hints: 1, stars: 2, passed: true },
      { id: 'm3', attempts: 2, hints: 1, stars: 2, passed: true },
      { id: 'm4', attempts: 1, hints: 0, stars: 3, passed: true },
    ],
    stationA: 'completed',
    stationAHints: 1,
    stationB: 'completed',
    submission: 'pending-review',
    reflection: 'เลือก .com เพราะอยากให้คนต่างจังหวัดหาร้านเจอด้วย',
  },
  {
    nickname: 'บีม',
    role: 'ครูตีกลับให้แก้ — หน้าเด็กจะขึ้นว่าต้องแก้ด้านไหนและส่งใหม่ได้',
    shop: {
      shopName: 'บีมกาแฟดริป',
      businessTypeId: 'coffee',
      domainName: 'beamdrip',
      isRegisteredCompany: false,
      audience: 'thai',
    },
    scaffold: 2,
    goalLevel: 2,
    preTestScore: 5,
    postTestScore: 6,
    confidence: { 'obj-1': 2, 'obj-2': 3, 'obj-3': 2, 'obj-4': 1 },
    readiness: { 'obj-1': true, 'obj-2': true, 'obj-3': true, 'obj-4': false },
    missionConfidence: { m1: 2, m2: 2, m3: 2, m4: 1 },
    route: 'clip',
    missions: [
      { id: 'm1', attempts: 1, hints: 1, stars: 3, passed: true },
      { id: 'm2', attempts: 2, hints: 1, stars: 2, passed: true },
      { id: 'm3', attempts: 2, hints: 2, stars: 1, passed: true },
      { id: 'm4', attempts: 3, hints: 1, stars: 1, passed: true },
    ],
    stationA: 'completed',
    stationAHints: 2,
    stationB: 'completed',
    submission: 'revision-requested',
    reflection: 'ครูบอกให้เขียนเหตุผลให้ชัดกว่านี้ จะลองเขียนใหม่',
  },
]

// ───────────────────────────── ครู

async function ensureTeacherAuthUser(): Promise<string> {
  const admin = getServiceClient().auth.admin

  const created = await admin.createUser({
    email: TEACHER_EMAIL,
    password: TEACHER_PASSWORD,
    email_confirm: true,
  })
  if (created.data.user) return created.data.user.id

  // มีอยู่แล้ว (รันซ้ำ) — หา user เดิมแล้วตั้งรหัสผ่านทับให้ตรงกับคู่มือเสมอ
  const listed = await admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) throw listed.error
  const existing = listed.data.users.find((u) => u.email === TEACHER_EMAIL)
  if (!existing) throw created.error ?? new Error('สร้างบัญชีครู UAT ไม่สำเร็จ')

  const reset = await admin.updateUserById(existing.id, {
    password: TEACHER_PASSWORD,
    email_confirm: true,
  })
  if (reset.error) throw reset.error
  return existing.id
}

/**
 * ล้างห้อง UAT เดิมแล้วสร้างใหม่ — แถวลูกทุกตารางหายตาม FK cascade ใน deleteClassroom()
 * ห้องของครูคนอื่นที่บังเอิญใช้รหัสเดียวกัน = หยุดทันที ไม่ลบ
 */
async function resetClassroom(teacherId: string): Promise<repo.Classroom> {
  if (!isValidRoomCode(ROOM_CODE)) {
    throw new Error(`รหัสห้อง ${ROOM_CODE} ใช้ตัวอักษรที่ระบบไม่รับ (ตัด 0 O 1 I L ทิ้ง)`)
  }

  const found = await getServiceClient()
    .from('classrooms')
    .select('id, teacher_id')
    .eq('room_code', ROOM_CODE)
    .maybeSingle()
  if (found.error) throw found.error

  if (found.data) {
    if (found.data.teacher_id !== teacherId) {
      throw new Error(
        `ห้อง ${ROOM_CODE} เป็นของครูคนอื่น (teacher_id=${found.data.teacher_id}) ` +
          'ไม่ลบให้ — เปลี่ยน ROOM_CODE ในสคริปต์นี้ก่อน',
      )
    }
    const removed = await repo.deleteClassroom(teacherId, found.data.id)
    if (!removed) throw new Error(`ลบห้อง ${ROOM_CODE} ไม่สำเร็จ`)
    console.log(`ลบห้อง ${ROOM_CODE} เดิมแล้ว (ไฟล์เสียง ${removed.deletedFiles} ไฟล์)`)
  }

  return repo.createClassroom(teacherId, ROOM_CODE)
}

// ───────────────────────────── คำตอบรายข้อของแบบทดสอบ

/** เฉลยอ่านฝั่งเซิร์ฟเวอร์เท่านั้น — ไฟล์นี้รันด้วย tsx ไม่เคยถูกส่งไปเบราว์เซอร์ */
const quizAnswers = JSON.parse(
  readFileSync(join(process.cwd(), 'content', 'quiz-answers.json'), 'utf8'),
) as { pre: Array<{ id: string; answerIndex: number }>; post: Array<{ id: string; answerIndex: number }> }

/** แถวคำตอบรายข้อที่ทำให้ได้คะแนนเท่ากับ score พอดี */
function quizItemRows(set: 'pre' | 'post', score: number) {
  return quizAnswers[set].map((q, index) => {
    const correct = index < score
    return {
      itemId: q.id,
      choiceIndex: correct ? q.answerIndex : (q.answerIndex + 1) % 4,
      correct,
    }
  })
}

// ───────────────────────────── นักเรียนหุ่น

/**
 * คะแนนที่ติดไปกับใบเสนอ ต้องเป็น **โครงเดียวกับที่ POST /api/ceo เขียน** ไม่ใช่แค่แมปคะแนนแบน ๆ
 * เพราะหน้า /ceo กับ /result อ่านความเห็นรายด้านจาก `ai_scores.ruleScores.dimensions`
 * ถ้าเขียนเป็น { 'dim-naming': 3, ... } เฉย ๆ การ์ด "ความเห็นที่ระบบเสนอ" จะไม่ขึ้นให้เจ้าของดูเลย
 */
function bossAiScores(bot: BotSpec, emphasisCriterion: string, version: number) {
  const graded = fallbackGradeReason(
    {
      tldId: 'com',
      reasonText: `ชื่อนี้ตรงกับป้ายหน้าร้าน ${bot.shop.shopName} ลูกค้าพิมพ์ตามได้ทันทีไม่ต้องเลื่อนหา`,
      domainName: bot.shop.domainName,
      businessTypeId: bot.shop.businessTypeId,
      shopName: bot.shop.shopName,
      isRegisteredCompany: bot.shop.isRegisteredCompany,
      audience: bot.shop.audience,
      emphasisCriterion,
      studentId: undefined,
      missionId: 'big-ceo',
    } as never,
    'not-requested',
  )
  return {
    gradingStatus: 'pending-ai',
    version,
    ruleScores: {
      dimensions: graded.dimensions,
      weightedTotal: graded.weightedTotal,
      weightedMax: graded.weightedMax,
      stars: graded.stars,
      feedback: graded.feedback,
    },
    aiProposed: null,
    dimensions: graded.dimensions,
    emphasisDimensionId: graded.emphasisDimensionId,
    weightedTotal: graded.weightedTotal,
    weightedMax: graded.weightedMax,
    stars: graded.stars,
    score: graded.weightedTotal,
    maxScore: graded.weightedMax,
    feedback: graded.feedback,
    needsTeacherConfirm: graded.needsTeacherConfirm,
    ...sourceInfo(graded),
  }
}

/** คะแนนรายด้านที่ครูยืนยัน — ใช้ตอนตั้งค่าหุ่นที่ครูตรวจจบแล้ว */
const CONFIRMED_DIMENSIONS = {
  'dim-naming': 3,
  'dim-tld-fit': 3,
  'dim-customer-reason': 3,
  'dim-business-link': 3,
} as const

async function seedBot(
  teacherId: string,
  classroomId: string,
  pinHash: string,
  bot: BotSpec,
): Promise<repo.Student> {
  const student = await repo.joinClassroom({
    classroomId,
    nickname: bot.nickname,
    pinHash,
  })

  await saveShopProfile(student.id, bot.shop)
  /**
   * profiles.confidence ถูกอ่านสองมุมจากก้อนเดียวกัน จึงต้องมีคีย์ทั้งสองชุด
   * - คีย์ obj-1..obj-4 → getTeacherBoardWithFlags() ใช้คิดธง calibration ของแผงครู
   * - คีย์ m1..m4       → listCalibrationFlags() ใช้จับคู่ "มั่นใจแต่ผิด / เดาแต่ถูก"
   */
  await repo.upsertProfile(student.id, {
    confidence: { ...bot.confidence, ...bot.missionConfidence },
    readiness: bot.readiness,
    pre_test_score: bot.preTestScore,
    post_test_score: bot.postTestScore,
    scaffold_level: bot.scaffold,
  })

  /**
   * คำตอบรายข้อของทั้งสองชุด — ไม่ใส่แล้วหน้ารายงานจะไม่มีค่าความยาก p และอำนาจจำแนก r ให้ดูเลย
   * ใช้กติกาเดียวกับ scripts/check-evidence.ts: คนที่ได้ k คะแนน ตอบข้อที่ 1..k ถูก ที่เหลือผิด
   * ทำแบบนี้เพื่อให้ค่าความยากไล่จากง่ายไปยากและตรวจย้อนด้วยมือได้
   * `correct` คิดจากเฉลยฝั่งเซิร์ฟเวอร์ ไม่ได้รับมาจากไหน (กฎเดียวกับ recordQuizItemResponses)
   */
  await repo.recordQuizItemResponses(student.id, 'pre', quizItemRows('pre', bot.preTestScore))
  await repo.recordQuizItemResponses(student.id, 'post', quizItemRows('post', bot.postTestScore))

  // สิ่งที่ "ระบบเสนอ" ก่อนเด็กเลือก — คู่เทียบของ learning_route / scaffold_level
  await repo.saveSuggestion(student.id, {
    channel: bot.route,
    level: bot.scaffold,
    ownGoalText: `อยากให้ลูกค้าจำชื่อ ${bot.shop.shopName} ได้`,
  })
  await repo.raiseGoal(student.id, bot.goalLevel)

  await repo.switchLearningRoute(student.id, bot.route, { chosenBy: 'system', missionId: null })
  if (bot.switchedTo) {
    await repo.switchLearningRoute(student.id, bot.switchedTo.to, {
      chosenBy: 'student',
      missionId: bot.switchedTo.missionId,
    })
  }

  const now = new Date().toISOString()
  await repo.recordProgress(student.id, 'A', {
    status: bot.stationA,
    attempts: bot.missions.reduce((sum, m) => sum + m.attempts, 0),
    hints_used: bot.stationAHints,
    started_at: now,
    completed_at: bot.stationA === 'completed' ? now : null,
  })
  await repo.recordProgress(student.id, 'B', {
    status: bot.stationB,
    attempts: bot.stationB === 'not_started' ? 0 : 1,
    hints_used: 0,
    started_at: bot.stationB === 'not_started' ? null : now,
    completed_at: bot.stationB === 'completed' ? now : null,
  })

  const lastRoute = bot.switchedTo?.to ?? bot.route
  for (const m of bot.missions) {
    await repo.upsertMissionProgress(student.id, m.id, {
      channel_used: bot.switchedTo && m.id === bot.switchedTo.missionId ? lastRoute : bot.route,
      attempts: m.attempts,
      hints_used: m.hints,
      stars: m.stars,
      passed_at: m.passed ? now : null,
    })
  }

  // ดาวรวมต้องคำนวณจาก mission_progress เสมอ ไม่งั้นจอเด็กกับแผงครูไม่ตรงกัน
  await repo.recalcStudentStars(student.id)

  if (bot.skip) {
    await repo.recordSkip(student.id, bot.skip.missionId, bot.skip.reason)
  }

  await repo.saveChatMessage(
    student.id,
    'dome',
    `สวัสดี ${bot.nickname} วันนี้เรามาตั้งชื่อร้านบนอินเทอร์เน็ตกัน`,
    'scripted',
  )
  await repo.saveChatMessage(
    student.id,
    'student',
    `ร้านเราชื่อ ${bot.shop.shopName} นะ`,
    'scripted',
  )
  await repo.saveReflection(student.id, 'reflect-1', bot.reflection)

  if (bot.submission !== 'none') {
    const submission = await repo.saveSubmission(student.id, {
      domainName: bot.shop.domainName,
      tld: '.com',
      reasonText: `ชื่อนี้ตรงกับป้ายหน้าร้าน ${bot.shop.shopName} ลูกค้าพิมพ์ตามได้ทันทีไม่ต้องเลื่อนหา`,
      aiScores: bossAiScores(bot, 'dim-customer-reason', 1) as never,
      format: 'write',
      emphasisCriterion: 'dim-customer-reason',
      selfScores: { 'dim-naming': 3, 'dim-customer-reason': 2 },
    })

    if (bot.submission === 'confirmed') {
      /**
       * โครงนี้ต้องตรงกับที่ POST /api/teacher/confirm-score เขียน (route.ts:100-109)
       * ที่สำคัญคือ `confirmedByTeacher: true` — ถ้าไม่มี หน้าเด็กจะยังขึ้นว่า "รอครูยืนยันคะแนน"
       * ทั้งที่ครูตรวจจบแล้ว และใบประกาศจะดูเหมือนได้มาโดยครูยังไม่ได้ตัดสิน
       */
      const confirmed = await repo.confirmSubmissionScores(teacherId, submission.id, {
        dimensions: CONFIRMED_DIMENSIONS,
        emphasisDimensionId: 'dim-customer-reason',
        // ด้านที่เน้นคูณ 2 → (3 x 2) + 3 + 3 + 3 = 15 เต็ม
        weightedTotal: 15,
        weightedMax: 15,
        stars: 3,
        note: 'เหตุผลชัดขึ้นมากหลังคุยกัน ผ่านครบทั้ง 4 ด้าน',
        confirmedByTeacher: true,
      })
      if (!confirmed) throw new Error(`ยืนยันคะแนนของ ${bot.nickname} ไม่สำเร็จ`)
      // route ของครูให้ดาวด่านบอสตามคะแนนที่ยืนยันแล้วคิดดาวรวมใหม่ — ทำตามให้ทุกจอตรงกัน
      await repo.setMissionStars(student.id, 'boss', 3)
      await repo.recalcStudentStars(student.id)
    }

    if (bot.submission === 'revision-requested') {
      // เส้นทางเดียวกับ POST /api/teacher/request-revision (รอบแรก = round 1)
      const bag = buildRevisionBag({
        dimensionIds: ['dim-customer-reason', 'dim-business-link'],
        dimensionScores: { 'dim-customer-reason': 2, 'dim-business-link': 2 },
        note: 'เหตุผลยังกว้างอยู่ ลองบอกให้ชัดว่าลูกค้าของร้านเราคือใคร แล้วส่งใหม่ได้เลย',
        overrideLimit: false,
        round: 1,
        at: now,
      })
      const sent = await repo.confirmSubmissionScores(teacherId, submission.id, bag)
      if (!sent) throw new Error(`ส่งงานกลับให้ ${bot.nickname} แก้ไม่สำเร็จ`)
      await repo.logEvent(student.id, 'teacher.revision-requested', {
        submissionId: submission.id,
        dimensionIds: bag.reviseDimensionIds,
        round: 1,
        source: 'seed-uat',
      })
    }
  }

  await repo.logEvent(student.id, 'seed.uat_bot_ready', { role: bot.role })
  await repo.touchStudentPresence(student.id, bot.missions.at(-1)?.id ?? 'map')

  return student
}

// ───────────────────────────── main

async function main(): Promise<void> {
  const teacherId = await ensureTeacherAuthUser()
  const teacher = await repo.upsertTeacher(teacherId, TEACHER_EMAIL, TEACHER_NAME)

  const classroom = await resetClassroom(teacher.id)
  const pinHash = await hashPin(BOT_PIN)

  const students: repo.Student[] = []
  for (const bot of BOTS) {
    students.push(await seedBot(teacher.id, classroom.id, pinHash, bot))
  }

  // เพื่อนชมเพื่อน 1 คู่ ให้ผนังผลงานมีคอมเมนต์ให้ดู
  const [arm, , , , fasai] = students
  if (arm && fasai) {
    await repo.addPeerFeedback(arm.id, fasai.id, {
      praiseText: 'ชื่อร้านอ่านง่ายจำง่ายมาก',
      suggestText: 'ลองเขียนเหตุผลเพิ่มอีกบรรทัดว่าลูกค้าเป็นใคร',
    })
  }

  // ปักหมุดผลงาน 1 ชิ้นขึ้นจอหน้าห้อง ไม่งั้นช่อง "ผลงานที่ครูยกมาให้ดู" บนจอนั้นว่างเปล่า
  if (arm) {
    const armWork = (await repo.listSubmissions(arm.id)).find(
      (row) => row.emphasis_criterion !== null,
    )
    if (armWork) await repo.teacherPinSubmission(teacher.id, armWork.id, true)
  }

  /**
   * เปิดคาบให้พร้อมเล่นทันที เจ้าของตื่นมาไม่ต้องกดตั้งค่าอะไรก่อน
   * ทุกอย่างนี้ครูกดเองได้ที่ /teacher (ดู docs/try-it.md ข้อ 6)
   */
  const session = await repo.ensureClassSession(teacher.id, classroom.id)
  if (!session) throw new Error('เปิดคาบของห้อง UAT ไม่สำเร็จ')
  const moved = await repo.setSessionPhase(
    teacher.id,
    session.id,
    START_PHASE,
    START_TIMER_SECONDS,
  )
  if (!moved) throw new Error('ย้ายช่วงของคาบไม่สำเร็จ')
  await repo.setTestWindow(teacher.id, session.id, 'pre', true)
  await repo.setShowcaseEnabled(teacher.id, classroom.id, true)

  const board = await repo.listClassroomBoard(teacher.id, classroom.id)
  if (!board) throw new Error('ดึงแผงห้องเรียนไม่ได้ (teacherId ไม่ตรงกับเจ้าของห้อง)')

  const pending = await repo.listPendingReview(teacher.id, classroom.id)
  const showcase = await repo.listClassroomShowcase(classroom.id, students[0]!.id)

  console.log('')
  console.log('═══ พร้อมเล่นแล้ว ═══')
  console.log(`ครู       ${TEACHER_EMAIL} / ${TEACHER_PASSWORD}   → http://localhost:3000/teacher`)
  console.log(`รหัสห้อง   ${classroom.room_code}                        → http://localhost:3000/join?code=${classroom.room_code}`)
  console.log(`PIN หุ่น   ${BOT_PIN} (ทุกคน)`)
  console.log(`ช่วงของคาบ ${moved.phase} · แบบทดสอบก่อนเรียน เปิด · ผนังผลงาน เปิด`)
  console.table(
    board.map((r) => ({
      ชื่อเล่น: r.nickname,
      ร้าน: r.businessName,
      ตัวช่วย: r.scaffoldLevel,
      ช่องทาง: r.learningRoute ?? '-',
      สลับ: r.routeSwitches,
      ดาว: `${r.earnedStars}/${r.goalStars ?? '-'}`,
      A: r.stations.A?.status ?? '-',
      B: r.stations.B?.status ?? '-',
      ขอครู: r.needsHelp,
      รอตรวจ: r.pendingReview,
    })),
  )
  console.log(
    `นักเรียนหุ่น ${board.length} คน · งานรอครูตรวจ ${pending?.filter((s) => s.needs_review).length ?? 0} ใบ · ผนังผลงาน ${showcase.length} ชิ้น`,
  )
  console.log('ที่นั่งว่างสำหรับเจ้าของ: เข้า /join พิมพ์ชื่อเล่นใหม่ที่ยังไม่มีในตารางข้างบน')

  // กันเงียบ: ถ้าอนาคตมีใครแก้ repo แล้วหุ่นหาย จะเห็นตรงนี้ทันที
  if (board.length !== BOTS.length) {
    throw new Error(`คาดว่าจะมีหุ่น ${BOTS.length} คน แต่บอร์ดเห็น ${board.length} คน`)
  }
}

main().catch((err: unknown) => {
  console.error('seed-uat ล้มเหลว:', err)
  process.exit(1)
})

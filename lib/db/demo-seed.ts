/**
 * E-16 โหมดสาธิต — ข้อมูลห้องหุ่นสำหรับขึ้นเวที
 *
 * โมดูลนี้เป็น **แหล่งเดียว** ของ "ห้องสาธิตหน้าตาเป็นยังไง" ใช้ร่วมกันสองทาง:
 *   - `scripts/seed-demo.ts`            สร้างห้องครั้งแรก (รันจากเทอร์มินัล)
 *   - `POST /api/teacher/demo-reset`    ครูกดปุ่มล้างกลางเวที แล้วเรียงของกลับเหมือนเดิม
 * ถ้าแยกสองชุด วันแข่งจะได้ห้องคนละหน้าตากับที่ซ้อมมา
 *
 * ⚠️ ข้อมูลทุกตัวเขียนผ่าน `lib/db/repo` + `components/server` เหมือนที่ API route ใช้
 *    ไม่มี INSERT ตรงลงตาราง และไม่มีการเขียน hash ดิบ (PIN ผ่าน hashPin เสมอ)
 */

import quizJson from '../../content/quiz.json'
import { sourceInfo } from '../../components/server/ai'
import { saveShopProfile } from '../../components/server/game-state'
import { buildRevisionBag } from '../../components/server/revision'
import { fallbackGradeReason } from '../ai'
import { hashPin } from '../pin'
import * as repo from './repo'

/** รหัสห้องสาธิต — ต้องผ่าน isValidRoomCode() (ชุดตัวอักษรตัด 0 O 1 I L ทิ้ง) */
export const DEMO_ROOM_CODE = 'QUEST9'
export const DEMO_TEACHER_EMAIL = 'teacher.demo@digital-biz.local'
export const DEMO_TEACHER_PASSWORD = 'demo-teacher-1234'
export const DEMO_TEACHER_NAME = 'ครูเดโม'
/** PIN ของหุ่นทุกตัว — กรรมการสวมรอยเข้าไปดูจอนักเรียนได้ทันที */
export const DEMO_PIN = '1234'

/** ช่วงของคาบที่เปิดค้างไว้ ขึ้นเวทีแล้วไม่ต้องกดตั้งค่าก่อน */
const START_PHASE: repo.SessionPhase = 'mission'
const START_TIMER_SECONDS = 20 * 60

/**
 * สถานะที่หุ่นตัวหนึ่งค้างอยู่ — ต้องมีครบทุกแบบ ไม่งั้นบางจอของครูจะว่างเปล่าตอนสาธิต
 *   confirmed  ครูยืนยันคะแนนแล้ว (มีใบประกาศ)      · pending  ส่งแล้วรอครูตรวจ
 *   revision   ครูตีกลับให้แก้                        · finished ผ่าน 4 ภารกิจ ยังไม่ส่งด่านบอส
 *   working    กำลังทำอยู่                            · stuck    ติด ลองหลายครั้งยังไม่ผ่าน
 *   help       กดขอครู (จุดแดงบนแผงห้องเรียนสด)
 */
export type DemoState =
  | 'confirmed'
  | 'pending'
  | 'revision'
  | 'finished'
  | 'working'
  | 'stuck'
  | 'help'

export interface DemoBot {
  nickname: string
  shopName: string
  businessTypeId: string
  domainName: string
  state: DemoState
  scaffold: 1 | 2 | 3
  goalLevel: repo.GoalLevel
  route: repo.LearningRoute
  preTestScore: number
  /** null = ยังไม่ได้ทำแบบทดสอบหลังเรียน */
  postTestScore: number | null
}

/**
 * 20 ตัว กระจายสถานะให้ทุกจอมีของดู
 * จำนวนต่อสถานะ: ครูยืนยันแล้ว 3 · รอตรวจ 3 · ถูกตีกลับ 2 · ผ่านครบยังไม่ส่ง 2
 *                กำลังทำ 5 · ติดอยู่ 2 · ขอครู 3
 */
export const DEMO_BOTS: readonly DemoBot[] = [
  { nickname: 'อาร์ม', shopName: 'อาร์มเกมเซ็นเตอร์', businessTypeId: 'game', domainName: 'armgame', state: 'confirmed', scaffold: 1, goalLevel: 3, route: 'game', preTestScore: 8, postTestScore: 10 },
  { nickname: 'พลอย', shopName: 'พลอยร้านดอกไม้', businessTypeId: 'flower', domainName: 'ploychflower', state: 'confirmed', scaffold: 1, goalLevel: 3, route: 'clip', preTestScore: 7, postTestScore: 10 },
  { nickname: 'กันต์', shopName: 'กันต์คาร์แคร์', businessTypeId: 'service', domainName: 'kantcarcare', state: 'confirmed', scaffold: 2, goalLevel: 2, route: 'card', preTestScore: 6, postTestScore: 9 },

  { nickname: 'ฟ้าใส', shopName: 'ฟ้าใสเสื้อผ้ามือสอง', businessTypeId: 'secondhand', domainName: 'fasaisecond', state: 'pending', scaffold: 2, goalLevel: 2, route: 'game', preTestScore: 6, postTestScore: 9 },
  { nickname: 'เจแปน', shopName: 'เจแปนข้าวมันไก่', businessTypeId: 'food', domainName: 'japanchicken', state: 'pending', scaffold: 2, goalLevel: 2, route: 'clip', preTestScore: 5, postTestScore: 8 },
  { nickname: 'มิ้นท์', shopName: 'มิ้นท์ชานมไข่มุก', businessTypeId: 'drink', domainName: 'mintmilktea', state: 'pending', scaffold: 3, goalLevel: 1, route: 'card', preTestScore: 4, postTestScore: 7 },

  { nickname: 'บีม', shopName: 'บีมกาแฟดริป', businessTypeId: 'coffee', domainName: 'beamdrip', state: 'revision', scaffold: 2, goalLevel: 2, route: 'clip', preTestScore: 5, postTestScore: 7 },
  { nickname: 'ออม', shopName: 'ออมขนมไทย', businessTypeId: 'bakery', domainName: 'aomthaidessert', state: 'revision', scaffold: 3, goalLevel: 1, route: 'buddy', preTestScore: 3, postTestScore: 6 },

  { nickname: 'ตังค์', shopName: 'ตังค์ซ่อมจักรยาน', businessTypeId: 'service', domainName: 'tangbike', state: 'finished', scaffold: 1, goalLevel: 3, route: 'game', preTestScore: 7, postTestScore: 9 },
  { nickname: 'เนย', shopName: 'เนยเบเกอรี่โฮมเมด', businessTypeId: 'bakery', domainName: 'noeibakery', state: 'finished', scaffold: 2, goalLevel: 2, route: 'card', preTestScore: 6, postTestScore: 8 },

  { nickname: 'มะลิ', shopName: 'มะลิเบเกอรี่', businessTypeId: 'bakery', domainName: 'malibakery', state: 'working', scaffold: 2, goalLevel: 2, route: 'clip', preTestScore: 5, postTestScore: null },
  { nickname: 'ปอนด์', shopName: 'ปอนด์ร้านผลไม้', businessTypeId: 'fruit', domainName: 'pondfruit', state: 'working', scaffold: 2, goalLevel: 2, route: 'game', preTestScore: 5, postTestScore: null },
  { nickname: 'แพร', shopName: 'แพรผ้าไทย', businessTypeId: 'fabric', domainName: 'praethaisilk', state: 'working', scaffold: 2, goalLevel: 1, route: 'card', preTestScore: 4, postTestScore: null },
  { nickname: 'โอ๊ต', shopName: 'โอ๊ตซ่อมมือถือ', businessTypeId: 'phone-repair', domainName: 'oatfixphone', state: 'working', scaffold: 3, goalLevel: 1, route: 'buddy', preTestScore: 4, postTestScore: null },
  { nickname: 'จูน', shopName: 'จูนร้านเครื่องเขียน', businessTypeId: 'stationery', domainName: 'junestationery', state: 'working', scaffold: 3, goalLevel: 1, route: 'clip', preTestScore: 3, postTestScore: null },

  { nickname: 'ต้นกล้า', shopName: 'ต้นกล้าซ่อมมือถือ', businessTypeId: 'phone-repair', domainName: 'tonklafix', state: 'stuck', scaffold: 3, goalLevel: 1, route: 'buddy', preTestScore: 2, postTestScore: null },
  { nickname: 'ดิว', shopName: 'ดิวร้านปลาสวยงาม', businessTypeId: 'pet', domainName: 'dewfishshop', state: 'stuck', scaffold: 3, goalLevel: 1, route: 'card', preTestScore: 2, postTestScore: null },

  { nickname: 'ปูเป้', shopName: 'ปูเป้ดอกไม้สด', businessTypeId: 'flower', domainName: 'poupeflower', state: 'help', scaffold: 3, goalLevel: 1, route: 'card', preTestScore: 3, postTestScore: null },
  { nickname: 'ก้อง', shopName: 'ก้องล้างแอร์', businessTypeId: 'service', domainName: 'kongaircare', state: 'help', scaffold: 3, goalLevel: 1, route: 'buddy', preTestScore: 2, postTestScore: null },
  { nickname: 'แนน', shopName: 'แนนร้านตัดผม', businessTypeId: 'service', domainName: 'nanhairsalon', state: 'help', scaffold: 2, goalLevel: 1, route: 'clip', preTestScore: 3, postTestScore: null },
]

/** ภารกิจที่ผ่านแล้ว + ดาว ต่อสถานะ — คิดที่เดียวเพื่อให้ทุกจอเห็นเลขเดียวกัน */
const MISSION_PLAN: Record<
  DemoState,
  { missions: Array<{ id: repo.MissionId; attempts: number; hints: number; stars: number; passed: boolean }> }
> = {
  confirmed: {
    missions: [
      { id: 'm1', attempts: 1, hints: 0, stars: 3, passed: true },
      { id: 'm2', attempts: 1, hints: 0, stars: 3, passed: true },
      { id: 'm3', attempts: 1, hints: 1, stars: 3, passed: true },
      { id: 'm4', attempts: 2, hints: 0, stars: 2, passed: true },
    ],
  },
  pending: {
    missions: [
      { id: 'm1', attempts: 1, hints: 0, stars: 3, passed: true },
      { id: 'm2', attempts: 1, hints: 1, stars: 2, passed: true },
      { id: 'm3', attempts: 2, hints: 1, stars: 2, passed: true },
      { id: 'm4', attempts: 1, hints: 0, stars: 3, passed: true },
    ],
  },
  revision: {
    missions: [
      { id: 'm1', attempts: 1, hints: 1, stars: 3, passed: true },
      { id: 'm2', attempts: 2, hints: 1, stars: 2, passed: true },
      { id: 'm3', attempts: 2, hints: 2, stars: 1, passed: true },
      { id: 'm4', attempts: 3, hints: 1, stars: 1, passed: true },
    ],
  },
  finished: {
    missions: [
      { id: 'm1', attempts: 1, hints: 0, stars: 3, passed: true },
      { id: 'm2', attempts: 1, hints: 1, stars: 2, passed: true },
      { id: 'm3', attempts: 2, hints: 1, stars: 2, passed: true },
      { id: 'm4', attempts: 2, hints: 1, stars: 2, passed: true },
    ],
  },
  working: {
    missions: [
      { id: 'm1', attempts: 1, hints: 1, stars: 3, passed: true },
      { id: 'm2', attempts: 2, hints: 1, stars: 2, passed: true },
      { id: 'm3', attempts: 2, hints: 1, stars: 0, passed: false },
    ],
  },
  stuck: {
    missions: [
      { id: 'm1', attempts: 3, hints: 2, stars: 1, passed: true },
      { id: 'm2', attempts: 4, hints: 3, stars: 0, passed: false },
    ],
  },
  help: {
    missions: [
      { id: 'm1', attempts: 2, hints: 3, stars: 1, passed: true },
      { id: 'm2', attempts: 3, hints: 3, stars: 0, passed: false },
    ],
  },
}

/** สถานะสถานี A/B ต่อสถานะหุ่น — `needs_help` คือจุดแดงบนแผงครู */
const STATION_PLAN: Record<DemoState, { a: repo.ProgressStatus; b: repo.ProgressStatus }> = {
  confirmed: { a: 'completed', b: 'completed' },
  pending: { a: 'completed', b: 'completed' },
  revision: { a: 'completed', b: 'completed' },
  finished: { a: 'completed', b: 'in_progress' },
  working: { a: 'completed', b: 'in_progress' },
  stuck: { a: 'in_progress', b: 'not_started' },
  help: { a: 'needs_help', b: 'not_started' },
}

const CONFIRMED_DIMENSIONS = {
  'dim-naming': 3,
  'dim-tld-fit': 3,
  'dim-customer-reason': 3,
  'dim-business-link': 3,
} as const

/** ใบเสนอด่านบอสต้องมีสำหรับสถานะไหนบ้าง */
function submissionKind(state: DemoState): 'none' | 'pending' | 'confirmed' | 'revision' {
  if (state === 'confirmed') return 'confirmed'
  if (state === 'pending') return 'pending'
  if (state === 'revision') return 'revision'
  return 'none'
}

/**
 * คะแนนที่ติดไปกับใบเสนอ ต้องเป็นโครงเดียวกับที่ `POST /api/ceo` เขียน
 * หน้า /ceo กับ /result อ่านความเห็นรายด้านจาก `ai_scores.ruleScores.dimensions`
 * ถ้าเขียนเป็นแมปคะแนนแบน ๆ การ์ด "ความเห็นที่ระบบเสนอ" จะไม่ขึ้นเลยตอนสาธิต
 */
function bossAiScores(bot: DemoBot, emphasisCriterion: string) {
  const graded = fallbackGradeReason(
    {
      tldId: 'com',
      reasonText: reasonTextOf(bot),
      domainName: bot.domainName,
      businessTypeId: bot.businessTypeId,
      shopName: bot.shopName,
      isRegisteredCompany: false,
      audience: 'thai',
      emphasisCriterion,
      studentId: undefined,
      missionId: 'big-ceo',
    } as never,
    'not-requested',
  )
  return {
    gradingStatus: 'pending-ai',
    version: 1,
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

/** ช่องทางถัดไปในวง clip → card → game → buddy → clip */
function nextRoute(route: repo.LearningRoute): repo.LearningRoute {
  const order = repo.LEARNING_ROUTES
  return order[(order.indexOf(route) + 1) % order.length] ?? 'game'
}

function reasonTextOf(bot: DemoBot): string {
  return `ชื่อนี้ตรงกับป้ายหน้าร้าน ${bot.shopName} ลูกค้าพิมพ์ตามได้ทันทีไม่ต้องเลื่อนหา`
}

/**
 * คำตอบรายข้อของแบบทดสอบ — ให้ตอบถูก n ข้อแรกตามคะแนนที่กำหนดไว้ในสเปกของหุ่น
 *
 * ต้องมีจริงในตาราง ไม่งั้นค่าความยาก p กับอำนาจจำแนก r บนหน้ารายงานจะว่างเปล่าตอนขึ้นสไลด์
 * (ข้อที่ตอบผิดเลือกช่องถัดจากข้อแรกไว้เฉย ๆ — ค่านี้ไม่ใช่เฉลยและไม่เคยถูกส่งออกฝั่งเบราว์เซอร์)
 */
function quizSheet(set: repo.QuizSetKey, score: number): repo.QuizItemResponseInput[] {
  const items = quizJson[set] as Array<{ id: string }>
  return items.map((item, index) => ({
    itemId: item.id,
    choiceIndex: index < score ? 0 : 1,
    correct: index < score,
  }))
}

/** คำขอเปลี่ยนแผนที่ค้างรอครูตอบ — ให้ปุ่มตอบบนแผงห้องเรียนสดมีของให้กดตอนสาธิต */
const PLAN_REQUESTS: ReadonlyArray<{
  nickname: string
  kind: repo.PlanRequestKind
  requestedValue: string
  missionId: repo.MissionId
  reason: string
}> = [
  {
    nickname: 'ต้นกล้า',
    kind: 'time',
    requestedValue: '5',
    missionId: 'm2',
    reason: 'ผมอ่านโจทย์ช้ากว่าเพื่อน ขอเวลาเพิ่มอีกนิดเดียวครับ',
  },
  {
    nickname: 'ปูเป้',
    kind: 'channel',
    requestedValue: 'clip',
    missionId: 'm2',
    reason: 'อ่านการ์ดแล้วยังไม่เข้าใจ อยากดูคลิปแทนค่ะ',
  },
]

/**
 * แบบสอบถามความพึงพอใจของหุ่นที่เรียนจบแล้ว (S-40)
 *
 * ไม่มีข้อมูลชุดนี้ การ์ด "ความพึงพอใจรายข้อ" บนหน้ารายงานจะไม่ขึ้นเลย
 * ทั้งที่เป็นสถิติที่สเปกข้อ 9.4 แถวแรกขอไว้ (ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐานของความพึงพอใจ)
 * คะแนนจงใจไม่เท่ากันทุกข้อ เพื่อให้เห็นว่าข้อไหนคะแนนตกบนจอจริง
 */
const DEMO_SURVEY: ReadonlyArray<{
  nickname: string
  scores: Record<repo.SurveyScaleItem, number>
  like?: string
  improve?: string
}> = [
  {
    nickname: 'อาร์ม',
    scores: { q1: 5, q2: 5, q3: 5, q4: 4, q5: 5, q6: 5, q7: 5, q8: 5 },
    like: 'ชอบตอนได้ตั้งชื่อร้านตัวเองแล้วระบบบอกว่าชื่อซ้ำไหม',
  },
  {
    nickname: 'พลอย',
    scores: { q1: 5, q2: 4, q3: 5, q4: 4, q5: 4, q6: 5, q7: 5, q8: 4 },
    improve: 'อยากให้มีเวลาคิดชื่อนานกว่านี้อีกนิด',
  },
  {
    nickname: 'กันต์',
    scores: { q1: 4, q2: 4, q3: 4, q4: 3, q5: 4, q6: 4, q7: 4, q8: 4 },
    like: 'ตัวช่วยอ่านง่าย ไม่ได้บอกคำตอบตรง ๆ แต่ทำให้คิดออก',
  },
  {
    nickname: 'ฟ้าใส',
    scores: { q1: 4, q2: 4, q3: 4, q4: 3, q5: 5, q6: 4, q7: 5, q8: 4 },
    improve: 'ด่านที่ 3 ยากกว่าด่านอื่นเยอะ',
  },
  {
    nickname: 'เจแปน',
    scores: { q1: 4, q2: 3, q3: 4, q4: 3, q5: 4, q6: 4, q7: 4, q8: 3 },
  },
  {
    nickname: 'มิ้นท์',
    scores: { q1: 3, q2: 3, q3: 4, q4: 2, q5: 4, q6: 3, q7: 4, q8: 3 },
    improve: 'ตัวหนังสือเล็กไปหน่อยตอนดูในมือถือ',
  },
]

export interface DemoSeedResult {
  classroomId: string
  roomCode: string
  students: number
  pendingReview: number
  planRequests: number
  showcase: number
}

/**
 * เติมหุ่นลงห้องสาธิตที่ "ว่างแล้ว" — เรียกได้ทั้งตอน seed ครั้งแรกและตอนครูกดล้างกลางเวที
 * ห้องต้องเป็นของ `teacherId` จริง ทุกฟังก์ชันของ repo ตรวจซ้ำในคิวรีเดียวกับที่เขียนอยู่แล้ว
 */
export async function fillDemoClassroom(
  teacherId: string,
  classroomId: string,
  roomCode: string,
): Promise<DemoSeedResult> {
  // แฮชครั้งเดียวใช้ทุกตัว — argon2 เป็นงานหนัก ถ้าแฮช 20 รอบปุ่มล้างจะช้าเกินกว่าจะใช้บนเวที
  const pinHash = await hashPin(DEMO_PIN)
  const now = new Date().toISOString()

  const byNickname = new Map<string, repo.Student>()
  for (const bot of DEMO_BOTS) {
    byNickname.set(bot.nickname, await seedBot(teacherId, classroomId, pinHash, bot, now))
  }

  for (const ask of PLAN_REQUESTS) {
    const student = byNickname.get(ask.nickname)
    if (!student) continue
    await repo.createPlanRequest(student.id, {
      kind: ask.kind,
      reason: ask.reason,
      requestedValue: ask.requestedValue,
      missionId: ask.missionId,
    })
  }

  for (const answer of DEMO_SURVEY) {
    const student = byNickname.get(answer.nickname)
    if (!student) continue
    await repo.submitSurveyResponse(student.id, answer.scores, {
      likeText: answer.like ?? null,
      improveText: answer.improve ?? null,
      // ข้อความของเด็กผ่านด่านกรองคำแล้วถึงจะโชว์ให้คนอื่นเห็น — ของหุ่นเขียนเองจึงปลอดภัยอยู่แล้ว
      likeTextSafe: answer.like ?? null,
      improveTextSafe: answer.improve ?? null,
    })
  }

  // เพื่อนชมเพื่อน 2 คู่ ให้ผนังผลงานมีคอมเมนต์ให้ดู ไม่ใช่การ์ดเปล่า
  const arm = byNickname.get('อาร์ม')
  const ploy = byNickname.get('พลอย')
  const fasai = byNickname.get('ฟ้าใส')
  if (arm && fasai) {
    await repo.addPeerFeedback(arm.id, fasai.id, {
      praiseText: 'ชื่อร้านอ่านง่ายจำง่ายมาก',
      suggestText: 'ลองเขียนเหตุผลเพิ่มอีกบรรทัดว่าลูกค้าเป็นใคร',
    })
  }
  if (fasai && ploy) {
    await repo.addPeerFeedback(fasai.id, ploy.id, {
      praiseText: 'เลือกนามสกุลโดเมนได้ตรงกับร้านดี',
      suggestText: 'ชื่ออาจสั้นลงได้อีกนิดจะพิมพ์ง่ายขึ้น',
    })
  }

  // ปักหมุดผลงาน 2 ชิ้นขึ้นจอหน้าห้อง ไม่งั้นช่อง "ผลงานที่ครูยกมาให้ดู" ว่างตอนสาธิต
  let showcase = 0
  for (const student of [arm, ploy]) {
    if (!student) continue
    const work = (await repo.listSubmissions(student.id)).find((row) => row.emphasis_criterion !== null)
    if (work && (await repo.teacherPinSubmission(teacherId, work.id, true))) showcase += 1
  }

  // เปิดคาบให้พร้อมสาธิตทันที ขึ้นเวทีแล้วไม่ต้องกดตั้งค่าอะไรก่อน
  const session = await repo.ensureClassSession(teacherId, classroomId)
  if (!session) throw new Error('เปิดคาบของห้องสาธิตไม่สำเร็จ')
  if (!(await repo.setSessionPhase(teacherId, session.id, START_PHASE, START_TIMER_SECONDS))) {
    throw new Error('ย้ายช่วงของคาบห้องสาธิตไม่สำเร็จ')
  }
  await repo.setTestWindow(teacherId, session.id, 'pre', true)
  await repo.setShowcaseEnabled(teacherId, classroomId, true)

  const pending = await repo.listPendingReview(teacherId, classroomId)
  const asks = await repo.listClassroomPlanRequests(teacherId, classroomId, { includeAnswered: false })

  // กันเงียบ: ถ้าอนาคตมีใครแก้ repo แล้วหุ่นหาย จะเห็นตรงนี้ทันที ไม่ใช่บนเวที
  const board = await repo.listClassroomBoard(teacherId, classroomId)
  if (!board || board.length !== DEMO_BOTS.length) {
    throw new Error(`ห้องสาธิตควรมีหุ่น ${DEMO_BOTS.length} คน แต่บอร์ดเห็น ${board?.length ?? 0} คน`)
  }

  return {
    classroomId,
    roomCode,
    students: board.length,
    pendingReview: (pending ?? []).filter((row) => row.needs_review).length,
    planRequests: asks?.length ?? 0,
    showcase,
  }
}

async function seedBot(
  teacherId: string,
  classroomId: string,
  pinHash: string,
  bot: DemoBot,
  now: string,
): Promise<repo.Student> {
  const student = await repo.joinClassroom({ classroomId, nickname: bot.nickname, pinHash })
  const plan = MISSION_PLAN[bot.state]
  const stations = STATION_PLAN[bot.state]

  await saveShopProfile(student.id, {
    shopName: bot.shopName,
    businessTypeId: bot.businessTypeId,
    domainName: bot.domainName,
    isRegisteredCompany: false,
    audience: 'thai',
  })

  /**
   * `profiles.confidence` ถูกอ่านสองมุมจากก้อนเดียว จึงต้องมีคีย์ทั้งสองชุด
   *   obj-1..obj-4 → ธง calibration บนแผงครู · m1..m4 → listCalibrationFlags()
   * ความมั่นใจผูกกับระดับตัวช่วย: ตัวช่วยเยอะ = มั่นใจน้อย (ยกเว้นคนติดที่มั่นใจเกินจริง 1 คน)
   */
  const base = bot.scaffold === 1 ? 3 : bot.scaffold === 2 ? 2 : 1
  const confidence = { 'obj-1': base, 'obj-2': base, 'obj-3': Math.max(1, base - 1), 'obj-4': Math.max(1, base - 1) }
  const missionConfidence = Object.fromEntries(
    plan.missions.map((m) => [m.id, m.passed ? base : bot.state === 'stuck' ? 3 : Math.max(1, base - 1)]),
  )
  const passedCount = plan.missions.filter((m) => m.passed).length
  await repo.upsertProfile(student.id, {
    confidence: { ...confidence, ...missionConfidence },
    readiness: {
      'obj-1': true,
      'obj-2': passedCount >= 2,
      'obj-3': passedCount >= 3,
      'obj-4': passedCount >= 4,
    },
    pre_test_score: bot.preTestScore,
    ...(bot.postTestScore === null ? {} : { post_test_score: bot.postTestScore }),
    scaffold_level: bot.scaffold,
  })

  await repo.saveSuggestion(student.id, {
    channel: bot.route,
    level: bot.scaffold,
    ownGoalText: `อยากให้ลูกค้าจำชื่อ ${bot.shopName} ได้`,
  })
  await repo.raiseGoal(student.id, bot.goalLevel)
  await repo.switchLearningRoute(student.id, bot.route, { chosenBy: 'system', missionId: null })
  /**
   * คนที่กำลังทำอยู่สลับช่องทางเองกลางคัน = หลักฐาน personalized ใน route_changes
   * สลับไป "ช่องทางถัดไป" ไม่ใช่ช่องทางเดียวกันทุกคน ไม่งั้นแผนภูมิช่องทางบนแผงครูจะกองอยู่ช่องเดียว
   */
  const switched = bot.state === 'working' ? nextRoute(bot.route) : null
  if (switched) {
    await repo.switchLearningRoute(student.id, switched, { chosenBy: 'student', missionId: 'm2' })
  }

  await repo.recordProgress(student.id, 'A', {
    status: stations.a,
    attempts: plan.missions.reduce((sum, m) => sum + m.attempts, 0),
    hints_used: plan.missions.reduce((sum, m) => sum + m.hints, 0),
    started_at: now,
    completed_at: stations.a === 'completed' ? now : null,
  })
  await repo.recordProgress(student.id, 'B', {
    status: stations.b,
    attempts: stations.b === 'not_started' ? 0 : 1,
    hints_used: 0,
    started_at: stations.b === 'not_started' ? null : now,
    completed_at: stations.b === 'completed' ? now : null,
  })

  for (const m of plan.missions) {
    await repo.upsertMissionProgress(student.id, m.id, {
      channel_used: switched && m.id === 'm2' ? switched : bot.route,
      attempts: m.attempts,
      hints_used: m.hints,
      stars: m.stars,
      passed_at: m.passed ? now : null,
    })
  }
  // ดาวรวมต้องคำนวณจาก mission_progress เสมอ ไม่งั้นจอเด็กกับแผงครูไม่ตรงกัน
  await repo.recalcStudentStars(student.id)

  if (bot.state === 'stuck') {
    await repo.recordSkip(student.id, 'm2', 'ยังไม่เข้าใจ อยากลองด่านถัดไปก่อน')
  }

  await repo.recordQuizItemResponses(student.id, 'pre', quizSheet('pre', bot.preTestScore))
  if (bot.postTestScore !== null) {
    await repo.recordQuizItemResponses(student.id, 'post', quizSheet('post', bot.postTestScore))
  }

  await repo.saveChatMessage(student.id, 'dome', `สวัสดี ${bot.nickname} วันนี้เรามาตั้งชื่อร้านบนอินเทอร์เน็ตกัน`, 'scripted')
  await repo.saveChatMessage(student.id, 'student', `ร้านเราชื่อ ${bot.shopName} นะ`, 'scripted')
  await repo.saveReflection(student.id, 'reflect-1', `ได้รู้ว่าชื่อโดเมนของ ${bot.shopName} ต้องพิมพ์ง่ายและตรงกับร้าน`)

  const kind = submissionKind(bot.state)
  if (kind !== 'none') {
    const submission = await repo.saveSubmission(student.id, {
      domainName: bot.domainName,
      tld: '.com',
      reasonText: reasonTextOf(bot),
      aiScores: bossAiScores(bot, 'dim-customer-reason') as never,
      format: 'write',
      emphasisCriterion: 'dim-customer-reason',
      selfScores: { 'dim-naming': 3, 'dim-customer-reason': 2 },
    })

    if (kind === 'confirmed') {
      /**
       * โครงนี้ต้องตรงกับที่ `POST /api/teacher/confirm-score` เขียน
       * `confirmedByTeacher: true` ขาดไม่ได้ ไม่งั้นหน้าเด็กยังขึ้นว่ารอครูยืนยันทั้งที่ตรวจจบแล้ว
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
      await repo.setMissionStars(student.id, 'boss', 3)
      await repo.recalcStudentStars(student.id)
    }

    if (kind === 'revision') {
      // เส้นทางเดียวกับ POST /api/teacher/request-revision (รอบแรก = round 1)
      const bag = buildRevisionBag({
        dimensionIds: ['dim-customer-reason', 'dim-business-link'],
        dimensionScores: { 'dim-customer-reason': 2, 'dim-business-link': 2 },
        note: 'เหตุผลยังกว้างอยู่ ลองบอกให้ชัดว่าลูกค้าของร้านเราคือใคร แล้วส่งใหม่ได้เลย',
        overrideLimit: false,
        round: 1,
        at: now,
      })
      if (!(await repo.confirmSubmissionScores(teacherId, submission.id, bag))) {
        throw new Error(`ส่งงานกลับให้ ${bot.nickname} แก้ไม่สำเร็จ`)
      }
      await repo.logEvent(student.id, 'teacher.revision-requested', {
        submissionId: submission.id,
        dimensionIds: bag.reviseDimensionIds,
        round: 1,
        source: 'demo',
      })
    }
  }

  await repo.logEvent(student.id, 'demo.bot_ready', { state: bot.state })
  await repo.touchStudentPresence(student.id, plan.missions.at(-1)?.id ?? 'map')

  return student
}

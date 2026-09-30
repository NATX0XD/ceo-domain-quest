import { NextResponse } from 'next/server'
import { getQuizSet, type QuizSetName } from '@/core/quiz'
import { GROUP_FRACTION, itemAnalysis, type ItemStat } from '@/core/statistics'
import {
  getClassroomQuizItemSheets,
  listClassroomsByTeacher,
  type QuizSetKey,
} from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../../_lib/session-cookie'

/**
 * ค่าความยาก p และอำนาจจำแนก r รายข้อ — สถิติข้อ 5 จาก 6 ตัวของสเปกข้อ 9.4
 *
 *   GET /api/teacher/report/items?classroomId=<uuid>
 *
 * **คิดที่ core/statistics.itemAnalysis() ที่เดียว** ฐานข้อมูลคืนแค่ "ใครตอบข้อไหนถูก"
 * เขียนสูตรซ้ำใน SQL เมื่อไร ตัวเลขบนสไลด์กับบนจอจะเริ่มไม่ตรงกัน
 *
 * ⚠️ แยกชุด pre กับ post ก่อนคิดเสมอ — เป็นข้อสอบคู่ขนานคนละฉบับ
 *    รวมกันแล้วค่าความยากของทุกข้อจะกลายเป็นค่าเฉลี่ยของ "ข้อที่ครึ่งห้องไม่ได้ทำ"
 * ⚠️ ไม่คืนเฉลยและไม่คืนตัวเลือกที่เด็กกด — (รหัสข้อ + ตัวเลือก + ตอบถูก) = เฉลยข้อนั้น
 *    ตัวโจทย์กับตัวเลือกส่งออกได้ (content/quiz.json เปิดเผยได้) แต่ answerIndex อยู่คนละไฟล์
 * ⚠️ ครูคนอื่นขอห้องนี้ = 404
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** ชื่อชุดที่ครูอ่านรู้เรื่อง — ในเอกสารวิจัยคือข้อสอบคู่ขนานชุด A กับชุด B */
const SET_LABEL: Record<QuizSetKey, string> = {
  // flow-1 ข้อ 19: ห้ามใช้คำว่า "ชุด A/B" ตรงนี้ เพราะคำเดียวกันใช้กับชุดเช็กความเข้าใจที่สลับแจก
  pre: 'แบบทดสอบก่อนเรียน 10 ข้อ',
  post: 'แบบทดสอบหลังเรียน 10 ข้อ',
}

/** แปลค่าความยากเป็นภาษาที่ครูใช้ตัดสินใจได้ (เกณฑ์ 0.20-0.80 ตามสเปกข้อ 9.4) */
function readDifficulty(p: number | null): string {
  if (p === null) return 'ยังไม่มีใครทำข้อนี้'
  if (p > 0.8) return 'ง่ายไป เกือบทุกคนตอบถูก'
  if (p < 0.2) return 'ยากไป แทบไม่มีใครตอบถูก'
  return 'ความยากกำลังดี'
}

/** แปลอำนาจจำแนก (เกณฑ์ตั้งแต่ 0.20 ขึ้นไปตามสเปกข้อ 9.4) */
function readDiscrimination(r: number | null, reason: string | null): string {
  if (r === null) return reason ?? 'คนน้อยเกินกว่าจะแบ่งกลุ่มสูง-ต่ำ'
  if (r < 0) return 'กลับทาง คนได้คะแนนรวมน้อยกลับตอบข้อนี้ถูกมากกว่า ควรตรวจโจทย์กับเฉลยอีกรอบ'
  if (r < 0.2) return 'แยกคนเก่งกับคนอ่อนไม่ออก'
  if (r < 0.4) return 'แยกคนเก่งกับคนอ่อนได้พอใช้'
  return 'แยกคนเก่งกับคนอ่อนได้ดี'
}

/** ทำอย่างไรต่อกับข้อนี้ */
function verdict(stat: ItemStat): string {
  if (stat.usable === null) return 'ข้อมูลยังไม่พอสรุป'
  if (stat.usable) return 'ใช้ข้อนี้ต่อได้'
  if (stat.difficultyOk === false && stat.discriminationOk === false) {
    return 'ควรเขียนข้อนี้ใหม่ ทั้งความยากและอำนาจจำแนกไม่ผ่านเกณฑ์'
  }
  if (stat.difficultyOk === false) return 'ควรปรับความยากของข้อนี้'
  return 'ควรปรับตัวลวง ตัวเลือกที่ผิดอาจดูผิดชัดเกินไป'
}

function analyseSet(set: QuizSetKey, sheets: Record<string, boolean>[]) {
  const questions = getQuizSet(set as QuizSetName)
  const questionText = new Map(questions.map((q) => [q.id, q.question]))
  const objectiveOf = new Map(questions.map((q) => [q.id, q.objectiveIds]))

  // เรียงตามลำดับข้อในไฟล์โจทย์ ไม่ใช่ลำดับที่บังเอิญเจอในฐานข้อมูล
  const order = new Map(questions.map((q, i) => [q.id, i]))
  const stats = itemAnalysis(sheets.map((correctByItem) => ({ correctByItem }))).sort(
    (a, b) => (order.get(a.itemId) ?? 999) - (order.get(b.itemId) ?? 999),
  )

  const scored = stats.filter((s) => s.usable !== null)

  return {
    set,
    label: SET_LABEL[set],
    /** จำนวนคนที่ทำชุดนี้ — น้อยกว่า 4 คนคำนวณอำนาจจำแนกไม่ได้ */
    responders: sheets.length,
    /**
     * กลุ่มสูง/กลุ่มต่ำที่ใช้หาอำนาจจำแนก กลุ่มละกี่คน (27% ของผู้ทำ)
     * ห้องเล็กจะได้กลุ่มละ 1 คน ทำให้ r มีได้แค่ -1 / 0 / 1 — ครูต้องรู้ก่อนตีความ
     */
    groupSize: Math.floor(sheets.length * GROUP_FRACTION),
    itemCount: questions.length,
    usableCount: scored.filter((s) => s.usable === true).length,
    needsReviewCount: scored.filter((s) => s.usable === false).length,
    items: stats.map((s) => ({
      itemId: s.itemId,
      question: questionText.get(s.itemId) ?? s.itemId,
      objectiveIds: objectiveOf.get(s.itemId) ?? [],
      correctCount: s.correctCount,
      responseCount: s.responseCount,
      difficulty: s.difficulty,
      discrimination: s.discrimination,
      difficultyOk: s.difficultyOk,
      discriminationOk: s.discriminationOk,
      usable: s.usable,
      difficultyNote: readDifficulty(s.difficulty),
      discriminationNote: readDiscrimination(s.discrimination, s.reason),
      verdict: verdict(s),
    })),
  }
}

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const classroomId = new URL(request.url).searchParams.get('classroomId')
  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')

  // แยก "ไม่ใช่ห้องของคุณ" ออกจาก "ห้องนี้ยังไม่มีใครทำแบบทดสอบ" — ทั้งคู่คืน 0 แถวเหมือนกัน
  const rooms = await listClassroomsByTeacher(session.teacherId)
  if (!rooms.some((r) => r.id === classroomId)) {
    return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)
  }

  const sheets = await getClassroomQuizItemSheets(session.teacherId, classroomId)

  return NextResponse.json({
    itemAnalysis: {
      classroomId,
      /** เกณฑ์ที่ใช้ตัดสิน ส่งไปให้หน้าจออธิบายครูได้โดยไม่ต้องเขียนเลขซ้ำ */
      criteria: { difficultyMin: 0.2, difficultyMax: 0.8, discriminationMin: 0.2 },
      sets: [analyseSet('pre', sheets.pre), analyseSet('post', sheets.post)],
    },
  })
}

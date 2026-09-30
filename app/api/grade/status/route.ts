import { NextResponse } from 'next/server'
import { type Submission, listSubmissions } from '@/lib/db/repo'
import { certificateStandingOf } from '@/components/server/certificate-eligibility'
import { revisionDimensions, revisionState } from '@/components/server/revision'
import { studentNextStep } from '@/components/server/next-step'
import { readStudentSession, unauthorized } from '../../_lib/session-cookie'

/**
 * สถานะการตรวจงานของผู้เรียนคนที่ถือคุกกี้ใบนี้ — **สำหรับให้หน้าจอ poll**
 *
 * ทำไมต้องมี: เด็กกดส่งใบเสนอแล้วหน้าจอเงียบ ไม่รู้ว่า "ครูอ่านหรือยัง" หรือ "ต้องแก้อะไรไหม"
 * ต้องรีเฟรชเองไปเรื่อย ๆ ซึ่งในคาบจริงแปลว่าเด็กนั่งจ้องจอแทนที่จะไปทำอย่างอื่นต่อ
 *
 * **ออกแบบให้เบา เพราะถูกยิงซ้ำ ๆ**
 * - อ่านฐานข้อมูล **ครั้งเดียว** (`listSubmissions`) แล้วเอาแถวชุดเดิมไปคิดทั้งสองอย่าง
 *   (สถานะการตรวจ + สถานะใบประกาศ) ผ่าน `certificateStandingOf(rows)` ที่เป็นตัวคิดล้วน ๆ
 * - ไม่แตะ AI ไม่แตะคิว ไม่เขียนอะไรลงฐานข้อมูลเลย
 * - บอก `pollAfterSeconds` กลับไปด้วย หน้าจอจะได้ไม่ต้องเดาจังหวะเอง และ **หยุด poll เองเมื่อจบ**
 *
 * ⚠️ **ห้ามส่งคะแนนที่ AI เสนอออกมาทางนี้เด็ดขาด**
 *    คะแนนของ AI เป็นข้อเสนอ**สำหรับครู** ไม่ใช่ผลของผู้เรียน ที่นี่จึงบอกแค่ว่า
 *    "ตรวจถึงไหนแล้ว" (`aiCheck`) ไม่บอกว่า AI ให้เท่าไร
 * ⚠️ studentId มาจากคุกกี้ dbq_student เท่านั้น ไม่มีพารามิเตอร์ให้ส่งเข้ามา
 * ⚠️ ข้อความทุกอันมาจาก `certificateStandingOf` ที่คุมถ้อยคำไว้แล้ว (ห้ามมีคำว่าตก/ไม่ผ่าน — สเปกข้อ 2.3)
 *    ไม่แต่งข้อความใหม่ที่นี่ เพื่อไม่ให้มีสองแหล่งความจริงเรื่องคำพูด
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** ยังมีอะไรเคลื่อนไหวอยู่ = ถามใหม่ในอีกกี่วินาที */
const POLL_SECONDS = 10

/** สถานะของงานในสายตาผู้เรียน */
export type GradeState =
  /** ยังไม่ได้ส่งใบเสนอของภารกิจใหญ่ */
  | 'not-submitted'
  /** ส่งแล้ว รอครูอ่าน */
  | 'waiting-teacher'
  /** ครูส่งกลับมาให้แก้ */
  | 'revise'
  /** ครูยืนยันคะแนนแล้ว */
  | 'confirmed'

/** การตรวจของ AI เดินถึงไหน — เป็นงานเบื้องหลัง ไม่ใช่สิ่งที่ผู้เรียนต้องรอ */
export type AiCheckState =
  | 'not-submitted'
  /** ยังไม่ได้ฝากเข้าคิว (ใบเก่าก่อนมีคิว) */
  | 'not-requested'
  /** อยู่ในคิว หรือกำลังตรวจ */
  | 'in-progress'
  /** ตรวจเสร็จแล้ว ครูเห็นข้อเสนอของ AI คู่กับของกฎ */
  | 'done'
  /** ตรวจไม่สำเร็จ — **ไม่กระทบผู้เรียน** คะแนนจากกฎบันทึกไปตั้งแต่ตอนกดส่งแล้ว */
  | 'unavailable'

const STATE_LABEL: Record<GradeState, string> = {
  'not-submitted': 'ยังไม่ได้ส่งงาน',
  'waiting-teacher': 'ส่งแล้ว รอครูอ่าน',
  revise: 'ครูส่งกลับมาให้แก้',
  confirmed: 'ครูตรวจเรียบร้อยแล้ว',
}

/**
 * แปลง `ai_scores.gradingStatus` ที่ฝั่งคิวเขียนไว้ ให้เป็นคำที่หน้าจอใช้ได้
 * `pending-ai` = ฝากเข้าคิวแล้วรอ worker · `done` = worker เติมข้อเสนอของ AI แล้ว · `ai-failed` = ลองครบ 3 รอบแล้วไม่สำเร็จ
 */
function aiCheckOf(submission: Submission | null): AiCheckState {
  if (!submission) return 'not-submitted'
  const bag = submission.ai_scores
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return 'not-requested'
  const status = (bag as Record<string, unknown>).gradingStatus
  if (status === 'pending-ai') return 'in-progress'
  if (status === 'done') return 'done'
  if (status === 'ai-failed') return 'unavailable'
  return 'not-requested'
}

export async function GET() {
  const session = await readStudentSession()
  if (!session) return unauthorized('ยังไม่ได้เข้าห้อง')

  // อ่านครั้งเดียว แล้วใช้แถวชุดนี้คิดทุกอย่าง
  const rows = await listSubmissions(session.studentId)
  const state = revisionState(rows)
  const standing = certificateStandingOf(rows)
  const latest = state.latest

  const gradeState: GradeState =
    latest === null
      ? 'not-submitted'
      : state.request
        ? 'revise'
        : latest.teacher_confirmed_scores === null
          ? 'waiting-teacher'
          : 'confirmed'

  const aiCheck = aiCheckOf(latest)

  return NextResponse.json({
    ok: true,
    submissionId: latest?.id ?? null,
    /** ส่งมาแล้วกี่ฉบับ — ฉบับเดิมไม่เคยถูกทับ ครูเทียบพัฒนาการได้ */
    versionCount: state.versionCount,
    state: gradeState,
    stateLabel: STATE_LABEL[gradeState],
    aiCheck,
    /**
     * ข้อความที่แสดงให้ผู้เรียนได้เลย มาจากตัวเดียวกับที่หน้าใบประกาศใช้
     * จึงไม่มีทางที่สองหน้าจะพูดคนละเรื่องกัน
     */
    message: standing.message,
    nextHref: standing.nextHref,
    nextLabel: standing.nextLabel,
    /**
     * "ตอนนี้ต้องทำอะไรต่อ" จาก `studentNextStep()` ซึ่งเป็นแหล่งความจริงเดียวของทั้งระบบ
     * การ์ดนี้อยู่บนหน้า /ceo จึงส่ง `onBossScreen` ไปด้วย ปุ่มจะได้ไม่ชี้กลับมาหน้าเดิม
     */
    nextStep: studentNextStep({
      status: standing.status,
      missingCount: standing.missing.length,
      onBossScreen: true,
    }),
    /** ครูสั่งแก้อะไรไว้ — `null` เมื่อไม่ได้อยู่ในรอบแก้ */
    revision: state.request
      ? {
          note: state.request.note,
          dimensions: revisionDimensions(state.request),
          round: state.roundsUsed + 1,
          roundsLeft: state.roundsLeft,
        }
      : null,
    /** ความคืบหน้าของเกณฑ์ใบประกาศ — ไม่มีคะแนนดิบ มีแค่ว่าผ่านกี่ด้านจากกี่ด้าน */
    certificate: {
      status: standing.status,
      eligible: standing.eligible,
      passedCount: standing.passedCount,
      totalCount: standing.totalCount,
      missing: standing.missing.map((d) => ({
        id: d.id,
        shortName: d.shortName,
        whatGetsYouThere: d.whatGetsYouThere,
      })),
    },
    /** `0` = จบแล้ว ไม่ต้องถามอีก · หน้าจอไม่ต้องเดาจังหวะเอง */
    pollAfterSeconds: gradeState === 'confirmed' || gradeState === 'not-submitted' ? 0 : POLL_SECONDS,
  })
}

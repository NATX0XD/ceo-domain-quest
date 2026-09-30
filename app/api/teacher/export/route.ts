import missionsJson from '@/content/missions.json'
import {
  getClassroomReportRaw,
  getOwnedClassroom,
  listClassroomEvents,
  listClassroomReflections,
  listSurveyResponses,
  type RawStudentRow,
} from '@/lib/db/repo'
import { errorResponse, readTeacherSession, unauthorized } from '../../_lib/session-cookie'

/**
 * T-13 ส่งออกข้อมูลเป็น CSV สำหรับเอกสารประกวด
 *
 *   GET /api/teacher/export?classroomId=<uuid>&type=students|scores|events|reflections|survey
 *   &pseudonymize=1   แทนชื่อเล่นด้วยรหัส S01 S02 ... (ใช้เมื่อนำข้อมูลออกนอกห้องเรียน)
 *
 * **PDPA**: ไฟล์ทุกชนิดมีได้อย่างมากแค่ชื่อเล่น — ไม่มีชื่อจริง เลขประจำตัว อีเมล รหัสผ่าน
 * หรือ hash ของรหัส 4 หลัก · ไฟล์แบบสอบถามไม่มีตัวระบุผู้ตอบตั้งแต่ในฐานข้อมูลอยู่แล้ว
 * · id ภายในเป็น uuid สุ่ม ไม่ผูกกับตัวตนจริง และถูกตัดออกเมื่อเลือก pseudonymize
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXPORT_TYPES = ['students', 'scores', 'events', 'reflections', 'survey'] as const
type ExportType = (typeof EXPORT_TYPES)[number]

const MISSION_IDS_ORDER = missionsJson.missions.map((m) => m.id)

/** ใส่ BOM ให้ Excel อ่านภาษาไทยไม่เพี้ยน (เกณฑ์ตรวจรับข้อ 1 ของ T-13) */
const BOM = '﻿'

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  // ตัด = + - @ นำหน้า กัน Excel ตีความเป็นสูตร (CSV injection)
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return BOM + [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n')
}

function num(value: unknown, fallback: number | '' = ''): number | '' {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function confirmedWeighted(row: RawStudentRow): number | '' {
  const scores = row.submission?.teacherScores as Record<string, unknown> | null | undefined
  const weighted = scores?.weightedTotal
  return typeof weighted === 'number' ? weighted : ''
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * ตอนเลือกแทนชื่อด้วยรหัส ต้องลบ uuid ในรายละเอียดเหตุการณ์ออกด้วย
 * ไม่งั้นเอาไฟล์สองก้อนมาต่อกันก็ย้อนกลับไปหาว่าใครเป็นใครได้ (re-identification)
 */
function scrubIds(value: unknown, code: Map<string, string>): unknown {
  if (value === null || value === undefined) return value
  return JSON.parse(
    JSON.stringify(value).replace(UUID_RE, (id) => code.get(id.toLowerCase()) ?? 'ID'),
  )
}

function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}

export async function GET(request: Request) {
  const session = await readTeacherSession()
  if (!session) return unauthorized()

  const params = new URL(request.url).searchParams
  const classroomId = params.get('classroomId')
  const type = (params.get('type') ?? 'students') as ExportType
  const pseudonymize = params.get('pseudonymize') === '1'

  if (!classroomId) return errorResponse('bad-request', 'ต้องส่ง classroomId')
  if (!EXPORT_TYPES.includes(type)) {
    return errorResponse('bad-request', `type ต้องเป็นหนึ่งใน ${EXPORT_TYPES.join(' | ')}`)
  }

  const raw = await getClassroomReportRaw(session.teacherId, classroomId)
  if (!raw) return errorResponse('not-found', 'ไม่พบห้องนี้ในบัญชีของคุณ', 404)

  // รหัสแทนตัว S01 S02 ... เรียงตามชื่อเล่นเพื่อให้ผลคงที่ทุกครั้งที่ส่งออก
  const code = new Map<string, string>()
  raw.students.forEach((s, i) => code.set(s.studentId, `S${String(i + 1).padStart(2, '0')}`))
  const label = (studentId: string, nickname: string | null | undefined): string =>
    pseudonymize ? (code.get(studentId) ?? 'S??') : (nickname ?? '')

  const stamp = new Date().toISOString().slice(0, 10)

  /**
   * E-16 ไฟล์จากห้องสาธิตต้องดูออกตั้งแต่ชื่อไฟล์ ก่อนจะเปิดอ่าน
   * ไฟล์ CSV ไปจบที่โฟลเดอร์เดียวกับไฟล์ของห้องจริง ถ้าไม่ติดป้ายไว้ที่ชื่อ
   * วันหนึ่งจะมีคนหยิบตัวเลขห้องหุ่นขึ้นสไลด์แล้วอ้างว่าเป็นผลการทดลอง
   * (ชื่อคอลัมน์ในไฟล์ไม่เปลี่ยน — สคริปต์ที่อ่านไฟล์เดิมอยู่จึงไม่พัง)
   */
  const classroom = await getOwnedClassroom(session.teacherId, classroomId)
  // ASCII ล้วน — header content-disposition ใส่ภาษาไทยตรง ๆ ไม่ได้ (latin-1 เท่านั้น)
  const filePrefix = classroom?.is_demo ? 'DEMO-not-real-data-' : ''

  if (type === 'students') {
    const headers = [
      'รหัส', 'ชื่อเล่น', 'ช่องทางที่ระบบเสนอ', 'ช่องทางที่ใช้', 'ใครเลือก', 'สลับช่องทาง (ครั้ง)',
      'ระดับตัวช่วย', 'เป้าดาว', 'ยกเป้า (ครั้ง)', 'ดาวที่ได้',
      ...MISSION_IDS_ORDER.flatMap((id) => [`${id} ผ่าน`, `${id} ดาว`, `${id} ครั้งที่พยายาม`, `${id} วินาที`]),
      'ข้ามภารกิจ', 'คะแนนรูบริกที่ครูยืนยัน', 'ครูแก้จาก AI', 'ก่อนเรียน', 'หลังเรียน', 'พัฒนาการ',
      'สะท้อนคิด (ข้อ)', 'ครูแก้แผนให้ (ครั้ง)',
    ]

    const rows = raw.students.map((s) => {
      const byId = new Map(s.missions.map((m) => [m.missionId, m]))
      const skipped = new Set(s.skips.map((k) => k.missionId))
      const pre = num(s.profile?.preTestScore)
      const post = num(s.profile?.postTestScore)
      return [
        code.get(s.studentId),
        pseudonymize ? '' : s.nickname,
        s.profile?.channelSuggested, s.profile?.learningRoute, s.profile?.channelChosenBy,
        num(s.profile?.channelSwitches, 0), num(s.profile?.scaffoldLevel), num(s.profile?.goalStars),
        num(s.profile?.goalRaisedCount, 0), num(s.profile?.earnedStars, 0),
        ...MISSION_IDS_ORDER.flatMap((id) => {
          const m = byId.get(id)
          return [
            skipped.has(id) ? 'ข้าม' : m?.passed ? 'ผ่าน' : 'ยังไม่ผ่าน',
            num(m?.stars, 0), num(m?.attempts, 0), num(m?.secondsSpent),
          ]
        }),
        s.skips.map((k) => k.missionId).join(' '),
        confirmedWeighted(s),
        s.submission?.teacherChanged ? 'ใช่' : '',
        pre, post,
        typeof pre === 'number' && typeof post === 'number' ? post - pre : '',
        s.reflectionCount, s.overrides,
      ]
    })

    return csvResponse(`${filePrefix}students-${stamp}.csv`, toCsv(headers, rows))
  }

  if (type === 'scores') {
    const headers = ['รหัส', 'ชื่อเล่น', 'ก่อนเรียน', 'หลังเรียน', 'พัฒนาการ', 'ดาวที่ได้', 'คะแนนรูบริกที่ครูยืนยัน']
    const rows = raw.students.map((s) => {
      const pre = num(s.profile?.preTestScore)
      const post = num(s.profile?.postTestScore)
      return [
        code.get(s.studentId), pseudonymize ? '' : s.nickname, pre, post,
        typeof pre === 'number' && typeof post === 'number' ? post - pre : '',
        num(s.profile?.earnedStars, 0), confirmedWeighted(s),
      ]
    })
    return csvResponse(`${filePrefix}scores-${stamp}.csv`, toCsv(headers, rows))
  }

  if (type === 'events') {
    const events = await listClassroomEvents(session.teacherId, classroomId)
    const headers = ['เวลา', 'รหัส', 'ชื่อเล่น', 'ชนิดเหตุการณ์', 'รายละเอียด']
    const rows = events.map((e) => [
      e.created_at,
      code.get(e.student_id) ?? '',
      pseudonymize ? '' : label(e.student_id, (e as { students?: { nickname?: string } }).students?.nickname),
      e.type,
      pseudonymize ? scrubIds(e.payload, code) : e.payload,
    ])
    return csvResponse(`${filePrefix}events-${stamp}.csv`, toCsv(headers, rows))
  }

  if (type === 'reflections') {
    const reflections = await listClassroomReflections(session.teacherId, classroomId)
    const headers = ['เวลา', 'รหัส', 'ชื่อเล่น', 'คำถาม', 'คำตอบ']
    const rows = reflections.map((r) => [
      r.created_at,
      code.get(r.student_id) ?? '',
      pseudonymize ? '' : label(r.student_id, (r as { students?: { nickname?: string } }).students?.nickname),
      r.question_id,
      r.answer_text,
    ])
    return csvResponse(`${filePrefix}reflections-${stamp}.csv`, toCsv(headers, rows))
  }

  // แบบสอบถาม — ไม่มีตัวระบุผู้ตอบเลยตั้งแต่ในฐานข้อมูล (S-40) จึงไม่มีคอลัมน์ชื่อให้ส่งออก
  const responses = await listSurveyResponses(session.teacherId, classroomId)
  const headers = [
    'เวลา', 'ข้อ1 ใช้งานง่าย', 'ข้อ2 คำแนะนำชัดเจน', 'ข้อ3 ตรงความสนใจ', 'ข้อ4 ความยากพอดี',
    'ข้อ5 ตัวช่วยเข้าใจขึ้น', 'ข้อ6 ผลย้อนกลับมีประโยชน์', 'ข้อ7 อยากเรียนแบบนี้อีก', 'ข้อ8 พอใจโดยรวม',
    'ข้อ9 ชอบอะไรมากที่สุด', 'ข้อ10 อยากให้ปรับอะไร',
  ]
  const rows = responses.map((r) => [
    r.created_at, r.q1, r.q2, r.q3, r.q4, r.q5, r.q6, r.q7, r.q8,
    r.like_text_safe ?? '', r.improve_text_safe ?? '',
  ])
  return csvResponse(`${filePrefix}survey-${stamp}.csv`, toCsv(headers, rows))
}

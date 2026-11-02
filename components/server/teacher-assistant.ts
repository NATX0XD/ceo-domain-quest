import type { ClassroomReportRaw } from '@/lib/db/repo'
import type { StudentLearnResult } from './learn-results'

/**
 * "ถามโดม" ฝั่งครู — สร้างข้อมูลห้องแบบย่อ + ตอบสำรองด้วยกฎเมื่อ AI ไม่ว่าง
 *
 * ⚠️ ข้อมูลที่ออกจากไฟล์นี้ไปถึงโมเดลมีแค่ชื่อเล่นกับตัวเลข — ไม่มี PIN รหัสห้อง รหัสนักเรียน อีเมล
 *    (ชื่อร้าน/โดเมนก็ไม่ส่ง เพราะไม่จำเป็นกับคำถามภาพรวม)
 */

export const ASSIST_MISSIONS = ['m1', 'm2', 'm3', 'm4', 'm5'] as const
export const ASSIST_CONTEXT_MAX_CHARS = 7000

export interface AssistStudent {
  nickname: string
  passed: number
  total: number
  stars: number
  /** ภารกิจที่เริ่มแล้วแต่ยังไม่ผ่าน (ข้อแรกตามลำดับ) */
  stuck: string | null
  attempts: number
  lastActiveAt: string | null
  pending: number
  requests: number
  /** ผลเช็กพื้นฐานก่อนเรียน เช่น "m1 3/5" */
  warmup: string[]
  started: boolean
  posttest: boolean
}

export interface AssistContext {
  students: AssistStudent[]
  now: number
}

export interface AssistInputs {
  raw: ClassroomReportRaw
  learn: readonly StudentLearnResult[]
  /** ชื่อเล่น -> จำนวนงานรอตรวจ */
  pendingByNickname: ReadonlyMap<string, number>
  /** รหัสนักเรียน -> จำนวนคำขอที่ยังไม่ตอบ (ใช้จับคู่ภายในเท่านั้น ไม่ออกไปถึงโมเดล) */
  requestsByStudent: ReadonlyMap<string, number>
  now?: number
}

const ts = (v: string | null | undefined) => {
  const n = v ? Date.parse(v) : NaN
  return Number.isFinite(n) ? n : 0
}

export function buildAssistContext({ raw, learn, pendingByNickname, requestsByStudent, now = Date.now() }: AssistInputs): AssistContext {
  const learnById = new Map(learn.map((l) => [l.studentId, l]))
  const students = raw.students.map((s): AssistStudent => {
    const byMission = new Map(s.missions.map((m) => [m.missionId, m]))
    const learnMissions = learnById.get(s.studentId)?.missions ?? []
    let stuck: string | null = null
    let passed = 0
    let attempts = 0
    let last = 0
    for (const id of ASSIST_MISSIONS) {
      const m = byMission.get(id)
      if (!m) continue
      if (m.passed) passed += 1
      attempts += m.attempts ?? 0
      last = Math.max(last, ts(m.startedAt), ts(m.passedAt))
      const done = m.passed || m.skippedBy
      if (!stuck && !done && (m.startedAt || m.attempts > 0)) stuck = id
    }
    for (const lm of learnMissions) last = Math.max(last, ts(lm.lastActivityAt))
    const warmup = learnMissions
      .filter((lm) => lm.warmupScore !== null && lm.warmupTotal !== null)
      .map((lm) => `${lm.missionId} ${lm.warmupScore}/${lm.warmupTotal}`)
    const started = last > 0 || attempts > 0 || learnMissions.length > 0
    return {
      nickname: s.nickname,
      passed,
      total: ASSIST_MISSIONS.length,
      stars: s.profile?.earnedStars ?? s.missions.reduce((sum, m) => sum + (m.stars ?? 0), 0),
      stuck,
      attempts,
      lastActiveAt: last > 0 ? new Date(last).toISOString() : null,
      pending: pendingByNickname.get(s.nickname) ?? 0,
      requests: requestsByStudent.get(s.studentId) ?? 0,
      warmup,
      started,
      posttest: s.profile?.postTestScore != null,
    }
  })
  return { students, now }
}

export function ago(iso: string | null, now: number): string {
  if (!iso) return 'ยังไม่มีกิจกรรม'
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (min < 2) return 'เมื่อสักครู่'
  if (min < 60) return `${min} นาทีก่อน`
  if (min < 60 * 24) return `${Math.round(min / 60)} ชม.ก่อน`
  return `${Math.round(min / 60 / 24)} วันก่อน`
}

/** ข้อความข้อมูลห้องสำหรับโมเดล — ตัดความยาวไม่เกิน ASSIST_CONTEXT_MAX_CHARS */
export function contextToText(ctx: AssistContext): string {
  const n = ctx.students.length
  const notStarted = ctx.students.filter((s) => !s.started).length
  const header = `นักเรียน ${n} คน · ยังไม่เริ่ม ${notStarted} · ผ่านครบ ${ctx.students.filter((s) => s.passed >= s.total).length} · งานรอตรวจรวม ${ctx.students.reduce((a, s) => a + s.pending, 0)} · คำขอรอตอบรวม ${ctx.students.reduce((a, s) => a + s.requests, 0)}`
  const lines = ctx.students.map(
    (s) =>
      `${s.nickname.slice(0, 30)} | ผ่าน ${s.passed}/${s.total} | ${s.stars} ดาว | ${s.started ? `ติด ${s.stuck ?? '-'}` : 'ยังไม่เริ่ม'} | ลองรวม ${s.attempts} | ล่าสุด ${ago(s.lastActiveAt, ctx.now)} | รอตรวจ ${s.pending} | คำขอ ${s.requests} | พื้นฐาน ${s.warmup.join(',') || '-'}`,
  )
  let out = header
  for (const l of lines) {
    if (out.length + l.length + 1 > ASSIST_CONTEXT_MAX_CHARS) {
      out += '\n(ตัดรายชื่อที่เหลือเพราะยาวเกิน)'
      break
    }
    out += `\n${l}`
  }
  return out
}

// ───────────────────────────── ทางสำรอง: ตอบด้วยกฎ

export type AssistIntent = 'student' | 'not-started' | 'stuck' | 'help-first' | 'summary'

export interface MatchedIntent {
  intent: AssistIntent
  mission?: string
  student?: AssistStudent
}

export function matchIntent(question: string, students: readonly AssistStudent[]): MatchedIntent {
  const q = question.toLowerCase()
  const named = [...students]
    .filter((s) => s.nickname.trim().length >= 2 && q.includes(s.nickname.trim().toLowerCase()))
    .sort((a, b) => b.nickname.length - a.nickname.length)[0]
  if (named) return { intent: 'student', student: named }
  if (/ไม่เริ่ม|ยังไม่ได้เล่น|ยังไม่ได้เข้า|ไม่ได้เริ่ม|ยังไม่ทำ/.test(q)) return { intent: 'not-started' }
  if (/ช่วยใครก่อน|ควรช่วย|ต้องช่วย|ช่วยใคร|ดูแลใคร|ใครต้องการความช่วย/.test(q)) return { intent: 'help-first' }
  if (/ติด|ค้าง|ไม่ผ่าน|สะดุด/.test(q)) {
    const m = q.match(/m\s*([1-5])|ภารกิจ\s*(?:ที่\s*)?([1-5])/)
    const num = m?.[1] ?? m?.[2]
    return { intent: 'stuck', mission: num ? `m${num}` : undefined }
  }
  return { intent: 'summary' }
}

const names = (list: readonly AssistStudent[], max = 12) =>
  list.slice(0, max).map((s) => s.nickname).join(', ') + (list.length > max ? ` และอีก ${list.length - max} คน` : '')

export function fallbackAnswer(question: string, ctx: AssistContext): string {
  const { students, now } = ctx
  if (students.length === 0) return 'ห้องนี้ยังไม่มีนักเรียนเข้าห้องครับ'
  const hit = matchIntent(question, students)

  if (hit.intent === 'student' && hit.student) {
    const s = hit.student
    const lines = [
      `- ${s.nickname}: ผ่าน ${s.passed}/${s.total} ภารกิจ · ${s.stars} ดาว`,
      s.started ? `- ${s.stuck ? `ตอนนี้ยังไม่ผ่าน ${s.stuck} (ลองรวม ${s.attempts} ครั้ง)` : 'ไม่มีภารกิจที่ค้างอยู่'}` : '- ยังไม่เริ่มทำภารกิจ',
      `- ใช้งานล่าสุด: ${ago(s.lastActiveAt, now)}`,
    ]
    if (s.warmup.length) lines.push(`- เช็กพื้นฐาน: ${s.warmup.join(', ')}`)
    if (s.pending) lines.push(`- มีงานรอครูตรวจ ${s.pending} ชิ้น`)
    if (s.requests) lines.push(`- มีคำขอรอตอบ ${s.requests} รายการ`)
    return lines.join('\n')
  }

  if (hit.intent === 'not-started') {
    const list = students.filter((s) => !s.started)
    return list.length ? `ยังไม่เริ่ม ${list.length} คนครับ\n- ${names(list)}` : 'ทุกคนเริ่มทำภารกิจแล้วครับ'
  }

  if (hit.intent === 'stuck') {
    const stuck = students.filter((s) => s.stuck && (!hit.mission || s.stuck === hit.mission))
    if (!stuck.length) return hit.mission ? `ตอนนี้ไม่มีใครค้างที่ ${hit.mission.toUpperCase()} ครับ` : 'ตอนนี้ไม่มีใครค้างภารกิจครับ'
    if (hit.mission) return `ค้างที่ ${hit.mission.toUpperCase()} ${stuck.length} คนครับ\n- ${names(stuck)}`
    return ASSIST_MISSIONS.map((id) => ({ id, list: stuck.filter((s) => s.stuck === id) }))
      .filter((g) => g.list.length)
      .map((g) => `- ${g.id.toUpperCase()}: ${names(g.list, 8)} (${g.list.length} คน)`)
      .join('\n')
  }

  if (hit.intent === 'help-first') {
    const score = (s: AssistStudent) => (s.stuck ? 3 + Math.min(s.attempts, 6) : 0) + s.requests * 3 + s.pending + (s.started ? 0 : 1)
    const top = [...students].filter((s) => score(s) > 0).sort((a, b) => score(b) - score(a)).slice(0, 5)
    if (!top.length) return 'ตอนนี้ไม่เห็นใครที่ต้องช่วยด่วนครับ'
    return (
      'ควรดูก่อนตามลำดับนี้ครับ\n' +
      top
        .map((s) => {
          const why = [s.stuck ? `ค้าง ${s.stuck.toUpperCase()} (ลอง ${s.attempts})` : '', s.requests ? `คำขอรอตอบ ${s.requests}` : '', s.pending ? `รอตรวจ ${s.pending}` : '', !s.started ? 'ยังไม่เริ่ม' : '']
            .filter(Boolean)
            .join(' · ')
          return `- ${s.nickname}: ${why}`
        })
        .join('\n')
    )
  }

  const done = students.filter((s) => s.passed >= s.total)
  const idle = students.filter((s) => !s.started)
  const pending = students.reduce((a, s) => a + s.pending, 0)
  const reqs = students.reduce((a, s) => a + s.requests, 0)
  const avg = students.reduce((a, s) => a + s.passed, 0) / students.length
  const lines = [
    `- นักเรียน ${students.length} คน · ผ่านเฉลี่ย ${avg.toFixed(1)}/${ASSIST_MISSIONS.length} ภารกิจ`,
    `- ผ่านครบ ${done.length} คน (ได้ใบประกาศอัตโนมัติแล้ว) · ยังไม่เริ่ม ${idle.length} คน`,
    `- งานรอตรวจ ${pending} ชิ้น · คำขอรอตอบ ${reqs} รายการ`,
  ]
  const busiest = ASSIST_MISSIONS.map((id) => ({ id, n: students.filter((s) => s.stuck === id).length })).sort((a, b) => b.n - a.n)[0]
  if (busiest && busiest.n > 0) lines.push(`- ค้างมากที่สุดที่ ${busiest.id.toUpperCase()} (${busiest.n} คน)`)
  return lines.join('\n')
}

export const SUGGESTED_QUESTIONS = ['สรุปห้องนี้', 'ใครยังไม่เริ่ม', 'ใครติดภารกิจไหนบ้าง', 'ควรช่วยใครก่อน'] as const

import * as repo from '../lib/db/repo'
import { getServiceClient } from '../lib/db/client'
import { loadEnvLocal } from './load-env'
import { genRoomCode } from '../lib/room-code'

loadEnvLocal()

const base = process.env.APP_BASE_URL ?? 'http://localhost:3000'
const roomCode = genRoomCode()
const nickname = `fx6-${Date.now().toString(36)}`
const pin = '2468'

class Client {
  jar = new Map<string, string>()
  async req(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(this.jar.size ? { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    for (const raw of res.headers.getSetCookie()) {
      const pair = raw.split(';')[0] ?? ''
      const at = pair.indexOf('=')
      if (at > 0) this.jar.set(pair.slice(0, at), pair.slice(at + 1))
    }
    const text = await res.text()
    let json: Record<string, unknown> | null = null
    try { json = JSON.parse(text) as Record<string, unknown> } catch { /* html */ }
    return { status: res.status, json, text }
  }
}

const compact = (row: Record<string, unknown>) => ({
  status: row.status,
  source: row.source,
  provider: row.provider,
  fallbackReason: row.fallbackReason ?? null,
})

async function main() {
  const db = getServiceClient()
  const teacher = await db.from('teachers').select('id').eq('email', 'kru@uat.local').maybeSingle()
  if (!teacher.data) throw new Error('UAT teacher missing')
  const classroom = await repo.createClassroom(teacher.data.id, roomCode)
  const teacherClient = new Client()
  const studentClient = new Client()
  let studentId = ''
  try {
    const login = await teacherClient.req('/api/teacher/login', { email: 'kru@uat.local', password: 'uat1234' })
    if (login.status !== 200) throw new Error(`teacher login ${login.status}`)
    await teacherClient.req('/api/teacher/session', { action: 'open', classroomId: classroom.id })
    const joined = await studentClient.req('/api/join', { roomCode, nickname, pin })
    if (joined.status !== 200) throw new Error(`student join ${joined.status}`)
    const me = await studentClient.req('/api/me')
    studentId = String((me.json?.student as { id?: string } | undefined)?.id ?? '')
    await studentClient.req('/api/profile', { shopName: 'ร้านขนม FX6', businessTypeId: 'bakery', domainName: 'fx6bakery', isRegisteredCompany: false, audience: 'thai' })

    const check = async (id: string, body: Record<string, unknown>) => {
      const res = await studentClient.req(`/api/mission/${id}/check`, body)
      if (res.status !== 200 || res.json?.passed !== true) throw new Error(`${id} check ${res.status}`)
    }
    await check('m1', { choiceIndex: 0, channel: 'game', confidence: 2 })
    await check('m2', { placements: { 'm2-g-slot1': 'm2-g-p1', 'm2-g-slot2': 'm2-g-p2', 'm2-g-slot3': 'm2-g-p3' }, channel: 'game', confidence: 2 })
    await check('m3', { choiceIndex: 1, channel: 'game', confidence: 2 })
    await check('m4', { choiceIndex: 0, channel: 'game', confidence: 2 })

    const aiRows: Record<string, unknown>[] = []
    for (const [label, body] of [
      ['dome-on-topic', { message: 'โดเมนคืออะไรสำหรับร้านขนม' }],
      ['dome-off-topic', { message: 'ช่วยทำนายผลบอลคืนนี้' }],
      ['dome-m5-dns', { message: 'โดเมนกับ DNS ต่างกันยังไง อธิบายแบบร้านขนม' }],
    ] as const) {
      const started = Date.now(); const res = await studentClient.req('/api/dome', body); aiRows.push({ path: label, latencyMs: Date.now() - started, ...compact(res.json ?? {}) })
    }
    const startedHint = Date.now(); const hint = await studentClient.req('/api/hint', { missionId: 'm1' }); aiRows.push({ path: 'hint-m1', latencyMs: Date.now() - startedHint, ...compact(hint.json ?? {}) })
    const startedLearn = Date.now(); const learn = await studentClient.req('/api/mission/m1/learn', { action: 'answer', mode: 'read', answers: { 'm1-rq1': 'ชื่อเว็บใช้เข้าเว็บไซต์และช่วยให้จำง่ายกว่าตัวเลข IP', 'm1-rq2': 'เมื่อระบบเจอที่อยู่แล้ว เบราว์เซอร์เปิดเว็บร้านขนม' } }); aiRows.push({ path: 'learnCheck-m1', latencyMs: Date.now() - startedLearn, status: learn.status, provider: ((learn.json?.perQuestion as Array<Record<string, unknown>> | undefined) ?? []).map((item) => item.source ?? null), source: 'ai-if-perQuestion-provider-present' })
    const ceo = await studentClient.req('/api/ceo', {
      modeId: 'bm-mode-write', focusRubricId: 'bm-r3',
      fields: { 'bm-f1': 'fx6bakery', 'bm-f2': '.com', 'bm-f3': 'ชื่อสั้น จำง่าย และลูกค้าพิมพ์ตามป้ายร้านได้ทันที', 'bm-f4': 'ร้านยังไม่ได้จดทะเบียนจึงเลือก .com ที่จดได้ทั่วไป', 'bm-f5': 'ลูกค้าหลักเป็นคนไทยที่อยากสั่งขนมออนไลน์' },
      selfAssessment: { 'bm-self1': 'ชื่อจำง่าย', 'bm-self2': 'อธิบายเหตุผลได้', 'bm-self3': 'จะฝึกเขียนให้ละเอียดขึ้น' },
    })
    const submissionId = String(ceo.json?.submissionId ?? '')
    console.log(JSON.stringify({ roomCode, nickname, studentId, aiRows, ceoSubmit: { status: ceo.status, source: ceo.json?.source, provider: ceo.json?.provider, gradeJobQueued: ceo.json?.gradeJobQueued, submissionId } }))
    const drained = await teacherClient.req('/api/jobs/drain', { max: 1 })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const submissions = await repo.listSubmissions(studentId)
    const row = submissions.find((item) => item.id === submissionId)
    const scores = row?.ai_scores as Record<string, unknown> | null
    const ai = scores?.aiProposed as { dimensions?: Array<{ id: string; score: number }>; emphasisDimensionId?: string | null } | null
    const confirmed = await teacherClient.req('/api/teacher/confirm-score', {
      submissionId,
      dimensions: Object.fromEntries((ai?.dimensions ?? []).map((dimension) => [dimension.id, dimension.score])),
      emphasisDimensionId: ai?.emphasisDimensionId ?? undefined,
      note: 'ครูยืนยันจากการตรวจรอบ QA6',
    })
    console.log(JSON.stringify({ drain: drained.json, ceoDb: { submissionId, gradingStatus: scores?.gradingStatus ?? null, aiProposedSource: (scores?.aiProposed as Record<string, unknown> | null)?.source ?? null, aiProposedProvider: (scores?.aiProposed as Record<string, unknown> | null)?.provider ?? null }, teacherConfirm: { status: confirmed.status, ok: confirmed.json?.ok ?? false, changedFrom: confirmed.json?.submission && (confirmed.json.submission as Record<string, unknown>).changedFrom }, teacherBoardStatus: (await teacherClient.req(`/api/teacher/board?classroomId=${classroom.id}`)).status }))
  } finally {
    if (studentId) {
      const removed = await repo.removeStudent(teacher.data.id, classroom.id, studentId)
      if (!removed) throw new Error('student cleanup failed')
    }
    await repo.deleteClassroom(teacher.data.id, classroom.id)
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'qa-fix6 failed'); process.exitCode = 1 })

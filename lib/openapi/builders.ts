/**
 * ตัวช่วยเขียน spec ให้สั้นและไม่หลุดกติกาของโปรเจกต์
 *
 * กติกาที่ตัวช่วยชุดนี้บังคับให้เอง
 *  1. **ทุก operation บอกบทบาทเป็นภาษาไทยไว้บรรทัดแรกของคำอธิบาย** — `op()` เติมให้จาก `security`
 *     ไม่ให้เขียนมือ เพราะเขียนมือแล้วรูปกุญแจใน Swagger UI กับข้อความจะเพี้ยนกันได้
 *  2. **รูป error เดียวกันทุกเส้น** `{ error, message }` — `failures()` สร้างจากรหัสจริงในโค้ด
 *  3. **ค่าตัวอย่างเป็นค่าปลอมทั้งหมด** อยู่รวมกันที่ `FAKE` ที่เดียว ไม่มีคีย์ ไม่มี token ไม่มีรหัสผ่าน
 */
import type {
  JsonSchema,
  MediaTypeObject,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SecurityRequirement,
} from './types'

// ───────────────────────────── ชื่อ security scheme (ต้องตรงกับ components.securitySchemes)

export const STUDENT_SCHEME = 'studentCookie'
export const TEACHER_SCHEME = 'teacherCookie'
export const WORKER_SCHEME = 'workerSecret'

/** ยิงได้เลย ไม่ต้องมีคุกกี้ — มีแค่ 3 เส้น (เข้าห้อง · กลับเข้าห้อง · ครูล็อกอิน) */
export const ANYONE: readonly SecurityRequirement[] = []
export const STUDENT_ONLY: readonly SecurityRequirement[] = [{ [STUDENT_SCHEME]: [] }]
export const TEACHER_ONLY: readonly SecurityRequirement[] = [{ [TEACHER_SCHEME]: [] }]
/** เส้นสองบทบาท: ตอบคนละอย่างตามคุกกี้ที่ส่งมา (`GET /api/plan-request` · `GET /api/self-assess`) */
export const STUDENT_OR_TEACHER: readonly SecurityRequirement[] = [
  { [STUDENT_SCHEME]: [] },
  { [TEACHER_SCHEME]: [] },
]
export const TEACHER_OR_WORKER: readonly SecurityRequirement[] = [
  { [TEACHER_SCHEME]: [] },
  { [WORKER_SCHEME]: [] },
]

const ROLE_LINE: Record<string, string> = {
  '': '**ใครเรียกได้:** ยิงได้เลย ไม่ต้องมีคุกกี้',
  [STUDENT_SCHEME]: '**ใครเรียกได้:** นักเรียน — ต้องมีคุกกี้ `dbq_student`',
  [TEACHER_SCHEME]: '**ใครเรียกได้:** ครู — ต้องมีคุกกี้ `dbq_teacher`',
  [`${STUDENT_SCHEME},${TEACHER_SCHEME}`]:
    '**ใครเรียกได้:** นักเรียน **หรือ** ครู — เส้นสองบทบาท คืนข้อมูลคนละชุดตามคุกกี้ที่ส่งมา',
  [`${TEACHER_SCHEME},${WORKER_SCHEME}`]:
    '**ใครเรียกได้:** ครู (คุกกี้ `dbq_teacher`) **หรือ** worker ที่ส่ง header `x-worker-secret` ตรงกับ `GRADE_WORKER_SECRET`',
}

function roleLine(security: readonly SecurityRequirement[]): string {
  const key = security.flatMap((entry) => Object.keys(entry)).join(',')
  const line = ROLE_LINE[key]
  if (!line) throw new Error(`[openapi] ไม่มีคำอธิบายบทบาทของชุด security "${key}"`)
  return line
}

// ───────────────────────────── ค่าตัวอย่าง

/**
 * **uuid ในเอกสารเป็นค่าปลอมเสมอ** — ค่าจริงเกิดใหม่ทุกครั้งที่ seed หรือทุกครั้งที่กดส่งงาน
 * จึงเขียนค่าตายตัวที่ยิงผ่านไม่ได้ ทุกตัวเป็น uuid v4 ที่ถูกรูป (zod `.uuid()` ผ่าน)
 * แต่ไม่มีแถวไหนในฐานข้อมูลใช้ค่านี้
 *
 * ⚠️ operation ที่ต้องใช้ค่าพวกนี้ **ต้องเขียนในคำอธิบายว่าเอาค่าจริงมาจากปุ่มไหน**
 *    (มีเทสต์ล็อกไว้ว่า uuid ทุกตัวในเอกสารต้องขึ้นต้นด้วยชุดนี้)
 */
export const FAKE = {
  classroomId: '00000000-0000-4000-8000-00000000c1a5',
  studentId: '00000000-0000-4000-8000-000000005700',
  submissionId: '00000000-0000-4000-8000-0000000050b1',
  sessionId: '00000000-0000-4000-8000-0000000053e5',
  requestId: '00000000-0000-4000-8000-000000009e00',
  offerId: '00000000-0000-4000-8000-00000000f0e1',
  flagId: '00000000-0000-4000-8000-00000000f1a9',
  voiceId: '00000000-0000-4000-8000-000000000ce1',
  feedbackId: '00000000-0000-4000-8000-00000000fdb1',
  timestamp: '2569-01-01T08:30:00.000Z',
} as const

/**
 * ค่าจาก **ชุดข้อมูลสาธิตในเครื่อง** (`lib/db/demo-seed.ts` + `content/`)
 *
 * เจตนา: เปิด `/api-docs` แล้วกด **Try it out → Execute ได้เลยโดยไม่ต้องพิมพ์อะไรเพิ่ม**
 * ค่าที่ใส่ไว้จึงต้องเป็นของที่มีอยู่จริงหลังรัน `npx tsx scripts/seed-demo.ts`
 *
 * 🔒 **ไม่ใช่ของลับ** รหัสผ่านครูสาธิตเป็นค่าคงที่ของเครื่องพัฒนา อยู่ใน `lib/db/demo-seed.ts`
 *    กับ `scripts/check-authz.ts` และ `docs/pre-flight.md` อยู่แล้ว · หน้า `/api-docs` เปิดได้เฉพาะ
 *    `next dev` เท่านั้น (production ตอบ `404`) จึงไม่มีทางที่ค่านี้ไปโผล่บนเซิร์ฟเวอร์จริง
 *    ⚠️ **ห้ามเอา `SESSION_SECRET` · `GRADE_WORKER_SECRET` · คีย์ AI · `service_role` มาใส่ที่นี่เด็ดขาด**
 *    ของพวกนั้นเป็นความลับจริงและต้องคงเป็นคำอธิบายเท่านั้น
 */
export const DEMO = {
  roomCode: 'QUEST9',
  /** PIN ของหุ่นทุกตัวในห้องสาธิต (`DEMO_PIN`) */
  pin: '1234',
  /** หุ่นที่มีอยู่แล้วในห้อง — ใช้กับ `/api/join/resume` ได้ซ้ำไม่จำกัด */
  botNickname: 'มิ้นท์',
  /** เพื่อนอีกคนในห้องเดียวกัน ใช้เป็นผู้รับคำชม */
  friendNickname: 'อาร์ม',
  /** ชื่อของ "คนใหม่" สำหรับ `/api/join` — ใช้ได้ครั้งเดียวต่อชื่อ (ชื่อซ้ำได้ `409`) */
  newNickname: 'ผู้มาเยือน1',
  teacherEmail: 'teacher.demo@digital-biz.local',
  teacherPassword: 'demo-teacher-1234',
  shopName: 'ร้านขนมผู้มาเยือน',
  domainName: 'visitorsweets',
  /** ต้องมีอยู่จริงใน `content/business-types.json` */
  businessTypeId: 'bakery',
  missionId: 'm1',
  checkId: 'm1-check',
  /** ชุดเช็กความเข้าใจชุด A (`content/check-questions.json`) */
  checkSetId: 'set-a',
  tldId: 'com',
  goalId: 'goal-good',
  nextGoalId: 'goal-next-1',
} as const

// ───────────────────────────── ตัวย่อของ JSON Schema

export const str = (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({
  type: 'string',
  description,
  ...extra,
})

export const int = (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({
  type: 'integer',
  description,
  ...extra,
})

export const num = (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({
  type: 'number',
  description,
  ...extra,
})

export const bool = (description: string): JsonSchema => ({ type: 'boolean', description })

export const uuid = (description: string, example: string = FAKE.studentId): JsonSchema => ({
  type: 'string',
  format: 'uuid',
  description,
  examples: [example],
})

/** ช่องที่เป็น `null` ได้ — OpenAPI 3.1 ใช้ `type: [..., 'null']` ไม่ใช่ `nullable: true` ของ 3.0 */
export const nullable = (schema: JsonSchema): JsonSchema => ({
  ...schema,
  type: Array.isArray(schema.type)
    ? [...schema.type, 'null']
    : [String(schema.type ?? 'string'), 'null'],
})

export const obj = (
  properties: Record<string, JsonSchema>,
  extra: Partial<JsonSchema> = {},
): JsonSchema => ({ type: 'object', properties, ...extra })

export const arr = (items: JsonSchema, description: string): JsonSchema => ({
  type: 'array',
  description,
  items,
})

/** object ที่คีย์เป็นรหัสที่ตั้งเอง เช่น `{ "pre-1": 0 }` — zod `z.record()` */
export const map = (values: JsonSchema, description: string): JsonSchema => ({
  type: 'object',
  description,
  additionalProperties: values,
})

/** ก้อนที่รายละเอียดข้างในยาวเกินกว่าจะไล่ทุกช่อง — บอกให้ไปดูของจริงจากปุ่มลองยิง */
export const opaque = (description: string): JsonSchema => ({
  type: 'object',
  description: `${description}\n\n(ช่องข้างในเยอะ ดูของจริงได้จากปุ่ม Try it out)`,
  additionalProperties: true,
})

// ───────────────────────────── query / body / response

export function query(
  name: string,
  description: string,
  opts: { required?: boolean; schema?: JsonSchema; example?: unknown } = {},
): ParameterObject {
  return {
    name,
    in: 'query',
    required: opts.required ?? false,
    description,
    schema: opts.schema ?? { type: 'string' },
    ...(opts.example === undefined ? {} : { example: opts.example }),
  }
}

export function pathParam(name: string, description: string, example: string): ParameterObject {
  return { name, in: 'path', required: true, description, schema: { type: 'string' }, example }
}

export function jsonBody(
  schema: JsonSchema,
  example: Record<string, unknown>,
  opts: { required?: boolean; description?: string } = {},
): RequestBodyObject {
  return {
    required: opts.required ?? true,
    ...(opts.description ? { description: opts.description } : {}),
    content: { 'application/json': { schema, example } },
  }
}

/** route ที่ไม่อ่าน body เลย — ยังต้องยิง POST ได้โดยไม่ต้องส่งอะไร */
export const NO_BODY: RequestBodyObject = {
  required: false,
  description: 'route นี้ไม่อ่าน body เลย ส่งอะไรมาก็ไม่มีผล',
  content: { 'application/json': { schema: obj({}, { additionalProperties: true }), example: {} } },
}

export function ok(
  description: string,
  schema: JsonSchema,
  example?: unknown,
): Record<string, ResponseObject> {
  const media: MediaTypeObject = { schema, ...(example === undefined ? {} : { example }) }
  return { '200': { description, content: { 'application/json': media } } }
}

export function created(
  description: string,
  schema: JsonSchema,
  example?: unknown,
): Record<string, ResponseObject> {
  const media: MediaTypeObject = { schema, ...(example === undefined ? {} : { example }) }
  return { '201': { description, content: { 'application/json': media } } }
}

export function fileResponse(
  status: number,
  description: string,
  mime: string,
  headers: Record<string, string>,
): Record<string, ResponseObject> {
  return {
    [String(status)]: {
      description,
      headers: Object.fromEntries(
        Object.entries(headers).map(([name, note]) => [name, { description: note, schema: { type: 'string' } }]),
      ),
      content: { [mime]: { schema: { type: 'string', format: 'binary' } } },
    },
  }
}

// ───────────────────────────── error

/**
 * ความหมายของรหัส error ทุกตัวที่มีจริงในโค้ด (`errorResponse('<รหัส>', ...)`)
 *
 * ⚠️ เติมรหัสใหม่ที่นี่เมื่อ route เพิ่มรหัสใหม่ — `failures()` โยน error ถ้าเจอรหัสที่ไม่รู้จัก
 *    จึงลืมไม่ได้ และไม่มีทางมีรหัสที่เอกสารอธิบายไม่ได้
 */
const CODE_MEANING: Record<string, string> = {
  unauthorized: 'ไม่มีคุกกี้ หรือคุกกี้หมดอายุ/ผิดบทบาท',
  'bad-request': 'รูปแบบ body หรือ query ไม่ผ่าน zod',
  'bad-pin': 'รหัส 4 หลักไม่ใช่ตัวเลข 4 ตัวพอดี',
  'room-not-found': 'ไม่พบห้องนี้ หรือครูปิดห้องไปแล้ว',
  'nickname-taken': 'ชื่อเล่นนี้มีคนใช้ในห้องนี้แล้ว (ไม่เติมเลขท้ายให้)',
  'room-full': 'ห้องเต็มตามเพดาน `CLASSROOM_MAX_STUDENTS`',
  'room-too-busy': 'ห้องเก่าที่ล้นเพดานอยู่ก่อนแล้ว รับคนใหม่ได้ 45 คน/10 นาที',
  'too-many-attempts': 'ยิงรัวเกิน 5 ครั้ง/10 นาที ต่อคู่ (รหัสห้อง + ชื่อเล่น)',
  'invalid-credentials': 'ชื่อเล่นหรือรหัสไม่ถูกต้อง (ข้อความเหมือนกันทั้งสองกรณีโดยเจตนา)',
  'content-flagged': 'ข้อความไม่ผ่านด่านกรองคำ (E-11) — คืนข้อความเดิมกลับไปด้วย',
  'not-open': 'ครูยังไม่ได้กดเปิดของชิ้นนี้',
  'already-done': 'ทำไปแล้ว ทำซ้ำไม่ได้',
  incomplete: 'ยังกรอกไม่ครบ — มี `missing` บอกช่องที่ขาด',
  'too-short': 'คำตอบสั้นกว่าที่ไฟล์เนื้อหากำหนด',
  'profile-locked': 'โปรไฟล์ร้านถูกล็อกเพราะเริ่มเล่นแล้ว',
  'domain-taken': 'ชื่อเว็บนี้มีเพื่อนในห้องจดไปก่อน (ใครจดก่อนได้ก่อน)',
  'mission-not-found': 'ไม่มีภารกิจรหัสนี้',
  'tld-not-found': 'ไม่มีนามสกุลโดเมนรหัสนี้',
  'reason-required': 'ต้องเขียนเหตุผลอย่างน้อย 10 ตัวอักษร',
  'no-profile': 'ยังไม่ได้ตั้งค่าร้าน',
  'skip-not-allowed': 'ยังไม่เข้าเงื่อนไขข้ามภารกิจ',
  'answers-file-missing': 'อ่านไฟล์เฉลยไม่ได้ (ปัญหาฝั่งเซิร์ฟเวอร์ ไม่ใช่ความผิดของผู้เรียน)',
  'answers-file-invalid': 'ไฟล์เฉลยไม่ตรง schema',
  'answer-not-found': 'ไม่มีเฉลยของข้อนี้ในไฟล์เฉลย',
  'game-key-unavailable': 'ภารกิจนี้ไม่มีเฉลยของเกม',
  'assemble-key-unavailable': 'ข้อตรวจแบบประกอบชิ้นส่วนของภารกิจนี้ยังไม่มีเฉลย — ข้อความบอกให้ไปตอบแบบเลือกตัวเลือกแทน',
  'goal-not-found': 'ไม่มีเป้าหมายรหัสนี้',
  'bad-mode': 'ไม่มีรูปแบบการส่งงานนี้',
  'bad-rubric': 'ไม่มีด้านนี้ในรูบริก',
  'already-submitted': 'ส่งใบเสนอไปแล้ว และครูยังไม่ได้สั่งแก้',
  'revision-limit': 'ครบโควตาแก้งานแล้ว (ครูติ๊ก `allowExtraRound` ให้ต่อได้)',
  'no-file': 'ไม่พบไฟล์เสียงในคำขอ',
  'too-large': 'ไฟล์เสียงเกิน 2 MiB',
  'bad-type': 'ชนิดไฟล์เสียงไม่อยู่ในรายการที่รับ',
  'empty-feedback': 'ไม่ได้เขียนทั้งช่องคำชมและช่องข้อเสนอแนะ',
  'self-feedback': 'ให้ความเห็นตัวเองไม่ได้',
  'friend-not-found': 'ไม่มีเพื่อนชื่อเล่นนี้ในห้องเดียวกัน',
  'save-failed': 'บันทึกไม่สำเร็จ ลองใหม่ได้',
  'not-found': 'ไม่พบของชิ้นนี้ **ในห้องของคุณ** (ตอบ 404 ไม่ใช่ 403 เพื่อไม่ให้ไล่เดา id ของคนอื่นได้)',
  'not-yet': 'ยังไม่เข้าเกณฑ์รับใบประกาศ — คืนว่าเหลือด้านไหนและต้องเพิ่มอะไร',
  'student-not-found': 'ไม่พบที่นั่งของผู้เรียนคนนี้',
  'buddy-request-failed': 'เปิดใบคำขอคู่หูไม่สำเร็จ กดใหม่ได้',
  'offer-not-open': 'คำขอใบนี้ถูกตอบ/หมดเวลาไปแล้ว',
  'request-not-open': 'ใบคำขอนี้ปิดไปแล้ว',
  'bad-value': 'ค่าที่ขอ (หรือค่าที่ครูให้) ไม่อยู่ในกติกาของ `core/plan-request.ts`',
  'reason-blocked': 'เหตุผลที่พิมพ์ไม่ผ่านด่านกรองคำ',
  'duplicate-request': 'มีคำขอที่ครูยังไม่ตอบค้างอยู่แล้ว 1 ใบ',
  'granted-value-required': 'ตอบว่า `changed` ต้องบอกด้วยว่าให้อะไรแทน',
  'bad-scores': 'คะแนนรายด้านไม่ครบ 4 ด้าน หรืออยู่นอกช่วง 1-3',
  'bad-goal': 'ไม่มีเป้าหมายรหัสนี้ใน `content/reflection.json`',
  'goal-blocked': 'เป้าที่พิมพ์เองไม่ผ่านด่านกรองคำ',
  'no-submission': 'ยังไม่มีใบงานให้ประเมินตัวเอง',
  'too-fast': 'ส่งประกาศได้ 1 ข้อความทุก 30 วินาที',
  'too-late': 'ย้อนการย้ายช่วงได้ภายใน 30 วินาทีเท่านั้น',
  'confirm-mismatch': '`roomCode` ที่ส่งมายืนยันไม่ตรงกับรหัสห้องจริง — **ไม่ลบอะไรเลย**',
  'not-demo': 'ห้องนี้ไม่ได้ติดป้าย `is_demo` ฐานข้อมูลปฏิเสธการล้าง',
  'queue-unavailable': 'อ่านสถานะคิวไม่ได้',
}

const STATUS_LABEL: Record<number, string> = {
  400: 'คำขอไม่ถูกรูปแบบ',
  401: 'ไม่ได้รับอนุญาต',
  403: 'ยังทำสิ่งนี้ไม่ได้ตอนนี้',
  404: 'ไม่พบ',
  409: 'ชนกับสถานะที่มีอยู่',
  413: 'ไฟล์ใหญ่เกิน',
  415: 'ชนิดไฟล์ไม่รับ',
  422: 'ข้อมูลไม่ผ่านกติกาเนื้อหา',
  429: 'ยิงถี่เกินไป',
  503: 'บริการเบื้องหลังใช้ไม่ได้ชั่วคราว',
}

export const API_ERROR_SCHEMA: JsonSchema = {
  type: 'object',
  description: 'รูป error เดียวกันทุก route (`app/api/_lib/session-cookie.ts` → `errorResponse()`)',
  properties: {
    error: str('รหัสที่เครื่องอ่าน — หน้าจอใช้ตัดสินใจ'),
    message: str('ข้อความภาษาไทยที่แสดงให้ผู้ใช้อ่านได้ตรง ๆ'),
  },
  required: ['error', 'message'],
  additionalProperties: true,
}

/**
 * สร้าง response ของกรณีพลาด จาก **รหัสจริงที่ route คืน**
 *
 * `failures([400, ['bad-request', 'bad-pin']], [404, ['room-not-found']])`
 */
export function failures(
  ...entries: readonly (readonly [number, readonly string[], string?])[]
): Record<string, ResponseObject> {
  const out: Record<string, ResponseObject> = {}
  for (const [status, codes, note] of entries) {
    const lines = codes.map((code) => {
      const meaning = CODE_MEANING[code]
      if (!meaning) throw new Error(`[openapi] ไม่รู้จักรหัส error "${code}" — เติมใน CODE_MEANING ก่อน`)
      return `- \`${code}\` — ${meaning}`
    })
    const first = codes[0] ?? 'bad-request'
    out[String(status)] = {
      description: [
        `**${status} ${STATUS_LABEL[status] ?? ''}**`.trim(),
        ...(note ? ['', note] : []),
        '',
        ...lines,
      ].join('\n'),
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiError' },
          example: { error: first, message: CODE_MEANING[first] ?? '' },
        },
      },
    }
  }
  return out
}

/** 401 ที่ทุกเส้นที่ต้องมีคุกกี้ใช้เหมือนกันหมด */
export const UNAUTHORIZED = failures([401, ['unauthorized']])

// ───────────────────────────── operation

export function op(input: {
  id: string
  summary: string
  tags: readonly string[]
  security: readonly SecurityRequirement[]
  description: string
  parameters?: readonly ParameterObject[]
  requestBody?: RequestBodyObject
  responses: Record<string, ResponseObject>
}): OperationObject {
  return {
    operationId: input.id,
    summary: input.summary,
    tags: input.tags,
    security: input.security,
    description: `${roleLine(input.security)}\n\n${input.description.trim()}`,
    ...(input.parameters ? { parameters: input.parameters } : {}),
    ...(input.requestBody ? { requestBody: input.requestBody } : {}),
    responses: input.responses,
  }
}

/**
 * เส้นของครู และเส้นของระบบ (worker คิวตรวจงาน)
 *
 * กติกาที่ทุกเส้นในไฟล์นี้ยึด (`docs/api.md` หัวข้อ 4.1)
 *  - \`teacherId\` มาจากคุกกี้เท่านั้น **ไม่เคยรับจาก body หรือ query**
 *  - \`classroomId\`/\`submissionId\`/\`studentId\` รับจากภายนอกได้ แต่ทุกคำสั่งใส่
 *    \`teacher_id = <คนที่ถือคุกกี้>\` ลงไปใน query เดียวกัน ไม่ใช่ "ค้นก่อนแล้วเช็กทีหลัง"
 *  - ไม่ใช่เจ้าของได้ **\`404\` ไม่ใช่ \`403\`** โดยเจตนา เพราะ \`403\` เท่ากับบอกว่า
 *    "ห้อง/งาน id นี้มีอยู่จริงแต่ไม่ใช่ของคุณ" ทำให้ไล่เดา id ของคนอื่นได้
 */
import {
  ANYONE,
  DEMO,
  FAKE,
  TEACHER_ONLY,
  TEACHER_OR_WORKER,
  UNAUTHORIZED,
  arr,
  bool,
  created,
  failures,
  fileResponse,
  int,
  jsonBody,
  map,
  nullable,
  num,
  obj,
  ok,
  op,
  opaque,
  query,
  str,
  uuid,
} from './builders'
import type { ParameterObject, PathItemObject } from './types'

const TEACHER = 'ครู'
const SYSTEM = 'ระบบและคิวตรวจงาน'

/**
 * `classroomId` เป็น uuid ที่เกิดใหม่ทุกครั้งที่ seed จึงเขียนค่าตายตัวที่ยิงผ่านไม่ได้
 * ทุกที่ที่ใช้ตัวนี้ต้องบอกให้ชัดว่าเอาค่าจริงมาจากไหน
 */
const CLASSROOM_ID_SOURCE =
  'รหัสห้องของตัวเอง (uuid) — **บังคับ** · ค่าตัวอย่างเป็นของปลอม **คัดลอกค่าจริงจากช่อง `id` ในผลของ `GET /api/teacher/classroom`** (ห้องสาธิตคือใบที่ `room_code` = `QUEST9`)'

const classroomQuery: ParameterObject = query('classroomId', CLASSROOM_ID_SOURCE, {
  required: true,
  schema: { type: 'string', format: 'uuid' },
  example: FAKE.classroomId,
})

export const teacherPaths: Record<string, PathItemObject> = {
  '/api/teacher/mission-settings': {
    get: op({
      id: 'teacherMissionSettingsGet',
      summary: 'อ่านค่าตั้งค่าด่านของห้อง',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      parameters: [classroomQuery],
      description: 'คืนค่าตั้งค่าของ m1, m2, m3, m4 และ CEO โดยผสานค่าที่เก็บไว้กับค่าเริ่มต้นและตรวจสิทธิ์เจ้าของห้อง',
      responses: {
        ...ok('ค่าตั้งค่าด่านทั้งห้า', obj({ ok: bool('สำเร็จ'), classroomId: uuid('รหัสห้อง'), missions: map(opaque('รายละเอียดด่าน'), 'ค่าตั้งค่ารายด่าน') })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    put: op({
      id: 'teacherMissionSettingsPut',
      summary: 'บันทึกค่าตั้งค่าด่านของห้อง',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      parameters: [classroomQuery],
      description: 'ตรวจ schema และบีบค่าตัวเลขให้อยู่ในช่วงที่เนื้อหารองรับก่อนบันทึก พร้อมเขียน audit event',
      requestBody: jsonBody(obj({ missionId: str('m1 | m2 | m3 | m4 | ceo'), settings: opaque('ค่าตั้งค่าของด่าน') }, { required: ['missionId', 'settings'] }), { missionId: 'm3', settings: { realCustomers: 3 } }),
      responses: {
        ...ok('บันทึกแล้ว', obj({ ok: bool('สำเร็จ'), setting: opaque('แถวค่าตั้งค่าที่บันทึก') })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']], [500, ['save-failed']]),
      },
    }),
  },
  '/api/teacher/account': {
    get: op({
      id: 'teacherAccountGet',
      summary: 'อ่านบัญชีครูของตัวเอง',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: 'ไม่รับพารามิเตอร์และคืนอีเมลกับชื่อที่แสดงของครูจากคุกกี้เท่านั้น',
      responses: {
        ...ok('ข้อมูลบัญชีครู', obj({ teacher: obj({ email: str('อีเมล'), displayName: str('ชื่อที่แสดง') }) })),
        ...failures([401, ['unauthorized', 'not-found']]),
      },
    }),
    patch: op({
      id: 'teacherAccountPatch',
      summary: 'เปลี่ยนชื่อหรือรหัสผ่านครู',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: 'ชื่อที่แสดงเปลี่ยนได้โดยตรง; การเปลี่ยนรหัสผ่านต้องส่งรหัสผ่านปัจจุบันและรหัสใหม่อย่างน้อย 10 ตัวอักษร',
      requestBody: jsonBody({
        oneOf: [
          obj({ displayName: str('ชื่อที่แสดงใหม่', { minLength: 1, maxLength: 80 }) }, { required: ['displayName'] }),
          obj({
            currentPassword: str('รหัสผ่านปัจจุบัน'),
            newPassword: str('รหัสผ่านใหม่อย่างน้อย 10 ตัวอักษร', { minLength: 10, maxLength: 128 }),
            confirmPassword: str('ยืนยันรหัสผ่านใหม่'),
          }, { required: ['currentPassword', 'newPassword', 'confirmPassword'] }),
        ],
      }, { displayName: 'ครูผู้สอน' }),
      responses: {
        ...ok('บันทึกบัญชีแล้ว', obj({ ok: bool('สำเร็จ'), teacher: obj({ email: str('อีเมล'), displayName: str('ชื่อที่แสดง') }) })),
        ...failures([400, ['bad-request', 'account-update-failed']], [401, ['unauthorized', 'invalid-password']], [404, ['not-found']]),
      },
    }),
  },
  '/api/teacher/login': {
    post: op({
      id: 'teacherLogin',
      summary: 'ครูเข้าสู่ระบบ (ออกคุกกี้ครู)',
      tags: [TEACHER],
      security: ANYONE,
      description: `
**ตรวจรหัสผ่านด้วย anon key ไม่ใช่ \`service_role\`** แล้วแลกเป็นคุกกี้ของแอปเอง
access token ของ Supabase **ไม่ถูกส่งกลับไปเบราว์เซอร์เลย**

คุกกี้ \`dbq_teacher\` เป็น JWT HS256 ลงนามด้วย \`SESSION_SECRET\` อายุ 12 ชั่วโมง · \`httpOnly\` \`SameSite=Lax\`
(\`Secure\` เปิดเฉพาะ production เพราะ dev รันบน http)

**กด Execute ได้เลย** ตัวอย่างเป็นบัญชีครูสาธิตในเครื่อง (ต้องรัน \`npx tsx scripts/seed-demo.ts\` ก่อน)
ล็อกอินผ่านแล้วเส้น \`/api/teacher/*\` ทั้งหมดในหน้านี้จะยิงได้ทันที เบราว์เซอร์ถือคุกกี้ให้เอง

🔒 **บัญชีนี้ไม่ใช่ความลับ** เป็นค่าคงที่ของเครื่องพัฒนา (\`lib/db/demo-seed.ts\` · \`scripts/check-authz.ts\` · \`docs/pre-flight.md\`)
และหน้านี้เปิดได้เฉพาะ \`next dev\` เท่านั้น — production ตอบ \`404\` ทุก URL ใต้ \`/api-docs\`
`,
      requestBody: jsonBody(
        obj(
          {
            email: str('อีเมลครู', { examples: [DEMO.teacherEmail] }),
            password: str('รหัสผ่านของครู (ตัวอย่างคือของบัญชีสาธิตในเครื่อง)'),
          },
          { required: ['email', 'password'] },
        ),
        { email: DEMO.teacherEmail, password: DEMO.teacherPassword },
      ),
      responses: {
        ...ok(
          'ล็อกอินได้ — ตั้งคุกกี้ `dbq_teacher` มาใน `set-cookie`',
          obj({
            ok: bool('สำเร็จ'),
            teacher: obj({ email: str('อีเมล'), name: nullable(str('ชื่อที่แสดง')) }),
          }),
          { ok: true, teacher: { email: DEMO.teacherEmail, name: 'ครูตัวอย่าง' } },
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['invalid-credentials'], 'ข้อความไม่บอกว่าอีเมลนี้มีในระบบไหม'],
        ),
      },
    }),
  },

  '/api/teacher/signup': {
    post: op({
      id: 'teacherSignup',
      summary: 'สมัครบัญชีครูด้วยรหัสเชิญ',
      tags: [TEACHER],
      security: ANYONE,
      description: `สร้างบัญชีครูใน Supabase Auth พร้อมห้องเรียนเริ่มต้น 1 ห้อง
รหัสเชิญตรวจเทียบฝั่งเซิร์ฟเวอร์กับ \`TEACHER_INVITE_CODE\` แบบเวลาคงที่
เมื่อสำเร็จจะตั้งคุกกี้ \`dbq_teacher\` แบบ \`httpOnly\` และ redirect ไป \`/teacher\` · ต้องเปิดรับสมัครด้วย env นี้ก่อน`,
      requestBody: jsonBody(
        obj(
          {
            displayName: str('ชื่อที่แสดง'),
            email: str('อีเมลที่ใช้เข้าสู่ระบบ'),
            password: str('รหัสผ่านอย่างน้อย 10 ตัวอักษร'),
            confirmPassword: str('ยืนยันรหัสผ่าน'),
            inviteCode: str('รหัสเชิญครู'),
          },
          { required: ['displayName', 'email', 'password', 'confirmPassword', 'inviteCode'] },
        ),
        { displayName: 'ครูผู้สอน', email: 'teacher@example.ac.th', password: 'ตัวอย่างรหัสผ่าน 10 ตัว', confirmPassword: 'ตัวอย่างรหัสผ่าน 10 ตัว', inviteCode: 'รหัสเชิญจากผู้ดูแล' },
      ),
      responses: {
        ...ok('สมัครสำเร็จ — ตั้งคุกกี้แล้วและ redirect ไป `/teacher`', obj({ ok: bool('สำเร็จ') }), { ok: true }),
        ...failures(
          [400, ['bad-request']],
          [403, ['signup-disabled', 'invalid-invite']],
          [409, ['signup-failed']],
          [429, ['rate-limited']],
        ),
      },
    }),
  },

  '/api/teacher/logout': {
    post: op({
      id: 'teacherLogout',
      summary: 'ครูออกจากระบบ (ลบคุกกี้ครู)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
ลบคุกกี้ \`dbq_teacher\` ทิ้ง — ใช้กับปุ่ม "ออกจากระบบ" บนแถบบนของแดชบอร์ดครู

**ทำไมต้องมี:** ก่อนหน้านี้ทั้งระบบ **ไม่มีทางออกจากระบบให้ครูกดเลย** ครูที่ยืมเครื่องคนอื่น
หรือใช้เครื่องกลางของโรงเรียนจึงค้าง session ไว้จนหมดอายุเอง

⚠️ **ไม่มีคุกกี้มาด้วยได้ \`401\` ไม่ใช่ \`200\`** — เหมือนเส้นอื่นใต้ \`/api/teacher/*\` ทั้งหมด ไม่มีข้อยกเว้นให้จำ
⚠️ ลบคุกกี้ด้วยออปชันชุดเดียวกับตอนตั้ง (\`path\`/\`secure\`/\`sameSite\`) ไม่งั้นเบราว์เซอร์ถือว่าคนละใบ แล้วคุกกี้เดิมจะยังอยู่
· ไม่รับพารามิเตอร์และไม่อ่าน body
`,
      responses: {
        ...ok('ออกจากระบบแล้ว — คุกกี้ถูกลบใน `set-cookie`', obj({ ok: bool('สำเร็จ') }), {
          ok: true,
        }),
        ...failures([401, ['unauthorized'], 'ไม่มีคุกกี้ครูมาด้วย']),
      },
    }),
  },

  '/api/teacher/classroom': {
    get: op({
      id: 'classroomList',
      summary: 'ห้องทั้งหมดของครูคนนี้',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: 'ไม่รับพารามิเตอร์ — คืนเฉพาะห้องของเจ้าของคุกกี้',
      responses: {
        ...ok(
          'รายการห้อง',
          obj({
            classrooms: arr(
              obj({
                id: uuid('รหัสห้อง', FAKE.classroomId),
                room_code: str('รหัส 6 ตัวที่ฉายบนจอ'),
                status: str('`open` | `locked` | `closed`'),
                teacher_id: uuid('เจ้าของห้อง'),
                opens_at: nullable(str('เวลาเปิด')),
                closes_at: nullable(str('เวลาปิด')),
                created_at: str('เวลาสร้าง'),
              }),
              'ห้องของครูคนนี้',
            ),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'classroomCreate',
      summary: 'เปิดห้องใหม่',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
**ครูเลือกรหัสห้องเองไม่ได้ และเส้นนี้ไม่รับ body เลย**
รหัสมาจาก \`genRoomCode()\` ที่ตัด \`0 O 1 I L\` ออกเพราะอ่านสับสนบนโปรเจกเตอร์
`,
      responses: {
        ...created('สร้างแล้ว', obj({ ok: bool('สำเร็จ'), classroom: opaque('ห้องที่เพิ่งสร้าง') })),
        ...UNAUTHORIZED,
      },
    }),
    patch: op({
      id: 'classroomSetStatus',
      summary: 'ล็อก/ปลด/ปิดห้อง',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: '`closed` จะ stamp `closes_at` ให้ · ห้องที่ `locked`/`closed` รับคนใหม่ไม่ได้',
      requestBody: jsonBody(
        obj(
          {
            classroomId: uuid('ห้องของตัวเอง', FAKE.classroomId),
            status: str('สถานะใหม่', { enum: ['open', 'locked', 'closed'] }),
          },
          { required: ['classroomId', 'status'] },
        ),
        { classroomId: FAKE.classroomId, status: 'locked' },
      ),
      responses: {
        ...ok('เปลี่ยนแล้ว', obj({ ok: bool('สำเร็จ'), classroom: opaque('ห้องหลังเปลี่ยน') })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    delete: op({
      id: 'classroomDelete',
      summary: 'ลบห้องทั้งห้อง (ลบจริง พร้อมไฟล์เสียง)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
⚠️ **ลบจริง ไม่ใช่ซ่อน** ลบนักเรียน ความก้าวหน้า และ**ไฟล์เสียงทั้งห้อง**ใน bucket ด้วย
\`deletedVoiceFiles\` บอกจำนวนไฟล์ที่ลบไป
`,
      requestBody: jsonBody(obj({ classroomId: uuid('ห้องที่จะลบ', FAKE.classroomId) }, { required: ['classroomId'] }), {
        classroomId: FAKE.classroomId,
      }),
      responses: {
        ...ok('ลบแล้ว', obj({ ok: bool('สำเร็จ'), deletedVoiceFiles: int('ลบไฟล์เสียงไปกี่ไฟล์') })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/board': {
    get: op({
      id: 'teacherBoard',
      summary: 'แผงโค้ช — ใครควรเข้าไปหาก่อนและเพราะอะไร',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
**เป็นแผงโค้ช ไม่ใช่ตารางสถานะเฉย ๆ** หน้าเว็บครู poll ทุก 3 วินาที

แต่ละแถวใน \`board[]\` มี: \`studentId\` \`nickname\` \`businessName\` \`learningRoute\` \`scaffoldLevel\` \`goalStars\`
\`goalStatus\` \`earnedStars\` \`currentMission\` \`idleSeconds\` \`confidenceByObjective\` \`correctByObjective\`
\`calibration\` \`skippedMissions\` \`pendingReview\` \`pendingSubmissions\` \`askedForHelp\` \`helpMissionId\` \`flag\` \`coachCard\`

- \`flag\` = \`{ flagged, level, cause, label, reasonId, reasonName, teacherNote }\` เช่น \`idle-too-long\`
- \`coachCard\` = คำแนะนำที่ครูอ่านแล้วเดินไปคุยได้ทันที
- \`goalStatus\` แยก **"ยังไม่ตั้งเป้า"** ออกจาก **"ตั้งเป้า 0"** (สองอย่างนี้ไม่เหมือนกัน)
- \`calibration\` เทียบความมั่นใจกับผลถูกผิด → สรุปเป็น \`shouldTalk\` / \`shouldPraise\`
  **ไม่มีผลกับคะแนน และไม่แสดงเป็นคำตัดสินให้ผู้เรียนเห็น** ใช้ตั้งวงคุยเท่านั้น

⚠️ **ไม่มี \`pin_hash\` หรือคีย์ลับหลุดออกมา**
⚠️ **ห้ามส่งเฉลยมาที่ฝั่งครูในหน้าเดียวกับคำถามโค้ช** route อ่านเฉพาะ \`title\` กับ **จำนวน** ของ hints
   ไม่เคยส่งตัวข้อความคำใบ้ออกไป — ตำราให้ครูถาม ไม่ใช่ให้ครูบอกคำตอบ
⚠️ **ไม่มีช่อง \`stations\` แล้ว** (รูปแบบเดิม)
`,
      parameters: [
        classroomQuery,
        query('now', 'timestamp (ms) ไว้ทดสอบเรื่องเวลา — ไม่ส่งก็ได้', { schema: { type: 'integer' } }),
      ],
      responses: {
        ...ok(
          'แผงของห้องนี้',
          obj({
            classroomId: uuid('ห้อง', FAKE.classroomId),
            now: int('เวลาที่ใช้คิด (ms)'),
            students: int('จำนวนนักเรียนในห้อง'),
            flagged: int('กี่คนที่ติดธง'),
            needsHelp: int('กี่คนที่กดเรียกครู'),
            shouldTalk: int('กี่คนที่ควรเข้าไปคุย'),
            shouldPraise: int('กี่คนที่ควรชม'),
            pendingReview: int('งานที่รอครูยืนยัน'),
            coachRules: opaque('เกณฑ์ของธง ให้ครูเข้าใจว่าระบบยกธงจากอะไร'),
            board: arr(opaque('1 แถว = 1 คน'), '**อาร์เรย์ของนักเรียนอยู่ที่ช่องนี้** (`students` เป็นตัวเลข)'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/learn': {
    get: op({
      id: 'teacherLearn',
      summary: 'ผลเส้นทางเรียน (ดู / อ่าน / ลงมือทำ) ของห้อง หรือรายคน',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
ไม่ส่ง \`studentId\` = ทั้งห้อง (\`students[]\` + สรุปรายภารกิจใน \`missions\`) · ส่ง \`studentId\` = คนเดียว (\`student\`)

มี \`missionTitles\` และ \`questionPrompts[missionId][qid]\` ให้ครูอ่านคำตอบปลายเปิดล่าสุด (\`latestAnswer\`) คู่กับโจทย์

⚠️ **ตรวจเจ้าของห้องในคิวรีเดียวกับที่อ่านข้อมูล** ไม่ใช่เจ้าของห้อง = \`404\` ไม่ใช่ \`403\`
`,
      parameters: [
        classroomQuery,
        query('studentId', 'ดูเฉพาะนักเรียนคนนี้ (uuid) — ไม่ส่งก็ได้', {
          schema: { type: 'string', format: 'uuid' },
        }),
      ],
      responses: {
        ...ok(
          'ผลเส้นทางเรียน',
          obj({
            students: arr(opaque('ผลรายคน'), 'ทั้งห้อง (ไม่มีเมื่อส่ง `studentId`)'),
            student: opaque('ผลของคนเดียว (มีเมื่อส่ง `studentId`)'),
            missions: arr(opaque('สรุปรายภารกิจ'), 'สรุปทั้งห้อง (ไม่มีเมื่อส่ง `studentId`)'),
            missionTitles: map(str('ชื่อภารกิจ'), 'รหัสภารกิจ → ชื่อ'),
            questionPrompts: opaque('รหัสภารกิจ → รหัสข้อ → โจทย์'),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [404, ['not-found']],
          [503, ['learn-unavailable']],
        ),
      },
    }),
  },

  '/api/teacher/screen': {
    get: op({
      id: 'teacherScreen',
      summary: 'จอหน้าห้อง (ฉายบนโปรเจกเตอร์)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: '⚠️ **ไม่มีชื่อคนที่ยังทำไม่เสร็จ** จอหน้าห้องต้องไม่กลายเป็นที่ประจานเด็ก · `showcase[]` คือผลงานที่ครูปักไว้',
      parameters: [classroomQuery],
      responses: {
        ...ok(
          'สิ่งที่ควรขึ้นจอหน้าห้อง',
          obj({
            ok: bool('สำเร็จ'),
            phase: nullable(str('ช่วงของห้องตอนนี้')),
            phaseLabel: str('ป้ายภาษาไทย'),
            remainingSeconds: nullable(int('วินาทีที่เหลือ')),
            paused: bool('นาฬิกาหยุดอยู่'),
            focusScreen: bool('กดเรียกความสนใจอยู่'),
            joined: int('เข้าห้องแล้วกี่คน'),
            missionsPassed: int('ผ่านภารกิจไปแล้วกี่ครั้งรวมทั้งห้อง'),
            submitted: int('ส่งใบเสนอแล้วกี่คน'),
            showcase: arr(opaque('ผลงานที่ปักไว้'), 'ผลงานที่ครูเลือกโชว์'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/broadcast': {
    get: op({
      id: 'broadcastList',
      summary: 'ประกาศที่ส่งไปแล้ว + ข้อความสำเร็จรูป',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: '`presets[]` คือข้อความที่กดส่งได้เลย ครูไม่ต้องพิมพ์กลางคาบ · `maxChars` = 80',
      parameters: [classroomQuery],
      responses: {
        ...ok(
          'ประกาศของห้องนี้',
          obj({
            broadcasts: arr(opaque('ประกาศ 1 ใบ'), 'ที่ส่งไปแล้ว'),
            presets: arr(str('ข้อความสำเร็จรูป'), 'กดส่งได้เลย'),
            maxChars: int('ความยาวสูงสุด (80)'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    post: op({
      id: 'broadcastSend',
      summary: 'ส่งประกาศถึงทั้งห้อง (หรือเฉพาะกลุ่ม)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
จำกัด **1 ข้อความทุก 30 วินาที** ต่อห้อง (\`429\` \`too-fast\`) เพื่อไม่ให้กลายเป็นแถบข้อความเด้งรบกวนกลางคาบ
· \`target: "mission"\` ต้องส่ง \`targetValue\` เช่น \`m3\` ไม่งั้น \`400\`
`,
      requestBody: jsonBody(
        obj(
          {
            classroomId: uuid('ห้องของตัวเอง', FAKE.classroomId),
            text: str('ข้อความ 1-80 ตัวอักษร'),
            target: str('ส่งถึงใคร', { enum: ['all', 'mission'], default: 'all' }),
            targetValue: str('เฉพาะกลุ่มไหน เช่น `m3` (≤20)'),
          },
          { required: ['classroomId', 'text'] },
        ),
        { classroomId: FAKE.classroomId, text: 'อีก 5 นาทีเราจะไปด่านบอสพร้อมกันนะ', target: 'all' },
      ),
      responses: {
        ...ok('ส่งแล้ว', obj({ ok: bool('สำเร็จ'), broadcast: opaque('ประกาศที่ส่ง') })),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [404, ['not-found']],
          [429, ['too-fast']],
        ),
      },
    }),
  },

  '/api/teacher/flags': {
    get: op({
      id: 'flagsList',
      summary: 'ธงคำไม่เหมาะสมที่ถึงครู',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
ตารางการตัดสินของ \`reviewStudentText()\` (E-11)

| สิ่งที่เจอ | ระบบทำอะไร | ครูเห็นไหม |
|---|---|---|
| ข้อมูลส่วนตัว (เบอร์โทร ที่อยู่) | ไม่รับ บอกให้เอาออก | **ไม่แจ้งครู** (ตามตารางในสเปก) |
| ระดับ 1 | ไม่รับ ชวนเปลี่ยนคำ | ไม่แจ้งครู (บันทึกสถิติ) |
| ระดับ 2 | ไม่รับ | **แจ้งครู** พร้อมข้อความ**ปิดบางส่วน** |
| ระดับ 3 | ไม่รับ | **แจ้งครู** พร้อมข้อความเต็ม (ต้องถึงแผงครูใน 3 วินาที) |

**ข้อความเดิมของเด็กถูกส่งกลับไปให้เห็นเสมอ (\`original\`) ห้ามกลืนหาย** และ**ไม่มีการแก้ข้อความของเด็กให้**
`,
      parameters: [
        classroomQuery,
        query('minLevel', 'เอาตั้งแต่ระดับนี้ขึ้นไป (ค่าเริ่มต้นตามที่ route กำหนด)', { schema: { type: 'integer' } }),
        query('since', 'เอาเฉพาะที่ใหม่กว่าเวลานี้ (ISO timestamp)', { example: FAKE.timestamp }),
      ],
      responses: {
        ...ok(
          'ธงของห้องนี้',
          obj({
            ok: bool('สำเร็จ'),
            minLevel: int('ระดับต่ำสุดที่กรองมา'),
            flags: arr(opaque('ธง 1 ใบ (ระดับ 2 ข้อความปิดบางส่วน · ระดับ 3 เต็ม)'), 'ธงที่ถึงครู'),
            checkedAt: str('เวลาที่อ่าน — ใช้เป็น `since` ของรอบถัดไป'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    post: op({
      id: 'flagResolve',
      summary: 'ปิดธง ("ดูแลแล้ว")',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: '⚠️ **ปิดธง ไม่ลบข้อความ** ร่องรอยยังอยู่ให้ตรวจย้อนได้ · ปิดซ้ำได้ `404`',
      requestBody: jsonBody(
        obj(
          {
            flagId: uuid('ธงที่จะปิด — **คัดลอกจาก `flags[].id` ในผลของ `GET /api/teacher/flags`**', FAKE.flagId),
            note: str('บันทึกของครู ≤500'),
          },
          { required: ['flagId'] },
        ),
        { flagId: FAKE.flagId, note: 'คุยกับนักเรียนแล้ว เข้าใจกันดี' },
      ),
      responses: {
        ...ok('ปิดแล้ว', obj({ ok: bool('สำเร็จ'), flagId: uuid('ธงที่ปิด', FAKE.flagId) })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/session': {
    get: op({
      id: 'sessionGet',
      summary: 'คาบของห้องนี้ + ประวัติการย้ายช่วง',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: '**เปิดคาบให้เองถ้ายังไม่มี** ครูไม่ต้องกดสองที · `phases[8]` คือช่วงทั้งหมดพร้อมป้ายภาษาไทย',
      parameters: [classroomQuery],
      responses: {
        ...ok(
          'คาบตอนนี้',
          obj({
            session: opaque('แถว `class_sessions` ของคาบนี้'),
            phases: arr(opaque('ช่วง 1 ช่วง'), '8 ช่วง: wait onboard mission boss summary reflect end home'),
            changes: arr(opaque('การย้ายช่วง 1 ครั้ง'), 'ประวัติการย้ายช่วง'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    post: op({
      id: 'sessionAction',
      summary: 'คุมคาบ — ย้ายช่วง ตั้งเวลา หยุด เรียกความสนใจ เปิดแบบทดสอบ',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
**"ช่วงของห้อง" คือเพดานสูงสุดที่ครูเปิดให้ทำ ไม่ใช่โซ่ที่ลากทุกคนไปพร้อมกัน**

| action | ฟิลด์ | ทำอะไร |
|---|---|---|
| \`open\` | \`classroomId\` | เปิดคาบ (มีอยู่แล้วคืนของเดิม ไม่สร้างซ้อน) |
| \`phase\` | \`sessionId\` · \`phase\` · \`timerSeconds\` | ย้ายทั้งห้อง + ตั้งนาฬิกาในคำสั่งเดียว |
| \`revert\` | \`sessionId\` | ย้อนการย้ายช่วงล่าสุด **ภายใน 30 วินาที** เกินนั้น \`409\` \`too-late\` |
| \`timer\` | \`sessionId\` · \`seconds\` | ตั้งเวลา |
| \`extend\` | \`sessionId\` · \`addSeconds\` | ปุ่ม +1 +3 +5 นาที (นับสะสมใน \`timer_extended_seconds\`) |
| \`pause\` | \`sessionId\` · \`paused\` | หยุด/เดินนาฬิกาต่อ **จากวินาทีที่ค้างไว้** ไม่ใช่เริ่มนับใหม่ |
| \`focus\` | \`sessionId\` · \`on\` | เรียกความสนใจ — จอเด็กขึ้นหน้าพัก "ดูจอหน้าห้องนะ" |
| \`settings\` | \`sessionId\` · \`aiEnabled\` · \`allowEarlyBoss\` · \`surveyEnabled\` · \`homeDeadline\` | ตั้งค่าของคาบ |
| \`test-window\` | \`sessionId\` · \`which\` (\`pre\`\\|\`post\`) · \`enabled\` | **เปิด/ปิดแบบทดสอบ 10 ข้อ** |
| \`test\` | \`sessionId\` · \`kind\` (\`pretest\`\\|\`posttest\`) · \`enabled\` | ชื่อเดิมของ \`test-window\` (ยังรับอยู่ให้หน้าจอเก่าไม่พัง) |
| \`close\` | \`sessionId\` | ปิดคาบ (ห้องยังเปิด เด็กยังเข้าได้) |
| \`unlock-student\` / \`lock-student\` | \`studentId\` · \`phase\` · \`note\` | ปลดล็อก/เก็บคืนช่วงให้รายคนก่อนทั้งห้อง |

**ปลดล็อกได้เฉพาะ** \`onboard\` \`mission\` \`boss\` \`summary\` \`reflect\` \`home\` (\`wait\`/\`end\` ไม่ใช่กิจกรรมที่ทำคนเดียวได้)

⚠️ **แบบทดสอบก่อน/หลังเรียนไม่ผูกกับช่วงของคาบ** (T-12) ใช้สวิตช์ \`pretest_enabled\`/\`posttest_enabled\` โดยตรง
ผลที่ตั้งใจ: ครูกดเปิดแบบทดสอบแล้ว**ทั้งห้องไม่เด้งไปช่วงอื่น**
⚠️ **ปิดคาบแล้วสั่งอะไรกับ \`sessionId\` ใบนั้นไม่ได้อีก** ได้ \`404\` — ต้องกด \`open\` เปิดคาบใหม่ก่อน
`,
      requestBody: jsonBody(
        obj(
          {
            action: str('คำสั่ง', {
              enum: [
                'open',
                'phase',
                'revert',
                'timer',
                'extend',
                'pause',
                'focus',
                'settings',
                'test-window',
                'test',
                'close',
                'unlock-student',
                'lock-student',
              ],
            }),
            classroomId: uuid('ใช้กับ `open`', FAKE.classroomId),
            sessionId: uuid('ใช้กับทุก action ที่ไม่ใช่ `open` และไม่ใช่รายคน — **คัดลอกจาก `session.id` ในผลของ `GET /api/teacher/session`**', FAKE.sessionId),
            studentId: uuid('ใช้กับ `unlock-student` / `lock-student` — **คัดลอกจาก `studentId` ในผลของ `GET /api/teacher/board`**', FAKE.studentId),
            phase: str('ช่วงที่จะย้ายไป / ช่วงที่ปลดล็อกให้รายคน', {
              enum: ['wait', 'onboard', 'mission', 'boss', 'summary', 'reflect', 'end', 'home'],
            }),
            timerSeconds: int('ตั้งนาฬิกาพร้อมย้ายช่วง 0-7200'),
            seconds: int('ตั้งเวลา 0-7200'),
            addSeconds: int('เพิ่มเวลา 1-1800'),
            paused: bool('หยุดนาฬิกาไหม'),
            on: bool('เปิดโหมดเรียกความสนใจไหม'),
            which: str('แบบทดสอบชุดไหน (`test-window`)', { enum: ['pre', 'post'] }),
            kind: str('แบบทดสอบชุดไหน (`test` — ชื่อเดิม)', { enum: ['pretest', 'posttest'] }),
            enabled: bool('เปิดหรือปิด'),
            aiEnabled: bool('ให้ใช้ชั้น AI ในคาบนี้ไหม'),
            allowEarlyBoss: bool('ให้เข้าด่านบอสก่อนถึงช่วงได้ไหม'),
            surveyEnabled: bool('เปิดแบบสอบถามไหม'),
            homeDeadline: str('เส้นตายของงานที่ทำต่อที่บ้าน (ISO)'),
            note: str('บันทึกของครู ≤200'),
          },
          { required: ['action'] },
        ),
        { action: 'phase', sessionId: FAKE.sessionId, phase: 'mission', timerSeconds: 900 },
        { description: 'ช่องที่ต้องส่งขึ้นกับ `action` — ดูตารางในคำอธิบาย (zod เป็น discriminated union)' },
      ),
      responses: {
        ...ok(
          'ทำแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            session: opaque('คาบหลังเปลี่ยน (ทุก action ที่ระดับห้อง)'),
            unlock: opaque('การปลดล็อกรายคน (`unlock-student` / `lock-student`)'),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [404, ['not-found'], 'รวมกรณี "ปิดคาบไปแล้ว" — ต้องกด `open` ใหม่'],
          [409, ['too-late']],
        ),
      },
    }),
  },

  '/api/teacher/student': {
    get: op({
      id: 'teacherStudentGet',
      summary: 'รายงานรายคน + ร่องรอยที่ครูแก้ไว้',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: '`reasonOptions[]` = ตัวเลือกเหตุผลที่ระบบรับ ให้หน้าจอไม่ต้องฮาร์ดโค้ดเอง',
      parameters: [
        query('studentId', 'รหัสนักเรียนในห้องของตัวเอง (uuid) — **บังคับ**', {
          required: true,
          schema: { type: 'string', format: 'uuid' },
          example: FAKE.studentId,
        }),
      ],
      responses: {
        ...ok(
          'ข้อมูลรายคน',
          obj({
            report: opaque('รายงานของคนนี้'),
            overrides: arr(opaque('การแก้ 1 ครั้ง (ค่าเดิม ค่าใหม่ ใครแก้ เมื่อไร)'), 'ร่องรอยที่ครูแก้'),
            notes: arr(opaque('บันทึกการโค้ช'), 'บันทึกของครู'),
            unlocks: arr(opaque('การปลดล็อกช่วง'), 'ช่วงที่ปลดล็อกให้คนนี้'),
            reasonOptions: arr(opaque('ตัวเลือกเหตุผล'), '`coached` `device` `level-fit` `other`'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    post: op({
      id: 'teacherStudentAction',
      summary: 'ครูปรับแผนรายคน (ทุกครั้งต้องเลือกเหตุผล)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
**ทุกการแก้ต้องเลือกเหตุผล** จาก \`coached\` · \`device\` · \`level-fit\` · \`other\`
ระบบเก็บค่าเดิม ค่าใหม่ ใครแก้ เมื่อไร ลง \`teacher_overrides\` เอาไปตอบกรรมการได้ว่า
**"ครูแก้การตัดสินใจของระบบได้จริง ไม่ใช่ระบบสั่งครู"**

| action | ทำอะไร |
|---|---|
| \`mission-level\` | ปรับระดับตัวช่วยของภารกิจหนึ่งให้คนหนึ่ง |
| \`allow-skip\` | เปิด/ปิดสิทธิ์ข้ามภารกิจนั้น (\`allow\`) |
| \`skip-mission\` | สั่งข้ามภารกิจนั้นให้เลย |
| \`force-pass\` | ให้ผ่านภารกิจนั้น |
| \`scaffold\` | เปลี่ยนช่องทางเรียน/ระดับตัวช่วย (ต้องส่ง \`channel\` หรือ \`level\` อย่างน้อยหนึ่งอย่าง ไม่งั้น \`400\`) |
| \`unlock-business\` | ปลดล็อกโปรไฟล์ร้านให้แก้ได้อีกครั้ง |
| \`boss-template\` | เปลี่ยนแม่แบบงานด่านบอส |
| \`open-boss\` | เปิดด่านบอสให้คนนี้ก่อน |
| \`reset-pin\` | ออกรหัส 4 หลักชั่วคราว — **คืนค่ากลับมาครั้งเดียวให้ครูบอกต่อ ฐานข้อมูลเก็บแต่ hash** |
| \`note\` | บันทึกการโค้ช (ป้าย + ข้อความ) — ไม่ใช่การแก้ค่า จึงไม่บังคับเหตุผล |
`,
      requestBody: jsonBody(
        obj(
          {
            action: str('คำสั่ง', {
              enum: [
                'mission-level',
                'allow-skip',
                'skip-mission',
                'force-pass',
                'scaffold',
                'unlock-business',
                'boss-template',
                'open-boss',
                'reset-pin',
                'note',
              ],
            }),
            studentId: uuid('นักเรียนในห้องของตัวเอง', FAKE.studentId),
            missionId: str('ภารกิจ `m1`-`m4`', { examples: [DEMO.missionId] }),
            level: int('ระดับตัวช่วย 1-3'),
            allow: bool('ใช้กับ `allow-skip`'),
            channel: str('ช่องทางการเรียน', { enum: ['clip', 'card', 'game', 'buddy'] }),
            unlocked: bool('ใช้กับ `unlock-business`'),
            templateId: str('รหัสแม่แบบงานด่านบอส 1-60'),
            reason: str('**เหตุผล** (ทุก action ที่เป็นการแก้ค่า)', {
              enum: ['coached', 'device', 'level-fit', 'other'],
              default: 'other',
            }),
            note: str('บันทึกสั้น ≤200'),
            chips: arr(str('ป้าย ≤40'), 'ใช้กับ `note` — ป้ายสำเร็จรูปไม่เกิน 8 อัน'),
            text: str('ข้อความของบันทึก ≤500 (ใช้กับ `note`)'),
          },
          { required: ['action', 'studentId'] },
        ),
        { action: 'force-pass', studentId: FAKE.studentId, missionId: DEMO.missionId, reason: 'coached', note: 'คุยกันแล้วเข้าใจเรื่องนี้' },
        { description: 'ช่องที่ต้องส่งขึ้นกับ `action` (zod เป็น discriminated union)' },
      ),
      responses: {
        ...ok(
          'ทำแล้ว — ช่องที่คืนต่างกันตาม action',
          obj({
            ok: bool('สำเร็จ'),
            missionProgress: opaque('ใช้กับ action ที่แตะภารกิจ'),
            profile: opaque('ใช้กับ action ที่แตะโปรไฟล์'),
            unlock: opaque('ใช้กับ `open-boss`'),
            note: opaque('ใช้กับ `note`'),
            tempPin: str('ใช้กับ `reset-pin` — **คืนครั้งเดียว** ฐานข้อมูลเก็บแต่ hash'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    delete: op({
      id: 'teacherStudentRemove',
      summary: 'ลบนักเรียนรายคนออกจากห้อง (ลบจริง)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
⚠️ **ลบจริง ไม่ใช่ซ่อน** ใช้กับชื่อที่สมัครผิดหรือสมัครซ้ำ หน้าจอครูถามยืนยันก่อนส่งเสมอ
ตรวจว่าห้องเป็นของครูคนนี้และนักเรียนอยู่ห้องนั้นในคำสั่งเดียวกัน ไม่ใช่ = \`404\`
`,
      requestBody: jsonBody(
        obj(
          {
            studentId: uuid('นักเรียนที่จะลบ', FAKE.studentId),
            classroomId: uuid('ห้องของนักเรียน', FAKE.classroomId),
          },
          { required: ['studentId', 'classroomId'] },
        ),
        { studentId: FAKE.studentId, classroomId: FAKE.classroomId },
      ),
      responses: {
        ...ok('ลบแล้ว', obj({ ok: bool('สำเร็จ'), removed: obj({ id: uuid('นักเรียนที่ลบ'), nickname: str('ชื่อเล่น') }) })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/confirm-score': {
    post: op({
      id: 'confirmScore',
      summary: 'ครูยืนยันคะแนนรายด้าน (คำตัดสินจริงอยู่ที่นี่)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
**ครูเป็นคนตัดสินเสมอ AI เป็นแค่ข้อเสนอ**
\`submissionId\` รับจาก body ได้ แต่ SQL function ตรวจ \`EXISTS(งานชิ้นนี้อยู่ในห้องของครูคนนี้)\`
ภายใน \`UPDATE\` เดียวกัน ไม่ใช่เจ้าของ = 0 แถว = \`404\`

**คะแนนรายด้าน 4 ด้าน** \`dim-naming\` · \`dim-tld-fit\` · \`dim-customer-reason\` · \`dim-business-link\` (ด้านละ 1-3)

- **เซิร์ฟเวอร์คำนวณคะแนนรวมถ่วงน้ำหนักเอง ไม่รับตัวเลขรวมจากหน้าจอ** สูตร = (ด้านที่เน้น × 2) + อีก 3 ด้าน · เต็ม 15
- \`emphasisDimensionId\` รับได้ทั้ง \`dim-*\` · \`bm-r*\` · \`emphasis-*\` (แปลงด้วย \`toRubricDimensionId()\` ที่เดียวในโปรเจกต์ บันทึกเป็น \`dim-*\` เสมอ)
- **\`note\` บังคับกรอก** อย่างน้อย 1 ตัวอักษร — คะแนนที่ไม่มีคำอธิบายไม่ช่วยให้ผู้เรียนรู้ว่าต้องแก้อะไร
- ส่ง \`stars\` มาจะใช้ค่านั้น ไม่ส่งจะคิดจาก \`starBands\` ให้เอง แล้ว \`recalcStudentStars()\` ให้ทุกจอตรงกัน
- รูปแบบเดิม \`score\`/\`maxScore\` ยังรับได้ (ต้องส่ง \`dimensions\` **หรือ** \`score\` อย่างใดอย่างหนึ่ง)

**\`changedDimensions\` = ด้านที่ครูแก้ "รอบนี้"** ไม่ใช่ "ต่างจากที่ AI เสนอ"
\`changedFrom\`: \`'teacher'\` = เทียบกับรอบก่อนของครู · \`'ai'\` = ยืนยันครั้งแรก · \`null\` = ไม่มีอะไรให้เทียบ
· \`aiScores\` คือ \`ai_scores_snapshot\` ณ วินาทีที่กดยืนยัน — **ทางเดียวที่อ่านผลของ AI ผ่าน HTTP ได้**
`,
      requestBody: jsonBody(
        obj(
          {
            submissionId: uuid('ใบงานในห้องของตัวเอง — **คัดลอกจาก `pendingSubmissions[].id` ในผลของ `GET /api/teacher/board`**', FAKE.submissionId),
            dimensions: map(int('ระดับ 1-3'), 'คะแนนรายด้าน **ครบ 4 ด้าน**'),
            emphasisDimensionId: str('ด้านที่ถ่วง 2 เท่า (`dim-*` / `bm-r*` / `emphasis-*`)'),
            stars: int('ดาว 0-3 (ไม่ส่ง = ให้ระบบคิดจาก starBands)'),
            score: int('รูปแบบเดิม: คะแนนก้อนเดียว 0-100'),
            maxScore: int('รูปแบบเดิม: คะแนนเต็ม 1-100'),
            note: str('**บังคับ** คำอธิบายถึงผู้เรียน 1-500 ตัวอักษร'),
          },
          { required: ['submissionId', 'note'] },
        ),
        {
          submissionId: FAKE.submissionId,
          dimensions: { 'dim-naming': 3, 'dim-tld-fit': 3, 'dim-customer-reason': 2, 'dim-business-link': 3 },
          emphasisDimensionId: 'dim-tld-fit',
          note: 'เหตุผลเรื่องลูกค้าเขียนได้ดีขึ้นมาก ลองเติมว่าลูกค้ากลุ่มไหนอีกนิด',
        },
      ),
      responses: {
        ...ok(
          'ยืนยันแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            submission: obj({
              id: uuid('ใบงาน', FAKE.submissionId),
              needsReview: bool('`false` แล้วหลังยืนยัน'),
              aiScores: nullable(opaque('`ai_scores_snapshot` — ของกฎกับของ AI คู่กัน')),
              teacherScores: opaque('คะแนนที่ครูยืนยันรอบนี้'),
              teacherChanged: bool('ครูแก้จากข้อเสนอไหม'),
              changedDimensions: arr(str('รหัสด้าน'), 'ด้านที่ครูแก้ **รอบนี้**'),
              changedFrom: nullable(str('`teacher` | `ai`')),
              previousTeacherScores: nullable(opaque('คะแนนที่ครูยืนยันไว้ครั้งก่อน')),
              confirmedAt: str('เวลาที่ยืนยัน'),
            }),
          }),
        ),
        ...failures(
          [400, ['bad-request'], 'ขาดด้านไหน **บอกชื่อด้านที่ขาดมาตรง ๆ** ไม่ใช่แค่ "ข้อมูลไม่ครบ"'],
          [401, ['unauthorized']],
          [404, ['not-found']],
        ),
      },
    }),
  },

  '/api/teacher/request-revision': {
    post: op({
      id: 'requestRevision',
      summary: 'ส่งงานกลับให้แก้ (ลูป "ไม่มีการตก ทำต่อได้")',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
\`\`\`
เด็กส่ง -> ครูสั่งแก้ -> เด็กแก้แล้วส่งใหม่ (แถวใหม่) -> ครูยืนยัน -> ใบประกาศออก
\`\`\`

- คำสั่ง "ให้แก้" เก็บใน \`submissions.teacher_confirmed_scores\` เป็น \`{ status: 'revise', reviseDimensionIds, note, round, overrideLimit }\`
- เด็กแก้แล้วส่งใหม่ = **แถวใหม่ใน \`submissions\`** ฉบับเดิมไม่ถูกทับ ครูเทียบพัฒนาการได้
- **แก้ได้ 3 รอบ** กันวนไม่จบ แต่**ไม่ตัน** — ครบแล้วครูติ๊ก \`allowExtraRound: true\` ให้แก้ต่อได้
- \`revision.dimensions[].whatGetsYouThere\` = descriptor ระดับ 3 จาก \`content/rubric.json\` **ตรง ๆ ไม่ได้แต่งเอง**

⚠️ **สถานะนำหน้าคะแนนเสมอ** ต่อให้ครูเผลอให้ 3 ครบทุกด้านตอนสั่งแก้ ใบประกาศก็ยังเป็น \`keep-going\` อยู่ดี
⚠️ **\`note\` บังคับ** และ \`dimensionIds\` ต้องมีอย่างน้อย 1 ด้าน
`,
      requestBody: jsonBody(
        obj(
          {
            submissionId: uuid('ใบงานในห้องของตัวเอง — **คัดลอกจาก `pendingSubmissions[].id` ในผลของ `GET /api/teacher/board`**', FAKE.submissionId),
            dimensionIds: arr(str('รหัสด้าน `dim-*`'), 'ด้านที่ให้กลับไปแก้ — **อย่างน้อย 1**'),
            dimensions: map(int('ระดับ 1-3'), 'คะแนนที่ให้ไว้ตอนสั่งแก้ (ไม่บังคับ)'),
            note: str('**บังคับ** บอกว่าให้แก้อะไร 1-500'),
            allowExtraRound: bool('ให้แก้เกินโควตา 3 รอบได้'),
          },
          { required: ['submissionId', 'dimensionIds', 'note'] },
        ),
        {
          submissionId: FAKE.submissionId,
          dimensionIds: ['dim-customer-reason'],
          note: 'ลองบอกให้ชัดว่าลูกค้าของเราคือใคร แล้วนามสกุลนี้ช่วยเขาตรงไหน',
        },
      ),
      responses: {
        ...ok(
          'ส่งกลับให้แก้แล้ว',
          obj({
            ok: bool('สำเร็จ'),
            submission: obj({
              id: uuid('ใบงาน', FAKE.submissionId),
              needsReview: bool('รอครูอ่านอีกครั้งไหม'),
              revision: opaque('คำสั่งแก้ (รอบที่เท่าไร เหลือกี่รอบ ด้านไหน)'),
            }),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/showcase': {
    get: op({
      id: 'teacherShowcaseGet',
      summary: 'ผนังผลงานฝั่งครู (ปักหมุด + ดูความเห็นเพื่อน)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: '`withoutFeedback[]` = คนที่ยังไม่มีใครเขียนถึง — ครูใช้ชวนเพื่อนไปให้กำลังใจ ไม่ให้ใครถูกลืม',
      parameters: [classroomQuery],
      responses: {
        ...ok(
          'ผนังผลงานของห้องนี้',
          obj({
            ok: bool('สำเร็จ'),
            pinned: arr(opaque('ผลงานที่ปักไว้'), 'ที่โชว์บนจอหน้าห้อง'),
            feedback: arr(opaque('ความเห็น 1 ใบ'), 'ความเห็นที่เพื่อนเขียนถึงกัน'),
            withoutFeedback: arr(opaque('คนที่ยังไม่มีใครเขียนถึง'), 'ให้ครูชวนเพื่อนไปให้กำลังใจ'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    post: op({
      id: 'teacherShowcaseAction',
      summary: 'ปักหมุดผลงาน หรือซ่อนความเห็นที่ไม่เหมาะ',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
- \`action: "pin"\` — \`submissionId\` · \`pinned\` · \`hideName\` (ปักได้โดยไม่ต้องเปิดชื่อเจ้าของ)
- \`action: "peer-visible"\` — \`submissionId\` · \`visible\` (true อนุมัติให้เพื่อนเห็น · false ซ่อน · null ให้ตัวกรองคำตัดสิน)
- \`action: "hide-feedback"\` — \`feedbackId\` · \`hidden\` · \`reason\` (**ซ่อน ไม่ลบ** ร่องรอยยังอยู่)
`,
      requestBody: jsonBody(
        obj(
          {
            action: str('คำสั่ง', { enum: ['pin', 'peer-visible', 'hide-feedback'] }),
            submissionId: uuid('ใช้กับ `pin` และ `peer-visible`', FAKE.submissionId),
            pinned: bool('ปักหรือถอด'),
            visible: nullable(bool('เพื่อนเห็นบนผนังไหม (null = ตัวกรองตัดสิน)')),
            hideName: bool('ปักโดยไม่โชว์ชื่อเจ้าของ'),
            feedbackId: uuid('ใช้กับ `hide-feedback`', FAKE.feedbackId),
            hidden: bool('ซ่อนหรือเอากลับมา'),
            reason: str('เหตุผลที่ซ่อน ≤300'),
          },
          { required: ['action'] },
        ),
        { action: 'pin', submissionId: FAKE.submissionId, pinned: true, hideName: false },
      ),
      responses: {
        ...ok(
          'ทำแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            submissionId: uuid('ใช้กับ `pin`', FAKE.submissionId),
            pinnedAt: nullable(str('เวลาที่ปัก')),
            peerVisible: nullable(bool('ค่าที่ครูตั้งไว้ (peer-visible)')),
            feedbackId: uuid('ใช้กับ `hide-feedback`', FAKE.feedbackId),
            hiddenAt: nullable(str('เวลาที่ซ่อน')),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/voice': {
    get: op({
      id: 'voiceList',
      summary: 'ไฟล์เสียงของทั้งห้อง (signed URL อายุสั้น)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
\`teacherId\` มาจากคุกกี้เท่านั้น · ทั้ง \`listClassroomVoiceSubmissions\` และ \`delete_voice_submission\`
ตรวจสายโซ่เจ้าของ (ไฟล์เสียง → นักเรียน → ห้อง → ครู) ใน query/SQL เดียวกัน ไม่ใช่เจ้าของ = \`404\`
และ**ไม่แตะไฟล์ใน bucket เลย**

⚠️ \`url\` เป็น **signed URL อายุสั้นของ bucket ส่วนตัว ไม่ใช่ลิงก์สาธารณะ**
`,
      parameters: [classroomQuery],
      responses: {
        ...ok(
          'ไฟล์เสียงของห้องนี้',
          obj({
            classroomId: uuid('ห้อง', FAKE.classroomId),
            count: int('จำนวนไฟล์'),
            voices: arr(
              obj({
                id: uuid('รหัสไฟล์เสียง', FAKE.voiceId),
                nickname: str('ชื่อเล่นเจ้าของเสียง'),
                durationSec: num('ความยาว (วินาที)'),
                transcriptText: nullable(str('ข้อความที่ถอดได้ (ถ้ามี)')),
                createdAt: str('เวลาที่อัปโหลด'),
                expiresAt: str('เวลาที่จะถูกลบอัตโนมัติ (90 วัน)'),
                url: str('signed URL อายุสั้น'),
              }),
              'ไฟล์เสียงทั้งห้อง',
            ),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
    delete: op({
      id: 'voiceDelete',
      summary: 'ลบไฟล์เสียง 1 ไฟล์ (ลบทั้งไฟล์และแถว)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: 'ครูสั่งลบก่อนครบ 90 วันได้ — **เสียงเด็กเป็นข้อมูลส่วนบุคคล**',
      requestBody: jsonBody(obj(
          { voiceSubmissionId: uuid('ไฟล์เสียงในห้องของตัวเอง — **คัดลอกจาก `voices[].id` ในผลของ `GET /api/teacher/voice`**', FAKE.voiceId) },
          { required: ['voiceSubmissionId'] },
        ), {
        voiceSubmissionId: FAKE.voiceId,
      }),
      responses: {
        ...ok('ลบแล้ว', obj({ ok: bool('สำเร็จ'), deleted: uuid('รหัสที่ลบ', FAKE.voiceId) })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/report': {
    get: op({
      id: 'report',
      summary: 'รายงาน — รายคน (`studentId`) หรือรายห้อง (`classroomId`)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: 'ส่งอย่างใดอย่างหนึ่ง · ไม่ส่งเลยได้ `400` · รายห้องมี `buddyLog` ติดมาด้วย',
      parameters: [
        query('studentId', 'รายคน (uuid)', { schema: { type: 'string', format: 'uuid' }, example: FAKE.studentId }),
        query('classroomId', 'รายห้อง (uuid)', { schema: { type: 'string', format: 'uuid' }, example: FAKE.classroomId }),
      ],
      responses: {
        ...ok(
          'รายงาน',
          obj({
            report: opaque('รายงานรายคนหรือรายห้อง'),
            buddyLog: arr(opaque('การช่วยกัน 1 ครั้ง'), 'เฉพาะรายห้อง — ใครช่วยใคร'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/report/class': {
    get: op({
      id: 'reportClass',
      summary: 'รายงานทั้งห้อง — E1/E2 · t-test · effect size · normalized gain',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
สถิติที่งานวิจัยสื่อการสอนต้องใช้ คิดที่ \`core/statistics.ts\` ที่เดียว
· \`objectiveGaps\` บอกจุดประสงค์ที่ทั้งห้องยังอ่อน เอาไปปรับแผนคาบหน้าได้
`,
      parameters: [classroomQuery],
      responses: {
        ...ok('รายงานทั้งห้อง', obj({ report: opaque('E1/E2 · t-test · effect size · normalized gain · objectiveGaps') })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/report/items': {
    get: op({
      id: 'reportItems',
      summary: 'สถิติรายข้อ — ค่าความยาก (p) และอำนาจจำแนก (r)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
เกณฑ์: ความยาก **0.20-0.80** · อำนาจจำแนก **ตั้งแต่ 0.20** · ทุกข้อมีคำแปลเป็นภาษาที่ครูใช้ตัดสินใจได้ (\`verdict\`)

⚠️ **แยกชุดก่อนเรียน (ชุด A) กับหลังเรียน (ชุด B) ก่อนคิดเสมอ** เป็นข้อสอบคู่ขนานคนละฉบับ
รวมกันแล้วค่าความยากทุกข้อจะกลายเป็นค่าเฉลี่ยของ "ข้อที่ครึ่งห้องไม่ได้ทำ"
⚠️ **ไม่คืนเฉลยและไม่คืนตัวเลือกที่เด็กกด** เพราะ (รหัสข้อ + ตัวเลือก + ตอบถูก) = เฉลยข้อนั้น
⚠️ \`groupSize\` = กลุ่มสูง/กลุ่มต่ำกลุ่มละกี่คน (27% ของผู้ทำ) — ห้องเล็กได้กลุ่มละ 1 คน
ทำให้ r มีได้แค่ −1/0/1 **ครูต้องรู้ก่อนตีความ**
`,
      parameters: [classroomQuery],
      responses: {
        ...ok(
          'สถิติรายข้อ',
          obj({
            itemAnalysis: obj({
              classroomId: uuid('ห้อง', FAKE.classroomId),
              criteria: opaque('เกณฑ์ที่ใช้ตัดสิน (p 0.20-0.80 · r ≥ 0.20 · 27%)'),
              sets: arr(opaque('1 ชุด (pre หรือ post) พร้อมสถิติรายข้อ'), '2 ชุด: ก่อนเรียน และหลังเรียน'),
            }),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/efficiency': {
    get: op({
      id: 'efficiency',
      summary: 'ประสิทธิภาพสื่อ E1/E2 เทียบเกณฑ์มาตรฐาน',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: '`meetsStandard` เทียบกับ `standardLabel` ให้เลย ครูไม่ต้องคิดเอง · `summary` เป็นประโยคที่ก๊อปไปใส่รายงานได้',
      parameters: [classroomQuery],
      responses: {
        ...ok(
          'E1/E2 ของห้องนี้',
          obj({
            ok: bool('สำเร็จ'),
            studentCount: int('จำนวนนักเรียน'),
            postTestDone: int('ทำแบบทดสอบหลังเรียนแล้วกี่คน'),
            preTestDone: int('ทำก่อนเรียนแล้วกี่คน'),
            e1: opaque('ประสิทธิภาพของกระบวนการ'),
            e2: opaque('ประสิทธิภาพของผลลัพธ์'),
            label: str('ป้ายของค่าที่ได้'),
            standardLabel: str('เกณฑ์มาตรฐานที่ใช้เทียบ'),
            meetsStandard: bool('ถึงเกณฑ์ไหม'),
            summary: str('ประโยคสรุปที่ก๊อปไปใส่รายงานได้'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/export': {
    get: op({
      id: 'exportCsv',
      summary: 'ส่งออก CSV (5 ชนิด · มีโหมดปิดชื่อ)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
\`pseudonymize=1\` แทนชื่อเล่นด้วยรหัส \`S01\` \`S02\` … **เรียงตามชื่อเล่นเพื่อให้ผลคงที่ทุกครั้งที่ส่งออก**
ใช้ตอนเอาข้อมูลไปทำรายงานวิจัยที่ไม่ควรมีชื่อเด็ก

ไฟล์มี **BOM** นำหน้า เพื่อให้ Excel บน Windows อ่านภาษาไทยไม่เพี้ยน
`,
      parameters: [
        classroomQuery,
        query('type', 'ชนิดข้อมูล (ไม่ส่ง = `students`)', {
          schema: { type: 'string', enum: ['students', 'scores', 'events', 'reflections', 'survey'] },
          example: 'scores',
        }),
        query('pseudonymize', '`1` = แทนชื่อเล่นด้วยรหัส `S01` `S02` …', { schema: { type: 'string', enum: ['1'] } }),
      ],
      responses: {
        ...fileResponse(200, 'ไฟล์ CSV', 'text/csv', {
          'content-disposition': 'ชื่อไฟล์ตามชนิดและรหัสห้อง',
          'cache-control': '`no-store`',
        }),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/teacher/demo-reset': {
    post: op({
      id: 'demoReset',
      summary: 'ล้างห้องสาธิตกลับค่าเริ่มต้น (ด่าน 3 ชั้น)',
      tags: [TEACHER],
      security: TEACHER_ONLY,
      description: `
**ด่าน 3 ชั้น ด่านล่างสุดคือตัวจริง**

1. คุกกี้ครู (\`teacherId\` **ไม่เคยรับจาก body**)
2. \`roomCode\` ในคำขอต้องตรงกับรหัสห้องจริง = **การยืนยัน** (ไม่ตรง = \`400\` \`confirm-mismatch\` และ**ไม่ลบอะไรเลย**)
3. \`reset_demo_classroom\` ในฐานข้อมูล**ปฏิเสธห้องที่ไม่ได้ติดป้าย \`is_demo\`** → **ห้องเรียนจริงล้างไม่ได้แม้ยิง API ตรง ๆ** (\`403\` \`not-demo\`)

⚠️ **ลบนักเรียนทั้งห้องจริง ๆ แล้วเติมหุ่นกลับ** ถ้ามีใครกำลังทดสอบบนห้องนั้นอยู่ เขาจะหลุดกลางทาง
`,
      requestBody: jsonBody(
        obj(
          {
            classroomId: uuid('ห้องสาธิตของตัวเอง — **คัดลอกจาก `GET /api/teacher/classroom`** (ใบที่ `room_code` = `QUEST9`)', FAKE.classroomId),
            roomCode: str('พิมพ์รหัสห้องซ้ำเพื่อยืนยัน 1-12 ตัวอักษร (ต้องตรงกับห้องที่เลือก ไม่ตรง = `400` และไม่ลบอะไรเลย)', { examples: [DEMO.roomCode] }),
          },
          { required: ['classroomId', 'roomCode'] },
        ),
        { classroomId: FAKE.classroomId, roomCode: DEMO.roomCode },
      ),
      responses: {
        ...ok(
          'ล้างแล้วและเติมหุ่นกลับ',
          obj({
            ok: bool('สำเร็จ'),
            roomCode: str('รหัสห้อง'),
            cleared: int('ลบข้อมูลไปกี่รายการ'),
            seeded: int('เติมหุ่นกลับกี่คน'),
            elapsedMs: int('ใช้เวลากี่มิลลิวินาที'),
            message: str('ข้อความสรุปให้ครูอ่าน'),
          }),
        ),
        ...failures(
          [400, ['bad-request', 'confirm-mismatch']],
          [401, ['unauthorized']],
          [403, ['not-demo']],
          [404, ['not-found']],
        ),
      },
    }),
  },

  '/api/jobs/drain': {
    get: op({
      id: 'queueCounts',
      summary: 'ดูว่าคิวตรวจงานเหลือเท่าไร (อ่านอย่างเดียว)',
      tags: [SYSTEM],
      security: TEACHER_OR_WORKER,
      description: 'เบา เรียกถี่ได้ · แผงครูใช้ตัดสินใจว่าจะยิง `POST` รอบต่อไปไหม · **ไม่แตะคิว**',
      responses: {
        ...ok(
          'จำนวนงานในคิวแต่ละสถานะ',
          obj({
            ok: bool('สำเร็จ'),
            pending: int('รอคิว'),
            running: int('กำลังตรวจ'),
            done: int('เสร็จแล้ว'),
            failed: int('ไม่สำเร็จครบ 3 รอบ'),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'queueDrain',
      summary: 'worker ตรวจงานในคิว (ยิงซ้ำได้ idempotent)',
      tags: [SYSTEM],
      security: TEACHER_OR_WORKER,
      description: `
ทุกครั้งที่เรียก: ดึงงานค้างของ worker ที่ตายกลับเข้าคิว (\`reclaimed\`) → แล้วตรวจจนคิวว่างหรือครบ \`max\`

ผ่านได้ 2 ทาง: (1) header \`x-worker-secret\` ตรงกับ \`GRADE_WORKER_SECRET\` หรือ (2) คุกกี้ \`dbq_teacher\`
**ไม่ได้ตั้ง \`GRADE_WORKER_SECRET\` = ทางที่ (1) ไม่ผ่านตั้งแต่ต้น** (ไม่ใช่ "ไม่ตั้ง = ผ่านหมด")

⚠️ **ช้าได้เป็นสิบวินาที** เพราะฝั่งเบื้องหลังให้งบเวลา 60 วินาทีต่องาน (ไม่ใช่ 5 วินาทีเหมือนเส้นที่ผู้เรียนรอ)
ตรวจได้สูงสุด 20 งานต่อครั้ง เหลือให้ยิงซ้ำ
⚠️ **ได้ \`skipped: true\` · \`processed: 0\` ไม่ใช่ข้อผิดพลาด** — มี worker ได้ครั้งละตัวต่อ process
(\`inFlight\` ใน \`components/server/grade-queue.ts\`) ชนกับ worker เบื้องหลังที่กำลังทำงานอยู่ ให้ยิงซ้ำอีกรอบ
⚠️ **ผลที่ AI เสนอถูกเก็บคู่ขนานใน \`submissions.ai_scores.aiProposed\`** ไม่แตะดาวที่นักเรียนเห็นไปแล้ว
และไม่แตะคะแนนที่ครูยืนยัน
`,
      parameters: [
        {
          name: 'x-worker-secret',
          in: 'header',
          required: false,
          description: 'ทางเข้าของ worker ที่ไม่ใช่ครู — ต้องตรงกับ `GRADE_WORKER_SECRET` (**ห้ามใส่ค่าจริงไว้ในเอกสารนี้**)',
          schema: { type: 'string' },
        },
      ],
      requestBody: jsonBody(obj({ max: int('ตรวจไม่เกินกี่งานในรอบนี้ (≤20)', { minimum: 1, maximum: 20 }) }), { max: 5 }, {
        required: false,
      }),
      responses: {
        ...ok(
          'รอบนี้ทำอะไรไปบ้าง',
          obj({
            ok: bool('สำเร็จ'),
            reclaimed: int('ดึงงานค้างกลับเข้าคิวกี่งาน'),
            processed: int('ตรวจไปกี่งานรอบนี้'),
            skipped: bool('`true` = ชน worker อื่นที่กำลังทำงาน — ไม่ใช่ error ให้ยิงซ้ำ'),
            queue: obj({
              pending: int('รอคิว'),
              running: int('กำลังตรวจ'),
              done: int('เสร็จแล้ว'),
              failed: int('ไม่สำเร็จ'),
            }),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
  },
}

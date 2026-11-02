/**
 * เส้นของผู้เรียน ช่วงต้นคาบถึงกลางคาบ — เข้าห้อง · เลือกวิธีเรียน · เล่นภารกิจ
 *
 * ที่มาของสัญญาแต่ละเส้น: อ่าน `const ...Schema = z.object({...})` กับทุกจุดที่เรียก
 * `errorResponse()` ในไฟล์ route ตัวจริง แล้วเทียบกับ `docs/api.md` หัวข้อ 2.1-2.3
 */
import {
  ANYONE,
  DEMO,
  NO_BODY,
  STUDENT_ONLY,
  UNAUTHORIZED,
  arr,
  bool,
  failures,
  int,
  jsonBody,
  map,
  nullable,
  num,
  obj,
  ok,
  op,
  opaque,
  pathParam,
  query,
  str,
} from './builders'
import type { PathItemObject } from './types'

const JOIN = 'เข้าห้องเรียน'
const BEFORE = 'ก่อนเรียน และการเลือกวิธีเรียน'
const PLAY = 'เล่นภารกิจ'

const missionParam = pathParam('id', 'รหัสภารกิจ `m1`-`m4`', DEMO.missionId)

export const studentPaths: Record<string, PathItemObject> = {
  '/api/profile/account': {
    patch: op({
      id: 'studentAccountPatch',
      summary: 'เปลี่ยนชื่อเล่นหรือ PIN ของตัวเอง',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: `ชื่อเล่นใหม่ต้องยาว 1-40 ตัวอักษร ผ่านการตรวจแบบเดียวกับตอนเข้าห้อง และไม่ซ้ำในห้องเดียวกัน
การเปลี่ยนชื่อไม่เปลี่ยน PIN หรือ session เดิม; การเปลี่ยน PIN ต้องส่ง PIN ปัจจุบัน`,
      requestBody: jsonBody({
        oneOf: [
          obj({ nickname: str('ชื่อเล่นใหม่ 1-40 ตัวอักษร', { minLength: 1, maxLength: 40 }) }, { required: ['nickname'] }),
          obj({ currentPin: str('PIN ปัจจุบัน', { pattern: '^[0-9]{4}$' }), newPin: str('PIN ใหม่ 4 หลัก', { pattern: '^[0-9]{4}$' }) }, { required: ['currentPin', 'newPin'] }),
        ],
      }, { nickname: 'ชื่อใหม่' }),
      responses: {
        ...ok('บันทึกบัญชีนักเรียนแล้ว', obj({ ok: bool('สำเร็จ'), nickname: str('ชื่อเล่นปัจจุบัน'), message: str('ข้อความสำหรับแสดงผล') })),
        ...failures([400, ['bad-request']], [401, ['unauthorized', 'invalid-pin']], [409, ['nickname-taken']], [422, ['content-flagged']]),
      },
    }),
  },
  '/api/join': {
    post: op({
      id: 'join',
      summary: 'เข้าห้องเรียนครั้งแรก (ออกคุกกี้นักเรียน)',
      tags: [JOIN],
      security: ANYONE,
      description: `
เส้นเดียวในระบบที่ **สร้างแถวนักเรียนใหม่ได้** จึงมีเกราะ 3 ชั้นซ้อนกัน (ถอดชั้นใดชั้นหนึ่งออก อีกสองชั้นเอาไม่อยู่)

| ชั้น | กติกา | ชนแล้วได้ |
|---|---|---|
| 1 ตัวนับต่อ (รหัสห้อง + ชื่อเล่น) | 5 ครั้ง/10 นาที · **ไม่ล้างตัวนับเมื่อเข้าสำเร็จ** | \`429\` \`too-many-attempts\` |
| 2 เพดานคนต่อห้อง | ค่าเริ่มต้น 60 คน ปรับด้วย env \`CLASSROOM_MAX_STUDENTS\` | \`409\` \`room-full\` |
| 3 ชื่อซ้ำในห้อง | **ไม่เติมเลขท้ายให้** ให้เด็กเปลี่ยนชื่อเอง หรือไปโหมด "เคยเข้าห้องแล้ว" | \`409\` \`nickname-taken\` |

\`renamed\` เป็น \`false\` เสมอแล้ว (คงช่องไว้ให้หน้าจอเดิมไม่พัง) · \`seatsLeft\` = ที่ว่างหลังรับคนนี้เข้าไป
(\`null\` = ห้องเก่าที่มีคนล้นเพดานอยู่ก่อนแล้ว ซึ่งคุมด้วยอัตรารับคนใหม่ 45 คน/10 นาทีแทน)

**กด Execute ได้เลย** ตัวอย่างใช้ห้องสาธิต \`QUEST9\` (ต้องรัน \`npx tsx scripts/seed-demo.ts\` ก่อน)

⚠️ **ชื่อเล่นหนึ่งชื่อใช้ได้ครั้งเดียว** กดรอบสองจะได้ \`409\` \`nickname-taken\` ตามกติกาชั้นที่ 3
รอบต่อไปให้เปลี่ยนเลขท้ายชื่อ (\`ผู้มาเยือน2\` \`ผู้มาเยือน3\` …) หรือกลับเข้าห้องด้วย
\`POST /api/join/resume\` ด้วยชื่อเดิม + PIN เดิม ซึ่ง**กดซ้ำได้ไม่จำกัด**
`,
      requestBody: jsonBody(
        obj(
          {
            roomCode: str('รหัสห้อง 6 ตัว ที่ครูฉายบนจอ', { examples: [DEMO.roomCode] }),
            nickname: str('ชื่อเล่น 1-40 ตัวอักษร ห้ามซ้ำกับคนในห้อง', { examples: [DEMO.newNickname] }),
            pin: str('รหัสของตัวเอง ตัวเลข 4 หลักเป๊ะ', { pattern: '^[0-9]{4}$', examples: [DEMO.pin] }),
          },
          { required: ['roomCode', 'nickname', 'pin'] },
        ),
        { roomCode: DEMO.roomCode, nickname: DEMO.newNickname, pin: DEMO.pin },
      ),
      responses: {
        ...ok(
          'เข้าห้องได้ — ตั้งคุกกี้ `dbq_student` (httpOnly อายุ 6 ชั่วโมง) มาใน `set-cookie`',
          obj({
            ok: bool('เข้าห้องสำเร็จ'),
            nickname: str('ชื่อเล่นที่บันทึกจริง'),
            renamed: bool('`false` เสมอ — ระบบไม่เปลี่ยนชื่อให้แล้ว'),
            roomCode: str('รหัสห้อง'),
            seatsLeft: nullable(int('ที่ว่างที่เหลือหลังรับคนนี้')),
            capacity: int('เพดานคนของห้องนี้'),
          }),
          { ok: true, nickname: DEMO.newNickname, renamed: false, roomCode: DEMO.roomCode, seatsLeft: 39, capacity: 60 },
        ),
        ...failures(
          [400, ['bad-request', 'bad-pin']],
          [404, ['room-not-found'], 'ข้อความไม่บอกว่ารหัสห้องมีอยู่จริงไหม กันการไล่เดารหัสห้อง'],
          [409, ['nickname-taken', 'room-full']],
          [422, ['content-flagged'], 'ชื่อเล่นก็เป็นข้อความที่เด็กพิมพ์เอง จึงผ่านด่านกรองคำ (E-11)'],
          [429, ['too-many-attempts', 'room-too-busy'], 'มี `resetAt` บอกว่าลองใหม่ได้เมื่อไร'],
        ),
      },
    }),
  },

  '/api/join/resume': {
    post: op({
      id: 'joinResume',
      summary: 'กลับเข้าห้องด้วยชื่อเล่น + รหัสเดิม (ย้ายเครื่อง)',
      tags: [JOIN],
      security: ANYONE,
      description: `
**ไม่สร้างแถวใหม่** ตรวจรหัสกับ hash ของแถวเดิมแล้วออกคุกกี้ใบใหม่ · ใช้ตอนเด็กเปลี่ยนเครื่องหรือคุกกี้หาย

⚠️ ข้อความของ \`401\` **เหมือนกันทั้งกรณี "ไม่มีชื่อนี้" และ "รหัสผิด"** ไม่งั้นคนเดาจะรู้ว่าเดาชื่อถูกแล้ว
⚠️ นับจำนวนครั้งตอน "พยายาม" **ก่อน** ตรวจรหัส จึงเลี่ยงด้วยการสลับส่งรหัสถูก/ผิดไม่ได้ · เข้าสำเร็จแล้วล้างตัวนับ (เฉพาะเส้นนี้)
⚠️ เส้นนี้ **ไม่ผ่านด่านเพดานคนต่อห้อง** — ห้องที่คนเต็มแล้วจึงไม่มีทางล็อกคนของตัวเองออก

**กด Execute ได้เลย และกดซ้ำได้ไม่จำกัด** ตัวอย่างเป็นหุ่น \`มิ้นท์\` ในห้องสาธิต (PIN ของหุ่นทุกตัวคือ \`1234\`)
**นี่คือทางที่เร็วที่สุดในการได้คุกกี้นักเรียนสำหรับลองยิงเส้นอื่นในหน้านี้**

⚠️ หุ่นตัวนี้ตั้งค่าร้านและส่งด่านบอสไปแล้ว การยิง \`POST /api/profile\` หรือ \`POST /api/ceo\` ในนามของมันจะได้
\`409\` ซึ่งถูกต้องตามกติกา · อยากเดินเส้นทาง "ตั้งค่าร้าน → ส่งด่านบอส" ให้ครบ ต้องเป็นคนใหม่จาก \`POST /api/join\`
`,
      requestBody: jsonBody(
        obj(
          {
            roomCode: str('รหัสห้องเดิม', { examples: [DEMO.roomCode] }),
            nickname: str('ชื่อเล่นเดิมในห้องนั้น', { examples: [DEMO.botNickname] }),
            pin: str('รหัส 4 หลักเดิม', { examples: [DEMO.pin] }),
          },
          { required: ['roomCode', 'nickname', 'pin'] },
        ),
        { roomCode: DEMO.roomCode, nickname: DEMO.botNickname, pin: DEMO.pin },
      ),
      responses: {
        ...ok(
          'รหัสถูก — ออกคุกกี้ `dbq_student` ใบใหม่',
          obj({ ok: bool('สำเร็จ'), nickname: str('ชื่อเล่น'), roomCode: str('รหัสห้อง') }),
          { ok: true, nickname: DEMO.botNickname, roomCode: DEMO.roomCode },
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['invalid-credentials'], 'มี `remaining` บอกจำนวนครั้งที่เหลือ'],
          [404, ['room-not-found']],
          [429, ['too-many-attempts']],
        ),
      },
    }),
  },

  '/api/student/logout': {
    post: op({
      id: 'studentLogout',
      summary: 'นักเรียนออกจากระบบ (ลบคุกกี้นักเรียน)',
      tags: [JOIN],
      security: STUDENT_ONLY,
      description: `
ลบคุกกี้ \`dbq_student\` ทิ้ง — ใช้กับปุ่ม "ออกจากระบบ" ในแผ่นบัญชีของฉันบนหน้า \`/profile\`

· session เป็น token ในคุกกี้ล้วน ไม่มีแถว session ในฐานข้อมูลให้ลบ · **ข้อมูลความคืบหน้าไม่หาย**
· กลับมาเล่นต่อได้ด้วย \`POST /api/join/resume\` (รหัสห้อง + ชื่อเล่น + PIN เดิม)
⚠️ **ไม่มีคุกกี้มาด้วยได้ \`401\` ไม่ใช่ \`200\`** — เหมือนเส้นอื่นที่ต้องมี session
⚠️ ลบคุกกี้ด้วยออปชันชุดเดียวกับตอนตั้ง (\`path\`/\`secure\`/\`sameSite\`) ไม่งั้นเบราว์เซอร์ถือว่าคนละใบ
· ไม่รับพารามิเตอร์และไม่อ่าน body
`,
      responses: {
        ...ok('ออกจากระบบแล้ว — คุกกี้ถูกลบใน `set-cookie`', obj({ ok: bool('สำเร็จ') }), {
          ok: true,
        }),
        ...failures([401, ['unauthorized'], 'ไม่มีคุกกี้นักเรียนมาด้วย']),
      },
    }),
  },

  '/api/health': {
    get: op({
      id: 'health',
      summary: 'ตรวจว่าเซิร์ฟเวอร์ตอบอยู่ (ผ่านประตูเปิดตัวได้แม้ยังปิด)',
      tags: [JOIN],
      security: ANYONE,
      description: 'ไม่แตะฐานข้อมูล ใช้ให้ตัวเฝ้าระวังยิงเช็ก ประตูเปิดตัว (`proxy.ts`) ปล่อยผ่านเส้นนี้เส้นเดียวตอนที่ API อื่นตอบ 503',
      responses: {
        ...ok('เซิร์ฟเวอร์ปกติ', obj({ ok: bool('true เสมอ') })),
      },
    }),
  },

  '/api/me': {
    get: op({
      id: 'me',
      summary: 'ตัวฉัน — ห้อง โปรไฟล์ ความก้าวหน้า',
      tags: [JOIN],
      security: STUDENT_ONLY,
      description: `
**ไม่รับพารามิเตอร์ใด ๆ** ทุกอย่างมาจากคุกกี้ · ต่อ \`?studentId=\` ท้าย URL แล้วไม่มีผล
และ**ไม่มีข้อมูลของเพื่อนคนไหนหลุดออกมาเลย**
`,
      responses: {
        ...ok(
          'ข้อมูลของเจ้าของคุกกี้',
          obj({
            student: obj({
              id: uuidRef('รหัสนักเรียนของตัวเอง'),
              nickname: str('ชื่อเล่น'),
              joinedAt: str('เวลาที่เข้าห้อง'),
            }),
            classroom: nullable(obj({ id: uuidRef('รหัสห้อง'), roomCode: str('รหัสห้อง 6 ตัว'), status: str('open | locked | closed') })),
            profile: nullable(opaque('โปรไฟล์ร้านของตัวเอง')),
            progress: arr(opaque('ความก้าวหน้าต่อสถานี'), 'ความก้าวหน้าต่อสถานี'),
            missions: arr(opaque('ความก้าวหน้าต่อภารกิจ'), 'ความก้าวหน้าต่อภารกิจ'),
            shop: obj({
              stage: int('ด่านที่อยู่ตอนนี้'),
              stagesCleared: int('ผ่านมาแล้วกี่ด่าน'),
              stagesTotal: int('ทั้งหมดกี่ด่าน'),
              label: str('ป้ายภาษาไทย เช่น "ร้านโตมาแล้ว 0 จาก 5 ด่าน"'),
              percent: int('คิดเป็นกี่เปอร์เซ็นต์'),
            }),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
  },

  '/api/session': {
    get: op({
      id: 'studentSession',
      summary: 'ช่วงของคาบและนาฬิกา (ฝั่งนักเรียน อ่านอย่างเดียว)',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: `
**เซิร์ฟเวอร์ส่ง "วินาทีที่เหลือ" มาให้ ไม่ให้เบราว์เซอร์คิดเองจากนาฬิกาเครื่องตัวเอง**
· **ห้ามจับเวลารายข้อ** (สเปกข้อ 2.7) นาฬิกามีเฉพาะระดับช่วงกิจกรรม
· \`restMode\` เป็นหน้าพัก **ไม่ได้ล็อกเครื่อง** เด็กกด "กลับไปทำต่อ" เองได้
· ยังไม่มีคาบเปิด → \`{ active: false, phase: null, restMode: false }\`
`,
      responses: {
        ...ok(
          'สถานะของคาบตอนนี้',
          obj({
            active: bool('ครูเปิดคาบอยู่ไหม'),
            phase: nullable(str('ช่วงของห้อง: wait | onboard | mission | boss | summary | reflect | end | home')),
            phaseLabel: str('ป้ายภาษาไทยของช่วง'),
            remainingSeconds: nullable(int('วินาทีที่เหลือของช่วงนี้')),
            paused: bool('ครูกดหยุดนาฬิกาไว้'),
            showClock: bool('ให้โชว์นาฬิกาบนจอเด็กไหม'),
            warn: bool('ใกล้หมดเวลาแล้ว'),
            restMode: bool('หน้าพัก "ดูจอหน้าห้องนะ"'),
            restReason: nullable(str('เหตุผลของหน้าพัก')),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
  },

  '/api/pretest': {
    get: op({
      id: 'pretestGet',
      summary: 'ผลแบบทดสอบก่อนเรียนของตัวเอง',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: '`result` เป็น `null` ถ้ายังไม่เคยทำ · `open`/`reason` บอกว่าครูเปิดให้ทำอยู่ไหม',
      responses: {
        ...ok(
          'ผลของตัวเอง (ถ้ามี)',
          obj({
            result: nullable(opaque('คะแนนและหัวข้อที่ควรเน้น')),
            open: bool('ครูกดเปิดแบบทดสอบอยู่ไหม'),
            reason: nullable(str('ถ้ายังไม่เปิด บอกว่ารออะไร')),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'pretestSubmit',
      summary: 'ส่งคำตอบแบบทดสอบก่อนเรียน',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: `
**ตรวจที่เซิร์ฟเวอร์เท่านั้น** ผ่าน \`core/quiz.ts\` เฉลยอยู่ใน \`content/quiz-answers.json\`

⚠️ **ห้ามคืน \`wrongIds\` หรือเฉลย** คืนแค่คะแนนรวมกับหัวข้อที่ควรเน้น ไม่งั้นย้อนรู้เฉลยได้
· รหัสข้อที่ไม่มีอยู่จริงถูกตัดทิ้งเงียบ ๆ · ผลที่ได้เป็น **"ข้อเสนอ"** จนกว่าจะกดเลือกที่ \`POST /api/profile/choice\`
`,
      requestBody: jsonBody(
        obj({ answers: map(int('ลำดับตัวเลือกที่กด 0-3'), 'คู่ รหัสข้อ → ลำดับตัวเลือก') }, { required: ['answers'] }),
        { answers: { 'pre-1': 0, 'pre-2': 1, 'pre-3': 2, 'pre-4': 0 } },
      ),
      responses: {
        ...ok(
          'ตรวจแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            score: int('จำนวนข้อที่ถูก'),
            total: int('จำนวนข้อทั้งหมด'),
            suggestedLevel: int('ระดับตัวช่วยที่ระบบเสนอ 1-3'),
            levelReason: str('เหตุผลของข้อเสนอ เป็นภาษาที่เด็กอ่านได้'),
            weakObjectives: arr(str('รหัสจุดประสงค์'), 'หัวข้อที่ควรเน้น'),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [403, ['not-open'], 'ครูเป็นคนกดเปิด (`class_sessions.pretest_enabled`) ไม่ผูกกับช่วงของคาบ'],
          [409, ['already-done']],
        ),
      },
    }),
  },

  '/api/posttest': {
    get: op({
      id: 'posttestGet',
      summary: 'โจทย์/ผลแบบทดสอบหลังเรียน',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: '**ส่งตัวโจทย์มาเฉพาะตอนครูเปิดจริงและยังไม่เคยทำ** ตอนอื่นได้แต่สถานะ',
      responses: {
        ...ok(
          'สถานะ + โจทย์ (ถ้าเปิด)',
          obj({
            open: bool('ครูเปิดให้ทำอยู่ไหม'),
            reason: nullable(str('ถ้ายังไม่เปิด บอกว่ารออะไร')),
            done: bool('ทำไปแล้วหรือยัง'),
            score: nullable(int('คะแนนที่ได้')),
            total: nullable(int('จำนวนข้อ')),
            questions: arr(opaque('โจทย์ 1 ข้อ — **ไม่มี `answerIndex` ติดมา**'), 'โจทย์ทั้งชุด'),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'posttestSubmit',
      summary: 'ส่งคำตอบแบบทดสอบหลังเรียน',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: 'คืน `preScore` กับ `gain` มาด้วย เพื่อให้เด็กเห็นพัฒนาการของตัวเอง ไม่ใช่เทียบกับเพื่อน',
      requestBody: jsonBody(
        obj({ answers: map(int('ลำดับตัวเลือก 0-3'), 'คู่ รหัสข้อ → ลำดับตัวเลือก') }, { required: ['answers'] }),
        { answers: { 'post-1': 0, 'post-2': 1, 'post-3': 2 } },
      ),
      responses: {
        ...ok(
          'ตรวจแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            score: int('คะแนนหลังเรียน'),
            total: int('จำนวนข้อ'),
            preScore: nullable(int('คะแนนก่อนเรียนของคนเดียวกัน')),
            gain: nullable(num('ส่วนต่างที่พัฒนาขึ้น')),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [403, ['not-open']], [409, ['already-done']]),
      },
    }),
  },

  '/api/check': {
    get: op({
      id: 'checkGet',
      summary: 'ชุดเช็กความเข้าใจ 4 ข้อ',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: '⚠️ โจทย์ที่ส่งออกไป **ไม่มี `answerIndex` และไม่มี `objectiveId`** ติดมา',
      responses: {
        ...ok(
          'ชุดโจทย์ของคนนี้',
          obj({
            setId: str('รหัสชุด'),
            questions: arr(opaque('โจทย์ 1 ข้อ'), 'โจทย์ทั้งชุด'),
            done: bool('ทำไปแล้วหรือยัง'),
            score: nullable(int('คะแนนที่ได้')),
            total: nullable(int('จำนวนข้อ')),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'checkSubmit',
      summary: 'ส่งคำตอบเช็กความเข้าใจ (+ ความมั่นใจรายข้อ)',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: `
\`confidence\` (1-3) ไม่มีผลกับคะแนน แต่เอาไปทำ **ธง calibration** บนแผงครู
(มั่นใจสูงแต่ผิด = "ควรคุย" · มั่นใจต่ำแต่ถูก = "ควรชม") ซึ่ง**ไม่เคยแสดงเป็นคำตัดสินให้ผู้เรียนเห็น**

ตอบถูกข้อที่วัดจุดประสงค์ของภารกิจไหน จะ**ข้ามภารกิจนั้นได้แบบเต็ม 3 ดาว** (ดู \`POST /api/mission/{id}/skip\`)
`,
      requestBody: jsonBody(
        obj(
          {
            answers: map(int('ลำดับตัวเลือก 0-5'), 'คู่ รหัสข้อ → ลำดับตัวเลือก'),
            confidence: map(int('ความมั่นใจ 1-3'), 'คู่ รหัสข้อ → ความมั่นใจ (ไม่บังคับ)'),
            setId: str('รหัสชุด (ไม่บังคับ)'),
          },
          { required: ['answers'] },
        ),
        {
          setId: DEMO.checkSetId,
          answers: { 'chk-a1': 0, 'chk-a2': 1, 'chk-a3': 2, 'chk-a4': 0 },
          confidence: { 'chk-a1': 3, 'chk-a2': 2, 'chk-a3': 1, 'chk-a4': 2 },
        },
      ),
      responses: {
        ...ok(
          'ตรวจแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            score: int('จำนวนข้อที่ถูก'),
            total: int('จำนวนข้อ'),
            suggestedLevel: int('ระดับตัวช่วยที่เสนอ'),
            levelReason: str('เหตุผล'),
            weakObjectives: arr(str('รหัสจุดประสงค์'), 'หัวข้อที่ควรเน้น'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']]),
      },
    }),
  },

  '/api/profile/preferences': {
    post: op({
      id: 'profilePreferences',
      summary: 'ตอบแบบสำรวจวิธีเรียนที่ถนัด (ได้ข้อเสนอ ไม่ใช่การตั้งค่า)',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: '**ผลเป็น "ข้อเสนอ" ทั้งหมด** ยังไม่ถูกใช้จริงจนกว่าจะกดเลือกที่ `POST /api/profile/choice`',
      requestBody: jsonBody(
        obj({ prefAnswers: map(str('รหัสตัวเลือก'), 'คู่ `pref-N` → `pref-N-x`') }, { required: ['prefAnswers'] }),
        { prefAnswers: { 'pref-1': 'pref-1-a', 'pref-2': 'pref-2-c' } },
      ),
      responses: {
        ...ok(
          'ข้อเสนอของระบบ',
          obj({
            suggestedRoute: str('ช่องทางที่เสนอ: clip | card | game | buddy'),
            routeScores: map(num('คะแนนของช่องทางนั้น'), 'คะแนนรายช่องทาง ให้เด็กเห็นว่าเสนอเพราะอะไร'),
            routeReason: str('เหตุผลของช่องทาง'),
            suggestedLevel: int('ระดับตัวช่วยที่เสนอ 1-3'),
            levelReason: str('เหตุผลของระดับ'),
            weakObjectives: arr(str('รหัสจุดประสงค์'), 'หัวข้อที่ควรเน้น'),
            talentId: nullable(str('รหัส "ของที่ถนัด" ที่เอาไปใช้ตกแต่งเนื้อเรื่อง')),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']]),
      },
    }),
  },

  '/api/profile/choice': {
    post: op({
      id: 'profileChoice',
      summary: 'นักเรียนกดเลือกช่องทาง/ระดับ/เป้าหมายของตัวเอง',
      tags: [BEFORE],
      security: STUDENT_ONLY,
      description: `
⚠️ **ห้ามปฏิเสธช่องทางหรือระดับที่นักเรียนเลือก** เลือกได้ครบทั้ง 4 ช่องทางและ 3 ระดับเสมอ
ระบบแค่บันทึก \`chosenBy = student\` ไว้เป็นหลักฐานให้ครูเห็น

ข้อยกเว้นเดียวคือเป้าหมาย: **ยกขึ้นได้ตลอดคาบ แต่ลดไม่ได้** (\`goalPolicy.canLowerDuringLesson = false\`)
กดลดเป้าได้ \`200\` พร้อม \`goalRejectedNote\` อธิบาย **ไม่ใช่ error** — ปฏิเสธการกระทำ แต่ไม่ปฏิเสธตัวผู้เรียน

ส่งช่องไหนมาก็ได้ ไม่ต้องครบทุกช่อง
`,
      requestBody: jsonBody(
        obj({
          route: str('ช่องทางที่เลือก', { enum: ['clip', 'card', 'game', 'buddy'] }),
          level: int('ระดับตัวช่วย 1-3', { enum: [1, 2, 3] }),
          goalId: str('รหัสเป้าหมาย — `goal-basic` · `goal-good` · `goal-challenge` (`content/self-profile.json` → `goalOptions`)'),
          ownGoalText: str('เป้าที่พิมพ์เอง (≤300) เฉพาะตัวเลือกที่เปิดให้พิมพ์'),
          finish: bool('ปิดขั้นตอนเลือกแล้ว'),
        }),
        { route: 'game', level: 2, goalId: DEMO.goalId },
      ),
      responses: {
        ...ok(
          'บันทึกแล้ว',
          obj({
            accepted: bool('`true` เสมอ — เส้นนี้ไม่ปฏิเสธผู้เรียน'),
            route: nullable(str('ช่องทางที่ใช้จริงตอนนี้')),
            routeChosenBy: nullable(str('`student` | `system` | `teacher`')),
            level: nullable(int('ระดับตัวช่วยที่ใช้จริง')),
            goalId: nullable(str('รหัสเป้าหมาย')),
            goalStars: nullable(int('เป้าหมายกี่ดาว')),
            goalRejectedNote: nullable(str('ถ้ากดลดเป้า — อธิบายว่าทำไมยังเป็นค่าเดิม')),
          }),
        ),
        ...failures([400, ['bad-request', 'content-flagged']], [401, ['unauthorized']], [404, ['goal-not-found']]),
      },
    }),
  },

  '/api/profile': {
    get: op({
      id: 'profileGet',
      summary: 'โปรไฟล์ร้านของตัวเอง',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: '`locked: true` = เริ่มเล่นแล้ว แก้ข้อมูลร้านไม่ได้อีก (ครูปลดล็อกให้ได้)',
      responses: {
        ...ok('โปรไฟล์ร้าน', obj({ profile: nullable(opaque('ข้อมูลร้าน')), locked: bool('ล็อกแล้วหรือยัง') })),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'profileSave',
      summary: 'ตั้งค่าร้านของตัวเอง (จุดเดียวที่จดชื่อโดเมน)',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
**โปรไฟล์ถูกล็อกทันทีที่เริ่มเล่น** (มี attempt ของภารกิจใด หรือยื่นสถานี B แล้ว)
จึงต้องยิงเส้นนี้ **ก่อน** \`/api/mission/{id}/check\` และ \`/api/station-b/submit\` ไม่งั้นได้ \`409\` \`profile-locked\`
เหตุผล: สถานี B ตัดสินจาก \`isRegisteredCompany\` และ \`audience\` ถ้าแก้ได้เรื่อย ๆ เด็กจะยื่นไม่ผ่านแล้วย้อนมาแก้ให้ผ่าน

**การจดชื่อโดเมนเกิดที่นี่ที่เดียว** (\`POST /api/domain/check\` ตรวจอย่างเดียว ไม่จดให้)
ชื่อซ้ำกับเพื่อนในห้อง = \`409\` \`domain-taken\` (ใครจดก่อนได้ก่อน)
· ตั้งค่าเสร็จแล้วระบบ**ฝากงานแต่งเรื่องเฉพาะร้านเข้าคิวให้เอง** (\`storyQueued\`) เด็กไม่ต้องนั่งรอ
`,
      requestBody: jsonBody(
        obj(
          {
            shopName: str('ชื่อร้าน 1-60 ตัวอักษร', { examples: [DEMO.shopName] }),
            businessTypeId: str('รหัสประเภทธุรกิจจาก `content/`'),
            domainName: str('ชื่อเว็บที่อยากจด 1-60 ตัวอักษร', { examples: [DEMO.domainName] }),
            isRegisteredCompany: bool('จดทะเบียนนิติบุคคลแล้วหรือยัง — สถานี B ใช้ตัดสิน'),
            audience: str('ลูกค้าหลักอยู่ไหน', { enum: ['thai', 'international'] }),
          },
          { required: ['shopName', 'businessTypeId', 'domainName', 'isRegisteredCompany', 'audience'] },
        ),
        {
          shopName: DEMO.shopName,
          businessTypeId: DEMO.businessTypeId,
          domainName: DEMO.domainName,
          isRegisteredCompany: false,
          audience: 'thai',
        },
      ),
      responses: {
        ...ok(
          'บันทึกแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            locked: bool('`false` — เพิ่งบันทึก ยังแก้ได้จนเริ่มเล่น'),
            storyQueued: bool('ฝากงานแต่งเรื่องเข้าคิวได้ไหม (ฝากไม่ได้ก็เล่นต่อได้ ไม่ใช่ error)'),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [409, ['profile-locked', 'domain-taken'], 'มี `takenByNickname` บอกว่าเพื่อนคนไหนจดไปก่อน'],
          [422, ['content-flagged']],
        ),
      },
    }),
  },

  '/api/hint': {
    post: op({
      id: 'hint',
      summary: 'ขอคำใบ้ทีละใบ',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
**ส่งทีละใบ ไม่ส่งทั้งชุดตั้งแต่แรก** ไม่งั้นเปิด DevTools อ่านครบโดยไม่เสียการนับ
ภารกิจละ 3 ใบ · \`station-b\` ตันที่ \`hintsUsed = 2\`

\`source\` เป็น \`ai\` **หรือ** \`fallback\` ก็ถูกทั้งคู่ — ระบบต้องเดินได้แม้ AI ล่ม (ดูหัวข้อ 3.2 ของ \`docs/api.md\`)
ตัวช่วยของสถานี B เป็น \`fallback\`/\`not-requested\` เสมอ เพราะเป็นการเปิดป้ายเงื่อนไขจากไฟล์เนื้อหา ไม่ได้เรียกโมเดล
`,
      requestBody: jsonBody(
        obj({ missionId: str('`m1`-`m4` หรือ `station-b`', { examples: [DEMO.missionId] }) }, { required: ['missionId'] }),
        { missionId: DEMO.missionId },
      ),
      responses: {
        ...ok(
          'ได้คำใบ้ใบถัดไป',
          obj({
            scope: str('`mission` หรือ `station-b`'),
            hint: str('ข้อความคำใบ้ (ไม่มีในกรณี station-b)'),
            hintsUsed: int('ใช้ไปกี่ใบแล้ว'),
            total: int('มีทั้งหมดกี่ใบ'),
            exhausted: bool('หมดใบแล้ว'),
            source: str('`ai` หรือ `fallback`'),
            provider: str('ชื่อผู้ให้บริการ หรือ `rules`'),
            fallbackReason: nullable(str('เหตุผลที่ตกไปทางกฎ')),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['mission-not-found']]),
      },
    }),
  },

  '/api/help': {
    post: op({
      id: 'help',
      summary: 'ปุ่ม "ขอให้ครูมาช่วย" (และยกเลิก)',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
ผู้เรียนกดเองเมื่อรู้สึกติด ไม่ต้องรอให้เกณฑ์เวลา 60/90/150 วินาทีจับได้ก่อน
ชื่อขึ้นธงแดงบนแผงครูทันที (\`askedForHelp: true\` ใน \`GET /api/teacher/board\`) · ส่ง \`cancel: true\` เพื่อลดธงลง

⚠️ **การขอครูไม่ใช่ช่องทางการเรียนที่ 5** \`channel\` ยังเป็น \`clip|card|game|buddy\` เท่านั้น
route จึงไม่แตะคอลัมน์ \`channel\`/\`learning_route\` เลย · \`missionId\` ไม่ส่งก็ได้ เซิร์ฟเวอร์เดาจากภารกิจที่ขยับล่าสุดให้เอง
`,
      requestBody: jsonBody(
        obj({
          missionId: str('ภารกิจที่ติด (ไม่ส่งก็ได้)', { examples: [DEMO.missionId] }),
          cancel: bool('`true` = ยกเลิกการขอ'),
        }),
        { missionId: DEMO.missionId },
      ),
      responses: {
        ...ok(
          'บันทึกแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            askedForHelp: bool('สถานะธงตอนนี้'),
            missionId: nullable(str('ภารกิจที่ผูกกับธงนี้')),
            message: str('ข้อความบอกเด็กว่าครูกำลังมา'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']]),
      },
    }),
  },

  '/api/dome': {
    post: op({
      id: 'dome',
      summary: 'คุยกับโดม (ผู้ช่วยในเกม)',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: 'ข้อความของเด็กผ่านด่านกรองคำก่อนทุกครั้ง · `quickReplies` คือปุ่มคำถามที่กดต่อได้ ไม่ต้องพิมพ์เอง',
      requestBody: jsonBody(
        obj({
          message: str('ข้อความ ≤500 ตัวอักษร'),
          quickReplyId: nullable(str('รหัสปุ่มที่กด (≤40)')),
        }),
        { message: 'ชื่อเว็บควรตั้งยังไงให้คนจำได้' },
      ),
      responses: {
        ...ok(
          'คำตอบของโดม',
          obj({
            reply: str('ข้อความตอบ'),
            source: str('`ai` หรือ `fallback`'),
            provider: str('ผู้ให้บริการ หรือ `rules`'),
            quickReplies: arr(opaque('ปุ่มคำถามถัดไป'), 'ปุ่มที่กดต่อได้'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [422, ['content-flagged']]),
      },
    }),
  },

  '/api/presence': {
    post: op({
      id: 'presence',
      summary: 'จุดเต้นของหัวใจ — บอกว่ายังนั่งอยู่',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
เขียน \`students.last_seen_at\` ให้เป็นปัจจุบัน · หน้าเว็บยิงทุก 30 วินาทีจากทุกหน้า

⚠️ **ถ้าไม่มีใครเขียนคอลัมน์นี้ จะไม่มีใครเข้าเกณฑ์เป็นคู่หูได้เลยสักคน โดยไม่มี error ให้เห็น** (บั๊กเงียบที่ T57 ฝากไว้)
⚠️ **เบาที่สุดในระบบโดยตั้งใจ** — ทั้งห้องยิงพร้อมกัน จึงมีแค่ \`UPDATE\` แถวเดียว ไม่อ่านโปรไฟล์ ไม่เขียน event log
⚠️ **คืนแค่ \`{ ok: true }\`** ไม่คืนข้อมูลของใครเลย กันไม่ให้กลายเป็นช่องส่องเพื่อน
⚠️ \`401\` คือสัญญาณให้หน้าจอ **"หยุดเต้นถาวร"** (หน้า \`/join\` \`/teacher\` จะได้ไม่ยิงเปล่าทุก 30 วินาที)
`,
      requestBody: jsonBody(obj({ screen: str('หน้าที่เปิดอยู่ ≤64 ตัวอักษร เช่น `/mission/m1`') }), {
        screen: '/mission/m1',
      }),
      responses: {
        ...ok('บันทึกแล้ว', obj({ ok: bool('`true` เท่านั้น') }), { ok: true }),
        ...failures([400, ['bad-request']], [401, ['unauthorized']]),
      },
    }),
  },

  '/api/domain/check': {
    post: op({
      id: 'domainCheck',
      summary: 'ปุ่ม "ชื่อนี้ว่างไหม" (ตรวจอย่างเดียว ไม่จดให้)',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
ตรวจ 4 ชั้นตามลำดับ (ลำดับสำคัญ — \`components/server/domain-registry.ts\`)

1. ตัด URL ที่ก๊อปมาวางให้เหลือชื่อจริง แล้วบอกใน \`removed\` ว่าตัดอะไรไป
2. ชื่อต้องห้าม — แบรนด์คนอื่น · ชื่อในแบบฝึก · คำสงวนทางเทคนิค (\`status: "reserved"\`)
3. ถูกจดไปแล้วในโลกของเกม (\`status: "taken-world"\`)
4. เพื่อนในห้องเดียวกันจดไปก่อน (\`status: "taken-classroom"\` + \`takenByNickname\`)

⚠️ **ไม่จดให้ และไม่แก้ชื่อของเด็ก** การจดจริงเกิดที่ \`POST /api/profile\`
⚠️ **ชนแล้วต้องมี \`suggestions\` เสมอ** · ยังไม่พิมพ์ชื่อได้ \`200\` + \`status: "empty"\` **ไม่ใช่ \`400\`**
⚠️ **คืนแค่ชื่อเล่นของเพื่อนที่จดไปก่อน ไม่คืนดาวหรือคะแนนของใคร**
`,
      requestBody: jsonBody(obj({ name: str('ชื่อที่อยากตรวจ ≤200 — ใส่ URL ทั้งก้อนมาก็ได้') }, { required: ['name'] }), {
        name: 'https://www.minthkanom.com/',
      }),
      responses: {
        ...ok(
          'ผลการตรวจ',
          obj({
            ok: bool('ตรวจสำเร็จ (ไม่ได้แปลว่าชื่อว่าง)'),
            input: str('ข้อความที่ส่งมาดิบ ๆ'),
            name: str('ชื่อจริงหลังตัด URL ออก'),
            removed: arr(str('สิ่งที่ตัดออก'), 'บอกให้เด็กรู้ว่าตัดอะไรไป'),
            rules: obj({
              results: arr(opaque('ผลของกฎ 1 ข้อ'), 'ผลรายกฎ'),
              score: int('ผ่านกี่กฎ'),
              allPassed: bool('ผ่านครบทุกกฎ'),
            }),
            takenByNickname: nullable(str('ชื่อเล่นของเพื่อนที่จดไปก่อน')),
            suggestions: arr(str('ชื่อที่แนะนำ'), 'ชนแล้วต้องมีตัวเลือกให้เสมอ'),
            available: bool('จดได้ไหม'),
            status: str('`empty` | `ok` | `reserved` | `taken-world` | `taken-classroom`'),
            message: str('ข้อความให้เด็กอ่าน'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [422, ['content-flagged']]),
      },
    }),
  },

  '/api/domain/rdap': {
    get: op({
      id: 'domainRdap',
      summary: 'ค้นชื่อโดเมนจริงจากระบบทะเบียน (RDAP) ของเกมลงมือทำ',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
ตรวจ 4 นามสกุลชุดเดียว: \`.com\` \`.shop\` \`.in.th\` \`.co.th\` — แยกจาก \`POST /api/domain/check\` (ตัวนั้นตรวจในโลกของเกม)

- \`registered\` = ถูกจดแล้ว (มี \`registeredAt\` / \`expiresAt\` ถ้ามี)
- \`not-found\` = "ไม่พบการจด" ⚠️ **ไม่ใช่ "ว่าง"** เพราะบางชื่อถูกสงวนไว้
- ตรวจจริงไม่ได้ (เกิน 4 วินาที registry ตอบผิดปกติ หรือนักเรียนค้นเกินโควตา) → ตอบจากรายชื่อสำรองที่ตรวจ RDAP ไว้แล้ว (\`content/known-domains.json\`) ด้วย \`source: "offline"\` เกมจึงไม่ค้าง

⚠️ **ส่งออกไปแค่ชื่อโดเมน** ไม่ส่งข้อมูลนักเรียน และไม่คืนข้อมูลส่วนตัวของเจ้าของโดเมนจริง
⚠️ แคชผลต่อชื่อ 10 นาที · ใช้ถึง 80% ของงบแล้วสลับไปรายชื่อสำรอง: 32 จาก 40 ครั้ง/นักเรียน/10 นาที · 48 จาก 60 คำขอ/registry/นาที · registry ตอบ 429 = พักเจ้านั้น 2 นาที
`,
      parameters: [
        query('name', 'ชื่อโดเมนส่วนหน้า (a-z ตัวเลข ขีดกลาง ยาว 1-63) — **บังคับ**', {
          required: true,
          schema: { type: 'string' },
          example: 'minthkanom',
        }),
      ],
      responses: {
        ...ok(
          'ผลรายนามสกุล',
          obj({
            ok: bool('ตรวจสำเร็จ'),
            name: str('ชื่อที่ตรวจ'),
            results: arr(opaque('1 แถว = 1 นามสกุล: `tld` `domain` `status` `label` `source`'), 'ผลครบ 4 นามสกุล'),
            sample: bool('มีผลที่ไม่ได้มาจาก RDAP สดอย่างน้อย 1 รายการ'),
            offline: bool('มีผลจากรายชื่อสำรองอย่างน้อย 1 รายการ'),
          }),
        ),
        ...failures([400, ['bad-name']], [401, ['unauthorized']]),
      },
    }),
  },

  '/api/story': {
    post: op({
      id: 'storyEnqueue',
      summary: 'ฝากงานแต่งเรื่องเฉพาะร้านเข้าคิว',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
**ไม่รับ body เลย** · **ฝากซ้ำไม่บวมคิว** (\`reused: true\`)
· ฝากไม่สำเร็จ**ไม่ใช่เรื่องที่ผู้เรียนต้องรับรู้** คืน \`200\` + \`reason\` แล้วเล่นต่อได้
`,
      requestBody: NO_BODY,
      responses: {
        ...ok(
          'ฝากแล้ว หรือฝากไม่ได้แต่เล่นต่อได้',
          obj({
            ok: bool('`true` ทั้งสองกรณี'),
            enqueued: bool('เข้าคิวได้ไหม'),
            reused: bool('ใช้ใบเดิมที่ค้างอยู่'),
            jobId: nullable(str('รหัสงานในคิว')),
            reason: nullable(str('ถ้าเข้าคิวไม่ได้ — เพราะอะไร')),
            message: nullable(str('ข้อความที่เด็กอ่านได้')),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    get: op({
      id: 'storyQueue',
      summary: 'ตัวนับคิวงานแต่งเรื่อง',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: '⚠️ **คืนแค่ตัวนับ ไม่มีเนื้อเรื่องและไม่มีรหัสนักเรียนของใคร**',
      responses: {
        ...ok(
          'จำนวนงานในคิวแต่ละสถานะ',
          obj({
            ok: bool('สำเร็จ'),
            queue: obj({
              pending: int('รอคิว'),
              running: int('กำลังแต่ง'),
              done: int('เสร็จแล้ว'),
              failed: int('ไม่สำเร็จ'),
            }),
          }),
        ),
        ...failures([401, ['unauthorized']], [503, ['queue-unavailable']]),
      },
    }),
  },

  '/api/mission/{id}/story': {
    get: op({
      id: 'missionStory',
      summary: 'บทเปิดของภารกิจ (เฉพาะร้านของตัวเอง ถ้าแต่งเสร็จแล้ว)',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
**สัญญาข้อเดียวที่ห้ามผิด: ต้องมีข้อความให้อ่านเสมอ ผู้เรียนห้ามนั่งรอ**

| สถานะ | ได้อะไร | \`source\` | \`personalized\` |
|---|---|---|---|
| AI แต่งเสร็จแล้ว | เรื่องเฉพาะร้านของตัวเอง | \`ai\` | \`true\` |
| ยังไม่เสร็จ / AI ใช้ไม่ได้ | ประโยคสำรองที่เติมชื่อร้านจริงแล้ว | \`fallback\` | \`false\` |
| ยังไม่ได้ตั้งค่าร้าน | บทเปิดกลางของภารกิจจากไฟล์เนื้อหา | \`lesson-content\` | \`false\` |

เส้นนี้เป็น **ตาข่ายรับ** — ไม่เคยฝากงานเลยก็ฝากให้ตรงนั้นแล้วคืนประโยคสำรองในคำขอเดียวกัน

⚠️ **ห้ามสลับข้อความระหว่างที่เด็กกำลังอ่าน** หน้าจอควรเรียกครั้งเดียวตอนเปิดภารกิจแล้วถือข้อความนั้นไว้
⚠️ **รูป error ของ \`404\` ไม่เหมือนที่อื่น** เส้นนี้คืน \`{ ok: false, code, message }\` ขณะที่ทั้งระบบใช้ \`{ error, message }\`
   (บั๊กเล็กที่รู้แล้ว — \`app/api/mission/[id]/story/route.ts:42\` · \`docs/api.md\` หัวข้อ 8.8)
`,
      parameters: [missionParam],
      responses: {
        ...ok(
          'มีข้อความให้อ่านเสมอ',
          obj({
            ok: bool('สำเร็จ'),
            missionId: str('รหัสภารกิจ'),
            storyId: nullable(str('รหัสเรื่องที่ใช้')),
            text: str('ข้อความที่เอาไปแสดงได้ตรง ๆ'),
            source: str('`ai` | `fallback` | `lesson-content`'),
            fallbackReason: nullable(str('เหตุผลที่ยังไม่ใช่ของ AI')),
            personalized: bool('เป็นเรื่องเฉพาะร้านของคนนี้ไหม'),
          }),
        ),
        ...failures([401, ['unauthorized']]),
        '404': {
          description:
            '**404 ไม่พบภารกิจ** — ⚠️ รูปไม่เหมือนเส้นอื่น: `{ ok: false, code: "not-found", message }` ไม่ใช่ `{ error, message }`',
          content: {
            'application/json': {
              schema: obj({ ok: bool('`false`'), code: str('`not-found`'), message: str('ข้อความ') }),
              example: { ok: false, code: 'not-found', message: 'ไม่พบภารกิจนี้' },
            },
          },
        },
      },
    }),
  },

  '/api/mission/{id}/check': {
    post: op({
      id: 'missionCheck',
      summary: 'ตอบข้อวัดความเข้าใจของภารกิจ',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
**ตรวจที่เซิร์ฟเวอร์เท่านั้น** เฉลยอยู่ใน \`content/missions-answers.json\` อ่านด้วย dynamic import ตอนเรียกใช้จริง
ไม่ import บนหัวไฟล์ (เคยเจอบั๊กจริงว่าเฉลยหลุดเข้า \`.next/static\`)

⚠️ **ตอบผิดต้องไม่ส่ง \`explanation\` และ \`starCriteria\` กลับไป** ไม่งั้นตอบผิดรอบเดียวก็รู้เฉลย
⚠️ \`stars\` คิดจาก \`starsFor()\` ด้วยค่าจากฐานข้อมูล **ไม่รับตัวเลขจากเบราว์เซอร์** · รีเฟรชแล้ว \`attempts\` ต้องไม่รีเซ็ต
`,
      parameters: [missionParam],
      requestBody: jsonBody(
        obj({
          checkId: str('รหัสข้อ'),
          choiceIndex: int('ลำดับตัวเลือกที่กด 0-3', { minimum: 0, maximum: 3 }),
          placements: map(str('ชิ้นส่วนที่วาง'), 'ใช้กับภารกิจแบบต่อจิ๊กซอว์'),
          channel: str('ช่องทางที่ใช้ตอบข้อนี้', { enum: ['clip', 'card', 'game', 'buddy'] }),
          confidence: int('ความมั่นใจ 1-3 (ไปที่ธง calibration ไม่มีผลกับคะแนน)', { enum: [1, 2, 3] }),
        }),
        { checkId: DEMO.checkId, choiceIndex: 0, channel: 'clip', confidence: 2 },
      ),
      responses: {
        ...ok(
          'ผลการตอบ',
          obj({
            correct: bool('ถูกไหม'),
            attempts: int('ตอบมาแล้วกี่ครั้ง (นับที่เซิร์ฟเวอร์)'),
            wrong: int('ผิดไปกี่ครั้ง'),
            hintsUsed: int('ใช้คำใบ้ไปกี่ใบ'),
            stars: int('ดาวที่ได้ 0-3'),
            passed: bool('ผ่านภารกิจนี้แล้ว'),
            explanation: str('คำอธิบาย — **มีเฉพาะตอนตอบถูก**'),
            starCriteria: str('เกณฑ์ดาว — **มีเฉพาะตอนตอบถูก**'),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [404, ['mission-not-found']],
          [
            503,
            ['answers-file-missing', 'answers-file-invalid', 'answer-not-found', 'assemble-key-unavailable'],
            'ปัญหาฝั่งไฟล์เนื้อหา/เฉลย ไม่ใช่ความผิดของผู้เรียน — ดู `docs/api.md` หัวข้อ 5',
          ],
        ),
      },
    }),
  },

  '/api/mission/{id}/game': {
    post: op({
      id: 'missionGame',
      summary: 'ส่งคำตอบมินิเกมของภารกิจ',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
เกมมี 4 แบบ: \`match\` \`build\` \`sort\` (ส่ง \`placements\`) และ \`order\` (ส่ง \`order\`)

⚠️ **ตอบผิดไม่บอกว่าช่องไหนผิด** บอกแค่จำนวนที่ถูก เพื่อไม่ให้สลับทีละคู่แล้วยิงซ้ำจนครบ
`,
      parameters: [missionParam],
      requestBody: jsonBody(
        obj({
          placements: map(str('ชิ้นส่วน'), 'คู่ ช่อง → ชิ้นส่วน (ใช้กับ match/build/sort)'),
          order: arr(str('รหัสชิ้นส่วน'), 'ลำดับที่เรียง (ใช้กับ order)'),
        }),
        { placements: { 'slot-1': 'piece-a', 'slot-2': 'piece-b' } },
      ),
      responses: {
        ...ok(
          'ผลของเกม',
          obj({
            allCorrect: bool('ถูกทั้งหมดไหม'),
            correctCount: int('ถูกกี่ช่อง'),
            total: int('ทั้งหมดกี่ช่อง'),
            kind: str('`match` | `build` | `sort` | `order`'),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [404, ['mission-not-found']],
          [503, ['game-key-unavailable']],
        ),
      },
    }),
  },

  '/api/mission/{id}/learn': {
    post: op({
      id: 'missionLearn',
      summary: 'เส้นทางเรียนก่อนเข้าภารกิจ (วอร์มอัป / เลือกวิธีเรียน / ตอบ / ลงมือทำ)',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
ส่ง \`action\` ตัวใดตัวหนึ่ง (\`warmup\` \`choose\` \`answer\` \`do\` \`step\`) — สเปก \`docs/learn-path-spec.md\`

- \`warmup\` ส่ง \`answers\` 3 ตัว (เลขตัวเลือก \`-1\` ถึง \`3\`) → คืนคะแนนกับวิธีเรียนที่แนะนำ
- \`choose\` ส่ง \`mode\` (\`watch\` \`read\` \`do\` …) → สลับเส้นทางเรียนและบันทึกว่าตามคำแนะนำไหม
- \`answer\` ส่ง \`mode\` (\`watch\` | \`read\`) กับ \`answers\` เป็นคู่ รหัสข้อ → ข้อความ (ไม่เกิน 10 ข้อ) → คืนคะแนนรายข้อ
  ตรวจด้วยคำสำคัญเป็นพื้น แล้วให้ AI (Typhoon → Gemini, งบ 5 วินาที) ช่วยจับคำตอบที่ใช้คำของตัวเอง คะแนนรายข้อ = ค่าที่มากกว่า · \`source\` รายข้อ = \`typhoon\` | \`gemini\` | \`rule\`
- \`do\` ส่ง \`payload\` ของเกมลงมือทำ (รูปแบบขึ้นกับด่าน) → คืน \`score\` \`passed\` \`detail\`
- \`step\` ตรวจทีละจังหวะระหว่างเล่น (เฉพาะด่านที่มีเกมนับทีละคน/ทะเบียน)

⚠️ **ทุกวิธีเรียนเลือกได้เสมอ** ระบบแค่แนะนำ แล้วบันทึกทั้งค่าที่แนะนำกับค่าที่เลือกจริง
⚠️ **ตรวจทุกอย่างที่เซิร์ฟเวอร์ เฉลยไม่ออกไปเบราว์เซอร์** · \`studentId\` มาจากคุกกี้เท่านั้น
`,
      parameters: [missionParam],
      requestBody: jsonBody(
        obj(
          {
            action: str('`warmup` | `choose` | `answer` | `do` | `step`'),
            answers: opaque('ใช้กับ `warmup` (อาร์เรย์เลข 3 ตัว) และ `answer` (คู่ รหัสข้อ → ข้อความ)'),
            mode: str('ใช้กับ `choose` / `answer`'),
            payload: opaque('ใช้กับ `do` / `step` — รูปแบบขึ้นกับด่าน'),
          },
          { required: ['action'] },
        ),
        { action: 'warmup', answers: [1, 3, 0] },
      ),
      responses: {
        ...ok(
          'ผลของ action ที่ส่งมา (รูปแบบขึ้นกับ action)',
          obj({
            ok: bool('ใช้กับ `choose`'),
            score: int('คะแนน'),
            passed: bool('ผ่านเกณฑ์ไหม'),
            recommended: str('วิธีเรียนที่ระบบแนะนำ (`warmup`)'),
            detail: opaque('รายละเอียดผล (`do`)'),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [404, ['mission-not-found']],
          [503, ['learn-unavailable']],
        ),
      },
    }),
  },

  '/api/mission/{id}/skip': {
    post: op({
      id: 'missionSkip',
      summary: 'ข้ามภารกิจนี้',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
**ทำงานจริง ไม่ใช่ปุ่มหลอก** แต่ผลต่างกัน 3 แบบ (\`core/personalize.evaluateSkip\`)

| ผล | ดาว | นับว่าผ่านจุดประสงค์ |
|---|---|---|
| ข้ามเองโดยเข้าเงื่อนไข (ตอบข้อที่วัดเรื่องนี้ถูกตอนเช็กความเข้าใจ) | **3 ดาว** เท่าทำผ่านเอง | ผ่าน |
| ครูสั่งให้ข้าม (\`allow-skip\`) | **0 ดาว** | ผ่าน |
| ยังไม่เข้าเงื่อนไข | — | **\`403\` \`skip-not-allowed\`** |

⚠️ route นี้ **ไม่อ่าน body เลยแม้แต่ฟิลด์เดียว** ยิง \`{"allowed":true,"by":"teacher"}\` มาก็ไม่มีผล
ที่ต้องปฏิเสธแทนที่จะปล่อยให้ข้ามแล้วให้ 0 ดาว เพราะถ้าใครก็ข้ามได้ **ตัวเลข "ผ่านจุดประสงค์" ของทั้งห้องจะเชื่อไม่ได้**
`,
      parameters: [missionParam],
      requestBody: NO_BODY,
      responses: {
        ...ok(
          'ข้ามได้',
          obj({
            ok: bool('สำเร็จ'),
            skipped: bool('ข้ามแล้ว'),
            nextHref: nullable(str('หน้าถัดไปที่ควรไป')),
          }),
        ),
        ...failures(
          [401, ['unauthorized']],
          [403, ['skip-not-allowed'], 'มีเหตุผลเป็นภาษาที่เด็กอ่านได้ ไม่ใช่รหัสดิบ'],
          [404, ['mission-not-found']],
        ),
      },
    }),
  },

  '/api/mission/{id}/switch-route': {
    post: op({
      id: 'missionSwitchRoute',
      summary: 'สลับช่องทางการเรียนของภารกิจนี้',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
⚠️ **ห้ามปฏิเสธ** สลับกี่ครั้งก็ได้ ไม่หักดาว
· กดช่องทางเดิมซ้ำจะได้ \`unchanged: true\` และ**ไม่เขียนแถวใหม่**ลง \`route_changes\`
`,
      parameters: [missionParam],
      requestBody: jsonBody(
        obj({ toRoute: str('ช่องทางที่จะย้ายไป', { enum: ['clip', 'card', 'game', 'buddy'] }) }, { required: ['toRoute'] }),
        { toRoute: 'game' },
      ),
      responses: {
        ...ok(
          'สลับแล้ว',
          obj({
            accepted: bool('`true` เสมอ'),
            missionId: str('ภารกิจ'),
            fromRoute: nullable(str('ช่องทางเดิม')),
            toRoute: str('ช่องทางใหม่'),
            switchCount: int('สลับมาแล้วกี่ครั้งในภารกิจนี้'),
            unchanged: bool('กดช่องทางเดิมซ้ำ (ไม่เขียนแถวใหม่)'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['mission-not-found']]),
      },
    }),
  },

  '/api/station-b/submit': {
    post: op({
      id: 'stationBSubmit',
      summary: 'ยื่นเลือกนามสกุลโดเมนที่สถานี B',
      tags: [PLAY],
      security: STUDENT_ONLY,
      description: `
**บังคับเขียนเหตุผล** (มติ master รีวิว R7 ข้อ 8) อย่างน้อย 10 ตัวอักษร เพราะการอธิบายเหตุผลคือจุดสอนที่แรงที่สุดของเกม
เช็ก \`reasonText\` **ก่อน** ค้นหา \`tldId\` ดังนั้นส่ง tldId มั่วพร้อมเหตุผลว่างจะได้ \`reason-required\` ไม่ใช่ \`tld-not-found\`

ลำดับการตัดสินใน \`core/tld-rules.ts\`: หมวดสงวน → ต้องเป็นนิติบุคคล → ต้องใช้อักษรไทย → ลูกค้าต้องอยู่ไทย
หมวดสงวน (\`.ac.th\` \`.go.th\` \`.or.th\` \`.net.th\` \`.mi.th\`) ตัดจบก่อนทุกเงื่อนไข

⚠️ รับแค่ \`tldId\` กับ \`reasonText\` — ยัด \`shopProfile\` หรือ \`isRegisteredCompany\` มาก็ไม่มีผล
⚠️ คะแนนเหตุผลจากชั้น AI เป็น **ข้อเสนอ ครูยืนยันเสมอ** (\`needsTeacherConfirm: true\`)
`,
      requestBody: jsonBody(
        obj(
          {
            tldId: str('รหัสนามสกุลโดเมน 1-40'),
            reasonText: str('เหตุผล **อย่างน้อย 10 ตัวอักษร** ≤500'),
          },
          { required: ['tldId'] },
        ),
        { tldId: 'com', reasonText: 'ลูกค้าเป็นคนไทยแต่สั่งของออนไลน์ทั่วประเทศ จึงใช้ .com ที่คนคุ้นที่สุด' },
      ),
      responses: {
        ...ok(
          'ยื่นแล้ว (ผ่านหรือไม่ผ่านก็ `200`)',
          obj({
            accepted: bool('ผ่านเกณฑ์ไหม'),
            reason: str('เหตุผลของผลตัดสิน'),
            tldId: str('นามสกุลที่เลือก'),
            suffix: str('นามสกุลจริง เช่น `.com`'),
            domain: str('ชื่อเว็บเต็ม'),
            attempts: int('ยื่นมาแล้วกี่ครั้ง'),
            hintsUsed: int('ใช้ตัวช่วยไปกี่ใบ'),
            submissionId: nullable(uuidRef('รหัสใบงานที่บันทึก')),
            reasonScore: nullable(int('คะแนนเหตุผลที่ชั้น AI เสนอ')),
            reasonMaxScore: nullable(int('คะแนนเต็มของเหตุผล')),
            reasonFeedback: nullable(str('คำแนะนำเรื่องเหตุผล')),
            needsTeacherConfirm: bool('ครูต้องยืนยันคะแนนนี้'),
            source: str('`ai` หรือ `fallback`'),
            provider: str('ผู้ให้บริการ หรือ `rules`'),
          }),
        ),
        ...failures(
          [400, ['bad-request', 'reason-required']],
          [401, ['unauthorized']],
          [404, ['tld-not-found']],
          [409, ['no-profile']],
        ),
      },
    }),
  },
}

/** uuid ที่ใช้เป็นช่องของ response (ไม่ต้องมีตัวอย่าง เพราะไม่ใช่ช่องที่ผู้ใช้กรอก) */
function uuidRef(description: string) {
  return str(description, { format: 'uuid' })
}

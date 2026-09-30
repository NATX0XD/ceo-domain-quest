/**
 * เส้นของผู้เรียนช่วงท้ายคาบ — ด่านบอส · ผนังผลงาน · สะท้อนคิด · ใบประกาศ
 * และกลุ่มที่นักเรียนคุยกับครู — คู่หู · คำขอเปลี่ยนแผน · ประเมินตนเอง
 */
import {
  DEMO,
  FAKE,
  STUDENT_ONLY,
  STUDENT_OR_TEACHER,
  TEACHER_ONLY,
  UNAUTHORIZED,
  arr,
  bool,
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
import type { PathItemObject } from './types'

const ENDGAME = 'ท้ายคาบ — ด่านบอส ผนังผลงาน ใบประกาศ'
const TOGETHER = 'เพื่อนช่วยเพื่อน และคำขอถึงครู'

export const endgamePaths: Record<string, PathItemObject> = {
  '/api/ceo': {
    get: op({
      id: 'ceoGet',
      summary: 'สถานะใบเสนอของด่านบอส',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
⚠️ **คืนใบล่าสุดทุกชนิด รวมใบของสถานี B** จึงรายงาน \`submitted: true\` ได้ทั้งที่ยังไม่ส่งด่านบอส
แยกกันที่ \`emphasisCriterion\` (ใบของสถานี B เป็น \`null\`)

ช่องที่ใช้กับลูปแก้งาน: \`canResubmit\` · \`versionCount\` · \`revision\` · \`blockedReason\`
(\`blockedReason\` **ห้ามสื่อว่าตก** — กติกาถ้อยคำของ \`content/rubric.json\`)
`,
      responses: {
        ...ok(
          'สถานะใบเสนอ',
          obj({
            submitted: bool('มีใบงานล่าสุดแล้วไหม'),
            submission: nullable(
              obj({
                domainName: str('ชื่อเว็บ'),
                tld: str('นามสกุล'),
                format: nullable(str('รูปแบบการส่งงาน')),
                emphasisCriterion: nullable(str('ด้านที่ขอให้ประเมินหนัก — `null` = ใบของสถานี B')),
                createdAt: str('เวลาที่ส่ง'),
              }),
            ),
            canResubmit: bool('ส่งใหม่ได้ตอนนี้ไหม (คนตัดสินจริงคือ POST)'),
            versionCount: int('ส่งมาแล้วกี่ฉบับ'),
            revision: nullable(opaque('คำสั่งแก้งานของครู + ระดับ 3 ต้องทำอะไร')),
            blockedReason: nullable(str('ทำไมส่งใหม่ไม่ได้ — ห้ามสื่อว่าตก')),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'ceoSubmit',
      summary: 'ส่งใบเสนอด่านบอส (ได้คะแนนจากกฎทันที)',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
**ให้คะแนนด้วยกฎทันที แล้วฝากงานเข้าคิวให้ AI ตรวจทีหลัง** (มติ master)
ไม่แตะเน็ตเลยในคำขอนี้ จบในหลักมิลลิวินาที (ยิงจริงวัดได้ ~115 ms)

นักเรียนเลือกเองได้ 2 อย่าง: \`modeId\` รูปแบบการส่งงาน (\`bm-mode-write\`/\`voice\`/\`design\`)
และ \`focusRubricId\` ด้านที่อยากให้ประเมินหนักเป็นพิเศษ **ถ่วง 2 เท่า** (\`bm-r1\`-\`bm-r4\`)
เปลี่ยนได้จนกว่าจะกดส่ง หลังส่งแล้วล็อก เพื่อไม่ให้เปลี่ยนเกณฑ์หลังเห็นผล

⚠️ \`gradeJobQueued: false\` แปลว่าเข้าคิวไม่สำเร็จ — **ไม่กระทบคะแนนของนักเรียน** เพราะบันทึกไปก่อนแล้ว
⚠️ ตรวจความครบถ้วนที่เซิร์ฟเวอร์ กรอกไม่ครบได้ \`422\` พร้อมรายชื่อช่องที่ขาด
⚠️ คะแนนที่คืนมาเป็น **ข้อเสนอ** ทุกใบบันทึก \`needs_review = true\` จนครูกดยืนยัน
`,
      requestBody: jsonBody(
        obj(
          {
            modeId: str('รูปแบบการส่งงาน', { enum: ['bm-mode-write', 'bm-mode-voice', 'bm-mode-design'] }),
            focusRubricId: str('ด้านที่ขอให้ประเมินหนัก (ถ่วง 2 เท่า)', { enum: ['bm-r1', 'bm-r2', 'bm-r3', 'bm-r4'] }),
            fields: map(str('คำตอบของช่องนั้น ≤1000'), 'คู่ `bm-f1`…`bm-f5` → ข้อความ'),
            selfAssessment: map(str('คำตอบ ≤1000'), 'คู่ `bm-self1`…`bm-self3` → ข้อความ'),
          },
          { required: ['modeId', 'focusRubricId', 'fields', 'selfAssessment'] },
        ),
        {
          modeId: 'bm-mode-write',
          focusRubricId: 'bm-r2',
          fields: {
            'bm-f1': DEMO.shopName,
            'bm-f2': `${DEMO.domainName}.com`,
            'bm-f3': 'ลูกค้าเป็นคนไทยที่สั่งขนมออนไลน์',
            'bm-f4': 'ชื่อสั้น จำง่าย พิมพ์ไม่ผิด',
            'bm-f5': 'อยากให้คนเห็นชื่อแล้วรู้ว่าขายขนม',
          },
          selfAssessment: {
            'bm-self1': 'ตั้งชื่อให้จำง่ายได้แล้ว',
            'bm-self2': 'ยังไม่มั่นใจเรื่องเลือกนามสกุล',
            'bm-self3': 'คาบหน้าจะลองเขียนเหตุผลให้ยาวขึ้น',
          },
        },
      ),
      responses: {
        ...ok(
          'บันทึกแล้ว พร้อมคะแนนจากกฎ',
          obj({
            ok: bool('สำเร็จ'),
            submitted: bool('ส่งแล้ว'),
            submissionId: uuid('รหัสใบงาน', FAKE.submissionId),
            emphasisCriterion: str('ด้านที่ถ่วงน้ำหนัก (เก็บเป็น `dim-*`)'),
            format: str('รูปแบบการส่งงาน'),
            proposedScore: int('คะแนนที่กฎเสนอ'),
            proposedMaxScore: int('คะแนนเต็ม (15)'),
            proposedStars: int('ดาวที่เสนอ 0-3'),
            dimensions: arr(opaque('คะแนนรายด้าน 1 ด้าน'), 'คะแนนรายด้าน 4 ด้าน'),
            emphasisDimensionId: str('รหัสด้านที่ถ่วงน้ำหนัก'),
            feedback: str('คำแนะนำที่เด็กอ่านได้'),
            needsTeacherConfirm: bool('`true` เสมอ — ครูเป็นคนตัดสิน'),
            totalStars: int('ดาวรวมของทั้งคาบ'),
            gradeJobQueued: bool('ฝากเข้าคิว AI ได้ไหม (`false` ไม่กระทบคะแนน)'),
            nextHref: nullable(str('หน้าถัดไป')),
            source: str('`ai` หรือ `fallback` — ใบนี้เป็น `fallback`/`not-requested` โดยเจตนา'),
            provider: str('ผู้ให้บริการ หรือ `rules`'),
            fallbackReason: nullable(str('`not-requested` = ไม่ได้เรียกโมเดลตั้งแต่แรก')),
          }),
        ),
        ...failures(
          [400, ['bad-request', 'bad-mode', 'bad-rubric']],
          [401, ['unauthorized']],
          [409, ['already-submitted', 'revision-limit']],
          [422, ['incomplete', 'content-flagged'], '`incomplete` มี `missingFields` บอกช่องที่ขาด'],
        ),
      },
    }),
  },

  '/api/ceo/voice': {
    post: op({
      id: 'ceoVoice',
      summary: 'อัปโหลดคำตอบแบบเสียง (multipart)',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
ใช้เมื่อผู้เรียนเลือกโหมด \`bm-mode-voice\` · เก็บลง bucket **ส่วนตัว** \`voice-submissions\`

- path ในสตอเรจเป็น \`<studentId>/<uuid>.<ext>\` เสมอ (policy ของ storage อ่าน \`student_id\` จากโฟลเดอร์ชั้นแรก — **ห้ามเปลี่ยนรูปแบบโดยไม่แก้ migration**)
- รับเฉพาะ \`audio/webm\` \`audio/ogg\` \`audio/mp4\` \`audio/mpeg\` \`audio/wav\` · เกิน 2 MiB ได้ \`413\`
- **ฝั่งนักเรียนได้แค่ \`submissionId\`** ไม่มี URL ไฟล์และไม่มี path หลุดออกมา
- ⚠️ **อัปโหลดพังต้องไม่ทำให้ผู้เรียนตัน** ทุกข้อความ error ของเส้นนี้ลงท้ายด้วย "พิมพ์คำตอบแทนได้เลย"
- **เก็บ 90 วันแล้วลบอัตโนมัติ** (\`voice_submissions.expires_at\`) — เสียงเด็กเป็นข้อมูลส่วนบุคคล
`,
      requestBody: {
        required: true,
        description: '`multipart/form-data` เท่านั้น',
        content: {
          'multipart/form-data': {
            schema: obj(
              {
                audio: str('ไฟล์เสียง ≤2 MiB', { format: 'binary' }),
                durationSec: num('ความยาวเสียงเป็นวินาที'),
              },
              { required: ['audio'] },
            ),
          },
        },
      },
      responses: {
        ...ok(
          'อัปโหลดแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            durationSec: num('ความยาวที่บันทึก'),
            submissionId: uuid('รหัสใบงาน', FAKE.submissionId),
            message: str('ข้อความให้เด็กอ่าน'),
          }),
        ),
        ...failures(
          [400, ['bad-request', 'no-file']],
          [401, ['unauthorized']],
          [413, ['too-large']],
          [415, ['bad-type']],
        ),
      },
    }),
  },

  '/api/me/showcase': {
    get: op({
      id: 'myShowcase',
      summary: 'ผนังผลงานของเพื่อนในห้อง',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
**ไม่รับพารามิเตอร์ใด ๆ** \`classroomId\`/\`studentId\` มาจากคุกกี้เท่านั้น

⚠️ **ห้ามมีดาว คะแนน หรือสถานะผ่าน/ไม่ผ่านของใครในนี้เด็ดขาด** SQL function \`classroom_showcase\` เลือกมาแค่ 4 คอลัมน์
กระดานนี้ให้เห็นไอเดียเพื่อน **ไม่ใช่ตารางอันดับ** — เด็กที่ได้ 1 ดาวกับ 3 ดาวเปิดแล้วเห็นเหมือนกันทุกประการ

\`ownHidden\` = จำนวนงานของตัวเองที่ถูกตัดออก (ให้หน้าจอบอกได้ว่า "งานของเราอยู่ที่หน้าผลของฉัน")
`,
      responses: {
        ...ok(
          'ผลงานของเพื่อน',
          obj({
            count: int('จำนวนที่แสดง'),
            showcase: arr(
              obj({
                nickname: str('ชื่อเล่นเพื่อน'),
                domainName: str('ชื่อเว็บ'),
                tld: str('นามสกุล'),
                reasonText: str('เหตุผลที่เพื่อนเขียน'),
              }),
              '4 คอลัมน์นี้เท่านั้น',
            ),
            ownHidden: int('งานของตัวเองที่ถูกตัดออกไปกี่ชิ้น'),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
  },

  '/api/showcase/feedback': {
    post: op({
      id: 'showcaseFeedback',
      summary: 'เขียนคำชม/ข้อเสนอแนะให้เพื่อน',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
ผู้ส่งอ่านจากคุกกี้เท่านั้น · ผู้รับต้องอยู่ห้องเดียวกัน (ค้นด้วย \`classroomId\` ของ session) **ส่งข้ามห้องไม่ได้**
ต้องมีอย่างน้อย 1 ช่องไม่ว่าง

⚠️ **ที่นี่ไม่มีคะแนนหรือดาวของใครทั้งสิ้น** ตำราห้ามเอาผู้เรียนมาเปรียบเทียบกัน
`,
      requestBody: jsonBody(
        obj(
          {
            toNickname: str('ชื่อเล่นเพื่อนในห้องเดียวกัน 1-40', { examples: [DEMO.friendNickname] }),
            praiseText: str('คำชม ≤400'),
            suggestText: str('ข้อเสนอแนะ ≤400'),
          },
          { required: ['toNickname'] },
        ),
        { toNickname: DEMO.friendNickname, praiseText: 'ชื่อเว็บจำง่ายมาก อ่านครั้งเดียวก็จำได้' },
      ),
      responses: {
        ...ok('ส่งแล้ว', obj({ ok: bool('สำเร็จ'), toNickname: str('ชื่อเล่นผู้รับ') }), {
          ok: true,
          toNickname: DEMO.friendNickname,
        }),
        ...failures(
          [400, ['bad-request', 'empty-feedback', 'self-feedback']],
          [401, ['unauthorized']],
          [404, ['friend-not-found']],
          [409, ['save-failed']],
          [422, ['content-flagged']],
        ),
      },
    }),
  },

  '/api/reflect': {
    get: op({
      id: 'reflectGet',
      summary: 'คำตอบสะท้อนคิดที่เคยเขียนไว้',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: 'ข้อไหนยังไม่ตอบก็ข้ามได้ ถ้าไม่ส่ง `submit: true`',
      responses: {
        ...ok('คำตอบเดิม', obj({ answers: map(str('คำตอบ'), 'คู่ `reflect-N` → ข้อความ') })),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'reflectSave',
      summary: 'บันทึก/ส่งคำตอบสะท้อนคิด',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
ความยาวขั้นต่ำมาจากไฟล์เนื้อหา (\`reflect-1\`/\`reflect-3\` ≥10 ตัวอักษร · \`reflect-2\` ≥5) **ตรวจที่เซิร์ฟเวอร์**
· ตอบซ้ำ = ทับของเดิม · ส่ง \`submit: true\` แล้วจึงตรวจความยาวและเทียบกับเป้าที่ตั้งไว้
`,
      requestBody: jsonBody(
        obj({ answers: map(str('คำตอบ ≤2000'), 'คู่ `reflect-N` → ข้อความ'), submit: bool('กดส่งจริง') }, {
          required: ['answers'],
        }),
        { answers: { 'reflect-1': 'วันนี้ได้รู้ว่านามสกุลเว็บบอกประเภทธุรกิจได้' }, submit: false },
      ),
      responses: {
        ...ok(
          'บันทึกแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            submitted: bool('กดส่งแล้วหรือยัง'),
            earnedStars: int('ดาวที่ทำได้'),
            goalStars: nullable(int('ดาวที่ตั้งเป้าไว้')),
            outcome: nullable(opaque('ข้อความเทียบเป้ากับผล — ห้ามมีคำว่าตก')),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [422, ['too-short', 'content-flagged'], '`too-short` มี `minLength` และ `tooShort` บอกว่าข้อไหนสั้น'],
        ),
      },
    }),
  },

  '/api/grade/status': {
    get: op({
      id: 'gradeStatus',
      summary: 'ตรวจงานถึงไหนแล้ว (หน้าจอ poll เส้นนี้)',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
| \`state\` | ความหมาย | \`pollAfterSeconds\` |
|---|---|---|
| \`not-submitted\` | ยังไม่ได้ส่งใบเสนอ | \`0\` |
| \`waiting-teacher\` | ส่งแล้ว รอครูอ่าน | \`10\` |
| \`revise\` | ครูส่งกลับมาให้แก้ | \`10\` |
| \`confirmed\` | ครูยืนยันคะแนนแล้ว | \`0\` |

\`aiCheck\`: \`not-submitted\` · \`not-requested\` · \`in-progress\` · \`done\` · \`unavailable\`
(\`unavailable\` = AI ตรวจไม่สำเร็จครบ 3 รอบ — **ไม่กระทบผู้เรียน** คะแนนจากกฎบันทึกไปตั้งแต่ตอนกดส่ง)

⚠️ **ห้ามส่งคะแนนที่ AI เสนอออกมาทางนี้เด็ดขาด** เส้นนี้บอกแค่ "ตรวจถึงไหนแล้ว" ไม่บอกว่า AI ให้เท่าไร
⚠️ **\`pollAfterSeconds: 0\` = จบแล้ว หน้าจอหยุดถามได้** ไม่ต้องเดาจังหวะเอง
⚠️ เบาพอให้ poll ได้ — อ่านฐานข้อมูลครั้งเดียว ไม่แตะ AI ไม่แตะคิว ไม่เขียนอะไร
`,
      responses: {
        ...ok(
          'สถานะการตรวจงาน',
          obj({
            ok: bool('สำเร็จ'),
            submissionId: nullable(uuid('ใบงานที่กำลังพูดถึง', FAKE.submissionId)),
            versionCount: int('ส่งมาแล้วกี่ฉบับ'),
            state: str('`not-submitted` | `waiting-teacher` | `revise` | `confirmed`'),
            stateLabel: str('ป้ายภาษาไทยของสถานะ'),
            aiCheck: str('`not-submitted` | `not-requested` | `in-progress` | `done` | `unavailable`'),
            message: str('ข้อความที่แสดงได้ตรง ๆ (มาจากตัวเดียวกับหน้าใบประกาศ)'),
            nextHref: nullable(str('หน้าถัดไป')),
            nextLabel: nullable(str('ป้ายของปุ่มถัดไป')),
            revision: nullable(opaque('คำสั่งแก้ของครู ถ้า state = revise')),
            certificate: opaque('สถานะใบประกาศ 4 แบบ'),
            pollAfterSeconds: int('ถามอีกครั้งในกี่วินาที (`0` = หยุดถาม)'),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
  },

  '/api/survey': {
    get: op({
      id: 'surveyGet',
      summary: 'แบบสอบถามความพึงพอใจ',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: 'ส่งตัวข้อคำถามมาเฉพาะตอนครูเปิด · `scale` บอกช่วงคะแนนที่รับ',
      responses: {
        ...ok(
          'สถานะ + ข้อคำถาม',
          obj({
            open: bool('ครูเปิดให้ตอบไหม'),
            done: bool('ตอบไปแล้วหรือยัง'),
            meta: opaque('หัวเรื่องและคำชี้แจง'),
            scale: opaque('ช่วงคะแนนและป้ายของแต่ละระดับ'),
            items: arr(opaque('ข้อคำถาม 1 ข้อ'), 'ข้อคำถามทั้งชุด'),
            reason: nullable(str('ถ้ายังไม่เปิด บอกว่ารออะไร')),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'surveySubmit',
      summary: 'ส่งแบบสอบถาม',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: '⚠️ **คืน `{ ok: true }` เท่านั้น ไม่มี id ของใครเลย** — แบบสอบถามต้องไม่ผูกกลับไปหาคนตอบได้ในคำตอบ',
      requestBody: jsonBody(
        obj(
          {
            scores: map(int('คะแนน 1-5'), 'คู่ `q1`…`q8` → คะแนน **บังคับครบทุกข้อ**'),
            likeText: str('สิ่งที่ชอบ ≤500'),
            improveText: str('สิ่งที่อยากให้ปรับ ≤500'),
          },
          { required: ['scores'] },
        ),
        { scores: { q1: 5, q2: 4, q3: 5, q4: 4, q5: 5, q6: 4, q7: 5, q8: 5 }, likeText: 'ชอบตอนเลือกชื่อเว็บเอง' },
      ),
      responses: {
        ...ok('ขอบคุณที่ตอบ', obj({ ok: bool('`true` เท่านั้น') }), { ok: true }),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [403, ['not-open']],
          [409, ['already-done']],
          [422, ['incomplete', 'content-flagged']],
        ),
      },
    }),
  },

  '/api/self-assess': {
    get: op({
      id: 'selfAssessGet',
      summary: 'ตารางประเมิน 3 แหล่ง (ฉัน / ระบบ / ครู)',
      tags: [ENDGAME],
      security: STUDENT_OR_TEACHER,
      description: `
ตารางเดียวที่มี 3 คอลัมน์ — **ฉันให้ตัวเอง** · **ระบบเสนอ** · **ครูยืนยัน** ครูกับผู้เรียนเห็นตารางเดียวกัน

- **นักเรียน** ไม่ต้องส่งอะไร ได้ของตัวเอง (\`role: "student"\`)
- **ครู** ต้องส่ง query \`studentId\` และเห็นเพิ่ม \`nickname\` \`selfAwareness\` \`nextGoal\` \`nextGoalSummary\`

⚠️ **\`selfAwareness\` (ธงการรู้ตัว) มีแต่ในมุมของครู ไม่เคยส่งไปฝั่งผู้เรียน**
⚠️ **คะแนนที่ผู้เรียนให้ตัวเองไม่ถูกเอาไปรวมกับคะแนนครู และไม่มีผลต่อดาวเลย**

⚠️ **กับดักของ Postman/เครื่องมือทดสอบ** cookie jar ถือคุกกี้ทั้งสองใบพร้อมกันได้ ซึ่งเบราว์เซอร์จริงไม่เป็นแบบนั้น
เส้นนี้จะเข้าทางของ **ครู** ก่อนเสมอถ้ามีคุกกี้ครูติดไปด้วย แล้วขอ \`studentId\` → ได้ \`400\`
`,
      parameters: [
        query('studentId', '**บังคับเมื่อเรียกด้วยคุกกี้ครู** — รหัสนักเรียนในห้องของตัวเอง (uuid) · ค่าตัวอย่างเป็นของปลอม **คัดลอกจาก `board[].studentId` ในผลของ `GET /api/teacher/board`**', {
          schema: { type: 'string', format: 'uuid' },
          example: FAKE.studentId,
        }),
      ],
      responses: {
        ...ok(
          'ตารางประเมิน',
          obj({
            ok: bool('สำเร็จ'),
            role: str('`student` หรือ `teacher` — บอกว่าตอบมาในมุมไหน'),
            submissionId: nullable(uuid('ใบงานที่ประเมิน', FAKE.submissionId)),
            form: opaque('ฟอร์มให้กรอก (หัวข้อ + ระดับ 1-3)'),
            table: opaque('ตาราง 3 คอลัมน์'),
            nickname: str('**มุมครูเท่านั้น** ชื่อเล่นผู้เรียน'),
            selfAwareness: opaque('**มุมครูเท่านั้น** ธงการรู้ตัว'),
            nextGoal: nullable(opaque('**มุมครูเท่านั้น** เป้าหมายคาบหน้า')),
            nextGoalSummary: nullable(str('**มุมครูเท่านั้น** สรุปเป้าหมายเป็นบรรทัดเดียว')),
          }),
        ),
        ...failures(
          [400, ['bad-request'], 'ครูเรียกโดยไม่ส่ง `studentId` หรือส่งมาไม่ใช่ uuid'],
          [401, ['unauthorized']],
          [404, ['not-found']],
        ),
      },
    }),
    post: op({
      id: 'selfAssessSave',
      summary: 'ให้คะแนนตัวเองรายด้าน',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
⚠️ **ให้ใหม่ทับของเดิมได้ตลอด** ไม่ใช่ทำได้ครั้งเดียว
⚠️ เก็บใต้คีย์ \`dimensions\` ของ \`submissions.self_scores\` **รวมกับของเดิม ไม่เขียนทับทั้งก้อน**
เพราะคอลัมน์นั้นเก็บคำตอบพิมพ์ 3 ข้อของด่านบอสอยู่แล้ว (\`bm-self1..3\`) — เขียนทับแล้วคำตอบเด็กหาย
⚠️ ต้องครบ **4 ด้าน** ด้านละ 1-3 ไม่งั้น \`400\` \`bad-scores\`
`,
      requestBody: jsonBody(
        obj(
          {
            scores: map(int('ระดับที่ให้ตัวเอง 1-3'), 'คู่ รหัสด้าน → ระดับ **ครบ 4 ด้าน**'),
            submissionId: uuid('ใบงานที่จะผูกคะแนนนี้ — **ไม่ส่งก็ได้ ระบบใช้ใบล่าสุดของตัวเองให้เอง** (แนะนำให้ไม่ส่ง จะได้กด Execute ได้เลย)', FAKE.submissionId),
          },
          { required: ['scores'] },
        ),
        {
          scores: { 'dim-naming': 3, 'dim-tld-fit': 2, 'dim-customer-reason': 2, 'dim-business-link': 3 },
        },
      ),
      responses: {
        ...ok(
          'บันทึกแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            role: str('`student`'),
            submissionId: uuid('ใบงาน', FAKE.submissionId),
            form: opaque('ฟอร์ม'),
            table: opaque('ตาราง 3 คอลัมน์ที่อัปเดตแล้ว'),
            message: str('ข้อความให้เด็กอ่าน — **ไม่มีคำตัดสิน** (`core/self-assess.ts` มีเทสต์คุมไว้)'),
          }),
        ),
        ...failures(
          [400, ['bad-request', 'bad-scores']],
          [401, ['unauthorized']],
          [404, ['not-found']],
          [409, ['no-submission']],
        ),
      },
    }),
  },

  '/api/self-assess/next-goal': {
    get: op({
      id: 'nextGoalGet',
      summary: 'ตัวเลือกเป้าหมายคาบหน้า',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
ตัวเลือกมาจาก \`content/reflection.json\` คีย์ \`nextGoals\` — ไฟล์เนื้อหาเขียนกติกาไว้เองว่า
**ห้ามมีตัวเลือกที่เทียบกับเพื่อน** · ตัวเลือกที่มี \`allowFreeText\` เปิดช่องพิมพ์เป้าของตัวเอง (4-200 ตัวอักษร)
`,
      responses: {
        ...ok(
          'ตัวเลือกและเป้าที่เลือกไว้',
          obj({
            ok: bool('สำเร็จ'),
            prompt: str('คำถามนำ'),
            options: arr(opaque('ตัวเลือก 1 อัน'), 'ตัวเลือกทั้งหมด'),
            ownTextMaxLength: int('ความยาวสูงสุดของเป้าที่พิมพ์เอง'),
            current: nullable(opaque('เป้าที่เลือกไว้ตอนนี้')),
            summary: nullable(str('สรุปเป้าเป็นบรรทัดเดียว')),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
    post: op({
      id: 'nextGoalSave',
      summary: 'เลือกเป้าหมายคาบหน้า',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
⚠️ **ตัวเลือกสำเร็จรูปใช้ข้อความจากไฟล์เนื้อหา ไม่ใช้ที่หน้าจอส่งมา** — ยัด \`ownText\` มากับตัวเลือกที่ไม่เปิดช่องพิมพ์เองจะไม่มีผล
⚠️ ข้อความที่พิมพ์เอง **ผ่านด่านกรองคำทุกครั้ง** (ไม่ผ่าน = \`400\` \`goal-blocked\`)
· \`changeCount\` นับจำนวนครั้งที่เปลี่ยนใจ — เป็นข้อมูลการกำกับตนเอง **ไม่ใช่ความผิด**
· เป้าคาบหน้า**ไม่มีผลต่อดาวของคาบนี้**
`,
      requestBody: jsonBody(
        obj({ goalId: str('รหัสเป้าหมาย'), ownText: str('เป้าที่พิมพ์เอง (เฉพาะตัวเลือกที่เปิดให้)') }, {
          required: ['goalId'],
        }),
        { goalId: DEMO.nextGoalId },
      ),
      responses: {
        ...ok(
          'บันทึกแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            current: opaque('เป้าที่เลือกตอนนี้ (มี `changeCount`)'),
            summary: str('สรุปเป้าเป็นบรรทัดเดียว'),
            message: str('ข้อความให้เด็กอ่าน'),
          }),
        ),
        ...failures([400, ['bad-request', 'bad-goal', 'goal-blocked']], [401, ['unauthorized']]),
      },
    }),
  },

  '/api/certificate': {
    get: op({
      id: 'certificate',
      summary: 'ดาวน์โหลดเกียรติบัตร (ไฟล์ PDF)',
      tags: [ENDGAME],
      security: STUDENT_ONLY,
      description: `
⚠️ **\`studentId\` อ่านจากคุกกี้เท่านั้น route ไม่อ่าน \`searchParams\` เลย**
ถ้ารับจาก query เด็กจะโหลดใบประกาศของเพื่อนได้ทั้งห้อง

**ไม่ได้ออกให้ทุกคนอัตโนมัติ** (มติ T40) ออกให้เมื่อ **ครูยืนยันคะแนนแล้ว และได้ระดับ 3 ขึ้นไปครบทั้ง 4 ด้าน**
· **ไม่ผูกกับจำนวนดาว** · ยังไม่เข้าเกณฑ์ได้ \`403\` \`not-yet\` ที่บอกว่าเหลือด้านไหนและต้องเพิ่มอะไร

⚠️ **กติกาถ้อยคำ** ข้อความทุกสถานะห้ามใช้คำว่า ไม่ผ่าน · ตก · ล้มเหลว · ยังไม่ได้มาตรฐาน
`,
      responses: {
        ...fileResponse(200, 'ไฟล์ PDF ของเจ้าของคุกกี้', 'application/pdf', {
          'content-disposition': 'ชื่อไฟล์ `เกียรติบัตร-<ชื่อเล่น>.pdf` ส่งแบบ RFC 5987 เพื่อให้ชื่อไทยไม่เพี้ยน',
          'cache-control': '`private, no-store` — ข้อมูลรายบุคคล ห้ามให้ proxy หรือ CDN เก็บไว้แจกซ้ำ',
        }),
        ...failures(
          [401, ['unauthorized']],
          [
            403,
            ['not-yet'],
            'มี `status` (`not-submitted` | `pending-teacher` | `keep-going`) · `passedCount` · `missing[]` (พร้อม `whatGetsYouThere` ของระดับ 3) · `nextHref`',
          ],
        ),
      },
    }),
  },

  '/api/buddy': {
    post: op({
      id: 'buddyAsk',
      summary: 'ขอให้เพื่อนมาช่วยภารกิจนี้',
      tags: [TOGETHER],
      security: STUDENT_ONLY,
      description: `
**เกณฑ์การเป็นผู้ช่วย ครบทุกข้อเท่านั้น** (\`core/buddy.ts\`)
ผ่านภารกิจนั้นแล้ว (หรือข้ามเพราะตอบถูกตั้งแต่ตอนเช็ก) · ใช้งานใน **60 วินาที**ที่ผ่านมา · ไม่ได้อยู่ในด่านบอส ·
ไม่ได้กดเรียกครูค้างไว้ · ไม่ได้ปิดรับคำขอ · กำลังช่วยอยู่ไม่เกิน 2 คน · ไม่ได้เพิ่งปฏิเสธผู้ขอคนนี้ไปไม่ถึง 5 นาที

**คะแนนจัดลำดับ** ผ่าน 3 ดาว +3 · ข้ามเพราะมั่นใจ +2 · ผ่าน 2 ดาว +1 · ชอบเรียนกับเพื่อน +1 · นั่งโซนเดียวกัน +1 ·
**ช่วยไปแล้วกี่ครั้ง −1 ต่อครั้ง** (กระจายภาระ) · คะแนนเท่ากันตัดสินด้วยลำดับคงที่ **ไม่สุ่ม** จึงตรวจย้อนได้

⚠️ **ยิงคำขอทีละคน ไม่ประกาศทั้งห้อง** คนที่ถูกถามมีเวลาตอบ 60 วินาที ปฏิเสธ/หมดเวลาแล้วยิงต่อคนถัดไปเอง สูงสุด 3 คน
⚠️ **ผู้ขอมีใบค้างได้ครั้งละ 1 ใบ** กดซ้ำได้ \`200\` พร้อมใบเดิม **ไม่ใช่ \`409\`** เพราะการกดซ้ำไม่ใช่ความผิดของเด็ก
⚠️ **ไม่มีใครเข้าเกณฑ์ = ไม่เปิดใบ** แต่ต้องได้การ์ดคู่คิด (\`showCard: true\`) + \`teacherHelpAvailable: true\` ทันที ห้ามปล่อยจอค้าง
⚠️ **ไม่มี \`studentId\` ของเพื่อนคนไหนในคำตอบเลย มีแต่ชื่อเล่น**
`,
      requestBody: jsonBody(obj({ missionId: str('`m1`-`m4`', { examples: [DEMO.missionId] }) }, { required: ['missionId'] }), {
        missionId: DEMO.missionId,
      }),
      responses: {
        ...ok(
          'เปิดใบคำขอ หรือได้การ์ดคู่คิดแทน',
          obj({
            ok: bool('สำเร็จ'),
            kind: str('`buddy` (เปิดใบแล้ว) หรือ `thinking-partner` (ไม่มีใครเข้าเกณฑ์)'),
            headline: str('พาดหัวที่แสดงบนจอ'),
            request: nullable(
              obj({
                id: uuid('รหัสใบคำขอ', FAKE.requestId),
                status: str('สถานะใบ'),
                waitingFor: nullable(obj({ nickname: str('ชื่อเล่นคนที่กำลังถูกถาม — **ไม่มี studentId**') })),
                helperNickname: nullable(str('ชื่อเล่นคนที่รับช่วย')),
              }),
            ),
            showCard: bool('ให้โชว์การ์ดคู่คิดไหม'),
            teacherHelpAvailable: bool('ปุ่มเรียกครูใช้ได้ไหม'),
            consideredCount: int('พิจารณาเพื่อนไปกี่คน'),
            reason: nullable(str('ทำไมได้ผลแบบนี้')),
          }),
        ),
        ...failures(
          [400, ['bad-request']],
          [401, ['unauthorized']],
          [404, ['student-not-found']],
          [503, ['buddy-request-failed']],
        ),
      },
    }),
    get: op({
      id: 'buddyState',
      summary: 'ใบคำขอของฉัน + คำขอที่คนอื่นส่งมา',
      tags: [TOGETHER],
      security: STUDENT_ONLY,
      description: `
หน้าจอ poll เส้นนี้ · \`incoming[]\` = แผ่นคำขอที่คนอื่นยิงมาถึงเรา (ตอบได้ที่ \`POST /api/buddy/respond\`)
· \`helpedCount\` = **ตราพี่เลี้ยง** ไม่ใช่ดาว **ไม่เอาไปเทียบกับเพื่อนและไม่ขึ้นอันดับ**
`,
      parameters: [query('screen', 'หน้าที่เปิดอยู่ (ไม่บังคับ) — ใช้ต่อสัญญาณว่ายังนั่งอยู่')],
      responses: {
        ...ok(
          'สถานะคู่หูของคนนี้',
          obj({
            ok: bool('สำเร็จ'),
            myRequest: nullable(opaque('ใบที่ตัวเองเปิดไว้')),
            incoming: arr(opaque('คำขอที่ส่งมาถึงเรา (มี `offerId` กับชื่อเล่นผู้ขอ)'), 'คำขอที่รอเราตอบ'),
            helping: nullable(opaque('กำลังช่วยใครอยู่')),
            helpedCount: int('ตราพี่เลี้ยง — ช่วยสำเร็จมาแล้วกี่ครั้ง'),
          }),
        ),
        ...UNAUTHORIZED,
      },
    }),
  },

  '/api/buddy/respond': {
    post: op({
      id: 'buddyRespond',
      summary: 'รับ/ปฏิเสธคำขอช่วยเพื่อน',
      tags: [TOGETHER],
      security: STUDENT_ONLY,
      description: `
⚠️ **ตอบแทนคนอื่นถูกกันที่ฐานข้อมูล** \`helper_id\` อยู่ในเงื่อนไข \`UPDATE\` ไม่ใช่เช็กแค่ที่ชั้น route
ปฏิเสธแล้วระบบยิงต่อคนถัดไปเอง (\`passedOn\`)
`,
      requestBody: jsonBody(
        obj({ offerId: uuid('รหัสคำขอ — **คัดลอกจาก `incoming[].offerId` ในผลของ `GET /api/buddy`**', FAKE.offerId), accept: bool('รับช่วยไหม') }, {
          required: ['offerId', 'accept'],
        }),
        { offerId: FAKE.offerId, accept: true },
      ),
      responses: {
        ...ok(
          'ตอบแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            accepted: bool('รับหรือปฏิเสธ'),
            missionId: nullable(str('ภารกิจที่ต้องไปช่วย')),
            requesterNickname: nullable(str('ชื่อเล่นผู้ขอ')),
            passedOn: bool('ปฏิเสธแล้วระบบยิงต่อคนถัดไปได้ไหม'),
            message: str('ข้อความให้ผู้ช่วยอ่าน'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [409, ['offer-not-open']]),
      },
    }),
  },

  '/api/buddy/close': {
    post: op({
      id: 'buddyClose',
      summary: 'ปิดใบคำขอ (ยกเลิก หรือช่วยจบแล้ว)',
      tags: [TOGETHER],
      security: STUDENT_ONLY,
      description: `
\`action: "done"\` = ช่วยจบแล้ว ผู้ช่วยได้ตราพี่เลี้ยง +1 · \`action: "cancel"\` = ผู้ขอยกเลิกเอง
⚠️ **ปิดใบของคนอื่นถูกกันที่ฐานข้อมูล** \`requester_id\` อยู่ในเงื่อนไข \`UPDATE\` · ปิดซ้ำได้ \`409\`
`,
      requestBody: jsonBody(
        obj(
          {
            requestId: uuid('ใบที่จะปิด — **คัดลอกจาก `myRequest.id` ในผลของ `GET /api/buddy`**', FAKE.requestId),
            action: str('ปิดแบบไหน', { enum: ['cancel', 'done'] }),
            feedback: str('ช่วยแล้วเป็นยังไง', { enum: ['helpful', 'ok'] }),
            passedAfter: bool('หลังเพื่อนช่วยแล้วทำผ่านไหม'),
          },
          { required: ['requestId', 'action'] },
        ),
        { requestId: FAKE.requestId, action: 'done', feedback: 'helpful', passedAfter: true },
      ),
      responses: {
        ...ok('ปิดแล้ว', obj({ ok: bool('สำเร็จ'), status: str('สถานะสุดท้ายของใบ'), message: str('ข้อความ') })),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [409, ['request-not-open']]),
      },
    }),
  },

  '/api/plan-request': {
    post: op({
      id: 'planRequestCreate',
      summary: 'นักเรียนขอเปลี่ยนแผนการเรียน (ถึงครู)',
      tags: [TOGETHER],
      security: STUDENT_ONLY,
      description: `
**ค่าที่ขอได้** \`level\` 1-3 · \`channel\` \`clip\`/\`card\`/\`game\`/\`buddy\` · \`time\` **1-15 นาที** · \`skip\` ไม่ต้องมีค่า
กติกาอยู่ที่ \`core/plan-request.ts\` ที่เดียว และ**ค่าที่ครูให้ถูกตรวจด้วยกติกาตัวเดียวกัน**

⚠️ **\`reason\` บังคับ** 1-500 ตัวอักษร และ**ผ่านด่านกรองคำทุกครั้ง** ระดับ 2-3 บันทึกธงถึงครูในคำขอเดียวกัน
⚠️ **ใบซ้ำเป็น \`409\` ไม่ใช่ \`500\`** — unique index \`plan_requests_one_pending_idx\` เด้ง \`23505\` แล้ว route แปลงให้
`,
      requestBody: jsonBody(
        obj(
          {
            kind: str('ขอเรื่องอะไร', { enum: ['level', 'channel', 'skip', 'time'] }),
            requestedValue: str('ค่าที่ขอ — ตัวเลขหรือข้อความตาม `kind` (`skip` ไม่ต้องส่ง)'),
            missionId: str('ภารกิจที่เกี่ยวข้อง (ไม่บังคับ)', { examples: [DEMO.missionId] }),
            reason: str('เหตุผล **บังคับ** 1-500 ตัวอักษร'),
          },
          { required: ['kind', 'reason'] },
        ),
        { kind: 'level', requestedValue: 3, reason: 'อ่านคำใบ้แล้วยังไม่เข้าใจ อยากได้ตัวช่วยเยอะขึ้น' },
      ),
      responses: {
        ...ok(
          'ส่งคำขอแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            request: obj({
              id: uuid('รหัสใบคำขอ', FAKE.requestId),
              kind: str('ขอเรื่องอะไร'),
              missionId: nullable(str('ภารกิจ')),
              requestedValue: nullable(str('ค่าที่ขอ — **ไม่เคยถูกเขียนทับด้วยค่าที่ครูให้**')),
              reason: str('เหตุผลที่เขียน'),
              status: str('`pending` ตอนเพิ่งสร้าง'),
              createdAt: str('เวลาที่ขอ'),
              summary: str('สรุปคำขอเป็นบรรทัดเดียว'),
            }),
            message: str('ข้อความบอกเด็กว่ารอครูตอบ'),
          }),
        ),
        ...failures(
          [400, ['bad-request', 'bad-value', 'reason-blocked']],
          [401, ['unauthorized']],
          [409, ['duplicate-request']],
        ),
      },
    }),
    get: op({
      id: 'planRequestList',
      summary: 'รายการคำขอเปลี่ยนแผน (คนละมุมตามบทบาท)',
      tags: [TOGETHER],
      security: STUDENT_OR_TEACHER,
      description: `
- **นักเรียน** ได้เฉพาะใบของตัวเอง (\`role: "student"\`) มี \`answer\` เป็นภาษาคน · **เมิน \`classroomId\` ที่แนบมา**
- **ครู** ต้องส่ง \`classroomId\` (uuid) ได้ใบของทั้งห้องพร้อม \`nickname\` และ \`reason\` เต็ม

⚠️ **ครูคนอื่นขอดูห้องนี้ได้ \`404\`** (เดิมเป็น \`200\` + รายการว่าง แก้แล้วในรอบ T67)
⚠️ กับดักเดียวกับ \`GET /api/self-assess\` — cookie jar ที่ถือ 2 ใบจะเข้าทางครูก่อนเสมอ
`,
      parameters: [
        query('classroomId', '**บังคับเมื่อเรียกด้วยคุกกี้ครู** (uuid) · **คัดลอกจาก `GET /api/teacher/classroom`**', {
          schema: { type: 'string', format: 'uuid' },
          example: FAKE.classroomId,
        }),
        query('all', 'ครู: `1` = เอาใบที่ตอบแล้วมาด้วย', { schema: { type: 'string', enum: ['1'] } }),
      ],
      responses: {
        ...ok(
          'รายการคำขอ',
          obj({
            ok: bool('สำเร็จ'),
            role: str('`student` หรือ `teacher`'),
            pendingCount: int('**มุมครูเท่านั้น** ใบที่ยังไม่ตอบ'),
            requests: arr(opaque('คำขอ 1 ใบ (มุมครูมี `nickname` มุมนักเรียนมี `answer`)'), 'รายการคำขอ'),
          }),
        ),
        ...failures([400, ['bad-request']], [401, ['unauthorized']], [404, ['not-found']]),
      },
    }),
  },

  '/api/plan-request/respond': {
    post: op({
      id: 'planRequestRespond',
      summary: 'ครูตอบคำขอเปลี่ยนแผน',
      tags: [TOGETHER],
      security: TEACHER_ONLY,
      description: `
⚠️ **\`changed\` โดยไม่บอกว่าให้อะไรแทน = \`400\` \`granted-value-required\`**
เด็กที่ได้คำตอบว่า "ครูให้แบบอื่น" แล้วไม่รู้ว่าทำอะไรต่อ แย่กว่าถูกปฏิเสธตรง ๆ
⚠️ **เก็บทั้งสิ่งที่ขอ (\`requested_value\`) และสิ่งที่ได้จริง (\`granted_value\`) ห้ามเขียนทับกัน**
⚠️ **ตอบไปแล้วตอบซ้ำไม่ได้ (\`409\`)** กันครู 2 คนกดพร้อมกันแล้วคำตอบของคนแรกถูกทับ
⚠️ ค่าที่ครูให้ถูกตรวจด้วย **กติกาตัวเดียวกับฝั่งนักเรียน** (\`core/plan-request.ts\`) ให้เกินกติกาไม่ได้
`,
      requestBody: jsonBody(
        obj(
          {
            requestId: uuid('ใบที่จะตอบ — **คัดลอกจาก `requests[].id` ในผลของ `GET /api/plan-request?classroomId=…`**', FAKE.requestId),
            status: str('ตอบว่าอะไร', { enum: ['approved', 'rejected', 'changed'] }),
            response: str('ข้อความถึงเด็ก ≤300'),
            grantedValue: str('ให้อะไรแทน — **บังคับเมื่อ `status` = `changed`**'),
            kind: str('ชนิดของคำขอ (ช่วยตรวจค่า)', { enum: ['level', 'channel', 'skip', 'time'] }),
          },
          { required: ['requestId', 'status'] },
        ),
        { requestId: FAKE.requestId, status: 'changed', grantedValue: 2, response: 'ให้ระดับ 2 ก่อน ถ้ายังติดมาบอกครูได้' },
      ),
      responses: {
        ...ok(
          'ตอบแล้ว',
          obj({
            ok: bool('สำเร็จ'),
            request: opaque('ใบคำขอหลังตอบ (มีทั้ง `requestedValue` และ `grantedValue`)'),
            answer: str('คำตอบที่เด็กจะเห็น เป็นภาษาคน'),
          }),
        ),
        ...failures(
          [400, ['bad-request', 'bad-value', 'granted-value-required']],
          [401, ['unauthorized']],
          [409, ['request-not-open']],
        ),
      },
    }),
  },
}

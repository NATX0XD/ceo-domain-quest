/**
 * เอกสาร OpenAPI 3.1 ของ Digital Biz Quest — **ของจริงอยู่ที่นี่ ไม่ใช่ไฟล์ .json ที่ commit ไว้**
 *
 * ## ทำไมเป็นไฟล์ TypeScript ไม่ใช่ `openapi.json` หรือ `openapi.yaml`
 *
 * 1. **`tsc` จับพิมพ์ผิดให้** — ลืม `security` ลืม `description` หรือใส่รหัส error ที่ไม่มีจริง
 *    จะตกตั้งแต่ `npm run typecheck` ไม่ใช่ตกตอนเปิดหน้าเว็บแล้วเห็นช่องว่าง
 * 2. **ไม่มีไฟล์สองใบให้หลุดกัน** — หน้า `/api-docs` เสิร์ฟจากโมดูลนี้ตรง ๆ
 *    ไม่มีขั้น "generate แล้วลืม commit"
 * 3. **เทสต์ import ไปเทียบกับ `app/api/**` ได้** ดู `lib/openapi/spec.test.ts`
 *    ใครเพิ่ม route ใหม่แล้วลืมเขียนเอกสาร → `npm test` แดง
 *
 * ต้องการไฟล์ `.json` จริง ๆ (เอาไปเปิดใน Swagger Editor / import เข้า Postman):
 * `npx tsx scripts/openapi-json.ts > /tmp/openapi.json`
 *
 * ## กติกาของไฟล์นี้
 *
 * 🔒 **ห้ามมีค่าลับ** ไม่มีคีย์ ไม่มี token ไม่มีรหัสผ่าน ไม่มี uuid ของแถวจริง
 *    ค่าตัวอย่างทุกตัวอยู่ใน `FAKE` ของ `builders.ts` และเป็นค่าที่ไม่มีในฐานข้อมูล
 *    มีเทสต์ไล่ตรวจทั้งเอกสารไว้อีกชั้น (`spec.test.ts`)
 *
 * ⚠️ นำเข้าแบบ path ตรง ไม่ใช่ alias `@/` เพราะโปรเจกต์ยังไม่มี vitest config ที่รู้จัก alias
 */
import { STUDENT_SCHEME, TEACHER_SCHEME, WORKER_SCHEME, API_ERROR_SCHEMA } from './builders'
import { endgamePaths } from './paths-endgame'
import { studentPaths } from './paths-student'
import { teacherPaths } from './paths-teacher'
import type { OpenApiDocument } from './types'

/**
 * รุ่นของ **เอกสาร** ไม่ใช่รุ่นของแอป
 * ขยับเลขนี้เมื่อสัญญาของ API เปลี่ยนแบบที่ทำให้ของเดิมพัง
 */
export const API_DOC_VERSION = '1.0.0'

export const openApiSpec: OpenApiDocument = {
  openapi: '3.1.1',
  info: {
    title: 'Digital Biz Quest API',
    version: API_DOC_VERSION,
    summary: 'API ทั้งหมดของสื่อการสอนวิชา 21910-2002 อินเทอร์เน็ตในงานธุรกิจดิจิทัล',
    description: `
สื่อการสอน **"ภารกิจโดเมนของร้านฉัน"** — นักเรียนเปิดร้านของตัวเอง เลือกชื่อเว็บและนามสกุลโดเมน
โดยมีครูเป็นคนตัดสินคะแนนเสมอ

## ตัวตนของผู้เรียก — มี 2 คุกกี้ ไม่มี Bearer token

| คุกกี้ | ออกให้โดย | ใช้กับ | อายุ |
|---|---|---|---|
| \`dbq_student\` | \`POST /api/join\` · \`POST /api/join/resume\` | ทุก endpoint ของนักเรียน | 6 ชั่วโมง |
| \`dbq_teacher\` | \`POST /api/teacher/login\` | \`/api/teacher/*\` | 12 ชั่วโมง |

ทั้งสองใบเป็น JWT HS256 ลงนามด้วย \`SESSION_SECRET\` เป็น **\`httpOnly\`** JavaScript ฝั่งหน้าเว็บอ่านไม่ได้
จึงขโมย token ไปสวมรอยไม่ได้ · และ **ตรวจ \`role\` แยกกัน** — token ของนักเรียนที่ลายเซ็นถูก
ใช้แทนคุกกี้ครูไม่ได้ เพราะ \`verifyTeacherSession()\` เช็ก \`role === 'teacher'\` ด้วย

## ⚠️ ต้องมีห้องสาธิตในเครื่องก่อน

\`\`\`bash
npx tsx scripts/seed-demo.ts    # ครู 1 คน + ห้อง QUEST9 + หุ่น 20 คน (รันซ้ำได้)
\`\`\`

**ตัวอย่างในหน้านี้ใช้บัญชีและข้อมูลของชุดสาธิตชุดนั้นทั้งหมด** ยังไม่ได้ seed = กดลองยิงแล้วได้
\`404 room-not-found\` หรือ \`401 invalid-credentials\` ทั้งที่ระบบไม่ได้พัง

🔒 บัญชีครูสาธิตกับ PIN ของหุ่น **ไม่ใช่ความลับ** เป็นค่าคงที่ของเครื่องพัฒนา (\`lib/db/demo-seed.ts\`)
ส่วนของลับจริง (\`SESSION_SECRET\` · \`GRADE_WORKER_SECRET\` · คีย์ AI · \`service_role\`)
**ไม่มีค่าจริงอยู่ในเอกสารนี้แม้แต่ตัวเดียว** มีแต่คำอธิบายว่าคืออะไร

### กดลองยิงในหน้านี้ — ส่วนใหญ่กด Execute ได้เลยไม่ต้องพิมพ์อะไรเพิ่ม

เบราว์เซอร์เก็บคุกกี้ให้เอง ไม่ต้องก๊อป token ไปไหน

1. **เป็นนักเรียน** — ยิง \`POST /api/join/resume\` (ตัวอย่างเป็นหุ่น \`มิ้นท์\` + PIN \`1234\`) **กดซ้ำได้ไม่จำกัด**
   จากนั้นเส้นของนักเรียนยิงได้หมด · อยากเป็น "คนใหม่" ที่ยังไม่ได้ตั้งค่าร้าน ใช้ \`POST /api/join\` แทน
   (ชื่อเล่นหนึ่งชื่อใช้ได้ครั้งเดียว กดรอบสองได้ \`409\` ให้เปลี่ยนเลขท้ายชื่อ)
2. **เป็นครู** — ยิง \`POST /api/teacher/login\` หนึ่งครั้ง แล้วเส้น \`/api/teacher/*\` ยิงได้หมด

**ที่ยังต้องพิมพ์เอง คือ id ที่เกิดใหม่ทุกครั้ง** (\`classroomId\` \`sessionId\` \`submissionId\` \`studentId\` \`flagId\` …)
ค่าตัวอย่างของช่องพวกนี้เป็น uuid ปลอมโดยเจตนา และ**ทุกช่องเขียนไว้ในคำอธิบายว่าคัดลอกค่าจริงมาจากผลของเส้นไหน**

⚠️ **หน้านี้เก็บคุกกี้ทั้งสองใบไว้พร้อมกันได้** ซึ่งเบราว์เซอร์ของเด็กจริงไม่เป็นแบบนั้น
เส้นสองบทบาท (\`GET /api/plan-request\` · \`GET /api/self-assess\`) จะ**เข้าทางของครูก่อนเสมอ**
ถ้ามีคุกกี้ครูติดอยู่ — เป็นพฤติกรรมที่ถูกต้อง ไม่ใช่บั๊ก

## กฎที่ทุก endpoint เคารพ

1. **\`studentId\` / \`teacherId\` อ่านจากคุกกี้เท่านั้น ห้ามเชื่อ id จาก body หรือ query**
   ไม่มี schema ของ route ไหนมีช่องนี้เลย ค่าที่ส่งมาจึงถูก zod ตัดทิ้งเงียบ ๆ — ได้ \`200\` ไม่ใช่ \`400\`
2. **\`classroomId\` / \`submissionId\` รับจากภายนอกได้** แต่ทุกคำสั่งใส่ \`teacher_id = <คนที่ถือคุกกี้>\`
   ลงไปใน query เดียวกัน ไม่ใช่ "ค้นก่อนแล้วเช็กทีหลัง" · ไม่ใช่เจ้าของได้ **\`404\` ไม่ใช่ \`403\`**
   โดยเจตนา เพราะ \`403\` เท่ากับบอกว่า id นี้มีอยู่จริงแต่ไม่ใช่ของคุณ
3. **ค่าที่ชี้ผลลัพธ์คิดที่เซิร์ฟเวอร์** ตัวนับ \`attempts\`/\`hintsUsed\` และ \`stars\` ไม่รับตัวเลขจากเบราว์เซอร์
4. **เฉลยห้ามหลุดไปฝั่งเบราว์เซอร์** ตอบผิดต้องไม่ส่ง \`explanation\` \`starCriteria\` \`wrongIds\`
   หรือตำแหน่งช่องที่ผิดในเกม
5. **คะแนนจาก AI เป็นข้อเสนอ ครูยืนยันเสมอ** ทุกใบบันทึก \`needs_review = true\` จนครูกด
6. **รูป error เดียวกันทุกเส้น** \`{ error, message }\` (+ ฟิลด์เสริม) · ทุก route ตั้ง
   \`runtime = 'nodejs'\` และ \`dynamic = 'force-dynamic'\`

## ระบบต้องเดินได้แม้ AI ล่ม — นี่คือจุดขาย ไม่ใช่ข้อแก้ตัว

เส้นที่เรียกชั้น AI (\`/api/hint\` · \`/api/station-b/submit\` · \`/api/ceo\` · \`/api/dome\`) คืน
\`source\` (\`ai\` หรือ \`fallback\`) · \`provider\` · \`fallbackReason\` ติดมาเสมอ
**\`fallback\` คือผลที่ถูกต้อง ไม่ใช่ error** เน็ตโรงเรียนไม่แน่นอนจริง เส้นทางกฎล้วนจึงเป็นทางหลักที่ต้องเดินได้เสมอ

## เอกสารที่ละเอียดกว่านี้

- \`docs/api.md\` — เหตุผลการออกแบบ ประวัติบั๊ก และกับดักตอนเขียนเทสต์
- \`postman/digital-biz-quest.postman_collection.json\` — ยิงจริงทั้งชุด 381 คำขอ (มีโฟลเดอร์ "ทดสอบว่าโกงไม่ได้")
`.trim(),
    license: { name: 'ใช้ในการเรียนการสอน' },
  },

  servers: [{ url: '/', description: 'เซิร์ฟเวอร์เดียวกับหน้านี้ (คุกกี้จึงส่งไปให้เอง)' }],

  tags: [
    { name: 'เข้าห้องเรียน', description: 'ขอตัวตน · กลับเข้าห้อง · ดูข้อมูลตัวเอง' },
    { name: 'ก่อนเรียน และการเลือกวิธีเรียน', description: 'แบบทดสอบ · เช็กความเข้าใจ · ผู้เรียนเลือกช่องทางและระดับของตัวเอง' },
    { name: 'เล่นภารกิจ', description: 'ตั้งค่าร้าน · คำใบ้ · ตอบข้อ · มินิเกม · สถานี B · เรื่องราวเฉพาะคน' },
    { name: 'ท้ายคาบ — ด่านบอส ผนังผลงาน ใบประกาศ', description: 'ส่งใบเสนอ · ประเมินตนเอง · สะท้อนคิด · เกียรติบัตร' },
    { name: 'เพื่อนช่วยเพื่อน และคำขอถึงครู', description: 'คู่หูครบวง · คำขอเปลี่ยนแผน 2 ฝั่ง' },
    { name: 'ครู', description: 'แผงโค้ช · คุมคาบ · ยืนยันคะแนน · รายงาน · ส่งออกข้อมูล' },
    { name: 'ระบบและคิวตรวจงาน', description: 'worker ที่ตรวจงานด้วย AI เบื้องหลัง' },
  ],

  components: {
    securitySchemes: {
      [STUDENT_SCHEME]: {
        type: 'apiKey',
        in: 'cookie',
        name: 'dbq_student',
        description:
          'คุกกี้ httpOnly ของนักเรียน — ได้มาจาก `POST /api/join` หรือ `POST /api/join/resume` เบราว์เซอร์ส่งให้เองทุกคำขอ **ไม่ต้องกรอกที่ปุ่ม Authorize** (และกรอกไม่ได้ เพราะ httpOnly)',
      },
      [TEACHER_SCHEME]: {
        type: 'apiKey',
        in: 'cookie',
        name: 'dbq_teacher',
        description:
          'คุกกี้ httpOnly ของครู — ได้มาจาก `POST /api/teacher/login` เบราว์เซอร์ส่งให้เองทุกคำขอ **ไม่ต้องกรอกที่ปุ่ม Authorize**',
      },
      [WORKER_SCHEME]: {
        type: 'apiKey',
        in: 'header',
        name: 'x-worker-secret',
        description:
          'ทางเข้าของ worker คิวตรวจงานที่ไม่ใช่ครู ต้องตรงกับ `GRADE_WORKER_SECRET` ในเซิร์ฟเวอร์ · **ไม่ตั้งค่า = ทางนี้ไม่ผ่านตั้งแต่ต้น** (ไม่ใช่ "ไม่ตั้ง = ผ่านหมด") · 🔒 ห้ามใส่ค่าจริงลงเอกสารหรือ git',
      },
    },
    schemas: { ApiError: API_ERROR_SCHEMA },
  },

  paths: { ...studentPaths, ...endgamePaths, ...teacherPaths },
}
